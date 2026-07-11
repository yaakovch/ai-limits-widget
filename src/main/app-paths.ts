import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PRODUCT_DATA_DIRECTORY = 'AI Limits Widget';
export const LEGACY_DATA_DIRECTORY = 'limits-widget';

const MIGRATION_MARKER = 'legacy-migration-v1.json';
const MIGRATABLE_FILES = ['settings.json', 'codex-profiles.json', 'claude-limits.json', 'window-state.json'] as const;

export interface DataMigrationResult {
  migrated: boolean;
  copiedFiles: string[];
  message?: string;
}

export function getAppDataRoot(): string {
  return process.env.APPDATA ?? join(process.env.USERPROFILE ?? '.', 'AppData', 'Roaming');
}

export function getWidgetDataDir(appDataRoot = getAppDataRoot()): string {
  return process.env.AI_LIMITS_DATA_DIR || join(appDataRoot, PRODUCT_DATA_DIRECTORY);
}

export function getLegacyWidgetDataDir(appDataRoot = getAppDataRoot()): string {
  return join(appDataRoot, LEGACY_DATA_DIRECTORY);
}

export function migrateLegacyData(
  targetDir = getWidgetDataDir(),
  legacyDir = getLegacyWidgetDataDir(),
  now = new Date()
): DataMigrationResult {
  const markerPath = join(targetDir, MIGRATION_MARKER);
  if (existsSync(markerPath)) return readMigrationMarker(markerPath);

  mkdirSync(targetDir, { recursive: true });
  const copiedFiles: string[] = [];
  if (existsSync(legacyDir)) {
    for (const fileName of MIGRATABLE_FILES) {
      const source = join(legacyDir, fileName);
      const target = join(targetDir, fileName);
      if (!existsSync(target) && existsSync(source)) {
        copyFileSync(source, target);
        copiedFiles.push(fileName);
      }
    }
  }

  const result: DataMigrationResult = {
    migrated: copiedFiles.length > 0,
    copiedFiles,
    message: copiedFiles.length > 0 ? `Migrated ${copiedFiles.length} legacy data file(s)` : undefined
  };
  writeFileSync(markerPath, `${JSON.stringify({ ...result, completedAt: now.toISOString() }, null, 2)}\n`, 'utf8');
  return result;
}

function readMigrationMarker(markerPath: string): DataMigrationResult {
  try {
    const value = JSON.parse(readFileSync(markerPath, 'utf8')) as Partial<DataMigrationResult>;
    return {
      migrated: Boolean(value.migrated),
      copiedFiles: Array.isArray(value.copiedFiles) ? value.copiedFiles.filter((item): item is string => typeof item === 'string') : [],
      message: typeof value.message === 'string' ? value.message : undefined
    };
  } catch {
    return { migrated: false, copiedFiles: [] };
  }
}
