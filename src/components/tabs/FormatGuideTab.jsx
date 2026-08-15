import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  FileType2,
  Lightbulb,
  PenLine,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { mutatePublishingProject } from '@/lib/projectMutation';
import { scheduleCoordinatedSave } from '@/lib/saveCoordinator';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const INPUT_STYLE = { background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a4a' };

const OFFICIAL_LINKS = {
  formats: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G200634390',
  manuscript: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G200645680',
  toc: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G201605700',
  previewer: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G202131170',
  upload: 'https://kdp.amazon.co.jp/ja_JP/help/topic/G200641240',
  googleHeadings: 'https://support.google.com/docs/answer/116338?co=GENIE.Platform%3DDesktop&hl=ja-JP',
  googlePages: 'https://support.google.com/docs/answer/11528737?co=GENIE.Platform%3DDesktop&hl=ja',
  googleBreaks: 'https://support.google.com/docs/answer/11526892?co=GENIE.Platform%3DDesktop&hl=ja',
  googleDownload: 'https://support.google.com/docs/answer/49114?co=GENIE.Platform%3DDesktop&hl=ja',
};

const GUIDE_STEPS = [
  {
    icon: PenLine,
    title: '1. Google ドキュメントで原稿を作る',
    body: '本文を一つのドキュメントにまとめ、章見出しへ「見出し 1」、節へ「見出し 2」を設定します。スペースやTabキーで位置を合わせないのが崩れにくいコツです。',
  },
  {
    icon: FileText,
    title: '2. DOCXでダウンロード',
    body: '初心者には、Google ドキュメントから Microsoft Word（.docx）で書き出す流れがおすすめです。元のGoogle ドキュメントは編集用の原本として残します。',
  },
  {
    icon: Eye,
    title: '3. Kindle Previewerで確認',
    body: 'スマホ・タブレット・電子書籍リーダー表示を切り替え、目次リンク、改ページ、画像、文字サイズ変更時の崩れを確認します。',
  },
  {
    icon: UploadCloud,
    title: '4. KDPへアップロード',
    body: '修正はGoogle ドキュメント側で行い、DOCXを書き出し直して再確認します。KDPのオンラインプレビューも最後に確認してから公開します。',
  },
];

const GOOGLE_DOCS_STEPS = [
  {
    title: 'ページ形式にする',
    body: '「ファイル → ページ設定」で「ページ形式」を選び、用紙サイズをA5（14.8×21.0cm）にするのがおすすめです。本らしいページ感覚でKindle向け原稿の分量や改ページを確認しやすく、後からA5判の紙の本へ展開するときの下準備にも便利です。これはKDP電子書籍の指定ではなく、電子書籍の表示は端末や文字サイズで変わるためA5固定ではありません。紙版は入稿先の余白・裁ち落とし仕様へ別途調整してください。「ページ分けなし」では、改ページやヘッダーなど一部の機能が使えません。',
    link: OFFICIAL_LINKS.googlePages,
    linkLabel: 'Googleのページ設定ヘルプ',
  },
  {
    title: '見出しスタイルを設定する',
    body: '章タイトルは「見出し 1」、章内の節は「見出し 2」にします。文字を大きくするだけでは目次の構造になりません。',
    link: OFFICIAL_LINKS.googleHeadings,
    linkLabel: 'Googleの見出し・目次ヘルプ',
  },
  {
    title: '章の前に改ページを入れる',
    body: 'Enterキーの連打ではなく、「挿入 → 区切り → 改ページ」を使います。前の章を直しても、次章の開始位置がずれにくくなります。',
    link: OFFICIAL_LINKS.googleBreaks,
    linkLabel: 'Googleの改ページヘルプ',
  },
  {
    title: '自動目次を入れて更新する',
    body: '見出しを設定したあとに本文内の目次を挿入し、章名を直したときは目次を更新します。DOCX出力後は、Kindle Previewerで「本文内目次のリンク」とKindleの「移動」メニューに表示される目次（論理目次）の両方を確認します。',
    link: OFFICIAL_LINKS.toc,
    linkLabel: 'KDPの目次作成ガイド',
  },
  {
    title: '前付・本文・後付を整理する',
    body: 'タイトルページ、著作権表記、目次、本文、著者紹介、関連作品や案内の順に整理します。不要な空白行・タブ・手動ページ番号は減らします。',
    link: OFFICIAL_LINKS.manuscript,
    linkLabel: 'KDPの原稿フォーマットガイド',
  },
  {
    title: 'DOCXを書き出してプレビューする',
    body: '「ファイル → ダウンロード → Microsoft Word（.docx）」で書き出し、Kindle PreviewerとKDPのプレビューで端末ごとの表示を確認します。',
    link: OFFICIAL_LINKS.googleDownload,
    linkLabel: 'Googleのファイルダウンロード手順',
  },
];

const PREFLIGHT_ITEMS = [
  '章・節に「見出し 1」「見出し 2」が正しく設定されている',
  '本文内の目次から各章へ移動でき、章名の変更も目次へ反映されている',
  'Kindle Previewerの「移動」メニューに各章が並ぶ。表示されない場合は、見出し構造やDOCX／EPUBのナビゲーションを修正する',
  '章の開始は空行の連打ではなく改ページで区切っている',
  '段落の字下げや間隔は、スペースやTabではなく段落設定を使っている',
  'タイトル・著者名・著作権表記・著者紹介・リンクを確認した',
  '画像がつぶれておらず、スマホ幅でも内容を読める',
  '文字サイズを変えても、本文・画像・リンクが不自然に崩れない',
  'Kindle PreviewerとKDPのオンラインプレビューを両方確認した',
];

function OfficialLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-2 text-xs font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
    </a>
  );
}

