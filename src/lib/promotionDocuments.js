export const PROMOTION_DOCUMENT_SECTION_IDS = Object.freeze([
  'strategy',
  'sns1',
  'sns2',
]);

const SETTINGS_KIND = 'kindle-navi-promotion-documents';
const SETTINGS_VERSION = 1;

function createDocumentEntry() {
  return { url: '', collapsed: false };
}

export function createPromotionDocumentSettings({ legacyNotes = '' } = {}) {
  return {
    documents: {
      strategy: createDocumentEntry(),
      sns1: createDocumentEntry(),
      sns2: createDocumentEntry(),
    },
    legacyNotes: typeof legacyNotes === 'string' ? legacyNotes : '',
  };
}

/**
 * Returns a URL that is safe to place in href, or a Japanese validation error.
 * Only explicit http/https URLs are accepted so stored text can never become a
 * javascript:, data:, or other executable link.
 */
export function validatePromotionDocumentUrl(value) {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) return { input: '', href: '', error: '' };

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return {
      input,
      href: '',
      error: 'URLの形式を確認してください（https:// または http:// から入力）',
    };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      input,
      href: '',
      error: 'https:// または http:// から始まるURLだけ利用できます',
    };
  }

  if (!parsed.hostname) {
    return {
      input,
      href: '',
      error: 'URLの形式を確認してください（https:// または http:// から入力）',
    };
  }

  return { input, href: parsed.href, error: '' };
}

function normalizeDocumentEntry(value) {
  const url = typeof value?.url === 'string' ? value.url : '';
  const validation = validatePromotionDocumentUrl(url);
  return {
    url,
    // A section with an empty or invalid URL must remain open and editable.
    collapsed: Boolean(value?.collapsed) && Boolean(validation.href),
  };
}

function normalizeSettings(value, legacyNotes = '') {
  const fallback = createPromotionDocumentSettings({ legacyNotes });
  const documents = value?.documents;
  if (!documents || typeof documents !== 'object' || Array.isArray(documents)) {
    return fallback;
  }

  return {
    documents: Object.fromEntries(PROMOTION_DOCUMENT_SECTION_IDS.map(sectionId => [
      sectionId,
      normalizeDocumentEntry(documents[sectionId]),
    ])),
    legacyNotes: typeof value.legacyNotes === 'string' ? value.legacyNotes : legacyNotes,
  };
}

/**
 * promotion_notes existed before document links were added. Unknown legacy
 * content is retained verbatim and included again when these settings are saved.
 */
export function parsePromotionDocumentSettings(rawValue) {
  if (typeof rawValue !== 'string' || !rawValue) {
    return createPromotionDocumentSettings();
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (
      parsed
      && typeof parsed === 'object'
      && !Array.isArray(parsed)
      && parsed.kind === SETTINGS_KIND
      && parsed.version === SETTINGS_VERSION
    ) {
      return normalizeSettings(parsed);
    }
  } catch {
    // Plain-text promotion_notes from older versions is preserved below.
  }

  return createPromotionDocumentSettings({ legacyNotes: rawValue });
}

export function updatePromotionDocumentSettings(settings, sectionId, updates) {
  if (!PROMOTION_DOCUMENT_SECTION_IDS.includes(sectionId)) return normalizeSettings(settings);

  return normalizeSettings({
    ...settings,
    documents: {
      ...settings?.documents,
      [sectionId]: {
        ...settings?.documents?.[sectionId],
        ...updates,
      },
    },
  });
}

/**
 * Apply one field change to the latest saved document settings. This keeps
 * edits from another browser tab or another document section instead of
 * replacing the whole promotion_notes snapshot with stale UI state.
 */
export function mergePromotionDocumentUpdate(rawValue, sectionId, updates) {
  return serializePromotionDocumentSettings(
    updatePromotionDocumentSettings(
      parsePromotionDocumentSettings(rawValue),
      sectionId,
      updates,
    ),
  );
}

export function selectPromotionDocumentHydration({
  savedSettings,
  pendingSettings = null,
  projectChanged = false,
  hasPendingChanges = false,
}) {
  if (projectChanged && pendingSettings) return normalizeSettings(pendingSettings);
  if (projectChanged || !hasPendingChanges) return normalizeSettings(savedSettings);
  return null;
}

export function serializePromotionDocumentSettings(settings) {
  const normalized = normalizeSettings(settings);
  return JSON.stringify({
    kind: SETTINGS_KIND,
    version: SETTINGS_VERSION,
    documents: normalized.documents,
    ...(normalized.legacyNotes ? { legacyNotes: normalized.legacyNotes } : {}),
  });
}
