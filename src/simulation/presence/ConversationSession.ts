export type ConversationRole = 'talk' | 'listen';

export interface XZ {
  x: number;
  z: number;
}

/**
 * Two-party conversation choreography — talk/listen roles + mutual facing.
 * SceneManager applies roles to CharacterController; this class owns the rules.
 */
export class ConversationSession {
  public readonly a: number;
  public readonly b: number;
  private speaker: number | null = null;
  private active = false;

  constructor(participantA: number, participantB: number) {
    this.a = participantA;
    this.b = participantB;
  }

  public get participants(): [number, number] {
    return [this.a, this.b];
  }

  public get isActive(): boolean {
    return this.active;
  }

  public begin(): void {
    this.active = true;
    this.speaker = null;
  }

  public end(): void {
    this.active = false;
    this.speaker = null;
  }

  public isParticipant(index: number): boolean {
    return index === this.a || index === this.b;
  }

  /** Set who is talking, or null for both listening. Ignored if session ended. */
  public setSpeaker(index: number | null): void {
    if (!this.active) return;
    if (index !== null && !this.isParticipant(index)) return;
    this.speaker = index;
  }

  public roleOf(index: number): ConversationRole {
    if (!this.active || !this.isParticipant(index)) return 'listen';
    return this.speaker === index ? 'talk' : 'listen';
  }

  /**
   * Unit XZ facing for each participant toward the other.
   * Falls back to +Z if coincident.
   */
  public facingDirs(posA: XZ, posB: XZ): { a: XZ; b: XZ } {
    let dx = posB.x - posA.x;
    let dz = posB.z - posA.z;
    let len = Math.hypot(dx, dz);
    if (len < 1e-5) {
      return { a: { x: 0, z: 1 }, b: { x: 0, z: -1 } };
    }
    dx /= len;
    dz /= len;
    return {
      a: { x: dx, z: dz },
      b: { x: -dx, z: -dz },
    };
  }
}
