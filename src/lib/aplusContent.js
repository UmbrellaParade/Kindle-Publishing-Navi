export const APLUS_CONTENT_VERSION = 1;
export const APLUS_MODULE_TYPE = 'standard-multiple-image-a';
export const APLUS_IMAGES_PER_MODULE = 4;
export const APLUS_MAX_MODULES = 5;

export const APLUS_FIELD_LIMITS = Object.freeze({
  contentName: 100,
  altText: 100,
  headline: 160,
  body: 1000,
  caption: 200,
});

export const APLUS_IMAGE_SPEC = Object.freeze({
  minWidth: 300,
  minHeight: 300,
  maxBytes: 2 * 1024 * 1024,
  acceptedTypes: Object.freeze(['image/jpeg', 'image/png', 'image/bmp']),
});

export const APLUS_STATUS_OPTIONS = Object.freeze([
  { value: 'draft', label: '下書き' },
  { value: 'ready', label: 'KDP入力準備完了' },
  { value: 'submitted', label: '審査中' },
  { value: 'needs_revision', label: '要修正' },
  { value: 'published', label: '公開済み' },
]);

export const APLUS_CHECKLIST_ITEMS = Object.freeze([
  { key: 'rights_confirmed', label: '画像と文章の利用権を確認した' },
  { key: 'rgb_confirmed', label: '画像がRGBカラーモード・300PPI推奨で書き出されている' },
  { key: 'no_prohibited_claims', label: '価格・割引・レビュー・外部リンクなどの禁止表現がない' },
  { key: 'alt_reviewed', label: 'すべての画像の代替テキストを読み直した' },
  { key: 'desktop_previewed', label: 'KDPのデスクトッププレビューを確認した' },
  { key: 'mobile_previewed', label: 'KDPのモバイルプレビューを確認した' },
  { key: 'asin_applied', label: '対象ASINを適用した' },
]);

const STATUS_VALUES = new Set(APLUS_STATUS_OPTIONS.map(option => option.value));
const LOCAL_IMAGE_PREFIX = 'local-image:';

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value) {
  return value === true;
}

function parseKdpMeta(raw, { strict = false } = {}) {
  if (!raw) return { meta: {}, error: null };
  try {
    const meta = JSON.parse(raw);
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      throw new Error('KDPメタデータがオブジェクトではありません');
    }
    return { meta, error: null };
  } catch (error) {
    const normalized = new Error(`保存済みのKDPデータを読み込めません（${error?.message || 'JSON形式エラー'}）`);
    if (strict) throw normalized;
    return { meta: {}, error: normalized };
  }
}

function getSavedAplusShapeError(meta) {
  if (!Object.prototype.hasOwnProperty.call(meta, 'aplus')) return null;
  if (!meta.aplus || typeof meta.aplus !== 'object' || Array.isArray(meta.aplus)) {
    return new Error('保存済みのA+データ形式に対応していません');
  }
  if (meta.aplus.version != null && meta.aplus.version !== APLUS_CONTENT_VERSION) {
    return new Error(`A+データのバージョン${meta.aplus.version}には未対応です`);
  }
  return null;
}

export function createEmptyAplusImage(slot = 0, overrides = {}) {
  return {
    id: asString(overrides.id) || createId(`aplus_image_${slot + 1}`),
    image_url: asString(overrides.image_url),
    file_name: asString(overrides.file_name),
    file_size: Number.isFinite(overrides.file_size) ? overrides.file_size : 0,
    width: Number.isFinite(overrides.width) ? overrides.width : 0,
    height: Number.isFinite(overrides.height) ? overrides.height : 0,
    alt_text: asString(overrides.alt_text).slice(0, APLUS_FIELD_LIMITS.altText),
    headline: asString(overrides.headline).slice(0, APLUS_FIELD_LIMITS.headline),
    body: asString(overrides.body).slice(0, APLUS_FIELD_LIMITS.body),
    caption: asString(overrides.caption).slice(0, APLUS_FIELD_LIMITS.caption),
  };
}

export function createAplusModule(overrides = {}) {
  const sourceImages = Array.isArray(overrides.images) ? overrides.images : [];
  const images = Array.from({ length: APLUS_IMAGES_PER_MODULE }, (_, index) => (
    createEmptyAplusImage(index, sourceImages[index])
  ));

  return {
    id: asString(overrides.id) || createId('aplus_module'),
    type: APLUS_MODULE_TYPE,
    images,
  };
}

