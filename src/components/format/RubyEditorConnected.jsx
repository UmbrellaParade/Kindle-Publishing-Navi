import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  BookMarked, Loader2, Copy, Check, AlertTriangle, Pencil, Trash2,
  ChevronDown, ChevronUp, BookOpen, FileType, X, Save
} from 'lucide-react';
import NeonCard from '../NeonCard';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const DEFAULT_DICT = {
  'ヴェル13世': 'ヴェルじゅうさんせい',
  '雨守': 'あまもり', 'アマモリ': 'あまもり',
  '雨詠': 'あまよみ', 'アマヨミ': 'あまよみ',
  'ネスト13': 'ネストじゅうさん',
  '天律': 'てんりつ',
  'パレードマスター': 'ぱれーどますたー',
  'グランドパレード': 'ぐらんどぱれーど',
  'ラザロ・ストール': 'らざろすとーる',
};
// 辞書値がこの定数のとき「ルビなし（スキップ）」
const NO_RUBY = '__no_ruby__';
const STORAGE_KEY = 'ruby_custom_dict';

function loadDict() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_DICT, ...JSON.parse(saved) } : { ...DEFAULT_DICT };
  } catch { return { ...DEFAULT_DICT }; }
}
function saveCustomDict(dict) {
  const custom = {};
  for (const [k, v] of Object.entries(dict)) {
    if (DEFAULT_DICT[k] !== v || !(k in DEFAULT_DICT)) custom[k] = v;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

function RubyEditPopover({ token, onSave, onClose }) {
  const [rubyText, setRubyText] = useState(token.ruby || '');
  const [noRuby, setNoRuby] = useState(!token.ruby);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute z-50 left-0 top-full mt-1 bg-card border border-neon-pink/40 rounded-lg shadow-xl p-3 w-56 neon-box-pink">
      <p className="text-xs font-bold text-neon-pink mb-2">「{token.base}」のルビを編集</p>
      <div className="flex items-center gap-2 mb-2">
        <input type="checkbox" id={`noruby-${token.id}`} checked={noRuby} onChange={(e) => setNoRuby(e.target.checked)} className="accent-pink-500" />
        <label htmlFor={`noruby-${token.id}`} className="text-xs text-muted-foreground cursor-pointer">ルビなし（辞書にも保存）</label>
      </div>
      {!noRuby && (
        <input autoFocus type="text" value={rubyText} onChange={(e) => setRubyText(e.target.value)} placeholder="ふりがな"
          className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs mb-2 text-foreground focus:border-neon-pink/50 outline-none" />
      )}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 h-7 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30"
          onClick={() => { onSave(token.id, noRuby ? NO_RUBY : rubyText); onClose(); }}>
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

export default function RubyEditorConnected({ sharedText }) {
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState(null);
  const [plainSegments, setPlainSegments] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [dict, setDict] = useState(loadDict);
  const [showDict, setShowDict] = useState(false);
  const [copyFormat, setCopyFormat] = useState('epub');
  const [copied, setCopied] = useState(false);
  const [showNeedsCheck, setShowNeedsCheck] = useState(true);
  // 修正1: ルビ付与方式
  const [rubyMode, setRubyMode] = useState('first'); // 'first' | 'all'

  useEffect(() => { setTokens(null); setPlainSegments(null); }, [sharedText]);

  const runRuby = async () => {
    const text = sharedText.trim();
    if (text.length < 5) return;
    setLoading(true);
    setTokens(null);
    setPlainSegments(null);
    setEditingId(null);

    // NO_RUBYの語を除外してLLMに渡す辞書を作成
    const dictStr = Object.entries(dict)
      .filter(([, v]) => v !== NO_RUBY)
      .map(([k, v]) => `${k} → ${v}`)
      .join('\n');

    const noRubyWords = Object.entries(dict)
      .filter(([, v]) => v === NO_RUBY)
      .map(([k]) => k)
      .join('、');

    const modeInstruction = rubyMode === 'first'
      ? '同じ単語が複数回出てくる場合は、初出のみルビを振り、2回目以降はルビなし（plain扱い）にすること。'
      : '同じ単語が複数回出てくる場合も、すべての出現箇所にルビを振ること。';

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `あなたは日本語の電子書籍編集者です。以下の小説テキストにルビ（読み仮名）を振ってください。

【固有名詞辞書（必ず優先適用すること）】
${dictStr || '（なし）'}

【ルビなし指定語（これらには絶対にルビを振らないこと）】
${noRubyWords || '（なし）'}

【ルビ付与ルール】
1. 辞書に登録されている語は辞書通りに適用すること
2. ルビなし指定語にはルビを振らないこと
3. 難読漢字・一般的でない熟語にルビを振る
4. 小学校レベルの漢字にはルビ不要
5. 人名・地名・固有名詞は needsCheck: true にする
6. 辞書登録済みの語は needsCheck: false でよい
7. ${modeInstruction}

テキストを「ルビあり」「ルビなし」のセグメントに分割して返す。
ルビありは {base, ruby, needsCheck} の形式。ルビなしは {plain} の形式。

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

    if (res?.segments) {
      const newTokens = [], newSegments = [];
      let idx = 0;
      for (const seg of res.segments) {
        if (seg.plain !== undefined) {
          newSegments.push({ type: 'plain', text: seg.plain });
        } else if (seg.base !== undefined) {
          const id = `t${idx++}`;
          newTokens.push({ id, base: seg.base, ruby: seg.ruby || '', needsCheck: seg.needsCheck || false });
          newSegments.push({ type: 'ruby', tokenId: id });
        }
      }
      setTokens(newTokens);
      setPlainSegments(newSegments);
    }
    setLoading(false);
  };

  // 修正1: ルビ削除ハンドラー（辞書にNO_RUBYとして保存）
  const handleDeleteRuby = useCallback((tokenId) => {
    setTokens(prev => {
      const updated = prev.map(t => t.id === tokenId ? { ...t, ruby: '', needsCheck: false } : t);
      const token = updated.find(t => t.id === tokenId);
      if (token) {
        setDict(d => {
          const newDict = { ...d, [token.base]: NO_RUBY };
          saveCustomDict(newDict);
          return newDict;
        });
      }
      return updated;
    });
    toast.success('ルビを削除し、辞書に「ルビなし」として保存しました');
  }, []);

  const handleSaveRuby = useCallback((tokenId, newRuby) => {
    setTokens(prev => {
      const updated = prev.map(t => t.id === tokenId ? { ...t, ruby: newRuby === NO_RUBY ? '' : newRuby, needsCheck: false } : t);
      const token = updated.find(t => t.id === tokenId);
      if (token) {
        setDict(d => {
          const newDict = { ...d, [token.base]: newRuby };
          saveCustomDict(newDict);
          return newDict;
        });
      }
      return updated;
    });
    toast.success('辞書を更新しました');
  }, []);

  const buildOutputText = () => {
    if (!plainSegments || !tokens) return '';
    const tokenMap = Object.fromEntries(tokens.map(t => [t.id, t]));
    return plainSegments.map(seg => {
      if (seg.type === 'plain') return seg.text;
      const t = tokenMap[seg.tokenId];
      if (!t || !t.ruby) return t?.base || '';
      return copyFormat === 'epub' ? `${t.base}《${t.ruby}》` : `|${t.base}《${t.ruby}》`;
    }).join('');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildOutputText());
    setCopied(true);
    toast.success('コピーしました');
    setTimeout(() => setCopied(false), 2000);
  };

  const needsCheckTokens = tokens?.filter(t => t.needsCheck) || [];
  const tokenMap = tokens ? Object.fromEntries(tokens.map(t => [t.id, t])) : {};
  const isReady = sharedText.trim().length >= 5;

  return (
    <NeonCard glowColor="pink">
      <div className="flex items-center gap-2 mb-1">
        <BookMarked className="w-4 h-4 text-neon-pink" />
        <h3 className="font-bold text-sm text-neon-pink neon-pink-glow">ルビ付け（自動＋手動修正）</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        共通テキストにルビを自動付与します。クリックで手動修正でき、辞書に自動保存されます。
        {!isReady && <span className="text-neon-amber ml-1">（上の入力エリアに本文を貼り付けてください）</span>}
      </p>

      {/* 修正2: ルビ付与方式選択 */}
      <div className="mb-4 p-3 bg-secondary/50 rounded-lg border border-border">
        <p className="text-xs font-bold mb-2 text-foreground">ルビの付与方法</p>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="rubyMode" value="first" checked={rubyMode === 'first'} onChange={() => setRubyMode('first')} className="accent-pink-500" />
            <span className="text-xs text-foreground">初出のみ（同じ単語が2回目以降は振らない）</span>
            <span className="text-[10px] text-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 rounded border border-neon-cyan/30">デフォルト</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="rubyMode" value="all" checked={rubyMode === 'all'} onChange={() => setRubyMode('all')} className="accent-pink-500" />
            <span className="text-xs text-foreground">すべてに振る（同じ単語が出るたびに振る）</span>
          </label>
        </div>
      </div>

      <Button onClick={runRuby} disabled={loading || !isReady}
        className="w-full h-9 bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30 text-xs disabled:opacity-40">
        {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />解析中...</> : <><BookMarked className="w-3.5 h-3.5 mr-1.5" />ルビを付与する</>}
      </Button>

      {/* 辞書確認 */}
      <div className="mt-3">
        <button onClick={() => setShowDict(v => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-neon-cyan transition-colors">
          <BookOpen className="w-3.5 h-3.5" />
          固有名詞辞書（{Object.keys(dict).length}件）
          {showDict ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <AnimatePresence>
          {showDict && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 bg-secondary/50 rounded-lg p-3 border border-border max-h-40 overflow-y-auto space-y-1.5">
                {Object.entries(dict).map(([base, ruby]) => (
                  <div key={base} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground font-medium">{base}</span>
                    <span className={`${ruby === NO_RUBY ? 'text-neon-amber' : 'text-muted-foreground'}`}>
                      → {ruby === NO_RUBY ? 'ルビなし' : ruby}
                    </span>
                    <button onClick={() => {
                      const newDict = { ...dict };
                      if (base in DEFAULT_DICT) { newDict[base] = DEFAULT_DICT[base]; }
                      else { delete newDict[base]; }
                      setDict(newDict); saveCustomDict(newDict);
                      toast.success(`「${base}」をリセットしました`);
                    }} className="text-muted-foreground hover:text-neon-red transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {tokens && plainSegments && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
            {/* 修正1: 要確認リストに削除ボタン */}
            {needsCheckTokens.length > 0 && (
              <div className="bg-neon-amber/5 border border-neon-amber/30 rounded-lg p-3">
                <button onClick={() => setShowNeedsCheck(v => !v)} className="flex items-center gap-2 w-full">
                  <AlertTriangle className="w-4 h-4 text-neon-amber" />
                  <span className="text-xs font-bold text-neon-amber">固有名詞・要確認（{needsCheckTokens.length}件）</span>
                  {showNeedsCheck ? <ChevronUp className="w-3.5 h-3.5 text-neon-amber ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-neon-amber ml-auto" />}
                </button>
                <AnimatePresence>
                  {showNeedsCheck && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="flex flex-wrap gap-2 mt-3">
                        {needsCheckTokens.map(t => (
                          <span key={t.id} className="inline-flex items-center gap-1 bg-neon-amber/10 border border-neon-amber/30 rounded px-2 py-1 text-xs">
                            <span className="text-foreground font-medium">{t.base}</span>
                            {t.ruby && <span className="text-muted-foreground">《{t.ruby}》</span>}
                            <button
                              onClick={() => handleDeleteRuby(t.id)}
                              className="ml-1 text-muted-foreground hover:text-neon-red transition-colors"
                              title="ルビを削除"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* インタラクティブプレビュー（削除ボタン付き） */}
            <div>
              <p className="text-xs font-bold mb-2">インタラクティブプレビュー <span className="text-muted-foreground font-normal text-[10px]">（ルビをクリックで編集、×で削除）</span></p>
              <div className="bg-secondary/60 rounded-lg p-4 border border-border text-sm leading-loose font-body min-h-[60px]">
                {plainSegments.map((seg, i) => {
                  if (seg.type === 'plain') return <span key={i} className="whitespace-pre-wrap">{seg.text}</span>;
                  const t = tokenMap[seg.tokenId];
                  if (!t) return null;
                  const isEditingThis = editingId === t.id;
                  return (
                    <span key={i} className="relative inline-block group/ruby">
                      <span className="relative inline-flex flex-col items-center align-bottom">
                        <button onClick={() => setEditingId(isEditingThis ? null : t.id)}
                          className={`relative inline-flex flex-col items-center align-bottom cursor-pointer rounded px-0.5 transition-colors ${t.needsCheck ? 'bg-neon-amber/10 hover:bg-neon-amber/20' : 'hover:bg-neon-pink/10'} ${isEditingThis ? 'ring-1 ring-neon-pink/60' : ''}`}>
                          {t.ruby && <span className={`text-[9px] leading-none mb-0.5 ${t.needsCheck ? 'text-neon-amber' : 'text-neon-pink/80'}`}>{t.ruby}</span>}
                          <span className={`text-sm leading-tight ${t.needsCheck ? 'text-neon-amber' : ''}`}>{t.base}</span>
                          <Pencil className="absolute -top-1 -right-1 w-2.5 h-2.5 text-neon-pink/50 opacity-0 group-hover/ruby:opacity-100 transition-opacity" />
                        </button>
                        {/* 削除ボタン */}
                        {t.ruby && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRuby(t.id); }}
                            className="absolute -top-2 -right-2 w-3.5 h-3.5 bg-neon-red/80 hover:bg-neon-red rounded-full flex items-center justify-center opacity-0 group-hover/ruby:opacity-100 transition-opacity z-10"
                            title="ルビを削除"
                          >
                            <X className="w-2 h-2 text-white" />
                          </button>
                        )}
                      </span>
                      {isEditingThis && <RubyEditPopover token={t} onSave={handleSaveRuby} onClose={() => setEditingId(null)} />}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                <button onClick={() => setCopyFormat('epub')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${copyFormat === 'epub' ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40' : 'text-muted-foreground hover:text-foreground'}`}>
                  <FileType className="w-3.5 h-3.5" />epub / 《》
                </button>
                <button onClick={() => setCopyFormat('docx')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${copyFormat === 'docx' ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/40' : 'text-muted-foreground hover:text-foreground'}`}>
                  <FileType className="w-3.5 h-3.5" />docx / |《》
                </button>
              </div>
              <Button onClick={handleCopy} className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 text-xs h-8">
                {copied ? <><Check className="w-3.5 h-3.5 mr-1.5" />コピー済み</> : <><Copy className="w-3.5 h-3.5 mr-1.5" />ルビ付きテキストをコピー</>}
              </Button>
            </div>

            <div className="bg-secondary/30 rounded-lg p-3 border border-border">
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">出力プレビュー（{copyFormat === 'epub' ? 'epub/《》記法' : 'docx/|《》記法'}）</p>
              <pre className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-body max-h-40 overflow-y-auto">{buildOutputText()}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NeonCard>
  );
}