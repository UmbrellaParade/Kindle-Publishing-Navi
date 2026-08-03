import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { scheduleCoordinatedSave } from '@/lib/saveCoordinator';
import { mutatePublishingProject } from '@/lib/projectMutation';
import {
  createPromotionDocumentSettings,
  mergePromotionDocumentUpdate,
  parsePromotionDocumentSettings,
  selectPromotionDocumentHydration,
  updatePromotionDocumentSettings,
  validatePromotionDocumentUrl,
} from '@/lib/promotionDocuments';
import { getPromotionPostCopyText } from '@/lib/promotionPostCopy';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };

const SNS_OPTIONS = ['X', 'Instagram', 'TikTok', 'その他'];
const SNS_COLORS = {
  'X': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Instagram': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'TikTok': 'bg-red-500/20 text-red-400 border-red-500/30',
  'その他': 'bg-secondary text-muted-foreground border-border',
};

async function copyTextToClipboard({ text, setCopied, emptyMessage, successMessage }) {
  if (!text.trim()) {
    toast.error(emptyMessage);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(successMessage);
  } catch {
    toast.error('コピーできませんでした。ブラウザのクリップボード許可を確認してください');
  }
}

function DocumentLinkControls({ sectionId, url, collapsed, onUrlChange, onToggleCollapse }) {
  const validation = validatePromotionDocumentUrl(url);
  const canOpen = Boolean(validation.href);

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/10 p-2.5">
      <label htmlFor={`promotion-document-${sectionId}`} className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
        <Link2 className="h-3.5 w-3.5" />
        関連ドキュメント
      </label>
      <div className="flex min-w-0 flex-col gap-2">
        <input
          id={`promotion-document-${sectionId}`}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={url}
          onChange={event => onUrlChange(event.target.value)}
          placeholder="https://docs.google.com/..."
          aria-invalid={Boolean(validation.error)}
          aria-describedby={validation.error ? `promotion-document-error-${sectionId}` : undefined}
          className="h-8 min-w-0 rounded px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          style={INPUT_STYLE}
        />
        {canOpen && (
          <a
            href={validation.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-neon-cyan/40 bg-neon-cyan/10 px-2 text-xs font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/20"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            ドキュメントを開く
          </a>
        )}
      </div>
      {validation.error ? (
        <p id={`promotion-document-error-${sectionId}`} role="alert" className="text-[10px] leading-relaxed text-red-400">
          {validation.error}
        </p>
      ) : (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          GoogleドキュメントやスプレッドシートなどのURLを自動保存します。
        </p>
      )}
      {canOpen && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="inline-flex w-full items-center justify-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          {collapsed ? 'メモを開く' : 'メモを折りたたむ'}
        </button>
      )}
    </div>
  );
}

