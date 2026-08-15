import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Monitor,
  PenLine,
  Printer,
  QrCode,
  ShieldCheck,
  WandSparkles,
} from 'lucide-react';
import {
  KINDLE_MANUSCRIPT_FORMATTER_URL,
  SHIMAUMA_PUBLISH_NOVEL_URL,
} from '@/lib/externalTools';
import ManuscriptFormatterManual from './ManuscriptFormatterManual';

const CARD_STYLE = {
  background: '#1a1a2e',
  border: '1px solid #2a2a4a',
};

const CAPABILITIES = [
  {
    icon: FileText,
    title: 'Kindle電子書籍',
    tone: 'cyan',
    body: '見出し・目次・改ページ・画像を整え、KDPへ登録するDOCXを書き出します。電子書籍の表示はA5固定ではありません。',
  },
  {
    icon: Printer,
    title: 'しまうま出版の紙の本',
    tone: 'pink',
    body: 'A5とA6の印刷用PDFを仕上げられます。A6は一般的な文庫本サイズで、紙の本を1冊から作りたい方にも分かりやすい選択肢です。',
  },
  {
    icon: QrCode,
    title: 'QRコード付き案内',
    tone: 'amber',
    body: 'URLからQRコード付きカードをツール内で作り、本文へ配置できます。完成PDFではスマートフォンでリンク先を確認してください。',
  },
];

const CAPABILITY_TONES = {
  cyan: 'border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan',
  pink: 'border-neon-pink/30 bg-neon-pink/5 text-neon-pink',
  amber: 'border-neon-amber/35 bg-neon-amber/5 text-neon-amber',
};

const WORKFLOW_STEPS = [
  {
    icon: PenLine,
    title: '1. 文章を完成させる',
    body: 'GoogleドキュメントやWordなど、書き慣れた場所で本文を書き終えます。',
  },
  {
    icon: WandSparkles,
    title: '2. 本の形へ整える',
    body: '完成原稿をこのツールへ移し、見出し・改ページ・目次・画像・QRコードを整えます。',
  },
  {
    icon: CheckCircle2,
    title: '3. 用途別に書き出す',
    body: 'KindleはDOCX、しまうま出版の紙版はA5またはA6のPDFで書き出して確認します。',
  },
];

export default function ManuscriptFormatterTab() {
  const [showManual, setShowManual] = useState(false);

  const changeView = nextView => {
    setShowManual(nextView === 'manual');
    window.setTimeout(() => {
      const root = document.getElementById(
        nextView === 'manual' ? 'manuscript-formatter-manual' : 'manuscript-formatter-overview',
      );
      const focusTarget = document.getElementById(
        nextView === 'manual' ? 'formatter-manual-page-title' : 'open-formatter-manual-button',
      );
      root?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      focusTarget?.focus({ preventScroll: true });
    }, 0);
  };

  if (showManual) {
    return <ManuscriptFormatterManual onBack={() => changeView('overview')} />;
  }

  return (
    <div id="manuscript-formatter-overview" className="mx-auto max-w-5xl scroll-mt-24 space-y-5">
      <section
        aria-labelledby="manuscript-formatter-heading"
        className="overflow-hidden rounded-2xl"
        style={CARD_STYLE}
      >
        <div className="border-b border-neon-cyan/20 bg-neon-cyan/5 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              完成原稿の仕上げ用
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2.5 py-1 text-[11px] font-bold text-neon-cyan">
              <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
              PC専用
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-2.5 py-1 text-[11px] font-black text-neon-amber">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              テスト版
            </span>
          </div>

          <div className="mt-4 flex items-start gap-3">
            <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 p-2.5 text-neon-cyan">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="manuscript-formatter-heading" className="text-xl font-black text-foreground sm:text-2xl">
                完成した文章を、本の形へ整えるツール
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                文章を書き終えたあとに、Kindle向けDOCXや、しまうま出版向けA5・A6印刷用PDFへ仕上げます。
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="rounded-xl border border-neon-amber/35 bg-neon-amber/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-amber" aria-hidden="true" />
              <div>
                <h3 className="font-black text-neon-amber">このツール内で文章をゼロから書く用途には向きません</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  GoogleドキュメントやWordなどで文章を完成させてから、見出し・改ページ・目次・画像・QRコードを整える仕上げ工程で使ってください。
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={KINDLE_MANUSCRIPT_FORMATTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Kindle原稿整形ツール（テスト版）を新しいタブで開く"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-neon-cyan/50 bg-neon-cyan/15 px-4 py-3 text-sm font-black text-neon-cyan transition-colors hover:bg-neon-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 sm:w-auto"
            >
              PCで完成した原稿を整形する
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <button
              id="open-formatter-manual-button"
              type="button"
              onClick={() => changeView('manual')}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-black text-foreground transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 sm:w-auto"
            >
              先に使い方を読む
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            整形ツールは新しいタブで開きます。スマートフォンでは表示が崩れるため、必ずPCで使用してください。このナビのプロジェクトとは自動同期されません。
          </p>
        </div>
      </section>

      <section aria-labelledby="formatter-capabilities-heading" className="space-y-3">
        <div>
          <p className="text-xs font-black text-neon-cyan">このツールでできること</p>
          <h2 id="formatter-capabilities-heading" className="mt-1 text-lg font-black text-foreground">仕上げ先を選べます</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, tone, body }) => (
            <article key={title} className={`rounded-xl border p-4 ${CAPABILITY_TONES[tone]}`}>
              <Icon className="h-6 w-6" aria-hidden="true" />
              <h3 className="mt-3 font-black text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="formatter-workflow-heading" className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
        <h2 id="formatter-workflow-heading" className="font-black text-foreground">迷わない3ステップ</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {WORKFLOW_STEPS.map(({ icon: Icon, title, body }, index) => (
            <div key={title} className="relative rounded-lg border border-white/10 bg-black/10 p-3">
              <div className="flex items-center gap-2 text-neon-cyan">
                <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-black text-foreground">{title}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
              {index < WORKFLOW_STEPS.length - 1 && (
                <ArrowRight className="absolute -right-5 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-neon-cyan/50 md:block" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-neon-pink/30 bg-neon-pink/5 p-4">
          <div className="flex items-start gap-3">
            <Printer className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-pink" aria-hidden="true" />
            <div>
              <h2 className="font-black text-neon-pink">紙の本なら、しまうま出版もおすすめです</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                紙の本を1冊から作りたい初心者にも分かりやすい選択肢です。文章中心の本はA5とA6に対応し、A6は一般的な文庫本サイズです。
              </p>
              <a
                href={SHIMAUMA_PUBLISH_NOVEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-neon-pink/35 px-3 py-2 text-xs font-black text-neon-pink hover:bg-neon-pink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/80"
              >
                しまうま出版のA5・A6仕様を確認
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                このツールは、しまうま出版の公式・提携ツールではありません。入稿前に公式の最新仕様と全ページを確認してください。
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/15 bg-black/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-amber" aria-hidden="true" />
            <div>
              <h2 className="font-black text-foreground">元原稿を残してから試してください</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                テスト版のため、大切な原稿は先に複製・バックアップし、コピーした原稿で試してください。縦書きは最終PDFとKindle Previewerで確認します。
              </p>
              <button
                type="button"
                onClick={() => changeView('manual')}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-neon-cyan/35 px-3 py-2 text-xs font-black text-neon-cyan hover:bg-neon-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
              >
                利用マニュアルを読む
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
