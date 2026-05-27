export const AI_SETTINGS_KEY = 'kindle_navi_ai_settings';

const DEFAULTS = {
  openaiApiKey: '', openaiModel: 'gpt-5.5',
  geminiApiKey: '', geminiModel: 'gemini-3.5-flash',
  claudeApiKey: '', claudeModel: 'claude-sonnet-4-6',
};

export function loadExternalAiSettings() {
  try {
    const saved = localStorage.getItem(AI_SETTINGS_KEY);
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

export async function invokeOpenAI(apiKey, model, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 16000 }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `OpenAI APIエラー (${res.status})`); }
  return (await res.json()).choices?.[0]?.message?.content || '';
}

export async function invokeGemini(apiKey, model, prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 16000 } }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `Gemini APIエラー (${res.status})`); }
  return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function invokeClaude(apiKey, model, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true', 'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `Claude APIエラー (${res.status})`); }
  return (await res.json()).content?.[0]?.text || '';
}

export async function callExternalAi(provider, settings, prompt) {
  if (provider === 'chatgpt') return invokeOpenAI(settings.openaiApiKey, settings.openaiModel, prompt);
  if (provider === 'gemini') return invokeGemini(settings.geminiApiKey, settings.geminiModel, prompt);
  if (provider === 'claude') return invokeClaude(settings.claudeApiKey, settings.claudeModel, prompt);
  throw new Error('未知のAIプロバイダーです');
}

export const PROVIDER_LABELS = { chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude' };

export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try { return JSON.parse(candidate); } catch {
    const start = candidate.indexOf('{'), end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) { try { return JSON.parse(candidate.slice(start, end + 1)); } catch {} }
    return null;
  }
}
