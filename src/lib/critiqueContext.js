export const CRITIQUE_CONTEXT_VERSION = 1;

export const CRITIQUE_MANUSCRIPT_CHECK_STATUSES = Object.freeze([
  { value: 'not_checked', label: '未確認' },
  { value: 'matched', label: '一致した' },
  { value: 'mismatch', label: '一致しなかった（読み取り不足）' },
]);

const ROOT_FIELDS = new Set([
  'version',
  'updatedAt',
  'targetReader',
  'coreMessage',
  'readerOutcome',
  'plannedPrice',
  'publicationPurpose',
  'manuscriptCheck',
]);
const MANUSCRIPT_CHECK_FIELDS = new Set([
  'manuscriptLabel',
  'expectedFinalChapterTitle',
  'expectedLastSentence',
  'status',
  'checkedAt',
]);
const CHECK_STATUS_VALUES = new Set(
  CRITIQUE_MANUSCRIPT_CHECK_STATUSES.map(item => item.value),
);

export class CritiqueContextBlockingError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'CritiqueContextBlockingError';
    this.corruptRaw = options.corruptRaw || '';
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

function isoDate(value, fallback = '') {
  if (typeof value !== 'string' && !(value instanceof Date)) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function resolveNow(now) {
  const value = typeof now === 'function' ? now() : now;
  return isoDate(value || new Date(), new Date().toISOString());
}

function assertKnownFields(value, allowed, label, raw) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new CritiqueContextBlockingError(
        `${label}に未対応の項目「${key}」があります。データを守るため上書きを停止しました。`,
        { corruptRaw: raw },
      );
    }
  }
}

function emptyManuscriptCheck() {
  return {
    manuscriptLabel: '',
    expectedFinalChapterTitle: '',
    expectedLastSentence: '',
    status: 'not_checked',
    checkedAt: '',
  };
}

export function createEmptyCritiqueContext() {
  return {
    version: CRITIQUE_CONTEXT_VERSION,
    updatedAt: '',
    targetReader: '',
    coreMessage: '',
    readerOutcome: '',
    plannedPrice: '',
    publicationPurpose: '',
    manuscriptCheck: emptyManuscriptCheck(),
  };
}

function normalizeManuscriptCheck(value, raw) {
  const source = value === undefined ? {} : value;
  if (!isPlainObject(source)) {
    throw new CritiqueContextBlockingError(
      '原稿取得確認の保存形式が正しくありません。データを守るため上書きを停止しました。',
      { corruptRaw: raw },
    );
  }
  assertKnownFields(source, MANUSCRIPT_CHECK_FIELDS, '原稿取得確認', raw);
  const status = CHECK_STATUS_VALUES.has(source.status) ? source.status : 'not_checked';
  return {
    manuscriptLabel: text(source.manuscriptLabel),
    expectedFinalChapterTitle: text(source.expectedFinalChapterTitle),
    expectedLastSentence: text(source.expectedLastSentence),
    status,
    checkedAt: status === 'not_checked' ? '' : isoDate(source.checkedAt),
  };
}

function normalizeSavedContext(source, raw) {
  if (!isPlainObject(source)) {
    throw new CritiqueContextBlockingError(
      '本の前提の保存形式が正しくありません。データを守るため上書きを停止しました。',
      { corruptRaw: raw },
    );
  }
  assertKnownFields(source, ROOT_FIELDS, '本の前提', raw);
  if (source.version !== CRITIQUE_CONTEXT_VERSION) {
    throw new CritiqueContextBlockingError(
      `本の前提のバージョン${source.version ?? '不明'}には未対応です。データを守るため上書きを停止しました。`,
      { corruptRaw: raw },
    );
  }
  const updatedAt = isoDate(source.updatedAt);
  if (!updatedAt) {
    throw new CritiqueContextBlockingError(
      '本の前提の更新日時が正しくありません。データを守るため上書きを停止しました。',
      { corruptRaw: raw },
    );
  }
  return {
    version: CRITIQUE_CONTEXT_VERSION,
    updatedAt,
    targetReader: text(source.targetReader),
    coreMessage: text(source.coreMessage),
    readerOutcome: text(source.readerOutcome),
    plannedPrice: text(source.plannedPrice),
    publicationPurpose: text(source.publicationPurpose),
    manuscriptCheck: normalizeManuscriptCheck(source.manuscriptCheck, raw),
  };
}

