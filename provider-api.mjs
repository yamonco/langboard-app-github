/** Read-only GitHub Checks API adapter. Credentials and repository mapping stay server-side. */
export function githubApi({origin = 'https://api.github.com', token, apiVersion = '2022-11-28'}, request = fetch) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.origin !== origin || typeof token !== 'string' || !token) throw new Error('Exact HTTPS GitHub origin and credential required');
  async function get(path) {
    const response = await request(origin + path, { method:'GET', headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':apiVersion}, redirect:'error', signal:AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('GitHub check read failed');
    const reader = response.body.getReader(); let bytes = 0; const chunks = [];
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength; if (bytes > 1048576) throw new Error('GitHub response exceeds byte limit'); chunks.push(Buffer.from(value)); }
    } finally { await reader.cancel(); reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  return { async readCheckRun({owner, repository, checkRunId, externalId}) {
    if (![owner, repository].every(v => typeof v === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(v)) || typeof checkRunId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(checkRunId) || typeof externalId !== 'string' || !/^[1-9][0-9]{0,19}$/.test(externalId)) throw new Error('Invalid repository or check identity');
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
    const current = await get(path);
    if (String(current?.id) !== externalId || current?.full_name?.toLowerCase() !== `${owner}/${repository}`.toLowerCase()) throw new Error('GitHub repository identity mismatch');
    const body=await get(`${path}/check-runs/${checkRunId}`); if (!body || String(body.id)!==String(checkRunId)) throw new Error('GitHub check identity mismatch');
    return body;
  } };
}
