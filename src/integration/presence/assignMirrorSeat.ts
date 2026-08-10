export interface MirrorSeatLike {
  id: string;
  occupiedBy: number | null;
}

export interface MirrorSeatWithPos extends MirrorSeatLike {
  x: number;
  z: number;
}

/**
 * Pick an exclusive desk/lounge seat for a mirror agent.
 * Never returns a seat occupied by someone else (walkToPoi would fail).
 */
export function assignMirrorSeat(
  seats: MirrorSeatLike[],
  agentIndex: number,
  preferredSlot = Math.max(0, agentIndex - 1),
): MirrorSeatLike | null {
  const held = seats.find((s) => s.occupiedBy === agentIndex);
  if (held) return held;
  const free = seats
    .filter((s) => s.occupiedBy === null)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (free.length === 0) return null;
  return free[preferredSlot % free.length];
}

/** Prefer a nearby free seat so agents don't cross the map into furniture holes. */
export function assignMirrorSeatNear(
  seats: MirrorSeatWithPos[],
  agentIndex: number,
  from: { x: number; z: number },
  preferredSlot = Math.max(0, agentIndex - 1),
): MirrorSeatWithPos | null {
  const held = seats.find((s) => s.occupiedBy === agentIndex);
  if (held) return held;
  const free = seats.filter((s) => s.occupiedBy === null);
  if (free.length === 0) return null;

  const dist2 = (s: MirrorSeatWithPos) => (s.x - from.x) ** 2 + (s.z - from.z) ** 2;
  free.sort((a, b) => {
    const d = dist2(a) - dist2(b);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  const nearest = free[0];
  const preferred = [...free].sort((a, b) => a.id.localeCompare(b.id))[
    preferredSlot % free.length
  ];
  if (preferred && dist2(preferred) <= dist2(nearest) * 2.25) return preferred;
  return nearest;
}
