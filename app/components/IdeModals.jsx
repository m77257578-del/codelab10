'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, FolderGit2, Keyboard, MessageCircle, Search, Download, Archive, FileJson, CheckCircle2, AlertTriangle, ShieldCheck, FileText, ArrowRight } from 'lucide-react';
import { ALL_LANGUAGE_OPTIONS, DEV, WORKSPACE_TEMPLATES, detectLang } from '../lib/workspaces';
import { diagnose } from '../lib/diagnostics';
import { sanitizeProjectName } from '../lib/storage';
import LanguageIcon from './LanguageIcon';
import { useI18n } from '../lib/LocaleContext';

function ModalFrame({ title, onClose, maxWidth = 'max-w-xl', children }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65" onClick={onClose}>
      <div
        className={`w-full ${maxWidth} rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeAria')}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 max-h-[75vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export function ExportProjectModal({ open, onClose, projectName, onRenameProject, fileCount, onDownloadZip, onDownloadJson }) {
  const { t } = useI18n();
  const [nameInput, setNameInput] = useState(projectName || 'my-codelab-project');

  useEffect(() => {
    if (open) setNameInput(projectName || 'my-codelab-project');
  }, [open, projectName]);

  if (!open) return null;
  const safe = sanitizeProjectName(nameInput);

  return (
    <ModalFrame title={t('exportModalTitle')} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {t('exportFolderLabel')}
          </label>
          <input
            autoFocus
            dir="ltr"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              onRenameProject?.(e.target.value);
            }}
            placeholder="my-awesome-project"
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{t('includedFilesCount', fileCount)}</span>
            <span className="font-mono" dir="ltr">
              {safe}.zip
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onRenameProject?.(safe);
              onDownloadZip(safe);
              onClose();
            }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Archive className="w-4 h-4 shrink-0" />
              <div className="text-start">
                <div>{t('downloadZipTitle')}</div>
                <div className="text-[11px] font-normal text-sky-100">{t('downloadZipDesc')}</div>
              </div>
            </div>
            <Download className="w-4 h-4 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => {
              onRenameProject?.(safe);
              onDownloadJson(safe);
              onClose();
            }}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-sky-500 text-slate-800 dark:text-slate-200 text-xs font-medium transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FileJson className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{t('downloadJsonLabel')}</span>
            </div>
            <Download className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

const LANG_CATEGORY_IDS = ['all', 'web', 'data', 'systems', 'scripting'];

export function LanguagesModal({ open, onClose, onCreateLanguageFile }) {
  const { t, dict } = useI18n();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_LANGUAGE_OPTIONS.filter((l) => {
      if (category !== 'all' && l.category !== category) return false;
      if (!q) return true;
      return l.label.toLowerCase().includes(q) || l.ext.toLowerCase().includes(q) || l.id.toLowerCase().includes(q);
    });
  }, [search, category]);

  if (!open) return null;

  return (
    <ModalFrame title={t('languagesModalTitle', ALL_LANGUAGE_OPTIONS.length)} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5 pointer-events-none" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchLangPlaceholder')}
            className="w-full ps-9 pe-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {LANG_CATEGORY_IDS.map((catId) => (
            <button
              key={catId}
              type="button"
              onClick={() => setCategory(catId)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                category === catId
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {dict.langCategories[catId]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filtered.map((lang) => (
          <button
            key={lang.id}
            type="button"
            onClick={() => {
              onCreateLanguageFile(lang);
              onClose();
            }}
            className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50 dark:bg-slate-900/60 text-start transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <LanguageIcon lang={lang.id} size={20} />
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" dir="ltr">
                {lang.label}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0" dir="ltr">
              .{lang.ext}
            </span>
          </button>
        ))}
      </div>
    </ModalFrame>
  );
}

export function TemplatesModal({ open, onClose, onLoadTemplate }) {
  const { t, dict } = useI18n();
  if (!open) return null;
  return (
    <ModalFrame title={t('templatesModalTitle')} onClose={onClose}>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        {t('templatesModalDesc')}
      </p>
      <div className="space-y-2.5">
        {WORKSPACE_TEMPLATES.map((tpl) => {
          const localized = dict.templates?.[tpl.id];
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                onLoadTemplate(tpl);
                onClose();
              }}
              className="w-full text-start p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50 dark:bg-slate-900/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FolderGit2 className="w-4 h-4 text-sky-500 shrink-0" />
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {localized?.name || tpl.name}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {t('filesBadgeCount', Object.keys(tpl.files).length)}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                {localized?.description || tpl.description}
              </p>
            </button>
          );
        })}
      </div>
    </ModalFrame>
  );
}

export function ShortcutsModal({ open, onClose }) {
  const { t, dict } = useI18n();
  if (!open) return null;
  return (
    <ModalFrame title={t('shortcutsModalTitle')} onClose={onClose}>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {dict.shortcutsList.map(([keys, desc]) => (
          <div key={keys} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Keyboard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{desc}</span>
            </div>
            <kbd
              dir="ltr"
              className="px-2 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              {keys}
            </kbd>
          </div>
        ))}
      </div>
    </ModalFrame>
  );
}

export function DeveloperModal({ open, onClose }) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <ModalFrame title={t('developerModalTitle')} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('devName')}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-7">{t('devBio')}</p>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2 gap-y-1">
          {DEV.tech.map((techName, idx) => (
            <span key={techName}>
              {idx > 0 && <span className="me-2 text-slate-400">·</span>}
              <span className="font-mono text-slate-700 dark:text-slate-300">{techName}</span>
            </span>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono" dir="ltr">
            {DEV.phone}
          </span>
          <a
            href={DEV.wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>{t('contactWhatsapp')}</span>
          </a>
        </div>
      </div>
    </ModalFrame>
  );
}

export function CodeReviewModal({ open, onClose, files, onSelectFile }) {
  const { locale, t, dict } = useI18n();
  if (!open) return null;

  const allProblems = [];
  let totalLines = 0;

  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue;
    totalLines += content.split('\n').length;
    const lang = detectLang(path);
    const diags = diagnose(content, lang, locale);
    for (const d of diags) {
      allProblems.push({ ...d, file: path });
    }
  }

  const errorCount = allProblems.filter((p) => p.severity === 'error' || !p.severity).length;
  const warningCount = allProblems.filter((p) => p.severity === 'warning').length;
  const fileCount = Object.keys(files).length;

  const score = Math.max(15, Math.min(100, 100 - errorCount * 12 - warningCount * 4));
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
  const gradeColor = score >= 80 ? 'text-emerald-500 bg-emerald-500/10' : score >= 60 ? 'text-amber-500 bg-amber-500/10' : 'text-rose-500 bg-rose-500/10';

  return (
    <ModalFrame title={t('codeReviewTitle')} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-5 text-xs sm:text-sm">
        {/* Score & Summary Card */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/85">
          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('projectQualityLabel')}</div>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{score} / 100</span>
              <span className={`px-2.5 py-0.5 rounded-lg text-sm font-bold ${gradeColor}`}>{grade}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {errorCount === 0 && warningCount === 0 ? t('excellentCode') : t('issuesFound', errorCount, warningCount)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center font-mono">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="text-base font-bold text-sky-600 dark:text-sky-400">{fileCount}</div>
              <div className="text-[10px] text-slate-500">{t('filesStat')}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">{totalLines}</div>
              <div className="text-[10px] text-slate-500">{t('totalLinesStat')}</div>
            </div>
          </div>
        </div>

        {/* Problems / Issues List (VS Code Problems style) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>{t('problemsHeader', allProblems.length)}</span>
            </span>
            <span className="text-xs font-normal text-slate-500">{t('problemsHint')}</span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-white dark:bg-[#0b1120]">
            {allProblems.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span>{t('noSyntaxIssues')}</span>
              </div>
            ) : (
              allProblems.map((prob, idx) => (
                <div
                  key={`${prob.file}-${prob.line}-${idx}`}
                  onClick={() => {
                    onSelectFile?.(prob.file);
                    onClose();
                  }}
                  className="group flex items-start justify-between gap-3 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 bg-slate-50 dark:bg-slate-900/60 cursor-pointer transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 font-mono text-xs text-sky-600 dark:text-sky-400">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{prob.file}</span>
                      <span className="text-slate-400">{t('lineLabel', prob.line)}</span>
                    </div>
                    <div className="text-slate-800 dark:text-slate-200 font-medium">{prob.why}</div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">{t('fixSuggestion', prob.fix)}</div>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-slate-400 group-hover:text-sky-500 shrink-0 self-center ${locale === 'ar' ? 'rotate-180' : ''}`} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quality Recommendations */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-500" />
            <span>{t('bestPracticesTitle')}</span>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 list-disc list-inside leading-relaxed">
            {dict.bestPractices.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </ModalFrame>
  );
}
