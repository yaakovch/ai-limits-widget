import { describe, expect, it } from 'vitest';
import { applyInteractionMode, type InteractionWindow } from '../src/main/window-mode';
import { createDefaultSettings } from '../src/shared/settings';

class FakeWindow implements InteractionWindow {
  calls: string[] = [];

  setAlwaysOnTop(flag: boolean, level?: string): void {
    this.calls.push(`always:${flag}:${level ?? ''}`);
  }

  setFocusable(focusable: boolean): void {
    this.calls.push(`focusable:${focusable}`);
  }

  setIgnoreMouseEvents(ignore: boolean, options?: { forward: boolean }): void {
    this.calls.push(`ignore:${ignore}:${options?.forward ?? false}`);
  }

  setOpacity(opacity: number): void {
    this.calls.push(`opacity:${opacity}`);
  }

  setSkipTaskbar(skip: boolean): void {
    this.calls.push(`taskbar:${skip}`);
  }

  show(): void {
    this.calls.push('show');
  }

  showInactive(): void {
    this.calls.push('showInactive');
  }

  focus(): void {
    this.calls.push('focus');
  }
}

describe('interaction mode', () => {
  it('applies passive click-through settings', () => {
    const settings = createDefaultSettings();
    const window = new FakeWindow();

    applyInteractionMode(window, 'passive', settings);

    expect(window.calls).toEqual([
      'always:true:screen-saver',
      'opacity:0.8',
      'ignore:true:true',
      'taskbar:true',
      'focusable:false',
      'showInactive'
    ]);
  });

  it('applies active clickable settings', () => {
    const settings = createDefaultSettings();
    const window = new FakeWindow();

    applyInteractionMode(window, 'active', settings);

    expect(window.calls).toEqual([
      'always:true:screen-saver',
      'focusable:true',
      'taskbar:false',
      'ignore:false:false',
      'opacity:1',
      'show',
      'focus'
    ]);
  });
});
