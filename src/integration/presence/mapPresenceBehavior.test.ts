import { describe, expect, it } from 'vitest';
import { mapPresenceBehavior } from './mapPresenceBehavior';

describe('mapPresenceBehavior', () => {
  it('maps working specialist to desk sit_work with Working bubble', () => {
    const b = mapPresenceBehavior('working', 'Editing file', { isLead: false });
    expect(b.placement).toBe('desk');
    expect(b.characterState).toBe('sit_work');
    expect(b.dimmed).toBe(false);
    expect(b.bubblePrimary).toBe('Working');
  });

  it('maps working lead to stage talk with Working bubble', () => {
    const b = mapPresenceBehavior('working', 'Using Shell', { isLead: true });
    expect(b.placement).toBe('stage');
    expect(b.bubblePrimary).toBe('Working');
    expect(b.dimmed).toBe(false);
  });

  it('maps idle specialist to lounge sit + dimmed + no bubble', () => {
    const b = mapPresenceBehavior('idle', undefined, { isLead: false });
    expect(b.placement).toBe('lounge');
    expect(b.characterState).toBe('sit_idle');
    expect(b.dimmed).toBe(true);
    expect(b.bubblePrimary).toBe('');
  });

  it('maps thinking specialist to whiteboard look', () => {
    const b = mapPresenceBehavior('thinking', undefined, { isLead: false });
    expect(b.placement).toBe('board');
    expect(b.characterState).toBe('look_around');
    expect(b.bubblePrimary).toBe('');
  });

  it('keeps lead full color when idle', () => {
    const b = mapPresenceBehavior('idle', undefined, { isLead: true });
    expect(b.placement).toBe('stage');
    expect(b.dimmed).toBe(false);
  });
});
