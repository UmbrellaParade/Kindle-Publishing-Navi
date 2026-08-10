import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectDisplayNameUpdate,
  normalizeProjectDisplayName,
  ProjectDisplayNameConflictError,
  PROJECT_DISPLAY_NAME_MAX_LENGTH,
} from './projectDisplayName.js';

test('仮タイトルを前後空白なしの本の管理名として保存する', () => {
  assert.equal(normalizeProjectDisplayName('  はじめての本（仮）  '), 'はじめての本（仮）');
  assert.throws(() => normalizeProjectDisplayName('   '), /本の管理名を入力してください/);
  assert.throws(
    () => normalizeProjectDisplayName('本'.repeat(PROJECT_DISPLAY_NAME_MAX_LENGTH + 1)),
    /80文字以内/,
  );
});

test('名前変更ではプロジェクトIDや正式書名を更新対象に含めない', () => {
  const latest = {
    id: 'project-1',
    name: '仮タイトル',
    book_title: 'KDPへ登録する正式書名',
    checklist_data: '{"keep":true}',
  };

  const updates = buildProjectDisplayNameUpdate(latest, {
      expectedName: '仮タイトル',
      nextName: '完成後の管理名',
    });
  assert.deepEqual(updates, { name: '完成後の管理名' });
  assert.deepEqual(
    { ...latest, ...updates },
    {
      id: 'project-1',
      name: '完成後の管理名',
      book_title: 'KDPへ登録する正式書名',
      checklist_data: '{"keep":true}',
    },
  );
});

test('編集開始後に別画面で名前が変わっていたら上書きしない', () => {
  const latest = { id: 'project-1', name: '別画面で変更済み', manuscript: '保持する原稿' };
  assert.throws(
    () => buildProjectDisplayNameUpdate(
      latest,
      { expectedName: '編集開始時の名前', nextName: '古い画面からの変更' },
    ),
    error => (
      error instanceof ProjectDisplayNameConflictError
      && error.latestProject === latest
      && /別の画面で変更されています/.test(error.message)
    ),
  );
});
