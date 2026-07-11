import type { BrowserWindow } from 'electron';
import type { InteractionMode, WidgetSettings } from '../shared/settings';

export interface InteractionWindow {
  setAlwaysOnTop(flag: boolean, level?: string): void;
  setFocusable(focusable: boolean): void;
  setIgnoreMouseEvents(ignore: boolean, options?: { forward: boolean }): void;
  setOpacity(opacity: number): void;
  setSkipTaskbar(skip: boolean): void;
  show(): void;
  showInactive?(): void;
  focus(): void;
}

export function applyInteractionMode(
  window: InteractionWindow | BrowserWindow,
  mode: InteractionMode,
  settings: Pick<WidgetSettings, 'passiveOpacity' | 'activeOpacity'>
): void {
  window.setAlwaysOnTop(true, 'screen-saver');

  if (mode === 'passive') {
    window.setOpacity(settings.passiveOpacity);
    window.setIgnoreMouseEvents(true, { forward: true });
    window.setSkipTaskbar(true);
    window.setFocusable(false);
    if (typeof window.showInactive === 'function') window.showInactive();
    else window.show();
    return;
  }

  window.setFocusable(true);
  window.setSkipTaskbar(false);
  window.setIgnoreMouseEvents(false);
  window.setOpacity(settings.activeOpacity);
  window.show();
  window.focus();
}
