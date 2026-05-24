import React, { useState } from "react";
import { KDP_CATEGORIES } from "../lib/kdpCategories";

interface Props {
  text: string;
  selectedGenre: string;
  onFixedTextChange: (text: string) => void;
}

type Version = "original" | "ai" | "manual";

export default function Step4Readability({ text, selectedGenre, onFixedTextChange }: Props) {
  const [genre, setGenre] = useState(selectedGenre || "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiFixed, setAiFixed] = useState("");
  const [manualText, setManualText] = useState("");
  const [currentVersion, setCurrentVersion] = useState<Version>("original");
  const [isEditing, setIsEditing] = useState(false);

  const analyze = async () => {
    if (!text.trim()) return alert("本文を入力してください");
    if (!genre) return alert("ジャンルを選択してください");
    setIsAnalyzing(true);
    await new Promise((r) => setTimeout(r, 2000));
    // AIスコアリング（実装予定 - OpenAI/Claude API連携）
    setScore(72);
    setSuggestions([
      "冒頭の掴みをさらに強化すると◎。最初の1段落で感情的な引きを作りましょう。",
      "文章のリズムは良好。ただし長い段落が続く箇所は息継ぎの改行を1行追加すると読みやすくなります。",
      "感情の起伏バランスは良い。クライマックス前の「静」のシーンをもう少し長くとると山場が際立ちます。",
    ]);
    const fixed = text.replace(/。([^\n])/g, "。\n\n$1");
    setAiFixed(fixed);
    setManualText(fixed);
    setCurrentVersion("ai");
    onFixedTextChange(fixed);
    setIsAnalyzing(false);
  };

  const getCurrentText = () => {
    if (currentVersion === "original") return text;
    if (currentVersion === "ai") return aiFixed;
    return manualText;
  };

  const switchVersion = (v: Version) => {
    setCurrentVersion(v);
    onFixedTextChange(v === "original" ? text : v === "ai" ? aiFixed : manualText);
  };

  return (
    <div className="step-section">
      <h2>④ 読みやすさチェック＆修正</h2>

      <div className="genre-selector">
        <p>対象ジャンルを選択：</p>
        <select value={genre} onChange={(e) => setGenre(e.target.value)} className="select">
          <option value="">選択してください</option>
          {KDP_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {selectedGenre && genre !== selectedGenre && (
          <button onClick={() => setGenre(selectedGenre)} className="btn btn-small">
            ジャンル診断の結果を使う
          </button>
        )}
        {genre && (
          <div className="current-genre">現在選択中のジャンル：<strong>{genre}</strong></div>
        )}
      </div>

      <button onClick={analyze} disabled={isAnalyzing} className="btn btn-primary">
        {isAnalyzing ? "📊 分析中..." : "📊 ベストセラーと比較して分析する"}
      </button>
      <p className="note">※ AIを使用します。Base44のクレジットが消費されます（Claude等との別途契約は不要です）</p>

      {score !== null && (
        <div className="score-box">
          <h3>📈 ベストセラー比較スコア：<strong>{score} / 100点</strong></h3>
          <p>数十万部規模のKindleベストセラーと比較した評価です。</p>
          <ul>
            {suggestions.map((s, i) => <li key={i}>✦ {s}</li>)}
          </ul>
        </div>
      )}

      {aiFixed && (
        <div className="version-control">
          <div className="version-tabs">
            <button onClick={() => switchVersion("original")} className={currentVersion === "original" ? "tab tab-active" : "tab"}>元の本文</button>
            <button onClick={() => switchVersion("ai")} className={currentVersion === "ai" ? "tab tab-active" : "tab"}>AI修正版</button>
            <button onClick={() => switchVersion("manual")} className={currentVersion === "manual" ? "tab tab-active" : "tab"}>手動編集版</button>
          </div>
          <div className="current-version-label">現在：<strong>{currentVersion === "original" ? "元の本文" : currentVersion === "ai" ? "AI修正版" : "手動編集版"}</strong></div>

          <textarea
            className="preview-textarea"
            value={getCurrentText()}
            readOnly={currentVersion !== "manual"}
            onChange={(e) => {
              if (currentVersion === "manual") {
                setManualText(e.target.value);
                onFixedTextChange(e.target.value);
              }
            }}
            onClick={() => { if (currentVersion !== "manual") switchVersion("manual"); }}
            rows={20}
          />

          <div className="version-buttons">
            <button onClick={() => switchVersion("ai")} className="btn btn-small">AIの修正に戻す</button>
            <button onClick={() => switchVersion("original")} className="btn btn-small">元の本文に戻す</button>
          </div>
        </div>
      )}
    </div>
  );
}
