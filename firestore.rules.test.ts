/**
 * Phase 0 Payload-First Security Test Suite for DropLink Firestore Rules.
 * Verifies all 12 "Dirty Dozen" adversarial payloads are rejected (PERMISSION_DENIED)
 * and legitimate owner/public-share workflows succeed.
 *
 * Run against the Firebase Emulator Suite with @firebase/rules-unit-testing.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actor: { uid: string | null; emailVerified: boolean };
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on File Create',
    collectionPath: 'files/file_spoof_01',
    operation: 'create',
    actor: { uid: 'user_A', emailVerified: true },
    payload: {
      shareId: 'file_spoof_01',
      ownerId: 'user_B',
      ownerDisplayName: 'Bob',
      fileName: 'photo.png',
      originalName: 'photo.png',
      mimeType: 'image/png',
      category: 'image',
      extension: 'png',
      sizeBytes: 1024,
      sha256: 'a'.repeat(64),
      visibility: 'public',
      folderId: '',
      description: '',
      directPath: '/api/raw/file_spoof_01',
      downloadPath: '/api/download/file_spoof_01',
      sharePath: '/s/file_spoof_01',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidUploadedFile(): data.ownerId == request.auth.uid',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on File Create',
    collectionPath: 'files/file_shadow_02',
    operation: 'create',
    actor: { uid: 'user_A', emailVerified: true },
    payload: {
      shareId: 'file_shadow_02',
      ownerId: 'user_A',
      ownerDisplayName: 'Alice',
      fileName: 'clip.mp4',
      originalName: 'clip.mp4',
      mimeType: 'video/mp4',
      category: 'video',
      extension: 'mp4',
      sizeBytes: 4096,
      sha256: 'b'.repeat(64),
      visibility: 'public',
      folderId: '',
      description: '',
      directPath: '/api/raw/file_shadow_02',
      downloadPath: '/api/download/file_shadow_02',
      sharePath: '/s/file_shadow_02',
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidUploadedFile(): data.keys().hasOnly([...])',
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    collectionPath: 'folders/folder_unverified_03',
    operation: 'create',
    actor: { uid: 'user_A', emailVerified: false },
    payload: {
      folderId: 'folder_unverified_03',
      ownerId: 'user_A',
      name: 'Designs',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isVerifiedUser(): request.auth.token.email_verified == true',
  },
  {
    id: 4,
    name: 'Cross-User PII Read',
    collectionPath: 'users/user_A',
    operation: 'get',
    actor: { uid: 'user_B', emailVerified: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'match /users/{userId}: allow get: if isSignedIn() && request.auth.uid == userId',
  },
  {
    id: 5,
    name: 'Private File Unauthorized Read',
    collectionPath: 'files/file_private_05',
    operation: 'get',
    actor: { uid: null, emailVerified: false },
    expected: 'PERMISSION_DENIED',
    enforcedBy: "match /files/{shareId}: existing().visibility in ['public', 'unlisted']",
  },
  {
    id: 6,
    name: 'Collection Scraping List Query',
    collectionPath: 'files',
    operation: 'list',
    actor: { uid: 'user_B', emailVerified: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'match /files/{shareId}: allow list: if isSignedIn() && existing().ownerId == request.auth.uid',
  },
  {
    id: 7,
    name: 'Foreign Folder Reference on File Create',
    collectionPath: 'files/file_foreign_folder_07',
    operation: 'create',
    actor: { uid: 'user_A', emailVerified: true },
    payload: {
      shareId: 'file_foreign_folder_07',
      ownerId: 'user_A',
      folderId: 'folder_owned_by_user_B',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'ownsFolderIfSet(): get(/databases/$(database)/documents/folders/$(folderId)).data.ownerId == request.auth.uid',
  },
  {
    id: 8,
    name: 'Immutable Field Tampering on File Update',
    collectionPath: 'files/file_immutable_08',
    operation: 'update',
    actor: { uid: 'user_A', emailVerified: true },
    payload: {
      sha256: 'c'.repeat(64),
      directPath: '/api/raw/hijacked',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'affectedKeys().hasOnly([...]) && isImmutableFileUnchanged()',
  },
  {
    id: 9,
    name: 'Value Poisoning on Allowed Key Update',
    collectionPath: 'files/file_poison_09',
    operation: 'update',
    actor: { uid: 'user_A', emailVerified: true },
    payload: {
      visibility: 'super_admin',
      fileName: 'x'.repeat(500),
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidUploadedFile(incoming(), shareId)',
  },
  {
    id: 10,
    name: 'Forged Client Timestamp',
    collectionPath: 'folders/folder_time_10',
    operation: 'create',
    actor: { uid: 'user_A', emailVerified: true },
    payload: {
      folderId: 'folder_time_10',
      ownerId: 'user_A',
      name: 'Backdated',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 11,
    name: 'ID Poisoning via Oversized / Invalid Characters',
    collectionPath: 'files/' + 'a'.repeat(180),
    operation: 'create',
    actor: { uid: 'user_A', emailVerified: true },
    payload: { shareId: 'a'.repeat(180) },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidId(shareId) && shareId.size() <= 64',
  },
  {
    id: 12,
    name: 'Shadow Field Update on User Profile',
    collectionPath: 'users/user_A',
    operation: 'update',
    actor: { uid: 'user_A', emailVerified: true },
    payload: {
      role: 'admin',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: "isValidUserProfile(incoming(), userId) && incoming().diff(existing()).affectedKeys().hasOnly(['displayName', 'photoURL', 'email', 'updatedAt'])",
  },
];
