import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle, Copy, ExternalLink, FileInput, KeyRound, Save, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const AI_SETTINGS_KEY = 'kindle_navi_ai_settings';

const DEFAULT_SETTINGS = {
  defaultProvider: 'chatgpt',
  openaiApiKey: '',
  openaiModel: 'gpt-4.1',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-pro',
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-4-5',
};

const PROVIDERS = [
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/' },
  { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/' },
  { id: 'claude', label: 'Claude', url: 'https://claude.ai/' },
];

const TASKS = [
  { id: 'format', label: 'フォーマット判定' },
  { id: 'genre', label: 'ジャンル診断' },
  { id: 'ruby', label: 'ルビ付け' },
  { id: 'readability', label: '読みやすさ修正' },
];

function loadAiSettings() {
  try {
    const saved = localStorage.getItem(AI_SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function extractJson(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildPrompt(taskId, providerLabel, sharedText) {
  const text = sharedText.trim();
  const commonHeader = `あなたはKindle出版の編集者です。以下の原稿を、KDP入稿前の実務チェックとして扱ってください。

使用AI: ${providerLabel}
重要:
- 原稿の意味、設定、登場人物を勝手に変えないでください。
- 出力指定を必ず守ってください。
- 説明文を長くせず、作業結果をそのまま貼り戻せる形にしてください。`;

  if (taskId === 'format') {
    return `${commonHeader}

作業: Kindle入稿フォーマット判定
次のJSONだけを返してください。

{
  "recommendation": "docx または epub",
  "reason": "推奨理由を1〜2文",
  "has_special_layout": false,
  "warnings": ["注意点があれば短く"]
}

原稿:
${text}`;
  }

  if (taskId === 'genre') {
    return `${commonHeader}

作業: Kindleジャンル診断とKDPカテゴリー候補
次のJSONだけを返してください。

{
  "genre_label": "作品ジャンル名",
  "diagnosis": "なぜそのジャンルかを2〜4文",
  "kdp_categories": ["KDPカテゴリー候補1", "KDPカテゴリー候補2", "KDPカテゴリー候補3"],
  "category_strategy": "カテゴリー選定の戦略を1〜2文"
}

原稿:
${text}`;
  }

  if (taskId === 'ruby') {
    return `${commonHeader}

作業: ルビ付け
出力は本文だけにしてください。説明や前置きは不要です。
ルビは青空文庫風の「｜漢字《かな》」形式で付けてください。
一般的な常用漢字には過剰にルビを振らず、固有名詞、難読語、作品独自語を優先してください。

原稿:
${text}`;
  }

  return `${commonHeader}

作業: 読みやすさ修正
出力は修正後本文だけにしてください。説明や前置きは不要です。
修正方針:
- 一文が長すぎる箇所を分割する
- 会話の前後に読みやすい余白を置く
- 感情が高まる場面は短い文や改行で余韻を作る
- 意味、設定、登場人物名、固有名詞は変えない
- Kindle読者がスマホで読みやすい行間・リズムに整える

原稿:
${text}`;
}

export default function ExternalAiWorkspace({ sharedText, onDiagnosed, onVersionChange }) {
  const [provider, setProvider] = useState('chatgpt');
  const [task, setTask] = useState('readability');
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [settings, setSettings] = useState(loadAiSettings);

  useEffect(() => {
    if (settings.defaultProvider) setProvider(settings.defaultProvider);
  }, []);

  const selectedProvider = PROVIDERS.find(item => item.id === provider) || PROVIDERS[0];
  const selectedTask = TASKS.find(item => item.id === task) || TASKS[0];
  const canUse = sharedText.trim().length >= 50;

  const prompt = useMemo(
    () => buildPrompt(task, selectedProvider.label, sharedText),
    [task, selectedProvider.label, sharedText]
  );

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(`${selectedProvider.label}用プロンプトをコピーしました`);
    } catch {
      toast.error('コピーできませんでした。プロンプト欄から手動でコピーしてください');
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
      setProvider(settings.defaultProvider);
      toast.success('AI設定をこのブラウザに保存しました');
    } catch {
      toast.error('AI設定を保存できませんでした');
    }
  };

  const clearSettings = () => {
    try {
      localStorage.removeItem(AI_SETTINGS_KEY);
      setSettings(DEFAULT_SETTINGS);
      setProvider(DEFAULT_SETTINGS.defaultProvider);
      toast.success('AI設定をクリアしました');
    } catch {
      toast.error('AI設定をクリアできませんでした');
    }
  };

  const applyAnswer = () => {
    if (!answer.trim()) {
      toast.error('AIの回答を貼り付けてください');
      return;
    }

    if (task === 'format' || task === 'genre') {
      const parsed = extractJson(answer);
      if (!parsed) {
        toast.error('JSONとして読み取れませんでした。AIに「JSONだけで再出力」と依頼してください');
        return;
      }

      setResult(parsed);
      if (task === 'genre' && parsed.kdp_categories?.[0]) {
        onDiagnosed?.({
          genreLabel: parsed.genre_label || '',
          primaryCategory: parsed.kdp_categories[0],
          kdpCategories: parsed.kdp_categories,
          source: 'external-ai',
        });
      }
      toast.success(`${selectedTask.label}の結果を取り込みました`);
      return;
    }

    const parsed = extractJson(answer);
    const outputText = parsed?.text || parsed?.revised_text || parsed?.ruby_text || answer.trim();

    onVersionChange?.({
      currentVersion: 'ai',
      originalText: sharedText,
      aiText: outputText,
      manualText: '',
      onVersionChange,
    });
    setResult({ text: outputText });
    toast.success(`${selectedTask.label}の本文を出力候補にしました`);
  };

  return (
    <div className="rounded-xl p-4 space-y-4" style={CARD_STYLE}>
      <div className="flex items-center gap-2">
        <Bot className="w-4 h-4 text-neon-cyan" />
        <h3 className="font-bold text-sm text-neon-cyan neon-cyan-glow">ChatGPT / Gemini / Claude 連携</h3>
      </div>

      <details className="rounded-lg border border-neon-cyan/25 bg-secondary/30">
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-neon-cyan flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5" />AI設定（APIキー・モデル）
        </summary>
        <div className="px-3 pb-3 space-y-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            APIキーはこのブラウザ内にだけ保存されます。公開サイトでキーを直接使うと閲覧者に見えるため、API直結は次の段階でバックエンド経由にするのが安全です。今はプロンプトコピー/貼り戻し方式で確実に使えます。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">既定AI</span>
              <select
                value={settings.defaultProvider}
                onChange={event => updateSetting('defaultProvider', event.target.value)}
                className="w-full h-9 rounded-md bg-secondary border border-border px-2 text-xs text-foreground focus:outline-none focus:border-neon-cyan"
              >
                {PROVIDERS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">OpenAI / ChatGPT APIキー</span>
              <input
                type="password"
                value={settings.openaiApiKey}
                onChange={event => updateSetting('openaiApiKey', event.target.value)}
                placeholder="sk-..."
                className="w-full h-9 rounded-md bg-secondary border border-border px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-cyan"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">OpenAIモデル</span>
              <input
                value={settings.openaiModel}
                onChange={event => updateSetting('openaiModel', event.target.value)}
                className="w-full h-9 rounded-md bg-secondary border border-border px-2 text-xs text-foreground focus:outline-none focus:border-neon-cyan"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Gemini APIキー</span>
              <input
                type="password"
                value={settings.geminiApiKey}
                onChange={event => updateSetting('geminiApiKey', event.target.value)}
                placeholder="AIza..."
                className="w-full h-9 rounded-md bg-secondary border border-border px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-cyan"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Geminiモデル</span>
              <input
                value={settings.geminiModel}
                onChange={event => updateSetting('geminiModel', event.target.value)}
                className="w-full h-9 rounded-md bg-secondary border border-border px-2 text-xs text-foreground focus:outline-none focus:border-neon-cyan"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Claude APIキー</span>
              <input
                type="password"
                value={settings.claudeApiKey}
                onChange={event => updateSetting('claudeApiKey', event.target.value)}
                placeholder="sk-ant-..."
                className="w-full h-9 rounded-md bg-secondary border border-border px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-cyan"
              />
            </label>

            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Claudeモデル</span>
              <input
                value={settings.claudeModel}
                onChange={event => updateSetting('claudeModel', event.target.value)}
                className="w-full h-9 rounded-md bg-secondary border border-border px-2 text-xs text-foreground focus:outline-none focus:border-neon-cyan"
              />
            </label>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={saveSettings} className="h-8 text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30">
              <Save className="w-3.5 h-3.5 mr-1.5" />設定を保存
            </Button>
            <Button onClick={clearSettings} variant="ghost" className="h-8 text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10 border border-destructive/20">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />設定をクリア
            </Button>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-1 md:grid-cols-[160px_180px_1fr] gap-3">
        <label className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">AI</span>
          <select
            value={provider}
            onChange={event => setProvider(event.target.value)}
            className="w-full h-9 rounded-md bg-secondary border border-border px-2 text-xs text-foreground focus:outline-none focus:border-neon-cyan"
          >
            {PROVIDERS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">作業</span>
          <select
            value={task}
            onChange={event => { setTask(event.target.value); setAnswer(''); setResult(null); }}
            className="w-full h-9 rounded-md bg-secondary border border-border px-2 text-xs text-foreground focus:outline-none focus:border-neon-cyan"
          >
            {TASKS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>

        <div className="flex items-end gap-2 flex-wrap">
          <Button onClick={copyPrompt} disabled={!canUse} className="h-9 text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 disabled:opacity-40">
            <Copy className="w-3.5 h-3.5 mr-1.5" />プロンプトをコピー
          </Button>
          <a
            href={selectedProvider.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neon-pink/35 bg-neon-pink/10 px-3 text-xs font-bold text-neon-pink hover:bg-neon-pink/20"
          >
            <ExternalLink className="w-3.5 h-3.5" />{selectedProvider.label}を開く
          </a>
        </div>
      </div>

      {!canUse && (
        <p className="text-xs text-neon-amber">原稿を50文字以上入力すると、外部AI用プロンプトを作成できます。</p>
      )}

      <details className="rounded-lg border border-border bg-secondary/40">
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-muted-foreground">生成されるプロンプトを確認</summary>
        <textarea
          readOnly
          value={prompt}
          className="w-full min-h-[220px] resize-y rounded-b-lg bg-black/30 p-3 text-xs leading-relaxed text-foreground focus:outline-none"
        />
      </details>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileInput className="w-3.5 h-3.5 text-neon-pink" />
          <p className="text-xs font-bold text-neon-pink">AIの回答を貼り戻す</p>
        </div>
        <textarea
          value={answer}
          onChange={event => setAnswer(event.target.value)}
          placeholder={task === 'format' || task === 'genre' ? 'AIが返したJSONを貼り付けてください' : 'AIが返した本文を貼り付けてください'}
          className="w-full min-h-[120px] resize-y rounded-lg px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-pink"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a4a' }}
        />
        <Button onClick={applyAnswer} disabled={!answer.trim()} className="h-9 text-xs bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30 disabled:opacity-40">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />回答を取り込む
        </Button>
      </div>

      {result && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.25)' }}>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-neon-cyan" />
            <p className="text-xs font-bold text-neon-cyan">取り込み済み</p>
          </div>
          {task === 'format' && (
            <p className="text-xs text-foreground">推奨: <strong>{result.recommendation}</strong> / {result.reason}</p>
          )}
          {task === 'genre' && (
            <div className="text-xs text-foreground space-y-1">
              <p><strong>{result.genre_label}</strong></p>
              <p className="text-muted-foreground">{result.diagnosis}</p>
              {result.kdp_categories?.map((category, index) => <p key={category}>{index + 1}. {category}</p>)}
            </div>
          )}
          {(task === 'ruby' || task === 'readability') && (
            <p className="text-xs text-muted-foreground">この本文は「出力」ステップのAI修正版として使えます。</p>
          )}
        </div>
      )}
    </div>
  );
}
