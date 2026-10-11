import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { archiveReceiver, archiveStore, verifyArchiveEvent } from './archive-receiver.mjs';
import { panelServer, configuration } from './server.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const event = { schema_version: 1, event_type: 'io.langboard.app.card.archived.v1', event_uid: 'event000001', archive_uid: 'archiv00001', board_uid: 'board000001', card_uid: 'card0000001', connection_uid: 'connect0001', app_key: 'github-panel', card_type: 'issue', external_resource_id: 'example/project#42', action: 'close_issue' };
function signed(value) {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify(value));
  const signature = createHmac('sha256', 'webhook-secret').update(`${timestamp}.`).update(body).digest('hex');
  return [body, { 'x-langboard-webhook-version': '1', 'x-langboard-webhook-timestamp': String(timestamp), 'x-langboard-webhook-signature': `v1=${signature}` }];
}

test('archive event authenticates exact bytes and rejects altered bytes', () => {
  const [body, headers] = signed(event);
  assert.deepEqual(verifyArchiveEvent(body, headers, 'webhook-secret'), event);
  assert.throws(() => verifyArchiveEvent(Buffer.from(JSON.stringify({ ...event, action: 'delete_issue' })), headers, 'webhook-secret'));
});

test('durable claim and report survive reopening without storing credentials', () => {
  const folder = mkdtempSync(join(tmpdir(), 'archive-receiver-'));
  try {
    let store = archiveStore(join(folder, 'ledger.sqlite'));
    assert.equal(store.claim(event.archive_uid, event).inserted, true);
    const report = { expected_revision: 0, outcome: { state: 'unknown', external_state: null, readback_confirmed: false } };
    store.record(event.archive_uid, report); store.close();
    store = archiveStore(join(folder, 'ledger.sqlite'));
    assert.deepEqual(store.claim(event.archive_uid, event), { inserted: false, report });
    assert.throws(() => store.claim(event.archive_uid, { ...event, card_uid: 'card0000002' }));
    store.close();
  } finally { rmSync(folder, { recursive: true }); }
});

test('archive HTTP route is opt-in and bounds signed request bytes', async t => {
  const server = panelServer(configuration(), { receiveArchive: async (body, headers) => {
    verifyArchiveEvent(body, headers, 'webhook-secret'); return { state: 'applied' };
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/events/archive`;
  const [body, headers] = signed(event);
  assert.equal((await fetch(url, { method: 'POST', body, headers })).status, 200);
  assert.equal((await fetch(url, { method: 'POST', body, headers: {} })).status, 403);
  assert.equal((await fetch(url, { method: 'POST', body: Buffer.alloc(65537) })).status, 413);
});

test('receiver persists claim before provider action and reuses the same report', async () => {
  const store = archiveStore(':memory:');
  const calls = [];
  const host = { read: async () => ({ archive_uid: event.archive_uid, receipt: { event_uid: event.event_uid, connection_uid: event.connection_uid, card_type: 'issue', external_resource_id: event.external_resource_id, archive_policy: { action: 'close_issue' }, outcome_revision: 0, state: 'pending' } }), report: async (_event, body) => { calls.push(body); if (calls.filter(v => typeof v === 'object').length === 1) throw new Error('Lost report response'); return { changed: true }; } };
  const receiver = archiveReceiver({ secret: 'webhook-secret', store, host, resolveIssue: async () => ({ enabled: true, appKey: event.app_key, boardUID: event.board_uid, connectionUID: event.connection_uid, owner: 'example', repository: 'project', number: 42, apiOrigin: 'https://api.github.com', token: 'provider-secret' }), providerRequest: async (_url, init) => { calls.push(init.method); return new Response(JSON.stringify({ number: 42, state: calls.includes('PATCH') ? 'closed' : 'open' })); } });
  const [body, headers] = signed(event);
  await assert.rejects(receiver(body, headers), /Lost report response/);
  await receiver(body, headers);
  assert.equal(calls.filter(value => value === 'PATCH').length, 1);
  assert.equal(calls.filter(value => typeof value === 'object').length, 2);
  store.close();
});
