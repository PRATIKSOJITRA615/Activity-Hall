/*  Seat geometry — mirrors the physical hall layout */

export const HALL_ROWS = {
  Deluxe: [
    ["B", 34], // 17 pairs (B1-2 to B33-34)
    ["C", 36], // 18 pairs (C1-2 to C35-36)
    ["D", 38], // 19 pairs (D1-2 to D37-38)
    ["E", 40], // 20 pairs (E1-2 to E39-40)
    ["F", 42], // 21 pairs (F1-2 to F41-42) - Reserved for new members
  ],
  Premium: [
    ["G", 44], // 22 pairs (G1-2 to G43-44)
    ["H", 46], // 23 pairs (H1-2 to H45-46)
    ["I", 42], // 21 pairs (I1-2 to I41-42)
    ["J", 44], // 22 pairs (J1-2 to J43-44)
    ["K", 46], // 23 pairs (K1-2 to K45-46)
    ["L", 48], // 24 pairs (L1-2 to L47-48)
  ],
};

export function buildSeatStructure(category) {
  const rows = [];
  const flat = [];
  HALL_ROWS[category].forEach(([row, count]) => {
    const labels = [];
    for (let n = 1; n < count; n += 2) {
      const label = `${row}${n}-${row}${n + 1}`;
      labels.push(label);
      flat.push(label);
    }
    rows.push({ row, labels });
  });
  return { flat, rows, total: flat.length };
}

/**
 * Determines if a seat index in a row is considered a Corner seat (outer ~25% edges)
 * or a Center seat (middle ~50%).
 */
export function isSeatCorner(seatInRow, rowLen) {
  const cutoff = Math.max(1, Math.floor(rowLen * 0.25));
  return seatInRow < cutoff || seatInRow >= rowLen - cutoff;
}

/**
 * Extracts row, column index, and zone (corner vs center) for a flat index.
 */
export function getSeatInfo(flatIndex, struct) {
  let offset = 0;
  for (let r = 0; r < struct.rows.length; r++) {
    const rowLen = struct.rows[r].labels.length;
    if (flatIndex >= offset && flatIndex < offset + rowLen) {
      const seatInRow = flatIndex - offset;
      const isCorner = isSeatCorner(seatInRow, rowLen);
      return {
        rowIndex: r,
        rowLetter: struct.rows[r].row,
        seatInRow,
        rowLen,
        isCorner,
        zone: isCorner ? "corner" : "center",
        flatIndex,
        label: struct.flat[flatIndex],
        rowOffset: offset,
      };
    }
    offset += rowLen;
  }
  return {
    rowIndex: 0,
    rowLetter: struct.rows[0].row,
    seatInRow: 0,
    rowLen: struct.rows[0].labels.length,
    isCorner: true,
    zone: "corner",
    flatIndex: 0,
    label: struct.flat[0],
    rowOffset: 0,
  };
}

/**
 * Utility: Fisher-Yates array shuffle for fair random allocation.
 */
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[j], shuffled[i]] = [shuffled[i], shuffled[j]];
  }
  return shuffled;
}

/**
 * Smart Fair Rotation with Continuous Seating (Zero Gaps in Between):
 * 1. All active members occupy continuous seats from 0 to N-1 (empty seats only at the very end).
 * 2. Premium rotates across active filled rows (Row G -> Row H -> Row I ... -> Row G).
 * 3. Deluxe rotates across active filled rows (Row B -> Row C -> Row D -> Row E -> Row B, Row F reserved).
 * 4. Members who were in Corner seats are prioritized for Center seats in the next row.
 * 5. Members who were in Center seats are rotated to Corner/outer seats in the next row.
 * 6. Seats within each zone are fairly shuffled for a fresh and balanced experience.
 */
