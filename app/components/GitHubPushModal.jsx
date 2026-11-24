'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  GitBranch,
  Lock,
  Globe,
  ExternalLink,
  Copy,
  Check,
  LogOut,
  UploadCloud,
  DownloadCloud,
  Link2,
  Unlink,
  RefreshCw,
  Search,
  FolderGit2,
  PlusCircle,
  CheckCircle2,
} from 'lucide-react';
import { sanitizeProjectName } from '../lib/storage';
import { buildGitHubSnapshot, parseRepoSlug, validateGitHubBranch } from '../lib/githubSync';
import { useI18n } from '../lib/LocaleContext';

export default function GitHubPushModal({
  open,
  onClose,
  projectName,
  files,
  githubUser,
  githubSessionToken,
  githubLink,
  changes,
  onConnectGitHub,
  onDisconnectGitHub,
  onLinkRepository,
  onPullRepository,
  onUnlinkRepository,
  onChangeLinkedBranch,
  onPushSuccess,
}) {
  const { t, locale } = useI18n();
  const [modeTab, setModeTab] = useState('link'); // 'link' | 'create'
  const [choosingRepo, setChoosingRepo] = useState(false);

  // Create-new-repo state
  const [repoName, setRepoName] = useState(sanitizeProjectName(projectName));
  const [description, setDescription] = useState('Built with CodeLab IDE');
  const [isPrivate, setIsPrivate] = useState(false);

  // Link-existing-repo state
  const [repos, setRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoQuery, setRepoQuery] = useState('');
  const [manualSlug, setManualSlug] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [availableBranches, setAvailableBranches] = useState([]);
  const [pulling, setPulling] = useState(false);
  const [linking, setLinking] = useState(false);

  // Staging & commit state
  const [selectedPaths, setSelectedPaths] = useState({});
  const [forcePushAll, setForcePushAll] = useState(false);
  const [commitMessage, setCommitMessage] = useState('Initial commit from CodeLab IDE');
  const [pushing, setPushing] = useState(false);
  const [oauthConfig, setOauthConfig] = useState({ checked: false, configured: true, redirectUri: '' });
  const [errorMsg, setErrorMsg] = useState(null);
  const [result, setResult] = useState(null);
  const [copiedUri, setCopiedUri] = useState(false);

  const isLinkedView = Boolean(githubLink && !choosingRepo);

  const fetchRepositories = useCallback(async () => {
    if (!githubSessionToken) return;
    setLoadingRepos(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/github/repos', {
        headers: { Authorization: `Bearer ${githubSessionToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || t('reposLoadError'));
      } else {
        setRepos(Array.isArray(data.repos) ? data.repos : []);
      }
    } catch {
      setErrorMsg(t('reposLoadError'));
    } finally {
      setLoadingRepos(false);
    }
  }, [githubSessionToken, t]);

  const fetchLinkedBranches = useCallback(async () => {
    if (!githubSessionToken || !githubLink?.owner || !githubLink?.name) return;
    try {
      const params = new URLSearchParams({
        owner: githubLink.owner,
        repo: githubLink.name,
        branch: githubLink.branch || 'main',
        branchesOnly: '1',
      });
      const res = await fetch(`/api/github/pull?${params.toString()}`, {
        headers: { Authorization: `Bearer ${githubSessionToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.branches) && data.branches.length > 0) {
        setAvailableBranches(data.branches);
      }
    } catch {}
  }, [githubSessionToken, githubLink?.owner, githubLink?.name, githubLink?.branch]);

  // Reset modal transient UI only when modal opens
  useEffect(() => {
    if (!open) return;
    setRepoName(sanitizeProjectName(projectName));
    setErrorMsg(null);
    setResult(null);
    setForcePushAll(false);
    setChoosingRepo(false);

    (async () => {
      try {
        const res = await fetch('/api/github/auth');
        if (!res.ok) return;
        const data = await res.json();
        setOauthConfig({
          checked: true,
          configured: Boolean(data.configured),
          redirectUri: data.redirectUri || `${window.location.origin}/auth/callback`,
        });
      } catch {}
    })();
  }, [open, projectName]);

  // Sync branch/slug inputs when linked repo changes while open
  useEffect(() => {
    if (!open) return;
    if (githubLink) {
      setManualSlug(githubLink.fullName);
      setTargetBranch(githubLink.branch || 'main');
      setAvailableBranches((prev) =>
        prev.includes(githubLink.branch || 'main') ? prev : [githubLink.branch || 'main', ...prev]
      );
    } else {
      setManualSlug('');
      setTargetBranch('');
      setAvailableBranches([]);
      setModeTab('link');
    }
  }, [open, githubLink]);

  // Load repositories or linked branches when authenticated & open
  useEffect(() => {
    if (!open || !githubSessionToken) return;
    if (githubLink && !choosingRepo) {
      fetchLinkedBranches();
    } else {
      fetchRepositories();
    }
  }, [open, githubSessionToken, githubLink, choosingRepo, fetchLinkedBranches, fetchRepositories]);

  // Keep staged items synced with pending changes (default all checked)
  const stagedItems = useMemo(() => {
    if (isLinkedView && !forcePushAll) {
      return changes?.changes || [];
    }
    return Object.keys(files || {})
      .sort((a, b) => a.localeCompare(b))
      .map((path) => ({
        path,
        status: changes?.statusMap?.[path] || 'added',
      }));
  }, [isLinkedView, forcePushAll, changes, files]);

  useEffect(() => {
    if (!open) return;
    const next = {};
    for (const item of stagedItems) {
      next[item.path] = true;
    }
    setSelectedPaths(next);

    if (isLinkedView) {
      setCommitMessage(
        stagedItems.length > 0
          ? t('defaultUpdateCommit', stagedItems.length)
          : t('defaultUpdateCommit', 1)
      );
    } else {
      setCommitMessage(t('defaultInitialCommit'));
    }
  }, [open, isLinkedView, stagedItems, t]);

  const filteredRepos = useMemo(() => {
    const q = repoQuery.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    );
  }, [repos, repoQuery]);

  if (!open) return null;

  const selectedItemsList = stagedItems.filter((item) => selectedPaths[item.path]);
  const allSelected = stagedItems.length > 0 && selectedItemsList.length === stagedItems.length;

  const handleToggleAll = () => {
    const nextVal = !allSelected;
    const next = {};
    for (const item of stagedItems) {
      next[item.path] = nextVal;
    }
    setSelectedPaths(next);
  };

  const resolveSelectedSlug = () => {
    const candidate = manualSlug.trim() || repoQuery.trim();
    return parseRepoSlug(candidate, githubUser?.login || '');
  };

  const handleLinkRepo = async (pullFiles) => {
    if (!githubSessionToken || pulling || linking) return;
    const parsed = resolveSelectedSlug();
    if (!parsed) {
      setErrorMsg(t('invalidRepoError'));
      return;
    }

    const branchParam = targetBranch.trim() ? validateGitHubBranch(targetBranch.trim()) : null;
    if (targetBranch.trim() && !branchParam) {
      setErrorMsg(t('invalidRepoError'));
      return;
    }

    setErrorMsg(null);
    if (pullFiles) setPulling(true);
    else setLinking(true);

    try {
      const params = new URLSearchParams({
        owner: parsed.owner,
        repo: parsed.repo,
      });
      if (branchParam) params.set('branch', branchParam);

      const res = await fetch(`/api/github/pull?${params.toString()}`, {
        headers: { Authorization: `Bearer ${githubSessionToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || t('pullError'));
        return;
      }

      const remoteSnapshot = buildGitHubSnapshot(data.files || {});
      const linkInfo = {
        fullName: data.repo.fullName,
        owner: data.repo.owner,
        name: data.repo.name,
        branch: data.repo.branch,
        private: Boolean(data.repo.private),
        htmlUrl: data.repo.htmlUrl,
        lastCommitSha: data.headSha || null,
        lastSyncedAt: new Date().toISOString(),
        syncedSnapshot: remoteSnapshot,
      };

      if (Array.isArray(data.branches)) {
        setAvailableBranches(data.branches);
      }

      if (pullFiles) {
        onPullRepository?.(linkInfo, data.files || {});
      } else {
        onLinkRepository?.(linkInfo);
      }
      setChoosingRepo(false);
    } catch {
      setErrorMsg(t('pullError'));
    } finally {
      setPulling(false);
      setLinking(false);
    }
  };

  const handlePullLatest = async () => {
    if (!githubSessionToken || !githubLink || pulling) return;
    setErrorMsg(null);
    setResult(null);
    setPulling(true);
    try {
      const branchToPull = targetBranch || githubLink.branch || 'main';
      const params = new URLSearchParams({
        owner: githubLink.owner,
        repo: githubLink.name,
        branch: branchToPull,
      });
      const res = await fetch(`/api/github/pull?${params.toString()}`, {
        headers: { Authorization: `Bearer ${githubSessionToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || t('pullError'));
        return;
      }

      const linkInfo = {
        ...githubLink,
        branch: data.repo?.branch || branchToPull,
        htmlUrl: data.repo?.htmlUrl || githubLink.htmlUrl,
        lastCommitSha: data.headSha || null,
        lastSyncedAt: new Date().toISOString(),
        syncedSnapshot: buildGitHubSnapshot(data.files || {}),
      };
      if (Array.isArray(data.branches)) {
        setAvailableBranches(data.branches);
      }
      onPullRepository?.(linkInfo, data.files || {});
    } catch {
      setErrorMsg(t('pullError'));
    } finally {
      setPulling(false);
    }
  };

  const handlePush = async (e) => {
    e.preventDefault();
    if (!githubSessionToken || pushing) return;

    const creatingNew = !isLinkedView && modeTab === 'create';
    if (!creatingNew && !isLinkedView) {
      // User clicked submit while browsing link tab without linking first -> link & stay if slug valid
      await handleLinkRepo(false);
      return;
    }

    if (selectedItemsList.length === 0) return;

    setErrorMsg(null);
    setResult(null);
    setPushing(true);

    try {
      const filesToPush = {};
      const deletedToPush = [];
      for (const item of selectedItemsList) {
        if (item.status === 'deleted') {
          deletedToPush.push(item.path);
        } else if (files[item.path] !== undefined) {
          filesToPush[item.path] = files[item.path];
        }
      }

      const payload = creatingNew
        ? {
            owner: githubUser?.login,
            repoName,
            description,
            isPrivate,
            createIfMissing: true,
            commitMessage,
            files: filesToPush,
          }
        : {
            owner: githubLink.owner,
            repoName: githubLink.name,
            branch: targetBranch || githubLink.branch || 'main',
            createIfMissing: false,
            commitMessage,
            files: filesToPush,
            deletedPaths: deletedToPush,
          };

      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${githubSessionToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || t('pushError'));
      } else {
        setResult(data);
        setForcePushAll(false);
        onPushSuccess?.({
          ...data,
          pushedItems: selectedItemsList,
        });
      }
    } catch {
      setErrorMsg(t('pushNetworkError'));
    } finally {
      setPushing(false);
    }
  };

  const formatSyncTime = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="w-4 h-4 text-sky-500 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {t('githubModalTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('closeAria')}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-auto">
          {!githubSessionToken ? (
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {t('githubIntro')}
              </p>

              {githubLink && (
                <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/10 text-xs text-sky-900 dark:text-sky-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderGit2 className="w-4 h-4 text-sky-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-mono font-semibold truncate" dir="ltr">
                        {githubLink.fullName} ({githubLink.branch})
                      </div>
                      {changes?.totalChanges > 0 && (
                        <div className="text-[11px] opacity-85">
                          {t('savedChangesHeading', changes.totalChanges)}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onUnlinkRepository}
                    className="text-[11px] underline shrink-0 hover:opacity-80"
                  >
                    {t('unlinkRepoBtn')}
                  </button>
                </div>
              )}

              {oauthConfig.checked && !oauthConfig.configured && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200 space-y-2">
                  <div className="font-semibold">{t('githubSetupTitle')}</div>
                  <p>{t('githubSetupNote')}</p>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2 rounded border border-amber-500/30" dir="ltr">
                    <code className="text-[11px] font-mono truncate flex-1">{oauthConfig.redirectUri}</code>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard?.writeText(oauthConfig.redirectUri);
                        setCopiedUri(true);
                        setTimeout(() => setCopiedUri(false), 1500);
                      }}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      {copiedUri ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onConnectGitHub}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-sm font-semibold transition-colors"
              >
                <GitBranch className="w-4 h-4" />
                <span>{t('connectGitHubNow')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connected Account Bar */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  {githubUser?.avatar_url ? (
                    <img
                      src={githubUser.avatar_url}
                      alt={githubUser.login}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-sky-600 text-white text-xs font-bold grid place-items-center">
                      {githubUser?.login?.[0]?.toUpperCase() || 'G'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {githubUser?.name || githubUser?.login}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate" dir="ltr">
                      @{githubUser?.login}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onDisconnectGitHub}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('disconnect')}</span>
                </button>
              </div>

              {/* Active Linked Repository View */}
              {isLinkedView ? (
                <form onSubmit={handlePush} className="space-y-4">
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                          {t('linkedRepoLabel')}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {githubLink.private ? (
                            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          )}
                          <a
                            href={githubLink.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            dir="ltr"
                            className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 hover:text-sky-500 truncate inline-flex items-center gap-1"
                          >
                            <span>{githubLink.fullName}</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={handlePullLatest}
                          disabled={pulling}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                        >
                          <DownloadCloud className="w-3.5 h-3.5 text-sky-500" />
                          <span>{pulling ? t('pullingFiles') : t('pullLatestBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setChoosingRepo(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <FolderGit2 className="w-3.5 h-3.5" />
                          <span>{t('switchRepoBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={onUnlinkRepository}
                          title={t('unlinkRepoBtn')}
                          className="p-1.5 rounded-md text-slate-500 hover:text-rose-500 hover:bg-rose-500/10"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t('branchLabel')}:
                        </label>
                        <select
                          dir="ltr"
                          value={targetBranch || githubLink.branch || 'main'}
                          onChange={(e) => {
                            const nextBranch = e.target.value;
                            setTargetBranch(nextBranch);
                            onChangeLinkedBranch?.(nextBranch);
                          }}
                          className="px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                        >
                          {availableBranches.map((br) => (
                            <option key={br} value={br}>
                              {br}
                            </option>
                          ))}
                        </select>
                      </div>
                      {githubLink.lastSyncedAt && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t('lastSyncedLabel', formatSyncTime(githubLink.lastSyncedAt))}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pending Saved File Changes List */}
                  {stagedItems.length > 0 ? (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {forcePushAll
                            ? t('allWorkspaceFilesHeading', stagedItems.length)
                            : t('savedChangesHeading', stagedItems.length)}
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleAll}
                          className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          {allSelected ? t('deselectAll') : t('selectAll')}
                        </button>
                      </div>
                      <div className="max-h-44 overflow-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                        {stagedItems.map((item) => {
                          const badge =
                            item.status === 'modified'
                              ? { code: 'M', cls: 'text-amber-600 dark:text-amber-400 bg-amber-500/10', label: t('statusModified') }
                              : item.status === 'deleted'
                                ? { code: 'D', cls: 'text-rose-600 dark:text-rose-400 bg-rose-500/10', label: t('statusDeleted') }
                                : { code: 'A', cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10', label: t('statusAdded') };
                          return (
                            <label
                              key={item.path}
                              className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selectedPaths[item.path])}
                                  onChange={(e) =>
                                    setSelectedPaths((prev) => ({
                                      ...prev,
                                      [item.path]: e.target.checked,
                                    }))
                                  }
                                  className="rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500"
                                />
                                <span
                                  dir="ltr"
                                  className={`font-mono truncate ${
                                    item.status === 'deleted'
                                      ? 'line-through text-slate-400 dark:text-slate-500'
                                      : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {item.path}
                                </span>
                              </div>
                              <span
                                title={badge.label}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${badge.cls}`}
                              >
                                {badge.code} · {badge.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 space-y-2">
                      <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{t('noPendingChanges')}</span>
                      </div>
                      <label className="inline-flex items-center gap-2 cursor-pointer text-[11px] opacity-90">
                        <input
                          type="checkbox"
                          checked={forcePushAll}
                          onChange={(e) => setForcePushAll(e.target.checked)}
                          className="rounded border-emerald-400 text-emerald-600"
                        />
                        <span>{t('forcePushAllLabel')}</span>
                      </label>
                    </div>
                  )}

                  {/* Commit Message */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('commitMsgLabel')}
                    </label>
                    <input
                      dir="ltr"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                    />
                  </div>

                  {errorMsg && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                      {errorMsg}
                    </div>
                  )}

                  {result && (
                    <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 space-y-2">
                      <div className="font-semibold">
                        {t('uploadSuccess', (result.filesCount || 0) + (result.deletedCount || 0))}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={result.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold underline"
                        >
                          <span>{t('openRepo')}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {result.commitUrl && (
                          <a
                            href={result.commitUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 underline"
                          >
                            <span>{t('viewCommit')}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={pushing || selectedItemsList.length === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>
                      {pushing
                        ? t('pushing')
                        : t('pushSavedChangesBtn', selectedItemsList.length)}
                    </span>
                  </button>
                </form>
              ) : (
                /* Link Existing Repo OR Create New Repo Mode */
                <div className="space-y-4">
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setModeTab('link');
                        setErrorMsg(null);
                      }}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        modeTab === 'link'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>{t('linkExistingRepoTab')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModeTab('create');
                        setErrorMsg(null);
                      }}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        modeTab === 'create'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>{t('createNewRepoTab')}</span>
                    </button>
                  </div>

                  {modeTab === 'link' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            value={repoQuery}
                            onChange={(e) => setRepoQuery(e.target.value)}
                            placeholder={t('searchReposPlaceholder')}
                            className="w-full ps-8 pe-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                          />
                        </div>
                        <button
                          type="button"
                          title={t('refreshReposTitle')}
                          onClick={fetchRepositories}
                          disabled={loadingRepos}
                          className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingRepos ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      {/* Repository List */}
                      <div className="max-h-44 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80">
                        {loadingRepos ? (
                          <div className="p-4 text-center text-xs text-slate-500">{t('loadingRepos')}</div>
                        ) : filteredRepos.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">{t('noReposFound')}</div>
                        ) : (
                          filteredRepos.map((r) => {
                            const selected = manualSlug.toLowerCase() === r.fullName.toLowerCase();
                            return (
                              <button
                                key={r.id || r.fullName}
                                type="button"
                                onClick={() => {
                                  setManualSlug(r.fullName);
                                  setTargetBranch(r.defaultBranch || 'main');
                                  setErrorMsg(null);
                                }}
                                className={`w-full text-start px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                                  selected
                                    ? 'bg-sky-500/10 text-sky-900 dark:text-sky-200'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 font-mono font-semibold truncate" dir="ltr">
                                    {r.private ? (
                                      <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                                    ) : (
                                      <Globe className="w-3 h-3 text-sky-500 shrink-0" />
                                    )}
                                    <span className="truncate">{r.fullName}</span>
                                  </div>
                                  {r.description && (
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                      {r.description}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                  {r.defaultBranch}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            {t('repoSlugLabel')}
                          </label>
                          <input
                            dir="ltr"
                            value={manualSlug}
                            onChange={(e) => setManualSlug(e.target.value)}
                            placeholder={t('repoSlugPlaceholder')}
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            {t('branchLabel')}
                          </label>
                          <input
                            dir="ltr"
                            value={targetBranch}
                            onChange={(e) => setTargetBranch(e.target.value)}
                            placeholder="main"
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>

                      {errorMsg && (
                        <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                          {errorMsg}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleLinkRepo(false)}
                          disabled={linking || pulling || !manualSlug.trim()}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>{linking ? t('linkingRepo') : t('linkRepoKeepLocalBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLinkRepo(true)}
                          disabled={linking || pulling || !manualSlug.trim()}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-100 text-xs font-semibold transition-colors"
                        >
                          <DownloadCloud className="w-3.5 h-3.5 text-sky-500" />
                          <span>{pulling ? t('pullingFiles') : t('pullAndLinkBtn')}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handlePush} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          {t('repoNameLabel')}
                        </label>
                        <input
                          required
                          dir="ltr"
                          value={repoName}
                          onChange={(e) => setRepoName(e.target.value)}
                          placeholder="my-codelab-project"
                          className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                        />
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono" dir="ltr">
                          github.com/{githubUser?.login}/{repoName.replace(/[^a-zA-Z0-9._-]+/g, '-') || '...'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          {t('repoDescLabel')}
                        </label>
                        <input
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          {t('commitMsgLabel')}
                        </label>
                        <input
                          dir="ltr"
                          value={commitMessage}
                          onChange={(e) => setCommitMessage(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsPrivate(false)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                            !isPrivate
                              ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>{t('publicRepo')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsPrivate(true)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                            isPrivate
                              ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>{t('privateRepo')}</span>
                        </button>
                      </div>

                      {errorMsg && (
                        <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                          {errorMsg}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={pushing || Object.keys(files).length === 0}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>{pushing ? t('pushing') : t('pushFilesBtn', Object.keys(files).length)}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
