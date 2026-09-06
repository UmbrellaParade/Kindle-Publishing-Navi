import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPlanningOutlineRows } from './planningOutlineSearch.js';

const rows = [
  { id: 'part', parentId: '', title: '体験', nodeType: 'part' },
  { id: 'chapter-1', parentId: 'part', title: '始まり', nodeType: 'chapter' },
  { id: 'chapter-2', parentId: 'part', title: '転機', nodeType: 'chapter' },
  { id: 'section', parentId: 'chapter-2', title: '試行錯誤ＡＢＣ', nodeType: 'section' },
  { id: 'chapter-3', parentId: '', title: '旅立ち', nodeType: 'chapter' },
].map((record, index) => ({
  record: { chapterIds: [], status: 'draft', sourcePriority: 'unspecified', order: index, ...record },
  depth: record.id === 'section' ? 2 : record.parentId ? 1 : 0,
  originalOrdinal: index + 1,
}));

test('検索0件ではカードを残さず、解除で全項目を元の順序へ戻す', () => {
  const before = structuredClone(rows);
  assert.deepEqual(filterPlanningOutlineRows(rows, { query: '存在しない' }), { rows: [], matchCount: 0 });
  assert.deepEqual(filterPlanningOutlineRows(rows).rows.map(row => row.record.id), rows.map(row => row.record.id));
  assert.deepEqual(rows, before);
});

test('一致した節と祖先だけ表示し、階層・元の番号・本文参照を保つ', () => {
  const result = filterPlanningOutlineRows(rows, { query: 'abc' });
  assert.equal(result.matchCount, 1);
  assert.deepEqual(result.rows.map(row => row.record.id), ['part', 'chapter-2', 'section']);
  assert.deepEqual(result.rows.map(row => row.filterContext), [true, true, false]);
  assert.equal(result.rows[1].record, rows[2].record);
  assert.equal(result.rows[1].originalOrdinal, 3);
  assert.equal(result.rows[2].depth, 2);
});

test('原稿未完成だけと検索・構成項目の条件を併用できる', () => {
  const completed = new Map([['part', { completed: true }], ['chapter-2', { completed: true }]]);
  const result = filterPlanningOutlineRows(rows, { chapterId: 'chapter-2' }, { unfinishedOnly: true, manuscriptByChapterId: completed });
  assert.equal(result.matchCount, 1);
  assert.deepEqual(result.rows.map(row => row.record.id), ['part', 'chapter-2', 'section']);
  assert.deepEqual(result.rows.map(row => row.filterContext), [true, true, false]);
  assert.equal(filterPlanningOutlineRows(rows, { query: '転機' }, { unfinishedOnly: true, manuscriptByChapterId: completed }).matchCount, 0);
});

test('確定版・過去版の検索はその版の本文を使い、現行版の変更を混ぜない', () => {
  const historyRows = rows.map(row => ({ ...row, record: { ...row.record, title: `${row.record.title} 旧版` } }));
  assert.equal(filterPlanningOutlineRows(historyRows, { query: '旧版' }).matchCount, 5);
  assert.equal(filterPlanningOutlineRows(rows, { query: '旧版' }).matchCount, 0);
  assert.equal(filterPlanningOutlineRows(historyRows, { status: 'approved' }).matchCount, 0);
  assert.equal(filterPlanningOutlineRows(rows, { chapterId: 'missing' }).matchCount, 0);
});

test('親参照が壊れた行でも探索が循環しない', () => {
  const cyclic = [{ record: { id: 'a', parentId: 'b', title: '対象' } }, { record: { id: 'b', parentId: 'a', title: '親' } }];
  assert.equal(filterPlanningOutlineRows(cyclic, { query: '対象' }).rows.length, 2);
  assert.equal(filterPlanningOutlineRows(cyclic, { chapterId: 'missing' }).rows.length, 0);
});
