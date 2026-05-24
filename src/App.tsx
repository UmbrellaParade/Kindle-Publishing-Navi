import React, { useState } from "react";
import Step1Format from "./components/Step1Format";
import Step2Genre from "./components/Step2Genre";
import Step3Ruby from "./components/Step3Ruby";
import Step4Readability from "./components/Step4Readability";
import Step5Output from "./components/Step5Output";
import "./App.css";

export default function App() {
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"docx" | "epub" | null>(null);
  const [genre, setGenre] = useState("");
  const [rubyText, setRubyText] = useState("");
  const [aiFixedText, setAiFixedText] = useState("");
  const [manualText, setManualText] = useState("");
  const [currentVersion, setCurrentVersion] = useState<"original" | "ai" | "manual">("original");

  return (
    <div className="app">
      <header className="app-header">
        <h1>🌂 Umbrella Parade<br />Kindle出版ナビ</h1>
        <p>KDP入稿をステップ形式でサポートするツールです</p>
      </header>

      <div className="text-input-section">
        <h2>📄 本文を貼り付けてください</h2>
        <textarea
          className="main-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ここに小説本文を貼り付けてください..."
          rows={10}
        />
        <p className="char-count">{text.length.toLocaleString()} 文字</p>
      </div>

      <Step1Format text={text} onFormatDecided={setFormat} />
      <Step2Genre text={text} onGenreSelected={setGenre} />
      <Step3Ruby text={text} onRubyApplied={setRubyText} />
      <Step4Readability
        text={rubyText || text}
        selectedGenre={genre}
        onFixedTextChange={(t) => {
          setAiFixedText(t);
          setManualText(t);
        }}
      />
      <Step5Output
        originalText={text}
        aiFixedText={aiFixedText}
        manualText={manualText}
        currentVersion={currentVersion}
      />
    </div>
  );
}
