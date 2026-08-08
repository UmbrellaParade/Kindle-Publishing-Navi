import React from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Save,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CRITIQUE_MANUSCRIPT_CHECK_STATUSES } from '@/lib/critiqueContext';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };

const CONTEXT_FIELDS = [
  {
    key: 'targetReader',
    label: '誰に向けた本か',
    placeholder: '例：初めてKindle出版へ挑戦する会社員',
    help: '年齢や職業だけでなく、今どこで困っている人かを書きます。',
  },
  {
    key: 'coreMessage',
    label: '何を伝える本か',
    placeholder: '例：特別な経験がなくても、手順を分ければ1冊を完成できる',
    help: 'この本で一番伝えたい中心メッセージを、1〜2文でまとめます。',
  },
  {
    key: 'readerOutcome',
    label: '読後にどう変わってほしいか',
    placeholder: '例：迷わず出版準備を進め、自分で次の行動を選べる',
    help: '読者が読み終えた後にできるようになることを書きます。',
  },
  {
    key: 'plannedPrice',
    label: '予定している価格',
    placeholder: '例：電子書籍 780円（検討中）',
    help: '未決定なら、候補の価格帯や「検討中」でも大丈夫です。',
    singleLine: true,
  },
  {
    key: 'publicationPurpose',
    label: '出版の目的',
    placeholder: '例：同じ悩みを持つ人へ経験を届け、講座の入口にもする',
    help: '売上、認知、読者支援、活動紹介など、今回の目的を書きます。',
  },
];

const MANUSCRIPT_TEXT_FIELDS = [
  'manuscriptLabel',
  'expectedFinalChapterTitle',
  'expectedLastSentence',
];

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function countCompleted(source, keys) {
  return keys.filter(key => hasText(source?.[key])).length;
}

function updateRootDraft(onDraftChange, key, value) {
  onDraftChange?.(current => ({
    ...(current || {}),
    [key]: value,
  }));
}

function updateManuscriptDraft(onDraftChange, key, value) {
  onDraftChange?.(current => ({
    ...(current || {}),
    manuscriptCheck: {
      ...(current?.manuscriptCheck || {}),
      [key]: value,
    },
  }));
}

