import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookCheck,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  DatabaseBackup,
  LayoutGrid,
  ListTree,
  Plus,
  Sheet,
  Sparkles,
} from 'lucide-react';
import manualMarkdown from '@/content/kindleNaviManual.md?raw';
import {
  getKindleNaviManualSectionId,
  KINDLE_NAVI_MANUAL_GROUPS,
  KINDLE_NAVI_MANUAL_UPDATED_AT,
} from '@/lib/kindleNaviManual';

const CARD_STYLE = {
  background: '#1a1a2e',
  border: '1px solid #2a2a4a',
};

const FEATURE_LINKS = [
  { id: 'creation', label: 'Kindle本制作進捗', description: '全フェーズと目標日' },
  { id: 'kdp', label: 'KDP登録進捗', description: '入稿・価格・提出' },
  { id: 'category', label: 'カテゴリーチェック', description: '候補を最大3件整理' },
  { id: 'promo', label: 'プロモーション戦略メモ', description: '方針・SNS下書き' },
  { id: 'description', label: 'KDP書籍説明文', description: 'Amazonページ用HTML' },
  { id: 'aplus', label: '表紙＆A+コンテンツ', description: '画像と提出準備' },
  { id: 'format', label: 'Kindle原稿作成ガイド', description: 'Googleドキュメント中心' },
  { id: 'formatter', label: 'Kindle原稿整形ツール', description: '別ツール・テスト版' },
  { id: 'critique', label: '辛口論評', description: '評価履歴と修正タスク' },
];

const MANUAL_BODY_MARKDOWN = manualMarkdown;

function prefersReducedMotion() {
  return globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function scrollToElement(id) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  });
  window.setTimeout(() => element.focus({ preventScroll: true }), prefersReducedMotion() ? 0 : 350);
}

function scrollToManualSection(event, id) {
  event.preventDefault();
  scrollToElement(id);
}

