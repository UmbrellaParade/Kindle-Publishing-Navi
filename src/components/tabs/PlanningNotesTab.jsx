import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpenText,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  ClipboardList,
  Compass,
  Copy,
  CornerDownRight,
  Download,
  ExternalLink,
  FileUp,
  FileSearch,
  FileText,
  History,
  Lightbulb,
  Link2,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Scale,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { flushPendingSaves } from '@/lib/saveCoordinator';
import { mutatePublishingProject } from '@/lib/projectMutation';
import {
  copyPlanningInstructionText,
  getPlanningInstructionCopyText,
} from '@/lib/planningInstructionCopy';
import { buildPlanningChapterQuestionIndex } from '@/lib/planningChapterQuestions';
import { normalizePlanningViewSection } from '@/lib/viewResumeState';
import {
  PLANNING_NOTE_STATUSES,
  PLANNING_CHAPTER_NODE_TYPES,
  PLANNING_OUTLINE_SNAPSHOT_KINDS,
  PLANNING_NOTES_WARNING_BYTES,
  PLANNING_SOURCE_PRIORITIES,
  applyMarketResearchImport,
  assignDecisionCanonical,
  assignInstructionCanonical,
  buildPlanningNotesSharePackage,
  clearInstructionCanonical,
  createPlanningRecord,
  createPlanningChapterRecord,
  createPlanningOutlineSnapshot,
  deletePlanningRecord,
  duplicatePlanningRecord,
  estimatePlanningNotesBytes,
  filterPlanningNotes,
  findMarketResearchRestrictedData,
  findPlanningNotesSensitiveData,
  flattenPlanningChapterTree,
  flattenPlanningOutlineSnapshot,
  formatPlanningDateTimeJst,
  getPlanningMarketMetrics,
  getConfirmedPlanningOutline,
  getPlanningDraftOutlineChapters,
  getNextPlanningChapterOrder,
  getPlanningChapterNodeLabel,
  getPlanningChapterManuscript,
  getPlanningChapterParentOptions,
  isPlanningDraftChapter,
  movePlanningChapter,
  parsePlanningOutlineMarkdown,
  parseMarketResearchSummaryMarkdown,
  planningNotesShareToMarkdown,
  planningOutlineMatchesSnapshot,
  previewMarketResearchImport,
  readPlanningNotes,
  replacePlanningOutlineDraft,
  savePlanningMarketSummary,
  savePlanningConcept,
  serializePlanningNotes,
  sortPlanningRecordsNewest,
  sortPlanningOutlineSnapshotsNewest,
  upsertPlanningRecord,
  updatePlanningRecordChapterLinks,
  updatePlanningChapterManuscript,
  validatePlanningManuscriptUrl,
  withdrawPlanningDecision,
} from '@/lib/planningNotes';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_CLASS = 'min-h-11 w-full rounded-md border border-[#34345a] bg-[#101020] px-3 py-2 text-sm text-foreground outline-none transition focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/50 disabled:opacity-60';
const TEXTAREA_CLASS = `${INPUT_CLASS} min-h-28 resize-y leading-relaxed`;

const SECTION_META = {
  overview: { label: '概要', icon: BookOpenText },
  concept: { label: '企画メモ', icon: Lightbulb },
  competitors: { label: '競合・市場調査', icon: FileSearch },
  chapters: { label: '目次・章構成', icon: ClipboardList },
  interviews: { label: '取材記録', icon: MessageSquareText },
  instructionVersions: { label: '執筆設計・GPTs指示書', icon: FileText },
  decisions: { label: '意思決定・版履歴', icon: History },
};

const OUTLINE_VIEW_META = Object.freeze({
  draft: { label: '仮目次', description: '編集中', icon: Pencil },
  confirmed: { label: '確定目次', description: '現在使う目次', icon: ShieldCheck },
  history: { label: '過去の目次', description: '保存履歴', icon: History },
});

const FORM_FIELDS = {
  concept: [
    ['targetReader', '想定読者', 'textarea', '誰に向けた本かを、できるだけ具体的に書きます。'],
    ['readerProblems', '読者の悩み', 'textarea', '今、何に困っている読者なのかを残します。'],
    ['bookPromise', '本の約束', 'textarea', 'この本を読むと何が分かる／できるようになるかを書きます。'],
    ['theme', 'テーマ・何を伝える本か', 'textarea', '本の中心となるメッセージです。'],
    ['uniqueness', 'この本ならではの独自性', 'textarea', '本人の体験、視点、方法などを記録します。'],
    ['includeMarkdown', '入れる内容', 'textarea', '箇条書きやMarkdownで構いません。'],
    ['excludeMarkdown', '入れない内容', 'textarea', '今回の本では扱わない範囲を決めます。'],
  ],
  competitors: [
    ['competitorName', '競合名・サービス名', 'text'],
    ['bookTitle', '書名', 'text'],
    ['author', '著者', 'text'],
    ['url', '確認URL', 'url'],
    ['checkedOn', '確認日', 'date'],
    ['priceMemo', '価格メモ', 'textarea'],
    ['targetReader', '競合の対象読者', 'textarea'],
    ['mainPromise', '競合が約束していること', 'textarea'],
    ['strengths', '強み', 'textarea'],
    ['findings', 'レビュー等から分かったこと', 'textarea'],
    ['readerReactionGap', '読者反応から見える不足', 'textarea'],
    ['differentiation', 'こちらとの差別化', 'textarea'],
    ['assessmentStatus', '調査内容の状態', 'select', '未確認の内容を事実として断定しないため、根拠に合う状態を選びます。', { unset: '未設定', verified: '確認済み', hypothesis: '仮説', author_experience: '著者の実感' }],
    ['claimKind', '情報の区分', 'select', '', { fact: '事実', hypothesis: '仮説', mixed: '事実と仮説が混在' }],
    ['sourceQuoteNotes', '出典・引用の注意', 'textarea'],
    ['recheckStatus', '再確認状態', 'select', '', { needs_recheck: '要再確認', checked: '確認済み', not_required: '再確認不要' }],
  ],
  chapters: [
    ['title', 'タイトル（例：第一部、第一話）', 'text'],
    ['role', 'この構成項目の役割', 'textarea'],
    ['readerQuestion', '読者の疑問', 'textarea'],
    ['personalSources', '使う本人体験・取材', 'textarea'],
    ['evidenceNeeded', '必要な根拠', 'textarea'],
    ['outlineMarkdown', '章内構成', 'textarea', 'Markdown・箇条書きで構いません。'],
    ['readerNextStep', '読後の一歩', 'textarea'],
  ],
  interviews: [
    ['question', '今回の質問', 'textarea'],
    ['rawAnswer', '本人の原回答', 'textarea', '言い換えず、生の言葉を残します。初期状態は非公開です。'],
    ['publicAnswer', '匿名化した共有・公開用の文章', 'textarea', '生の回答をコピーせず、名前・場所・連絡先などを伏せた文章を別に作ります。共有用ファイルへ出すのはこちらだけです。'],
    ['anonymizationNotes', '匿名化・伏せる情報のメモ', 'textarea', '例：本名、勤務先、地名、第三者を特定できる出来事。共有用ファイルからは除外します。'],
    ['summary', '要約', 'textarea'],
    ['event', '出来事', 'textarea'],
    ['emotion', '感情', 'textarea'],
    ['decision', '判断', 'textarea'],
    ['failure', '失敗・うまくいかなかったこと', 'textarea'],
    ['numbers', '数字・実測', 'textarea'],
    ['sourceKind', '回答の区分', 'select', '', { fact: '確認できる事実', memory: '本人の記憶', opinion: '本人の意見', ai_inference: 'AIの推論' }],
    ['followUpQuestions', '追加で聞くこと', 'textarea'],
    ['visibility', '公開可否', 'select', '', { private: '非公開', share_candidate: '公開候補' }],
  ],
  instructionVersions: [
    ['name', '指示書名', 'text'],
    ['targetAi', '対象AI', 'text', '例：ChatGPT、Codex、Gemini'],
    ['role', '役割', 'select', '', { writing: '執筆', critique: '辛口論評', cover: '表紙', promotion: 'プロモーション', other: 'その他' }],
    ['audience', '最初に読む対象', 'select', '正本に指定する前に、Codex向け・著者向け・共通のどれかを選びます。', { unset: '対象未設定', codex: 'Codex', author: '著者', shared: 'Codex・著者共通' }],
    ['inputManuscriptLabel', '入力原稿版', 'text'],
    ['changeSummary', '前版からの変更概要', 'textarea'],
    ['markdown', '指示書本文（Markdown）', 'textarea', '貼り付けた指示は資料として保存するだけで、このアプリが命令として実行することはありません。'],
    ['nextHandoff', '次の受渡先', 'text'],
    ['externalFileLocation', '外部ファイルの所在メモ', 'text', '共有用書き出しからは除外します。認証情報は保存しないでください。'],
  ],
  decisions: [
    ['decision', '何を決めたか', 'textarea'],
    ['reason', '決めた理由', 'textarea'],
    ['decidedBy', '決裁者', 'text'],
    ['decidedAt', '決定日', 'date'],
    ['reconsiderWhen', '再確認する条件', 'textarea'],
    ['evidenceRefs', '根拠・参照資料', 'textarea'],
  ],
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value) {
  return String(value || 'kindle-planning-notes')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function recordTitle(section, record) {
  if (section === 'concept' || section === 'conceptHistory') return '企画メモ';
  if (section === 'competitors') return record.bookTitle || record.competitorName || '名称未設定の競合';
  if (section === 'chapters') return record.title || '無題の構成項目';
  if (section === 'interviews') return record.question || '質問未入力の取材';
  if (section === 'instructionVersions') return `${record.name || '無題の指示書'} v${record.versionNumber}`;
  return record.decision || '未入力の意思決定';
}

function chapterPathLabel(recordOrId, chapters, { includeSelf = true } = {}) {
  const chapterById = new Map(chapters.map(chapter => [chapter.id, chapter]));
  let current = typeof recordOrId === 'string' ? chapterById.get(recordOrId) : recordOrId;
  if (!current) return typeof recordOrId === 'string' ? recordOrId : '';
  const path = [];
  const visited = new Set();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.push(`${getPlanningChapterNodeLabel(current.nodeType)}：${current.title || '無題'}`);
    current = current.parentId ? chapterById.get(current.parentId) : null;
  }
  const ordered = path.reverse();
  if (!includeSelf) ordered.pop();
  return ordered.join(' › ');
}

function chapterReferenceLabel(recordOrId, allChapters, activeChapterIds) {
  const record = typeof recordOrId === 'string'
    ? allChapters.find(chapter => chapter.id === recordOrId)
    : recordOrId;
  if (!record) return '削除済みの構成項目';
  const path = chapterPathLabel(record, allChapters);
  return activeChapterIds.has(record.id) ? path : `旧目次：${path}`;
}

function ChapterReferenceSummary({ record, allChapters, activeChapterIds, className = '' }) {
  if (!record?.chapterIds?.length) return null;
  return (
    <p className={`break-words text-[11px] leading-relaxed text-neon-cyan/80 ${className}`}>
      紐づく構成：{record.chapterIds.map(id => chapterReferenceLabel(id, allChapters, activeChapterIds)).join('／')}
    </p>
  );
}

function planningOutlineRewritePrompt(chapterRows, concept) {
  const currentOutline = chapterRows.length > 0
    ? chapterRows.map(({ record, depth }) => (
      `${'#'.repeat(Math.min(depth + 1, 6))} ${getPlanningChapterNodeLabel(record.nodeType)}：${record.title || '無題'}`
    )).join('\n')
    : '（現在の仮目次は空です）';
  const conceptLines = [
    ['想定読者', concept?.targetReader],
    ['読者の悩み', concept?.readerProblems],
    ['本の約束', concept?.bookPromise],
    ['テーマ', concept?.theme],
  ].filter(([, value]) => String(value || '').trim())
    .map(([label, value]) => `${label}：${String(value).trim()}`);
  return [
    '以下はKindle本の現在の仮目次です。内容を踏まえ、目次全体を新しい案として書き直してください。',
    '既存項目の削除や承認解除はしません。新しい目次案だけを作ってください。',
    '出力は説明文を付けず、次のMarkdown形式だけにしてください。',
    '# 第一部　大きなまとまり',
    '## 第一話　部の中の話',
    '### 第一節　話の中の小見出し',
    '',
    ...(conceptLines.length > 0 ? ['【本の前提】', ...conceptLines, ''] : []),
    '【現在の仮目次】',
    currentOutline,
  ].join('\n');
}

function outlineRewriteHistoryMessage(summary) {
  const itemCount = Number(summary?.archivedChapterCount) || 0;
  if (itemCount === 0) return '前の目次は空だったため、履歴の追加はありません';
  if (summary?.snapshotCreated) return `前の目次 1版（${itemCount}項目）を履歴へ保存`;
  if (summary?.snapshotId) return `前の目次は保存済みの履歴に保持（${itemCount}項目）`;
  return `前の目次 ${itemCount}項目は旧目次として保持`;
}

function recordSummary(section, record) {
  const value = {
    competitors: record.findings || record.differentiation,
    chapters: record.role || record.readerQuestion,
    interviews: record.summary || record.rawAnswer,
    instructionVersions: record.changeSummary || record.markdown,
    decisions: record.reason,
  }[section] || '';
  return value.length > 180 ? `${value.slice(0, 180)}…` : value;
}

function StatusBadge({ status }) {
  const style = {
    draft: 'border-slate-400/30 bg-slate-400/10 text-slate-200',
    needs_confirmation: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    approved: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
    rejected: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  }[status] || 'border-white/20 text-muted-foreground';
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${style}`}>{PLANNING_NOTE_STATUSES[status] || status}</span>;
}

function MetaBadge({ icon: Icon, children, tone = 'muted' }) {
  const style = {
    first: 'border-neon-pink/45 bg-neon-pink/10 text-neon-pink',
    canonical: 'border-neon-cyan/45 bg-neon-cyan/10 text-neon-cyan',
    latest: 'border-amber-400/45 bg-amber-400/10 text-amber-200',
    current: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
    changed: 'border-slate-400/35 bg-slate-400/10 text-slate-200',
    withdrawn: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
    muted: 'border-white/15 bg-white/5 text-muted-foreground',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style}`}>
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

const MARKET_EVIDENCE_META = {
  verified: { label: '書誌確認済み', tone: 'current', icon: ShieldCheck },
  hypothesis: { label: '仮説', tone: 'latest', icon: FileSearch },
  author_experience: { label: '著者の実感', tone: 'canonical', icon: UserRound },
};

function MarketEvidenceBadge({ value }) {
  const meta = MARKET_EVIDENCE_META[value];
  if (!meta) return <MetaBadge>状態未設定</MetaBadge>;
  return <MetaBadge icon={meta.icon} tone={meta.tone}>{meta.label}</MetaBadge>;
}

const MARKET_CLAIM_META = {
  fact: { label: '事実記録', tone: 'current', icon: ShieldCheck },
  hypothesis: { label: '差別化は編集仮説', tone: 'latest', icon: FileSearch },
  mixed: { label: '事実・仮説を含む', tone: 'canonical', icon: FileSearch },
};

function MarketClaimBadge({ value }) {
  const meta = MARKET_CLAIM_META[value];
  if (!meta) return null;
  return <MetaBadge icon={meta.icon} tone={meta.tone}>{meta.label}</MetaBadge>;
}

function MarketRecheckBadge({ value }) {
  if (value !== 'needs_recheck') return null;
  return <MetaBadge icon={Clock3} tone="latest">レビュー観察は再確認待ち</MetaBadge>;
}

const REFERENCE_TARGET_LABELS = {
  codex: 'Codex',
  author: '著者',
  shared: '共通',
};

function ReferenceTargetBadge({ value }) {
  return <MetaBadge icon={UserRound}>対象：{REFERENCE_TARGET_LABELS[value] || '未設定'}</MetaBadge>;
}

function InstructionCopyButton({ record, onCopyInstruction, className = '', contextLabel = '' }) {
  const hasText = Boolean(getPlanningInstructionCopyText(record).trim());
  const displayName = record?.name || '無題の指示書';
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => onCopyInstruction(record)}
      aria-label={`${contextLabel ? `${contextLabel}の` : ''}「${displayName}」v${record?.versionNumber || 1}の質問文をコピー（指示書本文のみ）`}
      title={hasText ? '指示書本文だけをクリップボードへコピーします' : 'コピーする指示書本文がありません'}
      className={`min-h-11 border-neon-cyan/35 text-neon-cyan ${className}`}
    >
      <Copy className="h-4 w-4" aria-hidden="true" />質問文をコピー
    </Button>
  );
}

