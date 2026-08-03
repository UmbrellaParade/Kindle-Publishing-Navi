const pendingSaves = new Map();
const inFlightSaves = new Set();
const inFlightSaveCountsByKey = new Map();
const saveErrors = new Map();
let saveQueue = Promise.resolve();

function currentSaveCount() {
  return pendingSaves.size + inFlightSaves.size;
}

function notifySaveState() {
  notify('kindle-save-pending', {
    count: currentSaveCount(),
    errorCount: saveErrors.size,
  });
}

function markInFlight(key) {
  inFlightSaveCountsByKey.set(key, (inFlightSaveCountsByKey.get(key) || 0) + 1);
}

function unmarkInFlight(key) {
  const nextCount = (inFlightSaveCountsByKey.get(key) || 1) - 1;
  if (nextCount > 0) inFlightSaveCountsByKey.set(key, nextCount);
  else inFlightSaveCountsByKey.delete(key);
}

function notify(type, detail = {}) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

async function runPending(key, entry) {
  if (pendingSaves.get(key) !== entry) return;
  pendingSaves.delete(key);

  let queuedOperation;
  try {
    // localStorage-backed project updates are read/modify/write operations. If
    // two tabs flush at the same time, running them concurrently can make both
    // read the same old snapshot and let the last write win. Keep every
    // coordinated save in one queue so each operation reads the result of the
    // previous one before applying its own patch.
    queuedOperation = saveQueue.then(entry.operation, entry.operation);
    saveQueue = queuedOperation.catch(() => {});
    inFlightSaves.add(queuedOperation);
    markInFlight(key);
    notifySaveState();
    await queuedOperation;
    saveErrors.delete(key);
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error('保存に失敗しました');
    saveErrors.set(key, { error: normalized, operation: entry.operation });
    notify('kindle-save-error', { error: normalized });
    throw normalized;
  } finally {
    if (queuedOperation) {
      inFlightSaves.delete(queuedOperation);
      unmarkInFlight(key);
    }
    notifySaveState();
  }
}

export function scheduleCoordinatedSave(key, operation, delay = 1000) {
  if (!key || typeof operation !== 'function') {
    throw new Error('保存キーと保存処理が必要です');
  }

  const previous = pendingSaves.get(key);
  if (previous) clearTimeout(previous.timer);

  const entry = { operation, timer: null };
  entry.timer = setTimeout(() => {
    runPending(key, entry).catch(() => {
      // エラーはイベントと lastSaveError へ記録し、未処理 Promise を防ぐ。
    });
  }, delay);

  pendingSaves.set(key, entry);
  notifySaveState();
}

export async function flushPendingSaves() {
  let firstRejection;

  // A timer may already have moved a save from pending to in-flight just
  // before this function is called. Loop until both collections are empty so
  // an update reload, backup, or migration never races an active write.
  while (pendingSaves.size > 0 || inFlightSaves.size > 0) {
    const entries = [...pendingSaves.entries()];
    for (const [, entry] of entries) clearTimeout(entry.timer);

    const started = entries.map(([key, entry]) => runPending(key, entry));
    const active = [...inFlightSaves];
    const results = await Promise.allSettled([...new Set([...started, ...active])]);
    const rejected = results.find(result => result.status === 'rejected');
    if (!firstRejection && rejected) firstRejection = rejected.reason;
  }

  if (firstRejection) throw firstRejection;
  const storedError = saveErrors.values().next().value?.error;
  if (storedError) throw storedError;
}

export async function retryFailedSaves() {
  for (const [key, failure] of [...saveErrors.entries()]) {
    if (!pendingSaves.has(key) && !inFlightSaveCountsByKey.has(key)) {
      scheduleCoordinatedSave(key, failure.operation, 0);
    }
  }

  await flushPendingSaves();
}

export function cancelPendingSaves() {
  for (const entry of pendingSaves.values()) clearTimeout(entry.timer);
  pendingSaves.clear();
  notifySaveState();
}

export function getPendingSaveCount() {
  return currentSaveCount();
}

export function hasUnresolvedSaveErrors() {
  return saveErrors.size > 0;
}

export function getUnresolvedSaveErrorCount() {
  return saveErrors.size;
}

export function clearSaveError() {
  saveErrors.clear();
  notifySaveState();
}
