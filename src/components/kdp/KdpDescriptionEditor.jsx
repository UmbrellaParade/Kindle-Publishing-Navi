import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

const MAX_CHARS = 4000;
const WARNING_CHARS = 3500;

// 絵文字パターン（Unicode 絵文字範囲のみ）
// 0x1F300-0x1F9FF: 絵文字メイン範囲
// 0x1FA00-0x1FAFF: 追加絵文字
// 0x2600-0x26FF: 記号・絵文字
// 0x2700-0x27BF: Dingbats
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
// URL パターン
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]/;

export default function KdpDescriptionEditor({ description, onSave }) {
  const editorRef = useRef(null);
  const [htmlOutput, setHtmlOutput] = useState(description || '');
  const [charCount, setCharCount] = useState(0);
  const [hasUrl, setHasUrl] = useState(false);
  const [hasEmoji, setHasEmoji] = useState(false);
  const [copied, setCopied] = useState(false);
  const isInitialized = useRef(false);

  // 初期値をエディターにセット
  useEffect(() => {
    if (editorRef.current && !isInitialized.current) {
      editorRef.current.innerHTML = description || '';
      isInitialized.current = true;
      setHtmlOutput(description || '');
      updateStats(description || '');
    }
  }, []);

  // description が外部から変わった場合
  useEffect(() => {
    if (editorRef.current && isInitialized.current) {
      const current = editorRef.current.innerHTML;
      if (current !== (description || '')) {
        editorRef.current.innerHTML = description || '';
        setHtmlOutput(description || '');
        updateStats(description || '');
      }
    }
  }, [description]);

  const updateStats = (html) => {
    // 文字数カウント（タグを含む）
    const text = html.replace(/<[^>]*>/g, '');
    setCharCount(text.length);
    // URL チェック
    setHasUrl(URL_REGEX.test(html));
    // 絵文字チェック
    setHasEmoji(EMOJI_REGEX.test(text));
  };

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    setHtmlOutput(html);
    onSave(html);
    updateStats(html);
  }, [onSave]);

  // Enter キーで<br>改行
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
    }
  };

  // execCommand ラッパー
  const exec = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    handleInput();
  };

  // 見出し挿入（H4/H5/H6）
  const insertHeading = (tag) => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, tag);
    handleInput();
  };

  // 箇条書き挿入
  const insertList = (ordered) => {
    editorRef.current?.focus();
    document.execCommand(ordered ? 'insertOrderedList' : 'insertUnorderedList');
    handleInput();
  };

  const copyHtml = () => {
    navigator.clipboard.writeText(htmlOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('HTML をコピーしました');
  };

  const TOOLBAR = [
    { label: 'H4', title: '見出し大（<h4>）', action: () => insertHeading('h4') },
    { label: 'H5', title: '見出し中（<h5>）', action: () => insertHeading('h5') },
    { label: 'H6', title: '見出し小（<h6>）', action: () => insertHeading('h6') },
    { label: 'B', title: '太字（<b>）', action: () => exec('bold') },
    { label: 'I', title: '斜体（<i>）', action: () => exec('italic') },
    { label: 'U', title: '下線（<u>）', action: () => exec('underline') },
    { label: '・', title: '箇条書き（<ul><li>）', action: () => insertList(false) },
    { label: '1.', title: '番号付きリスト（<ol><li>）', action: () => insertList(true) },
  ];

  const pct = Math.min((charCount / MAX_CHARS) * 100, 100);
  const isWarning = charCount >= WARNING_CHARS && charCount < MAX_CHARS;
  const isError = charCount >= MAX_CHARS;

  return (
    <div className="space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-neon-pink neon-pink-glow">📄 KDP 書籍説明文（Amazon ページ用）</h3>
      </div>
      <p className="text-xs text-muted-foreground">テキストを選択してボタンを押すと書式が適用されます。Enter キーで改行できます。</p>

      {/* ── 警告表示 ── */}
      {(hasUrl || hasEmoji) && (
        <div className="rounded-lg p-3 border border-destructive/30 bg-destructive/10 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <div className="text-xs text-destructive space-y-1">
            {hasUrl && <p>⚠️ URL が含まれています。Amazon KDP の書籍説明に URL は含めないでください。</p>}
            {hasEmoji && <p>⚠️ 絵文字が含まれています。Amazon KDP の書籍説明に絵文字は含めないでください。</p>}
          </div>
        </div>
      )}

      {/* ── 文字数カウンター ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={`font-bold ${isError ? 'text-destructive' : isWarning ? 'text-neon-amber' : 'text-muted-foreground'}`}>
            {charCount.toLocaleString()}文字 / {MAX_CHARS.toLocaleString()}文字
          </span>
          {isError && <span className="text-destructive font-bold">超過</span>}
        </div>
        <Progress value={pct} className={`h-1.5 ${isError ? '[&>div]:bg-destructive' : isWarning ? '[&>div]:bg-neon-amber' : '[&>div]:bg-neon-cyan'}`} />
      </div>

      {/* ── エディター本体 ── */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#12122a', border: '1px solid #2a2a4a' }}>

        {/* ツールバー */}
        <div className="flex items-center gap-1 flex-wrap px-2 py-2 border-b" style={{ borderColor: '#2a2a4a', background: '#0e0e24' }}>
          {TOOLBAR.map((btn, i) => (
            <button
              key={i}
              title={btn.title}
              onMouseDown={e => { e.preventDefault(); btn.action(); }}
              className="inline-flex items-center justify-center min-w-[32px] h-7 px-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-neon-pink/50 hover:bg-neon-pink/10 transition-colors text-[11px] font-bold"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* contentEditable エディター */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-placeholder="ここに書籍説明文を入力してください。&#10;&#10;例：&#10;H4/H5/H6 で見出し、B で太字、I で斜体、・で箇条書きができます。"
          className="w-full min-h-[240px] px-4 py-3 text-sm focus:outline-none leading-relaxed
            [&_h4]:text-base [&_h4]:font-black [&_h4]:mt-3 [&_h4]:mb-1
            [&_h5]:text-sm [&_h5]:font-bold [&_h5]:mt-2 [&_h5]:mb-0.5
            [&_h6]:text-xs [&_h6]:font-bold [&_h6]:mt-1.5 [&_h6]:mb-0.5 [&_h6]:text-muted-foreground
            [&_b]:font-black [&_strong]:font-black
            [&_i]:italic [&_em]:italic
            [&_u]:underline
            [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-1 [&_ul>li]:my-0.5
            [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:my-1 [&_ol>li]:my-0.5
            empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none empty:before:whitespace-pre-line"
          style={{ minHeight: '240px', background: '#ffffff', color: '#000000' }}
        />
      </div>

      {/* ── HTML ソースコード表示 ── */}
      <div className="rounded-xl p-4" style={{ background: '#1a1a1a', border: '1px solid #2a2a4a' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-green-400">📋 HTML ソースコード（KDP にコピペ用）</p>
          <Button size="sm" onClick={copyHtml} className="h-7 text-xs gap-1 bg-green-500/20 text-green-400 border border-green-500/40 hover:bg-green-500/30">
            {copied ? <><Check className="w-3 h-3" />コピー済み</> : <><Copy className="w-3 h-3" />📋 コピー</>}
          </Button>
        </div>
        <textarea
          readOnly
          value={htmlOutput}
          className="w-full h-32 px-3 py-2 text-xs font-mono rounded-lg focus:outline-none resize-none"
          style={{ background: '#0d0d1a', color: '#00ff88', border: '1px solid #2a2a4a' }}
        />
      </div>
    </div>
  );
}