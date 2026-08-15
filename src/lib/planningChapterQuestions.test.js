import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPlanningChapterQuestionIndex } from './planningChapterQuestions.js';

function question(overrides = {}) {
  return {
    id: 'question-1',
    documentId: 'question-series-1',
    versionNumber: 1,
    updatedAt: '2026-08-15T00:00:00.000Z',
    role: 'writing',
    status: 'draft',
    referenceStatus: 'active',
    firstReadFor: [],
    canonicalFor: [],
    chapterIds: ['chapter-a'],
    markdown: '本文だけ',
    ...overrides,
  };
}

test('明示的に紐づく章だけへ同じ質問レコードを参照表示する', () => {
  const shared = question({ chapterIds: ['chapter-a', 'chapter-b'] });
  const records = [shared, question({ id: 'question-2', documentId: 'question-series-2', chapterIds: ['chapter-b'] })];
  const before = structuredClone(records);
  const index = buildPlanningChapterQuestionIndex(records);

  assert.deepEqual(index.get('chapter-a'), [shared]);
  assert.deepEqual(index.get('chapter-b').map(record => record.id), ['question-1', 'question-2']);
  assert.equal(index.has('chapter-c'), false);
  assert.equal(index.get('chapter-a')[0], shared, '質問データを複製せず同じレコードを参照する');
  assert.deepEqual(records, before, '索引化で保存データを変更しない');
});

test('親子へ自動継承せず、旧版・採用しない・執筆以外を目次へ混ぜない', () => {
  const index = buildPlanningChapterQuestionIndex([
    question({ id: 'parent', documentId: 'parent-series', chapterIds: ['part-1'] }),
    question({ id: 'child', documentId: 'child-series', chapterIds: ['episode-1'] }),
    question({ id: 'old', documentId: 'old-series', referenceStatus: 'old' }),
    question({ id: 'rejected', documentId: 'rejected-series', status: 'rejected' }),
    question({ id: 'cover', documentId: 'cover-series', role: 'cover' }),
  ]);

  assert.deepEqual(index.get('part-1').map(record => record.id), ['parent']);
  assert.deepEqual(index.get('episode-1').map(record => record.id), ['child']);
  assert.equal(index.get('chapter-a'), undefined);
});

test('同じ文書系列は章ごとに最も新しい版だけ表示し、正本・最初に見るを先に並べる', () => {
  const v1 = question({ id: 'v1', versionNumber: 1 });
  const v2 = question({ id: 'v2', versionNumber: 2, updatedAt: '2026-08-14T00:00:00.000Z' });
  const canonical = question({
    id: 'canonical', documentId: 'canonical-series', canonicalFor: ['author'], updatedAt: '2026-08-10T00:00:00.000Z',
  });
  const first = question({
    id: 'first', documentId: 'first-series', firstReadFor: ['author'], updatedAt: '2026-08-09T00:00:00.000Z',
  });

  const index = buildPlanningChapterQuestionIndex([v1, v2, canonical, first]);
  assert.deepEqual(index.get('chapter-a').map(record => record.id), ['first', 'canonical', 'v2']);
});

test('新しい版で章の紐づけを変更した系列は旧版を以前の章へ残さない', () => {
  const index = buildPlanningChapterQuestionIndex([
    question({ id: 'v1', versionNumber: 1, chapterIds: ['chapter-a'] }),
    question({
      id: 'v2',
      versionNumber: 2,
      chapterIds: ['chapter-b'],
      updatedAt: '2026-08-16T00:00:00.000Z',
    }),
  ]);

  assert.equal(index.has('chapter-a'), false);
  assert.deepEqual(index.get('chapter-b').map(record => record.id), ['v2']);
});

test('同じ優先度の質問01〜11は名前の番号順に並べる', () => {
  const index = buildPlanningChapterQuestionIndex([
    question({ id: 'q10', documentId: 'series-10', name: '質問10：最後の一歩' }),
    question({ id: 'q02', documentId: 'series-02', name: '質問02：転機' }),
    question({ id: 'q01', documentId: 'series-01', name: '質問01：始まり' }),
  ]);
  assert.deepEqual(index.get('chapter-a').map(record => record.id), ['q01', 'q02', 'q10']);
});

test('壊れた入力や未紐づけ質問は安全に無視する', () => {
  assert.deepEqual([...buildPlanningChapterQuestionIndex(null)], []);
  assert.deepEqual([...buildPlanningChapterQuestionIndex([null, {}, question({ chapterIds: [] })])], []);
});
