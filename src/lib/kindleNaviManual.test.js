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
  '最初の10分でやること',
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

  assert.equal(KINDLE_NAVI_MANUAL_UPDATED_AT, '2026年8月6日');
  assert.equal(sections.length, 19);
  assert.deepEqual(sections.map(section => section.title), EXPECTED_TITLES);
  assert.deepEqual(
    sections.map(section => section.id),
    EXPECTED_TITLES.map((_, index) => `kindle-navi-manual-section-${index + 1}`),
  );
  assert.deepEqual(markdownHeadings.map(match => match[2]), EXPECTED_TITLES);
  assert.equal(new Set(sections.map(section => section.id)).size, 19);
  assert.equal(getKindleNaviManualSectionId('3. 最初の10分でやること'), 'kindle-navi-manual-section-3');
  assert.equal(getKindleNaviManualSectionId('最初の10分でやること'), undefined);
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
  assert.equal((manual.match(/^- \[ \] /gm) || []).length, 4);
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
  assert.match(manualComponentSource, /最初の10分で行う4ステップ/);
});
