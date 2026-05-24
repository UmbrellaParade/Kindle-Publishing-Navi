import React, { useState } from "react";
import { downloadAsDocx, downloadAsEpub } from "../lib/downloadHelpers";

interface Props {
  originalText: string;
  aiFixedText: string;
  manualText: string;
  currentVersion: "original" | "ai" | "manual";
}

export default function Step5Output({ originalText, aiFixedText, manualText, currentVersion }: Props) {
  const [format, setFormat] = useState<"docx" | "epub">("docx");
  const hasUrl = /https?:\/\//.test(originalText);

  const getCurrentText = () => {
    if (currentVersion === "original") return originalText;
    if (currentVersion === "ai") return aiFixedText;
    return manualText;
  };

  const versionLabel = currentVersion === "original" ? "元の本文" : currentVersion === "ai" ? "AI修正版" : "手動編集版";

  const handleDownload = async () => {
    const text = getCurrentText();
    if (format === "docx") {
      await downloadAsDocx(text, "umbrella_parade_kindle");
    } else {
      downloadAsEpub(text, "umbrella_parade_kindle");
    }
  };

  return (
    <div className="step-section">
      <h2>⑤ 出力</h2>

      <div className="format-select">
        <p><strong>ダウンロード形式：</strong></p>
        <label>
          <input type="radio" value="docx" checked={format === "docx"} onChange={() => setFormat("docx")} />
          　.docx（推奨：URLリンクがある場合）
        </label>
        <br />
        <label>
          <input type="radio" value="epub" checked={format === "epub"} onChange={() => setFormat("epub")} />
          　.epub（URLリンクがない場合）
        </label>
        {format === "epub" && hasUrl && (
          <div className="alert alert-warning">
            ⚠️ URLリンクが含まれている場合はdocxを推奨します
          </div>
        )}
      </div>

      <div className="download-info">
        現在：<strong>{versionLabel}</strong>をダウンロードします
      </div>

      <button onClick={handleDownload} className="btn btn-primary btn-large">
        📥 修正済み本文を.{format}でダウンロード
      </button>
    </div>
  );
}
