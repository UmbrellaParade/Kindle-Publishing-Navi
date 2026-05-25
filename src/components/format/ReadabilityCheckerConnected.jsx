import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Copy, BookOpen, Download, FileText } from 'lucide-react';
import NeonCard from '../NeonCard';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const DEFAULT_GENRE = 'ダークファンタジー / 音楽ファンタジー';

const COMMON_EDITING_RULES = `【共通ルール】
- 意味、設定、登場人物、固有名詞、時系列は変えない
- 説明を足しすぎず、原文の声と文体を残す
- 1文が長すぎる箇所は自然に分割する
- 改行、段落分け、余白を整え、読者が息継ぎしやすい本文にする
- 1段落が長すぎる箇所は、意味のまとまりごとに自然に分ける
- 台詞、地の文、場面転換、感情の転換点に読みやすい余白を入れる
- Kindleスマホ表示でも追いやすい段落量に整える
- 縦書き化や横書き化そのものを目的にしない
- ジャンル差を作り込みすぎず、読みやすさの基本品質を優先する`;

const GENRE_PROFILES = [
  {
    value: DEFAULT_GENRE,
    label: DEFAULT_GENRE,
    aliases: ['ダークファンタジー', '音楽ファンタジー', '音楽', '芸術', 'フィクション > ファンタジー > ダークファンタジー'],
    instructions: `【ジャンル別方針】
- 陰影、余韻、音や沈黙の描写を活かす
- 感情が高まる場面は短文と改行で息継ぎを作る
- 世界観説明は詰め込みすぎず、場面の流れの中に分散する
- 章の冒頭と末尾は印象が残る一文に整える`,
  },
  {
    value: 'ハイファンタジー / エピックファンタジー',
    label: 'ハイファンタジー / エピックファンタジー',
    aliases: ['ハイファンタジー', 'エピックファンタジー', '叙事詩', 'フィクション > ファンタジー > 叙事詩'],
    instructions: `【ジャンル別方針】
- 固有名詞、地名、歴史設定が続く箇所は情報を小分けにする
- 壮大さを残しつつ、行動と感情の軸を見失わない段落にする
- 戦闘や旅の場面はテンポよく、説明場面は段落を短めに整理する
- 章末は物語の前進や余韻が伝わる形に整える`,
  },
  {
    value: '異世界ファンタジー',
    label: '異世界ファンタジー',
    aliases: ['異世界', '転生', '転移', 'なろう系'],
    instructions: `【ジャンル別方針】
- 主人公の目的、状況、能力がすぐ追えるように文を整理する
- スキルや設定説明は箇条書き風にしすぎず、短い段落で見せる
- 会話とリアクションのテンポを上げ、読み進めやすくする
- コメディや爽快感を削らず、説明過多だけを軽くする`,
  },
  {
    value: '都市ファンタジー / 現代ファンタジー',
    label: '都市ファンタジー / 現代ファンタジー',
    aliases: ['都市ファンタジー', '現代ファンタジー', 'ローファンタジー', 'フィクション > ファンタジー > 都市', 'フィクション > ファンタジー > コンテンポラリー'],
    instructions: `【ジャンル別方針】
- 日常描写と非日常描写の境目が伝わるように段落を切る
- 現代的な会話は軽く、異能や怪異の描写は余韻を残す
- 場所、時間、視点の切り替わりを明確にする
- 説明よりも出来事の流れで設定を理解できる形に整える`,
  },
  {
    value: 'マジカルリアリズム',
    label: 'マジカルリアリズム',
    aliases: ['マジカルリアリズム', 'フィクション > マジカルリアリズム'],
    instructions: `【ジャンル別方針】
- 不思議な出来事を説明しすぎず、自然に受け止められる文にする
- 静かな違和感、象徴、余白を残す
- 長い心理描写は意味のまとまりごとに分ける
- 文学的なリズムを保ちながら読みづらい密度だけを調整する`,
  },
  {
    value: 'SF / 近未来SF',
    label: 'SF / 近未来SF',
    aliases: ['SF', '近未来', 'フィクション > SF > 一般'],
    instructions: `【ジャンル別方針】
- 技術説明は1段落1テーマに整理する
- 専門用語が続く箇所は、人物の行動や感情を挟んで読みやすくする
- 世界設定とストーリー進行のバランスを取る
- 緊迫場面では短文を増やしてスピード感を出す`,
  },
  {
    value: 'サイバーパンク',
    label: 'サイバーパンク',
    aliases: ['サイバーパンク', 'フィクション > SF > サイバーパンク'],
    instructions: `【ジャンル別方針】
- 硬質な語感と疾走感を残しつつ、情報密度を整理する
- 都市、端末、身体改造などの描写は短い文で鋭く見せる
- 会話はテンポよく、説明は必要な位置に絞る
- アクション場面は視線の移動が追える段落にする`,
  },
  {
    value: 'スペースオペラ',
    label: 'スペースオペラ',
    aliases: ['スペースオペラ', '宇宙', '銀河', 'フィクション > SF > スペースオペラ'],
    instructions: `【ジャンル別方針】
- 艦隊、惑星、勢力関係の情報を一度に詰め込まない
- 壮大な描写と人物の目的がつながるように段落を整理する
- 戦闘や移動は位置関係が追える文にする
- 固有名詞の連続は必要に応じて短い補助文を挟む`,
  },
  {
    value: 'ミステリー / 探偵小説',
    label: 'ミステリー / 探偵小説',
    aliases: ['ミステリー', '探偵', '推理', 'フィクション > ミステリー、探偵小説 > 一般'],
    instructions: `【ジャンル別方針】
- 伏線、手がかり、推理の流れが追いやすい段落にする
- 情報開示の文は短く、誤読しにくく整理する
- 緊張感のある場面は余白と短文でリズムを作る
- 犯人や真相に関わる意味は絶対に変えない`,
  },
  {
    value: 'コージーミステリー',
    label: 'コージーミステリー',
    aliases: ['コージーミステリー', '日常ミステリー'],
    instructions: `【ジャンル別方針】
- 会話の軽さ、生活感、温かさを残す
- 謎解き部分は自然に読める順番へ整える
- コメディや人間関係の空気を削らず、文の詰まりを取る
- 場面転換はやわらかく、読者が迷わない余白を置く`,
  },
  {
    value: 'サスペンス / スリラー',
    label: 'サスペンス / スリラー',
    aliases: ['サスペンス', 'スリラー', '超自然サスペンス', 'フィクション > スリラー > 一般', 'フィクション > スリラー > 超自然サスペンス'],
    instructions: `【ジャンル別方針】
- 危機が近づく場面は短文で圧を出す
- 説明は引き延ばさず、行動と発見の順に整理する
- 章末や場面末に次を読みたくなる余韻を残す
- 真相や因果関係の意味は変えず、読みやすさだけを整える`,
  },
  {
    value: 'ホラー',
    label: 'ホラー',
    aliases: ['ホラー', '怪談', 'フィクション > ホラー'],
    instructions: `【ジャンル別方針】
- 恐怖描写は短文、沈黙、余白で間を作る
- 怪異の説明は明かしすぎず、不穏さを残す
- 視覚、音、匂いなどの感覚描写を読みやすく分ける
- 急展開は段落を短くし、読者の呼吸を誘導する`,
  },
  {
    value: '恋愛 / ロマンス',
    label: '恋愛 / ロマンス',
    aliases: ['恋愛', 'ロマンス', 'フィクション > ロマンス > 一般'],
    instructions: `【ジャンル別方針】
- 心の揺れ、視線、沈黙が伝わるように余白を作る
- 台詞と地の文のバランスを整え、感情の流れを滑らかにする
- 甘い場面や切ない場面は短い文で余韻を残す
- 関係性の変化が自然に追える段落にする`,
  },
  {
    value: 'ロマンスファンタジー',
    label: 'ロマンスファンタジー',
    aliases: ['ロマンスファンタジー', '恋愛ファンタジー', 'フィクション > ロマンス > ファンタジー'],
    instructions: `【ジャンル別方針】
- 恋愛感情と世界観説明がぶつからないように段落を分ける
- ときめき、緊張、身分差などの感情差を読みやすく見せる
- 魔法や王宮設定は必要な分だけ自然に補助する
- クライマックスでは感情の余韻を残す文に整える`,
  },
  {
    value: 'BL / ブロマンス',
    label: 'BL / ブロマンス',
    aliases: ['BL', 'ボーイズラブ', 'ブロマンス', 'ライトノベル > ボーイズラブノベルス'],
    instructions: `【ジャンル別方針】
- 距離感、視線、沈黙、言外の感情が伝わる余白を残す
- 関係性の変化が急に見えないよう、感情の段階を整理する
- 会話のテンポと心理描写の濃度を場面ごとに調整する
- 読者が感情移入しやすいよう、長い独白は分割する`,
  },
  {
    value: 'ライトノベル',
    label: 'ライトノベル',
    aliases: ['ライトノベル', 'ラノベ', 'キャラ文芸', 'ライトノベル > 一般'],
    instructions: `【ジャンル別方針】
- 会話、リアクション、地の文のテンポを軽くする
- 1文は短めにし、スマホでも追いやすい段落にする
- キャラクターの声を残し、説明だけ重い箇所を削る
- 見せ場では改行を使って勢いと余韻を作る`,
  },
  {
    value: 'キャラクター文芸',
    label: 'キャラクター文芸',
    aliases: ['キャラクター文芸', 'キャラ文芸', '文芸ライト'],
    instructions: `【ジャンル別方針】
- キャラクターの魅力が立つ会話と心理描写を残す
- 読みやすい文芸感を保ち、硬すぎる説明を軽くする
- 日常、謎、恋愛、成長の要素が自然につながる段落にする
- 場面ごとの感情の着地点をわかりやすくする`,
  },
  {
    value: 'アクション / 冒険',
    label: 'アクション / 冒険',
    aliases: ['アクション', '冒険', 'アドベンチャー', 'フィクション > アクション、アドベンチャー'],
    instructions: `【ジャンル別方針】
- 動作の順番が一目で追える短い文にする
- 戦闘、逃走、移動はテンポを優先する
- 説明や心理描写はアクションの流れを止めない位置に置く
- 場面転換と位置関係を明確にする`,
  },
  {
    value: '歴史 / 時代小説',
    label: '歴史 / 時代小説',
    aliases: ['歴史', '時代小説', '大河小説', 'フィクション > 大河小説'],
    instructions: `【ジャンル別方針】
- 時代背景の説明は簡潔にし、人物の行動に結びつける
- 古風な語り口を残しつつ、意味が取りにくい長文は分割する
- 戦、政争、家族関係などの情報を段落で整理する
- 台詞は雰囲気を保ちつつ読みやすい長さにする`,
  },
  {
    value: '文学 / 純文学',
    label: '文学 / 純文学',
    aliases: ['文学', '純文学', 'フィクション > 文学'],
    instructions: `【ジャンル別方針】
- 文体の個性、余韻、象徴表現を残す
- 長い心理描写は意味のまとまりで分割する
- 説明しすぎず、読者に委ねる余白を残す
- 読みにくさだけを整え、文章の密度は削りすぎない`,
  },
  {
    value: '一般文芸 / ヒューマンドラマ',
    label: '一般文芸 / ヒューマンドラマ',
    aliases: ['一般文芸', 'ヒューマンドラマ', 'フィクション > 一般'],
    instructions: `【ジャンル別方針】
- 人物の心情変化が自然に伝わる順番へ整える
- 日常描写と感情描写の段落を読みやすく分ける
- 会話と地の文のバランスを整える
- 感情の転換点には軽い余白を入れる`,
  },
  {
    value: '青春 / 成長物語',
    label: '青春 / 成長物語',
    aliases: ['青春', '成長物語', '学園', 'YA', 'ヤングアダルト'],
    instructions: `【ジャンル別方針】
- 主人公の迷い、気づき、変化が追えるように段落を整理する
- 会話は自然なテンポにし、説明過多を避ける
- 感動場面は短文と余白で余韻を作る
- 若い読者にも読みやすい文量に整える`,
  },
  {
    value: '短編小説',
    label: '短編小説',
    aliases: ['短編', 'ショートショート', 'フィクション > 短編小説'],
    instructions: `【ジャンル別方針】
- 一文ごとの役割を明確にし、冗長な説明を軽くする
- 導入、転換、余韻が短い分量で伝わるように整える
- オチや印象的な結末につながる情報は変えない
- 段落数を増やしすぎず、密度と読みやすさを両立する`,
  },
  {
    value: 'コメディ / 風刺',
    label: 'コメディ / 風刺',
    aliases: ['コメディ', 'ユーモア', '風刺', 'フィクション > 風刺'],
    instructions: `【ジャンル別方針】
- ツッコミ、間、オチのリズムが伝わる改行にする
- 説明で笑いを潰さず、テンポを優先する
- 風刺の意図がぼやけないよう文を整理する
- 会話の掛け合いは短く読みやすくする`,
  },
  {
    value: 'ノンフィクション / エッセイ',
    label: 'ノンフィクション / エッセイ',
    aliases: ['ノンフィクション', 'エッセイ', '随筆'],
    instructions: `【ジャンル別方針】
- 1段落1メッセージを意識して整理する
- 体験、考察、結論の流れが追えるようにする
- 読者に伝えたい要点を短い文で見せる
- 著者の語り口は残し、説明の重複だけを軽くする`,
  },
  {
    value: '詩 / 散文詩',
    label: '詩 / 散文詩',
    aliases: ['詩', '散文詩', '詩集'],
    instructions: `【ジャンル別方針】
- 行間、余白、リズムを作品の一部として扱う
- 意味を説明しすぎず、響きと余韻を残す
- 改行位置を整え、視覚的な読みやすさを高める
- 比喩や象徴表現は不用意に言い換えない`,
  },
];

