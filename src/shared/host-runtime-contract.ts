export type HostRuntimeErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'conflict'
  | 'stale_revision'
  | 'unsupported'
  | 'unavailable'
  | 'timeout'
  | 'resource_limit'
  | 'tmux_unavailable'
  | 'helper_unavailable'
  | 'unsafe_state'
  | 'internal_failure'
  | 'SESSION_UNAVAILABLE'
  | 'PROVIDER_UNAVAILABLE'
  | 'TRANSFER_REJECTED'
  | 'REPOSITORY_UNAVAILABLE';

export interface HostRuntimeRecovery {
  title: string;
  action: string;
  actionKind: 'retry' | 'refresh' | 'review' | 'terminal' | 'rollback';
}

export const HOST_RUNTIME_RECOVERY: Readonly<Record<HostRuntimeErrorCode, HostRuntimeRecovery>> = {
  invalid_request: { title: 'Host request rejected', action: 'Review the request', actionKind: 'review' },
  not_found: { title: 'Host resource not found', action: 'Refresh host state', actionKind: 'refresh' },
  conflict: { title: 'Host state changed', action: 'Refresh host state', actionKind: 'refresh' },
  stale_revision: { title: 'Host state changed', action: 'Refresh host state', actionKind: 'refresh' },
  unsupported: { title: 'Host capability unsupported', action: 'Update or roll back', actionKind: 'rollback' },
  unavailable: { title: 'Host capability unavailable', action: 'Retry host capability', actionKind: 'retry' },
  timeout: { title: 'Host operation timed out', action: 'Retry operation', actionKind: 'retry' },
  resource_limit: { title: 'Host operation limit reached', action: 'Retry after current work', actionKind: 'retry' },
  tmux_unavailable: { title: 'Host session service unavailable', action: 'Repair tmux', actionKind: 'review' },
  helper_unavailable: { title: 'Host runtime incomplete', action: 'Repair the host runtime', actionKind: 'rollback' },
  unsafe_state: { title: 'Host state could not be verified', action: 'Refresh host state', actionKind: 'refresh' },
  internal_failure: { title: 'Host operation failed safely', action: 'Retry host capability', actionKind: 'retry' },
  SESSION_UNAVAILABLE: { title: 'Session unavailable', action: 'Refresh sessions', actionKind: 'refresh' },
  PROVIDER_UNAVAILABLE: { title: 'Native provider unavailable', action: 'Open Terminal', actionKind: 'terminal' },
  TRANSFER_REJECTED: { title: 'Transfer rejected', action: 'Review the transfer', actionKind: 'review' },
  REPOSITORY_UNAVAILABLE: { title: 'Repository unavailable', action: 'Refresh repository', actionKind: 'refresh' }
};

export function hostRuntimeRecovery(code: string): HostRuntimeRecovery | null {
  return code in HOST_RUNTIME_RECOVERY
    ? HOST_RUNTIME_RECOVERY[code as HostRuntimeErrorCode]
    : null;
}
