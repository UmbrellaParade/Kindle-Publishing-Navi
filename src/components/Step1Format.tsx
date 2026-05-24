import React, { useState } from "react";

interface Props {
  text: string;
  onFormatDecided: (format: "docx" | "epub") => void;
}

export default function Step1Format({ text, onFormatDecided }: Props) {
  const [hasLinks, setHasLinks] = useState<boolean | null>(null);
  const hasUrlInText = /https?:\/\//.test(text);

  const handleYes = () => {
    setHasLinks(true);
    onFormatDecided("docx");
  };
  const handleNo = () => {
    setHasLinks(false);
  };

  return (
    <div className="step-section">
      <h2>① フォーマット判定</h2>

      {hasUrlInText && (
        <div className="alert alert-warning">
          ⚠️ 本文にURLリンクが検出されました。<strong>docx形式を強く推奨します。</strong>
        </div>
      )}

      <p>本文に外部URLリンク（楽曲リンク等）はありますか？</p>
      <div className="button-group">
        <button onClick={handleYes} className={hasLinks === true ? "btn btn-active" : "btn"}>
          Yes（リンクあり）
        </button>
        <button onClick={handleNo} className={hasLinks === false ? "btn btn-active" : "btn"}>
          No（リンクなし）
        </button>
      </div>

      {hasLinks === true && (
        <div className="result-box result-docx">
          <p>✅ <strong>推奨形式：.docx</strong></p>
          <p>URLリンクが含まれる場合、epubではリンクが正常に機能しない場合があります。Kindle推奨のdocx形式を選択してください。</p>
        </div>
      )}

      {hasLinks === false && (
        <div>
          <p>AIが本文を解析してフォーマットを判定します。</p>
          <div className="button-group">
            <button onClick={() => onFormatDecided("epub")} className="btn btn-primary">
              epub（リフロー型・一般的）
            </button>
            <button onClick={() => onFormatDecided("docx")} className="btn">
              docx（レイアウト固定）
            </button>
          </div>
          <p className="note">⚠️ URLリンクがある場合はdocxを選んでください</p>
        </div>
      )}
    </div>
  );
}
