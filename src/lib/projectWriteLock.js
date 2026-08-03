export const PROJECT_WRITE_LOCK = 'kindle-publishing-navi-project-writes';

/**
 * Serializes project-level writes across tabs when the Web Locks API is
 * available. Browsers without Web Locks still run the operation normally.
 */
export async function withProjectWriteLock(operation) {
  if (typeof operation !== 'function') {
    throw new TypeError('書き込み処理が必要です');
  }

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(PROJECT_WRITE_LOCK, { mode: 'exclusive' }, operation);
  }

  return operation();
}
