import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  BookMarked, Loader2, Copy, Check, AlertTriangle, Pencil, Trash2,
  ChevronDown, ChevronUp, RefreshCw, BookOpen, FileType, X, Save
} from 'lucide-react';
import NeonCard from './NeonCard';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ── デフォルト辞書 ─────────────────────────────────────────────
const DEFAULT_DICT = {
  'ヴェル13世': 'ヴェルじゅうさんせい',
  '雨守': 'あまもり',
  'アマモリ': 'あまもり',
  '雨詠': 'あまよみ',
  'アマヨミ': 'あまよみ',
  'ネスト13': 'ネストじゅうさん',
  '天律': 'てんりつ',
  'パレードマスター': 'ぱれーどますたー',
  'グランドパレード': 'ぐらんどぱれーど',
  'ラザロ・ストール': 'らざろすとーる',
};

const STORAGE_KEY = 'ruby_custom_dict';

function loadDict() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_DICT, ...JSON.parse(saved) } : { ...DEFAULT_DICT };
  } catch { return { ...DEFAULT_DICT }; }
}

function saveCustomDict(dict) {
  // デフォルトと異なる部分だけ保存
  const custom = {};
  for (const [k, v] of Object.entries(dict)) {
    if (DEFAULT_DICT[k] !== v) custom[k] = v;
  }
  // デフォルトにない新規エントリも保存
  for (const [k, v] of Object.entries(dict)) {
    if (!(k in DEFAULT_DICT)) custom[k] = v;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

// ── ルビトークンの型 ──────────────────────────────────────────
// token: { id, type: 'ruby'|'plain', base, ruby, needsCheck }
// needsCheck: 固有名詞など要確認フラグ

function tokenizeWithRuby(rubyPairs) {
  // rubyPairs: [{base, ruby, start, end, needsCheck}]
  // text: 元テキスト
  // → tokens配列で返す
  return rubyPairs;
}

// ── 個別ルビ編集ポップオーバー ────────────────────────────────
function RubyEditPopover({ token, onSave, onRemove, onClose, dict }) {
  const [rubyText, setRubyText] = useState(token.ruby || '');
  const [noRuby, setNoRuby] = useState(!token.ruby);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSave = () => {
    onSave(token.id, noRuby ? '' : rubyText);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute z-50 left-0 top-full mt-1 bg-card border border-neon-pink/40 rounded-lg shadow-xl p-3 w-56 neon-box-pink"
    >
      <p className="text-xs font-bold text-neon-pink mb-2">「{token.base}」のルビを編集</p>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          id={`noruby-${token.id}`}
          checked={noRuby}
          onChange={(e) => setNoRuby(e.target.checked)}
          className="accent-pink-500"
        />
        <label htmlFor={`noruby-${token.id}`} className="text-xs text-muted-foreground cursor-pointer">ルビなし</label>
      </div>
      {!noRuby && (
        <input
          autoFocus
          type="text"
          value={rubyText}
          onChange={(e) => setRubyText(e.target.value)}
          placeholder="ふりがな"
          className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs mb-2 text-foreground focus:border-neon-pink/50 outline-none"
        />
      )}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 h-7 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30" onClick={handleSave}>
          <Save className="w-3 h-3 mr-1" />保存
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      <p className="text-[9px] text-muted-foreground mt-1.5">保存するとこの漢字の辞書が更新されます</p>
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────
export default function RubyEditor() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState(null); // [{id, base, ruby, needsCheck}]
  const [plainSegments, setPlainSegments] = useState(null); // [{type:'plain'|'ruby', text, tokenId?}]
  const [editingId, setEditingId] = useState(null);
  const [dict, setDict] = useState(loadDict);
  const [showDict, setShowDict] = useState(false);
  const [copyFormat, setCopyFormat] = useState('epub'); // 'epub' | 'docx'
  const [copied, setCopied] = useState(false);
  const [showNeedsCheck, setShowNeedsCheck] = useState(true);

  // ── AI でルビ振り ─────────────────────────────────────────
  const runRuby = async () => {
    if (text.trim().length < 5) return;
    setLoading(true);
    setTokens(null);
    setPlainSegments(null);
    setEditingId(null);

    // 辞書をプロンプトに含める
    const dictStr = Object.entries(dict).map(([k, v]) => `${k} → ${v}`).join('\n');

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `あなたは日本語の電子書籍編集者です。以下の小説テキストにルビ（読み仮名）を振ってください。

【固有名詞辞書（必ず優先適用すること）】
${dictStr}

【ルビ付与ルール】
1. 辞書に登録されている語は辞書通りに適用すること
2. 難読漢字・一般的でない熟語にルビを振る
3. 小学校レベルの漢字（山、川、水、人など）にはルビ不要
4. 人名・地名・固有名詞は needsCheck: true にする
5. 辞書登録済みの語は needsCheck: false でよい

【出力形式】
テキストを「ルビあり」「ルビなし」のセグメントに分割して返す。
ルビありは {base: "漢字", ruby: "よみ", needsCheck: false} の形式。
ルビなしは {plain: "テキスト"} の形式。

【対象テキスト】
${text.slice(0, 3000)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                plain: { type: 'string' },
                base: { type: 'string' },
                ruby: { type: 'string' },
                needsCheck: { type: 'boolean' },
              },
            },
          },
        },
      },
    });

    // segments → tokens + plainSegments
    if (res?.segments) {
      const newTokens = [];
      const newSegments = [];
      let idCounter = 0;

      for (const seg of res.segments) {
        if (seg.plain !== undefined) {
          newSegments.push({ type: 'plain', text: seg.plain });
        } else if (seg.base !== undefined) {
          const id = `t${idCounter++}`;
          newTokens.push({ id, base: seg.base, ruby: seg.ruby || '', needsCheck: seg.needsCheck || false });
          newSegments.push({ type: 'ruby', tokenId: id });
        }
      }

      setTokens(newTokens);
      setPlainSegments(newSegments);
    }

    setLoading(false);
  };

  // ── ルビ編集保存 ─────────────────────────────────────────
  const handleSaveRuby = useCallback((tokenId, newRuby) => {
    setTokens((prev) =>
      prev.map((t) => t.id === tokenId ? { ...t, ruby: newRuby, needsCheck: false } : t)
    );
    // 辞書に保存
    setTokens((prev) => {
      const token = prev.find((t) => t.id === tokenId);
      if (token) {
        const newDict = { ...dict, [token.base]: newRuby };
        setDict(newDict);
        saveCustomDict(newDict);
      }
      return prev;
    });
    toast.success('辞書を更新しました');
  }, [dict]);

  // ── 出力テキスト生成 ──────────────────────────────────────
  const buildOutputText = () => {
    if (!plainSegments || !tokens) return '';
    const tokenMap = Object.fromEntries(tokens.map((t) => [t.id, t]));

    return plainSegments.map((seg) => {
      if (seg.type === 'plain') return seg.text;
      const t = tokenMap[seg.tokenId];
      if (!t) return '';
      if (!t.ruby) return t.base;

      if (copyFormat === 'epub') {
        // epub/aozora形式: 基本《読み》
        return `${t.base}《${t.ruby}》`;
      } else {
        // docx用: |基本《読み》 (縦中横対応の青空文庫形式)
        return `|${t.base}《${t.ruby}》`;
      }
    }).join('');
  };

  const handleCopy = () => {
    const out = buildOutputText();
    navigator.clipboard.writeText(out);
    setCopied(true);
    toast.success('コピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  const needsCheckTokens = tokens?.filter((t) => t.needsCheck) || [];
  const tokenMap = tokens ? Object.fromEntries(tokens.map((t) => [t.id, t])) : {};

  return (
    <NeonCard glowColor="pink">
      <div className="flex items-center gap-2 mb-1">
        <BookMarked className="w-4 h-4 text-neon-pink" />
        <h3 className="font-bold text-sm text-neon-pink neon-pink-glow">ルビ付け機能（自動＋手動修正）</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        テキストを貼り付けるとAIが自動でルビを振ります。クリックで手動修正でき、辞書に保存されます。
      </p>

      {/* Input */}
      <div className="space-y-2">
        <Textarea
          placeholder="小説テキストをここに貼り付け..."
          value={text}
          onChange={(e) => { setText(e.target.value); setTokens(null); setPlainSegments(null); }}
          className="min-h-[120px] bg-secondary border-border focus:border-neon-pink/50 text-sm resize-none font-body"
          disabled={loading}
        />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{text.length}文字</span>
            {text.length > 0 && !loading && (
              <button onClick={() => { setText(''); setTokens(null); setPlainSegments(null); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-neon-red transition-colors">
                <RefreshCw className="w-3 h-3" />クリア
              </button>
            )}
          </div>
          <Button
            onClick={runRuby}
            disabled={loading || text.trim().length < 5}
            className="bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30 text-xs h-8"
          >
            {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />解析中...</> : <><BookMarked className="w-3.5 h-3.5 mr-1.5" />ルビを自動付与</>}
          </Button>
        </div>
      </div>

      {/* 辞書確認 */}
      <div className="mt-3">
        <button onClick={() => setShowDict((v) => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-neon-cyan transition-colors">
          <BookOpen className="w-3.5 h-3.5" />
          固有名詞辞書を{showDict ? '閉じる' : '確認する'}（{Object.keys(dict).length}件）
          {showDict ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <AnimatePresence>
          {showDict && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 bg-secondary/50 rounded-lg p-3 border border-border max-h-48 overflow-y-auto space-y-1.5">
                {Object.entries(dict).map(([base, ruby]) => (
                  <div key={base} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground font-medium">{base}</span>
                    <span className="text-muted-foreground">→ {ruby}</span>
                    <button
                      onClick={() => {
                        const newDict = { ...dict };
                        delete newDict[base];
                        if (base in DEFAULT_DICT) {
                          // デフォルト語は削除不可（リセットのみ）
                          newDict[base] = DEFAULT_DICT[base];
                        }
                        setDict(newDict);
                        saveCustomDict(newDict);
                        toast.success(`「${base}」を辞書からリセットしました`);
                      }}
                      className="text-muted-foreground hover:text-neon-red transition-colors flex-shrink-0"
                      title={base in DEFAULT_DICT ? 'デフォルトに戻す' : '削除'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 結果表示 */}
      <AnimatePresence>
        {tokens && plainSegments && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">

            {/* 要確認リスト */}
            {needsCheckTokens.length > 0 && (
              <div className="bg-neon-amber/5 border border-neon-amber/30 rounded-lg p-3">
                <button onClick={() => setShowNeedsCheck((v) => !v)} className="flex items-center gap-2 w-full">
                  <AlertTriangle className="w-4 h-4 text-neon-amber" />
                  <span className="text-xs font-bold text-neon-amber">固有名詞・要確認リスト（{needsCheckTokens.length}件）</span>
                  {showNeedsCheck ? <ChevronUp className="w-3.5 h-3.5 text-neon-amber ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-neon-amber ml-auto" />}
                </button>
                <AnimatePresence>
                  {showNeedsCheck && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="flex flex-wrap gap-2 mt-3">
                        {needsCheckTokens.map((t) => (
                          <span key={t.id} className="inline-flex items-center gap-1 bg-neon-amber/10 border border-neon-amber/30 rounded px-2 py-1 text-xs">
                            <span className="text-foreground font-medium">{t.base}</span>
                            {t.ruby && <span className="text-muted-foreground">《{t.ruby}》</span>}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">以下のインタラクティブプレビューでクリックして修正できます。</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* インタラクティブプレビュー */}
            <div>
              <p className="text-xs font-bold text-foreground mb-2">インタラクティブプレビュー <span className="text-muted-foreground font-normal text-[10px]">（ルビをクリックで編集）</span></p>
              <div className="bg-secondary/60 rounded-lg p-4 border border-border text-sm leading-loose font-body text-foreground min-h-[80px]">
                {plainSegments.map((seg, i) => {
                  if (seg.type === 'plain') {
                    return <span key={i} className="whitespace-pre-wrap">{seg.text}</span>;
                  }
                  const t = tokenMap[seg.tokenId];
                  if (!t) return null;
                  const isEditing = editingId === t.id;
                  return (
                    <span key={i} className="relative inline-block">
                      <button
                        onClick={() => setEditingId(isEditing ? null : t.id)}
                        className={`relative inline-flex flex-col items-center align-bottom group cursor-pointer rounded px-0.5 transition-colors ${
                          t.needsCheck ? 'bg-neon-amber/10 hover:bg-neon-amber/20' : 'hover:bg-neon-pink/10'
                        } ${isEditing ? 'ring-1 ring-neon-pink/60' : ''}`}
                      >
                        {t.ruby && (
                          <span className={`text-[9px] leading-none mb-0.5 ${t.needsCheck ? 'text-neon-amber' : 'text-neon-pink/80'}`}>
                            {t.ruby}
                          </span>
                        )}
                        <span className={`text-sm leading-tight ${t.needsCheck ? 'text-neon-amber' : ''}`}>{t.base}</span>
                        <Pencil className="absolute -top-1 -right-1 w-2.5 h-2.5 text-neon-pink/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      {isEditing && (
                        <RubyEditPopover
                          token={t}
                          dict={dict}
                          onSave={handleSaveRuby}
                          onRemove={() => {}}
                          onClose={() => setEditingId(null)}
                        />
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 出力フォーマット選択＆コピー */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                <button
                  onClick={() => setCopyFormat('epub')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${copyFormat === 'epub' ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <FileType className="w-3.5 h-3.5" />epub / 《》形式
                </button>
                <button
                  onClick={() => setCopyFormat('docx')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${copyFormat === 'docx' ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/40' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <FileType className="w-3.5 h-3.5" />docx / |《》形式
                </button>
              </div>
              <Button
                onClick={handleCopy}
                className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 text-xs h-8"
              >
                {copied ? <><Check className="w-3.5 h-3.5 mr-1.5" />コピー済み</> : <><Copy className="w-3.5 h-3.5 mr-1.5" />ルビ付きテキストをコピー</>}
              </Button>
            </div>

            {/* 出力プレビュー */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-border">
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">出力プレビュー（{copyFormat === 'epub' ? 'epub / 《》記法' : 'docx / |《》記法'}）</p>
              <pre className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-body max-h-40 overflow-y-auto">
                {buildOutputText()}
              </pre>
            </div>

            <p className="text-[10px] text-muted-foreground">
              ※ epub形式：基本《読み》　docx形式：|基本《読み》（いずれも青空文庫準拠・KDP互換）
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </NeonCard>
  );
}