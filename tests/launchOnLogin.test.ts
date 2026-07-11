import { describe, expect, it } from 'vitest';
import { buildShortcutScript } from '../src/main/launch-on-login';

describe('launch-on-login shortcut script', () => {
  it('creates a Startup shortcut that launches the dev app from the project root', () => {
    const script = buildShortcutScript(
      "C:\\Users\\Test User\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\AI Limits Widget.lnk",
      "C:\\projects\\limits"
    );

    expect(script).toContain('CreateShortcut');
    expect(script).toContain("TargetPath = 'powershell.exe'");
    expect(script).toContain("Set-Location -LiteralPath ''C:\\projects\\limits''; npm run dev");
    expect(script).toContain('AI Limits Widget');
  });
});
