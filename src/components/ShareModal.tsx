import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Link2,
  Lock,
  Mail,
  QrCode,
  Share2,
  X,
} from 'lucide-react';
import type { FileVisibility, Folder, UploadedFile } from '../types/file.ts';
import { updateFileMetadata } from '../services/fileService.ts';
import {
  buildEmbedSnippet,
  buildFullUrl,
  formatBytes,
  formatDate,
  getCategoryLabel,
} from '../utils/format.ts';
import { FileTypeIcon } from './FileIcon.tsx';

interface ShareModalProps {
  file: UploadedFile;
  folders: Folder[];
  getIdToken: () => Promise<string>;
  onClose: () => void;
  onNavigateSharePage: (shareId: string) => void;
}

type EmbedTab = 'html' | 'markdown' | 'bbcode' | 'curl';

export function ShareModal({
  file,
  folders,
  getIdToken,
  onClose,
  onNavigateSharePage,
}: ShareModalProps) {
  const [visibility, setVisibility] = useState<FileVisibility>(file.visibility);
  const [fileName, setFileName] = useState(file.fileName);
  const [folderId, setFolderId] = useState(file.folderId);
  const [description, setDescription] = useState(file.description);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [embedTab, setEmbedTab] = useState<EmbedTab>('html');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showQr, setShowQr] = useState(false);

  const shareUrl = buildFullUrl(file.sharePath);
  const directUrl = buildFullUrl(file.directPath);
  const downloadUrl = buildFullUrl(file.downloadPath);

  useEffect(() => {
    setVisibility(file.visibility);
    setFileName(file.fileName);
    setFolderId(file.folderId);
    setDescription(file.description);
  }, [file]);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(shareUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shareUrl]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleVisibilityChange = async (next: FileVisibility) => {
    setVisibility(next);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const token = await getIdToken();
      await updateFileMetadata({
        shareId: file.shareId,
        token,
        updates: { visibility: next },
      });
      setSaveMessage('Access level updated');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setVisibility(file.visibility);
      setSaveError(err instanceof Error ? err.message : 'Failed to update access level.');
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fileName.trim();
    if (!trimmed) {
      setSaveError('File name cannot be empty.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const token = await getIdToken();
      await updateFileMetadata({
        shareId: file.shareId,
        token,
        updates: {
          fileName: trimmed,
          description: description.trim(),
          folderId,
          visibility,
        },
      });
      setSaveMessage('Changes saved');
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: file.fileName,
          text: description || `Shared file: ${file.fileName}`,
          url: shareUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      await copyText('native', shareUrl);
    }
  };

  const snippet = buildEmbedSnippet(embedTab, {
    fileName: fileName || file.fileName,
    category: file.category,
    directUrl,
    shareUrl,
    downloadUrl,
  });

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(fileName || file.fileName);

  const isDirty =
    fileName.trim() !== file.fileName ||
    description.trim() !== file.description ||
    folderId !== file.folderId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
              <FileTypeIcon category={file.category} extension={file.extension} className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="share-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate"
              >
                {file.fileName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {getCategoryLabel(file.category)} · {file.extension.toUpperCase()} · {formatBytes(file.sizeBytes)} · Uploaded {formatDate(file.createdAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Access Visibility Control */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Link access
              </h3>
              {saveMessage && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {saveMessage}
                </span>
              )}
              {saveError && (
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {saveError}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    value: 'unlisted',
                    label: 'Anyone with link',
                    desc: 'Accessible via generated URL',
                    Icon: Link2,
                  },
                  {
                    value: 'public',
                    label: 'Public',
                    desc: 'Open share page & direct URL',
                    Icon: Globe,
                  },
                  {
                    value: 'private',
                    label: 'Private',
                    desc: 'Only your account can open',
                    Icon: Lock,
                  },
                ] as const
              ).map(({ value, label, desc, Icon }) => {
                const active = visibility === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleVisibilityChange(value)}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Generated URLs */}
          <section className="space-y-3 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Generated URLs
              </h3>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateSharePage(file.shareId);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap cursor-pointer"
              >
                Open share page
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {visibility === 'private' && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg px-3 py-2">
                This file is currently Private. Switch access to "Anyone with link" or "Public" before sharing these URLs with others.
              </p>
            )}

            <div className="space-y-2.5">
              {[
                { key: 'share', label: 'Share Page URL', value: shareUrl },
                { key: 'direct', label: 'Direct File URL', value: directUrl },
                { key: 'download', label: 'Direct Download URL', value: downloadUrl },
              ].map((row) => (
                <div key={row.key} className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {row.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={row.value}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 h-9 px-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => copyText(row.key, row.value)}
                      className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedKey === row.key ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Share Channels + QR Code */}
          <section className="space-y-3 pt-5 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Share directly
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleNativeShare}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                {copiedKey === 'native' ? 'Link Copied' : 'Share Link'}
              </button>

              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                className={`h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  showQr
                    ? 'border-slate-900 dark:border-slate-200 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                {showQr ? 'Hide QR Code' : 'QR Code'}
              </button>

              <a
                href={`mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`View or download "${fileName}": ${shareUrl}`)}`}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${fileName} — ${shareUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                WhatsApp
              </a>

              <a
                href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Telegram
              </a>

              <a
                href={`https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Post on X
              </a>
            </div>

            {showQr && qrDataUrl && (
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${file.fileName}`}
                  referrerPolicy="no-referrer"
                  className="w-36 h-36 rounded-lg border border-slate-200 bg-white p-1.5 shrink-0"
                />
                <div className="space-y-2 text-center sm:text-left">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Scan to open on mobile
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Points directly to your DropLink share page for quick preview and download on phones or tablets.
                  </p>
                  <a
                    href={qrDataUrl}
                    download={`${file.shareId}-qr.png`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PNG
                  </a>
                </div>
              </div>
            )}
          </section>

          {/* Embed Snippets */}
          <section className="space-y-3 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Embed & code snippets
              </h3>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {(['html', 'markdown', 'bbcode', 'curl'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setEmbedTab(tab)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      embedTab === tab
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {tab === 'html'
                      ? 'HTML'
                      : tab === 'markdown'
                        ? 'Markdown'
                        : tab === 'bbcode'
                          ? 'BBCode'
                          : 'cURL'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <pre className="flex-1 p-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 overflow-x-auto">
                <code>{snippet}</code>
              </pre>
              <button
                type="button"
                onClick={() => copyText('snippet', snippet)}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey === 'snippet' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Metadata Edit Form */}
          <form onSubmit={handleSaveDetails} className="space-y-3 pt-5 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              File details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="edit-filename" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Display name
                </label>
                <input
                  id="edit-filename"
                  type="text"
                  maxLength={255}
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-folder" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Folder
                </label>
                <select
                  id="edit-folder"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="">All Files (Root)</option>
                  {folders.map((f) => (
                    <option key={f.folderId} value={f.folderId}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-description" className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Note (shown on share page)
              </label>
              <textarea
                id="edit-description"
                rows={2}
                maxLength={500}
                placeholder="Add an optional note or context for recipients..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono text-slate-400 truncate max-w-[260px]" title={file.sha256}>
                SHA-256: {file.sha256.slice(0, 16)}...
              </span>
              <button
                type="submit"
                disabled={saving || !isDirty}
                className="h-9 px-4 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
