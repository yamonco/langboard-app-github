import {createSignalInbox, createSourceInbox as createScopedInbox, filterSignals} from '@langboard/app-panel/inbox';
export const provider = 'github';
export const title = { en: 'Checks and commit statuses', ko: '체크 및 커밋 상태' };
export const visibleItems = (items, query, outcome, source = provider) => filterSignals(items, source, query, outcome);
export const createInbox = (session, changed, source = provider) => createSignalInbox(session, source, changed);
export const createSourceInbox = (session, changed, source) => createScopedInbox(session, source, changed);
