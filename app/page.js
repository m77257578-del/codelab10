'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  PanelLeft,
  PanelRight,
  Search,
  Wand2,
  WrapText,
  Sun,
  Moon,
  Download,
  RefreshCw,
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  Tablet,
  Smartphone,
  Terminal,
  AlertTriangle,
  Trash2,
  Command,
  X,
  ImageIcon,
  Film,
  Music,
  Languages,
  Keyboard,
  FolderDown,
  Minus,
  Plus,
  GitBranch,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import CodeEditorPane from './components/CodeEditorPane';
import FileExplorer from './components/FileExplorer';
import LanguageIcon from './components/LanguageIcon';
import MediaViewerPane from './components/MediaViewerPane';
import MobileCodeBar from './components/MobileCodeBar';
import CommandPalette from './components/CommandPalette';
import QuickOpenModal from './components/QuickOpenModal';
import IntegratedTerminal from './components/IntegratedTerminal';
import {
  DeveloperModal,
  ExportProjectModal,
  LanguagesModal,
  ShortcutsModal,
  TemplatesModal,
  CodeReviewModal,
} from './components/IdeModals';
import { WORKSPACE_TEMPLATES, detectLang, detectMediaKind, getLangMeta } from './lib/workspaces';
import { arJs, diagnose, formatCode } from './lib/diagnostics';
import { formatWithPrettier } from './lib/formatter';
import { buildWebPreviewDoc, isPyodideReady, runCode, runWorker } from './lib/runner';
import {
  buildProjectZip,
  isMediaEntry,
  loadProjectName,
  loadWorkspaceFiles,
  sanitizeProjectName,
  saveProjectName,
  saveWorkspaceFiles,
} from './lib/storage';

const STORAGE_FILES_LEGACY = 'codelab_ide_files_v1';
const STORAGE_TABS = 'codelab_ide_tabs_v1';
const STORAGE_ACTIVE = 'codelab_ide_active_v1';
const STORAGE_PREFS = 'codelab_ide_prefs_v1';

const DEFAULT_TPL = WORKSPACE_TEMPLATES[0];

