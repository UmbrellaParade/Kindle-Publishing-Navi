import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FilePenLine,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  getDefaultPlanningGptHandoffTemplate,
  renderPlanningGptHandoffTemplate,
  resolvePlanningGptHandoffTemplates,
} from '@/lib/planningNotes';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const TEXTAREA_CLASS = 'min-h-52 w-full resize-y rounded-md border border-[#34345a] bg-[#101020] px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/50 disabled:opacity-60';
const EMPTY_TEMPLATE_VALUES = Object.freeze({});

function normalizeTemplateValue(value) {
  if (value === undefined || value === null || value === '') return '未設定';
  return String(value);
}

export default function PlanningGptHandoffPreparationCard({
  kind,
  projectKey,
  data,
  activeSession,
  nextManagementId,
  projectTitle,
  extraTemplateValues = EMPTY_TEMPLATE_VALUES,
  busy = false,
  onSave,
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => resolvePlanningGptHandoffTemplates(data, kind));
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(
    () => data.gptHandoffTemplates?.[kind]?.updatedAt || '',
  );
  const [dirty, setDirty] = useState(false);
  const [externalConflict, setExternalConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyState, setCopyState] = useState({
    field: '',
    message: '',
    failed: false,
    rendered: '',
  });
  const firstTextareaRef = useRef(null);
  const secondTextareaRef = useRef(null);
  const fallbackTextareaRef = useRef(null);
  const copyTimerRef = useRef(0);
  const identityRef = useRef(`${projectKey || ''}:${kind}`);

  const storedTemplate = data.gptHandoffTemplates?.[kind];
  const storedUpdatedAt = storedTemplate?.updatedAt || '';
  const resolvedTemplate = useMemo(
    () => resolvePlanningGptHandoffTemplates(data, kind),
    [data, kind],
  );
  const defaultTemplate = useMemo(
    () => getDefaultPlanningGptHandoffTemplate(kind),
    [kind],
  );
  const templateValues = useMemo(() => Object.fromEntries(
    Object.entries({
      projectTitle,
      currentManagementId: activeSession?.managementId,
      nextManagementId,
      scope: activeSession?.scope,
      ...extraTemplateValues,
    }).map(([key, value]) => [key, normalizeTemplateValue(value)]),
  ), [activeSession?.managementId, activeSession?.scope, extraTemplateValues, nextManagementId, projectTitle]);

  useEffect(() => {
    const identity = `${projectKey || ''}:${kind}`;
    if (identityRef.current !== identity) {
      identityRef.current = identity;
      window.clearTimeout(copyTimerRef.current);
      setOpen(false);
      setDraft(resolvedTemplate);
      setExpectedUpdatedAt(storedUpdatedAt);
      setDirty(false);
      setExternalConflict(false);
      setSaving(false);
      setCopyState({ field: '', message: '', failed: false, rendered: '' });
      return;
    }
    if (!dirty) {
      setDraft(resolvedTemplate);
      setExpectedUpdatedAt(storedUpdatedAt);
      setExternalConflict(false);
      return;
    }
    if (expectedUpdatedAt !== storedUpdatedAt) setExternalConflict(true);
  }, [dirty, expectedUpdatedAt, kind, projectKey, resolvedTemplate, storedUpdatedAt]);

  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  const updateDraft = (field, value) => {
    setDraft(current => ({ ...current, [field]: value }));
    setDirty(true);
    setCopyState({ field: '', message: '', failed: false, rendered: '' });
  };

  const copyTemplate = async (field, successMessage) => {
    window.clearTimeout(copyTimerRef.current);
    let rendered = '';
    try {
      rendered = renderPlanningGptHandoffTemplate(kind, draft[field], templateValues);
      if (!rendered) throw new Error('コピーする文章が空です');
      if (!navigator.clipboard?.writeText) throw new Error('このブラウザではクリップボードを使えません');
      await navigator.clipboard.writeText(rendered);
      setCopyState({ field, message: successMessage, failed: false, rendered: '' });
      copyTimerRef.current = window.setTimeout(
        () => setCopyState({ field: '', message: '', failed: false, rendered: '' }),
        2400,
      );
    } catch {
      const message = 'コピーできませんでした。ブラウザのクリップボード許可を確認するか、下に表示した差し込み済み全文を手動でコピーしてください。';
      setCopyState({ field, message, failed: true, rendered });
      window.requestAnimationFrame(() => {
        fallbackTextareaRef.current?.focus({ preventScroll: false });
        fallbackTextareaRef.current?.select();
      });
    }
  };

  const saveTemplates = async () => {
    if (!dirty || saving || busy || externalConflict) return;
    setSaving(true);
    try {
      const next = await onSave?.({
        handoffDocumentInstruction: draft.handoffDocumentInstruction,
        handoffStartMessage: draft.handoffStartMessage,
      }, expectedUpdatedAt);
      if (!next) return;
      setDirty(false);
      setExternalConflict(false);
      setExpectedUpdatedAt(next.gptHandoffTemplates?.[kind]?.updatedAt || '');
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = () => {
    setDraft(defaultTemplate);
    setDirty(true);
    setExternalConflict(false);
    setCopyState({ field: '', message: '', failed: false, rendered: '' });
    window.requestAnimationFrame(() => firstTextareaRef.current?.focus({ preventScroll: true }));
  };

  const copiedDocument = copyState.field === 'handoffDocumentInstruction' && !copyState.failed;
  const copiedStart = copyState.field === 'handoffStartMessage' && !copyState.failed;

  return (
    <section className="overflow-hidden rounded-xl" style={CARD_STYLE} aria-labelledby={`${kind}-gpt-handoff-preparation-title`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h3 id={`${kind}-gpt-handoff-preparation-title`} className="flex items-center gap-2 font-black text-neon-cyan">
              <FilePenLine className="h-5 w-5" aria-hidden="true" />引継ぎの準備
            </h3>
            <p className="mt-2 text-sm font-bold leading-relaxed text-foreground">①旧GPTで引継ぎ書 → ②新GPTへ貼る → ③受領確認後に使用中切替</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">作品名・管理ID・担当範囲など、画面に保存済みの管理情報だけを差し込みます。限定URL・会話URL・セッションID・認証情報・生の非公開会話は自動挿入しません。必要な一般公開URLは利用できます。</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(value => !value)}
            aria-expanded={open}
            aria-controls={`${kind}-gpt-handoff-template-editor`}
            className="min-h-11 shrink-0 gap-2 border-white/15"
          >
            {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            {open ? '全文編集を閉じる' : '全文を確認・編集'}
            {dirty && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200">未保存</span>}
          </Button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => copyTemplate('handoffDocumentInstruction', '引継ぎ書の作成指示をコピーしました')}
            className="min-h-11 gap-2 border-neon-pink/35 text-neon-pink"
          >
            {copiedDocument ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copiedDocument ? '引継ぎ書の作成指示をコピー済み' : '引継ぎ書の作成指示をコピー'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => copyTemplate('handoffStartMessage', '新しいGPTへの開始指示をコピーしました')}
            className="min-h-11 gap-2 border-neon-cyan/35 text-neon-cyan"
          >
            {copiedStart ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copiedStart ? '新しいGPTへの開始指示をコピー済み' : '新しいGPTへの開始指示をコピー'}
          </Button>
        </div>

        {copyState.message && (
          <p role="status" aria-live="polite" aria-atomic="true" className={`mt-3 text-xs font-bold ${copyState.failed ? 'text-red-300' : 'text-emerald-200'}`}>
            {copyState.message}
          </p>
        )}
        {copyState.failed && copyState.rendered && (
          <label className="mt-3 block space-y-1.5 text-xs font-bold text-foreground">
            <span>コピーできなかった差し込み済み全文</span>
            <textarea
              ref={fallbackTextareaRef}
              readOnly
              value={copyState.rendered}
              rows={8}
              className={`${TEXTAREA_CLASS} min-h-40`}
              aria-describedby={`${kind}-gpt-copy-fallback-help`}
            />
            <span id={`${kind}-gpt-copy-fallback-help`} className="block font-normal leading-relaxed text-muted-foreground">
              クリップボードへ渡そうとした本文と同じ内容です。全文を選択して手動でコピーできます。
            </span>
          </label>
        )}
      </div>

      {open && (
        <div id={`${kind}-gpt-handoff-template-editor`} className="space-y-4 border-t border-[#2a2a4a] bg-black/10 p-4 sm:p-5">
          {externalConflict && (
            <div role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
              別の画面で引継ぎ文章が更新されました。入力中の内容は保存せず、最新表示を確認してください。
            </div>
          )}
          <label className="block space-y-1.5 text-xs font-bold text-foreground">
            <span>引継ぎ書の作成指示</span>
            <textarea
              ref={firstTextareaRef}
              value={draft.handoffDocumentInstruction}
              onChange={event => updateDraft('handoffDocumentInstruction', event.target.value)}
              className={TEXTAREA_CLASS}
              aria-describedby={`${kind}-gpt-handoff-template-help`}
            />
          </label>
          <label className="block space-y-1.5 text-xs font-bold text-foreground">
            <span>新しいGPTへの開始指示</span>
            <textarea
              ref={secondTextareaRef}
              value={draft.handoffStartMessage}
              onChange={event => updateDraft('handoffStartMessage', event.target.value)}
              className={TEXTAREA_CLASS}
              aria-describedby={`${kind}-gpt-handoff-template-help`}
            />
          </label>
          <p id={`${kind}-gpt-handoff-template-help`} className="text-xs leading-relaxed text-muted-foreground">
            波括弧の差し込み項目は保存時に文字のまま残り、コピー時だけ現在の管理情報へ置き換わります。既定文へ戻した場合も「保存」を押すまでは確定しません。
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={restoreDefaults} disabled={saving || busy} className="min-h-11 gap-2">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />既定へ戻す
            </Button>
            <Button type="button" onClick={saveTemplates} disabled={!dirty || saving || busy || externalConflict} className="min-h-11 gap-2 bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {saving ? '保存中…' : '引継ぎ文章を保存'}
            </Button>
          </div>
          <div className="flex gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.045] p-3 text-xs leading-relaxed text-emerald-100">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            保存した文章は完全バックアップで復元できますが、共有用JSON／Markdownには含まれません。
          </div>
        </div>
      )}
    </section>
  );
}