function FormatCard({ title, badge, children, accent = 'pink' }) {
  const colors = accent === 'pink'
    ? 'border-neon-pink/30 bg-neon-pink/[0.04] text-neon-pink'
    : 'border-neon-cyan/30 bg-neon-cyan/[0.04] text-neon-cyan';

  return (
    <article className={`min-w-0 rounded-xl border p-4 ${colors}`}>
      <div className="flex flex-wrap items-center gap-2">
        <FileType2 className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <h3 className="font-bold">{title}</h3>
        <span className="rounded-full border border-current/30 px-2 py-0.5 text-[10px] font-bold">{badge}</span>
      </div>
      <div className="mt-3 space-y-2 text-xs leading-relaxed text-foreground/90">{children}</div>
    </article>
  );
}

export default function FormatGuideTab({ project, onProjectUpdate }) {
  const [postPublicationNotes, setPostPublicationNotes] = useState('');
  const activeProjectIdRef = useRef('');
  const onProjectUpdateRef = useRef(onProjectUpdate);
  const pendingNotesRef = useRef(new Map());
  const noteRevisionRef = useRef(new Map());

  onProjectUpdateRef.current = onProjectUpdate;

  useEffect(() => {
    const projectId = project?.id || '';
    activeProjectIdRef.current = projectId;

    if (!projectId) {
      setPostPublicationNotes('');
      return;
    }

    const pendingValue = pendingNotesRef.current.get(projectId);
    setPostPublicationNotes(
      typeof pendingValue === 'string'
        ? pendingValue
        : typeof project?.post_publication_notes === 'string'
          ? project.post_publication_notes
          : '',
    );
  }, [project?.id, project?.post_publication_notes]);

  const scheduleNotesSave = (value, delay = 900) => {
    if (!project?.id) return;

    const targetProject = project;
    const targetProjectId = project.id;
    const revision = (noteRevisionRef.current.get(targetProjectId) || 0) + 1;
    noteRevisionRef.current.set(targetProjectId, revision);
    pendingNotesRef.current.set(targetProjectId, value);

    scheduleCoordinatedSave(`post-publication-notes:${targetProjectId}`, async () => {
      const updated = await mutatePublishingProject(targetProjectId, () => ({
        post_publication_notes: value,
      }), targetProject);

      if (noteRevisionRef.current.get(targetProjectId) === revision) {
        pendingNotesRef.current.delete(targetProjectId);
      }

      // Home側もproject IDを照合する。切替後のプロジェクトへ古い保存結果を表示しない。
      onProjectUpdateRef.current?.(updated);

      if (
        activeProjectIdRef.current === targetProjectId
        && noteRevisionRef.current.get(targetProjectId) === revision
      ) {
        setPostPublicationNotes(value);
      }
    }, delay);
  };

  const handleNotesChange = event => {
    const value = event.target.value;
    setPostPublicationNotes(value);
    scheduleNotesSave(value);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl" style={CARD_STYLE}>
        <div className="border-b border-neon-pink/20 bg-gradient-to-r from-neon-pink/10 via-violet-500/5 to-neon-cyan/10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <BookOpen className="h-5 w-5 text-neon-pink" aria-hidden="true" />
                <h2 className="text-lg font-black text-neon-pink neon-pink-glow">Kindle原稿作成ガイド</h2>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
                  原稿を変更しない安全ガイド
                </span>
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-foreground/90">
                この画面では、原稿の貼り付け・ルビ付け・自動変換は行いません。編集用の原本はGoogle ドキュメントなどで管理し、書き出したファイルをプレビューしてからKDPへ登録します。
              </p>
            </div>
            <ShieldCheck className="hidden h-12 w-12 flex-shrink-0 text-emerald-300/60 sm:block" aria-hidden="true" />
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-neon-cyan/20 bg-neon-cyan/[0.05] p-3 text-xs leading-relaxed text-foreground/90">
            <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-neon-cyan" aria-hidden="true" />
            <p><strong className="text-neon-cyan">初心者におすすめ：</strong> Google ドキュメントで原稿を管理 → DOCXでダウンロード → Kindle Previewerで確認 → KDPへアップロード</p>
          </div>

          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="おすすめの原稿作成手順">
            {GUIDE_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative rounded-lg border border-white/10 bg-white/[0.025] p-3.5">
                  <Icon className="mb-2 h-5 w-5 text-neon-pink" aria-hidden="true" />
                  <h3 className="text-xs font-bold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{step.body}</p>
                  {index < GUIDE_STEPS.length - 1 && (
                    <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-neon-cyan/50 xl:block" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <FileType2 className="h-4 w-4 text-neon-cyan" aria-hidden="true" />
          <h2 className="text-sm font-bold text-neon-cyan neon-cyan-glow">DOCXとEPUB、どちらを選ぶ？</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FormatCard title="DOCX" badge="初心者におすすめ" accent="pink">
            <p>Google ドキュメントやWordで文章中心の本を作り、あとから修正しやすい形式です。KDPへアップロードするとKindle向けに変換されます。</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>本文・見出し・簡単な画像が中心の本に向く</li>
              <li>元原稿をGoogle ドキュメントで継続管理しやすい</li>
              <li>KDP変換後の表示と目次リンクは必ずPreviewerで確認する</li>
            </ul>
          </FormatCard>
          <FormatCard title="EPUB" badge="制作経験者向け" accent="cyan">
            <p>電子書籍の文書構造や表示を細かく管理できる形式です。専用ソフト等で正しく作成・検証できる場合に選びます。</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>ルビ・注釈・複雑な構造を扱う本で選択肢になる</li>
              <li>拡張子を変えただけのファイルは使わず、EPUB制作手順で作る</li>
              <li>エラー検証とKindle Previewerでの端末別確認が必要</li>
            </ul>
          </FormatCard>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs leading-relaxed text-amber-100/90 sm:flex-row sm:items-start">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" aria-hidden="true" />
          <p>ルビを多用する本や複雑なレイアウトは、DOCX変換だけで思いどおりにならない場合があります。このツールでは自動加工せず、EPUB制作に慣れた環境や専門家を利用したうえで、実機に近い表示を確認してください。</p>
        </div>
        <OfficialLink href={OFFICIAL_LINKS.formats}>KDP対応ファイル形式を確認</OfficialLink>
      </section>

      <section className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="mb-4 flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-neon-pink" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-neon-pink neon-pink-glow">Google ドキュメントで作る手順</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">見た目だけでなく、見出しや改ページの「文書構造」を整えるのがポイントです。</p>
          </div>
        </div>

        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {GOOGLE_DOCS_STEPS.map((step, index) => (
            <li key={step.title} className="rounded-lg border border-white/10 bg-white/[0.025] p-3.5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-neon-pink/40 bg-neon-pink/10 text-xs font-black text-neon-pink">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{step.body}</p>
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-neon-cyan hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70"
                  >
                    {step.linkLabel}<ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-neon-cyan" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-neon-cyan neon-cyan-glow">入稿前チェック</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">この一覧は確認用です。原稿そのものは元のGoogle ドキュメントで直してください。</p>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {PREFLIGHT_ITEMS.map(item => (
            <li key={item} className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-foreground/90">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <OfficialLink href={OFFICIAL_LINKS.previewer}>Kindle Previewer</OfficialLink>
          <OfficialLink href={OFFICIAL_LINKS.upload}>KDPのアップロード・プレビュー手順</OfficialLink>
          <OfficialLink href={OFFICIAL_LINKS.manuscript}>KDP原稿フォーマットガイド</OfficialLink>
        </div>
      </section>

      <section className="rounded-xl p-4 sm:p-5" style={CARD_STYLE}>
        <div className="mb-3 flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-neon-pink" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-neon-pink neon-pink-glow">出版後の展開メモ</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              読者の反応を受けた改訂、次作、ペーパーバック、音声・動画・講座への展開などを、プロジェクトごとに自由に残せます。
            </p>
          </div>
        </div>
        {project ? (
          <>
            <label htmlFor={`post-publication-notes-${project.id}`} className="sr-only">出版後の展開メモ</label>
            <textarea
              id={`post-publication-notes-${project.id}`}
              value={postPublicationNotes}
              onChange={handleNotesChange}
              onBlur={() => scheduleNotesSave(postPublicationNotes, 0)}
              rows={10}
              placeholder={'例：\n・読者から多かった質問を次回改訂で追記\n・テーマを深掘りした次作を企画\n・ペーパーバック版／音声版を検討\n・ブログ、動画、講座へ再構成\n・紹介した資料やリンクの更新時期を確認'}
              className="w-full resize-y rounded-lg px-3 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/60"
              style={{ ...INPUT_STYLE, minHeight: '220px' }}
            />
            <p className="mt-2 text-[10px] text-muted-foreground">入力内容はこのプロジェクトへ自動保存されます。</p>
          </>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 text-center text-xs text-muted-foreground">
            メモを保存するプロジェクトを選択してください。
          </div>
        )}
      </section>
    </div>
  );
}
