import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, RotateCcw, Pencil, Save, X, Eye, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// 2つのテキストを行単位で比較し、差異をハイライトして返す
function DiffView({ original, revised }) {
  const origLines = original.split('\n');
  const revLines = revised.split('\n');

  return (
    <div className="grid grid-cols-2 gap-0 text-xs font-body leading-relaxed overflow-hidden">
      <div className="px-3 py-2 bg-secondary/80 border-b border-r border-border font-bold text-muted-foreground text-[10px] uppercase tracking-wide">修正前</div>
      <div className="px-3 py-2 bg-neon-cyan/10 border-b border-border font-bold text-neon-cyan text-[10px] uppercase tracking-wide">修正後</div>
      <div className="border-r border-border overflow-y-auto max-h-80">
        {origLines.map((line, i) => {
          const changed = revLines[i] !== undefined && line !== revLines[i];
          return (
            <div key={i} className={`px-3 py-0.5 whitespace-pre-wrap ${changed ? 'bg-red-500/10 text-neon-red/90' : 'text-muted-foreground'}`}>
              {line || <span className="text-border">&#8203;</span>}
            </div>
          );
        })}
      </div>
      <div className="overflow-y-auto max-h-80">
        {revLines.map((line, i) => {
          const changed = origLines[i] !== undefined && line !== origLines[i];
          return (
            <div key={i} className={`px-3 py-0.5 whitespace-pre-wrap ${changed ? 'bg-green-500/10 text-green-400' : 'text-foreground'}`}>
              {line || <span className="text-border">&#8203;</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const VERSION_LABELS = {
  original: { label: '元の本文', color: 'bg-secondary text-muted-foreground border-border' },
  ai:       { label: 'AI修正版', color: 'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40' },
  manual:   { label: '手動編集版', color: 'bg-neon-pink/15 text-neon-pink border-neon-pink/40' },
};

// RTF形式でdocx互換ファイルを生成（游明朝・11pt・Kindle推奨余白・太字/斜体対応）
function buildRtf(text) {
  // RTFフォントテーブルに游明朝を登録
  const header = `{\\rtf1\\ansi\\ansicpg932\\deff0
{\\fonttbl{\\f0\\froman\\fcharset128 Yu Mincho;}}
{\\colortbl;}
\\paperw12240\\paperh15840
\\margt1440\\margb1440\\margl1728\\margr1728
\\f0\\fs22
`;

  const lines = text.split('\n');
  const body = lines.map(line => {
    if (line.trim() === '') return '\\par';
    // **bold** → \b ... \b0, *italic* → \i ... \i0
    let rtfLine = line
      .replace(/\\/g, '\\\\')
      .replace(/[{}]/g, c => '\\' + c);
    rtfLine = rtfLine
      .replace(/\*\*(.+?)\*\*/g, '{\\b $1}')
      .replace(/\*(.+?)\*/g, '{\\i $1}');
    // 日本語文字をUnicode RTFエスケープ
    rtfLine = rtfLine.replace(/[^\x00-\x7F]/g, c => {
      const code = c.charCodeAt(0);
      return `\\u${code}?`;
    });
    return rtfLine + '\\par';
  }).join('\n');

  return header + body + '\n}';
}

function hasUrl(text) {
  return /https?:\/\//.test(text);
}

export default function TextVersionPreview({ originalText, aiText, onVersionChange }) {
  const [currentVersion, setCurrentVersion] = useState('ai');
  const [manualText, setManualText] = useState(aiText);
  const [editingText, setEditingText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [viewMode, setViewMode] = useState('single');
  const [copied, setCopied] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('docx'); // 'docx' | 'epub'

  useEffect(() => {
    setManualText(aiText);
    setCurrentVersion('ai');
    setIsEditing(false);
    setIsDirty(false);
  }, [aiText]);

  useEffect(() => {
    if (onVersionChange) onVersionChange({ currentVersion, text: getCurrentText() });
  }, [currentVersion, manualText]);

  const getCurrentText = () => {
    if (currentVersion === 'original') return originalText;
    if (currentVersion === 'ai') return aiText;
    return manualText;
  };

  const startEdit = () => {
    setEditingText(getCurrentText());
    setIsEditing(true);
    setIsDirty(false);
  };

  const saveEdit = () => {
    setManualText(editingText);
    setCurrentVersion('manual');
    setIsEditing(false);
    setIsDirty(false);
    toast.success('手動編集を保存しました');
    if (onVersionChange) onVersionChange({ currentVersion: 'manual', text: editingText });
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setIsDirty(false);
  };

  const copyText = () => {
    navigator.clipboard.writeText(getCurrentText());
    setCopied(true);
    toast.success('テキストをコピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadDocx = () => {
    const text = getCurrentText();
    const rtf = buildRtf(text);
    const blob = new Blob([rtf], { type: 'application/rtf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `本文_${vCfg.label}.rtf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${vCfg.label}を.rtf（Word互換）でダウンロードしました`);
  };

  const downloadEpub = () => {
    // epub: HTMLベースのシンプル出力（xhtmlラッパー）
    const text = getCurrentText();
    const lines = text.split('\n');
    const bodyHtml = lines.map(line => {
      if (line.trim() === '') return '<p>&nbsp;</p>';
      const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // **bold** → <strong>, *italic* → <em>
      const formatted = escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
      return `<p>${formatted}</p>`;
    }).join('\n');

    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>${vCfg.label}</title>
  <style>
    body { font-family: serif; font-size: 1em; margin: 2em; line-height: 1.8; }
    p { margin: 0 0 0.5em 0; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

    const blob = new Blob([xhtml], { type: 'application/xhtml+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `本文_${vCfg.label}.xhtml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${vCfg.label}をepub(xhtml)でダウンロードしました`);
  };

  const handleDownload = () => {
    if (downloadFormat === 'docx') {
      downloadDocx();
    } else {
      downloadEpub();
    }
  };

  const vCfg = VERSION_LABELS[currentVersion];
  const currentText = getCurrentText();
  const textHasUrl = hasUrl(currentText || '');

  return (
    <div className="rounded-lg border border-neon-cyan/30 overflow-hidden">
      {/* ── ヘッダー ── */}
      <div className="px-4 py-3 bg-neon-cyan/5 border-b border-neon-cyan/20 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-neon-cyan" />
          <span className="text-sm font-bold text-neon-cyan">プレビュー</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${vCfg.color}`}>
            現在：{vCfg.label}
          </span>
          {isEditing && (
            <span className="text-[10px] text-neon-amber animate-pulse font-bold">編集中...</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="ghost" size="sm" className={`h-7 text-xs px-2.5 ${viewMode === 'single' ? 'bg-secondary' : ''}`} onClick={() => setViewMode('single')}>単独</Button>
          <Button variant="ghost" size="sm" className={`h-7 text-xs px-2.5 ${viewMode === 'diff' ? 'bg-secondary' : ''}`} onClick={() => setViewMode('diff')}>差分比較</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-neon-cyan hover:bg-neon-cyan/20 px-2.5" onClick={copyText}>
            {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}コピー
          </Button>
        </div>
      </div>

      {/* ── バージョン切り替えタブ ── */}
      <div className="flex border-b border-border">
        {(['original', 'ai', 'manual']).map((v) => {
          const cfg = VERSION_LABELS[v];
          const active = currentVersion === v && !isEditing;
          const disabled = v === 'manual' && !manualText;
          return (
            <button
              key={v}
              disabled={disabled}
              onClick={() => { setCurrentVersion(v); setIsEditing(false); }}
              className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${
                active ? 'border-neon-cyan text-neon-cyan bg-neon-cyan/5' : 'border-transparent text-muted-foreground hover:text-foreground'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* ── 本文エリア ── */}
      {viewMode === 'diff' && aiText ? (
        <DiffView original={originalText} revised={isEditing ? editingText : (currentVersion === 'manual' ? manualText : aiText)} />
      ) : isEditing ? (
        <textarea
          className="w-full p-4 text-xs text-foreground leading-relaxed whitespace-pre-wrap font-body bg-neon-pink/5 min-h-[200px] max-h-80 resize-none focus:outline-none border-none"
          value={editingText}
          onChange={(e) => { setEditingText(e.target.value); setIsDirty(true); }}
          autoFocus
        />
      ) : (
        <pre className="p-4 text-xs text-foreground leading-relaxed whitespace-pre-wrap font-body bg-secondary/20 max-h-80 overflow-y-auto">
          {getCurrentText()}
        </pre>
      )}

      {/* ── アクションバー ── */}
      <div className="px-4 py-3 bg-secondary/40 border-t border-border flex items-center flex-wrap gap-2">
        {isEditing ? (
          <>
            <Button size="sm" className="h-7 text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30" onClick={saveEdit}>
              <Save className="w-3 h-3 mr-1" />変更を保存
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={cancelEdit}>
              <X className="w-3 h-3 mr-1" />キャンセル
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" className="h-7 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30" onClick={startEdit}
              disabled={currentVersion === 'original'}>
              <Pencil className="w-3 h-3 mr-1" />手動編集
            </Button>
            {currentVersion === 'manual' && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-neon-cyan hover:bg-neon-cyan/10" onClick={() => setCurrentVersion('ai')}>
                <RotateCcw className="w-3 h-3 mr-1" />AI修正に戻す
              </Button>
            )}
            {currentVersion !== 'original' && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-neon-red" onClick={() => { setCurrentVersion('original'); setIsEditing(false); }}>
                <RotateCcw className="w-3 h-3 mr-1" />元の本文に戻す
              </Button>
            )}
          </>
        )}
      </div>

      {/* ── ダウンロードバー ── */}
      <div className="px-4 py-4 bg-neon-amber/5 border-t border-neon-amber/20 space-y-3">
        {/* フォーマット選択 */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">ダウンロード形式</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="dlFormat" value="docx" checked={downloadFormat === 'docx'} onChange={() => setDownloadFormat('docx')} className="accent-pink-500" />
            <span className="text-xs text-foreground">.docx（推奨：URLリンクがある場合）</span>
            <span className="text-[10px] text-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 rounded border border-neon-cyan/30">デフォルト</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="dlFormat" value="epub" checked={downloadFormat === 'epub'} onChange={() => setDownloadFormat('epub')} className="accent-pink-500" />
            <span className="text-xs text-foreground">.epub（URLリンクがない場合）</span>
          </label>
        </div>

        {/* URLリンク警告 */}
        {downloadFormat === 'epub' && textHasUrl && (
          <div className="flex items-start gap-1.5 bg-neon-amber/10 border border-neon-amber/30 rounded px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-neon-amber flex-shrink-0 mt-0.5" />
            <p className="text-xs text-neon-amber">URLリンクが含まれている場合はdocxを推奨します</p>
          </div>
        )}

        {/* ダウンロードボタン */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            className="h-8 text-xs bg-neon-amber/20 text-neon-amber border border-neon-amber/40 hover:bg-neon-amber/30"
            onClick={handleDownload}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />📥 修正済み本文をダウンロード
          </Button>
          <span className="text-[10px] text-muted-foreground">
            現在：<span className="font-bold text-neon-amber">{vCfg.label}</span>をダウンロードします
          </span>
        </div>
      </div>
    </div>
  );
}