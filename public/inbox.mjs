import {createSignalInbox, filterSignals} from '@langboard/app-panel/inbox';
export const provider = 'github';
export const title = { en: 'Checks and commit statuses', ko: '체크 및 커밋 상태' };
export const visibleItems = (items, query, outcome) => filterSignals(items, provider, query, outcome);
export const createInbox = (session, changed) => createSignalInbox(session, provider, changed);