function ProgressBadge({ children, complete }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${
        complete
          ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
          : 'border-neon-amber/35 bg-neon-amber/10 text-neon-amber'
      }`}
    >
      {children}
    </span>
  );
}

export default function CritiqueContextCard({
  context,
  draft,
  hasSaved,
  error,
  dirty,
  conflict,
  saving,
  open,
  onOpenChange,
  onDraftChange,
  onSave,
  onDiscardStaleDraft,
  onDownloadRaw,
}) {
  const shown = draft || context || {};
  const manuscriptCheck = shown.manuscriptCheck || {};
  const completedContextCount = countCompleted(shown, CONTEXT_FIELDS.map(field => field.key));
  const completedManuscriptCount = countCompleted(manuscriptCheck, MANUSCRIPT_TEXT_FIELDS);
  const manuscriptMatched = manuscriptCheck.status === 'matched';
  const saveBlocked = Boolean(error) || conflict || saving || !dirty;

  return (
    <section className="min-w-0 overflow-hidden rounded-xl" style={CARD_STYLE} aria-labelledby="critique-context-title">
      <button
        type="button"
        onClick={() => onOpenChange?.(!open)}
        aria-expanded={open}
        aria-controls="critique-context-body"
        className="flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-cyan/70 sm:px-5"
      >
        <BookOpenCheck className="h-5 w-5 flex-shrink-0 text-neon-cyan" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="critique-context-title" className="text-sm font-bold text-neon-cyan">
            この本の前提（最初に1回）
          </h2>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
            AIの点数ではなく、この本の目的に合った修正かを判断するための基準です。
          </p>
        </div>
        <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
          <ProgressBadge complete={completedContextCount === CONTEXT_FIELDS.length}>
            本の前提 {completedContextCount}/{CONTEXT_FIELDS.length}
          </ProgressBadge>
          <ProgressBadge complete={completedManuscriptCount === MANUSCRIPT_TEXT_FIELDS.length && manuscriptMatched}>
            原稿確認 {completedManuscriptCount}/{MANUSCRIPT_TEXT_FIELDS.length}
          </ProgressBadge>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          : <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />}
      </button>

      {open && (
        <div id="critique-context-body" className="min-w-0 space-y-5 border-t border-border/50 px-4 pb-5 pt-4 sm:px-5">
          <div className="flex flex-wrap gap-1.5 sm:hidden">
            <ProgressBadge complete={completedContextCount === CONTEXT_FIELDS.length}>
              本の前提 {completedContextCount}/{CONTEXT_FIELDS.length}
            </ProgressBadge>
            <ProgressBadge complete={completedManuscriptCount === MANUSCRIPT_TEXT_FIELDS.length && manuscriptMatched}>
              原稿確認 {completedManuscriptCount}/{MANUSCRIPT_TEXT_FIELDS.length}
            </ProgressBadge>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3" role="alert">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-red-200">保存済みの本の前提を安全に読み込めませんでした</h3>
                  <p className="mt-1 break-words text-[11px] leading-relaxed text-red-100/80">{error}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-red-100/70">
                    元データを守るため保存を停止しています。先に退避ファイルを保存してください。
                  </p>
                  {onDownloadRaw && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onDownloadRaw}
                      className="mt-3 min-h-11 gap-2 border-red-400/40 text-xs text-red-200 hover:bg-red-500/10"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />読み込めなかったデータを退避
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {conflict && !error && (
            <div className="rounded-lg border border-neon-amber/40 bg-neon-amber/[0.07] p-3" role="alert">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-amber" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold text-neon-amber">別の画面で、本の前提が更新されています</h3>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    入力中の内容は確認用に残しています。古い内容で最新データを上書きしないよう、保存を停止しています。
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onDiscardStaleDraft}
                    className="mt-3 min-h-11 border-neon-amber/40 text-xs text-neon-amber hover:bg-neon-amber/10"
                  >
                    未保存内容を破棄して最新へ切り替える
                  </Button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={onSave} className="min-w-0 space-y-5">
            <fieldset disabled={saving || Boolean(error)} className="min-w-0 space-y-5 disabled:opacity-70">
              <section aria-labelledby="critique-premise-fields-title">
                <div className="mb-3">
                  <h3 id="critique-premise-fields-title" className="text-xs font-bold text-neon-cyan">最初に決めた5つの前提</h3>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    原稿づくりの最初に答えた内容を保存します。後から変わった場合は、現在の方針へ更新できます。
                  </p>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                  {CONTEXT_FIELDS.map(field => (
                    <label key={field.key} className={`min-w-0 space-y-1.5 ${field.key === 'publicationPurpose' ? 'md:col-span-2' : ''}`}>
                      <span className="block text-xs font-bold text-foreground">{field.label}</span>
                      {field.singleLine ? (
                        <input
                          value={shown[field.key] || ''}
                          onChange={event => updateRootDraft(onDraftChange, field.key, event.target.value)}
                          placeholder={field.placeholder}
                          className="min-h-11 w-full min-w-0 rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70"
                          style={INPUT_STYLE}
                        />
                      ) : (
                        <textarea
                          value={shown[field.key] || ''}
                          onChange={event => updateRootDraft(onDraftChange, field.key, event.target.value)}
                          rows={3}
                          placeholder={field.placeholder}
                          className="min-h-24 w-full min-w-0 resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70"
                          style={INPUT_STYLE}
                        />
                      )}
                      <span className="block text-[10px] leading-relaxed text-muted-foreground">{field.help}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-neon-amber/25 bg-neon-amber/[0.04] p-3 sm:p-4" aria-labelledby="manuscript-check-title">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 id="manuscript-check-title" className="text-xs font-bold text-neon-amber">原稿を最後まで読めたか確認</h3>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      Codexへ原稿を渡す前に、正しい末尾を手元へ記録します。Codexの回答と見比べて、全文を取得できたか確認してください。
                    </p>
                  </div>
                  {manuscriptMatched && (
                    <span className="inline-flex min-h-7 flex-shrink-0 items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />一致確認済み
                    </span>
                  )}
                </div>

                <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="min-w-0 space-y-1.5">
                    <span className="block text-xs font-bold text-foreground">対象原稿のラベル</span>
                    <input
                      value={manuscriptCheck.manuscriptLabel || ''}
                      onChange={event => updateManuscriptDraft(onDraftChange, 'manuscriptLabel', event.target.value)}
                      placeholder="例：第2稿・2026年8月版"
                      className="min-h-11 w-full min-w-0 rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-amber/70"
                      style={INPUT_STYLE}
                    />
                  </label>
                  <label className="min-w-0 space-y-1.5">
                    <span className="block text-xs font-bold text-foreground">確認状況</span>
                    <select
                      value={manuscriptCheck.status || 'not_checked'}
                      onChange={event => updateManuscriptDraft(onDraftChange, 'status', event.target.value)}
                      className="min-h-11 w-full min-w-0 rounded-md px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-neon-amber/70"
                      style={INPUT_STYLE}
                    >
                      {CRITIQUE_MANUSCRIPT_CHECK_STATUSES.map(status => (
                        <option key={status.value} value={status.value} className="bg-[#1a1a2e]">{status.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0 space-y-1.5">
                    <span className="block text-xs font-bold text-foreground">正しい最終章のタイトル</span>
                    <input
                      value={manuscriptCheck.expectedFinalChapterTitle || ''}
                      onChange={event => updateManuscriptDraft(onDraftChange, 'expectedFinalChapterTitle', event.target.value)}
                      placeholder="例：おわりに"
                      className="min-h-11 w-full min-w-0 rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-amber/70"
                      style={INPUT_STYLE}
                    />
                  </label>
                  <label className="min-w-0 space-y-1.5 md:row-span-2">
                    <span className="block text-xs font-bold text-foreground">正しい最後の一文</span>
                    <textarea
                      value={manuscriptCheck.expectedLastSentence || ''}
                      onChange={event => updateManuscriptDraft(onDraftChange, 'expectedLastSentence', event.target.value)}
                      rows={4}
                      placeholder="原稿の最後の一文を、そのまま手元用に記録"
                      className="min-h-28 w-full min-w-0 resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-amber/70"
                      style={INPUT_STYLE}
                    />
                  </label>
                </div>

                <div className="mt-3 rounded-lg border border-white/10 bg-black/15 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
                  「正しい最終章のタイトル」と「正しい最後の一文」は、Codexの回答と照合するための手元用です。答えを先に教えてしまわないよう、相談文にはコピーしません。
                </div>
              </section>
            </fieldset>

            <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] leading-relaxed text-muted-foreground" aria-live="polite">
                {error
                  ? 'データを守るため保存を停止しています。'
                  : conflict
                    ? '別の画面の更新を確認するまで保存を停止しています。'
                    : dirty
                    ? '未保存の変更があります。'
                    : hasSaved
                      ? '保存済みです。'
                      : 'まだ保存されていません。入力すると保存できます。'}
              </p>
              <Button
                type="submit"
                disabled={saveBlocked}
                className="min-h-11 gap-2 border border-neon-cyan/40 bg-neon-cyan/15 text-xs text-neon-cyan hover:bg-neon-cyan/25"
              >
                <Save className="h-4 w-4" aria-hidden="true" />{saving ? '保存中…' : '本の前提を保存'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
