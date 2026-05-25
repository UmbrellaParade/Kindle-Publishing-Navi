import React from 'react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';
import { FileText, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const URL_REGEX = /https?:\/\/[^\s。、！？\]）)]+/;

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textWithRubyToXhtml(text) {
  const pattern = /[｜|]([^《\n]{1,40})《([^》\n]{1,40})》/g;
  let output = '';
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    output += escapeXml(text.slice(lastIndex, match.index));
    output += `<ruby>${escapeXml(match[1])}<rp>（</rp><rt>${escapeXml(match[2])}</rt><rp>）</rp></ruby>`;
    lastIndex = pattern.lastIndex;
  }

  output += escapeXml(text.slice(lastIndex));
  return output;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildDocx(text) {
  const children = text.split('\n').map((line) => new Paragraph({
    children: [
      new TextRun({
        text: line.trim() === '' ? ' ' : line,
        font: 'Yu Mincho',
        size: 22,
      }),
    ],
    spacing: {
      line: 360,
      after: line.trim() === '' ? 120 : 80,
    },
  }));

  return new Document({
    creator: 'Umbrella Parade Kindle出版ナビ',
    title: 'Kindle manuscript',
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

function buildXhtml(text) {
  const lines = text.split('\n').map(line =>
    line.trim() === '' ? '<p>&#x3000;</p>' : `<p>${textWithRubyToXhtml(line)}</p>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">
<head><title>原稿</title>
<style>body{font-family:'Yu Mincho',serif;font-size:1em;line-height:2;} p{margin:0.5em 0;}</style>
</head><body>${lines}</body></html>`;
}

async function buildEpub(text) {
  const zip = new JSZip();
  const content = buildXhtml(text);
  const identifier = `urn:uuid:${crypto.randomUUID?.() || Date.now()}`;

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.folder('META-INF').file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  const oebps = zip.folder('OEBPS');
  oebps.file('content.xhtml', content);
  oebps.file('nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja">
<head><title>目次</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目次</h1>
    <ol><li><a href="content.xhtml">本文</a></li></ol>
  </nav>
</body>
</html>`);
  oebps.file('package.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="bookid" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${identifier}</dc:identifier>
    <dc:title>Kindle manuscript</dc:title>
    <dc:language>ja</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="content"/>
  </spine>
</package>`);

  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

export default function Step5Export({ sharedText, versionState }) {
  const hasUrl = URL_REGEX.test(sharedText);
  const hasText = sharedText.trim().length > 0;

  const getOutputText = () => {
    if (!versionState) return sharedText;
    const { currentVersion, originalText, aiText, manualText } = versionState;
    if (currentVersion === 'ai' && aiText) return aiText;
    if (currentVersion === 'manual' && manualText) return manualText;
    return originalText || sharedText;
  };

  const downloadDocx = async () => {
    const text = getOutputText();
    const blob = await Packer.toBlob(buildDocx(text));
    downloadBlob(blob, 'kindle-manuscript.docx');
    toast.success('DOCXをダウンロードしました');
  };

  const downloadEpub = async () => {
    if (hasUrl) { toast.warning('URLリンクがあります。docxを推奨します。'); }
    const text = getOutputText();
    const blob = await buildEpub(text);
    downloadBlob(blob, 'kindle-manuscript.epub');
    toast.success('EPUBをダウンロードしました');
  };

  return (
    <div className="rounded-xl p-4 space-y-4" style={CARD_STYLE}>
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-neon-cyan" />
        <h3 className="text-sm font-bold text-neon-cyan neon-cyan-glow">DOCX / EPUB 出力形式とルビ表記の違い</h3>
      </div>

      {/* バージョン選択 */}
      {versionState && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)' }}>
          <p className="text-xs font-bold text-neon-cyan mb-2">出力するバージョンを選択</p>
          <div className="flex gap-2 flex-wrap">
            {[{ key: 'original', label: '元の本文' }, { key: 'ai', label: 'AI修正版' }, { key: 'manual', label: '手動編集版' }].map(({ key, label }) => (
              <button key={key} onClick={() => versionState.onVersionChange?.({ ...versionState, currentVersion: key })}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors font-bold ${versionState.currentVersion === key ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50' : 'text-muted-foreground border-border hover:text-foreground'}`}
                style={versionState.currentVersion !== key ? { background: 'rgba(255,255,255,0.04)' } : {}}
              >{label}</button>
            ))}
          </div>
        </div>
      )}

      {hasUrl && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(255,179,0,0.07)', border: '1px solid rgba(255,179,0,0.25)' }}>
          <AlertTriangle className="w-3.5 h-3.5 text-neon-amber flex-shrink-0 mt-0.5" />
          <p className="text-xs text-neon-amber">URLリンクがある作品はdocxを推奨します。epubではリンクが正しく埋め込まれない場合があります。</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,45,120,0.04)', border: '1px solid rgba(255,45,120,0.18)' }}>
          <p className="text-xs font-bold text-neon-pink">DOCXの注意点</p>
          <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
            <li>・KDPへ手軽にアップロードしたい場合に向いています。</li>
            <li>・このツールのルビは <code className="text-foreground">｜漢字《かな》</code> の表記として本文に残ります。</li>
            <li>・Word上の正式なルビ表示にしたい場合は、DOCX側で別途調整が必要です。</li>
          </ul>
        </div>
        <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.18)' }}>
          <p className="text-xs font-bold text-neon-cyan">EPUBの注意点</p>
          <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
            <li>・ルビを実際のHTML rubyタグとして出したい場合に向いています。</li>
            <li>・<code className="text-foreground">｜漢字《かな》</code> の表記を <code className="text-foreground">&lt;ruby&gt;&lt;rt&gt;</code> 形式へ変換します。</li>
            <li>・KDPへ登録する前にKindle Previewerで表示確認してください。</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-lg space-y-2" style={{ background: 'rgba(255,45,120,0.05)', border: '1px solid rgba(255,45,120,0.25)' }}>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-neon-pink" />
            <span className="text-sm font-bold text-neon-pink">docx（游明朝・11pt）</span>
            {hasUrl && <span className="text-[10px] text-neon-pink bg-neon-pink/20 px-1.5 py-0.5 rounded">推奨</span>}
          </div>
          <p className="text-xs text-muted-foreground">URLリンク有りの作品・初心者・手軽に出版したい場合</p>
          <p className="text-[10px] text-muted-foreground">ルビ表記: ｜漢字《かな》 のまま出力</p>
          <Button onClick={downloadDocx} disabled={!hasText} className="w-full h-8 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30 disabled:opacity-40">
            <Download className="w-3.5 h-3.5 mr-1.5" />docxダウンロード
          </Button>
        </div>

        <div className="p-4 rounded-lg space-y-2" style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.2)' }}>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-neon-cyan" />
            <span className="text-sm font-bold text-neon-cyan">epub</span>
          </div>
          <p className="text-xs text-muted-foreground">レイアウトにこだわりたい・ルビをHTML rubyタグに変換したい場合</p>
          <p className="text-[10px] text-muted-foreground">ルビ表記: ｜漢字《かな》 → HTML rubyタグ</p>
          <Button onClick={downloadEpub} disabled={!hasText} className="w-full h-8 text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 disabled:opacity-40">
            <Download className="w-3.5 h-3.5 mr-1.5" />epubダウンロード
          </Button>
          {hasUrl && <p className="text-[10px] text-neon-amber">⚠️ URLリンクあり → docx推奨</p>}
        </div>
      </div>
    </div>
  );
}
