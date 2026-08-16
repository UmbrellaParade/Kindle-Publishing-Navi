import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCopy,
  Code2,
  ExternalLink,
  FileCheck2,
  FolderCheck,
  KeyRound,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  GOLIATH_BRAIN_MATERIAL_URL,
  GOLIATH_SKILL_CREATION_PROMPT,
  OPENAI_CODEX_SKILLS_GUIDE_URL,
} from '@/lib/goliathSkillGuide';

const CARD_STYLE = {
  background: '#1a1a2e',
  border: '1px solid #2a2a4a',
};

const WORKFLOW_STEPS = [
  {
    icon: FileCheck2,
    title: '1. 教材・GPTを用意する',
    body: 'Brainの教材ページや手元の資料と、自分で確認できるGPTの指示・知識ファイルを準備します。',
  },
  {
    icon: FolderCheck,
    title: '2. 指示文をCodexへ貼る',
    body: '下の指示文をコピーし、新しいCodexのチャットへ貼ります。保存先が分からなくても、その場で相談できます。',
  },
  {
    icon: CheckCircle2,
    title: '3. 質問に答えて検品する',
    body: 'Codexからの確認に答え、作成されたスキルの保存先・呼び出し例・テスト結果を最後に確認します。',
  },
];

function copyFailureMessage() {
  return 'コピーできませんでした。ブラウザのクリップボード許可を確認するか、下の全文欄から手動でコピーしてください。';
}

