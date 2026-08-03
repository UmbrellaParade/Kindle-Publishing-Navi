import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Download, Upload, RefreshCw, ChevronDown, ChevronUp, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

import Step1FormatDecision from '../format/Step1FormatDecision';
import Step3RubyEditor from '../format/Step3RubyEditor';
import Step5Export from '../format/Step5Export';
import ExternalAiWorkspace from '../format/ExternalAiWorkspace';
import { scheduleCoordinatedSave } from '@/lib/saveCoordinator';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };

function getAuthorName(project) {
  if (typeof project?.author_name === 'string' && project.author_name.trim()) {
    return project.author_name.trim();
  }

  try {
    const checklist = project?.checklist_data ? JSON.parse(project.checklist_data) : {};
    const fields = checklist?._kdp_fields || {};
    const authorName = fields.t42_author_name || fields.author_name;
    return typeof authorName === 'string' ? authorName.trim() : '';
  } catch {
    return '';
  }
}

export default function FormatGuideTab({ project }) {
  const lsKey = `format_guide_state_${project?.id || 'global'}`;
  const authorName = getAuthorName(project);

  const [sharedText, setSharedText] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [versionState, setVersionState] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const [loadedStorageKey, setLoadedStorageKey] = useState('');
  const [storageError, setStorageError] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const fileInputRef = useRef(null);

  // プロジェクトが切り替わったらそのプロジェクトの保存データを読み込む
  useEffect(() => {
    setStorageReady(false);
    setLoadedStorageKey('');
    setStorageError('');
    setRecoveryKey('');
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.sharedText !== 'string') {
          throw new Error('保存形式が正しくありません');
        }
        setSharedText(parsed.sharedText || '');
        setIsExpanded(!parsed.sharedText);
      } else {
        setSharedText('');
        setIsExpanded(true);
      }
      setStorageReady(true);
      setLoadedStorageKey(lsKey);
    } catch (error) {
      const corruptKey = `format_guide_corrupt_backup_${project?.id || 'global'}`;
      try {
        const raw = localStorage.getItem(lsKey);
        if (raw !== null && localStorage.getItem(corruptKey) === null) {
          localStorage.setItem(corruptKey, raw);
        }
        if (localStorage.getItem(corruptKey) !== null) setRecoveryKey(corruptKey);
      } catch {
        // 原文退避に失敗した場合も、元キーは上書きしない。
      }
      setSharedText('');
      setIsExpanded(true);
      setStorageError(`保存済みの原稿調整データを読み込めないため、上書きを停止しました（${error?.message || 'JSON破損'}）`);
    }
    setVersionState(null);
  }, [lsKey, project?.id]);

  // 原稿が変わったら保存
  useEffect(() => {
    if (!storageReady || storageError || loadedStorageKey !== lsKey) return;
    scheduleCoordinatedSave(`format-guide:${project?.id || 'global'}`, async () => {
      localStorage.setItem(lsKey, JSON.stringify({ sharedText }));
    }, 250);
  }, [sharedText, lsKey, project?.id, storageReady, storageError, loadedStorageKey]);

  const handleReset = () => {
    const recoveryNote = storageError
      ? '\n読み込めなかった原文の退避データは削除せず残します。'
      : '';
    if (!window.confirm(`このプロジェクトの原稿調整データを削除しますか？\n必要なら先に「データ管理」からバックアップしてください。${recoveryNote}`)) return;
    setSharedText(''); setIsExpanded(true); setVersionState(null);
    try { localStorage.removeItem(lsKey); } catch {}
    setStorageError('');
    setStorageReady(true);
    setLoadedStorageKey(lsKey);
    toast.success('リセットしました');
  };

  const downloadRecovery = () => {
    try {
      const raw = recoveryKey ? localStorage.getItem(recoveryKey) : null;
      if (raw === null) throw new Error('退避データが見つかりません');
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `kindle-navi-recovered-manuscript-${project?.id || 'global'}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast.error(error?.message || '退避データをダウンロードできませんでした');
    }
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
        <p className="text-xs text-muted-foreground mb-3">ここに本文を貼ると、以下の全ステップ（フォーマット判定・ルビ付け・出力）が連動します。</p>

        {storageError && (
          <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive" role="alert">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p>{storageError}</p>
                {recoveryKey && (
                  <button type="button" onClick={downloadRecovery} className="inline-flex items-center gap-1.5 rounded border border-destructive/40 px-2 py-1 hover:bg-destructive/10">
                    <Download className="w-3 h-3" />退避した原文データをダウンロード
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <textarea
                placeholder={`原稿本文をここにペーストしてください（50文字以上）\n\n例：\nはじめに\nこの本では、毎日の仕事を整えるための3つの工夫を紹介します。まず、今日やることを一つ選びましょう。`}
                value={sharedText}
                disabled={Boolean(storageError)}
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
            <button disabled={Boolean(storageError)} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs text-neon-cyan hover:text-neon-pink disabled:opacity-40 transition-colors px-2.5 py-1.5 rounded-md" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Upload className="w-3 h-3" />.txtから読み込む
            </button>
            <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
            {sharedText.length > 0 && (
              <button disabled={Boolean(storageError)} onClick={() => { setSharedText(''); setIsExpanded(true); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-neon-red disabled:opacity-40 transition-colors">
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

      {/* ChatGPT / Gemini / Claude AI設定 */}
      <ExternalAiWorkspace />

      {/* ステップ1：フォーマット判定 */}
      <StepWrapper n="1" label="フォーマット判定（docx / epub）" color="cyan">
        <Step1FormatDecision sharedText={sharedText} />
      </StepWrapper>

      {/* ステップ2：ルビ付け */}
      <StepWrapper n="2" label="ルビ自動付与 → 手動修正 → コピー" color="pink">
        <Step3RubyEditor projectId={project?.id} sharedText={sharedText} onVersionChange={setVersionState} />
      </StepWrapper>

      {/* ステップ3：出力 */}
      <StepWrapper n="3" label="出力（docx / epub）" color="cyan">
        <Step5Export sharedText={sharedText} versionState={versionState} authorName={authorName} />
      </StepWrapper>

      {/* docx vs epub 比較ガイド */}
      <ComparisonGuide />

      {/* リセットボタン */}
      <div className="flex justify-center pt-4 pb-2">
        <Button variant="ghost" onClick={handleReset} className="h-8 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-1.5 border border-destructive/20">
          <Trash2 className="w-3.5 h-3.5" />全データをリセット（入力テキスト・修正結果を削除）
        </Button>
      </div>
    </div>
  );
}

function ComparisonGuide() {
  const rows = [
    { item: '向いている使い方', docx: '文章中心の原稿をWordでも調整したい', epub: 'ルビや文書構造をHTML形式で確認したい' },
    { item: 'URLリンク', docx: 'Previewerで動作確認', epub: 'Previewerで動作確認' },
    { item: 'Kindle Unlimitedへの対応', docx: '✅ 対応', epub: '✅ 対応' },
    { item: 'レイアウト', docx: '出力後にWordで調整可能', epub: 'このツールではリフロー型' },
    { item: 'Kindleプレビューアーでの確認', docx: '✅ 推奨', epub: '✅ 推奨' },
    { item: 'KDP登録前の作業', docx: '必要に応じてWordで仕上げる', epub: 'EPUBの検証結果を確認する' },
    { item: 'ルビ（ふりがな）の扱い', docx: '｜漢字《かな》 の記法で出力', epub: 'HTML rubyタグに変換' },
    { item: '画像・図表', docx: '出力後にWordで追加・調整', epub: 'このテキスト出力には含まれない' },
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
        <p className="text-xs text-neon-pink font-bold">✅ 文章中心で後から調整するならdocx、HTMLルビを確認するならepubが目安です。</p>
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
