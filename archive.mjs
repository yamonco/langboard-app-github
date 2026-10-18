// Called by the authenticated event adapter after current host authority checks.
// This module exposes no public endpoint and never owns credentials or retries.
export const cardLifecycle = {
  issue: { archive: { mode: 'external', action: 'close_issue', default_enabled: false, description: 'When archive sync is enabled, close the linked GitHub issue; retain its comments and history.' }, restore: 'retain_external_state' },
  pull_request: { archive: { mode: 'retain', description: 'Retain pull request state; archiving a card never closes or merges a pull request.' }, restore: 'retain_external_state' },
};

export async function archiveIssue({ enabled = false, apiOrigin = 'https://api.github.com', owner, repository, number, token }, request = fetch) {
  if (enabled !== true) return { state: 'retained', external_action: 'none' };
  const origin = new URL(apiOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== apiOrigin || origin.username || origin.password) throw new Error('Exact HTTPS API origin required');
  if (![owner, repository].every(v => typeof v === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(v)) || !Number.isSafeInteger(number) || number < 1 || typeof token !== 'string' || !token) throw new Error('Invalid issue identity or credential');
  const url = `${apiOrigin}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/issues/${number}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' };
  let writeAttempted = false;
  const read = async () => {
    const response = await request(url, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Read failed');
    const item = await response.json();
    if (item.number !== number || item.pull_request || !['open', 'closed'].includes(item.state)) throw new Error('Unexpected issue resource');
    return item;
  };
  try {
    const before = await read();
    if (before.state === 'closed') return { state: 'already_applied', external_state: 'closed' };
    writeAttempted = true;
    const response = await request(url, { method: 'PATCH', headers, redirect: 'error', signal: AbortSignal.timeout(15000), body: JSON.stringify({ state: 'closed' }) });
    if (!response.ok) return { state: response.status >= 500 ? 'unknown' : 'failed', http_status: response.status };
    const after = await read();
    return after.state === 'closed' ? { state: 'applied', external_state: 'closed' } : { state: 'unknown' };
  } catch {
    return { state: writeAttempted ? 'unknown' : 'failed' };
  }
}
