import test from 'node:test';
import assert from 'node:assert/strict';
import { cardInteractions, pullRequestDecision } from './interactions.mjs';
test('PR choices require opt-in and contain no execution or implicit stage grants', () => {
  assert.equal(pullRequestDecision('pr-42'), null);
  assert.equal(cardInteractions.pull_request[0].default_enabled, false);
  const request = pullRequestDecision('pr-42', { enabled: true, expiresAt: '2026-10-11T01:00:00Z' });
  assert.deepEqual(request.questions[0].choices.map(choice => choice.id), ['merge', 'close', 'hold']);
  assert.equal(request.execution, undefined);
  assert.equal(request.outcomes, undefined);
  assert.throws(() => pullRequestDecision('bad key', { enabled: true }));
  assert.throws(() => pullRequestDecision('pr-42', { enabled: true }));
});
