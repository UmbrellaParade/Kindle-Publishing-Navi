import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Columns2,
  ExternalLink,
  Focus,
  Heading1,
  ImagePlus,
  ListTree,
  QrCode,
  Redo2,
  Rows3,
  Scan,
  ScissorsLineDashed,
  Undo2,
} from 'lucide-react';
import manualMarkdown from '@/content/manuscriptFormatterManual.md?raw';
import { KINDLE_MANUSCRIPT_FORMATTER_URL } from '@/lib/externalTools';
import {
  getManuscriptFormatterManualSectionId,
  MANUSCRIPT_FORMATTER_MANUAL_GROUPS,
  MANUSCRIPT_FORMATTER_MANUAL_UPDATED_AT,
} from '@/lib/manuscriptFormatterManual';

const CARD_STYLE = {
  background: '#1a1a2e',
  border: '1px solid #2a2a4a',
};

const TOOL_ICON_GUIDE = [
  { label: '戻す', icon: Undo2 },
  { label: '進む', icon: Redo2 },
  { label: '見出し1', icon: Heading1 },
  { label: 'ルビ', text: 'ルビ' },
  { label: '左揃え', icon: AlignLeft },
  { label: '中央揃え', icon: AlignCenter },
  { label: '右揃え', icon: AlignRight },
  { label: '選択ブロックをページ中央', icon: Focus },
  { label: '選択段落を横組み', icon: Rows3 },
  { label: 'ページ内カラム', icon: Columns2 },
  { label: '画像', icon: ImagePlus },
  { label: '全画像をページ内最大', icon: Scan },
  { label: 'QRリンク', icon: QrCode },
  { label: '改ページ', icon: ScissorsLineDashed },
];

const MANUAL_BODY_MARKDOWN = manualMarkdown.replace(
  /^# Umbrella Parade 原稿制作ツール 利用マニュアル\r?\n\r?\n更新日: [^\r\n]+\r?\n\r?\n公開版: \[Umbrella Parade 原稿制作ツール\]\(https:\/\/umbrellaparade\.github\.io\/novel-drafting-tool\/\)\r?\n\r?\n/,
  '',
);

function scrollToManualSection(event, id) {
  event.preventDefault();
  const heading = document.getElementById(id);
  if (!heading) return;
  heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => heading.focus({ preventScroll: true }), 350);
}