export function createDefaultAplusContent({ legacyImageUrl = '', projectName = '' } = {}) {
  const firstModule = createAplusModule();
  if (legacyImageUrl) firstModule.images[0].image_url = legacyImageUrl;

  return {
    version: APLUS_CONTENT_VERSION,
    content_name: projectName ? `${projectName} A+コンテンツ`.slice(0, APLUS_FIELD_LIMITS.contentName) : '',
    language: 'ja-JP',
    marketplace: 'Amazon.co.jp',
    asin_text: '',
    status: 'draft',
    submitted_at: '',
    published_at: '',
    notes: '',
    checklist: Object.fromEntries(APLUS_CHECKLIST_ITEMS.map(item => [item.key, false])),
    modules: [firstModule],
  };
}

export function normalizeAplusContent(value, options = {}) {
  const fallback = createDefaultAplusContent(options);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const sourceModules = Array.isArray(value.modules) ? value.modules.slice(0, APLUS_MAX_MODULES) : [];
  const modules = sourceModules.length > 0
    ? sourceModules.map(module => createAplusModule(module))
    : fallback.modules;

  const checklist = Object.fromEntries(
    APLUS_CHECKLIST_ITEMS.map(item => [item.key, asBoolean(value.checklist?.[item.key])]),
  );

  return {
    version: APLUS_CONTENT_VERSION,
    content_name: asString(value.content_name, fallback.content_name).slice(0, APLUS_FIELD_LIMITS.contentName),
    language: asString(value.language, fallback.language) || fallback.language,
    marketplace: fallback.marketplace,
    asin_text: asString(value.asin_text),
    status: STATUS_VALUES.has(value.status) ? value.status : 'draft',
    submitted_at: asString(value.submitted_at),
    published_at: asString(value.published_at),
    notes: asString(value.notes),
    checklist,
    modules,
  };
}

export function readAplusContent(kdpMetaRaw, { legacyImageUrl = '', projectName = '' } = {}) {
  const { meta, error } = parseKdpMeta(kdpMetaRaw);
  const shapeError = error ? null : getSavedAplusShapeError(meta);
  const hasAplusKey = Object.prototype.hasOwnProperty.call(meta, 'aplus');
  const hasSavedAplus = !shapeError && hasAplusKey;
  const content = normalizeAplusContent(meta.aplus, {
    legacyImageUrl: hasSavedAplus ? '' : legacyImageUrl,
    projectName,
  });

  return {
    content,
    error: error || shapeError,
    migratedLegacyImage: !hasAplusKey && Boolean(legacyImageUrl),
  };
}

export function writeAplusContent(kdpMetaRaw, content) {
  const { meta } = parseKdpMeta(kdpMetaRaw, { strict: true });
  const shapeError = getSavedAplusShapeError(meta);
  if (shapeError) throw shapeError;
  const normalized = normalizeAplusContent(content);
  return JSON.stringify({ ...meta, aplus: normalized });
}

export function collectAplusImageReferences(project) {
  const references = [];
  if (typeof project?.aplus_image_url === 'string' && project.aplus_image_url) {
    references.push(project.aplus_image_url);
  }

  const raw = typeof project?.kdp_meta === 'string' ? project.kdp_meta : '';
  for (const match of raw.matchAll(/local-image:[A-Za-z0-9_-]+/g)) {
    references.push(match[0]);
  }

  const { content, error } = readAplusContent(raw, {
    legacyImageUrl: project?.aplus_image_url || '',
    projectName: project?.name || '',
  });
  if (error) {
    return [...new Set(references)];
  }

  for (const module of content.modules) {
    for (const image of module.images) {
      if (image.image_url) references.push(image.image_url);
    }
  }
  return [...new Set(references)];
}

export function collectProjectImageReferences(project) {
  return [...new Set([
    project?.cover_image_url || '',
    ...collectAplusImageReferences(project),
  ].filter(Boolean))];
}

export function parseAplusAsins(value) {
  return asString(value)
    .split(/[\s,、]+/)
    .map(asin => asin.trim().toUpperCase())
    .filter(Boolean);
}

export function validateAplusAsinText(value) {
  const asins = parseAplusAsins(value);
  const duplicates = [...new Set(asins.filter((asin, index) => asins.indexOf(asin) !== index))];
  const invalid = [...new Set(asins.filter(asin => !/^[A-Z0-9]{10}$/.test(asin)))];
  return {
    asins,
    uniqueAsins: [...new Set(asins)],
    duplicates,
    invalid,
    valid: asins.length > 0 && duplicates.length === 0 && invalid.length === 0,
  };
}

