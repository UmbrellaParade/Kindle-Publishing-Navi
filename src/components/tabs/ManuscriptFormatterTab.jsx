import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  Monitor,
  ShieldCheck,
} from 'lucide-react';
import {
  KINDLE_MANUSCRIPT_FORMATTER_MANUAL_URL,
  KINDLE_MANUSCRIPT_FORMATTER_URL,
} from '@/lib/externalTools';
import ManuscriptFormatterManual from './ManuscriptFormatterManual';

const CARD_STYLE = {
  background: '#1a1a2e',
  border: '1px solid #2a2a4a',
};

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
    <div id="manuscript-formatter-overview" className="mx-auto max-w-4xl scroll-mt-24 space-y-5">
      <section
        aria-labelledby="manuscript-formatter-heading"
        className="overflow-hidden rounded-2xl"
        style={CARD_STYLE}
      >
        <div className="border-b border-neon-cyan/20 bg-neon-cyan/5 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-2.5 py-1 text-[11px] font-black text-neon-amber">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              テスト版
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2.5 py-1 text-[11px] font-bold text-neon-cyan">
              <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
              現在は横書きのみ推奨
            </span>
          </div>

          <div className="mt-4 flex items-start gap-3">
            <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 p-2.5 text-neon-cyan">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="manuscript-formatter-heading" className="text-xl font-black text-foreground sm:text-2xl">
                Kindle原稿整形ツール（テスト版）
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                原稿整形ツールが使える状態になってきたため、テスト版としてご案内します。Kindle用原稿の整形を別画面で試せます。
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-6">
          <a
            href={KINDLE_MANUSCRIPT_FORMATTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Kindle原稿整形ツール（テスト版）を新しいタブで開く"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-neon-cyan/50 bg-neon-cyan/15 px-4 py-3 text-sm font-black text-neon-cyan transition-colors hover:bg-neon-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 sm:w-auto"
          >
            横書きで原稿整形ツールを開く
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <p className="text-xs leading-relaxed text-muted-foreground">
            新しいタブで開きます。細かな整形作業はPCでの利用がおすすめです。このナビに保存したプロジェクトとは自動同期されません。
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-neon-amber/35 bg-neon-amber/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-amber" aria-hidden="true" />
            <div>
              <h3 className="font-black text-neon-amber">初めてのテスト利用は横書きがおすすめです</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                ツール自体は縦書きにも対応していますが、このナビではまず「横書き」での利用を案内します。縦書きは最終PDFとKindle Previewerで必ず確認してください。
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-neon-pink/30 bg-neon-pink/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-pink" aria-hidden="true" />
            <div>
              <h3 className="font-black text-neon-pink">元原稿を残してからお試しください</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                テスト版のため、大切な原稿は先に複製・バックアップし、コピーした原稿で試すのがおすすめです。
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-cyan" aria-hidden="true" />
            <div>
              <h3 className="font-black text-foreground">利用マニュアルが完成しました</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                基本操作、A5・A6、縦書き、画像、目次、QR、保存、PDF・DOCX・EPUB、スマホ、FAQ、最終チェックをまとめています。
              </p>
            </div>
          </div>
          <button
            id="open-formatter-manual-button"
            type="button"
            onClick={() => changeView('manual')}
            className="inline-flex min-h-12 w-full flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-neon-cyan/50 bg-neon-cyan/15 px-4 py-3 text-sm font-black text-neon-cyan transition hover:bg-neon-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 sm:w-auto"
          >
            利用マニュアルを読む
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 border-t border-[#2a2a4a] pt-3">
          <a
            href={KINDLE_MANUSCRIPT_FORMATTER_MANUAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHubで公開マニュアルを新しいタブで開く"
            className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-muted-foreground underline decoration-slate-600 underline-offset-4 transition hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70"
          >
            GitHubで公開マニュアルを見る
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
}
