import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScanText, Loader2, FileText, ChevronRight, BarChart2 } from 'lucide-react';
import NeonCard from './NeonCard';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';

const PLACEHOLDER = `ここに小説のテキストを貼り付けてください（200〜2000文字推奨）

例：
第一章　路地裏のレクイエム

 雨は止まなかった。
「また雨か」とヴェルは呟いた。黒い傘を片手に、ネオンの滲む路地裏を歩く。
 鼓膜に届くのは、遠くのライブハウスから漏れる音楽だった──`;

export default function TextFormatAnalyzer() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const analyze = async () => {
    if (!text.trim() || text.trim().length < 50) return;
    setLoading(true);
    setResult(null);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `あなたはKindle電子書籍のフォーマット専門家です。以下の小説テキストを分析し、KDP入稿に最適なフォーマットを日本語で提案してください。

【分析するテキスト】
${text}

以下の観点で分析してください：
1. 文体分析（ラノベ調 / 純文学調 / エッセイ調 / ビジネス文体 など）
2. セリフ量（多い / 普通 / 少ない）
3. 外部URLや楽曲リンクの有無
4. 縦書き vs 横書きの判断
5. docx vs epubの推奨

JSONで返してください。`,
      response_json_schema: {
        type: 'object',
        properties: {
          format_recommendation: { type: 'string' },
          direction: { type: 'string' },
          style_analysis: { type: 'string' },
          dialogue_ratio: { type: 'string' },
          has_external_links: { type: 'boolean' },
          reasons: { type: 'array', items: { type: 'string' } },
          categories: { type: 'array', items: { type: 'string' } },
          one_point_advice: { type: 'string' },
        },
      },
    });

    setResult(res);
    setLoading(false);
  };

  const charCount = text.length;
  const isReady = charCount >= 50;

  return (
    <NeonCard glowColor="cyan">
      <div className="flex items-center gap-2 mb-1">
        <ScanText className="w-4 h-4 text-neon-cyan" />
        <h3 className="font-bold text-sm text-neon-cyan neon-cyan-glow">テキスト読み込み → フォーマット自動判定</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        小説の一部をペーストするとAIが文体・構成を分析して最適なフォーマットを提案します。
      </p>

      <Textarea
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="bg-secondary border-border focus:border-neon-cyan/50 text-xs leading-relaxed resize-none h-36 font-body"
      />
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs ${isReady ? 'text-neon-cyan' : 'text-muted-foreground'}`}>
          {charCount}文字 {!isReady && '（50文字以上で判定可）'}
        </span>
        <Button
          size="sm"
          onClick={analyze}
          disabled={!isReady || loading}
          className="h-8 text-xs bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-40"
        >
          {loading ? (
            <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />分析中...</>
          ) : (
            <><ScanText className="w-3 h-3 mr-1.5" />フォーマット判定</>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 space-y-3"
          >
            {/* Main recommendation */}
            <div className="p-3 rounded-md bg-neon-cyan/5 border border-neon-cyan/30">
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">判定結果</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-neon-cyan neon-cyan-glow">
                  {result.format_recommendation}
                </span>
                <span className="text-xs text-muted-foreground">／</span>
                <span className="text-xs text-neon-amber">{result.direction}</span>
              </div>
            </div>

            {/* Analysis details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <AnalysisChip label="文体" value={result.style_analysis} />
              <AnalysisChip label="セリフ量" value={result.dialogue_ratio} />
              <AnalysisChip label="外部リンク" value={result.has_external_links ? 'あり（リンク埋め込み推奨）' : 'なし'} />
            </div>

            {/* Reasons */}
            {result.reasons && result.reasons.length > 0 && (
              <div className="bg-secondary/50 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <BarChart2 className="w-3.5 h-3.5 text-neon-pink" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">判定根拠</p>
                </div>
                <ul className="space-y-1.5">
                  {result.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <ChevronRight className="w-3 h-3 text-neon-pink mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground leading-relaxed">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested categories */}
            {result.categories && result.categories.length > 0 && (
              <div className="bg-secondary/50 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="w-3.5 h-3.5 text-neon-amber" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">提案KDPカテゴリー</p>
                </div>
                {result.categories.map((cat, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1">
                    <ChevronRight className="w-3 h-3 text-neon-amber mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-foreground">{cat}</p>
                  </div>
                ))}
              </div>
            )}

            {/* One point */}
            {result.one_point_advice && (
              <div className="p-3 rounded-md bg-neon-pink/5 border border-neon-pink/20">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-neon-pink font-bold">AIアドバイス：</span>
                  {result.one_point_advice}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </NeonCard>
  );
}

function AnalysisChip({ label, value }) {
  return (
    <div className="bg-secondary/50 rounded-md p-2.5">
      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}