const GENRE_OPTIONS = GENRE_PROFILES.map(({ value, label }) => ({ value, label }));
const GENRE_INSTRUCTIONS = Object.fromEntries(GENRE_PROFILES.map(({ value, instructions }) => [value, instructions]));

function getDiagnosisSearchText(diagnosis) {
  if (!diagnosis) return '';
  if (typeof diagnosis === 'string') return diagnosis;

  const parts = [
    diagnosis.genreLabel,
    diagnosis.genre_label,
    diagnosis.genreKey,
    diagnosis.genre_key,
    diagnosis.primaryCategory,
    ...(diagnosis.kdpCategories || []),
    ...(diagnosis.kdp_categories || []),
  ];

  return parts.filter(Boolean).join(' / ');
}

function getDiagnosisDisplayText(diagnosis) {
  if (!diagnosis) return '';
  if (typeof diagnosis === 'string') return diagnosis;
  return diagnosis.genreLabel || diagnosis.genre_label || diagnosis.primaryCategory || diagnosis.kdpCategories?.[0] || diagnosis.kdp_categories?.[0] || '';
}

function findGenreFromDiagnosis(diagnosis) {
  const searchText = getDiagnosisSearchText(diagnosis).toLowerCase();
  if (!searchText) return null;

  return GENRE_PROFILES.find(profile => {
    const words = [profile.value, profile.label, ...(profile.aliases || [])];
    return words.some(word => searchText.includes(String(word).toLowerCase()));
  }) || null;
}