function ManualTableOfContents({ compact = false }) {
  return (
    <nav aria-label="Kindle出版ナビ使い方マニュアルの目次" className={compact ? 'mt-3' : ''}>
      <div className="space-y-4">
        {KINDLE_NAVI_MANUAL_GROUPS.map(group => (
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
                    className="flex min-h-10 items-start gap-2 rounded-lg px-2 py-2 text-xs leading-relaxed text-muted-foreground transition hover:bg-neon-cyan/10 hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70"
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

const MARKDOWN_COMPONENTS = {
  h2: ({ children }) => {
    const heading = React.Children.toArray(children).join('');
    const id = getKindleNaviManualSectionId(heading);
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
    <h3 className="mt-7 text-base font-black leading-relaxed text-neon-pink sm:text-lg">{children}</h3>
  ),
  p: ({ children }) => <p className="my-3 text-sm leading-8 text-slate-300 sm:text-[15px]">{children}</p>,
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
  strong: ({ children }) => <strong className="font-black text-foreground">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-5 rounded-r-xl border-l-4 border-neon-amber bg-neon-amber/5 px-4 py-2 text-slate-200">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-[#303052]">
      <table className="w-full min-w-[38rem] border-collapse text-left text-sm">{children}</table>
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

export default function KindleNaviManualTab({
  hasProject,
  onCreateProject,
  onNavigateTab,
  onOpenSchedule,
}) {
  const navigateToFeature = async tabId => {
    await onNavigateTab(tabId);
    window.setTimeout(() => {
      const tabButton = document.querySelector(`[data-main-tab="${tabId}"]`);
      if (tabButton instanceof HTMLElement) tabButton.focus({ preventScroll: true });
    }, 0);
  };

  const focusDataManagement = () => {
    const trigger = document.getElementById('data-management-trigger');
    trigger?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => trigger?.focus({ preventScroll: true }), prefersReducedMotion() ? 0 : 350);
  };

  return (
    <section
      id="kindle-navi-manual"
      aria-labelledby="kindle-navi-manual-title"
      className="mx-auto max-w-7xl scroll-mt-24 space-y-4"
    >
      <header className="overflow-hidden rounded-2xl p-4 sm:p-6" style={CARD_STYLE}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl border border-neon-pink/30 bg-neon-pink/10 p-2.5 text-neon-pink">
              <BookOpen className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                更新日 {KINDLE_NAVI_MANUAL_UPDATED_AT}
              </p>
              <h2
                id="kindle-navi-manual-title"
                tabIndex={-1}
                className="mt-1 text-xl font-black text-foreground outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70 sm:text-3xl"
              >
                Kindle出版ナビ はじめてガイド
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                初めての1冊でも、次に何をすればよいか迷わないように、最初の設定から出版後までを順番に案内します。
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/5 px-4 py-3 text-xs leading-relaxed text-slate-300 lg:max-w-sm">
            <p className="flex items-center gap-2 font-black text-neon-cyan">
              <Sheet className="h-4 w-4" aria-hidden="true" />
              ゴリアスさんの教材と内容連携
            </p>
            <p className="mt-1.5">
              スプレッドシートの出版工程・備考を取り込み、初心者向け解説と日程管理を追加しています。Googleスプレッドシートとの自動同期ではありません。
            </p>
          </div>
        </div>
      </header>

      <section aria-labelledby="first-steps-heading" className="rounded-2xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-neon-pink" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold text-neon-pink">まずはここから</p>
            <h2 id="first-steps-heading" className="text-lg font-black text-foreground sm:text-xl">最初の10分で行う4ステップ</h2>
          </div>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <li className="flex flex-col rounded-xl border border-neon-pink/25 bg-neon-pink/5 p-4">
            <span className="text-xs font-black text-neon-pink">STEP 1</span>
            <div className="mt-2 flex items-center gap-2 font-black text-foreground"><Plus className="h-4 w-4" />本を作る</div>
            <p className="mt-2 flex-1 text-xs leading-6 text-muted-foreground">管理用のプロジェクト名を入力します。正式な書名は後から設定できます。</p>
            <button type="button" onClick={onCreateProject} className="mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-neon-pink/40 bg-neon-pink/15 px-3 py-2 text-xs font-black text-neon-pink transition hover:bg-neon-pink/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/70">
              {hasProject ? '別の本を追加する' : '新しい本を作る'}<ChevronRight className="h-4 w-4" />
            </button>
          </li>
          <li className="flex flex-col rounded-xl border border-neon-cyan/25 bg-neon-cyan/5 p-4">
            <span className="text-xs font-black text-neon-cyan">STEP 2</span>
            <div className="mt-2 flex items-center gap-2 font-black text-foreground"><CalendarDays className="h-4 w-4" />発売日を逆算</div>
            <p className="mt-2 flex-1 text-xs leading-6 text-muted-foreground">配信方法と発売目標日を選び、各工程へ標準8週間の日程を入れます。</p>
            <button type="button" onClick={hasProject ? onOpenSchedule : onCreateProject} className="mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-neon-cyan/40 bg-neon-cyan/15 px-3 py-2 text-xs font-black text-neon-cyan transition hover:bg-neon-cyan/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70">
              {hasProject ? '発売日を設定する' : '先に本を作る'}<ChevronRight className="h-4 w-4" />
            </button>
          </li>
          <li className="flex flex-col rounded-xl border border-neon-amber/25 bg-neon-amber/5 p-4">
            <span className="text-xs font-black text-neon-amber">STEP 3</span>
            <div className="mt-2 flex items-center gap-2 font-black text-foreground"><BookCheck className="h-4 w-4" />フェーズ0を開始</div>
            <p className="mt-2 flex-1 text-xs leading-6 text-muted-foreground">制作進捗を個別表示にして、準備の一番上からチェックします。</p>
            <button type="button" onClick={hasProject ? () => navigateToFeature('creation') : onCreateProject} className="mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-neon-amber/40 bg-neon-amber/10 px-3 py-2 text-xs font-black text-neon-amber transition hover:bg-neon-amber/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber/70">
              {hasProject ? '制作進捗を開く' : '本を作って準備を始める'}<ChevronRight className="h-4 w-4" />
            </button>
          </li>
          <li className="flex flex-col rounded-xl border border-[#3a3a5f] bg-[#111122] p-4">
            <span className="text-xs font-black text-slate-300">STEP 4</span>
            <div className="mt-2 flex items-center gap-2 font-black text-foreground"><DatabaseBackup className="h-4 w-4" />バックアップ</div>
            <p className="mt-2 flex-1 text-xs leading-6 text-muted-foreground">初回設定後にJSONを保存します。端末変更や万一の消失に備えられます。</p>
            <button type="button" onClick={focusDataManagement} className="mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#4a4a70] px-3 py-2 text-xs font-black text-slate-200 transition hover:border-neon-cyan/50 hover:text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70">
              データ管理の場所を見る<ChevronRight className="h-4 w-4" />
            </button>
          </li>
        </ol>
      </section>

      <section aria-labelledby="feature-links-heading" className="rounded-2xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
          <h2 id="feature-links-heading" className="text-lg font-black text-foreground">機能から探す</h2>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_LINKS.map(feature => (
            <button
              key={feature.id}
              type="button"
              onClick={() => navigateToFeature(feature.id)}
              className="group flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[#303052] bg-[#111122] px-3 py-2.5 text-left transition hover:border-neon-cyan/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-slate-200 group-hover:text-neon-cyan">{feature.label}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{feature.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-neon-cyan" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <details className="rounded-xl p-4 lg:hidden" style={CARD_STYLE}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-black text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70">
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

        <article aria-label="Kindle出版ナビ使い方マニュアル本文" className="min-w-0 rounded-2xl px-4 py-6 sm:p-8" style={CARD_STYLE}>
          <div className="space-y-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
              {MANUAL_BODY_MARKDOWN}
            </ReactMarkdown>
          </div>

          <footer className="mt-10 rounded-xl border border-neon-pink/25 bg-neon-pink/5 p-4">
            <p className="flex items-center gap-2 font-black text-foreground">
              <CheckCircle2 className="h-5 w-5 text-neon-pink" aria-hidden="true" />
              次に迷ったら、フェーズ0の一番上から
            </p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">全部を一度に理解しなくても大丈夫です。1項目ずつ完了させていきましょう。</p>
            <button type="button" onClick={() => navigateToFeature('creation')} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neon-pink/40 bg-neon-pink/15 px-4 py-2 text-sm font-black text-neon-pink transition hover:bg-neon-pink/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/70">
              Kindle本制作進捗を開く<ChevronRight className="h-4 w-4" />
            </button>
          </footer>
        </article>
      </div>
    </section>
  );
}
