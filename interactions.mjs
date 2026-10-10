export const cardInteractions = {
  pull_request: [{ key: 'merge_decision', kind: 'question', description: 'Choose whether to merge, close without merging, or defer this pull request.', default_enabled: false, choices: ['merge', 'close', 'hold'] }],
};

// Request creation is independent from provider execution and inbox observations.
export function pullRequestDecision(key, { enabled = false } = {}) {
  if (!enabled) return null;
  if (typeof key !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(key)) throw new Error('Stable request key required');
  return {
    schema_version: 1, kind: 'question', app_request_key: key,
    prompt: { en: 'Choose the pull request outcome', ko: 'PR 처리 방식을 선택하세요' },
    questions: [{ id: 'outcome', type: 'single_choice', choices: [
      { id: 'merge', label: { en: 'Merge', ko: '머지' } },
      { id: 'close', label: { en: 'Close without merging', ko: '머지 없이 닫기' } },
      { id: 'hold', label: { en: 'Hold', ko: '보류' } },
    ] }], presentation: { type: 'choice_card' },
  };
}
