import React, { useState } from "react";
import { DEFAULT_RUBY_DICT } from "../lib/kdpCategories";

interface Props {
  text: string;
  onRubyApplied: (text: string) => void;
}

export default function Step3Ruby({ text, onRubyApplied }: Props) {
  const [rubyMode, setRubyMode] = useState<"first" | "all">("first");
  const [rubyDict, setRubyDict] = useState<Record<string, string | null>>(DEFAULT_RUBY_DICT);
  const [processedText, setProcessedText] = useState("");
  const [pendingList, setPendingList] = useState<string[]>([]);

  const applyRuby = () => {
    if (!text.trim()) return alert("本文を入力してください");
    let result = text;
    const seen = new Set<string>();

    for (const [word, reading] of Object.entries(rubyDict)) {
      if (reading === null) continue; // 削除済み
      if (rubyMode === "first") {
        let found = false;
        result = result.replace(new RegExp(word, "g"), (match) => {
          if (!found) { found = true; return `${match}《${reading}》`; }
          return match;
        });
      } else {
        result = result.replace(new RegExp(word, "g"), `$&《${reading}》`);
      }
    }

    setProcessedText(result);
    onRubyApplied(result);
  };

  const removeRuby = (word: string) => {
    setRubyDict((prev) => ({ ...prev, [word]: null }));
  };

  return (
    <div className="step-section">
      <h2>③ ルビ付け</h2>

      <div className="ruby-mode">
        <p><strong>ルビの付与方法：</strong></p>
        <label>
          <input type="radio" value="first" checked={rubyMode === "first"} onChange={() => setRubyMode("first")} />
          　初出のみ（同じ単語は最初の1回だけ）← 推奨
        </label>
        <br />
        <label>
          <input type="radio" value="all" checked={rubyMode === "all"} onChange={() => setRubyMode("all")} />
          　すべてに振る（出るたびに振る）
        </label>
      </div>

      <div className="ruby-dict">
        <p><strong>ルビ辞書（クリックで削除）：</strong></p>
        <div className="ruby-tags">
          {Object.entries(rubyDict).map(([word, reading]) =>
            reading !== null ? (
              <span key={word} className="ruby-tag">
                {word}《{reading}》
                <button onClick={() => removeRuby(word)} className="ruby-delete">×</button>
              </span>
            ) : (
              <span key={word} className="ruby-tag ruby-deleted">
                {word}（ルビなし）
              </span>
            )
          )}
        </div>
      </div>

      <button onClick={applyRuby} className="btn btn-primary">
        ルビを付与する
      </button>

      {processedText && (
        <div className="preview-box">
          <p><strong>プレビュー（先頭500文字）：</strong></p>
          <pre>{processedText.slice(0, 500)}...</pre>
        </div>
      )}
    </div>
  );
}
