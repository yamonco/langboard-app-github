import { archiveReceiver as receiver } from '@langboard/app-server';
import { archiveIssue } from './archive.mjs';
export { archiveStore, archiveHost, verifyArchiveEvent } from '@langboard/app-server';

export function archiveReceiver({ secret, store, host, resolveIssue, providerRequest = fetch }) {
  return receiver({ secret, store, host, cardType: 'issue', action: 'close_issue',
    resolveContext: async event => { const context = await resolveIssue(event); return context && { ...context, externalResourceId: `${context.owner}/${context.repository}#${context.number}` }; },
    execute: context => archiveIssue(context, providerRequest),
  });
}
