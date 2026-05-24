// フェーズ0〜3：Kindle本制作進捗タブ
export const CREATION_PHASES = [
  {
    id: 'phase0',
    label: 'フェーズ0：準備',
    color: 'cyan',
    tasks: [
      { id: 't01', title: '特典の「ロードマップ音声」を聴く', tool: '音声リンク', note_default: '全体像を把握する', important: false },
      { id: 't02', title: '3つのGemをGeminiにインストールする', tool: 'Gemリンク集', note_default: 'リンクを開いて保存', important: false },
    ],
  },
  {
    id: 'phase1',
    label: 'フェーズ1：企画・執筆',
    color: 'pink',
    tasks: [
      { id: 't11', title: 'Gemに挨拶し、自分の過去の文章を貼って「文体」を学習させる', tool: 'THE Kindle出版サポートGem', note_default: 'ブログやnoteなど', important: false },
      { id: 't12', title: '書きたいテーマをGemに伝え、市場調査（穴場探し）を行う', tool: 'THE Kindle出版サポートGem', note_default: '競合の不満点を探す', important: false },
      { id: 't13', title: 'Gemが提案した目次構成を確認・決定する', tool: 'THE Kindle出版サポートGem', note_default: '', important: false },
      { id: 't14', title: 'Gemからのインタビューに答えながら、1章ずつ執筆を進める', tool: 'THE Kindle出版サポートGem', note_default: 'エピソードを箇条書きで渡す', important: true },
      { id: 't15', title: '全章書き終わったら、自分で通読して微修正する', tool: 'Googleドキュメント等', note_default: '', important: false },
      { id: 't16', title: '書籍説明文（あらすじ）とキーワードを出力させる', tool: 'THE Kindle出版サポートGem', note_default: 'KDP登録時に使用', important: false },
    ],
  },
  {
    id: 'phase2',
    label: 'フェーズ2：価格',
    color: 'amber',
    tasks: [
      { id: 't21', title: '原稿をGemに読み込ませ、コンセプト（誰に・何を・どうなる）を伝える', tool: 'Kindle辛口論評Gem', note_default: '', important: false },
      { id: 't22', title: '「価格の制限要因」と「判定」を確認し、修正か進行か決断する', tool: 'Kindle辛口論評Gem', note_default: '過大評価なら修正', important: false },
      { id: 't23', title: '推奨価格を決定する', tool: 'Kindle辛口論評Gem', note_default: '499円〜800円目安', important: false },
    ],
  },
  {
    id: 'phase3',
    label: 'フェーズ3：表紙作成',
    color: 'pink',
    tasks: [
      { id: 't31', title: '原稿の内容を伝え、画像生成プロンプトを出力させる', tool: 'Kindle専用表紙作成Gem', note_default: '', important: false },
      { id: 't32', title: '別のウィンドウでGeminiを開き、プロンプトを貼って画像を生成', tool: 'Gemini (Nano Banana Pro)', note_default: '何度か試行する', important: false },
      { id: 't33', title: 'Canvaで画像を読み込み、帯の文字入れを行う', tool: 'Canva', note_default: '文字サイズは1.5倍意識', important: false },
      { id: 't34', title: '【フォント確認】ゴシックなら「Noto Sans JP」、明朝なら「Shippori Mincho」等を使用', tool: 'Canva', note_default: '素人感を出さない', important: false },
    ],
  },
];

// フェーズ4：KDP登録進捗タブ
export const KDP_PHASES = [
  {
    id: 'phase4',
    label: 'フェーズ4：KDP登録',
    color: 'cyan',
    tasks: [
      { id: 't41', title: 'KDPにログインし「タイトルの新規作成」', tool: 'KDP公式サイト', note_default: '', important: false },
      { id: 't42', title: '本の詳細（タイトル、著者名、内容紹介など）を入力', tool: 'Gem1の出力をコピペ', note_default: '', important: false },
      { id: 't43', title: 'カテゴリーとキーワード（7つ）を設定', tool: 'Gem1の出力をコピペ', note_default: '', important: false },
      { id: 't44', title: '原稿と表紙ファイルをアップロードする', tool: 'KDP編集画面', note_default: '', important: false },
      { id: 't45', title: 'AI生成コンテンツの申告（「はい」→「Gemini」と入力）', tool: 'KDP編集画面', note_default: '', important: false },
      { id: 't46', title: 'プレビューアーで表示崩れがないか確認', tool: 'KDP編集画面', note_default: '', important: false },
      { id: 't47', title: 'KDPセレクトに登録する', tool: 'KDP価格設定画面', note_default: '必ずチェック', important: true },
      { id: 't48', title: 'ロイヤリティ「70%」を選択し、決定した価格を入力', tool: 'KDP価格設定画面', note_default: '', important: false },
      { id: 't49', title: '「Kindle本を出版」ボタンを押す', tool: 'KDP', note_default: '審査待ち（約48時間）', important: false },
    ],
  },
];

// フェーズ5：プロモーション進捗タブ
export const PROMO_PHASES = [
  {
    id: 'phase5',
    label: 'フェーズ5：プロモーション',
    color: 'amber',
    tasks: [
      { id: 't51', title: '【事前】Kindle作家仲間をフォロー・応援（ギブ）しておく', tool: 'X (Twitter)', note_default: '普段からやっておく', important: false },
      { id: 't52', title: '【3週間前〜】執筆中の悩みや進捗をポスト（匂わせ）', tool: 'X (Twitter)', note_default: '', important: false },
      { id: 't53', title: '【1週間前】タイトルを発表する', tool: 'X (Twitter)', note_default: '', important: false },
      { id: 't54', title: '【4日前】表紙デザインを公開する', tool: 'X (Twitter)', note_default: '', important: false },
      { id: 't55', title: '【発売日】99円キャンペーン（または無料）を開始し、告知する', tool: 'X (Twitter)', note_default: '初速をつける', important: false },
      { id: 't56', title: '読者からのレビューを確認し、感謝のポストをする', tool: 'X (Twitter)', note_default: '', important: false },
    ],
  },
];

export const ALL_CREATION_IDS = CREATION_PHASES.flatMap(p => p.tasks.map(t => t.id));
export const ALL_KDP_IDS = KDP_PHASES.flatMap(p => p.tasks.map(t => t.id));
export const ALL_PROMO_IDS = PROMO_PHASES.flatMap(p => p.tasks.map(t => t.id));

export function buildInitialChecklistData() {
  const data = {};
  [...CREATION_PHASES, ...KDP_PHASES, ...PROMO_PHASES].forEach(phase => {
    phase.tasks.forEach(task => {
      data[task.id] = { is_done: false, due_date: '', note: task.note_default || '' };
    });
  });
  return data;
}