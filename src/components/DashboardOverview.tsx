import { useMemo } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  Play,
  Share2,
} from 'lucide-react';
import type { FileCategory, FileStatsMap, UploadedFile } from '../types/file.ts';
import {
  formatBytes,
  formatRelativeTime,
  getVisibilityLabel,
  isInlineImage,
  isInlineVideo,
} from '../utils/format.ts';
import { FileTypeIcon } from './FileIcon.tsx';

interface DashboardOverviewProps {
  files: UploadedFile[];
  stats: FileStatsMap;
  copiedId: string | null;
  activeCategory: FileCategory | null;
  onSelectCategory: (category: FileCategory | null) => void;
  onCopyUrl: (file: UploadedFile) => void;
  onOpenShare: (file: UploadedFile) => void;
  onOpenPreview: (file: UploadedFile) => void;
}

const CATEGORY_META: Array<{
  key: FileCategory;
  label: string;
  barClass: string;
}> = [
  { key: 'image', label: 'Images', barClass: 'bg-blue-600 dark:bg-blue-500' },
  { key: 'video', label: 'Videos', barClass: 'bg-teal-600 dark:bg-teal-500' },
  { key: 'audio', label: 'Audio', barClass: 'bg-amber-500 dark:bg-amber-400' },
  { key: 'document', label: 'Documents', barClass: 'bg-indigo-600 dark:bg-indigo-400' },
  { key: 'archive', label: 'Archives', barClass: 'bg-slate-500 dark:bg-slate-400' },
  { key: 'other', label: 'Other', barClass: 'bg-slate-400 dark:bg-slate-600' },
];

