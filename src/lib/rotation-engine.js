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
    ["G", 44], // 22 pairs
    ["H", 46], // 23 pairs
    ["I", 42], // 21 pairs
    ["J", 44], // 22 pairs
    ["K", 46], // 23 pairs
    ["L", 48], // 24 pairs
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
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Smart Fair Rotation with Row-Progression & Corner-to-Center Alternation:
 * 1. Deluxe rotates only through rows B -> C -> D -> E -> B (Row F is reserved for new members).
 * 2. Premium rotates through rows G -> H -> I -> J -> K -> L -> G.
 * 3. Members who were in Corner seats (e.g. B1-B2) are placed in Center seats in the next row (e.g. C21-C22).
 * 4. Members who were in Center seats are rotated to Corner/outer seats in the next row.
 * 5. Seats are fairly shuffled within each zone so allocations remain dynamic and exciting.
 */
export function computePreview(members, isFirstEvent, structures) {
  const preview = { Deluxe: [], Premium: [] };

  ["Deluxe", "Premium"].forEach((cat) => {
    const struct = structures[cat];
    const active = members.filter((m) => m.category === cat && m.status === "active");

    // Deluxe uses rows B, C, D, E (0..3) for regular rotation. Row F (4) is reserved for new members.
    // Premium uses all rows G..L (0..5).
    const activeNumRows = cat === "Deluxe" ? Math.min(4, struct.rows.length) : struct.rows.length;
    const totalNumRows = struct.rows.length;
    const flat = struct.flat;

    // Row offsets
    const rowOffsets = [];
    let curOff = 0;
    for (let r = 0; r < totalNumRows; r++) {
      rowOffsets.push(curOff);
      curOff += struct.rows[r].labels.length;
    }

    if (isFirstEvent) {
      const sorted = [...active].sort((a, b) => (a.currentSeatIndex ?? 0) - (b.currentSeatIndex ?? 0));
      preview[cat] = sorted.map((m, idx) => {
        const newIndex = m.currentSeatIndex !== undefined && m.currentSeatIndex >= 0 ? m.currentSeatIndex : idx;
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

    // Step 1: For each member, determine their current seat position, row, and whether they were corner or center
    const memberTargets = active.map((m) => {
      const seatInfo = getSeatInfo(m.currentSeatIndex ?? 0, struct);
      // For Deluxe: if member is on row 0..3, next row is (r + 1) % 4 (B -> C -> D -> E -> B).
      // If member was in Row F (index 4, e.g. newly added), transition them into Row B (index 0).
      const nextRowIndex = seatInfo.rowIndex >= activeNumRows ? 0 : (seatInfo.rowIndex + 1) % activeNumRows;
      const wantsCenter = seatInfo.isCorner; // Corner in prev activity -> Center in next row; Center -> Corner
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

    // Step 3: Prepare available slots in each row partitioned into Center and Corner
    const assignedResults = [];
    const availableRowSlots = [];

    for (let r = 0; r < totalNumRows; r++) {
      const rowLen = struct.rows[r].labels.length;
      const offset = rowOffsets[r];
      const centerSlots = [];
      const cornerSlots = [];
      for (let s = 0; s < rowLen; s++) {
        if (isSeatCorner(s, rowLen)) {
          cornerSlots.push(offset + s);
        } else {
          centerSlots.push(offset + s);
        }
      }
      availableRowSlots.push({
        centerSlots: shuffleArray(centerSlots),
        cornerSlots: shuffleArray(cornerSlots),
      });
    }

    // Step 4: Assign members to their target row slots (Center seekers get center, Corner seekers get corner)
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
          // If center slots in this row are exhausted, take corner slot
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
          // If corner slots in this row are exhausted, take center slot
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

    // Step 5: If any overflow members remain (e.g. capacity in B-E exceeded), fill in remaining rows (e.g. Row F)
    if (unassignedMembers.length > 0) {
      for (let r = 0; r < totalNumRows && unassignedMembers.length > 0; r++) {
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
