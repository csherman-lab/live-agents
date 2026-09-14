import { describe, expect, it } from 'vitest';
import { assignMirrorSeat, assignMirrorSeatNear } from './assignMirrorSeat';

type Seat = { id: string; occupiedBy: number | null };

describe('assignMirrorSeat', () => {
  it('keeps held seat', () => {
    const seats: Seat[] = [
      { id: 'sit_work-1', occupiedBy: 2 },
      { id: 'sit_work-2', occupiedBy: null },
    ];
    expect(assignMirrorSeat(seats, 2)?.id).toBe('sit_work-1');
  });

  it('never returns a seat occupied by someone else', () => {
    const seats: Seat[] = [
      { id: 'sit_work-1', occupiedBy: 1 },
      { id: 'sit_work-2', occupiedBy: 3 },
    ];
    expect(assignMirrorSeat(seats, 2)).toBeNull();
  });

  it('stable free pick by preferredSlot', () => {
    const seats: Seat[] = [
      { id: 'sit_work-1', occupiedBy: null },
      { id: 'sit_work-2', occupiedBy: null },
      { id: 'sit_work-3', occupiedBy: null },
    ];
    expect(assignMirrorSeat(seats, 2, 0)?.id).toBe('sit_work-1');
    expect(assignMirrorSeat(seats, 3, 1)?.id).toBe('sit_work-2');
  });
});

describe('assignMirrorSeatNear', () => {
  it('picks the nearest free seat', () => {
    const seats = [
      { id: 'sit_idle-1', occupiedBy: null, x: 10, z: 10 },
      { id: 'sit_idle-2', occupiedBy: null, x: 1, z: 1 },
      { id: 'sit_idle-3', occupiedBy: null, x: 8, z: 8 },
    ];
    expect(assignMirrorSeatNear(seats, 2, { x: 0, z: 0 }, 0)?.id).toBe('sit_idle-2');
  });
});
