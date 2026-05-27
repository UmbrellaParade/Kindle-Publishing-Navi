import React, { useState } from 'react';
import { KeyRound, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CARD_STYLE = { background: '#1a1a2e', border: '1px solid #2a2a4a' };
const AI_SETTINGS_KEY = 'kindle_navi_ai_settings';

const DEFAULT_SETTINGS = {
  defaultProvider: 'chatgpt',
  openaiApiKey: '',
  openaiModel: 'gpt-5.5',
  geminiApiKey: '',
  geminiModel: 'gemini-3.5-flash',
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-4-6',
};

const MODEL_OPTIONS = {
  chatgpt: [
    { value: 'gpt-5.5',          label: 'GPT-5.5（最新・推奨）' },
    { value: 'gpt-5.5-pro',      label: 'GPT-5.5 Pro（最高精度）' },
    { value: 'gpt-5.4-thinking', label: 'GPT-5.4 Thinking（高度な推論）' },
    { value: 'gpt-5.4-mini',     label: 'GPT-5.4 mini（軽量・高速）' },
  ],
  gemini: [
    { value: 'gemini-3.5-flash',      label: 'Gemini 3.5 Flash（最新・推奨）' },
    { value: 'gemini-3.1-pro',        label: 'Gemini 3.1 Pro（推論・コーディング）' },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite（軽量・高速）' },
    { value: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro' },
  ],
  claude: [
    { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6（最新・推奨）' },
    { value: 'claude-opus-4-7',           label: 'Claude Opus 4.7（最高精度）' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5（軽量・高速）' },
  ],
};

const PROVIDERS = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'gemini',  label: 'Gemini' },
  { id: 'claude',  label: 'Claude' },
];

function loadAiSettings() {
  try {
    const saved = localStorage.getItem(AI_SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function ExternalAiWorkspace() {
  const [settings, setSettings] = useState(loadAiSettings);

  const updateSetting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const saveSettings = () => {
    try {
      localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
      toast.success('AI設定をこのブラウザに保存しました');
    } catch {
      toast.error('AI設定を保存できませんでした');
    }
  };

  const clearSettings = () => {
    try {
      localStorage.removeItem(AI_SETTINGS_KEY);
      setSettings(DEFAULT_SETTINGS);
      toast.success('AI設定をクリアしました');
    } catch {
      toast.error('AI設定をクリアできませんでした');
    }
  };

  return (
    <div className="rounded-xl p-4" style={CARD_STYLE}>
      <details className="rounded-lg border border-neon-cyan/25 bg-secondary/30">
        <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-neon-cyan flex items-center gap-2 select-none">
          <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />
          ChatGPT / Gemini / Claude AI設定（APIキー・モデル）
          <span className="ml-auto text-[10px] text-muted-foreground font-normal">クリックで開閉</span>
        </summary>
        <div className="px-3 pb-4 pt-3 space-y-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            APIキーはこのブラウザ内にだけ保存されます。入力後「設定を保存」を押してください。<br />
            APIキーを設定すると、ステップ4の読みやすさ修正でChatGPT / Gemini / Claudeを直接使えます。
          </p>
          <label className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground font-bold whitespace-nowrap">既定AI</span>
            <select
              value={settings.defaultProvider}
              onChange={e => updateSetting('defaultProvider', e.target.value)}
              className="h-8 rounded-md bg-secondary border border-border px-2 text-xs text-foreground focus:outline-none focus:border-neon-cyan"
            >
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg p-3 space-y-2.5" style={{ background: 'rgba(16,163,127,0.06)', border: '1px solid rgba(16,163,127,0.25)' }}>
              <p className="text-xs font-bold text-emerald-400">ChatGPT（OpenAI）</p>
              <label className="block space-y-1">
                <span className="text-[10px] text-muted-foreground">APIキー</span>
                <input type="password" value={settings.openaiApiKey} onChange={e => updateSetting('openaiApiKey', e.target.value)} placeholder="sk-..." className="w-full h-8 rounded-md bg-secondary border border-border px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-400/60" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-muted-foreground">モデル</span>
                <select value={settings.openaiModel} onChange={e => updateSetting('openaiModel', e.target.value)} className="w-full h-8 rounded-md bg-secondary border border-border px-2 text-xs text-foreground focus:outline-none focus:border-emerald-400/60">
                  {MODEL_OPTIONS.chatgpt.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
            <div className="rounded-lg p-3 space-y-2.5" style={{ background: 'rgba(66,133,244,0.06)', border: '1px solid rgba(66,133,244,0.25)' }}>
              <p className="text-xs font-bold text-blue-400">Gemini（Google）</p>
              <label className="block space-y-1">
                <span className="text-[10px] text-muted-foreground">APIキー</span>
                <input type="password" value={settings.geminiApiKey} onChange={e => updateSetting('geminiApiKey', e.target.value)} placeholder="AIza..." className="w-full h-8 rounded-md bg-secondary border border-border px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-400/60" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-muted-foreground">モデル</span>
                <select value={settings.geminiModel} onChange={e => updateSetting('geminiModel', e.target.value)} className="w-full h-8 rounded-md bg-secondary border border-border px-2 text-xs text-foreground focus:outline-none focus:border-blue-400/60">
                  {MODEL_OPTIONS.gemini.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
            <div className="rounded-lg p-3 space-y-2.5" style={{ background: 'rgba(210,140,100,0.06)', border: '1px solid rgba(210,140,100,0.25)' }}>
              <p className="text-xs font-bold text-orange-300">Claude（Anthropic）</p>
              <label className="block space-y-1">
                <span className="text-[10px] text-muted-foreground">APIキー</span>
                <input type="password" value={settings.claudeApiKey} onChange={e => updateSetting('claudeApiKey', e.target.value)} placeholder="sk-ant-..." className="w-full h-8 rounded-md bg-secondary border border-border px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-orange-300/60" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-muted-foreground">モデル</span>
                <select value={settings.claudeModel} onChange={e => updateSetting('claudeModel', e.target.value)} className="w-full h-8 rounded-md bg-secondary border border-border px-2 text-xs text-foreground focus:outline-none focus:border-orange-300/60">
                  {MODEL_OPTIONS.claude.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
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
    </div>
  );
}
