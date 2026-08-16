import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reviewSource = readFileSync(
  new URL('../src/components/tabs/ReviewGuideTab.jsx', import.meta.url),
  'utf8',
);
const managerSource = readFileSync(
  new URL('../src/components/critique/CritiqueGptManagement.jsx', import.meta.url),
  'utf8',
);
const handoffSource = readFileSync(
  new URL('../src/components/gpt/PlanningGptHandoffPreparationCard.jsx', import.meta.url),
  'utf8',
);
const homeSource = readFileSync(
  new URL('../src/pages/Home.jsx', import.meta.url),
  'utf8',
);

test('辛口論評の結果・履歴とGPT世代管理を別のアクセシブルな画面に分ける', () => {
  assert.match(reviewSource, /\{ id: 'history', label: '論評・履歴'/);
  assert.match(reviewSource, /\{ id: 'gptSessions', label: '辛口論評GPT管理'/);
  assert.match(reviewSource, /role="tablist"/);
  assert.match(reviewSource, /aria-selected=\{selected\}/);
  assert.match(reviewSource, /tabIndex=\{selected \? 0 : -1\}/);
  assert.match(reviewSource, /ArrowRight'[\s\S]*ArrowLeft'[\s\S]*Home'[\s\S]*End'/);
  assert.match(reviewSource, /role="tabpanel"/);
  assert.match(reviewSource, /<CritiqueGptManagement/);
  assert.match(managerSource, /論評結果・4分類・著者判断の履歴は「論評・履歴」に残し/);
  assert.doesNotMatch(managerSource, /updatePlanningRecordStatus|approvedAt|approvedBy/);
});

test('辛口論評GPT管理は初心者向け案内・11列・現在使用中・並び替えを一画面に備える', () => {
  for (const phrase of [
    '辛口論評GPT 管理',
    '重くなる前に移る目安',
    '移るときの3ステップ',
    'まだ辛口論評GPTセッションはありません',
    '次の管理ID候補',
    '使用中を先頭・開始日の新しい順',
    '使用中を先頭・開始日の古い順',
    '現在使うGPT',
  ]) assert.match(managerSource, new RegExp(phrase));

  const expectedFields = [
    '辛口論評GPT管理ID',
    'セッション名',
    '辛口論評GPT URL',
    '担当範囲',
    '状態',
    '開始日',
    '対象原稿版ID',
    '論評回',
    '引継ぎ先ID',
    '引継ぎメモ',
    '備考',
  ];
  const fieldsStart = managerSource.indexOf('const CRITIQUE_GPT_SPREADSHEET_FIELDS');
  const fieldsEnd = managerSource.indexOf('const CRITIQUE_GPT_STATUS_META', fieldsStart);
  const fields = managerSource.slice(fieldsStart, fieldsEnd);
  let previous = -1;
  for (const label of expectedFields) {
    const current = fields.indexOf(label);
    assert.ok(current > previous, `${label}がスプレッドシート列順ではありません`);
    previous = current;
  }

  assert.match(managerSource, /getNextPlanningCritiqueGptManagementId/);
  assert.match(managerSource, /sortPlanningCritiqueGptSessions\(sessions, \{ direction: sortOrder \}\)/);
  assert.match(managerSource, /border-emerald-400\/45[\s\S]*現在使うGPT/);
  assert.match(managerSource, /min-h-11/);
});

test('開始日と論評回を正しい型で保存し、一覧・再読み込みへ残す配線がある', () => {
  assert.match(managerSource, /const rawValue = draft\?\.\[field\]/);
  assert.match(managerSource, /field === 'critiqueRound' \? \(rawValue \|\| ''\) : \(rawValue \?\? ''\)/);
  assert.match(managerSource, /field === 'critiqueRound'[\s\S]*event\.target\.value === '' \? 0 : Number\(event\.target\.value\)/);
  assert.match(managerSource, /type=\{type\}/);
  assert.match(managerSource, /onInput=\{type === 'date'[\s\S]*event\.currentTarget\.value/);
  assert.match(managerSource, /draft: \{ \.\.\.current\.draft, \[field\]: value \}/);
  assert.match(managerSource, /開始日：\{record\.startedOn \|\| '未設定'\}/);
  assert.match(managerSource, /serializePlanningNotes\(nextData, \{ enforceStorageBudget: true \}\)/);
  assert.match(homeSource, /initialSection=\{critiqueSection\}/);
  assert.match(homeSource, /onSectionChange=\{handleCritiqueSectionChange\}/);
});

test('引継ぎ先は保留で原子的に作り、現在の使用中からつながる記録だけ開始できる', () => {
  assert.match(managerSource, /createPlanningCritiqueGptHandoffTarget/);
  assert.match(managerSource, /sessionStatus: 'on_hold'/);
  assert.match(managerSource, /activatePlanningCritiqueGptSession/);
  assert.match(managerSource, /const source = sessions\.find\(session => session\.sessionStatus === 'active'\)/);
  assert.match(managerSource, /record\.sessionStatus === 'on_hold'[\s\S]*activeSession\?\.handoffToId === record\.managementId/);
  assert.match(managerSource, /前の使用中セッションは「引継ぎ済み」になり、記録は残ります/);
  assert.match(managerSource, /target="_blank" rel="noopener noreferrer"/);
  assert.match(managerSource, />GPTを開く</);
});

test('ダイアログと削除後のキーボードフォーカスを失わず、390pxでも操作順が一致する', () => {
  assert.match(managerSource, /const returnFocusNodeRef = useRef\(null\)/);
  assert.match(managerSource, /onCloseAutoFocus=\{event => \{[\s\S]*restoreReturnFocus\(\)/);
  assert.match(managerSource, /requestAnimationFrame\(restoreReturnFocus\)/);
  assert.match(managerSource, /focusAfterDelete = sorted\[index \+ 1\] \|\| sorted\[index - 1\] \|\| null/);
  assert.match(managerSource, /setPendingFocus\(focusAfterDelete\?\.managementId \|\| '__list__'\)/);
  assert.match(managerSource, /id="critique-gptSessions-list-title" tabIndex=\{-1\}/);
  assert.match(managerSource, /DialogFooter className="flex-col gap-2[^"]*sm:flex-row sm:space-x-0"/);
});

test('両GPT管理の引継ぎ準備は差込・編集・コピー失敗時の手動導線を備える', () => {
  assert.match(managerSource, /kind="critique"/);
  assert.match(managerSource, /targetManuscriptVersionId/);
  assert.match(managerSource, /critiqueRound/);
  assert.match(managerSource, /previousFindings/);
  assert.match(managerSource, /unresolvedFindings/);
  assert.match(managerSource, /updatePlanningGptHandoffTemplates\(current, 'critique'/);
  assert.match(handoffSource, /引継ぎ書の作成指示をコピー/);
  assert.match(handoffSource, /新しいGPTへの開始指示をコピー/);
  assert.match(handoffSource, /let rendered = '';[\s\S]*navigator\.clipboard\.writeText\(rendered\)/);
  assert.match(handoffSource, /setCopyState\(\{ field, message, failed: true, rendered \}\)/);
  assert.match(handoffSource, /readOnly[\s\S]*value=\{copyState\.rendered\}/);
  assert.match(handoffSource, /fallbackTextareaRef\.current\?\.focus[\s\S]*fallbackTextareaRef\.current\?\.select/);
  assert.match(handoffSource, /限定URL・会話URL・セッションID・認証情報・生の非公開会話は自動挿入しません/);
  assert.match(handoffSource, /必要な一般公開URLは利用できます/);
  assert.match(handoffSource, /role="status" aria-live="polite"/);
  assert.match(handoffSource, /identityRef\.current !== identity/);
});
