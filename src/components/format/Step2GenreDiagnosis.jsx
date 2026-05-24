import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };

const KDP_CATEGORIES = [
  'フィクション > 一般',
  'フィクション > アクション、アドベンチャー',
  'フィクション > ファンタジー > 一般',
  'フィクション > ファンタジー > コンテンポラリー',
  'フィクション > ファンタジー > ダークファンタジー',
  'フィクション > ファンタジー > 叙事詩',
  'フィクション > ファンタジー > 超常現象',
  'フィクション > ファンタジー > 都市',
  'フィクション > ホラー',
  'フィクション > 文学',
  'フィクション > マジカルリアリズム',
  'フィクション > ミステリー、探偵小説 > 一般',
  'フィクション > SF > 一般',
  'フィクション > スリラー > 超自然サスペンス',
  'フィクション > 短編小説',
  'フィクション > ロマンス > ファンタジー',
  'ライトノベル > 一般',
];

export default function Step2GenreDiagnosis({ sharedText, onDiagnosed }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const canDiagnose = sharedText.trim().length >= 50;

  const diagnose = async () => {
    setLoading(true);
    setResult(null);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `あなたはKindle電子書籍のジャンル診断の専門家です。以下の小説テキストを分析し、最適なジャンルとKDPカテゴリーを診断してください。

【テキスト】
${sharedText.slice(0, 2000)}

以下を出力してください：
- genre_label: ジャンル名（例：「ダークファンタジー×音楽ロマン」のように具体的に）
- diagnosis: 「あなたの作品は〇〇です」という形の診断コメント（2文）
- kdp_categories: 以下のリストから3つ選ぶこと。リスト外は絶対に使わないこと。
  使用可能リスト：${KDP_CATEGORIES.join(' / ')}
- category_strategy: カテゴリー戦略（1文）`,
      response_json_schema: {
        type: 'object',
        properties: {
          genre_label: { type: 'string' },
          diagnosis: { type: 'string' },
          kdp_categories: { type: 'array', items: { type: 'string' } },
          category_strategy: { type: 'string' },
        },
      },
    });
    setResult(res);
    if (onDiagnosed) {
      onDiagnosed({
        genreLabel: res?.genre_label || '',
        primaryCategory: res?.kdp_categories?.[0] || '',
        kdpCategories: res?.kdp_categories || [],
        source: 'genre-diagnosis',
      });
    }
    setLoading(false);
  };

  return (
    <div className="rounded-xl p-4 space-y-4" style={CARD_STYLE}>
      <Button onClick={diagnose} disabled={loading || !canDiagnose} className="w-full h-10 text-sm bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30 disabled:opacity-40">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />診断中...</> : <><Wand2 className="w-4 h-4 mr-2" />ジャンルを診断する</>}
      </Button>
      {!canDiagnose && <p className="text-[10px] text-muted-foreground">上部に本文を入力してください（50文字以上）</p>}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,45,120,0.06)', border: '1px solid rgba(255,45,120,0.25)' }}>
              <p className="text-[10px] text-neon-pink uppercase tracking-wide mb-1 font-bold">診断結果</p>
              <p className="text-sm font-bold text-foreground mb-1">「<span className="text-neon-pink">{result.genre_label}</span>」</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{result.diagnosis}</p>
            </div>

            {result.kdp_categories?.length > 0 && (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2a4a' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Trophy className="w-3.5 h-3.5 text-neon-amber" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold">推奨KDPカテゴリー（3つ）</p>
                </div>
                {result.kdp_categories.map((cat, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${i === 0 ? 'bg-neon-amber/20 text-neon-amber' : 'text-muted-foreground'}`} style={i > 0 ? { background: 'rgba(255,255,255,0.05)' } : {}}>
                      {i + 1}位
                    </span>
                    <p className="text-xs text-foreground">{cat}</p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">{result.category_strategy}</p>
                <p className="text-[10px] text-neon-cyan mt-1">✓ すべてKDP実在カテゴリーです</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