export function computePreview(members, isFirstEvent, structures) {
  const preview = { Deluxe: [], Premium: [] };

  ["Deluxe", "Premium"].forEach((cat) => {
    const struct = structures[cat];
    const active = members.filter((m) => m.category === cat && m.status === "active");
    const N = active.length;

    if (N === 0) {
      preview[cat] = [];
      return;
    }

    const totalNumRows = struct.rows.length;
    const flat = struct.flat;

    // Compute row start offsets
    const rowOffsets = [];
    let curOff = 0;
    for (let r = 0; r < totalNumRows; r++) {
      rowOffsets.push(curOff);
      curOff += struct.rows[r].labels.length;
    }

    // First event: place all N active members continuously in seats 0..N-1
    if (isFirstEvent) {
      const sorted = [...active].sort((a, b) => (a.currentSeatIndex ?? 0) - (b.currentSeatIndex ?? 0));
      preview[cat] = sorted.map((m, idx) => {
        const newIndex = idx;
        return {
          userId: m.id,
          userName: m.name,
          category: cat,
          previousSeat: null,
          newIndex,
          assignedSeat: flat[newIndex] ?? "—",
        };
      });
      return;
    }

    // Identify how many rows are currently occupied by the N active members
    let activeNumRows = 1;
    for (let r = 0; r < totalNumRows; r++) {
      if (rowOffsets[r] < N) {
        activeNumRows = r + 1;
      } else {
        break;
      }
    }
    // For Deluxe: regular rotation is within rows B-E (first 4 rows) if N <= 74
    if (cat === "Deluxe" && activeNumRows > 4 && N <= 74) {
      activeNumRows = 4;
    }

    // Step 1: For each member, find current seat position and target next row & zone
    const memberTargets = active.map((m) => {
      const seatInfo = getSeatInfo(m.currentSeatIndex ?? 0, struct);
      const currRow = seatInfo.rowIndex >= activeNumRows ? 0 : seatInfo.rowIndex;
      const nextRowIndex = (currRow + 1) % activeNumRows;
      const wantsCenter = seatInfo.isCorner; // Corner -> Center; Center -> Corner
      return {
        member: m,
        prevSeatInfo: seatInfo,
        nextRowIndex,
        wantsCenter,
      };
    });

    // Step 2: Bucket members by next row
    const rowBuckets = Array.from({ length: totalNumRows }, () => []);
    memberTargets.forEach((t) => {
      rowBuckets[t.nextRowIndex].push(t);
    });

    // Step 3: Prepare available slots strictly from indices 0 to N-1 (NO GAPS IN BETWEEN)
    const assignedResults = [];
    const availableRowSlots = [];

    for (let r = 0; r < totalNumRows; r++) {
      const offset = rowOffsets[r];
      const rowLen = struct.rows[r].labels.length;
      const centerSlots = [];
      const cornerSlots = [];

      for (let s = 0; s < rowLen; s++) {
        const flatIdx = offset + s;
        // Only include seats within the first N seats to ensure all empty seats are at the end
        if (flatIdx < N) {
          if (isSeatCorner(s, rowLen)) {
            cornerSlots.push(flatIdx);
          } else {
            centerSlots.push(flatIdx);
          }
        }
      }

      availableRowSlots.push({
        centerSlots: shuffleArray(centerSlots),
        cornerSlots: shuffleArray(cornerSlots),
      });
    }

    // Step 4: Assign members to their target row slots
    let unassignedMembers = [];

    for (let r = 0; r < activeNumRows; r++) {
      const items = rowBuckets[r];
      const rowSlots = availableRowSlots[r];

      const centerSeekers = shuffleArray(items.filter((x) => x.wantsCenter));
      const cornerSeekers = shuffleArray(items.filter((x) => !x.wantsCenter));

      // 1. Assign members wanting Center (who were in Corner before)
      centerSeekers.forEach((item) => {
        let chosenFlatIdx = rowSlots.centerSlots.pop();
        if (chosenFlatIdx === undefined) {
          chosenFlatIdx = rowSlots.cornerSlots.pop();
        }
        if (chosenFlatIdx !== undefined) {
          assignedResults.push({
            userId: item.member.id,
            userName: item.member.name,
            category: cat,
            previousSeat: item.prevSeatInfo.label ?? "—",
            newIndex: chosenFlatIdx,
            assignedSeat: flat[chosenFlatIdx] ?? "—",
          });
        } else {
          unassignedMembers.push(item);
        }
      });

      // 2. Assign members wanting Corner (who were in Center before)
      cornerSeekers.forEach((item) => {
        let chosenFlatIdx = rowSlots.cornerSlots.pop();
        if (chosenFlatIdx === undefined) {
          chosenFlatIdx = rowSlots.centerSlots.pop();
        }
        if (chosenFlatIdx !== undefined) {
          assignedResults.push({
            userId: item.member.id,
            userName: item.member.name,
            category: cat,
            previousSeat: item.prevSeatInfo.label ?? "—",
            newIndex: chosenFlatIdx,
            assignedSeat: flat[chosenFlatIdx] ?? "—",
          });
        } else {
          unassignedMembers.push(item);
        }
      });
    }

    // Step 5: Fill any remaining unassigned members into open slots in active rows (0..N-1)
    if (unassignedMembers.length > 0) {
      for (let r = 0; r < activeNumRows && unassignedMembers.length > 0; r++) {
        const rowSlots = availableRowSlots[r];
        while (unassignedMembers.length > 0 && (rowSlots.centerSlots.length > 0 || rowSlots.cornerSlots.length > 0)) {
          const item = unassignedMembers.pop();
          let chosenFlatIdx = item.wantsCenter
            ? (rowSlots.centerSlots.pop() ?? rowSlots.cornerSlots.pop())
            : (rowSlots.cornerSlots.pop() ?? rowSlots.centerSlots.pop());
          if (chosenFlatIdx !== undefined) {
            assignedResults.push({
              userId: item.member.id,
              userName: item.member.name,
              category: cat,
              previousSeat: item.prevSeatInfo.label ?? "—",
              newIndex: chosenFlatIdx,
              assignedSeat: flat[chosenFlatIdx] ?? "—",
            });
          }
        }
      }
    }

    preview[cat] = assignedResults;
  });

  return preview;
}