// ─ SNS 投稿文カラム ─
function SnsPostColumn({
  title,
  data,
  onChange,
  color,
  documentSectionId,
  documentSettings,
  onDocumentUrlChange,
  onToggleCollapse,
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [data.body]);
  const c = color === 'cyan'
    ? { border: 'border-neon-cyan/30', text: 'text-neon-cyan', bg: 'rgba(0,245,255,0.04)', btn: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/30' }
    : { border: 'border-neon-amber/30', text: 'text-neon-amber', bg: 'rgba(255,179,0,0.04)', btn: 'bg-neon-amber/20 text-neon-amber border-neon-amber/40 hover:bg-neon-amber/30' };

  const handleCopy = () => {
    const postText = getPromotionPostCopyText(data);
    copyTextToClipboard({
      text: postText,
      setCopied,
      emptyMessage: 'コピーする投稿文を入力してください',
      successMessage: '投稿文だけをコピーしました',
    });
  };

  return (
    <div
      className={`min-w-0 self-start rounded-xl border ${c.border} p-3 flex flex-col gap-3`}
      style={{ background: c.bg, minHeight: documentSettings.collapsed ? 'auto' : '600px' }}
    >
      <h3 className={`text-sm font-bold ${c.text}`}>{title}</h3>
      <DocumentLinkControls
        sectionId={documentSectionId}
        url={documentSettings.url}
        collapsed={documentSettings.collapsed}
        onUrlChange={onDocumentUrlChange}
        onToggleCollapse={onToggleCollapse}
      />
      {!documentSettings.collapsed && (
        <>
          <input value={data.subtitle || ''} onChange={e => onChange({ ...data, subtitle: e.target.value })}
            placeholder="例：発売告知ツイート"
            className="h-8 px-2 text-xs rounded text-foreground placeholder:text-muted-foreground focus:outline-none"
            style={INPUT_STYLE} />
          <div className="flex flex-wrap gap-1">
            {SNS_OPTIONS.map(sns => (
              <button key={sns} onClick={() => {
                const tags = data.tags || [];
                onChange({ ...data, tags: tags.includes(sns) ? tags.filter(t => t !== sns) : [...tags, sns] });
              }} className={`text-[10px] px-2 py-0.5 rounded-full border font-bold transition-all ${(data.tags || []).includes(sns) ? SNS_COLORS[sns] : 'bg-secondary/50 text-muted-foreground border-border hover:border-muted-foreground'}`}>
                {sns}
              </button>
            ))}
          </div>
          <textarea value={data.body || ''} onChange={e => onChange({ ...data, body: e.target.value })}
            placeholder="投稿文を入力..."
            className="flex-1 text-xs rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
            style={{ ...INPUT_STYLE, minHeight: '450px' }} />
          <div className="mt-auto space-y-1.5">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              タイトルや選択SNSを含めず、入力した投稿文だけをコピーします。
            </p>
            <Button
              size="sm"
              type="button"
              onClick={handleCopy}
              aria-label={`${title}の投稿文だけコピー`}
              className={`h-9 w-full text-xs gap-1.5 border ${c.btn}`}
            >
              {copied ? <><Check className="w-3 h-3" />コピー済み</> : <><Copy className="w-3 h-3" />投稿文だけコピー</>}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function PromoChecklistTab({ project, onProjectUpdate }) {
  const [goal, setGoal] = useState('');
  const [strategyMemo, setStrategyMemo] = useState('');
  const [strategyCopied, setStrategyCopied] = useState(false);
  const [snsPost1, setSnsPost1] = useState({ subtitle: '', tags: [], body: '' });
  const [snsPost2, setSnsPost2] = useState({ subtitle: '', tags: [], body: '' });
  const [documentSettings, setDocumentSettings] = useState(createPromotionDocumentSettings);
  const documentSettingsRef = useRef(documentSettings);
  const documentProjectIdRef = useRef('');
  const documentRevisionRef = useRef(0);
  const documentSaveRevisionsRef = useRef(new Map());
  const pendingDocumentSettingsRef = useRef(new Map());
  useEffect(() => setStrategyCopied(false), [project?.id, strategyMemo]);

  // プロジェクト選択時にデータを読み込み
  useEffect(() => {
    if (!project) {
      const emptyDocuments = createPromotionDocumentSettings();
      const baselineRevision = documentRevisionRef.current + 1;
      setGoal('');
      setStrategyMemo('');
      setSnsPost1({ subtitle: '', tags: [], body: '' });
      setSnsPost2({ subtitle: '', tags: [], body: '' });
      documentProjectIdRef.current = '';
      documentRevisionRef.current = baselineRevision;
      documentSettingsRef.current = emptyDocuments;
      setDocumentSettings(emptyDocuments);
      return;
    }

    // promotion_goal, strategy_memo, sns_memo1, sns_memo2 から読み込み
    setGoal(project.promotion_goal || '');
    setStrategyMemo(project.strategy_memo || '');
    const projectChanged = documentProjectIdRef.current !== project.id;
    const saveKeyPrefix = `promotion-document:${project.id}:`;
    const hasPendingChanges = [...documentSaveRevisionsRef.current.keys()]
      .some(key => key.startsWith(saveKeyPrefix));
    const nextDocumentSettings = selectPromotionDocumentHydration({
      savedSettings: parsePromotionDocumentSettings(project.promotion_notes),
      pendingSettings: pendingDocumentSettingsRef.current.get(project.id) || null,
      projectChanged,
      hasPendingChanges,
    });
    if (nextDocumentSettings) {
      if (projectChanged) {
        const baselineRevision = documentRevisionRef.current + 1;
        documentRevisionRef.current = baselineRevision;
      }
      documentProjectIdRef.current = project.id;
      documentSettingsRef.current = nextDocumentSettings;
      setDocumentSettings(nextDocumentSettings);
    }
    
    try {
      const memo1 = project.sns_memo1 ? JSON.parse(project.sns_memo1) : { subtitle: '', tags: [], body: '' };
      setSnsPost1(memo1);
    } catch { setSnsPost1({ subtitle: '', tags: [], body: '' }); }
    
    try {
      const memo2 = project.sns_memo2 ? JSON.parse(project.sns_memo2) : { subtitle: '', tags: [], body: '' };
      setSnsPost2(memo2);
    } catch { setSnsPost2({ subtitle: '', tags: [], body: '' }); }
  }, [project?.id, project?.promotion_goal, project?.strategy_memo, project?.sns_memo1, project?.sns_memo2, project?.promotion_notes]);

  // 自動保存（promotion_goal, strategy_memo, sns_memo）
  const scheduleSavePromo = (updates) => {
    if (!project) return;
    const fields = Object.keys(updates).sort().join(',');
    scheduleCoordinatedSave(`promo-fields:${project.id}:${fields}`, async () => {
      const updated = await base44.entities.PublishingProject.update(project.id, updates);
      onProjectUpdate(updated);
    }, 1000);
  };

  const updateDocumentSettings = (sectionId, updates) => {
    if (!project) return;
    const next = updatePromotionDocumentSettings(documentSettingsRef.current, sectionId, updates);
    const revision = documentRevisionRef.current + 1;
    const targetProject = project;
    documentProjectIdRef.current = project.id;
    documentRevisionRef.current = revision;
    documentSettingsRef.current = next;
    pendingDocumentSettingsRef.current.set(project.id, next);
    setDocumentSettings(next);
    const fields = Object.keys(updates).sort().join(',') || 'entry';
    const saveKey = `promotion-document:${project.id}:${sectionId}:${fields}`;
    documentSaveRevisionsRef.current.set(saveKey, revision);
    scheduleCoordinatedSave(saveKey, async () => {
      const updated = await mutatePublishingProject(project.id, latest => ({
        promotion_notes: mergePromotionDocumentUpdate(
          latest?.promotion_notes || '',
          sectionId,
          updates,
        ),
      }), targetProject);
      if (documentSaveRevisionsRef.current.get(saveKey) === revision) {
        documentSaveRevisionsRef.current.delete(saveKey);
      }
      const projectSaveKeyPrefix = `promotion-document:${targetProject.id}:`;
      const projectStillHasPendingChanges = [...documentSaveRevisionsRef.current.keys()]
        .some(key => key.startsWith(projectSaveKeyPrefix));
      if (!projectStillHasPendingChanges) {
        pendingDocumentSettingsRef.current.delete(targetProject.id);
      }
      onProjectUpdate(updated);
    }, 1000);
  };

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground"><span className="text-4xl">📣</span><p className="mt-3 text-sm">プロジェクトを選択してください</p></div>;
  }

  return (
    <div className="space-y-5">
      {/* 出版目標 */}
      <div className="rounded-xl p-4 space-y-2" style={CARD_STYLE}>
        <p className="text-sm font-bold text-neon-pink neon-pink-glow">🎯 出版目標</p>
        <textarea value={goal} onChange={e => { setGoal(e.target.value); scheduleSavePromo({ promotion_goal: e.target.value }); }} rows={3}
          placeholder="例：読者 100 人に届け、レビューや感想を次作の改善につなげる"
          className="w-full text-sm rounded px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
          style={INPUT_STYLE} />
      </div>

      {/* PCは3カラムを均等表示 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1 列：戦略メモ */}
        <div
          className="min-w-0 self-start rounded-xl border border-neon-pink/25 p-3 flex flex-col gap-3"
          style={{ background: 'rgba(255,45,120,0.04)', minHeight: documentSettings.documents.strategy.collapsed ? 'auto' : '600px' }}
        >
          <h3 className="text-sm font-bold text-neon-pink neon-pink-glow">📊 プロモーション戦略メモ</h3>
          <DocumentLinkControls
            sectionId="strategy"
            url={documentSettings.documents.strategy.url}
            collapsed={documentSettings.documents.strategy.collapsed}
            onUrlChange={url => updateDocumentSettings('strategy', { url })}
            onToggleCollapse={() => updateDocumentSettings('strategy', {
              collapsed: !documentSettings.documents.strategy.collapsed,
            })}
          />
          {!documentSettings.documents.strategy.collapsed && (
            <>
              <p className="text-[10px] text-muted-foreground leading-relaxed">Kindle 辛口論評 Gem の結果、戦略などを貼り付けて保存</p>
              <textarea value={strategyMemo} onChange={e => { setStrategyMemo(e.target.value); scheduleSavePromo({ strategy_memo: e.target.value }); }}
                placeholder="戦略メモ、Gem の分析結果などをここに貼り付けてください..."
                className="flex-1 text-xs rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
                style={{ ...INPUT_STYLE, minHeight: '500px' }} />
              <div className="mt-auto space-y-1.5">
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  入力した戦略メモだけをコピーします。
                </p>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => copyTextToClipboard({
                    text: strategyMemo,
                    setCopied: setStrategyCopied,
                    emptyMessage: 'コピーする戦略メモを入力してください',
                    successMessage: '戦略メモだけをコピーしました',
                  })}
                  className="h-9 w-full gap-1.5 border border-neon-pink/40 bg-neon-pink/15 text-xs text-neon-pink hover:bg-neon-pink/25"
                >
                  {strategyCopied
                    ? <><Check className="h-3.5 w-3.5" />コピー済み</>
                    : <><Copy className="h-3.5 w-3.5" />戦略メモだけコピー</>}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* 2 列：SNS 投稿文 1 */}
        <SnsPostColumn
          title="✍️ SNS 投稿文章メモ 1"
          data={snsPost1}
          onChange={d => { setSnsPost1(d); scheduleSavePromo({ sns_memo1: JSON.stringify(d) }); }}
          color="cyan"
          documentSectionId="sns1"
          documentSettings={documentSettings.documents.sns1}
          onDocumentUrlChange={url => updateDocumentSettings('sns1', { url })}
          onToggleCollapse={() => updateDocumentSettings('sns1', {
            collapsed: !documentSettings.documents.sns1.collapsed,
          })}
        />

        {/* 3 列：SNS 投稿文 2 */}
        <SnsPostColumn
          title="✍️ SNS 投稿文章メモ 2"
          data={snsPost2}
          onChange={d => { setSnsPost2(d); scheduleSavePromo({ sns_memo2: JSON.stringify(d) }); }}
          color="amber"
          documentSectionId="sns2"
          documentSettings={documentSettings.documents.sns2}
          onDocumentUrlChange={url => updateDocumentSettings('sns2', { url })}
          onToggleCollapse={() => updateDocumentSettings('sns2', {
            collapsed: !documentSettings.documents.sns2.collapsed,
          })}
        />
      </div>
    </div>
  );
}
