import { describe, expect, it } from 'vitest';
import { createLimitWindow, type ProviderLimitSnapshot, STALE_AFTER_MS, withFreshness } from '../src/shared/limits';

describe('withFreshness', () => {
  it('marks ok provider data stale after the stale window', () => {
    const fetchedAt = 1000;
    const snapshot: ProviderLimitSnapshot = {
      id: 'codex1',
      provider: 'codex',
      label: 'Codex',
      status: 'ok',
      source: 'test',
      fetchedAt,
      windows: {
        fiveHour: createLimitWindow('fiveHour', 10, null, 300)
      }
    };

    const stale = withFreshness(snapshot, fetchedAt * 1000 + STALE_AFTER_MS + 1);
    expect(stale.status).toBe('stale');
  });

  it('does not overwrite non-ok statuses', () => {
    const snapshot: ProviderLimitSnapshot = {
      id: 'claude',
      provider: 'claude',
      label: 'Claude Code',
      status: 'error',
      source: 'test',
      fetchedAt: 1000,
      windows: {}
    };

    expect(withFreshness(snapshot, 999999999).status).toBe('error');
  });
});