function normalizeDraftContext(source, now) {
  const input = isPlainObject(source) ? source : {};
  const manuscriptCheck = isPlainObject(input.manuscriptCheck)
    ? input.manuscriptCheck
    : {};
  const status = CHECK_STATUS_VALUES.has(manuscriptCheck.status)
    ? manuscriptCheck.status
    : 'not_checked';
  return {
    version: CRITIQUE_CONTEXT_VERSION,
    updatedAt: resolveNow(now),
    targetReader: text(input.targetReader),
    coreMessage: text(input.coreMessage),
    readerOutcome: text(input.readerOutcome),
    plannedPrice: text(input.plannedPrice),
    publicationPurpose: text(input.publicationPurpose),
    manuscriptCheck: {
      manuscriptLabel: text(manuscriptCheck.manuscriptLabel),
      expectedFinalChapterTitle: text(manuscriptCheck.expectedFinalChapterTitle),
      expectedLastSentence: text(manuscriptCheck.expectedLastSentence),
      status,
      checkedAt: status === 'not_checked'
        ? ''
        : isoDate(manuscriptCheck.checkedAt, resolveNow(now)),
    },
  };
}

export function readCritiqueContext(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return {
      context: createEmptyCritiqueContext(),
      error: null,
      corruptRaw: '',
      hasSavedContext: false,
    };
  }
  if (typeof raw !== 'string') {
    const error = new CritiqueContextBlockingError(
      '本の前提がJSON文字列ではありません。データを守るため上書きを停止しました。',
      { corruptRaw: String(raw) },
    );
    return {
      context: createEmptyCritiqueContext(),
      error,
      corruptRaw: String(raw),
      hasSavedContext: true,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    const error = new CritiqueContextBlockingError(
      '本の前提を読み込めません。データを守るため上書きを停止しました。',
      { cause, corruptRaw: raw },
    );
    return { context: createEmptyCritiqueContext(), error, corruptRaw: raw, hasSavedContext: true };
  }

  try {
    return {
      context: normalizeSavedContext(parsed, raw),
      error: null,
      corruptRaw: '',
      hasSavedContext: true,
    };
  } catch (cause) {
    const error = cause instanceof CritiqueContextBlockingError
      ? cause
      : new CritiqueContextBlockingError(
          '本の前提を正規化できません。',
          { cause, corruptRaw: raw },
        );
    return { context: createEmptyCritiqueContext(), error, corruptRaw: raw, hasSavedContext: true };
  }
}

export function hasCritiqueContextEditConflict(expectedUpdatedAt, latestReadResult) {
  const expected = isoDate(expectedUpdatedAt);
  const latest = latestReadResult || {};
  if (latest.error) return true;
  if (!latest.hasSavedContext) return Boolean(expected);
  return !expected || expected !== latest.context?.updatedAt;
}

export function upsertCritiqueContext(raw, input, options = {}) {
  const current = readCritiqueContext(raw);
  if (current.error) throw current.error;
  if (hasCritiqueContextEditConflict(options.expectedUpdatedAt || '', current)) {
    throw new CritiqueContextBlockingError(
      'この本の前提は別の画面で更新されています。最新内容を確認してから編集し直してください。',
      { corruptRaw: raw || '' },
    );
  }
  const context = normalizeDraftContext(input, options.now);
  return { context, value: JSON.stringify(context) };
}

export function createCritiqueBriefSnapshot(context = {}) {
  return {
    targetReader: text(context.targetReader),
    coreMessage: text(context.coreMessage),
    readerOutcome: text(context.readerOutcome),
    plannedPrice: text(context.plannedPrice),
    publicationPurpose: text(context.publicationPurpose),
    manuscriptLabel: text(context.manuscriptCheck?.manuscriptLabel),
  };
}

export function cacheCritiqueDraft(cache, key, draft, metadata = {}) {
  if (!(cache instanceof Map) || !key) return { draft, revision: 0 };
  const previousRevision = Number(cache.get(key)?.revision) || 0;
  const record = { ...metadata, draft, revision: previousRevision + 1 };
  cache.set(key, record);
  return record;
}

export function readCachedCritiqueDraft(cache, key) {
  if (!(cache instanceof Map) || !key) return null;
  const record = cache.get(key);
  return record && typeof record === 'object' ? record : null;
}

export function hasCachedCritiqueDraftConflict(record, latestUpdatedAt) {
  return Boolean(
    record
    && Object.prototype.hasOwnProperty.call(record, 'baseUpdatedAt')
    && record.baseUpdatedAt !== latestUpdatedAt,
  );
}

export function clearCachedCritiqueDraftIfUnchanged(cache, key, revision) {
  if (!(cache instanceof Map) || !key) return false;
  const current = cache.get(key);
  if (!current || current.revision !== revision) return false;
  cache.delete(key);
  return true;
}
