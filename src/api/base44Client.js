import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { saveImageFile } from '@/lib/localImageStore';
import { withProjectWriteLock } from '@/lib/projectWriteLock';

const { appId, token, functionsVersion, appBaseUrl } = appParams;
const useRemoteClient = import.meta.env.VITE_STORAGE_MODE !== 'local' && appId && appBaseUrl;

// GitHub Pages の配布版では SDK を初期化しない。createClient は内部で
// 通信や監視を開始するため、選択後に破棄する形では完全ローカルにならない。
const remoteClient = useRemoteClient
  ? createClient({
    appId,
    token,
    functionsVersion,
    serverUrl: '',
    requiresAuth: false,
    appBaseUrl,
  })
  : null;

export const LOCAL_PROJECTS_KEY = 'kindle_publishing_navi_local_projects';
const CORRUPT_PROJECTS_KEY = 'kindle_publishing_navi_corrupt_projects_backup';
const memoryStorage = new Map();

const getStorage = () => {
  if (typeof window === 'undefined') {
    return {
      getItem: (key) => memoryStorage.get(key) || null,
      setItem: (key, value) => memoryStorage.set(key, value),
      removeItem: (key) => memoryStorage.delete(key),
    };
  }

  try {
    const storage = window.localStorage;
    const testKey = '__kindle_navi_storage_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return storage;
  } catch {
    throw new Error('このブラウザではデータを永続保存できません。通常モードで開き、サイトデータの保存を許可してください。');
  }
};

const readProjects = () => {
  const storage = getStorage();
  const raw = storage.getItem(LOCAL_PROJECTS_KEY);
  if (!raw) return [];

  try {
    const projects = JSON.parse(raw);
    if (!Array.isArray(projects) || projects.some(project => !project || typeof project !== 'object' || Array.isArray(project))) {
      throw new Error('プロジェクトデータの形式が正しくありません');
    }
    return projects;
  } catch (error) {
    try {
      if (!storage.getItem(CORRUPT_PROJECTS_KEY)) storage.setItem(CORRUPT_PROJECTS_KEY, raw);
    } catch {
      // 壊れた原文を退避できない場合も、空配列として上書きはしない。
    }
    throw new Error(`保存データを読み込めません。データ管理から復元してください（${error?.message || 'JSON破損'}）`);
  }
};

const writeProjects = (projects) => {
  if (!Array.isArray(projects)) throw new Error('保存するプロジェクトデータの形式が正しくありません');
  try {
    getStorage().setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
  } catch (error) {
    throw new Error(`プロジェクトを保存できません。ブラウザの空き容量を確認し、バックアップを作成してください（${error?.message || '保存失敗'}）`);
  }
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
      '実用・ビジネス（参考候補）',
      'エッセイ・自分史（参考候補）',
      '小説・ラノベ（参考候補）',
    ];

    return {
      genre_key: 'not_connected',
      genre_label: 'AI未接続（ジャンル未判定）',
      diagnosis: 'AI機能は接続されていません。カテゴリーはKDP公式画面で確認してください。',
      kdp_categories: categories,
      category_strategy: '入力内容に最も関連する候補を選び、KDP公式画面で最終確認してください。',
      readability_tips: ['対象読者を明確にする', '一文を読みやすい長さにする', '見出しと段落を整理する'],
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
      novel_categories: ['本の内容に合うカテゴリーをKDPで確認'],
      recommended_categories: [
        {
          title: 'AI未接続（候補なし）',
          reason: 'この公開版ではAI診断を行っていません。',
        },
      ],
      notes: 'KDPのカテゴリーは変更されるため、公式画面で最新候補を確認してください。',
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
      get: async (id) => readProjects().find(project => project.id === id) || null,
      create: async (data) => withProjectWriteLock(async () => {
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
      }),
      update: async (id, updates) => withProjectWriteLock(async () => {
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
      }),
      mutate: async (id, buildUpdates) => withProjectWriteLock(async () => {
        if (typeof buildUpdates !== 'function') throw new TypeError('更新関数が必要です');
        const projects = readProjects();
        const index = projects.findIndex(project => project.id === id);
        if (index < 0) throw new Error('プロジェクトが見つかりません');
        const updates = await buildUpdates({ ...projects[index] });
        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
          throw new TypeError('更新内容の形式が正しくありません');
        }
        const updated = {
          ...projects[index],
          ...updates,
          updated_date: new Date().toISOString(),
        };
        projects[index] = updated;
        writeProjects(projects);
        return updated;
      }),
      delete: async (id) => withProjectWriteLock(async () => {
        writeProjects(readProjects().filter((project) => project.id !== id));
        return true;
      }),
    },
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => ({
        file_url: file?.type?.startsWith('image/') ? await saveImageFile(file) : await fileToDataUrl(file),
      }),
      InvokeLLM: mockInvokeLLM,
    },
  },
});

export const base44 = remoteClient || createLocalClient();
