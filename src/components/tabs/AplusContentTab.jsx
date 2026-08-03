import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FilePenLine,
  ImageIcon,
  Images,
  LoaderCircle,
  MonitorSmartphone,
  Plus,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { downloadImage, getImageDataUrl } from '@/lib/localImageStore';
import { prepareAplusImageForUpload } from '@/lib/aplusImageOptimization';
import { mutatePublishingProject } from '@/lib/projectMutation';
import { flushPendingSaves, scheduleCoordinatedSave } from '@/lib/saveCoordinator';
import {
  APLUS_CHECKLIST_ITEMS,
  APLUS_FIELD_LIMITS,
  APLUS_IMAGES_PER_MODULE,
  APLUS_MAX_MODULES,
  APLUS_STATUS_OPTIONS,
  createAplusModule,
  getAplusPolicyWarnings,
  getAplusReadiness,
  normalizeAplusContent,
  readAplusContent,
  validateAplusAsinText,
  validateAplusImageMetadata,
  writeAplusContent,
} from '@/lib/aplusContent';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };
const KDP_APLUS_URL = 'https://kdp.amazon.co.jp/ja_JP/help/topic/G8EP5W6H9CY7T8GS';
const KDP_GUIDELINES_URL = 'https://kdp.amazon.co.jp/ja_JP/help/topic/G4WB7VPPEAREHAAD';
const KDP_MARKETING_URL = 'https://kdp.amazon.co.jp/ja_JP/marketing/manager';
const KDP_APLUS_MANAGER_URL = 'https://kdp.amazon.co.jp/aplus/content-manager';

const STATUS_COLORS = {
  draft: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  ready: 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan',
  submitted: 'border-neon-amber/40 bg-neon-amber/10 text-neon-amber',
  needs_revision: 'border-red-500/40 bg-red-500/10 text-red-300',
  published: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
};

function CharacterCount({ value, max }) {
  const count = value?.length || 0;
  return (
    <span className={`text-[10px] tabular-nums ${count >= max ? 'text-red-300' : 'text-muted-foreground'}`}>
      {count} / {max}
    </span>
  );
}

