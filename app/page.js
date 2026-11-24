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
  FolderArchive,
  Files,
  Layers,
  Settings,
  ChevronRight,
  Minus,
  Plus,
  GitBranch,
  SlidersHorizontal,
  Check,
  Columns2,
  Rows2,
  Globe,
  Copy,
} from 'lucide-react';
import EditorGroupPane from './components/EditorGroupPane';
import FileExplorer from './components/FileExplorer';
import LanguageIcon from './components/LanguageIcon';
import MobileCodeBar from './components/MobileCodeBar';
import CommandPalette from './components/CommandPalette';
import QuickOpenModal from './components/QuickOpenModal';
import IntegratedTerminal from './components/IntegratedTerminal';
import GitHubPushModal from './components/GitHubPushModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import {
  ExportProjectModal,
  LanguagesModal,
  ShortcutsModal,
  TemplatesModal,
  CodeReviewModal,
} from './components/IdeModals';
import { WORKSPACE_TEMPLATES, detectLang, getLangMeta } from './lib/workspaces';
import { diagnose, explainRuntimeError, formatCode } from './lib/diagnostics';
import { formatWithPrettier } from './lib/formatter';
import { buildWebPreviewDoc, isPyodideReady, runCode, runWorker } from './lib/runner';
import { I18nProvider } from './lib/LocaleContext';
import { createTranslator, getToggleLocale, normalizeLocale } from './lib/i18n';
import {
  buildProjectZip,
  clearGitHubLink,
  extractZipArchive,
  isMediaEntry,
  loadGitHubLink,
  loadProjectName,
  loadWorkspaceFiles,
  sanitizeProjectName,
  saveGitHubLink,
  saveProjectName,
  saveWorkspaceFiles,
} from './lib/storage';
import {
  buildGitHubSnapshot,
  computeGitHubChanges,
  getEntrySignature,
} from './lib/githubSync';
import {
  MAX_EDITOR_GROUPS,
  closeEditorGroup,
  closeTabInGroup,
  createInitialGroups,
  getActiveGroup,
  moveTabBetweenGroups,
  normalizeGroups,
  openFileInGroup,
  removeFileFromGroups,
  renameFileInGroups,
  splitEditorGroup,
} from './lib/editorGroups';

const STORAGE_FILES_LEGACY = 'codelab_ide_files_v1';
const STORAGE_TABS = 'codelab_ide_tabs_v1';
const STORAGE_ACTIVE = 'codelab_ide_active_v1';
const STORAGE_GROUPS = 'codelab_ide_groups_v1';
const STORAGE_ACTIVE_GROUP = 'codelab_ide_active_group_v1';
const STORAGE_SPLIT_DIR = 'codelab_ide_split_dir_v1';
const STORAGE_PREFS = 'codelab_ide_prefs_v1';

const DEFAULT_TPL = WORKSPACE_TEMPLATES[0];
const INITIAL_GROUP_STATE = createInitialGroups(
  [DEFAULT_TPL.entryFile, 'styles.css', 'app.js'],
  DEFAULT_TPL.entryFile
);

