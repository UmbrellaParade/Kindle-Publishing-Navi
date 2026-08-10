import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getKindleNaviManualSectionId,
  KINDLE_NAVI_MANUAL_GROUPS,
  KINDLE_NAVI_MANUAL_UPDATED_AT,
} from './kindleNaviManual.js';

const manual = readFileSync(
  new URL('../content/kindleNaviManual.md', import.meta.url),
  'utf8',
);

const homeSource = readFileSync(
  new URL('../pages/Home.jsx', import.meta.url),
  'utf8',
);

const manualComponentSource = readFileSync(
  new URL('../components/tabs/KindleNaviManualTab.jsx', import.meta.url),
  'utf8',
);

const EXPECTED_TITLES = [
  'このマニュアルの使い方',
  'ゴリアスさんの教材・スプレッドシートとの関係',
  '発売目標日から始める初回ガイド',
  '出版までのおすすめ順',
  '画面上部と自動保存',
  'Kindle本制作進捗',
  'KDP登録進捗',
  'カテゴリーチェック',
  'プロモーション戦略メモ',
  'KDP書籍説明文',
  '表紙＆A+コンテンツ',
  'Kindle原稿作成ガイド',
  'Kindle原稿整形ツール（テスト版）',
  '辛口論評',
  '保存・バックアップ・復元',
  'パソコンとスマホ・アップデート',
  '出版後の展開を残す',
  'よくある質問',
  '初回チェックリスト',
];

