import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wand2, FolderSearch, ChevronRight } from 'lucide-react';
import NeonCard from './NeonCard';
import { motion, AnimatePresence } from 'framer-motion';

const GENRE_OPTIONS = [
  { value: 'lit', label: 'フィクション > 文学' },
  { value: 'fiction_general', label: 'フィクション > 一般' },
  { value: 'action', label: 'フィクション > アクション、アドベンチャー' },
  { value: 'fantasy_general', label: 'フィクション > ファンタジー > 一般' },
  { value: 'dark_fantasy', label: 'フィクション > ファンタジー > ダークファンタジー' },
  { value: 'epic_fantasy', label: 'フィクション > ファンタジー > 叙事詩' },
  { value: 'paranormal_fantasy', label: 'フィクション > ファンタジー > 超常現象' },
  { value: 'urban_fantasy', label: 'フィクション > ファンタジー > 都市' },
  { value: 'horror', label: 'フィクション > ホラー' },
  { value: 'magical_realism', label: 'フィクション > マジカルリアリズム' },
  { value: 'mystery', label: 'フィクション > ミステリー、探偵小説 > 一般' },
  { value: 'sf', label: 'フィクション > SF > 一般' },
  { value: 'supernatural_thriller', label: 'フィクション > スリラー > 超自然サスペンス' },
  { value: 'romance_fantasy', label: 'フィクション > ロマンス > ファンタジー' },
  { value: 'light_novel', label: 'ライトノベル > 一般' },
];

