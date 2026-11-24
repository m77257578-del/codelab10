import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  TRANSLATIONS,
  createTranslator,
  getLocaleDirection,
  getToggleLocale,
  normalizeLocale,
} from './i18n';
import { diagnose, explainRuntimeError } from './diagnostics';
import { WORKSPACE_TEMPLATES } from './workspaces';

test('locale helpers normalize and resolve direction properly', () => {
  assert.deepEqual(SUPPORTED_LOCALES, ['ar', 'en']);
  assert.equal(DEFAULT_LOCALE, 'ar');
  assert.equal(normalizeLocale('en'), 'en');
  assert.equal(normalizeLocale('ar'), 'ar');
  assert.equal(normalizeLocale('fr'), 'ar');
  assert.equal(getLocaleDirection('ar'), 'rtl');
  assert.equal(getLocaleDirection('en'), 'ltr');
  assert.equal(getToggleLocale('ar'), 'en');
  assert.equal(getToggleLocale('en'), 'ar');
});

test('TRANSLATIONS.ar and TRANSLATIONS.en have complete key parity', () => {
  const arKeys = Object.keys(TRANSLATIONS.ar).sort();
  const enKeys = Object.keys(TRANSLATIONS.en).sort();
  assert.deepEqual(arKeys, enKeys);

  for (const key of arKeys) {
    const arVal = TRANSLATIONS.ar[key];
    const enVal = TRANSLATIONS.en[key];
    assert.equal(typeof arVal, typeof enVal, `Type mismatch for key "${key}"`);
    if (typeof arVal === 'string') {
      assert.ok(arVal.trim().length > 0, `Empty Arabic string for "${key}"`);
      assert.ok(enVal.trim().length > 0, `Empty English string for "${key}"`);
    }
  }
});

test('workspace templates and dynamic translators render valid strings in both locales', () => {
  const ar = createTranslator('ar');
  const en = createTranslator('en');

  for (const tpl of WORKSPACE_TEMPLATES) {
    assert.ok(ar.dict.templates[tpl.id]?.name, `Missing Arabic template name for ${tpl.id}`);
    assert.ok(en.dict.templates[tpl.id]?.name, `Missing English template name for ${tpl.id}`);
    assert.ok(ar.dict.templates[tpl.id]?.description, `Missing Arabic template description for ${tpl.id}`);
    assert.ok(en.dict.templates[tpl.id]?.description, `Missing English template description for ${tpl.id}`);
  }

  assert.match(en.t('confirmDeleteAll', 4), /4/);
  assert.match(ar.t('confirmDeleteAll', 4), /4/);
  assert.equal(en.t('problemsCount', 1), '⚠ 1 Problem');
  assert.equal(en.t('problemsCount', 3), '⚠ 3 Problems');
  assert.match(ar.t('problemsCount', 3), /3/);
});

test('diagnose and explainRuntimeError localize messages for ar and en', () => {
  const arIssues = diagnose('{ bad json', 'json', 'ar');
  const enIssues = diagnose('{ bad json', 'json', 'en');
  assert.equal(arIssues.length, 1);
  assert.equal(enIssues.length, 1);
  assert.match(arIssues[0].why, /JSON/);
  assert.match(enIssues[0].why, /Invalid JSON syntax/);

  const arHtml = diagnose('<div><span>hi</div>', 'html', 'ar');
  const enHtml = diagnose('<div><span>hi</div>', 'html', 'en');
  assert.ok(arHtml.length > 0);
  assert.ok(enHtml.length > 0);
  assert.match(enHtml[0].why, /Closing tag/);

  assert.match(explainRuntimeError('ZeroDivisionError', 'ar'), /صفر/);
  assert.equal(explainRuntimeError('ZeroDivisionError', 'en'), 'Division by zero error');
});
