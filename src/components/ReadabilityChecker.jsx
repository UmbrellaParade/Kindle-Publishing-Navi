import React, { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, Loader2, Upload, Copy, Check,
  AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import NeonCard from './NeonCard';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const CHECK_LABELS = {
  line_breaks: '改行・息継ぎ',
  dialogue: 'セリフの統一感',
  kindle_readability: 'Kindle可読性',
  quote_blocks: '引用ブロック',
  links: 'リンクの表記',
  paragraph_length: '段落の長さ',
};

const SEVERITY_CONFIG = {
  ok:      { icon: CheckCircle2, color: 'text-green-500',    bg: 'bg-green-500/10 border-green-500/20',  label: '問題なし' },
  warning: { icon: AlertTriangle, color: 'text-neon-amber',  bg: 'bg-neon-amber/10 border-neon-amber/20', label: '要確認' },
  error:   { icon: XCircle,       color: 'text-neon-red',    bg: 'bg-neon-red/10 border-neon-red/20',     label: '要修正' },
};

function CheckResultItem({ checkKey, item }) {
  const [open, setOpen] = useState(item.severity !== 'ok');
  const cfg = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.warning;
  const Icon = cfg.icon;

  return (
    <div className={`rounded-md border ${cfg.bg} overflow-hidden`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
        <span className="text-sm font-bold flex-1">{CHECK_LABELS[checkKey] || checkKey}</span>
        <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${cfg.color} border-current`}>
          {cfg.label}
        </Badge>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-current/10 pt-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{item.comment}</p>
              {item.suggestion && (
                <div className="bg-black/20 rounded p-2.5">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">修正案</p>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{item.suggestion}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ReadabilityChecker() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copiedRevised, setCopiedRevised] = useState(false);
  const [showRevised, setShowRevised] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) {
      toast.error('.txtファイルのみ対応しています');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setText(ev.target.result || '');
    reader.readAsText(file, 'UTF-8');
  };

  const analyze = async () => {
    if (text.trim().length < 50) return;
    setLoading(true);
    setResult(null);
    setShowRevised(false);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `あなたはKindle電子書籍の編集者です。以下の小説テキストを6項目でチェックし、Kindle向けに最適化された修正後テキストも生成してください。

【テキスト】
${text.slice(0, 4000)}

【チェック観点】
1. line_breaks: セリフ前後の空行、場面転換の区切り
2. dialogue: 「」の使い方、セリフと地の文の切り替えの統一
3. kindle_readability: スマホ・電子ペーパーでの読みやすさ（一段落の行数、漢字の密度など）
4. quote_blocks: 引用ブロック（>形式）や特殊表記の統一感
5. links: URLリンクの表記、Spotifyなど楽曲リンクの配置
6. paragraph_length: 長すぎる段落（5行以上の連続テキスト）の有無

各項目を severity（ok/warning/error）、comment（問題の説明）、suggestion（修正案）で評価してください。
修正後テキストはKindle読者が最も読みやすい形に整えてください。`,
      response_json_schema: {
        type: 'object',
        properties: {
          checks: {
            type: 'object',
            properties: {
              line_breaks:        { type: 'object', properties: { severity: { type: 'string', enum: ['ok','warning','error'] }, comment: { type: 'string' }, suggestion: { type: 'string' } } },
              dialogue:           { type: 'object', properties: { severity: { type: 'string', enum: ['ok','warning','error'] }, comment: { type: 'string' }, suggestion: { type: 'string' } } },
              kindle_readability: { type: 'object', properties: { severity: { type: 'string', enum: ['ok','warning','error'] }, comment: { type: 'string' }, suggestion: { type: 'string' } } },
              quote_blocks:       { type: 'object', properties: { severity: { type: 'string', enum: ['ok','warning','error'] }, comment: { type: 'string' }, suggestion: { type: 'string' } } },
              links:              { type: 'object', properties: { severity: { type: 'string', enum: ['ok','warning','error'] }, comment: { type: 'string' }, suggestion: { type: 'string' } } },
              paragraph_length:   { type: 'object', properties: { severity: { type: 'string', enum: ['ok','warning','error'] }, comment: { type: 'string' }, suggestion: { type: 'string' } } },
            },
          },
          overall_score: { type: 'number', description: '0〜100の総合スコア' },
          overall_comment: { type: 'string', description: '総合評価コメント（1〜2文）' },
          revised_text: { type: 'string', description: '修正後テキスト（元テキストが4000文字以内の場合は全文、それ以外は冒頭部分）' },
        },
      },
      model: 'claude_sonnet_4_6',
    });

    setResult(res);
    setLoading(false);
  };

  const copyRevised = () => {
    if (!result?.revised_text) return;
    navigator.clipboard.writeText(result.revised_text);
    setCopiedRevised(true);
    toast.success('修正後テキストをコピーしました');
    setTimeout(() => setCopiedRevised(false), 2000);
  };

  const errorCount  = result ? Object.values(result.checks || {}).filter(c => c.severity === 'error').length : 0;
  const warningCount= result ? Object.values(result.checks || {}).filter(c => c.severity === 'warning').length : 0;
  const okCount     = result ? Object.values(result.checks || {}).filter(c => c.severity === 'ok').length : 0;
  const score       = result?.overall_score ?? null;
  const scoreColor  = score >= 80 ? 'text-green-500' : score >= 60 ? 'text-neon-amber' : 'text-neon-red';

  return (
    <NeonCard glowColor="pink">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-4 h-4 text-neon-pink" />
        <h3 className="font-bold text-sm text-neon-pink neon-pink-glow">小説 読みやすさチェック＆修正</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        本文をペーストまたは.txtアップロードするとAIが6項目でチェックし、修正後テキストも生成します。
      </p>

      {/* Input area */}
      <div className="space-y-2">
        <Textarea
          placeholder="小説本文をここにペースト（改行・セリフ・段落含む冒頭部分が最適）..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[160px] bg-secondary border-border focus:border-neon-pink/50 text-sm resize-none leading-relaxed font-body"
        />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{text.length}文字</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs text-neon-cyan hover:text-neon-pink transition-colors bg-secondary px-2.5 py-1.5 rounded-md"
            >
              <Upload className="w-3 h-3" />.txtアップロード
            </button>
            <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
            {text.length > 0 && (
              <button
                onClick={() => { setText(''); setResult(null); }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-neon-red transition-colors"
              >
                <RefreshCw className="w-3 h-3" />クリア
              </button>
            )}
          </div>
          <Button
            onClick={analyze}
            disabled={loading || text.trim().length < 50}
            className="bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30 text-xs h-8 disabled:opacity-40"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />チェック中...</>
            ) : (
              <><ShieldCheck className="w-3.5 h-3.5 mr-1.5" />チェック＆修正する</>
            )}
          </Button>
        </div>
      </div>

      {/* Note */}
      <p className="text-[10px] text-muted-foreground mt-1">
        ※ このチェックはAIによる提案です。最終的な判断は著者自身が行ってください。
      </p>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-4"
          >
            {/* Score bar */}
            <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/60 border border-border">
              <div className="text-center flex-shrink-0">
                <p className={`text-3xl font-heading font-black ${scoreColor}`}>{score}</p>
                <p className="text-[10px] text-muted-foreground">/ 100</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold mb-1 text-foreground">総合スコア</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{result.overall_comment}</p>
                <div className="flex gap-3 mt-2">
                  {errorCount > 0   && <span className="text-[10px] text-neon-red font-bold">要修正 {errorCount}件</span>}
                  {warningCount > 0 && <span className="text-[10px] text-neon-amber font-bold">要確認 {warningCount}件</span>}
                  {okCount > 0      && <span className="text-[10px] text-green-500 font-bold">問題なし {okCount}件</span>}
                </div>
              </div>
            </div>

            {/* Check items */}
            <div className="space-y-2">
              {Object.entries(result.checks || {}).map(([key, item]) => (
                <CheckResultItem key={key} checkKey={key} item={item} />
              ))}
            </div>

            {/* Revised text */}
            {result.revised_text && (
              <div className="rounded-lg border border-neon-cyan/20 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-neon-cyan/5 hover:bg-neon-cyan/10 transition-colors"
                  onClick={() => setShowRevised((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-neon-cyan" />
                    <span className="text-sm font-bold text-neon-cyan">修正後テキストを見る</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-neon-cyan hover:bg-neon-cyan/20"
                      onClick={(e) => { e.stopPropagation(); copyRevised(); }}
                    >
                      {copiedRevised ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      コピー
                    </Button>
                    {showRevised ? <ChevronUp className="w-3.5 h-3.5 text-neon-cyan" /> : <ChevronDown className="w-3.5 h-3.5 text-neon-cyan" />}
                  </div>
                </button>
                <AnimatePresence>
                  {showRevised && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <pre className="p-4 text-xs text-foreground leading-relaxed whitespace-pre-wrap font-body bg-secondary/30 max-h-96 overflow-y-auto">
                        {result.revised_text}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </NeonCard>
  );
}
