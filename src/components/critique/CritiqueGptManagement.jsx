import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  PauseCircle,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import PlanningGptHandoffPreparationCard from '@/components/gpt/PlanningGptHandoffPreparationCard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { mutatePublishingProject } from '@/lib/projectMutation';
import { flushPendingSaves } from '@/lib/saveCoordinator';
import {
  PLANNING_CRITIQUE_GPT_SESSION_STATUSES,
  activatePlanningCritiqueGptSession,
  createPlanningCritiqueGptHandoffTarget,
  createPlanningCritiqueGptSessionRecord,
  deletePlanningCritiqueGptSession,
  getNextPlanningCritiqueGptManagementId,
  readPlanningNotes,
  serializePlanningNotes,
  sortPlanningCritiqueGptSessions,
  updatePlanningGptHandoffTemplates,
  upsertPlanningCritiqueGptSession,
  validatePlanningCritiqueGptSessionUrl,
} from '@/lib/planningNotes';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_CLASS = 'min-h-11 w-full rounded-md border border-[#34345a] bg-[#101020] px-3 py-2 text-sm text-foreground outline-none transition focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/50 disabled:opacity-60';
const TEXTAREA_CLASS = `${INPUT_CLASS} min-h-28 resize-y leading-relaxed`;
const CRITIQUE_HANDOFF_MEMO_TEMPLATE = `対象原稿版ID：
論評回：
前回指摘：
未対応指摘：
現在地：
確定事項：
未確定事項：
次の一手：`;

const CRITIQUE_GPT_SPREADSHEET_FIELDS = Object.freeze([
  ['managementId', '辛口論評GPT管理ID', 'text'],
  ['sessionName', 'セッション名', 'text'],
  ['gptUrl', '辛口論評GPT URL', 'url'],
  ['scope', '担当範囲', 'textarea'],
  ['sessionStatus', '状態', 'select'],
  ['startedOn', '開始日', 'date'],
  ['targetManuscriptVersionId', '対象原稿版ID', 'text'],
  ['critiqueRound', '論評回', 'number'],
  ['handoffToId', '引継ぎ先ID', 'handoff'],
  ['handoffMemo', '引継ぎメモ', 'textarea'],
  ['notes', '備考', 'textarea'],
]);

const CRITIQUE_GPT_STATUS_META = Object.freeze({
  active: { label: '使用中', icon: CheckCircle2, tone: 'border-emerald-400/45 bg-emerald-400/10 text-emerald-200' },
  handed_over: { label: '引継ぎ済み', icon: ArrowRightLeft, tone: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100' },
  completed: { label: '完了', icon: ShieldCheck, tone: 'border-slate-400/35 bg-slate-400/10 text-slate-200' },
  on_hold: { label: '保留', icon: PauseCircle, tone: 'border-amber-400/40 bg-amber-400/10 text-amber-200' },
});

function CritiqueGptStatusBadge({ value }) {
  const meta = CRITIQUE_GPT_STATUS_META[value] || {
    label: PLANNING_CRITIQUE_GPT_SESSION_STATUSES[value] || '状態未設定',
    icon: AlertTriangle,
    tone: 'border-white/15 bg-white/5 text-muted-foreground',
  };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${meta.tone}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />{meta.label}
    </span>
  );
}

