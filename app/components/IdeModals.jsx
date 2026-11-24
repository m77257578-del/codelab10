'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, FolderGit2, Keyboard, MessageCircle, Search, Download, Archive, FileJson } from 'lucide-react';
import { ALL_LANGUAGE_OPTIONS, DEV, WORKSPACE_TEMPLATES } from '../lib/workspaces';
import { sanitizeProjectName } from '../lib/storage';
import LanguageIcon from './LanguageIcon';

function ModalFrame({ title, onClose, maxWidth = 'max-w-xl', children }) {
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
            aria-label="إغلاق"
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
  const [nameInput, setNameInput] = useState(projectName || 'my-codelab-project');

  useEffect(() => {
    if (open) setNameInput(projectName || 'my-codelab-project');
  }, [open, projectName]);

  if (!open) return null;
  const safe = sanitizeProjectName(nameInput);

  return (
    <ModalFrame title="تسمية وتنزيل ملف المشروع" onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            اسم مجلد / ملف المشروع عند التنزيل
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
            <span>عدد الملفات المضمنة: {fileCount}</span>
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
                <div>تنزيل المشروع كاملاً (ZIP)</div>
                <div className="text-[11px] font-normal text-sky-100">مجلد باسم المشروع يحتوي على كل الأكواد والصور والفيديو</div>
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
              <span>تنزيل نسخة مشروع CodeLab (.json) لإعادة فتحها لاحقاً</span>
            </div>
            <Download className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

const LANG_CATEGORIES = [
  { id: 'all', label: 'الكل' },
  { id: 'web', label: 'الويب وPHP' },
  { id: 'data', label: 'SQL وJSON والبيانات' },
  { id: 'systems', label: 'البرمجة والأنظمة' },
  { id: 'scripting', label: 'السكربت والتكوين' },
];

export function LanguagesModal({ open, onClose, onCreateLanguageFile }) {
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
    <ModalFrame title={`إنشاء ملف بلغة برمجة (${ALL_LANGUAGE_OPTIONS.length} لغة مدعومة)`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن لغة: JSON, SQL, PHP, Python, Rust, Go, Swift, Kotlin..."
            className="w-full pr-9 pl-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {LANG_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                category === cat.id
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
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
  if (!open) return null;
  return (
    <ModalFrame title="قوالب المشاريع الجاهزة" onClose={onClose}>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        اختر قالب مساحة عمل جديد للبدء الفوري. سيستبدل القالب الملفات الحالية في مساحة العمل.
      </p>
      <div className="space-y-2.5">
        {WORKSPACE_TEMPLATES.map((tpl) => (
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
                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{tpl.name}</span>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400" dir="ltr">
                {Object.keys(tpl.files).length} files
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">{tpl.description}</p>
          </button>
        ))}
      </div>
    </ModalFrame>
  );
}

const SHORTCUTS = [
  ['Ctrl / Cmd + Enter', 'تشغيل الكود وتحديث المعاينة'],
  ['Ctrl / Cmd + K', 'فتح لوحة الأوامر والبحث السريع عن الملفات'],
  ['Ctrl / Cmd + F', 'البحث والاستبدال داخل الملف الحالي'],
  ['Ctrl / Cmd + B', 'إظهار أو إخفاء مستكشف الملفات'],
  ['Ctrl / Cmd + J', 'إظهار أو إخفاء اللوحة السفلية (Terminal / Console)'],
  ['Ctrl / Cmd + `', 'فتح أو إخفاء الطرفية المتكاملة (Terminal)'],
  ['Ctrl / Cmd + /', 'تفعيل أو تعطيل التعليق للأسطر المحددة'],
  ['Alt + Click', 'إضافة مؤشر كتابة متعدد (Multi-cursor)'],
  ['Tab / Shift + Tab', 'زيادة أو تقليل المسافة البادئة'],
];

export function ShortcutsModal({ open, onClose }) {
  if (!open) return null;
  return (
    <ModalFrame title="اختصارات لوحة المفاتيح" onClose={onClose}>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {SHORTCUTS.map(([keys, desc]) => (
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
  if (!open) return null;
  return (
    <ModalFrame title="عن المطور" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{DEV.name}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-7">{DEV.bio}</p>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2 gap-y-1">
          {DEV.tech.map((t, idx) => (
            <span key={t}>
              {idx > 0 && <span className="ml-2 text-slate-400">·</span>}
              <span className="font-mono text-slate-700 dark:text-slate-300">{t}</span>
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
            <span>تواصل عبر واتساب</span>
          </a>
        </div>
      </div>
    </ModalFrame>
  );
}
