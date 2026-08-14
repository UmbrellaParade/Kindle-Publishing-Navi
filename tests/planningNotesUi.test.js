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

test('内側メニューは外側ナビの実測高さを避けて追従し、狭幅では選択中を横スクロール内へ表示する', () => {
  assert.match(source, /sticky z-20/);
  assert.match(source, /calc\(var\(--kindle-main-nav-height, 60px\) \+ 0\.5rem\)/);
  assert.match(source, /overflow-x-auto overscroll-x-contain/);
  assert.match(source, /flex min-w-max gap-2 lg:min-w-0 lg:w-full/);
  assert.match(source, /sectionButtonRefs\.current\.get\(activeSection\)/);
  assert.match(source, /container\.scrollTo\(\{[\s\S]*left: Math\.max\(0, targetLeft\)/);
  assert.doesNotMatch(source, /button\.scrollIntoView/);
  assert.match(source, /activeSection === key \? CheckCircle2 : meta\.icon/);
  assert.match(source, /aria-current=\{activeSection === key \? 'page' : undefined\}/);
  assert.match(source, /focus-visible:ring-2 focus-visible:ring-neon-cyan\/80/);
});

test('市場調査はサマリー・根拠・PC比較表・スマホカード・0件解除を一画面で確認できる', () => {
  for (const label of [
    '市場調査サマリー',
    '調査更新日',
    '競合数',
    '確認済みソース数',
    '主な読者ニーズ',
    '本書の主要機会',
    '読者が求めていること',
    '競合に共通すること・不足',
    'この本が取る立ち位置',
    '読者反応から見える不足',
    '書誌確認済み',
    '差別化は編集仮説',
    '再確認待ち',
    '市場ポジション・主USPは著者承認待ち',
    'レビュー観察は再確認待ち',
  ]) assert.match(source, new RegExp(label));
  assert.match(source, /<MarketClaimBadge value=\{record\.claimKind\} \/>/);
  assert.equal((source.match(/<MarketRecheckBadge value=\{record\.recheckStatus\} \/>/g) || []).length, 2);
  assert.match(source, /label === 'レビュー観察メモ' && \/再確認待ち\//);
  assert.match(source, /<table className="min-w-\[1500px\]/);
  assert.match(source, /className="space-y-3 lg:hidden"/);
  assert.match(source, /比較できる競合はまだありません/);
  assert.match(source, /条件に一致する競合はありません/);
  assert.match(source, /onClearFilters/);
  assert.match(source, /planning-competitors-\$\{record\.id\}-desktop/);
  assert.match(source, /planning-competitors-\$\{record\.id\}-mobile/);
  assert.match(source, /scrollMarginTop: 'calc\(var\(--kindle-main-nav-height, 60px\) \+ 5\.5rem\)'/);
});

test('市場調査の正本Markdownはファイル名だけを渡し、必ず差分preview後に追加する', () => {
  assert.match(source, /正本を読み込む/);
  assert.match(source, /parseMarketResearchSummaryMarkdown\(markdown, \{ sourceName: fileName \}\)/);
  assert.match(source, /previewMarketResearchImport\(data, incoming\)/);
  assert.match(source, /applyMarketResearchImport\(current, marketImport\.incoming\)/);
  assert.match(source, /この差分を追加/);
  assert.match(source, /追加/);
  assert.match(source, /同一のため追加しない/);
  assert.match(source, /競合/);
  assert.match(source, /削除/);
  assert.match(source, /再確認待ち観察/);
  assert.match(source, /未調査・次回確認/);
  assert.match(source, /disabled=\{busy \|\| !canApply \|\| Boolean\(value\?\.error\)\}/);
  assert.doesNotMatch(source, /file\.path/);
});

test('市場調査保存前に限定URL・会話URL・内部指示を検査する', () => {
  assert.match(source, /findMarketResearchRestrictedData\(editor\.draft\)/);
  assert.match(source, /findMarketResearchRestrictedData\(marketEditor\.draft\)/);
  assert.match(source, /限定URL・会話URL・セッションID・GPTs内部指示/);
  assert.match(source, /未確認の内容は断定せず/);
});

test('指示書はCodex・著者の正本枠を常設し、正本・最新を別概念で明示する', () => {
  assert.match(source, /Codexが最初に見る正本/);
  assert.match(source, /著者が最初に見る正本/);
  assert.match(source, /正本未設定/);
  assert.match(source, /正本<\/span>＝現在参照すべき版/);
  assert.match(source, /最新<\/span>＝更新日時が最も新しい記録/);
  assert.match(source, /sortPlanningRecordsNewest\(data\.instructionVersions\)/);
  assert.match(source, /assignInstructionCanonical\(current, record\.id, target, \{ makeFirstRead: true \}\)/);
  assert.match(source, /clearInstructionCanonical\(current, record\.id, target\)/);
  assert.match(source, /同じ役割・対象の旧正本は旧版になります/);
});

test('意思決定は現在の正本と最新順の履歴を分け、差替え・撤回・相互参照を示す', () => {
  assert.match(source, /現在の判断・正本（まずここを見る）/);
  assert.match(source, /表示順：更新日時の新しい順（最新が上）/);
  assert.match(source, /日時は日本時間で表示/);
  assert.match(source, /sortPlanningRecordsNewest\(data\.decisions\)/);
  assert.match(source, /assignDecisionCanonical\(current, record\.id, \{ makeFirstRead: true \}\)/);
  assert.match(source, /withdrawPlanningDecision\(current, record\.id\)/);
  assert.match(source, /差替え前を見る/);
  assert.match(source, /差替え後を見る/);
  assert.match(source, /記録は削除せず「撤回」として履歴へ残します/);
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
  assert.match(backupDialogSource, /内容・章順・版・正本指定の競合/);
  assert.match(backupDialogSource, /conflict\.projectName/);
  assert.match(backupDialogSource, /conflict\.section/);
  assert.match(backupDialogSource, /conflict\.reason/);
  assert.match(backupDialogSource, /disabled=\{busy \|\| planningMergeConflicts\.length > 0\}/);
  assert.match(backupDialogSource, /非公開取材は通常バックアップに含まれます/);
});
