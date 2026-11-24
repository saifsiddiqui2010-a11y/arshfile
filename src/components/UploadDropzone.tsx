import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  FileArchive,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Music,
  Share2,
  UploadCloud,
  X,
} from 'lucide-react';
import type { FileVisibility, Folder, UploadedFile, UploadQueueItem } from '../types/file.ts';
import { uploadFileWithProgress } from '../services/fileService.ts';
import { buildFullUrl, formatBytes } from '../utils/format.ts';

interface UploadDropzoneProps {
  folders: Folder[];
  defaultFolderId: string;
  getIdToken: () => Promise<string>;
  onUploadComplete: (file: UploadedFile) => void;
  onOpenShare: (file: UploadedFile) => void;
  onNotify?: (message: string) => void;
  compact?: boolean;
  externalFiles?: File[] | null;
  onExternalFilesConsumed?: () => void;
}

export function UploadDropzone({
  folders,
  defaultFolderId,
  getIdToken,
  onUploadComplete,
  onOpenShare,
  onNotify,
  compact = false,
  externalFiles,
  onExternalFilesConsumed,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [visibility, setVisibility] = useState<FileVisibility>('unlisted');
  const [folderId, setFolderId] = useState<string>(defaultFolderId);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setFolderId(defaultFolderId);
  }, [defaultFolderId]);

  const startUploads = useCallback(
    async (fileList: File[]) => {
      if (!fileList.length) return;

      const items: UploadQueueItem[] = fileList.map((file) => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        progress: 0,
        status: 'uploading',
      }));

      setQueue((prev) => [...items, ...prev].slice(0, 20));

      let token: string;
      try {
        token = await getIdToken();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication required.';
        setQueue((prev) =>
          prev.map((q) =>
            items.some((i) => i.id === q.id)
              ? { ...q, status: 'error', error: message }
              : q
          )
        );
        return;
      }

      for (const item of items) {
        if (item.file.size > 250 * 1024 * 1024) {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, status: 'error', error: 'File exceeds the 250 MB limit.' }
                : q
            )
          );
          continue;
        }

        try {
          const uploaded = await uploadFileWithProgress({
            file: item.file,
            visibility,
            folderId,
            token,
            onProgress: (pct) => {
              setQueue((prev) =>
                prev.map((q) =>
                  q.id === item.id
                    ? { ...q, progress: pct, status: pct >= 99 ? 'saving' : 'uploading' }
                    : q
                )
              );
            },
          });

          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, progress: 100, status: 'done', uploaded }
                : q
            )
          );
          onUploadComplete(uploaded);
          onNotify?.(`Uploaded "${uploaded.fileName}" — URL ready`);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed.';
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id ? { ...q, status: 'error', error: message } : q
            )
          );
        }
      }
    },
    [folderId, getIdToken, onNotify, onUploadComplete, visibility]
  );

  useEffect(() => {
    if (externalFiles && externalFiles.length > 0) {
      void startUploads(externalFiles);
      onExternalFilesConsumed?.();
    }
  }, [externalFiles, onExternalFilesConsumed, startUploads]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length > 0) {
        e.preventDefault();
        void startUploads(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [startUploads]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      void startUploads(files);
    }
  };

  const handleCopy = async (id: string, url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      onNotify?.(`${label} copied to clipboard`);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const dismissQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCompleted = () => {
    setQueue((prev) => prev.filter((item) => item.status === 'uploading' || item.status === 'saving'));
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative rounded-xl border transition-all duration-150 bg-studio-grid overflow-hidden ${
          isDragging
            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
            : 'border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400/70 dark:hover:border-blue-500/50'
        } ${compact ? 'p-5 sm:p-6' : 'p-7 sm:p-9'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
              void startUploads(files);
            }
            e.target.value = '';
          }}
        />

        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Drop files here to generate instant URLs
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl">
                Upload any format up to 250 MB or press Ctrl+V to paste screenshots. Every file gets a share page, direct URL, embed code, and QR code.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Images
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  Streaming Video
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Audio
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  PDF & Docs
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FileArchive className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  ZIP & Any Binary
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 h-10">
              <label htmlFor="upload-visibility" className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Access
              </label>
              <select
                id="upload-visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as FileVisibility)}
                className="text-xs font-semibold bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                <option value="unlisted" className="bg-white dark:bg-slate-900">Anyone with link</option>
                <option value="public" className="bg-white dark:bg-slate-900">Public</option>
                <option value="private" className="bg-white dark:bg-slate-900">Private</option>
              </select>
            </div>

            {folders.length > 0 && (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 h-10">
                <label htmlFor="upload-folder" className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Folder
                </label>
                <select
                  id="upload-folder"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="text-xs font-semibold bg-transparent text-slate-900 dark:text-slate-100 max-w-[130px] truncate focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-white dark:bg-slate-900">Root</option>
                  {folders.map((f) => (
                    <option key={f.folderId} value={f.folderId} className="bg-white dark:bg-slate-900">
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="h-10 px-5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 cursor-pointer"
            >
              Select Files
            </button>
          </div>
        </div>
      </div>

      {queue.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              Transfers · {queue.length} {queue.length === 1 ? 'file' : 'files'}
            </span>
            {queue.some((q) => q.status === 'done' || q.status === 'error') && (
              <button
                type="button"
                onClick={clearCompleted}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Clear finished
              </button>
            )}
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {queue.map((item) => {
              const shareUrl = item.uploaded ? buildFullUrl(item.uploaded.sharePath) : '';
              const directUrl = item.uploaded ? buildFullUrl(item.uploaded.directPath) : '';
              return (
                <li key={item.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.file.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums shrink-0">
                        {formatBytes(item.file.size)}
                      </span>
                    </div>

                    {item.status === 'uploading' || item.status === 'saving' ? (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-150"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums w-20 text-right">
                          {item.status === 'saving' ? 'Saving...' : `${item.progress}%`}
                        </span>
                      </div>
                    ) : item.status === 'error' ? (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.error}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-mono truncate">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{shareUrl}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'done' && item.uploaded && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopy(`${item.id}_share`, shareUrl, 'Share URL')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {copiedId === `${item.id}_share` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Link2 className="w-3.5 h-3.5" />
                              Share Link
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(`${item.id}_raw`, directUrl, 'Direct URL')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {copiedId === `${item.id}_raw` ? (
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
                          onClick={() => onOpenShare(item.uploaded!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Share
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => dismissQueueItem(item.id)}
                      aria-label="Dismiss transfer"
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
