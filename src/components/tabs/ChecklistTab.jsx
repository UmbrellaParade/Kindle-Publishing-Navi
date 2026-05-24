import React, { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, Info, Sparkles, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import NeonCard from '../NeonCard';
import { motion, AnimatePresence } from 'framer-motion';

const CHECKLIST_ITEMS = [
  {
    id: 'manuscript-format',
    title: '原稿ファイルの形式確認（docx推奨）',
    description: 'KDPはdocx形式を推奨。epubも可だがdocxの方がトラブルが少なく、初心者には安全策。',
    link: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G200634390',
    linkLabel: 'KDP対応形式一覧',
  },
  {
    id: 'font-size',
    title: 'フォント・文字サイズの設定確認',
    description: '游明朝 or Noto Serif JPが安牌。文字サイズは10.5〜12pt。特殊フォントは埋め込みエラーの原因に。',
    link: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G200645680',
    linkLabel: 'フォーマットガイド',
  },
  {
    id: 'kdp-select',
    title: 'KDPセレクト登録（必須）',
    description: '70%ロイヤリティの条件。Kindle Unlimitedにも配信される。90日間の独占配信契約。',
    link: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G200798990',
    linkLabel: 'KDPセレクトについて',
  },
  {
    id: 'category',
    title: 'カテゴリー設定（実在確認済み）',
    description: 'AIが提案したカテゴリーがKDPに存在するか必ず確認。存在しないカテゴリーは設定できない。',
    link: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G200652170',
    linkLabel: 'カテゴリー設定ガイド',
  },
  {
    id: 'keywords',
    title: 'キーワード7つ設定',
    description: 'Amazon検索で見つけてもらうための命綱。「ジャンル名 + 読者の悩み」で設定するのが鉄板。',
    link: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G201484410',
    linkLabel: 'キーワードガイド',
  },
  {
    id: 'ai-disclosure',
    title: 'AI生成コンテンツの申告',
    description: 'AI利用の有無を正直に申告。2024年以降、Amazonは厳格化。虚偽申告はアカウント停止リスク。',
    link: 'https://kdp.amazon.co.jp/ja_JP/help/topic/GQ4WBMRE5545MMLX',
    linkLabel: 'AI利用ガイドライン',
  },
  {
    id: 'royalty',
    title: 'ロイヤリティ70%選択',
    description: 'KDPセレクト加入 + 価格250〜1250円の条件で70%。条件を満たさないと35%になる。',
    link: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G200634560',
    linkLabel: 'ロイヤリティ詳細',
  },
  {
    id: 'drm',
    title: 'DRM適用設定',
    description: 'デジタル著作権管理。コピー防止のため基本ONを推奨。一度設定すると変更不可。',
    link: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G200652510',
    linkLabel: 'DRM設定について',
  },
  {
    id: 'preview',
    title: 'プレビューアーで表示確認',
    description: 'Kindle Previewerで全ページ確認。目次リンク、画像表示、改ページを重点チェック。',
    link: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G202131170',
    linkLabel: 'Kindle Previewer',
  },
  {
    id: 'pricing',
    title: '価格設定（発売5日間99円キャンペーン）',
    description: '初動の売上ランキングを押し上げるための戦略価格。5日後に正規価格（480〜980円）に変更。',
    link: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G201834170',
    linkLabel: '価格設定ガイド',
  },
];

const STORAGE_KEY = 'up-kindle-checklist';

export default function ChecklistTab() {
  const [checked, setChecked] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked]);

  const toggleItem = (id) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetAll = () => setChecked({});

  const completedCount = Object.values(checked).filter(Boolean).length;
  const progress = (completedCount / CHECKLIST_ITEMS.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <NeonCard glowColor="pink">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-neon-pink" />
            <span className="font-bold text-sm">入稿進捗</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {completedCount} / {CHECKLIST_ITEMS.length} 完了
            </span>
            <Button variant="ghost" size="sm" onClick={resetAll} className="h-7 text-xs text-muted-foreground hover:text-neon-pink">
              <RotateCcw className="w-3 h-3 mr-1" />
              リセット
            </Button>
          </div>
        </div>
        <Progress value={progress} className="h-2 bg-secondary [&>div]:bg-neon-pink" />
        {progress === 100 && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-sm mt-3 neon-pink-glow text-neon-pink font-bold"
          >
            全項目クリア！入稿準備完了だ。さあ、世界に放て。
          </motion.p>
        )}
      </NeonCard>

      {/* Checklist items */}
      <div className="space-y-3">
        <AnimatePresence>
          {CHECKLIST_ITEMS.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div
                className={`bg-card border rounded-lg p-4 transition-all duration-300 cursor-pointer group ${
                  checked[item.id]
                    ? 'border-neon-pink/30 bg-neon-pink/5'
                    : 'border-border hover:border-neon-pink/20'
                }`}
                onClick={() => toggleItem(item.id)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={!!checked[item.id]}
                    onCheckedChange={() => toggleItem(item.id)}
                    className="mt-0.5 border-neon-pink/50 data-[state=checked]:bg-neon-pink data-[state=checked]:border-neon-pink"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold transition-colors ${checked[item.id] ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {item.title}
                    </p>
                    <div className="flex items-start gap-1.5 mt-2">
                      <Info className="w-3 h-3 text-neon-cyan mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-neon-cyan hover:text-neon-pink transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {item.linkLabel}
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}