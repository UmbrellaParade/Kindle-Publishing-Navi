import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPromotionDocumentSettings,
  mergePromotionDocumentUpdate,
  parsePromotionDocumentSettings,
  selectPromotionDocumentHydration,
  serializePromotionDocumentSettings,
  updatePromotionDocumentSettings,
  validatePromotionDocumentUrl,
} from './promotionDocuments.js';

test('document URL validation accepts only explicit http and https links', () => {
  assert.equal(
    validatePromotionDocumentUrl(' https://docs.google.com/document/d/abc ').href,
    'https://docs.google.com/document/d/abc',
  );
  assert.equal(validatePromotionDocumentUrl('http://example.com/memo').error, '');
  assert.match(validatePromotionDocumentUrl('docs.google.com/document/d/abc').error, /https:\/\//);
  assert.match(validatePromotionDocumentUrl('javascript:alert(1)').error, /だけ利用できます/);
  assert.match(validatePromotionDocumentUrl('data:text/html,hello').error, /だけ利用できます/);
});

test('blank URL is valid as an empty optional field', () => {
  assert.deepEqual(validatePromotionDocumentUrl(''), { input: '', href: '', error: '' });
});

test('document settings round-trip URLs and collapsed preferences', () => {
  let settings = createPromotionDocumentSettings();
  settings = updatePromotionDocumentSettings(settings, 'sns1', {
    url: 'https://docs.google.com/document/d/sns-one',
  });
  settings = updatePromotionDocumentSettings(settings, 'sns1', { collapsed: true });

  const parsed = parsePromotionDocumentSettings(serializePromotionDocumentSettings(settings));
  assert.deepEqual(parsed.documents.sns1, {
    url: 'https://docs.google.com/document/d/sns-one',
    collapsed: true,
  });
  assert.deepEqual(parsed.documents.strategy, { url: '', collapsed: false });
});

test('a collapsed section reopens when its URL becomes invalid or is removed', () => {
  let settings = createPromotionDocumentSettings();
  settings = updatePromotionDocumentSettings(settings, 'strategy', {
    url: 'https://example.com/strategy',
    collapsed: true,
  });
  assert.equal(settings.documents.strategy.collapsed, true);

  settings = updatePromotionDocumentSettings(settings, 'strategy', { url: 'javascript:alert(1)' });
  assert.equal(settings.documents.strategy.collapsed, false);

  settings = updatePromotionDocumentSettings(settings, 'strategy', { url: '' });
  assert.equal(settings.documents.strategy.collapsed, false);
});

test('older promotion_notes content is preserved when document links are saved', () => {
  const legacyText = '以前のプロモーション補足メモ';
  let settings = parsePromotionDocumentSettings(legacyText);
  settings = updatePromotionDocumentSettings(settings, 'sns2', {
    url: 'https://example.com/sns-plan',
  });

  const reparsed = parsePromotionDocumentSettings(serializePromotionDocumentSettings(settings));
  assert.equal(reparsed.legacyNotes, legacyText);
  assert.equal(reparsed.documents.sns2.url, 'https://example.com/sns-plan');
});

test('unknown JSON previously stored in promotion_notes is also preserved verbatim', () => {
  const unknownJson = JSON.stringify({ future: true, note: 'keep me' });
  const parsed = parsePromotionDocumentSettings(unknownJson);
  assert.equal(parsed.legacyNotes, unknownJson);
});

test('section updates merge into the latest saved settings instead of erasing another tab', () => {
  let latest = createPromotionDocumentSettings();
  latest = updatePromotionDocumentSettings(latest, 'sns1', {
    url: 'https://docs.google.com/document/d/latest-sns',
  });

  const mergedRaw = mergePromotionDocumentUpdate(
    serializePromotionDocumentSettings(latest),
    'strategy',
    { url: 'https://docs.google.com/document/d/new-strategy' },
  );
  const collapsedRaw = mergePromotionDocumentUpdate(
    mergedRaw,
    'strategy',
    { collapsed: true },
  );
  const merged = parsePromotionDocumentSettings(collapsedRaw);

  assert.equal(merged.documents.strategy.url, 'https://docs.google.com/document/d/new-strategy');
  assert.equal(merged.documents.strategy.collapsed, true);
  assert.equal(merged.documents.sns1.url, 'https://docs.google.com/document/d/latest-sns');
});

test('an older save response cannot rehydrate over a newer local document edit', () => {
  const savedSettings = createPromotionDocumentSettings();
  const pendingSettings = updatePromotionDocumentSettings(savedSettings, 'strategy', {
    url: 'https://docs.google.com/document/d/newer-local-edit',
  });

  assert.equal(selectPromotionDocumentHydration({
    savedSettings,
    pendingSettings,
    projectChanged: false,
    hasPendingChanges: true,
  }), null);

  assert.equal(selectPromotionDocumentHydration({
    savedSettings,
    pendingSettings,
    projectChanged: true,
    hasPendingChanges: true,
  }).documents.strategy.url, 'https://docs.google.com/document/d/newer-local-edit');

  assert.deepEqual(selectPromotionDocumentHydration({
    savedSettings,
    projectChanged: false,
    hasPendingChanges: false,
  }), savedSettings);
});
