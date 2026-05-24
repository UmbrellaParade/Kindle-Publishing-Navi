import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Cpu, Loader2, Link2, MessageSquare, BookOpen, LayoutList, Sparkles } from 'lucide-react';
import NeonCard from '../NeonCard';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

function AnalysisItem({ icon: Icon, label, value, color = 'text-muted-foreground' }) {
  return (
    <div className="flex items-start gap-2.5 bg-secondary/50 rounded-md p-3">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-xs text-foreground leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

export default function TextAnalyzer() {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!text.trim() || text.trim().length < 50) return;
    setLoading(true);
    setResult(null);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `あなたはKindle出版の専門家です。以下の小説テキストを分析して、最適なKDPフォーマット（docx or epub）を提案してください。

テキスト:
"""
${text.slice(0, 3000)}
"""

以下のJSONスキーマで回答してください。`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommended_format: { type: 'string', enum: ['docx', 'epub'] },
          style: { type: 'string', description: '文体の特徴（例：ラノベ調、純文学調、会話重視など）' },
          has_urls: { type: 'boolean', description: 'URLや外部リンクの言及があるか' },
          dialogue_ratio: { type: 'string', description: 'セリフの多さ（多め・普通・少なめ）' },
          chapter_structure: { type: 'string', description: '章構成の特徴' },
          reasoning: { type: 'string', description: 'フォーマット推奨の理由（2〜3文で）' },
          additional_tips: { type: 'string', description: 'KDP入稿時のアドバイス（1〜2文）' },
        },
      },
    });

    setResult(res);
    setLoading(false);
  };

  return (
    <NeonCard glowColor="cyan">
      <div className="flex items-center gap-2 mb-1">
        <Cpu className="w-4 h-4 text-neon-cyan" />
        <h3 className="font-bold text-sm text-neon-cyan neon-cyan-glow">テキスト解析 — AI自動フォーマット判定</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        小説の一部（100文字以上）をペーストすると、AIが文体・リンク・章構成を分析して最適フォーマットを提案します。
      </p>

      <Textarea
        placeholder="ここに小説のテキストをペーストしてください（冒頭部分・1章分など）..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[140px] bg-secondary border-border focus:border-neon-cyan/50 text-sm resize-none mb-3 leading-relaxed"
      />

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{text.length} 文字</span>
        <Button
          onClick={analyze}
          disabled={loading || text.trim().length < 50}
          className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 text-xs h-8"
        >
          {loading ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />解析中...</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5 mr-1.5" />AIで解析する</>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 space-y-3"
          >
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/80 border border-neon-cyan/20">
              <p className="text-xs text-muted-foreground">判定結果</p>
              <Badge className={`font-heading font-bold text-sm px-3 py-1 ${result.recommended_format === 'epub' ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40' : 'bg-neon-pink/20 text-neon-pink border border-neon-pink/40'}`}>
                {result.recommended_format}
              </Badge>
              <p className="text-xs flex-1 text-foreground leading-relaxed">{result.reasoning}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <AnalysisItem icon={BookOpen} label="文体" value={result.style} color="text-neon-pink" />
              <AnalysisItem icon={MessageSquare} label="セリフ量" value={result.dialogue_ratio} color="text-neon-amber" />
              <AnalysisItem icon={Link2} label="外部リンクの言及" value={result.has_urls ? 'あり → epubを強く推奨' : 'なし → docxで問題なし'} color={result.has_urls ? 'text-neon-cyan' : 'text-muted-foreground'} />
              <AnalysisItem icon={LayoutList} label="章構成" value={result.chapter_structure} color="text-neon-cyan" />
            </div>

            {result.additional_tips && (
              <div className="bg-neon-amber/5 border border-neon-amber/20 rounded-md p-3">
                <p className="text-[10px] text-neon-amber uppercase tracking-wide mb-1">KDP入稿アドバイス</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{result.additional_tips}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </NeonCard>
  );
}