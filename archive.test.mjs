import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveIssue } from './archive.mjs';

const context = { enabled: true, owner: 'example', repository: 'project', number: 42, token: 'test-only' };
test('archive sync defaults off and cannot make a provider request', async () => {
  const result = await archiveIssue({}, () => { throw new Error('Must not call provider'); });
  assert.deepEqual(result, { state: 'retained', external_action: 'none' });
});
test('open issue closes once and requires a current closed readback', async () => {
  const calls = [];
  const result = await archiveIssue(context, async (url, init) => {
    calls.push(init);
    return new Response(JSON.stringify({ number: 42, state: calls.length === 1 ? 'open' : 'closed' }));
  });
  assert.deepEqual(result, { state: 'applied', external_state: 'closed' });
  assert.equal(calls.length, 3);
  assert.equal(calls[1].method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[1].body), { state: 'closed' });
  assert.equal(calls[1].redirect, 'error');
});
test('already closed is idempotent; pull requests never close', async () => {
  for (const resource of [{ number: 42, state: 'closed' }, { number: 42, state: 'open', pull_request: {} }]) {
    let calls = 0;
    const result = await archiveIssue(context, async () => { calls++; return new Response(JSON.stringify(resource)); });
    assert.equal(calls, 1);
    assert.equal(result.state, resource.pull_request ? 'failed' : 'already_applied');
  }
});
test('lost write response is unknown and never retried; credentials are absent from receipt', async () => {
  let calls = 0;
  const result = await archiveIssue(context, async () => {
    if (++calls === 1) return new Response(JSON.stringify({ number: 42, state: 'open' }));
    throw new Error('secret test-only');
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, { state: 'unknown' });
});
test('denied write is a failed receipt; successful write without closed readback is unknown', async () => {
  for (const status of [403, 500, 200]) {
    let calls = 0;
    const result = await archiveIssue(context, async () => {
      calls++;
      return calls === 2 ? new Response('{}', { status }) : new Response(JSON.stringify({ number: 42, state: 'open' }));
    });
    assert.equal(result.state, status === 403 ? 'failed' : 'unknown');
    assert.equal(calls, status === 200 ? 3 : 2);
  }
});