test('出版ナビの初心者マニュアルは全19章を安定IDで案内する', () => {
  const sections = KINDLE_NAVI_MANUAL_GROUPS.flatMap(group => group.sections);
  const markdownHeadings = [...manual.matchAll(/^## (\d+)\. (.+)$/gm)];

  assert.equal(KINDLE_NAVI_MANUAL_UPDATED_AT, '2026年8月10日');
  assert.equal(sections.length, 19);
  assert.deepEqual(sections.map(section => section.title), EXPECTED_TITLES);
  assert.deepEqual(
    sections.map(section => section.id),
    EXPECTED_TITLES.map((_, index) => `kindle-navi-manual-section-${index + 1}`),
  );
  assert.deepEqual(markdownHeadings.map(match => match[2]), EXPECTED_TITLES);
  assert.equal(new Set(sections.map(section => section.id)).size, 19);
  assert.equal(getKindleNaviManualSectionId('3. 発売目標日から始める初回ガイド'), 'kindle-navi-manual-section-3');
  assert.equal(getKindleNaviManualSectionId('発売目標日から始める初回ガイド'), undefined);
});

test('教材との内容連携と自動同期ではないことを誤解なく説明する', () => {
  const requiredPhrases = [
    '出版フロー30項目と備考メモ15件の要点',
    '一般の方も進めやすいように工程を32項目へ整理',
    '「連携」は内容・工程の連携です。',
    'Googleスプレッドシートとのリアルタイム同期ではありません。',
    'このナビの入力もシートへ書き戻されません。',
    '教材側のリンクから開きます。',
  ];

  requiredPhrases.forEach(phrase => {
    assert.equal(manual.includes(phrase), true, `不足している説明: ${phrase}`);
  });
});

test('初めての利用者が開始からバックアップまで迷わず進められる', () => {
  const requiredPhrases = [
    '「＋」',
    '発売目標日から逆算',
    '「逆算して設定」',
    'フェーズ0：準備',
    '「データ管理」→「バックアップをダウンロード」',
    '別のパソコンやスマートフォンで開く',
    '「結合して復元」',
    '「すべて置き換える」',
    '同じプロジェクトを複数タブで同時編集',
    '更新前にバックアップ',
  ];

  requiredPhrases.forEach(phrase => {
    assert.equal(manual.includes(phrase), true, `不足している初心者案内: ${phrase}`);
  });
  assert.equal(manual.includes('一度に全部終わらせる必要はありません'), true);
  assert.equal(manual.includes('最初に決めるのは発売目標日です。'), true);
  assert.equal(manual.includes('初日は発売目標日から逆算するところまで'), true);
  assert.equal(manual.includes('最初の10分でやること'), false);
  const firstGuide = manual.match(/## 3\. 発売目標日から始める初回ガイド([\s\S]*?)\n---/)?.[1] || '';
  const firstGuideHeadings = [...firstGuide.matchAll(/^### (.+)$/gm)].map(match => match[1]);
  assert.deepEqual(firstGuideHeadings, [
    '初回準備：本の保存先を作る',
    'STEP 1：発売目標日から逆算する',
    'STEP 2：フェーズ0の最初の1項目を確認する',
    '安全のため：最初のバックアップを取る',
  ]);
  assert.ok(firstGuide.indexOf('発売目標日から逆算する') < firstGuide.indexOf('フェーズ0の最初の1項目'));
  assert.equal((manual.match(/^- \[ \] /gm) || []).length, 4);
});

test('辛口論評を本の前提から小さな修正まで初心者向けに案内する', () => {
  const requiredPhrases = [
    '誰に向けた本か',
    '何を伝える本か',
    '読後にどう変わってほしいか',
    '予定している価格',
    '出版の目的',
    '最終章のタイトル',
    '最後の一文',
    '必ず直す',
    '読者確認',
    '著者判断',
    '見送る',
    '1〜3件',
    '目次の重複',
    '誤字脱字',
    '具体的な1件を最初に直します',
    '不要な修正を作る必要はありません',
    'ハードゲート',
    '読者へ伝わる本にすることが目的',
    '前の原稿へ戻す',
    '外部へ自動送信しません',
  ];

  requiredPhrases.forEach(phrase => {
    assert.equal(manual.includes(phrase), true, `不足している辛口論評の説明: ${phrase}`);
  });
});

test('現行9機能と外部操作・KDP最新確認の注意をすべて案内する', () => {
  const featureNames = [
    'Kindle本制作進捗',
    'KDP登録進捗',
    'カテゴリーチェック',
    'プロモーション戦略メモ',
    'KDP書籍説明文',
    '表紙＆A+コンテンツ',
    'Kindle原稿作成ガイド',
    'Kindle原稿整形ツール（テスト版）',
    '辛口論評',
  ];

  featureNames.forEach(name => assert.equal(manual.includes(name), true, `不足している機能: ${name}`));
  assert.equal(manual.includes('KDPへの登録や提出そのものはAmazon KDPで行います。'), true);
  assert.equal(manual.includes('SNSへ自動投稿はしません。'), true);
  assert.equal(manual.includes('KDP公式画面と公式ヘルプの最新表示で確認してください。'), true);
});

test('使い方マニュアルはナビ先頭にあり、プロジェクト0件では自動表示する', () => {
  const tabBlock = homeSource.match(/const TABS = \[([\s\S]*?)\];/)?.[1] || '';
  assert.match(tabBlock.trimStart(), /^\{ id: 'manual',\s+label: '使い方マニュアル' \}/);
  assert.match(homeSource, /else \{\s*setActiveTab\('manual'\);\s*\}/);
  assert.match(homeSource, /activeTab === 'manual'[\s\S]*?<KindleNaviManualTab/);
});

test('マニュアルから現行9機能と初回4ステップへ移動できる', () => {
  const featureIds = ['creation', 'kdp', 'category', 'promo', 'description', 'aplus', 'format', 'formatter', 'critique'];
  featureIds.forEach(id => {
    assert.match(manualComponentSource, new RegExp(`\\{ id: '${id}',`), `${id} への導線がありません`);
  });

  assert.match(manualComponentSource, /onCreateProject/);
  assert.match(manualComponentSource, /onOpenSchedule/);
  assert.match(manualComponentSource, /data-management-trigger/);
  assert.match(manualComponentSource, /発売目標日から始める初回ガイド/);
  assert.match(manualComponentSource, /この4つは一度に終わらせなくて大丈夫です/);
  assert.match(manualComponentSource, /ここが実質的なスタートです/);
  assert.match(manualComponentSource, /初回準備[\s\S]*STEP 1[\s\S]*発売目標日から逆算/);
  assert.match(manualComponentSource, /この本は準備済み/);
  assert.doesNotMatch(manualComponentSource, /最初の10分で行う4ステップ/);
  assert.match(manual, /スマートフォンでは \*\*「機能一覧（10）」\*\* を押す/);
  assert.doesNotMatch(manual, /メニューを横へスワイプ/);
});
