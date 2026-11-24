import { useState } from 'react';
import {
  ArrowRight,
  Copy,
  FileArchive,
  FileText,
  Film,
  Image as ImageIcon,
  Lock,
  QrCode,
  Share2,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

type FormatSampleKey = 'image' | 'video' | 'document' | 'archive';

const FORMAT_SAMPLES: Record<
  FormatSampleKey,
  {
    label: string;
    fileName: string;
    mimeType: string;
    size: string;
    sharePath: string;
    directPath: string;
    snippet: string;
    note: string;
  }
> = {
  image: {
    label: 'Images',
    fileName: 'product-launch-hero.webp',
    mimeType: 'image/webp',
    size: '1.8 MB',
    sharePath: '/s/k9Xp2mQ4vL8n',
    directPath: '/api/raw/k9Xp2mQ4vL8n',
    snippet: '<img src="https://droplink.app/api/raw/k9Xp2mQ4vL8n" alt="product-launch-hero.webp" />',
    note: 'PNG, JPEG, WebP, GIF, AVIF, SVG — direct inline image URLs and Markdown embeds.',
  },
  video: {
    label: 'Videos',
    fileName: 'walkthrough-1080p.mp4',
    mimeType: 'video/mp4',
    size: '48.4 MB',
    sharePath: '/s/r4Tn7wB2cJ5q',
    directPath: '/api/raw/r4Tn7wB2cJ5q',
    snippet: '<video src="https://droplink.app/api/raw/r4Tn7wB2cJ5q" controls playsinline></video>',
    note: 'MP4, WebM, MOV, OGG — served with HTTP byte-range streaming for instant scrubbing.',
  },
  document: {
    label: 'Documents',
    fileName: 'q4-architecture-spec.pdf',
    mimeType: 'application/pdf',
    size: '4.2 MB',
    sharePath: '/s/m2Hs9dF6pK1z',
    directPath: '/api/raw/m2Hs9dF6pK1z',
    snippet: '[q4-architecture-spec.pdf](https://droplink.app/s/m2Hs9dF6pK1z)',
    note: 'PDF, DOCX, XLSX, TXT, JSON, CSV, Markdown — inline preview plus SHA-256 verification.',
  },
  archive: {
    label: 'Any File',
    fileName: 'release-v2.4-bundle.zip',
    mimeType: 'application/zip',
    size: '112.0 MB',
    sharePath: '/s/v8Cy3nR5xM0t',
    directPath: '/api/download/v8Cy3nR5xM0t',
    snippet: 'curl -L -o "release-v2.4-bundle.zip" "https://droplink.app/api/download/v8Cy3nR5xM0t"',
    note: 'ZIP, TAR, 7Z, APK, DMG, audio tracks, or raw binaries up to 250 MB per upload.',
  },
};

export function LandingView() {
  const { signInWithGoogle, authError } = useAuth();
  const [selectedSample, setSelectedSample] = useState<FormatSampleKey>('image');
  const activeSample = FORMAT_SAMPLES[selectedSample];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFB] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 h-16 px-6 lg:px-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-8">
        <a
          href="/"
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          DropLink
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-400">
          <a href="#upload" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Upload
          </a>
          <a href="#formats" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Formats
          </a>
          <a href="#sharing" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Sharing
          </a>
          <a href="#access" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Access
          </a>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={signInWithGoogle}
            className="h-9 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Sign in with Google
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section id="upload" className="max-w-6xl mx-auto px-6 lg:px-10 pt-16 pb-20 lg:pt-24 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Universal File Hosting · Images, Video & All Formats
              </p>
              <h1
                className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.1]"
                style={{ textWrap: 'balance' }}
              >
                Upload any file. Share a direct URL in seconds.
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                Drop images, streaming videos, audio tracks, PDFs, archives, or binaries into your workspace. Every upload generates a clean share page, a direct file URL, embed snippets, and a scannable QR code.
              </p>

              {authError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2 max-w-md">
                  {authError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="h-11 px-6 inline-flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Start Uploading
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#formats"
                  className="h-11 px-5 inline-flex items-center text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  Inspect URL Formats
                </a>
              </div>
            </div>

            {/* Interactive Format & URL Generator Preview */}
            <div className="lg:col-span-6 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Generated Output Preview
                </span>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {(
                    [
                      { key: 'image', label: 'Image' },
                      { key: 'video', label: 'Video' },
                      { key: 'document', label: 'Docs' },
                      { key: 'archive', label: 'Any' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedSample(item.key)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        selectedSample === item.key
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                        {selectedSample === 'image' && <ImageIcon className="w-5 h-5" />}
                        {selectedSample === 'video' && <Film className="w-5 h-5" />}
                        {selectedSample === 'document' && <FileText className="w-5 h-5" />}
                        {selectedSample === 'archive' && <FileArchive className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {activeSample.fileName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {activeSample.mimeType} · {activeSample.size}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                      Link Ready
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Shareable Viewer Page
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                        {typeof window !== 'undefined' ? window.location.origin : 'https://droplink.app'}
                        {activeSample.sharePath}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Direct File URL
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                        {typeof window !== 'undefined' ? window.location.origin : 'https://droplink.app'}
                        {activeSample.directPath}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Ready-to-paste Embed Snippet
                      </div>
                      <pre className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 overflow-x-auto">
                        <code>{activeSample.snippet}</code>
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeSample.note}
                  </p>
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Upload yours
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capability Grid separated by hairline dividers */}
        <section
          id="formats"
          className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50"
        >
          <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
            <div className="max-w-xl space-y-2 mb-12">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Built for every file type and workflow
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No format lock-in or image-only restrictions. Organize uploads into folders and control exactly who can view or download each link.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <div id="sharing" className="space-y-2.5">
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200">
                  <Copy className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Direct URLs & Embeds
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Get a dedicated share page URL, a raw media URL with byte-range streaming for video and audio, plus one-click HTML, Markdown, BBCode, and cURL snippets.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200">
                  <QrCode className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Multi-Channel Sharing & QR
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Share straight from the browser via native Share Sheet, downloadable QR codes for mobile handoff, Email, WhatsApp, Telegram, or X.
                </p>
              </div>

              <div id="access" className="space-y-2.5">
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Granular Access & Integrity
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Switch any file between Public, Anyone with link, or Private at any time. Every upload is fingerprinted with a SHA-256 checksum and isolated from active script execution.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-6 lg:px-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>DropLink · Universal file hosting & link sharing</span>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Sign in to open workspace
          </button>
        </div>
      </footer>
    </div>
  );
}
