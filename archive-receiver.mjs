import { createHmac, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { archiveIssue } from './archive.mjs';

const uid = value => typeof value === 'string' && /^[A-Za-z0-9]{11}$/.test(value);
const eventType = 'io.langboard.app.card.archived.v1';

/** App-local operation receipts survive restarts; no credentials are stored. */
export function archiveStore(path) {
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE IF NOT EXISTS archives (uid TEXT PRIMARY KEY, event TEXT NOT NULL, report TEXT)');
  return {
    claim(id, event) {
      const encoded = JSON.stringify(event);
      const inserted = db.prepare('INSERT OR IGNORE INTO archives(uid,event) VALUES (?,?)').run(id, encoded).changes === 1;
      const row = db.prepare('SELECT event,report FROM archives WHERE uid=?').get(id);
      if (row.event !== encoded) throw new Error('Archive identity conflict');
      return { inserted, report: row.report ? JSON.parse(row.report) : null };
    },
    record(id, report) { db.prepare('UPDATE archives SET report=? WHERE uid=? AND report IS NULL').run(JSON.stringify(report), id); },
    close() { db.close(); },
  };
}

export function verifyArchiveEvent(body, headers, secret, now = Math.floor(Date.now() / 1000)) {
  if (!Buffer.isBuffer(body) || body.length > 65536 || typeof secret !== 'string' || !secret) throw new Error('Invalid webhook');
  const timestamp = headers['x-langboard-webhook-timestamp'];
  const signature = headers['x-langboard-webhook-signature'];
  if (headers['x-langboard-webhook-version'] !== '1' || !/^[0-9]{1,12}$/.test(timestamp ?? '') ||
      !/^v1=[0-9a-f]{64}$/.test(signature ?? '') || now - Number(timestamp) > 300 || now - Number(timestamp) < -30) throw new Error('Invalid webhook');
  const expected = createHmac('sha256', secret).update(timestamp + '.').update(body).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(3), 'hex'))) throw new Error('Invalid webhook');
  const event = JSON.parse(body.toString('utf8'));
  if (event.schema_version !== 1 || event.event_type !== eventType || event.card_type !== 'issue' || event.action !== 'close_issue' ||
      !['event_uid', 'archive_uid', 'board_uid', 'card_uid', 'connection_uid'].every(key => uid(event[key]))) throw new Error('Invalid archive event');
  return event;
}

/** Authenticated host calls use configured origin and token, never payload URLs. */
export function archiveHost({ origin, token }, request = fetch) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password || !token) throw new Error('Exact HTTPS host origin and credential required');
  const call = async (event, method, report) => {
    const path = `/apps/v1/boards/${event.board_uid}/archives/${event.archive_uid}${method === 'POST' ? '/outcome' : ''}`;
    const response = await request(origin + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(report ? { body: JSON.stringify(report) } : {}), redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Current host authority or report unavailable');
    return await response.json();
  };
  return { read: event => call(event, 'GET'), report: (event, report) => call(event, 'POST', report) };
}

/** Caller supplies a trusted, explicitly enabled per-connection issue mapping. */
export function archiveReceiver({ secret, store, host, resolveIssue, providerRequest = fetch }) {
  return async (body, headers) => {
    const event = verifyArchiveEvent(body, headers, secret);
    const context = await resolveIssue(event);
    if (!context || context.enabled !== true || context.appKey !== event.app_key || context.boardUID !== event.board_uid ||
        context.connectionUID !== event.connection_uid || `${context.owner}/${context.repository}#${context.number}` !== event.external_resource_id) throw new Error('Archive feature or mapping unavailable');
    const current = await host.read(event);
    const receipt = current.receipt;
    if (current.archive_uid !== event.archive_uid || receipt?.event_uid !== event.event_uid || receipt.connection_uid !== event.connection_uid ||
        receipt.card_type !== 'issue' || receipt.external_resource_id !== event.external_resource_id ||
        receipt.archive_policy?.action !== 'close_issue' || !Number.isSafeInteger(receipt.outcome_revision)) throw new Error('Current archive identity mismatch');
    const claim = store.claim(event.archive_uid, event);
    if (['applied', 'already_applied'].includes(receipt.state)) return { state: receipt.state, changed: false };
    let report = claim.report;
    if (!claim.inserted && !report) return { state: 'processing', changed: false };
    if (!report) {
      // A crash or concurrent claim after persistence must never repeat a provider mutation.
      const outcome = await archiveIssue(context, providerRequest);
      report = { expected_revision: receipt.outcome_revision, outcome: {
        state: outcome.state, external_state: outcome.external_state ?? null,
        readback_confirmed: ['applied', 'already_applied'].includes(outcome.state),
      } };
      store.record(event.archive_uid, report);
    }
    // A lost report response only replays the same durable report, not the provider action.
    return await host.report(event, report);
  };
}
