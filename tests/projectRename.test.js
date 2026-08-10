import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const headerSource = readFileSync(new URL('../src/components/AppHeader.jsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');

test('選択中の本はヘッダーから管理名を変更できる', () => {
  assert.match(headerSource, /aria-label="選択中の本の管理名を変更"/);
  assert.match(headerSource, /本の管理名を変更/);
  assert.match(headerSource, /KDPへ登録する正式な書名・原稿・進捗は変わりません/);
  assert.match(headerSource, /mutatePublishingProject\(targetProjectId/);
  assert.match(headerSource, /buildProjectDisplayNameUpdate/);
  assert.match(headerSource, /ProjectDisplayNameConflictError/);
  assert.match(headerSource, /renameSavingRef/);
  assert.match(headerSource, /createSavingRef/);
  assert.match(homeSource, /onProjectUpdate=\{handleProjectUpdate\}/);
  const renameHandler = headerSource.match(/const handleRename = async \(\) => \{([\s\S]*?)\n  \};/)?.[1] || '';
  assert.ok(renameHandler.indexOf('await flushPendingSaves()') < renameHandler.indexOf('mutatePublishingProject('));
  assert.match(headerSource, /disabled=\{renameSaving \|\| createSaving\}/);
  assert.match(headerSource, /if \(renameSavingRef\.current \|\| createSavingRef\.current\) return/);
});

test('新規作成は仮タイトルで始めて後から変更できると案内する', () => {
  assert.match(headerSource, /正式な書名が未定でも/);
  assert.match(headerSource, /「○○（仮）」で始められます/);
  assert.match(headerSource, /この名前はあとから変更できます/);
  assert.match(headerSource, /PROJECT_DISPLAY_NAME_MAX_LENGTH/);
  assert.match(headerSource, /if \(createSavingRef\.current\) return/);
  assert.match(headerSource, /nativeEvent\?\.isComposing/g);
});