function ManualTableOfContents({ compact = false }) {
  return (
    <nav aria-label="原稿制作ツールマニュアルの目次" className={compact ? 'mt-3' : ''}>
      <div className="space-y-4">
        {MANUSCRIPT_FORMATTER_MANUAL_GROUPS.map(group => (
          <section key={group.label} aria-label={group.label}>
            <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-neon-cyan/80">
              {group.label}
            </p>
            <ol className="space-y-0.5">
              {group.sections.map(section => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={event => scrollToManualSection(event, section.id)}
                    className="flex min-h-9 items-start gap-2 rounded-lg px-2 py-1.5 text-xs leading-relaxed text-muted-foreground transition hover:bg-neon-cyan/10 hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70"
                  >
                    <span className="w-5 flex-shrink-0 text-right font-black text-neon-cyan/70">
                      {section.number}.
                    </span>
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </nav>
  );
}

function ToolIconGuide() {
  return (
    <section aria-labelledby="manual-tool-icon-heading" className="rounded-2xl p-4 sm:p-5" style={CARD_STYLE}>
      <h2 id="manual-tool-icon-heading" className="text-base font-black text-foreground sm:text-lg">
        本文ツールバーの記号
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        原稿制作ツールに表示される記号と操作名です。詳しい使い方は第8章で確認できます。
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-4">
        {TOOL_ICON_GUIDE.map(item => {
          const Icon = item.icon;
          return (
            <li key={item.label} className="flex min-w-0 items-center gap-2 py-1 text-xs leading-snug text-slate-300">
              <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-neon-cyan/30 bg-[#111122] font-black text-neon-cyan">
                {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : item.text}
              </span>
              <span>{item.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const MARKDOWN_COMPONENTS = {
  h2: ({ children }) => {
    const heading = React.Children.toArray(children).join('');
    const id = getManuscriptFormatterManualSectionId(heading);
    return (
      <h2
        id={id}
        tabIndex={-1}
        className="scroll-mt-28 border-t border-neon-cyan/20 pt-8 text-xl font-black leading-snug text-neon-cyan outline-none first:border-t-0 first:pt-0 sm:text-2xl"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }) => (
    <h3 className="mt-7 text-base font-black leading-relaxed text-neon-pink sm:text-lg">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-3 text-sm leading-8 text-slate-300 sm:text-[15px]">{children}</p>
  ),
  ul: ({ children, className }) => (
    <ul className={`my-4 space-y-2 pl-5 text-sm leading-7 text-slate-300 marker:text-neon-cyan ${className || 'list-disc'}`}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-2 pl-6 text-sm leading-7 text-slate-300 marker:font-black marker:text-neon-pink">
      {children}
    </ol>
  ),
  li: ({ children, className }) => (
    <li className={className?.includes('task-list-item') ? 'list-none pl-0' : ''}>{children}</li>
  ),
  a: ({ children, href }) => {
    const external = href?.startsWith('http');
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="font-bold text-neon-cyan underline decoration-neon-cyan/40 underline-offset-4 hover:decoration-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70"
      >
        {children}
        {external && <span className="sr-only">（新しいタブで開きます）</span>}
      </a>
    );
  },
  code: ({ children }) => (
    <code className="rounded border border-neon-pink/20 bg-neon-pink/10 px-1.5 py-0.5 font-mono text-[0.88em] text-pink-200">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-[#303052]">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-neon-cyan/10 text-neon-cyan">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-[#303052]">{children}</tbody>,
  tr: ({ children }) => <tr className="divide-x divide-[#303052]">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2.5 font-black">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2.5 leading-relaxed text-slate-300">{children}</td>,
  hr: () => <hr className="my-8 border-neon-pink/25" />,
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={Boolean(checked)}
      disabled
      aria-label={checked ? '確認済み' : '未確認'}
      className="mr-2 h-4 w-4 rounded border-neon-cyan/50 accent-cyan-400"
    />
  ),
};

export default function ManuscriptFormatterManual({ onBack }) {
  return (
    <section
      id="manuscript-formatter-manual"
      aria-labelledby="formatter-manual-page-title"
      className="mx-auto max-w-7xl scroll-mt-24 space-y-4"
    >
      <header className="rounded-2xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 p-2.5 text-neon-cyan">
              <BookOpen className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                現行公開版・更新日 {MANUSCRIPT_FORMATTER_MANUAL_UPDATED_AT}
              </p>
              <h1
                id="formatter-manual-page-title"
                tabIndex={-1}
                className="mt-1 text-xl font-black text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70 sm:text-2xl"
              >
                Umbrella Parade 原稿制作ツール 利用マニュアル
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                完成した文章をKindle向けDOCXへ整える流れを中心に案内します。後半では、しまうま出版向けA5・A6印刷用PDFの仕上げも説明します。
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#3a3a5f] bg-[#111122] px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-neon-pink/40 hover:text-neon-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/70"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              案内へ戻る
            </button>
            <a
              href={KINDLE_MANUSCRIPT_FORMATTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="原稿制作ツールを新しいタブで開く"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neon-cyan/50 bg-neon-cyan/15 px-4 py-2 text-sm font-black text-neon-cyan transition hover:bg-neon-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
            >
              原稿制作ツールを開く
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <ToolIconGuide />

      <details className="rounded-xl p-4 lg:hidden" style={CARD_STYLE}>
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 font-black text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70">
          <ListTree className="h-5 w-5" aria-hidden="true" />
          マニュアル目次を開く
        </summary>
        <ManualTableOfContents compact />
      </details>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside className="sticky top-32 hidden max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl p-4 lg:block" style={CARD_STYLE}>
          <div className="mb-4 flex items-center gap-2 border-b border-neon-cyan/20 pb-3">
            <ListTree className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
            <h2 className="font-black text-foreground">目次</h2>
          </div>
          <ManualTableOfContents />
        </aside>

        <article aria-label="原稿制作ツール利用マニュアル本文" className="min-w-0 rounded-2xl px-4 py-6 sm:p-8" style={CARD_STYLE}>
          <div className="space-y-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
              {MANUAL_BODY_MARKDOWN}
            </ReactMarkdown>
          </div>

          <footer className="mt-10 border-t border-neon-cyan/20 pt-5 text-sm text-muted-foreground">
            <p>このページは、{MANUSCRIPT_FORMATTER_MANUAL_UPDATED_AT}更新の利用マニュアルです。</p>
          </footer>
        </article>
      </div>
    </section>
  );
}
