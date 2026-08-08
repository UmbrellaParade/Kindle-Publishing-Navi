import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  History,
  ListPlus,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import CritiqueContextCard from '@/components/critique/CritiqueContextCard';
import CritiqueFindingDialog from '@/components/critique/CritiqueFindingDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CRITIQUE_AXES,
  CRITIQUE_FINDING_CATEGORIES,
  CRITIQUE_JUDGMENTS,
  CRITIQUE_RESPONSE_STATUSES,
  buildCritiqueCodexPrompt,
  buildCritiqueDecisionPrompt,
  buildLatestCritiqueTaskPlan,
  compareCritiqueEntries,
  createCritiqueDuplicateDraft,
  createCritiqueEntry,
  deleteCritiqueEntryIfUnchanged,
  hasCritiqueEntryEditConflict,
  hasCritiqueManuscriptVersionMismatch,
  readCritiqueHistory,
  serializeCritiqueHistory,
  shouldApplyCritiqueMutationResult,
  upsertCritiqueEntry,
} from '@/lib/critiqueHistory';
import {
  cacheCritiqueDraft,
  clearCachedCritiqueDraftIfUnchanged,
  createCritiqueBriefSnapshot,
  createEmptyCritiqueContext,
  hasCachedCritiqueDraftConflict,
  readCachedCritiqueDraft,
  readCritiqueContext,
  upsertCritiqueContext,
} from '@/lib/critiqueContext';
import { mutatePublishingProject } from '@/lib/projectMutation';
import { readChecklistEnvelope, writeChecklistEnvelope } from '@/lib/releaseSchedule';
import {
  buildCritiqueDraftScores,
  parseCritiqueScore,
  parseOptionalFiniteNumber,
  readCritiqueManuscriptState,
  serializeCritiqueDraftScores,
  shouldNotifyCritiqueHistoryChange,
  validateCritiqueDraftScores,
} from '@/lib/critiqueScoreUi';
import {
  LEGACY_CRITIQUE_STOPPING_CHECKS_KEY,
  mergeCritiqueStoppingChecks,
  patchCritiqueStoppingCheck,
  readCritiqueStoppingChecks,
  rollbackFailedCritiqueStoppingChecks,
  selectProjectCritiqueStoppingChecks,
} from '@/lib/critiqueStoppingChecks';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };

const FALLBACK_AXES = [
  { key: 'originality', label: '独自性' },
  { key: 'expertise', label: '専門性' },
  { key: 'specificity', label: '具体性' },
  { key: 'structure', label: '体系性' },
  { key: 'actionability', label: '行動可能性' },
  { key: 'evidence', label: '根拠' },
  { key: 'competitiveAdvantage', label: '競合優位性' },
  { key: 'priceAlignment', label: '価格整合性' },
  { key: 'rightsSafety', label: '権利・安全性' },
];

const FALLBACK_JUDGMENTS = [
  { value: 'pass', label: '合格' },
  { value: 'conditional_pass', label: '条件付き合格' },
  { value: 'needs_revision', label: '要修正' },
  { value: 'conditional_fail', label: '条件付き不合格' },
  { value: 'hold', label: '保留' },
];

const FALLBACK_RESPONSE_STATUSES = [
  { value: 'not_started', label: '未着手' },
  { value: 'in_progress', label: '対応中' },
  { value: 're_review_waiting', label: '再論評待ち' },
  { value: 'completed', label: '修正済み' },
  { value: 'deferred', label: '見送り' },
];

const STOPPING_SIGNS = [
  { id: 'same-feedback', text: '前回と同じ指摘が中心になり、新しい重大な不足が出なくなった' },
  { id: 'minor-only', text: '指摘が言い回しなどの軽微な調整に絞られてきた' },
  { id: 'structure-ok', text: '章構成や論理の流れに大きな問題がなくなった' },
  { id: 'core-message', text: '誰に何を届ける本か、核心メッセージが明確になった' },
  { id: 'three-plus', text: '複数回見直し、大きな改善点が増えなくなった' },
  { id: 'hard-gates-cleared', text: '権利・安全・事実確認などのハードゲートを解消し、著者が最終確認した' },
];

const LOOP_GUIDANCE = [
  {
    title: '指摘の有無ではなく、重大さで判断する',
    text: '論評は改善点を探すため、毎回何らかの指摘が出ます。致命的な不足、読者価値に直結する不足、軽微な表現調整を分けて考えます。',
  },
  {
    title: '修正が往復したら目的へ戻る',
    text: 'Aを直すとBへ戻るような状態では、対象読者と本の約束に照らして、どちらの表現が目的に合うかを著者が決めます。',
  },
  {
    title: 'ハードゲートは発売前に解消する',
    text: '権利、危険な断定、未確認の事実、個人情報などは後回しにしません。公開後に直せることと、公開前に必ず確認することを分けます。',
  },
  {
    title: '最終決定は著者が行う',
    text: '点数やチェック数は停止点を考える参考です。販売可否、価格、公開時期は、原稿全体と確認状況を見て人が決めます。',
  },
];

function normalizeAxes(source) {
  if (Array.isArray(source) && source.length > 0) {
    return source.map((item, index) => {
      if (typeof item === 'string') return { key: item, label: item };
      return {
        key: item?.key || item?.value || item?.id || `axis_${index}`,
        label: item?.label || item?.title || item?.key || `評価 ${index + 1}`,
      };
    });
  }
  if (source && typeof source === 'object') {
    return Object.entries(source).map(([key, value]) => ({
      key,
      label: typeof value === 'string' ? value : value?.label || value?.title || key,
    }));
  }
  return FALLBACK_AXES;
}

function normalizeOptions(source, fallback) {
  if (Array.isArray(source) && source.length > 0) {
    return source.map((item, index) => {
      if (typeof item === 'string') return { value: item, label: item };
      return {
        value: item?.value || item?.key || item?.id || `option_${index}`,
        label: item?.label || item?.title || item?.value || `選択肢 ${index + 1}`,
      };
    });
  }
  if (source && typeof source === 'object') {
    return Object.entries(source).map(([key, value]) => ({
      value: key,
      label: typeof value === 'string' ? value : value?.label || value?.title || key,
    }));
  }
  return fallback;
}

function toDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '日時未設定';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function normalizePriorityFixes(value) {
  const fixes = Array.isArray(value) ? value : [];
  return [0, 1, 2].map(index => {
    const item = fixes[index];
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') return String(item.text || item.title || '');
    return '';
  });
}

function prepareDraft(entry, axes) {
  const isExisting = Boolean(entry);
  const source = isExisting ? entry : createCritiqueEntry();
  const scores = buildCritiqueDraftScores(
    source.scores,
    axes.map(axis => axis.key),
    { isNew: !isExisting },
  );
  return {
    ...source,
    reviewedAt: toDateTimeLocal(source.reviewedAt),
    manuscriptLabel: source.manuscriptLabel || '',
    environmentModel: source.environmentModel || '',
    judgment: source.judgment || FALLBACK_JUDGMENTS[2].value,
    scores,
    summary: source.summary || '',
    priceConstraints: source.priceConstraints || '',
    recommendedPriceRange: source.recommendedPriceRange || '',
    hardGates: source.hardGates || '',
    priorityFixes: normalizePriorityFixes(source.priorityFixes),
    lowerPricePlan: source.lowerPricePlan || '',
    strengthenContentPlan: source.strengthenContentPlan || '',
    authorDecision: source.authorDecision || '',
    responseStatus: source.responseStatus || FALLBACK_RESPONSE_STATUSES[0].value,
    notes: source.notes || '',
  };
}

function sortedByReviewedAt(entries) {
  return [...entries].sort((left, right) => {
    const leftReviewedTime = Date.parse(left?.reviewedAt || '') || 0;
    const rightReviewedTime = Date.parse(right?.reviewedAt || '') || 0;
    if (leftReviewedTime !== rightReviewedTime) return rightReviewedTime - leftReviewedTime;
    const leftCreatedTime = Date.parse(left?.createdAt || '') || 0;
    const rightCreatedTime = Date.parse(right?.createdAt || '') || 0;
    return rightCreatedTime - leftCreatedTime;
  });
}

function optionLabel(options, value, fallback = '未設定') {
  return options.find(option => option.value === value)?.label || value || fallback;
}

