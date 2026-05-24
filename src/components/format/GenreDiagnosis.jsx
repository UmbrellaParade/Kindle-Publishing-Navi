import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wand2, FileText, FolderSearch, Music, BookOpen, Sparkles } from 'lucide-react';
import NeonCard from '../NeonCard';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const GENRE_LIST = [
  { value: 'fantasy', label: 'ファンタジー・異世界' },
  { value: 'lightnovel', label: 'ライトノベル' },
  { value: 'music_art', label: '音楽・芸術・IP系（Umbrella Paradeなど）' },
  { value: 'mystery', label: 'ミステリー・サスペンス' },
  { value: 'human_drama', label: 'ヒューマンドラマ・純文学' },
  { value: 'romance', label: 'ロマンス・恋愛' },
  { value: 'sf', label: 'SF・ホラー' },
  { value: 'business', label: 'ビジネス・自己啓発' },
  { value: 'essay', label: 'エッセイ・ノンフィクション' },
];

const GENRE_ADVICE = {
  fantasy: {
    label: 'ファンタジー・異世界',
    format: 'docx',
    formatReason: '縦書き・ルビ対応がdocxで安定。異世界系読者はKindle Unlimited経由が多く、docxの変換品質で十分。',
    categories: [
      '文学・評論 > SF・ホラー・ファンタジー',
      'ライトノベル（異世界寄りの場合）',
    ],
    categoryTips: 'メインを「SF・ホラー・ファンタジー」に設定し、サブカテゴリーで「異世界ファンタジー」系を選ぶと発見されやすい。',
    color: 'cyan',
    icon: Sparkles,
  },
  lightnovel: {
    label: 'ライトノベル',
    format: 'docx',
    formatReason: 'ルビ（ふりがな）が多いライトノベルはdocxの変換が最も安定。epubでのルビ実装は上級者向け。',
    categories: [
      'Kindleストア > ライトノベル',
      '文学・評論 > 文芸作品（補完として）',
    ],
    categoryTips: '「ライトノベル」カテゴリーは競合が多いが読者層が大きい。サブジャンル（学園・異能など）を意識したタイトル・表紙が重要。',
    color: 'pink',
    icon: BookOpen,
  },
  music_art: {
    label: '音楽・芸術・IP系',
    format: 'epub',
    formatReason: 'Umbrella Paradeのような楽曲リンク・Spotifyリンクを埋め込みたい場合はepub一択。外部ハイパーリンクが有効に機能する。docxでも外部リンクは貼れるが、epubの方が確実にタップ可能なリンクになる。',
    categories: [
      '文学・評論 > 文芸作品',
      'アート・建築・デザイン（音楽寄りなら）',
      '文学・評論 > SF・ホラー・ファンタジー（世界観重視なら）',
    ],
    categoryTips: '音楽×ファンタジーIPはニッチだからこそ刺さる。「アート・建築・デザイン」は競合が少なくランキング入りしやすい穴場。',
    color: 'amber',
    icon: Music,
  },
  mystery: {
    label: 'ミステリー・サスペンス',
    format: 'docx',
    formatReason: '横書き・縦書きどちらも安定。テキスト主体のミステリーはdocxで十分なクオリティが出せる。',
    categories: [
      '文学・評論 > ミステリー・サスペンス・ハードボイルド',
    ],
    categoryTips: 'ミステリーは国内外の古典が強い激戦区。タイトルに「謎」「消えた」「殺人」などの直接的なワードを入れると検索経由で見つけられやすい。',
    color: 'pink',
    icon: BookOpen,
  },
  human_drama: {
    label: 'ヒューマンドラマ・純文学',
    format: 'docx',
    formatReason: '縦書き・游明朝の組み合わせがdocxで美しく再現できる。純文学読者は文章体験を重視するため、変換安定性が最優先。',
    categories: [
      '文学・評論 > 日本文学',
      '文学・評論 > 文芸作品',
    ],
    categoryTips: '「日本文学」は文芸性の高さをアピールできるカテゴリー。タイトルや紹介文で「人間」「家族」「再生」「孤独」などのテーマワードを使うと刺さりやすい。',
    color: 'cyan',
    icon: BookOpen,
  },
  romance: {
    label: 'ロマンス・恋愛',
    format: 'docx',
    formatReason: 'ロマンス小説は縦書きが主流。docxで縦書き設定すれば問題なし。KU（Kindle Unlimited）読者が多いため読みやすさ優先。',
    categories: [
      '文学・評論 > ロマンス',
      '暮らし・健康・子育て > 恋愛・結婚・離婚（エッセイ寄りなら）',
    ],
    categoryTips: '「ロマンス」はKindleで最も活性化しているカテゴリーの一つ。サブジャンル（学園・社会人・再会など）のキーワード設定が売上を左右する。',
    color: 'pink',
    icon: BookOpen,
  },
  sf: {
    label: 'SF・ホラー',
    format: 'epub',
    formatReason: 'SFは図版・地図・専門用語集などを含むことが多く、epubのレイアウト制御が活きる。ホラーは演出的な空白や特殊フォントをepubで表現できる。',
    categories: [
      '文学・評論 > SF・ホラー・ファンタジー',
    ],
    categoryTips: 'SF・ホラーは海外作品との競合も視野に。「日本のSF」「国産ホラー」という差別化軸でタイトル・説明文を書くと国内読者に刺さる。',
    color: 'cyan',
    icon: Sparkles,
  },
  business: {
    label: 'ビジネス・自己啓発',
    format: 'docx',
    formatReason: '横書き・ゴシック体はdocxで最も安定。図表・箇条書きもdocxなら視認性の高い状態で変換される。',
    categories: [
      'ビジネス・経済 > ビジネス実用',
      '人文・思想 > 自己啓発',
    ],
    categoryTips: 'ビジネス書は「具体的な悩み」を解決するタイトルが圧倒的に強い。「〇〇できる」「〇〇の法則」形式のタイトルは検索にも強い。',
    color: 'amber',
    icon: FileText,
  },
  essay: {
    label: 'エッセイ・ノンフィクション',
    format: 'docx',
    formatReason: 'エッセイは文章主体のためdocxで十分。写真を多用する場合はepubを検討するが、初版はdocxで出してから判断でもOK。',
    categories: [
      '文学・評論 > エッセー・随筆',
      'ノンフィクション > ノンフィクション',
    ],
    categoryTips: 'エッセイ・ノンフィクションは著者の個性・ブランドが問われるジャンル。SNSでの発信履歴・実績が購買に直結するため、プロフィール欄の充実も忘れずに。',
    color: 'cyan',
    icon: PenLine,
  },
};

