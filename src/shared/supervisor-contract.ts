export const SUPERVISOR_MAX_FRAME_BYTES = 256 * 1024;
export const SUPERVISOR_MAX_QUEUED_CONTROL = 16;
export const SUPERVISOR_MAX_IN_FLIGHT_CONTROL = 1;
export const SUPERVISOR_REQUEST_DEADLINE_MS = 20_000;
export const SUPERVISOR_HEARTBEAT_TIMEOUT_MS = 30_000;
export const SUPERVISOR_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

export type SupervisorPhase = 'stopped' | 'initializing' | 'ready' | 'degraded' | 'backoff' | 'shutting-down';
export type SupervisorHealth = 'stopped' | 'connecting' | 'healthy' | 'degraded' | 'unhealthy';
export type SupervisorChannel = 'control' | 'conversation' | 'terminal' | 'transfer' | 'diagnostics' | 'update';

export interface SupervisorState {
  phase: SupervisorPhase;
  foreground: boolean;
  connectionGeneration: number;
  controlProcessCount: 0 | 1;
  health: SupervisorHealth;
  lastError: string;
}

export type SupervisorAction =
  | { type: 'foreground-start' | 'foreground-resume' | 'ready' | 'heartbeat-missed' | 'heartbeat-expired'
      | 'process-exited' | 'request-timed-out' | 'retry-elapsed' | 'background-retain'
      | 'background-stop' | 'shutdown-complete' | 'queue-saturated' }
  | { type: 'channel-failed'; channel: SupervisorChannel };

export const STOPPED_SUPERVISOR_STATE: Readonly<SupervisorState> = Object.freeze({
  phase: 'stopped',
  foreground: false,
  connectionGeneration: 0,
  controlProcessCount: 0,
  health: 'stopped',
  lastError: ''
});

export function reduceSupervisorState(state: SupervisorState, action: SupervisorAction): SupervisorState {
  switch (action.type) {
    case 'foreground-start':
      return startConnection(state);
    case 'foreground-resume':
      return state.phase === 'stopped'
        ? startConnection(state)
        : { ...state, foreground: true };
    case 'ready':
      return { ...state, phase: 'ready', controlProcessCount: 1, health: 'healthy', lastError: '' };
    case 'heartbeat-missed':
      return { ...state, phase: 'degraded', health: 'degraded', lastError: 'heartbeat_late' };
    case 'heartbeat-expired':
      return failed(state, 'heartbeat_timeout');
    case 'process-exited':
      return failed(state, 'process_exit');
    case 'request-timed-out':
      return failed(state, 'request_timeout');
    case 'retry-elapsed':
      return state.foreground ? startConnection(state) : state;
    case 'background-retain':
      return { ...state, foreground: false };
    case 'background-stop':
      return {
        ...state,
        phase: 'shutting-down',
        foreground: false,
        health: 'degraded',
        lastError: ''
      };
    case 'shutdown-complete':
      return {
        ...state,
        phase: 'stopped',
        controlProcessCount: 0,
        health: 'stopped',
        lastError: ''
      };
    case 'channel-failed':
      return action.channel === 'control' ? failed(state, 'control_failure') : state;
    case 'queue-saturated':
      return { ...state, lastError: 'backpressure' };
  }
}

function startConnection(state: SupervisorState): SupervisorState {
  return {
    phase: 'initializing',
    foreground: true,
    connectionGeneration: state.connectionGeneration + 1,
    controlProcessCount: 1,
    health: 'connecting',
    lastError: ''
  };
}

function failed(state: SupervisorState, lastError: string): SupervisorState {
  return {
    ...state,
    phase: 'backoff',
    controlProcessCount: 0,
    health: 'unhealthy',
    lastError
  };
}
