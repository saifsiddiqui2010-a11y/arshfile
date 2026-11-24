import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Check,
  Copy,
  Download,
  Eye,
  FileArchive,
  FileText,
  Film,
  Folder as FolderIcon,
  FolderPlus,
  Grid2x2,
  Image as ImageIcon,
  Layers,
  List,
  LogOut,
  Menu,
  Moon,
  Music,
  Search,
  Share2,
  Sun,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type {
  FileCategory,
  FileStatsMap,
  Folder,
  UploadedFile,
} from '../types/file.ts';
import {
  createFolder,
  deleteFolder,
  deleteUploadedFile,
  fetchOwnerStats,
} from '../services/fileService.ts';
import {
  buildFullUrl,
  formatBytes,
  formatRelativeTime,
  getVisibilityLabel,
  isInlineImage,
} from '../utils/format.ts';
import { UploadDropzone } from './UploadDropzone.tsx';
import { ShareModal } from './ShareModal.tsx';
import { PreviewModal } from './PreviewModal.tsx';
import { FileTypeIcon } from './FileIcon.tsx';

interface WorkspaceViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigateSharePage: (shareId: string) => void;
}

type FilterNav =
  | { type: 'all' }
  | { type: 'category'; category: FileCategory }
  | { type: 'folder'; folderId: string };

type SortKey = 'newest' | 'largest' | 'name';

