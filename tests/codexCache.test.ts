import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadCodexCache, saveCodexCache } from '../src/main/codex-cache';
import { createLimitWindow, type ProviderLimitSnapshot } from '../src/shared/limits';

const tempDirs: string[] = [];

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('Codex latest-only cache', () => {
  it('persists only sanitized latest snapshots and replaces the cache atomically', () => {
    const root = mkdtempSync(join(tmpdir(), 'limits-widget-codex-cache-'));
    tempDirs.push(root);
    const cachePath = join(root, 'codex-profiles.json');
    const snapshot = makeSnapshot('codex1', 25, 1000);
    (snapshot as ProviderLimitSnapshot & { authToken?: string }).authToken = 'do-not-write';

    saveCodexCache([snapshot], cachePath);
    saveCodexCache([{ ...snapshot, windows: { fiveHour: createLimitWindow('fiveHour', 30, 2000, 300) } }], cachePath);

    const raw = readFileSync(cachePath, 'utf8');
    expect(raw).not.toContain('do-not-write');
    expect(Object.keys(JSON.parse(raw))).toEqual(['version', 'profiles']);
    expect(loadCodexCache(cachePath).codex1?.windows.fiveHour?.usedPercent).toBe(30);
    expect(readdirSync(root)).toEqual(['codex-profiles.json']);
  });
});

function makeSnapshot(id: 'codex1', usedPercent: number, fetchedAt: number): ProviderLimitSnapshot {
  return {
    id,
    provider: 'codex',
    label: id,
    status: 'ok',
    source: 'test',
    fetchedAt,
    windows: { fiveHour: createLimitWindow('fiveHour', usedPercent, 2000, 300) }
  };
}
