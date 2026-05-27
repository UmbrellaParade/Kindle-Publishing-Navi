import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertTriangle, Link2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { loadExternalAiSettings, callExternalAi, PROVIDER_LABELS, extractJson } from '../../lib/externalAi';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const URL_REGEX = /https?:\/\/[^\s。、！？\]）)]+/;

export default function Step1FormatDecision({ sharedText }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [aiProvider, setAiProvider] = useState('internal');

  const hasUrl = URL_REGEX.test(sharedText);
  const canAnalyze = sharedText.trim().length >= 50;

  const handleAuto = async () => {
    setLoading(true);
    setResult(null);
    try {
      if (aiProvider === 'internal') {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `以下のテキストを分析して、Kindle出版フォーマット（docx か epub）を推奨してください。

テキスト：
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
        const prompt = `以下のテキストを分析して、Kindle出版フォーマット（docx か epub）を推奨してください。
次のJSONだけを返してください（説明不要）:
{"recommendation": "docx", "reason": "推奨理由を1〜2文で", "has_special_layout": false}
recommendationは "docx" または "epub" のどちらか。

テキスト：
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
            <p className="text-xs font-bold text-neon-amber">⚠️ URLリンクが検出されました</p>
            <p className="text-xs text-muted-foreground mt-0.5">楽曲URL・外部URLがある場合は <strong className="text-neon-pink">docx形式を推奨</strong> します。epubでは埋め込み不可です。</p>
          </div>
        </div>
      )}

      {/* docx確定（URL有り） */}
      {hasUrl ? (
        <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'rgba(255,45,120,0.06)', border: '1px solid rgba(255,45,120,0.3)' }}>
          <CheckCircle className="w-4 h-4 text-neon-pink flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-neon-pink">✅ docx形式を推奨します（確定）</p>
            <p className="text-xs text-muted-foreground mt-0.5">URLリンクがある作品はdocx一択です。変換エラーリスクも低く、楽曲リンク埋め込みにも最適。</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">本文に外部URLリンク（楽曲リンク等）が含まれていません。AIで自動判定することもできます。</p>

          {/* AI選択 */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">使用するAI</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'internal', label: 'このアプリのAI', sub: 'APIキー不要' },
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

          <Button onClick={handleAuto} disabled={loading || !canAnalyze} className="w-full h-9 text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 disabled:opacity-40">
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />判定中...</>
              : `${aiProvider === 'internal' ? 'AI' : PROVIDER_LABELS[aiProvider]}で自動判定する`}
          </Button>
          {!canAnalyze && <p className="text-[10px] text-muted-foreground">上部に本文を入力してください</p>}
        </div>
      )}

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
