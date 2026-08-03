export function isEmptyCritiqueScore(value) {
  return value === null || value === undefined || value === '';
}

export function parseCritiqueScore(value) {
  if (isEmptyCritiqueScore(value)) return null;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) return null;
  return numeric;
}

export function parseOptionalFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function buildCritiqueDraftScores(scores, axisKeys, { isNew = false } = {}) {
  const source = scores && typeof scores === 'object' ? scores : {};
  return Object.fromEntries(axisKeys.map(key => {
    const parsed = parseCritiqueScore(source[key]);
    return [key, parsed === null ? (isNew ? 3 : '') : parsed];
  }));
}

export function validateCritiqueDraftScores(scores, axisKeys, { requireAll = false } = {}) {
  const source = scores && typeof scores === 'object' ? scores : {};
  return axisKeys.every(key => {
    const value = source[key];
    if (isEmptyCritiqueScore(value)) return !requireAll;
    return parseCritiqueScore(value) !== null;
  });
}

export function serializeCritiqueDraftScores(scores, axisKeys) {
  const source = scores && typeof scores === 'object' ? scores : {};
  return Object.fromEntries(axisKeys.map(key => [key, parseCritiqueScore(source[key])]));
}

export function resolveCritiqueManuscript(formatGuideState, projectManuscript) {
  if (formatGuideState && typeof formatGuideState === 'object' && typeof formatGuideState.sharedText === 'string') {
    return formatGuideState.sharedText;
  }
  return typeof projectManuscript === 'string' ? projectManuscript : '';
}

export function readCritiqueManuscriptState(rawFormatGuideState, projectManuscript) {
  if (rawFormatGuideState === null || rawFormatGuideState === undefined) {
    return resolveCritiqueManuscript(null, projectManuscript);
  }
  if (typeof rawFormatGuideState !== 'string') {
    throw new Error('原稿調整データがJSON文字列ではありません');
  }
  let parsed;
  try {
    parsed = JSON.parse(rawFormatGuideState);
  } catch (cause) {
    throw new Error('原稿調整データが壊れているため、相談文のコピーを停止しました', { cause });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.sharedText !== 'string') {
    throw new Error('原稿調整データの保存形式が正しくないため、相談文のコピーを停止しました');
  }
  return parsed.sharedText;
}

export function shouldNotifyCritiqueHistoryChange({
  previousProjectId,
  currentProjectId,
  previousHistory,
  currentHistory,
  draftOpen,
}) {
  return Boolean(
    draftOpen
    && currentProjectId
    && previousProjectId === currentProjectId
    && previousHistory !== undefined
    && previousHistory !== currentHistory,
  );
}