const GENRE_RESULTS = {
  lit: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: '文学は縦書きdocxが最適。文章の重みと格調が縦書きで際立つ。',
    epubNote: '詩集・歌集など特殊レイアウトが必要な場合のみepub。',
    categories: [
      'フィクション > 文学',
      'フィクション > ファンタジー > ダークファンタジー',
    ],
    categoryNote: 'Umbrella Paradeのような作品は「フィクション > 文学」を1位狙い、「ダークファンタジー」を2位狙いに設定しよう。',
    tip: '文学ジャンルはレビュー数が武器になる。読者にレビューをお願いする文言を後書きに入れよう。',
  },
  fiction_general: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: 'フィクション全般は縦書きdocxで安定出力できる。変換エラーリスクが最も低い。',
    epubNote: '挿絵・図解が多い場合のみepubを検討。',
    categories: [
      'フィクション > 一般',
      'フィクション > 文学',
    ],
    categoryNote: '「フィクション > 一般」は競合が少なく1位を狙いやすいカテゴリー。',
    tip: '「フィクション > 一般」は穴場カテゴリー。まず1冊目はここから狙おう。',
  },
  action: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: 'アクション小説は縦書きのテンポが戦闘シーンの緊張感を高める。',
    epubNote: '地図・イラストを多数入れる場合はepubも選択肢に。',
    categories: [
      'フィクション > アクション、アドベンチャー',
      'フィクション > ファンタジー > 一般',
    ],
    categoryNote: '「アクション、アドベンチャー」と「ファンタジー > 一般」の組み合わせが有効。',
    tip: '冒頭3ページでの掴みが最重要。試し読みで離脱されないよう入り口を磨こう。',
  },
  fantasy_general: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: 'ファンタジーは縦書きdocxが最安全。世界観の没入感を高める。',
    epubNote: '独自レイアウト・挿絵が多い場合はepubも選択肢に。',
    categories: [
      'フィクション > ファンタジー > 一般',
      'フィクション > 文学',
    ],
    categoryNote: '「ファンタジー > 一般」で安定的な露出を狙いつつ、「文学」で格調をアピール。',
    tip: '魔法名・地名などの独自語はキーワードに入れると検索流入になる。',
  },
  dark_fantasy: {
    formatRec: 'docx（縦書き）＋ URLリンク活用',
    formatEmphasis: 'pink',
    formatReason: 'Umbrella Paradeのようなダークファンタジー×音楽IPは縦書きdocxが最適。楽曲URLをテキストリンクとして本文に埋め込める。',
    epubNote: '独自装飾にこだわる場合はepubが強い。楽曲URLがある場合はdocx確定。',
    categories: [
      'フィクション > 文学',
      'フィクション > ファンタジー > ダークファンタジー',
      'フィクション > ファンタジー > 一般',
    ],
    categoryNote: '1位狙い：フィクション > 文学、2位狙い：ダークファンタジー、3位狙い：ファンタジー > 一般。',
    tip: '本文中に「この章のテーマ曲：[Spotify URL]」と書くだけでKindleから再生できる。読者体験が格段に上がる。',
    special: true,
  },
  epic_fantasy: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: '叙事詩系ファンタジーは縦書きで重厚感が増す。長編向きなのでdocxの安定性が活きる。',
    epubNote: '地図・系譜図を入れる場合はepubを検討。',
    categories: [
      'フィクション > ファンタジー > 叙事詩',
      'フィクション > ファンタジー > 一般',
    ],
    categoryNote: '「叙事詩」は競合が少なく1位を狙いやすい穴場カテゴリー。',
    tip: '長編は章タイトルと目次をしっかり作ると読者の満足度が上がる。',
  },
  paranormal_fantasy: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: '超常現象系は縦書きの余白が神秘的な雰囲気を演出する。',
    epubNote: '特殊演出フォントを使いたい場合はepubを検討。',
    categories: [
      'フィクション > ファンタジー > 超常現象',
      'フィクション > ホラー',
    ],
    categoryNote: '「超常現象」は競合が比較的少なく1位を狙えるカテゴリー。',
    tip: '謎めいたあらすじ文章が試し読みへの誘導につながる。',
  },
  urban_fantasy: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: '都市ファンタジーは縦書きdocxで問題なし。',
    epubNote: '都市マップなどビジュアル要素が多い場合はepubも有効。',
    categories: [
      'フィクション > ファンタジー > 都市',
      'フィクション > ファンタジー > 一般',
    ],
    categoryNote: '「都市」は都市設定ファンタジーの専用カテゴリー。他に「一般」も設定しよう。',
    tip: '現実の都市名をキーワードに入れると地域ファンに刺さりやすい。',
  },
  horror: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: 'ホラーは縦書きの方が恐怖感が増す。改ページや余白を恐怖演出に使えるのでdocxが最適。',
    epubNote: '演出的な特殊フォント・赤文字を使いたい場合はepubを検討。',
    categories: [
      'フィクション > ホラー',
      'フィクション > スリラー > 超自然サスペンス',
    ],
    categoryNote: '「フィクション > ホラー」が主カテゴリー。サスペンス要素があれば「超自然サスペンス」も設定。',
    tip: '表紙の暗さとタイトルの不気味さで手に取られる確率が大きく変わるジャンル。',
  },
  magical_realism: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: 'マジカルリアリズムは文章の密度が武器。縦書きdocxで日本文学の文脈に乗せやすい。',
    epubNote: '基本不要。',
    categories: [
      'フィクション > マジカルリアリズム',
      'フィクション > 文学',
    ],
    categoryNote: '「マジカルリアリズム」は競合が少なく1位を狙いやすい穴場カテゴリー。',
    tip: '日常と非日常の境界線を描く文章力を前書きでアピールしよう。',
  },
  mystery: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: 'ミステリーは縦書きが読者の期待値。docxで十分対応できる。',
    epubNote: '図解・地図を多用する場合はepubが有利。',
    categories: [
      'フィクション > ミステリー、探偵小説 > 一般',
      'フィクション > スリラー > 超自然サスペンス',
    ],
    categoryNote: '「ミステリー、探偵小説 > 一般」が基本。超自然要素があれば「超自然サスペンス」も設定。',
    tip: '謎解き要素をキーワードに入れると（例：「叙述トリック」）ファンに刺さりやすい。',
  },
  sf: {
    formatRec: 'docx または epub',
    formatEmphasis: 'cyan',
    formatReason: 'SFは図解・用語集が多い場合はepubが有利。文章中心ならdocxで十分。',
    epubNote: '宇宙地図・設定図を入れる場合はepubを検討。',
    categories: [
      'フィクション > SF > 一般',
      'フィクション > ファンタジー > 一般',
    ],
    categoryNote: '「SF > 一般」が主カテゴリー。ファンタジー要素が強い場合は「ファンタジー > 一般」も設定。',
    tip: 'ハードSF用語はキーワードに入れると検索ニッチを狙える。',
  },
  supernatural_thriller: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: '超自然サスペンスは縦書きの緊張感が活きる。URLリンクがある場合はdocx確定。',
    epubNote: '演出的な特殊レイアウトを使う場合のみepub。',
    categories: [
      'フィクション > スリラー > 超自然サスペンス',
      'フィクション > ホラー',
    ],
    categoryNote: '「超自然サスペンス」と「ホラー」の2カテゴリーで読者層をカバー。',
    tip: 'スリラーは冒頭の緊張感が試し読みでの購入率に直結する。',
  },
  romance_fantasy: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: 'ロマンス×ファンタジーは縦書きで読む文化が根強い。docxで問題なし。',
    epubNote: '特に理由なければdocxを推奨。',
    categories: [
      'フィクション > ロマンス > ファンタジー',
      'フィクション > ファンタジー > 一般',
    ],
    categoryNote: '「ロマンス > ファンタジー」は女性読者層に強い。「ファンタジー > 一般」との併用が有効。',
    tip: '表紙のビジュアルインパクトがコンバージョンに直結するジャンル。表紙に力を入れよう。',
  },
  light_novel: {
    formatRec: 'docx（縦書き）',
    formatEmphasis: 'pink',
    formatReason: 'ラノベはKDP読者層がdocxの縦書きに慣れている。ページ数が多くなりやすいのでdocxの方が変換エラーリスクが低い。',
    epubNote: '挿絵が多数ある場合のみepubを検討。',
    categories: [
      'ライトノベル > 一般',
      'フィクション > ファンタジー > 一般',
    ],
    categoryNote: '「ライトノベル > 一般」は単独カテゴリーとして実在する。必ずここに設定しよう。',
    tip: 'タイトルにジャンルを直接含める（例：「〜の魔法使い」）と検索に強い。',
  },
};

