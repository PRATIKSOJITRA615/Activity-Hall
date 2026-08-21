
/*  Seat geometry — mirrors the physical hall layout                   */


const HALL_ROWS = {
  Deluxe: [
    ["B", 34],
    ["C", 36],
    ["D", 38],
    ["E", 40],
    ["F", 42],
  ],
  Premium: [
    ["G", 44],
    ["H", 46],
    ["I", 42],
    ["J", 44],
    ["K", 46],
    ["L", 48],
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


/*  Rotation logic                                                      */


export function computePreview(members, isFirstEvent, structures) {
  const preview = { Deluxe: [], Premium: [] };
  ["Deluxe", "Premium"].forEach((cat) => {
    const active = members
      .filter((m) => m.category === cat && m.status === "active")
      .sort((a, b) => a.currentSeatIndex - b.currentSeatIndex);
    const n = active.length;
    const labels = structures[cat].flat;
    preview[cat] = active.map((m) => {
      // Move everyone forward by exactly 1 position within their category
      const newIndex = isFirstEvent ? m.currentSeatIndex : n > 0 ? (m.currentSeatIndex + 1) % n : 0;
      return {
        userId: m.id,
        userName: m.name,
        category: cat,
        previousSeat: isFirstEvent ? null : labels[m.currentSeatIndex] ?? "—",
        newIndex,
        assignedSeat: labels[newIndex] ?? "—",
      };
    });
  });
  return preview;
}
