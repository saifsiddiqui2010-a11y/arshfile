import type { Timestamp } from 'firebase/firestore';
import type { FileCategory, FileVisibility } from '../types/file.ts';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

export function formatDate(value: Timestamp | string | Date | null | undefined): string {
  if (!value) return 'Just now';
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else if (typeof value.toDate === 'function') {
    date = value.toDate();
  } else {
    return 'Just now';
  }
  if (Number.isNaN(date.getTime())) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatRelativeTime(value: Timestamp | string | Date | null | undefined): string {
  if (!value) return 'Just now';
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value)
        : typeof value.toDate === 'function'
          ? value.toDate()
          : null;
  if (!date || Number.isNaN(date.getTime())) return 'Just now';

  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'Just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return formatDate(date);
}

export function getCategoryLabel(category: FileCategory): string {
  switch (category) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'document':
      return 'Document';
    case 'archive':
      return 'Archive';
    default:
      return 'File';
  }
}

export function getVisibilityLabel(visibility: FileVisibility): string {
  switch (visibility) {
    case 'public':
      return 'Public';
    case 'unlisted':
      return 'Anyone with link';
    case 'private':
      return 'Private';
  }
}

export function buildFullUrl(relativePath: string): string {
  if (typeof window === 'undefined') return relativePath;
  return `${window.location.origin}${relativePath}`;
}

export function buildEmbedSnippet(
  kind: 'html' | 'markdown' | 'bbcode' | 'curl',
  opts: {
    fileName: string;
    category: FileCategory;
    directUrl: string;
    shareUrl: string;
    downloadUrl: string;
  }
): string {
  const safeAlt = opts.fileName.replace(/["<>[\]]/g, '');
  switch (kind) {
    case 'html':
      if (opts.category === 'image') {
        return `<img src="${opts.directUrl}" alt="${safeAlt}" loading="lazy" />`;
      }
      if (opts.category === 'video') {
        return `<video src="${opts.directUrl}" controls playsinline preload="metadata"></video>`;
      }
      if (opts.category === 'audio') {
        return `<audio src="${opts.directUrl}" controls preload="metadata"></audio>`;
      }
      return `<a href="${opts.shareUrl}" target="_blank" rel="noopener noreferrer">${safeAlt}</a>`;
    case 'markdown':
      if (opts.category === 'image') {
        return `![${safeAlt}](${opts.directUrl})`;
      }
      return `[${safeAlt}](${opts.shareUrl})`;
    case 'bbcode':
      if (opts.category === 'image') {
        return `[img]${opts.directUrl}[/img]`;
      }
      return `[url=${opts.shareUrl}]${safeAlt}[/url]`;
    case 'curl':
      return `curl -L -o "${safeAlt || 'file'}" "${opts.downloadUrl}"`;
  }
}

export function isTextPreviewable(mimeType: string, extension: string, sizeBytes: number): boolean {
  if (sizeBytes > 512 * 1024) return false;
  const mime = mimeType.toLowerCase();
  if (mime === 'text/plain' || mime === 'text/csv' || mime === 'application/json') return true;
  return ['txt', 'md', 'json', 'csv', 'log', 'yaml', 'yml', 'toml', 'ini', 'env'].includes(
    extension.toLowerCase()
  );
}

export function isInlineImage(mimeType: string): boolean {
  return [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/bmp',
  ].includes(mimeType.toLowerCase());
}

export function isInlineVideo(mimeType: string): boolean {
  return ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'].includes(
    mimeType.toLowerCase()
  );
}

export function isInlineAudio(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('audio/');
}