export default function CodeLabIDE() {
  const [files, setFiles] = useState(DEFAULT_TPL.files);
  const [openTabs, setOpenTabs] = useState([DEFAULT_TPL.entryFile, 'styles.css', 'app.js']);
  const [activeFile, setActiveFile] = useState(DEFAULT_TPL.entryFile);
  const [projectName, setProjectName] = useState('my-codelab-project');
  const [hydrated, setHydrated] = useState(false);

  const [prefs, setPrefs] = useState({
    theme: 'dark',
    fontSize: 14,
    tabSize: 2,
    wordWrap: false,
    autoRun: true,
    showExplorer: true,
    showPreview: true,
    showDock: false,
    showMobileBar: false,
  });

  const [isMobile, setIsMobile] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(null);
  const [isOnline, setIsOnline] = useState(true);

  const [cursor, setCursor] = useState({ line: 1, col: 1, selected: 0, lines: 1 });
  const [dockTab, setDockTab] = useState('terminal'); // 'terminal' | 'console' | 'problems'
  const [dockExpanded, setDockExpanded] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [replInput, setReplInput] = useState('');
  const [previewDoc, setPreviewDoc] = useState('');
  const [previewRev, setPreviewRev] = useState(0);
  const [previewViewport, setPreviewViewport] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState(null);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const editorApiRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const settingsRef = useRef(null);

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2600);
  }, []);

  // Load persisted workspace (IndexedDB -> legacy localStorage fallback) and preferences
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let loadedFiles = await loadWorkspaceFiles();
        if (!loadedFiles) {
          const legacyRaw = localStorage.getItem(STORAGE_FILES_LEGACY);
          if (legacyRaw) {
            loadedFiles = JSON.parse(legacyRaw);
            if (loadedFiles && Object.keys(loadedFiles).length > 0) {
              await saveWorkspaceFiles(loadedFiles);
              localStorage.removeItem(STORAGE_FILES_LEGACY);
            }
          }
        }

        const savedTabs = localStorage.getItem(STORAGE_TABS);
        const savedActive = localStorage.getItem(STORAGE_ACTIVE);
        const savedPrefs = localStorage.getItem(STORAGE_PREFS);
        const savedProj = loadProjectName();

        if (!active) return;
        setProjectName(savedProj);

        if (loadedFiles && Object.keys(loadedFiles).length > 0) {
          setFiles(loadedFiles);
          const keys = Object.keys(loadedFiles);
          const validTabs = savedTabs ? JSON.parse(savedTabs).filter((t) => loadedFiles[t] !== undefined) : [];
          setOpenTabs(validTabs.length ? validTabs : [keys[0]]);
          setActiveFile(savedActive && loadedFiles[savedActive] !== undefined ? savedActive : keys[0]);
        }

        const narrow = typeof window !== 'undefined' && window.innerWidth < 768;
        const tablet = typeof window !== 'undefined' && window.innerWidth < 1024;
        if (savedPrefs) {
          const parsedPrefs = JSON.parse(savedPrefs);
          setPrefs((prev) => ({
            ...prev,
            ...parsedPrefs,
            ...(narrow
              ? { showPreview: false, showExplorer: false, showDock: false }
              : tablet && parsedPrefs.showPreview && parsedPrefs.showExplorer
                ? { showPreview: false }
                : {}),
          }));
        } else if (tablet) {
          setPrefs((prev) => ({
            ...prev,
            showPreview: false,
            showExplorer: !narrow,
            showDock: false,
            showMobileBar: narrow,
          }));
        }
      } catch {}

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        if (process.env.NODE_ENV === 'production') {
          navigator.serviceWorker.register('/api/pwa?sw=1', { scope: '/' }).catch(() => {});
        } else {
          navigator.serviceWorker.getRegistrations()
            .then((regs) => Promise.all(regs.map((r) => r.unregister())))
            .catch(() => {});
          if (typeof caches !== 'undefined') {
            caches.keys()
              .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
              .catch(() => {});
          }
        }
      }
      if (active) setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Track responsive mobile viewport + virtual keyboard height (visualViewport) + offline/online status
  useEffect(() => {
    const syncViewport = () => {
      const w = window.innerWidth;
      const mobile = w < 768;
      setIsMobile(mobile);
      if (window.visualViewport) {
        setViewportHeight(mobile ? Math.round(window.visualViewport.height) : null);
      } else {
        setViewportHeight(null);
      }
    };
    const syncOnline = () => setIsOnline(navigator.onLine);

    syncViewport();
    syncOnline();

    window.addEventListener('resize', syncViewport);
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    window.visualViewport?.addEventListener('resize', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
      window.visualViewport?.removeEventListener('resize', syncViewport);
    };
  }, []);

  // Close editor settings popover on outside click or Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const handleOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [settingsOpen]);

  // Listen for GitHub OAuth popup callback messages
  useEffect(() => {
    const handleOAuthMessage = (event) => {
      if (!event?.data || typeof event.data !== 'object') return;
      const origin = event.origin || '';
      const isTrustedOrigin =
        origin === window.location.origin ||
        /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/i.test(origin) ||
        /^http:\/\/localhost(:\d+)?$/i.test(origin);
      if (!isTrustedOrigin) return;

      if (event.data.type === 'GITHUB_OAUTH_SUCCESS' && event.data.sessionToken) {
        setGithubSessionToken(event.data.sessionToken);
        setGithubUser(event.data.user || null);
        showNotice(`تم ربط حساب GitHub: @${event.data.user?.login || 'user'}`);
      } else if (event.data.type === 'GITHUB_OAUTH_ERROR') {
        showNotice(event.data.error || 'تعذر إتمام ربط حساب GitHub');
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [showNotice]);

  // Persist workspace locally in IndexedDB + lightweight metadata in localStorage
  useEffect(() => {
    if (!hydrated) return;
    saveWorkspaceFiles(files);
    try {
      localStorage.setItem(STORAGE_TABS, JSON.stringify(openTabs));
      localStorage.setItem(STORAGE_ACTIVE, activeFile);
      localStorage.setItem(STORAGE_PREFS, JSON.stringify(prefs));
      saveProjectName(projectName);
    } catch {}
  }, [files, openTabs, activeFile, prefs, projectName, hydrated]);

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [prefs.theme]);

  const activeEntry = files[activeFile];
  const activeIsMedia = isMediaEntry(activeEntry);
  const activeCode = typeof activeEntry === 'string' ? activeEntry : '';
  const activeLang = detectLang(activeFile);
  const activeMeta = getLangMeta(activeLang);

  const showCodingBar = !activeIsMedia && (isMobile || prefs.showMobileBar);

  // Check if current workspace has web/previewable files
  const hasWebFiles = useMemo(
    () =>
      Object.keys(files).some((p) => /\.(html|htm|css|svg)$/i.test(p)) ||
      activeLang === 'markdown' ||
      activeIsMedia,
    [files, activeLang, activeIsMedia]
  );

  // Diagnostics across code files
  const problems = useMemo(() => {
    const list = [];
    for (const [path, content] of Object.entries(files)) {
      if (typeof content !== 'string') continue;
      const l = detectLang(path);
      const diags = diagnose(content, l);
      for (const d of diags) {
        list.push({ ...d, file: path });
      }
    }
    return list;
  }, [files]);

  const appendLog = useCallback((level, text) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setConsoleLogs((prev) => [...prev.slice(-199), { id: `${Date.now()}-${Math.random()}`, level, text, time }]);
  }, []);

  // Listen to sandboxed iframe console & error messages
  useEffect(() => {
    const onMsg = (e) => {
      if (!e.data?.cl) return;
      if (e.data.cl === 'clear') {
        setConsoleLogs([]);
      } else if (e.data.cl === 'log') {
        appendLog(e.data.level || 'log', String(e.data.m));
      } else if (e.data.cl === 'err') {
        const lineStr = e.data.l ? ` (سطر ${e.data.l})` : '';
        appendLog('error', `${arJs(e.data.m)}${lineStr}`);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [appendLog]);

  const doRun = useCallback(
    async (silent = false) => {
      if (!activeFile) return;
      const hasHtmlWorkspace = Object.keys(files).some((p) => /\.(html|htm)$/i.test(p));
      const isWebEntry =
        activeIsMedia ||
        activeLang === 'html' ||
        activeLang === 'css' ||
        activeLang === 'svg' ||
        activeLang === 'markdown' ||
        ((activeLang === 'js' || activeLang === 'ts' || activeLang === 'jsx' || activeLang === 'tsx') &&
          hasHtmlWorkspace);

      if (isWebEntry) {
        if (!silent) setConsoleLogs([]);
        const doc = buildWebPreviewDoc(files, activeFile, true);
        setPreviewDoc(doc);
        setPreviewRev((n) => n + 1);
        if (!silent) {
          setFocusMode(false);
          editorApiRef.current?.blur();
        }
        if (!silent && !prefs.showPreview) {
          const isTabletOrMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
          const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;
          setPrefs((p) => ({
            ...p,
            showPreview: true,
            ...(isTabletOrMobile ? { showExplorer: false } : {}),
            ...(isPhone ? { showDock: false } : {}),
          }));
        }
        return;
      }

      if (!activeMeta.runnable) {
        if (!silent) showNotice(`الملف ${activeFile} جاهز للتحرير والتمييز اللوني (${activeMeta.label})`);
        return;
      }

      if (!silent) {
        setFocusMode(false);
        editorApiRef.current?.blur();
      }

      const localDiags = diagnose(activeCode, activeLang);
      if (localDiags.length) {
        setDockTab('problems');
        setPrefs((p) => ({ ...p, showDock: true }));
        appendLog('error', `يوجد ${localDiags.length} أخطاء في ${activeFile} — راجع تبويب المشكلات.`);
        return;
      }

      setRunning(true);
      setDockTab('console');
      const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;
      setPrefs((p) => ({
        ...p,
        showDock: true,
        ...(isPhone ? { showPreview: false, showExplorer: false } : {}),
      }));

      if (activeLang === 'python' && !isPyodideReady()) {
        appendLog('info', 'جارٍ التشغيل بمحرك Python المحلي الفوري...');
      }

      const res = await runCode(activeLang, activeCode, files);
      setRunning(false);

      if (res.noRun || res.err) {
        appendLog('error', arJs(res.err));
        return;
      }
      const output = (res.out || '').trimEnd();
      if (output) {
        output.split('\n').forEach((line) => appendLog('output', line));
      } else {
        appendLog('info', 'انتهى التنفيذ بدون مخرجات مطبوعة.');
      }
      if (res.stderr) {
        appendLog('warn', res.stderr);
      }
    },
    [activeFile, activeIsMedia, activeLang, activeCode, activeMeta.runnable, activeMeta.label, files, prefs.showPreview, appendLog, showNotice]
  );

  // Initial preview & auto-run debounce for web projects
  useEffect(() => {
    if (!hydrated) return;
    if (!prefs.autoRun && previewRev > 0) return;
    const hasHtmlWorkspace = Object.keys(files).some((p) => /\.(html|htm)$/i.test(p));
    const isWebContext =
      activeIsMedia ||
      activeLang === 'html' ||
      activeLang === 'css' ||
      activeLang === 'svg' ||
      activeLang === 'markdown' ||
      ((activeLang === 'js' || activeLang === 'ts' || activeLang === 'jsx' || activeLang === 'tsx') &&
        hasHtmlWorkspace);
    if (!isWebContext) return;

    const timer = setTimeout(() => {
      const doc = buildWebPreviewDoc(files, activeFile, true);
      setPreviewDoc(doc);
      setPreviewRev((n) => n + 1);
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, activeFile, activeLang, activeIsMedia, prefs.autoRun, hydrated]);

  // Global IDE keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setFocusMode(false);
        setPrefs((p) => ({ ...p, showExplorer: !p.showExplorer }));
      } else if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setFocusMode(false);
        setPrefs((p) => ({ ...p, showDock: !p.showDock }));
      } else if (mod && e.key === '`') {
        e.preventDefault();
        setFocusMode(false);
        setDockTab('terminal');
        setPrefs((p) => ({ ...p, showDock: !(p.showDock && dockTab === 'terminal') }));
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFocusMode((v) => !v);
      } else if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setQuickOpenOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        showNotice('تم حفظ المشروع محلياً على جهازك (جاهز بدون إنترنت)');
      } else if (mod && e.key === 'Enter') {
        e.preventDefault();
        doRun(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doRun, showNotice, dockTab]);

  // File management handlers
  const handleSelectFile = useCallback((path) => {
    setActiveFile(path);
    setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path]));
  }, []);

  const handleCloseTab = useCallback(
    (path) => {
      setOpenTabs((tabs) => {
        const next = tabs.filter((t) => t !== path);
        if (activeFile === path) {
          setActiveFile(next[next.length - 1] || '');
        }
        return next;
      });
    },
    [activeFile]
  );

  const handleCreateFile = useCallback(
    (rawPath, initialContent) => {
      const clean = rawPath.trim().replace(/^\/+|\/+$/g, '');
      if (!clean) return;
      if (files[clean] !== undefined) {
        handleSelectFile(clean);
        showNotice('الملف موجود بالفعل، تم فتحه');
        return;
      }
      const detected = detectLang(clean);
      const starter =
        initialContent !== undefined ? initialContent : getLangMeta(detected).starter || '';
      setFiles((prev) => ({ ...prev, [clean]: starter }));
      setOpenTabs((tabs) => [...tabs, clean]);
      setActiveFile(clean);
    },
    [files, handleSelectFile, showNotice]
  );

  const handleCreateLanguageFile = useCallback(
    (langMeta) => {
      let baseName =
        langMeta.id === 'dockerfile'
          ? 'Dockerfile'
          : langMeta.id === 'java'
            ? 'Main.java'
            : `main.${langMeta.ext}`;
      let idx = 2;
      while (files[baseName] !== undefined) {
        baseName =
          langMeta.id === 'dockerfile'
            ? `Dockerfile.${idx}`
            : langMeta.id === 'java'
              ? `Main${idx}.java`
              : `main-${idx}.${langMeta.ext}`;
        idx += 1;
      }
      setFiles((prev) => ({ ...prev, [baseName]: langMeta.starter || '' }));
      setOpenTabs((tabs) => [...tabs, baseName]);
      setActiveFile(baseName);
      showNotice(`تم إنشاء ملف ${baseName} (${langMeta.label})`);
    },
    [files, showNotice]
  );

  const handleRenameFile = useCallback(
    (oldPath, newPath) => {
      if (files[newPath] !== undefined) {
        showNotice('يوجد ملف آخر بنفس الاسم');
        return;
      }
      setFiles((prev) => {
        const next = { ...prev };
        next[newPath] = next[oldPath];
        delete next[oldPath];
        return next;
      });
      setOpenTabs((tabs) => tabs.map((t) => (t === oldPath ? newPath : t)));
      if (activeFile === oldPath) setActiveFile(newPath);
    },
    [files, activeFile, showNotice]
  );

  const handleDuplicateFile = useCallback(
    (path) => {
      const dot = path.lastIndexOf('.');
      const base = dot > -1 ? path.slice(0, dot) : path;
      const ext = dot > -1 ? path.slice(dot) : '';
      let idx = 1;
      let candidate = `${base}-copy${ext}`;
      while (files[candidate] !== undefined) {
        idx += 1;
        candidate = `${base}-copy${idx}${ext}`;
      }
      setFiles((prev) => ({ ...prev, [candidate]: prev[path] }));
      setOpenTabs((tabs) => [...tabs, candidate]);
      setActiveFile(candidate);
    },
    [files]
  );

  const handleDeleteFile = useCallback(
    (path) => {
      const keys = Object.keys(files).filter((k) => k !== path);
      if (keys.length === 0) return;
      setFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      setOpenTabs((tabs) => {
        const next = tabs.filter((t) => t !== path);
        if (activeFile === path) {
          const fallback = next[next.length - 1] || keys[0];
          setActiveFile(fallback);
          return next.length ? next : [keys[0]];
        }
        return next;
      });
    },
    [files, activeFile]
  );

  const handleClearAllFiles = useCallback(() => {
    const starter = WORKSPACE_TEMPLATES[0].files;
    setFiles(starter);
    const keys = Object.keys(starter);
    setOpenTabs([keys[0]]);
    setActiveFile(keys[0]);
    setConsoleLogs([]);
    showNotice('تم مسح جميع الملفات وبدء مشروع فارغ جديد');
  }, [showNotice]);

  const handleImportFiles = useCallback(
    (loaded, importedProjectName) => {
      setFiles((prev) => ({ ...prev, ...loaded }));
      if (importedProjectName) {
        setProjectName(sanitizeProjectName(importedProjectName));
      }
      const importedNames = Object.keys(loaded);
      if (importedNames.length) {
        setOpenTabs((tabs) => Array.from(new Set([...tabs, ...importedNames])));
        setActiveFile(importedNames[0]);
        showNotice(`تم استيراد ${importedNames.length} ملف وحفظهم محلياً`);
      }
    },
    [showNotice]
  );

  const handleInsertIntoHtml = useCallback(
    (snippet) => {
      const htmlPath =
        files['index.html'] !== undefined
          ? 'index.html'
          : Object.keys(files).find((p) => /\.(html|htm)$/i.test(p)) || 'index.html';
      const currentHtml =
        typeof files[htmlPath] === 'string'
          ? files[htmlPath]
          : getLangMeta('html').starter;
      const updated = /<\/body>/i.test(currentHtml)
        ? currentHtml.replace(/<\/body>/i, `  ${snippet}\n</body>`)
        : `${currentHtml}\n${snippet}\n`;
      setFiles((prev) => ({ ...prev, [htmlPath]: updated }));
      setOpenTabs((tabs) => (tabs.includes(htmlPath) ? tabs : [...tabs, htmlPath]));
      setActiveFile(htmlPath);
      showNotice(`تم إدراج الوسم داخل ${htmlPath}`);
    },
    [files, showNotice]
  );

  const handleRenameProject = useCallback((raw) => {
    setProjectName(sanitizeProjectName(raw));
  }, []);

  const handleDownloadZip = useCallback(
    (customName) => {
      const safe = sanitizeProjectName(customName || projectName);
      const blob = buildProjectZip(safe, files);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safe}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showNotice(`تم تنزيل المشروع: ${safe}.zip`);
    },
    [files, projectName, showNotice]
  );

  const handleDownloadJson = useCallback(
    (customName) => {
      const safe = sanitizeProjectName(customName || projectName);
      const blob = new Blob(
        [JSON.stringify({ projectName: safe, files, exportedAt: new Date().toISOString() }, null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safe}.codelab.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotice(`تم تنزيل المشروع: ${safe}.codelab.json`);
    },
    [files, projectName, showNotice]
  );

  const handleDownloadActive = useCallback(() => {
    if (!activeFile) return;
    if (activeIsMedia && activeEntry?.dataUrl) {
      const a = document.createElement('a');
      a.href = activeEntry.dataUrl;
      a.download = activeFile.split('/').pop() || 'media';
      a.click();
      return;
    }
    const blob = new Blob([activeCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.split('/').pop() || 'code.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [activeFile, activeIsMedia, activeEntry, activeCode]);

  const handleSaveLocalFile = useCallback(async () => {
    if (!activeFile || activeIsMedia) return;
    if (typeof window === 'undefined' || !window.showSaveFilePicker) {
      handleDownloadActive();
      return;
    }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: activeFile.split('/').pop() || 'code.txt',
        types: [
          {
            description: 'Source Code / Text',
            accept: { 'text/plain': ['.txt', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.py', '.json', '.sql', '.php', '.md'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(activeCode);
      await writable.close();
      showNotice(`تم حفظ الملف محلياً: ${handle.name}`);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        handleDownloadActive();
      }
    }
  }, [activeFile, activeIsMedia, activeCode, handleDownloadActive, showNotice]);

  const handleOpenLocalFile = useCallback(async () => {
    if (typeof window === 'undefined' || !window.showOpenFilePicker) {
      document.getElementById('codelab-local-file-input')?.click();
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Code & Text Files',
            accept: { 'text/*': ['.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.py', '.json', '.sql', '.php', '.md', '.txt', '.sh', '.yaml', '.yml'] },
          },
        ],
      });
      const file = await handle.getFile();
      const content = await file.text();
      const fileName = file.name || 'imported.txt';
      setFiles((prev) => ({ ...prev, [fileName]: content }));
      setOpenTabs((tabs) => (tabs.includes(fileName) ? tabs : [...tabs, fileName]));
      setActiveFile(fileName);
      showNotice(`تم فتح الملف المحلي: ${fileName}`);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        document.getElementById('codelab-local-file-input')?.click();
      }
    }
  }, [showNotice]);

  const handleFormat = useCallback(async () => {
    if (!activeFile || activeIsMedia) return;
    try {
      const formatted = await formatWithPrettier(activeCode, activeFile);
      setFiles((prev) => ({ ...prev, [activeFile]: formatted }));
      showNotice('تم تنسيق الكود بواسطة Prettier');
    } catch (err) {
      try {
        const formatted = formatCode(activeCode, activeLang, prefs.tabSize);
        setFiles((prev) => ({ ...prev, [activeFile]: formatted }));
        showNotice('تم تنسيق الكود (تنسيق أساسي)');
      } catch {
        showNotice('تعذر تنسيق الكود لوجود أخطاء نحوية');
      }
    }
  }, [activeFile, activeIsMedia, activeCode, activeLang, prefs.tabSize, showNotice]);

  const handleLoadTemplate = useCallback(
    (tpl) => {
      setFiles({ ...tpl.files });
      setOpenTabs(Object.keys(tpl.files));
      setActiveFile(tpl.entryFile);
      setConsoleLogs([]);
      const isWeb = tpl.id === 'web-app';
      setFocusMode(false);
      setPrefs((p) => ({ ...p, showPreview: isWeb && !isMobile, showDock: false }));
      showNotice(`تم تحميل قالب: ${tpl.name}`);
    },
    [isMobile, showNotice]
  );

  const handleConnectGitHub = useCallback(async () => {
    try {
      const res = await fetch('/api/github/auth');
      const data = await res.json();
      if (!data?.configured || !data?.url) {
        setGithubOpen(true);
        showNotice('يرجى إضافة مفاتيح GitHub OAuth في الإعدادات أولاً');
        return;
      }
      const popup = window.open(data.url, 'github_oauth_popup', 'width=600,height=700');
      if (!popup) {
        showNotice('يرجى السماح بالنوافذ المنبثقة لإتمام الربط مع GitHub');
      }
    } catch {
      showNotice('تعذر بدء تسجيل الدخول عبر GitHub');
    }
  }, [showNotice]);

  const handleDisconnectGitHub = useCallback(() => {
    setGithubSessionToken(null);
    setGithubUser(null);
    showNotice('تم فصل حساب GitHub');
  }, [showNotice]);

  const handleUpdateFilesFromTerminal = useCallback(
    (nextFiles) => {
      setFiles(nextFiles);
      const keys = Object.keys(nextFiles);
      setOpenTabs((tabs) => {
        const filtered = tabs.filter((t) => nextFiles[t] !== undefined);
        return filtered.length ? filtered : keys.length ? [keys[0]] : [];
      });
      if (activeFile && nextFiles[activeFile] === undefined) {
        setActiveFile(keys[0] || '');
      }
    },
    [activeFile]
  );

  const handleOpenFileFromTerminal = useCallback(
    (path, line) => {
      if (!path) return;
      handleSelectFile(path);
      if (line) {
        setTimeout(() => editorApiRef.current?.jumpToLine(line), 60);
      }
    },
    [handleSelectFile]
  );

  const handleRefreshPreviewFromTerminal = useCallback(() => {
    const doc = buildWebPreviewDoc(files, activeFile, true);
    setPreviewDoc(doc);
    setPreviewRev((n) => n + 1);
    const isTabletOrMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;
    setPrefs((p) => ({
      ...p,
      showPreview: true,
      ...(isTabletOrMobile ? { showExplorer: false } : {}),
      ...(isPhone ? { showDock: false } : {}),
    }));
  }, [files, activeFile]);

  const handleEditorFocusChange = useCallback((focused) => {
    setEditorFocused(focused);
    if (focused && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setPrefs((p) =>
        p.showExplorer || p.showPreview
          ? { ...p, showExplorer: false, showPreview: false }
          : p
      );
    }
  }, []);

  const toggleExplorer = useCallback(() => {
    setFocusMode(false);
    const isTabletOrMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;
    setPrefs((p) => {
      const next = !p.showExplorer;
      return {
        ...p,
        showExplorer: next,
        ...(next && isTabletOrMobile ? { showPreview: false } : {}),
        ...(next && isPhone ? { showDock: false } : {}),
      };
    });
  }, []);

  const toggleDock = useCallback(() => {
    setFocusMode(false);
    const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;
    setPrefs((p) => {
      const next = !p.showDock;
      return {
        ...p,
        showDock: next,
        ...(next && isPhone ? { showPreview: false, showExplorer: false } : {}),
      };
    });
  }, []);

  const togglePreview = useCallback(() => {
    setFocusMode(false);
    const isTabletOrMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;
    setPrefs((p) => {
      const next = !p.showPreview;
      return {
        ...p,
        showPreview: next,
        ...(next && isTabletOrMobile ? { showExplorer: false } : {}),
        ...(next && isPhone ? { showDock: false } : {}),
      };
    });
  }, []);

  const handleReplSubmit = async (e) => {
    e.preventDefault();
    const expr = replInput.trim();
    if (!expr) return;
    setReplInput('');
    appendLog('info', `> ${expr}`);
    const wrapped = `try { const __res = (${expr}); if (__res !== undefined) console.log(typeof __res === 'object' ? JSON.stringify(__res) : __res); } catch { ${expr} }`;
    const res = await runWorker(wrapped);
    if (res.err) appendLog('error', arJs(res.err));
    else if (res.out) res.out.trimEnd().split('\n').forEach((l) => appendLog('output', l));
  };

  const externalPreviewUrl = useMemo(() => {
    if (!previewDoc) return '#';
    try {
      const cleanHtml = previewDoc.replace(/<script>\(\(\)=>\{[\s\S]*?<\/script>/, '');
      return URL.createObjectURL(new Blob([cleanHtml], { type: 'text/html' }));
    } catch {
      return '#';
    }
  }, [previewDoc]);

  useEffect(() => {
    return () => {
      if (externalPreviewUrl && externalPreviewUrl !== '#') {
        URL.revokeObjectURL(externalPreviewUrl);
      }
    };
  }, [externalPreviewUrl]);

  const paletteCommands = useMemo(
    () => [
      { id: 'run', label: 'تشغيل الكود الحالي', shortcut: 'Ctrl+Enter', action: () => doRun(false) },
      { id: 'focus', label: focusMode ? 'إلغاء وضع التركيز الكامل' : 'تفعيل وضع التركيز الكامل للكتابة', shortcut: 'Ctrl+Shift+F', action: () => setFocusMode((v) => !v) },
      { id: 'new-lang', label: 'إنشاء ملف بلغة برمجة (44 لغة)', shortcut: '', action: () => setLanguagesOpen(true) },
      { id: 'github-push', label: 'رفع المشروع مباشرة إلى GitHub', shortcut: '', action: () => setGithubOpen(true) },
      { id: 'export-project', label: 'تسمية وتنزيل المشروع كاملاً (ZIP)', shortcut: '', action: () => setExportOpen(true) },
      { id: 'format', label: 'تنسيق الكود (Format)', shortcut: 'Toolbar', action: handleFormat },
      { id: 'find', label: 'البحث والاستبدال في الملف', shortcut: 'Ctrl+F', action: () => editorApiRef.current?.openFind() },
      {
        id: 'explorer',
        label: prefs.showExplorer ? 'إخفاء مستكشف الملفات' : 'إظهار مستكشف الملفات',
        shortcut: 'Ctrl+B',
        action: toggleExplorer,
      },
      {
        id: 'terminal',
        label: 'فتح الطرفية المتكاملة (Terminal)',
        shortcut: 'Ctrl+`',
        action: () => {
          setFocusMode(false);
          setDockTab('terminal');
          const isPhone = typeof window !== 'undefined' && window.innerWidth < 768;
          setPrefs((p) => ({
            ...p,
            showDock: true,
            ...(isPhone ? { showPreview: false, showExplorer: false } : {}),
          }));
        },
      },
      {
        id: 'dock',
        label: prefs.showDock ? 'إخفاء اللوحة السفلية (Terminal / Console)' : 'إظهار اللوحة السفلية (Terminal / Console)',
        shortcut: 'Ctrl+J',
        action: toggleDock,
      },
      {
        id: 'preview',
        label: prefs.showPreview ? 'إخفاء المعاينة الحية' : 'إظهار المعاينة الحية',
        shortcut: '',
        action: togglePreview,
      },
      {
        id: 'mobilebar',
        label: prefs.showMobileBar ? 'إخفاء شريط اختصارات الهاتف' : 'إظهار شريط اختصارات الهاتف',
        shortcut: '',
        action: () => setPrefs((p) => ({ ...p, showMobileBar: !p.showMobileBar })),
      },
      {
        id: 'wrap',
        label: prefs.wordWrap ? 'إلغاء التفاف الأسطر' : 'تفعيل التفاف الأسطر',
        shortcut: '',
        action: () => setPrefs((p) => ({ ...p, wordWrap: !p.wordWrap })),
      },
      {
        id: 'theme',
        label: prefs.theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن',
        shortcut: '',
        action: () => setPrefs((p) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' })),
      },
      { id: 'quick-open', label: 'فتح ملف سريع (Quick Open / Go to File)', shortcut: 'Ctrl+P', action: () => setQuickOpenOpen(true) },
      { id: 'shortcuts', label: 'عرض اختصارات لوحة المفاتيح', shortcut: '', action: () => setShortcutsOpen(true) },
      { id: 'review', label: 'تقرير تقييم وفحص جودة الكود (Code Review)', shortcut: '', action: () => setReviewOpen(true) },
    ],
    [doRun, focusMode, handleFormat, prefs.showExplorer, prefs.showDock, prefs.showPreview, prefs.showMobileBar, prefs.wordWrap, prefs.theme, toggleExplorer, toggleDock, togglePreview, setReviewOpen, setQuickOpenOpen]
  );

  const renderTabIcon = (path) => {
    const kind = detectMediaKind(path, files[path]);
    if (kind === 'image') return <ImageIcon className="w-3.5 h-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />;
    if (kind === 'video') return <Film className="w-3.5 h-3.5 shrink-0 text-purple-500 dark:text-purple-400" />;
    if (kind === 'audio') return <Music className="w-3.5 h-3.5 shrink-0 text-pink-500 dark:text-pink-400" />;
    return <LanguageIcon lang={detectLang(path)} size={15} />;
  };

  const typingFullMobile = isMobile && editorFocused;
  const showHeaderFull = !typingFullMobile && !focusMode;
  const showToolbar = !typingFullMobile && !focusMode;
  const showExplorerPane = prefs.showExplorer && !focusMode && !typingFullMobile;
  const showPreviewPane = prefs.showPreview && !focusMode && !typingFullMobile;
  const showDockPane = prefs.showDock && !focusMode && !typingFullMobile;

  return (
    <div
      className="h-[100dvh] flex flex-col bg-slate-50 text-slate-900 dark:bg-[#0b1120] dark:text-slate-100 overflow-hidden"
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
    >
      {/* Distraction-free slim writing bar (mobile typing OR desktop focus mode) */}
      {(typingFullMobile || focusMode) && (
        <div className="h-10 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]">
          <div className="flex items-center gap-2 min-w-0">
            <LanguageIcon lang={activeLang} size={17} />
            <span className="text-xs font-mono font-medium text-slate-800 dark:text-slate-100 truncate" dir="ltr">
              {activeFile || projectName}
            </span>
            <span className="hidden sm:inline text-[11px] text-slate-400 shrink-0">· {activeMeta.label}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {focusMode ? (
              <button
                type="button"
                onClick={() => setFocusMode(false)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>إنهاء التركيز</span>
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorApiRef.current?.blur()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>تم</span>
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => doRun(false)}
              disabled={running}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-60"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{running ? 'جارٍ...' : 'تشغيل'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3-Zone Top Header Contract */}
      {showHeaderFull && (
      <header className="h-12 shrink-0 flex items-center justify-between gap-4 sm:gap-6 px-3 sm:px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <img
            src="/codelab-logo.jpg"
            alt="كود لاب"
            className="w-7 h-7 rounded-lg object-cover shrink-0"
          />
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
            كود لاب
          </span>
        </div>

        <nav className="flex items-center gap-3.5 sm:gap-6 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => editorApiRef.current?.focus()}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            المحرر
          </button>
          <button
            type="button"
            onClick={() => setLanguagesOpen(true)}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            اللغات
          </button>
          <button
            type="button"
            onClick={() => setTemplatesOpen(true)}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            القوالب
          </button>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            الاختصارات
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => doRun(false)}
            disabled={running}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{running ? 'جارٍ التشغيل' : 'تشغيل'}</span>
          </button>
        </div>
      </header>
      )}

      {/* Consolidated IDE Workspace Toolbar (3 clean groups + Editor Settings popover) */}
      {showToolbar && (
      <div className="relative h-11 shrink-0 flex items-center justify-between gap-2 px-2.5 sm:px-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0d1526]">
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
          {/* Group 1: Workspace Panels */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              title="مستكشف الملفات (Ctrl+B)"
              onClick={toggleExplorer}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 ${
                prefs.showExplorer
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">الملفات</span>
            </button>

            <button
              type="button"
              title="الطرفية واللوحة السفلية (Ctrl+`)"
              onClick={() => {
                if (!prefs.showDock) setDockTab('terminal');
                toggleDock();
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 ${
                prefs.showDock
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">الطرفية</span>
            </button>

            <button
              type="button"
              title="المعاينة الحية"
              onClick={togglePreview}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 ${
                prefs.showPreview
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">المعاينة</span>
            </button>

            <button
              type="button"
              title="وضع التركيز للكتابة بدون إزعاج (Ctrl+Shift+F)"
              onClick={() => setFocusMode(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">تركيز</span>
            </button>
          </div>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

          {/* Group 2: Project Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              title="اختيار لغة برمجة (44 لغة)"
              onClick={() => setLanguagesOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 whitespace-nowrap shrink-0"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="hidden md:inline">لغة جديدة</span>
            </button>

            <button
              type="button"
              title="تسمية وتنزيل المشروع"
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 whitespace-nowrap shrink-0"
            >
              <FolderDown className="w-3.5 h-3.5" />
              <span className="hidden md:inline">تنزيل المشروع</span>
            </button>

          </div>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

          {/* Group 3: Quick Code Tools */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              title="بحث واستبدال (Ctrl+F)"
              onClick={() => editorApiRef.current?.openFind()}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">بحث</span>
            </button>

            <button
              type="button"
              title="تنسيق الكود"
              onClick={handleFormat}
              disabled={activeIsMedia}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">تنسيق</span>
            </button>
          </div>
        </div>

        {/* Trailing Controls: Editor Settings Popover + Theme Toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              title="إعدادات المحرر والأدوات"
              onClick={() => setSettingsOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 ${
                settingsOpen
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">إعدادات المحرر</span>
            </button>

            {settingsOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-xl p-3 z-50 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">إعدادات المحرر</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    <LanguageIcon lang={activeLang} size={14} />
                    <span>{activeMeta.label}</span>
                  </span>
                </div>

                {/* Font size */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">حجم الخط</span>
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, fontSize: Math.max(11, p.fontSize - 1) }))}
                      className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2.5 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-200">
                      {prefs.fontSize}px
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, fontSize: Math.min(22, p.fontSize + 1) }))}
                      className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Tab size */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">المسافة البادئة (Tab)</span>
                  <div className="flex items-center gap-1">
                    {[2, 4].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setPrefs((p) => ({ ...p, tabSize: sz }))}
                        className={`px-2.5 py-1 rounded-md font-mono text-xs tabular-nums transition-colors ${
                          prefs.tabSize === sz
                            ? 'bg-sky-600 text-white font-semibold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, wordWrap: !p.wordWrap }))}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <WrapText className="w-3.5 h-3.5 text-slate-400" />
                      <span>التفاف الأسطر</span>
                    </span>
                    {prefs.wordWrap && <Check className="w-3.5 h-3.5 text-sky-500" />}
                  </button>

                  {hasWebFiles && (
                    <button
                      type="button"
                      onClick={() => setPrefs((p) => ({ ...p, autoRun: !p.autoRun }))}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                        <span>تحديث تلقائي للمعاينة</span>
                      </span>
                      {prefs.autoRun && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, showMobileBar: !p.showMobileBar }))}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                      <span>شريط اختصارات الكود</span>
                    </span>
                    {prefs.showMobileBar && <Check className="w-3.5 h-3.5 text-sky-500" />}
                  </button>
                </div>

                {/* Secondary actions */}
                <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      setPaletteOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Command className="w-3.5 h-3.5 text-slate-400" />
                      <span>لوحة الأوامر</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Ctrl+K</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSettingsOpen(false);
                      handleDownloadActive();
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>تحميل الملف الحالي</span>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            title={prefs.theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            onClick={() => setPrefs((p) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }))}
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 shrink-0"
          >
            {prefs.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
      )}

      {/* Main IDE Workspace */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {/* File Explorer Sidebar (drawer on mobile/tablet with backdrop) */}
        {showExplorerPane && (
          <>
            <div
              onClick={() => setPrefs((p) => ({ ...p, showExplorer: false }))}
              className="fixed inset-0 z-20 bg-slate-950/50 md:hidden"
            />
            <div className="absolute inset-y-0 right-0 z-30 flex md:static md:z-auto shadow-xl md:shadow-none max-w-[85vw]">
              <FileExplorer
                files={files}
                activeFile={activeFile}
                projectName={projectName}
                onRenameProject={handleRenameProject}
                onSelectFile={(p) => {
                  handleSelectFile(p);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setPrefs((prev) => ({ ...prev, showExplorer: false }));
                  }
                }}
                onCreateFile={handleCreateFile}
                onOpenLanguagePicker={() => setLanguagesOpen(true)}
                onRenameFile={handleRenameFile}
                onDuplicateFile={handleDuplicateFile}
                onDeleteFile={handleDeleteFile}
                onImportFiles={handleImportFiles}
                onExportWorkspace={() => setExportOpen(true)}
                onClearAllFiles={handleClearAllFiles}
                onOpenLocalFile={handleOpenLocalFile}
                onSaveLocalFile={handleSaveLocalFile}
              />
            </div>
          </>
        )}

        {/* Center Editor + Bottom Output/Console + Mobile Coding Bar */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Open Tabs Bar with Integrated Active File Path (auto-hidden during mobile typing for max code area) */}
          {!typingFullMobile && (
          <div
            className="h-9 shrink-0 flex items-center justify-between bg-slate-100 dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800"
            dir="ltr"
          >
            <div className="flex-1 min-w-0 h-full flex items-center overflow-x-auto no-scrollbar">
              {openTabs.map((path) => {
                const isActive = path === activeFile;
                const name = path.split('/').pop();
                return (
                  <div
                    key={path}
                    onClick={() => setActiveFile(path)}
                    className={`group h-full flex items-center gap-2 px-3 border-r border-slate-200 dark:border-slate-800 text-xs font-mono cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                      isActive
                        ? 'bg-white dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 border-t-2 border-t-sky-500'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {renderTabIcon(path)}
                    <span>{name}</span>
                    <button
                      type="button"
                      aria-label={`إغلاق ${name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(path);
                      }}
                      className="p-0.5 rounded opacity-70 hover:opacity-100 hover:bg-slate-300/60 dark:hover:bg-slate-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {activeFile && (
              <div className="hidden md:flex items-center gap-2 px-3 text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0 max-w-[280px]">
                <span className="truncate">{activeFile}</span>
                <span>·</span>
                <LanguageIcon lang={activeLang} size={14} />
                <span className="shrink-0 text-slate-500 dark:text-slate-400">{activeMeta.label}</span>
              </div>
            )}
          </div>
          )}

          {/* CodeMirror Editor OR Media Viewer */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeFile ? (
              activeIsMedia ? (
                <MediaViewerPane
                  path={activeFile}
                  media={activeEntry}
                  onInsertIntoHtml={handleInsertIntoHtml}
                />
              ) : (
                <CodeEditorPane
                  value={activeCode}
                  onChange={(val) => setFiles((prev) => ({ ...prev, [activeFile]: val }))}
                  lang={activeLang}
                  files={files}
                  theme={prefs.theme}
                  fontSize={prefs.fontSize}
                  tabSize={prefs.tabSize}
                  wordWrap={prefs.wordWrap}
                  onCursorChange={setCursor}
                  onFocusChange={handleEditorFocusChange}
                  editorRefOut={editorApiRef}
                  onRunShortcut={() => doRun(false)}
                />
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <p>لا يوجد ملف مفتوح حالياً</p>
                <button
                  type="button"
                  onClick={() => handleSelectFile(Object.keys(files)[0])}
                  className="px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold"
                >
                  فتح الملف الرئيسي
                </button>
              </div>
            )}
          </div>

          {/* Bottom Terminal, Console & Problems Dock */}
          {showDockPane && (
            <div
              className={`${
                dockExpanded ? 'h-72 sm:h-96' : 'h-40 sm:h-44'
              } shrink-0 flex flex-col border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] transition-[height] duration-150`}
            >
              <div className="h-8 shrink-0 flex items-center justify-between px-3 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
                <div className="flex items-center gap-4 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setDockTab('terminal')}
                    className={`h-8 flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                      dockTab === 'terminal'
                        ? 'border-sky-500 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>الطرفية Terminal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDockTab('console')}
                    className={`h-8 flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                      dockTab === 'console'
                        ? 'border-sky-500 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Command className="w-3.5 h-3.5" />
                    <span>وحدة التحكم Console</span>
                    {consoleLogs.length > 0 && (
                      <span className="font-mono tabular-nums text-[11px] text-slate-400">({consoleLogs.length})</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDockTab('problems')}
                    className={`h-8 flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                      dockTab === 'problems'
                        ? 'border-sky-500 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>المشكلات</span>
                    {problems.length > 0 && (
                      <span className="font-mono tabular-nums text-[11px] text-rose-600 dark:text-rose-400">
                        ({problems.length})
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {dockTab === 'console' && (
                    <button
                      type="button"
                      title="مسح السجل"
                      onClick={() => setConsoleLogs([])}
                      className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title={dockExpanded ? 'تصغير اللوحة' : 'توسيع اللوحة'}
                    onClick={() => setDockExpanded((v) => !v)}
                    className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    {dockExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    title="إغلاق اللوحة"
                    onClick={() => setPrefs((p) => ({ ...p, showDock: false }))}
                    className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {dockTab === 'terminal' ? (
                <IntegratedTerminal
                  projectName={projectName}
                  files={files}
                  activeFile={activeFile}
                  onUpdateFiles={handleUpdateFilesFromTerminal}
                  onOpenFile={handleOpenFileFromTerminal}
                  onRefreshPreview={handleRefreshPreviewFromTerminal}
                  onExportZip={handleDownloadZip}
                />
              ) : dockTab === 'console' ? (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 overflow-auto p-2.5 space-y-1 font-mono text-xs" dir="ltr">
                    {consoleLogs.length === 0 ? (
                      <div className="text-slate-400 dark:text-slate-500">
                        Console ready. Run your code or evaluate JavaScript expressions below.
                      </div>
                    ) : (
                      consoleLogs.map((entry) => (
                        <div
                          key={entry.id}
                          className={`flex items-start gap-2.5 leading-5 ${
                            entry.level === 'error'
                              ? 'text-rose-600 dark:text-rose-400'
                              : entry.level === 'warn'
                                ? 'text-amber-600 dark:text-amber-400'
                                : entry.level === 'info'
                                  ? 'text-sky-600 dark:text-sky-400'
                                  : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          <span className="text-[10px] text-slate-400 tabular-nums shrink-0 pt-0.5">{entry.time}</span>
                          <pre className="whitespace-pre-wrap break-words font-mono m-0">{entry.text}</pre>
                        </div>
                      ))
                    )}
                  </div>
                  <form
                    onSubmit={handleReplSubmit}
                    dir="ltr"
                    className="h-8 shrink-0 flex items-center gap-2 px-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0b1120]"
                  >
                    <span className="font-mono text-xs text-sky-500">&gt;</span>
                    <input
                      value={replInput}
                      onChange={(e) => setReplInput(e.target.value)}
                      placeholder="Evaluate JS expression (e.g. [1,2,3].map(x => x * 2))"
                      className="flex-1 bg-transparent font-mono text-xs text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </form>
                </div>
              ) : (
                <div className="flex-1 overflow-auto divide-y divide-slate-200 dark:divide-slate-800">
                  {problems.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 p-4">لا توجد أخطاء مكتشفة في ملفات المشروع.</div>
                  ) : (
                    problems.map((p, idx) => (
                      <button
                        key={`${p.file}-${p.line}-${idx}`}
                        type="button"
                        onClick={() => {
                          handleSelectFile(p.file);
                          setTimeout(() => editorApiRef.current?.jumpToLine(p.line), 60);
                        }}
                        className="w-full text-start px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/70 flex items-start justify-between gap-3 text-xs transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="text-rose-600 dark:text-rose-400 font-medium">{p.why}</div>
                          <div className="text-slate-500 dark:text-slate-400">{p.fix}</div>
                        </div>
                        <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0" dir="ltr">
                          {p.file}:{p.line}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mobile / Touch Coding Shortcut Bar right above the phone keyboard */}
          {showCodingBar && (
            <MobileCodeBar
              lang={activeLang}
              editorApiRef={editorApiRef}
              compact={typingFullMobile}
            />
          )}
        </div>

        {/* Live Browser Preview Pane */}
        {showPreviewPane && (
          <section
            className={`${
              previewFullscreen
                ? 'fixed inset-0 z-50 bg-slate-100 dark:bg-[#0b1120]'
                : 'absolute inset-0 z-20 lg:static lg:z-auto flex lg:w-[38%] xl:w-[40%] lg:max-w-[560px] border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0f172a]'
            } flex flex-col shrink-0`}
          >
            <div className="h-9 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 min-w-0">
                <span className="font-semibold shrink-0">المعاينة الحية</span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-[11px] text-slate-500 truncate max-w-[140px]" dir="ltr">
                  {activeFile}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="سطح المكتب"
                  onClick={() => setPreviewViewport('desktop')}
                  className={`hidden sm:inline-flex p-1.5 rounded ${
                    previewViewport === 'desktop'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="تابلت (768px)"
                  onClick={() => setPreviewViewport('tablet')}
                  className={`hidden sm:inline-flex p-1.5 rounded ${
                    previewViewport === 'tablet'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="موبايل (375px)"
                  onClick={() => setPreviewViewport('mobile')}
                  className={`hidden sm:inline-flex p-1.5 rounded ${
                    previewViewport === 'mobile'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="تحديث المعاينة"
                  onClick={() => doRun(false)}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <a
                  href={externalPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="فتح في تبويب متصفح مستقل"
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  title={previewFullscreen ? 'تصغير' : 'ملء الشاشة'}
                  onClick={() => setPreviewFullscreen((v) => !v)}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {previewFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  title="إغلاق المعاينة"
                  onClick={() => {
                    setPreviewFullscreen(false);
                    setPrefs((p) => ({ ...p, showPreview: false }));
                  }}
                  className="lg:hidden p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 p-2 sm:p-3 flex items-center justify-center overflow-auto bg-slate-200/70 dark:bg-[#090d16]">
              <iframe
                key={previewRev}
                title="Live Preview"
                sandbox="allow-scripts allow-modals"
                srcDoc={previewDoc || buildWebPreviewDoc(files, activeFile, true)}
                className="h-full bg-white rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm transition-all"
                style={{
                  width:
                    previewViewport === 'mobile'
                      ? '375px'
                      : previewViewport === 'tablet'
                        ? '768px'
                        : '100%',
                  maxWidth: '100%',
                }}
              />
            </div>
          </section>
        )}
      </div>

      {/* Quiet IDE Status Bar (auto-hides on mobile while typing or in Focus Mode) */}
      {!typingFullMobile && !focusMode && (
        <footer
          dir="ltr"
          className="h-7 shrink-0 flex items-center justify-between px-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">
              Ln {cursor.line}, Col {cursor.col}
              {cursor.selected > 0 ? ` (${cursor.selected} selected)` : ''}
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">·</span>
            <span className="hidden sm:inline">Spaces: {prefs.tabSize}</span>
            <span className="hidden md:inline text-slate-300 dark:text-slate-700">·</span>
            <span className="hidden md:inline">UTF-8</span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <LanguageIcon lang={activeLang} size={13} />
            <span className="truncate">{activeMeta.label}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
              Designed by{' '}
              <a
                href="https://mahmoud-smoky.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Mahmoud Medhat
              </a>
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">·</span>
            <span className="hidden sm:inline">Local IndexedDB</span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">·</span>
            <button
              type="button"
              title="عرض تقرير فحص وتقييم الكود (Code Review)"
              onClick={() => {
                setReviewOpen(true);
              }}
              className={`hover:text-slate-900 dark:hover:text-slate-100 ${
                problems.length > 0 ? 'text-amber-500 font-semibold' : ''
              }`}
            >
              Code Review: {problems.length} مشكلة
            </button>
          </div>
        </footer>
      )}

      {/* Non-intrusive floating toast notification */}
      {notice && (
        <div
          role="status"
          className="fixed bottom-10 left-4 z-50 px-3.5 py-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-medium pointer-events-none"
        >
          {notice}
        </div>
      )}

      {/* Modals & Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        files={files}
        onSelectFile={handleSelectFile}
        commands={paletteCommands}
      />
      <LanguagesModal
        open={languagesOpen}
        onClose={() => setLanguagesOpen(false)}
        onCreateLanguageFile={handleCreateLanguageFile}
      />
      <ExportProjectModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        projectName={projectName}
        onRenameProject={handleRenameProject}
        fileCount={Object.keys(files).length}
        onDownloadZip={handleDownloadZip}
        onDownloadJson={handleDownloadJson}
      />
      <TemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onLoadTemplate={handleLoadTemplate}
      />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CodeReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} files={files} onSelectFile={handleSelectFile} />
      <QuickOpenModal open={quickOpenOpen} onClose={() => setQuickOpenOpen(false)} files={files} onSelectFile={handleSelectFile} />
    </div>
  );
}
