import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/components/tabs/PlanningNotesTab.jsx', import.meta.url),
  'utf8',
);
const backupDialogSource = readFileSync(
  new URL('../src/components/DataBackupDialog.jsx', import.meta.url),
  'utf8',
);

test('初心者は空状態から企画・章・取材のどれか1件を始められる', () => {
  assert.match(source, /まずは1つだけで大丈夫です/);
  assert.match(source, /企画メモを書く/);
  assert.match(source, /章を1つ作る/);
  assert.match(source, /取材を1問記録/);
  assert.match(source, /この1問を保存/);
  assert.match(source, /章タイトルを入力してください/);
  assert.match(source, /今回の質問を入力してください/);
  assert.match(source, /指示書名を入力してください/);
});

test('6領域と検索・章・状態・資料優先順位の絞り込みを表示する', () => {
  for (const label of [
    '企画メモ',
    '競合・市場調査',
    '目次・章構成',
    '取材記録',
    '執筆設計・GPTs指示書',
    '意思決定・版履歴',
  ]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /ノート内を検索/);
  assert.match(source, /章で絞り込み/);
  assert.match(source, /状態で絞り込み/);
  assert.match(source, /資料優先順位で絞り込み/);
});

test('承認済みを直接上書きせず履歴・新版として扱う導線がある', () => {
  assert.match(source, /承認版を残して新しい案/);
  assert.match(source, /承認済みの旧企画を確認/);
  assert.match(source, /本人承認済みは直接上書きせず、新しい案・新しい版として残します/);
  assert.match(source, /activeSection === 'instructionVersions' \? '新しい版' : '複製'/);
  assert.match(source, /本人承認済みにする場合は、承認者を入力してください/);
  assert.match(source, /承認後はこの記録を直接編集・削除できません/);
  assert.match(source, /内容を見る/);
  assert.match(source, /保存済みの内容を読む画面です。ここでは変更しません/);
  assert.match(source, /target="_blank" rel="noopener noreferrer"/);
  assert.match(source, /採用しない（履歴）/);
});

test('生の取材回答と匿名化した共有用文章を分離し、共有範囲を説明する', () => {
  assert.match(source, /本人の原回答/);
  assert.match(source, /匿名化した共有・公開用の文章/);
  assert.match(source, /共有用ファイルへ出すのはこちらだけ/);
  assert.match(source, /共有用JSON/);
  assert.match(source, /共有用Markdown/);
  assert.match(source, /APIキー・認証情報・非公開会話URLは保存しない/);
});

test('容量警告・破損停止・明示保存・章並べ替えの安全導線を備える', () => {
  assert.match(source, /容量が増えています。バックアップ推奨/);
  assert.match(source, /空データで上書きせず停止しています/);
  assert.match(source, /保存するまで既存データは変わりません/);
  assert.match(source, /aria-label=\{`\$\{record\.title \|\| '無題の章'\}を上へ`\}/);
  assert.match(source, /aria-label=\{`\$\{record\.title \|\| '無題の章'\}を下へ`\}/);
});

test('長文入力中に全文の再解析・dirty比較・検索再正規化を繰り返さない', () => {
  assert.match(source, /useState\(\(\) => readPlanningNotes\(project\?\.planning_notes\)\)/);
  assert.doesNotMatch(source, /JSON\.stringify\(editor\.draft\)/);
  assert.match(source, /dirty: true/);
  assert.match(source, /\{ assumeNormalized: true \}/);
  assert.match(source, /const usageBytes = useMemo\(/);
});

test('バックアップ結合のノート競合は場所と理由を示して実行を止める', () => {
  assert.match(backupDialogSource, /previewDataBackupPlanningNotesConflicts/);
  assert.match(backupDialogSource, /planningMergeConflicts\.length > 0/);
  assert.match(backupDialogSource, /内容・章順・指示書版の競合/);
  assert.match(backupDialogSource, /conflict\.projectName/);
  assert.match(backupDialogSource, /conflict\.section/);
  assert.match(backupDialogSource, /conflict\.reason/);
  assert.match(backupDialogSource, /disabled=\{busy \|\| planningMergeConflicts\.length > 0\}/);
  assert.match(backupDialogSource, /非公開取材は通常バックアップに含まれます/);
});