function estimateKindlePages(text) {
  const bodyText = String(text || '').replace(/\s/g, '');
  const chars = bodyText.length;
  if (!chars) {
    return { chars: 0, pages: 0, range: '0' };
  }

  const pages = Math.max(1, Math.ceil(chars / 600));
  const min = Math.max(1, Math.floor(chars / 700));
  const max = Math.max(min, Math.ceil(chars / 500));

  return { chars, pages, range: min === max ? `${pages}` : `${min}〜${max}` };
}

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };

export default function Step4ReadabilityCheck({ sharedText, diagnosedGenre, onVersionChange, project }) {
  // FormatGuideTab から使われる場合は project が渡されないため、localStorage から取得
  const projectName = project?.name || '原稿';
  const [genreSource, setGenreSource] = useState('diagnosed');
  const [manualGenre, setManualGenre] = useState(DEFAULT_GENRE);
  const [previewMode, setPreviewMode] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [revisedText, setRevisedText] = useState('');
  const [manualText, setManualText] = useState('');
  const [activeTab, setActiveTab] = useState('original');
  const [importedText, setImportedText] = useState('');

  const matchedDiagnosedGenre = useMemo(() => findGenreFromDiagnosis(diagnosedGenre), [diagnosedGenre]);
  const diagnosisDisplayText = useMemo(() => getDiagnosisDisplayText(diagnosedGenre), [diagnosedGenre]);
  const isUsingDiagnosedGenre = genreSource === 'diagnosed' && Boolean(matchedDiagnosedGenre);
  const selectedGenre = isUsingDiagnosedGenre ? matchedDiagnosedGenre.value : manualGenre;
  const selectedGenreLabel = GENRE_OPTIONS.find(opt => opt.value === selectedGenre)?.label || selectedGenre;
  const selectedGenreSourceLabel = isUsingDiagnosedGenre ? '診断結果' : '手動選択';
  const selectedGenreInstructions = GENRE_INSTRUCTIONS[selectedGenre] || GENRE_INSTRUCTIONS[DEFAULT_GENRE];
  const originalPageEstimate = useMemo(() => estimateKindlePages(sharedText), [sharedText]);
  const finalPageEstimate = useMemo(() => estimateKindlePages(importedText || revisedText || sharedText), [importedText, revisedText, sharedText]);

  useEffect(() => {
    setRevisedText('');
    setManualText('');
    setImportedText('');
    setActiveTab('original');
    setPreviewMode('normal');
  }, [sharedText]);

  const analyze = async () => {
    const text = sharedText.trim();
    if (text.length < 50) {
      toast.error('50 文字以上入力してください');
      return;
    }

    setLoading(true);
    setRevisedText('');

    const instructions = `${COMMON_EDITING_RULES}

【参考ジャンル】
${selectedGenreLabel}
※ジャンル別方針は補助情報です。ランキングや市場差を過度に推測せず、読みやすさの基本品質を優先してください。
${selectedGenreInstructions}`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `あなたは Kindle 出版の文章編集専門家です。以下のテキストを、改行・段落分け・余白・文の長さを中心に読みやすく整えてください。

【ジャンル指定】
- 使用ジャンル: ${selectedGenreLabel}
- 指定方法: ${selectedGenreSourceLabel}
${isUsingDiagnosedGenre && diagnosisDisplayText ? `- 診断表示: ${diagnosisDisplayText}` : ''}

【重要】意味・ストーリー・登場人物・設定は絶対に変えないでください。あくまで「読みやすさ」のための改行・段落・余白調整を中心に行ってください。縦書き化や横書き化そのものは行わないでください。

${instructions}

【原文】
${text.slice(0, 4000)}

【出力形式】
修正後のテキストのみを出力してください。解説やコメントは不要です。`,
        model: 'claude_sonnet_4_6',
      });

      setRevisedText(res);
      setManualText('');
      setImportedText('');
      setActiveTab('revised');
      toast.success('文章を整えました');
      setTimeout(() => {
        document.getElementById('readability-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (err) {
      toast.error('エラーが発生しました：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('コピーしました');
  };

  const importText = () => {
    if (!importedText.trim()) {
      toast.error('原稿が入力されていません');
      return;
    }
    setRevisedText(importedText);
    setManualText('');
    setActiveTab('revised');
    toast.success('原稿を取り込みました');
  };

  const downloadDocx = async () => {
    const textToDownload = revisedText || sharedText;
    if (!textToDownload) {
      toast.error('ダウンロードする原稿がありません');
      return;
    }

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `原稿_${projectName}_${date}.docx`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `以下のテキストを HTML 形式（Word で開ける形式）に変換してください。
- 游明朝または Noto Serif JP、11pt を使用
- 行間は 1.5〜2.0
- 段落間にスペースを空ける
- 見出しは<h4>、本文は<p>タグ

【テキスト】
${textToDownload.slice(0, 4000)}`,
        model: 'claude_sonnet_4_6',
      });

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Noto Serif JP', '游明朝', serif; font-size: 11pt; line-height: 2.0; }
  p { margin: 1em 0; }
  h4 { font-size: 13pt; margin: 1.5em 0 0.5em; }
</style>
</head>
<body>
${res}
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('DOCX でダウンロードしました');
    } catch (err) {
      toast.error('ダウンロードに失敗しました：' + err.message);
    }
  };

  const downloadTxt = () => {
    const textToDownload = revisedText || sharedText;
    if (!textToDownload) {
      toast.error('ダウンロードする原稿がありません');
      return;
    }

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `原稿_${projectName}_${date}.txt`;

    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('TXT でダウンロードしました');
  };

  const getFinalText = () => {
    return importedText || revisedText || sharedText;
  };

  return (
    <NeonCard glowColor="amber">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="w-4 h-4 text-neon-amber" />
        <h3 className="font-bold text-sm text-neon-amber neon-amber-glow">📖 読みやすさ修正</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        改行、段落分け、余白、文の長さを中心に、Kindleで読み進めやすい本文へ整えます。ジャンルは補助情報として使います。
        {sharedText.trim().length < 50 && <span className="text-neon-amber ml-1">（上の入力エリアに本文を貼り付けてください）</span>}
      </p>

      {/* ジャンル選択 */}
      <div className="mb-4 space-y-3">
        <p className="text-xs font-bold text-foreground">参考ジャンル（任意）</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => matchedDiagnosedGenre && setGenreSource('diagnosed')}
            disabled={!matchedDiagnosedGenre}
            className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
              isUsingDiagnosedGenre
                ? 'border-neon-amber/60 bg-neon-amber/10 text-neon-amber'
                : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-neon-amber/40'
            }`}
          >
            <span className="block text-xs font-bold">診断結果を使う</span>
            <span className="block text-[10px] mt-1 leading-relaxed">
              {matchedDiagnosedGenre
                ? `${diagnosisDisplayText ? `${diagnosisDisplayText} → ` : ''}${matchedDiagnosedGenre.label}`
                : 'ジャンル診断後に選べます'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setGenreSource('manual')}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
              !isUsingDiagnosedGenre
                ? 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan'
                : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-neon-cyan/40'
            }`}
          >
            <span className="block text-xs font-bold">手動で選ぶ</span>
            <span className="block text-[10px] mt-1 leading-relaxed">{manualGenre}</span>
          </button>
        </div>

        <Select value={manualGenre} onValueChange={(value) => { setManualGenre(value); setGenreSource('manual'); }}>
          <SelectTrigger className="bg-secondary border-border focus:border-neon-amber/50 text-sm">
            <SelectValue placeholder="ジャンルを選択してください..." />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {GENRE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 修正方針表示 */}
      {selectedGenre && (
        <div className="mb-4 rounded-lg p-3 text-xs leading-relaxed" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2a4a' }}>
          <p className="font-bold text-neon-cyan mb-1">改行・段落・余白の共通方針 + {selectedGenreLabel} の補助方針（{selectedGenreSourceLabel}）：</p>
          <p className="text-muted-foreground whitespace-pre-wrap mb-3">{COMMON_EDITING_RULES}</p>
          <p className="text-muted-foreground whitespace-pre-wrap">{selectedGenreInstructions}</p>
        </div>
      )}

      <Button
        onClick={analyze}
        disabled={loading || sharedText.trim().length < 50}
        className="w-full h-9 bg-neon-amber/20 text-neon-amber border border-neon-amber/40 hover:bg-neon-amber/30 text-xs disabled:opacity-40"
      >
        {loading
          ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />修正中...</>
          : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />✨ 改行と段落を読みやすく整える</>}
      </Button>
      <p className="text-[10px] text-muted-foreground mt-1">※ AIによる読みやすさ調整です。内容を確認してから採用してください。</p>

      <AnimatePresence>
        {revisedText && (
          <motion.div id="readability-result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
            
            {/* タブ切り替え */}
            <div className="rounded-lg overflow-hidden" style={CARD_STYLE}>
              <div className="flex border-b" style={{ borderColor: '#2a2a4a' }}>
                <button
                  onClick={() => setActiveTab('original')}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'original' ? 'bg-neon-pink/10 text-neon-pink' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <BookOpen className="w-3.5 h-3.5" />📄 修正前
                </button>
                <button
                  onClick={() => setActiveTab('revised')}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'revised' ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />✨ 修正後
                </button>
              </div>

              {/* タブコンテンツ */}
              <div className="p-4">
                {activeTab === 'original' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-muted-foreground">元の本文（読み取り専用）</p>
                      <Button size="sm" variant="ghost" onClick={() => copyText(sharedText)} className="h-7 text-xs gap-1">
                        <Copy className="w-3 h-3" />📋 コピー
                      </Button>
                    </div>
                    <div className="rounded-lg p-3 text-sm leading-relaxed max-h-[600px] overflow-y-auto" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2a2a4a' }}>
                      {sharedText}
                    </div>
                  </div>
                )}

                {activeTab === 'revised' && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-neon-cyan">✨ 修正後（直接編集可能）</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => copyText(revisedText)} className="h-7 text-xs gap-1 text-neon-cyan">
                            <Copy className="w-3 h-3" />📋 コピー
                          </Button>
                        </div>
                      </div>
                      <textarea
                        value={revisedText}
                        onChange={(e) => setRevisedText(e.target.value)}
                        className="w-full min-h-[600px] p-4 text-sm rounded-lg focus:outline-none resize-y leading-[2.0]"
                        style={{
                          background: '#ffffff',
                          color: '#111111',
                          fontFamily: "'Noto Serif JP', serif",
                          border: '1px solid #2a2a4a',
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground mt-2">
                        フォント：明朝系 / 行間：2.0 / Kindle の読書画面に近い表示
                      </p>
                    </div>

                    <div className="rounded-lg p-4 border border-neon-amber/30" style={{ background: 'rgba(255,179,0,0.04)' }}>
                      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                        <div>
                          <p className="text-sm font-bold text-neon-amber">表示確認プレビュー</p>
                          <p className="text-[10px] text-muted-foreground mt-1">本文は変更せず、修正後テキストの見え方だけを確認します。</p>
                        </div>
                        <div className="flex gap-1 bg-secondary rounded-lg p-1">
                          <button
                            type="button"
                            onClick={() => setPreviewMode('normal')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${previewMode === 'normal' ? 'bg-neon-amber/20 text-neon-amber border border-neon-amber/40' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            通常表示
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewMode('vertical')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${previewMode === 'vertical' ? 'bg-neon-amber/20 text-neon-amber border border-neon-amber/40' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            縦書きプレビュー
                          </button>
                        </div>
                      </div>
                      <div
                        className="rounded-lg p-4 text-sm bg-white text-black border border-border whitespace-pre-wrap"
                        style={{
                          minHeight: previewMode === 'vertical' ? 360 : 160,
                          maxHeight: 420,
                          overflowX: previewMode === 'vertical' ? 'auto' : 'hidden',
                          overflowY: previewMode === 'vertical' ? 'hidden' : 'auto',
                          writingMode: previewMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                          textOrientation: 'mixed',
                          lineHeight: 2,
                          fontFamily: "'Noto Serif JP', 'Yu Mincho', serif",
                        }}
                      >
                        {revisedText}
                      </div>
                    </div>

                    {/* 📥 仕上げ原稿を取り込む */}
                    <div className="rounded-lg p-4 border border-neon-pink/30" style={{ background: 'rgba(255,45,120,0.04)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Download className="w-4 h-4 text-neon-pink" />
                        <p className="text-sm font-bold text-neon-pink">📥 仕上げ原稿を取り込む</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">外部で編集した原稿をここに貼り付けてください。取り込むと上の「修正後プレビュー」エリアに反映され、手動編集も可能になります。</p>
                      <textarea
                        value={importedText}
                        onChange={(e) => setImportedText(e.target.value)}
                        placeholder="外部で修正した原稿をここにコピペしてください"
                        className="w-full min-h-[300px] p-3 text-sm rounded-lg focus:outline-none resize-y"
                        style={{
                          background: '#ffffff',
                          color: '#111111',
                          border: '1px solid #2a2a4a',
                        }}
                      />
                      <Button
                        onClick={importText}
                        className="mt-2 h-8 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30"
                      >
                        <Download className="w-3 h-3 mr-1.5" />📥 この原稿を取り込む
                      </Button>
                    </div>

                    {/* 推定ページ数 */}
                    <div className="rounded-lg p-4 border border-neon-amber/30" style={{ background: 'rgba(255,179,0,0.05)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-4 h-4 text-neon-amber" />
                        <p className="text-sm font-bold text-neon-amber">推定ページ数</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="rounded-md p-2 bg-secondary/50 border border-border/60">
                          <p className="text-[10px] text-muted-foreground mb-0.5">修正後の目安</p>
                          <p className="text-lg font-bold text-foreground">{finalPageEstimate.pages}ページ前後</p>
                        </div>
                        <div className="rounded-md p-2 bg-secondary/50 border border-border/60">
                          <p className="text-[10px] text-muted-foreground mb-0.5">幅を見た目安</p>
                          <p className="text-lg font-bold text-foreground">{finalPageEstimate.range}ページ</p>
                        </div>
                        <div className="rounded-md p-2 bg-secondary/50 border border-border/60">
                          <p className="text-[10px] text-muted-foreground mb-0.5">文字数</p>
                          <p className="text-lg font-bold text-foreground">{finalPageEstimate.chars.toLocaleString()}字</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        日本語本文600字前後を1ページとして計算した概算です。KDP上の正確なページ数はKindle PreviewerとKDP登録画面で最終確認してください。
                        {originalPageEstimate.chars > 0 && ` 修正前は約${originalPageEstimate.pages}ページ前後です。`}
                      </p>
                    </div>

                    {/* 💾 ダウンロードエリア */}
                    <div className="rounded-lg p-4 border border-neon-cyan/30" style={{ background: 'rgba(0,245,255,0.04)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-neon-cyan" />
                        <p className="text-sm font-bold text-neon-cyan">💾 ダウンロード</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">取り込み（または手動編集）した最終原稿をダウンロードできます。</p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={downloadDocx}
                          className="h-9 text-xs gap-1.5 bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30"
                        >
                          <Download className="w-3.5 h-3.5" />📄 .docx でダウンロード
                        </Button>
                        <Button
                          onClick={downloadTxt}
                          className="h-9 text-xs gap-1.5 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30"
                        >
                          <Download className="w-3.5 h-3.5" />📝 .txt でダウンロード
                        </Button>
                        <Button
                          onClick={() => copyText(getFinalText())}
                          className="h-9 text-xs gap-1.5 bg-secondary text-foreground border border-border hover:border-neon-cyan/50"
                        >
                          <Copy className="w-3.5 h-3.5" />📋 全文コピー
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </NeonCard>
  );
}
