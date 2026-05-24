import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Copy, BookOpen, Download, FileText } from 'lucide-react';
import NeonCard from '../NeonCard';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const GENRE_OPTIONS = [
  { value: 'ダークファンタジー / 音楽ファンタジー', label: 'ダークファンタジー / 音楽ファンタジー' },
  { value: 'ヒューマンドラマ', label: 'ヒューマンドラマ' },
  { value: 'SF・サイバーパンク', label: 'SF・サイバーパンク' },
  { value: 'ライトノベル', label: 'ライトノベル' },
  { value: 'ミステリー・サスペンス', label: 'ミステリー・サスペンス' },
  { value: 'ホラー', label: 'ホラー' },
  { value: 'ロマンス・恋愛', label: 'ロマンス・恋愛' },
  { value: 'ノンフィクション・エッセイ', label: 'ノンフィクション・エッセイ' },
  { value: '歴史・時代小説', label: '歴史・時代小説' },
  { value: '純文学', label: '純文学' },
  { value: 'コージーミステリー', label: 'コージーミステリー' },
  { value: 'アクション・冒険', label: 'アクション・冒険' },
  { value: '青春・成長物語', label: '青春・成長物語' },
  { value: 'ビジネス・自己啓発', label: 'ビジネス・自己啓発' },
  { value: '詩・散文', label: '詩・散文' },
];

const GENRE_INSTRUCTIONS = {
  'ダークファンタジー / 音楽ファンタジー': `【修正方針】
- 1 文が長すぎる箇所を分割して読みやすく
- 感情の高まる場面は 1 文 1 行の「息継ぎ」改行を入れる
- 台詞の前後に適切な空白行
- 章の冒頭・末尾は余韻が残るよう短い文で締める
- テンポが単調な連続描写にリズム変化を加える`,
  'ヒューマンドラマ': `【修正方針】
- 心理描写の文を丁寧に分割
- 感情の転換点に空白行
- 台詞と地の文のバランスを整える`,
  'SF・サイバーパンク': `【修正方針】
- 技術描写は簡潔に、感情描写は丁寧に
- 1 文 1 情報を原則に分割
- 場面転換に空白行`,
  'ライトノベル': `【修正方針】
- 1 文 60 文字以内を目標に分割
- 台詞は 1 行ごとに改行
- 感情表現は短い文で`,
  'ミステリー・サスペンス': `【修正方針】
- 伏線部分は短く印象的に
- 緊張感は短い文でリズムを
- 情報開示は適切な行間で`,
  'ホラー': `【修正方針】
- 恐怖描写は短い文で余韻を
- 1 文 1 行の「間」を効果的に
- 不気味なシーンは余白で表現`,
  'ロマンス・恋愛': `【修正方針】
- 心理描写は丁寧に、感情の機微を
- 会話と地の文のバランスを
- 感動的な場面は短い文で締める`,
  'ノンフィクション・エッセイ': `【修正方針】
- 1 文 1 メッセージを明確に
- 段落ごとに適切な行間
- 読みやすい文長に整理`,
  '歴史・時代小説': `【修正方針】
- 時代背景の説明は簡潔に
- 台詞は時代劇らしいリズムで
- 場面転換を明確に`,
  '純文学': `【修正方針】
- 心理描写を深く、丁寧に
- 文のリズムに緩急を
- 余韻を残す表現を`,
  'コージーミステリー': `【修正方針】
- 軽妙なタッチで読みやすく
- 伏線は自然に配置
- 会話中心の展開に`,
  'アクション・冒険': `【修正方針】
- 動作描写は短い文でテンポよく
- 緊張感は 1 文 1 行で
- 場面転換を明確に`,
  '青春・成長物語': `【修正方針】
- 心情描写は丁寧に、共感やすく
- 会話と地の文のバランスを
- 感動的な場面は短い文で`,
  'ビジネス・自己啓発': `【修正方針】
- 1 文 1 メッセージを明確に
- 重要な箇所は改行で強調
- 読みやすい構成に整理`,
  '詩・散文': `【修正方針】
- 行間・余白を効果的に
- リズムと韻を重視
- 視覚的な美しさを`,
};

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };

