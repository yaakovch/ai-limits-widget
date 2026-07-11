import { describe, expect, it } from 'vitest';
import { createLimitWindow } from '../src/shared/limits';
import { getLevel, renderLimitCell } from '../src/renderer/src/widget-view';

describe('dual-color limit bar', () => {
  it('fills the bar with green remaining followed by red used', () => {
    const html = renderLimitCell(createLimitWindow('fiveHour', 66, 2000, 300), 'ok', 1000 * 1000);
    expect(html).toContain('bar-remaining" style="width:34%');
    expect(html).toContain('bar-used" style="width:66%');
    expect(html).not.toContain('bar-unknown');
  });

  it('mutes cached stale ratios without hiding their proportions', () => {
    const html = renderLimitCell(createLimitWindow('weekly', 10, null, 10080), 'stale');
    expect(html).toContain('bar-ratio bar-muted');
    expect(html).toContain('width:90%');
    expect(html).toContain('width:10%');
  });

  it('uses a neutral bar for unknown values and preserves urgency levels', () => {
    expect(renderLimitCell(undefined, 'unavailable')).toContain('bar-unknown');
    expect(getLevel(createLimitWindow('fiveHour', 70, null, 300))).toBe('is-warning');
    expect(getLevel(createLimitWindow('fiveHour', 90, null, 300))).toBe('is-critical');
  });
});
