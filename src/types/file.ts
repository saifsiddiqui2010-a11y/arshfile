import type { Timestamp } from 'firebase/firestore';

export type FileVisibility = 'public' | 'unlisted' | 'private';

export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

export interface UploadedFile {
  shareId: string;
  ownerId: string;
  ownerDisplayName: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  category: FileCategory;
  extension: string;
  sizeBytes: number;
  sha256: string;
  visibility: FileVisibility;
  folderId: string;
  description: string;
  directPath: string;
  downloadPath: string;
  sharePath: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Folder {
  folderId: string;
  ownerId: string;
  name: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface FileStats {
  views: number;
  downloads: number;
  available: boolean;
}

export type FileStatsMap = Record<string, FileStats>;

export interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'saving' | 'done' | 'error';
  error?: string;
  uploaded?: UploadedFile;
}

export interface PublicFileMeta {
  shareId: string;
  ownerDisplayName: string;
  isOwner: boolean;
  fileName: string;
  originalName: string;
  mimeType: string;
  category: FileCategory;
  extension: string;
  sizeBytes: number;
  sha256: string;
  visibility: FileVisibility;
  description: string;
  views: number;
  downloads: number;
  available: boolean;
  directPath: string;
  downloadPath: string;
  sharePath: string;
  createdAt: string;
  updatedAt: string;
}
