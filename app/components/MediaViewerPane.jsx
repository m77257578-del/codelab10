'use client';

import { useState } from 'react';
import { Copy, Check, Code2, ImageIcon, Film, Music } from 'lucide-react';
import { formatBytes } from '../lib/storage';
import { useI18n } from '../lib/LocaleContext';

export default function MediaViewerPane({ path, media, onInsertIntoHtml }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [dimensions, setDimensions] = useState(null);

  const kind = media.mime?.startsWith('image/')
    ? 'image'
    : media.mime?.startsWith('video/')
      ? 'video'
      : 'audio';

  const snippet =
    kind === 'image'
      ? `<img src="${path}" alt="${path.split('/').pop()}" style="max-width: 100%; border-radius: 8px;" />`
      : kind === 'video'
        ? `<video src="${path}" controls style="max-width: 100%; border-radius: 8px;"></video>`
        : `<audio src="${path}" controls></audio>`;

  const copySnippet = async () => {
    try {
      await navigator.clipboard?.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0b1120] overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]">
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          {kind === 'image' ? (
            <ImageIcon className="w-4 h-4 text-emerald-500" />
          ) : kind === 'video' ? (
            <Film className="w-4 h-4 text-purple-500" />
          ) : (
            <Music className="w-4 h-4 text-pink-500" />
          )}
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100" dir="ltr">
            {path}
          </span>
          <span className="text-slate-400">·</span>
          <span className="font-mono text-slate-500 dark:text-slate-400" dir="ltr">
            {media.mime}
          </span>
          <span className="text-slate-400">·</span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">
            {formatBytes(media.size)}
          </span>
          {dimensions && (
            <>
              <span className="text-slate-400">·</span>
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">
                {dimensions.w} × {dimensions.h}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copySnippet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t('copied') : t('copyHtml')}</span>
          </button>
          {onInsertIntoHtml && (
            <button
              type="button"
              onClick={() => onInsertIntoHtml(snippet)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{t('insertInHtml')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-auto bg-slate-100 dark:bg-[#090d16]">
        {kind === 'image' && (
          <img
            src={media.dataUrl}
            alt={path}
            referrerPolicy="no-referrer"
            onLoad={(e) => setDimensions({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="max-w-full max-h-full rounded-lg border border-slate-300 dark:border-slate-700 object-contain shadow-sm"
          />
        )}
        {kind === 'video' && (
          <video
            src={media.dataUrl}
            controls
            onLoadedMetadata={(e) =>
              setDimensions({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })
            }
            className="max-w-full max-h-full rounded-lg border border-slate-300 dark:border-slate-700 bg-black shadow-sm"
          />
        )}
        {kind === 'audio' && (
          <div className="w-full max-w-md p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-pink-500/10 text-pink-500 grid place-items-center">
              <Music className="w-6 h-6" />
            </div>
            <div className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100 truncate" dir="ltr">
              {path}
            </div>
            <audio src={media.dataUrl} controls className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
