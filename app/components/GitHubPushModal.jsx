'use client';

import { useEffect, useState } from 'react';
import { X, GitBranch, Lock, Globe, ExternalLink, Copy, Check, LogOut, UploadCloud } from 'lucide-react';
import { sanitizeProjectName } from '../lib/storage';

export default function GitHubPushModal({
  open,
  onClose,
  projectName,
  files,
  githubUser,
  githubSessionToken,
  onConnectGitHub,
  onDisconnectGitHub,
  onPushSuccess,
}) {
  const [repoName, setRepoName] = useState(sanitizeProjectName(projectName));
  const [description, setDescription] = useState('Built with CodeLab IDE');
  const [commitMessage, setCommitMessage] = useState('Initial commit from CodeLab IDE');
  const [isPrivate, setIsPrivate] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [oauthConfig, setOauthConfig] = useState({ checked: false, configured: true, redirectUri: '' });
  const [errorMsg, setErrorMsg] = useState(null);
  const [result, setResult] = useState(null);
  const [copiedUri, setCopiedUri] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRepoName(sanitizeProjectName(projectName));
    setErrorMsg(null);
    setResult(null);
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

  if (!open) return null;

  const handlePush = async (e) => {
    e.preventDefault();
    if (!githubSessionToken || pushing) return;
    setErrorMsg(null);
    setResult(null);
    setPushing(true);

    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${githubSessionToken}`,
        },
        body: JSON.stringify({
          repoName,
          description,
          isPrivate,
          commitMessage,
          files,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || 'تعذر رفع المشروع إلى GitHub.');
      } else {
        setResult(data);
        onPushSuccess?.(data);
      }
    } catch {
      setErrorMsg('حدث خطأ في الاتصال أثناء الرفع إلى GitHub.');
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-sky-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              رفع المشروع مباشرة إلى GitHub
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-auto">
          {!githubSessionToken ? (
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                سجّل الدخول بحسابك على GitHub لإنشاء مستودع جديد بالاسم الذي تختاره ورفع جميع ملفات الكود والوسائط مباشرة من المحرر.
              </p>

              {oauthConfig.checked && !oauthConfig.configured && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-200 space-y-2">
                  <div className="font-semibold">خطوة إعداد GitHub OAuth (مرة واحدة):</div>
                  <p>
                    أضف <span className="font-mono">GITHUB_CLIENT_ID</span> و <span className="font-mono">GITHUB_CLIENT_SECRET</span> في لوحة{' '}
                    <strong>Settings &gt; Secrets</strong>، وضع رابط الاستدعاء التالي في إعدادات تطبيق OAuth على GitHub:
                  </p>
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
                <span>ربط حساب GitHub الآن</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handlePush} className="space-y-4">
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
                  <span>فصل</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  اسم المستودع (Repository Name)
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
                  وصف المستودع (اختياري)
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  رسالة الحفظ (Commit Message)
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
                  <span>مستودع عام (Public)</span>
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
                  <span>مستودع خاص (Private)</span>
                </button>
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {errorMsg}
                </div>
              )}

              {result && (
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200 space-y-2">
                  <div className="font-semibold">تم رفع {result.filesCount} ملف بنجاح إلى GitHub!</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={result.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold underline"
                    >
                      <span>فتح المستودع</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    {result.commitUrl && (
                      <a
                        href={result.commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline"
                      >
                        <span>عرض الـ Commit</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={pushing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{pushing ? 'جارٍ الرفع إلى GitHub...' : `رفع ${Object.keys(files).length} ملف إلى GitHub`}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
