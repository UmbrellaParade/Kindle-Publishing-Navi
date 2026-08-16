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

  assert.equal(KINDLE_NAVI_MANUAL_UPDATED_AT, '2026年8月17日');
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
    '7つの領域を使い分ける',
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
    'この章の原稿メモ',
    'メモのタイトル',
    'メモ本文',
    '質問から書き始める本だけでなく、書き出し案、必ず入れる体験、参考資料、注意点',
    '原稿メモのタイトルと本文は共有用JSON／Markdownにも含まれる',
    '以前に「この章の原稿を作る質問」として保存した内容は削除・移動せず',
    '親から子、子から親へ勝手に複製しません',
    '過去の目次履歴には後から変わったメモを重ねません',
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
    '「目次・章構成」** の該当カードにも **原稿メモ** として表示されます',
    'データを複製するのではなく同じ保存記録を参照',
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

  const chapterQuestionFaq = manual.match(/### 章ごとに質問以外のメモも残せますか？([\s\S]*?)(?=\n### |\n---|$)/)?.[1] || '';
  for (const phrase of [
    '仮目次',
    '現在の確定目次',
    '原稿メモを追加',
    'タイトルと本文を自由に入力',
    '以前に章へ紐づけた質問は削除されず',
    'メモ本文をコピー',
    '内容を見る',
    '過去の目次には現在のメモを重ねない',
  ]) {
    assert.equal(chapterQuestionFaq.includes(phrase), true, `不足している目次内質問FAQ: ${phrase}`);
  }
});