function averageScore(entry, axes) {
  const scores = axes
    .map(axis => parseCritiqueScore(entry?.scores?.[axis.key]))
    .filter(value => value !== null);
  if (scores.length === 0) return null;
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function deltaText(delta) {
  if (!Number.isFinite(delta)) return '比較なし';
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return '変化なし';
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function readProjectFields(project) {
  const { envelope: rawEnvelope, error } = readChecklistEnvelope(project?.checklist_data);
  if (error) return {};
  const envelope = /** @type {Record<string, any>} */ (rawEnvelope || {});
  return envelope._kdp_fields && typeof envelope._kdp_fields === 'object'
    ? envelope._kdp_fields
    : {};
}

function readProjectManuscript(project) {
  let raw;
  try {
    raw = localStorage.getItem(`format_guide_state_${project?.id || 'global'}`);
  } catch (cause) {
    throw new Error('旧版で保存した原稿データを確認できないため、相談文のコピーを停止しました', { cause });
  }
  return readCritiqueManuscriptState(raw, project?.manuscript);
}

function extractTargetReader(project) {
  const description = stripHtml(project?.kdp_description || '');
  const descriptionMatch = description.match(/対象読者[：:]\s*([^。\n]+)/);
  if (descriptionMatch?.[1]) return descriptionMatch[1].trim();
  const strategy = String(project?.strategy_memo || '');
  const strategyMatch = strategy.match(/【主な読者(?:仮説)?】\s*([\s\S]*?)(?:\n\s*\n|【|$)/);
  return strategyMatch?.[1]?.trim() || '';
}

function classificationDraftCacheKey(projectId, entryId) {
  return projectId && entryId ? `${projectId}:${entryId}` : '';
}

function buildProjectPromptContext({ project, fields, entries, context, manuscript, judgments, statuses }) {
  const bookTitle = project.book_title
    || fields.t41_book_title
    || fields.t42_book_title2
    || project.name
    || '';
  const authorName = project.author_name || fields.t42_author_name || '';
  const categories = [
    project.category_main,
    project.category_sub1,
    project.category_sub2,
    fields.t43a_category1,
    fields.t43a_category2,
    fields.t43a_category3,
  ].filter(Boolean);
  const keywords = [
    fields.t43b_kw1,
    fields.t43b_kw2,
    fields.t43b_kw3,
    fields.t43b_kw4,
    fields.t43b_kw5,
    fields.t43b_kw6,
    fields.t43b_kw7,
  ].filter(Boolean);
  const latestEntry = entries[0] || null;
  const previousEntry = entries[1] || null;

  return {
    bookTitle,
    authorName,
    bookDescription: stripHtml(project.kdp_description || ''),
    targetReader: context.targetReader,
    coreMessage: context.coreMessage,
    readerOutcome: context.readerOutcome,
    plannedPrice: context.plannedPrice,
    publicationPurpose: context.publicationPurpose,
    promotionGoal: project.promotion_goal || '',
    strategyMemo: project.strategy_memo || '',
    categories: project.categories || categories,
    keywords: project.keywords || keywords,
    releaseTargetDate: project.release_target_date || project.release_date || '',
    manuscript,
    manuscriptLabel: context.manuscriptCheck?.manuscriptLabel || '',
    latestCritique: latestEntry ? JSON.stringify({
      manuscriptLabel: latestEntry.manuscriptLabel,
      reviewedAt: latestEntry.reviewedAt,
      judgment: optionLabel(judgments, latestEntry.judgment),
      scores: latestEntry.scores,
      summary: latestEntry.summary,
      hardGates: latestEntry.hardGates,
      priorityFixes: latestEntry.priorityFixes,
      findingCategories: latestEntry.findingCategories,
      authorDecision: latestEntry.authorDecision,
      responseStatus: optionLabel(statuses, latestEntry.responseStatus),
    }, null, 2) : '',
    latestEntry,
    previousEntry,
    critiqueEntries: entries,
  };
}

function TextBlock({ label, value }) {
  if (!value) return null;
  return (
    <section className="min-w-0 rounded-lg border border-white/10 bg-black/10 p-3">
      <h4 className="text-[11px] font-bold text-neon-cyan">{label}</h4>
      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">{value}</p>
    </section>
  );
}

function ScoreComparison({ entry, previous, axes, comparison }) {
  const currentAverage = parseOptionalFiniteNumber(comparison?.average?.current ?? comparison?.average?.after);
  const previousAverage = parseOptionalFiniteNumber(comparison?.average?.previous ?? comparison?.average?.before);
  const computedCurrentAverage = averageScore(entry, axes);
  const computedPreviousAverage = averageScore(previous, axes);
  const shownCurrentAverage = currentAverage ?? computedCurrentAverage;
  const shownPreviousAverage = previousAverage ?? computedPreviousAverage;

  return (
    <section className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/[0.03] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-neon-cyan">9つの評価軸</h4>
        {shownCurrentAverage !== null && (
          <p className="text-[11px] text-muted-foreground">
            平均 <span className="font-bold text-foreground">{shownCurrentAverage.toFixed(1)}</span>
            {previous && shownPreviousAverage !== null && (
              <span>（前回 {shownPreviousAverage.toFixed(1)} → {deltaText(Number((shownCurrentAverage - shownPreviousAverage).toFixed(1))) }）</span>
            )}
          </p>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {axes.map(axis => {
          const current = parseCritiqueScore(entry?.scores?.[axis.key]);
          const before = parseCritiqueScore(previous?.scores?.[axis.key]);
          const compared = comparison?.scores?.[axis.key];
          const comparedDelta = parseOptionalFiniteNumber(
            typeof compared === 'number' ? compared : compared?.delta,
          );
          const delta = current !== null && before !== null
            ? comparedDelta ?? current - before
            : null;
          return (
            <div key={axis.key} className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-bold text-foreground">{axis.label}</span>
                <span className="text-base font-black text-neon-pink">{current ?? '—'}</span>
              </div>
              <p className="mt-1 break-words text-[10px] text-muted-foreground">
                {previous
                  ? `前回 ${before ?? '—'} → 今回 ${current ?? '—'}${delta !== null ? `（${deltaText(delta)}）` : ''}`
                  : '初回評価'}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HistoryCard({
  entry,
  previous,
  latest,
  axes,
  judgments,
  statuses,
  taskResult,
  taskBusy,
  mutationsBlocked,
  onEdit,
  onDuplicate,
  onDelete,
  onAddTasks,
  onClassify,
  onCopyDecisionPrompt,
  decisionPromptCopied,
  onNavigateCreation,
}) {
  const [open, setOpen] = useState(latest);
  const comparison = previous ? compareCritiqueEntries(entry, previous) : null;
  const fixes = normalizePriorityFixes(entry.priorityFixes).filter(Boolean);
  const findingBlocks = CRITIQUE_FINDING_CATEGORIES
    .map(category => ({ ...category, value: entry.findingCategories?.[category.key] || '' }))
    .filter(category => category.value);
  const briefSnapshot = entry.briefSnapshot || {};
  const hasBriefSnapshot = Object.values(briefSnapshot).some(Boolean);

  return (
    <article className="min-w-0 overflow-hidden rounded-xl" style={{ ...CARD_STYLE, borderLeft: latest ? '4px solid #ff2d78' : '4px solid #00f5ff' }}>
      <div className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70"
        >
          <History className={`mt-0.5 h-4 w-4 flex-shrink-0 ${latest ? 'text-neon-pink' : 'text-neon-cyan'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-sm font-bold text-foreground">{entry.manuscriptLabel || '原稿ラベル未設定'}</h3>
              {latest && <span className="rounded-full border border-neon-pink/30 bg-neon-pink/10 px-2 py-0.5 text-[9px] font-bold text-neon-pink">最新</span>}
              <span className="rounded-full border border-neon-amber/30 bg-neon-amber/10 px-2 py-0.5 text-[9px] font-bold text-neon-amber">
                {optionLabel(judgments, entry.judgment)}
              </span>
            </div>
            <p className="mt-1 break-words text-[10px] text-muted-foreground">
              論評 {formatDateTime(entry.reviewedAt)}
              {entry.environmentModel ? ` ・ ${entry.environmentModel}` : ''}
            </p>
            {previous && (
              <p className="mt-1 text-[10px] text-neon-cyan">
                前回「{optionLabel(judgments, previous.judgment)}」→ 今回「{optionLabel(judgments, entry.judgment)}」
              </p>
            )}
          </div>
          {open ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
        </button>

        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          <Button type="button" size="sm" variant="ghost" disabled={mutationsBlocked} onClick={() => onEdit(entry)} className="h-8 gap-1 text-[10px] text-neon-cyan hover:bg-neon-cyan/10 hover:text-neon-cyan">
            <Pencil className="h-3.5 w-3.5" />編集
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={mutationsBlocked} onClick={() => onDuplicate(entry)} className="h-8 gap-1 text-[10px] text-neon-amber hover:bg-neon-amber/10 hover:text-neon-amber">
            <Copy className="h-3.5 w-3.5" />複製
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={mutationsBlocked} onClick={() => onDelete(entry)} className="h-8 gap-1 text-[10px] text-red-400 hover:bg-red-500/10 hover:text-red-300">
            <Trash2 className="h-3.5 w-3.5" />削除
          </Button>
        </div>
      </div>

      {open && (
        <div className="min-w-0 space-y-4 border-t border-border/50 px-4 pb-4 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span>対応状況：</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-bold text-foreground">
              {optionLabel(statuses, entry.responseStatus)}
            </span>
            <span>記録作成：{formatDateTime(entry.createdAt)}</span>
          </div>

          <ScoreComparison entry={entry} previous={previous} axes={axes} comparison={comparison} />

          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
            <TextBlock label="総評" value={entry.summary} />
            <TextBlock label="致命的な不足／ハードゲート" value={entry.hardGates} />
            <TextBlock label="価格の制限要因" value={entry.priceConstraints} />
            <TextBlock label="推奨価格帯" value={entry.recommendedPriceRange} />
            <TextBlock label="価格を下げる案" value={entry.lowerPricePlan} />
            <TextBlock label="内容を強化する案" value={entry.strengthenContentPlan} />
            <TextBlock label="著者の判断" value={entry.authorDecision} />
            <TextBlock label="自由メモ" value={entry.notes} />
          </div>

          {hasBriefSnapshot && (
            <section className="rounded-xl border border-violet-400/20 bg-violet-500/[0.03] p-3 sm:p-4">
              <h4 className="text-xs font-bold text-violet-200">この論評で使った本の前提</h4>
              <p className="mt-1 text-[10px] text-muted-foreground">後から本の方向性が変わっても、当時どの前提で評価したかを確認できます。</p>
              <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <TextBlock label="誰に向けた本か" value={briefSnapshot.targetReader} />
                <TextBlock label="何を伝える本か" value={briefSnapshot.coreMessage} />
                <TextBlock label="読後にどう変わってほしいか" value={briefSnapshot.readerOutcome} />
                <TextBlock label="予定価格" value={briefSnapshot.plannedPrice} />
                <TextBlock label="出版の目的" value={briefSnapshot.publicationPurpose} />
                <TextBlock label="原稿版ラベル" value={briefSnapshot.manuscriptLabel} />
              </div>
            </section>
          )}

          <section className="rounded-xl border border-violet-400/20 bg-violet-500/[0.03] p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="text-xs font-bold text-violet-200">指摘を4種類に整理</h4>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">AIの指摘をそのまま採用せず、「必ず直す・読者確認・著者判断・見送る」に分けて理由を残します。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={mutationsBlocked} onClick={() => onClassify(entry)} className="min-h-9 gap-1.5 border-violet-400/35 bg-violet-500/10 text-[10px] text-violet-200 hover:bg-violet-500/20">
                  <Pencil className="h-3.5 w-3.5" />{findingBlocks.length ? '分類を編集' : '4種類に整理'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onCopyDecisionPrompt(entry)} className="min-h-9 gap-1.5 border-neon-cyan/35 bg-neon-cyan/10 text-[10px] text-neon-cyan hover:bg-neon-cyan/20">
                  {decisionPromptCopied ? <Check className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  {decisionPromptCopied ? '相談文をコピー済み' : '修正判断をCodexへ相談'}
                </Button>
              </div>
            </div>
            {findingBlocks.length > 0 ? (
              <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                {findingBlocks.map(category => (
                  <TextBlock key={category.key} label={category.label} value={category.value} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">まだ分類されていません。原文の論評を残したまま、採否の判断だけを追加できます。</p>
            )}
          </section>

          <section className="rounded-xl border border-neon-pink/20 bg-neon-pink/[0.03] p-3 sm:p-4">
            <h4 className="text-xs font-bold text-neon-pink">優先修正トップ3</h4>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">1位は、目次の重複や誤字脱字など、まず直せる修正を優先します（ある場合）。2位・3位は必要な修正だけで、無理に埋めません。</p>
            {fixes.length > 0 ? (
              <ol className="mt-2 space-y-2">
                {fixes.map((fix, index) => (
                  <li key={`${entry.id}-fix-${index}`} className="flex min-w-0 gap-2 text-xs leading-relaxed text-foreground">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-neon-pink/15 text-[10px] font-black text-neon-pink">{index + 1}</span>
                    <span className="min-w-0 whitespace-pre-wrap break-words">{fix}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">優先修正はまだ入力されていません。</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={mutationsBlocked || taskBusy || fixes.length === 0}
                onClick={() => onAddTasks(entry)}
                className="min-h-9 gap-1.5 border border-neon-pink/35 bg-neon-pink/15 text-xs text-neon-pink hover:bg-neon-pink/25"
              >
                <ListPlus className="h-4 w-4" />
                {taskBusy ? '追加中…' : '制作進捗へ修正タスクを追加'}
              </Button>
              {taskResult && (
                <p className="text-[10px] text-muted-foreground" aria-live="polite">
                  {taskResult.added}件追加・{taskResult.updated || 0}件更新・{taskResult.skipped}件は追加済みまたは空欄
                </p>
              )}
              {taskResult && (
                <button type="button" onClick={onNavigateCreation} className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-[10px] font-bold text-neon-cyan hover:bg-neon-cyan/10">
                  制作進捗で確認<ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

function EntryForm({ open, editing, draft, axes, judgments, statuses, saving, onOpenChange, onDraftChange, onSave }) {
  if (!draft) return null;

  const update = (key, value) => onDraftChange(current => ({ ...current, [key]: value }));
  const updateScore = (key, value) => onDraftChange(current => ({
    ...current,
    scores: { ...current.scores, [key]: value === '' ? '' : Number(value) },
  }));
  const updateFix = (index, value) => onDraftChange(current => ({
    ...current,
    priorityFixes: current.priorityFixes.map((fix, fixIndex) => fixIndex === index ? value : fix),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto p-4 sm:p-6" style={{ background: '#151527', border: '1px solid #2a2a4a' }}>
        <DialogHeader className="pr-7">
          <DialogTitle className="text-neon-pink">{editing ? '辛口論評を編集' : '新しい辛口論評を記録'}</DialogTitle>
          <DialogDescription>
            原稿を別視点で確認した結果を保存します。入力した内容はこのプロジェクトだけに保存されます。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSave} className="min-w-0 space-y-5">
          <section className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>論評日時</span>
              <input type="datetime-local" required value={draft.reviewedAt} onChange={event => update('reviewedAt', event.target.value)} className="h-10 w-full min-w-0 rounded-md px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70" style={INPUT_STYLE} />
            </label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>対象原稿バージョン／ラベル</span>
              <input required value={draft.manuscriptLabel} onChange={event => update('manuscriptLabel', event.target.value)} placeholder="例：第2稿・2026年8月版" className="h-10 w-full min-w-0 rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70" style={INPUT_STYLE} />
            </label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>実行環境・モデル名 <span className="font-normal text-muted-foreground">（任意）</span></span>
              <input value={draft.environmentModel} onChange={event => update('environmentModel', event.target.value)} placeholder="例：Codex / 使用モデル名" className="h-10 w-full min-w-0 rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70" style={INPUT_STYLE} />
            </label>
          </section>

          <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>総合判定</span>
              <select required value={draft.judgment} onChange={event => update('judgment', event.target.value)} className="h-10 w-full min-w-0 rounded-md px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-neon-pink/70" style={INPUT_STYLE}>
                {judgments.map(option => <option key={option.value} value={option.value} className="bg-[#1a1a2e]">{option.label}</option>)}
              </select>
            </label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>対応状況</span>
              <select required value={draft.responseStatus} onChange={event => update('responseStatus', event.target.value)} className="h-10 w-full min-w-0 rounded-md px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70" style={INPUT_STYLE}>
                {statuses.map(option => <option key={option.value} value={option.value} className="bg-[#1a1a2e]">{option.label}</option>)}
              </select>
            </label>
          </section>

          <section className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/[0.03] p-3 sm:p-4">
            <div>
              <h3 className="text-sm font-bold text-neon-cyan">評価軸（1〜5）</h3>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                1は大きな改善が必要、5は十分に強い状態の目安です。
                {editing ? ' 未評価だった項目は空欄のまま保存できます。' : ' 新規記録は全項目3点から始まります。'}
              </p>
            </div>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {axes.map(axis => (
                <label key={axis.key} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs font-bold">
                  <span className="min-w-0 break-words">{axis.label}</span>
                  <select aria-label={`${axis.label}の点数`} required={!editing} value={draft.scores[axis.key] ?? ''} onChange={event => updateScore(axis.key, event.target.value)} className="h-9 w-24 flex-shrink-0 rounded-md px-2 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70" style={INPUT_STYLE}>
                    <option value="" className="bg-[#1a1a2e]">未評価</option>
                    {[1, 2, 3, 4, 5].map(score => <option key={score} value={score} className="bg-[#1a1a2e]">{score}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="min-w-0 space-y-1.5 text-xs font-bold lg:col-span-2">
              <span>総評</span>
              <textarea value={draft.summary} onChange={event => update('summary', event.target.value)} rows={5} placeholder="原稿全体の強み、弱み、販売・公開に向けた判断を記録" className="min-h-[120px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-pink/70" style={INPUT_STYLE} />
            </label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>価格の制限要因</span>
              <textarea value={draft.priceConstraints} onChange={event => update('priceConstraints', event.target.value)} rows={4} placeholder="価格を上げにくくしている不足や条件" className="min-h-[100px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70" style={INPUT_STYLE} />
            </label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>推奨価格帯</span>
              <textarea value={draft.recommendedPriceRange} onChange={event => update('recommendedPriceRange', event.target.value)} rows={4} placeholder="例：現状は○円〜○円を再検討。最終価格は著者が決定" className="min-h-[100px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70" style={INPUT_STYLE} />
            </label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold lg:col-span-2">
              <span>致命的な不足／ハードゲート</span>
              <textarea value={draft.hardGates} onChange={event => update('hardGates', event.target.value)} rows={4} placeholder="権利、事実、危険な断定、著者確認など、公開前に必ず解消する項目" className="min-h-[100px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-amber/70" style={INPUT_STYLE} />
            </label>
          </div>

          <section className="rounded-xl border border-neon-pink/20 bg-neon-pink/[0.03] p-3 sm:p-4">
            <h3 className="text-sm font-bold text-neon-pink">優先修正トップ3</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">目次の重複、誤字脱字、明らかな表記ゆれ・見出しのズレがあれば1位へ。まず1件直して前進を実感し、内容面の修正は必要なものだけ選びます。無理に3件すべてを埋める必要はありません。権利・安全・重大な事実誤りは、上のハードゲートで別に必ず管理します。保存後は制作進捗の追加タスクへ重複なく登録できます。</p>
            <div className="mt-3 space-y-2">
              {draft.priorityFixes.map((fix, index) => (
                <label key={`priority-fix-${index}`} className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] items-start gap-2">
                  <span className="mt-2 flex h-5 w-5 items-center justify-center rounded-full bg-neon-pink/15 text-[10px] font-black text-neon-pink">{index + 1}</span>
                  <textarea aria-label={`優先修正 ${index + 1}`} value={fix} onChange={event => updateFix(index, event.target.value)} rows={2} placeholder={index === 0 ? '例：重複した目次を削除する／誤字を修正する' : `優先修正 ${index + 1}`} className="min-w-0 resize-y rounded-md px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-pink/70" style={INPUT_STYLE} />
                </label>
              ))}
            </div>
          </section>

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>価格を下げる案</span>
              <textarea value={draft.lowerPricePlan} onChange={event => update('lowerPricePlan', event.target.value)} rows={4} placeholder="内容を変えずに価格・提供方法を調整する場合" className="min-h-[100px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70" style={INPUT_STYLE} />
            </label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>内容を強化する案</span>
              <textarea value={draft.strengthenContentPlan} onChange={event => update('strengthenContentPlan', event.target.value)} rows={4} placeholder="事例、根拠、手順、付録などを追加する場合" className="min-h-[100px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70" style={INPUT_STYLE} />
            </label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>著者の判断</span>
              <textarea value={draft.authorDecision} onChange={event => update('authorDecision', event.target.value)} rows={4} placeholder="採用する修正、見送る修正、その理由" className="min-h-[100px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-pink/70" style={INPUT_STYLE} />
            </label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold">
              <span>自由メモ</span>
              <textarea value={draft.notes} onChange={event => update('notes', event.target.value)} rows={4} placeholder="再論評の条件、確認先、保留事項など" className="min-h-[100px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/70" style={INPUT_STYLE} />
            </label>
          </div>

          <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:space-x-0">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>キャンセル</Button>
            <Button type="submit" disabled={saving} className="gap-2 border border-neon-pink/40 bg-neon-pink/20 text-neon-pink hover:bg-neon-pink/30">
              <Save className="h-4 w-4" />{saving ? '保存中…' : '論評を保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ReviewGuideTab({ project, onProjectUpdate, onNavigateTab }) {
  const axes = useMemo(() => normalizeAxes(CRITIQUE_AXES), []);
  const judgments = useMemo(() => normalizeOptions(CRITIQUE_JUDGMENTS, FALLBACK_JUDGMENTS), []);
  const statuses = useMemo(() => normalizeOptions(CRITIQUE_RESPONSE_STATUSES, FALLBACK_RESPONSE_STATUSES), []);
  const [entries, setEntries] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [corruptRaw, setCorruptRaw] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState('');
  const [draft, setDraft] = useState(null);
  const [savingEntry, setSavingEntry] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [taskBusyId, setTaskBusyId] = useState('');
  const [taskResults, setTaskResults] = useState({});
  const [promptCopied, setPromptCopied] = useState(false);
  const [critiqueContext, setCritiqueContext] = useState(() => createEmptyCritiqueContext());
  const [contextDraft, setContextDraft] = useState(() => createEmptyCritiqueContext());
  const [contextHasSaved, setContextHasSaved] = useState(false);
  const [contextError, setContextError] = useState('');
  const [contextCorruptRaw, setContextCorruptRaw] = useState('');
  const [contextDirty, setContextDirty] = useState(false);
  const [contextConflict, setContextConflict] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [contextSaving, setContextSaving] = useState(false);
  const [classificationTarget, setClassificationTarget] = useState(null);
  const [classificationDraft, setClassificationDraft] = useState(null);
  const [classificationDirty, setClassificationDirty] = useState(false);
  const [classificationConflict, setClassificationConflict] = useState(false);
  const [classificationSaving, setClassificationSaving] = useState(false);
  const [decisionPromptCopiedId, setDecisionPromptCopiedId] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [stoppingChecks, setStoppingChecks] = useState({});
  const [stoppingChecksError, setStoppingChecksError] = useState('');
  const [legacyStoppingChecks, setLegacyStoppingChecks] = useState({});
  const [legacyStoppingImporting, setLegacyStoppingImporting] = useState(false);
  const activeProjectIdRef = useRef(project?.id || '');
  const onProjectUpdateRef = useRef(onProjectUpdate);
  const stoppingChecksRef = useRef({});
  const formOpenRef = useRef(formOpen || Boolean(classificationTarget));
  const loadedHistoryRef = useRef({ projectId: '', raw: undefined });
  const contextDirtyRef = useRef(false);
  const classificationDirtyRef = useRef(false);
  const contextDraftCacheRef = useRef(new Map());
  const classificationDraftCacheRef = useRef(new Map());
  const loadedContextRef = useRef({ projectId: '', raw: undefined });
  const projectSelectionRef = useRef({ projectId: project?.id || '', generation: 0 });
  const renderedProjectId = project?.id || '';
  if (projectSelectionRef.current.projectId !== renderedProjectId) {
    projectSelectionRef.current = {
      projectId: renderedProjectId,
      generation: projectSelectionRef.current.generation + 1,
    };
  }
  activeProjectIdRef.current = renderedProjectId;
  onProjectUpdateRef.current = onProjectUpdate;
  formOpenRef.current = formOpen || Boolean(classificationTarget);

  const canApplyMutationResult = (startedProjectId, startedGeneration) => (
    shouldApplyCritiqueMutationResult(
      startedProjectId,
      activeProjectIdRef.current,
      startedGeneration,
      projectSelectionRef.current.generation,
    )
  );

  useEffect(() => {
    setFormOpen(false);
    setEditingEntryId('');
    setDraft(null);
    setSavingEntry(false);
    setDeleteTarget(null);
    setDeleting(false);
    setTaskBusyId('');
    setTaskResults({});
    setPromptCopied(false);
    setDecisionPromptCopiedId('');
    setClassificationTarget(null);
    setClassificationDraft(null);
    classificationDirtyRef.current = false;
    setClassificationDirty(false);
    setClassificationConflict(false);
    setClassificationSaving(false);
    setContextSaving(false);
    contextDirtyRef.current = false;
    setContextDirty(false);
    setContextConflict(false);
    setGuideOpen(false);
    setLegacyStoppingImporting(false);

  }, [project?.id]);

  useEffect(() => {
    const projectId = project?.id || '';
    const rawContext = typeof project?.critique_context === 'string'
      ? project.critique_context
      : '';
    const previous = loadedContextRef.current;
    const sameProject = previous.projectId === projectId;
    const changedExternally = sameProject
      && previous.raw !== undefined
      && previous.raw !== rawContext;
    loadedContextRef.current = { projectId, raw: rawContext };

    if (!project) {
      const empty = createEmptyCritiqueContext();
      setCritiqueContext(empty);
      setContextDraft(empty);
      setContextHasSaved(false);
      setContextError('');
      setContextCorruptRaw('');
      setContextOpen(true);
      contextDirtyRef.current = false;
      setContextDirty(false);
      return;
    }

    const parsed = readCritiqueContext(rawContext);
    setCritiqueContext(parsed.context);
    setContextHasSaved(parsed.hasSavedContext);
    setContextError(parsed.error?.message || '');
    setContextCorruptRaw(parsed.corruptRaw || '');

    const cachedDraft = readCachedCritiqueDraft(contextDraftCacheRef.current, projectId);
    if (cachedDraft) {
      setContextDraft(cachedDraft.draft);
      contextDirtyRef.current = true;
      setContextDirty(true);
      setContextConflict(hasCachedCritiqueDraftConflict(cachedDraft, parsed.context.updatedAt));
      setContextOpen(true);
    } else if (!sameProject || !contextDirtyRef.current) {
      const inferredReader = parsed.hasSavedContext ? '' : extractTargetReader(project);
      const nextDraft = parsed.hasSavedContext
        ? parsed.context
        : { ...parsed.context, targetReader: inferredReader };
      setContextDraft(nextDraft);
      const hasSuggestedDraft = !parsed.hasSavedContext && Boolean(inferredReader);
      contextDirtyRef.current = hasSuggestedDraft;
      setContextDirty(hasSuggestedDraft);
      setContextConflict(false);
    } else if (changedExternally) {
      setContextConflict(true);
      toast.info('同じプロジェクトの「本の前提」が更新されました。入力中の内容は保持しています');
    }

    if (!parsed.hasSavedContext || parsed.error) setContextOpen(true);
  }, [project?.id, project?.critique_context]);

  useEffect(() => {
    const projectId = project?.id || '';
    const rawHistory = project?.critique_history || '';
    const previous = loadedHistoryRef.current;
    const notifyDraftPreserved = shouldNotifyCritiqueHistoryChange({
      previousProjectId: previous.projectId,
      currentProjectId: projectId,
      previousHistory: previous.raw,
      currentHistory: rawHistory,
      draftOpen: formOpenRef.current,
    });
    loadedHistoryRef.current = { projectId, raw: rawHistory };

    if (!project) {
      setEntries([]);
      setHistoryError('');
      setCorruptRaw('');
      return;
    }
    const parsed = readCritiqueHistory(rawHistory);
    setEntries(sortedByReviewedAt(parsed.entries || []));
    setHistoryError(parsed.error ? parsed.error.message || '辛口論評の保存データを読み込めませんでした' : '');
    setCorruptRaw(parsed.corruptRaw || '');
    if (notifyDraftPreserved) {
      toast.info('同じプロジェクトの論評履歴が更新されました。入力中の下書きは保持しています');
    }
  }, [project?.id, project?.critique_history]);

  useEffect(() => {
    if (!classificationTarget) return;
    const latestEntry = entries.find(entry => entry.id === classificationTarget.id);
    if (latestEntry && latestEntry.updatedAt !== classificationTarget.updatedAt) {
      setClassificationConflict(true);
    }
  }, [entries, classificationTarget]);

  useEffect(() => {
    if (!project) {
      stoppingChecksRef.current = {};
      setStoppingChecks({});
      setStoppingChecksError('');
      setLegacyStoppingChecks({});
      setLegacyStoppingImporting(false);
      return;
    }

    let legacyRaw = null;
    try {
      legacyRaw = localStorage.getItem(LEGACY_CRITIQUE_STOPPING_CHECKS_KEY);
    } catch {
      // 旧キーを読めない環境でも、プロジェクト内の保存値は利用する。
    }
    const restored = readCritiqueStoppingChecks(project.checklist_data, legacyRaw);
    if (restored.error) {
      stoppingChecksRef.current = {};
      setStoppingChecks({});
      setStoppingChecksError(restored.error.message || '終了判断チェックを読み込めませんでした');
      setLegacyStoppingChecks({});
      return;
    }

    const projectChecks = selectProjectCritiqueStoppingChecks(restored);
    stoppingChecksRef.current = projectChecks;
    setStoppingChecks(projectChecks);
    setStoppingChecksError('');
    setLegacyStoppingChecks(restored.legacyChecks || {});
  }, [project?.id, project?.checklist_data]);

  const openNewEntry = () => {
    setEditingEntryId('');
    setDraft(prepareDraft(null, axes));
    setFormOpen(true);
  };

  const openEditEntry = entry => {
    setEditingEntryId(entry.id);
    setDraft(prepareDraft(entry, axes));
    setFormOpen(true);
  };

  const handleContextDraftChange = updater => {
    setContextDraft(current => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      const manuscriptChanged = [
        'manuscriptLabel',
        'expectedFinalChapterTitle',
        'expectedLastSentence',
      ].some(key => current.manuscriptCheck?.[key] !== next?.manuscriptCheck?.[key]);
      const normalized = manuscriptChanged
        ? {
            ...next,
            manuscriptCheck: {
              ...next.manuscriptCheck,
              status: 'not_checked',
              checkedAt: '',
            },
          }
        : next;
      cacheCritiqueDraft(contextDraftCacheRef.current, project?.id || '', normalized, {
        baseUpdatedAt: current?.updatedAt || '',
      });
      return normalized;
    });
    contextDirtyRef.current = true;
    setContextDirty(true);
  };

  const handleSaveContext = async event => {
    event?.preventDefault?.();
    if (!project || contextSaving || contextError || contextConflict) return;

    const targetProject = project;
    const targetProjectId = targetProject.id;
    const targetGeneration = projectSelectionRef.current.generation;
    const targetDraftRevision = readCachedCritiqueDraft(
      contextDraftCacheRef.current,
      targetProjectId,
    )?.revision ?? null;
    const expectedUpdatedAt = contextDraft.updatedAt || '';
    setContextSaving(true);
    try {
      let savedContext = contextDraft;
      const updated = await mutatePublishingProject(targetProjectId, latest => {
        const latestRaw = typeof latest?.critique_context === 'string'
          ? latest.critique_context
          : '';
        const result = upsertCritiqueContext(latestRaw, contextDraft, { expectedUpdatedAt });
        savedContext = result.context;
        return { critique_context: result.value };
      }, targetProject);

      const cachedAfterSave = readCachedCritiqueDraft(
        contextDraftCacheRef.current,
        targetProjectId,
      );
      const draftUnchanged = cachedAfterSave
        ? cachedAfterSave.revision === targetDraftRevision
        : targetDraftRevision === null;
      if (cachedAfterSave && draftUnchanged) {
        clearCachedCritiqueDraftIfUnchanged(
          contextDraftCacheRef.current,
          targetProjectId,
          targetDraftRevision,
        );
      }

      if (canApplyMutationResult(targetProjectId, targetGeneration) && draftUnchanged) {
        contextDirtyRef.current = false;
        setContextDirty(false);
        setCritiqueContext(savedContext);
        setContextDraft(savedContext);
        setContextHasSaved(true);
        setContextConflict(false);
        setContextOpen(false);
      }
      onProjectUpdateRef.current?.(updated);
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        toast.success('この本の前提と原稿確認情報を保存しました');
      }
    } catch (error) {
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        toast.error(error?.message || 'この本の前提を保存できませんでした');
      }
    } finally {
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        setContextSaving(false);
      }
    }
  };

  const discardStaleContextDraft = () => {
    if (!project) return;
    contextDraftCacheRef.current.delete(project.id);
    setContextDraft(critiqueContext);
    contextDirtyRef.current = false;
    setContextDirty(false);
    setContextConflict(false);
    toast.info('未保存内容を破棄し、最新の本の前提へ切り替えました');
  };

  const downloadCorruptContext = () => {
    if (!contextCorruptRaw) return;
    try {
      const url = URL.createObjectURL(new Blob([contextCorruptRaw], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `kindle-navi-critique-context-recovery-${project?.id || 'project'}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast.error(error?.message || '本の前提の退避データをダウンロードできませんでした');
    }
  };

  const handleFormOpenChange = nextOpen => {
    if (savingEntry) return;
    setFormOpen(nextOpen);
    if (!nextOpen) {
      setEditingEntryId('');
      setDraft(null);
    }
  };

  const handleSaveEntry = async event => {
    event.preventDefault();
    if (!project || !draft || savingEntry || historyError) return;

    const reviewedAt = new Date(draft.reviewedAt || '');
    const axisKeys = axes.map(axis => axis.key);
    const scoresValid = validateCritiqueDraftScores(
      draft.scores,
      axisKeys,
      { requireAll: !editingEntryId },
    );
    if (Number.isNaN(reviewedAt.getTime()) || !draft.manuscriptLabel.trim() || !scoresValid) {
      toast.error(editingEntryId
        ? '論評日時・原稿ラベル・入力済み評価点が1〜5か確認してください'
        : '論評日時・原稿ラベル・1〜5の評価点を確認してください');
      return;
    }

    const targetProject = project;
    const targetProjectId = targetProject.id;
    const targetGeneration = projectSelectionRef.current.generation;
    setSavingEntry(true);
    try {
      const targetEntryId = editingEntryId;
      const expectedUpdatedAt = targetEntryId ? draft.updatedAt : '';
      const entryInput = {
        ...draft,
        ...(targetEntryId ? { id: targetEntryId } : {}),
        manuscriptLabel: draft.manuscriptLabel.trim(),
        reviewedAt: reviewedAt.toISOString(),
        scores: serializeCritiqueDraftScores(draft.scores, axisKeys),
        priorityFixes: normalizePriorityFixes(draft.priorityFixes),
        briefSnapshot: targetEntryId
          ? draft.briefSnapshot
          : createCritiqueBriefSnapshot(critiqueContext),
      };
      const entryToSave = targetEntryId ? entryInput : createCritiqueEntry(entryInput);
      let nextEntries = entries;
      const updated = await mutatePublishingProject(project.id, latest => {
        const latestRaw = typeof latest?.critique_history === 'string'
          ? latest.critique_history
          : serializeCritiqueHistory([]);
        const latestHistory = readCritiqueHistory(latestRaw);
        if (latestHistory.error) throw latestHistory.error;
        const latestEntry = targetEntryId
          ? latestHistory.entries.find(entry => entry.id === targetEntryId)
          : null;
        if (targetEntryId && !latestEntry) {
          throw new Error('編集対象の論評が別の画面で削除されました。画面を更新して確認してください');
        }
        if (targetEntryId && hasCritiqueEntryEditConflict(expectedUpdatedAt, latestEntry)) {
          throw new Error('この論評は別の画面で更新されています。入力中の下書きは保持しました。最新履歴を確認して編集し直すか、内容を複製下書きとして保存してください');
        }
        const result = upsertCritiqueEntry(latestRaw, entryToSave);
        nextEntries = result.entries;
        return { critique_history: result.value };
      }, targetProject);
      onProjectUpdate?.(updated);
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        setEntries(sortedByReviewedAt(nextEntries));
        setFormOpen(false);
        setEditingEntryId('');
        setDraft(null);
        toast.success('辛口論評を保存しました');
      }
    } catch (error) {
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        toast.error(error?.message || '辛口論評を保存できませんでした');
      }
    } finally {
      if (canApplyMutationResult(targetProjectId, targetGeneration)) setSavingEntry(false);
    }
  };

  const handleDuplicate = entry => {
    if (!project || historyError) return;
    try {
      const duplicateDraft = createCritiqueDuplicateDraft(entry, {
        briefSnapshot: createCritiqueBriefSnapshot(critiqueContext),
      });
      setEditingEntryId('');
      setDraft(prepareDraft(duplicateDraft, axes));
      setFormOpen(true);
      toast.info('複製を未保存の下書きとして開きました。編集後に保存してください');
    } catch (error) {
      toast.error(error?.message || '論評の複製下書きを作成できませんでした');
    }
  };

  const handleStoppingCheckChange = (signId, checked) => {
    if (!project || stoppingChecksError) return;
    const targetProject = project;
    const targetGeneration = projectSelectionRef.current.generation;
    const previous = stoppingChecksRef.current;
    const next = { ...previous, [signId]: checked === true };
    stoppingChecksRef.current = next;
    setStoppingChecks(next);

    let savedChecks = next;
    mutatePublishingProject(targetProject.id, latest => {
      const result = patchCritiqueStoppingCheck(latest?.checklist_data, signId, checked);
      savedChecks = result.checks;
      return { checklist_data: result.value };
    }, targetProject).then(updated => {
      onProjectUpdateRef.current?.(updated);
      if (canApplyMutationResult(targetProject.id, targetGeneration)) {
        const current = stoppingChecksRef.current;
        const reconciled = current === next ? savedChecks : { ...savedChecks, ...current };
        stoppingChecksRef.current = reconciled;
        setStoppingChecks(reconciled);
      }
    }).catch(error => {
      if (canApplyMutationResult(targetProject.id, targetGeneration)) {
        const rolledBack = rollbackFailedCritiqueStoppingChecks(
          stoppingChecksRef.current,
          next,
          previous,
        );
        if (rolledBack !== stoppingChecksRef.current) {
          stoppingChecksRef.current = rolledBack;
          setStoppingChecks(rolledBack);
        }
        toast.error(error?.message || '終了判断チェックを保存できませんでした');
      }
    });
  };

  const handleImportLegacyStoppingChecks = async () => {
    if (!project || stoppingChecksError || legacyStoppingImporting) return;
    const targetProject = project;
    const targetGeneration = projectSelectionRef.current.generation;
    let next = { ...legacyStoppingChecks, ...stoppingChecksRef.current };
    setLegacyStoppingImporting(true);
    try {
      const updated = await mutatePublishingProject(targetProject.id, latest => {
        const result = mergeCritiqueStoppingChecks(latest?.checklist_data, legacyStoppingChecks);
        next = result.checks;
        return { checklist_data: result.value };
      }, targetProject);
      try {
        localStorage.removeItem(LEGACY_CRITIQUE_STOPPING_CHECKS_KEY);
      } catch {
        // プロジェクトへの保存は完了しているため、旧キーが残っても保存値を優先する。
      }
      onProjectUpdateRef.current?.(updated);
      if (canApplyMutationResult(targetProject.id, targetGeneration)) {
        stoppingChecksRef.current = next;
        setStoppingChecks(next);
        setLegacyStoppingChecks({});
        toast.success(`旧終了判断チェックを「${targetProject.name}」へ引き継ぎました`);
      }
    } catch (error) {
      if (canApplyMutationResult(targetProject.id, targetGeneration)) {
        toast.error(error?.message || '旧終了判断チェックを引き継げませんでした。元の旧キーは残しています');
      }
    } finally {
      if (canApplyMutationResult(targetProject.id, targetGeneration)) {
        setLegacyStoppingImporting(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!project || !deleteTarget || historyError || deleting) return;
    const targetProject = project;
    const targetProjectId = targetProject.id;
    const targetGeneration = projectSelectionRef.current.generation;
    setDeleting(true);
    try {
      let nextEntries = entries;
      const updated = await mutatePublishingProject(project.id, latest => {
        const latestRaw = typeof latest?.critique_history === 'string'
          ? latest.critique_history
          : serializeCritiqueHistory([]);
        const result = deleteCritiqueEntryIfUnchanged(latestRaw, deleteTarget);
        nextEntries = result.entries;
        return { critique_history: result.value };
      }, targetProject);
      onProjectUpdate?.(updated);
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        setEntries(sortedByReviewedAt(nextEntries));
        setDeleteTarget(null);
        toast.success('論評を削除しました');
      }
    } catch (error) {
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        toast.error(error?.message || '論評を削除できませんでした');
      }
    } finally {
      if (canApplyMutationResult(targetProjectId, targetGeneration)) setDeleting(false);
    }
  };

  const handleAddTasks = async entry => {
    if (!project || historyError || taskBusyId) return;
    const targetProject = project;
    const targetProjectId = targetProject.id;
    const targetGeneration = projectSelectionRef.current.generation;
    setTaskBusyId(entry.id);
    try {
      let resultSummary = { added: 0, updated: 0, skipped: 0 };
      const updated = await mutatePublishingProject(project.id, latest => {
        const checklist = readChecklistEnvelope(latest?.checklist_data);
        if (checklist.error) throw checklist.error;
        const envelope = /** @type {Record<string, any>} */ (checklist.envelope || {});
        const existingTasks = Array.isArray(envelope._creation_custom)
          ? envelope._creation_custom
          : Array.isArray(envelope._custom) ? envelope._custom : [];
        const latestRaw = typeof latest?.critique_history === 'string'
          ? latest.critique_history
          : serializeCritiqueHistory([]);
        const plan = buildLatestCritiqueTaskPlan(latestRaw, entry.id, existingTasks);
        const additions = Array.isArray(plan.additions) ? plan.additions : [];
        const updates = Array.isArray(plan.updates) ? plan.updates : [];
        const skipped = Array.isArray(plan.skipped) ? plan.skipped : [];
        const plannedTasks = Array.isArray(plan.tasks) ? plan.tasks : [...existingTasks, ...additions];
        resultSummary = { added: additions.length, updated: updates.length, skipped: skipped.length };
        return {
          checklist_data: writeChecklistEnvelope(
            latest?.checklist_data,
            checklist.data,
            { _creation_custom: plannedTasks },
          ),
        };
      }, targetProject);
      onProjectUpdate?.(updated);
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        setTaskResults(current => ({ ...current, [entry.id]: resultSummary }));
        if (resultSummary.added > 0 || resultSummary.updated > 0) {
          toast.success(`修正タスクを${resultSummary.added}件追加・${resultSummary.updated}件更新しました`);
        }
        else toast.info('追加できる新しい修正タスクはありませんでした');
      }
    } catch (error) {
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        toast.error(error?.message || '修正タスクを追加できませんでした');
      }
    } finally {
      if (canApplyMutationResult(targetProjectId, targetGeneration)) setTaskBusyId('');
    }
  };

  const createSavedPromptContext = () => {
    if (!project) return null;
    const saved = readCritiqueContext(project.critique_context || '');
    if (saved.error || contextError) {
      toast.error(saved.error?.message || contextError || '本の前提を読み込めないため、相談文のコピーを停止しました');
      return null;
    }
    if (!saved.hasSavedContext || contextDirtyRef.current) {
      toast.info('先に「この本の前提」を保存してから相談文をコピーしてください');
      setContextOpen(true);
      return null;
    }

    let manuscript;
    try {
      manuscript = readProjectManuscript(project);
    } catch (error) {
      toast.error(error?.message || '旧版で保存した原稿データを読み込めないため、相談文のコピーを停止しました');
      return null;
    }
    return buildProjectPromptContext({
      project,
      fields: readProjectFields(project),
      entries,
      context: saved.context,
      manuscript,
      judgments,
      statuses,
    });
  };

  const handleCopyPrompt = async () => {
    const promptContext = createSavedPromptContext();
    if (!promptContext) return;
    try {
      const prompt = buildCritiqueCodexPrompt(promptContext);
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
      toast.success('原稿確認＋辛口論評の相談文をコピーしました');
    } catch (error) {
      toast.error(error?.message || '相談文をコピーできませんでした。ブラウザのクリップボード許可を確認してください');
    }
  };

  const openClassification = entry => {
    if (!project || historyError) return;
    const cacheKey = classificationDraftCacheKey(project.id, entry.id);
    const cached = readCachedCritiqueDraft(classificationDraftCacheRef.current, cacheKey);
    const hasCachedBaseUpdatedAt = Boolean(
      cached && Object.prototype.hasOwnProperty.call(cached, 'baseUpdatedAt'),
    );
    const hasConflict = hasCachedCritiqueDraftConflict(cached, entry.updatedAt);
    setClassificationTarget(hasCachedBaseUpdatedAt
      ? { ...entry, updatedAt: cached.baseUpdatedAt }
      : entry);
    setClassificationDraft(cached?.draft || {
      mustFix: entry.findingCategories?.mustFix || '',
      readerCheck: entry.findingCategories?.readerCheck || '',
      authorJudgment: entry.findingCategories?.authorJudgment || '',
      deferred: entry.findingCategories?.deferred || '',
    });
    classificationDirtyRef.current = Boolean(cached);
    setClassificationDirty(Boolean(cached));
    setClassificationConflict(hasConflict);
    if (hasConflict) {
      toast.warning('一時保存した4分類より後に、この論評が別の画面で更新されています。内容を確認してから最新データへ切り替えてください');
    }
  };

  const handleClassificationDraftChange = updater => {
    setClassificationDraft(current => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      const cacheKey = classificationDraftCacheKey(project?.id, classificationTarget?.id);
      cacheCritiqueDraft(classificationDraftCacheRef.current, cacheKey, next, {
        baseUpdatedAt: classificationTarget?.updatedAt || '',
      });
      return next;
    });
    classificationDirtyRef.current = true;
    setClassificationDirty(true);
  };

  const handleClassificationOpenChange = nextOpen => {
    if (classificationSaving) return;
    if (!nextOpen) {
      if (classificationDirtyRef.current) {
        toast.info('未保存の4分類を一時保存しました。もう一度開くと入力内容を戻せます');
      }
      setClassificationTarget(null);
      setClassificationDraft(null);
      classificationDirtyRef.current = false;
      setClassificationDirty(false);
      setClassificationConflict(false);
    }
  };

  const discardStaleClassificationDraft = () => {
    if (!project || !classificationTarget) return;
    const latestEntry = entries.find(entry => entry.id === classificationTarget.id);
    if (!latestEntry) {
      toast.error('最新の論評を確認できませんでした。画面を更新してください');
      return;
    }
    const cacheKey = classificationDraftCacheKey(project.id, latestEntry.id);
    classificationDraftCacheRef.current.delete(cacheKey);
    setClassificationTarget(latestEntry);
    setClassificationDraft({
      mustFix: latestEntry.findingCategories?.mustFix || '',
      readerCheck: latestEntry.findingCategories?.readerCheck || '',
      authorJudgment: latestEntry.findingCategories?.authorJudgment || '',
      deferred: latestEntry.findingCategories?.deferred || '',
    });
    classificationDirtyRef.current = false;
    setClassificationDirty(false);
    setClassificationConflict(false);
    toast.info('一時保存した内容を破棄し、最新の4分類へ切り替えました');
  };

  const handleSaveClassification = async event => {
    event?.preventDefault?.();
    if (!project || !classificationTarget || !classificationDraft || historyError || classificationSaving || classificationConflict) return;

    const targetProject = project;
    const targetProjectId = targetProject.id;
    const targetGeneration = projectSelectionRef.current.generation;
    const targetEntryId = classificationTarget.id;
    const targetCacheKey = classificationDraftCacheKey(targetProjectId, targetEntryId);
    const targetDraftRevision = readCachedCritiqueDraft(
      classificationDraftCacheRef.current,
      targetCacheKey,
    )?.revision ?? null;
    const expectedUpdatedAt = classificationTarget.updatedAt;
    setClassificationSaving(true);
    try {
      let nextEntries = entries;
      const updated = await mutatePublishingProject(targetProjectId, latest => {
        const latestRaw = typeof latest?.critique_history === 'string'
          ? latest.critique_history
          : serializeCritiqueHistory([]);
        const latestHistory = readCritiqueHistory(latestRaw);
        if (latestHistory.error) throw latestHistory.error;
        const latestEntry = latestHistory.entries.find(entry => entry.id === targetEntryId);
        if (!latestEntry) throw new Error('整理対象の論評が別の画面で削除されました');
        if (hasCritiqueEntryEditConflict(expectedUpdatedAt, latestEntry)) {
          throw new Error('この論評は別の画面で更新されています。最新履歴を確認してから4分類を編集し直してください');
        }
        const result = upsertCritiqueEntry(latestRaw, {
          ...latestEntry,
          findingCategories: classificationDraft,
        });
        nextEntries = result.entries;
        return { critique_history: result.value };
      }, targetProject);
      onProjectUpdateRef.current?.(updated);
      const cachedAfterSave = readCachedCritiqueDraft(
        classificationDraftCacheRef.current,
        targetCacheKey,
      );
      const draftUnchanged = cachedAfterSave
        ? cachedAfterSave.revision === targetDraftRevision
        : targetDraftRevision === null;
      if (cachedAfterSave && draftUnchanged) {
        clearCachedCritiqueDraftIfUnchanged(
          classificationDraftCacheRef.current,
          targetCacheKey,
          targetDraftRevision,
        );
      }
      if (canApplyMutationResult(targetProjectId, targetGeneration) && draftUnchanged) {
        setEntries(sortedByReviewedAt(nextEntries));
        setClassificationTarget(null);
        setClassificationDraft(null);
        classificationDirtyRef.current = false;
        setClassificationDirty(false);
        setClassificationConflict(false);
        toast.success('AIの指摘を4種類に整理して保存しました');
      }
    } catch (error) {
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        toast.error(error?.message || '指摘の分類を保存できませんでした');
      }
    } finally {
      if (canApplyMutationResult(targetProjectId, targetGeneration)) {
        setClassificationSaving(false);
      }
    }
  };

  const handleCopyDecisionPrompt = async (entry, draftCategories = null) => {
    const promptContext = createSavedPromptContext();
    if (!promptContext || !entry) return;
    try {
      const historicalBrief = entry.briefSnapshot && typeof entry.briefSnapshot === 'object'
        ? entry.briefSnapshot
        : {};
      const hasHistoricalBrief = [
        'targetReader',
        'coreMessage',
        'readerOutcome',
        'plannedPrice',
        'publicationPurpose',
        'manuscriptLabel',
      ].some(key => String(historicalBrief[key] || '').trim());
      const reviewedManuscriptLabel = String(
        entry.manuscriptLabel || historicalBrief.manuscriptLabel || '',
      ).trim();
      const currentManuscriptLabel = String(promptContext.manuscriptLabel || '').trim();
      const manuscriptVersionMismatch = hasCritiqueManuscriptVersionMismatch(
        reviewedManuscriptLabel,
        currentManuscriptLabel,
      );
      const prompt = buildCritiqueDecisionPrompt({
        ...promptContext,
        targetReader: hasHistoricalBrief ? historicalBrief.targetReader : '',
        coreMessage: hasHistoricalBrief ? historicalBrief.coreMessage : '',
        readerOutcome: hasHistoricalBrief ? historicalBrief.readerOutcome : '',
        plannedPrice: hasHistoricalBrief ? historicalBrief.plannedPrice : '',
        publicationPurpose: hasHistoricalBrief ? historicalBrief.publicationPurpose : '',
        reviewedManuscriptLabel,
        currentManuscriptLabel,
        manuscriptVersionMismatch,
        historicalPremiseUnavailable: !hasHistoricalBrief,
        selectedCritique: entry,
        findingCategories: draftCategories || entry.findingCategories,
        authorDecision: entry.authorDecision,
      });
      await navigator.clipboard.writeText(prompt);
      setDecisionPromptCopiedId(entry.id);
      setTimeout(() => setDecisionPromptCopiedId(''), 2000);
      toast.success('修正判断をCodexへ相談する文をコピーしました');
    } catch (error) {
      toast.error(error?.message || '修正判断の相談文をコピーできませんでした');
    }
  };

  const downloadCorruptHistory = () => {
    if (!corruptRaw) return;
    try {
      const url = URL.createObjectURL(new Blob([corruptRaw], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `kindle-navi-critique-recovery-${project?.id || 'project'}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast.error(error?.message || '退避データをダウンロードできませんでした');
    }
  };

  if (!project) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <History className="mx-auto h-10 w-10 text-neon-pink/70" />
        <p className="mt-3 text-sm">プロジェクトを選択してください</p>
      </div>
    );
  }

  const mutationsBlocked = Boolean(historyError);
  const completedStoppingSigns = STOPPING_SIGNS.filter(sign => stoppingChecks[sign.id]).length;
  const legacyStoppingCount = Object.values(legacyStoppingChecks).filter(Boolean).length;

  return (
    <div className="min-w-0 space-y-5">
      <section className="min-w-0 rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 flex-shrink-0 text-neon-pink" />
              <h2 className="text-base font-black text-neon-pink neon-pink-glow">辛口論評</h2>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              本の前提を保存 → 原稿を末尾まで読めたか確認 → 論評を保存 → 指摘を4種類に整理 → 小さく直して再論評、の履歴をこの本ごとに残せます。
              AIの点数を上げることではなく、読者へ伝わる本にしながら著者らしさを守ることが目的です。
            </p>
            <ol className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-[10px] text-muted-foreground sm:grid-cols-2 xl:grid-cols-5">
              {['本の前提を保存', '原稿を渡す', '最終章・最後の一文を確認', '論評結果を記録', '4分類して小さく修正'].map((step, index) => (
                <li key={step} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-neon-cyan/15 font-black text-neon-cyan">{index + 1}</span>
                  <span className="break-words">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-shrink-0 flex-wrap gap-2 lg:max-w-[280px] lg:justify-end">
            <Button type="button" onClick={handleCopyPrompt} variant="outline" className="min-h-10 gap-2 border-violet-400/40 bg-violet-500/10 text-xs text-violet-200 hover:bg-violet-500/20">
              {promptCopied ? <Check className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              {promptCopied ? '相談文をコピー済み' : '原稿確認＋辛口論評の相談文をコピー'}
            </Button>
            <Button type="button" onClick={openNewEntry} disabled={mutationsBlocked} className="min-h-10 gap-2 border border-neon-pink/40 bg-neon-pink/20 text-xs text-neon-pink hover:bg-neon-pink/30">
              <Plus className="h-4 w-4" />新しい論評を記録
            </Button>
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          相談文には、保存した5つの前提・書名・説明文・原稿版・旧版で保存済みの本文（ある場合）・直近の論評をまとめます。新しい原稿はCodexの相談時にファイルで添付してください。最初の返信では採点せず、最終章と最後の一文だけを確認します。このボタンでは外部送信しません。
        </p>
      </section>

      <CritiqueContextCard
        context={critiqueContext}
        draft={contextDraft}
        hasSaved={contextHasSaved}
        error={contextError}
        dirty={contextDirty}
        conflict={contextConflict}
        saving={contextSaving}
        open={contextOpen}
        onOpenChange={setContextOpen}
        onDraftChange={handleContextDraftChange}
        onSave={handleSaveContext}
        onDiscardStaleDraft={discardStaleContextDraft}
        onDownloadRaw={downloadCorruptContext}
      />

      {historyError && (
        <section className="rounded-xl border border-red-500/40 bg-red-950/30 p-4" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-red-200">保存済みの辛口論評を安全に読み込めませんでした</h3>
              <p className="mt-1 break-words text-xs leading-relaxed text-red-100/80">{historyError}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-red-100/70">元データを上書きしないため、編集・複製・削除・タスク追加を停止しています。下の退避ファイルを保存してください。データ管理では、正常部分のバックアップと壊れた論評原文の復旧用JSONを分けて保存できます。</p>
              {corruptRaw && (
                <Button type="button" size="sm" variant="outline" onClick={downloadCorruptHistory} className="mt-3 h-8 gap-1.5 border-red-400/40 text-[10px] text-red-200 hover:bg-red-500/10">
                  <Download className="h-3.5 w-3.5" />読み込めなかった論評データを退避
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {entries.length === 0 && !historyError ? (
        <section className="rounded-xl border border-dashed border-neon-cyan/30 bg-neon-cyan/[0.03] px-4 py-12 text-center sm:px-8" aria-label="辛口論評の空状態">
          <FileText className="mx-auto h-10 w-10 text-neon-cyan/70" />
          <h3 className="mt-4 text-sm font-bold text-foreground">まだ論評はありません</h3>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
            まず上の「この本の前提」を保存し、相談文をコピーしてください。Codexが答えた最終章と最後の一文を照合してから論評を進め、結果を「新しい論評を記録」へ保存します。
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" onClick={handleCopyPrompt} className="gap-2 border-violet-400/40 bg-violet-500/10 text-xs text-violet-200 hover:bg-violet-500/20">
              <Bot className="h-4 w-4" />相談文をコピー
            </Button>
            <Button type="button" onClick={openNewEntry} className="gap-2 border border-neon-pink/40 bg-neon-pink/20 text-xs text-neon-pink hover:bg-neon-pink/30">
              <Plus className="h-4 w-4" />新しい論評を記録
            </Button>
          </div>
        </section>
      ) : (
        <section className="min-w-0 space-y-3" aria-label="辛口論評の履歴">
          <div className="flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <h2 className="text-sm font-bold text-foreground">論評履歴</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">論評日時の新しい順に表示しています。各記録を開くと、直前の論評との差を確認できます。</p>
            </div>
            <span className="text-[10px] font-bold text-neon-cyan">{entries.length}件</span>
          </div>
          {entries.map((entry, index) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              previous={entries[index + 1] || null}
              latest={index === 0}
              axes={axes}
              judgments={judgments}
              statuses={statuses}
              taskResult={taskResults[entry.id]}
              taskBusy={taskBusyId === entry.id}
              mutationsBlocked={mutationsBlocked}
              onEdit={openEditEntry}
              onDuplicate={handleDuplicate}
              onDelete={setDeleteTarget}
              onAddTasks={handleAddTasks}
              onClassify={openClassification}
              onCopyDecisionPrompt={handleCopyDecisionPrompt}
              decisionPromptCopied={decisionPromptCopiedId === entry.id}
              onNavigateCreation={() => onNavigateTab?.('creation')}
            />
          ))}
        </section>
      )}

      {legacyStoppingCount > 0 && (
        <section className="rounded-xl border border-neon-amber/35 bg-neon-amber/[0.06] p-4" role="status">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neon-amber">出所不明の旧終了判断チェックが見つかりました</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                旧版では本ごとのIDが保存されていないため、自動では割り当てません。{legacyStoppingCount}件のチェックがこの本のものだと確認できた場合だけ、右のボタンで引き継いでください。確認が終わるまで元の旧キーは削除しません。
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={legacyStoppingImporting || Boolean(stoppingChecksError)}
              onClick={handleImportLegacyStoppingChecks}
              className="min-h-9 flex-shrink-0 border border-neon-amber/40 bg-neon-amber/15 text-xs text-neon-amber hover:bg-neon-amber/25"
            >
              {legacyStoppingImporting ? '引き継ぎ中…' : `この本へ引き継ぐ（${legacyStoppingCount}件）`}
            </Button>
          </div>
        </section>
      )}

      {stoppingChecksError && (
        <section className="rounded-xl border border-red-500/40 bg-red-950/30 p-4" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
            <div>
              <h3 className="text-sm font-bold text-red-200">終了判断チェックを読み込めませんでした</h3>
              <p className="mt-1 break-words text-xs text-red-100/80">{stoppingChecksError}</p>
              <p className="mt-1 text-[10px] text-red-100/70">空データで上書きしないためチェック操作を停止しています。データ管理からバックアップを保存し、チェックリストデータを復旧してください。</p>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl" style={CARD_STYLE}>
        <button type="button" onClick={() => setGuideOpen(value => !value)} aria-expanded={guideOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-amber/70">
          <ShieldCheck className="h-4 w-4 flex-shrink-0 text-neon-amber" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-neon-amber">論評を終える目安</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">修正ループから抜けるための参考。合否や出版可否を自動判定するものではありません。</p>
          </div>
          <span className="text-[10px] text-muted-foreground">{completedStoppingSigns}/{STOPPING_SIGNS.length}</span>
          {guideOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {guideOpen && (
          <div className="space-y-4 border-t border-border/50 px-4 pb-4 pt-4">
            <div className="space-y-2">
              {STOPPING_SIGNS.map(sign => (
                <label key={sign.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-foreground hover:border-neon-amber/30">
                  <Checkbox disabled={Boolean(stoppingChecksError)} checked={Boolean(stoppingChecks[sign.id])} onCheckedChange={checked => handleStoppingCheckChange(sign.id, checked)} className="mt-0.5 border-neon-amber/50 data-[state=checked]:border-neon-amber data-[state=checked]:bg-neon-amber" />
                  <span className="min-w-0 break-words">{sign.text}</span>
                </label>
              ))}
            </div>
            <div className="rounded-lg border border-neon-amber/25 bg-neon-amber/5 p-3 text-[10px] leading-relaxed text-muted-foreground">
              チェック数は停止点を考える参考です。致命的な不足とハードゲートを解消し、著者が原稿全体を確認したうえで最終判断してください。
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {LOOP_GUIDANCE.map(item => (
                <div key={item.title} className="rounded-lg border border-white/10 bg-black/10 p-3">
                  <h3 className="text-xs font-bold text-neon-amber">{item.title}</h3>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <EntryForm
        open={formOpen}
        editing={Boolean(editingEntryId)}
        draft={draft}
        axes={axes}
        judgments={judgments}
        statuses={statuses}
        saving={savingEntry}
        onOpenChange={handleFormOpenChange}
        onDraftChange={setDraft}
        onSave={handleSaveEntry}
      />

      <CritiqueFindingDialog
        open={Boolean(classificationTarget)}
        entry={classificationTarget}
        draft={classificationDraft}
        categories={CRITIQUE_FINDING_CATEGORIES}
        dirty={classificationDirty}
        conflict={classificationConflict}
        saving={classificationSaving}
        promptCopied={Boolean(classificationTarget && decisionPromptCopiedId === classificationTarget.id)}
        onOpenChange={handleClassificationOpenChange}
        onDraftChange={handleClassificationDraftChange}
        onDiscardStaleDraft={discardStaleClassificationDraft}
        onSave={handleSaveClassification}
        onCopyPrompt={() => handleCopyDecisionPrompt(classificationTarget, classificationDraft)}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent style={{ background: '#151527', border: '1px solid #ef444466' }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-5 w-5" />この論評を削除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.manuscriptLabel || '原稿ラベル未設定'}」の論評記録を削除します。この操作は元に戻せません。制作進捗へ追加済みのタスクは削除しません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-500">
              <Trash2 className="h-4 w-4" />{deleting ? '削除中…' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
