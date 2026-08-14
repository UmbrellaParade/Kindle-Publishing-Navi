import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpenText,
  ClipboardList,
  Copy,
  Download,
  FileSearch,
  FileText,
  History,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
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
  PLANNING_NOTE_STATUSES,
  PLANNING_NOTES_WARNING_BYTES,
  PLANNING_SOURCE_PRIORITIES,
  buildPlanningNotesSharePackage,
  createPlanningRecord,
  deletePlanningRecord,
  duplicatePlanningRecord,
  estimatePlanningNotesBytes,
  filterPlanningNotes,
  findPlanningNotesSensitiveData,
  movePlanningChapter,
  planningNotesShareToMarkdown,
  readPlanningNotes,
  savePlanningConcept,
  serializePlanningNotes,
  upsertPlanningRecord,
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
    ['findings', 'レビュー等から分かったこと', 'textarea'],
    ['differentiation', 'こちらとの差別化', 'textarea'],
    ['claimKind', '情報の区分', 'select', '', { fact: '事実', hypothesis: '仮説', mixed: '事実と仮説が混在' }],
    ['sourceQuoteNotes', '出典・引用の注意', 'textarea'],
    ['recheckStatus', '再確認状態', 'select', '', { needs_recheck: '要再確認', checked: '確認済み', not_required: '再確認不要' }],
  ],
  chapters: [
    ['title', '章タイトル', 'text'],
    ['role', 'この章の役割', 'textarea'],
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
  if (section === 'chapters') return record.title || '無題の章';
  if (section === 'interviews') return record.question || '質問未入力の取材';
  if (section === 'instructionVersions') return `${record.name || '無題の指示書'} v${record.versionNumber}`;
  return record.decision || '未入力の意思決定';
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

function RecordDetailDialog({ detail, chapters, onClose }) {
  const record = detail?.record;
  const section = detail?.section === 'conceptHistory' ? 'concept' : detail?.section;
  const fields = FORM_FIELDS[section] || [];
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
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-muted-foreground">
                {PLANNING_SOURCE_PRIORITIES[record.sourcePriority] || '未設定'}
              </span>
              {detail.section === 'instructionVersions' && (
                <span className="text-[10px] text-muted-foreground">v{record.versionNumber} ／ 系列ID: {record.documentId}</span>
              )}
            </div>
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
                <p className="text-[10px] font-bold text-neon-cyan">紐づく章</p>
                <p className="mt-1 text-sm text-foreground">
                  {record.chapterIds.map(id => chapters.find(chapter => chapter.id === id)?.title || id).join('／')}
                </p>
              </div>
            )}
            <p className="break-all text-[10px] text-muted-foreground">ID: {record.id}</p>
          </div>
        )}
        <DialogFooter className="border-t border-[#2a2a4a] bg-[#121222] px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} className="min-h-11">閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditorDialog({ editor, chapters, busy, onChange, onSave, onClose }) {
  const draft = editor?.draft;
  const section = editor?.section;
  const fields = FORM_FIELDS[section] || [];
  const dirty = Boolean(editor?.dirty);

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
              <legend className="px-1 text-xs font-bold text-foreground">紐づく章</legend>
              {chapters.length === 0 ? (
                <p className="text-xs text-muted-foreground">先に「目次・章構成」で章を作ると紐づけられます。</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {chapters.map(chapter => {
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
                        {chapter.title || '無題の章'}
                      </label>
                    );
                  })}
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

export default function PlanningNotesTab({ project, onProjectUpdate, onNavigateTab }) {
  const [initialRead] = useState(() => readPlanningNotes(project?.planning_notes));
  const [data, setData] = useState(initialRead.data);
  const [loadError, setLoadError] = useState(initialRead.error);
  const [activeSection, setActiveSection] = useState('overview');
  const [editor, setEditor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const activeProjectIdRef = useRef(project?.id || '');
  const operationGenerationRef = useRef(0);
  const draftCacheRef = useRef(new Map());

  useEffect(() => {
    activeProjectIdRef.current = project?.id || '';
    operationGenerationRef.current += 1;
    setBusy(false);
    setStatusMessage('');
    const parsed = readPlanningNotes(project?.planning_notes);
    setData(parsed.data);
    setLoadError(parsed.error);
    setEditor(draftCacheRef.current.get(project?.id || '') || null);
    setDetail(null);
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

  const chapters = useMemo(
    () => [...data.chapters].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
    [data.chapters],
  );
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

  const canApplyResult = (projectId, generation) => (
    activeProjectIdRef.current === projectId && operationGenerationRef.current === generation
  );

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

  const openNewRecord = (section) => {
    const values = section === 'chapters'
      ? { order: Math.max(-1, ...data.chapters.map(chapter => chapter.order)) + 1 }
      : {};
    const draft = createPlanningRecord(section, values);
    setEditor({
      projectId: project.id,
      section,
      title: section === 'interviews' ? '次の1問を記録' : `${SECTION_META[section].label}を追加`,
      draft,
      dirty: false,
      expectedUpdatedAt: null,
      initialStatus: 'draft',
      forkApproved: false,
      externalConflict: false,
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

  const openDuplicate = (section, record) => {
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
      if (editor.section === 'chapters' && !editor.draft.title?.trim()) return '章タイトルを入力してください';
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
    const sensitive = findPlanningNotesSensitiveData(editor.draft);
    if (sensitive.length > 0) {
      toast.error(`${sensitive[0].label}を検出したため保存を停止しました。APIキー・認証情報・非公開会話URLは削除してください`);
      return;
    }
    if (editor.section === 'concept') {
      await persist(current => savePlanningConcept(current, editor.draft, {
        expectedUpdatedAt: editor.expectedUpdatedAt,
        forkApproved: editor.forkApproved,
      }), editor.forkApproved ? '承認済みの企画を履歴へ残し、新しい案を保存しました' : '企画メモを保存しました');
      return;
    }
    await persist(current => upsertPlanningRecord(current, editor.section, editor.draft, {
      expectedUpdatedAt: editor.expectedUpdatedAt,
    }), editor.section === 'interviews' ? 'この1問を保存しました' : 'ノートを保存しました');
  };

  const handleDelete = async (section, record) => {
    if (!globalThis.window.confirm(`「${recordTitle(section, record)}」を削除しますか？\n\n本人承認済みの項目は削除できません。`)) return;
    await persist(current => deletePlanningRecord(current, section, record.id, {
      expectedUpdatedAt: record.updatedAt,
    }), 'ノートを削除しました', { closeEditor: false });
  };

  const handleMoveChapter = async (record, direction) => {
    const next = await persist(current => movePlanningChapter(current, record.id, direction, {
      expectedRevision: data.chapterOrderRevision,
    }), `「${record.title || '無題の章'}」を${direction === 'up' ? '上' : '下'}へ移動しました`, { closeEditor: false });
    if (next) setData(next);
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
    setDetail({ projectId: project.id, section, record });
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

  const sectionRecords = activeSection === 'concept'
    ? []
    : activeSection === 'overview'
      ? []
      : activeSection === 'chapters'
        ? [
          ...chapters.filter(chapter => chapter.status !== 'rejected'),
          ...chapters.filter(chapter => chapter.status === 'rejected'),
        ]
        : [...(data[activeSection] || [])].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));

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

      <nav aria-label="企画ノート内の項目" className="grid grid-cols-2 gap-2 rounded-xl border border-[#2a2a4a] bg-[#151529] p-2 sm:grid-cols-4 lg:grid-cols-7">
        {Object.entries(SECTION_META).map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              aria-current={activeSection === key ? 'page' : undefined}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-center text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 ${activeSection === key ? 'border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan' : 'border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />{meta.label}
            </button>
          );
        })}
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
              <select aria-label="章で絞り込み" value={chapterFilter} onChange={event => setChapterFilter(event.target.value)} className={INPUT_CLASS}>
                <option value="all">すべての章</option><option value="unlinked">章未紐づけ</option>
                {chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title || '無題の章'}</option>)}
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
            <Button type="button" variant="ghost" className="mt-2 min-h-11 text-xs" onClick={() => { setQuery(''); setTypeFilter('all'); setChapterFilter('all'); setStatusFilter('all'); setPriorityFilter('all'); }}>
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
                <Button type="button" onClick={() => { setActiveSection('concept'); openConcept(); }} className="min-h-14 bg-neon-cyan/20 text-neon-cyan"><Lightbulb />企画メモを書く</Button>
                <Button type="button" variant="outline" onClick={() => { setActiveSection('chapters'); openNewRecord('chapters'); }} className="min-h-14 border-neon-pink/35 text-neon-pink"><ClipboardList />章を1つ作る</Button>
                <Button type="button" variant="outline" onClick={() => { setActiveSection('interviews'); openNewRecord('interviews'); }} className="min-h-14 border-amber-400/35 text-amber-200"><MessageSquareText />取材を1問記録</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(SECTION_META).filter(([key]) => !['overview'].includes(key)).map(([key, meta]) => {
                const count = key === 'concept' ? (data.concept.revision > 0 ? 1 : 0) : data[key].length;
                const Icon = meta.icon;
                return (
                  <button key={key} type="button" onClick={() => setActiveSection(key)} className="min-h-28 rounded-xl border border-[#2a2a4a] bg-[#1a1a2e] p-4 text-left transition hover:border-neon-cyan/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80">
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

      {!['overview', 'concept'].includes(activeSection) && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl p-4" style={CARD_STYLE}>
            <div><h2 className="text-lg font-black text-neon-cyan">{SECTION_META[activeSection].label}</h2><p className="mt-1 text-xs text-muted-foreground">本人承認済みは直接上書きせず、新しい案・新しい版として残します。</p></div>
            <Button type="button" onClick={() => openNewRecord(activeSection)} className="min-h-11 gap-2 bg-neon-cyan/20 text-neon-cyan"><Plus />{activeSection === 'interviews' ? '次の1問を記録' : '新しく追加'}</Button>
          </div>

          {sectionRecords.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-muted-foreground">まだ記録はありません。1件から始めてください。</div>
          ) : sectionRecords.map((record, index) => (
            <article key={record.id} className="rounded-xl p-4" style={CARD_STYLE}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeSection === 'chapters' && (
                      <span className="text-xs font-black text-neon-pink">
                        {record.status === 'rejected'
                          ? '採用しない（履歴）'
                          : `第${sectionRecords.slice(0, index + 1).filter(chapter => chapter.status !== 'rejected').length}章`}
                      </span>
                    )}
                    <h3 className="break-words font-bold text-foreground">{recordTitle(activeSection, record)}</h3>
                    <StatusBadge status={record.status} />
                    {record.sourcePriority !== 'unspecified' && <span className="rounded-full border border-neon-cyan/25 px-2 py-0.5 text-[10px] text-neon-cyan">{PLANNING_SOURCE_PRIORITIES[record.sourcePriority]}</span>}
                    {activeSection === 'interviews' && <span className="rounded-full border border-amber-400/25 px-2 py-0.5 text-[10px] text-amber-200">{record.visibility === 'private' ? '非公開' : '公開候補'}</span>}
                  </div>
                  {recordSummary(activeSection, record) && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{recordSummary(activeSection, record)}</p>}
                  {record.chapterIds.length > 0 && <p className="mt-2 text-[11px] text-neon-cyan/80">章：{record.chapterIds.map(id => chapters.find(chapter => chapter.id === id)?.title || id).join('／')}</p>}
                  <p className="mt-2 break-all text-[10px] text-muted-foreground">ID: {record.id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeSection === 'chapters' && record.status !== 'rejected' && <>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleMoveChapter(record, 'up')} disabled={busy || index === 0 || record.status === 'approved' || sectionRecords[index - 1]?.status === 'approved'} className="min-h-11" aria-label={`${record.title || '無題の章'}を上へ`}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleMoveChapter(record, 'down')} disabled={busy || index === sectionRecords.filter(chapter => chapter.status !== 'rejected').length - 1 || record.status === 'approved' || sectionRecords[index + 1]?.status === 'approved'} className="min-h-11" aria-label={`${record.title || '無題の章'}を下へ`}><ArrowDown className="h-4 w-4" /></Button>
                  </>}
                  <Button type="button" size="sm" variant="outline" onClick={() => openDetail(activeSection, record)} className="min-h-11 border-white/15 text-foreground"><BookOpenText className="h-4 w-4" />内容を見る</Button>
                  {record.status !== 'approved' && <Button type="button" size="sm" variant="outline" onClick={() => openEditRecord(activeSection, record)} className="min-h-11"><Pencil className="h-4 w-4" />編集</Button>}
                  <Button type="button" size="sm" variant="outline" onClick={() => openDuplicate(activeSection, record)} className="min-h-11 border-neon-cyan/30 text-neon-cyan"><Copy className="h-4 w-4" />{activeSection === 'instructionVersions' ? '新しい版' : '複製'}</Button>
                  {record.status !== 'approved' && <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(activeSection, record)} className="min-h-11 border-red-400/30 text-red-300"><Trash2 className="h-4 w-4" />削除</Button>}
                </div>
              </div>
            </article>
          ))}
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
                  setActiveSection(targetSection);
                  if (section !== 'concept') openDetail(section, record);
                }}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-left hover:border-neon-cyan/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"
              >
                <span><span className="block text-[10px] text-muted-foreground">{SECTION_META[section]?.label || '企画メモ履歴'}</span><span className="block text-sm font-bold text-foreground">{recordTitle(section, record)}</span></span>
                <StatusBadge status={record.status} />
              </button>
            ))}
          </div>
        </section>
      )}

      {statusMessage && <p className="sr-only" aria-live="polite">{statusMessage}</p>}
      <EditorDialog
        editor={editor?.projectId === project.id ? editor : null}
        chapters={chapters}
        busy={busy}
        onChange={draft => setEditor(current => ({ ...current, draft, dirty: true }))}
        onSave={saveEditor}
        onClose={() => { draftCacheRef.current.delete(project.id); setEditor(null); }}
      />
      <RecordDetailDialog
        detail={detail?.projectId === project.id ? detail : null}
        chapters={chapters}
        onClose={() => setDetail(null)}
      />

      <section className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 p-4 text-xs leading-relaxed text-muted-foreground">
        <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-neon-cyan" /><p><span className="font-bold text-foreground">保存と共有について：</span>通常バックアップには全記録が含まれます。「共有用」は非公開取材を除外します。JSON／Markdownの自動取込と添付ファイル本体はまだ行わず、既存承認版を無断で上書きしません。完全バックアップは上部の「データ管理」から保存してください。</p></div>
        {onNavigateTab && <button type="button" onClick={() => onNavigateTab('manual')} className="mt-2 min-h-11 font-bold text-neon-cyan underline underline-offset-4">使い方マニュアルを確認</button>}
      </section>
    </div>
  );
}
