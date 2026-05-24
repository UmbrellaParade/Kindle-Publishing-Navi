import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Wand2, Loader2, ChevronRight, Link2,
  Sparkles, BookOpen, Trophy, ChevronDown, ChevronUp
} from 'lucide-react';
import NeonCard from '../NeonCard';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';

const GENRE_OPTIONS = [
  { value: 'lit', label: 'フィクション > 文学' },
  { value: 'fiction_general', label: 'フィクション > 一般' },
  { value: 'action', label: 'フィクション > アクション、アドベンチャー' },
  { value: 'fantasy_general', label: 'フィクション > ファンタジー > 一般' },
  { value: 'dark_fantasy', label: 'フィクション > ファンタジー > ダークファンタジー' },
  { value: 'epic_fantasy', label: 'フィクション > ファンタジー > 叙事詩' },
  { value: 'paranormal_fantasy', label: 'フィクション > ファンタジー > 超常現象' },
  { value: 'urban_fantasy', label: 'フィクション > ファンタジー > 都市' },
  { value: 'horror', label: 'フィクション > ホラー' },
  { value: 'magical_realism', label: 'フィクション > マジカルリアリズム' },
  { value: 'mystery', label: 'フィクション > ミステリー、探偵小説 > 一般' },
  { value: 'sf', label: 'フィクション > SF > 一般' },
  { value: 'supernatural_thriller', label: 'フィクション > スリラー > 超自然サスペンス' },
  { value: 'romance_fantasy', label: 'フィクション > ロマンス > ファンタジー' },
  { value: 'light_novel', label: 'ライトノベル > 一般' },
];

const FORMAT_BY_GENRE = {
  lit:                  { rec: 'docx（縦書き）', emphasis: 'pink', reason: '文学は縦書きdocxが最適。文章の重みと格調が縦書きで際立つ。', epubNote: '詩集・歌集など特殊レイアウトが必要な場合のみepub。' },
  fiction_general:      { rec: 'docx（縦書き）', emphasis: 'pink', reason: 'フィクション全般は縦書きdocxで安定出力できる。変換エラーリスクが最も低い。', epubNote: '挿絵・図解が多い場合のみepubを検討。URLリンクがある場合はdocx確定。' },
  action:               { rec: 'docx（縦書き）', emphasis: 'pink', reason: 'アクション小説は縦書きのテンポが戦闘シーンの緊張感を高める。', epubNote: '地図・イラストを多数入れる場合はepubも選択肢に。' },
  fantasy_general:      { rec: 'docx（縦書き）', emphasis: 'pink', reason: 'ファンタジーは縦書きdocxが最安全。世界観の没入感を高める。', epubNote: '独自レイアウト・挿絵が多い場合はepubも選択肢に。URLリンクがある場合はdocx優先。' },
  dark_fantasy:         { rec: 'docx（縦書き）＋ URLリンク活用', emphasis: 'pink', reason: 'Umbrella Paradeのようなダークファンタジー×音楽IPは縦書きdocxが最適。楽曲URLをテキストリンクとして本文に埋め込める。', epubNote: '独自装飾にこだわる場合はepubが強い。楽曲URLがある場合はdocx確定。', urlNote: '楽曲URLを含む作品はdocxが必須です。', special: true },
  epic_fantasy:         { rec: 'docx（縦書き）', emphasis: 'pink', reason: '叙事詩系ファンタジーは縦書きで重厚感が増す。長編向きなのでdocxの安定性が活きる。', epubNote: '地図・系譜図を入れる場合はepubを検討。' },
  paranormal_fantasy:   { rec: 'docx（縦書き）', emphasis: 'pink', reason: '超常現象系は縦書きの余白が神秘的な雰囲気を演出する。', epubNote: '特殊演出フォントを使いたい場合はepubを検討。' },
  urban_fantasy:        { rec: 'docx（縦書き）', emphasis: 'pink', reason: '都市ファンタジーは縦書きdocxで問題なし。URLリンク（スポットの地図など）がある場合はdocx確定。', epubNote: '都市マップなどビジュアル要素が多い場合はepubも有効。' },
  horror:               { rec: 'docx（縦書き）', emphasis: 'pink', reason: 'ホラーは縦書きの方が恐怖感が増す。改ページ・余白を恐怖演出に使える。', epubNote: '特殊フォント・赤文字を使いたい場合はepubを検討。URLリンクがある場合はdocx確定。' },
  magical_realism:      { rec: 'docx（縦書き）', emphasis: 'pink', reason: 'マジカルリアリズムは文章の密度が武器。縦書きdocxで日本文学の文脈に乗せやすい。', epubNote: '基本不要。' },
  mystery:              { rec: 'docx（縦書き）', emphasis: 'pink', reason: 'ミステリーは縦書きが読者の期待値。docxで十分対応できる。', epubNote: '図解・地図を多用する場合はepubが有利。URLリンクがある場合はdocx確定。' },
  sf:                   { rec: 'docx または epub', emphasis: 'cyan', reason: 'SFは図解・用語集が多い場合はepubが有利。文章中心ならdocxで十分。', epubNote: '宇宙地図・設定図を入れる場合はepubを検討。URLリンクがある場合はdocx確定。' },
  supernatural_thriller:{ rec: 'docx（縦書き）', emphasis: 'pink', reason: '超自然サスペンスは縦書きの緊張感が活きる。URLリンクがある場合はdocx確定。', epubNote: '演出的な特殊レイアウトを使う場合のみepub。' },
  romance_fantasy:      { rec: 'docx（縦書き）', emphasis: 'pink', reason: 'ロマンス×ファンタジーは縦書きで読む文化が根強い。docxで問題なし。', epubNote: '特に理由なければdocxを推奨。' },
  light_novel:          { rec: 'docx（縦書き）', emphasis: 'pink', reason: 'ラノベはdocxの縦書きに読者が慣れている。変換エラーリスクも低い。', epubNote: '挿絵多数の場合のみepubを検討。URLリンクがある場合はdocx確定。' },
};

