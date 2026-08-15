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

function sourceBlock(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `開始位置が見つかりません: ${startMarker}`);
  assert.notEqual(end, -1, `終了位置が見つかりません: ${endMarker}`);
  return source.slice(start, end);
}

test('初心者は空状態から企画・階層目次・取材のどれか1件を始められる', () => {
  assert.match(source, /まずは1つだけで大丈夫です/);
  assert.match(source, /企画メモを書く/);
  assert.match(source, /目次の構成を作る/);
  assert.match(source, /部を追加/);
  assert.match(source, /章だけで始める/);
  assert.match(source, /取材を1問記録/);
  assert.match(source, /この1問を保存/);
  assert.match(source, /部・章・話・節のタイトルを入力してください/);
  assert.match(source, /今回の質問を入力してください/);
  assert.match(source, /指示書名を入力してください/);
});

test('6領域と検索・構成項目・状態・資料優先順位の絞り込みを表示する', () => {
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
  assert.match(source, /構成項目で絞り込み/);
  assert.match(source, /状態で絞り込み/);
  assert.match(source, /資料優先順位で絞り込み/);
});

test('内側メニューは外側ナビの実測高さを避けて追従し、狭幅では選択中を横スクロール内へ表示する', () => {
  assert.match(source, /sticky z-20/);
  assert.match(source, /calc\(var\(--kindle-main-nav-height, 60px\) \+ 0\.5rem\)/);
  assert.match(source, /overflow-x-auto overscroll-x-contain/);
  assert.match(source, /flex min-w-max gap-2 lg:min-w-0 lg:w-full/);
  assert.match(source, /sectionButtonRefs\.current\.get\(activeSection\)/);
  assert.match(source, /currentContainer\.scrollTo\(\{[\s\S]*left: Math\.min\(maxLeft, Math\.max\(0, targetLeft\)\)/);
  assert.match(source, /top: currentContainer\.scrollTop/);
  assert.match(source, /new window\.ResizeObserver\(handleSectionNavResize\)/);
  assert.match(source, /resizeObserver\?\.observe\(container\)/);
  assert.match(source, /resizeObserver\?\.observe\(button\)/);
  assert.match(source, /window\.addEventListener\('resize', handleSectionNavResize\)/);
  assert.match(source, /resizeObserver\?\.disconnect\(\)/);
  assert.match(source, /window\.removeEventListener\('resize', handleSectionNavResize\)/);
  assert.match(source, /window\.requestAnimationFrame/);
  assert.match(source, /window\.cancelAnimationFrame/);
  assert.match(source, /reduceMotion \|\| requestedBehavior !== 'smooth' \? 'auto' : 'smooth'/);
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
  assert.match(source, /title: '読者が求めていること'[\s\S]*?icon: UserRound[\s\S]*?border-l-cyan-400[\s\S]*?text-cyan-200/);
  assert.match(source, /title: '競合に共通すること・不足'[\s\S]*?icon: Scale[\s\S]*?border-l-amber-400[\s\S]*?text-amber-200/);
  assert.match(source, /title: 'この本が取る立ち位置'[\s\S]*?icon: Compass[\s\S]*?border-l-emerald-400[\s\S]*?text-emerald-200/);
  assert.match(source, /border border-l-4/);
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
  assert.match(source, /本人承認済みは直接上書きせず、新しい案として残します/);
  assert.match(source, /この項目だけ複製/);
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

test('容量警告・破損停止・明示保存・兄弟単位の並べ替えを備える', () => {
  assert.match(source, /容量が増えています。バックアップ推奨/);
  assert.match(source, /空データで上書きせず停止しています/);
  assert.match(source, /保存するまで既存データは変わりません/);
  assert.match(source, /chapter\.parentId === record\.parentId/);
  assert.match(source, /aria-label=\{`\$\{record\.title \|\| '無題の構成項目'\}を\$\{siblingLocation\}上へ`\}/);
  assert.match(source, /aria-label=\{`\$\{record\.title \|\| '無題の構成項目'\}を\$\{siblingLocation\}下へ`\}/);
});

test('部・章・話・節を階層表示し、親選択・子追加・パンくずを配線する', () => {
  assert.match(source, /PLANNING_CHAPTER_NODE_TYPES/);
  assert.match(source, /flattenPlanningChapterTree\(data\)/);
  assert.match(source, /getPlanningChapterParentOptions\(planningData, draft\.id, draft\.nodeType\)/);
  assert.match(source, /項目の種類/);
  assert.match(source, /入れる場所/);
  assert.match(source, /この中に追加/);
  assert.match(source, /入っている場所：\{pathLabel\}/);
  assert.match(source, /data-chapter-depth/);
  assert.match(source, /Math\.min\(depth, 3\) \* 8/);
  assert.match(source, /紐づく部・章・話・節/);
  assert.match(source, /planningData=\{data\}/);
  assert.match(source, /本全体の最上位/);
  assert.match(source, /section === 'chapters'[\s\S]*?chapterPathLabel\(record, chapters/);
});

test('仮目次・確定目次・過去の目次をアクセシブルな3タブとして切り替える', () => {
  for (const label of ['仮目次', '確定目次', '過去の目次']) assert.match(source, new RegExp(label));
  assert.match(source, /role="tablist"[\s\S]*?aria-label="目次の表示を切り替える"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected=\{isActive\}/);
  assert.match(source, /aria-controls=\{`planning-outline-panel-\$\{view\}`\}/);
  assert.match(source, /tabIndex=\{isActive \? 0 : -1\}/);
  for (const view of ['confirmed', 'history']) {
    assert.match(source, new RegExp(`id="planning-outline-panel-${view}"`));
    assert.match(source, new RegExp(`aria-labelledby="planning-outline-tab-${view}"`));
  }
  assert.match(source, /id=\{activeSection === 'chapters' \? 'planning-outline-panel-draft' : undefined\}/);
  assert.match(source, /role=\{activeSection === 'chapters' \? 'tabpanel' : undefined\}/);
  assert.match(source, /aria-labelledby=\{activeSection === 'chapters' \? 'planning-outline-tab-draft' : undefined\}/);
  assert.equal((source.match(/role="tabpanel"/g) || []).length, 3);
  assert.match(source, /Object\.keys\(OUTLINE_VIEW_META\)[\s\S]*?filter\(view => view !== outlineView\)[\s\S]*?hidden/);
  assert.match(source, /if \(event\.key === 'ArrowRight'\)/);
  assert.match(source, /else if \(event\.key === 'ArrowLeft'\)/);
  assert.match(source, /else if \(event\.key === 'Home'\) nextIndex = 0/);
  assert.match(source, /else if \(event\.key === 'End'\) nextIndex = views\.length - 1/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /outlineTabRefs\.current\.get\(view\)/);
  assert.match(source, /outlineTabRefs\.current\.get\(view\)\?\.focus\(\)/);
  assert.match(source, /setStatusMessage\(`\$\{OUTLINE_VIEW_META\[view\]\.label\}を表示しました`\)/);
});

test('目次本文の編集は仮目次だけに置き、確定目次は原稿管理だけ、履歴は読み取り専用にする', () => {
  assert.match(source, /outlineView === 'draft' && \([\s\S]*?openNewRecord\('chapters', \{ nodeType: 'part' \}\)[\s\S]*?openNewRecord\('chapters', \{ nodeType: 'chapter' \}\)[\s\S]*?openOutlineSnapshotDialog\('draft'\)[\s\S]*?openOutlineSnapshotDialog\('confirmed'\)/);
  assert.match(source, /outlineView === 'confirmed'[\s\S]*?目次本文は読み取り専用です。[\s\S]*?<OutlineSnapshotTree[\s\S]*?snapshot=\{confirmedOutline\}[\s\S]*?current/);
  assert.match(source, /outlineView === 'history'[\s\S]*?内容を見る（読み取り専用）[\s\S]*?<OutlineSnapshotTree/);

  const snapshotTreeSource = sourceBlock('function OutlineSnapshotTree', 'function EditorDialog');
  assert.doesNotMatch(snapshotTreeSource, /openNewRecord|openEditRecord|handleMoveChapter|handleDelete|<Button/);

  assert.match(source, /selectActiveSection\('chapters'\);\s*selectOutlineView\('draft'\);\s*openNewRecord\('chapters', \{ nodeType: 'part' \}\)/);
});

test('仮目次の履歴保存と確定は確認ダイアログを経て既存版を残す', () => {
  for (const label of [
    '今の仮目次を履歴に保存',
    'この仮目次を確定目次にする',
    '現在採用中の内容：',
    '履歴として残るもの：',
    '消えるもの：',
    '変わるもの：',
    '前の確定目次は履歴へ残ります',
    '版の名前',
    '変更メモ（任意）',
    '確定目次として保存',
    '履歴に保存',
  ]) assert.match(source, new RegExp(label));
  assert.match(source, /createPlanningOutlineSnapshot\(current, \{[\s\S]*?kind,[\s\S]*?label: outlineDialog\.label,[\s\S]*?note: outlineDialog\.note/);
  assert.match(source, /expectedOutlineRevision: outlineDialog\.expectedOutlineRevision/);
  assert.match(source, /expectedChapterOrderRevision: outlineDialog\.expectedChapterOrderRevision/);
  assert.match(source, /版の名前（空欄でもOK）/);
  assert.match(source, /onClick=\{onSave\} disabled=\{busy\}/);
  assert.match(source, /setOutlineDialog\(null\);\s*selectOutlineView\(kind === 'confirmed' \? 'confirmed' : 'history', \{ focus: true \}\)/);
});

test('目次全体の確定と各項目の本人承認を初心者向け文言で区別する', () => {
  assert.match(source, /仮目次<\/span>は何度でも編集できます/);
  assert.match(source, /確定目次<\/span>は目次本文を変えない保存版ですが/);
  assert.match(source, /各項目の「本人承認済み」とは別です/);
  assert.match(source, /各項目の「本人承認済み」は内容確認です/);
  assert.match(source, /ここで作る「確定目次」は、本全体で現在使う目次の保存版です/);
});

test('目次の3タブは狭い画面で横スクロールし、PCでは3列に収める', () => {
  assert.match(source, /role="tablist"[\s\S]*?className="flex min-w-max gap-2 sm:min-w-0 sm:grid sm:grid-cols-3"/);
  assert.match(source, /<div ref=\{outlineTablistScrollRef\} className="overflow-x-auto overscroll-x-contain">[\s\S]*?role="tablist"/);
  assert.match(source, /min-h-12 min-w-\[7\.5rem\]/);
  assert.match(source, /focus-visible:ring-2 focus-visible:ring-neon-cyan\/80/);
  assert.match(source, /const container = outlineTablistScrollRef\.current/);
  assert.match(source, /const button = outlineTabRefs\.current\.get\(outlineView\)/);
  assert.match(source, /targetLeft = button\.offsetLeft - \(\(container\.clientWidth - button\.offsetWidth\) \/ 2\)/);
  assert.match(source, /left: Math\.min\(maxLeft, Math\.max\(0, targetLeft\)\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
});

test('目次全体を1件ずつ削除せずCodex案へ安全に書き直せる', () => {
  for (const label of [
    '目次をまとめて書き直す',
    'Codexの目次案を貼り付ける（おすすめ）',
    '空の仮目次から始める',
    'Codexへの相談文をコピー',
    '新しい仮目次のプレビュー',
    '切り替える前の安全確認',
    '新しい仮目次へ切り替える',
  ]) assert.match(source, new RegExp(label));
  assert.match(source, /parsePlanningOutlineMarkdown\(outlineRewrite\.markdown\)/);
  assert.match(source, /replacePlanningOutlineDraft\(current, outlineRewrite\.preview\.proposedChapters/);
  assert.match(source, /expectedOutlineRevision: outlineRewrite\.expectedOutlineRevision/);
  assert.match(source, /expectedChapterOrderRevision: outlineRewrite\.expectedChapterOrderRevision/);
  assert.match(source, /本人承認済みの項目・取材の質問と回答・競合調査・執筆指示書・現在の確定目次・過去の目次はすべて残ります/);
  assert.match(source, /消えるもの：<\/span>ありません/);
  assert.match(source, /確定目次は自動では変わりません/);
});

test('書き直しダイアログは3手順・キーボード復帰・モバイル再配置に対応する', () => {
  assert.match(source, /aria-label="目次を書き直す手順"/);
  assert.match(source, /aria-current=\{active \? 'step' : undefined\}/);
  assert.match(source, /onOpenAutoFocus=\{event => \{/);
  assert.match(source, /cancelButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /outlineRewriteTriggerRef\.current\?\.focus\(\)/);
  assert.match(source, /max-h-\[92dvh\].*max-w-3xl.*overflow-hidden/);
  assert.match(source, /min-h-11/);
  assert.match(source, /flex flex-col gap-2.*sm:flex-row/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-live="polite"/);
});

test('Codex相談文は本の前提と現在目次だけを含め、非公開取材を自動コピーしない', () => {
  const promptSource = sourceBlock('function planningOutlineRewritePrompt', 'function recordSummary');
  for (const field of ['targetReader', 'readerProblems', 'bookPromise', 'theme']) {
    assert.match(promptSource, new RegExp(`concept\\?\\.${field}`));
  }
  assert.match(promptSource, /既存項目の削除や承認解除はしません/);
  assert.match(promptSource, /出力は説明文を付けず、次のMarkdown形式だけ/);
  assert.doesNotMatch(promptSource, /interviews|rawAnswer|publicAnswer|session/i);
});

test('書き直し後の旧目次リンクを見える状態で保持し、再紐づけできる', () => {
  assert.match(source, /getPlanningDraftOutlineChapters\(data\)/);
  assert.match(source, /const allChapters = data\.chapters/);
  assert.match(source, /旧目次：\$\{path\}/);
  assert.match(source, /旧目次との紐づけ（参照用）/);
  assert.match(source, /目次を書き直す前の紐づけです/);
  assert.match(source, /<option value="archived">旧目次に紐づく記録<\/option>/);
  assert.match(source, /record\.chapterIds\.map\(id => chapterReferenceLabel\(id, allChapters, activeChapterIds\)\)/);
  assert.match(source, /lastOutlineRewriteSummary\.preservedLinkCount/);
  assert.match(source, /lastOutlineRewriteSummary\.needsRelinkCount/);
});

test('本人承認済みの取材等も本文を解除せず目次の紐づけだけ付け直せる', () => {
  for (const label of [
    '目次との紐づけだけ変更',
    '本文や承認状態は変わりません',
    '旧目次との紐づけ（現在残っているもの）',
    '紐づけだけ保存',
  ]) assert.match(source, new RegExp(label));
  assert.match(source, /updatePlanningRecordChapterLinks\(/);
  assert.match(source, /chapterLinkEditor\.section/);
  assert.match(source, /chapterLinkEditor\.recordId/);
  assert.match(source, /expectedUpdatedAt: chapterLinkEditor\.expectedUpdatedAt/);
  assert.match(source, /<ChapterLinkDialog/);
  assert.match(source, /value=\{chapterLinkEditor\?\.projectId === project\.id \? chapterLinkEditor : null\}/);
  assert.match(source, /record && !\['chapters', 'concept', 'conceptHistory'\]\.includes\(detail\.section\)/);
  assert.match(source, /activeSection !== 'chapters'.*openChapterLinkEditor\(activeSection, record\)/);
  assert.match(source, /onEditChapterLinks=\{record => openChapterLinkEditor\('competitors', record\)\}/);
  assert.match(source, /onEditChapterLinks=\{record => openChapterLinkEditor\('instructionVersions', record\)\}/);
  assert.match(source, /onEditChapterLinks=\{record => openChapterLinkEditor\('decisions', record\)\}/);
});

test('空の仮目次をもう一度空にせず、完了表示で履歴追加の有無と項目数を区別する', () => {
  assert.match(source, /disabled=\{value\.currentCount === 0\}/);
  assert.match(source, /仮目次はすでに空です。Codexの案を貼るか、ダイアログを閉じて部・章を追加してください/);
  assert.match(source, /if \(!result\.summary\.changed\) throw new Error/);
  assert.match(source, /function outlineRewriteHistoryMessage\(summary\)/);
  assert.match(source, /if \(itemCount === 0\) return '前の目次は空だったため、履歴の追加はありません'/);
  assert.match(source, /if \(summary\?\.snapshotCreated\) return `前の目次 1版（\$\{itemCount\}項目）を履歴へ保存`/);
  assert.match(source, /if \(summary\?\.snapshotId\) return `前の目次は保存済みの履歴に保持（\$\{itemCount\}項目）`/);
  assert.match(source, /outlineRewriteHistoryMessage\(lastOutlineRewriteSummary\)/);
});

test('仮目次と確定目次だけで章ごとの原稿進捗と原稿リンクを更新できる', () => {
  assert.match(source, /function ChapterManuscriptControls\(/);
  assert.match(source, /activeSection === 'chapters' && record\.status !== 'rejected'[\s\S]*<ChapterManuscriptControls/);
  assert.match(source, /<OutlineSnapshotTree[\s\S]*snapshot=\{confirmedOutline\}[\s\S]*current[\s\S]*onToggleManuscriptComplete=\{toggleChapterManuscriptComplete\}[\s\S]*onEditManuscriptLink=\{openManuscriptLinkEditor\}/);
  assert.match(source, /current && getManuscript && onToggleManuscriptComplete && onEditManuscriptLink/);
  assert.match(source, /<OutlineSnapshotTree snapshot=\{snapshot\} includeRejected \/>/);
  assert.match(source, /確定目次<\/span>は目次本文を変えない保存版ですが、原稿の完成チェックと原稿リンクだけは更新できます/);
  assert.match(source, /過去の目次<\/span>は変更できません/);
});

test('原稿完成チェックと任意HTTPS原稿URLは初心者向けで安全に操作できる', () => {
  assert.match(source, /getPlanningChapterManuscript\(data, record\.id\)/);
  assert.match(source, /new Map\(data\.chapterWritingStates\.map\(state => \[state\.chapterId, state\]\)\)/);
  assert.match(source, /updatePlanningChapterManuscript\(/);
  assert.match(source, /validatePlanningManuscriptUrl\(manuscriptLinkEditor\.documentUrl\)/);
  assert.match(source, /原稿の保存先リンク/);
  assert.match(source, /原稿リンクを設定/);
  assert.match(source, /Googleドキュメント、Notion、OneDrive、Dropbox/);
  assert.match(source, /Googleドキュメントを使う場合の執筆用目安/);
  assert.match(source, /［ファイル］→［ページ設定］/);
  assert.match(source, /これはKDP電子書籍の指定ではありません/);
  assert.match(source, /通常のKindle電子書籍は端末や文字設定に合わせて表示が組み直される/);
  assert.match(source, /電子版はKindle Previewerで確認/);
  assert.match(source, /A5判の紙版は入稿先の判型・余白・裁ち落とし仕様へ別途調整/);
  assert.match(source, /aria-describedby="planning-manuscript-a5-help planning-manuscript-document-help planning-manuscript-document-error"/);
  assert.match(source, /type="checkbox"[\s\S]*aria-label=\{`\$\{itemLabel\}の原稿を書き終えた`\}/);
  assert.match(source, /原稿：完成/);
  assert.match(source, /原稿：未完成/);
  assert.match(source, /target="_blank"[\s\S]*rel="noopener noreferrer"/);
  assert.match(source, /原稿を開く/);
  assert.match(source, /空欄で保存すると、この原稿リンクだけを削除します/);
  assert.match(source, /type="url"/);
  assert.match(source, /<form noValidate/);
  assert.match(source, /onOpenAutoFocus=\{event =>/);
  assert.match(source, /onCloseAutoFocus=\{event =>/);
  assert.match(source, /returnFocusRef\.current\?\.focus\(\)/);
  assert.match(source, /const returnTarget = manuscriptLinkReturnFocusRef\.current/);
  assert.match(source, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*window\.requestAnimationFrame\(\(\) => returnTarget\?\.focus\(\)\)/);
  assert.match(source, /className="mt-4 flex-col-reverse gap-2 sm:flex-row"/);
  assert.match(source, /setStatusMessage\(successMessage\)/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /共有用JSON／Markdownには含めません/);
  assert.match(source, /章ごとの原稿完成チェックと原稿URLは完全バックアップに含まれますが、共有用JSON／MarkdownからURLは除外します/);
  assert.match(source, /外部サービスの原稿本文を同期・保存する機能ではありません/);
  assert.match(source, /原稿完成チェックとリンクは、過去または確定済みの目次側に残ります/);
  assert.match(source, /削除が実行される場合、この項目だけの原稿完成チェックとリンクも一緒に削除されます/);
  assert.match(source, /outlineSnapshots\.some\([\s\S]*snapshot\.chapters\.some\(chapter => chapter\.id === record\.id\)/);
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
  assert.match(backupDialogSource, /内容・章順・版・正本指定・原稿進捗の競合/);
  assert.match(backupDialogSource, /conflict\.projectName/);
  assert.match(backupDialogSource, /conflict\.section/);
  assert.match(backupDialogSource, /conflict\.reason/);
  assert.match(backupDialogSource, /目次の保存履歴が上限100件を超える/);
  assert.match(backupDialogSource, /編集中の仮目次が異なる（自動では切り替えない）/);
  assert.match(backupDialogSource, /chapterWritingStates: '章ごとの原稿進捗'/);
  assert.match(backupDialogSource, /chapter_writing_state_requires_review: '同じ章の完成状態・リンクが異なる'/);
  assert.match(backupDialogSource, /disabled=\{busy \|\| planningMergeConflicts\.length > 0\}/);
  assert.match(backupDialogSource, /非公開取材は通常バックアップに含まれます/);
});
