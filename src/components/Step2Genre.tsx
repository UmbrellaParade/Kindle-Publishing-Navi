import React, { useState } from "react";
import { KDP_CATEGORIES } from "../lib/kdpCategories";

interface Props {
  text: string;
  onGenreSelected: (genre: string) => void;
}

export default function Step2Genre({ text, onGenreSelected }: Props) {
  const [diagnosedGenre, setDiagnosedGenre] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const diagnose = async () => {
    if (!text.trim()) return alert("本文を入力してください");
    setIsAnalyzing(true);
    // AIによるジャンル診断（Base44 / OpenAI API経由で実装予定）
    // ここではUmbrella Paradeのデフォルトを仮セット
    await new Promise((r) => setTimeout(r, 1500));
    const genre = "フィクション > ファンタジー > ダークファンタジー";
    const recs = [
      "フィクション > ファンタジー > ダークファンタジー",
      "フィクション > 文学",
      "フィクション > 一般",
    ];
    setDiagnosedGenre(genre);
    setRecommendations(recs);
    setSelectedGenre(genre);
    onGenreSelected(genre);
    setIsAnalyzing(false);
  };

  return (
    <div className="step-section">
      <h2>② ジャンル診断</h2>
      <p>本文を読み込んでAIがジャンルを自動診断します。</p>

      <button onClick={diagnose} disabled={isAnalyzing} className="btn btn-primary">
        {isAnalyzing ? "🔍 診断中..." : "🔍 ジャンルを診断する"}
      </button>
      <p className="note">※ AIを使用します。Base44のクレジットが消費されます（Claude等との別途契約は不要です）</p>

      {diagnosedGenre && (
        <div className="result-box">
          <p>📊 <strong>診断結果：</strong>{diagnosedGenre}</p>
          <p><strong>おすすめカテゴリー（KDP実在）：</strong></p>
          <ul>
            {recommendations.map((r, i) => (
              <li key={i}>
                {i === 0 ? "🥇 1位狙い" : i === 1 ? "🥈 2位狙い" : "🥉 3位狙い"}：{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="manual-select">
        <p>🎯 <strong>狙うジャンルを手動で選択：</strong></p>
        <select
          value={selectedGenre}
          onChange={(e) => { setSelectedGenre(e.target.value); onGenreSelected(e.target.value); }}
          className="select"
        >
          <option value="">選択してください</option>
          {KDP_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        {diagnosedGenre && (
          <button
            onClick={() => { setSelectedGenre(diagnosedGenre); onGenreSelected(diagnosedGenre); }}
            className="btn btn-small"
          >
            診断結果を使う
          </button>
        )}
      </div>

      {selectedGenre && (
        <div className="current-genre">
          現在選択中のジャンル：<strong>{selectedGenre}</strong>
        </div>
      )}
    </div>
  );
}
