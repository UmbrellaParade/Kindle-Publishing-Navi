import React from 'react';
import { FileText, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const URL_REGEX = /https?:\/\/[^\s。、！？\]）)]+/;

function buildRtf(text) {
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .split('\n')
    .map(line => line.trim() === '' ? '\\par' : `${line}\\par`)
    .join('\n');

  return `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\fnil\\fcharset128 Yu Mincho;}}
{\\colortbl;}
\\f0\\fs22
${escaped}
}`;
}

function buildXhtml(text) {
  const lines = text.split('\n').map(line =>
    line.trim() === '' ? '<p>&#x3000;</p>' : `<p>${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head><meta charset="UTF-8" /><title>原稿</title>
<style>body{font-family:'ヒラギノ明朝 Pro','Yu Mincho',serif;font-size:1em;line-height:2;} p{margin:0.5em 0;}</style>
</head><body>${lines}</body></html>`;
}

export default function Step5Export({ sharedText, versionState }) {
  const hasUrl = URL_REGEX.test(sharedText);
  const hasText = sharedText.trim().length > 0;

  const getOutputText = () => {
    if (!versionState) return sharedText;
    const { currentVersion, originalText, aiText, manualText } = versionState;
    if (currentVersion === 'ai' && aiText) return aiText;
    if (currentVersion === 'manual' && manualText) return manualText;
    return originalText || sharedText;
  };

  const downloadDocx = () => {
    const text = getOutputText();
    const rtf = buildRtf(text);
    const blob = new Blob([rtf], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '原稿.rtf'; a.click();
    URL.revokeObjectURL(url);
    toast.success('RTF（Word互換）をダウンロードしました');
  };

  const downloadEpub = () => {
    if (hasUrl) { toast.warning('URLリンクがあります。docxを推奨します。'); }
    const text = getOutputText();
    const xhtml = buildXhtml(text);
    const blob = new Blob([xhtml], { type: 'application/xhtml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '原稿.xhtml'; a.click();
    URL.revokeObjectURL(url);
    toast.success('XHTML（epub用）をダウンロードしました');
  };

  return (
    <div className="rounded-xl p-4 space-y-4" style={CARD_STYLE}>
      {/* バージョン選択 */}
      {versionState && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)' }}>
          <p className="text-xs font-bold text-neon-cyan mb-2">出力するバージョンを選択</p>
          <div className="flex gap-2 flex-wrap">
            {[{ key: 'original', label: '元の本文' }, { key: 'ai', label: 'AI修正版' }, { key: 'manual', label: '手動編集版' }].map(({ key, label }) => (
              <button key={key} onClick={() => versionState.onVersionChange?.({ ...versionState, currentVersion: key })}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors font-bold ${versionState.currentVersion === key ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50' : 'text-muted-foreground border-border hover:text-foreground'}`}
                style={versionState.currentVersion !== key ? { background: 'rgba(255,255,255,0.04)' } : {}}
              >{label}</button>
            ))}
          </div>
        </div>
      )}

      {hasUrl && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(255,179,0,0.07)', border: '1px solid rgba(255,179,0,0.25)' }}>
          <AlertTriangle className="w-3.5 h-3.5 text-neon-amber flex-shrink-0 mt-0.5" />
          <p className="text-xs text-neon-amber">URLリンクがある作品はdocxを推奨します。epubではリンクが正しく埋め込まれない場合があります。</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-lg space-y-2" style={{ background: 'rgba(255,45,120,0.05)', border: '1px solid rgba(255,45,120,0.25)' }}>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-neon-pink" />
            <span className="text-sm font-bold text-neon-pink">docx（游明朝・11pt）</span>
            {hasUrl && <span className="text-[10px] text-neon-pink bg-neon-pink/20 px-1.5 py-0.5 rounded">推奨</span>}
          </div>
          <p className="text-xs text-muted-foreground">URLリンク有りの作品・初心者・手軽に出版したい場合</p>
          <Button onClick={downloadDocx} disabled={!hasText} className="w-full h-8 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30 disabled:opacity-40">
            <Download className="w-3.5 h-3.5 mr-1.5" />docxダウンロード（RTF）
          </Button>
        </div>

        <div className="p-4 rounded-lg space-y-2" style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.2)' }}>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-neon-cyan" />
            <span className="text-sm font-bold text-neon-cyan">epub（XHTML）</span>
          </div>
          <p className="text-xs text-muted-foreground">レイアウトにこだわりたい・2冊目以降に挑戦</p>
          <Button onClick={downloadEpub} disabled={!hasText} className="w-full h-8 text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 disabled:opacity-40">
            <Download className="w-3.5 h-3.5 mr-1.5" />epubダウンロード（XHTML）
          </Button>
          {hasUrl && <p className="text-[10px] text-neon-amber">⚠️ URLリンクあり → docx推奨</p>}
        </div>
      </div>
    </div>
  );
}