export function DashboardOverview({
  files,
  stats,
  copiedId,
  activeCategory,
  onSelectCategory,
  onCopyUrl,
  onOpenShare,
  onOpenPreview,
}: DashboardOverviewProps) {
  const metrics = useMemo(() => {
    let totalBytes = 0;
    let totalViews = 0;
    let totalDownloads = 0;
    let shareableCount = 0;
    let privateCount = 0;

    const bytesByCategory: Record<FileCategory, number> = {
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      archive: 0,
      other: 0,
    };

    const countByCategory: Record<FileCategory, number> = {
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      archive: 0,
      other: 0,
    };

    for (const f of files) {
      const sz = f.sizeBytes || 0;
      totalBytes += sz;
      bytesByCategory[f.category] = (bytesByCategory[f.category] || 0) + sz;
      countByCategory[f.category] = (countByCategory[f.category] || 0) + 1;
      if (f.visibility === 'private') {
        privateCount += 1;
      } else {
        shareableCount += 1;
      }
      const st = stats[f.shareId];
      if (st) {
        totalViews += st.views || 0;
        totalDownloads += st.downloads || 0;
      }
    }

    return {
      totalBytes,
      totalViews,
      totalDownloads,
      shareableCount,
      privateCount,
      bytesByCategory,
      countByCategory,
    };
  }, [files, stats]);

  const recentFiles = useMemo(() => {
    return [...files]
      .sort((a, b) => {
        const tA = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : Date.now();
        const tB = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : Date.now();
        return tB - tA;
      })
      .slice(0, 4);
  }, [files]);

  const activeSegments = useMemo(() => {
    if (metrics.totalBytes <= 0) return [];
    return CATEGORY_META.filter((c) => metrics.bytesByCategory[c.key] > 0).map((c) => ({
      ...c,
      bytes: metrics.bytesByCategory[c.key],
      count: metrics.countByCategory[c.key],
      pct: Math.max(3, (metrics.bytesByCategory[c.key] / metrics.totalBytes) * 100),
    }));
  }, [metrics]);

  return (
    <div className="space-y-6">
      {/* Unified 4-Column KPI Strip + Proportional Storage Bar */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          <div className="p-5 space-y-1.5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Files
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {files.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {metrics.countByCategory.image} img · {metrics.countByCategory.video} vid ·{' '}
              {files.length - metrics.countByCategory.image - metrics.countByCategory.video} other
            </div>
          </div>

          <div className="p-5 space-y-1.5 border-l border-slate-200 dark:border-slate-800 lg:border-l-0">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Storage Used
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {formatBytes(metrics.totalBytes)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              All formats · 250 MB / file limit
            </div>
          </div>

          <div className="p-5 space-y-1.5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Link Views
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {metrics.totalViews}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {metrics.shareableCount} active share links
            </div>
          </div>

          <div className="p-5 space-y-1.5 border-l border-slate-200 dark:border-slate-800 lg:border-l-0">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Downloads
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {metrics.totalDownloads}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {metrics.privateCount} private · {metrics.shareableCount} shared
            </div>
          </div>
        </div>

        {/* Interactive Storage Breakdown Bar */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-2.5">
          <div className="h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden flex gap-0.5">
            {activeSegments.length > 0 ? (
              activeSegments.map((seg) => (
                <button
                  key={seg.key}
                  type="button"
                  title={`${seg.label}: ${formatBytes(seg.bytes)} (${seg.count})`}
                  onClick={() =>
                    onSelectCategory(activeCategory === seg.key ? null : seg.key)
                  }
                  style={{ width: `${seg.pct}%` }}
                  className={`h-full transition-opacity cursor-pointer ${seg.barClass} ${
                    activeCategory && activeCategory !== seg.key
                      ? 'opacity-30'
                      : 'opacity-100 hover:opacity-85'
                  }`}
                />
              ))
            ) : (
              <div className="h-full w-full bg-slate-200 dark:bg-slate-800" />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {CATEGORY_META.map((cat) => {
                const count = metrics.countByCategory[cat.key];
                const bytes = metrics.bytesByCategory[cat.key];
                const isSelected = activeCategory === cat.key;
                if (count === 0 && files.length > 0) return null;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => onSelectCategory(isSelected ? null : cat.key)}
                    className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'text-blue-700 dark:text-blue-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-xs shrink-0 ${cat.barClass}`} />
                    <span>{cat.label}</span>
                    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {formatBytes(bytes)}
                    </span>
                  </button>
                );
              })}
              {files.length === 0 && (
                <span className="text-slate-400 dark:text-slate-500">
                  Storage distribution appears automatically after your first upload.
                </span>
              )}
            </div>

            {activeCategory && (
              <button
                type="button"
                onClick={() => onSelectCategory(null)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
              >
                Show all types
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Recent Uploads Visual Spotlight (shown when user has files) */}
      {recentFiles.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Uploads
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Latest {recentFiles.length} {recentFiles.length === 1 ? 'link' : 'links'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {recentFiles.map((file) => {
              const st = stats[file.shareId];
              const isCopied = copiedId === `${file.shareId}_share`;
              const showImage = isInlineImage(file.mimeType) && file.visibility !== 'private';
              const showVideo = isInlineVideo(file.mimeType) && file.visibility !== 'private';

              return (
                <article
                  key={file.shareId}
                  className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => onOpenPreview(file)}
                    className="relative aspect-[16/10] w-full bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    {showImage ? (
                      <img
                        src={file.directPath}
                        alt={file.fileName}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                      />
                    ) : showVideo ? (
                      <>
                        <video
                          src={file.directPath}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-studio-grid flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                        <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <FileTypeIcon
                            category={file.category}
                            extension={file.extension}
                            className="w-5 h-5"
                          />
                        </div>
                        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          .{file.extension}
                        </span>
                      </div>
                    )}

                    {/* Subtle hover scrim with quick inspect indicator */}
                    <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between text-[11px] text-white">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Eye className="w-3 h-3" />
                        Preview
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </div>
                  </button>

                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenPreview(file)}
                        className="block w-full text-left text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate cursor-pointer"
                      >
                        {file.fileName}
                      </button>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                        {getVisibilityLabel(file.visibility)} · {formatRelativeTime(file.createdAt)}
                        {st ? ` · ${st.views}v / ${st.downloads}d` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => onCopyUrl(file)}
                        className="flex-1 h-8 px-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy URL
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenShare(file)}
                        aria-label={`Share ${file.fileName}`}
                        className="h-8 px-2.5 inline-flex items-center justify-center gap-1 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Share
                      </button>

                      {file.visibility !== 'private' && (
                        <a
                          href={file.downloadPath}
                          download={file.fileName}
                          aria-label={`Download ${file.fileName}`}
                          title="Download"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
