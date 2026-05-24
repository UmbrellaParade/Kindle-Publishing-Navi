import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const remoteClient = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

const PROJECTS_KEY = 'kindle_publishing_navi_local_projects';
const memoryStorage = new Map();

const getStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Fall back to memory storage below.
  }

  return {
    getItem: (key) => memoryStorage.get(key) || null,
    setItem: (key, value) => memoryStorage.set(key, value),
    removeItem: (key) => memoryStorage.delete(key),
  };
};

const readProjects = () => {
  try {
    const raw = getStorage().getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeProjects = (projects) => {
  getStorage().setItem(PROJECTS_KEY, JSON.stringify(projects));
};

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const sortProjects = (projects, sortBy = '-created_date') => {
  const descending = sortBy.startsWith('-');
  const field = descending ? sortBy.slice(1) : sortBy;

  return [...projects].sort((a, b) => {
    const left = a[field] || '';
    const right = b[field] || '';
    return descending ? String(right).localeCompare(String(left)) : String(left).localeCompare(String(right));
  });
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) {
    resolve('');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('File read failed'));
  reader.readAsDataURL(file);
});

const extractPromptText = (prompt = '') => {
  const markers = ['【対象テキスト】', '【分析するテキスト】', '【入力文】', '【テキスト】', 'テキスト：', 'テキスト:'];
  for (const marker of markers) {
    const index = prompt.indexOf(marker);
    if (index >= 0) {
      return prompt.slice(index + marker.length).trim().slice(0, 1200);
    }
  }

  return prompt.slice(-1200).trim();
};

const mockInvokeLLM = async ({ prompt = '', response_json_schema: schema } = {}) => {
  const properties = schema?.properties || {};
  const text = extractPromptText(prompt);

  if (properties.recommendation) {
    return {
      recommendation: /https?:\/\//.test(text) ? 'docx' : 'epub',
      reason: 'ローカルプレビュー用の仮判定です。Base44接続後はAI判定に置き換わります。',
      has_special_layout: false,
    };
  }

  if (properties.format_recommendation || properties.recommended_format) {
    return {
      format_recommendation: /https?:\/\//.test(text) ? 'docx' : 'epub',
      recommended_format: /https?:\/\//.test(text) ? 'docx' : 'epub',
      reason: 'ローカルプレビュー用の仮判定です。URLがある場合はdocx寄りで確認してください。',
      reasons: ['ローカルプレビューではAI接続なしで簡易判定しています。'],
      warnings: [],
      url_check: /https?:\/\//.test(text) ? 'URLリンクを検出しました。' : 'URLリンクは検出していません。',
      layout_check: '特殊レイアウトは未検出です。',
      ruby_check: 'ルビは手動確認してください。',
    };
  }

  if (properties.genre_label || properties.genre_key) {
    const categories = [
      'フィクション > ファンタジー > ダークファンタジー',
      'フィクション > ファンタジー > 一般',
      'ライトノベル > 一般',
    ];

    return {
      genre_key: 'dark_fantasy',
      genre_label: 'ダークファンタジー / 音楽ファンタジー',
      diagnosis: 'ローカルプレビュー用の仮診断です。作品の雰囲気を確認するためのダミー結果です。',
      kdp_categories: categories,
      category_strategy: '本番ではBase44のAI診断結果を使ってカテゴリー候補を調整してください。',
      readability_tips: ['一文を短めにする', '会話の前後に余白を置く', '章末に余韻を残す'],
      has_music_or_url: /https?:\/\//.test(text),
    };
  }

  if (properties.segments) {
    return {
      segments: [
        {
          plain: text || 'ローカルプレビューではAIルビ解析は未接続です。本文を入力して確認してください。',
        },
      ],
    };
  }

  if (properties.checks) {
    return {
      checks: [
        { item: '文字量', severity: 'ok', comment: 'ローカルプレビュー用の簡易チェックです。', suggestion: '本番AI接続後に再チェックしてください。' },
      ],
      revised_text: text,
      summary: 'ローカルプレビュー用の仮結果です。',
    };
  }

  if (properties.revised_text) {
    return {
      revised_text: text,
      points: ['ローカルプレビュー用の仮修正です。'],
      notes: 'Base44接続後はAIによる修正結果に置き換わります。',
    };
  }

  if (properties.novel_categories) {
    return {
      novel_categories: ['フィクション', 'ファンタジー', 'ライトノベル'],
      recommended_categories: [
        {
          title: 'フィクション > ファンタジー',
          reason: 'ローカルプレビュー用の仮カテゴリーです。',
        },
      ],
      notes: 'Base44接続後に最新情報で再取得してください。',
    };
  }

  return text || 'ローカルプレビュー用の仮レスポンスです。Base44接続後はAI結果に置き換わります。';
};

const createLocalClient = () => ({
  __isLocalFallback: true,
  auth: {
    me: async () => ({
      id: 'local-user',
      email: 'local@example.com',
      full_name: 'Local Preview',
    }),
    logout: () => {},
    redirectToLogin: () => {},
  },
  entities: {
    PublishingProject: {
      list: async (sortBy = '-created_date', limit = 50) => sortProjects(readProjects(), sortBy).slice(0, limit),
      create: async (data) => {
        const now = new Date().toISOString();
        const project = {
          ...data,
          id: createId(),
          created_date: now,
          updated_date: now,
        };
        const projects = [project, ...readProjects()];
        writeProjects(projects);
        return project;
      },
      update: async (id, updates) => {
        const projects = readProjects();
        const index = projects.findIndex((project) => project.id === id);
        if (index < 0) {
          throw new Error('プロジェクトが見つかりません');
        }

        const updated = {
          ...projects[index],
          ...updates,
          updated_date: new Date().toISOString(),
        };
        projects[index] = updated;
        writeProjects(projects);
        return updated;
      },
      delete: async (id) => {
        writeProjects(readProjects().filter((project) => project.id !== id));
        return true;
      },
    },
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => ({
        file_url: await fileToDataUrl(file),
      }),
      InvokeLLM: mockInvokeLLM,
    },
  },
});

export const base44 = appId && appBaseUrl ? remoteClient : createLocalClient();
