'use client';

import { useMemo, useRef, useState } from 'react';
import {
  FilePlus,
  FolderPlus,
  FolderArchive,
  Upload,
  Download,
  Trash2,
  Pencil,
  Copy,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  ImageIcon,
  Film,
  Music,
  Languages,
  Search,
  X,
  Columns2,
  Check,
} from 'lucide-react';
import { detectLang, detectMediaKind } from '../lib/workspaces';
import { normalizeWorkspacePath } from '../lib/workspaceFiles';
import { extractZipArchive, isMediaEntry } from '../lib/storage';
import LanguageIcon from './LanguageIcon';
import { useI18n } from '../lib/LocaleContext';

function buildTree(paths) {
  const root = { folders: {}, files: [] };
  for (const path of paths.sort((a, b) => a.localeCompare(b))) {
    const parts = path.split('/').filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!node.folders[seg]) node.folders[seg] = { folders: {}, files: [] };
      node = node.folders[seg];
    }
    node.files.push({ name: parts[parts.length - 1], path });
  }
  return root;
}

function readUploadedFile(file) {
  return new Promise((resolve, reject) => {
    const mime = file.type || '';
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isBinaryMedia =
      (mime.startsWith('image/') && !mime.includes('svg')) ||
      mime.startsWith('video/') ||
      mime.startsWith('audio/') ||
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'mp4', 'webm', 'mov', 'm4v', 'ogv', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);

    if (isBinaryMedia) {
      const reader = new FileReader();
      reader.onload = () => {
        const inferredMime =
          mime ||
          (['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(ext)
            ? `video/${ext === 'mov' ? 'quicktime' : ext}`
            : ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)
              ? `audio/${ext === 'mp3' ? 'mpeg' : ext}`
              : `image/${ext === 'jpg' ? 'jpeg' : ext}`);
        resolve({
          __media: true,
          mime: inferredMime,
          size: file.size,
          name: file.name,
          dataUrl: String(reader.result),
        });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    } else {
      file.text().then(resolve).catch(reject);
    }
  });
}

