import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CRITIQUE_STOPPING_CHECKS_FIELD,
  normalizeCritiqueStoppingChecks,
  readCritiqueStoppingChecks,
  rollbackFailedCritiqueStoppingChecks,
  selectProjectCritiqueStoppingChecks,
  writeCritiqueStoppingChecks,
} from './critiqueStoppingChecks.js';

test('旧up-review-checklistを初回移行用に読み込む', () => {
  const legacy = JSON.stringify({
    'same-feedback': true,
    'minor-only': false,
    'three-plus': true,
    broken: 'yes',
  });
  const result = readCritiqueStoppingChecks(JSON.stringify({ t01: { is_done: true } }), legacy);

  assert.equal(result.source, 'legacy');
  assert.deepEqual(result.checks, {
    'same-feedback': true,
    'minor-only': false,
    'three-plus': true,
  });
  assert.deepEqual(selectProjectCritiqueStoppingChecks(result), {});
});

test('プロジェクト単位のチェックを保存し、既存タスクとメタデータを保つ', () => {
  const raw = JSON.stringify({
    _data: { t01: { is_done: true, note: '保持' } },
    _creation_custom: [{ id: 'custom-1', title: '保持するタスク' }],
    _kdp_fields: { t41_book_title: '保持する書名' },
  });
  const saved = writeCritiqueStoppingChecks(raw, {
    'same-feedback': true,
    'hard-gates-cleared': false,
    ignored: 'not-boolean',
  });
  const parsed = JSON.parse(saved);
  const restored = readCritiqueStoppingChecks(saved, JSON.stringify({ 'three-plus': true }));

  assert.deepEqual(parsed._data, { t01: { is_done: true, note: '保持' } });
  assert.equal(parsed._creation_custom[0].id, 'custom-1');
  assert.equal(parsed._kdp_fields.t41_book_title, '保持する書名');
  assert.deepEqual(parsed[CRITIQUE_STOPPING_CHECKS_FIELD], {
    'same-feedback': true,
    'hard-gates-cleared': false,
  });
  assert.equal(restored.source, 'project');
  assert.deepEqual(restored.checks, parsed[CRITIQUE_STOPPING_CHECKS_FIELD]);
  assert.deepEqual(restored.legacyChecks, { 'three-plus': true });
});

test('別プロジェクトの終了判断チェックを混ぜず、再読込後も保持する', () => {
  const projectA = writeCritiqueStoppingChecks('', { 'same-feedback': true });
  const projectB = writeCritiqueStoppingChecks('', { 'minor-only': true });

  assert.deepEqual(readCritiqueStoppingChecks(projectA).checks, { 'same-feedback': true });
  assert.deepEqual(readCritiqueStoppingChecks(projectB).checks, { 'minor-only': true });
  assert.deepEqual(normalizeCritiqueStoppingChecks(null), {});
});

test('壊れたチェックリストを空として上書きしない', () => {
  const read = readCritiqueStoppingChecks('{broken', JSON.stringify({ 'same-feedback': true }));
  assert.ok(read.error);
  assert.equal(read.source, 'error');
  assert.throws(() => writeCritiqueStoppingChecks('{broken', { 'same-feedback': true }));
});

test('楽観更新の保存失敗は後続変更がない時だけ以前値へ戻す', () => {
  const previous = { 'same-feedback': false };
  const attempted = { 'same-feedback': true };
  const later = { 'same-feedback': true, 'minor-only': true };

  assert.equal(rollbackFailedCritiqueStoppingChecks(attempted, attempted, previous), previous);
  assert.equal(rollbackFailedCritiqueStoppingChecks(later, attempted, previous), later);
});