export default function GenreDiagnostic() {
  const [selectedGenre, setSelectedGenre] = useState('');
  const result = GENRE_RESULTS[selectedGenre];

  const emphasisColor = {
    pink: 'text-neon-pink neon-pink-glow',
    cyan: 'text-neon-cyan neon-cyan-glow',
    amber: 'text-neon-amber neon-amber-glow',
  };

  return (
    <NeonCard glowColor="pink">
      <div className="flex items-center gap-2 mb-1">
        <Wand2 className="w-4 h-4 text-neon-pink" />
        <h3 className="font-bold text-sm text-neon-pink neon-pink-glow">ジャンル診断</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        あなたの作品ジャンルを選ぶと、最適なフォーマットとカテゴリー設定のアドバイスを表示します。
      </p>

      <Select value={selectedGenre} onValueChange={setSelectedGenre}>
        <SelectTrigger className="bg-secondary border-border focus:border-neon-pink/50 text-sm">
          <SelectValue placeholder="ジャンルを選択してください..." />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {GENRE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-sm">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-5 space-y-3"
          >
            {result.special && (
              <div className="p-2 rounded bg-neon-pink/10 border border-neon-pink/30 text-xs text-neon-pink font-bold text-center">
                ✦ Umbrella Parade / 音楽IP 特別対応ジャンル ✦
              </div>
            )}

            {/* Format recommendation */}
            <div className="bg-secondary/50 rounded-md p-3 border border-neon-pink/20">
              <p className="text-[10px] text-muted-foreground mb-1 tracking-wide uppercase">推奨フォーマット</p>
              <p className={`text-sm font-bold mb-1.5 ${emphasisColor[result.formatEmphasis]}`}>
                {result.formatRec}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{result.formatReason}</p>
              {result.epubNote && (
                <p className="text-xs text-neon-amber mt-1.5">
                  <span className="font-medium">epub検討タイミング：</span>{result.epubNote}
                </p>
              )}
            </div>

            {/* Category recommendation */}
            <div className="bg-secondary/50 rounded-md p-3 border border-neon-cyan/20">
              <div className="flex items-center gap-1.5 mb-2">
                <FolderSearch className="w-3.5 h-3.5 text-neon-cyan" />
                <p className="text-[10px] text-muted-foreground tracking-wide uppercase">推奨KDPカテゴリー</p>
              </div>
              {result.categories.map((cat, i) => (
                <div key={i} className="flex items-start gap-1.5 mb-1.5">
                  <ChevronRight className="w-3 h-3 text-neon-cyan mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-foreground">{cat}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{result.categoryNote}</p>
            </div>

            {/* Tip */}
            <div className="p-3 rounded-md bg-neon-amber/5 border border-neon-amber/20">
              <p className="text-xs text-muted-foreground">
                <span className="text-neon-amber font-bold">TIPS：</span>
                {result.tip}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NeonCard>
  );
}