export default function Step4ReadabilityCheck({ sharedText, diagnosedGenre, onVersionChange, project }) {
  // FormatGuideTab から使われる場合は project が渡されないため、localStorage から取得
  const projectName = project?.name || '原稿';
  const [selectedGenre, setSelectedGenre] = useState('ダークファンタジー / 音楽ファンタジー');
  const [loading, setLoading] = useState(false);
  const [revisedText, setRevisedText] = useState('');
  const [manualText, setManualText] = useState('');
  const [activeTab, setActiveTab] = useState('original');
  const [importedText, setImportedText] = useState('');

  useEffect(() => {
    setRevisedText('');
    setManualText('');
    setImportedText('');
    setActiveTab('original');
  }, [sharedText]);

  useEffect(() => {
    if (diagnosedGenre && !selectedGenre) {
      const matched = GENRE_OPTIONS.find(g => diagnosedGenre.includes(g.value.split('/')[0].trim()));
      if (matched) setSelectedGenre(matched.value);
    }
  }, [diagnosedGenre]);

  const analyze = async () => {
    const text = sharedText.trim();
    if (text.length < 50) {
      toast.error('50 文字以上入力してください');
      return;
    }

    setLoading(true);
    setRevisedText('');

    const instructions = GENRE_INSTRUCTIONS[selectedGenre] || GENRE_INSTRUCTIONS['ダークファンタジー / 音楽ファンタジー'];

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `あなたは Kindle 出版の文章編集専門家です。以下のテキストを「${selectedGenre}」ジャンルのベストセラーに合わせて、文章の見た目・構成・リズムを整えてください。

【重要】意味・ストーリー・登場人物・設定は絶対に変えないでください。あくまで「読みやすさ」のための調整のみ行ってください。

${instructions}

【原文】
${text.slice(0, 4000)}

【出力形式】
修正後のテキストのみを出力してください。解説やコメントは不要です。`,
        model: 'claude_sonnet_4_6',
      });

      setRevisedText(res);
      setManualText('');
      setImportedText('');
      toast.success('文章を整えました');
      setTimeout(() => {
        document.getElementById('readability-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    } catch (err) {
      toast.error('エラーが発生しました：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('コピーしました');
  };

  const importText = () => {
    if (!importedText.trim()) {
      toast.error('原稿が入力されていません');
      return;
    }
    setRevisedText(importedText);
    setManualText('');
    setActiveTab('revised');
    toast.success('原稿を取り込みました');
  };

  const downloadDocx = async () => {
    const textToDownload = revisedText || sharedText;
    if (!textToDownload) {
      toast.error('ダウンロードする原稿がありません');
      return;
    }

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `原稿_${projectName}_${date}.docx`;

    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `以下のテキストを HTML 形式（Word で開ける形式）に変換してください。
- 游明朝または Noto Serif JP、11pt を使用
- 行間は 1.5〜2.0
- 段落間にスペースを空ける
- 見出しは<h4>、本文は<p>タグ

【テキスト】
${textToDownload.slice(0, 4000)}`,
        model: 'claude_sonnet_4_6',
      });

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Noto Serif JP', '游明朝', serif; font-size: 11pt; line-height: 2.0; }
  p { margin: 1em 0; }
  h4 { font-size: 13pt; margin: 1.5em 0 0.5em; }
</style>
</head>
<body>
${res}
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('DOCX でダウンロードしました');
    } catch (err) {
      toast.error('ダウンロードに失敗しました：' + err.message);
    }
  };

  const downloadTxt = () => {
    const textToDownload = revisedText || sharedText;
    if (!textToDownload) {
      toast.error('ダウンロードする原稿がありません');
      return;
    }

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `原稿_${projectName}_${date}.txt`;

    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('TXT でダウンロードしました');
  };

  const getFinalText = () => {
    return importedText || revisedText || sharedText;
  };

  return (
    <NeonCard glowColor="amber">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="w-4 h-4 text-neon-amber" />
        <h3 className="font-bold text-sm text-neon-amber neon-amber-glow">📖 読みやすさ修正</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        選択したジャンルの Kindle ベストセラーに合わせて、文章の見た目・構成・リズムを整えます。
        {sharedText.trim().length < 50 && <span className="text-neon-amber ml-1">（上の入力エリアに本文を貼り付けてください）</span>}
      </p>

      {/* ジャンル選択 */}
      <div className="mb-4 space-y-2">
        <p className="text-xs font-bold text-foreground">対象ジャンルを選択</p>
        <Select value={selectedGenre} onValueChange={setSelectedGenre}>
          <SelectTrigger className="bg-secondary border-border focus:border-neon-amber/50 text-sm">
            <SelectValue placeholder="ジャンルを選択してください..." />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {GENRE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 修正方針表示 */}
      {selectedGenre && (
        <div className="mb-4 rounded-lg p-3 text-xs leading-relaxed" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2a4a' }}>
          <p className="font-bold text-neon-cyan mb-1">{selectedGenre} の修正方針：</p>
          <p className="text-muted-foreground whitespace-pre-wrap">{GENRE_INSTRUCTIONS[selectedGenre]}</p>
        </div>
      )}

      <Button
        onClick={analyze}
        disabled={loading || sharedText.trim().length < 50}
        className="w-full h-9 bg-neon-amber/20 text-neon-amber border border-neon-amber/40 hover:bg-neon-amber/30 text-xs disabled:opacity-40"
      >
        {loading
          ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />修正中...</>
          : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />✨ このジャンルに合わせて文章を整える</>}
      </Button>
      <p className="text-[10px] text-muted-foreground mt-1">※ 高品質分析のため AI を使用します。Base44 のクレジットが消費されます</p>

      <AnimatePresence>
        {revisedText && (
          <motion.div id="readability-result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
            
            {/* タブ切り替え */}
            <div className="rounded-lg overflow-hidden" style={CARD_STYLE}>
              <div className="flex border-b" style={{ borderColor: '#2a2a4a' }}>
                <button
                  onClick={() => setActiveTab('original')}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'original' ? 'bg-neon-pink/10 text-neon-pink' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <BookOpen className="w-3.5 h-3.5" />📄 修正前
                </button>
                <button
                  onClick={() => setActiveTab('revised')}
                  className={`flex-1 px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'revised' ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />✨ 修正後
                </button>
              </div>

              {/* タブコンテンツ */}
              <div className="p-4">
                {activeTab === 'original' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-muted-foreground">元の本文（読み取り専用）</p>
                      <Button size="sm" variant="ghost" onClick={() => copyText(sharedText)} className="h-7 text-xs gap-1">
                        <Copy className="w-3 h-3" />📋 コピー
                      </Button>
                    </div>
                    <div className="rounded-lg p-3 text-sm leading-relaxed max-h-[600px] overflow-y-auto" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2a2a4a' }}>
                      {sharedText}
                    </div>
                  </div>
                )}

                {activeTab === 'revised' && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-neon-cyan">✨ 修正後（直接編集可能）</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => copyText(revisedText)} className="h-7 text-xs gap-1 text-neon-cyan">
                            <Copy className="w-3 h-3" />📋 コピー
                          </Button>
                        </div>
                      </div>
                      <textarea
                        value={revisedText}
                        onChange={(e) => setRevisedText(e.target.value)}
                        className="w-full min-h-[600px] p-4 text-sm rounded-lg focus:outline-none resize-y leading-[2.0]"
                        style={{
                          background: '#ffffff',
                          color: '#111111',
                          fontFamily: "'Noto Serif JP', serif",
                          border: '1px solid #2a2a4a',
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground mt-2">
                        フォント：明朝系 / 行間：2.0 / Kindle の読書画面に近い表示
                      </p>
                    </div>

                    {/* 📥 仕上げ原稿を取り込む */}
                    <div className="rounded-lg p-4 border border-neon-pink/30" style={{ background: 'rgba(255,45,120,0.04)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Download className="w-4 h-4 text-neon-pink" />
                        <p className="text-sm font-bold text-neon-pink">📥 仕上げ原稿を取り込む</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">外部で編集した原稿をここに貼り付けてください。取り込むと上の「修正後プレビュー」エリアに反映され、手動編集も可能になります。</p>
                      <textarea
                        value={importedText}
                        onChange={(e) => setImportedText(e.target.value)}
                        placeholder="外部で修正した原稿をここにコピペしてください"
                        className="w-full min-h-[300px] p-3 text-sm rounded-lg focus:outline-none resize-y"
                        style={{
                          background: '#ffffff',
                          color: '#111111',
                          border: '1px solid #2a2a4a',
                        }}
                      />
                      <Button
                        onClick={importText}
                        className="mt-2 h-8 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30"
                      >
                        <Download className="w-3 h-3 mr-1.5" />📥 この原稿を取り込む
                      </Button>
                    </div>

                    {/* 💾 ダウンロードエリア */}
                    <div className="rounded-lg p-4 border border-neon-cyan/30" style={{ background: 'rgba(0,245,255,0.04)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-neon-cyan" />
                        <p className="text-sm font-bold text-neon-cyan">💾 ダウンロード</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">取り込み（または手動編集）した最終原稿をダウンロードできます。</p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={downloadDocx}
                          className="h-9 text-xs gap-1.5 bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30"
                        >
                          <Download className="w-3.5 h-3.5" />📄 .docx でダウンロード
                        </Button>
                        <Button
                          onClick={downloadTxt}
                          className="h-9 text-xs gap-1.5 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30"
                        >
                          <Download className="w-3.5 h-3.5" />📝 .txt でダウンロード
                        </Button>
                        <Button
                          onClick={() => copyText(getFinalText())}
                          className="h-9 text-xs gap-1.5 bg-secondary text-foreground border border-border hover:border-neon-cyan/50"
                        >
                          <Copy className="w-3.5 h-3.5" />📋 全文コピー
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </NeonCard>
  );
}