test('Kindle出版サポートGPTの世代管理と非公開範囲を初心者向けに案内する', () => {
  for (const phrase of [
    'Kindle本の相談や原稿づくりを同じGPTで続けると、会話がたまって動作が重くなることがあります。',
    '1セッション＝1件',
    '`GPT-001`、`GPT-002`',
    '現在使うセッションは **「使用中」**',
    '「GPTを開く」',
    '引継ぎ先ID',
    '「使用中」を先頭',
    '開始日の新しい順／古い順',
    'GPT管理ID、企画・作品名、セッション名、Kindle出版サポートGPT URL、担当範囲、状態、開始日、引継ぎ先ID、引継ぎメモ、備考',
    '当面の母艦として使うGoogleスプレッドシート',
    '自動同期は行わない',
    '重くなる前に移る目安',
    '移るときの3ステップ',
    '節目で現在地と未確定事項を引継ぎメモにまとめる',
    '新しいGPTを登録して前のGPTの引継ぎ先IDをつなぐ',
    '新しいGPTが内容を受領したら、そちらを「使用中」にする',
    '現在地／確定事項／未確定事項／原稿一覧／執筆ルール／次の一手',
    '共有用JSON／Markdownからは「Kindle出版サポートGPT 管理」全体を除外',
    'APIキー、パスワード、生の非公開会話は貼り付けず',
  ]) {
    assert.equal(manual.includes(phrase), true, `不足しているGPT管理案内: ${phrase}`);
  }

  const fieldOrder = [
    '1. GPT管理ID',
    '2. 企画・作品名',
    '3. セッション名',
    '4. Kindle出版サポートGPT URL',
    '5. 担当範囲',
    '6. 状態',
    '7. 開始日',
    '8. 引継ぎ先ID',
    '9. 引継ぎメモ',
    '10. 備考',
  ];
  let previousIndex = -1;
  fieldOrder.forEach(field => {
    const index = manual.indexOf(field);
    assert.ok(index > previousIndex, `GPT管理列の順番が違います: ${field}`);
    previousIndex = index;
  });

  const managerSection = manual.match(/### Kindle出版サポートGPTの会話を引き継ぐ([\s\S]*?)(?=\n### 市場調査の正本Markdownを取り込む)/)?.[1] || '';
  assert.match(managerSection, /競合・市場調査などの一般公開URL欄とは別の例外/);
  assert.match(managerSection, /同じブラウザ内と \*\*完全バックアップ\*\* にだけ保持/);

  const managerFaq = manual.match(/### Kindle出版サポートGPTの会話が重くなったら、どう引き継ぎますか？([\s\S]*?)(?=\n### |\n---|$)/)?.[1] || '';
  assert.match(managerFaq, /完全バックアップには入ります/);
  assert.match(managerFaq, /共有用JSON／Markdownからは管理画面全体が除外/);
  assert.match(managerFaq, /Googleスプレッドシートの「Kindle出版サポートGPT」タブとは自動同期しない/);
});

test('2段階引継ぎと辛口論評GPT管理を承認・非公開範囲まで案内する', () => {
  for (const phrase of [
    '2段階の引継ぎ文をコピーする',
    '前のGPTに引継ぎ書を作ってもらう文をコピー',
    '新しいGPTへ最初に貼る文をコピー',
    'コピーだけではGPTへ送信されません',
    '限定URL・会話URL・署名付きURL',
    '一般公開URLは必要な場合だけ内容を確認して利用できます',
    'コピーに失敗した場合は送信済みと考えず',
    '辛口論評GPTの会話を世代管理する',
    '`CRITIQUE-001`、`CRITIQUE-002`',
    '対象原稿版ID',
    '論評回',
    '使用中を先頭',
    '「使用中」は1件だけ',
    '新しいGPTが引継ぎ書を受領したことを確認してから',
    '論評結果や著者判断を保存する履歴とは別の台帳',
    '過去の論評、採否、原稿、目次は上書きされません',
    '完全バックアップ',
    '共有用JSON／Markdownから全体を除外',
    '著者本人が内容を確認し、承認してから',
  ]) {
    assert.equal(manual.includes(phrase), true, `不足しているGPT引継ぎ案内: ${phrase}`);
  }

  const critiqueFields = [
    '1. 論評GPT管理ID',
    '2. セッション名',
    '3. 辛口論評GPT URL',
    '4. 担当範囲',
    '5. 状態',
    '6. 開始日',
    '7. 対象原稿版ID',
    '8. 論評回',
    '9. 引継ぎ先ID',
    '10. 引継ぎメモ',
    '11. 備考',
  ];
  const critiqueSection = manual.match(/### 辛口論評GPTの会話を世代管理する([\s\S]*?)(?=\n### 1）先に)/)?.[1] || '';
  let previousIndex = -1;
  critiqueFields.forEach(field => {
    const index = critiqueSection.indexOf(field);
    assert.ok(index > previousIndex, `辛口論評GPT管理項目の順番が違います: ${field}`);
    previousIndex = index;
  });

  const critiqueFaq = manual.match(/### 辛口論評GPTの会話が重くなったら、どう引き継ぎますか？([\s\S]*?)(?=\n### |\n---|$)/)?.[1] || '';
  assert.match(critiqueFaq, /「保留」で登録/);
  assert.match(critiqueFaq, /論評履歴や著者判断は変わりません/);
  assert.match(critiqueFaq, /コピーや切替だけで論評内容は承認されません/);

  const privacySection = manual.match(/### 取材回答を非公開のまま守る([\s\S]*?)(?=\n### 保存容量と)/)?.[1] || '';
  assert.match(privacySection, /「Kindle出版サポートGPT 管理」全体/);
  assert.match(privacySection, /「辛口論評GPT 管理」全体/);
  assert.match(privacySection, /編集した引継ぎテンプレートも除外/);
  assert.match(privacySection, /Kindle出版サポートGPT管理と辛口論評GPT管理/);
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

test('目次の自動番号と一括開閉を既存データを守る形で説明する', () => {
  for (const phrase of [
    '自動番号とタイトルを分ける',
    '「第N部／第N章／第N話／第N節」',
    '項目の種類と現在の並び順から自動で決まる表示ラベル',
    '番号は同じ親の中で種類ごとに数える',
    '種類を「章」から「話」へ変えると表示も「第N話」へ切り替わります',
    '保存済みのタイトル、構成項目ID、階層、取材・指示書との紐づき',
    '保存内容を勝手に削除・上書きしません',
    '画面に出すときだけ先頭の番号部分と題名を分ける',
    '「詳細を折りたたむ」',
    'タイトル、種類、状態を残したまま',
    '折りたたんだ状態でも、見出しに残る **「原稿：未完成／完成」** のチェックから進捗を更新でき',
    '「原稿を開く／原稿リンクを設定・変更」',
    '親項目を閉じても中の部・章・話・節は消えない',
    '今選択している目次だけをまとめて折りたたむ',
    '「すべて折りたたむ」',
    '「すべて開く」',
    '過去の目次ではボタンを押した保存版だけが対象です',
    '仮目次で一括操作しても、現在の確定目次や過去の目次を勝手に開閉しません',
    '目次本文、完全バックアップ、共有用JSON／Markdownには入りません',
  ]) assert.equal(manual.includes(phrase), true, `不足している目次案内: ${phrase}`);
});

test('折りたたんだ目次カードから原稿完成を安全に更新できると説明する', () => {
  for (const phrase of [
    'カードを折りたたんでいるときも',
    '見出しの **「原稿：未完成／完成」** にチェックを付けたり外したりでき',
    'チェック後も折りたたみ状態を保つ',
    '詳細を開き直す必要はありません',
    '過去の目次履歴は当時の構成を守るため、折りたたんだ状態でも原稿進捗やリンクを変更できません',
    '過去の目次履歴は当時の状態を守るため、チェックを変更できません',
  ]) assert.equal(manual.includes(phrase), true, `不足している折りたたみ時の原稿進捗案内: ${phrase}`);
});

test('目次種類の一括変更を初心者向けに安全に説明する', () => {
  for (const phrase of [
    '同じ種類をまとめて変更する',
    '種類をまとめて変更',
    '部・章・話・節をまとめて変更',
    '現在の種類',
    '変更後の種類',
    '変更内容を確認',
    '対象／変更できる／停止・スキップ',
    '対象は **現在の仮目次だけ**',
    '確定目次、過去の目次、採用しない項目は変更しません',
    '選んだ種類に本人承認済みの項目が1件でも含まれる場合',
    '一括変更を停止しています',
    '何も変更しません',
    '構成項目ID、タイトル、順番、入っている場所、取材・指示書との紐づき',
    '以前の確定目次と過去の目次履歴も、その版を作ったときの種類のまま残ります',
    '第1章、第2章をまとめて第1話、第2話へ変えられますか？',
    '仮目次のN件を『話』へ変更',
  ]) assert.equal(manual.includes(phrase), true, `不足している種類一括変更の説明: ${phrase}`);
});

test('完成原稿の整形先を初心者向けに説明する', () => {
  for (const phrase of [
    '文章をゼロから書く場所ではなく',
    'しまうま出版向けのA5・A6印刷用PDF',
    'A6は一般的な文庫本サイズ',
    'URLからQRコード付きカードを作り、本文へ配置できる',
    'しまうま出版の公式・提携ツールではありません',
  ]) assert.equal(manual.includes(phrase), true, `不足している原稿整形案内: ${phrase}`);
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
