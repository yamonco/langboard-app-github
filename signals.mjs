import { createHash } from 'node:crypto';
import { signalPublisher } from '@langboard/app-server';
const outcomes = new Set(['success','failure','neutral','cancelled','timed_out','action_required','stale','skipped']);
export const signalPolicy = { version:1, resource_types:['repository'], event_types:['check.completed'], outcome_states:Object.fromEntries([...outcomes].map(value=>[value, value==='success'?'passed':value==='failure'?'failed':value==='cancelled'?'cancelled':'unknown'])), commit_mode:'required', time_basis:'provider_occurrence' };
export function normalizeCheck(row, scope) {
  if (!row || String(row.id)!==String(scope.checkRunId) || row.status!=='completed' || !outcomes.has(row.conclusion) ||
      typeof row.head_sha!=='string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(row.head_sha) || typeof row.completed_at!=='string' || row.completed_at.length>40 || !/(?:Z|[+-]\d{2}:\d{2})$/.test(row.completed_at) || !Number.isFinite(Date.parse(row.completed_at))) throw new Error('Invalid check observation');
  const evidence={event_type:'check.completed',occurred_at:new Date(row.completed_at).toISOString(),external_id:String(row.id),outcome:row.conclusion,commit_sha:row.head_sha};
  return {...evidence,event_id:createHash('sha256').update(JSON.stringify({resource:scope.externalId,...evidence})).digest('hex')};
}
export async function observeCheck({api,scope,host,saveEnvelope},request=fetch) { const row=await api.readCheckRun(scope); const envelope={version:1,board_uid:scope.boardUID,resource_uid:scope.resourceUID,app_revision:scope.appRevision,binding_revision:scope.bindingRevision,...normalizeCheck(row,scope)}; await saveEnvelope(envelope); return signalPublisher(host,request)(envelope); }