function CritiqueGptEditorDialog({ editor, sessions, busy, onChange, onSave, onClose }) {
  const draft = editor?.draft;
  const dirty = Boolean(editor?.dirty);
  const titleInputRef = useRef(null);
  const returnFocusNodeRef = useRef(null);
  const wasOpenRef = useRef(false);
  const otherActiveSession = sessions.find(session => (
    session.sessionStatus === 'active' && session.id !== draft?.id
  ));

  const restoreReturnFocus = () => {
    const target = returnFocusNodeRef.current;
    if (target?.isConnected) target.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (editor) {
      wasOpenRef.current = true;
      returnFocusNodeRef.current = editor.returnFocusNode?.isConnected
        ? editor.returnFocusNode
        : null;
      return undefined;
    }
    if (!wasOpenRef.current) return undefined;
    wasOpenRef.current = false;
    const frameId = window.requestAnimationFrame(restoreReturnFocus);
    return () => window.cancelAnimationFrame(frameId);
  }, [editor]);

  const requestClose = () => {
    if (dirty && !globalThis.window.confirm('まだ保存していない入力があります。閉じてもよいですか？')) return;
    onClose();
  };
  const update = (field, value) => onChange(field, value);

  return (
    <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent
        className="flex max-h-[92dvh] max-w-3xl flex-col overflow-hidden p-0"
        style={{ background: '#151527', border: '1px solid #2a2a4a' }}
        onOpenAutoFocus={event => {
          event.preventDefault();
          window.requestAnimationFrame(() => titleInputRef.current?.focus());
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          restoreReturnFocus();
        }}
      >
        <DialogHeader className="border-b border-[#2a2a4a] px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 text-neon-pink">
            <Bot className="h-5 w-5" aria-hidden="true" />{editor?.mode === 'edit' ? '辛口論評GPTセッションを編集' : '辛口論評GPTセッションを登録'}
          </DialogTitle>
          <DialogDescription>スプレッドシートへ転記しやすい11項目の順番です。保存するまで既存データは変わりません。</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {editor?.externalConflict && (
            <div role="alert" className="flex gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              別の画面でこのセッションが更新されました。保存せず、最新表示を確認してください。
            </div>
          )}
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100">
            辛口論評GPT管理のURL・引継ぎメモ・備考は端末内と完全バックアップだけに保存され、共有用JSON／Markdownから除外されます。APIキー・パスワード・認証トークンは保存しないでください。
          </div>

          {CRITIQUE_GPT_SPREADSHEET_FIELDS.map(([field, label, type], index) => {
            const inputId = `critique-gpt-session-${field}`;
            const helpId = `${inputId}-help`;
            const handoffLockedField = editor?.mode === 'handoff' && ['sessionStatus', 'handoffToId'].includes(field);
            const hasHelp = ['managementId', 'gptUrl', 'handoffMemo', 'sessionStatus'].includes(field) || handoffLockedField;
            const rawValue = draft?.[field];
            const value = field === 'critiqueRound' ? (rawValue || '') : (rawValue ?? '');
            const common = {
              id: inputId,
              value,
              onChange: event => update(
                field,
                field === 'critiqueRound'
                  ? event.target.value === '' ? 0 : Number(event.target.value)
                  : event.target.value,
              ),
              className: type === 'textarea' ? TEXTAREA_CLASS : INPUT_CLASS,
              'aria-describedby': hasHelp ? helpId : undefined,
            };
            return (
              <div key={field} className="block space-y-1.5 text-xs font-bold text-foreground">
                <label htmlFor={inputId} className="block">{index + 1}. {label}</label>
                {field === 'managementId' && <span id={helpId} className="block font-normal leading-relaxed text-muted-foreground">次のCRITIQUE連番を自動提案します。既存記録のIDは変更できません。</span>}
                {field === 'gptUrl' && <span id={helpId} className="block font-normal leading-relaxed text-muted-foreground">この管理画面だけに保存する非公開URLです。https:// で始まるURLを入力します。</span>}
                {field === 'handoffMemo' && <span id={helpId} className="block font-normal leading-relaxed text-muted-foreground">対象版・論評回・前回指摘・未対応指摘・現在地・次の一手を短く残します。</span>}
                {field === 'sessionStatus' && !handoffLockedField && otherActiveSession && <span id={helpId} className="block font-normal leading-relaxed text-muted-foreground">「使用中」は1件だけです。引継ぎ先はカードの「このGPTを使用中にする」で切り替えます。</span>}
                {handoffLockedField && <span id={helpId} className="block font-normal leading-relaxed text-muted-foreground">引継ぎを受領するまでは「保留・引継ぎ先なし」で登録します。受領後にカードから使用中へ切り替えます。</span>}
                {type === 'textarea' ? (
                  <>
                    {field === 'handoffMemo' && !draft?.handoffMemo && (
                      <Button type="button" size="sm" variant="outline" onClick={() => update('handoffMemo', CRITIQUE_HANDOFF_MEMO_TEMPLATE)} className="min-h-11 border-neon-pink/30 text-neon-pink">
                        <Pencil className="h-4 w-4" aria-hidden="true" />8項目のひな形を入れる
                      </Button>
                    )}
                    <textarea {...common} />
                  </>
                ) : type === 'select' ? (
                  <select {...common} disabled={handoffLockedField}>
                    {Object.entries(PLANNING_CRITIQUE_GPT_SESSION_STATUSES).map(([optionValue, optionLabel]) => (
                      <option key={optionValue} value={optionValue} disabled={optionValue === 'active' && Boolean(otherActiveSession)}>{optionLabel}</option>
                    ))}
                  </select>
                ) : type === 'handoff' ? (
                  <select {...common} disabled={handoffLockedField}>
                    <option value="">引継ぎ先なし</option>
                    {sessions.filter(session => session.id !== draft?.id).map(session => (
                      <option key={session.id} value={session.managementId}>{session.managementId}：{session.sessionName || '名称未設定'}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...common}
                    ref={(editor?.mode === 'edit' ? field === 'sessionName' : field === 'managementId') ? titleInputRef : undefined}
                    type={type}
                    onInput={type === 'date' ? event => {
                      if (event.currentTarget.value) update(field, event.currentTarget.value);
                    } : undefined}
                    min={type === 'number' ? 1 : undefined}
                    disabled={field === 'managementId' && editor?.mode === 'edit'}
                    autoComplete="off"
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-[#2a2a4a] bg-[#121222] px-5 py-4 sm:flex-row sm:space-x-0">
          <Button type="button" variant="outline" onClick={requestClose} disabled={busy} className="min-h-11">キャンセル</Button>
          <Button type="button" onClick={onSave} disabled={busy || editor?.externalConflict} className="min-h-11 gap-2 bg-neon-pink/20 text-neon-pink hover:bg-neon-pink/30">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {busy ? '保存中…' : '辛口論評GPTを保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatFindingBlocks(entry, { unresolvedOnly = false } = {}) {
  if (!entry) return '未設定';
  if (unresolvedOnly && ['completed', 'deferred'].includes(entry.responseStatus)) return 'なし';
  const categoryLabels = {
    mustFix: '必ず直す',
    readerCheck: '読者確認',
    authorJudgment: '著者判断',
    deferred: '見送る',
  };
  const categoryKeys = unresolvedOnly
    ? ['mustFix', 'readerCheck', 'authorJudgment']
    : ['mustFix', 'readerCheck', 'authorJudgment', 'deferred'];
  const categorized = categoryKeys
    .map(key => {
      const text = String(entry.findingCategories?.[key] || '').trim();
      return text ? `【${categoryLabels[key]}】\n${text}` : '';
    })
    .filter(Boolean);
  if (categorized.length > 0) return categorized.join('\n\n');
  const fixes = (entry.priorityFixes || []).map(value => String(value || '').trim()).filter(Boolean);
  return fixes.length > 0 ? fixes.map((value, index) => `${index + 1}. ${value}`).join('\n') : '未設定';
}

export default function CritiqueGptManagement({ project, onProjectUpdate, entries = [] }) {
  const initialParsed = useMemo(() => readPlanningNotes(project?.planning_notes), [project?.id]);
  const [data, setData] = useState(initialParsed.data);
  const [loadError, setLoadError] = useState(initialParsed.error?.message || '');
  const [sortOrder, setSortOrder] = useState('newest');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  const [pendingFocus, setPendingFocus] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const activeProjectIdRef = useRef(project?.id || '');
  const operationGenerationRef = useRef(0);

  activeProjectIdRef.current = project?.id || '';

  useEffect(() => {
    const parsed = readPlanningNotes(project?.planning_notes);
    setData(parsed.data);
    setLoadError(parsed.error?.message || '');
    setBusy(false);
    setPendingFocus('');
    setStatusMessage('');
    setEditor(current => {
      if (!current || current.projectId !== project?.id) return null;
      if (current.mode === 'create' || current.mode === 'handoff') return current;
      const latest = parsed.data.critiqueGptSessions?.find(record => record.id === current.draft.id);
      if (!latest || latest.updatedAt === current.expectedUpdatedAt) return current;
      return { ...current, externalConflict: true };
    });
  }, [project?.id, project?.planning_notes]);

  const sessions = data.critiqueGptSessions || [];
  const activeSession = sessions.find(record => record.sessionStatus === 'active');
  const nextManagementId = useMemo(
    () => getNextPlanningCritiqueGptManagementId(data),
    [data],
  );
  const latestEntry = entries[0] || null;
  const extraTemplateValues = useMemo(() => ({
    targetManuscriptVersionId: activeSession?.targetManuscriptVersionId || latestEntry?.manuscriptLabel || '未設定',
    critiqueRound: activeSession?.critiqueRound || entries.length || '未設定',
    previousFindings: formatFindingBlocks(latestEntry),
    unresolvedFindings: formatFindingBlocks(latestEntry, { unresolvedOnly: true }),
  }), [activeSession?.critiqueRound, activeSession?.targetManuscriptVersionId, entries.length, latestEntry]);

  useEffect(() => {
    if (!pendingFocus) return undefined;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const record = pendingFocus === '__list__'
          ? null
          : data.critiqueGptSessions?.find(session => session.managementId === pendingFocus);
        const target = pendingFocus === '__list__'
          ? document.getElementById('critique-gptSessions-list-title')
          : record ? document.getElementById(`critique-gptSessions-${record.id}`) : null;
        target?.scrollIntoView({
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
        target?.focus({ preventScroll: true });
        setPendingFocus('');
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [data.critiqueGptSessions, pendingFocus]);

  const persist = async (buildNext, successMessage) => {
    if (!project?.id || busy || loadError) return null;
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
        return {
          planning_notes: serializePlanningNotes(nextData, { enforceStorageBudget: true }),
        };
      }, project);
      await onProjectUpdate?.(updated);
      if (activeProjectIdRef.current === targetProjectId && operationGenerationRef.current === generation) {
        setData(nextData);
        setStatusMessage(successMessage);
        toast.success(successMessage);
      }
      return nextData;
    } catch (error) {
      if (activeProjectIdRef.current === targetProjectId && operationGenerationRef.current === generation) {
        const message = error?.message || '辛口論評GPT管理を保存できませんでした';
        setStatusMessage(message);
        toast.error(message);
      }
      return null;
    } finally {
      if (activeProjectIdRef.current === targetProjectId && operationGenerationRef.current === generation) {
        setBusy(false);
      }
    }
  };

  const openNewSession = returnFocusNode => {
    const draft = createPlanningCritiqueGptSessionRecord(data, {
      managementId: nextManagementId,
      sessionStatus: activeSession ? 'on_hold' : 'active',
      targetManuscriptVersionId: latestEntry?.manuscriptLabel || '',
      critiqueRound: entries.length > 0 ? entries.length : 0,
    });
    setEditor({
      projectId: project.id,
      mode: 'create',
      draft,
      dirty: false,
      expectedUpdatedAt: null,
      externalConflict: false,
      returnFocusNode: returnFocusNode || document.activeElement,
    });
  };

  const openHandoffTarget = (source, returnFocusNode) => {
    const draft = createPlanningCritiqueGptSessionRecord(data, {
      managementId: nextManagementId,
      sessionStatus: 'on_hold',
      scope: source.scope,
      targetManuscriptVersionId: source.targetManuscriptVersionId,
      critiqueRound: source.critiqueRound,
      handoffMemo: CRITIQUE_HANDOFF_MEMO_TEMPLATE,
    });
    setEditor({
      projectId: project.id,
      mode: 'handoff',
      handoffSourceId: source.id,
      sourceExpectedUpdatedAt: source.updatedAt,
      draft,
      dirty: false,
      expectedUpdatedAt: null,
      externalConflict: false,
      returnFocusNode: returnFocusNode || document.activeElement,
    });
  };

  const openEditSession = (record, returnFocusNode) => setEditor({
    projectId: project.id,
    mode: 'edit',
    draft: { ...record },
    dirty: false,
    expectedUpdatedAt: record.updatedAt,
    externalConflict: false,
    returnFocusNode: returnFocusNode || document.activeElement,
  });

  const saveSession = async () => {
    if (!editor || editor.projectId !== project.id) return;
    if (!editor.draft.managementId?.trim()) {
      toast.error('辛口論評GPT管理IDを入力してください');
      return;
    }
    if (!editor.draft.sessionName?.trim()) {
      toast.error('セッション名を入力してください');
      return;
    }
    let validatedUrl;
    try {
      validatedUrl = validatePlanningCritiqueGptSessionUrl(editor.draft.gptUrl);
    } catch (error) {
      toast.error(error?.message || '辛口論評GPT URLを確認してください');
      return;
    }
    const managementId = editor.draft.managementId;
    const returnFocusNode = editor.returnFocusNode;
    const draft = { ...editor.draft, gptUrl: validatedUrl };
    const next = await persist(current => (
      editor.mode === 'handoff'
        ? createPlanningCritiqueGptHandoffTarget(current, editor.handoffSourceId, draft, {
          expectedUpdatedAt: editor.sourceExpectedUpdatedAt,
        })
        : upsertPlanningCritiqueGptSession(current, draft, {
          expectedUpdatedAt: editor.expectedUpdatedAt,
        })
    ), editor.mode === 'handoff'
      ? '新しい辛口論評GPTを保留として登録しました'
      : '辛口論評GPTセッションを保存しました');
    if (!next) return;
    setEditor(null);
    setPendingFocus(managementId);
    window.requestAnimationFrame(() => returnFocusNode?.focus?.({ preventScroll: true }));
  };

  const activateSession = async record => {
    if (!globalThis.window.confirm(`「${record.managementId} ${record.sessionName || ''}」を現在使う辛口論評GPTにしますか？\n\n前の使用中セッションは「引継ぎ済み」になり、記録は残ります。`)) return;
    const source = sessions.find(session => session.sessionStatus === 'active');
    const next = await persist(current => activatePlanningCritiqueGptSession(current, record.id, {
      expectedTargetUpdatedAt: record.updatedAt,
      expectedSourceUpdatedAt: source?.updatedAt,
    }), '新しい辛口論評GPTを使用中にし、前のGPTを引継ぎ済みにしました');
    if (next) setPendingFocus(record.managementId);
  };

  const deleteSession = async record => {
    if (!globalThis.window.confirm(`「${record.managementId} ${record.sessionName || ''}」を削除しますか？\n\n使用中や引継ぎ関係にある記録は削除せず停止します。`)) return;
    const sorted = sortPlanningCritiqueGptSessions(sessions, { direction: sortOrder });
    const index = sorted.findIndex(session => session.id === record.id);
    const focusAfterDelete = sorted[index + 1] || sorted[index - 1] || null;
    const next = await persist(current => deletePlanningCritiqueGptSession(current, record.id, {
      expectedUpdatedAt: record.updatedAt,
    }), '辛口論評GPTセッションを削除しました');
    if (next) setPendingFocus(focusAfterDelete?.managementId || '__list__');
  };

  const saveHandoffTemplate = (draft, expectedUpdatedAt) => persist(
    current => updatePlanningGptHandoffTemplates(current, 'critique', draft, {
      expectedUpdatedAt,
    }),
    '辛口論評GPTの引継ぎ文章を保存しました',
  );

  const sortedSessions = sortPlanningCritiqueGptSessions(sessions, { direction: sortOrder });
  const incomingTargetIds = new Set(sessions.map(record => record.handoffToId).filter(Boolean));

  return (
    <section className="space-y-4" aria-labelledby="critique-gpt-management-title">
      <div className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 id="critique-gpt-management-title" className="flex items-center gap-2 text-lg font-black text-neon-pink"><Bot className="h-5 w-5" aria-hidden="true" />辛口論評GPT 管理</h2>
            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">辛口論評を同じGPTで何度も続けると、会話がたまって動作が重くなり、どの原稿版を見ているか分かりにくくなることがあります。ここで原稿版・論評回・引継ぎ先をつなぐと、今使うGPTを迷わず確認できます。</p>
            <p className="mt-2 text-xs font-bold text-foreground">論評結果・4分類・著者判断の履歴は「論評・履歴」に残し、ここではGPT会話の世代だけを管理します。</p>
            <p className="mt-1 text-xs text-muted-foreground">1つの辛口論評GPT会話を1件として登録します。次の管理ID候補は {nextManagementId} です。</p>
          </div>
          <Button type="button" onClick={event => openNewSession(event.currentTarget)} disabled={busy || Boolean(loadError)} className="min-h-11 shrink-0 gap-2 bg-neon-pink/20 text-neon-pink"><Plus className="h-4 w-4" aria-hidden="true" />新しい辛口論評GPTを登録</Button>
        </div>
        <div className="mt-4 flex gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>辛口論評GPT URL・引継ぎメモ・備考は端末内と完全バックアップだけに保存し、共有用JSON／Markdownから除外します。会話全文や認証情報は貼り付けないでください。</p>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-950/30 p-4">
          <h3 className="font-black text-red-200">企画ノートを安全に読み込めませんでした</h3>
          <p className="mt-2 text-xs leading-relaxed text-red-100/80">{loadError}</p>
          <p className="mt-1 text-xs text-red-100/70">元データを上書きしないため、辛口論評GPT管理の追加・編集・削除を停止しています。データ管理から完全バックアップを保存してください。</p>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-xl border border-amber-400/25 bg-amber-400/[0.045] p-4" aria-labelledby="critique-gpt-move-timing-title">
          <h3 id="critique-gpt-move-timing-title" className="flex items-center gap-2 font-black text-amber-200"><Clock3 className="h-5 w-5" aria-hidden="true" />重くなる前に移る目安</h3>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <li>・読み込みや応答が明らかに重くなったとき</li>
            <li>・1つの原稿版や論評回の確認が一区切りついたとき</li>
            <li>・次の原稿版へ移る前に、未対応指摘をまとめられるとき</li>
          </ul>
        </section>
        <section className="rounded-xl border border-neon-pink/25 bg-neon-pink/[0.035] p-4" aria-labelledby="critique-gpt-move-steps-title">
          <h3 id="critique-gpt-move-steps-title" className="flex items-center gap-2 font-black text-neon-pink"><ArrowRightLeft className="h-5 w-5" aria-hidden="true" />移るときの3ステップ</h3>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              '対象版・論評回・未対応指摘を引継ぎメモにまとめる',
              '新しい辛口論評GPTを「保留」で登録して引継ぎ先をつなぐ',
              '新しいGPTが内容を受領したら、そちらを「使用中」にする',
            ].map((step, index) => (
              <li key={step} className="flex gap-2 rounded-lg border border-white/10 bg-black/10 p-3 text-xs leading-relaxed text-muted-foreground">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-neon-pink/40 font-black text-neon-pink">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <PlanningGptHandoffPreparationCard
        kind="critique"
        projectKey={project.id}
        data={data}
        activeSession={activeSession}
        nextManagementId={nextManagementId}
        projectTitle={project.book_title || project.name || ''}
        extraTemplateValues={extraTemplateValues}
        busy={busy || Boolean(loadError)}
        onSave={saveHandoffTemplate}
      />

      <div className="flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-end sm:justify-between" style={CARD_STYLE}>
        <div>
          <h3 id="critique-gptSessions-list-title" tabIndex={-1} className="font-black text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80" style={{ scrollMarginTop: 'calc(var(--kindle-main-nav-height, 60px) + 1rem)' }}>辛口論評GPTセッション一覧</h3>
          <p className="mt-1 text-xs text-muted-foreground">使用中を先頭に固定し、その他を開始日で並べます。</p>
        </div>
        <label className="block min-w-0 space-y-1 text-xs font-bold text-foreground sm:w-80">
          <span>並び順</span>
          <select value={sortOrder} onChange={event => setSortOrder(event.target.value)} className={INPUT_CLASS}>
            <option value="newest">使用中を先頭・開始日の新しい順</option>
            <option value="oldest">使用中を先頭・開始日の古い順</option>
          </select>
        </label>
      </div>

      {sortedSessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
          <Bot className="mx-auto h-10 w-10 text-neon-pink/65" aria-hidden="true" />
          <h3 className="mt-3 font-black text-foreground">まだ辛口論評GPTセッションはありません</h3>
          <p className="mt-2 text-sm text-muted-foreground">今使っている辛口論評GPTを1件だけ登録すれば大丈夫です。</p>
          <p className="mt-2 text-xs font-bold text-neon-pink">次の管理ID候補：{nextManagementId}</p>
          <Button type="button" onClick={event => openNewSession(event.currentTarget)} disabled={busy || Boolean(loadError)} className="mt-4 min-h-11 gap-2 bg-neon-pink/20 text-neon-pink"><Plus className="h-4 w-4" aria-hidden="true" />最初の辛口論評GPTを登録</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSessions.map(record => {
            const active = record.sessionStatus === 'active';
            const canActivate = record.sessionStatus === 'on_hold'
              && activeSession?.handoffToId === record.managementId;
            return (
              <article key={record.id} id={`critique-gptSessions-${record.id}`} tabIndex={-1} className={`rounded-xl border-l-4 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80 ${active ? 'border border-emerald-400/45 border-l-emerald-400 bg-emerald-400/[0.055]' : 'border border-[#2a2a4a] border-l-slate-500/50 bg-[#1a1a2e]'}`} style={{ scrollMarginTop: 'calc(var(--kindle-main-nav-height, 60px) + 1rem)' }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {active && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/45 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black text-emerald-200"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />現在使うGPT</span>}
                      <CritiqueGptStatusBadge value={record.sessionStatus} />
                      <span className="rounded-full border border-neon-pink/30 bg-neon-pink/5 px-2 py-0.5 text-[10px] font-black text-neon-pink">{record.managementId}</span>
                    </div>
                    <h3 className="mt-3 break-words font-black text-foreground">{record.sessionName || '名称未設定の辛口論評GPT'}</h3>
                    <p className="mt-1 break-words text-xs text-muted-foreground">開始日：{record.startedOn || '未設定'} ／ 対象版：{record.targetManuscriptVersionId || '未設定'} ／ 論評回：{record.critiqueRound || '未設定'}</p>
                    {record.scope && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">担当範囲：{record.scope}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:max-w-md sm:justify-end">
                    {record.gptUrl ? (
                      <a href={record.gptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-neon-pink/40 bg-neon-pink/10 px-3 py-2 text-sm font-bold text-neon-pink transition hover:bg-neon-pink/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"><ExternalLink className="h-4 w-4" aria-hidden="true" />GPTを開く</a>
                    ) : <Button type="button" size="sm" variant="outline" disabled className="min-h-11"><ExternalLink className="h-4 w-4" aria-hidden="true" />GPT URL未登録</Button>}
                    {active && !record.handoffToId && <Button type="button" size="sm" variant="outline" onClick={event => openHandoffTarget(record, event.currentTarget)} disabled={busy} className="min-h-11 border-neon-pink/35 text-neon-pink"><ArrowRightLeft className="h-4 w-4" aria-hidden="true" />新しい引継ぎ先を登録</Button>}
                    {canActivate && <Button type="button" size="sm" variant="outline" onClick={() => activateSession(record)} disabled={busy} className="min-h-11 border-emerald-400/40 text-emerald-200"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />このGPTを使用中にする</Button>}
                    <Button type="button" size="sm" variant="outline" onClick={event => openEditSession(record, event.currentTarget)} disabled={busy} className="min-h-11"><Pencil className="h-4 w-4" aria-hidden="true" />編集</Button>
                    {!active && !record.handoffToId && !incomingTargetIds.has(record.managementId) && <Button type="button" size="sm" variant="outline" onClick={() => deleteSession(record)} disabled={busy} className="min-h-11 border-red-400/30 text-red-300"><Trash2 className="h-4 w-4" aria-hidden="true" />削除</Button>}
                  </div>
                </div>

                {record.handoffToId && (
                  <button type="button" onClick={() => setPendingFocus(record.handoffToId)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-cyan-400/30 px-3 py-2 text-xs font-bold text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80"><ArrowRightLeft className="h-4 w-4" aria-hidden="true" />引継ぎ先：{record.handoffToId}を確認</button>
                )}

                <details className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-xs font-bold text-neon-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/80">スプレッドシート列順ですべての11項目を見る</summary>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    {CRITIQUE_GPT_SPREADSHEET_FIELDS.map(([field, label]) => {
                      const rawValue = record[field];
                      const value = field === 'sessionStatus'
                        ? PLANNING_CRITIQUE_GPT_SESSION_STATUSES[rawValue]
                        : rawValue;
                      return (
                        <div key={field} className={`min-w-0 rounded-lg border border-white/10 bg-white/[0.025] p-3 ${['scope', 'handoffMemo', 'notes'].includes(field) ? 'sm:col-span-2' : ''}`}>
                          <dt className="text-[10px] font-bold text-neon-pink">{label}</dt>
                          <dd className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">{value || '未設定'}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </details>
              </article>
            );
          })}
        </div>
      )}

      {statusMessage && <p role="status" aria-live="polite" aria-atomic="true" className="text-xs font-bold text-muted-foreground">{statusMessage}</p>}

      <CritiqueGptEditorDialog
        editor={editor}
        sessions={sessions}
        busy={busy}
        onChange={(field, value) => setEditor(current => current ? {
          ...current,
          draft: { ...current.draft, [field]: value },
          dirty: true,
        } : current)}
        onSave={saveSession}
        onClose={() => setEditor(null)}
      />
    </section>
  );
}
