import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Share2,
  X,
} from 'lucide-react';
import type { UploadedFile } from '../types/file.ts';
import { fetchPrivateTicket } from '../services/fileService.ts';
import {
  buildFullUrl,
  formatBytes,
  formatDate,
  getCategoryLabel,
  isInlineAudio,
  isInlineImage,
  isInlineVideo,
  isTextPreviewable,
} from '../utils/format.ts';
import { FileTypeIcon } from './FileIcon.tsx';

interface PreviewModalProps {
  file: UploadedFile;
  getIdToken: () => Promise<string>;
  onClose: () => void;
  onOpenShare: (file: UploadedFile) => void;
  onNavigateSharePage: (shareId: string) => void;
}

export function PreviewModal({
  file,
  getIdToken,
  onClose,
  onOpenShare,
  onNavigateSharePage,
}: PreviewModalProps) {
  const [ticket, setTicket] = useState<string | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(file.visibility === 'private');
  const [textContent, setTextContent] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    setMediaError(false);
    setTextContent(null);

    if (file.visibility === 'private') {
      setLoadingTicket(true);
      getIdToken()
        .then((tok) => fetchPrivateTicket(file.shareId, tok))
        .then((t) => {
          if (active) {
            setTicket(t);
            setLoadingTicket(false);
          }
        })
        .catch(() => {
          if (active) setLoadingTicket(false);
        });
    } else {
      setTicket(null);
      setLoadingTicket(false);
    }

    return () => {
      active = false;
    };
  }, [file.shareId, file.visibility, getIdToken]);

  const querySuffix = ticket ? `?ticket=${encodeURIComponent(ticket)}` : '';
  const rawSrc = `${file.directPath}${querySuffix}`;
  const downloadHref = `${file.downloadPath}${querySuffix}`;
  const shareUrl = buildFullUrl(file.sharePath);

  const canTextPreview = isTextPreviewable(file.mimeType, file.extension, file.sizeBytes);

  useEffect(() => {
    if (!canTextPreview || loadingTicket) return;
    let active = true;
    fetch(rawSrc)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Failed'))))
      .then((txt) => {
        if (active) setTextContent(txt);
      })
      .catch(() => {
        if (active) setTextContent(null);
      });
    return () => {
      active = false;
    };
  }, [canTextPreview, loadingTicket, rawSrc]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${file.fileName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {file.fileName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {getCategoryLabel(file.category)} · {file.mimeType} · {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenShare(file);
              }}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
            <a
              href={downloadHref}
              download={file.fileName}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media Stage */}
        <div className="flex-1 min-h-[320px] max-h-[70vh] overflow-auto bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-6">
          {loadingTicket ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Loading secure preview...
            </div>
          ) : mediaError ? (
            <div className="text-center space-y-3 max-w-sm">
              <div className="w-12 h-12 mx-auto rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                <FileTypeIcon category={file.category} extension={file.extension} className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Preview unavailable for this file
              </p>
              <a
                href={downloadHref}
                download={file.fileName}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download file
              </a>
            </div>
          ) : isInlineImage(file.mimeType) ? (
            <img
              src={rawSrc}
              alt={file.fileName}
              referrerPolicy="no-referrer"
              onError={() => setMediaError(true)}
              className="max-w-full max-h-[62vh] object-contain rounded-lg"
            />
          ) : isInlineVideo(file.mimeType) ? (
            <video
              src={rawSrc}
              controls
              playsInline
              onError={() => setMediaError(true)}
              className="max-w-full max-h-[62vh] rounded-lg bg-black"
            />
          ) : isInlineAudio(file.mimeType) ? (
            <div className="w-full max-w-md p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <FileTypeIcon category="audio" extension={file.extension} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {file.fileName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {formatBytes(file.sizeBytes)}
                  </div>
                </div>
              </div>
              <audio src={rawSrc} controls className="w-full" onError={() => setMediaError(true)} />
            </div>
          ) : file.mimeType === 'application/pdf' ? (
            <iframe
              src={rawSrc}
              title={file.fileName}
              className="w-full h-[62vh] rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
            />
          ) : canTextPreview && textContent !== null ? (
            <pre className="w-full h-full max-h-[62vh] overflow-auto p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
              {textContent}
            </pre>
          ) : (
            <div className="text-center space-y-4 max-w-md p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="w-14 h-14 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <FileTypeIcon category={file.category} extension={file.extension} className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">
                  {file.fileName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {file.extension.toUpperCase()} · {file.mimeType} · {formatBytes(file.sizeBytes)}
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <a
                  href={downloadHref}
                  download={file.fileName}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download file
                </a>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateSharePage(file.shareId);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Open share page
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
