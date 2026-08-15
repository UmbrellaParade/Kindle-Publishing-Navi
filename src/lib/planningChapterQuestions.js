function questionRank(record) {
  if (record?.firstReadFor?.length) return 0;
  if (record?.canonicalFor?.length) return 1;
  return 2;
}

function questionNumber(record) {
  const match = /(?:質問|問)\s*0*([0-9]+)/i.exec(String(record?.name || '').normalize('NFKC'));
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function compareQuestionRecords(left, right) {
  const rankDifference = questionRank(left) - questionRank(right);
  if (rankDifference !== 0) return rankDifference;
  const leftNumber = questionNumber(left);
  const rightNumber = questionNumber(right);
  if (Number.isFinite(leftNumber) || Number.isFinite(rightNumber)) {
    if (!Number.isFinite(leftNumber)) return 1;
    if (!Number.isFinite(rightNumber)) return -1;
    if (leftNumber !== rightNumber) return leftNumber - rightNumber;
  }
  const updatedDifference = String(right?.updatedAt || '').localeCompare(String(left?.updatedAt || ''));
  if (updatedDifference !== 0) return updatedDifference;
  const versionDifference = Number(right?.versionNumber || 0) - Number(left?.versionNumber || 0);
  if (versionDifference !== 0) return versionDifference;
  return String(left?.id || '').localeCompare(String(right?.id || ''));
}

function isNewerQuestionVersion(candidate, current) {
  const candidateVersion = Number(candidate?.versionNumber || 0);
  const currentVersion = Number(current?.versionNumber || 0);
  if (candidateVersion !== currentVersion) return candidateVersion > currentVersion;
  const candidateUpdatedAt = String(candidate?.updatedAt || '');
  const currentUpdatedAt = String(current?.updatedAt || '');
  if (candidateUpdatedAt !== currentUpdatedAt) return candidateUpdatedAt > currentUpdatedAt;
  return String(candidate?.id || '') > String(current?.id || '');
}

/**
 * 執筆用指示書を、明示的に紐づく構成項目IDごとに索引化する。
 * 同じ文書系列の旧版は保存データに残したまま、目次上では現在の版だけを表示する。
 */
export function buildPlanningChapterQuestionIndex(records = []) {
  const newestByDocument = new Map();

  for (const record of Array.isArray(records) ? records : []) {
    if (record?.role !== 'writing' || record?.status === 'rejected' || record?.referenceStatus === 'old') continue;
    const documentKey = String(record?.documentId || record?.id || '');
    if (!documentKey) continue;
    const current = newestByDocument.get(documentKey);
    if (!current || isNewerQuestionVersion(record, current)) newestByDocument.set(documentKey, record);
  }

  const byChapter = new Map();
  for (const record of newestByDocument.values()) {
    const chapterIds = Array.isArray(record?.chapterIds) ? [...new Set(record.chapterIds)] : [];
    for (const chapterId of chapterIds) {
      if (!chapterId) continue;
      if (!byChapter.has(chapterId)) byChapter.set(chapterId, []);
      byChapter.get(chapterId).push(record);
    }
  }

  return new Map(
    [...byChapter.entries()].map(([chapterId, chapterQuestions]) => [
      chapterId,
      chapterQuestions.sort(compareQuestionRecords),
    ]),
  );
}
