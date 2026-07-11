import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BrowserWindow, Rectangle } from 'electron';

interface SavedWindowState {
  x?: number;
  y?: number;
}

export function loadWindowPosition(filePath: string): Pick<Rectangle, 'x' | 'y'> | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as SavedWindowState;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function saveWindowPosition(filePath: string, window: BrowserWindow): void {
  const [x, y] = window.getPosition();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify({ x, y }, null, 2), 'utf8');
}
