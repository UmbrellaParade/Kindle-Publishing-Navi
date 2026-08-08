import React from 'react';
import { AlertTriangle, Bot, Check, Save, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CRITIQUE_FINDING_CATEGORIES } from '@/lib/critiqueHistory';

const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };

const CATEGORY_STYLES = {
  mustFix: {
    border: 'border-red-400/30',
    background: 'bg-red-400/[0.04]',
    heading: 'text-red-300',
    focus: 'focus:ring-red-400/70',
  },
  readerCheck: {
    border: 'border-neon-cyan/25',
    background: 'bg-neon-cyan/[0.03]',
    heading: 'text-neon-cyan',
    focus: 'focus:ring-neon-cyan/70',
  },
  authorJudgment: {
    border: 'border-violet-400/30',
    background: 'bg-violet-400/[0.04]',
    heading: 'text-violet-200',
    focus: 'focus:ring-violet-400/70',
  },
  deferred: {
    border: 'border-white/15',
    background: 'bg-white/[0.03]',
    heading: 'text-foreground/80',
    focus: 'focus:ring-white/40',
  },
};

function categoryStyle(key) {
  return CATEGORY_STYLES[key] || CATEGORY_STYLES.deferred;
}

function formatReviewDate(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function resolveFindingDraft(draft) {
  if (draft?.findingCategories && typeof draft.findingCategories === 'object') {
    return draft.findingCategories;
  }
  return draft || {};
}

function updateFindingDraft(onDraftChange, key, value) {
  onDraftChange?.(current => {
    if (current?.findingCategories && typeof current.findingCategories === 'object') {
      return {
        ...current,
        findingCategories: {
          ...current.findingCategories,
          [key]: value,
        },
      };
    }
    return { ...(current || {}), [key]: value };
  });
}

export default function CritiqueFindingDialog({
  open,
  entry,
  draft,
  categories,
  dirty,
  conflict,
  saving,
  promptCopied,
  onOpenChange,
  onDraftChange,
  onDiscardStaleDraft,
  onSave,
  onCopyPrompt,
}) {
  const categoryOptions = Array.isArray(categories) && categories.length > 0
    ? categories
    : CRITIQUE_FINDING_CATEGORIES;
  const findingDraft = resolveFindingDraft(draft);
  const completedCount = categoryOptions.filter(category => (
    typeof findingDraft?.[category.key] === 'string' && findingDraft[category.key].trim()
  )).length;
  const reviewDate = formatReviewDate(entry?.reviewedAt);

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!saving) onOpenChange?.(nextOpen); }}>
      <DialogContent
        className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto p-4 sm:p-6"
        style={{ background: '#151527', border: '1px solid #2a2a4a' }}
      >
        <DialogHeader className="pr-7">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 flex-shrink-0 text-neon-pink" aria-hidden="true" />
            <DialogTitle className="text-neon-pink">AIの指摘を4種類に整理</DialogTitle>
          </div>
          <DialogDescription className="leading-relaxed">
            点数に合わせて全部を直すのではなく、この本の目的と読者への影響を見ながら、指摘の扱いを決めます。
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            対象：<span className="font-bold text-foreground">{entry?.manuscriptLabel || '原稿ラベル未設定'}</span>
            {reviewDate ? `（${reviewDate}の論評）` : ''}
          </p>
          <p className="mt-1">
            ここで分類を保存しても、総評・点数・判定・優先修正トップ3などの原論評は上書きしません。迷う指摘は、下の相談文をCodexへ貼り付けて検討できます。
          </p>
        </div>

        {conflict && (
          <div className="rounded-lg border border-neon-amber/40 bg-neon-amber/[0.07] p-3" role="alert">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-neon-amber" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-neon-amber">別の画面で、この論評が更新されています</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  下の未保存内容は確認用に残しています。古い内容で最新データを上書きしないよう、保存を停止しています。
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              1つの欄に複数ある場合は、指摘ごとに改行すると後から確認しやすくなります。
            </p>
            <span className="inline-flex min-h-7 items-center rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2.5 py-1 text-[10px] font-bold text-neon-cyan">
              入力済み {completedCount}/{categoryOptions.length}
            </span>
          </div>

          <fieldset disabled={saving} className="grid min-w-0 grid-cols-1 gap-3 disabled:opacity-70 md:grid-cols-2">
            {categoryOptions.map((category, index) => {
              const styles = categoryStyle(category.key);
              return (
                <label
                  key={category.key || `finding-category-${index}`}
                  className={`min-w-0 rounded-xl border p-3 sm:p-4 ${styles.border} ${styles.background}`}
                >
                  <span className={`block text-sm font-bold ${styles.heading}`}>{category.label}</span>
                  <span className="mt-1 block min-h-10 text-[10px] leading-relaxed text-muted-foreground">
                    {category.description}
                  </span>
                  <textarea
                    aria-label={`${category.label}の指摘`}
                    value={findingDraft?.[category.key] || ''}
                    onChange={event => updateFindingDraft(onDraftChange, category.key, event.target.value)}
                    rows={6}
                    placeholder={`${category.label}に整理する指摘と、その理由を記録`}
                    className={`mt-3 min-h-36 w-full min-w-0 resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 ${styles.focus}`}
                    style={INPUT_STYLE}
                  />
                </label>
              );
            })}
          </fieldset>

          <div className="rounded-lg border border-violet-400/25 bg-violet-500/[0.05] p-3">
            <h3 className="text-xs font-bold text-violet-200">分類に迷ったとき</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              現在の論評・4分類・本の前提をまとめた相談文をコピーします。外部へ自動送信せず、保存内容も自動変更しません。Codexの回答を読んで、最終的な採用・見送りは著者が決めてください。
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onCopyPrompt}
              className="mt-3 min-h-11 gap-2 border-violet-400/40 bg-violet-500/10 text-xs text-violet-200 hover:bg-violet-500/20"
            >
              {promptCopied
                ? <Check className="h-4 w-4" aria-hidden="true" />
                : <Bot className="h-4 w-4" aria-hidden="true" />}
              {promptCopied ? '相談文をコピー済み' : 'Codexへ修正判断の相談文をコピー'}
            </Button>
          </div>

          <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:space-x-0">
            <p className="mr-auto text-[10px] leading-relaxed text-muted-foreground" aria-live="polite">
              {dirty ? '未保存の変更があります。閉じても、この画面を開いている間は一時保存します。' : '保存済みの分類を表示しています。'}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange?.(false)}
              className="min-h-11"
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={saving || conflict}
              className="min-h-11 gap-2 border border-neon-pink/40 bg-neon-pink/20 text-xs text-neon-pink hover:bg-neon-pink/30"
            >
              <Save className="h-4 w-4" aria-hidden="true" />{saving ? '保存中…' : '4分類を保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
