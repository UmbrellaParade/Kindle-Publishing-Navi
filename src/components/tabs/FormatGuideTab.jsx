import React, { useState, useRef, useEffect } from 'react';
import { Upload, RefreshCw, ChevronDown, ChevronUp, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const LS_KEY = 'format_guide_state';

import Step1FormatDecision from '../format/Step1FormatDecision';
import Step2GenreDiagnosis from '../format/Step2GenreDiagnosis';
import Step3RubyEditor from '../format/Step3RubyEditor';
import Step4ReadabilityCheck from '../format/Step4ReadabilityCheck';
import Step5Export from '../format/Step5Export';
import ExternalAiWorkspace from '../format/ExternalAiWorkspace';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };

export default function FormatGuideTab() {
  const [sharedText, setSharedText] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [diagnosedGenre, setDiagnosedGenre] = useState('');
  const [versionState, setVersionState] = useState(null);
  const fileInputRef = useRef(null);

  // localStorageから復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sharedText) { setSharedText(parsed.sharedText); setIsExpanded(false); }
        if (parsed.diagnosedGenre) setDiagnosedGenre(parsed.diagnosedGenre);
      }
    } catch {}
  }, []);

  // sharedText/diagnosedGenreが変わったら保存
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ sharedText, diagnosedGenre })); } catch {}
  }, [sharedText, diagnosedGenre]);

  const handleReset = () => {
    setSharedText(''); setIsExpanded(true); setDiagnosedGenre(''); setVersionState(null);
    try { localStorage.removeItem(LS_KEY); } catch {}
    toast.success('リセットしました');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) { toast.error('.txtファイルのみ対応しています'); return; }
    const reader = new FileReader();
    reader.onload = ev => { setSharedText(ev.target.result || ''); setIsExpanded(false); toast.success('テキストを読み込みました'); };
    reader.readAsText(file, 'UTF-8');
  };

  const isReady = sharedText.trim().length >= 50;

  return (
    <div className="space-y-6">
      {/* 共通テキスト入力 */}
      <div className="rounded-xl p-4" style={CARD_STYLE}>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-neon-pink" />
          <h3 className="font-bold text-sm text-neon-pink neon-pink-glow">原稿を貼り付けてください</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">ここに本文を貼ると、以下の全ステップ（フォーマット判定・ジャンル診断・ルビ・読みやすさ・出力）が連動します。</p>

        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <textarea
                placeholder={`小説本文をここにペーストしてください（50文字以上）\n\n例：\n　雨は止まなかった。\n「また雨か」とヴェルは呟いた。天律の加護も、今夜は薄い。`}
                value={sharedText}
                onChange={e => { setSharedText(e.target.value); if (e.target.value.length > 100) setIsExpanded(false); }}
                className="w-full min-h-[140px] px-3 py-2.5 text-sm rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a4a' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {isReady
              ? <span className="text-xs text-neon-pink font-bold">{sharedText.length.toLocaleString()}文字 ✓ 準備完了</span>
              : <span className="text-xs text-muted-foreground">{sharedText.length}文字（50文字以上で各機能が有効）</span>
            }
            <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs text-neon-cyan hover:text-neon-pink transition-colors px-2.5 py-1.5 rounded-md" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Upload className="w-3 h-3" />.txtから読み込む
            </button>
            <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
            {sharedText.length > 0 && (
              <button onClick={() => { setSharedText(''); setIsExpanded(true); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-neon-red transition-colors">
                <RefreshCw className="w-3 h-3" />クリア
              </button>
            )}
          </div>
          {sharedText.length > 0 && (
            <button onClick={() => setIsExpanded(v => !v)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {isExpanded ? '折りたたむ' : '編集する'}
            </button>
          )}
        </div>
      </div>

      {/* ステップ1：フォーマット判定 */}
      <StepWrapper n="1" label="フォーマット判定" color="cyan">
        <Step1FormatDecision sharedText={sharedText} />
      </StepWrapper>

      {/* ステップ2：ジャンル診断 */}
      <StepWrapper n="2" label="ジャンル診断 → KDPカテゴリー提案" color="pink">
        <Step2GenreDiagnosis sharedText={sharedText} onDiagnosed={setDiagnosedGenre} />
      </StepWrapper>

      {/* ステップ3：ルビ付け */}
      <StepWrapper n="3" label="ルビ自動付与 → 手動修正 → コピー" color="pink">
        <Step3RubyEditor sharedText={sharedText} onVersionChange={setVersionState} />
      </StepWrapper>

      <ExternalAiWorkspace
        sharedText={sharedText}
        onDiagnosed={setDiagnosedGenre}
        onVersionChange={setVersionState}
      />

      {/* ステップ4：読みやすさチェック */}
      <StepWrapper n="4" label="読みやすさチェック → ベストセラー比較＆修正" color="amber">
        <Step4ReadabilityCheck sharedText={sharedText} diagnosedGenre={diagnosedGenre} onVersionChange={setVersionState} />
      </StepWrapper>

      {/* ステップ5：出力 */}
      <StepWrapper n="5" label="出力（docx / epub）" color="cyan">
        <Step5Export sharedText={sharedText} versionState={versionState} />
      </StepWrapper>

      {/* docx vs epub 比較ガイド */}
      <ComparisonGuide />

      {/* リセットボタン */}
      <div className="flex justify-center pt-4 pb-2">
        <Button variant="ghost" onClick={handleReset} className="h-8 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-1.5 border border-destructive/20">
          <Trash2 className="w-3.5 h-3.5" />全データをリセット（入力テキスト・診断結果を削除）
        </Button>
      </div>
    </div>
  );
}

function ComparisonGuide() {
  const rows = [
    { item: '向いている使い方', docx: '手軽にKDPへ登録したい', epub: 'ルビやレイアウトを細かく確認したい' },
    { item: 'URLリンクの安定性', docx: '✅ 安定（推奨）', epub: '⚠️ 確認必須' },
    { item: 'Kindle Unlimitedへの対応', docx: '✅ 対応', epub: '✅ 対応' },
    { item: 'レイアウトの自由度', docx: '✅ 高い', epub: '△ リフロー型' },
    { item: 'Kindleプレビューアーでの確認', docx: '✅ 推奨', epub: '✅ 推奨' },
    { item: 'KDPでの使いやすさ', docx: '⭐⭐⭐（まずはこちら）', epub: '⭐⭐（確認できる人向け）' },
    { item: 'ルビ（ふりがな）の扱い', docx: '｜漢字《かな》 の記法で出力', epub: 'HTML rubyタグに変換' },
    { item: '挿入画像', docx: '✅ 対応', epub: '✅ 対応' },
    { item: 'ファイルサイズ', docx: '小〜中', epub: '小' },
  ];
  return (
    <div className="rounded-xl p-4 space-y-4" style={{ background: '#1a1a2e', border: '1px solid #2a2a4a' }}>
      <h3 className="text-sm font-bold text-neon-cyan neon-cyan-glow">📊 このツールでの docx / epub 比較ガイド</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 text-muted-foreground font-bold border-b" style={{ borderColor: '#2a2a4a' }}>項目</th>
              <th className="text-left py-2 px-3 text-neon-pink font-bold border-b" style={{ borderColor: '#2a2a4a' }}>.docx</th>
              <th className="text-left py-2 px-3 text-neon-cyan font-bold border-b" style={{ borderColor: '#2a2a4a' }}>.epub</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                <td className="py-2 px-3 text-muted-foreground border-b" style={{ borderColor: '#2a2a4a' }}>{r.item}</td>
                <td className="py-2 px-3 text-foreground border-b" style={{ borderColor: '#2a2a4a' }}>{r.docx}</td>
                <td className="py-2 px-3 text-foreground border-b" style={{ borderColor: '#2a2a4a' }}>{r.epub}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-1.5 pt-1">
        <p className="text-xs text-neon-pink font-bold">✅ 迷ったらdocx、ルビ表示まで確認したい場合はepubが目安です。</p>
        <p className="text-xs text-muted-foreground">📌 どちらもKDP登録前にKindle Previewerで崩れ・リンク・ルビ表示を確認してください。</p>
      </div>
    </div>
  );
}

function StepWrapper({ n, label, color, children }) {
  const cls = {
    pink:  'bg-neon-pink/20 text-neon-pink border-neon-pink/40',
    cyan:  'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40',
    amber: 'bg-neon-amber/20 text-neon-amber border-neon-amber/40',
  }[color];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs font-black flex-shrink-0 ${cls}`}>{n}</span>
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
      </div>
      {children}
    </div>
  );
}
