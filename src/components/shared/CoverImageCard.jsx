import React, { useEffect, useId, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, ImageIcon, Info, LoaderCircle, TriangleAlert, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { assessKindleCoverDimensions, KINDLE_COVER_LINKS } from '@/lib/coverImageGuidance';
import { downloadImage, getImageDataUrl } from '@/lib/localImageStore';
import { mutatePublishingProject } from '@/lib/projectMutation';
import { flushPendingSaves } from '@/lib/saveCoordinator';
import { toast } from 'sonner';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };

export default function CoverImageCard({ project, onProjectUpdate }) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageDimensions, setImageDimensions] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    let active = true;
    setImageDimensions(null);
    getImageDataUrl(project?.cover_image_url)
      .then(url => { if (active) setPreviewUrl(url || ''); })
      .catch(() => { if (active) setPreviewUrl(''); });
    return () => { active = false; };
  }, [project?.cover_image_url]);

  const dimensionAssessment = assessKindleCoverDimensions(
    imageDimensions?.width,
    imageDimensions?.height,
  );
  const DimensionIcon = dimensionAssessment.level === 'success'
    ? CheckCircle2
    : dimensionAssessment.level === 'warning'
      ? TriangleAlert
      : Info;
  const dimensionTone = dimensionAssessment.level === 'success'
    ? 'border-emerald-500/25 bg-emerald-500/[0.05] text-emerald-300'
    : dimensionAssessment.level === 'warning'
      ? 'border-neon-amber/30 bg-neon-amber/[0.05] text-neon-amber'
      : 'border-neon-cyan/20 bg-neon-cyan/[0.035] text-neon-cyan';

  const handleUpload = async file => {
    if (!project || !file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setUploadError('画像ファイルを選択してください。');
      return;
    }

    const targetProject = project;
    setUploading(true);
    setUploadError('');
    try {
      const { file_url: fileUrl } = await base44.integrations.Core.UploadFile({ file });
      await flushPendingSaves();
      const updated = await mutatePublishingProject(targetProject.id, () => ({
        cover_image_url: fileUrl,
      }), targetProject);
      onProjectUpdate(updated);
      toast.success('表紙画像を保存しました');
    } catch (error) {
      const message = error?.message || '表紙画像を保存できませんでした';
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-xl p-4 sm:p-5" style={CARD_STYLE} aria-labelledby="cover-image-heading">
      <div className="flex items-start gap-2">
        <ImageIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-pink" />
        <div>
          <h3 id="cover-image-heading" className="text-sm font-bold text-neon-pink">表紙画像</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Kindle本の表紙をここで保管できます。これまで登録した表紙データもそのまま表示されます。
          </p>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
        <div className="mx-auto flex aspect-[5/8] w-full max-w-[160px] items-center justify-center overflow-hidden rounded-lg border border-neon-pink/30 bg-black/30">
          {project?.cover_image_url && previewUrl ? (
            <img
              src={previewUrl}
              alt="保存済みの表紙画像"
              className="h-full w-full object-contain"
              onLoad={event => setImageDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })}
            />
          ) : (
            <div className="px-4 text-center text-muted-foreground">
              <ImageIcon className="mx-auto h-9 w-9 opacity-25" />
              <p className="mt-2 text-[10px]">表紙画像は未登録です</p>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-lg border border-neon-pink/25 bg-neon-pink/[0.045] p-3">
            <p className="text-xs font-bold text-neon-pink">Kindle電子書籍用（幅 × 高さ）</p>
            <p className="mt-1 text-[11px] font-bold text-foreground">推奨 1,600 × 2,560px（高さ:幅＝1.6:1）</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              最小 625 × 1,000px／各辺最大 10,000px。KDP入稿用はJPEGまたはTIFF・RGB・50MB未満で書き出してください。
            </p>
            <a
              href={KINDLE_COVER_LINKS.ebookRequirements}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-neon-cyan hover:text-neon-pink"
            >
              <ExternalLink className="h-3 w-3" />KDP公式の表紙仕様
            </a>
          </div>

          <div className={`rounded-lg border p-3 ${dimensionTone}`} aria-live="polite">
            <div className="flex items-start gap-2">
              <DimensionIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-bold">
                  {imageDimensions
                    ? `登録画像：${imageDimensions.width.toLocaleString()} × ${imageDimensions.height.toLocaleString()}px`
                    : '登録画像の寸法チェック'}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{dimensionAssessment.message}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neon-cyan/20 bg-neon-cyan/[0.03] p-3">
            <p className="text-xs font-bold text-neon-cyan">将来、A5・A6などの紙版も作るなら</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              A5・A6へ最初から固定せず、文字・人物・背景を直せる元データを保存するのがおすすめです。紙版は判型だけでなく、ページ数・用紙・塗り足しで背幅を含む表紙全体の寸法が変わります。本文確定後に、入稿先の最新テンプレートを使い、画像は300dpi以上を目安に別ファイルを書き出してください。
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              <a href={KINDLE_COVER_LINKS.paperbackCalculator} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-neon-cyan hover:text-neon-pink">
                <ExternalLink className="h-3 w-3" />KDP表紙計算ツール
              </a>
              <a href={KINDLE_COVER_LINKS.shimaumaTemplates} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-neon-cyan hover:text-neon-pink">
                <ExternalLink className="h-3 w-3" />しまうま出版のA5・A6テンプレート
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white/[0.025] p-3 text-[10px] leading-relaxed text-muted-foreground">
            このツールへの保管はJPG・PNGなどを選択できます。画像はこのブラウザ内へ保存され、データ管理のバックアップにも含まれます。
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label
              htmlFor={inputId}
              aria-disabled={uploading}
              className={`inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-neon-pink/40 bg-neon-pink/15 px-4 text-xs font-bold text-neon-pink transition hover:bg-neon-pink/25 ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              {uploading ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              {uploading ? '保存中…' : project?.cover_image_url ? '表紙を差し替える' : '表紙を選択する'}
            </label>
            {project?.cover_image_url && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-10 border border-border px-4 text-xs text-muted-foreground hover:text-neon-cyan"
                onClick={() => downloadImage(project.cover_image_url, `${project.name || 'Kindle本'}_表紙.png`)
                  .catch(error => toast.error(error?.message || '表紙画像をダウンロードできませんでした'))}
              >
                <Download className="mr-1.5 h-4 w-4" />ダウンロード
              </Button>
            )}
          </div>

          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
              event.target.value = '';
            }}
          />
          {uploadError && <p className="text-xs leading-relaxed text-red-300" role="alert">{uploadError}</p>}
        </div>
      </div>
    </section>
  );
}
