import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Link2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { loadExternalAiSettings, callExternalAi, PROVIDER_LABELS, extractJson } from '../../lib/externalAi';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const URL_REGEX = /https?:\/\/[^\s。、！？\]）)]+/;

export default function Step1FormatDecision({ sharedText }) {
  const internalAiAvailable = !base44.__isLocalFallback;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [aiProvider, setAiProvider] = useState(internalAiAvailable ? 'internal' : 'chatgpt');

  const hasUrl = URL_REGEX.test(sharedText);
  const canAnalyze = sharedText.trim().length >= 50;

  const handleAuto = async () => {
    setLoading(true);
    setResult(null);
    try {
      if (aiProvider === 'internal') {
        if (!internalAiAvailable) {
          toast.error('この公開版の内蔵AIは未接続です。外部AIを選び、ページ上部でAPIキーを設定してください');
          return;
        }
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `以下の原稿を分析して、このツールで出力するKindle出版フォーマット（docx か epub）の目安を提案してください。

判断の観点：
- 文章中心で、出力後にWordで編集したい場合はdocx
- ｜漢字《かな》形式のルビをHTML rubyタグへ変換して確認したい場合はepub
- 見出し、表、画像、脚注、リンク、特殊な字組みなど、本文以外の構造
- URLの有無だけで形式を決めない
- 貼り付けテキストから確認できない画像やレイアウトは、最終確認が必要と明記する

原稿：
${sharedText.slice(0, 2000)}

以下を返してください：
- recommendation: "docx" または "epub"
- reason: 推奨理由（1〜2文）
- has_special_layout: 特殊レイアウト（図・表・詩の特殊組版）が必要かどうか（true/false）`,
          response_json_schema: {
            type: 'object',
            properties: {
              recommendation: { type: 'string' },
              reason: { type: 'string' },
              has_special_layout: { type: 'boolean' },
            },
          },
        });
        setResult(res);
      } else {
        const settings = loadExternalAiSettings();
        const apiKey = aiProvider === 'chatgpt' ? settings.openaiApiKey
                     : aiProvider === 'gemini'  ? settings.geminiApiKey
                     : settings.claudeApiKey;
        if (!apiKey?.trim()) {
          toast.error(`${PROVIDER_LABELS[aiProvider]}のAPIキーをページ上部のAI設定から入力・保存してください`);
          setLoading(false);
          return;
        }
        const prompt = `以下の原稿を分析して、このツールで出力するKindle出版フォーマット（docx か epub）の目安を提案してください。
次のJSONだけを返してください（説明不要）:
{"recommendation": "docx", "reason": "推奨理由を1〜2文で", "has_special_layout": false}
recommendationは "docx" または "epub" のどちらか。
判断の観点は、文章中心でWord編集を続けるならdocx、｜漢字《かな》形式のルビをHTML rubyタグへ変換して確認するならepub。見出し・表・画像・脚注・リンク・特殊な字組みも考慮する。URLの有無だけで形式を決めない。貼り付けテキストでは画像やレイアウトを確認できない場合、その限界をreasonに含める。

原稿：
${sharedText.slice(0, 2000)}`;
        const text = await callExternalAi(aiProvider, settings, prompt);
        const parsed = extractJson(text);
        if (parsed) {
          setResult(parsed);
        } else {
          toast.error('AIの出力をJSON形式で読み取れませんでした');
        }
      }
    } catch (err) {
      toast.error('エラーが発生しました：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl p-4 space-y-4" style={CARD_STYLE}>
      {/* URL検出 */}
      {hasUrl && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.3)' }}>
          <AlertTriangle className="w-4 h-4 text-neon-amber flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-neon-amber">URLリンクが検出されました</p>
            <p className="text-xs text-muted-foreground mt-0.5">URLの有無だけでは形式は決まりません。どちらを選んでも、KDP登録前にKindle Previewerでリンク先と動作を確認してください。</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <div className="rounded-lg p-3" style={{ background: 'rgba(255,45,120,0.04)', border: '1px solid rgba(255,45,120,0.18)' }}>
          <p className="font-bold text-neon-pink mb-1">docxの目安</p>
          <p>実用書・エッセイ・小説などの文章中心の原稿を、出力後にWordでも調整したい場合。</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.18)' }}>
          <p className="font-bold text-neon-cyan mb-1">epubの目安</p>
          <p>ルビをHTML形式へ変換し、リフロー型の文書構造を確認したい場合。</p>
        </div>
      </div>

      <div className="space-y-3">
          <p className="text-xs text-muted-foreground">原稿の文章と構造から、AIで出力形式の目安を確認できます。絵本・マンガ・写真集など画像や固定レイアウトが中心の本は、テキスト判定だけで確定せずKDP公式ガイドも確認してください。</p>

          {/* AI選択 */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">使用するAI</p>
            <div className="flex flex-wrap gap-2">
              {[
                ...(internalAiAvailable ? [{ id: 'internal', label: 'このアプリのAI', sub: 'APIキー不要' }] : []),
                { id: 'chatgpt',  label: 'ChatGPT',        sub: 'OpenAI API' },
                { id: 'gemini',   label: 'Gemini',          sub: 'Google API' },
                { id: 'claude',   label: 'Claude',          sub: 'Anthropic API' },
              ].map(({ id, label, sub }) => (
                <button key={id} type="button" onClick={() => setAiProvider(id)}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors text-left ${
                    aiProvider === id
                      ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50 font-bold'
                      : 'text-muted-foreground border-border hover:text-foreground font-medium'
                  }`}
                  style={aiProvider !== id ? { background: 'rgba(255,255,255,0.04)' } : {}}
                >
                  {label}
                  <span className="block text-[9px] opacity-60 font-normal">{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {!internalAiAvailable && (
            <p className="text-[10px] text-neon-amber">公開版の内蔵AIは未接続です。利用する外部AIのAPIキーを、ページ上部の「AI設定」で保存してください。</p>
          )}

          <Button onClick={handleAuto} disabled={loading || !canAnalyze} className="w-full h-9 text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 disabled:opacity-40">
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />判定中...</>
              : `${aiProvider === 'internal' ? 'AI' : PROVIDER_LABELS[aiProvider]}で自動判定する`}
          </Button>
          {!canAnalyze && <p className="text-[10px] text-muted-foreground">上部に本文を入力してください</p>}
      </div>

      {/* AI判定結果 */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2a4a' }}>
            <p className="text-xs font-bold mb-1">
              AI判定：<span className={result.recommendation === 'docx' ? 'text-neon-pink' : 'text-neon-cyan'}>{result.recommendation}形式を推奨</span>
            </p>
            <p className="text-xs text-muted-foreground">{result.reason}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* リンク */}
      <div className="flex flex-wrap gap-2 pt-1">
        <a href="https://kdp.amazon.co.jp/ja_JP/help/topic/G200645680" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] text-neon-cyan hover:text-neon-pink transition-colors px-2.5 py-1.5 rounded-md" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <Link2 className="w-3 h-3" />KDP公式フォーマットガイド
        </a>
      </div>
    </div>
  );
}
