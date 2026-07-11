import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildClaudeStatusLineCommand,
  ensureClaudeStatusLineInstalled,
  type ClaudeStatusLinePaths
} from '../src/main/claude-statusline-install';

const tempDirs: string[] = [];

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('Claude status-line installation', () => {
  it('uses a Git Bash-safe Windows path', () => {
    expect(buildClaudeStatusLineCommand('C:\\Users\\Test User\\limits-widget\\claude-statusline.ps1')).toBe(
      'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:/Users/Test User/limits-widget/claude-statusline.ps1"'
    );
  });

  it('installs the collector while preserving other Claude settings', () => {
    const paths = createPaths();
    mkdirSync(join(paths.settingsPath, '..'), { recursive: true });
    writeFileSync(paths.settingsPath, '{"model":"opus"}\n', 'utf8');

    const result = ensureClaudeStatusLineInstalled(paths, new Date('2026-07-10T12:00:00Z'));
    const settings = JSON.parse(readFileSync(paths.settingsPath, 'utf8')) as {
      model: string;
      statusLine: { command: string };
    };

    expect(result.status).toBe('updated');
    expect(settings.model).toBe('opus');
    expect(settings.statusLine.command).toContain('/widget/claude-statusline.ps1');
    expect(existsSync(paths.targetScript)).toBe(true);
    expect(existsSync(`${paths.settingsPath}.ai-limits-widget-backup-2026-07-10T12-00-00-000Z`)).toBe(true);
  });

  it('does not replace an unrelated custom status line', () => {
    const paths = createPaths();
    mkdirSync(join(paths.settingsPath, '..'), { recursive: true });
    writeFileSync(
      paths.settingsPath,
      JSON.stringify({ statusLine: { type: 'command', command: 'my-custom-statusline.exe' } }),
      'utf8'
    );

    const result = ensureClaudeStatusLineInstalled(paths);
    const settings = JSON.parse(readFileSync(paths.settingsPath, 'utf8')) as {
      statusLine: { command: string };
    };

    expect(result.status).toBe('conflict');
    expect(settings.statusLine.command).toBe('my-custom-statusline.exe');
  });
});

function createPaths(): ClaudeStatusLinePaths {
  const root = mkdtempSync(join(tmpdir(), 'limits-widget-'));
  tempDirs.push(root);
  const sourceScript = join(root, 'source', 'claude-statusline.ps1');
  mkdirSync(join(sourceScript, '..'), { recursive: true });
  writeFileSync(sourceScript, 'Write-Output "test"\n', 'utf8');

  return {
    sourceScript,
    targetScript: join(root, 'widget', 'claude-statusline.ps1'),
    settingsPath: join(root, 'profile', '.claude', 'settings.json')
  };
}
