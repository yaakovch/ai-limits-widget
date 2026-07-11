import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateLegacyData } from '../src/main/app-paths';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('legacy data migration', () => {
  it('copies supported files once and preserves the legacy source', () => {
    const root = mkdtempSync(join(tmpdir(), 'ai-limits-migration-'));
    roots.push(root);
    const legacy = join(root, 'legacy');
    const target = join(root, 'new');
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, 'settings.json'), '{"version":1}', 'utf8');
    const first = migrateLegacyData(target, legacy, new Date('2026-07-11T00:00:00Z'));
    const second = migrateLegacyData(target, legacy);
    expect(first.migrated).toBe(true);
    expect(second.copiedFiles).toEqual(['settings.json']);
    expect(readFileSync(join(target, 'settings.json'), 'utf8')).toContain('version');
    expect(existsSync(join(legacy, 'settings.json'))).toBe(true);
  });
});