import { PenLine } from 'lucide-react';

const colorMap = {
  pink: 'text-neon-pink neon-pink-glow',
  cyan: 'text-neon-cyan neon-cyan-glow',
  amber: 'text-neon-amber neon-amber-glow',
};

export default function GenreDiagnosis() {
  const [selectedGenre, setSelectedGenre] = useState('');
  const result = selectedGenre ? GENRE_ADVICE[selectedGenre] : null;

  return (
    <NeonCard glowColor="pink">
      <div className="flex items-center gap-2 mb-1">
        <Wand2 className="w-4 h-4 text-neon-pink" />
        <h3 className="font-bold text-sm text-neon-pink neon-pink-glow">ジャンル診断 — 最適フォーマット＆カテゴリー提案</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">あなたの作品ジャンルを選ぶと、最適なフォーマットとKDPカテゴリー設定を提案します。</p>

      <Select value={selectedGenre} onValueChange={setSelectedGenre}>
        <SelectTrigger className="bg-secondary border-border text-sm focus:border-neon-pink/50">
          <SelectValue placeholder="ジャンルを選択してください..." />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {GENRE_LIST.map((g) => (
            <SelectItem key={g.value} value={g.value} className="text-sm hover:bg-secondary">
              {g.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 space-y-4"
          >
            {/* Format recommendation */}
            <div className="bg-secondary/60 rounded-lg p-4 border border-neon-pink/20">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">推奨フォーマット</p>
              <div className="flex items-center gap-3 mb-2">
                <Badge className={`text-base px-4 py-1 font-heading font-bold ${result.format === 'epub' ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40' : 'bg-neon-pink/20 text-neon-pink border border-neon-pink/40'}`}>
                  {result.format}
                </Badge>
                <span className="text-xs text-muted-foreground">を選べ</span>
              </div>
              <p className="text-xs text-foreground leading-relaxed">{result.formatReason}</p>
            </div>

            {/* Category recommendation */}
            <div className="bg-secondary/60 rounded-lg p-4 border border-neon-cyan/20">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">推奨カテゴリー</p>
              <ul className="space-y-1.5 mb-3">
                {result.categories.map((cat, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <FolderSearch className="w-3.5 h-3.5 text-neon-cyan mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{cat}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">{result.categoryTips}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NeonCard>
  );
}