import {
  parseBridgeFleetSnapshot,
  parseFleetDirectoryListing,
  parseFleetModelControlMutationResult,
  parseFleetModelControlState,
  parseFleetRepositoryPage
} from './fleet-protocol';
import { GENERATED_OBJECT_SHAPES } from './generated/agent-fleet-contracts';

const MAX_RESULT_BYTES = 256 * 1024;
const MAX_NESTING_DEPTH = 16;
const PRIVATE_FIELDS = new Set(['message', 'prompt', 'output', 'transcript', 'panetitle', 'command']);

export function assertAgentFleetControlResult(input: unknown): asserts input is Record<string, unknown> {
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > MAX_RESULT_BYTES) fail('result exceeds its size limit');
  inspect(input, 0);
  const value = record(input);
  const keys = new Set(Object.keys(value));
  if (keys.has('methods') && keys.has('events')) validateCapabilities(value);
  else if (keys.has('revision') && keys.has('hosts')) parseBridgeFleetSnapshot(value);
  else if (same(keys, ['backend', 'path', 'parentPath', 'entries', 'shortcuts', 'truncated'])) parseFleetDirectoryListing(value);
  else if (same(keys, ['rootName', 'relativePath', 'parentPath', 'entries', 'nextCursor', 'truncated'])) parseFleetRepositoryPage(value);
  else if (same(keys, ['sessionId', 'configRevision', 'tool', 'status', 'selected', 'effective', 'pending', 'catalog', 'detail'])) parseFleetModelControlState(value);
  else if (same(keys, ['operationId', 'status', 'modelControl'])) parseFleetModelControlMutationResult(value);
  else if (keys.has('operationId') && keys.has('status') && keys.has('snapshot')) validateMutation(value);
  else fail('result family is unknown');
}

export function parseAgentFleetControlResultsFixtureJson(input: string): unknown[] {
  if (new TextEncoder().encode(input).byteLength > MAX_RESULT_BYTES) fail('fixture exceeds its size limit');
  let parsed: unknown;
  try { parsed = JSON.parse(input) as unknown; } catch { fail('fixture is not valid JSON'); }
  const root = record(parsed);
  if (!same(new Set(Object.keys(root)), ['schemaVersion', 'results']) || root.schemaVersion !== 1 || !Array.isArray(root.results)) fail('fixture envelope is invalid');
  root.results.forEach(assertAgentFleetControlResult);
  return root.results;
}

function validateCapabilities(value: Record<string, unknown>): void {
  shape(value, 'control-results-v1:#/$defs/capabilityBase');
  if (('agentVersion' in value) === ('bridgeVersion' in value)) fail('capability component identity is invalid');
  if (value.protocolVersion !== 1 || typeof value.contractPackageVersion !== 'string') fail('capability versions are invalid');
  for (const name of ['controlVersions', 'conversationVersions', 'workspaceLayoutVersions']) versions(value[name]);
  stringArray(value.methods, 64); stringArray(value.events, 16);
}

function validateMutation(value: Record<string, unknown>): void {
  shape(value, 'control-results-v1:#/$defs/mutation');
  if (Object.keys(value).length > 4 || !token(value.operationId, 160) || !token(value.status, 32)) fail('mutation identity is invalid');
  parseBridgeFleetSnapshot(value.snapshot);
  if ('doctor' in value) {
    const doctor = shaped(value.doctor, 'control-results-v1:#/$defs/doctor');
    if (!Array.isArray(doctor.checks) || doctor.checks.length > 32) fail('doctor checks are invalid');
    doctor.checks.forEach((check) => shape(record(check), 'control-results-v1:#/$defs/doctorCheck'));
  }
  if ('invitation' in value) {
    const invitation = shaped(value.invitation, 'control-results-v1:#/$defs/invitation');
    shape(record(invitation.file), 'control-results-v1:#/$defs/invitationFile');
  }
  if ('pairingRequest' in value) {
    const pairing = shaped(value.pairingRequest, 'control-results-v1:#/$defs/pairingRequest');
    const proposal = shaped(pairing.proposal, 'control-results-v1:#/$defs/pairingProposal');
    shape(record(proposal.fallback), 'control-results-v1:#/$defs/pairingProposal/properties/fallback');
  }
}

function shaped(input: unknown, id: keyof typeof GENERATED_OBJECT_SHAPES): Record<string, unknown> {
  const value = record(input); shape(value, id); return value;
}
function shape(value: Record<string, unknown>, id: keyof typeof GENERATED_OBJECT_SHAPES): void {
  const model = GENERATED_OBJECT_SHAPES[id];
  const keys = Object.keys(value); const allowed = new Set<string>([...model.required, ...model.optional]);
  if (!model.required.every((name) => name in value) || keys.some((name) => !allowed.has(name))) fail(`${id} fields are invalid`);
}
function inspect(input: unknown, depth: number): void {
  if (depth > MAX_NESTING_DEPTH) fail('result nesting is too deep');
  if (Array.isArray(input)) { input.forEach((value) => inspect(value, depth + 1)); return; }
  if (!input || typeof input !== 'object') return;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (PRIVATE_FIELDS.has(key.toLowerCase())) fail(`private field is forbidden: ${key}`);
    inspect(value, depth + 1);
  }
}
function versions(input: unknown): void {
  if (!Array.isArray(input) || input.length < 1 || input.length > 8 || new Set(input).size !== input.length
    || input.some((value) => !Number.isInteger(value) || value < 1 || value > 1024)) fail('protocol versions are invalid');
}
function stringArray(input: unknown, maximum: number): void {
  if (!Array.isArray(input) || input.length > maximum || new Set(input).size !== input.length
    || input.some((value) => typeof value !== 'string' || value.length < 1 || value.length > 64)) fail('capability list is invalid');
}
function token(input: unknown, maximum: number): boolean { return typeof input === 'string' && input.length > 0 && input.length <= maximum && /^[A-Za-z0-9._:-]+$/u.test(input); }
function same(actual: ReadonlySet<string>, expected: readonly string[]): boolean { return actual.size === expected.length && expected.every((key) => actual.has(key)); }
function record(input: unknown): Record<string, unknown> { if (!input || typeof input !== 'object' || Array.isArray(input)) fail('result is not an object'); return input as Record<string, unknown>; }
function fail(message: string): never { throw new Error(`Invalid control result: ${message}`); }
