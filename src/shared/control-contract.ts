import { GENERATED_CONTROL_REQUEST_SHAPES } from './generated/agent-fleet-contracts';

export const CONTROL_PROTOCOL_VERSION = 1;
export const CONTROL_MAX_FRAME_BYTES = 256 * 1024;
const SHAPES = GENERATED_CONTROL_REQUEST_SHAPES;

const ID = /^[A-Za-z0-9._:-]{1,160}$/u;
const SESSION_ID = /^[A-Za-z0-9._:-]{1,320}$/u;
const REVISION = /^[a-f0-9]{16}$/u;
const LEGACY_SNAPSHOT_REVISION = /^[A-Za-z0-9._:-]{1,64}$/u;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/@+\\-]{0,159}$/u;
const EFFORT = /^[A-Za-z0-9][A-Za-z0-9._+\\-]{0,63}$/u;
const FORBIDDEN = new Set(['message', 'prompt', 'output', 'transcript', 'panetitle', 'command']);

export function assertAgentFleetControlRequest(input: unknown): asserts input is Record<string, unknown> {
  if (!record(input) || !exact(input, ['protocolVersion', 'type', 'requestId', 'method', 'timestamp', 'params'])
    || input.protocolVersion !== CONTROL_PROTOCOL_VERSION || input.type !== 'request'
    || !matches(input.requestId, ID) || !instant(input.timestamp) || typeof input.method !== 'string') fail('request envelope is invalid');
  const shape = SHAPES[input.method as keyof typeof SHAPES];
  if (!shape || !record(input.params) || !exact(input.params, shape.required, shape.optional)) fail('request parameters are invalid');
  if (input.method === 'session.create' && (('path' in input.params) !== ('locationKind' in input.params))) fail('session path metadata is incomplete');
  if (['directory.list', 'repository.list', 'repository.search'].includes(input.method)
    && (('expectedRevision' in input.params) !== ('idempotencyKey' in input.params))) fail('revision pair is incomplete');
  validateParameters(input.method, input.params);
  rejectPrivateFields(input);
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > CONTROL_MAX_FRAME_BYTES) fail('request exceeds its size limit');
}

export function parseAgentFleetControlRequestJson(line: string): Record<string, unknown> {
  if (new TextEncoder().encode(line).byteLength > CONTROL_MAX_FRAME_BYTES) fail('request exceeds its size limit');
  let value: unknown;
  try { value = JSON.parse(line) as unknown; } catch { fail('request is not valid JSON'); }
  assertAgentFleetControlRequest(value);
  return value;
}

export function controlMethods(): readonly string[] { return Object.keys(SHAPES); }

function validateParameters(method: string, params: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(params)) {
    if (['hostId', 'scheduleId', 'attentionId', 'presetId', 'pairingRequestId', 'invitationId', 'idempotencyKey'].includes(key)
      && !matches(value, ID)) fail(`${key} is invalid`);
    if (key === 'sessionId' && !matches(value, SESSION_ID)) fail(`${key} is invalid`);
    if (key === 'expectedRevision' && !matches(value, LEGACY_SNAPSHOT_REVISION)) fail(`${key} is invalid`);
    if (key === 'expectedConfigRevision' && !matches(value, REVISION)) fail(`${key} is invalid`);
  }
  if ('backend' in params && !member(params.backend, ['linux', 'windows'])) fail('backend is invalid');
  if ('tool' in params && !member(params.tool, ['shell', 'codex', 'claude', 'copilot'])) fail('tool is invalid');
  if ('locationKind' in params && !member(params.locationKind, ['project', 'custom'])) fail('location is invalid');
  if ('action' in params && params.action !== 'continue') fail('action is invalid');
  for (const key of ['includeSessionTitles', 'includeHidden', 'includeCatalog', 'custom', 'historyImpactAcknowledged']) {
    if (key in params && typeof params[key] !== 'boolean') fail(`${key} is invalid`);
  }
  if ('deliverAt' in params && !instant(params.deliverAt)) fail('delivery time is invalid');
  for (const key of ['path', 'parentPath', 'relativePath', 'cursor']) if (key in params && !text(params[key], 2048)) fail(`${key} is invalid`);
  if ('query' in params && (!text(params.query, 2048) || params.query.trim().length < 2)) fail('query is invalid');
  if ('project' in params && (typeof params.project !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,127}$/u.test(params.project))) fail('project is invalid');
  if ('name' in params && (!text(params.name, method === 'session.rename' ? 64 : 127) || !params.name.length)) fail('name is invalid');
  if ('modelId' in params && !matches(params.modelId, MODEL)) fail('model is invalid');
  if ('effortId' in params && !matches(params.effortId, EFFORT)) fail('effort is invalid');
  if ('preset' in params && !validPreset(params.preset)) fail('preset is invalid');
}

function validPreset(input: unknown): boolean {
  return record(input) && exact(input, ['id', 'name', 'hostId', 'project', 'backend', 'tool', 'profileAlias'])
    && matches(input.id, ID) && text(input.name, 128) && Boolean(input.name)
    && matches(input.hostId, ID) && text(input.project, 128) && Boolean(input.project)
    && member(input.backend, ['linux', 'windows']) && member(input.tool, ['shell', 'codex', 'claude', 'copilot'])
    && text(input.profileAlias, 64);
}

function rejectPrivateFields(input: unknown): void {
  if (Array.isArray(input)) { input.forEach(rejectPrivateFields); return; }
  if (!record(input)) return;
  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN.has(key.toLowerCase())) fail(`private field is forbidden: ${key}`);
    rejectPrivateFields(value);
  }
}

function exact(input: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(input); const allowed = new Set([...required, ...optional]);
  return required.every((key) => key in input) && keys.every((key) => allowed.has(key));
}
function record(input: unknown): input is Record<string, unknown> { return Boolean(input) && typeof input === 'object' && !Array.isArray(input); }
function matches(input: unknown, pattern: RegExp): input is string { return typeof input === 'string' && pattern.test(input); }
function member(input: unknown, values: readonly string[]): boolean { return typeof input === 'string' && values.includes(input); }
function text(input: unknown, maximum: number): input is string { return typeof input === 'string' && input.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(input); }
function instant(input: unknown): boolean { return typeof input === 'string' && input.length > 0 && input.length <= 40 && Number.isFinite(Date.parse(input)); }
function fail(message: string): never { throw new Error(`Invalid control request: ${message}`); }
