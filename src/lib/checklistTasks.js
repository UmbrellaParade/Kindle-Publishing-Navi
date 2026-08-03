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
      { id: 't23', title: '読者・内容・競合を踏まえて希望小売価格を決定する', tool: 'Kindle辛口論評Gem / KDP最新要件', note_default: '参考価格帯の一例は499〜800円。固定の正解ではないため、読者・内容・競合とKDPの最新条件を確認', important: false },
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
      { id: 't40', title: 'KDPアカウントの本人情報・税務・支払設定と、配信方法を確認する', tool: 'KDPアカウント / 配信日オプション', note_default: '初出版の場合は早めに準備。発売日を指定する電子書籍は予約注文を確認', important: true },
      { id: 't41', title: 'KDPにログインし「タイトルの新規作成」', tool: 'KDP公式サイト', note_default: '', important: false },
      { id: 't42', title: '本の詳細（タイトル、著者名、内容紹介など）を入力', tool: 'Gem1の出力をコピペ', note_default: '', important: false },
      { id: 't43a', title: '内容に合うカテゴリー候補（最大3つ）を設定', tool: 'カテゴリーチェック / KDP公式画面', note_default: '関連性を優先し、KDP画面で最終確認', important: false },
      { id: 't43b', title: '内容に合う検索キーワード（最大7つ）を設定', tool: '企画メモ / KDP公式画面', note_default: '読者が検索する具体的な語句を選ぶ', important: false },
      { id: 't44', title: '原稿と表紙ファイルをアップロードする', tool: 'KDP編集画面', note_default: '', important: false },
      { id: 't45', title: 'AI生成コンテンツを使用した場合は、KDPの質問に正確に回答する', tool: 'KDP編集画面', note_default: '使用ツールと該当範囲を確認。未使用なら画面の案内に従う', important: false },
      { id: 't46', title: 'プレビューアーで表示崩れがないか確認', tool: 'KDP編集画面', note_default: '', important: false },
      { id: 't47', title: 'KDPセレクトへ登録するか判断する（任意）', tool: 'KDP価格設定画面', note_default: 'KDPセレクトは必須ではありません。90日間の電子書籍独占など最新条件を確認し、販売方針に合う場合に選ぶ', important: false },
      { id: 't48', title: '35% / 70%の適用条件を確認し、ロイヤリティと価格を設定する', tool: 'KDP価格設定画面', note_default: '価格帯・販売地域・KDPセレクト等の最新条件を確認', important: false },
      { id: 't49', title: '内容を最終確認し、選んだ配信方法に合わせて審査へ提出する', tool: 'KDP', note_default: '予約注文は「予約注文用に提出」、今すぐ配信は「Kindle本を出版」。審査・反映時間は変動するため、期限より余裕を持って提出', important: true },
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
      { id: 't51', title: '【事前】読者や著者仲間と日頃から交流し、役立つ発信をする', tool: '利用するSNS / ブログ / メルマガ', note_default: '発売直前だけでなく普段から。無理のない媒体で、役立つ交流を続ける', important: false },
      { id: 't52', title: '【3週間前〜】制作の背景や進捗、読者に役立つ内容を発信する', tool: '利用する発信媒体', note_default: '', important: false },
      { id: 't53', title: '【1週間前】タイトル・発売予定日・対象読者を案内する', tool: '利用する発信媒体', note_default: '', important: false },
      { id: 't54', title: '【4日前】表紙と本の内容を紹介する', tool: '利用する発信媒体', note_default: '', important: false },
      { id: 't55', title: '【発売日】発売を案内し、設定したキャンペーンがあれば開始する', tool: '利用する発信媒体 / KDP', note_default: '発売直後の認知を後押しする。値下げ・無料施策は任意で、KDPの適用条件を確認', important: false },
      { id: 't56', title: '読者の感想を確認し、感謝と今後に役立つ情報を発信する', tool: '利用する発信媒体', note_default: '', important: false },
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