function CopyFieldButton({ value, label }) {
  const handleCopy = async () => {
    if (!value) {
      toast.info(`${label}はまだ入力されていません`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label}をコピーしました`);
    } catch {
      toast.error('コピーできませんでした');
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-8 items-center gap-1 rounded-md border border-neon-cyan/25 bg-neon-cyan/10 px-2 text-[10px] font-bold text-neon-cyan transition hover:bg-neon-cyan/20"
      aria-label={`${label}をコピー`}
    >
      <Copy className="h-3 w-3" />コピー
    </button>
  );
}

function AplusImage({ imageRef, alt, className = '' }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    getImageDataUrl(imageRef)
      .then(value => { if (active) setSrc(value || ''); })
      .catch(() => { if (active) setSrc(''); });
    return () => { active = false; };
  }, [imageRef]);

  if (!imageRef || !src) return null;
  return <img src={src} alt={alt} className={className} />;
}

function ProcessSteps() {
  const steps = [
    { icon: FilePenLine, label: '基本情報' },
    { icon: Images, label: '画像4枚' },
    { icon: Accessibility, label: '文章とalt' },
    { icon: MonitorSmartphone, label: 'PC・スマホ確認' },
    { icon: Send, label: 'ASIN適用・提出' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="A+コンテンツ作成の流れ">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.label} className="flex min-h-16 items-center gap-2 rounded-lg border border-border/70 bg-white/[0.025] px-3 py-2">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-neon-cyan/35 bg-neon-cyan/10 text-xs font-black text-neon-cyan">
              {index + 1}
            </span>
            <div className="min-w-0">
              <Icon className="mb-1 h-3.5 w-3.5 text-neon-cyan" />
              <p className="text-[10px] font-bold leading-tight text-foreground">{step.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KdpAplusSetupGuide() {
  const steps = [
    'KDPにログイン',
    '上部の「マーケティング」',
    '「A+コンテンツ」までスクロール',
    '「A+コンテンツの管理」から作成開始',
    '「モジュールの追加」で標準複数画像モジュール A',
  ];

  return (
    <section className="rounded-xl border border-neon-cyan/25 p-4 sm:p-5" style={CARD_STYLE}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-neon-cyan" />
            <h3 className="text-sm font-bold text-neon-cyan">KDPではどこから設定する？</h3>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            下の順番で進むと「標準複数画像モジュール A」を選べます。
          </p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[440px]">
          <a href={KDP_MARKETING_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-neon-pink/35 bg-neon-pink/15 px-3 text-xs font-bold text-neon-pink transition hover:bg-neon-pink/25">
            <ExternalLink className="h-3.5 w-3.5" />KDPマーケティングを開く
          </a>
          <a href={KDP_APLUS_MANAGER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-neon-cyan/35 bg-neon-cyan/15 px-3 text-xs font-bold text-neon-cyan transition hover:bg-neon-cyan/25">
            <ExternalLink className="h-3.5 w-3.5" />A+管理画面を直接開く
          </a>
        </div>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, index) => (
          <li key={step} className="flex min-h-16 items-start gap-2 rounded-lg border border-border/70 bg-white/[0.025] p-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neon-cyan/15 text-[10px] font-black text-neon-cyan">{index + 1}</span>
            <span className="text-[10px] font-bold leading-relaxed text-foreground/90">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          直接画面が開かない場合は、左の「KDPマーケティング」から進んでください。作成後は「次へ: ASINの適用」→プレビュー→「承認用に提出」です。
        </p>
        <a href={KDP_APLUS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 flex-shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 text-[10px] font-bold text-neon-cyan transition hover:border-neon-cyan/40">
          <ExternalLink className="h-3 w-3" />KDP公式の作成手順
        </a>
      </div>
    </section>
  );
}

function ModuleEditor({
  module,
  moduleIndex,
  moduleCount,
  uploadingKey,
  onChangeImage,
  onUpload,
  onDeleteImage,
  onMoveImage,
  onMoveModule,
  onDeleteModule,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const fileRef = useRef(null);
  const activeImage = module.images[activeIndex] || module.images[0];
  const uploadKey = `${module.id}:${activeImage.id}`;

  useEffect(() => {
    if (activeIndex >= module.images.length) setActiveIndex(0);
  }, [activeIndex, module.images.length]);

  const moveActiveImage = direction => {
    const nextIndex = activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= module.images.length) return;
    onMoveImage(module.id, activeIndex, direction);
    setActiveIndex(nextIndex);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-neon-cyan/25" style={{ background: 'rgba(0,245,255,0.025)' }} data-testid={`aplus-module-${moduleIndex + 1}`}>
      <header className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Images className="h-4 w-4 flex-shrink-0 text-neon-cyan" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-neon-cyan">標準複数画像モジュール A</h3>
            <p className="text-[10px] text-muted-foreground">
              モジュール {moduleIndex + 1}・{module.images.filter(image => image.image_url).length} / {APLUS_IMAGES_PER_MODULE} 枚登録
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button type="button" onClick={() => onMoveModule(module.id, -1)} disabled={moduleIndex === 0} className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary/60 text-muted-foreground transition hover:text-foreground disabled:opacity-30" aria-label={`モジュール${moduleIndex + 1}を上へ移動`}>
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMoveModule(module.id, 1)} disabled={moduleIndex === moduleCount - 1} className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary/60 text-muted-foreground transition hover:text-foreground disabled:opacity-30" aria-label={`モジュール${moduleIndex + 1}を下へ移動`}>
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onDeleteModule(module.id)} disabled={moduleCount === 1} className="flex h-9 w-9 items-center justify-center rounded-md border border-red-500/20 bg-red-500/5 text-red-300 transition hover:bg-red-500/15 disabled:opacity-30" aria-label={`モジュール${moduleIndex + 1}を削除`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.25fr)]">
        <div className="min-w-0 space-y-4">
          <div className="relative mx-auto flex aspect-square w-full max-w-[430px] items-center justify-center overflow-hidden rounded-lg border border-neon-cyan/25 bg-black/30">
            {activeImage.image_url ? (
              <AplusImage imageRef={activeImage.image_url} alt={activeImage.alt_text || `A+画像${activeIndex + 1}`} className="h-full w-full object-contain" />
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground transition hover:bg-neon-cyan/5 hover:text-neon-cyan">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-neon-cyan/35 bg-neon-cyan/5">
                  <Upload className="h-6 w-6" />
                </span>
                <span className="text-xs font-bold">画像 {activeIndex + 1} を選択</span>
                <span className="text-[10px] leading-relaxed">JPG / PNG / BMP・300×300px以上<br />大きい画像はKDP用に自動軽量化</span>
              </button>
            )}
          </div>

          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.055] p-3">
            <p className="text-xs font-bold text-emerald-300">2MBを超える画像も、そのまま選択できます</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              KDPへ登録しやすい1.8MB以下を目標に、必要な画像だけJPGへ自動変換・軽量化します。透過部分は白背景になります。
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2" role="tablist" aria-label={`モジュール${moduleIndex + 1}の画像`}>
            {module.images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                role="tab"
                aria-selected={activeIndex === index}
                onClick={() => setActiveIndex(index)}
                className={`relative aspect-square min-w-0 overflow-hidden rounded-md border-2 transition ${activeIndex === index ? 'border-neon-pink shadow-[0_0_12px_rgba(255,45,120,0.3)]' : 'border-border hover:border-neon-cyan/50'}`}
              >
                {image.image_url ? (
                  <AplusImage imageRef={image.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-secondary/40 text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-[9px]">画像 {index + 1}</span>
                  </span>
                )}
                <span className="absolute left-1 top-1 flex h-5 min-w-5 items-center justify-center rounded bg-black/75 px-1 text-[9px] font-black text-white">{index + 1}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {module.images.map((image, index) => (
              <label key={image.id} className={`block rounded-md border p-2 transition ${activeIndex === index ? 'border-neon-pink/40 bg-neon-pink/5' : 'border-border/70 bg-white/[0.02]'}`}>
                <span className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold text-muted-foreground">
                  画像 {index + 1} キャプション（任意）
                  <CharacterCount value={image.caption} max={APLUS_FIELD_LIMITS.caption} />
                </span>
                <input
                  value={image.caption}
                  maxLength={APLUS_FIELD_LIMITS.caption}
                  onFocus={() => setActiveIndex(index)}
                  onChange={event => onChangeImage(module.id, image.id, { caption: event.target.value })}
                  placeholder="画像の下に表示する短い説明"
                  className="h-9 w-full rounded px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-pink/50"
                  style={INPUT_STYLE}
                />
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadingKey === uploadKey} className="min-h-10 w-full border border-neon-cyan/35 bg-neon-cyan/15 text-xs text-neon-cyan hover:bg-neon-cyan/25 sm:w-auto sm:flex-1">
              {uploadingKey === uploadKey ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
              {activeImage.image_url ? '選択中の画像を差し替え' : '選択中の枠へ画像を追加'}
            </Button>
            <button type="button" onClick={() => moveActiveImage(-1)} disabled={activeIndex === 0} className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary/60 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="選択中の画像を左へ移動">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => moveActiveImage(1)} disabled={activeIndex === module.images.length - 1} className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary/60 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="選択中の画像を右へ移動">
              <ArrowRight className="h-4 w-4" />
            </button>
            {activeImage.image_url && (
              <>
                <button type="button" onClick={() => downloadImage(activeImage.image_url, activeImage.file_name || `Aplus_${moduleIndex + 1}_${activeIndex + 1}.png`).catch(error => toast.error(error?.message || '画像をダウンロードできませんでした'))} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-border bg-secondary/60 px-3 text-[10px] font-bold text-muted-foreground hover:text-neon-cyan" aria-label="KDP登録用の画像をダウンロード">
                  <Download className="h-4 w-4" />KDP用を保存
                </button>
                <button type="button" onClick={() => onDeleteImage(module.id, activeImage.id)} className="flex h-10 w-10 items-center justify-center rounded-md border border-red-500/25 bg-red-500/5 text-red-300 hover:bg-red-500/15" aria-label="選択中の画像を削除">
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/bmp"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) onUpload(module.id, activeImage.id, file);
                event.target.value = '';
              }}
            />
          </div>
          {activeImage.image_url && (activeImage.width > 0 || activeImage.file_size > 0) && (
            <div className="space-y-1 text-[10px] text-muted-foreground">
              <p>
                {activeImage.file_name || '保存済み画像'}
                {activeImage.width > 0 ? `・${activeImage.width}×${activeImage.height}px` : ''}
                {activeImage.file_size > 0 ? `・${(activeImage.file_size / 1_000_000).toFixed(2)}MB` : ''}
              </p>
              {activeImage.optimized && activeImage.original_file_size > 0 && (
                <p className="font-bold text-emerald-300">
                  自動軽量化済み：{(activeImage.original_file_size / 1_000_000).toFixed(2)}MB → {(activeImage.file_size / 1_000_000).toFixed(2)}MB
                </p>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4 rounded-lg border border-border/70 bg-black/10 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <p className="text-sm font-bold text-neon-pink">画像 {activeIndex + 1} の登録文</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">KDPでこの画像を選んだ時に表示される内容です。</p>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${activeImage.image_url && activeImage.alt_text ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-neon-amber/30 bg-neon-amber/10 text-neon-amber'}`}>
              {activeImage.image_url && activeImage.alt_text ? '画像とalt入力済み' : '画像とaltが必要'}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs font-bold">
              <span className="flex items-center gap-1.5"><Accessibility className="h-3.5 w-3.5 text-neon-cyan" />代替テキスト <span className="text-red-300">必須</span></span>
              <CharacterCount value={activeImage.alt_text} max={APLUS_FIELD_LIMITS.altText} />
            </div>
            <input
              aria-label={`画像${activeIndex + 1}の代替テキスト`}
              value={activeImage.alt_text}
              maxLength={APLUS_FIELD_LIMITS.altText}
              onChange={event => onChangeImage(module.id, activeImage.id, { alt_text: event.target.value })}
              placeholder="例：雨の街に立つ主人公と二人の仲間"
              className="h-10 w-full rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/60"
              style={INPUT_STYLE}
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground">検索キーワードではなく、画像を見られない読者へ内容を簡潔に説明します。</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs font-bold">
              <span>見出し <span className="font-normal text-muted-foreground">（任意）</span></span>
              <span className="flex items-center gap-2"><CharacterCount value={activeImage.headline} max={APLUS_FIELD_LIMITS.headline} /><CopyFieldButton value={activeImage.headline} label="見出し" /></span>
            </div>
            <input
              aria-label={`画像${activeIndex + 1}の見出し`}
              value={activeImage.headline}
              maxLength={APLUS_FIELD_LIMITS.headline}
              onChange={event => onChangeImage(module.id, activeImage.id, { headline: event.target.value })}
              placeholder="この画像で最も伝えたいことを一文で"
              className="h-10 w-full rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-pink/60"
              style={INPUT_STYLE}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs font-bold">
              <span>説明 <span className="font-normal text-muted-foreground">（任意）</span></span>
              <span className="flex items-center gap-2"><CharacterCount value={activeImage.body} max={APLUS_FIELD_LIMITS.body} /><CopyFieldButton value={activeImage.body} label="説明" /></span>
            </div>
            <textarea
              aria-label={`画像${activeIndex + 1}の説明`}
              value={activeImage.body}
              maxLength={APLUS_FIELD_LIMITS.body}
              rows={9}
              onChange={event => onChangeImage(module.id, activeImage.id, { body: event.target.value })}
              placeholder="画像を補足し、本の魅力や読者が得られる体験を具体的に入力します。価格や『今すぐ購入』などの表現は使えません。"
              className="min-h-[190px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-pink/60"
              style={INPUT_STYLE}
            />
            <p className="text-[10px] text-muted-foreground">太字・箇条書きなどの最終書式は、KDPへ貼り付けた後に設定します。</p>
          </div>

          <div className="rounded-lg border border-neon-cyan/15 bg-neon-cyan/[0.035] p-3">
            <p className="mb-1 text-[10px] font-bold text-neon-cyan">選択中のキャプション（任意）</p>
            <p className="min-h-5 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">{activeImage.caption || '左側のキャプション欄へ入力すると、ここに表示されます。'}</p>
            <div className="mt-2"><CopyFieldButton value={activeImage.caption} label="画像キャプション" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AplusContentTab({ project, onProjectUpdate }) {
  const [content, setContent] = useState(() => normalizeAplusContent(null));
  const contentRef = useRef(content);
  const activeProjectIdRef = useRef(project?.id || '');
  activeProjectIdRef.current = project?.id || '';
  const [loadError, setLoadError] = useState(null);
  const [migratedLegacyImage, setMigratedLegacyImage] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');

  useEffect(() => {
    if (!project) {
      const empty = normalizeAplusContent(null);
      contentRef.current = empty;
      setContent(empty);
      setLoadError(null);
      setMigratedLegacyImage(false);
      return;
    }
    const result = readAplusContent(project.kdp_meta, {
      legacyImageUrl: project.aplus_image_url || '',
      projectName: project.name || '',
    });
    contentRef.current = result.content;
    setContent(result.content);
    setLoadError(result.error);
    setMigratedLegacyImage(result.migratedLegacyImage);
  }, [project?.id, project?.kdp_meta, project?.aplus_image_url, project?.name]);

  const scheduleSave = useCallback((nextContent, delay = 800) => {
    if (!project || loadError) return;
    scheduleCoordinatedSave(`aplus-content:${project.id}`, async () => {
      const updated = await mutatePublishingProject(project.id, latest => {
        const normalized = normalizeAplusContent(nextContent);
        return {
          kdp_meta: writeAplusContent(latest?.kdp_meta || '', normalized),
          aplus_image_url: normalized.modules[0]?.images[0]?.image_url || '',
        };
      }, project);
      onProjectUpdate(updated);
    }, delay);
  }, [project, onProjectUpdate, loadError]);

  const updateContent = useCallback((updater, delay = 800) => {
    if (loadError) {
      toast.error('保存済みKDPデータを修復するまでA+内容を変更できません');
      return;
    }
    const current = contentRef.current;
    const next = normalizeAplusContent(typeof updater === 'function' ? updater(current) : updater);
    contentRef.current = next;
    setContent(next);
    scheduleSave(next, delay);
  }, [loadError, scheduleSave]);

  const updateImage = useCallback((moduleId, imageId, patch, delay = 800) => {
    updateContent(current => ({
      ...current,
      modules: current.modules.map(module => module.id === moduleId
        ? { ...module, images: module.images.map(image => image.id === imageId ? { ...image, ...patch } : image) }
        : module),
    }), delay);
  }, [updateContent]);

  const handleUpload = useCallback(async (moduleId, imageId, file) => {
    if (!project || loadError) {
      toast.error('A+データの形式エラーを解消してから画像を追加してください');
      return;
    }
    const targetProject = project;
    const key = `${moduleId}:${imageId}`;
    setUploadingKey(key);
    try {
      const prepared = await prepareAplusImageForUpload(file);
      const validation = validateAplusImageMetadata({
        type: prepared.file.type,
        size: prepared.file.size,
        width: prepared.width,
        height: prepared.height,
      });
      if (!validation.valid) throw new Error(validation.errors.join('／'));
      validation.warnings.forEach(message => toast.warning(message));

      const { file_url: imageUrl } = await base44.integrations.Core.UploadFile({ file: prepared.file });
      await flushPendingSaves();
      const updatedProject = await mutatePublishingProject(targetProject.id, latest => {
        const sourceProject = latest || targetProject;
        const result = readAplusContent(sourceProject.kdp_meta, {
          legacyImageUrl: sourceProject.aplus_image_url || '',
          projectName: sourceProject.name || '',
        });
        if (result.error) throw result.error;

        let foundImage = false;
        const nextContent = normalizeAplusContent({
          ...result.content,
          modules: result.content.modules.map(module => module.id === moduleId
            ? {
              ...module,
              images: module.images.map(image => {
                if (image.id !== imageId) return image;
                foundImage = true;
                return {
                  ...image,
                  image_url: imageUrl,
                  file_name: prepared.file.name || '',
                  file_size: prepared.file.size || 0,
                  original_file_name: prepared.originalName || '',
                  original_file_size: prepared.originalSize || 0,
                  optimized: prepared.optimized,
                  width: prepared.width,
                  height: prepared.height,
                };
              }),
            }
            : module),
        });
        if (!foundImage) throw new Error('画像の登録先が変更されています。もう一度選択してください');
        return {
          kdp_meta: writeAplusContent(sourceProject.kdp_meta || '', nextContent),
          aplus_image_url: nextContent.modules[0]?.images[0]?.image_url || '',
        };
      }, targetProject);

      onProjectUpdate(updatedProject);
      if (activeProjectIdRef.current === targetProject.id) {
        const saved = readAplusContent(updatedProject.kdp_meta, {
          legacyImageUrl: updatedProject.aplus_image_url || '',
          projectName: updatedProject.name || '',
        });
        contentRef.current = saved.content;
        setContent(saved.content);
      }
      const projectLabel = activeProjectIdRef.current === targetProject.id ? '' : `「${targetProject.name}」へ`;
      toast.success(prepared.optimized
        ? `${projectLabel}${(prepared.originalSize / 1_000_000).toFixed(2)}MB → ${(prepared.file.size / 1_000_000).toFixed(2)}MBへ自動軽量化して保存しました`
        : `${projectLabel}A+画像を保存しました`);
    } catch (error) {
      toast.error(error?.message || 'A+画像を保存できませんでした');
    } finally {
      setUploadingKey('');
    }
  }, [project, loadError, onProjectUpdate]);

  const handleDeleteImage = useCallback((moduleId, imageId) => {
    if (!window.confirm('この枠の画像と入力文をクリアしますか？')) return;
    updateImage(moduleId, imageId, {
      image_url: '', file_name: '', file_size: 0, width: 0, height: 0,
      original_file_name: '', original_file_size: 0, optimized: false,
      alt_text: '', headline: '', body: '', caption: '',
    }, 0);
  }, [updateImage]);

  const handleMoveImage = useCallback((moduleId, index, direction) => {
    updateContent(current => ({
      ...current,
      modules: current.modules.map(module => {
        if (module.id !== moduleId) return module;
        const images = [...module.images];
        const target = index + direction;
        if (target < 0 || target >= images.length) return module;
        [images[index], images[target]] = [images[target], images[index]];
        return { ...module, images };
      }),
    }));
  }, [updateContent]);

  const handleMoveModule = useCallback((moduleId, direction) => {
    updateContent(current => {
      const modules = [...current.modules];
      const index = modules.findIndex(module => module.id === moduleId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= modules.length) return current;
      [modules[index], modules[target]] = [modules[target], modules[index]];
      return { ...current, modules };
    });
  }, [updateContent]);

  const handleDeleteModule = useCallback(moduleId => {
    if (contentRef.current.modules.length <= 1) return;
    if (!window.confirm('このA+モジュールを削除しますか？')) return;
    updateContent(current => ({ ...current, modules: current.modules.filter(module => module.id !== moduleId) }), 0);
  }, [updateContent]);

  const readiness = useMemo(() => getAplusReadiness(content), [content]);
  const policyWarnings = useMemo(() => getAplusPolicyWarnings(content), [content]);
  const asinValidation = useMemo(() => validateAplusAsinText(content.asin_text), [content.asin_text]);
  const statusOption = APLUS_STATUS_OPTIONS.find(option => option.value === content.status) || APLUS_STATUS_OPTIONS[0];

  if (!project) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <BookOpen className="mx-auto h-10 w-10 opacity-30" />
        <p className="mt-3 text-sm">プロジェクトを選択してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="aplus-content-tab">
      <section className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Images className="h-5 w-5 text-neon-cyan" />
              <h2 className="text-base font-black text-neon-cyan neon-cyan-glow sm:text-lg">A+コンテンツ管理</h2>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${STATUS_COLORS[content.status] || STATUS_COLORS.draft}`}>{statusOption.label}</span>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              KDPの「標準複数画像モジュール A」と同じ4画像構成で、画像・代替テキスト・見出し・説明・キャプションをまとめて準備できます。
            </p>
          </div>
          <div className="w-full rounded-lg border border-neon-pink/25 bg-neon-pink/[0.035] p-3 lg:w-72">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">KDP転記準備度</span>
              <span className="font-black text-neon-pink">{readiness.percentage}%</span>
            </div>
            <Progress value={readiness.percentage} className="mt-2 h-2" />
            <p className="mt-2 text-[10px] text-muted-foreground">{readiness.done} / {readiness.total} 項目を準備済み</p>
          </div>
        </div>
        <div className="mt-4"><ProcessSteps /></div>
      </section>

      <KdpAplusSetupGuide />

      <aside className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.045] p-4" aria-label="A+画像の容量について">
        <div className="flex items-start gap-2">
          <Download className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
          <div>
            <p className="text-sm font-bold text-emerald-300">画像容量はツールが自動で整えます</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              「2MB未満」はKDPへ提出する1ファイルごとの条件で、ブラウザの保存上限とは別です。このツールは必要な画像だけ1.8MB以下を目標に軽量化し、加工後の画像だけをブラウザ内へ保存するため、両方の負担を減らせます。
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              公式ページ間で容量表記に差があるため、安全側の2MB未満で確認します。現在のKDP画面で表示される300×300px以上も確認しますが、PPIは自動保証できないため提出前チェックで確認してください。
            </p>
          </div>
        </div>
      </aside>

      {loadError && (
        <aside className="rounded-xl border border-red-500/40 bg-red-950/50 p-4 text-sm text-red-100" role="alert">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
            <div>
              <p className="font-bold">保存済みKDPデータに形式エラーがあります</p>
              <p className="mt-1 text-xs text-red-200/90">{loadError.message}。既存情報を上書きしないため、A+欄の保存を停止しています。</p>
            </div>
          </div>
        </aside>
      )}

      {migratedLegacyImage && !loadError && (
        <aside className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/[0.04] p-3 text-xs leading-relaxed text-neon-cyan">
          以前の「Amazon A+用画像」は、モジュール1の画像1へ引き継いで表示しています。何か編集すると新しいA+管理形式で保存されます。
        </aside>
      )}

      <fieldset disabled={Boolean(loadError || uploadingKey)} className="min-w-0 space-y-5 border-0 p-0">

      <section className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-neon-pink">最初に入力する情報</h3>
            <p className="mt-1 text-[10px] text-muted-foreground">KDPのA+コンテンツ作成画面で最初に求められる管理情報です。</p>
          </div>
          <a href={KDP_APLUS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-neon-cyan/30 bg-neon-cyan/10 px-3 text-xs font-bold text-neon-cyan transition hover:bg-neon-cyan/20">
            <ExternalLink className="h-3.5 w-3.5" />KDP公式の作成手順
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5 lg:col-span-2">
            <span className="flex items-center justify-between gap-2 text-xs font-bold">コンテンツ名<CharacterCount value={content.content_name} max={APLUS_FIELD_LIMITS.contentName} /></span>
            <input value={content.content_name} maxLength={APLUS_FIELD_LIMITS.contentName} onChange={event => updateContent(current => ({ ...current, content_name: event.target.value }))} placeholder="例：書籍名 A+コンテンツ" className="h-10 w-full rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-pink/60" style={INPUT_STYLE} />
            <p className="text-[10px] text-muted-foreground">読者には表示されない管理用の名前です。</p>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold">言語</span>
            <select value={content.language} onChange={event => updateContent(current => ({ ...current, language: event.target.value }))} className="h-10 w-full rounded-md px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/60" style={INPUT_STYLE}>
              <option value="ja-JP" className="bg-[#1a1a2e]">日本語</option>
              <option value="en-US" className="bg-[#1a1a2e]">英語</option>
              <option value="zh-CN" className="bg-[#1a1a2e]">簡体字中国語</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold">マーケットプレイス</span>
            <input value="Amazon.co.jp" readOnly aria-readonly="true" className="h-10 w-full cursor-not-allowed rounded-md px-3 text-sm text-muted-foreground focus:outline-none" style={INPUT_STYLE} />
            <p className="text-[10px] leading-relaxed text-muted-foreground">日本のKDPサイトからAmazon.co.jp向けに作成します。</p>
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-bold">対象ASIN</span>
            <textarea value={content.asin_text} onChange={event => updateContent(current => ({ ...current, asin_text: event.target.value }))} rows={3} placeholder="電子書籍・ペーパーバックなど、適用するASINを1行ずつ入力" className="w-full resize-y rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/60" style={INPUT_STYLE} />
            {content.asin_text.trim() && (
              <p className={`text-[10px] leading-relaxed ${asinValidation.valid ? 'text-emerald-300' : 'text-red-300'}`}>
                {asinValidation.valid
                  ? `${asinValidation.uniqueAsins.length}件のASINを確認しました`
                  : [
                    asinValidation.invalid.length > 0 ? `10文字の英数字ではない値：${asinValidation.invalid.join('、')}` : '',
                    asinValidation.duplicates.length > 0 ? `重複：${asinValidation.duplicates.join('、')}` : '',
                  ].filter(Boolean).join('／')}
              </p>
            )}
            <p className="text-[10px] leading-relaxed text-muted-foreground">同じKDPアカウントにある、販売中または予約注文中の本のASINを入力します。</p>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold">現在の状態</span>
            <select value={content.status} onChange={event => {
              const value = event.target.value;
              const today = new Date().toISOString().slice(0, 10);
              updateContent(current => ({
                ...current,
                status: value,
                submitted_at: value === 'submitted' && !current.submitted_at ? today : current.submitted_at,
                published_at: value === 'published' && !current.published_at ? today : current.published_at,
              }));
            }} className="h-10 w-full rounded-md px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/60" style={INPUT_STYLE}>
              {APLUS_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value} className="bg-[#1a1a2e]">{option.label}</option>)}
            </select>
            <p className="text-[10px] leading-relaxed text-muted-foreground">このツール内の手動記録です。KDPとは自動同期しません。</p>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1.5"><span className="text-xs font-bold">提出日</span><input type="date" value={content.submitted_at} onChange={event => updateContent(current => ({ ...current, submitted_at: event.target.value }))} className="h-10 w-full rounded-md px-2 text-xs text-foreground focus:outline-none" style={INPUT_STYLE} /></label>
            <label className="space-y-1.5"><span className="text-xs font-bold">公開日</span><input type="date" value={content.published_at} onChange={event => updateContent(current => ({ ...current, published_at: event.target.value }))} className="h-10 w-full rounded-md px-2 text-xs text-foreground focus:outline-none" style={INPUT_STYLE} /></label>
          </div>
        </div>
      </section>

      {policyWarnings.length > 0 && (
        <aside className="rounded-xl border border-neon-amber/35 bg-neon-amber/[0.045] p-4" aria-live="polite">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-neon-amber" />
            <div>
              <p className="text-sm font-bold text-neon-amber">審査前に確認したい表現があります</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">自動判定は参考です。文脈を確認し、不要なら言い換えてください。</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground/90">
                {policyWarnings.map(warning => <li key={warning.id}>・{warning.label}：<span className="text-neon-amber">{warning.matches.join('、')}</span></li>)}
              </ul>
            </div>
          </div>
        </aside>
      )}

      <div className="space-y-4">
        {content.modules.map((module, index) => (
          <ModuleEditor
            key={module.id}
            module={module}
            moduleIndex={index}
            moduleCount={content.modules.length}
            uploadingKey={uploadingKey}
            onChangeImage={updateImage}
            onUpload={handleUpload}
            onDeleteImage={handleDeleteImage}
            onMoveImage={handleMoveImage}
            onMoveModule={handleMoveModule}
            onDeleteModule={handleDeleteModule}
          />
        ))}
      </div>

      <Button
        type="button"
        onClick={() => updateContent(current => ({ ...current, modules: [...current.modules, createAplusModule()] }), 0)}
        disabled={content.modules.length >= APLUS_MAX_MODULES || Boolean(loadError)}
        className="min-h-11 w-full border border-dashed border-neon-cyan/40 bg-neon-cyan/[0.045] text-sm font-bold text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-40"
      >
        <Plus className="mr-2 h-4 w-4" />
        {content.modules.length >= APLUS_MAX_MODULES ? '最大5モジュールまで追加済み' : '標準複数画像モジュール A を追加'}
      </Button>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-neon-pink" />
            <h3 className="text-sm font-bold text-neon-pink">提出前チェック</h3>
          </div>
          <div className="space-y-2">
            {APLUS_CHECKLIST_ITEMS.map(item => (
              <label key={item.key} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-white/[0.02] px-3 py-2.5 transition hover:border-neon-pink/30">
                <input type="checkbox" checked={Boolean(content.checklist[item.key])} onChange={event => updateContent(current => ({ ...current, checklist: { ...current.checklist, [item.key]: event.target.checked } }))} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-pink-500" />
                <span className={`text-xs leading-relaxed ${content.checklist[item.key] ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Amazonの確認後、ガイドラインに適合した内容は通常8営業日以内に詳細ページへ表示されます。</p>
        </div>

        <div className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-neon-cyan">作業メモ</h3>
            <a href={KDP_GUIDELINES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-neon-cyan hover:text-neon-pink"><ExternalLink className="h-3 w-3" />公式ガイドライン</a>
          </div>
          <textarea value={content.notes} onChange={event => updateContent(current => ({ ...current, notes: event.target.value }))} rows={10} placeholder="修正指示、使用画像の出典、再提出予定などを記録" className="min-h-[220px] w-full resize-y rounded-md px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-neon-cyan/60" style={INPUT_STYLE} />
          <details className="mt-3 rounded-lg border border-border/70 bg-black/10 p-3">
            <summary className="cursor-pointer text-xs font-bold text-neon-amber">よくある審査NGを確認</summary>
            <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
              <li>・価格、割引、「無料」「ボーナス」、購入を促す表現</li>
              <li>・レビュー、競合比較、Kindle Unlimited、期間限定の表現</li>
              <li>・URL、QRコード、メール、電話番号、外部問い合わせ先</li>
              <li>・No.1、満足保証、配送・返金・保証、病気の治療や予防をうたう表現</li>
              <li>・引用は最大4件。著名人・著名な出版物に限り、出典と日付を記載</li>
              <li>・根拠のない受賞・認証、2年より古い受賞、HTML、選択言語以外の文章</li>
              <li>・Amazonのロゴや詳細ページの模倣、単独の著作権記号、商品画像ギャラリーと同じ画像</li>
              <li>・透かし、ぼやけ、スマホで読めない小文字、権利のない素材</li>
            </ul>
          </details>
        </div>
      </section>
      </fieldset>
    </div>
  );
}
