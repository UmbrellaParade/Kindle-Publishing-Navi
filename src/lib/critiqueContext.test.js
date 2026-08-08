import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cacheCritiqueDraft,
  clearCachedCritiqueDraftIfUnchanged,
  createCritiqueBriefSnapshot,
  createEmptyCritiqueContext,
  hasCachedCritiqueDraftConflict,
  hasCritiqueContextEditConflict,
  readCachedCritiqueDraft,
  readCritiqueContext,
  upsertCritiqueContext,
} from './critiqueContext.js';

const NOW = '2026-08-09T01:23:45.000Z';

function fullContext() {
  return {
    targetReader: '初めてKindle出版へ挑戦する人',
    coreMessage: '迷いやすい工程を順番に進める方法',
    readerOutcome: '自分で出版準備を完了できる',
    plannedPrice: '発売時99円、その後500円を検討',
    publicationPurpose: '教材を実践へつなぐ特典として届ける',
    manuscriptCheck: {
      manuscriptLabel: '第3稿・2026年8月版',
      expectedFinalChapterTitle: 'おわりに',
      expectedLastSentence: 'あなたの一冊を届けてください。',
      status: 'matched',
      checkedAt: NOW,
    },
  };
}

test('本の前提と原稿取得確認をプロジェクト用JSONで往復する', () => {
  const saved = upsertCritiqueContext('', fullContext(), { now: NOW, expectedUpdatedAt: '' });
  const restored = readCritiqueContext(saved.value);

  assert.equal(restored.error, null);
  assert.equal(restored.hasSavedContext, true);
  assert.deepEqual(restored.context, { version: 1, updatedAt: NOW, ...fullContext() });
  assert.deepEqual(createCritiqueBriefSnapshot(restored.context), {
    targetReader: fullContext().targetReader,
    coreMessage: fullContext().coreMessage,
    readerOutcome: fullContext().readerOutcome,
    plannedPrice: fullContext().plannedPrice,
    publicationPurpose: fullContext().publicationPurpose,
    manuscriptLabel: fullContext().manuscriptCheck.manuscriptLabel,
  });
});

test('空の既存プロジェクトは安全な未入力状態として開く', () => {
  const result = readCritiqueContext('');

  assert.equal(result.error, null);
  assert.equal(result.hasSavedContext, false);
  assert.deepEqual(result.context, createEmptyCritiqueContext());
});

test('保存後に明示的に空欄へ戻した前提を古い推測値へ置き換えない', () => {
  const initial = upsertCritiqueContext('', fullContext(), { now: NOW });
  const clearedAt = '2026-08-09T01:30:00.000Z';
  const cleared = upsertCritiqueContext(initial.value, {
    ...fullContext(),
    targetReader: '',
    readerOutcome: '',
  }, { now: clearedAt, expectedUpdatedAt: NOW });
  const restored = readCritiqueContext(cleared.value);

  assert.equal(restored.hasSavedContext, true);
  assert.equal(restored.context.targetReader, '');
  assert.equal(restored.context.readerOutcome, '');
});

test('原稿が変わった未確認状態では照合日時を残さない', () => {
  const input = fullContext();
  input.manuscriptCheck.status = 'not_checked';
  const saved = upsertCritiqueContext('', input, { now: NOW });

  assert.equal(readCritiqueContext(saved.value).context.manuscriptCheck.checkedAt, '');
});

test('壊れたJSON・将来版・未知項目は空データで上書きできる状態にしない', () => {
  const broken = readCritiqueContext('{broken');
  const futureRaw = JSON.stringify({ version: 99, updatedAt: NOW });
  const future = readCritiqueContext(futureRaw);
  const unknownRaw = JSON.stringify({ version: 1, updatedAt: NOW, futureField: true });
  const unknown = readCritiqueContext(unknownRaw);

  assert.ok(broken.error);
  assert.equal(broken.corruptRaw, '{broken');
  assert.ok(future.error);
  assert.equal(future.corruptRaw, futureRaw);
  assert.ok(unknown.error);
  assert.throws(() => upsertCritiqueContext(futureRaw, fullContext(), { now: NOW }));
});

test('編集開始後に同じ本の前提が更新されていたら競合として停止する', () => {
  const first = upsertCritiqueContext('', fullContext(), { now: NOW });
  const laterTime = '2026-08-09T02:00:00.000Z';
  const second = upsertCritiqueContext(first.value, {
    ...fullContext(),
    plannedPrice: '600円を検討',
  }, { now: laterTime, expectedUpdatedAt: NOW });
  const latest = readCritiqueContext(second.value);

  assert.equal(hasCritiqueContextEditConflict(NOW, latest), true);
  assert.equal(hasCritiqueContextEditConflict(laterTime, latest), false);
  assert.throws(
    () => upsertCritiqueContext(second.value, fullContext(), { now: laterTime, expectedUpdatedAt: NOW }),
    /別の画面/,
  );
});

test('古い保存完了では切替後に入力した新しい下書きを消さない', () => {
  const cache = new Map();
  const first = cacheCritiqueDraft(
    cache,
    'project-a',
    { targetReader: '保存開始時' },
    { baseUpdatedAt: '2026-08-09T01:00:00.000Z' },
  );

  cacheCritiqueDraft(cache, 'project-b', { targetReader: '別の本' });
  const resumed = cacheCritiqueDraft(cache, 'project-a', { targetReader: '戻ってからの入力' });

  assert.equal(clearCachedCritiqueDraftIfUnchanged(cache, 'project-a', first.revision), false);
  assert.deepEqual(readCachedCritiqueDraft(cache, 'project-a'), resumed);
  assert.equal(first.baseUpdatedAt, '2026-08-09T01:00:00.000Z');
  assert.equal(hasCachedCritiqueDraftConflict(first, '2026-08-09T02:00:00.000Z'), true);
  assert.equal(hasCachedCritiqueDraftConflict(first, first.baseUpdatedAt), false);
  assert.equal(hasCachedCritiqueDraftConflict({ baseUpdatedAt: '' }, '2026-08-09T02:00:00.000Z'), true);
  assert.equal(clearCachedCritiqueDraftIfUnchanged(cache, 'project-a', resumed.revision), true);
  assert.equal(readCachedCritiqueDraft(cache, 'project-a'), null);
});
