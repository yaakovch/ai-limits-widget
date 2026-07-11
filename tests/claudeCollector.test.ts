import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectClaudeLimits, mapClaudeStatusLineInput } from '../src/main/collectors/claude';

describe('mapClaudeStatusLineInput', () => {
  it('returns null when Claude status-line data has no rate limits', () => {
    expect(mapClaudeStatusLineInput({}, 100)).toBeNull();
  });

  it('maps Claude five-hour and seven-day rate limits', () => {
    const cache = mapClaudeStatusLineInput(
      {
        rate_limits: {
          five_hour: { used_percentage: 22.5, resets_at: 500 },
          seven_day: { used_percentage: 40, resets_at: 900 }
        }
      },
      100
    );

    expect(cache?.windows.fiveHour?.remainingPercent).toBe(77.5);
    expect(cache?.windows.fiveHour?.durationMinutes).toBe(300);
    expect(cache?.windows.weekly?.remainingPercent).toBe(60);
    expect(cache?.windows.weekly?.durationMinutes).toBe(10080);
  });

  it('reads caches written with a PowerShell UTF-8 BOM', () => {
    const root = mkdtempSync(join(tmpdir(), 'limits-widget-cache-'));
    const cachePath = join(root, 'claude-limits.json');
    const payload = {
      version: 1,
      provider: 'claude',
      source: 'claude-statusline',
      fetchedAt: 100,
      windows: {
        fiveHour: {
          id: 'fiveHour',
          label: '5h',
          usedPercent: 1,
          remainingPercent: 99,
          resetsAt: 500,
          durationMinutes: 300
        }
      }
    };

    try {
      writeFileSync(cachePath, `\uFEFF${JSON.stringify(payload)}`, 'utf8');
      expect(collectClaudeLimits(cachePath).windows.fiveHour?.remainingPercent).toBe(99);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('marks old Claude cache data stale with refresh instructions', () => {
    const root = mkdtempSync(join(tmpdir(), 'limits-widget-cache-'));
    const cachePath = join(root, 'claude-limits.json');

    try {
      writeFileSync(cachePath, JSON.stringify(createCachePayload(100)), 'utf8');
      const snapshot = collectClaudeLimits(cachePath, {
        nowMs: 100 * 1000 + 16 * 60 * 1000,
        inspectInstallation: () => ({ status: 'ready', message: 'ready' }),
        runtimeInfo: {
          runningProcessCount: 1,
          runningProcessStartedBeforeStatusLineInstall: false,
          oldestProcessStartTimeMs: 50 * 1000,
          statusLineSettingsMtimeMs: 25 * 1000
        }
      });

      expect(snapshot.status).toBe('stale');
      expect(snapshot.message).toContain('Complete one Claude Code response to refresh');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('asks for a Claude restart when a running session predates the status-line install', () => {
    const root = mkdtempSync(join(tmpdir(), 'limits-widget-cache-'));
    const cachePath = join(root, 'claude-limits.json');

    try {
      writeFileSync(cachePath, JSON.stringify(createCachePayload(100)), 'utf8');
      const snapshot = collectClaudeLimits(cachePath, {
        nowMs: 100 * 1000 + 16 * 60 * 1000,
        inspectInstallation: () => ({ status: 'ready', message: 'ready' }),
        runtimeInfo: {
          runningProcessCount: 1,
          runningProcessStartedBeforeStatusLineInstall: true,
          oldestProcessStartTimeMs: 50 * 1000,
          statusLineSettingsMtimeMs: 75 * 1000
        }
      });

      expect(snapshot.status).toBe('stale');
      expect(snapshot.message).toContain('Restart Claude Code');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function createCachePayload(fetchedAt: number): object {
  return {
    version: 1,
    provider: 'claude',
    source: 'claude-statusline',
    fetchedAt,
    windows: {
      fiveHour: {
        id: 'fiveHour',
        label: '5h',
        usedPercent: 1,
        remainingPercent: 99,
        resetsAt: 500,
        durationMinutes: 300
      }
    }
  };
}
