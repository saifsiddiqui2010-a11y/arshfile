import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import type {
  FileCategory,
  FileStatsMap,
  FileVisibility,
  PublicFileMeta,
  UploadedFile,
} from '../types/file.ts';

interface ServerUploadResponse {
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
  directPath: string;
  downloadPath: string;
  sharePath: string;
}

export function uploadFileWithProgress(opts: {
  file: File;
  visibility: FileVisibility;
  folderId: string;
  token: string;
  onProgress: (percent: number) => void;
}): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', opts.file);
    formData.append('visibility', opts.visibility);

    xhr.open('POST', '/api/files/upload', true);
    xhr.setRequestHeader('Authorization', `Bearer ${opts.token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
        opts.onProgress(pct);
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload.'));
    };

    xhr.onload = async () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const errBody = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(errBody.error || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
        return;
      }

      try {
        const data = JSON.parse(xhr.responseText) as ServerUploadResponse;
        const currentUser = auth.currentUser;
        if (!currentUser) {
          reject(new Error('Session expired during upload.'));
          return;
        }

        const docPath = `files/${data.shareId}`;
        const fileRecord = {
          shareId: data.shareId,
          ownerId: currentUser.uid,
          ownerDisplayName: (currentUser.displayName || data.ownerDisplayName || 'DropLink User').slice(0, 120),
          fileName: data.fileName.slice(0, 255),
          originalName: data.originalName.slice(0, 255),
          mimeType: data.mimeType.slice(0, 128),
          category: data.category,
          extension: data.extension.slice(0, 24),
          sizeBytes: Math.max(0, Math.floor(data.sizeBytes)),
          sha256: data.sha256,
          visibility: data.visibility,
          folderId: opts.folderId.slice(0, 128),
          description: '',
          directPath: data.directPath,
          downloadPath: data.downloadPath,
          sharePath: data.sharePath,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        try {
          await setDoc(doc(db, 'files', data.shareId), fileRecord);
        } catch (fsErr) {
          // Clean up uploaded binary if Firestore persistence failed
          fetch(`/api/files/${data.shareId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${opts.token}` },
          }).catch(() => {});
          handleFirestoreError(fsErr, OperationType.CREATE, docPath);
        }

        opts.onProgress(100);
        resolve({
          ...fileRecord,
          createdAt: null,
          updatedAt: null,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to save uploaded file metadata.'));
      }
    };

    xhr.send(formData);
  });
}

export async function updateFileMetadata(opts: {
  shareId: string;
  token: string;
  updates: {
    fileName?: string;
    description?: string;
    visibility?: FileVisibility;
    folderId?: string;
  };
}): Promise<void> {
  const { shareId, token, updates } = opts;

  // Sync server-side access controls & display filename first
  const serverPayload: Record<string, string> = {};
  if (updates.visibility !== undefined) serverPayload.visibility = updates.visibility;
  if (updates.fileName !== undefined) serverPayload.fileName = updates.fileName.trim().slice(0, 255);
  if (updates.description !== undefined) serverPayload.description = updates.description.slice(0, 500);

  if (Object.keys(serverPayload).length > 0) {
    const res = await fetch(`/api/files/${encodeURIComponent(shareId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(serverPayload),
    });
    if (!res.ok && res.status !== 404) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || 'Failed to update file access settings.');
    }
  }

  // Persist to Firestore matching strict action-based update rules
  const fsUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.fileName !== undefined) fsUpdates.fileName = updates.fileName.trim().slice(0, 255);
  if (updates.description !== undefined) fsUpdates.description = updates.description.slice(0, 500);
  if (updates.visibility !== undefined) fsUpdates.visibility = updates.visibility;
  if (updates.folderId !== undefined) fsUpdates.folderId = updates.folderId.slice(0, 128);

  const path = `files/${shareId}`;
  try {
    await updateDoc(doc(db, 'files', shareId), fsUpdates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteUploadedFile(shareId: string, token: string): Promise<void> {
  const res = await fetch(`/api/files/${encodeURIComponent(shareId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || 'Failed to remove file from storage.');
  }

  const path = `files/${shareId}`;
  try {
    await deleteDoc(doc(db, 'files', shareId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createFolder(name: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');

  const cleanName = name.trim().slice(0, 80);
  if (!cleanName) throw new Error('Folder name is required.');

  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const folderId = `fld_${randomPart}`;
  const path = `folders/${folderId}`;

  try {
    await setDoc(doc(db, 'folders', folderId), {
      folderId,
      ownerId: user.uid,
      name: cleanName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return folderId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  const path = `folders/${folderId}`;
  try {
    await deleteDoc(doc(db, 'folders', folderId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function fetchOwnerStats(token: string): Promise<FileStatsMap> {
  const res = await fetch('/api/files/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as { stats?: FileStatsMap };
  return data.stats || {};
}

export async function fetchPrivateTicket(shareId: string, token: string): Promise<string | null> {
  const res = await fetch(`/api/files/${encodeURIComponent(shareId)}/ticket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { ticket?: string };
  return data.ticket || null;
}

export async function fetchPublicFileMeta(
  shareId: string,
  opts?: { token?: string | null; track?: boolean }
): Promise<{ status: number; data?: PublicFileMeta; error?: string }> {
  const headers: Record<string, string> = {};
  if (opts?.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  const qs = opts?.track ? '?track=1' : '';
  const res = await fetch(`/api/meta/${encodeURIComponent(shareId)}${qs}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      status: res.status,
      error: (body as { error?: string }).error || 'Unable to load shared file.',
    };
  }
  const data = (await res.json()) as PublicFileMeta;
  return { status: res.status, data };
}
