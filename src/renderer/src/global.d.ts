import type { LimitsWidgetApi } from '../../preload';

declare global {
  interface Window {
    limitsWidget: LimitsWidgetApi;
  }
}