export default function FileExplorer({
  files,
  activeFile,
  projectName,
  onRenameProject,
  onSelectFile,
  onOpenFileToSide,
  onCreateFile,
  onOpenLanguagePicker,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onRenameFolder,
  onDeleteFolder,
  onImportFiles,
  onImportError,
  onExportWorkspace,
  onClearAllFiles,
  onOpenLocalFile,
  onSaveLocalFile,
  gitStatusMap,
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [renamingPath, setRenamingPath] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameFolderVal, setRenameFolderVal] = useState('');
  const [editingProject, setEditingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState(projectName || 'my-codelab-project');
  const [collapsed, setCollapsed] = useState({});
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [extractingZip, setExtractingZip] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const uploadRef = useRef(null);
  const zipUploadRef = useRef(null);
  const mediaUploadRef = useRef(null);

  const visiblePaths = useMemo(() => {
    const all = Object.keys(files);
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter((p) => p.toLowerCase().includes(q));
  }, [files, query]);

  const tree = useMemo(() => buildTree(visiblePaths), [visiblePaths]);

  const handleFileList = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    const loaded = {};
    let importedProjectName = null;
    let hasZip = false;

    setExtractingZip(list.some((f) => /\.zip$/i.test(f.name) || /zip/i.test(f.type || '')));
    try {
      for (const f of list) {
        try {
          const isZip =
            /\.zip$/i.test(f.name) ||
            f.type === 'application/zip' ||
            f.type === 'application/x-zip-compressed' ||
            f.type === 'multipart/x-zip';
          if (isZip) {
            hasZip = true;
            const extracted = await extractZipArchive(f);
            if (extracted.count === 0) {
              onImportError?.(t('zipEmptyNotice', f.name));
              continue;
            }
            Object.assign(loaded, extracted.files);
            if (extracted.projectName) importedProjectName = extracted.projectName;
            continue;
          }

          const content = await readUploadedFile(f);
          if (typeof content === 'string' && /\.json$/i.test(f.name)) {
            try {
              const parsed = JSON.parse(content);
              if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
                Object.assign(loaded, parsed.files);
                if (parsed.projectName) importedProjectName = parsed.projectName;
                continue;
              }
            } catch {}
          }
          loaded[f.name] = content;
        } catch {
          onImportError?.(t('zipReadFailedNotice', f.name));
        }
      }
      if (Object.keys(loaded).length) {
        onImportFiles(loaded, importedProjectName, { source: hasZip ? 'zip' : 'files' });
      }
    } finally {
      setExtractingZip(false);
    }
  };

  const submitCreate = (e) => {
    e.preventDefault();
    const clean = normalizeWorkspacePath(draftName);
    if (!clean) {
      if (draftName.trim()) onImportError?.(t('invalidPathNotice'));
      setCreating(null);
      return;
    }
    if (creating.type === 'folder') {
      const full = normalizeWorkspacePath(`${creating.prefix ? creating.prefix + '/' : ''}${clean}/index.js`);
      if (full) onCreateFile(full, t('newFolderStarterComment'));
    } else {
      const full = normalizeWorkspacePath(`${creating.prefix ? creating.prefix + '/' : ''}${clean}`);
      if (full) onCreateFile(full);
    }
    setDraftName('');
    setCreating(null);
  };

  const submitRename = (e, oldPath) => {
    e.preventDefault();
    const next = normalizeWorkspacePath(renameVal);
    if (!next && renameVal.trim()) {
      onImportError?.(t('invalidPathNotice'));
    } else if (next && next !== oldPath) {
      onRenameFile(oldPath, next);
    }
    setRenamingPath(null);
  };

  const submitRenameFolder = (e, oldPrefix) => {
    e.preventDefault();
    const next = normalizeWorkspacePath(renameFolderVal);
    if (!next && renameFolderVal.trim()) {
      onImportError?.(t('invalidPathNotice'));
    } else if (next && next !== oldPrefix) {
      onRenameFolder?.(oldPrefix, next);
    }
    setRenamingFolder(null);
  };

  const renderIcon = (path) => {
    const entry = files[path];
    const mediaKind = detectMediaKind(path, entry);
    if (mediaKind === 'image') return <ImageIcon className="w-3.5 h-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />;
    if (mediaKind === 'video') return <Film className="w-3.5 h-3.5 shrink-0 text-purple-500 dark:text-purple-400" />;
    if (mediaKind === 'audio') return <Music className="w-3.5 h-3.5 shrink-0 text-pink-500 dark:text-pink-400" />;
    return <LanguageIcon lang={detectLang(path)} size={15} />;
  };

  const renderNode = (node, prefix = '', depth = 0) => {
    const folderNames = Object.keys(node.folders).sort((a, b) => a.localeCompare(b));
    return (
      <>
        {folderNames.map((fname) => {
          const fullPrefix = prefix ? `${prefix}/${fname}` : fname;
          const isClosed = !!collapsed[fullPrefix];
          if (renamingFolder === fullPrefix) {
            return (
              <div key={fullPrefix}>
                <form
                  onSubmit={(e) => submitRenameFolder(e, fullPrefix)}
                  className="flex items-center gap-1 px-2 py-1"
                  style={{ paddingInlineStart: `${8 + depth * 14}px` }}
                >
                  <input
                    autoFocus
                    dir="ltr"
                    aria-label={t('renameFolderAria', fname)}
                    value={renameFolderVal}
                    onChange={(e) => setRenameFolderVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setRenamingFolder(null);
                    }}
                    onBlur={() => setRenamingFolder(null)}
                    className="flex-1 min-w-0 px-2 py-0.5 text-xs font-mono rounded border border-sky-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none"
                  />
                  <button
                    type="submit"
                    aria-label={t('confirmRenameTitle')}
                    onMouseDown={(e) => e.preventDefault()}
                    className="p-1 rounded bg-sky-600 text-white hover:bg-sky-500"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('cancelRenameTitle')}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setRenamingFolder(null)}
                    className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </form>
                {!isClosed && renderNode(node.folders[fname], fullPrefix, depth + 1)}
              </div>
            );
          }
          return (
            <div key={fullPrefix}>
              <div
                className="group flex items-center justify-between gap-1 px-2 py-1.5 text-xs rounded-md cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/70"
                style={{ paddingInlineStart: `${8 + depth * 14}px` }}
                onClick={() => setCollapsed((c) => ({ ...c, [fullPrefix]: !c[fullPrefix] }))}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isClosed ? <ChevronRight className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                  {isClosed ? <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" /> : <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
                  <span className="truncate font-mono">{fname}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 opacity-70 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <button
                    type="button"
                    title={t('newFileInFolderTitle')}
                    aria-label={t('newFileInFolderTitle')}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsed((c) => ({ ...c, [fullPrefix]: false }));
                      setCreating({ type: 'file', prefix: fullPrefix });
                      setDraftName('');
                    }}
                    className="p-0.5 rounded hover:bg-slate-300/60 dark:hover:bg-slate-700"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                  </button>
                  {onRenameFolder && (
                    <button
                      type="button"
                      title={t('renameFolderTitle')}
                      aria-label={t('renameFolderAria', fname)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingFolder(fullPrefix);
                        setRenameFolderVal(fullPrefix);
                      }}
                      className="p-0.5 rounded hover:bg-slate-300/60 dark:hover:bg-slate-700"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {onDeleteFolder && (
                    <button
                      type="button"
                      title={t('deleteFolderTitle')}
                      aria-label={t('deleteFolderAria', fname)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(fullPrefix);
                      }}
                      className="p-0.5 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-500/15"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {!isClosed && renderNode(node.folders[fname], fullPrefix, depth + 1)}
            </div>
          );
        })}

        {node.files.map(({ name, path }) => {
          const isActive = path === activeFile;
          if (renamingPath === path) {
            return (
              <form
                key={path}
                onSubmit={(e) => submitRename(e, path)}
                className="flex items-center gap-1 px-2 py-1"
                style={{ paddingInlineStart: `${12 + depth * 14}px` }}
              >
                <input
                  autoFocus
                  dir="ltr"
                  aria-label={t('renameAria', name)}
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setRenamingPath(null);
                  }}
                  onBlur={() => setRenamingPath(null)}
                  className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded border border-sky-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none"
                />
                <button
                  type="submit"
                  title={t('confirmRenameTitle')}
                  aria-label={t('confirmRenameTitle')}
                  onMouseDown={(e) => e.preventDefault()}
                  className="p-1 rounded bg-sky-600 text-white hover:bg-sky-500 shrink-0"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  title={t('cancelRenameTitle')}
                  aria-label={t('cancelRenameTitle')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setRenamingPath(null)}
                  className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            );
          }
          return (
            <div
              key={path}
              style={{ paddingInlineStart: `${12 + depth * 14}px` }}
              className={`group flex items-center justify-between gap-1.5 px-2 py-1 text-xs rounded-sm transition-colors ${
                isActive
                  ? 'bg-[#0060c0]/15 dark:bg-[#37373d] text-[#005fb8] dark:text-white font-medium'
                  : 'text-[#333333] dark:text-[#cccccc] hover:bg-[#e8e8e8] dark:hover:bg-[#2a2d2e]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectFile(path)}
                className="flex-1 flex items-center gap-1.5 min-w-0 text-start cursor-pointer"
                dir="ltr"
              >
                {renderIcon(path)}
                <span className="truncate font-mono">{name}</span>
                {gitStatusMap?.[path] === 'modified' && (
                  <span
                    title={t('statusModified')}
                    className="ms-auto text-[10px] font-mono font-bold text-amber-500 shrink-0"
                  >
                    M
                  </span>
                )}
                {gitStatusMap?.[path] === 'added' && (
                  <span
                    title={t('statusAdded')}
                    className="ms-auto text-[10px] font-mono font-bold text-emerald-500 shrink-0"
                  >
                    A
                  </span>
                )}
              </button>
              <div
                className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                  isActive ? 'opacity-100' : 'opacity-70 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100'
                }`}
              >
                {onOpenFileToSide && (
                  <button
                    type="button"
                    title={t('openToSideTitle')}
                    aria-label={t('openToSideAria', name)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFileToSide(path);
                    }}
                    className="p-1 rounded hover:bg-slate-300/70 dark:hover:bg-slate-700"
                  >
                    <Columns2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  title={t('renameTitle')}
                  aria-label={t('renameAria', name)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingPath(path);
                    setRenameVal(path);
                  }}
                  className="p-1 rounded hover:bg-slate-300/70 dark:hover:bg-slate-700"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {!isMediaEntry(files[path]) && (
                  <button
                    type="button"
                    title={t('duplicateTitle')}
                    aria-label={t('duplicateAria', name)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateFile(path);
                    }}
                    className="p-1 rounded hover:bg-slate-300/70 dark:hover:bg-slate-700"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  title={t('deleteTitle')}
                  aria-label={t('deleteAria', name)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFile(path);
                  }}
                  className="p-1 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-500/15"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <aside
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFileList(e.dataTransfer?.files);
      }}
      className={`w-56 xl:w-64 shrink-0 flex flex-col border-e border-[#e5e5e5] dark:border-[#2b2b2b] bg-[#f3f3f3] dark:bg-[#252526] select-none overflow-hidden transition-colors ${
        dragOver ? 'ring-2 ring-inset ring-[#007acc] bg-[#007acc]/10' : ''
      }`}
    >
      <div className="px-3 py-2.5 border-b border-[#e5e5e5] dark:border-[#2b2b2b] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {editingProject ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onRenameProject?.(projectDraft);
                setEditingProject(false);
              }}
              className="flex-1 min-w-0 flex items-center gap-1"
            >
              <input
                autoFocus
                dir="ltr"
                value={projectDraft}
                onChange={(e) => setProjectDraft(e.target.value)}
                onBlur={() => {
                  onRenameProject?.(projectDraft);
                  setEditingProject(false);
                }}
                className="w-full px-2 py-0.5 text-xs font-mono rounded border border-sky-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              title={t('clickToRenameProject')}
              onClick={() => {
                setProjectDraft(projectName || 'my-codelab-project');
                setEditingProject(true);
              }}
              className="flex items-center gap-1.5 min-w-0 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
            >
              <span className="truncate font-mono" dir="ltr">
                {projectName || 'my-codelab-project'}
              </span>
              <Pencil className="w-3 h-3 shrink-0 text-slate-400" />
            </button>
          )}
          <button
            type="button"
            title={t('downloadTitle')}
            onClick={onExportWorkspace}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-sky-600 hover:bg-sky-500 text-white shrink-0 transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>{t('downloadBtn')}</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">{t('explorerFilesHeading')}</span>
          <div className="flex items-center justify-end flex-wrap gap-0.5">
            <button
              type="button"
              title={t('newFileTitle')}
              onClick={() => {
                setCreating({ type: 'file', prefix: '' });
                setDraftName('');
              }}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title={t('newLangFileTitle')}
              onClick={onOpenLanguagePicker}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <Languages className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title={t('newFolderTitle')}
              onClick={() => {
                setCreating({ type: 'folder', prefix: '' });
                setDraftName('');
              }}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title={t('uploadMediaTitle')}
              onClick={() => mediaUploadRef.current?.click()}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title={t('openLocalTitle')}
              onClick={onOpenLocalFile}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-sky-600 dark:text-sky-400 font-medium text-xs flex items-center gap-1"
            >
              <span>{t('openLocalShort')}</span>
            </button>
            <button
              type="button"
              title={t('saveLocalTitle')}
              onClick={onSaveLocalFile}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-medium text-xs flex items-center gap-1"
            >
              <span>{t('saveLocalShort')}</span>
            </button>
            <button
              type="button"
              title={t('importZipTitle')}
              disabled={extractingZip}
              onClick={() => zipUploadRef.current?.click()}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 disabled:opacity-50"
            >
              <FolderArchive className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title={t('uploadAnyTitle')}
              onClick={() => uploadRef.current?.click()}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title={t('clearAllTitle')}
              disabled={Object.keys(files).length === 0}
              onClick={() => setConfirmClearAll((v) => !v)}
              className="p-1.5 rounded-md hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            ref={zipUploadRef}
            type="file"
            multiple
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            onChange={(e) => {
              handleFileList(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={uploadRef}
            type="file"
            multiple
            accept=".zip,.json,.txt,.js,.ts,.jsx,.tsx,.html,.css,.py,.sql,.php,.md,image/*,video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              handleFileList(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={mediaUploadRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.svg"
            className="hidden"
            onChange={(e) => {
              handleFileList(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('filterFilesPlaceholder')}
            className="w-full ps-8 pe-6 py-1 text-xs rounded-sm bg-white dark:bg-[#3c3c3c] border border-[#cecece] dark:border-[#3c3c3c] text-[#1e1e1e] dark:text-[#cccccc] outline-none focus:border-[#007acc]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute end-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {confirmClearAll && Object.keys(files).length > 0 && (
        <div className="p-2.5 border-b border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 space-y-2">
          <div className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
            {t('confirmDeleteAll', Object.keys(files).length)}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onClearAllFiles?.();
                setConfirmClearAll(false);
                setQuery('');
                setCreating(null);
              }}
              className="flex-1 px-2.5 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500 text-white font-medium transition-colors"
            >
              {t('deleteAllConfirmBtn')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmClearAll(false)}
              className="px-2.5 py-1 text-xs rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              {t('cancelBtn')}
            </button>
          </div>
        </div>
      )}

      {creating && (
        <form onSubmit={submitCreate} className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
            {creating.type === 'folder' ? t('newFolderLabel') : t('newFileLabel', creating.prefix)}
          </div>
          <div className="flex gap-1.5">
            <input
              autoFocus
              dir="ltr"
              aria-label={creating.type === 'folder' ? t('newFolderLabel') : t('newFileLabel', creating.prefix)}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setCreating(null);
              }}
              placeholder={creating.type === 'folder' ? 'src' : 'main.rs'}
              className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded border border-sky-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none"
            />
            <button type="submit" className="px-2.5 py-1 text-xs rounded bg-sky-600 text-white font-medium">
              {t('createBtn')}
            </button>
            <button
              type="button"
              onClick={() => setCreating(null)}
              className="px-2 py-1 text-xs rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              {t('cancelBtn')}
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {extractingZip && (
          <div className="mb-2 px-2.5 py-2 rounded-md bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-600 dark:text-sky-300 text-center">
            {t('extractingZip')}
          </div>
        )}
        {visiblePaths.length ? (
          renderNode(tree)
        ) : Object.keys(files).length === 0 ? (
          <div className="text-center py-8 px-3 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('noFilesInProject')}</p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCreating({ type: 'file', prefix: '' });
                  setDraftName('');
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>{t('createNewFileBtn')}</span>
              </button>
              <button
                type="button"
                onClick={() => zipUploadRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <FolderArchive className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('importAndExtractZipBtn')}</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 text-center py-6">{t('noMatchingFiles')}</p>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-[#e5e5e5] dark:border-[#2b2b2b] text-[11px] text-[#616161] dark:text-[#969696] flex items-center justify-between tabular-nums">
        <span>{t('totalFilesDrop')}</span>
        <span>{Object.keys(files).length}</span>
      </div>
    </aside>
  );
}
