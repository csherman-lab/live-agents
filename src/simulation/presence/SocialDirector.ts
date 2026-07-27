import type { CharacterStateKey } from '../../types';

export interface SocialDirectorOptions {
  /** Seconds between ambient pair attempts when none active. */
  ambientInterval: number;
  /** How long an ambient chat lasts once talking starts. */
  ambientDuration: number;
  /** Player proximity for notice reactions. */
  noticeRadius: number;
  noticeChance: number;
  noticeCooldown: number;
  /** Max distance to pick an ambient meetup pair (they walk together if farther). */
  ambientMeetupRadius: number;
}

export interface SocialAgentSnapshot {
  index: number;
  x: number;
  z: number;
  state: CharacterStateKey | string;
  pathing: boolean;
  busy: boolean;
  inPlayerChat: boolean;
}

export interface SocialUpdateContext {
  agents: SocialAgentSnapshot[];
  playerIndex: number;
  playerX: number;
  playerZ: number;
  /** Meetup walk or active talk in progress. */
  hasAmbientSession: boolean;
  hasPlayerSession: boolean;
  /** True once both agents arrived and talk choreography began. */
  ambientTalking: boolean;
}

export type SocialAction =
  | { type: 'ambient_meetup'; a: number; b: number }
  | { type: 'ambient_end' }
  | { type: 'ambient_tick'; speaker: number }
  | { type: 'notice'; index: number; reaction: 'wave' | 'look_around' };

const FREE_STATES = new Set(['idle', 'look_around', 'listen', 'talk']);

/**
 * Alive-office director — ambient meetups + notice-the-player.
 * Host walks pairs together; talking timer starts only after `ambientTalking`.
 */
export class SocialDirector {
  private ambientCooldown = 0;
  private ambientElapsed = 0;
  private ambientSpeakerFlip = 0;
  private ambientPair: [number, number] | null = null;
  private noticeLast = new Map<number, number>();
  private time = 0;
  private readonly opts: SocialDirectorOptions;

  constructor(opts: SocialDirectorOptions) {
    this.opts = opts;
    this.ambientCooldown = 0;
  }

  public cancelAmbient(): void {
    this.ambientPair = null;
    this.ambientElapsed = 0;
    this.ambientSpeakerFlip = 0;
    this.ambientCooldown = this.opts.ambientInterval;
  }

  public update(delta: number, ctx: SocialUpdateContext): SocialAction[] {
    this.time += delta;
    const actions: SocialAction[] = [];

    if (ctx.hasAmbientSession && this.ambientPair) {
      if (ctx.ambientTalking) {
        this.ambientElapsed += delta;
        this.ambientSpeakerFlip += delta;
        if (this.ambientElapsed >= this.opts.ambientDuration) {
          actions.push({ type: 'ambient_end' });
          this.cancelAmbient();
        } else if (this.ambientSpeakerFlip >= 1.2) {
          this.ambientSpeakerFlip = 0;
          const [a, b] = this.ambientPair;
          const speaker = Math.random() < 0.5 ? a : b;
          actions.push({ type: 'ambient_tick', speaker });
        }
      }
    } else if (!ctx.hasAmbientSession) {
      this.ambientCooldown -= delta;
      if (this.ambientCooldown <= 0 && !ctx.hasPlayerSession) {
        const pair = this.findAmbientPair(ctx.agents);
        if (pair) {
          this.ambientPair = pair;
          this.ambientElapsed = 0;
          this.ambientSpeakerFlip = 0;
          this.ambientCooldown = this.opts.ambientInterval;
          actions.push({ type: 'ambient_meetup', a: pair[0], b: pair[1] });
        } else {
          this.ambientCooldown = Math.min(2, this.opts.ambientInterval || 2);
        }
      }
    }

    if (!ctx.hasPlayerSession) {
      const notice = this.tryNotice(ctx);
      if (notice) actions.push(notice);
    }

    return actions;
  }

  private isEligible(agent: SocialAgentSnapshot): boolean {
    if (agent.busy || agent.pathing || agent.inPlayerChat) return false;
    if (!FREE_STATES.has(agent.state)) return false;
    return true;
  }

  private findAmbientPair(agents: SocialAgentSnapshot[]): [number, number] | null {
    const free = agents.filter((a) => this.isEligible(a));
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const dx = free[i].x - free[j].x;
        const dz = free[i].z - free[j].z;
        const dist = Math.hypot(dx, dz);
        if (dist <= this.opts.ambientMeetupRadius && dist < bestDist) {
          bestDist = dist;
          best = [free[i].index, free[j].index];
        }
      }
    }
    return best;
  }

  private tryNotice(ctx: SocialUpdateContext): SocialAction | null {
    for (const agent of ctx.agents) {
      if (agent.index === ctx.playerIndex) continue;
      if (!this.isEligible(agent)) continue;
      const dist = Math.hypot(agent.x - ctx.playerX, agent.z - ctx.playerZ);
      if (dist > this.opts.noticeRadius) continue;
      const last = this.noticeLast.get(agent.index) ?? -Infinity;
      if (this.time - last < this.opts.noticeCooldown) continue;
      if (Math.random() > this.opts.noticeChance) continue;
      this.noticeLast.set(agent.index, this.time);
      const reaction = agent.index % 2 === 0 ? 'wave' : 'look_around';
      return { type: 'notice', index: agent.index, reaction };
    }
    return null;
  }
}
