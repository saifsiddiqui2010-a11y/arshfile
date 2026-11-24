# DropLink Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Identity Ownership**: Every document in `/users/{userId}` may only be read, created, updated, or deleted by the verified authenticated user whose `request.auth.uid == userId`. No cross-user PII (`email`) reads are possible.
2. **Folder Ownership**: Every `/folders/{folderId}` document must have `ownerId == request.auth.uid` and `folderId == {folderId}`. Only the owner can `get`, `list`, `create`, `update`, or `delete` their folders.
3. **File Ownership & Share Access**:
   - Creating a `/files/{shareId}` document requires a verified signed-in user, `ownerId == request.auth.uid`, `shareId == {shareId}`, exact server timestamp (`createdAt == request.time`, `updatedAt == request.time`), and if `folderId != ""`, the referenced folder must exist and belong to `request.auth.uid`.
   - Listing `/files` is strictly enforced via `resource.data.ownerId == request.auth.uid`. Non-owners can never list or scrape files.
   - Single-document `get` on `/files/{shareId}` is allowed only if the caller is the owner OR `resource.data.visibility in ['public', 'unlisted']`. No PII is stored in `/files/{shareId}`.
   - Updates to `/files/{shareId}` are restricted to the owner via named actions (`rename`, `visibility`, `organize`, `describe`, `metadataEdit`) with strict `affectedKeys().hasOnly(...)`, full `isValidUploadedFile()` schema validation, and immutable field preservation (`shareId`, `ownerId`, `originalName`, `mimeType`, `category`, `extension`, `sizeBytes`, `sha256`, `directPath`, `downloadPath`, `sharePath`, `createdAt`).
4. **Temporal & Volumetric Integrity**: Every string enforces explicit `.size()` bounds; every ID matches `^[a-zA-Z0-9_-]+$`; every `createdAt`/`updatedAt` equals `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Identity Spoofing on File Create**: Authenticated user A creates `/files/abc123` with `ownerId: "user_B"`. Expected: `PERMISSION_DENIED`.
2. **Shadow Field Injection on File Create**: User creates `/files/abc123` with all valid fields plus `isAdmin: true`. Expected: `PERMISSION_DENIED`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create a file or folder. Expected: `PERMISSION_DENIED`.
4. **Cross-User PII Read**: User B attempts `get` on `/users/user_A`. Expected: `PERMISSION_DENIED`.
5. **Private File Unauthorized Read**: Anonymous or User B attempts `get` on `/files/priv123` where `visibility == 'private'`. Expected: `PERMISSION_DENIED`.
6. **Collection Scraping List Query**: Anonymous or User B runs `list` on `/files` without owner filter (or matching User A's files). Expected: `PERMISSION_DENIED`.
7. **Orphaned / Foreign Folder Reference**: User A creates `/files/abc123` referencing `folderId: "user_B_folder"`. Expected: `PERMISSION_DENIED`.
8. **Immutable Field Tampering on Update**: User A updates `/files/abc123` attempting to change `sha256`, `sizeBytes`, `directPath`, or `ownerId`. Expected: `PERMISSION_DENIED`.
9. **Value Poisoning on Allowed Key Update**: User A updates `/files/abc123` setting `visibility: "super_admin"` or `fileName` to a 500-char string. Expected: `PERMISSION_DENIED`.
10. **Forged Client Timestamp**: User A creates or updates a document with a backdated `createdAt` or `updatedAt` != `request.time`. Expected: `PERMISSION_DENIED`.
11. **ID Poisoning**: User A attempts to create `/files/../../etc/passwd` or a 200-char invalid document ID. Expected: `PERMISSION_DENIED`.
12. **Shadow Field Update on Profile**: User A updates `/users/user_A` adding `role: "admin"`. Expected: `PERMISSION_DENIED`.
