import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createLimitWindow,
  type CodexProfileId,
  type LimitWindowId,
  type LimitWindowSnapshot,
  type ProviderLimitSnapshot
} from '../shared/limits';
import { getWidgetDataDir } from './app-paths';

export interface CachedProfile {
  fetchedAt: number;
  windows: Partial<Record<LimitWindowId, LimitWindowSnapshot>>;
}

interface CodexCacheFile {
  version: 1;
  profiles: Record<CodexProfileId, CachedProfile | undefined>;
}

export function getCodexCachePath(): string {
  return join(getWidgetDataDir(), 'codex-profiles.json');
}

export function loadCodexCache(cachePath = getCodexCachePath()): Partial<Record<CodexProfileId, CachedProfile>> {
  if (!existsSync(cachePath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(cachePath, 'utf8').replace(/^\uFEFF/, '')) as CodexCacheFile;
    if (parsed.version !== 1 || !parsed.profiles || typeof parsed.profiles !== 'object') return {};

    const profiles: Partial<Record<CodexProfileId, CachedProfile>> = {};
    for (const id of Object.keys(parsed.profiles)) {
      const cached = parsed.profiles[id];
      if (!cached || !Number.isFinite(cached.fetchedAt)) continue;
      const windows = normalizeWindows(cached.windows);
      if (Object.keys(windows).length === 0) continue;
      profiles[id] = { fetchedAt: cached.fetchedAt, windows };
    }
    return profiles;
  } catch {
    return {};
  }
}

export function saveCodexCache(
  snapshots: readonly ProviderLimitSnapshot[],
  cachePath = getCodexCachePath()
): void {
  const profiles: Record<CodexProfileId, CachedProfile | undefined> = {};
  for (const snapshot of snapshots) {
    if (snapshot.provider !== 'codex' || snapshot.fetchedAt === null || Object.keys(snapshot.windows).length === 0) continue;
    profiles[snapshot.id] = {
      fetchedAt: snapshot.fetchedAt,
      windows: normalizeWindows(snapshot.windows)
    };
  }

  const payload: CodexCacheFile = { version: 1, profiles };
  mkdirSync(dirname(cachePath), { recursive: true });
  const tempPath = `${cachePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  renameSync(tempPath, cachePath);
}

function normalizeWindows(
  windows: Partial<Record<LimitWindowId, LimitWindowSnapshot>>
): Partial<Record<LimitWindowId, LimitWindowSnapshot>> {
  const normalized: Partial<Record<LimitWindowId, LimitWindowSnapshot>> = {};
  for (const id of ['fiveHour', 'weekly'] as const) {
    const window = windows?.[id];
    if (!window || (window.usedPercent !== null && !Number.isFinite(window.usedPercent))) continue;
    normalized[id] = createLimitWindow(
      id,
      window.usedPercent,
      typeof window.resetsAt === 'number' && Number.isFinite(window.resetsAt) ? window.resetsAt : null,
      typeof window.durationMinutes === 'number' && Number.isFinite(window.durationMinutes)
        ? window.durationMinutes
        : null
    );
  }
  return normalized;
}
