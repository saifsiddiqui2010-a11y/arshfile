import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Link2,
  Lock,
  Moon,
  QrCode,
  Share2,
  Sun,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { PublicFileMeta } from '../types/file.ts';
import { fetchPrivateTicket, fetchPublicFileMeta } from '../services/fileService.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  buildFullUrl,
  formatBytes,
  formatDate,
  getCategoryLabel,
  getVisibilityLabel,
  isInlineAudio,
  isInlineImage,
  isInlineVideo,
  isTextPreviewable,
} from '../utils/format.ts';
import { FileTypeIcon } from './FileIcon.tsx';

interface SharePageProps {
  shareId: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onGoHome: () => void;
}

export function SharePage({ shareId, isDark, onToggleTheme, onGoHome }: SharePageProps) {
  const { user, loading: authLoading, getIdToken, signInWithGoogle } = useAuth();
  const [meta, setMeta] = useState<PublicFileMeta | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'private' | 'not_found' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [ticket, setTicket] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    async function load() {
      setStatus('loading');
      setMediaFailed(false);
      setTextContent(null);
      let token: string | null = null;
      if (user) {
        try {
          token = await getIdToken();
        } catch {
          token = null;
        }
      }

      const result = await fetchPublicFileMeta(shareId, { token, track: true });
      if (!active) return;

      if (result.status === 200 && result.data) {
        setMeta(result.data);
        if (result.data.visibility === 'private' && token) {
          const t = await fetchPrivateTicket(shareId, token);
          if (active) setTicket(t);
        } else {
          setTicket(null);
        }
        setStatus('ready');
      } else if (result.status === 403) {
        setErrorMsg(result.error || 'This file is private.');
        setStatus('private');
      } else if (result.status === 404) {
        setErrorMsg(result.error || 'This file could not be found.');
        setStatus('not_found');
      } else {
        setErrorMsg(result.error || 'Unable to load shared file.');
        setStatus('error');
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [authLoading, getIdToken, shareId, user]);

  const shareUrl = buildFullUrl(`/s/${shareId}`);
  const querySuffix = ticket ? `?ticket=${encodeURIComponent(ticket)}` : '';
  const rawSrc = meta ? `${meta.directPath}${querySuffix}` : '';
  const directUrl = meta ? buildFullUrl(meta.directPath) : '';
  const downloadHref = meta ? `${meta.downloadPath}${querySuffix}` : '';

  useEffect(() => {
    if (!meta) return;
    let active = true;
    QRCode.toDataURL(shareUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [meta, shareUrl]);

  useEffect(() => {
    if (!meta || status !== 'ready') return;
    if (!isTextPreviewable(meta.mimeType, meta.extension, meta.sizeBytes)) return;
    let active = true;
    fetch(rawSrc)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Failed'))))
      .then((txt) => {
        if (active) setTextContent(txt);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [meta, rawSrc, status]);

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      // ignore
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && meta) {
      try {
        await navigator.share({
          title: meta.fileName,
          text: meta.description || `Shared file: ${meta.fileName}`,
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled
      }
    }
    await copyText('share', shareUrl);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFB] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* Top Bar */}
      <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={onGoHome}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
        >
          DropLink
        </button>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle color theme"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onGoHome}
            className="h-9 px-4 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {user ? 'My Workspace' : 'Upload Files'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {status === 'loading' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 h-[460px] rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
            <div className="lg:col-span-4 h-[360px] rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
          </div>
        ) : status === 'private' ? (
          <div className="max-w-md mx-auto mt-16 p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Private file
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {errorMsg}
            </p>
            {!user && (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="h-10 px-5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Sign in with Google
              </button>
            )}
          </div>
        ) : status !== 'ready' || !meta ? (
          <div className="max-w-md mx-auto mt-16 p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              File not found
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {errorMsg || 'This link may have expired or been removed by its owner.'}
            </p>
            <button
              type="button"
              onClick={onGoHome}
              className="h-10 px-5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Go to DropLink
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Media / Artifact Stage */}
            <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                  <FileTypeIcon category={meta.category} extension={meta.extension} className="w-4 h-4 shrink-0" />
                  <span className="truncate font-mono">{meta.mimeType}</span>
                </div>
                {isInlineImage(meta.mimeType) && !mediaFailed && (
                  <button
                    type="button"
                    onClick={() => setZoomed((z) => !z)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    {zoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                    {zoomed ? 'Fit' : 'Actual size'}
                  </button>
                )}
              </div>

              <div className="min-h-[380px] max-h-[72vh] overflow-auto bg-slate-100/80 dark:bg-slate-950 flex items-center justify-center p-6">
                {!meta.available || mediaFailed ? (
                  <div className="text-center space-y-3 max-w-sm">
                    <div className="w-14 h-14 mx-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500">
                      <FileTypeIcon category={meta.category} extension={meta.extension} className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {meta.available ? 'Inline preview not available' : 'File content is currently unavailable'}
                    </p>
                    {meta.available && (
                      <a
                        href={downloadHref}
                        download={meta.fileName}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download {meta.extension.toUpperCase()}
                      </a>
                    )}
                  </div>
                ) : isInlineImage(meta.mimeType) ? (
                  <img
                    src={rawSrc}
                    alt={meta.fileName}
                    referrerPolicy="no-referrer"
                    onError={() => setMediaFailed(true)}
                    className={
                      zoomed
                        ? 'max-w-none rounded-lg'
                        : 'max-w-full max-h-[64vh] object-contain rounded-lg'
                    }
                  />
                ) : isInlineVideo(meta.mimeType) ? (
                  <video
                    src={rawSrc}
                    controls
                    playsInline
                    onError={() => setMediaFailed(true)}
                    className="max-w-full max-h-[64vh] rounded-lg bg-black"
                  />
                ) : isInlineAudio(meta.mimeType) ? (
                  <div className="w-full max-w-md p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <FileTypeIcon category="audio" extension={meta.extension} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {meta.fileName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatBytes(meta.sizeBytes)}
                        </div>
                      </div>
                    </div>
                    <audio src={rawSrc} controls className="w-full" onError={() => setMediaFailed(true)} />
                  </div>
                ) : meta.mimeType === 'application/pdf' ? (
                  <iframe
                    src={rawSrc}
                    title={meta.fileName}
                    className="w-full h-[64vh] rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
                  />
                ) : textContent !== null ? (
                  <pre className="w-full max-h-[64vh] overflow-auto p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                    {textContent}
                  </pre>
                ) : (
                  <div className="text-center space-y-4 p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-md">
                    <div className="w-16 h-16 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
                      <FileTypeIcon category={meta.category} extension={meta.extension} className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-base font-semibold text-slate-900 dark:text-slate-100 break-all">
                        {meta.fileName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {meta.extension.toUpperCase()} · {formatBytes(meta.sizeBytes)}
                      </div>
                    </div>
                    <a
                      href={downloadHref}
                      download={meta.fileName}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download File
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Right Inspector Panel */}
            <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
              <div className="space-y-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 break-words leading-snug">
                  {meta.fileName}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Shared by {meta.ownerDisplayName} · {formatDate(meta.createdAt)}
                </p>
                {meta.description && (
                  <p className="text-sm text-slate-700 dark:text-slate-300 pt-1 leading-relaxed">
                    {meta.description}
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <a
                  href={downloadHref}
                  download={meta.fileName}
                  className="w-full h-10 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  Download ({formatBytes(meta.sizeBytes)})
                </a>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => copyText('direct', directUrl)}
                    className="h-9 px-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {copiedKey === 'direct' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Direct URL
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="h-9 px-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {copiedKey === 'share' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        Share
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Clean Key-Value Details (No pills) */}
              <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Type</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">
                    {getCategoryLabel(meta.category)} · {meta.extension.toUpperCase()}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Size</dt>
                  <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {formatBytes(meta.sizeBytes)}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Access</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">
                    {getVisibilityLabel(meta.visibility)}
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Activity</dt>
                  <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {meta.views} views · {meta.downloads} downloads
                  </dd>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400 shrink-0">SHA-256</dt>
                  <dd className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[140px]" title={meta.sha256}>
                      {meta.sha256}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText('sha', meta.sha256)}
                      aria-label="Copy SHA-256 checksum"
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
                    >
                      {copiedKey === 'sha' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </dd>
                </div>
              </dl>

              {/* Share URL + QR Toggle */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 inline-flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    Share link
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQr((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    {showQr ? 'Hide QR' : 'Show QR'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 h-8 px-2.5 text-[11px] font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => copyText('shareUrl', shareUrl)}
                    className="h-8 px-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {copiedKey === 'shareUrl' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {showQr && qrUrl && (
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <img
                      src={qrUrl}
                      alt={`QR code for ${meta.fileName}`}
                      referrerPolicy="no-referrer"
                      className="w-36 h-36 rounded-lg border border-slate-200 bg-white p-1.5"
                    />
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