export function WorkspaceView({
  isDark,
  onToggleTheme,
  onNavigateSharePage,
}: WorkspaceViewProps) {
  const { user, signOutUser, getIdToken } = useAuth();

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [stats, setStats] = useState<FileStatsMap>({});
  const [loadingFiles, setLoadingFiles] = useState(true);

  const [nav, setNav] = useState<FilterNav>({ type: 'all' });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showDropzone, setShowDropzone] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);

  const [shareFile, setShareFile] = useState<UploadedFile | null>(null);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [windowDragActive, setWindowDragActive] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);

  // Real-time Firestore listener for owner's files
  useEffect(() => {
    if (!user) return;
    setLoadingFiles(true);
    const q = query(collection(db, 'files'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: UploadedFile[] = snapshot.docs.map((d) => d.data() as UploadedFile);
        setFiles(list);
        setLoadingFiles(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'files');
      }
    );
    return () => unsub();
  }, [user]);

  // Real-time Firestore listener for owner's folders
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'folders'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Folder[] = snapshot.docs
          .map((d) => d.data() as Folder)
          .sort((a, b) => a.name.localeCompare(b.name));
        setFolders(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'folders');
      }
    );
    return () => unsub();
  }, [user]);

  // Keep active modals synchronized with real-time Firestore updates
  useEffect(() => {
    if (shareFile) {
      const updated = files.find((f) => f.shareId === shareFile.shareId);
      if (updated) setShareFile(updated);
    }
  }, [files, shareFile]);

  const refreshStats = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getIdToken();
      const next = await fetchOwnerStats(token);
      setStats(next);
    } catch {
      // ignore background stats fetch errors
    }
  }, [getIdToken, user]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats, files.length]);

  // Global drag-and-drop overlay support
  useEffect(() => {
    let dragCounter = 0;
    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        dragCounter += 1;
        setWindowDragActive(true);
      }
    };
    const onDragLeave = () => {
      dragCounter -= 1;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setWindowDragActive(false);
      }
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      dragCounter = 0;
      setWindowDragActive(false);
      const dropped = Array.from(e.dataTransfer?.files || []);
      if (dropped.length > 0) {
        e.preventDefault();
        setShowDropzone(true);
        setDroppedFiles(dropped);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<FileCategory, number> = {
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      archive: 0,
      other: 0,
    };
    for (const f of files) {
      counts[f.category] = (counts[f.category] || 0) + 1;
    }
    return counts;
  }, [files]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of files) {
      if (f.folderId) {
        counts[f.folderId] = (counts[f.folderId] || 0) + 1;
      }
    }
    return counts;
  }, [files]);

  const totalStorageBytes = useMemo(
    () => files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0),
    [files]
  );

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result = files.filter((f) => {
      if (nav.type === 'category' && f.category !== nav.category) return false;
      if (nav.type === 'folder' && f.folderId !== nav.folderId) return false;
      if (q) {
        const hay = `${f.fileName} ${f.mimeType} ${f.extension} ${f.description} ${f.shareId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'largest') return b.sizeBytes - a.sizeBytes;
      if (sortBy === 'name') return a.fileName.localeCompare(b.fileName);
      const timeA = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : Date.now();
      const timeB = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : Date.now();
      return timeB - timeA;
    });
    return result;
  }, [files, nav, searchQuery, sortBy]);

  const currentSectionTitle = useMemo(() => {
    if (nav.type === 'all') return 'All Files';
    if (nav.type === 'category') {
      const labels: Record<FileCategory, string> = {
        image: 'Images',
        video: 'Videos',
        audio: 'Audio',
        document: 'Documents',
        archive: 'Archives',
        other: 'Other Files',
      };
      return labels[nav.category];
    }
    return folders.find((f) => f.folderId === nav.folderId)?.name || 'Folder';
  }, [folders, nav]);

  const handleCopyLink = async (file: UploadedFile, mode: 'share' | 'direct') => {
    const url = buildFullUrl(mode === 'share' ? file.sharePath : file.directPath);
    const key = `${file.shareId}_${mode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(key);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      // ignore
    }
  };

  const handleDeleteFile = async (shareId: string) => {
    setDeletingId(shareId);
    setActionError(null);
    try {
      const token = await getIdToken();
      await deleteUploadedFile(shareId, token);
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete file.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setFolderBusy(true);
    setActionError(null);
    try {
      const id = await createFolder(newFolderName);
      setNewFolderName('');
      setNewFolderOpen(false);
      setNav({ type: 'folder', folderId: id });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create folder.');
    } finally {
      setFolderBusy(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setActionError(null);
    try {
      await deleteFolder(folderId);
      if (nav.type === 'folder' && nav.folderId === folderId) {
        setNav({ type: 'all' });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete folder.');
    }
  };

  const folderNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of folders) map[f.folderId] = f.name;
    return map;
  }, [folders]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
          DropLink
        </span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 shrink-0">
        <button
          type="button"
          onClick={() => {
            setShowDropzone(true);
            setMobileMenuOpen(false);
          }}
          className="w-full h-10 px-4 inline-flex items-center justify-center gap-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          <UploadCloud className="w-4 h-4" />
          Upload Files
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
        <div className="space-y-0.5">
          <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            Library
          </div>
          {(
            [
              { id: 'all', label: 'All Files', count: files.length, Icon: Layers, navVal: { type: 'all' } as FilterNav },
              { id: 'image', label: 'Images', count: categoryCounts.image, Icon: ImageIcon, navVal: { type: 'category', category: 'image' } as FilterNav },
              { id: 'video', label: 'Videos', count: categoryCounts.video, Icon: Film, navVal: { type: 'category', category: 'video' } as FilterNav },
              { id: 'audio', label: 'Audio', count: categoryCounts.audio, Icon: Music, navVal: { type: 'category', category: 'audio' } as FilterNav },
              { id: 'document', label: 'Documents', count: categoryCounts.document, Icon: FileText, navVal: { type: 'category', category: 'document' } as FilterNav },
              { id: 'archive', label: 'Archives', count: categoryCounts.archive, Icon: FileArchive, navVal: { type: 'category', category: 'archive' } as FilterNav },
            ] as const
          ).map(({ id, label, count, Icon, navVal }) => {
            const isActive =
              (nav.type === 'all' && navVal.type === 'all') ||
              (nav.type === 'category' && navVal.type === 'category' && nav.category === navVal.category);
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setNav(navVal);
                  setMobileMenuOpen(false);
                }}
                className={`w-full h-9 px-2.5 rounded-lg flex items-center justify-between text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                  <span className="truncate">{label}</span>
                </span>
                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom Folders */}
        <div className="space-y-1">
          <div className="px-2.5 pb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              Folders
            </span>
            <button
              type="button"
              onClick={() => setNewFolderOpen((v) => !v)}
              aria-label="Create folder"
              className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 rounded transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {newFolderOpen && (
            <form onSubmit={handleCreateFolder} className="px-1 pb-2 flex items-center gap-1.5">
              <input
                type="text"
                maxLength={80}
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                className="flex-1 h-8 px-2.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <button
                type="submit"
                disabled={folderBusy || !newFolderName.trim()}
                className="h-8 px-2.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
              >
                Add
              </button>
            </form>
          )}

          {folders.length === 0 ? (
            <p className="px-2.5 text-xs text-slate-400 dark:text-slate-500">
              No folders yet
            </p>
          ) : (
            folders.map((folder) => {
              const active = nav.type === 'folder' && nav.folderId === folder.folderId;
              return (
                <div
                  key={folder.folderId}
                  className={`group h-9 px-2.5 rounded-lg flex items-center justify-between text-xs font-medium transition-colors ${
                    active
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setNav({ type: 'folder', folderId: folder.folderId });
                      setMobileMenuOpen(false);
                    }}
                    className="flex-1 flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                  >
                    <FolderIcon className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {folderCounts[folder.folderId] || 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(folder.folderId)}
                      aria-label={`Delete folder ${folder.name}`}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </nav>

      {/* Storage Summary & Account Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4 shrink-0">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Stored</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">
              {formatBytes(totalStorageBytes)}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
            {files.length} {files.length === 1 ? 'file' : 'files'} · up to 250 MB per file
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Account'}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 shrink-0 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                {(user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user?.displayName || 'Account'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user?.email}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={signOutUser}
            title="Sign out"
            aria-label="Sign out"
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#FAFAFB] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-slate-950/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside className="w-[264px] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Workspace Header */}
        <header className="sticky top-0 z-20 h-16 px-4 sm:px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline whitespace-nowrap">
                Workspace
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {currentSectionTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files or types..."
                className="w-56 lg:w-64 h-9 pl-8 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>

            <select
              aria-label="Sort files"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-9 px-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="newest">Newest</option>
              <option value="largest">Largest</option>
              <option value="name">Name A–Z</option>
            </select>

            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                aria-label="Table view"
                className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Grid2x2 className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle color theme"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Main Workspace Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Mobile Search Input */}
          <div className="relative md:hidden">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files or types..."
              className="w-full h-9 pl-8 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>

          {actionError && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-red-500 hover:text-red-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Upload Zone */}
          {showDropzone && (
            <UploadDropzone
              folders={folders}
              defaultFolderId={nav.type === 'folder' ? nav.folderId : ''}
              getIdToken={getIdToken}
              compact={files.length > 0}
              externalFiles={droppedFiles}
              onExternalFilesConsumed={() => setDroppedFiles(null)}
              onUploadComplete={() => {
                void refreshStats();
              }}
              onOpenShare={(f) => setShareFile(f)}
            />
          )}

          {/* Section Count Bar */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {loadingFiles
                ? 'Loading files...'
                : `${filteredFiles.length} ${filteredFiles.length === 1 ? 'item' : 'items'}${
                    searchQuery ? ` matching "${searchQuery}"` : ''
                  }`}
            </p>
            {files.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDropzone((v) => !v)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                {showDropzone ? 'Hide upload area' : 'Show upload area'}
              </button>
            )}
          </div>

          {/* File Collection: Loading / Empty / Table / Grid */}
          {loadingFiles ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="h-14 px-4 flex items-center justify-between gap-4">
                  <div className="h-4 w-56 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  <div className="h-4 w-28 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 px-6 text-center space-y-3">
              <div className="w-11 h-11 mx-auto rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400">
                <UploadCloud className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {searchQuery ? 'No matching files' : 'No files uploaded yet'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try searching by file name, extension, or MIME type, or clear your current filter.'
                  : 'Drop any image, video, document, or archive above to generate an instant shareable URL.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="h-9 px-4 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 pl-4 pr-3">File</th>
                    <th className="py-3 px-3 hidden sm:table-cell">Access</th>
                    <th className="py-3 px-3 text-right">Size</th>
                    <th className="py-3 px-3 text-right hidden md:table-cell">Activity</th>
                    <th className="py-3 px-3 hidden lg:table-cell">Uploaded</th>
                    <th className="py-3 pl-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {filteredFiles.map((file) => {
                    const st = stats[file.shareId];
                    const shareCopied = copiedId === `${file.shareId}_share`;
                    const rawCopied = copiedId === `${file.shareId}_direct`;
                    const isConfirming = confirmDeleteId === file.shareId;

                    return (
                      <tr
                        key={file.shareId}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 pl-4 pr-3 max-w-[300px]">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 text-slate-500 hover:border-blue-400 transition-colors cursor-pointer"
                            >
                              {isInlineImage(file.mimeType) && file.visibility !== 'private' ? (
                                <img
                                  src={file.directPath}
                                  alt={file.fileName}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <FileTypeIcon
                                  category={file.category}
                                  extension={file.extension}
                                  className="w-4 h-4"
                                />
                              )}
                            </button>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setPreviewFile(file)}
                                className="block text-left text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[230px] sm:max-w-[280px] cursor-pointer"
                              >
                                {file.fileName}
                              </button>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {file.extension.toUpperCase()} · {file.mimeType}
                                {file.folderId && folderNameById[file.folderId]
                                  ? ` · ${folderNameById[file.folderId]}`
                                  : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 hidden sm:table-cell whitespace-nowrap">
                          <span
                            className={`text-xs font-medium ${
                              file.visibility === 'public'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : file.visibility === 'unlisted'
                                  ? 'text-blue-700 dark:text-blue-400'
                                  : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {getVisibilityLabel(file.visibility)}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {formatBytes(file.sizeBytes)}
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 hidden md:table-cell whitespace-nowrap">
                          {st ? `${st.views}v / ${st.downloads}d` : '0v / 0d'}
                        </td>

                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 hidden lg:table-cell whitespace-nowrap">
                          {formatRelativeTime(file.createdAt)}
                        </td>

                        <td className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={deletingId === file.shareId}
                                onClick={() => handleDeleteFile(file.shareId)}
                                className="h-7 px-2.5 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                              >
                                {deletingId === file.shareId ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="h-7 px-2 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleCopyLink(file, 'share')}
                                title="Copy Share Page URL"
                                className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                {shareCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    URL
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyLink(file, 'direct')}
                                title="Copy Direct File URL"
                                className="hidden xl:inline-flex h-8 px-2.5 items-center gap-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                {rawCopied ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  'Direct'
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => setShareFile(file)}
                                title="Share options, QR & embeds"
                                className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                Share
                              </button>

                              <button
                                type="button"
                                onClick={() => setPreviewFile(file)}
                                title="Preview file"
                                aria-label={`Preview ${file.fileName}`}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(file.shareId)}
                                title="Delete file"
                                aria-label={`Delete ${file.fileName}`}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredFiles.map((file) => {
                const st = stats[file.shareId];
                const shareCopied = copiedId === `${file.shareId}_share`;
                const isConfirming = confirmDeleteId === file.shareId;
                return (
                  <article
                    key={file.shareId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className="relative aspect-[16/10] w-full bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden cursor-pointer group"
                    >
                      {isInlineImage(file.mimeType) && file.visibility !== 'private' ? (
                        <img
                          src={file.directPath}
                          alt={file.fileName}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                          <FileTypeIcon
                            category={file.category}
                            extension={file.extension}
                            className="w-8 h-8"
                          />
                          <span className="font-mono text-xs uppercase text-slate-500 dark:text-slate-400">
                            .{file.extension}
                          </span>
                        </div>
                      )}
                    </button>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => setPreviewFile(file)}
                          className="block w-full text-left text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate cursor-pointer"
                        >
                          {file.fileName}
                        </button>
                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                          {formatBytes(file.sizeBytes)} · {getVisibilityLabel(file.visibility)} · {st ? `${st.views} views` : '0 views'}
                        </div>
                      </div>

                      {isConfirming ? (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            disabled={deletingId === file.shareId}
                            onClick={() => handleDeleteFile(file.shareId)}
                            className="h-8 px-3 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                          >
                            {deletingId === file.shareId ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-8 px-2.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(file, 'share')}
                              className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              {shareCopied ? (
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
                              onClick={() => setShareFile(file)}
                              className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              Share
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            {file.visibility !== 'private' && (
                              <a
                                href={file.downloadPath}
                                download={file.fileName}
                                title="Download file"
                                aria-label={`Download ${file.fileName}`}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(file.shareId)}
                              title="Delete file"
                              aria-label={`Delete ${file.fileName}`}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Global Drag-Over Overlay */}
      {windowDragActive && (
        <div className="fixed inset-0 z-50 bg-blue-950/50 backdrop-blur-[2px] flex items-center justify-center p-6 pointer-events-none">
          <div className="px-10 py-8 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-blue-500 text-center space-y-2 shadow-2xl">
            <UploadCloud className="w-10 h-10 mx-auto text-blue-600 dark:text-blue-400" />
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Release to upload to DropLink
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All file types accepted · instant share URLs generated automatically
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      {shareFile && (
        <ShareModal
          file={shareFile}
          folders={folders}
          getIdToken={getIdToken}
          onClose={() => setShareFile(null)}
          onNavigateSharePage={onNavigateSharePage}
        />
      )}

      {previewFile && (
        <PreviewModal
          file={previewFile}
          getIdToken={getIdToken}
          onClose={() => setPreviewFile(null)}
          onOpenShare={(f) => setShareFile(f)}
          onNavigateSharePage={onNavigateSharePage}
        />
      )}
    </div>
  );
}
