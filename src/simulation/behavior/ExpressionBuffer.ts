import { storage } from 'three/tsl';
import * as THREE from 'three/webgpu';
import { AtlasCoords, ExpressionKey } from '../../types';
import {
    ATLAS_COLS, ATLAS_ROWS, BLINK_DURATION, BLINK_FRAME, BLINK_INTERVAL_MIN, BLINK_INTERVAL_RANGE, SPEAKING_FRAME_DURATION
} from '../constants';

/**
 * Atlas cells (image top → row 0): ink-only cute eyes/mouths (transparent bg).
 * Eye mesh UVs live in home cell (0,3); offsets move to the absolute cell origin.
 * Mouth mesh UVs are baked into closed-smile (1,0); mouth offsets are relative.
 * No wink cells — resting faces are always two open friendly eyes + a smile.
 */
export const EXPRESSIONS: Record<ExpressionKey, { eyes: AtlasCoords; mouth: AtlasCoords }> = {
  idle: { eyes: { col: 0, row: 0 }, mouth: { col: 1, row: 0 } },
  listening: { eyes: { col: 0, row: 2 }, mouth: { col: 1, row: 0 } },
  neutral: { eyes: { col: 0, row: 0 }, mouth: { col: 1, row: 0 } },
  surprised: { eyes: { col: 1, row: 2 }, mouth: { col: 1, row: 0 } },
  // Happy: slightly bigger open dots (not closed/wink arcs)
  happy: { eyes: { col: 0, row: 1 }, mouth: { col: 1, row: 0 } },
  sick: { eyes: { col: 0, row: 0 }, mouth: { col: 1, row: 0 } },
  wink: { eyes: { col: 0, row: 0 }, mouth: { col: 1, row: 0 } },
  doubtful: { eyes: { col: 1, row: 1 }, mouth: { col: 1, row: 0 } },
  sad: { eyes: { col: 0, row: 0 }, mouth: { col: 1, row: 3 } },
};

export const SPEAKING_MOUTH_FRAMES: AtlasCoords[] = [
  { col: 0, row: 0 },
  { col: 1, row: 1 },
  { col: 0, row: 2 },
  { col: 0, row: 3 },
];

/** Idle faces stay cute/friendly open eyes — no wink / closed-eye personalities. */
export const IDLE_PERSONALITIES: ExpressionKey[] = [
  'idle',
  'neutral',
  'happy',
  'idle',
  'neutral',
  'happy',
];
/**
 * CPU/GPU buffer that stores per-instance expression data.
 * Each instance maps to one vec4:
 *   .x = eye X offset
 *   .y = eye Y offset
 *   .z = mouth X offset
 *   .w = mouth Y offset
 */
export class ExpressionBuffer {
  public readonly array: Float32Array;
  public readonly attribute: THREE.StorageInstancedBufferAttribute;
  public readonly storageNode: any;

  private speakingStates: boolean[] = [];
  private speakingFrames: number[] = [];
  private speakingTimers: number[] = [];
  private blinkTimers: number[] = [];
  private isBlinking: boolean[] = [];
  private currentExpressions: ExpressionKey[] = [];

  constructor(private readonly count: number) {
    this.array = new Float32Array(count * 4);
    this.attribute = new THREE.StorageInstancedBufferAttribute(this.array, 4);
    this.storageNode = storage(this.attribute, 'vec4', count);

    for (let i = 0; i < count; i++) {
      this.speakingStates[i] = false;
      this.speakingFrames[i] = 0;
      this.speakingTimers[i] = 0;
      // Stagger blinks so faces don't blink in lockstep
      this.blinkTimers[i] = BLINK_INTERVAL_MIN + ((i * 47) % 100) / 100 * BLINK_INTERVAL_RANGE;
      this.isBlinking[i] = false;
      // Per-instance idle cell — strangers see slightly different stares
      const personality = IDLE_PERSONALITIES[(i * 3 + 1) % IDLE_PERSONALITIES.length];
      this.setExpression(i, personality);
    }
  }

  public setExpression(index: number, name: ExpressionKey) {
    this.currentExpressions[index] = name;
    const config = EXPRESSIONS[name] || EXPRESSIONS.idle;

    // Apply eye offset (unless blinking)
    if (!this.isBlinking[index]) {
      this.setEyeOffset(index, config.eyes);
    }

    // Apply mouth offset (unless speaking)
    if (!this.speakingStates[index]) {
      this.setMouthOffset(index, config.mouth);
    }
  }

  public setSpeaking(index: number, isSpeaking: boolean) {
    this.speakingStates[index] = isSpeaking;
    if (!isSpeaking) {
      // Reset mouth to current expression
      const config = EXPRESSIONS[this.currentExpressions[index]] || EXPRESSIONS.idle;
      this.setMouthOffset(index, config.mouth);
    }
  }

  private setEyeOffset(index: number, coords: AtlasCoords) {
    // Eyes mesh UVs bake into open-dots cell (col0,row0). Offsets are relative — same
    // as mouths — so resting faces need no UV add (avoids wink/home-cell mistakes).
    const baseU = 0 * (1 / ATLAS_COLS);
    const baseV = 1.0 - (0 + 1) * (1 / ATLAS_ROWS);
    this.array[index * 4 + 0] = coords.col * (1 / ATLAS_COLS) - baseU;
    this.array[index * 4 + 1] = 1.0 - (coords.row + 1) * (1 / ATLAS_ROWS) - baseV;
    this.attribute.needsUpdate = true;
  }

  private setMouthOffset(index: number, coords: AtlasCoords) {
    // Mouth mesh UVs are baked into closed-smile cell (col1,row0). Offsets are relative
    // to that origin so resting smiles need no GPU add (Wave 17 TSL .zw was a no-op).
    const baseU = 1 * (1 / ATLAS_COLS);
    const baseV = 1.0 - (0 + 1) * (1 / ATLAS_ROWS);
    this.array[index * 4 + 2] = coords.col * (1 / ATLAS_COLS) - baseU;
    this.array[index * 4 + 3] = 1.0 - (coords.row + 1) * (1 / ATLAS_ROWS) - baseV;
    this.attribute.needsUpdate = true;
  }

  public update(delta: number) {
    let needsUpdate = false;

    for (let i = 0; i < this.count; i++) {
      // Handle Blinking
      this.blinkTimers[i] -= delta;
      if (this.blinkTimers[i] <= 0) {
        if (!this.isBlinking[i]) {
          this.isBlinking[i] = true;
          this.blinkTimers[i] = BLINK_DURATION;
          this.setEyeOffset(i, BLINK_FRAME);
          needsUpdate = true;
        } else {
          this.isBlinking[i] = false;
          this.blinkTimers[i] = BLINK_INTERVAL_MIN + Math.random() * BLINK_INTERVAL_RANGE;
          const config = EXPRESSIONS[this.currentExpressions[i]] || EXPRESSIONS.idle;
          this.setEyeOffset(i, config.eyes);
          needsUpdate = true;
        }
      }

      // Handle Speaking Animation
      if (this.speakingStates[i]) {
        this.speakingTimers[i] -= delta;
        if (this.speakingTimers[i] <= 0) {
          this.speakingTimers[i] = SPEAKING_FRAME_DURATION;
          this.speakingFrames[i] = (this.speakingFrames[i] + 1) % SPEAKING_MOUTH_FRAMES.length;
          this.setMouthOffset(i, SPEAKING_MOUTH_FRAMES[this.speakingFrames[i]]);
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      this.attribute.needsUpdate = true;
    }
  }
}
