export const cardInteractions = {
  pull_request: [{ key: 'merge_decision', kind: 'question', description: 'Choose whether to merge, close without merging, or defer this pull request.', default_enabled: false, choices: ['merge', 'close', 'hold'] }],
};

// Request creation is independent from provider execution and inbox observations.
export function pullRequestDecision(key, { enabled = false, expiresAt } = {}) {
  if (!enabled) return null;
  if (typeof key !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(key)) throw new Error('Stable request key required');
  if (typeof expiresAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(expiresAt) || !Number.isFinite(Date.parse(expiresAt))) throw new Error('Explicit expiry with timezone required');
  return {
    schema_version: 1, kind: 'question', app_request_key: key, expires_at: expiresAt,
    prompt: { en: 'Choose the pull request outcome', ko: 'PR 처리 방식을 선택하세요' },
    questions: [{ id: 'outcome', prompt: { en: 'Choose the pull request outcome', ko: 'PR 처리 방식을 선택하세요' }, type: 'single_choice', choices: [
      { id: 'merge', label: { en: 'Merge', ko: '머지' } },
      { id: 'close', label: { en: 'Close without merging', ko: '머지 없이 닫기' } },
      { id: 'hold', label: { en: 'Hold', ko: '보류' } },
    ] }], presentation: { type: 'choice_card' },
  };
}
