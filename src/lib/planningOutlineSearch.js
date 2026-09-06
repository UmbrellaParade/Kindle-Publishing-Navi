// 絞り込み前の行・階層・IDを維持する。番号の再採番や本文の変更は行わない。
export function filterPlanningOutlineRows(rows, filters = {}, {
  unfinishedOnly = false,
  manuscriptByChapterId = new Map(),
} = {}) {
  const records = rows.map(row => row.record);
  const byId = new Map(records.map(record => [record.id, record]));
  const needle = String(filters.query || '').normalize('NFKC').toLocaleLowerCase('ja-JP').trim();
  const chapterId = filters.chapterId || 'all';
  const resultIds = new Set(records.filter(record => {
    if (chapterId === 'archived') return false;
    if (chapterId === 'unlinked' && record.chapterIds?.length) return false;
    if (!['all', 'unlinked', 'archived'].includes(chapterId)) {
      const visited = new Set();
      let ancestorId = record.id;
      while (ancestorId && ancestorId !== chapterId && !visited.has(ancestorId)) {
        visited.add(ancestorId);
        ancestorId = byId.get(ancestorId)?.parentId;
      }
      if (ancestorId !== chapterId) return false;
    }
    if (filters.status && filters.status !== 'all' && record.status !== filters.status) return false;
    if (filters.sourcePriority && filters.sourcePriority !== 'all' && record.sourcePriority !== filters.sourcePriority) return false;
    if (unfinishedOnly && (record.status === 'rejected' || manuscriptByChapterId.get(record.id)?.completed)) return false;
    const text = Object.values(record).flatMap(value => Array.isArray(value) ? value : [value])
      .filter(value => typeof value === 'string').join('\n').normalize('NFKC').toLocaleLowerCase('ja-JP');
    return !needle || text.includes(needle);
  }).map(record => record.id));
  const visibleIds = new Set(resultIds);
  for (const id of resultIds) {
    const visited = new Set([id]);
    let parentId = byId.get(id)?.parentId;
    while (parentId && byId.has(parentId) && !visited.has(parentId)) {
      visibleIds.add(parentId);
      visited.add(parentId);
      parentId = byId.get(parentId).parentId;
    }
  }
  return {
    rows: rows.filter(({ record }) => visibleIds.has(record.id))
      .map(row => ({ ...row, filterContext: !resultIds.has(row.record.id) })),
    matchCount: resultIds.size,
  };
}