export function getAplusReadiness(content) {
  const normalized = normalizeAplusContent(content);
  const asinValidation = validateAplusAsinText(normalized.asin_text);
  const checks = [
    { key: 'content_name', label: 'コンテンツ名', done: Boolean(normalized.content_name.trim()) },
    { key: 'asin', label: '有効な対象ASIN', done: asinValidation.valid },
  ];

  normalized.modules.forEach((module, moduleIndex) => {
    module.images.forEach((image, imageIndex) => {
      const prefix = `モジュール${moduleIndex + 1}・画像${imageIndex + 1}`;
      checks.push(
        { key: `${module.id}:${image.id}:image`, label: `${prefix}の画像`, done: Boolean(image.image_url) },
        { key: `${module.id}:${image.id}:alt`, label: `${prefix}の代替テキスト`, done: Boolean(image.alt_text.trim()) },
      );
    });
  });

  APLUS_CHECKLIST_ITEMS.forEach(item => {
    checks.push({ key: `checklist:${item.key}`, label: item.label, done: normalized.checklist[item.key] === true });
  });

  const done = checks.filter(check => check.done).length;
  return {
    done,
    total: checks.length,
    percentage: checks.length ? Math.round((done / checks.length) * 100) : 0,
    missing: checks.filter(check => !check.done),
  };
}

const POLICY_RULES = [
  {
    id: 'promotion',
    label: '価格・割引・無料・ボーナス・購入を促す表現',
    pattern: /(価格|値引|割引|セール|お買い得|無料|ボーナス|今すぐ購入|カートに追加|購入してください)/gi,
  },
  {
    id: 'time-sensitive',
    label: '最新・期間限定・Kindle Unlimitedなど時間に左右される表現',
    pattern: /(最新|新発売|期間限定|発売中|販売中|Kindle\s*Unlimited|読み放題|今だけ)/gi,
  },
  {
    id: 'reviews',
    label: 'カスタマーレビュー・口コミ・個人の推薦',
    pattern: /(カスタマーレビュー|お客様の声|読者レビュー|口コミ|星[1-5]|★)/gi,
  },
  {
    id: 'external',
    label: 'URL・QRコード・メール・電話番号など外部誘導',
    pattern: /(https?:\/\/|www\.|QR\s*コード|メールアドレス|お問い合わせ|電話番号|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/gi,
  },
  {
    id: 'claims',
    label: 'No.1・満足保証など使用できない誇大表現',
    pattern: /(No\.?\s*1|ナンバー\s*ワン|トップ評価|満足保証|100%\s*満足|絶対に)/gi,
  },
  {
    id: 'health',
    label: '病気の治療・予防など使用できない健康効果表現',
    pattern: /(病気.{0,8}(治療|予防|治す|治る|完治)|治療効果|予防効果|健康効果を保証)/gi,
  },
];

export function getAplusPolicyWarnings(content) {
  const normalized = normalizeAplusContent(content);
  const text = normalized.modules.flatMap(module => module.images.flatMap(image => [
    image.alt_text,
    image.headline,
    image.body,
    image.caption,
  ])).join('\n');

  return POLICY_RULES.flatMap(rule => {
    const matches = [...text.matchAll(rule.pattern)].map(match => match[0]);
    if (matches.length === 0) return [];
    return [{ id: rule.id, label: rule.label, matches: [...new Set(matches)].slice(0, 5) }];
  });
}

export function validateAplusImageMetadata({ type = '', size = 0, width = 0, height = 0 } = {}) {
  const errors = [];
  const warnings = [];

  if (!APLUS_IMAGE_SPEC.acceptedTypes.includes(type)) {
    errors.push('JPG・PNG・BMPのいずれかを選んでください');
  }
  if (size >= APLUS_IMAGE_SPEC.maxBytes) {
    errors.push('画像は2MB未満にしてください');
  }
  if (width < APLUS_IMAGE_SPEC.minWidth || height < APLUS_IMAGE_SPEC.minHeight) {
    errors.push(`画像は${APLUS_IMAGE_SPEC.minWidth}×${APLUS_IMAGE_SPEC.minHeight}px以上にしてください`);
  }

  return { errors, warnings, valid: errors.length === 0 };
}

export function isLocalAplusImageReference(value) {
  return typeof value === 'string' && value.startsWith(LOCAL_IMAGE_PREFIX);
}