export default function GoliathBrainSkillsTab() {
  const [copyState, setCopyState] = useState({ kind: 'idle', message: '' });
  const [showManualCopy, setShowManualCopy] = useState(false);
  const fallbackRef = useRef(null);
  const statusTimerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(statusTimerRef.current), []);

  const announceCopyState = (kind, message) => {
    window.clearTimeout(statusTimerRef.current);
    setCopyState({ kind, message });
    if (kind === 'success') {
      statusTimerRef.current = window.setTimeout(() => {
        setCopyState({ kind: 'idle', message: '' });
      }, 4500);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(GOLIATH_SKILL_CREATION_PROMPT);
      setShowManualCopy(false);
      announceCopyState('success', 'Codexへのスキル化指示文をコピーしました。新しいCodexのチャットへ貼り付けてください。');
    } catch {
      setShowManualCopy(true);
      announceCopyState('error', copyFailureMessage());
      window.requestAnimationFrame(() => {
        fallbackRef.current?.focus();
        fallbackRef.current?.select();
      });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section aria-labelledby="goliath-brain-skills-heading" className="overflow-hidden rounded-2xl" style={CARD_STYLE}>
        <div className="border-b border-neon-cyan/20 bg-neon-cyan/5 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2.5 py-1 text-[11px] font-black text-neon-cyan">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              初心者向け
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-200">
              <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
              コピーして開始
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-neon-amber/35 bg-neon-amber/10 px-2.5 py-1 text-[11px] font-black text-neon-amber">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              自動送信なし
            </span>
          </div>

          <div className="mt-4 flex items-start gap-3">
            <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 p-2.5 text-neon-cyan">
              <Code2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="goliath-brain-skills-heading" className="text-xl font-black text-foreground sm:text-2xl">
                ゴリアスさんのBrain＆スキル化
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                教材やGPTの知識を、Codexで何度も使える自分専用の作業手順へ整理する入口です。教材を開くことと、スキル化を始めることを、この画面から迷わず進められます。
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section aria-labelledby="goliath-brain-material-heading" className="rounded-xl border border-neon-pink/30 bg-neon-pink/5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-6 w-6 flex-shrink-0 text-neon-pink" aria-hidden="true" />
            <div className="min-w-0">
              <h3 id="goliath-brain-material-heading" className="font-black text-neon-pink">ゴリアスさんのBrain教材</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                教材の商品ページを新しいタブで開きます。購入状況やログインが必要な場合は、Brain側で確認してください。
              </p>
              <a
                href={GOLIATH_BRAIN_MATERIAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="ゴリアスさんのBrain教材を新しいタブで開く"
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-neon-pink/45 bg-neon-pink/10 px-4 py-3 text-sm font-black text-slate-50 transition hover:bg-neon-pink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/80 sm:w-auto"
              >
                ゴリアスさんのBrain教材を開く
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                このナビはBrainへ自動ログインせず、教材本文を保存・転載・同期しません。
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="goliath-gpt-material-heading" className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <MessagesSquare className="mt-0.5 h-6 w-6 flex-shrink-0 text-neon-cyan" aria-hidden="true" />
            <div className="min-w-0">
              <h3 id="goliath-gpt-material-heading" className="font-black text-neon-cyan">確認できる資料があれば、各GPTの役割もスキル化できます</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                GPTのURLだけでは、非公開の指示や知識ファイルまでは読み取れません。自分が確認・利用できるGPT名、指示、会話スターター、知識ファイルを準備してください。
              </p>
              <a
                href={OPENAI_CODEX_SKILLS_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="OpenAI公式のCodexスキル作成ガイドを新しいタブで開く"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-neon-cyan/35 px-3 py-2 text-xs font-black text-neon-cyan transition hover:bg-neon-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
              >
                OpenAI公式のスキル作成ガイド
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </div>

      <section aria-labelledby="goliath-skill-workflow-heading" className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
        <p className="text-xs font-black text-neon-cyan">やることは3つだけ</p>
        <h3 id="goliath-skill-workflow-heading" className="mt-1 text-lg font-black text-foreground">Codexに貼った後は、質問に答えれば進みます</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {WORKFLOW_STEPS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-lg border border-white/10 bg-black/10 p-4">
              <Icon className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
              <h4 className="mt-3 text-sm font-black text-foreground">{title}</h4>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="goliath-skill-prompt-heading" className="overflow-hidden rounded-xl" style={CARD_STYLE}>
        <div className="border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <ClipboardCopy className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-pink" aria-hidden="true" />
            <div>
              <h3 id="goliath-skill-prompt-heading" className="font-black text-foreground">Codexへ貼るスキル化指示文</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                コピー後、新しいCodexのチャットへ貼り、［ ］の部分を分かる範囲で書き換えて送信してください。分からない欄は空欄でも、Codexが先に確認します。
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-neon-pink/50 bg-neon-pink/15 px-4 py-3 text-sm font-black text-slate-50 transition hover:bg-neon-pink/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/80 sm:w-auto"
          >
            {copyState.kind === 'success' ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <ClipboardCopy className="h-5 w-5" aria-hidden="true" />}
            Codexへのスキル化指示文をコピー
          </button>

          {copyState.message && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                copyState.kind === 'success'
                  ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
                  : 'border-neon-amber/40 bg-neon-amber/10 text-neon-amber'
              }`}
            >
              {copyState.message}
            </div>
          )}

          <details className="group rounded-lg border border-white/10 bg-black/10">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm font-black text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-cyan/80">
              指示文の全文を確認する
            </summary>
            <div className="border-t border-white/10 p-3">
              <textarea
                readOnly
                value={GOLIATH_SKILL_CREATION_PROMPT}
                aria-label="Codexへのスキル化指示文の全文"
                rows={18}
                className="w-full resize-y rounded-lg border border-[#34345a] bg-[#0d0d1a] px-3 py-3 font-mono text-xs leading-6 text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
              />
            </div>
          </details>

          {showManualCopy && (
            <div className="rounded-lg border border-neon-amber/35 bg-neon-amber/5 p-3">
              <label htmlFor="goliath-skill-prompt-fallback" className="text-xs font-black text-neon-amber">
                手動コピー用の全文
              </label>
              <textarea
                id="goliath-skill-prompt-fallback"
                ref={fallbackRef}
                readOnly
                value={GOLIATH_SKILL_CREATION_PROMPT}
                rows={10}
                className="mt-2 w-full resize-y rounded-lg border border-neon-amber/30 bg-[#0d0d1a] px-3 py-3 font-mono text-xs leading-6 text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber/80"
              />
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="goliath-skill-safety-heading" className="rounded-xl border border-neon-amber/35 bg-neon-amber/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-amber" aria-hidden="true" />
          <div>
            <h3 id="goliath-skill-safety-heading" className="font-black text-neon-amber">読み込ませてよい資料だけを使ってください</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              購入・閲覧できることだけで、複製・Codexでの処理・保存まで許可されるとは限りません。自分で利用する権利があり、Codexへ読み込ませてよい教材・GPT設定だけを使います。限定URL、ログイン情報、Cookie、APIキーを指示文やスキルへ残さず、作成したスキルを第三者へ共有するときは教材の利用条件を改めて確認してください。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