export default function CodeLabIDE() {
  const [files, setFiles] = useState(DEFAULT_TPL.files);
  const [editorGroups, setEditorGroups] = useState(INITIAL_GROUP_STATE.groups);
  const [activeGroupId, setActiveGroupId] = useState(INITIAL_GROUP_STATE.activeGroupId);
  const [splitDirection, setSplitDirection] = useState('horizontal'); // 'horizontal' | 'vertical'
  const [groupRatios, setGroupRatios] = useState(null);
  const [projectName, setProjectName] = useState('my-codelab-project');
  const [hydrated, setHydrated] = useState(false);

  const [prefs, setPrefs] = useState({
    theme: 'dark',
    locale: 'ar',
    fontSize: 14,
    tabSize: 2,
    wordWrap: false,
    autoRun: true,
    showExplorer: true,
    showPreview: true,
    showDock: false,
    showMobileBar: false,
    showMinimap: true,
  });

  const { locale, dir, dict, t } = useMemo(
    () => createTranslator(prefs.locale),
    [prefs.locale]
  );

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
  const [githubOpen, setGithubOpen] = useState(false);
  const [githubSessionToken, setGithubSessionToken] = useState(null);
  const [githubUser, setGithubUser] = useState(null);
  const [githubLink, setGithubLink] = useState(null);

  const githubChanges = useMemo(
    () => computeGitHubChanges(files, githubLink?.syncedSnapshot),
    [files, githubLink]
  );

  const editorApisRef = useRef({});
  const activeGroupIdRef = useRef(activeGroupId);
  activeGroupIdRef.current = activeGroupId;
  const splitContainerRef = useRef(null);
  const editorApiRef = useRef({
    openFind: () => editorApisRef.current[activeGroupIdRef.current]?.current?.openFind?.(),
    jumpToLine: (line) => editorApisRef.current[activeGroupIdRef.current]?.current?.jumpToLine?.(line),
    focus: () => editorApisRef.current[activeGroupIdRef.current]?.current?.focus?.(),
    blur: () => editorApisRef.current[activeGroupIdRef.current]?.current?.blur?.(),
    triggerAutocomplete: () => editorApisRef.current[activeGroupIdRef.current]?.current?.triggerAutocomplete?.(),
    undo: () => editorApisRef.current[activeGroupIdRef.current]?.current?.undo?.(),
    redo: () => editorApisRef.current[activeGroupIdRef.current]?.current?.redo?.(),
    toggleComment: () => editorApisRef.current[activeGroupIdRef.current]?.current?.toggleComment?.(),
    indent: () => editorApisRef.current[activeGroupIdRef.current]?.current?.indent?.(),
    moveCursor: (delta) => editorApisRef.current[activeGroupIdRef.current]?.current?.moveCursor?.(delta),
    insertSymbol: (sym) => editorApisRef.current[activeGroupIdRef.current]?.current?.insertSymbol?.(sym),
    insertSnippet: (tpl) => editorApisRef.current[activeGroupIdRef.current]?.current?.insertSnippet?.(tpl),
  });
  const noticeTimerRef = useRef(null);
  const settingsRef = useRef(null);
  const zipInputRef = useRef(null);

  const registerEditorApi = useCallback((groupId, ref) => {
    if (ref) {
      editorApisRef.current[groupId] = ref;
    } else {
      delete editorApisRef.current[groupId];
    }
  }, []);

  const activeGroup = useMemo(
    () => getActiveGroup(editorGroups, activeGroupId),
    [editorGroups, activeGroupId]
  );
  const activeFile = activeGroup.activeFile;

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2600);
  }, []);

  const handleSetLocale = useCallback(
    (nextLocale) => {
      const normalized = normalizeLocale(nextLocale);
      setPrefs((p) => ({ ...p, locale: normalized }));
      const nextTranslator = createTranslator(normalized);
      showNotice(nextTranslator.t('languageSwitchedNotice'));
    },
    [showNotice]
  );

  const handleToggleLocale = useCallback(() => {
    handleSetLocale(getToggleLocale(locale));
  }, [handleSetLocale, locale]);

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

        const savedGroupsRaw = localStorage.getItem(STORAGE_GROUPS);
        const savedActiveGroup = localStorage.getItem(STORAGE_ACTIVE_GROUP);
        const savedSplitDir = localStorage.getItem(STORAGE_SPLIT_DIR);
        const savedTabs = localStorage.getItem(STORAGE_TABS);
        const savedActive = localStorage.getItem(STORAGE_ACTIVE);
        const savedPrefs = localStorage.getItem(STORAGE_PREFS);
        const savedProj = loadProjectName();
        const savedGitHubLink = loadGitHubLink();

        if (!active) return;
        setProjectName(savedProj);
        if (savedGitHubLink) {
          setGithubLink(savedGitHubLink);
        }
        if (savedSplitDir === 'horizontal' || savedSplitDir === 'vertical') {
          setSplitDirection(savedSplitDir);
        }

        if (loadedFiles && typeof loadedFiles === 'object') {
          setFiles(loadedFiles);
          const keys = Object.keys(loadedFiles);
          if (keys.length > 0) {
            let candidateGroups = null;
            if (savedGroupsRaw) {
              try {
                const parsed = JSON.parse(savedGroupsRaw);
                if (Array.isArray(parsed) && parsed.length > 0) candidateGroups = parsed;
              } catch {}
            }
            if (!candidateGroups) {
              const validTabs = savedTabs ? JSON.parse(savedTabs).filter((t) => loadedFiles[t] !== undefined) : [];
              const fallbackTabs = validTabs.length ? validTabs : [keys[0]];
              const fallbackActive = savedActive && loadedFiles[savedActive] !== undefined ? savedActive : fallbackTabs[0];
              candidateGroups = createInitialGroups(fallbackTabs, fallbackActive).groups;
            }
            const normalized = normalizeGroups(candidateGroups, loadedFiles, savedActiveGroup);
            setEditorGroups(normalized.groups);
            setActiveGroupId(normalized.activeGroupId);
          } else {
            const emptyState = normalizeGroups([], {}, 'group-1');
            setEditorGroups(emptyState.groups);
            setActiveGroupId(emptyState.activeGroupId);
          }
        }

        const narrow = typeof window !== 'undefined' && window.innerWidth < 768;
        const tablet = typeof window !== 'undefined' && window.innerWidth < 1024;
        if (savedPrefs) {
          const parsedPrefs = JSON.parse(savedPrefs);
          setPrefs((prev) => ({
            ...prev,
            ...parsedPrefs,
            locale: normalizeLocale(parsedPrefs.locale),
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
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
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
        showNotice(t('githubConnectedNotice', event.data.user?.login || 'user'));
      } else if (event.data.type === 'GITHUB_OAUTH_ERROR') {
        showNotice(event.data.error || t('githubOAuthFailed'));
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [showNotice, t]);

  // Persist workspace locally in IndexedDB + lightweight metadata in localStorage
  useEffect(() => {
    if (!hydrated) return;
    saveWorkspaceFiles(files);
    try {
      localStorage.setItem(STORAGE_GROUPS, JSON.stringify(editorGroups));
      localStorage.setItem(STORAGE_ACTIVE_GROUP, activeGroupId);
      localStorage.setItem(STORAGE_SPLIT_DIR, splitDirection);
      localStorage.setItem(STORAGE_TABS, JSON.stringify(activeGroup.tabs));
      localStorage.setItem(STORAGE_ACTIVE, activeFile);
      localStorage.setItem(STORAGE_PREFS, JSON.stringify(prefs));
      saveProjectName(projectName);
    } catch {}
  }, [files, editorGroups, activeGroupId, splitDirection, activeGroup.tabs, activeFile, prefs, projectName, hydrated]);

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [prefs.theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dir;
    document.title = dict.docTitle;
  }, [locale, dir, dict.docTitle]);

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
      const diags = diagnose(content, l, locale);
      for (const d of diags) {
        list.push({ ...d, file: path });
      }
    }
    return list;
  }, [files, locale]);

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
        const lineStr = e.data.l ? t('lineSuffix', e.data.l) : '';
        appendLog('error', `${explainRuntimeError(e.data.m, locale)}${lineStr}`);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [appendLog, locale, t]);

  const doRun = useCallback(
    async (silent = false) => {
      if (!activeFile) return;
      const hasHtmlWorkspace = Object.keys(files).some((p) => /\.(html|htm)$/i.test(p));
      const usesDomOrUi =
        activeLang === 'jsx' ||
        activeLang === 'tsx' ||
        /document\.|window\.|export\s+default\s+|React|createRoot/.test(activeCode || '');
      const isWebEntry =
        activeIsMedia ||
        activeLang === 'html' ||
        activeLang === 'css' ||
        activeLang === 'scss' ||
        activeLang === 'svg' ||
        activeLang === 'markdown' ||
        ((activeLang === 'js' || activeLang === 'ts' || activeLang === 'jsx' || activeLang === 'tsx') &&
          (hasHtmlWorkspace || usesDomOrUi || prefs.showPreview));

      if (isWebEntry) {
        if (!silent) setConsoleLogs([]);
        const doc = buildWebPreviewDoc(files, activeFile, true, locale);
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
        if (!silent) showNotice(t('notRunnableNotice', activeFile, activeMeta.label));
        return;
      }

      if (!silent) {
        setFocusMode(false);
        editorApiRef.current?.blur();
      }

      const localDiags = diagnose(activeCode, activeLang, locale);
      if (localDiags.length) {
        setDockTab('problems');
        setPrefs((p) => ({ ...p, showDock: true }));
        appendLog('error', t('fileErrorsCheckProblems', localDiags.length, activeFile));
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
        appendLog('info', t('pyodideLoading'));
      }

      const res = await runCode(activeLang, activeCode, files, locale);
      setRunning(false);

      if (res.noRun || res.err) {
        appendLog('error', explainRuntimeError(res.err, locale));
        return;
      }
      const output = (res.out || '').trimEnd();
      if (output) {
        output.split('\n').forEach((line) => appendLog('output', line));
      } else {
        appendLog('info', t('executionFinishedNoOutput'));
      }
      if (res.stderr) {
        appendLog('warn', res.stderr);
      }
    },
    [activeFile, activeIsMedia, activeLang, activeCode, activeMeta.runnable, activeMeta.label, files, prefs.showPreview, appendLog, showNotice, locale, t]
  );

  // Initial preview & auto-run debounce for web/JS/TS/React/CSS/data projects (even without HTML)
  useEffect(() => {
    if (!hydrated) return;
    if (!prefs.autoRun && previewRev > 0) return;
    const isWebContext =
      activeIsMedia ||
      activeLang === 'html' ||
      activeLang === 'css' ||
      activeLang === 'scss' ||
      activeLang === 'svg' ||
      activeLang === 'markdown' ||
      activeLang === 'js' ||
      activeLang === 'ts' ||
      activeLang === 'jsx' ||
      activeLang === 'tsx' ||
      activeLang === 'json' ||
      prefs.showPreview;
    if (!isWebContext) return;

    const timer = setTimeout(() => {
      const doc = buildWebPreviewDoc(files, activeFile, true, locale);
      setPreviewDoc(doc);
      setPreviewRev((n) => n + 1);
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, activeFile, activeLang, activeIsMedia, prefs.autoRun, prefs.showPreview, hydrated, locale]);

  const handleSplitGroup = useCallback(
    (sourceGroupId, explicitFile) => {
      const targetId = sourceGroupId || activeGroupId;
      if (editorGroups.length >= MAX_EDITOR_GROUPS && !explicitFile) {
        showNotice(t('maxSplitNotice', MAX_EDITOR_GROUPS));
        return;
      }
      const res = splitEditorGroup(editorGroups, targetId, explicitFile, files);
      setEditorGroups(res.groups);
      setActiveGroupId(res.activeGroupId);
      if (res.didSplit) {
        setGroupRatios(null);
      }
    },
    [editorGroups, activeGroupId, files, showNotice, t]
  );

  const handleCloseGroup = useCallback(
    (groupId) => {
      const res = closeEditorGroup(editorGroups, groupId, activeGroupId);
      setEditorGroups(res.groups);
      setActiveGroupId(res.activeGroupId);
      setGroupRatios(null);
    },
    [editorGroups, activeGroupId]
  );

  const handleToggleSplitDirection = useCallback(() => {
    setSplitDirection((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
    setGroupRatios(null);
  }, []);

  const handleMoveActiveTab = useCallback(
    (groupId, path) => {
      const res = moveTabBetweenGroups(editorGroups, groupId, path, files);
      setEditorGroups(res.groups);
      setActiveGroupId(res.activeGroupId);
      setGroupRatios(null);
    },
    [editorGroups, files]
  );

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
      } else if (mod && e.key === '\\') {
        e.preventDefault();
        handleSplitGroup(activeGroupId);
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
        showNotice(t('savedLocallyNotice'));
      } else if (mod && e.key === 'Enter') {
        e.preventDefault();
        doRun(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doRun, showNotice, dockTab, handleSplitGroup, activeGroupId, t]);

  // File management handlers
  const handleSelectFile = useCallback(
    (path, targetGroupId) => {
      if (!path) return;
      const gid = targetGroupId || activeGroupId;
      setEditorGroups((prev) => openFileInGroup(prev, gid, path));
      if (targetGroupId) setActiveGroupId(targetGroupId);
    },
    [activeGroupId]
  );

  const handleSelectTab = useCallback((groupId, path) => {
    if (!path) return;
    setActiveGroupId(groupId);
    setEditorGroups((prev) => openFileInGroup(prev, groupId, path));
  }, []);

  const handleCloseTab = useCallback(
    (groupId, path) => {
      setEditorGroups((prev) => {
        const res = closeTabInGroup(prev, groupId, path, activeGroupId);
        if (res.activeGroupId !== activeGroupId) {
          setActiveGroupId(res.activeGroupId);
          setGroupRatios(null);
        } else if (res.groups.length !== prev.length) {
          setGroupRatios(null);
        }
        return res.groups;
      });
    },
    [activeGroupId]
  );

  const handleCreateFile = useCallback(
    (rawPath, initialContent) => {
      const clean = rawPath.trim().replace(/^\/+|\/+$/g, '');
      if (!clean) return;
      if (files[clean] !== undefined) {
        handleSelectFile(clean);
        showNotice(t('fileExistsNotice'));
        return;
      }
      const detected = detectLang(clean);
      const starter =
        initialContent !== undefined ? initialContent : getLangMeta(detected).starter || '';
      setFiles((prev) => ({ ...prev, [clean]: starter }));
      setEditorGroups((prev) => openFileInGroup(prev, activeGroupId, clean));
    },
    [files, activeGroupId, handleSelectFile, showNotice, t]
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
      setEditorGroups((prev) => openFileInGroup(prev, activeGroupId, baseName));
      showNotice(t('fileCreatedNotice', baseName, langMeta.label));
    },
    [files, activeGroupId, showNotice, t]
  );

  const handleRenameFile = useCallback(
    (oldPath, newPath) => {
      if (files[newPath] !== undefined) {
        showNotice(t('duplicateNameNotice'));
        return;
      }
      setFiles((prev) => {
        const next = { ...prev };
        next[newPath] = next[oldPath];
        delete next[oldPath];
        return next;
      });
      setEditorGroups((prev) => renameFileInGroups(prev, oldPath, newPath));
    },
    [files, showNotice, t]
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
      setEditorGroups((prev) => openFileInGroup(prev, activeGroupId, candidate));
    },
    [files, activeGroupId]
  );

  const handleDeleteFile = useCallback(
    (path) => {
      const remaining = { ...files };
      delete remaining[path];
      const keys = Object.keys(remaining);
      setFiles(remaining);
      setEditorGroups((prev) => {
        const res = removeFileFromGroups(prev, path, remaining, activeGroupId);
        setActiveGroupId(res.activeGroupId);
        if (res.groups.length !== prev.length) setGroupRatios(null);
        return res.groups;
      });
      if (keys.length === 0) {
        setPreviewDoc('');
        setPreviewRev((n) => n + 1);
        setConsoleLogs([]);
        showNotice(t('allFilesDeletedNotice'));
      }
    },
    [files, activeGroupId, showNotice, t]
  );

  const handleClearAllFiles = useCallback(() => {
    setFiles({});
    setEditorGroups([{ id: 'group-1', tabs: [], activeFile: '' }]);
    setActiveGroupId('group-1');
    setGroupRatios(null);
    setPreviewDoc('');
    setPreviewRev((n) => n + 1);
    setConsoleLogs([]);
    showNotice(t('allFilesDeletedNotice'));
  }, [showNotice, t]);

  const handleImportFiles = useCallback(
    (loaded, importedProjectName, meta) => {
      setFiles((prev) => ({ ...prev, ...loaded }));
      if (importedProjectName) {
        setProjectName(sanitizeProjectName(importedProjectName));
      }
      const importedNames = Object.keys(loaded);
      if (importedNames.length) {
        const entry =
          importedNames.find((p) => /^index\.html?$/i.test(p)) ||
          importedNames.find((p) => /\/index\.html?$/i.test(p)) ||
          importedNames.find((p) => /^(main|app|index)\.[^/]+$/i.test(p)) ||
          importedNames.find((p) => !isMediaEntry(loaded[p])) ||
          importedNames[0];
        setEditorGroups((prev) => {
          const targetId = prev.some((g) => g.id === activeGroupId) ? activeGroupId : prev[0]?.id || 'group-1';
          const next = prev.map((g) => {
            if (g.id !== targetId) return g;
            return {
              ...g,
              tabs: Array.from(new Set([...g.tabs, entry, ...importedNames.slice(0, 8)])),
              activeFile: entry,
            };
          });
          return next;
        });
        setPrefs((p) => ({ ...p, showExplorer: true }));
        showNotice(
          meta?.source === 'zip'
            ? t('zipImportedNotice', importedNames.length)
            : t('filesImportedNotice', importedNames.length)
        );
      }
    },
    [activeGroupId, showNotice, t]
  );

  const handleZipUpload = useCallback(
    async (fileList) => {
      const list = Array.from(fileList || []);
      if (!list.length) return;
      const merged = {};
      let projectTitle = null;
      for (const file of list) {
        try {
          const extracted = await extractZipArchive(file);
          if (extracted.count === 0) {
            showNotice(t('zipEmptyNotice', file.name));
            continue;
          }
          Object.assign(merged, extracted.files);
          if (extracted.projectName) projectTitle = extracted.projectName;
        } catch {
          showNotice(t('zipExtractFailedNotice', file.name));
        }
      }
      if (Object.keys(merged).length > 0) {
        handleImportFiles(merged, projectTitle, { source: 'zip' });
      }
    },
    [handleImportFiles, showNotice, t]
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
      setEditorGroups((prev) => openFileInGroup(prev, activeGroupId, htmlPath));
      showNotice(t('insertedIntoHtmlNotice', htmlPath));
    },
    [files, activeGroupId, showNotice, t]
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
      showNotice(t('projectDownloadedNotice', `${safe}.zip`));
    },
    [files, projectName, showNotice, t]
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
      showNotice(t('projectDownloadedNotice', `${safe}.codelab.json`));
    },
    [files, projectName, showNotice, t]
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
      showNotice(t('savedLocalFileNotice', handle.name));
    } catch (err) {
      if (err?.name !== 'AbortError') {
        handleDownloadActive();
      }
    }
  }, [activeFile, activeIsMedia, activeCode, handleDownloadActive, showNotice, t]);

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
      setEditorGroups((prev) => openFileInGroup(prev, activeGroupId, fileName));
      showNotice(t('openedLocalFileNotice', fileName));
    } catch (err) {
      if (err?.name !== 'AbortError') {
        document.getElementById('codelab-local-file-input')?.click();
      }
    }
  }, [activeGroupId, showNotice, t]);

  const handleFormat = useCallback(async () => {
    if (!activeFile || activeIsMedia) return;
    try {
      const formatted = await formatWithPrettier(activeCode, activeFile);
      setFiles((prev) => ({ ...prev, [activeFile]: formatted }));
      showNotice(t('formattedPrettierNotice'));
    } catch (err) {
      try {
        const formatted = formatCode(activeCode, activeLang, prefs.tabSize);
        setFiles((prev) => ({ ...prev, [activeFile]: formatted }));
        showNotice(t('formattedBasicNotice'));
      } catch {
        showNotice(t('formatErrorSyntaxNotice'));
      }
    }
  }, [activeFile, activeIsMedia, activeCode, activeLang, prefs.tabSize, showNotice, t]);

  const handleLoadTemplate = useCallback(
    (tpl) => {
      setFiles({ ...tpl.files });
      const initial = createInitialGroups(Object.keys(tpl.files), tpl.entryFile);
      setEditorGroups(initial.groups);
      setActiveGroupId(initial.activeGroupId);
      setGroupRatios(null);
      setConsoleLogs([]);
      clearGitHubLink();
      setGithubLink(null);
      const isWeb = tpl.id === 'web-app';
      setFocusMode(false);
      setPrefs((p) => ({ ...p, showPreview: isWeb && !isMobile, showDock: false }));
      const localizedTplName = dict.templates?.[tpl.id]?.name || tpl.name;
      showNotice(t('templateLoadedNotice', localizedTplName));
    },
    [isMobile, showNotice, dict, t]
  );

  const handleConnectGitHub = useCallback(async () => {
    try {
      const res = await fetch('/api/github/auth');
      const data = await res.json();
      if (!data?.configured || !data?.url) {
        setGithubOpen(true);
        showNotice(t('githubAddKeys'));
        return;
      }
      const popup = window.open(data.url, 'github_oauth_popup', 'width=600,height=700');
      if (!popup) {
        showNotice(t('githubAllowPopups'));
      }
    } catch {
      showNotice(t('githubLoginFailed'));
    }
  }, [showNotice, t]);

  const handleDisconnectGitHub = useCallback(() => {
    setGithubSessionToken(null);
    setGithubUser(null);
    showNotice(t('githubDisconnected'));
  }, [showNotice, t]);

  const handleLinkRepository = useCallback(
    (linkInfo) => {
      if (!linkInfo?.fullName) return;
      saveGitHubLink(linkInfo);
      setGithubLink(linkInfo);
      showNotice(t('githubLinkedNotice', linkInfo.fullName, linkInfo.branch || 'main'));
    },
    [showNotice, t]
  );

  const handlePullRepository = useCallback(
    (linkInfo, pulledFiles) => {
      const nextFiles = pulledFiles && typeof pulledFiles === 'object' ? pulledFiles : {};
      const keys = Object.keys(nextFiles);
      setFiles(nextFiles);

      if (keys.length > 0) {
        const entry =
          keys.find((p) => /^index\.html?$/i.test(p)) ||
          keys.find((p) => /^(main|app|index)\.[^/]+$/i.test(p)) ||
          keys.find((p) => !isMediaEntry(nextFiles[p])) ||
          keys[0];
        const initialTabs = Array.from(new Set([entry, ...keys.slice(0, 6)]));
        const initial = createInitialGroups(initialTabs, entry);
        setEditorGroups(initial.groups);
        setActiveGroupId(initial.activeGroupId);
      } else {
        const emptyState = normalizeGroups([], {}, 'group-1');
        setEditorGroups(emptyState.groups);
        setActiveGroupId(emptyState.activeGroupId);
      }
      setGroupRatios(null);

      if (linkInfo?.name) {
        setProjectName(sanitizeProjectName(linkInfo.name));
      }
      if (linkInfo?.fullName) {
        saveGitHubLink(linkInfo);
        setGithubLink(linkInfo);
      }
      showNotice(t('githubPulledNotice', keys.length, linkInfo?.fullName || 'GitHub'));
    },
    [showNotice, t]
  );

  const handleUnlinkRepository = useCallback(() => {
    clearGitHubLink();
    setGithubLink(null);
    showNotice(t('githubUnlinkedNotice'));
  }, [showNotice, t]);

  const handleChangeLinkedBranch = useCallback((nextBranch) => {
    if (!nextBranch) return;
    setGithubLink((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, branch: nextBranch };
      saveGitHubLink(updated);
      return updated;
    });
  }, []);

  const handleGitHubPushSuccess = useCallback(
    (data) => {
      const prevSnapshot = { ...(githubLink?.syncedSnapshot || {}) };
      const pushedItems = Array.isArray(data?.pushedItems) ? data.pushedItems : [];

      if (pushedItems.length > 0) {
        for (const item of pushedItems) {
          if (item.status === 'deleted') {
            delete prevSnapshot[item.path];
          } else if (files[item.path] !== undefined) {
            prevSnapshot[item.path] = getEntrySignature(files[item.path]);
          }
        }
      } else {
        Object.assign(prevSnapshot, buildGitHubSnapshot(files));
      }

      if (data?.fullName || githubLink?.fullName) {
        const nextLink = {
          fullName: data?.fullName || githubLink.fullName,
          owner: data?.owner || githubLink?.owner,
          name: data?.repo || githubLink?.name,
          branch: data?.branch || githubLink?.branch || 'main',
          private: Boolean(data?.private ?? githubLink?.private),
          htmlUrl: data?.repoUrl || githubLink?.htmlUrl,
          lastCommitSha: data?.commitSha || githubLink?.lastCommitSha || null,
          lastSyncedAt: new Date().toISOString(),
          syncedSnapshot: prevSnapshot,
        };
        saveGitHubLink(nextLink);
        setGithubLink(nextLink);
      }

      const changedCount =
        (data?.filesCount || 0) + (data?.deletedCount || 0) ||
        pushedItems.length ||
        Object.keys(files).length;
      showNotice(t('uploadSuccess', changedCount));
    },
    [files, githubLink, showNotice, t]
  );

  const handleUpdateFilesFromTerminal = useCallback(
    (nextFiles) => {
      setFiles(nextFiles);
      setEditorGroups((prev) => {
        const res = normalizeGroups(prev, nextFiles, activeGroupId);
        setActiveGroupId(res.activeGroupId);
        return res.groups;
      });
    },
    [activeGroupId]
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
    const doc = buildWebPreviewDoc(files, activeFile, true, locale);
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
  }, [files, activeFile, locale]);

  const handleEditorGroupFocusChange = useCallback((groupId, focused) => {
    if (focused) {
      setActiveGroupId(groupId);
    }
    setEditorFocused(focused);
    if (focused && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setPrefs((p) =>
        p.showExplorer || p.showPreview
          ? { ...p, showExplorer: false, showPreview: false }
          : p
      );
    }
  }, []);

  const handleEditorGroupCursorChange = useCallback((groupId, nextCursor) => {
    if (groupId === activeGroupIdRef.current) {
      setCursor(nextCursor);
    }
  }, []);

  const handleFileContentChange = useCallback((path, val) => {
    setFiles((prev) => ({ ...prev, [path]: val }));
  }, []);

  const startSplitResize = useCallback(
    (dividerIdx, e) => {
      e.preventDefault();
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const totalSize = splitDirection === 'horizontal' ? rect.width : rect.height;
      if (!totalSize) return;

      const count = editorGroups.length;
      const initialRatios =
        groupRatios && groupRatios.length === count
          ? [...groupRatios]
          : Array.from({ length: count }, () => 100 / count);

      const startPos = splitDirection === 'horizontal' ? e.clientX : e.clientY;
      const combined = initialRatios[dividerIdx] + initialRatios[dividerIdx + 1];
      const minPct = Math.min(20, combined / 2);

      const onMove = (ev) => {
        const curPos = splitDirection === 'horizontal' ? ev.clientX : ev.clientY;
        const deltaPct = ((curPos - startPos) / totalSize) * 100;
        const nextLeft = Math.min(combined - minPct, Math.max(minPct, initialRatios[dividerIdx] + deltaPct));
        const nextRight = combined - nextLeft;
        const updated = [...initialRatios];
        updated[dividerIdx] = nextLeft;
        updated[dividerIdx + 1] = nextRight;
        setGroupRatios(updated);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [splitDirection, editorGroups.length, groupRatios]
  );

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
    if (res.err) appendLog('error', explainRuntimeError(res.err, locale));
    else if (res.out) res.out.trimEnd().split('\n').forEach((l) => appendLog('output', l));
  };

  const [localPreviewUrl, setLocalPreviewUrl] = useState('#');

  useEffect(() => {
    if (!hydrated) return;
    try {
      const isWebEntry =
        activeIsMedia ||
        activeLang === 'html' ||
        activeLang === 'css' ||
        activeLang === 'scss' ||
        activeLang === 'svg' ||
        activeLang === 'markdown' ||
        activeLang === 'js' ||
        activeLang === 'ts' ||
        activeLang === 'jsx' ||
        activeLang === 'tsx' ||
        activeLang === 'json';

      let url = '#';
      if (isWebEntry) {
        const doc = previewDoc || buildWebPreviewDoc(files, activeFile, true, locale);
        const cleanHtml = doc.replace(/<script>\(\(\)=>\{[\s\S]*?<\/script>/, '');
        url = URL.createObjectURL(new Blob([cleanHtml], { type: 'text/html' }));
      } else {
        const html = `<!DOCTYPE html>
<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>CodeLab Local Preview — ${activeFile || 'Project'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; background: #1e1e1e; color: #d4d4d4; margin: 0; padding: 32px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { font-size: 20px; color: #4ec9b0; margin: 0; display: flex; align-items: center; gap: 8px; }
    .badge { background: #007acc; color: #fff; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-family: monospace; }
    .card { background: #252526; border: 1px solid #3c3c3c; border-radius: 6px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    h3 { font-size: 14px; color: #9cdcfe; margin-top: 0; margin-bottom: 10px; }
    pre { background: #1e1e1e; color: #ce9178; padding: 16px; border-radius: 4px; border: 1px solid #333; overflow-x: auto; font-family: ui-monospace, monospace; font-size: 13px; line-height: 1.5; margin: 0; }
    .footer { font-size: 12px; color: #858585; text-align: center; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="header">
    <h1><span>⚡ CodeLab Local Preview Sandbox</span></h1>
    <span class="badge">${activeFile || 'untitled'} (${activeLang.toUpperCase()})</span>
  </div>
  <div class="card">
    <h3>Active File Source Code:</h3>
    <pre>${(activeCode || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>
  <div class="card">
    <h3>Local Execution & Testing Status:</h3>
    <pre style="color: #4ec9b0;">✔ Local preview URL generated successfully.\n✔ Language: ${activeLang.toUpperCase()}\n✔ To execute code and run live terminal outputs, use CodeLab IDE Run & Debug button (Ctrl+Enter).</pre>
  </div>
  <div class="footer">
    Generated locally by CodeLab Pro IDE — Offline Browser Development Environment
  </div>
</body>
</html>`;
        url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      }
      setLocalPreviewUrl(url);
      return () => {
        if (url && url !== '#') {
          URL.revokeObjectURL(url);
        }
      };
    } catch {
      setLocalPreviewUrl('#');
    }
  }, [hydrated, previewDoc, activeLang, activeCode, activeFile, files, activeIsMedia, locale]);

  const paletteCommands = useMemo(
    () => [
      { id: 'run', label: t('cmdRun'), shortcut: 'Ctrl+Enter', action: () => doRun(false) },
      { id: 'focus', label: focusMode ? t('cmdFocusExit') : t('cmdFocusEnter'), shortcut: 'Ctrl+Shift+F', action: () => setFocusMode((v) => !v) },
      { id: 'new-lang', label: t('cmdNewLang'), shortcut: '', action: () => setLanguagesOpen(true) },
      { id: 'import-zip', label: t('cmdImportZip'), shortcut: '', action: () => zipInputRef.current?.click() },
      { id: 'github-push', label: t('cmdGithubPush'), shortcut: '', action: () => setGithubOpen(true) },
      { id: 'export-project', label: t('cmdExportProject'), shortcut: '', action: () => setExportOpen(true) },
      { id: 'format', label: t('cmdFormat'), shortcut: 'Toolbar', action: handleFormat },
      { id: 'find', label: t('cmdFind'), shortcut: 'Ctrl+F', action: () => editorApiRef.current?.openFind() },
      {
        id: 'explorer',
        label: prefs.showExplorer ? t('cmdHideExplorer') : t('cmdShowExplorer'),
        shortcut: 'Ctrl+B',
        action: toggleExplorer,
      },
      {
        id: 'terminal',
        label: t('cmdOpenTerminal'),
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
        label: prefs.showDock ? t('cmdHideDock') : t('cmdShowDock'),
        shortcut: 'Ctrl+J',
        action: toggleDock,
      },
      {
        id: 'preview',
        label: prefs.showPreview ? t('cmdHidePreview') : t('cmdShowPreview'),
        shortcut: '',
        action: togglePreview,
      },
      {
        id: 'mobilebar',
        label: prefs.showMobileBar ? t('cmdHideMobileBar') : t('cmdShowMobileBar'),
        shortcut: '',
        action: () => setPrefs((p) => ({ ...p, showMobileBar: !p.showMobileBar })),
      },
      {
        id: 'wrap',
        label: prefs.wordWrap ? t('cmdDisableWrap') : t('cmdEnableWrap'),
        shortcut: '',
        action: () => setPrefs((p) => ({ ...p, wordWrap: !p.wordWrap })),
      },
      {
        id: 'minimap',
        label: prefs.showMinimap !== false ? t('cmdHideMinimap') : t('cmdShowMinimap'),
        shortcut: '',
        action: () => setPrefs((p) => ({ ...p, showMinimap: p.showMinimap === false })),
      },
      {
        id: 'theme',
        label: prefs.theme === 'dark' ? t('cmdLightTheme') : t('cmdDarkTheme'),
        shortcut: '',
        action: () => setPrefs((p) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' })),
      },
      {
        id: 'switch-language',
        label: t('cmdSwitchLanguage'),
        shortcut: '',
        action: handleToggleLocale,
      },
      {
        id: 'split-editor',
        label: t('cmdSplitEditor'),
        shortcut: 'Ctrl+\\',
        action: () => handleSplitGroup(activeGroupId),
      },
      ...(editorGroups.length > 1
        ? [
            {
              id: 'toggle-split-dir',
              label:
                splitDirection === 'horizontal'
                  ? t('cmdToggleSplitVertical')
                  : t('cmdToggleSplitHorizontal'),
              shortcut: '',
              action: handleToggleSplitDirection,
            },
            {
              id: 'close-split-group',
              label: t('cmdCloseSplitGroup'),
              shortcut: '',
              action: () => handleCloseGroup(activeGroupId),
            },
          ]
        : []),
      { id: 'quick-open', label: t('cmdQuickOpen'), shortcut: 'Ctrl+P', action: () => setQuickOpenOpen(true) },
      { id: 'shortcuts', label: t('cmdShortcuts'), shortcut: '', action: () => setShortcutsOpen(true) },
      { id: 'review', label: t('cmdReview'), shortcut: '', action: () => setReviewOpen(true) },
    ],
    [t, doRun, focusMode, handleFormat, prefs.showExplorer, prefs.showDock, prefs.showPreview, prefs.showMobileBar, prefs.wordWrap, prefs.showMinimap, prefs.theme, toggleExplorer, toggleDock, togglePreview, handleToggleLocale, handleSplitGroup, handleToggleSplitDirection, handleCloseGroup, activeGroupId, editorGroups.length, splitDirection, setReviewOpen, setQuickOpenOpen]
  );

  const typingFullMobile = isMobile && editorFocused;
  const showHeaderFull = !typingFullMobile && !focusMode;
  const showToolbar = !typingFullMobile && !focusMode;
  const showExplorerPane = prefs.showExplorer && !focusMode && !typingFullMobile;
  const showPreviewPane = prefs.showPreview && !focusMode && !typingFullMobile;
  const showDockPane = prefs.showDock && !focusMode && !typingFullMobile;

  return (
    <I18nProvider locale={locale}>
    <div
      dir={dir}
      lang={locale}
      className="h-[100dvh] flex flex-col bg-white text-[#1e1e1e] dark:bg-[#1e1e1e] dark:text-[#cccccc] overflow-hidden"
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
    >
      {/* Distraction-free slim writing bar (mobile typing OR desktop focus mode) */}
      {(typingFullMobile || focusMode) && (
        <div className="h-10 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-[#e5e5e5] dark:border-[#2b2b2b] bg-[#f3f3f3] dark:bg-[#252526]">
          <div className="flex items-center gap-2 min-w-0">
            <LanguageIcon lang={activeLang} size={17} />
            <span className="text-xs font-mono font-medium text-[#1e1e1e] dark:text-[#cccccc] truncate" dir="ltr">
              {activeFile || projectName}
            </span>
            <span className="hidden sm:inline text-[11px] text-[#717171] dark:text-[#858585] shrink-0">· {activeMeta.label}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {focusMode ? (
              <button
                type="button"
                onClick={() => setFocusMode(false)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium bg-[#e4e4e4] dark:bg-[#3c3c3c] text-[#1e1e1e] dark:text-[#cccccc] hover:bg-[#d4d4d4] dark:hover:bg-[#4a4a4a]"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>{t('exitFocus')}</span>
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorApiRef.current?.blur()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium bg-[#e4e4e4] dark:bg-[#3c3c3c] text-[#1e1e1e] dark:text-[#cccccc]"
              >
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t('done')}</span>
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => doRun(false)}
              disabled={running}
              title={t('vscodeRun')}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-sm text-xs font-medium bg-[#0e639c] hover:bg-[#1177bb] border border-[#005fb8]/60 text-white disabled:opacity-60 shadow-sm"
            >
              <Play className="w-3 h-3 fill-current text-white/90" />
              <span>{running ? t('runningShort') : t('run')}</span>
            </button>
          </div>
        </div>
      )}

      {/* VS Code Title Bar */}
      {showHeaderFull && (
      <header className="h-10 shrink-0 flex items-center justify-between gap-4 sm:gap-6 px-3 sm:px-4 border-b border-[#d4d4d4] dark:border-[#2b2b2b] bg-[#dddddd] dark:bg-[#323233]">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <img
            src="/codelab-logo.png"
            alt={t('brandName')}
            className="w-6 h-6 rounded-md object-cover shrink-0 shadow-sm ring-1 ring-white/10"
          />
          <span className="text-sm font-bold tracking-tight text-[#1e1e1e] dark:text-[#cccccc]">
            {t('brandName')}
          </span>
          <span className="hidden md:inline text-[11px] font-mono text-[#616161] dark:text-[#8c8c8c]" dir="ltr">
            — {projectName}
          </span>
        </div>

        <nav className="flex items-center gap-3.5 sm:gap-5 text-xs font-medium text-[#333333] dark:text-[#cccccc] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => editorApiRef.current?.focus()}
            className="hover:text-[#000000] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            {t('navEditor')}
          </button>
          <button
            type="button"
            onClick={() => setLanguagesOpen(true)}
            className="hover:text-[#000000] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            {t('navLanguages')}
          </button>
          <button
            type="button"
            onClick={() => setTemplatesOpen(true)}
            className="hover:text-[#000000] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            {t('navTemplates')}
          </button>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            className="hover:text-[#000000] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            {t('navShortcuts')}
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => doRun(false)}
            disabled={running}
            title={t('vscodeRun')}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 rounded-sm text-xs font-medium bg-[#0e639c] hover:bg-[#1177bb] border border-[#005fb8]/60 text-white disabled:opacity-60 transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current text-white/90" />
            <span>{running ? t('running') : t('run')}</span>
          </button>
        </div>
      </header>
      )}

      {/* Consolidated IDE Workspace Toolbar */}
      {showToolbar && (
      <div className="relative h-10 shrink-0 flex items-center justify-between gap-2 px-2.5 sm:px-3.5 border-b border-[#e5e5e5] dark:border-[#2b2b2b] bg-[#ececec] dark:bg-[#252526]">
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
          {/* Group 1: Workspace Panels */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              title={t('filesPanelTitle')}
              onClick={toggleExplorer}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 ${
                prefs.showExplorer
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('filesPanel')}</span>
            </button>

            <button
              type="button"
              title={t('terminalPanelTitle')}
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
              <span className="hidden sm:inline">{t('terminalPanel')}</span>
            </button>

            <button
              type="button"
              title={t('previewPanelTitle')}
              onClick={togglePreview}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 ${
                prefs.showPreview
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('previewPanel')}</span>
            </button>

            <button
              type="button"
              title={t('focusPanelTitle')}
              onClick={() => setFocusMode(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 whitespace-nowrap shrink-0"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t('focusPanel')}</span>
            </button>
          </div>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

          {/* Group 2: Project Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              title={t('newLangTitle')}
              onClick={() => setLanguagesOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 whitespace-nowrap shrink-0"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t('newLangBtn')}</span>
            </button>

            <button
              type="button"
              title={t('importZipTitle')}
              onClick={() => zipInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 whitespace-nowrap shrink-0"
            >
              <FolderArchive className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden md:inline">{t('importZipBtn')}</span>
            </button>

            <button
              type="button"
              title={t('exportProjectTitle')}
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 whitespace-nowrap shrink-0"
            >
              <FolderDown className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t('exportProjectBtn')}</span>
            </button>

            <button
              type="button"
              data-testid="toolbar-github-btn"
              title={
                githubLink
                  ? t('githubLinkedTitle', githubLink.fullName, githubLink.branch, githubChanges.totalChanges)
                  : t('githubBtnTitle')
              }
              onClick={() => setGithubOpen(true)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap shrink-0 transition-colors ${
                githubLink
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden md:inline">{t('githubBtn')}</span>
              {githubLink && githubChanges.totalChanges > 0 && (
                <span
                  data-testid="toolbar-github-badge"
                  className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono tabular-nums font-bold"
                >
                  {githubChanges.totalChanges}
                </span>
              )}
            </button>

          </div>

          <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5 shrink-0" />

          {/* Group 3: Quick Code Tools */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              title={t('findTitle')}
              onClick={() => editorApiRef.current?.openFind()}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('findBtn')}</span>
            </button>

            <button
              type="button"
              title={t('formatTitle')}
              onClick={handleFormat}
              disabled={activeIsMedia}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('formatBtn')}</span>
            </button>

            <button
              type="button"
              title={t('splitScreenTitle')}
              onClick={() => handleSplitGroup(activeGroupId)}
              disabled={Object.keys(files).length === 0 || editorGroups.length >= MAX_EDITOR_GROUPS}
              className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 ${
                editorGroups.length > 1
                  ? 'bg-[#007acc]/15 text-[#005fb8] dark:text-[#4fc1ff] font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              {splitDirection === 'vertical' ? (
                <Rows2 className="w-3.5 h-3.5" />
              ) : (
                <Columns2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden lg:inline">{t('splitScreenBtn')}</span>
            </button>
          </div>
        </div>

        {/* Trailing Controls: Language Switcher + Editor Settings Popover + Theme Toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="locale-toggle-btn"
            title={t('langSwitchTitle')}
            onClick={handleToggleLocale}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 whitespace-nowrap shrink-0 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-sky-500" />
            <span>{t('langSwitchLabel')}</span>
          </button>

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              title={t('editorSettingsTitle')}
              onClick={() => setSettingsOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 ${
                settingsOpen
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('editorSettings')}</span>
            </button>

            {settingsOpen && (
              <div className="absolute end-0 top-full mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-xl p-3 z-50 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{t('editorSettings')}</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    <LanguageIcon lang={activeLang} size={14} />
                    <span>{activeMeta.label}</span>
                  </span>
                </div>

                {/* Interface Language */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">{t('interfaceLanguage')}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSetLocale('ar')}
                      className={`px-2 py-1 rounded-md text-xs transition-colors ${
                        locale === 'ar'
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {t('arabicLabel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetLocale('en')}
                      className={`px-2 py-1 rounded-md text-xs transition-colors ${
                        locale === 'en'
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {t('englishLabel')}
                    </button>
                  </div>
                </div>

                {/* Font size */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">{t('fontSize')}</span>
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
                  <span className="text-slate-600 dark:text-slate-300">{t('tabSize')}</span>
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
                      <span>{t('wordWrap')}</span>
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
                        <span>{t('autoRun')}</span>
                      </span>
                      {prefs.autoRun && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, showMinimap: p.showMinimap === false }))}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('minimapSetting')}</span>
                    </span>
                    {prefs.showMinimap !== false && <Check className="w-3.5 h-3.5 text-sky-500" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, showMobileBar: !p.showMobileBar }))}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('mobileBarSetting')}</span>
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
                      <span>{t('commandPalette')}</span>
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
                      <span>{t('downloadCurrentFile')}</span>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            title={prefs.theme === 'dark' ? t('lightThemeTitle') : t('darkThemeTitle')}
            onClick={() => setPrefs((p) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }))}
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/60 shrink-0"
          >
            {prefs.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
      )}

      {/* Main VS Code IDE Workspace */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {/* VS Code Activity Bar */}
        {!typingFullMobile && !focusMode && (
          <aside
            aria-label={t('activityBarAria')}
            className="hidden md:flex w-11 shrink-0 flex-col items-center justify-between py-1.5 bg-[#2c2c2c] dark:bg-[#333333] text-[#858585] select-none border-e border-[#e5e5e5] dark:border-[#252526]"
          >
            <div className="flex flex-col items-center w-full gap-1">
              <button
                type="button"
                title={t('filesPanelTitle')}
                onClick={toggleExplorer}
                className={`relative w-full h-10 flex items-center justify-center transition-colors ${
                  prefs.showExplorer ? 'text-white' : 'hover:text-white'
                }`}
              >
                {prefs.showExplorer && (
                  <span className="absolute start-0 inset-y-1.5 w-0.5 bg-white rounded-e" />
                )}
                <Files className="w-5 h-5" />
              </button>

              <button
                type="button"
                title={t('quickOpenTitle')}
                onClick={() => setQuickOpenOpen(true)}
                className="w-full h-10 flex items-center justify-center hover:text-white transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                type="button"
                title={t('chooseLangTitle')}
                onClick={() => setLanguagesOpen(true)}
                className="w-full h-10 flex items-center justify-center hover:text-white transition-colors"
              >
                <Languages className="w-5 h-5" />
              </button>

              <button
                type="button"
                title={t('templatesTitle')}
                onClick={() => setTemplatesOpen(true)}
                className="w-full h-10 flex items-center justify-center hover:text-white transition-colors"
              >
                <Layers className="w-5 h-5" />
              </button>

              <button
                type="button"
                title={t('integratedTerminalTitle')}
                onClick={() => {
                  setDockTab('terminal');
                  toggleDock();
                }}
                className={`relative w-full h-10 flex items-center justify-center transition-colors ${
                  prefs.showDock ? 'text-white' : 'hover:text-white'
                }`}
              >
                {prefs.showDock && (
                  <span className="absolute start-0 inset-y-1.5 w-0.5 bg-white rounded-e" />
                )}
                <Terminal className="w-5 h-5" />
              </button>

              <button
                type="button"
                title={t('problemsReviewTitle')}
                onClick={() => setReviewOpen(true)}
                className="relative w-full h-10 flex items-center justify-center hover:text-white transition-colors"
              >
                <AlertTriangle className="w-5 h-5" />
                {problems.length > 0 && (
                  <span className="absolute top-1.5 end-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#007acc] text-white text-[10px] font-mono leading-4 text-center">
                    {problems.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                data-testid="activity-github-btn"
                title={t('sourceControlTitle')}
                onClick={() => setGithubOpen(true)}
                className={`relative w-full h-10 flex items-center justify-center transition-colors ${
                  githubOpen ? 'text-white' : 'hover:text-white'
                }`}
              >
                {githubOpen && (
                  <span className="absolute start-0 inset-y-1.5 w-0.5 bg-white rounded-e" />
                )}
                <GitBranch className="w-5 h-5" />
                {githubLink && githubChanges.totalChanges > 0 && (
                  <span
                    data-testid="activity-github-badge"
                    className="absolute top-1.5 end-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] font-mono leading-4 text-center"
                  >
                    {githubChanges.totalChanges}
                  </span>
                )}
              </button>
            </div>

            <div className="flex flex-col items-center w-full gap-1">
              <button
                type="button"
                title={t('commandPaletteTitle')}
                onClick={() => setPaletteOpen(true)}
                className="w-full h-10 flex items-center justify-center hover:text-white transition-colors"
              >
                <Command className="w-5 h-5" />
              </button>
              <button
                type="button"
                title={t('activitySettingsTitle')}
                onClick={() => setSettingsOpen((v) => !v)}
                className={`w-full h-10 flex items-center justify-center transition-colors ${
                  settingsOpen ? 'text-white' : 'hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </aside>
        )}

        {/* File Explorer Sidebar (drawer on mobile/tablet with backdrop) */}
        {showExplorerPane && (
          <>
            <div
              onClick={() => setPrefs((p) => ({ ...p, showExplorer: false }))}
              className="fixed inset-0 z-20 bg-slate-950/50 md:hidden"
            />
            <div className="absolute inset-y-0 start-0 z-30 flex md:static md:z-auto shadow-xl md:shadow-none max-w-[85vw]">
              <FileExplorer
                files={files}
                activeFile={activeFile}
                projectName={projectName}
                gitStatusMap={githubLink ? githubChanges.statusMap : undefined}
                onRenameProject={handleRenameProject}
                onSelectFile={(p) => {
                  handleSelectFile(p);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setPrefs((prev) => ({ ...prev, showExplorer: false }));
                  }
                }}
                onOpenFileToSide={(p) => {
                  handleSplitGroup(activeGroupId, p);
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
                onImportError={showNotice}
                onExportWorkspace={() => setExportOpen(true)}
                onClearAllFiles={handleClearAllFiles}
                onOpenLocalFile={handleOpenLocalFile}
                onSaveLocalFile={handleSaveLocalFile}
              />
            </div>
          </>
        )}

        {/* Center Editor Groups (Split-Screen Ready) + Bottom Output/Console + Mobile Coding Bar */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-[#1e1e1e]">
          <div
            ref={splitContainerRef}
            dir="ltr"
            className={`flex-1 min-h-0 flex ${
              splitDirection === 'vertical' ? 'flex-col' : 'flex-row'
            } overflow-hidden`}
          >
            {editorGroups.map((group, idx) => {
              const hasCustomRatio =
                editorGroups.length > 1 &&
                groupRatios &&
                groupRatios.length === editorGroups.length;
              const paneStyle = hasCustomRatio
                ? { flex: `0 0 ${groupRatios[idx]}%` }
                : undefined;

              return (
                <div
                  key={group.id}
                  className="contents"
                >
                  <div
                    style={paneStyle}
                    className={`${
                      hasCustomRatio ? '' : 'flex-1'
                    } min-w-0 min-h-0 flex overflow-hidden`}
                  >
                    <EditorGroupPane
                      group={group}
                      groupIndex={idx}
                      totalGroups={editorGroups.length}
                      isFocusedGroup={group.id === activeGroup.id}
                      splitDirection={splitDirection}
                      files={files}
                      projectName={projectName}
                      theme={prefs.theme}
                      fontSize={prefs.fontSize}
                      tabSize={prefs.tabSize}
                      wordWrap={prefs.wordWrap}
                      showMinimap={prefs.showMinimap !== false}
                      typingFullMobile={typingFullMobile}
                      onFocusGroup={setActiveGroupId}
                      onSelectTab={handleSelectTab}
                      onCloseTab={handleCloseTab}
                      onSplitGroup={(gid) => handleSplitGroup(gid)}
                      onToggleSplitDirection={handleToggleSplitDirection}
                      onCloseGroup={handleCloseGroup}
                      onMoveActiveTab={handleMoveActiveTab}
                      onFileChange={handleFileContentChange}
                      onCursorChange={handleEditorGroupCursorChange}
                      onEditorFocusChange={handleEditorGroupFocusChange}
                      onRegisterEditorApi={registerEditorApi}
                      onRunShortcut={() => doRun(false)}
                      onInsertIntoHtml={handleInsertIntoHtml}
                      onOpenQuickOpen={() => setQuickOpenOpen(true)}
                      onOpenLanguages={() => setLanguagesOpen(true)}
                      onOpenTemplates={() => setTemplatesOpen(true)}
                      onOpenZip={() => zipInputRef.current?.click()}
                      onSelectFirstFile={(gid) => {
                        const first = Object.keys(files)[0];
                        if (first) handleSelectFile(first, gid);
                      }}
                    />
                  </div>
                  {idx < editorGroups.length - 1 && (
                    <div
                      role="separator"
                      aria-orientation={splitDirection === 'vertical' ? 'horizontal' : 'vertical'}
                      aria-label={t('resizeSplitAria')}
                      onPointerDown={(e) => startSplitResize(idx, e)}
                      className={`shrink-0 transition-colors select-none z-10 ${
                        splitDirection === 'vertical'
                          ? 'h-1 w-full cursor-row-resize border-y border-[#e5e5e5] dark:border-[#2b2b2b] bg-[#f3f3f3] dark:bg-[#252526] hover:bg-[#007acc]'
                          : 'w-1 h-full cursor-col-resize border-x border-[#e5e5e5] dark:border-[#2b2b2b] bg-[#f3f3f3] dark:bg-[#252526] hover:bg-[#007acc]'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Terminal, Console & Problems Dock */}
          {showDockPane && (
            <div
              className={`${
                dockExpanded ? 'h-72 sm:h-96' : 'h-40 sm:h-44'
              } shrink-0 flex flex-col border-t border-[#e5e5e5] dark:border-[#2b2b2b] bg-white dark:bg-[#1e1e1e] transition-[height] duration-150`}
            >
              <div className="h-8 shrink-0 flex items-center justify-between px-3 border-b border-[#e5e5e5] dark:border-[#2b2b2b] bg-[#f3f3f3] dark:bg-[#252526] overflow-x-auto">
                <div className="flex items-center gap-4 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setDockTab('terminal')}
                    className={`h-8 flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                      dockTab === 'terminal'
                        ? 'border-[#007acc] text-[#1e1e1e] dark:text-white font-semibold'
                        : 'border-transparent text-[#616161] dark:text-[#969696] hover:text-[#1e1e1e] dark:hover:text-white'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>{t('terminalTab')}</span>
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
                    <span>{t('consoleTab')}</span>
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
                    <span>{t('problemsTab')}</span>
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
                      title={t('clearLogTitle')}
                      onClick={() => setConsoleLogs([])}
                      className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title={dockExpanded ? t('shrinkDockTitle') : t('expandDockTitle')}
                    onClick={() => setDockExpanded((v) => !v)}
                    className="p-1 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    {dockExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    title={t('closeDockTitle')}
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
                        {t('consoleReady')}
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
                      placeholder={t('replPlaceholder')}
                      className="flex-1 bg-transparent font-mono text-xs text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </form>
                </div>
              ) : (
                <div className="flex-1 overflow-auto divide-y divide-slate-200 dark:divide-slate-800">
                  {problems.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 p-4">{t('noProblemsFound')}</div>
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
                ? 'fixed inset-0 z-50 bg-[#f3f3f3] dark:bg-[#1e1e1e]'
                : `absolute inset-0 z-20 lg:static lg:z-auto flex ${
                    editorGroups.length > 1 && splitDirection === 'horizontal'
                      ? 'lg:w-[32%] xl:w-[33%] lg:max-w-[460px]'
                      : 'lg:w-[38%] xl:w-[40%] lg:max-w-[560px]'
                  } border-s border-[#e5e5e5] dark:border-[#2b2b2b] bg-[#f3f3f3] dark:bg-[#252526]`
            } flex flex-col shrink-0`}
          >
            <div className="h-9 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-[#e5e5e5] dark:border-[#2b2b2b] bg-[#ececec] dark:bg-[#252526]">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 min-w-0">
                <span className="font-semibold shrink-0">{t('livePreview')}</span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-[11px] text-slate-500 truncate max-w-[140px]" dir="ltr">
                  {activeFile}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title={t('desktopViewport')}
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
                  title={t('tabletViewport')}
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
                  title={t('mobileViewport')}
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
                  title={t('refreshPreview')}
                  onClick={() => doRun(false)}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title={t('copyPreviewLink')}
                  onClick={() => {
                    if (localPreviewUrl && localPreviewUrl !== '#') {
                      navigator.clipboard.writeText(localPreviewUrl);
                      showNotice(t('previewUrlCopied'));
                    }
                  }}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <a
                  href={localPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('localPreviewLink')}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  title={previewFullscreen ? t('minimizeTitle') : t('fullscreenTitle')}
                  onClick={() => setPreviewFullscreen((v) => !v)}
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {previewFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  title={t('closePreviewTitle')}
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
                title={t('livePreview')}
                sandbox="allow-scripts allow-modals"
                srcDoc={previewDoc || buildWebPreviewDoc(files, activeFile, true, locale)}
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

      {/* Authentic VS Code Blue Status Bar */}
      {!typingFullMobile && !focusMode && (
        <footer
          dir="ltr"
          className="h-6 shrink-0 flex items-center justify-between px-3 bg-[#007acc] text-[11px] font-mono tabular-nums text-white select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              data-testid="statusbar-github-btn"
              title={t('githubStatusTitle')}
              onClick={() => setGithubOpen(true)}
              className="inline-flex items-center gap-1 hover:bg-white/15 px-1.5 py-0.5 rounded-sm transition-colors max-w-[320px] truncate shrink-0"
            >
              <GitBranch className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {githubLink ? `${githubLink.fullName} (${githubLink.branch})` : t('githubBtn')}
              </span>
              {githubLink && githubChanges.totalChanges > 0 && (
                <span
                  dir={dir}
                  data-testid="statusbar-github-changes"
                  className="px-1 rounded bg-white/20 text-[10px] font-semibold shrink-0"
                >
                  {t('changesBadge', githubChanges.totalChanges)}
                </span>
              )}
            </button>
            <span className="opacity-60">|</span>
            <span className="truncate">
              Ln {cursor.line}, Col {cursor.col}
              {cursor.selected > 0 ? t('selectedSuffix', cursor.selected) : ''}
            </span>
            <span className="hidden sm:inline opacity-60">|</span>
            <span className="hidden sm:inline">{t('spacesLabel', prefs.tabSize)}</span>
            <span className="hidden md:inline opacity-60">|</span>
            <span className="hidden md:inline">UTF-8</span>
            <span className="opacity-60">|</span>
            <span className="truncate font-semibold">{activeMeta.label}</span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline text-[11px] font-sans opacity-95" dir={dir}>
              {t('designedBy')}{' '}
              <a
                href="https://mahmoud-smoky.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2 hover:text-white/80"
              >
                {t('devName')}
              </a>
            </span>
            <span className="hidden sm:inline opacity-60">|</span>
            <span className="hidden sm:inline opacity-90">IndexedDB</span>
            <span className="hidden sm:inline opacity-60">|</span>
            <button
              type="button"
              title={t('problemsStatusTitle')}
              dir={dir}
              onClick={() => {
                setReviewOpen(true);
              }}
              className="hover:bg-white/15 px-1.5 py-0.5 rounded-sm transition-colors"
            >
              {problems.length > 0 ? t('problemsCount', problems.length) : t('noProblemsStatus')}
            </button>
          </div>
        </footer>
      )}

      <OfflineIndicator />

      {/* Non-intrusive floating toast notification */}
      {notice && (
        <div
          role="status"
          className="fixed bottom-10 end-4 z-50 px-3.5 py-2 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-medium pointer-events-none"
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
      <GitHubPushModal
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        projectName={projectName}
        files={files}
        githubUser={githubUser}
        githubSessionToken={githubSessionToken}
        githubLink={githubLink}
        changes={githubChanges}
        onConnectGitHub={handleConnectGitHub}
        onDisconnectGitHub={handleDisconnectGitHub}
        onConnectSuccess={(token, user) => {
          setGithubSessionToken(token);
          setGithubUser(user);
          showNotice(t('tokenConnectedNotice', user?.login));
        }}
        onLinkRepository={handleLinkRepository}
        onPullRepository={handlePullRepository}
        onUnlinkRepository={handleUnlinkRepository}
        onChangeLinkedBranch={handleChangeLinkedBranch}
        onPushSuccess={handleGitHubPushSuccess}
      />
      <input
        ref={zipInputRef}
        type="file"
        multiple
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={(e) => {
          handleZipUpload(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
    </I18nProvider>
  );
}