export default function GenreDiagnosticConnected({ sharedText, onDiagnosed }) {
  const [loading, setLoading] = useState(false);
  const [revising, setRevising] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [revision, setRevision] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [manualGenre, setManualGenre] = useState('');
  const [showRevision, setShowRevision] = useState(false);

  const inputText = sharedText.trim().slice(0, 500);
  const canDiagnose = inputText.length >= 20;
  const hasSharedText = sharedText.trim().length >= 50;

  const diagnose = async () => {
    if (!canDiagnose) return;
    setLoading(true);
    setAiResult(null);
    setRevision(null);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `あなたはKindle電子書籍のジャンル診断の専門家です。以下の作品コンセプト・あらすじを読んで、最適なジャンルとKDPカテゴリーを診断してください。

【作品コンセプト / あらすじ】
${inputText}

以下を出力してください：
1. genre_key: 最も近いジャンルのキー（lit/fiction_general/action/fantasy_general/dark_fantasy/epic_fantasy/paranormal_fantasy/urban_fantasy/horror/magical_realism/mystery/sf/supernatural_thriller/romance_fantasy/light_novel のいずれか）
2. genre_label: ジャンル名（日本語で、例「ダークファンタジー×音楽ロマン」のように具体的に）
3. diagnosis_message: 「あなたの作品は〇〇です」という形の診断コメント（2〜3文、作品の魅力も含めて）
4. kdp_categories: KDPカテゴリー3つ。必ず以下の実在するカテゴリーリストの中からのみ選ぶこと。リスト外のカテゴリー（「音楽・芸術系フィクション」「音楽エンタメ」等）は絶対に使わないこと。
   【選択可能なKDPカテゴリー（正式名称）】
   - フィクション > 一般
   - フィクション > アクション、アドベンチャー
   - フィクション > ファンタジー > 一般
   - フィクション > ファンタジー > コンテンポラリー
   - フィクション > ファンタジー > ダークファンタジー
   - フィクション > ファンタジー > 叙事詩
   - フィクション > ファンタジー > 史伝
   - フィクション > ファンタジー > 超常現象
   - フィクション > ファンタジー > 都市
   - フィクション > ホラー
   - フィクション > 文学
   - フィクション > マジカルリアリズム
   - フィクション > ミステリー、探偵小説 > 一般
   - フィクション > ミステリー、探偵小説 > ハードボイルド
   - フィクション > SF > 一般
   - フィクション > SF > スペースオペラ
   - フィクション > SF > サイバーパンク
   - フィクション > スリラー > 一般
   - フィクション > スリラー > 超自然サスペンス
   - フィクション > 短編小説
   - フィクション > ロマンス > 一般
   - フィクション > ロマンス > ファンタジー
   - フィクション > 風刺
   - フィクション > 大河小説
   - ライトノベル > 一般
   - ライトノベル > ボーイズラブノベルス
   ※Umbrella Paradeのような音楽×ダークファンタジー系の作品には「フィクション > 文学」「フィクション > ファンタジー > ダークファンタジー」「フィクション > ファンタジー > 一般」を推奨。
5. category_strategy: カテゴリー選定の戦略アドバイス（1〜2文）
6. readability_tips: このジャンルに特有の読みやすさのポイント（3点）
7. has_music_or_url: 音楽や外部URLリンクが含まれそうか（true/false）`,
      response_json_schema: {
        type: 'object',
        properties: {
          genre_key: { type: 'string' },
          genre_label: { type: 'string' },
          diagnosis_message: { type: 'string' },
          kdp_categories: { type: 'array', items: { type: 'string' } },
          category_strategy: { type: 'string' },
          readability_tips: { type: 'array', items: { type: 'string' } },
          has_music_or_url: { type: 'boolean' },
        },
      },
    });

    setAiResult(res);
    if (res?.genre_key) setManualGenre(res.genre_key);
    if (onDiagnosed) {
      onDiagnosed({
        genreKey: res?.genre_key || '',
        genreLabel: res?.genre_label || '',
        primaryCategory: res?.kdp_categories?.[0] || '',
        kdpCategories: res?.kdp_categories || [],
        source: 'genre-diagnostic-connected',
      });
    }
    setLoading(false);
  };

  const reviseForGenre = async () => {
    if (!hasSharedText || !aiResult) return;
    setRevising(true);
    setRevision(null);
    setShowRevision(true);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `あなたはKindle電子書籍の編集者です。以下のテキストを「${aiResult.genre_label}」ジャンルのスタイルに合わせてKindle向けに修正してください。

【テキスト】
${sharedText.slice(0, 3000)}

【修正方針】
- ジャンル（${aiResult.genre_label}）の読者が読みやすいリズム・段落構成にする
- Kindle端末での改行・段落の扱いを最適化する
- セリフや地の文の統一感を整える

修正後テキストと修正のポイント（3点以内）を返してください。`,
      response_json_schema: {
        type: 'object',
        properties: {
          revised_text: { type: 'string' },
          points: { type: 'array', items: { type: 'string' } },
        },
      },
      model: 'claude_sonnet_4_6',
    });
    setRevision(res);
    setRevising(false);
  };

  const displayGenre = aiResult?.genre_key || manualGenre;
  const formatInfo = FORMAT_BY_GENRE[displayGenre];
  const emphasisColor = { pink: 'text-neon-pink neon-pink-glow', cyan: 'text-neon-cyan neon-cyan-glow' };

  return (
    <NeonCard glowColor="pink">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-neon-pink" />
        <h3 className="font-bold text-sm text-neon-pink neon-pink-glow">ジャンル診断</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        上部の共通テキストエリアに貼り付けた本文をもとに、AIがジャンル・カテゴリー・読みやすさのポイントを診断します。
      </p>

      {!hasSharedText && (
        <div className="mb-3 p-3 rounded-lg bg-neon-amber/10 border border-neon-amber/30 text-xs text-neon-amber">
          先に上部の本文エリアにテキストを貼り付けてください。
        </div>
      )}

      <Button
        onClick={diagnose}
        disabled={loading || !canDiagnose}
        className="w-full h-10 bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30 text-sm disabled:opacity-40"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />診断中...</>
          : <><Wand2 className="w-4 h-4 mr-2" />ジャンルを診断する</>}
      </Button>

      {/* AI診断結果 */}
      <AnimatePresence>
        {aiResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">

            {/* 診断メイン */}
            <div className="p-4 rounded-lg bg-neon-pink/10 border border-neon-pink/30">
              <p className="text-[10px] text-neon-pink uppercase tracking-wide mb-1 font-bold">診断結果</p>
              <p className="text-base font-bold text-foreground mb-2">
                あなたの作品は <span className="text-neon-pink neon-pink-glow">「{aiResult.genre_label}」</span> です
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{aiResult.diagnosis_message}</p>
              {aiResult.has_music_or_url && (
                <div className="mt-3 flex items-start gap-2 bg-green-500/10 rounded p-2 border border-green-500/20">
                  <Link2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-400 font-medium">楽曲・外部URLリンクが含まれる作品と判定されました → docx形式を推奨します</p>
                </div>
              )}
            </div>

            {/* KDPカテゴリー */}
            {aiResult.kdp_categories?.length > 0 && (
              <div className="bg-secondary/50 rounded-md p-3 border border-neon-cyan/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <Trophy className="w-3.5 h-3.5 text-neon-amber" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">おすすめKDPカテゴリー（1位狙い含む）</p>
                </div>
                {aiResult.kdp_categories.map((cat, i) => (
                  <div key={i} className="flex items-start gap-2 mb-2">
                    <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5 ${i === 0 ? 'bg-neon-amber/20 text-neon-amber' : 'bg-secondary text-muted-foreground'}`}>
                      {i + 1}位狙い
                    </span>
                    <p className="text-xs text-foreground leading-relaxed">{cat}</p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed border-t border-border pt-2">{aiResult.category_strategy}</p>
                <p className="text-[10px] text-neon-cyan mt-2 pt-2 border-t border-border">
                  ✓ 上記はすべてKDPに実在するカテゴリーです（2025年時点）
                </p>
              </div>
            )}

            {/* 読みやすさのポイント */}
            {aiResult.readability_tips?.length > 0 && (
              <div className="bg-secondary/50 rounded-md p-3 border border-neon-amber/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <BookOpen className="w-3.5 h-3.5 text-neon-amber" />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">このジャンルの読みやすさポイント</p>
                </div>
                {aiResult.readability_tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1.5">
                    <ChevronRight className="w-3 h-3 text-neon-amber mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            )}

            {/* フォーマット情報 */}
            {formatInfo && (
              <div className="bg-secondary/50 rounded-md p-3 border border-neon-pink/20">
                <p className="text-[10px] text-muted-foreground mb-1 tracking-wide uppercase">推奨フォーマット</p>
                <p className={`text-sm font-bold mb-1.5 ${emphasisColor[formatInfo.emphasis]}`}>{formatInfo.rec}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{formatInfo.reason}</p>
                {formatInfo.epubNote && (
                  <p className="text-xs text-neon-amber mt-1.5">
                    <span className="font-medium">epub検討タイミング：</span>{formatInfo.epubNote}
                  </p>
                )}
              </div>
            )}

            {/* 本文修正ボタン */}
            {hasSharedText && (
              <Button
                onClick={reviseForGenre}
                disabled={revising}
                className="w-full h-9 bg-neon-amber/20 text-neon-amber border border-neon-amber/40 hover:bg-neon-amber/30 text-xs"
              >
                {revising
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />修正中...</>
                  : <><Wand2 className="w-3.5 h-3.5 mr-1.5" />このジャンル向けに本文を修正する</>}
              </Button>
            )}

            {/* 修正結果 */}
            <AnimatePresence>
              {revision && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  {revision.points?.length > 0 && (
                    <div className="bg-secondary/50 rounded-md p-3">
                      <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">修正のポイント</p>
                      {revision.points.map((p, i) => (
                        <div key={i} className="flex items-start gap-1.5 mb-1 text-xs text-muted-foreground">
                          <ChevronRight className="w-3 h-3 text-neon-amber mt-0.5 flex-shrink-0" />{p}
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setShowRevision(v => !v)} className="flex items-center gap-2 text-xs text-neon-cyan hover:text-neon-pink transition-colors">
                    {showRevision ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    修正後テキストを{showRevision ? '閉じる' : '表示する'}
                  </button>
                  {showRevision && revision.revised_text && (
                    <RevisionOutput text={revision.revised_text} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 手動選択（補助） */}
      <div className="mt-5 border-t border-border pt-4">
        <button onClick={() => setShowManual(v => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {showManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          ジャンルを手動で選んでフォーマット情報だけ確認する
        </button>
        <AnimatePresence>
          {showManual && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 space-y-3">
                <Select value={manualGenre} onValueChange={setManualGenre}>
                  <SelectTrigger className="bg-secondary border-border focus:border-neon-pink/50 text-sm">
                    <SelectValue placeholder="ジャンルを選択..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {GENRE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formatInfo && !aiResult && (
                  <div className="bg-secondary/50 rounded-md p-3 border border-neon-pink/20">
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">推奨フォーマット</p>
                    <p className={`text-sm font-bold mb-1.5 ${emphasisColor[formatInfo.emphasis]}`}>{formatInfo.rec}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{formatInfo.reason}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </NeonCard>
  );
}

function RevisionOutput({ text }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="rounded-lg border border-neon-cyan/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-neon-cyan/5">
        <span className="text-xs font-bold text-neon-cyan">修正後テキスト</span>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-neon-cyan hover:bg-neon-cyan/20" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
          {copied ? '✓ コピー済み' : 'コピー'}
        </Button>
      </div>
      <pre className="p-4 text-xs text-foreground whitespace-pre-wrap leading-relaxed font-body bg-secondary/30 max-h-80 overflow-y-auto">{text}</pre>
    </div>
  );
}
