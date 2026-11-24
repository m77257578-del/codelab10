'use client';

import { useMemo, useRef, useState } from 'react';
import {
  FilePlus,
  FolderPlus,
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
} from 'lucide-react';
import { detectLang, detectMediaKind } from '../lib/workspaces';
import { isMediaEntry } from '../lib/storage';
import LanguageIcon from './LanguageIcon';

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
  onCreateFile,
  onOpenLanguagePicker,
  onRenameFile,
  onDuplicateFile,
  onDeleteFile,
  onImportFiles,
  onExportWorkspace,
  onClearAllFiles,
  onOpenLocalFile,
  onSaveLocalFile,
}) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [renamingPath, setRenamingPath] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [editingProject, setEditingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState(projectName || 'my-codelab-project');
  const [collapsed, setCollapsed] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const uploadRef = useRef(null);
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

    for (const f of list) {
      try {
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
      } catch {}
    }
    if (Object.keys(loaded).length) {
      onImportFiles(loaded, importedProjectName);
    }
  };

  const submitCreate = (e) => {
    e.preventDefault();
    const clean = draftName.trim().replace(/^\/+|\/+$/g, '');
    if (!clean) {
      setCreating(null);
      return;
    }
    if (creating.type === 'folder') {
      const full = `${creating.prefix ? creating.prefix + '/' : ''}${clean}/index.js`;
      onCreateFile(full, '// ملف جديد داخل المجلد\n');
    } else {
      const full = `${creating.prefix ? creating.prefix + '/' : ''}${clean}`;
      onCreateFile(full);
    }
    setDraftName('');
    setCreating(null);
  };

  const submitRename = (e, oldPath) => {
    e.preventDefault();
    const next = renameVal.trim().replace(/^\/+|\/+$/g, '');
    if (next && next !== oldPath) {
      onRenameFile(oldPath, next);
    }
    setRenamingPath(null);
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
                <button
                  type="button"
                  title="ملف جديد داخل المجلد"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed((c) => ({ ...c, [fullPrefix]: false }));
                    setCreating({ type: 'file', prefix: fullPrefix });
                    setDraftName('');
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-300/60 dark:hover:bg-slate-700"
                >
                  <FilePlus className="w-3.5 h-3.5" />
                </button>
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
                className="px-2 py-1"
                style={{ paddingInlineStart: `${12 + depth * 14}px` }}
              >
                <input
                  autoFocus
                  dir="ltr"
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onBlur={() => setRenamingPath(null)}
                  className="w-full px-2 py-1 text-xs font-mono rounded border border-sky-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none"
                />
              </form>
            );
          }
          return (
            <div
              key={path}
              onClick={() => onSelectFile(path)}
              style={{ paddingInlineStart: `${12 + depth * 14}px` }}
              className={`group flex items-center justify-between gap-1.5 px-2 py-1.5 text-xs rounded-md cursor-pointer transition-colors ${
                isActive
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 font-medium'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0" dir="ltr">
                {renderIcon(path)}
                <span className="truncate font-mono">{name}</span>
              </div>
              <div
                className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                  isActive ? 'opacity-100' : 'opacity-70 md:opacity-0 md:group-hover:opacity-100'
                }`}
              >
                <button
                  type="button"
                  title="إعادة تسمية"
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
                    title="تكرار الملف"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateFile(path);
                    }}
                    className="p-1 rounded hover:bg-slate-300/70 dark:hover:bg-slate-700"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                )}
                {Object.keys(files).length > 1 && (
                  <button
                    type="button"
                    title="حذف الملف"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(path);
                    }}
                    className="p-1 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-500/15"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
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
      className={`w-56 xl:w-64 shrink-0 flex flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0f172a] select-none overflow-hidden transition-colors ${
        dragOver ? 'ring-2 ring-inset ring-sky-500 bg-sky-500/10' : ''
      }`}
    >
      <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
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
              title="اضغط لتغيير اسم المشروع"
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
            title="تسمية وتنزيل المشروع على جهازك"
            onClick={onExportWorkspace}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-sky-600 hover:bg-sky-500 text-white shrink-0 transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>تنزيل</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">الملفات</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="ملف جديد"
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
              title="اختيار لغة برمجة جديدة"
              onClick={onOpenLanguagePicker}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <Languages className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="مجلد جديد"
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
              title="رفع صور / فيديو / صوت"
              onClick={() => mediaUploadRef.current?.click()}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="فتح ملف محلي (File System Access)"
              onClick={onOpenLocalFile}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-sky-600 dark:text-sky-400 font-medium text-xs flex items-center gap-1"
            >
              <span>فتح ملف</span>
            </button>
            <button
              type="button"
              title="حفظ الملف الحالي محلياً"
              onClick={onSaveLocalFile}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-medium text-xs flex items-center gap-1"
            >
              <span>حفظ</span>
            </button>
            <button
              type="button"
              title="رفع ملفات كود أو وسائط"
              onClick={() => uploadRef.current?.click()}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="مسح سريع لجميع الكود والملفات"
              onClick={() => {
                if (window.confirm('هل أنت متأكد من مسح جميع ملفات المشروع الحالية وبدء ملف فارغ؟')) {
                  onClearAllFiles?.();
                }
              }}
              className="p-1.5 rounded-md hover:bg-rose-500/15 text-rose-600 dark:text-rose-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            ref={uploadRef}
            type="file"
            multiple
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
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="تصفية الملفات..."
            className="w-full pr-8 pl-6 py-1.5 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute left-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {creating && (
        <form onSubmit={submitCreate} className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
            {creating.type === 'folder' ? 'اسم المجلد الجديد:' : `اسم الملف${creating.prefix ? ` داخل ${creating.prefix}` : ''}:`}
          </div>
          <div className="flex gap-1.5">
            <input
              autoFocus
              dir="ltr"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={creating.type === 'folder' ? 'src' : 'main.rs'}
              className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded border border-sky-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none"
            />
            <button type="submit" className="px-2.5 py-1 text-xs rounded bg-sky-600 text-white font-medium">
              إنشاء
            </button>
            <button
              type="button"
              onClick={() => setCreating(null)}
              className="px-2 py-1 text-xs rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {visiblePaths.length ? (
          renderNode(tree)
        ) : (
          <p className="text-xs text-slate-500 text-center py-6">لا توجد ملفات مطابقة</p>
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between tabular-nums">
        <span>إجمالي الملفات · اسحب للرفع</span>
        <span>{Object.keys(files).length}</span>
      </div>
    </aside>
  );
}
