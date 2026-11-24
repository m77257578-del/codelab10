'use client';

import { useMemo } from 'react';
import { GitCommit, AlertTriangle, CheckCircle2, FileCode, ArrowRight, ExternalLink } from 'lucide-react';
import { useI18n } from '../lib/LocaleContext';

function ModalFrame({ title, onClose, maxWidth = 'max-w-2xl', children }) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <GitCommit className="w-5 h-5 text-sky-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeAria')}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        <div className="p-5 max-h-[75vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export function DependencyGraphModal({ open, onClose, files = {}, onSelectFile }) {
  const { t, locale } = useI18n();
  const isEn = locale === 'en';

  const graphData = useMemo(() => {
    const filePaths = Object.keys(files || {});
    const pathSet = new Set(filePaths);
    const nodes = [];
    const missingModulesList = new Set();

    for (const path of filePaths) {
      const content = String(files[path] || '');
      const outgoing = new Set();

      // Extract JS/TS imports & requires
      const importRe = /\b(?:import\s+(?:[\w*\s{},]+)\s+from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
      let m;
      while ((m = importRe.exec(content)) !== null) {
        const spec = m[1];
        if (spec.startsWith('.')) {
          // Resolve relative path
          const cleanSpec = spec.replace(/^\.\//, '');
          const resolved = pathSet.has(cleanSpec) ? cleanSpec : pathSet.has(cleanSpec + '.js') ? cleanSpec + '.js' : pathSet.has(cleanSpec + '.jsx') ? cleanSpec + '.jsx' : cleanSpec;
          outgoing.add(resolved);
          if (!pathSet.has(resolved) && !spec.startsWith('./node_modules')) {
            missingModulesList.add(spec);
          }
        } else if (spec.startsWith('@/') || spec.startsWith('~/')) {
          const clean = spec.slice(2);
          const resolved = pathSet.has(clean) ? clean : pathSet.has('src/' + clean) ? 'src/' + clean : clean;
          outgoing.add(resolved);
        } else {
          // External npm module
          outgoing.add(`npm:${spec}`);
        }
      }

      // Extract HTML src / href links
      const htmlLinkRe = /(?:src|href)=['"]([^'"]+)['"]/g;
      while ((m = htmlLinkRe.exec(content)) !== null) {
        const ref = m[1];
        if (!ref.startsWith('http') && !ref.startsWith('data:') && !ref.startsWith('#')) {
          const cleanRef = ref.replace(/^\.\//, '').replace(/^\//, '');
          if (pathSet.has(cleanRef)) {
            outgoing.add(cleanRef);
          } else if (!ref.startsWith('mailto:')) {
            missingModulesList.add(ref);
          }
        }
      }

      // Extract Python imports
      const pyImportRe = /^(?:\s*import\s+([\w.]+)|\s*from\s+([\w.]+)\s+import)/gm;
      while ((m = pyImportRe.exec(content)) !== null) {
        const mod = (m[1] || m[2] || '').trim();
        if (mod) {
          const pyFile = `${mod.replace(/\./g, '/')}.py`;
          if (pathSet.has(pyFile)) {
            outgoing.add(pyFile);
          } else if (!['json', 'math', 'os', 'sys', 'json', 'datetime', 'random'].includes(mod)) {
            // Builtin or external
          }
        }
      }

      nodes.push({
        path,
        outgoing: Array.from(outgoing),
        hasMissing: Array.from(outgoing).some((o) => o.startsWith('npm:') === false && !pathSet.has(o)),
      });
    }

    return {
      nodes,
      missingModules: Array.from(missingModulesList),
    };
  }, [files]);

  if (!open) return null;

  return (
    <ModalFrame title={isEn ? 'Visual Dependency & Module Graph' : 'خريطة الاعتماديات ووحدات المشروع'} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {isEn
            ? 'Visual representation of how your project files are connected via imports, scripts, styles, and references.'
            : 'عرض بصري لتشابك ملفات المشروع عبر استيرادات الأكواد، ملفات التنسيق، والوسوم، مما يساعد في اكتشاف أي وحدات مفقودة.'}
        </p>

        {graphData.missingModules.length > 0 && (
          <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-0.5">{isEn ? 'Potential Missing Modules / Unresolved References:' : 'تنبيه: وحدات مستوردة أو ملفات غير موجودة في المشروع:'}</div>
              <ul className="list-disc list-inside space-y-1 font-mono text-[11px] opacity-90">
                {graphData.missingModules.map((mod, idx) => (
                  <li key={idx}>{mod}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {graphData.nodes.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">{isEn ? 'No project files found.' : 'لا توجد ملفات في المشروع.'}</div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isEn ? `Project Files Connectivity (${graphData.nodes.length} files)` : `ارتباط ملفات المشروع (${graphData.nodes.length} ملف)`}
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
              {graphData.nodes.map((node) => (
                <div
                  key={node.path}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between gap-3 transition-colors hover:border-sky-500/50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCode className="w-4 h-4 text-sky-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-medium text-slate-800 dark:text-slate-200 truncate" dir="ltr">
                        {node.path}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {node.outgoing.length === 0
                          ? (isEn ? 'No outgoing dependencies' : 'بدون ارتباطات خارجية')
                          : node.outgoing.map((o) => (o.startsWith('npm:') ? o.slice(4) : o)).join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {node.hasMissing ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        {isEn ? 'Unresolved' : 'مرجع ناقص'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        {isEn ? 'Connected' : 'سليم'}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onSelectFile?.(node.path);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium inline-flex items-center gap-1 transition-colors"
                    >
                      <span>{isEn ? 'Open' : 'فتح'}</span>
                      <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalFrame>
  );
}
