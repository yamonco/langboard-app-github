import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runObservation } from './observation.mjs';
const config = { hostOrigin: 'https://host.example', providerOrigin: 'https://api.github.com',
  scope: { boardUID: 'board000001', resourceUID: 'resour00001', appRevision: 'a'.repeat(64), bindingRevision: 'b'.repeat(64),
    owner: 'example', repository: 'demo', externalId: '1', checkRunId: '42' } };
const credentials = { hostToken: 'lbac_' + 'a'.repeat(43), providerToken: 'private-provider-test' };
test('independent read persists before unknown submit and recovers without provider reads', async () => {
 const directory = await mkdtemp(join(tmpdir(), 'github-observation-'));
 try {
  const path = join(directory, 'event.json'); let reads = 0; const bodies = [];
  const request = async (url, options) => {
   if (url.startsWith(config.providerOrigin)) {
    reads++;
    return new Response(JSON.stringify(url.endsWith('/check-runs/42') ?
     { id: 42, status: 'completed', conclusion: 'success', head_sha: 'c'.repeat(40), completed_at: '2026-10-11T00:00:00Z', output: 'private' } :
     { id: 1, full_name: 'example/demo' }));
   }
   bodies.push(options.body); assert.equal((await stat(path)).mode & 0o777, 0o600);
   if (bodies.length === 1) throw new Error('Unknown receipt');
   return new Response(JSON.stringify({ signal_uid: 'signal00001', duplicate: true }));
  };
  const args = { path, config, credentials };
  await assert.rejects(runObservation(args, request), /Unknown receipt/);
  const saved = await readFile(path, 'utf8');
  assert.ok(!saved.includes(credentials.providerToken) && !saved.includes(credentials.hostToken) && !saved.includes('private'));
  assert.deepEqual(await runObservation({ ...args, resend: true }, request), [{ signal_uid: 'signal00001', duplicate: true }]);
  assert.equal(reads, 2); assert.deepEqual(bodies[0], bodies[1]);
  for (const patch of [{ hostOrigin: 'https://other.example' }, { providerOrigin: 'https://other.example' }]) {
   await assert.rejects(runObservation({ ...args, config: { ...config, ...patch }, resend: true }, request), /destination changed/);
  }
  assert.equal(bodies.length, 2);
  await assert.rejects(runObservation(args, request), /EEXIST/);
  assert.equal(await readFile(path, 'utf8'), saved);
 } finally { await rm(directory, { recursive: true, force: true }); }
});
