import {
  CRITICAL_USED_PERCENT,
  WARNING_USED_PERCENT,
  type LimitWindowSnapshot,
  type ProviderStatus
} from '../../shared/limits';

export function renderLimitCell(
  window: LimitWindowSnapshot | undefined,
  status: ProviderStatus,
  nowMs = Date.now()
): string {
  const level = getLevel(window);
  const remaining = window?.remainingPercent;
  const used = window?.usedPercent;
  const hasRatio = typeof remaining === 'number' && typeof used === 'number';
  const muted = hasRatio && (status === 'stale' || status === 'error');
  return `
    <div class="limit-cell ${level}">
      <div class="cell-metric">${remaining == null ? '<span class="unknown">--</span>' : `${formatPercent(remaining)} <small>left</small>`}</div>
      ${
        hasRatio
          ? `<div class="bar bar-ratio ${muted ? 'bar-muted' : ''}" aria-hidden="true"><span class="bar-remaining" style="width:${remaining}%"></span><span class="bar-used" style="width:${used}%"></span></div>`
          : '<div class="bar bar-unknown" aria-hidden="true"></div>'
      }
      <div class="cell-meta"><span>${used == null ? 'usage unknown' : `${formatPercent(used)} used`}</span><span>${formatReset(window, nowMs)}</span></div>
    </div>`;
}

export function getLevel(window: LimitWindowSnapshot | undefined): string {
  if (!window || window.usedPercent == null) return 'is-empty';
  if (window.usedPercent >= CRITICAL_USED_PERCENT) return 'is-critical';
  if (window.usedPercent >= WARNING_USED_PERCENT) return 'is-warning';
  return 'is-ok';
}

function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatReset(window: LimitWindowSnapshot | undefined, nowMs: number): string {
  if (!window?.resetsAt) return 'reset unknown';
  const diffMinutes = Math.round((window.resetsAt * 1000 - nowMs) / 60000);
  if (diffMinutes <= 0) return 'reset due';
  if (diffMinutes < 60) return `in ${diffMinutes}m`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `in ${hours}h ${diffMinutes % 60}m`;
  return `in ${Math.floor(hours / 24)}d ${hours % 24}h`;
}
