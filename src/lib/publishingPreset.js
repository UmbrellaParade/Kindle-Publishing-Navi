export const GORIAS_PRESET_ITEMS = [
  // 準備
  { id: 'p1', category: '準備', title: '特典の「ロードマップ音声」を聴く', tool: '音声リンク', link: '', is_done: false, note: '', is_important: false },
  { id: 'p2', category: '準備', title: '3つのGemをGeminiにインストールする', tool: 'Gemリンク集', link: '', is_done: false, note: '', is_important: false },
  { id: 'p3', category: '準備', title: 'Gemに挨拶し、自分の過去の文章を貼って「文体」を学習させる', tool: 'THE Kindle出版サポートGem', link: '', is_done: false, note: '', is_important: false },
  // 執筆
  { id: 'w1', category: '執筆', title: '書きたいテーマをGemに伝え、市場調査（穴場探し）を行う', tool: 'THE Kindle出版サポートGem', link: '', is_done: false, note: '', is_important: false },
  { id: 'w2', category: '執筆', title: 'Gemが提案した目次構成を確認・決定する', tool: 'THE Kindle出版サポートGem', link: '', is_done: false, note: '', is_important: false },
  { id: 'w3', category: '執筆', title: 'Gemからのインタビューに答えながら、1章ずつ執筆を進める', tool: 'THE Kindle出版サポートGem', link: '', is_done: false, note: '', is_important: true },
  { id: 'w4', category: '執筆', title: '全章書き終わったら、自分で通読して微修正する', tool: 'Googleドキュメント等', link: '', is_done: false, note: '', is_important: false },
  { id: 'w5', category: '執筆', title: '書籍説明文（あらすじ）とキーワードを出力させる', tool: 'THE Kindle出版サポートGem', link: '', is_done: false, note: '', is_important: false },
  // 出版査定
  { id: 'a1', category: '出版査定', title: '原稿をGemに読み込ませ、コンセプト（誰に・何を・どうなる）を伝える', tool: 'Kindle辛口論評Gem', link: '', is_done: false, note: '', is_important: false },
  { id: 'a2', category: '出版査定', title: '「価格の制限要因」と「判定」を確認し、修正か進行か決断する', tool: 'Kindle辛口論評Gem', link: '', is_done: false, note: '', is_important: false },
  { id: 'a3', category: '出版査定', title: '推奨価格を決定する', tool: 'Kindle辛口論評Gem', link: '', is_done: false, note: '', is_important: false },
  // 表紙制作
  { id: 'c1', category: '表紙制作', title: '原稿の内容を伝え、画像生成プロンプトを出力させる', tool: 'Kindle専用表紙作成Gem', link: '', is_done: false, note: '', is_important: false },
  { id: 'c2', category: '表紙制作', title: '別のウィンドウでGeminiを開き、プロンプトを貼って画像を生成', tool: 'Gemini (Nano Banana Pro)', link: '', is_done: false, note: '', is_important: false },
  { id: 'c3', category: '表紙制作', title: 'Canvaで画像を読み込み、帯の文字入れを行う', tool: 'Canva', link: 'https://canva.com', is_done: false, note: '', is_important: false },
  { id: 'c4', category: '表紙制作', title: '【フォント確認】ゴシックなら「Noto Sans JP」、明朝なら「Shippori Mincho」等を使用', tool: 'Canva', link: '', is_done: false, note: '', is_important: false },
  // KDP入稿
  { id: 'k1', category: 'KDP入稿', title: 'KDPにログインし「タイトルの新規作成」', tool: 'KDP公式サイト', link: 'https://kdp.amazon.co.jp', is_done: false, note: '', is_important: false },
  { id: 'k2', category: 'KDP入稿', title: '本の詳細（タイトル、著者名、内容紹介など）を入力', tool: 'Gem1の出力をコピペ', link: '', is_done: false, note: '', is_important: false },
  { id: 'k3', category: 'KDP入稿', title: 'カテゴリーとキーワード（7つ）を設定', tool: 'Gem1の出力をコピペ', link: '', is_done: false, note: '', is_important: false },
  { id: 'k4', category: 'KDP入稿', title: '原稿と表紙ファイルをアップロードする', tool: 'KDP編集画面', link: '', is_done: false, note: '', is_important: false },
  { id: 'k5', category: 'KDP入稿', title: 'AI生成コンテンツの申告（「はい」→「Gemini」と入力）', tool: 'KDP編集画面', link: '', is_done: false, note: '', is_important: false },
  { id: 'k6', category: 'KDP入稿', title: 'プレビューアーで表示崩れがないか確認', tool: 'KDP編集画面', link: '', is_done: false, note: '', is_important: false },
  { id: 'k7', category: 'KDP入稿', title: 'KDPセレクトに登録する', tool: 'KDP価格設定画面', link: '', is_done: false, note: '', is_important: true },
  { id: 'k8', category: 'KDP入稿', title: 'ロイヤリティ「70%」を選択し、決定した価格を入力', tool: 'KDP価格設定画面', link: '', is_done: false, note: '', is_important: false },
  { id: 'k9', category: 'KDP入稿', title: '「Kindle本を出版」ボタンを押す', tool: 'KDP', link: '', is_done: false, note: '', is_important: false },
  // SNSプロモーション
  { id: 's1', category: 'SNSプロモーション', title: '【事前】Kindle作家仲間をフォロー・応援（ギブ）しておく', tool: 'X (Twitter)', link: '', is_done: false, note: '', is_important: false },
  { id: 's2', category: 'SNSプロモーション', title: '【3週間前〜】執筆中の悩みや進捗をポスト（匂わせ）', tool: 'X (Twitter)', link: '', is_done: false, note: '', is_important: false },
  { id: 's3', category: 'SNSプロモーション', title: '【1週間前】タイトルを発表する', tool: 'X (Twitter)', link: '', is_done: false, note: '', is_important: false },
  { id: 's4', category: 'SNSプロモーション', title: '【4日前】表紙デザインを公開する', tool: 'X (Twitter)', link: '', is_done: false, note: '', is_important: false },
  { id: 's5', category: 'SNSプロモーション', title: '【発売日】99円キャンペーン（または無料）を開始し、告知する', tool: 'X (Twitter)', link: '', is_done: false, note: '', is_important: false },
  { id: 's6', category: 'SNSプロモーション', title: '読者からのレビューを確認し、感謝のポストをする', tool: 'X (Twitter)', link: '', is_done: false, note: '', is_important: false },
];

export const CATEGORY_ORDER = ['準備', '執筆', '出版査定', '表紙制作', 'KDP入稿', 'SNSプロモーション'];

export const CATEGORY_COLORS = {
  '準備': 'neon-cyan',
  '執筆': 'neon-pink',
  '出版査定': 'neon-amber',
  '表紙制作': 'neon-pink',
  'KDP入稿': 'neon-cyan',
  'SNSプロモーション': 'neon-amber',
};