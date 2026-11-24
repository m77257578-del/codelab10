'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowLeftRight,
  ChevronRight,
  Columns2,
  FolderArchive,
  ImageIcon,
  Film,
  Music,
  Rows2,
  X,
} from 'lucide-react';
import MediaViewerPane from './MediaViewerPane';

const CodeEditorPane = dynamic(() => import('./CodeEditorPane'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-white dark:bg-[#1e1e1e]" />,
});
import LanguageIcon from './LanguageIcon';
import { detectLang, detectMediaKind, getLangMeta } from '../lib/workspaces';
import { isMediaEntry } from '../lib/storage';
import { MAX_EDITOR_GROUPS } from '../lib/editorGroups';

export default function EditorGroupPane({
  group,
  groupIndex,
  totalGroups,
  isFocusedGroup,
  splitDirection,
  files,
  projectName,
  theme,
  fontSize,
  tabSize,
  wordWrap,
  showMinimap = true,
  typingFullMobile,
  onFocusGroup,
  onSelectTab,
  onCloseTab,
  onSplitGroup,
  onToggleSplitDirection,
  onCloseGroup,
  onMoveActiveTab,
  onFileChange,
  onCursorChange,
  onEditorFocusChange,
  onRegisterEditorApi,
  onRunShortcut,
  onInsertIntoHtml,
  onOpenQuickOpen,
  onOpenLanguages,
  onOpenTemplates,
  onOpenZip,
  onSelectFirstFile,
}) {
  const localEditorRef = useRef(null);

  useEffect(() => {
    onRegisterEditorApi?.(group.id, localEditorRef);
    return () => {
      onRegisterEditorApi?.(group.id, null);
    };
  }, [group.id, onRegisterEditorApi]);

  const activeFile = group.activeFile;
  const activeEntry = activeFile ? files[activeFile] : undefined;
  const activeIsMedia = isMediaEntry(activeEntry);
  const activeCode = typeof activeEntry === 'string' ? activeEntry : '';
  const activeLang = detectLang(activeFile);
  const activeMeta = getLangMeta(activeLang);

  const renderTabIcon = (path) => {
    const kind = detectMediaKind(path, files[path]);
    if (kind === 'image') return <ImageIcon className="w-3.5 h-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />;
    if (kind === 'video') return <Film className="w-3.5 h-3.5 shrink-0 text-purple-500 dark:text-purple-400" />;
    if (kind === 'audio') return <Music className="w-3.5 h-3.5 shrink-0 text-pink-500 dark:text-pink-400" />;
    return <LanguageIcon lang={detectLang(path)} size={15} />;
  };

  return (
    <div
      data-testid="editor-group"
      data-group-id={group.id}
      data-active={isFocusedGroup ? 'true' : 'false'}
      onMouseDown={() => onFocusGroup(group.id)}
      className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-[#1e1e1e]"
    >
      {/* VS Code Editor Group Tabs Bar */}
      {!typingFullMobile && (
        <div
          className="h-9 shrink-0 flex items-center justify-between bg-[#ececec] dark:bg-[#252526] border-b border-[#e5e5e5] dark:border-[#2b2b2b]"
          dir="ltr"
        >
          <div
            role="tablist"
            aria-label={`تبويبات القسم ${groupIndex + 1}`}
            className="flex-1 min-w-0 h-full flex items-center overflow-x-auto no-scrollbar"
          >
            {group.tabs.map((path) => {
              const isActive = path === activeFile;
              const name = path.split('/').pop();
              return (
                <div
                  key={path}
                  className={`group h-full flex items-center border-r border-[#e5e5e5] dark:border-[#252526] transition-colors shrink-0 ${
                    isActive
                      ? isFocusedGroup
                        ? 'bg-white dark:bg-[#1e1e1e] text-[#1e1e1e] dark:text-white border-t-2 border-t-[#007acc]'
                        : 'bg-white/95 dark:bg-[#1e1e1e] text-[#444444] dark:text-[#cccccc] border-t-2 border-t-[#9e9e9e] dark:border-t-[#5a5a5a]'
                      : 'bg-[#ececec] dark:bg-[#2d2d2d] text-[#616161] dark:text-[#969696] hover:bg-[#e4e4e4] dark:hover:bg-[#323233]'
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelectTab(group.id, path)}
                    className="h-full flex items-center gap-2 pl-3 pr-1.5 text-xs font-mono whitespace-nowrap cursor-pointer"
                  >
                    {renderTabIcon(path)}
                    <span>{name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`إغلاق ${name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(group.id, path);
                    }}
                    className={`mr-1.5 p-0.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-opacity ${
                      isActive ? 'opacity-90' : 'opacity-0 group-hover:opacity-90 focus:opacity-90'
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* VS Code Group Actions (Split Editor, Toggle Orientation, Move Tab, Close Group) */}
          <div className="flex items-center gap-0.5 px-1.5 h-full shrink-0 border-l border-[#dcdcdc] dark:border-[#333333] bg-[#ececec] dark:bg-[#252526]">
            {activeFile && totalGroups === 1 && (
              <div className="hidden lg:flex items-center gap-1.5 px-1.5 text-[11px] font-mono text-[#717171] dark:text-[#8c8c8c] shrink-0">
                <LanguageIcon lang={activeLang} size={13} />
                <span className="shrink-0">{activeMeta.label}</span>
              </div>
            )}

            {totalGroups < MAX_EDITOR_GROUPS && Object.keys(files).length > 0 && (
              <button
                type="button"
                title="تقسيم المحرر (Ctrl+\)"
                aria-label={totalGroups === 1 ? 'تقسيم الشاشة' : `تقسيم القسم ${groupIndex + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSplitGroup(group.id);
                }}
                className="p-1 rounded-sm text-[#616161] dark:text-[#cccccc] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                {splitDirection === 'vertical' ? (
                  <Rows2 className="w-3.5 h-3.5" />
                ) : (
                  <Columns2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {totalGroups > 1 && groupIndex === 0 && (
              <button
                type="button"
                title={splitDirection === 'horizontal' ? 'تبديل إلى تقسيم أفقي (أعلى / أسفل)' : 'تبديل إلى تقسيم عمودي (جنباً إلى جنب)'}
                aria-label="تبديل اتجاه التقسيم"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSplitDirection();
                }}
                className="p-1.5 rounded-sm text-[#616161] dark:text-[#cccccc] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                {splitDirection === 'horizontal' ? (
                  <Rows2 className="w-3.5 h-3.5" />
                ) : (
                  <Columns2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {totalGroups > 1 && activeFile && (
              <button
                type="button"
                title="نقل التبويب الحالي إلى القسم المجاور"
                aria-label={`نقل ${activeFile} إلى القسم المجاور`}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveActiveTab(group.id, activeFile);
                }}
                className="p-1.5 rounded-sm text-[#616161] dark:text-[#cccccc] hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            )}

            {totalGroups > 1 && (
              <button
                type="button"
                title="إغلاق هذا القسم"
                aria-label={`إغلاق القسم ${groupIndex + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseGroup(group.id);
                }}
                className="p-1.5 rounded-sm text-[#616161] dark:text-[#cccccc] hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* VS Code Breadcrumbs Bar */}
      {!typingFullMobile && activeFile && (
        <div
          dir="ltr"
          className="h-6 shrink-0 flex items-center gap-1 px-3 bg-white dark:bg-[#1e1e1e] border-b border-[#f0f0f0] dark:border-[#2b2b2b] text-[11px] font-mono text-[#616161] dark:text-[#969696] overflow-x-auto no-scrollbar select-none"
        >
          <button
            type="button"
            onClick={() => {
              onFocusGroup(group.id);
              onOpenQuickOpen();
            }}
            className="hover:text-[#1e1e1e] dark:hover:text-[#cccccc] transition-colors shrink-0"
          >
            {projectName}
          </button>
          {activeFile.split('/').map((seg, idx, arr) => {
            const isLast = idx === arr.length - 1;
            return (
              <span key={`${seg}-${idx}`} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="w-3 h-3 opacity-60" />
                {isLast ? (
                  <span className="flex items-center gap-1.5 text-[#1e1e1e] dark:text-[#cccccc] font-medium">
                    {renderTabIcon(activeFile)}
                    <span>{seg}</span>
                  </span>
                ) : (
                  <span>{seg}</span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* CodeMirror Editor OR Media Viewer OR Empty State */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeFile && activeEntry !== undefined ? (
          activeIsMedia ? (
            <MediaViewerPane
              path={activeFile}
              media={activeEntry}
              onInsertIntoHtml={onInsertIntoHtml}
            />
          ) : (
            <CodeEditorPane
              value={activeCode}
              onChange={(val) => onFileChange(activeFile, val)}
              lang={activeLang}
              files={files}
              theme={theme}
              fontSize={fontSize}
              tabSize={tabSize}
              wordWrap={wordWrap}
              showMinimap={showMinimap}
              onCursorChange={(c) => onCursorChange(group.id, c)}
              onFocusChange={(focused) => onEditorFocusChange(group.id, focused)}
              editorRefOut={localEditorRef}
              onRunShortcut={onRunShortcut}
            />
          )
        ) : Object.keys(files).length > 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <p>لا يوجد ملف مفتوح في هذا القسم</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectFirstFile(group.id)}
                className="px-4 py-2 rounded-sm bg-[#007acc] hover:bg-[#1f8ad2] text-white text-xs font-semibold"
              >
                فتح الملف الرئيسي
              </button>
              {totalGroups > 1 && (
                <button
                  type="button"
                  onClick={() => onCloseGroup(group.id)}
                  className="px-3 py-2 rounded-sm border border-[#d4d4d4] dark:border-[#3c3c3c] text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  إغلاق القسم
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>لا توجد ملفات في المشروع حالياً</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onOpenLanguages}
                className="px-4 py-2 rounded-sm bg-[#007acc] hover:bg-[#1f8ad2] text-white text-xs font-semibold"
              >
                إنشاء ملف جديد
              </button>
              <button
                type="button"
                onClick={onOpenZip}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm border border-[#d4d4d4] dark:border-[#3c3c3c] hover:bg-black/5 dark:hover:bg-white/5 text-[#1e1e1e] dark:text-[#cccccc] text-xs font-medium"
              >
                <FolderArchive className="w-3.5 h-3.5 text-amber-500" />
                <span>استيراد وفك ضغط ZIP</span>
              </button>
              <button
                type="button"
                onClick={onOpenTemplates}
                className="px-4 py-2 rounded-sm border border-[#d4d4d4] dark:border-[#3c3c3c] hover:bg-black/5 dark:hover:bg-white/5 text-[#1e1e1e] dark:text-[#cccccc] text-xs font-medium"
              >
                اختيار قالب جاهز
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
