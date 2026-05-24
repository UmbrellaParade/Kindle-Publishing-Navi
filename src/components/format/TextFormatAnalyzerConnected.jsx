import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  ScanText, Loader2, FileText, ChevronRight, BarChart2,
  CheckCircle2, AlertTriangle, Link2
} from 'lucide-react';
import NeonCard from '../NeonCard';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';

function AnalysisChip({ label, value }) {
  return (
    <div className="bg-secondary/50 rounded-md p-2.5">
      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}

export default function TextFormatAnalyzerConnected({ sharedText }) {
  const [hasExtUrl, setHasExtUrl] = useState(null);   // null | true | false
  const [hasMusicUrl, setHasMusicUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // sharedTextが変わったらリセット
  useEffect(() => { setResult(null); }, [sharedText]);

  const hasUrlFlag = hasExtUrl === true || hasMusicUrl === true;
  const bothAnswered = hasExtUrl !== null && hasMusicUrl !== null;

  const analyze = async () => {
    if (!bothAnswered) return;
    // URLありの場合はAI不要で即断定
    if (hasUrlFlag) return;

    const text = sharedText.trim();
    if (text.length < 50) return;
    setLoading(true);
    setResult(null);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `あなたはKindle電子書籍のフォーマット専門家です。以下の小説テキストを分析し、KDP入稿に最適なフォーマットを提案してください。

【分析するテキスト】
${text.slice(0, 2000)}

分析観点：
1. 文体分析（ラノベ調 / 純文学調 / エッセイ調 / ビジネス文体 など）
2. セリフ量（多い / 普通 / 少ない）
3. 縦書き vs 横書きの判断
4. docx vs epubの推奨（※URLリンクなしの前提で判定）

JSONで返してください。`,
      response_json_schema: {
        type: 'object',
        properties: {
          format_recommendation: { type: 'string', description: 'docx または epub' },
          direction: { type: 'string', description: '縦書き または 横書き' },
          style_analysis: { type: 'string' },
          dialogue_ratio: { type: 'string' },
          reasons: { type: 'array', items: { type: 'string' } },
          categories: { type: 'array', items: { type: 'string' } },
          one_point_advice: { type: 'string' },
        },
      },
    });

    setResult(res);
    setLoading(false);
  };

  const isDocxRecommended = result?.format_recommendation?.toLowerCase().includes('docx');
  const isEpubRecommended = result?.format_recommendation?.toLowerCase().includes('epub') && !isDocxRecommended;

  return (
    <NeonCard glowColor="cyan">
      <div className="flex items-center gap-2 mb-1">
        <ScanText className="w-4 h-4 text-neon-cyan" />
        <h3 className="font-bold text-sm text-neon-cyan neon-cyan-glow">ステップ2：フォーマット自動判定（URLリンクなしの場合）</h3>
      </div>

      {/* 対象者ガイド */}
      <div className="space-y-2 mb-4 mt-2">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-neon-amber/10 border border-neon-amber/30">
          <AlertTriangle className="w-4 h-4 text-neon-amber flex-shrink-0 mt-0.5" />
          <p className="text-xs text-neon-amber leading-relaxed font-medium">
            本文にURLリンク（楽曲・サイト等）が含まれる方 → docx確定のため、<span className="underline">このステップは不要です。ステップ3へ進んでください。</span>
          </p>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-green-400 leading-relaxed font-medium">
            URLリンクが含まれない方 → 以下でテキストを解析し、最適なフォーマットを自動判定します。
          </p>
        </div>
      </div>

      {/* ── 事前質問 ─────────────────────────────── */}
      <div className="space-y-3 mb-4">
        <p className="text-xs font-bold text-foreground">念のため確認（Yes/Noを選んでください）</p>

        <CheckQuestion
          label="本文中に外部URLリンク（楽曲サイト・公式サイト等へのリンク）が含まれていますか？"
          value={hasExtUrl}
          onChange={setHasExtUrl}
        />
        <CheckQuestion
          label="音楽・動画（Spotify / YouTube / Apple Music など）へのリンクを本文内に埋め込んでいますか？"
          value={hasMusicUrl}
          onChange={setHasMusicUrl}
        />
      </div>

      {/* ── ステップ2: 即断定 or AI判定ボタン ─────────────── */}
      <AnimatePresence>
        {bothAnswered && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {hasUrlFlag ? (
              /* URL あり → 即断定 */
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-500 mb-1">✅ docx 一択です</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      本文にURLリンクが含まれる場合、Kindleではdocxがもっとも安定してリンクを動作させます。
                      epub変換時にリンクが失われるリスクがあるため、docxを強く推奨します。
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-neon-amber">
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Spotify / YouTube URLはdocx本文に直接テキストリンクとして記載するだけでKindleから開けます。</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* URL なし → AI判定ボタン */
              <div className="space-y-3">
                <div className="p-3 rounded-md bg-secondary/50 border border-border text-xs text-muted-foreground">
                  URLリンクなしと確認できました。AIがテキストを詳しく分析してdocx / epubを比較検討します。
                </div>
                <Button
                  onClick={analyze}
                  disabled={loading || sharedText.trim().length < 50}
                  className="w-full h-9 text-xs bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-40"
                >
                  {loading ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />分析中...</>
                  ) : (
                    <><ScanText className="w-3.5 h-3.5 mr-1.5" />AIフォーマット判定を実行</>
                  )}
                </Button>
                {sharedText.trim().length < 50 && (
                  <p className="text-[10px] text-muted-foreground text-center">※ 上の共通テキストエリアに本文を貼り付けると判定できます</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ステップ3: AI判定結果 ───────────────────────────── */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-3">

            {/* 判定結果 */}
            <div className={`p-3 rounded-md border ${isDocxRecommended ? 'bg-green-500/10 border-green-500/30' : 'bg-neon-cyan/5 border-neon-cyan/30'}`}>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">判定結果</p>
              <div className="flex items-center gap-2 flex-wrap">
                {isDocxRecommended && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                <span className={`text-sm font-bold ${isDocxRecommended ? 'text-green-500' : 'text-neon-cyan neon-cyan-glow'}`}>
                  {isDocxRecommended ? '✅ docx 推奨' : result.format_recommendation}
                </span>
                <span className="text-xs text-muted-foreground">／</span>
                <span className="text-xs text-neon-amber">{result.direction}</span>
              </div>
            </div>

            {/* epub推奨の場合は必ず警告 */}
            {isEpubRecommended && (
              <div className="p-3 rounded-md bg-neon-amber/10 border border-neon-amber/40">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-neon-amber flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-neon-amber font-bold leading-relaxed">
                    ⚠️ ただし本文にURLリンクがある場合はdocxを選んでください。
                    epubはリンク消失リスクがあります。
                  </p>
                </div>
              </div>
            )}

            {/* Analysis chips */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <AnalysisChip label="文体" value={result.style_analysis} />
              <AnalysisChip label="セリフ量" value={result.dialogue_ratio} />
              <AnalysisChip label="組方向" value={result.direction} />
            </div>

            {result.reasons?.length > 0 && (
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

            {result.categories?.length > 0 && (
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

function CheckQuestion({ label, value, onChange }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3 border border-border">
      <p className="text-xs text-foreground mb-2 leading-relaxed">{label}</p>
      <div className="flex gap-3">
        <button
          onClick={() => onChange(true)}
          className={`flex-1 py-1.5 rounded-md text-xs font-bold border transition-colors ${
            value === true
              ? 'bg-neon-pink/20 text-neon-pink border-neon-pink/50'
              : 'text-muted-foreground border-border hover:border-neon-pink/30 hover:text-foreground'
          }`}
        >
          Yes（含まれる）
        </button>
        <button
          onClick={() => onChange(false)}
          className={`flex-1 py-1.5 rounded-md text-xs font-bold border transition-colors ${
            value === false
              ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50'
              : 'text-muted-foreground border-border hover:border-neon-cyan/30 hover:text-foreground'
          }`}
        >
          No（含まれない）
        </button>
      </div>
    </div>
  );
}