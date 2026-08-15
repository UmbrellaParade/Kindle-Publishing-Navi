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
  '仮日または発売目標日から始める初回ガイド',
  '出版までのおすすめ順',
  '画面上部と自動保存',
  'Kindle本制作進捗',
  '企画・取材・構成ノート',
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

test('出版ナビの初心者マニュアルは全20章を安定IDで案内する', () => {
  const sections = KINDLE_NAVI_MANUAL_GROUPS.flatMap(group => group.sections);
  const markdownHeadings = [...manual.matchAll(/^## (\d+)\. (.+)$/gm)];

  assert.equal(KINDLE_NAVI_MANUAL_UPDATED_AT, '2026年8月15日');
  assert.equal(sections.length, 20);
  assert.deepEqual(sections.map(section => section.title), EXPECTED_TITLES);
  assert.deepEqual(
    sections.map(section => section.id),
    EXPECTED_TITLES.map((_, index) => `kindle-navi-manual-section-${index + 1}`),
  );
  assert.deepEqual(markdownHeadings.map(match => match[2]), EXPECTED_TITLES);
  assert.equal(new Set(sections.map(section => section.id)).size, 20);
  assert.equal(getKindleNaviManualSectionId('3. 仮日または発売目標日から始める初回ガイド'), 'kindle-navi-manual-section-3');
  assert.equal(getKindleNaviManualSectionId('仮日または発売目標日から始める初回ガイド'), undefined);
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
    '仮リリース日または発売目標日から逆算',
    '「1か月後を仮設定」',
    '「この仮日で逆算」',
    '「正式日で逆算して設定」',
    'フェーズ0：準備',
    '「データ管理」→「バックアップをダウンロード」',
    '「○○（仮）」',
    '「名前を変更」',
    'KDPへ登録する正式な書名は変わりません',
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
  assert.equal(manual.includes('正式な発売目標日がまだ決まらなくても大丈夫です。'), true);
  assert.equal(manual.includes('初日は仮日または正式日から逆算するところまで'), true);
  assert.equal(manual.includes('最初の10分でやること'), false);
  const firstGuide = manual.match(/## 3\. 仮日または発売目標日から始める初回ガイド([\s\S]*?)\n---/)?.[1] || '';
  const firstGuideHeadings = [...firstGuide.matchAll(/^### (.+)$/gm)].map(match => match[1]);
  assert.deepEqual(firstGuideHeadings, [
    '初回準備：本の保存先を作る',
    'STEP 1：仮リリース日または発売目標日から逆算する',
    'STEP 2：フェーズ0の最初の1項目を確認する',
    '安全のため：最初のバックアップを取る',
  ]);
  assert.ok(firstGuide.indexOf('仮リリース日または発売目標日から逆算する') < firstGuide.indexOf('フェーズ0の最初の1項目'));
  assert.match(firstGuide, /仮リリース日[\s\S]*発売目標日（正式）[\s\S]*KDPの発売日・予約注文/);
  assert.match(firstGuide, /日付欄を変えただけでは保存・逆算されない/);
  assert.equal((manual.match(/^- \[ \] /gm) || []).length, 4);
  [
    '発売目標日だけ未設定に戻す',
    '仮日だけ未設定に戻す',
    '自動入力した日程だけ消す',
    '手動日を含むすべての日程を消す',
    '二段階の強い確認',
  ].forEach(phrase => assert.equal(manual.includes(phrase), true, `不足している日付リセット案内: ${phrase}`));
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

test('企画・取材・構成ノートを初心者が安全に使えるよう案内する', () => {
  const requiredPhrases = [
    '最初の1件を保存する',
    '企画メモを書く',
    '目次の構成を作る',
    '取材を1問記録',
    '6つの領域を使い分ける',
    '部・章・話・節を階層で作り',
    '第一部 ＞ 第一話／第二話 ＞ 第一節',
    '構成項目ID',
    'この中に追加',
    '仮目次から始め、確定目次と履歴を残す',
    '仮目次（編集中）',
    '確定目次（現在使う読み取り専用版）',
    '過去の目次履歴',
    '今の仮目次を履歴に保存',
    'この仮目次を確定目次にする',
    '目次全体を削除せずに書き直す',
    '目次を書き直す',
    'Codexの目次Markdownを貼り付ける',
    '空の仮目次から始める',
    '貼り付けただけでは保存されません',
    '旧目次の項目への参照',
    '旧リンクを新しい章へ勝手に付け替えることはありません',
    '取材記録、本人承認済みの項目、現在の確定目次、過去の目次履歴は消えません',
    '各項目が自動で「本人承認済み」になるわけではありません',
    '部・章・話・節ごとに原稿の完成と原稿リンクを管理する',
    '原稿を書き終えた',
    '原稿リンクを設定',
    'この話の原稿を作る質問',
    '目次カードは執筆時にすぐ使う場所',
    '親の部へ紐づけた質問を子の話へ自動表示したり、子の質問を親へ自動集約したりはしません',
    '過去の目次履歴には後から変わった質問を重ねません',
    'Googleドキュメント、Notion、OneDrive、Dropbox',
    '［ファイル］→［ページ設定］',
    '用紙サイズを **A5（14.8×21.0cm）** にしておくのがおすすめ',
    'これはKDP電子書籍の指定ではありません',
    '通常のKindle電子書籍は端末や文字設定に合わせて表示が組み直される',
    '電子版はKindle Previewerで確認',
    '後からA5判の紙の本へ展開するときの下準備にも便利',
    '紙版は入稿先の判型・余白・裁ち落とし仕様へ別途調整',
    '目次全体の確定や、各項目の本人承認とは別',
    '確定目次は目次本文を誤って変えないため読み取り専用',
    '共有用JSON／Markdownには原稿完成の状態を含めますが、原稿URLは含めません',
    '旧目次を勝手に確定しません',
    '案と承認版を分ける',
    '本人承認済み',
    '承認版を残して新しい案',
    '新しい版',
    '確認済み／仮説／著者の実感',
    '市場調査サマリー',
    '正本を読み込む',
    'この差分を追加',
    'Codexが最初に見る正本',
    '著者が最初に見る正本',
    '「正本」と「最新」は別',
    '各カードまたは **「内容を見る」** の **「質問文をコピー」**',
    '指示書本文（Markdown）だけ',
    '指示書名、版ID、状態、変更概要、外部ファイルの所在、目次との紐づけは含まれません',
    '「目次・章構成」** の該当カードにも同じ質問が表示されます',
    '質問データを複製するのではなく同じ保存記録を参照',
    '現在の判断・正本（まずここを見る）',
    '変更履歴（最新が上）',
    '価格帯、ランキング、検索需要、カテゴリー規模',
    'ログイン限定・期限付きの共有限定URL',
    '公開候補',
    '共有用JSON',
    '共有用Markdown',
    '非公開取材',
    '約700KB',
    '約2MB',
    '一般形式のJSON自動取込',
    '任意の資料Markdownの自動取込',
    '目次の書き直しでは画面で案内する形式の目次Markdownをプレビュー',
    '添付ファイル本体の保存',
    '旧バックアップに企画ノートがなくても',
  ];

  requiredPhrases.forEach(phrase => {
    assert.equal(manual.includes(phrase), true, `不足している企画ノートの説明: ${phrase}`);
  });

  const rewriteFaq = manual.match(/### 目次を全部書き直すには、紐づく取材を一つずつ外す必要がありますか？([\s\S]*?)(?=\n### |\n---|$)/)?.[1] || '';
  for (const phrase of [
    '必要ありません',
    'プレビュー後に一度の操作で新しい仮目次へ切り替えられます',
    '旧目次参照',
    '取材、承認済み項目、現在の確定目次、過去の履歴は削除されません',
    '別途、確定操作',
  ]) {
    assert.equal(rewriteFaq.includes(phrase), true, `不足している目次書き直しFAQ: ${phrase}`);
  }

  const copyFaq = manual.match(/### 質問文だけを新しいChatGPTへ貼り付けるには？([\s\S]*?)(?=\n### |\n---|$)/)?.[1] || '';
  for (const phrase of [
    '「質問文をコピー」',
    'カードからでも「内容を見る」の詳細画面からでもコピーできます',
    'コピーされるのは指示書本文だけ',
    '版ID、状態、外部ファイルの所在などの管理情報は入りません',
    'APIキー・認証情報・非公開会話URLらしき文字列',
  ]) {
    assert.equal(copyFaq.includes(phrase), true, `不足している質問文コピーFAQ: ${phrase}`);
  }

  const chapterQuestionFaq = manual.match(/### 章ごとの質問は、毎回「執筆設計・GPTs指示書」を開かないと使えませんか？([\s\S]*?)(?=\n### |\n---|$)/)?.[1] || '';
  for (const phrase of [
    '仮目次',
    '現在の確定目次',
    '質問文をコピー',
    '内容を見る',
    '過去の目次には現在の質問を重ねない',
  ]) {
    assert.equal(chapterQuestionFaq.includes(phrase), true, `不足している目次内質問FAQ: ${phrase}`);
  }
});

test('現行10機能と外部操作・KDP最新確認の注意をすべて案内する', () => {
  const featureNames = [
    'Kindle本制作進捗',
    '企画・取材・構成ノート',
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

test('目次の折りたたみと完成原稿の整形先を初心者向けに説明する', () => {
  for (const phrase of [
    '「詳細を折りたたむ」',
    'タイトル、種類、状態、原稿の完成状況を残したまま',
    '親項目を閉じても中の部・章・話・節は消えない',
    '文章をゼロから書く場所ではなく',
    'しまうま出版向けのA5・A6印刷用PDF',
    'A6は一般的な文庫本サイズ',
    'URLからQRコード付きカードを作り、本文へ配置できる',
    'しまうま出版の公式・提携ツールではありません',
  ]) assert.equal(manual.includes(phrase), true, `不足している案内: ${phrase}`);
});

test('使い方マニュアルはナビ先頭にあり、プロジェクト0件では自動表示する', () => {
  const tabBlock = homeSource.match(/const TABS = \[([\s\S]*?)\];/)?.[1] || '';
  assert.match(tabBlock.trimStart(), /^\{ id: 'manual',\s+label: '使い方マニュアル' \}/);
  assert.match(homeSource, /resolveViewResumeState\(initialViewResumeState, list/);
  assert.match(homeSource, /setActiveTab\(resolved\.mainTab\)/);
  assert.match(homeSource, /activeTab === 'manual'[\s\S]*?<KindleNaviManualTab/);
});

test('同じブラウザでは前回の閲覧位置へ安全に戻り、共有データへ混ぜない', () => {
  for (const phrase of [
    '最後に見ていた本',
    '近いスクロール位置から再開します',
    '前回の続きから再開しました',
    '完全バックアップ、共有用JSON／Markdownには入りません',
    '入力途中でまだ保存していない文章',
    '別の画面を指定したURLで開いた場合は、そのURLを優先します',
  ]) {
    assert.match(manual, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('マニュアルから現行10機能と初回4ステップへ移動できる', () => {
  const featureIds = ['creation', 'notes', 'kdp', 'category', 'promo', 'description', 'aplus', 'format', 'formatter', 'critique'];
  featureIds.forEach(id => {
    assert.match(manualComponentSource, new RegExp(`\\{ id: '${id}',`), `${id} への導線がありません`);
  });

  assert.match(manualComponentSource, /onCreateProject/);
  assert.match(manualComponentSource, /onOpenSchedule/);
  assert.match(manualComponentSource, /data-management-trigger/);
  assert.match(manualComponentSource, /仮日または発売目標日から始める初回ガイド/);
  assert.match(manualComponentSource, /この4つは一度に終わらせなくて大丈夫です/);
  assert.match(manualComponentSource, /ここが実質的なスタートです/);
  assert.match(manualComponentSource, /初回準備[\s\S]*STEP 1[\s\S]*仮日または正式日から逆算/);
  assert.match(manualComponentSource, /正式な発売日が決まっていなければ、まず1か月後を仮日にして進められます/);
  assert.match(manualComponentSource, /発売日程を設定する/);
  assert.match(manualComponentSource, /この本は準備済み/);
  assert.match(manualComponentSource, /仮タイトルでも大丈夫です/);
  assert.doesNotMatch(manualComponentSource, /最初の10分で行う4ステップ/);
  assert.match(manual, /スマートフォンでは \*\*「機能一覧（11）」\*\* を押す/);
  assert.doesNotMatch(manual, /メニューを横へスワイプ/);
});