function RecordDetailDialog({ detail, chapters, activeChapterIds, copyFeedback, onCopyInstruction, onEditChapterLinks, onClose }) {
  const record = detail?.record;
  const section = detail?.section === 'conceptHistory' ? 'concept' : detail?.section;
  const fields = FORM_FIELDS[section] || [];
  const activeCopyFeedback = record
    && detail.section === 'instructionVersions'
    && copyFeedback?.recordId === record.id
    ? copyFeedback
    : null;
  return (
    <Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-3xl flex-col overflow-hidden p-0"
        style={{ background: '#151527', border: '1px solid #2a2a4a' }}
      >
        <DialogHeader className="border-b border-[#2a2a4a] px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-neon-cyan">
            <BookOpenText className="h-5 w-5" aria-hidden="true" />
            {record ? recordTitle(detail.section, record) : '保存内容'}
          </DialogTitle>
          <DialogDescription>保存済みの内容を読む画面です。ここでは変更しません。</DialogDescription>
        </DialogHeader>
        {record && (
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={record.status} />
              {detail.section === 'chapters' && (
                <span className="rounded-full border border-neon-pink/30 bg-neon-pink/5 px-2 py-0.5 text-xs font-black text-neon-pink">
                  {getPlanningChapterNodeLabel(record.nodeType)}
                </span>
              )}
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-muted-foreground">
                {PLANNING_SOURCE_PRIORITIES[record.sourcePriority] || '未設定'}
              </span>
              {detail.section === 'instructionVersions' && (
                <span className="text-[10px] text-muted-foreground">v{record.versionNumber} ／ 系列ID: {record.documentId}</span>
              )}
              {detail.section === 'competitors' && <MarketEvidenceBadge value={record.assessmentStatus} />}
              {detail.section === 'competitors' && <MarketClaimBadge value={record.claimKind} />}
              {detail.section === 'instructionVersions' && <>
                {record.firstReadFor.length > 0 && <MetaBadge icon={Star} tone="first">最初に見る</MetaBadge>}
                {record.canonicalFor.length > 0 && <MetaBadge icon={ShieldCheck} tone="canonical">正本</MetaBadge>}
                <ReferenceTargetBadge value={record.audience} />
                <MetaBadge tone={record.referenceStatus === 'active' ? 'current' : 'changed'}>{record.referenceStatus === 'active' ? '有効' : record.referenceStatus === 'old' ? '旧版' : '状態未設定'}</MetaBadge>
              </>}
              {detail.section === 'decisions' && <>
                {record.isFirstRead && <MetaBadge icon={Star} tone="first">最初に見る</MetaBadge>}
                {record.isCanonical && <MetaBadge icon={ShieldCheck} tone="canonical">正本</MetaBadge>}
                <MetaBadge tone={record.decisionState === 'current' ? 'current' : record.decisionState === 'withdrawn' ? 'withdrawn' : 'changed'}>
                  {record.decisionState === 'current' ? '現行' : record.decisionState === 'changed' ? '変更済み' : record.decisionState === 'withdrawn' ? '撤回' : '状態未設定'}
                </MetaBadge>
              </>}
            </div>
            {detail.section === 'chapters' && (
              <div className="rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 p-3">
                <p className="text-[10px] font-bold text-neon-cyan">入っている場所</p>
                <p className="mt-1 break-words text-sm text-foreground">
                  {chapterPathLabel(record, chapters, { includeSelf: false }) || '本全体の最上位'}
                </p>
              </div>
            )}
            {fields.map(([field, label, type, _help, options]) => {
              const rawValue = record[field];
              if (rawValue === '' || rawValue === undefined || rawValue === null) return null;
              const value = options?.[rawValue] || String(rawValue);
              return (
                <div key={field} className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                  <p className="text-[10px] font-bold text-neon-pink">{label}</p>
                  {type === 'url' && /^https?:\/\//i.test(value) ? (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-sm font-bold text-neon-cyan underline underline-offset-4">
                      {value}
                    </a>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{value}</p>
                  )}
                </div>
              );
            })}
            {record.chapterIds?.length > 0 && (
              <div className="rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 p-3">
                <p className="text-[10px] font-bold text-neon-cyan">紐づく部・章・話・節</p>
                <p className="mt-1 text-sm text-foreground">
                  {record.chapterIds.map(id => chapterReferenceLabel(id, chapters, activeChapterIds)).join('／')}
                </p>
              </div>
            )}
            <p className="break-all text-[10px] text-muted-foreground">ID: {record.id}</p>
          </div>
        )}
        {activeCopyFeedback && (
          <div
            key={activeCopyFeedback.sequence}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`mx-5 flex flex-shrink-0 items-start gap-2 rounded-lg border p-3 text-sm leading-relaxed ${activeCopyFeedback.tone === 'error'
              ? 'border-red-400/30 bg-red-400/10 text-red-100'
              : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'}`}
          >
            {activeCopyFeedback.tone === 'error'
              ? <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />}
            <span>{activeCopyFeedback.message}</span>
          </div>
        )}
        <DialogFooter className="flex-col gap-2 border-t border-[#2a2a4a] bg-[#121222] px-5 py-4 sm:flex-row sm:space-x-0">
          {record && detail.section === 'instructionVersions' && (
            <InstructionCopyButton record={record} onCopyInstruction={onCopyInstruction} className="w-full sm:w-auto" />
          )}
          {record && !['chapters', 'concept', 'conceptHistory'].includes(detail.section) && (
            <Button type="button" variant="outline" onClick={() => onEditChapterLinks(detail.section, record)} className="min-h-11 w-full border-neon-cyan/35 text-neon-cyan sm:w-auto"><Link2 className="h-4 w-4" aria-hidden="true" />目次との紐づけだけ変更</Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} className="min-h-11 w-full sm:w-auto">閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OutlineSnapshotDialog({ value, busy, onChange, onSave, onClose }) {
  const kindLabel = PLANNING_OUTLINE_SNAPSHOT_KINDS[value?.kind] || '目次';
  return (
    <Dialog open={Boolean(value)} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-xl" style={{ background: '#151527', border: '1px solid #2a2a4a' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-neon-cyan">
            {value?.kind === 'confirmed' ? <ShieldCheck className="h-5 w-5" aria-hidden="true" /> : <History className="h-5 w-5" aria-hidden="true" />}
            {value?.kind === 'confirmed' ? 'この仮目次を確定目次にする' : '今の仮目次を履歴に保存'}
          </DialogTitle>
          <DialogDescription>
            {value?.kind === 'confirmed'
              ? '今の階層を読み取り専用の確定目次として保存します。仮目次と過去の目次は消えません。'
              : 'あとで見返せる読み取り専用の保存版を作ります。現在の仮目次はそのまま編集できます。'}
          </DialogDescription>
        </DialogHeader>
        {value && <div className="space-y-4">
          <div className="rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <p><span className="font-bold text-foreground">現在採用中の内容：</span>{value.chapterCount}件の部・章・話・節</p>
            <p className="mt-1"><span className="font-bold text-foreground">履歴として残るもの：</span>「採用しない」にした項目も含む、今の目次全体</p>
            <p className="mt-1"><span className="font-bold text-foreground">消えるもの：</span>ありません</p>
            {value.kind === 'confirmed' && <p className="mt-1"><span className="font-bold text-foreground">変わるもの：</span>「現在使う確定目次」の指定だけです。前の確定目次は履歴へ残ります。</p>}
          </div>
          <label className="block space-y-1 text-sm font-bold text-foreground">
            <span>版の名前（空欄でもOK）</span>
            <input
              value={value.label}
              onChange={event => onChange({ ...value, label: event.target.value })}
              className={INPUT_CLASS}
              maxLength={200}
              placeholder={kindLabel}
            />
          </label>
          <label className="block space-y-1 text-sm font-bold text-foreground">
            <span>変更メモ（任意）</span>
            <textarea
              value={value.note}
              onChange={event => onChange({ ...value, note: event.target.value })}
              className={TEXTAREA_CLASS}
              placeholder="例：第二部を追加し、第一話と第二話の順番を見直した"
            />
          </label>
          <p className="text-xs leading-relaxed text-amber-200">
            各項目の「本人承認済み」は内容確認です。ここで作る「確定目次」は、本全体で現在使う目次の保存版です。
          </p>
        </div>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="min-h-11">キャンセル</Button>
          <Button type="button" onClick={onSave} disabled={busy} className="min-h-11 bg-neon-cyan/20 text-neon-cyan">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {value?.kind === 'confirmed' ? '確定目次として保存' : '履歴に保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function flattenOutlineProposal(chapters = []) {
  const childrenByParent = new Map();
  for (const chapter of chapters) {
    const rows = childrenByParent.get(chapter.parentId || '') || [];
    rows.push(chapter);
    childrenByParent.set(chapter.parentId || '', rows);
  }
  for (const rows of childrenByParent.values()) {
    rows.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  }
  const result = [];
  const visited = new Set();
  const visit = (record, depth) => {
    if (!record || visited.has(record.id)) return;
    visited.add(record.id);
    result.push({ record, depth });
    for (const child of childrenByParent.get(record.id) || []) visit(child, depth + 1);
  };
  for (const root of childrenByParent.get('') || []) visit(root, 0);
  for (const record of chapters) visit(record, 0);
  return result;
}

function OutlineRewriteDialog({
  value,
  busy,
  onChange,
  onNext,
  onApply,
  onCopyPrompt,
  onClose,
}) {
  const cancelButtonRef = useRef(null);
  const previewRows = useMemo(
    () => flattenOutlineProposal(value?.preview?.proposedChapters || []),
    [value?.preview],
  );
  const step = value?.step || 1;
  const mode = value?.mode || 'paste';
  const stepLabels = ['方法を選ぶ', '新しい目次を用意', '安全確認'];

  return (
    <Dialog open={Boolean(value)} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-3xl flex-col overflow-hidden p-0"
        style={{ background: '#151527', border: '1px solid #2a2a4a' }}
        onOpenAutoFocus={event => {
          event.preventDefault();
          cancelButtonRef.current?.focus();
        }}
      >
        <DialogHeader className="border-b border-[#2a2a4a] px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-neon-cyan">
            <Pencil className="h-5 w-5" aria-hidden="true" />
            目次をまとめて書き直す
          </DialogTitle>
          <DialogDescription>
            1件ずつ削除しなくて大丈夫です。今の目次と取材を残したまま、新しい仮目次へ安全に切り替えます。
          </DialogDescription>
          <ol aria-label="目次を書き直す手順" className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-bold">
            {stepLabels.map((label, index) => {
              const number = index + 1;
              const active = step === number;
              const completed = step > number;
              return (
                <li
                  key={label}
                  aria-current={active ? 'step' : undefined}
                  className={`rounded-md border px-2 py-2 text-center ${active ? 'border-neon-cyan/55 bg-neon-cyan/10 text-neon-cyan' : completed ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-200' : 'border-white/10 text-muted-foreground'}`}
                >
                  <span className="block">{completed ? '完了' : `STEP ${number}`}</span>
                  <span className="mt-0.5 block">{label}</span>
                </li>
              );
            })}
          </ol>
        </DialogHeader>

        {value && <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {step === 1 && <>
            <fieldset className="space-y-3">
              <legend className="text-sm font-black text-foreground">書き直し方を選んでください</legend>
              <label className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 ${mode === 'paste' ? 'border-neon-cyan/55 bg-neon-cyan/10' : 'border-white/10 bg-black/10'}`}>
                <input
                  type="radio"
                  name="outline-rewrite-mode"
                  value="paste"
                  checked={mode === 'paste'}
                  onChange={() => onChange({ ...value, mode: 'paste', preview: null, error: '' })}
                  className="mt-1 h-4 w-4 accent-cyan-400"
                />
                <span className="min-w-0">
                  <span className="block font-black text-neon-cyan">Codexの目次案を貼り付ける（おすすめ）</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">CodexやChatGPTが作ったMarkdownを貼ると、部・章・話・節の階層を確認してから反映できます。</span>
                </span>
              </label>
              <label className={`flex min-h-14 items-start gap-3 rounded-xl border p-4 ${value.currentCount === 0 ? 'cursor-not-allowed border-white/10 bg-black/10 opacity-55' : mode === 'blank' ? 'cursor-pointer border-neon-pink/55 bg-neon-pink/10' : 'cursor-pointer border-white/10 bg-black/10'}`}>
                <input
                  type="radio"
                  name="outline-rewrite-mode"
                  value="blank"
                  checked={mode === 'blank'}
                  disabled={value.currentCount === 0}
                  onChange={() => onChange({ ...value, mode: 'blank', preview: null, error: '' })}
                  className="mt-1 h-4 w-4 accent-pink-400"
                />
                <span className="min-w-0">
                  <span className="block font-black text-neon-pink">空の仮目次から始める</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{value.currentCount === 0 ? '仮目次はすでに空です。Codexの案を貼るか、ダイアログを閉じて部・章を追加してください。' : '今の仮目次を履歴へ残し、新しい仮目次だけを空にします。あとから1件ずつ追加できます。'}</span>
                </span>
              </label>
            </fieldset>

            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="font-black text-emerald-200">どちらを選んでも、次の内容は消えません</p>
              <p className="mt-2">本人承認済みの項目・取材の質問と回答・競合調査・執筆指示書・現在の確定目次・過去の目次はすべて残ります。</p>
            </div>

            <Button type="button" variant="outline" onClick={onCopyPrompt} className="min-h-11 w-full gap-2 border-neon-cyan/35 text-neon-cyan sm:w-auto">
              <Copy className="h-4 w-4" aria-hidden="true" />Codexへの相談文をコピー
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">現在の目次と、貼り付けに使える出力形式をまとめてコピーします。Codexには「削除」ではなく「新しい目次案の作成」を頼めます。</p>
          </>}

          {step === 2 && mode === 'paste' && <>
            <label className="block space-y-2 text-sm font-black text-foreground">
              <span>Codexが作った新しい目次を貼り付ける</span>
              <span className="block text-xs font-normal leading-relaxed text-muted-foreground">貼り付けただけでは保存されません。次の画面で階層を確認してから切り替えます。</span>
              <textarea
                value={value.markdown}
                onChange={event => onChange({ ...value, markdown: event.target.value, preview: null, error: '' })}
                className={`${TEXTAREA_CLASS} min-h-64 font-mono text-xs`}
                placeholder={'# 第一部　息をしているだけで精いっぱいだった\n## 第一話　朝が来るのが怖かった\n### 第一節　布団から出られない朝'}
                aria-describedby={`outline-rewrite-format-help${value.error ? ' outline-rewrite-error' : ''}`}
              />
            </label>
            <div id="outline-rewrite-format-help" className="rounded-lg border border-white/10 bg-black/10 p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="font-bold text-foreground">貼り付け形式の例</p>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-neon-cyan">{'# 第一部　大きなまとまり\n## 第一話　部の中の話\n### 第一節　話の中の小見出し'}</pre>
              <p className="mt-2">「第1章」「第一話」などの文字から種類を判別します。判別できない行は勝手に保存せず、確認メッセージを表示します。</p>
            </div>
            {value.error && (
              <div id="outline-rewrite-error" role="alert" className="flex gap-2 rounded-lg border border-rose-400/40 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>{value.error}</span>
              </div>
            )}
          </>}

          {step === 2 && mode === 'blank' && (
            <div className="rounded-xl border border-neon-pink/30 bg-neon-pink/5 p-5">
              <h3 className="font-black text-neon-pink">新しい仮目次を空にします</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">今の仮目次は自動で「過去の目次」へ保存されます。空にしたあとも、履歴を見ながら新しい部・章・話・節を追加できます。</p>
            </div>
          )}

          {step === 3 && <>
            <div className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/5 p-4">
              <h3 className="font-black text-neon-cyan">新しい仮目次のプレビュー</h3>
              {previewRows.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-white/15 p-4 text-center text-sm text-muted-foreground">空の仮目次から始めます。</p>
              ) : <>
                <p className="mt-2 text-xs text-muted-foreground">
                  部 {value.preview?.counts?.part || 0}・章 {value.preview?.counts?.chapter || 0}・話 {value.preview?.counts?.episode || 0}・節 {value.preview?.counts?.section || 0}
                </p>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1" aria-label="新しい仮目次の階層プレビュー">
                  {previewRows.map(({ record, depth }) => (
                    <div
                      key={record.id}
                      className="rounded-lg border border-white/10 bg-black/10 px-3 py-2"
                      style={{ marginLeft: `${Math.min(depth, 3) * 8}px` }}
                    >
                      <span className="mr-2 inline-block rounded-full border border-neon-pink/30 px-2 py-0.5 text-[10px] font-black text-neon-pink">{getPlanningChapterNodeLabel(record.nodeType)}</span>
                      <span className="break-words text-sm font-bold text-foreground">{record.title || '無題'}</span>
                    </div>
                  ))}
                </div>
              </>}
              {(value.preview?.warnings || []).length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-amber-200">
                  {value.preview.warnings.map(warning => <li key={warning}>・{warning}</li>)}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 text-xs leading-relaxed text-muted-foreground">
              <h3 className="font-black text-emerald-200">切り替える前の安全確認</h3>
              <p className="mt-2"><span className="font-bold text-foreground">履歴へ残るもの：</span>現在の仮目次 {value.currentCount}件</p>
              <p className="mt-1"><span className="font-bold text-foreground">そのまま残るもの：</span>本人承認済み {value.approvedCount}件、取材などの紐づく記録 {value.linkedRecordCount}件、現在の確定目次、過去の履歴</p>
              <p className="mt-1"><span className="font-bold text-foreground">消えるもの：</span>ありません</p>
              <p className="mt-1"><span className="font-bold text-foreground">変わるもの：</span>編集中の仮目次だけです。確定目次は自動では変わりません。</p>
              {value.linkedRecordCount > 0 && <p className="mt-2 rounded-md border border-amber-400/25 bg-amber-400/5 p-2 text-amber-100">取材などの紐づけは「旧目次：〇〇」として残ります。新しい目次が固まってから、必要なものだけ付け直せます。</p>}
            </div>
          </>}

          <p className="sr-only" aria-live="polite">手順 {step}／3：{stepLabels[step - 1]}</p>
        </div>}

        <DialogFooter className="border-t border-[#2a2a4a] px-5 py-4 sm:justify-between">
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button ref={cancelButtonRef} type="button" variant="outline" onClick={onClose} disabled={busy} className="min-h-11">キャンセル</Button>
            {step > 1 && <Button type="button" variant="outline" onClick={() => onChange({ ...value, step: step - 1, error: '' })} disabled={busy} className="min-h-11">戻る</Button>}
          </div>
          {step < 3 ? (
            <Button type="button" onClick={onNext} disabled={busy || (step === 2 && mode === 'paste' && !value.markdown.trim())} className="min-h-11 bg-neon-cyan/20 text-neon-cyan">
              {step === 1 ? '次へ' : '解析して安全確認へ'}
            </Button>
          ) : (
            <Button type="button" onClick={onApply} disabled={busy} className="min-h-11 bg-emerald-400/15 text-emerald-200">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              {mode === 'blank' ? '仮目次を空にして始める' : '新しい仮目次へ切り替える'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sameStringSet(left = [], right = []) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every(value => rightSet.has(value));
}

function ChapterLinkDialog({
  value,
  chapterRows,
  allChapters,
  activeChapterIds,
  busy,
  onChange,
  onSave,
  onClose,
}) {
  const cancelButtonRef = useRef(null);
  const archivedSelected = useMemo(() => (
    (value?.chapterIds || [])
      .filter(chapterId => !activeChapterIds.has(chapterId))
      .map(chapterId => allChapters.find(chapter => chapter.id === chapterId))
      .filter(Boolean)
  ), [activeChapterIds, allChapters, value?.chapterIds]);
  const dirty = value ? !sameStringSet(value.initialChapterIds, value.chapterIds) : false;
  const toggleChapter = (chapterId, checked) => onChange({
    ...value,
    chapterIds: checked
      ? [...new Set([...(value.chapterIds || []), chapterId])]
      : (value.chapterIds || []).filter(id => id !== chapterId),
  });

  return (
    <Dialog open={Boolean(value)} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-2xl flex-col overflow-hidden p-0"
        style={{ background: '#151527', border: '1px solid #2a2a4a' }}
        onOpenAutoFocus={event => {
          event.preventDefault();
          cancelButtonRef.current?.focus();
        }}
      >
        <DialogHeader className="border-b border-[#2a2a4a] px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-neon-cyan"><Link2 className="h-5 w-5" aria-hidden="true" />目次との紐づけだけ変更</DialogTitle>
          <DialogDescription>{value?.title || 'この記録'}を、新しい仮目次のどこで使うか選び直します。</DialogDescription>
        </DialogHeader>
        {value && <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-black text-emerald-200">本文や承認状態は変わりません</p>
            <p className="mt-1">本人承認済みの取材でも、質問・原回答・要約・公開範囲を変更せず、目次との紐づけだけ安全に付け直せます。</p>
          </div>

          <fieldset>
            <legend className="text-sm font-black text-foreground">現在の仮目次</legend>
            {chapterRows.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-white/15 p-4 text-center text-xs text-muted-foreground">新しい仮目次は空です。先に部・章・話・節を追加すると紐づけられます。</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {chapterRows.map(({ record: chapter, depth }) => {
                  const checked = value.chapterIds.includes(chapter.id);
                  return (
                    <label key={chapter.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[#34345a] px-3 py-2 text-xs">
                      <input type="checkbox" checked={checked} onChange={event => toggleChapter(chapter.id, event.target.checked)} className="h-4 w-4 accent-cyan-400" />
                      <span className="min-w-0 break-words">{'› '.repeat(Math.min(depth, 3))}{getPlanningChapterNodeLabel(chapter.nodeType)}：{chapter.title || '無題'}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          {archivedSelected.length > 0 && (
            <fieldset className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
              <legend className="px-1 text-sm font-black text-amber-200">旧目次との紐づけ（現在残っているもの）</legend>
              <p className="text-[11px] leading-relaxed text-muted-foreground">チェックを外すまでは参照として残ります。新しい目次への付け直しと同時に外せます。</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {archivedSelected.map(chapter => (
                  <label key={chapter.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-amber-400/25 px-3 py-2 text-xs">
                    <input type="checkbox" checked onChange={event => toggleChapter(chapter.id, event.target.checked)} className="h-4 w-4 accent-amber-400" />
                    <span className="min-w-0 break-words">{chapterReferenceLabel(chapter, allChapters, activeChapterIds)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>}
        <DialogFooter className="border-t border-[#2a2a4a] px-5 py-4">
          <Button ref={cancelButtonRef} type="button" variant="outline" onClick={onClose} disabled={busy} className="min-h-11">キャンセル</Button>
          <Button type="button" onClick={onSave} disabled={busy || !dirty} className="min-h-11 bg-neon-cyan/20 text-neon-cyan">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            紐づけだけ保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChapterManuscriptControls({ record, manuscript, busy, onToggleComplete, onEditLink }) {
  const completed = Boolean(manuscript?.completed);
  const documentUrl = String(manuscript?.documentUrl || '');
  const title = record.title || '無題';
  const typeLabel = getPlanningChapterNodeLabel(record.nodeType);
  const itemLabel = `${typeLabel}「${title}」`;
  return (
    <div role="group" aria-label={`${itemLabel}の原稿管理`} className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold transition ${completed ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200' : 'border-white/15 bg-black/10 text-muted-foreground'} ${busy ? 'cursor-not-allowed opacity-60' : 'hover:border-neon-cyan/40'}`}>
        <input
          type="checkbox"
          checked={completed}
          disabled={busy}
          onChange={event => onToggleComplete(record, event.target.checked)}
          aria-label={`${itemLabel}の原稿を書き終えた`}
          className="h-4 w-4 accent-emerald-400"
        />
        {completed ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" /> : <Clock3 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
        <span>{completed ? '原稿：完成' : '原稿：未完成'}</span>
      </label>

      <div className="flex flex-wrap gap-2">
        {documentUrl && (
          <Button asChild size="sm" variant="outline" className="min-h-11 flex-1 border-neon-cyan/35 text-neon-cyan sm:flex-none">
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${itemLabel}の原稿リンクを開く（新しいタブ）`}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />原稿を開く
            </a>
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={event => onEditLink(record, event)}
          disabled={busy}
          className="min-h-11 flex-1 border-white/15 text-foreground sm:flex-none"
          aria-label={`${itemLabel}の原稿URLを${documentUrl ? '変更' : '設定'}`}
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />{documentUrl ? 'リンクを変更' : '原稿リンクを設定'}
        </Button>
      </div>
    </div>
  );
}

function outlineCardBodyId(cardKey) {
  return `planning-outline-card-body-${cardKey.replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

function OutlineCardCollapseButton({ cardKey, collapsed, itemLabel, onToggle }) {
  const controlsId = outlineCardBodyId(cardKey);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => onToggle(cardKey)}
      className="min-h-11 shrink-0 border-white/15 text-foreground"
      aria-expanded={!collapsed}
      aria-controls={controlsId}
      aria-label={`${itemLabel}の詳細を${collapsed ? '開く' : '折りたたむ'}`}
    >
      {collapsed
        ? <ChevronRight className="h-4 w-4" aria-hidden="true" />
        : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      {collapsed ? '詳細を開く' : '詳細を折りたたむ'}
    </Button>
  );
}

function OutlineCardSummaryBadges({ manuscript, showManuscript = false, questionCount = 0, childCount = 0 }) {
  const completed = Boolean(manuscript?.completed);
  const hasDocumentLink = Boolean(manuscript?.documentUrl);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
      {showManuscript && (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${completed ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200' : 'border-white/15 bg-black/10 text-muted-foreground'}`}>
          {completed
            ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}
          原稿：{completed ? '完成' : '未完成'}
        </span>
      )}
      {showManuscript && hasDocumentLink && (
        <span className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/5 px-2 py-1 text-neon-cyan">
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />原稿リンクあり
        </span>
      )}
      {questionCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full border border-neon-pink/30 bg-neon-pink/5 px-2 py-1 text-neon-pink">
          <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />質問 {questionCount}件
        </span>
      )}
      {childCount > 0 && (
        <span className="rounded-full border border-white/15 bg-black/10 px-2 py-1 text-muted-foreground">
          中の項目 {childCount}件
        </span>
      )}
    </div>
  );
}

function ChapterWritingQuestions({
  record,
  questions = [],
  currentConfirmed = false,
  onCopyInstruction,
  onOpenDetail,
  onAddQuestion,
  addQuestionUnavailableMessage = '',
}) {
  const typeLabel = getPlanningChapterNodeLabel(record.nodeType);
  const title = record.title || '無題';
  const itemLabel = `${typeLabel}「${title}」`;
  return (
    <section aria-label={`${itemLabel}の原稿を作る質問`} className="mt-3 border-t border-white/10 pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 text-xs font-black text-neon-pink">
            <MessageSquareText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {currentConfirmed ? `現在この${typeLabel}に紐づく質問` : `この${typeLabel}の原稿を作る質問`}
          </h4>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            質問文だけをコピーして、新しいChatGPTなどへ貼り付けられます。
          </p>
        </div>
        {onAddQuestion && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onAddQuestion(record)}
            className="min-h-11 shrink-0 border-neon-pink/35 text-neon-pink"
            aria-label={`${itemLabel}の原稿を作る質問を追加`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />質問を追加
          </Button>
        )}
      </div>

      {!onAddQuestion && addQuestionUnavailableMessage && (
        <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-100">
          {addQuestionUnavailableMessage}
        </p>
      )}

      {questions.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-white/15 bg-black/10 px-3 py-2 text-xs text-muted-foreground">
          この項目に紐づく執筆用の質問はまだありません。
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {questions.map(question => {
            const preview = getPlanningInstructionCopyText(question).trim();
            return (
              <article key={question.id} className="rounded-lg border border-neon-pink/20 bg-neon-pink/[0.035] p-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {question.firstReadFor.length > 0 && <MetaBadge icon={Star} tone="first">最初に見る</MetaBadge>}
                      {question.canonicalFor.length > 0 && <MetaBadge icon={ShieldCheck} tone="canonical">正本</MetaBadge>}
                      <span className="text-[10px] font-bold text-neon-cyan">v{question.versionNumber}</span>
                    </div>
                    <p className="mt-1 break-words text-sm font-bold text-foreground">{question.name || '無題の質問'}</p>
                    {preview ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                        {preview.slice(0, 180)}{preview.length > 180 ? '…' : ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-amber-200">質問本文はまだありません。</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
                    <InstructionCopyButton record={question} onCopyInstruction={onCopyInstruction} className="w-full lg:w-auto" contextLabel={itemLabel} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenDetail(question)}
                      className="min-h-11 w-full border-white/15 text-foreground lg:w-auto"
                      aria-label={`${itemLabel}の「${question.name || '無題の質問'}」v${question.versionNumber}の内容を見る`}
                    >
                      <BookOpenText className="h-4 w-4" aria-hidden="true" />内容を見る
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ManuscriptLinkDialog({ value, busy, returnFocusRef, onChange, onSave, onClose }) {
  const inputRef = useRef(null);
  const originalUrl = String(value?.originalDocumentUrl || '');
  const nextUrl = String(value?.documentUrl || '');
  const willDelete = Boolean(originalUrl) && !nextUrl.trim();
  const isDirty = nextUrl.trim() !== originalUrl;
  return (
    <Dialog open={Boolean(value)} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto"
        style={{ background: '#151527', border: '1px solid #2a2a4a' }}
        onOpenAutoFocus={event => {
          event.preventDefault();
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          window.requestAnimationFrame(() => returnFocusRef.current?.focus());
        }}
      >
        <form noValidate onSubmit={event => { event.preventDefault(); onSave(); }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-neon-cyan"><Link2 className="h-5 w-5" aria-hidden="true" />原稿の保存先リンク</DialogTitle>
            <DialogDescription className="leading-relaxed">
              {value ? `${getPlanningChapterNodeLabel(value.nodeType)}「${value.title || '無題'}」` : 'この項目'}の原稿を置いている場所へのリンクを設定します。目次本文や承認状態は変わりません。
            </DialogDescription>
          </DialogHeader>

          {value && <div className="mt-4 space-y-3">
            <div id="planning-manuscript-a5-help" className="rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3 text-xs leading-relaxed text-cyan-50">
              <div className="flex items-start gap-2">
                <BookOpenText className="mt-0.5 h-4 w-4 flex-shrink-0 text-neon-cyan" aria-hidden="true" />
                <p><span className="font-bold text-neon-cyan">Googleドキュメントを使う場合の執筆用目安</span><br />［ファイル］→［ページ設定］で「ページ形式」・A5にしておくと、紙面量の目安をつかみやすくなります。これはKDP電子書籍の指定ではありません。通常のKindle電子書籍は端末や文字設定に合わせて表示が組み直されるため、A5固定表示にはなりません。電子版はKindle Previewerで確認し、A5判の紙版は入稿先の判型・余白・裁ち落とし仕様へ別途調整してください。</p>
              </div>
            </div>
            <label htmlFor="planning-manuscript-document-url" className="block text-xs font-bold text-foreground">原稿URL（HTTPS）</label>
            <input
              ref={inputRef}
              id="planning-manuscript-document-url"
              type="url"
              inputMode="url"
              value={nextUrl}
              onChange={event => onChange({ ...value, documentUrl: event.target.value, error: '' })}
              placeholder="https://..."
              aria-invalid={Boolean(value.error)}
              aria-describedby="planning-manuscript-a5-help planning-manuscript-document-help planning-manuscript-document-error"
              className={INPUT_CLASS}
            />
            <p id="planning-manuscript-document-help" className="text-xs leading-relaxed text-muted-foreground">
              Googleドキュメント、Notion、OneDrive、Dropboxなど、原稿を置いているサービスの共有URLを貼り付けます。閲覧できる相手は保存先サービス側でも確認してください。このURLは完全バックアップには含まれますが、共有用JSON／Markdownには含めません。
            </p>
            {willDelete && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100">
                空欄で保存すると、この原稿リンクだけを削除します。原稿完成チェックや目次本文は残ります。
              </p>
            )}
            <p id="planning-manuscript-document-error" role={value.error ? 'alert' : undefined} className="min-h-5 text-xs text-red-300">{value.error || ''}</p>
          </div>}

          <DialogFooter className="mt-4 flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="min-h-11">キャンセル</Button>
            <Button type="submit" disabled={busy || !isDirty} className={`min-h-11 ${willDelete ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30' : 'bg-neon-pink/20 text-neon-pink hover:bg-neon-pink/30'}`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : willDelete ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {willDelete ? 'リンクを削除' : 'リンクを保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OutlineSnapshotTree({
  snapshot,
  collapseScope,
  collapsedCardKeys,
  onToggleCard,
  current = false,
  includeRejected = false,
  busy = false,
  getManuscript,
  getQuestions,
  onToggleManuscriptComplete,
  onEditManuscriptLink,
  onCopyQuestion,
  onOpenQuestion,
  onAddQuestion,
  canAddQuestion,
}) {
  if (!snapshot) return null;
  const rows = flattenPlanningOutlineSnapshot(snapshot, { includeRejected });
  const visibleRecords = rows.filter(({ record }) => includeRejected || record.status !== 'rejected');
  const counts = visibleRecords.reduce((result, { record }) => ({
    ...result,
    [record.nodeType]: (result[record.nodeType] || 0) + 1,
  }), {});
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MetaBadge icon={snapshot.kind === 'confirmed' ? ShieldCheck : History} tone={current ? 'canonical' : 'latest'}>
          {current ? '現在使う確定目次' : PLANNING_OUTLINE_SNAPSHOT_KINDS[snapshot.kind]}
        </MetaBadge>
        <span className="text-sm font-black text-foreground">{snapshot.label}</span>
        <span className="text-[11px] text-muted-foreground">保存日時：{formatPlanningDateTimeJst(snapshot.createdAt)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        部 {counts.part || 0}・章 {counts.chapter || 0}・話 {counts.episode || 0}・節 {counts.section || 0}
      </p>
      {snapshot.note && <p className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/10 p-3 text-sm leading-relaxed text-foreground">{snapshot.note}</p>}
      {visibleRecords.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 p-4 text-center text-sm text-muted-foreground">表示する構成項目はありません。</p>
      ) : (
        <div className="space-y-2">
          {visibleRecords.map(({ record, depth }) => {
            const questions = getQuestions?.(record.id) || [];
            const hasChildren = visibleRecords.some(({ record: child }) => child.parentId === record.id);
            const childCount = visibleRecords.filter(({ record: child }) => child.parentId === record.id).length;
            const manuscript = current && getManuscript ? getManuscript(record.id) : undefined;
            const itemLabel = `${getPlanningChapterNodeLabel(record.nodeType)}「${record.title || '無題'}」`;
            const cardKey = `${collapseScope || `history:${snapshot.id}`}:${record.id}`;
            const collapsed = collapsedCardKeys?.has(cardKey) || false;
            return (
              <article
                key={record.id}
                className="rounded-lg border border-white/10 bg-white/[0.025] p-3"
                style={{ marginLeft: `${Math.min(depth, 3) * 8}px` }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-neon-pink/30 bg-neon-pink/5 px-2 py-0.5 text-xs font-black text-neon-pink">
                        {getPlanningChapterNodeLabel(record.nodeType)}
                      </span>
                      <span className="break-words font-bold text-foreground">{record.title || '無題'}</span>
                      {record.status === 'rejected' && <span className="text-xs font-black text-rose-200">採用しない（履歴）</span>}
                    </div>
                    <OutlineCardSummaryBadges
                      manuscript={manuscript}
                      showManuscript={current}
                      questionCount={current ? questions.length : 0}
                      childCount={childCount}
                    />
                  </div>
                  <OutlineCardCollapseButton
                    cardKey={cardKey}
                    collapsed={collapsed}
                    itemLabel={itemLabel}
                    onToggle={onToggleCard}
                  />
                </div>
                <div id={outlineCardBodyId(cardKey)} hidden={collapsed}>
                  {record.role && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{record.role}</p>}
                  {current && getQuestions && onCopyQuestion && onOpenQuestion && (questions.length > 0 || !hasChildren) && (
                    <ChapterWritingQuestions
                      record={record}
                      questions={questions}
                      currentConfirmed
                      onCopyInstruction={onCopyQuestion}
                      onOpenDetail={onOpenQuestion}
                      onAddQuestion={canAddQuestion?.(record.id) ? onAddQuestion : undefined}
                      addQuestionUnavailableMessage={canAddQuestion?.(record.id) ? '' : 'この項目は以前の確定目次にだけ残っています。仮目次の項目へ質問を紐づけ直してから追加してください。'}
                    />
                  )}
                  {current && getManuscript && onToggleManuscriptComplete && onEditManuscriptLink && (
                    <ChapterManuscriptControls
                      record={record}
                      manuscript={manuscript}
                      busy={busy}
                      onToggleComplete={onToggleManuscriptComplete}
                      onEditLink={onEditManuscriptLink}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditorDialog({ editor, planningData, chapters, allChapters, activeChapterIds, busy, onChange, onSave, onClose }) {
  const draft = editor?.draft;
  const section = editor?.section;
  const fields = FORM_FIELDS[section] || [];
  const dirty = Boolean(editor?.dirty);
  const chapterParentOptions = section === 'chapters' && planningData && draft
    ? getPlanningChapterParentOptions(planningData, draft.id, draft.nodeType)
      .filter(({ record }) => record.status !== 'approved' && record.status !== 'rejected')
    : [];
  const currentChapterHasChildren = section === 'chapters' && draft
    ? chapters.some(chapter => chapter.parentId === draft.id)
    : false;
  const chapterRows = useMemo(
    () => planningData ? flattenPlanningChapterTree(planningData) : [],
    [planningData],
  );
  const archivedLinkedChapters = useMemo(() => (
    (draft?.chapterIds || [])
      .filter(chapterId => !activeChapterIds.has(chapterId))
      .map(chapterId => allChapters.find(chapter => chapter.id === chapterId))
      .filter(Boolean)
  ), [activeChapterIds, allChapters, draft?.chapterIds]);

  const requestClose = () => {
    if (dirty && !globalThis.window.confirm('まだ保存していない入力があります。閉じてもよいですか？')) return;
    onClose();
  };

  const update = (field, value) => onChange({ ...draft, [field]: value });
  return (
    <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-3xl flex-col overflow-hidden p-0"
        style={{ background: '#151527', border: '1px solid #2a2a4a' }}
      >
        <DialogHeader className="border-b border-[#2a2a4a] px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-neon-cyan">
            <Pencil className="h-5 w-5" aria-hidden="true" />
            {editor?.title}
          </DialogTitle>
          <DialogDescription>
            必須のものから少しずつで大丈夫です。保存するまで既存データは変わりません。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {editor?.externalConflict && (
            <div className="flex gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              別の画面でこの項目が更新されました。保存は停止されます。入力内容を控えてから最新表示を確認してください。
            </div>
          )}

          {section === 'instructionVersions' && (
            <div className="rounded-lg border border-neon-pink/25 bg-neon-pink/5 p-3 text-xs leading-relaxed text-muted-foreground">
              版ID：<span className="text-foreground">{draft?.id}</span> ／ 文書系列：<span className="text-foreground">{draft?.documentId}</span> ／ v{draft?.versionNumber}
            </div>
          )}

          {section === 'chapters' && (
            <fieldset className="rounded-lg border border-neon-cyan/20 bg-neon-cyan/[0.03] p-3">
              <legend className="px-1 text-xs font-black text-neon-cyan">目次の階層</legend>
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                「部」の中に「章」や「話」、その中に「節」を入れられます。既存の章は最上位のまま維持されます。
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-bold text-foreground">
                  <span>項目の種類</span>
                  <select
                    value={draft?.nodeType || 'chapter'}
                    onChange={event => {
                      const nodeType = event.target.value;
                      const allowedParentIds = new Set(
                        getPlanningChapterParentOptions(planningData, draft.id, nodeType)
                          .filter(({ record }) => record.status !== 'approved' && record.status !== 'rejected')
                          .map(({ record }) => record.id),
                      );
                      onChange({
                        ...draft,
                        nodeType,
                        parentId: allowedParentIds.has(draft.parentId) ? draft.parentId : '',
                      });
                    }}
                    disabled={currentChapterHasChildren}
                    className={INPUT_CLASS}
                    aria-describedby="planning-node-type-help"
                  >
                    {Object.entries(PLANNING_CHAPTER_NODE_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <span id="planning-node-type-help" className="block font-normal leading-relaxed text-muted-foreground">
                    {currentChapterHasChildren ? '子項目があるため、種類は変更できません。' : '例：第一部は「部」、第一話は「話」を選びます。'}
                  </span>
                </label>
                <label className="space-y-1.5 text-xs font-bold text-foreground">
                  <span>入れる場所</span>
                  <select
                    value={draft?.parentId || ''}
                    onChange={event => onChange({ ...draft, parentId: event.target.value })}
                    className={INPUT_CLASS}
                    aria-describedby="planning-parent-help"
                  >
                    <option value="">最上位に置く</option>
                    {chapterParentOptions.map(({ record, depth }) => (
                      <option key={record.id} value={record.id}>
                        {`${'　'.repeat(Math.min(depth, 3))}${getPlanningChapterNodeLabel(record.nodeType)}：${record.title || '無題'}`}
                      </option>
                    ))}
                  </select>
                  <span id="planning-parent-help" className="block font-normal leading-relaxed text-muted-foreground">
                    部や章の中へ入れる場合だけ選びます。移動先では末尾へ追加されます。
                  </span>
                </label>
              </div>
            </fieldset>
          )}

          {fields.map(([field, label, type, help, options]) => (
            <label key={field} className="block space-y-1.5 text-xs font-bold text-foreground">
              <span>{label}</span>
              {help && <span className="block font-normal leading-relaxed text-muted-foreground">{help}</span>}
              {type === 'textarea' ? (
                <textarea value={draft?.[field] || ''} onChange={event => update(field, event.target.value)} className={TEXTAREA_CLASS} />
              ) : type === 'select' ? (
                <select value={draft?.[field] || Object.keys(options)[0]} onChange={event => update(field, event.target.value)} className={INPUT_CLASS}>
                  {Object.entries(options).map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                </select>
              ) : (
                <input type={type} value={draft?.[field] || ''} onChange={event => update(field, event.target.value)} className={INPUT_CLASS} />
              )}
            </label>
          ))}

          {section !== 'concept' && section !== 'chapters' && (
            <fieldset className="rounded-lg border border-[#34345a] p-3">
              <legend className="px-1 text-xs font-bold text-foreground">紐づく部・章・話・節</legend>
              {chapters.length === 0 && archivedLinkedChapters.length === 0 ? (
                <p className="text-xs text-muted-foreground">先に「目次・章構成」で部・章・話・節を作ると紐づけられます。</p>
              ) : (
                <div className="space-y-3">
                  {chapterRows.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
                    {chapterRows.map(({ record: chapter, depth }) => {
                      const checked = (draft?.chapterIds || []).includes(chapter.id);
                      return (
                        <label key={chapter.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[#34345a] px-3 py-2 text-xs">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={event => update('chapterIds', event.target.checked
                              ? [...(draft.chapterIds || []), chapter.id]
                              : (draft.chapterIds || []).filter(id => id !== chapter.id))}
                            className="h-4 w-4 accent-cyan-400"
                          />
                          <span className="min-w-0 break-words">
                            {'› '.repeat(Math.min(depth, 3))}{getPlanningChapterNodeLabel(chapter.nodeType)}：{chapter.title || '無題'}
                          </span>
                        </label>
                      );
                    })}
                  </div>}
                  {archivedLinkedChapters.length > 0 && (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                      <p className="text-xs font-black text-amber-200">旧目次との紐づけ（参照用）</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">目次を書き直す前の紐づけです。取材内容は残したまま、ここでチェックを外したり、新しい目次へ付け直したりできます。</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {archivedLinkedChapters.map(chapter => (
                          <label key={chapter.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-amber-400/25 px-3 py-2 text-xs">
                            <input
                              type="checkbox"
                              checked
                              onChange={event => update('chapterIds', event.target.checked
                                ? [...new Set([...(draft.chapterIds || []), chapter.id])]
                                : (draft.chapterIds || []).filter(id => id !== chapter.id))}
                              className="h-4 w-4 accent-amber-400"
                            />
                            <span className="min-w-0 break-words">{chapterReferenceLabel(chapter, allChapters, activeChapterIds)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold text-foreground">
              <span>状態</span>
              <select value={draft?.status || 'draft'} onChange={event => update('status', event.target.value)} className={INPUT_CLASS}>
                {Object.entries(PLANNING_NOTE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-bold text-foreground">
              <span>資料の優先順位</span>
              <select value={draft?.sourcePriority || 'unspecified'} onChange={event => update('sourcePriority', event.target.value)} className={INPUT_CLASS}>
                {Object.entries(PLANNING_SOURCE_PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          {draft?.status === 'approved' && (
            <label className="block space-y-1.5 text-xs font-bold text-foreground">
              <span>承認者</span>
              <input value={draft.approvedBy || ''} onChange={event => update('approvedBy', event.target.value)} className={INPUT_CLASS} placeholder="例：著者本人" />
            </label>
          )}
        </div>

        <DialogFooter className="border-t border-[#2a2a4a] bg-[#121222] px-5 py-4">
          <Button type="button" variant="outline" onClick={requestClose} disabled={busy} className="min-h-11">キャンセル</Button>
          <Button type="button" onClick={onSave} disabled={busy || editor?.externalConflict} className="min-h-11 gap-2 bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {busy ? '保存中…' : section === 'interviews' ? 'この1問を保存' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const MARKET_SUMMARY_FIELDS = [
  ['readerNeeds', '読者が求めていること', 'レビューや公開情報から読み取れるニーズを、断定しすぎずに整理します。'],
  ['majorOpportunity', '本書の主要機会', 'この本だから応えられる機会を短くまとめます。'],
  ['competitorPatternsAndGaps', '競合に共通すること・不足', '複数の根拠記録を見比べ、共通点と不足を分けて書きます。'],
  ['bookPosition', 'この本が取る立ち位置', '誰のどの悩みに、どんな違いで応える本かをまとめます。'],
  ['mainUsp', '本書の中心的な独自性', '読者へ約束できる、この本ならではの強みです。'],
  ['avoidDirections', '避ける方向', '競合の模倣や、著者らしさを損なう方向を残します。'],
  ['unresearchedItems', '未調査・再確認すること', '確認前の内容を事実として扱わないための保留欄です。'],
  ['reviewObservations', 'レビュー観察メモ', '公開レビューから読み取った傾向。個別レビューの長い転載は避けます。'],
];

const MARKET_EVIDENCE_GROUPS = [
  ['readerNeedsEvidenceIds', '読者が求めていることの根拠'],
  ['majorOpportunityEvidenceIds', '本書の主要機会の根拠'],
  ['competitorPatternsEvidenceIds', '競合の共通点・不足の根拠'],
  ['bookPositionEvidenceIds', '本書の立ち位置の根拠'],
];

function MarketSummaryDialog({ editor, competitors, busy, onChange, onSave, onClose }) {
  const draft = editor?.draft;
  const requestClose = () => {
    if (editor?.dirty && !globalThis.window.confirm('まだ保存していない市場サマリーがあります。閉じてもよいですか？')) return;
    onClose();
  };
  const update = (field, value) => onChange({ ...draft, [field]: value });
  const evidenceOptions = [
    ...competitors.map(record => ({
      id: record.id,
      label: record.bookTitle || record.competitorName || '名称未設定の競合',
      kind: 'competitor',
    })),
    ...(draft?.publicSources || []).map(source => ({
      id: source.id,
      label: source.label || '名称未設定の公開出典',
      kind: 'source',
    })),
  ];

  return (
    <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-4xl flex-col overflow-hidden p-0"
        style={{ background: '#151527', border: '1px solid #2a2a4a' }}
      >
        <DialogHeader className="border-b border-[#2a2a4a] px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-neon-cyan">
            <FileSearch className="h-5 w-5" aria-hidden="true" />市場調査サマリーを編集
          </DialogTitle>
          <DialogDescription>
            未確認の内容は断定せず、下の競合記録を根拠として紐づけます。保存するまで現在の正本は変わりません。
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {editor?.externalConflict && (
            <div className="flex gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              別の画面で市場サマリーが更新されました。入力内容を控え、最新表示を確認してから編集し直してください。
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold text-foreground">
              <span>版ID</span>
              <input value={draft?.versionId || ''} onChange={event => update('versionId', event.target.value)} className={INPUT_CLASS} placeholder="例：market-v1" />
            </label>
            <label className="space-y-1.5 text-xs font-bold text-foreground">
              <span>調査元・資料名</span>
              <input value={draft?.sourceName || ''} onChange={event => update('sourceName', event.target.value)} className={INPUT_CLASS} placeholder="例：2026年8月 市場調査" />
            </label>
            <label className="space-y-1.5 text-xs font-bold text-foreground">
              <span>調査確認日</span>
              <input type="date" value={draft?.reviewedOn || ''} onChange={event => update('reviewedOn', event.target.value)} className={INPUT_CLASS} />
            </label>
            <label className="space-y-1.5 text-xs font-bold text-foreground">
              <span>状態</span>
              <select value={draft?.status || 'draft'} onChange={event => update('status', event.target.value)} className={INPUT_CLASS}>
                {Object.entries(PLANNING_NOTE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {MARKET_SUMMARY_FIELDS.map(([field, label, help]) => (
              <label key={field} className="space-y-1.5 text-xs font-bold text-foreground">
                <span>{label}</span>
                <span className="block font-normal leading-relaxed text-muted-foreground">{help}</span>
                <textarea value={draft?.[field] || ''} onChange={event => update(field, event.target.value)} className={TEXTAREA_CLASS} />
              </label>
            ))}
          </div>

          <fieldset className="rounded-xl border border-[#34345a] p-4">
            <legend className="px-1 text-sm font-bold text-neon-cyan">要約と根拠記録を紐づける</legend>
            {evidenceOptions.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">先に競合記録または公開出典を追加すると、根拠として選べます。</p>
            ) : (
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {MARKET_EVIDENCE_GROUPS.map(([field, label]) => (
                  <fieldset key={field} className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                    <legend className="px-1 text-xs font-bold text-foreground">{label}</legend>
                    <div className="mt-2 space-y-2">
                      {evidenceOptions.map(option => {
                        const checked = (draft?.[field] || []).includes(option.id);
                        return (
                          <label key={option.id} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md border border-white/10 px-3 py-2 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={event => update(field, event.target.checked
                                ? [...(draft?.[field] || []), option.id]
                                : (draft?.[field] || []).filter(id => id !== option.id))}
                              className="mt-0.5 h-4 w-4 accent-cyan-400"
                            />
                            <span><span className="block">{option.label}</span><span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{option.kind === 'source' ? '公開出典' : '競合記録'}</span></span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            )}
          </fieldset>

          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
            ログイン限定URL、会話URL、セッションID、生の非公開会話、GPTs内部指示は保存しないでください。公開出典は「正本を読み込む」の確認画面でも検査します。
          </div>
        </div>
        <DialogFooter className="border-t border-[#2a2a4a] bg-[#121222] px-5 py-4">
          <Button type="button" variant="outline" onClick={requestClose} disabled={busy} className="min-h-11">キャンセル</Button>
          <Button type="button" onClick={onSave} disabled={busy || editor?.externalConflict} className="min-h-11 gap-2 bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {busy ? '保存中…' : '市場サマリーを保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarketImportPreviewDialog({ value, busy, onApply, onClose }) {
  const preview = value?.preview;
  const summary = preview?.summary || {};
  const conflicts = preview?.conflicts || [];
  const canApply = Boolean(preview?.canApply) && conflicts.length === 0;
  const skippedCount = (preview?.skippedCompetitorIds?.length || 0) + (preview?.summarySkipped ? 1 : 0);
  const fallbackAdditionCount = Math.max(0, (summary.competitorCount || 0) - (preview?.skippedCompetitorIds?.length || 0))
    + (preview?.summarySkipped ? 0 : 1);
  const diff = preview?.diff || {};
  return (
    <Dialog open={Boolean(value)} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-3xl flex-col overflow-hidden p-0"
        style={{ background: '#151527', border: '1px solid #2a2a4a' }}
      >
        <DialogHeader className="border-b border-[#2a2a4a] px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-neon-cyan">
            <FileUp className="h-5 w-5" aria-hidden="true" />市場調査の正本を確認
          </DialogTitle>
          <DialogDescription>
            「{value?.fileName || '選択したMarkdown'}」はまだ保存していません。追加内容と競合を確認してから適用します。
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {value?.error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-100" role="alert">
              <p className="font-bold">このファイルは読み込めません</p>
              <p className="mt-2 leading-relaxed">{value.error}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['資料名', summary.sourceName || value?.incoming?.sourceName || '名称未設定'],
                  ['版ID', summary.versionId || '未設定'],
                  ['調査確認日', summary.reviewedOn || '未設定'],
                  ['競合記録', `${summary.competitorCount ?? 0}件`],
                  ['公開出典', `${summary.publicSourceCount ?? 0}件`],
                  ['再確認待ち観察', `${summary.reviewRecheckCount ?? 0}件`],
                  ['未調査・次回確認', `${summary.unresearchedCount ?? 0}件`],
                  ['状態', PLANNING_NOTE_STATUSES[summary.status] || summary.status || '未設定'],
                ].map(([label, text]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                    <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
                    <p className="mt-1 break-words text-sm font-bold text-foreground">{text}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="差分件数">
                {[
                  ['追加', `${diff.additions ?? fallbackAdditionCount}件`, 'text-emerald-200'],
                  ['同一のため追加しない', `${diff.unchanged ?? skippedCount}件`, 'text-muted-foreground'],
                  ['競合', `${diff.changes ?? conflicts.length}件`, conflicts.length ? 'text-red-200' : 'text-foreground'],
                  ['削除', `${diff.deletions ?? 0}件`, 'text-foreground'],
                ].map(([label, text, tone]) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-black/10 p-3">
                    <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
                    <p className={`mt-1 text-lg font-black ${tone}`}>{text}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-neon-cyan/25 bg-neon-cyan/5 p-4 text-xs leading-relaxed text-muted-foreground">
                <p className="font-bold text-neon-cyan">差分として追加する内容</p>
                <p className="mt-1">市場サマリー、公開出典、競合記録を確認し、既存の同一ID・同一版と衝突しないものだけを追加します。既存の承認版を無断で上書きしません。</p>
              </div>

              {conflicts.length > 0 ? (
                <section className="rounded-lg border border-red-500/40 bg-red-950/30 p-4" aria-labelledby="market-import-conflicts-title">
                  <h3 id="market-import-conflicts-title" className="flex items-center gap-2 font-bold text-red-100">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />競合があるため適用できません
                  </h3>
                  <ul className="mt-3 space-y-2 text-xs text-red-100/90">
                    {conflicts.map((conflict, index) => (
                      <li key={`${conflict.type}-${conflict.id}-${index}`} className="rounded-md border border-red-400/20 bg-black/10 p-2">
                        {conflict.label || conflict.id || conflict.type || `競合${index + 1}`}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">既存記録またはMarkdown側のID・版を整理して、もう一度ファイルを選んでください。</p>
                </section>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100" role="status">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  競合はありません。「この差分を追加」で初めて保存されます。
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="border-t border-[#2a2a4a] bg-[#121222] px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="min-h-11">キャンセル</Button>
          <Button type="button" onClick={onApply} disabled={busy || !canApply || Boolean(value?.error)} className="min-h-11 gap-2 bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {busy ? '追加中…' : 'この差分を追加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarketEvidenceLinks({ ids = [], competitors, publicSources = [], onOpen }) {
  const evidence = ids.map(id => {
    const competitor = competitors.find(record => record.id === id);
    if (competitor) return { id, kind: 'competitor', value: competitor };
    const source = publicSources.find(record => record.id === id);
    return source ? { id, kind: 'source', value: source } : null;
  }).filter(Boolean);
  if (evidence.length === 0) {
    return <p className="mt-3 text-[11px] text-muted-foreground">根拠記録はまだ紐づいていません。</p>;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label="紐づけた根拠記録">
      {evidence.map(item => item.kind === 'competitor' ? (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item.value)}
          className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 whitespace-normal break-words rounded-md border border-neon-cyan/25 bg-neon-cyan/5 px-2.5 py-1.5 text-left text-[11px] font-bold text-neon-cyan transition hover:border-neon-cyan/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
        >
          <Link2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          根拠を見る：{item.value.bookTitle || item.value.competitorName || '名称未設定'}
        </button>
      ) : (
        <a
          key={item.id}
          href={item.value.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-1.5 whitespace-normal break-words rounded-md border border-neon-cyan/25 bg-neon-cyan/5 px-2.5 py-1.5 text-left text-[11px] font-bold text-neon-cyan transition hover:border-neon-cyan/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
        >
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />根拠を開く：{item.value.label || '公開出典'}
        </a>
      ))}
    </div>
  );
}

function MarketResearchSection({
  summary,
  metrics,
  allCompetitors,
  visibleCompetitors,
  allChapters,
  activeChapterIds,
  filtersActive,
  onClearFilters,
  onEditSummary,
  onImport,
  onAdd,
  onRevealEvidence,
  onOpenDetail,
  onEditChapterLinks,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  const summaryCards = [
    {
      title: '読者が求めていること',
      text: summary.readerNeeds,
      evidenceIds: summary.readerNeedsEvidenceIds,
      icon: UserRound,
      cardClass: 'border-cyan-400/25 border-l-cyan-400 bg-cyan-400/[0.07]',
      headingClass: 'text-cyan-200',
    },
    {
      title: '競合に共通すること・不足',
      text: summary.competitorPatternsAndGaps,
      evidenceIds: summary.competitorPatternsEvidenceIds,
      icon: Scale,
      cardClass: 'border-amber-400/25 border-l-amber-400 bg-amber-400/[0.07]',
      headingClass: 'text-amber-200',
    },
    {
      title: 'この本が取る立ち位置',
      text: summary.bookPosition,
      evidenceIds: summary.bookPositionEvidenceIds,
      icon: Compass,
      cardClass: 'border-emerald-400/25 border-l-emerald-400 bg-emerald-400/[0.07]',
      headingClass: 'text-emerald-200',
    },
  ];
  const summaryUpdated = metrics.reviewedOn || summary.reviewedOn;
  const sourceCount = metrics.verifiedSourceCount ?? 0;

  const actionButtons = record => (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => onOpenDetail(record)} className="min-h-10 border-white/15 text-foreground"><BookOpenText className="h-4 w-4" />内容を見る</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onEditChapterLinks(record)} className="min-h-11 border-neon-cyan/30 text-neon-cyan"><Link2 className="h-4 w-4" />目次との紐づけだけ変更</Button>
      {record.status !== 'approved' && <Button type="button" size="sm" variant="outline" onClick={() => onEdit(record)} className="min-h-10"><Pencil className="h-4 w-4" />編集</Button>}
      <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(record)} className="min-h-10 border-neon-cyan/30 text-neon-cyan"><Copy className="h-4 w-4" />複製</Button>
      {record.status !== 'approved' && <Button type="button" size="sm" variant="outline" onClick={() => onDelete(record)} className="min-h-10 border-red-400/30 text-red-300"><Trash2 className="h-4 w-4" />削除</Button>}
    </div>
  );

  return (
    <section className="space-y-4" aria-labelledby="market-research-title">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl p-4" style={CARD_STYLE}>
        <div>
          <h2 id="market-research-title" className="text-lg font-black text-neon-cyan">競合・市場調査</h2>
          <p className="mt-1 text-xs text-muted-foreground">確認済み・仮説・著者の実感を分け、未確認の内容を断定しません。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onImport} className="min-h-11 gap-2 border-neon-pink/35 text-neon-pink"><FileUp className="h-4 w-4" />正本を読み込む</Button>
          <Button type="button" onClick={onAdd} className="min-h-11 gap-2 bg-neon-cyan/20 text-neon-cyan"><Plus className="h-4 w-4" />競合を追加</Button>
        </div>
      </div>

      <section className="rounded-xl p-4 sm:p-5" style={CARD_STYLE} aria-labelledby="market-summary-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="market-summary-title" className="font-black text-foreground">市場調査サマリー</h3>
              <StatusBadge status={summary.status} />
              {summary.status === 'needs_confirmation' && (
                <MetaBadge icon={UserRound} tone="latest">市場ポジション・主USPは著者承認待ち</MetaBadge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">要約だけで断定せず、下の根拠記録と公開出典を一緒に確認します。</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onEditSummary} className="min-h-11 border-neon-cyan/30 text-neon-cyan"><Pencil className="h-4 w-4" />サマリーを編集</Button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['調査更新日', summaryUpdated || (summary.updatedAt ? formatPlanningDateTimeJst(summary.updatedAt) : '未記録')],
            ['競合数', `${metrics.competitorCount ?? allCompetitors.length}件`],
            ['確認済みソース数', `${sourceCount}件`],
            ['主な読者ニーズ', summary.readerNeeds || '未整理'],
            ['本書の主要機会', summary.majorOpportunity || '未整理'],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.025] p-3">
              <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-xs font-bold leading-relaxed text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {summaryCards.map(({ title, text, evidenceIds, icon: Icon, cardClass, headingClass }) => (
            <article key={title} className={`rounded-xl border border-l-4 p-4 ${cardClass}`}>
              <h4 className={`flex items-center gap-2 text-sm font-black ${headingClass}`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {title}
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text || 'まだ整理されていません。'}</p>
              <MarketEvidenceLinks ids={evidenceIds} competitors={allCompetitors} publicSources={summary.publicSources || []} onOpen={onRevealEvidence} />
            </article>
          ))}
        </div>

        {summary.majorOpportunityEvidenceIds?.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
            <p className="text-xs font-bold text-amber-200">本書の主要機会の根拠</p>
            <MarketEvidenceLinks ids={summary.majorOpportunityEvidenceIds} competitors={allCompetitors} publicSources={summary.publicSources || []} onOpen={onRevealEvidence} />
          </div>
        )}

        {[summary.mainUsp, summary.avoidDirections, summary.unresearchedItems, summary.reviewObservations].some(Boolean) && (
          <details className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-xs font-bold text-neon-cyan">その他の調査判断・再確認事項</summary>
            <dl className="mt-2 grid gap-3 sm:grid-cols-2">
              {[
                ['本書の中心的な独自性', summary.mainUsp],
                ['避ける方向', summary.avoidDirections],
                ['未調査・再確認すること', summary.unresearchedItems],
                ['レビュー観察メモ', summary.reviewObservations],
              ].filter(([, value]) => value).map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-black/10 p-3">
                  <dt className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-neon-pink">
                    {label}
                    {label === 'レビュー観察メモ' && /再確認待ち/.test(value) && (
                      <MetaBadge icon={Clock3} tone="latest">再確認待ち</MetaBadge>
                    )}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        {summary.publicSources?.length > 0 && (
          <details className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-xs font-bold text-neon-cyan">公開出典を確認（{summary.publicSources.length}件）</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {summary.publicSources.map(source => (
                <article key={source.id} className="rounded-lg border border-white/10 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-foreground">{source.label || '名称未設定の出典'}</span>
                    <MetaBadge tone={source.verificationStatus === 'verified' ? 'current' : 'latest'}>
                      {{ verified: '確認済み', editorial_hypothesis: '編集仮説', review_recheck_pending: '再確認待ち' }[source.verificationStatus] || '状態未設定'}
                    </MetaBadge>
                  </div>
                  {source.purpose && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{source.purpose}</p>}
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1 break-all font-bold text-neon-cyan underline underline-offset-4">
                    公開出典を開く<ExternalLink className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  </a>
                  <p className="mt-1 text-[10px] text-muted-foreground">確認日：{source.checkedOn || '未記録'}</p>
                </article>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="competitor-comparison-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 id="competitor-comparison-title" className="font-black text-foreground">競合比較</h3>
            <p className="mt-1 text-xs text-muted-foreground">PCは比較表、スマホは読みやすい縦カードで同じ内容を表示します。</p>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">表示 {visibleCompetitors.length}件</p>
        </div>

        {allCompetitors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
            <FileSearch className="mx-auto h-9 w-9 text-neon-cyan/60" aria-hidden="true" />
            <p className="mt-3 font-bold text-foreground">比較できる競合はまだありません</p>
            <p className="mt-1 text-sm text-muted-foreground">まず1冊・1サービスだけ記録すると、市場の違いが見えやすくなります。</p>
            <Button type="button" onClick={onAdd} className="mt-4 min-h-11 bg-neon-cyan/20 text-neon-cyan"><Plus className="h-4 w-4" />最初の競合を追加</Button>
          </div>
        ) : visibleCompetitors.length === 0 && filtersActive ? (
          <div className="rounded-xl border border-dashed border-amber-400/30 bg-amber-400/5 p-8 text-center" role="status">
            <p className="font-bold text-foreground">条件に一致する競合はありません</p>
            <p className="mt-1 text-sm text-muted-foreground">検索語や絞り込み条件を解除すると、保存済みの競合をもう一度表示できます。</p>
            <Button type="button" variant="outline" onClick={onClearFilters} className="mt-4 min-h-11 border-amber-400/35 text-amber-200"><X className="h-4 w-4" />絞り込みを解除</Button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-[#2a2a4a] bg-[#151529] lg:block">
              <table className="min-w-[1500px] border-collapse text-left text-xs">
                <caption className="sr-only">保存した競合・市場調査の比較表</caption>
                <thead className="bg-black/20 text-muted-foreground">
                  <tr>{['書名・著者', '想定読者', '中心の約束', '強み', '読者反応から見える不足', '本書との差', '根拠URL', '確認日', '状態', '操作'].map(label => <th key={label} scope="col" className="border-b border-[#2a2a4a] px-3 py-3 font-bold">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {visibleCompetitors.map(record => (
                    <tr
                      key={record.id}
                      id={`planning-competitors-${record.id}-desktop`}
                      tabIndex={-1}
                      className="align-top odd:bg-white/[0.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-cyan/80"
                      style={{ scrollMarginTop: 'calc(var(--kindle-main-nav-height, 60px) + 5.5rem)' }}
                    >
                      <td className="max-w-48 px-3 py-3"><p className="font-bold text-foreground">{record.bookTitle || record.competitorName || '名称未設定'}</p><p className="mt-1 text-muted-foreground">{record.author || '著者未記録'}</p><ChapterReferenceSummary record={record} allChapters={allChapters} activeChapterIds={activeChapterIds} className="mt-2" /></td>
                      {[record.targetReader, record.mainPromise, record.strengths, record.readerReactionGap, record.differentiation].map((value, index) => <td key={index} className="max-w-56 whitespace-pre-wrap px-3 py-3 leading-relaxed text-foreground">{value || '未記録'}</td>)}
                      <td className="max-w-32 px-3 py-3">{record.url ? <a href={record.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-neon-cyan underline underline-offset-4">開く<ExternalLink className="h-3 w-3" aria-hidden="true" /></a> : <span className="text-muted-foreground">未記録</span>}</td>
                      <td className="px-3 py-3 text-foreground">{record.checkedOn || '未記録'}</td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-36 flex-col items-start gap-1.5">
                          <MarketEvidenceBadge value={record.assessmentStatus} />
                          <MarketClaimBadge value={record.claimKind} />
                          <MarketRecheckBadge value={record.recheckStatus} />
                        </div>
                      </td>
                      <td className="min-w-72 px-3 py-3">{actionButtons(record)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {visibleCompetitors.map(record => (
                <article
                  key={record.id}
                  id={`planning-competitors-${record.id}-mobile`}
                  tabIndex={-1}
                  className="rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
                  style={{ ...CARD_STYLE, scrollMarginTop: 'calc(var(--kindle-main-nav-height, 60px) + 5.5rem)' }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-foreground">{record.bookTitle || record.competitorName || '名称未設定'}</h4>
                    <MarketEvidenceBadge value={record.assessmentStatus} />
                    <MarketClaimBadge value={record.claimKind} />
                    <MarketRecheckBadge value={record.recheckStatus} />
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{record.author || '著者未記録'} ／ 確認日：{record.checkedOn || '未記録'}</p>
                  <ChapterReferenceSummary record={record} allChapters={allChapters} activeChapterIds={activeChapterIds} className="mt-2" />
                  <dl className="mt-3 space-y-2">
                    {[
                      ['想定読者', record.targetReader], ['中心の約束', record.mainPromise], ['強み', record.strengths],
                      ['読者反応から見える不足', record.readerReactionGap], ['本書との差', record.differentiation],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
                        <dt className="text-[10px] font-bold text-neon-pink">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{value || '未記録'}</dd>
                      </div>
                    ))}
                  </dl>
                  {record.url && <a href={record.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-1 font-bold text-neon-cyan underline underline-offset-4">根拠URLを開く<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
                  <div className="mt-3">{actionButtons(record)}</div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  );
}

const INSTRUCTION_ROLE_LABELS = {
  writing: '執筆',
  critique: '辛口論評',
  cover: '表紙',
  promotion: 'プロモーション',
  other: 'その他',
};

function InstructionReferenceSection({
  records,
  newestRecords,
  allChapters,
  activeChapterIds,
  busy,
  onAdd,
  onCopyInstruction,
  onOpenDetail,
  onEditChapterLinks,
  onEdit,
  onDuplicate,
  onDelete,
  onAssignCanonical,
  onClearCanonical,
}) {
  const newestId = newestRecords[0]?.id || '';
  const newestIndex = new Map(newestRecords.map((record, index) => [record.id, index]));
  const ordered = [...records].sort((left, right) => {
    const leftRank = left.firstReadFor.length ? 0 : left.canonicalFor.length ? 1 : 2;
    const rightRank = right.firstReadFor.length ? 0 : right.canonicalFor.length ? 1 : 2;
    return leftRank - rightRank || (newestIndex.get(left.id) ?? 0) - (newestIndex.get(right.id) ?? 0);
  });
  const firstReadFor = target => records.find(record => (
    record.canonicalFor.includes(target) && record.firstReadFor.includes(target)
  ));
  const slots = [
    ['codex', 'Codexが最初に見る正本', firstReadFor('codex')],
    ['author', '著者が最初に見る正本', firstReadFor('author')],
  ];
  const referenceStatusLabel = value => ({ active: '有効', old: '旧版', unset: '状態未設定' }[value] || '状態未設定');

  return (
    <section className="space-y-4" aria-labelledby="instruction-reference-title">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl p-4" style={CARD_STYLE}>
        <div>
          <h2 id="instruction-reference-title" className="text-lg font-black text-neon-cyan">執筆設計・GPTs指示書</h2>
          <p className="mt-1 text-xs text-muted-foreground">最新と正本は別です。最初に見る資料は、著者が明示して初めて決まります。</p>
          <p className="mt-1 text-xs text-muted-foreground">「質問文をコピー」は指示書本文だけをコピーします。指示書名・版・状態・外部ファイルの所在は含めません。</p>
          <p className="mt-1 text-xs text-muted-foreground">ここは質問・指示書の追加、編集、版管理をする場所です。目次へ紐づけた執筆用質問は、仮目次と現在の確定目次のカードからも使えます。</p>
        </div>
        <Button type="button" onClick={onAdd} className="min-h-11 gap-2 bg-neon-cyan/20 text-neon-cyan"><Plus className="h-4 w-4" />新しく追加</Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {slots.map(([target, title, record]) => (
          <article key={target} className={`rounded-xl border p-4 ${record ? 'border-neon-pink/35 bg-neon-pink/[0.055]' : 'border-dashed border-white/15 bg-white/[0.02]'}`}>
            <div className="flex items-center gap-2">
              <Star className={`h-5 w-5 ${record ? 'text-neon-pink' : 'text-muted-foreground'}`} aria-hidden="true" />
              <h3 className="font-black text-foreground">{title}</h3>
            </div>
            {record ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2"><MetaBadge icon={Star} tone="first">最初に見る</MetaBadge><MetaBadge icon={ShieldCheck} tone="canonical">正本</MetaBadge><ReferenceTargetBadge value={record.audience} /></div>
                <p className="mt-3 font-bold text-foreground">{record.name || '無題の指示書'} <span className="text-neon-cyan">v{record.versionNumber}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">{INSTRUCTION_ROLE_LABELS[record.role] || record.role} ／ 更新：{formatPlanningDateTimeJst(record.updatedAt)}（日本時間）</p>
                <ChapterReferenceSummary record={record} allChapters={allChapters} activeChapterIds={activeChapterIds} className="mt-2" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <InstructionCopyButton record={record} onCopyInstruction={onCopyInstruction} />
                  <Button type="button" size="sm" variant="outline" onClick={() => onOpenDetail(record)} className="min-h-10"><BookOpenText className="h-4 w-4" />内容を見る</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => onClearCanonical(record, target)} disabled={busy} className="min-h-10 border-white/15 text-muted-foreground"><X className="h-4 w-4" />指定を外す</Button>
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-white/15 p-4 text-sm text-muted-foreground">
                <p className="font-bold text-foreground">正本未設定</p>
                <p className="mt-1 text-xs leading-relaxed">最新の資料を自動では選びません。下の資料から明示して設定してください。</p>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-bold text-neon-cyan">正本</span>＝現在参照すべき版　／　<span className="font-bold text-amber-200">最新</span>＝更新日時が最も新しい記録
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-muted-foreground">
          指示書はまだありません。対象と役割を決めて、v1から保存できます。
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map(record => {
            const allowedTargets = record.audience === 'shared'
              ? ['codex', 'author']
              : record.audience === 'unset'
                ? ['codex', 'author']
                : ['codex', 'author'].filter(target => record.audience === target);
            return (
              <article key={record.id} className="rounded-xl p-4" style={CARD_STYLE}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {record.firstReadFor.length > 0 && <MetaBadge icon={Star} tone="first">最初に見る</MetaBadge>}
                      {record.canonicalFor.length > 0 && <MetaBadge icon={ShieldCheck} tone="canonical">正本</MetaBadge>}
                      {record.id === newestId && <MetaBadge icon={Clock3} tone="latest">最新</MetaBadge>}
                      <ReferenceTargetBadge value={record.audience} />
                      <MetaBadge tone={record.referenceStatus === 'active' ? 'current' : 'changed'}>{referenceStatusLabel(record.referenceStatus)}</MetaBadge>
                      <StatusBadge status={record.status} />
                    </div>
                    <h3 className="mt-3 break-words font-bold text-foreground">{record.name || '無題の指示書'} <span className="text-neon-cyan">v{record.versionNumber}</span></h3>
                    <p className="mt-1 text-xs text-muted-foreground">役割：{INSTRUCTION_ROLE_LABELS[record.role] || record.role} ／ 更新：{formatPlanningDateTimeJst(record.updatedAt)}（日本時間）</p>
                    <ChapterReferenceSummary record={record} allChapters={allChapters} activeChapterIds={activeChapterIds} className="mt-2" />
                    {record.changeSummary && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{record.changeSummary}</p>}
                    <p className="mt-2 break-all text-[10px] text-muted-foreground">ID: {record.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:max-w-md sm:justify-end">
                    {allowedTargets.map(target => (
                      <Button
                        key={target}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onAssignCanonical(record, target)}
                        disabled={busy || record.firstReadFor.includes(target)}
                        className="min-h-11 border-neon-pink/30 text-neon-pink"
                      >
                        <Star className="h-4 w-4" />{REFERENCE_TARGET_LABELS[target]}の正本にする
                      </Button>
                    ))}
                    {record.audience === 'unset' && <p className="w-full text-xs text-amber-200">正本にする対象を選ぶと、この資料の対象も同時に設定されます。</p>}
                    <InstructionCopyButton record={record} onCopyInstruction={onCopyInstruction} />
                    <Button type="button" size="sm" variant="outline" onClick={() => onOpenDetail(record)} className="min-h-11 border-white/15 text-foreground"><BookOpenText className="h-4 w-4" />内容を見る</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onEditChapterLinks(record)} className="min-h-11 border-neon-cyan/30 text-neon-cyan"><Link2 className="h-4 w-4" />目次との紐づけだけ変更</Button>
                    {record.status !== 'approved' && <Button type="button" size="sm" variant="outline" onClick={() => onEdit(record)} className="min-h-11"><Pencil className="h-4 w-4" />編集</Button>}
                    <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(record)} className="min-h-11 border-neon-cyan/30 text-neon-cyan"><Copy className="h-4 w-4" />新しい版</Button>
                    {record.status !== 'approved' && record.canonicalFor.length === 0 && <Button type="button" size="sm" variant="outline" onClick={() => onDelete(record)} className="min-h-11 border-red-400/30 text-red-300"><Trash2 className="h-4 w-4" />削除</Button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DecisionHistorySection({
  records,
  newestRecords,
  allChapters,
  activeChapterIds,
  busy,
  onAdd,
  onOpenDetail,
  onEditChapterLinks,
  onEdit,
  onDuplicate,
  onDelete,
  onAssignCanonical,
  onWithdraw,
  onReveal,
}) {
  const canonical = records.find(record => record.isCanonical);
  const newestId = newestRecords[0]?.id || '';
  const stateMeta = {
    current: { label: '現行', tone: 'current' },
    changed: { label: '変更済み', tone: 'changed' },
    withdrawn: { label: '撤回', tone: 'withdrawn' },
    unset: { label: '状態未設定', tone: 'muted' },
  };

  return (
    <section className="space-y-4" aria-labelledby="decision-history-title">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl p-4" style={CARD_STYLE}>
        <div><h2 id="decision-history-title" className="text-lg font-black text-neon-cyan">意思決定・版履歴</h2><p className="mt-1 text-xs text-muted-foreground">正本は著者が明示し、履歴は削除せず新旧のつながりを残します。</p></div>
        <Button type="button" onClick={onAdd} className="min-h-11 gap-2 bg-neon-cyan/20 text-neon-cyan"><Plus className="h-4 w-4" />新しい判断を追加</Button>
      </div>

      <section className="rounded-xl border border-neon-pink/25 bg-neon-pink/[0.045] p-4" aria-labelledby="current-decision-title">
        <h3 id="current-decision-title" className="flex items-center gap-2 font-black text-foreground"><Star className="h-5 w-5 text-neon-pink" aria-hidden="true" />現在の判断・正本（まずここを見る）</h3>
        {canonical ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              {canonical.isFirstRead && <MetaBadge icon={Star} tone="first">最初に見る</MetaBadge>}
              <MetaBadge icon={ShieldCheck} tone="canonical">正本</MetaBadge>
              <MetaBadge tone="current">現行</MetaBadge>
            </div>
            <p className="mt-3 whitespace-pre-wrap font-bold leading-relaxed text-foreground">{canonical.decision}</p>
            {canonical.reason && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">理由：{canonical.reason}</p>}
            <p className="mt-2 text-xs text-muted-foreground">更新：{formatPlanningDateTimeJst(canonical.updatedAt)}（日本時間）</p>
            <ChapterReferenceSummary record={canonical} allChapters={allChapters} activeChapterIds={activeChapterIds} className="mt-2" />
            <Button type="button" size="sm" variant="outline" onClick={() => onReveal(canonical.id)} className="mt-3 min-h-10"><History className="h-4 w-4" />履歴内で見る</Button>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-white/15 p-4 text-sm text-muted-foreground"><p className="font-bold text-foreground">正本未設定</p><p className="mt-1 text-xs">最新の判断を自動で正本にはしません。下の履歴から明示して設定してください。</p></div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="decision-change-history-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h3 id="decision-change-history-title" className="font-black text-foreground">変更履歴</h3><p className="mt-1 text-xs font-bold text-neon-cyan">表示順：更新日時の新しい順（最新が上）</p></div>
          <p className="text-xs text-muted-foreground">日時は日本時間で表示</p>
        </div>
        {newestRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-muted-foreground">判断の履歴はまだありません。最初の判断を1件保存してください。</div>
        ) : newestRecords.map(record => {
          const state = stateMeta[record.decisionState] || stateMeta.unset;
          return (
            <article
              key={record.id}
              id={`planning-decisions-${record.id}`}
              tabIndex={-1}
              className="rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
              style={{ ...CARD_STYLE, scrollMarginTop: 'calc(var(--kindle-main-nav-height, 60px) + 5.5rem)' }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {record.isFirstRead && <MetaBadge icon={Star} tone="first">最初に見る</MetaBadge>}
                    {record.isCanonical && <MetaBadge icon={ShieldCheck} tone="canonical">正本</MetaBadge>}
                    {record.id === newestId && <MetaBadge icon={Clock3} tone="latest">最新</MetaBadge>}
                    <MetaBadge tone={state.tone}>{state.label}</MetaBadge>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap font-bold leading-relaxed text-foreground">{record.decision}</p>
                  {record.reason && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">理由：{record.reason}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">更新：{formatPlanningDateTimeJst(record.updatedAt)}（日本時間）</p>
                  <ChapterReferenceSummary record={record} allChapters={allChapters} activeChapterIds={activeChapterIds} className="mt-2" />
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {record.supersedesId && <button type="button" onClick={() => onReveal(record.supersedesId)} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-white/15 px-2.5 py-1.5 font-bold text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"><Link2 className="h-3.5 w-3.5" />差替え前を見る</button>}
                    {record.supersededById && <button type="button" onClick={() => onReveal(record.supersededById)} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-white/15 px-2.5 py-1.5 font-bold text-neon-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"><Link2 className="h-3.5 w-3.5" />差替え後を見る</button>}
                  </div>
                  <p className="mt-2 break-all text-[10px] text-muted-foreground">ID: {record.id}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:max-w-md sm:justify-end">
                  {!record.isCanonical && record.decisionState !== 'withdrawn' && <Button type="button" size="sm" variant="outline" onClick={() => onAssignCanonical(record)} disabled={busy} className="min-h-11 border-neon-pink/30 text-neon-pink"><Star className="h-4 w-4" />正本にする</Button>}
                  {record.decisionState !== 'withdrawn' && <Button type="button" size="sm" variant="outline" onClick={() => onWithdraw(record)} disabled={busy} className="min-h-11 border-rose-400/30 text-rose-200"><X className="h-4 w-4" />撤回</Button>}
                  <Button type="button" size="sm" variant="outline" onClick={() => onOpenDetail(record)} className="min-h-11 border-white/15 text-foreground"><BookOpenText className="h-4 w-4" />内容を見る</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => onEditChapterLinks(record)} className="min-h-11 border-neon-cyan/30 text-neon-cyan"><Link2 className="h-4 w-4" />目次との紐づけだけ変更</Button>
                  {record.status !== 'approved' && record.decisionState !== 'withdrawn' && <Button type="button" size="sm" variant="outline" onClick={() => onEdit(record)} className="min-h-11"><Pencil className="h-4 w-4" />編集</Button>}
                  <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(record)} className="min-h-11 border-neon-cyan/30 text-neon-cyan"><Copy className="h-4 w-4" />新しい判断</Button>
                  {record.status !== 'approved' && !record.isCanonical && !record.supersedesId && !record.supersededById && <Button type="button" size="sm" variant="outline" onClick={() => onDelete(record)} className="min-h-11 border-red-400/30 text-red-300"><Trash2 className="h-4 w-4" />削除</Button>}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </section>
  );
}

export default function PlanningNotesTab({
  project,
  onProjectUpdate,
  onNavigateTab,
  initialSection = 'overview',
  onSectionChange,
  collapsedOutlineCardKeys = [],
  onCollapsedOutlineCardKeysChange,
}) {
  const [initialRead] = useState(() => readPlanningNotes(project?.planning_notes));
  const [data, setData] = useState(initialRead.data);
  const [loadError, setLoadError] = useState(initialRead.error);
  const [activeSection, setActiveSection] = useState(() => normalizePlanningViewSection(initialSection));
  const [editor, setEditor] = useState(null);
  const [marketEditor, setMarketEditor] = useState(null);
  const [marketImport, setMarketImport] = useState(null);
  const [detail, setDetail] = useState(null);
  const [outlineView, setOutlineView] = useState('draft');
  const [outlineDialog, setOutlineDialog] = useState(null);
  const [outlineRewrite, setOutlineRewrite] = useState(null);
  const [lastOutlineRewriteSummary, setLastOutlineRewriteSummary] = useState(null);
  const [chapterLinkEditor, setChapterLinkEditor] = useState(null);
  const [manuscriptLinkEditor, setManuscriptLinkEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [instructionCopyFeedback, setInstructionCopyFeedback] = useState(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [pendingRecordFocus, setPendingRecordFocus] = useState(null);
  const activeProjectIdRef = useRef(project?.id || '');
  const operationGenerationRef = useRef(0);
  const draftCacheRef = useRef(new Map());
  const sectionNavScrollRef = useRef(null);
  const sectionButtonRefs = useRef(new Map());
  const marketImportInputRef = useRef(null);
  const outlineTablistScrollRef = useRef(null);
  const outlineTabRefs = useRef(new Map());
  const outlineRewriteTriggerRef = useRef(null);
  const manuscriptLinkReturnFocusRef = useRef(null);
  const activeSectionRef = useRef(activeSection);
  const collapsedOutlineCardKeySet = useMemo(
    () => new Set(collapsedOutlineCardKeys),
    [collapsedOutlineCardKeys],
  );

  const toggleOutlineCard = cardKey => {
    if (!onCollapsedOutlineCardKeysChange) return;
    const nextKeys = collapsedOutlineCardKeySet.has(cardKey)
      ? collapsedOutlineCardKeys.filter(key => key !== cardKey)
      : [...collapsedOutlineCardKeys, cardKey];
    onCollapsedOutlineCardKeysChange(nextKeys);
  };

  const selectActiveSection = section => {
    const safeSection = normalizePlanningViewSection(section);
    if (safeSection === activeSectionRef.current) return;
    onSectionChange?.(safeSection, activeSectionRef.current);
    activeSectionRef.current = safeSection;
    setActiveSection(safeSection);
  };

  useEffect(() => {
    activeProjectIdRef.current = project?.id || '';
    operationGenerationRef.current += 1;
    setBusy(false);
    setStatusMessage('');
    setInstructionCopyFeedback(null);
    const parsed = readPlanningNotes(project?.planning_notes);
    setData(parsed.data);
    setLoadError(parsed.error);
    setEditor(draftCacheRef.current.get(project?.id || '') || null);
    setMarketEditor(null);
    setMarketImport(null);
    setDetail(null);
    setOutlineView('draft');
    setOutlineDialog(null);
    setOutlineRewrite(null);
    setLastOutlineRewriteSummary(null);
    setChapterLinkEditor(null);
    setManuscriptLinkEditor(null);
    manuscriptLinkReturnFocusRef.current = null;
    const restoredSection = normalizePlanningViewSection(initialSection);
    activeSectionRef.current = restoredSection;
    setActiveSection(restoredSection);
  }, [project?.id]);

  useEffect(() => {
    const parsed = readPlanningNotes(project?.planning_notes);
    setData(parsed.data);
    setLoadError(parsed.error);
    setEditor(current => {
      if (!current || current.projectId !== project?.id || parsed.error) return current;
      const latest = current.section === 'concept'
        ? parsed.data.concept
        : parsed.data[current.section]?.find(record => record.id === current.draft.id);
      if (current.expectedUpdatedAt === null || latest?.updatedAt === current.expectedUpdatedAt) return current;
      return { ...current, externalConflict: true };
    });
    setMarketEditor(current => {
      if (!current || current.projectId !== project?.id || parsed.error) return current;
      if (current.expectedUpdatedAt === parsed.data.marketSummary.updatedAt) return current;
      return { ...current, externalConflict: true };
    });
    setDetail(current => {
      if (!current || current.projectId !== project?.id || parsed.error) return current;
      const latest = current.section === 'concept'
        ? parsed.data.concept
        : current.section === 'conceptHistory'
          ? parsed.data.conceptHistory.find(record => record.id === current.record.id)
          : parsed.data[current.section]?.find(record => record.id === current.record.id);
      return latest ? { ...current, record: latest } : null;
    });
  }, [project?.planning_notes]);

  useEffect(() => {
    if (editor?.projectId) draftCacheRef.current.set(editor.projectId, editor);
  }, [editor]);

  useEffect(() => {
    if (instructionCopyFeedback?.surface !== 'card') return undefined;
    const sequence = instructionCopyFeedback.sequence;
    const timerId = window.setTimeout(() => {
      setInstructionCopyFeedback(current => (
        current?.surface === 'card' && current.sequence === sequence ? null : current
      ));
    }, 4500);
    return () => window.clearTimeout(timerId);
  }, [instructionCopyFeedback]);

  useEffect(() => {
    const container = sectionNavScrollRef.current;
    const button = sectionButtonRefs.current.get(activeSection);
    if (!container || !button) return;

    let animationFrameId = null;
    const scheduleActiveButtonScroll = requestedBehavior => {
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        const currentContainer = sectionNavScrollRef.current;
        const activeButton = sectionButtonRefs.current.get(activeSectionRef.current);
        if (!currentContainer || !activeButton) return;

        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const targetLeft = activeButton.offsetLeft
          - ((currentContainer.clientWidth - activeButton.offsetWidth) / 2);
        const maxLeft = Math.max(0, currentContainer.scrollWidth - currentContainer.clientWidth);
        currentContainer.scrollTo({
          left: Math.min(maxLeft, Math.max(0, targetLeft)),
          top: currentContainer.scrollTop,
          behavior: reduceMotion || requestedBehavior !== 'smooth' ? 'auto' : 'smooth',
        });
      });
    };

    const handleSectionNavResize = () => scheduleActiveButtonScroll('auto');
    scheduleActiveButtonScroll('smooth');

    const resizeObserver = typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver(handleSectionNavResize)
      : null;
    resizeObserver?.observe(container);
    resizeObserver?.observe(button);
    window.addEventListener('resize', handleSectionNavResize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleSectionNavResize);
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    };
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'chapters') return undefined;
    const container = outlineTablistScrollRef.current;
    const button = outlineTabRefs.current.get(outlineView);
    if (!container || !button) return undefined;
    const scrollActiveOutlineTab = () => {
      const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      const targetLeft = button.offsetLeft - ((container.clientWidth - button.offsetWidth) / 2);
      container.scrollTo({
        left: Math.min(maxLeft, Math.max(0, targetLeft)),
        top: container.scrollTop,
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    };
    const animationFrameId = window.requestAnimationFrame(scrollActiveOutlineTab);
    window.addEventListener('resize', scrollActiveOutlineTab);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', scrollActiveOutlineTab);
    };
  }, [activeSection, outlineView]);

  const allChapters = data.chapters;
  const chapters = useMemo(() => getPlanningDraftOutlineChapters(data), [data]);
  const activeChapterIds = useMemo(() => new Set(chapters.map(chapter => chapter.id)), [chapters]);
  const manuscriptByChapterId = useMemo(
    () => new Map(data.chapterWritingStates.map(state => [state.chapterId, state])),
    [data.chapterWritingStates],
  );
  const chapterRows = useMemo(() => flattenPlanningChapterTree(data), [data]);
  const outlineSnapshots = useMemo(
    () => sortPlanningOutlineSnapshotsNewest(data),
    [data],
  );
  const pastOutlineSnapshots = useMemo(
    () => outlineSnapshots.filter(snapshot => snapshot.id !== data.confirmedOutlineId),
    [data.confirmedOutlineId, outlineSnapshots],
  );
  const confirmedOutline = useMemo(
    () => getConfirmedPlanningOutline(data),
    [data],
  );
  const draftMatchesConfirmed = useMemo(
    () => Boolean(confirmedOutline && planningOutlineMatchesSnapshot(data, confirmedOutline)),
    [data, confirmedOutline],
  );
  const latestDraftSnapshot = useMemo(
    () => outlineSnapshots.find(snapshot => snapshot.kind === 'draft') || null,
    [outlineSnapshots],
  );
  const draftMatchesLatestSavedDraft = useMemo(
    () => Boolean(latestDraftSnapshot && planningOutlineMatchesSnapshot(data, latestDraftSnapshot)),
    [data, latestDraftSnapshot],
  );
  const activeOutlineChapterCount = useMemo(
    () => chapters.filter(chapter => chapter.status !== 'rejected').length,
    [chapters],
  );
  const approvedDraftChapterCount = useMemo(
    () => chapters.filter(chapter => chapter.status === 'approved').length,
    [chapters],
  );
  const linkedRecordCountForDraft = useMemo(() => (
    ['competitors', 'interviews', 'instructionVersions', 'decisions']
      .flatMap(section => data[section])
      .filter(record => record.chapterIds.some(chapterId => activeChapterIds.has(chapterId)))
      .length
  ), [activeChapterIds, data]);
  const usageBytes = useMemo(
    () => estimatePlanningNotesBytes(project?.planning_notes || serializePlanningNotes(data)),
    [project?.planning_notes, data],
  );
  const totalRecords = data.competitors.length + data.chapters.length + data.interviews.length
    + data.instructionVersions.length + data.decisions.length
    + (data.concept.revision > 0 ? 1 : 0);
  const searchResults = useMemo(() => filterPlanningNotes(data, {
    query,
    section: typeFilter,
    chapterId: chapterFilter,
    status: statusFilter,
    sourcePriority: priorityFilter,
  }, { assumeNormalized: true }), [data, query, typeFilter, chapterFilter, statusFilter, priorityFilter]);
  const marketMetrics = useMemo(() => getPlanningMarketMetrics(data), [data]);
  const newestInstructions = useMemo(
    () => sortPlanningRecordsNewest(data.instructionVersions),
    [data.instructionVersions],
  );
  const questionsByChapterId = useMemo(
    () => buildPlanningChapterQuestionIndex(data.instructionVersions),
    [data.instructionVersions],
  );
  const liveChapterIds = useMemo(
    () => new Set(data.chapters.map(chapter => chapter.id)),
    [data.chapters],
  );
  const newestDecisions = useMemo(
    () => sortPlanningRecordsNewest(data.decisions),
    [data.decisions],
  );
  const filtersActive = Boolean(
    query
    || typeFilter !== 'all'
    || chapterFilter !== 'all'
    || statusFilter !== 'all'
    || priorityFilter !== 'all',
  );

  const clearFilters = () => {
    setQuery('');
    setTypeFilter('all');
    setChapterFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
  };
  const newestCompetitors = useMemo(
    () => sortPlanningRecordsNewest(data.competitors),
    [data.competitors],
  );
  const visibleCompetitors = useMemo(() => {
    if (!filtersActive) return newestCompetitors;
    const visibleIds = new Set(
      searchResults
        .filter(result => result.section === 'competitors')
        .map(result => result.record.id),
    );
    return newestCompetitors.filter(record => visibleIds.has(record.id));
  }, [filtersActive, newestCompetitors, searchResults]);

  useEffect(() => {
    if (!pendingRecordFocus || activeSection !== pendingRecordFocus.section) return undefined;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const baseId = `planning-${pendingRecordFocus.section}-${pendingRecordFocus.id}`;
        const responsiveSuffix = window.matchMedia?.('(min-width: 1024px)').matches ? 'desktop' : 'mobile';
        const target = document.getElementById(`${baseId}-${responsiveSuffix}`)
          || document.getElementById(baseId);
        target?.scrollIntoView({
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
        target?.focus({ preventScroll: true });
        setPendingRecordFocus(null);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [activeSection, pendingRecordFocus, data]);

  const revealRecord = (section, recordId, { resetFilters = false } = {}) => {
    if (resetFilters) clearFilters();
    selectActiveSection(section);
    setPendingRecordFocus({ section, id: recordId });
  };

  const canApplyResult = (projectId, generation) => (
    activeProjectIdRef.current === projectId && operationGenerationRef.current === generation
  );

  const selectOutlineView = (view, { focus = false } = {}) => {
    if (!OUTLINE_VIEW_META[view]) return;
    setOutlineView(view);
    setStatusMessage(`${OUTLINE_VIEW_META[view].label}を表示しました`);
    if (focus) window.requestAnimationFrame(() => outlineTabRefs.current.get(view)?.focus());
  };

  const handleOutlineTabKeyDown = (event, currentView) => {
    const views = Object.keys(OUTLINE_VIEW_META);
    const currentIndex = views.indexOf(currentView);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % views.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + views.length) % views.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = views.length - 1;
    else return;
    event.preventDefault();
    selectOutlineView(views[nextIndex], { focus: true });
  };

  const persist = async (buildNext, successMessage, { closeEditor = true } = {}) => {
    if (!project?.id || busy) return null;
    const targetProjectId = project.id;
    operationGenerationRef.current += 1;
    const generation = operationGenerationRef.current;
    setBusy(true);
    try {
      await flushPendingSaves();
      let nextData;
      const updated = await mutatePublishingProject(targetProjectId, latest => {
        const current = readPlanningNotes(latest?.planning_notes);
        if (current.error) throw current.error;
        nextData = buildNext(current.data);
        const planningNotes = serializePlanningNotes(nextData, { enforceStorageBudget: true });
        return { planning_notes: planningNotes };
      }, project);
      await onProjectUpdate(updated);
      if (canApplyResult(targetProjectId, generation)) {
        setData(nextData);
        setStatusMessage(successMessage);
        toast.success(successMessage);
        if (estimatePlanningNotesBytes(updated.planning_notes) >= PLANNING_NOTES_WARNING_BYTES) {
          toast.warning('企画ノートの容量が増えています。データ管理から最新バックアップを保存してください');
        }
        if (closeEditor) {
          draftCacheRef.current.delete(targetProjectId);
          setEditor(null);
        }
      }
      return nextData;
    } catch (error) {
      if (canApplyResult(targetProjectId, generation)) {
        const message = error?.message || '企画・取材ノートを保存できませんでした';
        setStatusMessage(message);
        toast.error(message);
      }
      return null;
    } finally {
      if (canApplyResult(targetProjectId, generation)) setBusy(false);
    }
  };

  const openConcept = (forkApproved = false) => {
    const draft = {
      ...data.concept,
      status: forkApproved ? 'draft' : data.concept.status,
      approvedAt: forkApproved ? '' : data.concept.approvedAt,
      approvedBy: forkApproved ? '' : data.concept.approvedBy,
    };
    setEditor({
      projectId: project.id,
      section: 'concept',
      title: forkApproved ? '承認済みを残して新しい企画案を作る' : '企画メモを編集',
      draft,
      dirty: false,
      expectedUpdatedAt: data.concept.updatedAt,
      initialStatus: draft.status,
      forkApproved,
      externalConflict: false,
    });
  };

  const openNewRecord = (section, recordDefaults = {}, options = {}) => {
    const draft = section === 'chapters'
      ? createPlanningChapterRecord(data, {
        nodeType: recordDefaults.nodeType || 'chapter',
        parentId: recordDefaults.parentId || '',
      })
      : createPlanningRecord(section, recordDefaults);
    setEditor({
      projectId: project.id,
      section,
      title: options.title || (section === 'interviews' ? '次の1問を記録' : `${SECTION_META[section].label}を追加`),
      draft,
      dirty: false,
      expectedUpdatedAt: null,
      initialStatus: 'draft',
      forkApproved: false,
      externalConflict: false,
    });
  };

  const openNewQuestionForChapter = chapter => {
    const typeLabel = getPlanningChapterNodeLabel(chapter.nodeType);
    openNewRecord('instructionVersions', {
      role: 'writing',
      chapterIds: [chapter.id],
    }, {
      title: `${typeLabel}「${chapter.title || '無題'}」の原稿を作る質問を追加`,
    });
  };

  const openEditRecord = (section, record) => {
    setEditor({
      projectId: project.id,
      section,
      title: `${recordTitle(section, record)}を編集`,
      draft: { ...record, chapterIds: [...record.chapterIds] },
      dirty: false,
      expectedUpdatedAt: record.updatedAt,
      initialStatus: record.status,
      forkApproved: false,
      externalConflict: false,
    });
  };

  const openChapterLinkEditor = (section, record) => {
    if (section === 'chapters' || section === 'concept' || section === 'conceptHistory') return;
    setDetail(null);
    setChapterLinkEditor({
      projectId: project.id,
      section,
      recordId: record.id,
      title: recordTitle(section, record),
      initialChapterIds: [...record.chapterIds],
      chapterIds: [...record.chapterIds],
      expectedUpdatedAt: record.updatedAt,
    });
  };

  const saveChapterLinks = async () => {
    if (!chapterLinkEditor || chapterLinkEditor.projectId !== project.id) return;
    const next = await persist(current => updatePlanningRecordChapterLinks(
      current,
      chapterLinkEditor.section,
      chapterLinkEditor.recordId,
      chapterLinkEditor.chapterIds,
      { expectedUpdatedAt: chapterLinkEditor.expectedUpdatedAt },
    ), '目次との紐づけだけを保存しました', { closeEditor: false });
    if (next) setChapterLinkEditor(null);
  };

  const closeManuscriptLinkEditor = () => {
    const returnTarget = manuscriptLinkReturnFocusRef.current;
    setManuscriptLinkEditor(null);
    // Radixの閉じる処理とReactの再描画が完了した後でも、呼び出し元へ確実に戻す。
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => returnTarget?.focus());
    });
  };

  const openManuscriptLinkEditor = (record, event) => {
    const manuscript = getPlanningChapterManuscript(data, record.id);
    manuscriptLinkReturnFocusRef.current = event?.currentTarget || null;
    setManuscriptLinkEditor({
      projectId: project.id,
      chapterId: record.id,
      title: record.title,
      nodeType: record.nodeType,
      originalDocumentUrl: manuscript.documentUrl,
      documentUrl: manuscript.documentUrl,
      expectedRevision: manuscript.revision,
      error: '',
    });
  };

  const toggleChapterManuscriptComplete = async (record, completed) => {
    const manuscript = getPlanningChapterManuscript(data, record.id);
    const title = record.title || '無題';
    await persist(current => updatePlanningChapterManuscript(
      current,
      record.id,
      { completed },
      { expectedRevision: manuscript.revision },
    ), completed ? `「${title}」の原稿を完成にしました` : `「${title}」の原稿を未完成に戻しました`, { closeEditor: false });
  };

  const saveManuscriptDocumentUrl = async () => {
    if (!manuscriptLinkEditor || manuscriptLinkEditor.projectId !== project.id) return;
    let documentUrl;
    try {
      documentUrl = validatePlanningManuscriptUrl(manuscriptLinkEditor.documentUrl);
    } catch (error) {
      setManuscriptLinkEditor(current => current ? { ...current, error: error?.message || '原稿URLを確認してください' } : current);
      return;
    }
    const targetProjectId = manuscriptLinkEditor.projectId;
    const next = await persist(current => updatePlanningChapterManuscript(
      current,
      manuscriptLinkEditor.chapterId,
      { documentUrl },
      { expectedRevision: manuscriptLinkEditor.expectedRevision },
    ), documentUrl
      ? `「${manuscriptLinkEditor.title || '無題'}」の原稿URLを保存しました`
      : `「${manuscriptLinkEditor.title || '無題'}」の原稿リンクを削除しました`, { closeEditor: false });
    if (next && activeProjectIdRef.current === targetProjectId) closeManuscriptLinkEditor();
  };

  const openDuplicate = (section, record) => {
    if (section === 'chapters') {
      const parent = record.parentId
        ? chapters.find(chapter => chapter.id === record.parentId)
        : null;
      if (parent?.status === 'approved') {
        toast.error('本人承認済みの親項目には新しい子項目を追加できません。最上位へ新しい案を作ってください');
        return;
      }
    }
    const draft = duplicatePlanningRecord(data, section, record.id);
    setEditor({
      projectId: project.id,
      section,
      title: section === 'instructionVersions' ? `v${draft.versionNumber}を作る` : '新しい案として複製',
      draft,
      dirty: false,
      expectedUpdatedAt: null,
      initialStatus: 'draft',
      forkApproved: false,
      externalConflict: false,
    });
  };

  const saveEditor = async () => {
    if (!editor) return;
    const requiredMessage = (() => {
      if (editor.section === 'competitors' && !editor.draft.bookTitle?.trim() && !editor.draft.competitorName?.trim()) return '競合名または書名を1つ入力してください';
      if (editor.section === 'chapters' && !editor.draft.title?.trim()) return '部・章・話・節のタイトルを入力してください';
      if (editor.section === 'interviews' && !editor.draft.question?.trim()) return '今回の質問を入力してください';
      if (editor.section === 'instructionVersions' && !editor.draft.name?.trim()) return '指示書名を入力してください';
      if (editor.section === 'decisions' && !editor.draft.decision?.trim()) return '何を決めたかを入力してください';
      if (
        editor.section === 'interviews'
        && editor.draft.visibility === 'share_candidate'
        && editor.draft.status === 'approved'
        && !editor.draft.publicAnswer?.trim()
      ) return '公開候補として本人承認する前に、匿名化した共有・公開用の文章を入力してください';
      return '';
    })();
    if (requiredMessage) {
      toast.error(requiredMessage);
      return;
    }
    if (editor.draft.status === 'approved' && !editor.draft.approvedBy?.trim()) {
      toast.error('本人承認済みにする場合は、承認者を入力してください');
      return;
    }
    if (
      editor.draft.status === 'approved'
      && editor.initialStatus !== 'approved'
      && !globalThis.window.confirm(
        '本人承認済みとして保存しますか？\n\n承認後はこの記録を直接編集・削除できません。変更するときは、承認版を残して「複製」「新しい版」「新しい案」を作ります。',
      )
    ) return;
    const sensitive = editor.section === 'competitors'
      ? findMarketResearchRestrictedData(editor.draft)
      : findPlanningNotesSensitiveData(editor.draft);
    if (sensitive.length > 0) {
      toast.error(`${sensitive[0].label}を検出したため保存を停止しました。APIキー・認証情報・限定URL・非公開会話URLは削除してください`);
      return;
    }
    if (editor.section === 'concept') {
      await persist(current => savePlanningConcept(current, editor.draft, {
        expectedUpdatedAt: editor.expectedUpdatedAt,
        forkApproved: editor.forkApproved,
      }), editor.forkApproved ? '承認済みの企画を履歴へ残し、新しい案を保存しました' : '企画メモを保存しました');
      return;
    }
    await persist(current => {
      if (editor.section !== 'chapters') {
        return upsertPlanningRecord(current, editor.section, editor.draft, {
          expectedUpdatedAt: editor.expectedUpdatedAt,
        });
      }
      const storedRecord = current.chapters.find(chapter => chapter.id === editor.draft.id);
      if (storedRecord && !isPlanningDraftChapter(current, storedRecord.id)) {
        throw new Error('この項目を開いたあとに仮目次が書き直されました。新しい仮目次を確認してから編集してください');
      }
      const latestRecord = storedRecord;
      if (!latestRecord) {
        return upsertPlanningRecord(current, 'chapters', {
          ...editor.draft,
          order: getNextPlanningChapterOrder(current, editor.draft.parentId),
        }, { expectedUpdatedAt: null });
      }
      if (latestRecord.updatedAt !== editor.expectedUpdatedAt) {
        throw new Error('同じ構成項目が別の画面で更新されました。最新内容を確認してください');
      }
      const structureChanged = latestRecord.parentId !== editor.draft.parentId
        || latestRecord.nodeType !== editor.draft.nodeType;
      if (structureChanged) {
        if (current.chapterOrderRevision !== data.chapterOrderRevision) {
          throw new Error('目次・章構成の順序が別の画面で更新されました。最新内容を確認してください');
        }
        return upsertPlanningRecord(current, 'chapters', {
          ...editor.draft,
          order: latestRecord.parentId === editor.draft.parentId
            ? latestRecord.order
            : getNextPlanningChapterOrder(current, editor.draft.parentId),
        }, { expectedUpdatedAt: editor.expectedUpdatedAt });
      }
      return upsertPlanningRecord(current, 'chapters', editor.draft, {
        expectedUpdatedAt: editor.expectedUpdatedAt,
      });
    }, editor.section === 'interviews' ? 'この1問を保存しました' : 'ノートを保存しました');
  };

  const handleDelete = async (section, record) => {
    const manuscript = section === 'chapters' ? manuscriptByChapterId.get(record.id) : null;
    const hasManuscriptProgress = Boolean(manuscript?.completed || manuscript?.documentUrl);
    const remainsInSavedOutline = section === 'chapters' && outlineSnapshots.some(
      snapshot => snapshot.chapters.some(chapter => chapter.id === record.id),
    );
    const manuscriptNotice = hasManuscriptProgress
      ? remainsInSavedOutline
        ? '\n\n原稿完成チェックとリンクは、過去または確定済みの目次側に残ります。'
        : '\n\n削除が実行される場合、この項目だけの原稿完成チェックとリンクも一緒に削除されます。'
      : '';
    if (!globalThis.window.confirm(`「${recordTitle(section, record)}」だけを削除しますか？${manuscriptNotice}\n\n子項目や取材との紐づけがある場合は削除せず停止します。目次全体を変えたいときは、キャンセルして「目次をまとめて書き直す」を使ってください。`)) return;
    await persist(current => deletePlanningRecord(current, section, record.id, {
      expectedUpdatedAt: record.updatedAt,
    }), 'ノートを削除しました', { closeEditor: false });
  };

  const handleMoveChapter = async (record, direction) => {
    const next = await persist(current => movePlanningChapter(current, record.id, direction, {
      expectedRevision: data.chapterOrderRevision,
    }), `「${record.title || '無題の構成項目'}」を${direction === 'up' ? '上' : '下'}へ移動しました`, { closeEditor: false });
    if (next) setData(next);
  };

  const closeOutlineRewrite = () => {
    setOutlineRewrite(null);
    window.requestAnimationFrame(() => outlineRewriteTriggerRef.current?.focus());
  };

  const openOutlineRewrite = () => {
    setOutlineRewrite({
      projectId: project.id,
      step: 1,
      mode: 'paste',
      markdown: '',
      preview: null,
      error: '',
      currentCount: chapters.length,
      approvedCount: approvedDraftChapterCount,
      linkedRecordCount: linkedRecordCountForDraft,
      expectedOutlineRevision: data.outlineRevision,
      expectedChapterOrderRevision: data.chapterOrderRevision,
    });
  };

  const continueOutlineRewrite = () => {
    if (!outlineRewrite || outlineRewrite.projectId !== project.id) return;
    if (outlineRewrite.step === 1) {
      setOutlineRewrite({ ...outlineRewrite, step: 2, error: '', preview: null });
      return;
    }
    if (outlineRewrite.step !== 2) return;
    try {
      const preview = outlineRewrite.mode === 'blank'
        ? { proposedChapters: [], counts: { total: 0, part: 0, chapter: 0, episode: 0, section: 0 }, warnings: [] }
        : parsePlanningOutlineMarkdown(outlineRewrite.markdown);
      setOutlineRewrite({ ...outlineRewrite, step: 3, preview, error: '' });
    } catch (error) {
      setOutlineRewrite({ ...outlineRewrite, preview: null, error: error?.message || '新しい目次を解析できませんでした' });
    }
  };

  const copyOutlineRewritePrompt = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('このブラウザではクリップボードを利用できません');
      await navigator.clipboard.writeText(planningOutlineRewritePrompt(chapterRows, data.concept));
      toast.success('Codexへの相談文をコピーしました');
      setStatusMessage('Codexへの相談文をコピーしました');
    } catch (error) {
      toast.error(error?.message || '相談文をコピーできませんでした');
    }
  };

  const copyInstructionQuestion = async record => {
    const text = getPlanningInstructionCopyText(record);
    const displayName = record?.name || '無題の指示書';
    const targetProjectId = project.id;
    const generation = operationGenerationRef.current;
    const isDetailCopy = detail?.projectId === targetProjectId
      && detail.section === 'instructionVersions'
      && detail.record?.id === record?.id;
    try {
      if (findPlanningNotesSensitiveData({ markdown: text }).length > 0) {
        throw new Error('APIキー・認証情報・非公開会話URLらしき文字列が含まれるため、コピーを停止しました。本文を確認してください');
      }
      const writeText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
      await copyPlanningInstructionText(record, writeText);
      if (activeProjectIdRef.current !== targetProjectId || operationGenerationRef.current !== generation) return;
      const message = `「${displayName}」の質問文をコピーしました`;
      setInstructionCopyFeedback(current => ({
        recordId: record.id,
        message,
        tone: 'success',
        surface: isDetailCopy ? 'detail' : 'card',
        sequence: (current?.sequence || 0) + 1,
      }));
    } catch (error) {
      if (activeProjectIdRef.current !== targetProjectId || operationGenerationRef.current !== generation) return;
      const knownMessage = typeof error?.message === 'string' && (
        error.message === 'コピーする指示書本文がありません'
        || error.message === 'このブラウザではクリップボードを利用できません'
        || error.message.startsWith('APIキー・認証情報・非公開会話URLらしき文字列')
      );
      const message = knownMessage
        ? error.message
        : '質問文をコピーできませんでした。ブラウザのクリップボード許可を確認するか、「内容を見る」から本文を選択してコピーしてください';
      setInstructionCopyFeedback(current => ({
        recordId: record?.id || '',
        message,
        tone: 'error',
        surface: isDetailCopy ? 'detail' : 'card',
        sequence: (current?.sequence || 0) + 1,
      }));
    }
  };

  const applyOutlineRewrite = async () => {
    if (!outlineRewrite || outlineRewrite.projectId !== project.id || outlineRewrite.step !== 3 || !outlineRewrite.preview) return;
    let rewriteSummary = null;
    const next = await persist(current => {
      const result = replacePlanningOutlineDraft(current, outlineRewrite.preview.proposedChapters, {
        expectedOutlineRevision: outlineRewrite.expectedOutlineRevision,
        expectedChapterOrderRevision: outlineRewrite.expectedChapterOrderRevision,
      });
      if (!result.summary.changed) throw new Error('仮目次はすでに空です。Codexの案を貼るか、部・章を追加してください');
      rewriteSummary = result.summary;
      return result.data;
    }, outlineRewrite.mode === 'blank' ? '仮目次を空にして、前の目次を履歴へ残しました' : '新しい仮目次へ切り替えました', { closeEditor: false });
    if (!next || !rewriteSummary) return;
    setLastOutlineRewriteSummary(rewriteSummary);
    setOutlineRewrite(null);
    selectOutlineView('draft');
    window.requestAnimationFrame(() => outlineRewriteTriggerRef.current?.focus());
  };

  const openOutlineSnapshotDialog = kind => {
    if (activeOutlineChapterCount === 0) {
      toast.error('採用する部・章・話・節を1件以上作ってから保存してください');
      return;
    }
    const nextKindNumber = outlineSnapshots.filter(snapshot => snapshot.kind === kind).length + 1;
    setOutlineDialog({
      projectId: project.id,
      kind,
      label: kind === 'confirmed' ? `確定目次 v${nextKindNumber}` : `仮目次メモ ${nextKindNumber}`,
      note: '',
      chapterCount: activeOutlineChapterCount,
      expectedOutlineRevision: data.outlineRevision,
      expectedChapterOrderRevision: data.chapterOrderRevision,
    });
  };

  const saveOutlineSnapshot = async () => {
    if (!outlineDialog || outlineDialog.projectId !== project.id) return;
    const kind = outlineDialog.kind;
    const next = await persist(current => createPlanningOutlineSnapshot(current, {
      kind,
      label: outlineDialog.label,
      note: outlineDialog.note,
    }, {
      expectedOutlineRevision: outlineDialog.expectedOutlineRevision,
      expectedChapterOrderRevision: outlineDialog.expectedChapterOrderRevision,
    }), kind === 'confirmed'
      ? 'この仮目次を、現在使う確定目次として保存しました'
      : '今の仮目次を過去の目次へ保存しました', { closeEditor: false });
    if (!next) return;
    setOutlineDialog(null);
    selectOutlineView(kind === 'confirmed' ? 'confirmed' : 'history', { focus: true });
  };

  const exportShare = (format) => {
    try {
      const share = buildPlanningNotesSharePackage(data, {
        projectName: project?.name,
        bookTitle: project?.book_title,
      });
      const base = `${safeFilename(project?.book_title || project?.name)}-共有用企画ノート`;
      if (format === 'markdown') {
        downloadText(planningNotesShareToMarkdown(share), `${base}.md`, 'text/markdown;charset=utf-8');
      } else {
        downloadText(JSON.stringify(share, null, 2), `${base}.json`, 'application/json;charset=utf-8');
      }
      toast.success('非公開の取材回答を除いた共有用ファイルを保存しました');
    } catch (error) {
      toast.error(error?.message || '共有用ファイルを作成できませんでした');
    }
  };

  const openDetail = (section, record) => {
    setInstructionCopyFeedback(null);
    setDetail({ projectId: project.id, section, record });
  };

  const openMarketSummary = () => {
    setMarketEditor({
      projectId: project.id,
      expectedUpdatedAt: data.marketSummary.updatedAt,
      dirty: false,
      externalConflict: false,
      draft: {
        ...data.marketSummary,
        readerNeedsEvidenceIds: [...data.marketSummary.readerNeedsEvidenceIds],
        majorOpportunityEvidenceIds: [...data.marketSummary.majorOpportunityEvidenceIds],
        competitorPatternsEvidenceIds: [...data.marketSummary.competitorPatternsEvidenceIds],
        bookPositionEvidenceIds: [...data.marketSummary.bookPositionEvidenceIds],
        publicSources: data.marketSummary.publicSources.map(source => ({ ...source })),
      },
    });
  };

  const saveMarketSummary = async () => {
    if (!marketEditor || marketEditor.externalConflict) return;
    const restricted = findMarketResearchRestrictedData(marketEditor.draft);
    if (restricted.length > 0) {
      toast.error(`${restricted[0].label}を検出したため保存を停止しました。限定URL・会話URL・セッションID・GPTs内部指示は削除してください`);
      return;
    }
    const next = await persist(current => savePlanningMarketSummary(current, marketEditor.draft, {
      expectedUpdatedAt: marketEditor.expectedUpdatedAt,
    }), '市場調査サマリーを保存しました', { closeEditor: false });
    if (next) setMarketEditor(null);
  };

  const handleMarketImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const targetProjectId = project.id;
    const fileName = String(file.name || 'market-research-summary.md');
    if (!/\.(?:md|markdown|txt)$/i.test(fileName)) {
      setMarketImport({ fileName, error: 'Markdown（.md / .markdown）またはテキストファイルを選んでください' });
      return;
    }
    try {
      const markdown = await file.text();
      if (activeProjectIdRef.current !== targetProjectId) return;
      const incoming = parseMarketResearchSummaryMarkdown(markdown, { sourceName: fileName });
      const preview = previewMarketResearchImport(data, incoming);
      setMarketImport({ fileName, incoming, preview, error: '' });
    } catch (error) {
      if (activeProjectIdRef.current !== targetProjectId) return;
      setMarketImport({ fileName, error: error?.message || '市場調査Markdownを確認できませんでした' });
    }
  };

  const applyMarketImport = async () => {
    if (!marketImport?.preview?.canApply || !marketImport.incoming) return;
    const next = await persist(
      current => applyMarketResearchImport(current, marketImport.incoming),
      '市場調査の正本を差分追加しました',
      { closeEditor: false },
    );
    if (next) setMarketImport(null);
  };

  const handleAssignInstructionCanonical = async (record, target) => {
    if (!globalThis.window.confirm(`「${record.name || '無題の指示書'} v${record.versionNumber}」を${REFERENCE_TARGET_LABELS[target]}が最初に見る正本へ設定しますか？\n\n同じ役割・対象の旧正本は旧版になります。本文は変更しません。`)) return;
    await persist(
      current => assignInstructionCanonical(current, record.id, target, { makeFirstRead: true }),
      `${REFERENCE_TARGET_LABELS[target]}が最初に見る正本を設定しました`,
      { closeEditor: false },
    );
  };

  const handleClearInstructionCanonical = async (record, target) => {
    if (!globalThis.window.confirm(`${REFERENCE_TARGET_LABELS[target]}向けの正本・最初に見る指定を外しますか？\n\n指示書本文と履歴は残ります。`)) return;
    await persist(
      current => clearInstructionCanonical(current, record.id, target),
      `${REFERENCE_TARGET_LABELS[target]}向けの正本指定を外しました`,
      { closeEditor: false },
    );
  };

  const handleAssignDecisionCanonical = async (record) => {
    if (!globalThis.window.confirm(`この判断を「最初に見る正本」へ設定しますか？\n\n現在の正本は「変更済み」として履歴に残り、新旧を相互参照できます。`)) return;
    await persist(
      current => assignDecisionCanonical(current, record.id, { makeFirstRead: true }),
      '現在の判断・正本を更新しました',
      { closeEditor: false },
    );
  };

  const handleWithdrawDecision = async (record) => {
    if (!globalThis.window.confirm(`この判断を撤回しますか？\n\n記録は削除せず「撤回」として履歴へ残します。正本・最初に見る指定は外れます。`)) return;
    await persist(
      current => withdrawPlanningDecision(current, record.id),
      '判断を撤回として履歴へ残しました',
      { closeEditor: false },
    );
  };

  if (!project) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <BookOpenText className="mx-auto mb-3 h-10 w-10 text-neon-cyan/50" />
        <p className="font-bold text-foreground">先に本の保存先を作ってください</p>
        <p className="mt-2 text-sm">企画・取材・構成ノートは本ごとに保存されます。</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-red-500/40 bg-red-950/30 p-5" role="alert">
        <h2 className="flex items-center gap-2 font-bold text-red-200"><AlertTriangle className="h-5 w-5" />企画・取材ノートを安全に読み込めませんでした</h2>
        <p className="mt-2 text-sm text-red-100/80">{loadError.message}</p>
        <p className="mt-2 text-xs text-muted-foreground">空データで上書きせず停止しています。上部の「データ管理」からバックアップを保存し、復旧してください。</p>
      </div>
    );
  }

  const sectionRows = activeSection === 'concept' || activeSection === 'overview'
    ? []
    : activeSection === 'chapters'
      ? [
        ...chapterRows.filter(({ record }) => record.status !== 'rejected'),
        ...chapterRows.filter(({ record }) => record.status === 'rejected'),
      ]
      : [...(data[activeSection] || [])]
        .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
        .map(record => ({ record, depth: 0, pathIds: [record.id] }));
  return (
    <div className="space-y-4">
      <section className="rounded-xl p-5" style={CARD_STYLE}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BookOpenText className="h-6 w-6 text-neon-cyan" aria-hidden="true" />
              <h1 className="text-xl font-black text-neon-cyan">企画・取材・構成ノート</h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              市場調査、目次、本人への取材、執筆指示書、判断の理由を、この本の中へ分けて保存します。最初から全部埋めなくて大丈夫です。
            </p>
            <p className="mt-2 text-xs text-amber-200/90">
              指示文は資料として保存するだけです。このアプリが命令として実行することはありません。APIキー・認証情報・非公開会話URLは保存しないでください。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => exportShare('json')} className="min-h-11 gap-2 border-neon-cyan/35 text-neon-cyan">
              <Download className="h-4 w-4" />共有用JSON
            </Button>
            <Button type="button" variant="outline" onClick={() => exportShare('markdown')} className="min-h-11 gap-2 border-neon-pink/35 text-neon-pink">
              <Download className="h-4 w-4" />共有用Markdown
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-muted-foreground">保存項目 {totalRecords}件</span>
          <span className={`rounded-full border px-2.5 py-1 ${usageBytes >= PLANNING_NOTES_WARNING_BYTES ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-white/10 bg-white/5 text-muted-foreground'}`}>
            使用量の目安 {formatBytes(usageBytes)}
          </span>
          {usageBytes >= PLANNING_NOTES_WARNING_BYTES && <span className="font-bold text-amber-200">容量が増えています。バックアップ推奨</span>}
        </div>
      </section>

      <nav
        aria-label="企画ノート内の項目"
        data-view-resume-sticky="planning"
        className="sticky z-20 rounded-xl border border-[#2a2a4a] bg-[#151529]/95 p-2 shadow-[0_5px_14px_rgba(0,0,0,0.24)] backdrop-blur-md"
        style={{ top: 'calc(var(--kindle-main-nav-height, 60px) + 0.5rem)' }}
      >
        <div ref={sectionNavScrollRef} className="overflow-x-auto overscroll-x-contain">
          <div className="flex min-w-max gap-2 lg:min-w-0 lg:w-full">
            {Object.entries(SECTION_META).map(([key, meta]) => {
              const Icon = activeSection === key ? CheckCircle2 : meta.icon;
              return (
                <button
                  key={key}
                  ref={node => {
                    if (node) sectionButtonRefs.current.set(key, node);
                    else sectionButtonRefs.current.delete(key);
                  }}
                  type="button"
                  onClick={() => selectActiveSection(key)}
                  aria-current={activeSection === key ? 'page' : undefined}
                  data-planning-section={key}
                  className={`flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-center text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151529] lg:min-w-0 lg:flex-1 ${activeSection === key ? 'border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan shadow-[inset_0_-2px_0_rgba(0,245,255,0.7)]' : 'border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>{meta.label}</span>
                  {activeSection === key && <span className="sr-only">（表示中）</span>}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {totalRecords > 0 && (
        <section className="rounded-xl p-4" style={CARD_STYLE} aria-label="ノートを検索・絞り込み">
          <label className="relative block">
            <span className="sr-only">企画・取材・構成ノート内を検索</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ノート内を検索" className={`${INPUT_CLASS} pl-10`} />
          </label>
          <details className="mt-3">
            <summary className="min-h-11 cursor-pointer py-2 text-xs font-bold text-neon-cyan">絞り込み条件</summary>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select aria-label="種類で絞り込み" value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className={INPUT_CLASS}>
                <option value="all">すべての種類</option>
                <option value="concept">企画メモ</option>
                {Object.entries(SECTION_META).filter(([key]) => !['overview', 'concept'].includes(key)).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
              </select>
              <select aria-label="構成項目で絞り込み" value={chapterFilter} onChange={event => setChapterFilter(event.target.value)} className={INPUT_CLASS}>
                <option value="all">すべての部・章・話・節</option><option value="unlinked">構成項目へ未紐づけ</option><option value="archived">旧目次に紐づく記録</option>
                {chapterRows.map(({ record: chapter, depth }) => (
                  <option key={chapter.id} value={chapter.id}>
                    {`${'　'.repeat(Math.min(depth, 3))}${getPlanningChapterNodeLabel(chapter.nodeType)}：${chapter.title || '無題'}`}
                  </option>
                ))}
              </select>
              <select aria-label="状態で絞り込み" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className={INPUT_CLASS}>
                <option value="all">すべての状態</option>
                {Object.entries(PLANNING_NOTE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="資料優先順位で絞り込み" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)} className={INPUT_CLASS}>
                <option value="all">すべての資料優先順位</option>
                {Object.entries(PLANNING_SOURCE_PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <Button type="button" variant="ghost" className="mt-2 min-h-11 text-xs" onClick={clearFilters}>
              <X className="h-4 w-4" />絞り込みを解除
            </Button>
          </details>
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">検索結果 {searchResults.length}件</p>
        </section>
      )}

      {activeSection === 'overview' && (
        <section className="space-y-4">
          {totalRecords === 0 ? (
            <div className="rounded-xl p-6 text-center" style={CARD_STYLE}>
              <Lightbulb className="mx-auto h-10 w-10 text-neon-cyan/70" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-black text-foreground">まずは1つだけで大丈夫です</h2>
              <p className="mt-2 text-sm text-muted-foreground">おすすめは「企画メモを書く」から。決まっていない項目は空欄のまま保存できます。</p>
              <div className="mx-auto mt-5 grid max-w-3xl gap-3 sm:grid-cols-3">
                <Button type="button" onClick={() => { selectActiveSection('concept'); openConcept(); }} className="min-h-14 bg-neon-cyan/20 text-neon-cyan"><Lightbulb />企画メモを書く</Button>
                <Button type="button" variant="outline" onClick={() => { selectActiveSection('chapters'); selectOutlineView('draft'); openNewRecord('chapters', { nodeType: 'part' }); }} className="min-h-14 border-neon-pink/35 text-neon-pink"><ClipboardList />目次の構成を作る</Button>
                <Button type="button" variant="outline" onClick={() => { selectActiveSection('interviews'); openNewRecord('interviews'); }} className="min-h-14 border-amber-400/35 text-amber-200"><MessageSquareText />取材を1問記録</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(SECTION_META).filter(([key]) => !['overview'].includes(key)).map(([key, meta]) => {
                const count = key === 'concept' ? (data.concept.revision > 0 ? 1 : 0) : data[key].length;
                const Icon = meta.icon;
                return (
                  <button key={key} type="button" onClick={() => selectActiveSection(key)} className="min-h-28 rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-4 text-left transition hover:border-neon-cyan/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80">
                    <Icon className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
                    <span className="mt-2 block font-bold text-foreground">{meta.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{count}件</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeSection === 'concept' && (
        <section className="rounded-xl p-5" style={CARD_STYLE}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-black text-neon-cyan">企画メモ</h2><p className="mt-1 text-xs text-muted-foreground">本の軸がぼんやりしていても、分かるところだけ残せます。</p></div>
            {data.concept.status === 'approved' ? (
              <Button type="button" variant="outline" onClick={() => openConcept(true)} className="min-h-11 border-neon-pink/35 text-neon-pink"><Copy />承認版を残して新しい案</Button>
            ) : (
              <Button type="button" onClick={() => openConcept(false)} className="min-h-11 bg-neon-cyan/20 text-neon-cyan"><Pencil />{data.concept.revision ? '編集' : '企画メモを書く'}</Button>
            )}
          </div>
          {data.concept.revision === 0 ? <p className="mt-5 rounded-lg border border-dashed border-white/15 p-5 text-center text-sm text-muted-foreground">まだ企画メモはありません。</p> : (
            <div className="mt-4 space-y-3">
              <StatusBadge status={data.concept.status} />
              {FORM_FIELDS.concept.map(([field, label]) => data.concept[field] ? (
                <div key={field} className="rounded-lg border border-white/10 bg-white/[0.025] p-3"><p className="text-[10px] font-bold text-neon-pink">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{data.concept[field]}</p></div>
              ) : null)}
              {data.conceptHistory.length > 0 && (
                <details className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-xs font-bold text-emerald-200">
                    承認済みの旧企画を確認（{data.conceptHistory.length}件）
                  </summary>
                  <div className="mt-2 space-y-3">
                    {[...data.conceptHistory]
                      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
                      .map(history => (
                        <article key={history.id} className="rounded-lg border border-white/10 bg-black/10 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={history.status} />
                            <span className="text-[10px] text-muted-foreground">ID: {history.id}</span>
                          </div>
                          {FORM_FIELDS.concept.map(([field, label]) => history[field] ? (
                            <div key={field} className="mt-2">
                              <p className="text-[10px] font-bold text-neon-pink">{label}</p>
                              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground">{history[field]}</p>
                            </div>
                          ) : null)}
                        </article>
                      ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </section>
      )}

      {activeSection === 'competitors' && (
        <MarketResearchSection
          summary={data.marketSummary}
          metrics={marketMetrics}
          allCompetitors={newestCompetitors}
          visibleCompetitors={visibleCompetitors}
          allChapters={allChapters}
          activeChapterIds={activeChapterIds}
          filtersActive={filtersActive}
          onClearFilters={clearFilters}
          onEditSummary={openMarketSummary}
          onImport={() => marketImportInputRef.current?.click()}
          onAdd={() => openNewRecord('competitors')}
          onRevealEvidence={record => revealRecord('competitors', record.id, { resetFilters: true })}
          onOpenDetail={record => openDetail('competitors', record)}
          onEditChapterLinks={record => openChapterLinkEditor('competitors', record)}
          onEdit={record => openEditRecord('competitors', record)}
          onDuplicate={record => openDuplicate('competitors', record)}
          onDelete={record => handleDelete('competitors', record)}
        />
      )}

      {activeSection === 'instructionVersions' && (
        <InstructionReferenceSection
          records={data.instructionVersions}
          newestRecords={newestInstructions}
          allChapters={allChapters}
          activeChapterIds={activeChapterIds}
          busy={busy}
          onAdd={() => openNewRecord('instructionVersions')}
          onCopyInstruction={copyInstructionQuestion}
          onOpenDetail={record => openDetail('instructionVersions', record)}
          onEditChapterLinks={record => openChapterLinkEditor('instructionVersions', record)}
          onEdit={record => openEditRecord('instructionVersions', record)}
          onDuplicate={record => openDuplicate('instructionVersions', record)}
          onDelete={record => handleDelete('instructionVersions', record)}
          onAssignCanonical={handleAssignInstructionCanonical}
          onClearCanonical={handleClearInstructionCanonical}
        />
      )}

      {activeSection === 'decisions' && (
        <DecisionHistorySection
          records={data.decisions}
          newestRecords={newestDecisions}
          allChapters={allChapters}
          activeChapterIds={activeChapterIds}
          busy={busy}
          onAdd={() => openNewRecord('decisions')}
          onOpenDetail={record => openDetail('decisions', record)}
          onEditChapterLinks={record => openChapterLinkEditor('decisions', record)}
          onEdit={record => openEditRecord('decisions', record)}
          onDuplicate={record => openDuplicate('decisions', record)}
          onDelete={record => handleDelete('decisions', record)}
          onAssignCanonical={handleAssignDecisionCanonical}
          onWithdraw={handleWithdrawDecision}
          onReveal={id => revealRecord('decisions', id)}
        />
      )}

      {['chapters', 'interviews'].includes(activeSection) && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl p-4" style={CARD_STYLE}>
            <div>
              <h2 className="text-lg font-black text-neon-cyan">{SECTION_META[activeSection].label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeSection === 'chapters'
                  ? '「部」の中へ「章」「話」、さらに「節」を入れられます。章だけの本は「章だけで始める」で大丈夫です。'
                  : '本人承認済みは直接上書きせず、新しい案として残します。'}
              </p>
            </div>
            {activeSection !== 'chapters' && (
              <Button type="button" onClick={() => openNewRecord('interviews')} className="min-h-11 gap-2 bg-neon-cyan/20 text-neon-cyan"><Plus />次の1問を記録</Button>
            )}
          </div>

          {activeSection === 'chapters' && (
            <div className="space-y-3 rounded-xl p-3 sm:p-4" style={CARD_STYLE}>
              <div ref={outlineTablistScrollRef} className="overflow-x-auto overscroll-x-contain">
                <div
                  role="tablist"
                  aria-label="目次の表示を切り替える"
                  className="flex min-w-max gap-2 sm:min-w-0 sm:grid sm:grid-cols-3"
                >
                  {Object.entries(OUTLINE_VIEW_META).map(([view, meta]) => {
                    const Icon = meta.icon;
                    const isActive = outlineView === view;
                    const detail = view === 'history' ? `${pastOutlineSnapshots.length}件` : meta.description;
                    return (
                      <button
                        key={view}
                        ref={node => {
                          if (node) outlineTabRefs.current.set(view, node);
                          else outlineTabRefs.current.delete(view);
                        }}
                        id={`planning-outline-tab-${view}`}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`planning-outline-panel-${view}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => selectOutlineView(view)}
                        onKeyDown={event => handleOutlineTabKeyDown(event, view)}
                        className={`flex min-h-12 min-w-[7.5rem] items-center gap-2 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 ${isActive ? 'border-neon-cyan/55 bg-neon-cyan/10 text-neon-cyan shadow-[inset_0_-2px_0_rgba(0,245,255,0.72)]' : 'border-white/10 bg-black/10 text-muted-foreground hover:border-white/20 hover:text-foreground'}`}
                      >
                        {isActive ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" /> : <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
                        <span className="min-w-0">
                          <span className="block text-xs font-black">{meta.label}</span>
                          <span className="block text-[10px] font-bold">{detail}</span>
                        </span>
                        {isActive && <span className="sr-only">（表示中）</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-bold text-foreground">仮目次</span>は何度でも編集できます。<span className="font-bold text-foreground">確定目次</span>は目次本文を変えない保存版ですが、原稿の完成チェックと原稿リンクだけは更新できます。<span className="font-bold text-foreground">過去の目次</span>は変更できません。各項目の「本人承認済み」とは別です。
              </p>
              {outlineView === 'draft' && (
                <div className="space-y-3 border-t border-white/10 pt-3">
                  <div className="flex flex-col gap-2 rounded-xl border border-neon-pink/30 bg-neon-pink/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p id="outline-rewrite-help" className="text-xs font-black text-neon-pink">全体を変えたいときは、1件ずつ削除しなくて大丈夫です</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">今の目次・本人承認・取材の紐づけを残したまま、Codexの新しい案へまとめて切り替えられます。</p>
                    </div>
                    <Button
                      ref={outlineRewriteTriggerRef}
                      type="button"
                      variant="outline"
                      onClick={openOutlineRewrite}
                      disabled={busy}
                      aria-describedby="outline-rewrite-help"
                      className="min-h-11 shrink-0 gap-2 border-neon-pink/45 bg-neon-pink/10 text-neon-pink"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />目次をまとめて書き直す
                    </Button>
                  </div>

                  {lastOutlineRewriteSummary && (
                    <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 text-xs leading-relaxed text-muted-foreground">
                      <div>
                        <p className="font-black text-emerald-200">新しい仮目次へ安全に切り替えました</p>
                        <p className="mt-1">新しい仮目次 {lastOutlineRewriteSummary.createdChapterCount}項目 ／ {outlineRewriteHistoryMessage(lastOutlineRewriteSummary)}</p>
                        <p className="mt-1">取材などの紐づけ {lastOutlineRewriteSummary.preservedLinkCount}件は旧目次の参照として残っています。付け直しが必要な記録は {lastOutlineRewriteSummary.needsRelinkCount}件です。</p>
                      </div>
                      <button type="button" onClick={() => setLastOutlineRewriteSummary(null)} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80" aria-label="書き直し完了のお知らせを閉じる"><X className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => openNewRecord('chapters', { nodeType: 'part' })} className="min-h-11 gap-2 bg-neon-cyan/20 text-neon-cyan"><Plus />部を追加</Button>
                    <Button type="button" variant="outline" onClick={() => openNewRecord('chapters', { nodeType: 'chapter' })} className="min-h-11 gap-2 border-neon-pink/35 text-neon-pink"><Plus />章だけで始める</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openOutlineSnapshotDialog('draft')}
                      disabled={busy || activeOutlineChapterCount === 0 || draftMatchesLatestSavedDraft}
                      className="min-h-11 gap-2 border-slate-400/30 text-slate-200"
                    >
                      <History className="h-4 w-4" aria-hidden="true" />
                      {draftMatchesLatestSavedDraft ? '履歴へ保存済み' : '今の仮目次を履歴に保存'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openOutlineSnapshotDialog('confirmed')}
                      disabled={busy || activeOutlineChapterCount === 0 || draftMatchesConfirmed}
                      className="min-h-11 gap-2 border-emerald-400/35 text-emerald-200"
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      {draftMatchesConfirmed ? '確定目次へ反映済み' : 'この仮目次を確定目次にする'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'chapters' && Object.keys(OUTLINE_VIEW_META)
            .filter(view => view !== outlineView)
            .map(view => (
              <div
                key={view}
                id={`planning-outline-panel-${view}`}
                role="tabpanel"
                aria-labelledby={`planning-outline-tab-${view}`}
                hidden
              />
            ))}

          {activeSection === 'chapters' && outlineView === 'confirmed' ? (
            <div
              id="planning-outline-panel-confirmed"
              role="tabpanel"
              aria-labelledby="planning-outline-tab-confirmed"
              className="rounded-xl p-4"
              style={CARD_STYLE}
            >
              {!confirmedOutline ? (
                <div className="py-6 text-center">
                  <ShieldCheck className="mx-auto h-9 w-9 text-emerald-300/70" aria-hidden="true" />
                  <h3 className="mt-3 font-black text-foreground">確定目次はまだありません</h3>
                  <p className="mt-2 text-sm text-muted-foreground">仮目次がまとまった段階で保存できます。あとから新しい確定版へ切り替えても、以前の版は履歴に残ります。</p>
                  <Button type="button" variant="outline" onClick={() => selectOutlineView('draft', { focus: true })} className="mt-4 min-h-11 border-neon-cyan/35 text-neon-cyan"><Pencil className="h-4 w-4" />仮目次へ戻る</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {!draftMatchesConfirmed && (
                    <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs font-bold text-amber-200">
                      仮目次に、まだ確定目次へ反映していない変更があります。確定目次はそのまま残っています。
                    </p>
                  )}
                  <p className="text-xs leading-relaxed text-muted-foreground">目次本文は読み取り専用です。本文を変えるときは仮目次を編集します。原稿の完成チェックと原稿URLだけは、確定目次の各カードから更新できます。</p>
                  <OutlineSnapshotTree
                    snapshot={confirmedOutline}
                    collapseScope={`confirmed:${confirmedOutline.id}`}
                    collapsedCardKeys={collapsedOutlineCardKeySet}
                    onToggleCard={toggleOutlineCard}
                    current
                    busy={busy}
                    getManuscript={chapterId => manuscriptByChapterId.get(chapterId)}
                    getQuestions={chapterId => questionsByChapterId.get(chapterId) || []}
                    onToggleManuscriptComplete={toggleChapterManuscriptComplete}
                    onEditManuscriptLink={openManuscriptLinkEditor}
                    onCopyQuestion={copyInstructionQuestion}
                    onOpenQuestion={record => openDetail('instructionVersions', record)}
                    onAddQuestion={openNewQuestionForChapter}
                    canAddQuestion={chapterId => liveChapterIds.has(chapterId)}
                  />
                </div>
              )}
            </div>
          ) : activeSection === 'chapters' && outlineView === 'history' ? (
            <div
              id="planning-outline-panel-history"
              role="tabpanel"
              aria-labelledby="planning-outline-tab-history"
              className="space-y-3"
            >
              {pastOutlineSnapshots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-muted-foreground">
                  過去の目次はまだありません。「今の仮目次を履歴に保存」したときや、確定目次を新しい版へ更新したときに、以前の目次が読み取り専用で残ります。
                </div>
              ) : pastOutlineSnapshots.map(snapshot => (
                <details key={snapshot.id} className="rounded-xl p-4" style={CARD_STYLE}>
                  <summary className="min-h-11 cursor-pointer list-none py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80">
                    <span className="flex flex-wrap items-center gap-2">
                      <MetaBadge icon={snapshot.kind === 'confirmed' ? ShieldCheck : History} tone={snapshot.kind === 'confirmed' ? 'canonical' : 'latest'}>{PLANNING_OUTLINE_SNAPSHOT_KINDS[snapshot.kind]}</MetaBadge>
                      <span className="font-black text-foreground">{snapshot.label}</span>
                      <span className="text-[11px] text-muted-foreground">保存日時：{formatPlanningDateTimeJst(snapshot.createdAt)} ／ {snapshot.chapters.length}項目</span>
                    </span>
                    <span className="mt-1 block text-xs text-neon-cyan">内容を見る（読み取り専用）</span>
                  </summary>
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <OutlineSnapshotTree
                      snapshot={snapshot}
                      collapseScope={`history:${snapshot.id}`}
                      collapsedCardKeys={collapsedOutlineCardKeySet}
                      onToggleCard={toggleOutlineCard}
                      includeRejected
                    />
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div
              id={activeSection === 'chapters' ? 'planning-outline-panel-draft' : undefined}
              role={activeSection === 'chapters' ? 'tabpanel' : undefined}
              aria-labelledby={activeSection === 'chapters' ? 'planning-outline-tab-draft' : undefined}
              className="space-y-3"
            >
              {sectionRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-muted-foreground">
                  {activeSection === 'chapters' ? 'まだ仮目次はありません。まずは「部」または「章」から、決まっているところだけ作れば大丈夫です。' : 'まだ記録はありません。1件から始めてください。'}
                </div>
              ) : sectionRows.map(({ record, depth }) => {
            const siblings = activeSection === 'chapters'
              ? chapters
                .filter(chapter => chapter.status !== 'rejected' && chapter.parentId === record.parentId)
                .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
              : [];
            const siblingIndex = siblings.findIndex(chapter => chapter.id === record.id);
            const previousSibling = siblingIndex > 0 ? siblings[siblingIndex - 1] : null;
            const nextSibling = siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : null;
            const parent = activeSection === 'chapters' && record.parentId
              ? chapters.find(chapter => chapter.id === record.parentId)
              : null;
            const pathLabel = activeSection === 'chapters'
              ? chapterPathLabel(record, chapters, { includeSelf: false })
              : '';
            const hasChildren = activeSection === 'chapters'
              && chapters.some(chapter => chapter.parentId === record.id);
            const canAddChild = activeSection === 'chapters'
              && record.status !== 'approved'
              && record.status !== 'rejected'
              && record.nodeType !== 'section';
            const defaultChildType = record.nodeType === 'part' ? 'episode' : 'section';
            const duplicateBlocked = activeSection === 'chapters' && parent?.status === 'approved';
            const siblingLocation = parent
              ? `${getPlanningChapterNodeLabel(parent.nodeType)}「${parent.title || '無題'}」の中で`
              : '同じ階層で';
            const chapterQuestions = activeSection === 'chapters'
              ? questionsByChapterId.get(record.id) || []
              : [];
            const chapterManuscript = activeSection === 'chapters'
              ? manuscriptByChapterId.get(record.id)
              : undefined;
            const outlineCardKey = activeSection === 'chapters' ? `draft:${record.id}` : '';
            const outlineCardCollapsed = outlineCardKey
              ? collapsedOutlineCardKeySet.has(outlineCardKey)
              : false;
            const outlineItemLabel = activeSection === 'chapters'
              ? `${getPlanningChapterNodeLabel(record.nodeType)}「${record.title || '無題'}」`
              : '';
            return (
              <article
                key={record.id}
                data-planning-chapter-id={activeSection === 'chapters' ? record.id : undefined}
                data-chapter-depth={activeSection === 'chapters' ? depth : undefined}
                className={`rounded-xl p-4 ${activeSection === 'chapters' && depth > 0 ? 'border-l-4 border-l-neon-cyan/35' : ''}`}
                style={{
                  ...CARD_STYLE,
                  marginLeft: activeSection === 'chapters' ? `${Math.min(depth, 3) * 8}px` : undefined,
                }}
              >
                {activeSection === 'chapters' && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-neon-pink/30 bg-neon-pink/5 px-2 py-0.5 text-xs font-black text-neon-pink">
                          {getPlanningChapterNodeLabel(record.nodeType)}
                        </span>
                        {record.status === 'rejected' && <span className="text-xs font-black text-rose-200">採用しない（履歴）</span>}
                        <h3 className="break-words font-bold text-foreground">{recordTitle(activeSection, record)}</h3>
                        <StatusBadge status={record.status} />
                      </div>
                      <OutlineCardSummaryBadges
                        manuscript={chapterManuscript}
                        showManuscript={record.status !== 'rejected'}
                        questionCount={record.status !== 'rejected' ? chapterQuestions.length : 0}
                        childCount={hasChildren ? chapters.filter(chapter => chapter.parentId === record.id).length : 0}
                      />
                    </div>
                    <OutlineCardCollapseButton
                      cardKey={outlineCardKey}
                      collapsed={outlineCardCollapsed}
                      itemLabel={outlineItemLabel}
                      onToggle={toggleOutlineCard}
                    />
                  </div>
                )}
                <div
                  id={activeSection === 'chapters' ? outlineCardBodyId(outlineCardKey) : undefined}
                  hidden={activeSection === 'chapters' && outlineCardCollapsed}
                >
                  <div className={`${activeSection === 'chapters' ? 'mt-3 border-t border-white/10 pt-3' : ''} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`}>
                    <div className="min-w-0 flex-1">
                      {activeSection === 'chapters' && pathLabel && (
                        <p className="mb-2 flex min-w-0 items-start gap-1.5 break-words text-[11px] text-muted-foreground">
                          <CornerDownRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                          入っている場所：{pathLabel}
                        </p>
                      )}
                      {activeSection !== 'chapters' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-bold text-foreground">{recordTitle(activeSection, record)}</h3>
                          <StatusBadge status={record.status} />
                          {record.sourcePriority !== 'unspecified' && <span className="rounded-full border border-neon-cyan/25 px-2 py-0.5 text-[10px] text-neon-cyan">{PLANNING_SOURCE_PRIORITIES[record.sourcePriority]}</span>}
                          {activeSection === 'interviews' && <span className="rounded-full border border-amber-400/25 px-2 py-0.5 text-[10px] text-amber-200">{record.visibility === 'private' ? '非公開' : '公開候補'}</span>}
                        </div>
                      )}
                      {recordSummary(activeSection, record) && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{recordSummary(activeSection, record)}</p>}
                      {record.chapterIds.length > 0 && <p className="mt-2 break-words text-[11px] text-neon-cyan/80">紐づく構成：{record.chapterIds.map(id => chapterReferenceLabel(id, allChapters, activeChapterIds)).join('／')}</p>}
                      <p className="mt-2 break-all text-[10px] text-muted-foreground">ID: {record.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeSection === 'chapters' && record.status !== 'rejected' && <>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleMoveChapter(record, 'up')} disabled={busy || record.status === 'approved' || parent?.status === 'approved' || !previousSibling || previousSibling.status === 'approved'} className="min-h-11 min-w-11" aria-label={`${record.title || '無題の構成項目'}を${siblingLocation}上へ`}><ArrowUp className="h-4 w-4" /></Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleMoveChapter(record, 'down')} disabled={busy || record.status === 'approved' || parent?.status === 'approved' || !nextSibling || nextSibling.status === 'approved'} className="min-h-11 min-w-11" aria-label={`${record.title || '無題の構成項目'}を${siblingLocation}下へ`}><ArrowDown className="h-4 w-4" /></Button>
                      </>}
                      {canAddChild && (
                        <Button type="button" size="sm" variant="outline" onClick={() => openNewRecord('chapters', { nodeType: defaultChildType, parentId: record.id })} className="min-h-11 border-neon-pink/30 text-neon-pink"><CornerDownRight className="h-4 w-4" />この中に追加</Button>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={() => openDetail(activeSection, record)} className="min-h-11 border-white/15 text-foreground"><BookOpenText className="h-4 w-4" />内容を見る</Button>
                      {activeSection !== 'chapters' && <Button type="button" size="sm" variant="outline" onClick={() => openChapterLinkEditor(activeSection, record)} className="min-h-11 border-neon-cyan/30 text-neon-cyan"><Link2 className="h-4 w-4" />目次との紐づけだけ変更</Button>}
                      {record.status !== 'approved' && <Button type="button" size="sm" variant="outline" onClick={() => openEditRecord(activeSection, record)} className="min-h-11"><Pencil className="h-4 w-4" />編集</Button>}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openDuplicate(activeSection, record)}
                        disabled={busy || duplicateBlocked}
                        title={duplicateBlocked ? '本人承認済みの親項目には子を複製できません' : hasChildren ? 'この項目だけを複製し、中の項目は含めません' : undefined}
                        className="min-h-11 border-neon-cyan/30 text-neon-cyan"
                      >
                        <Copy className="h-4 w-4" />{activeSection === 'chapters' && hasChildren ? 'この項目だけ複製' : '複製'}
                      </Button>
                      {record.status !== 'approved' && <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(activeSection, record)} className="min-h-11 border-red-400/30 text-red-300"><Trash2 className="h-4 w-4" />削除</Button>}
                    </div>
                  </div>
                  {activeSection === 'chapters' && record.status !== 'rejected' && (chapterQuestions.length > 0 || !hasChildren) && (
                    <ChapterWritingQuestions
                      record={record}
                      questions={chapterQuestions}
                      onCopyInstruction={copyInstructionQuestion}
                      onOpenDetail={question => openDetail('instructionVersions', question)}
                      onAddQuestion={openNewQuestionForChapter}
                    />
                  )}
                  {activeSection === 'chapters' && record.status !== 'rejected' && (
                    <ChapterManuscriptControls
                      record={record}
                      manuscript={chapterManuscript}
                      busy={busy}
                      onToggleComplete={toggleChapterManuscriptComplete}
                      onEditLink={openManuscriptLinkEditor}
                    />
                  )}
                </div>
              </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {totalRecords > 0 && (query || typeFilter !== 'all' || chapterFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all') && (
        <section className="rounded-xl p-4" style={CARD_STYLE}>
          <h2 className="font-bold text-neon-cyan">検索結果</h2>
          <div className="mt-3 space-y-2">
            {searchResults.map(({ section, record }) => (
              <button
                key={`${section}-${record.id}`}
                type="button"
                onClick={() => {
                  const targetSection = section === 'conceptHistory' ? 'concept' : section;
                  selectActiveSection(targetSection);
                  if (section !== 'concept') openDetail(section, record);
                }}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-left hover:border-neon-cyan/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
              >
                <span className="min-w-0">
                  <span className="block text-[10px] text-muted-foreground">
                    {section === 'chapters'
                      ? `${activeChapterIds.has(record.id) ? '' : '旧目次 ／ '}${getPlanningChapterNodeLabel(record.nodeType)} ／ ${chapterPathLabel(record, allChapters, { includeSelf: false }) || '本全体の最上位'}`
                      : SECTION_META[section]?.label || '企画メモ履歴'}
                  </span>
                  <span className="block break-words text-sm font-bold text-foreground">{recordTitle(section, record)}</span>
                </span>
                <StatusBadge status={record.status} />
              </button>
            ))}
          </div>
        </section>
      )}

      {statusMessage && <p className="sr-only" aria-live="polite">{statusMessage}</p>}
      {instructionCopyFeedback?.surface === 'card' && (
        <div
          key={instructionCopyFeedback.sequence}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`fixed bottom-4 left-4 right-4 z-40 flex items-start gap-2 rounded-xl border p-3 pr-12 text-sm leading-relaxed shadow-2xl backdrop-blur sm:right-auto sm:max-w-md ${instructionCopyFeedback.tone === 'error'
            ? 'border-red-400/40 bg-[#2a151d]/95 text-red-100'
            : 'border-emerald-400/40 bg-[#10261f]/95 text-emerald-100'}`}
        >
          {instructionCopyFeedback.tone === 'error'
            ? <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            : <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />}
          <span>{instructionCopyFeedback.message}</span>
          <button
            type="button"
            onClick={() => setInstructionCopyFeedback(null)}
            className="absolute right-1 top-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-current/75 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            aria-label="コピー結果の通知を閉じる"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <input
        ref={marketImportInputRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        onChange={handleMarketImportFile}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <EditorDialog
        editor={editor?.projectId === project.id ? editor : null}
        planningData={data}
        chapters={chapters}
        allChapters={allChapters}
        activeChapterIds={activeChapterIds}
        busy={busy}
        onChange={draft => setEditor(current => ({ ...current, draft, dirty: true }))}
        onSave={saveEditor}
        onClose={() => { draftCacheRef.current.delete(project.id); setEditor(null); }}
      />
      <MarketSummaryDialog
        editor={marketEditor?.projectId === project.id ? marketEditor : null}
        competitors={newestCompetitors}
        busy={busy}
        onChange={draft => setMarketEditor(current => ({ ...current, draft, dirty: true }))}
        onSave={saveMarketSummary}
        onClose={() => setMarketEditor(null)}
      />
      <MarketImportPreviewDialog
        value={marketImport}
        busy={busy}
        onApply={applyMarketImport}
        onClose={() => setMarketImport(null)}
      />
      <OutlineSnapshotDialog
        value={outlineDialog?.projectId === project.id ? outlineDialog : null}
        busy={busy}
        onChange={setOutlineDialog}
        onSave={saveOutlineSnapshot}
        onClose={() => setOutlineDialog(null)}
      />
      <OutlineRewriteDialog
        value={outlineRewrite?.projectId === project.id ? outlineRewrite : null}
        busy={busy}
        onChange={setOutlineRewrite}
        onNext={continueOutlineRewrite}
        onApply={applyOutlineRewrite}
        onCopyPrompt={copyOutlineRewritePrompt}
        onClose={closeOutlineRewrite}
      />
      <ChapterLinkDialog
        value={chapterLinkEditor?.projectId === project.id ? chapterLinkEditor : null}
        chapterRows={chapterRows}
        allChapters={allChapters}
        activeChapterIds={activeChapterIds}
        busy={busy}
        onChange={setChapterLinkEditor}
        onSave={saveChapterLinks}
        onClose={() => setChapterLinkEditor(null)}
      />
      <ManuscriptLinkDialog
        value={manuscriptLinkEditor?.projectId === project.id ? manuscriptLinkEditor : null}
        busy={busy}
        returnFocusRef={manuscriptLinkReturnFocusRef}
        onChange={setManuscriptLinkEditor}
        onSave={saveManuscriptDocumentUrl}
        onClose={closeManuscriptLinkEditor}
      />
      <RecordDetailDialog
        detail={detail?.projectId === project.id ? detail : null}
        chapters={allChapters}
        activeChapterIds={activeChapterIds}
        copyFeedback={instructionCopyFeedback}
        onCopyInstruction={copyInstructionQuestion}
        onEditChapterLinks={openChapterLinkEditor}
        onClose={() => { setDetail(null); setInstructionCopyFeedback(null); }}
      />

      <section className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 p-4 text-xs leading-relaxed text-muted-foreground">
        <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-neon-cyan" /><p><span className="font-bold text-foreground">保存と共有について：</span>通常バックアップには全記録が含まれます。「共有用」は非公開取材を除外します。章ごとの原稿完成チェックと原稿URLは完全バックアップに含まれますが、共有用JSON／MarkdownからURLは除外します。外部サービスの原稿本文を同期・保存する機能ではありません。市場調査の正本Markdownだけは、内容確認と差分プレビュー後に追加できます。任意形式のJSON／Markdownや添付ファイル本体は自動取込せず、既存承認版を無断で上書きしません。完全バックアップは上部の「データ管理」から保存してください。</p></div>
        {onNavigateTab && <button type="button" onClick={() => onNavigateTab('manual')} className="mt-2 min-h-11 font-bold text-neon-cyan underline underline-offset-4">使い方マニュアルを確認</button>}
      </section>
    </div>
  );
}
