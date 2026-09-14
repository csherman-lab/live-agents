/** Double-click if last click was within thresholdMs. */
export function isDoubleClick(
  nowMs: number,
  lastClickMs: number | null,
  thresholdMs: number,
): boolean {
  if (lastClickMs === null) return false;
  return nowMs - lastClickMs <= thresholdMs;
}

export type HoverReaction = 'wave' | 'look_around';

export interface HoverReactionOptions {
  /** Probability of reacting once min hover is met (0–1). */
  chance: number;
  /** Per-agent cooldown after a reaction (ms). */
  cooldownMs: number;
  /** Must hover the same agent this long before a roll (ms). */
  minHoverMs: number;
}

/**
 * Rate-limited hover reactions for InteractionPresence (Wave 3).
 * Deterministic when chance === 1 (tests); otherwise Math.random.
 */
export class HoverReactionScheduler {
  private hoveredIndex: number | null = null;
  private hoverStartedAt = 0;
  private lastReactionAt = new Map<number, number>();
  private readonly chance: number;
  private readonly cooldownMs: number;
  private readonly minHoverMs: number;
  private reactedThisHover = false;

  constructor(opts: HoverReactionOptions) {
    this.chance = opts.chance;
    this.cooldownMs = opts.cooldownMs;
    this.minHoverMs = opts.minHoverMs;
  }

  /**
   * @returns reaction to play, or null
   */
  public tick(hoveredIndex: number | null, nowMs: number): HoverReaction | null {
    if (hoveredIndex === null) {
      this.hoveredIndex = null;
      this.reactedThisHover = false;
      return null;
    }

    if (hoveredIndex !== this.hoveredIndex) {
      this.hoveredIndex = hoveredIndex;
      this.hoverStartedAt = nowMs;
      this.reactedThisHover = false;
      return null;
    }

    if (this.reactedThisHover) return null;
    if (nowMs - this.hoverStartedAt < this.minHoverMs) return null;

    const last = this.lastReactionAt.get(hoveredIndex) ?? -Infinity;
    if (nowMs - last < this.cooldownMs) return null;

    if (Math.random() > this.chance) {
      this.reactedThisHover = true; // don't spam rolls this hover
      return null;
    }

    this.reactedThisHover = true;
    this.lastReactionAt.set(hoveredIndex, nowMs);
    // Alternate look vs wave by index for variety
    return hoveredIndex % 2 === 0 ? 'wave' : 'look_around';
  }
}
