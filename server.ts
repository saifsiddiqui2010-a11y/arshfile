import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Firebase Admin (ID Token Verification ONLY — requires zero IAM permissions)
// ---------------------------------------------------------------------------
const adminApp = getApps().length
  ? getApp()
  : initializeApp({
      projectId: firebaseConfig.projectId,
    });
const adminAuth = getAuth(adminApp);

// ---------------------------------------------------------------------------
// Storage Directories & File Registry
// ---------------------------------------------------------------------------
const ROOT_DIR = process.cwd();
const UPLOAD_DIR = path.resolve(ROOT_DIR, 'uploads');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const INDEX_FILE = path.resolve(DATA_DIR, 'file-index.json');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB
const TICKET_SECRET = process.env.TICKET_SECRET || crypto.randomBytes(32).toString('hex');
const SHARE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,64}$/;

type FileVisibility = 'public' | 'unlisted' | 'private';
type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

interface StoredFileRecord {
  shareId: string;
  ownerUid: string;
  ownerDisplayName: string;
  diskName: string;
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
  createdAt: string;
  updatedAt: string;
}

type IndexMap = Record<string, StoredFileRecord>;

function loadIndex(): IndexMap {
  try {
    if (!fs.existsSync(INDEX_FILE)) return {};
    const raw = fs.readFileSync(INDEX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as IndexMap) : {};
  } catch (err) {
    console.error('Failed to read file index, starting fresh:', err);
    return {};
  }
}

let fileIndex: IndexMap = loadIndex();

function persistIndex(): void {
  const tmpFile = `${INDEX_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(fileIndex, null, 2), 'utf8');
  fs.renameSync(tmpFile, INDEX_FILE);
}

function resolveUploadPath(diskName: string): string | null {
  if (!/^[a-f0-9]{32}$/.test(diskName)) return null;
  const resolved = path.resolve(UPLOAD_DIR, diskName);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep)) return null;
  return resolved;
}

// ---------------------------------------------------------------------------
// MIME Classification & Safe Inline Rendering Allowlist (Anti-XSS)
// ---------------------------------------------------------------------------
const SAFE_INLINE_MIMES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/x-icon',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/aac',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
]);

function normalizeExtension(fileName: string): string {
  const ext = path.extname(fileName).replace(/^\./, '').toLowerCase();
  const clean = ext.replace(/[^a-z0-9]/g, '').slice(0, 24);
  return clean || 'bin';
}

function classifyCategory(mimeType: string, extension: string): FileCategory {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg', 'bmp', 'ico', 'heic'].includes(extension)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv'].includes(extension)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus'].includes(extension)) {
    return 'audio';
  }
  if (
    mime === 'application/pdf' ||
    mime.startsWith('text/') ||
    mime.includes('document') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'rtf'].includes(extension)
  ) {
    return 'document';
  }
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('gzip') ||
    mime.includes('compressed') ||
    ['zip', 'tar', 'gz', 'tgz', 'rar', '7z', 'bz2', 'xz'].includes(extension)
  ) {
    return 'archive';
  }
  return 'other';
}

function sanitizeHeaderFilename(name: string): string {
  const base = path.basename(name).replace(/[\r\n"\\]/g, '_').trim();
  return base.slice(0, 200) || 'download';
}

function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Short-lived HMAC Access Tickets for Private Files
// ---------------------------------------------------------------------------
function signTicket(shareId: string, uid: string, ttlSeconds = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${shareId}:${uid}:${exp}`;
  const sig = crypto.createHmac('sha256', TICKET_SECRET).update(payload).digest('base64url');
  return `${exp}.${sig}`;
}

function verifyTicket(shareId: string, ownerUid: string, ticket?: string): boolean {
  if (!ticket || typeof ticket !== 'string') return false;
  const parts = ticket.split('.');
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const payload = `${shareId}:${ownerUid}:${exp}`;
  const expected = crypto.createHmac('sha256', TICKET_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// ---------------------------------------------------------------------------
// Express Auth Middleware
// ---------------------------------------------------------------------------
interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email_verified) {
      res.status(403).json({ error: 'Verified email required.' });
      return;
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      req.user = await adminAuth.verifyIdToken(token);
    } catch {
      // Ignore invalid token for public access check
    }
  }
  next();
}

function canAccessFile(record: StoredFileRecord, req: AuthRequest): boolean {
  if (record.visibility === 'public' || record.visibility === 'unlisted') {
    return true;
  }
  if (req.user && req.user.uid === record.ownerUid) {
    return true;
  }
  const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : undefined;
  return verifyTicket(record.shareId, record.ownerUid, ticket);
}

// ---------------------------------------------------------------------------
// Multer Disk Upload Configuration (Accepts ALL File Types)
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, _file, cb) => {
    cb(null, crypto.randomBytes(16).toString('hex'));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

// ---------------------------------------------------------------------------
// Express Application Setup
// ---------------------------------------------------------------------------
async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Upload any file type
  app.post('/api/files/upload', requireAuth, (req: AuthRequest, res: Response) => {
    upload.single('file')(req, res, async (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: 'File exceeds the 250 MB upload limit.' });
          return;
        }
        res.status(400).json({ error: 'Upload failed. Please try again.' });
        return;
      }

      const file = req.file;
      if (!file || !req.user) {
        res.status(400).json({ error: 'No file provided.' });
        return;
      }

      const filePath = resolveUploadPath(file.filename);
      if (!filePath) {
        res.status(500).json({ error: 'Invalid upload storage path.' });
        return;
      }

      try {
        const sha256 = await computeFileSha256(filePath);
        const shareId = crypto.randomBytes(9).toString('base64url');
        const originalName = (file.originalname || 'untitled').slice(0, 255);
        const mimeType = (file.mimetype || 'application/octet-stream').slice(0, 128);
        const extension = normalizeExtension(originalName);
        const category = classifyCategory(mimeType, extension);

        const rawVisibility = typeof req.body?.visibility === 'string' ? req.body.visibility : 'unlisted';
        const visibility: FileVisibility =
          rawVisibility === 'public' || rawVisibility === 'private' || rawVisibility === 'unlisted'
            ? rawVisibility
            : 'unlisted';

        const ownerDisplayName =
          typeof req.user.name === 'string' && req.user.name.trim()
            ? req.user.name.trim().slice(0, 120)
            : 'DropLink User';

        const nowIso = new Date().toISOString();
        const record: StoredFileRecord = {
          shareId,
          ownerUid: req.user.uid,
          ownerDisplayName,
          diskName: file.filename,
          fileName: originalName,
          originalName,
          mimeType,
          category,
          extension,
          sizeBytes: file.size,
          sha256,
          visibility,
          description: '',
          views: 0,
          downloads: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        fileIndex[shareId] = record;
        persistIndex();

        res.status(201).json({
          shareId: record.shareId,
          ownerId: record.ownerUid,
          ownerDisplayName: record.ownerDisplayName,
          fileName: record.fileName,
          originalName: record.originalName,
          mimeType: record.mimeType,
          category: record.category,
          extension: record.extension,
          sizeBytes: record.sizeBytes,
          sha256: record.sha256,
          visibility: record.visibility,
          directPath: `/api/raw/${record.shareId}`,
          downloadPath: `/api/download/${record.shareId}`,
          sharePath: `/s/${record.shareId}`,
        });
      } catch (uploadErr) {
        console.error('Upload processing error:', uploadErr);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {
          // ignore cleanup failure
        }
        res.status(500).json({ error: 'Failed to process uploaded file.' });
      }
    });
  });

  // Get view/download stats for authenticated owner's files
  app.get('/api/files/stats', requireAuth, (req: AuthRequest, res: Response) => {
    const uid = req.user!.uid;
    const stats: Record<string, { views: number; downloads: number; available: boolean }> = {};
    for (const [shareId, rec] of Object.entries(fileIndex)) {
      if (rec.ownerUid === uid) {
        const fullPath = resolveUploadPath(rec.diskName);
        stats[shareId] = {
          views: rec.views,
          downloads: rec.downloads,
          available: Boolean(fullPath && fs.existsSync(fullPath)),
        };
      }
    }
    res.json({ stats });
  });

  // Mint short-lived signed access ticket for private files (owner only)
  app.post('/api/files/:shareId/ticket', requireAuth, (req: AuthRequest, res: Response) => {
    const { shareId } = req.params;
    if (!SHARE_ID_PATTERN.test(shareId)) {
      res.status(400).json({ error: 'Invalid share ID.' });
      return;
    }
    const record = fileIndex[shareId];
    if (!record) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    if (record.ownerUid !== req.user!.uid) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    const ticket = signTicket(shareId, record.ownerUid);
    res.json({ ticket });
  });

  // Sync metadata (visibility / fileName / description) on server index (owner only)
  app.patch('/api/files/:shareId', requireAuth, (req: AuthRequest, res: Response) => {
    const { shareId } = req.params;
    if (!SHARE_ID_PATTERN.test(shareId)) {
      res.status(400).json({ error: 'Invalid share ID.' });
      return;
    }
    const record = fileIndex[shareId];
    if (!record) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    if (record.ownerUid !== req.user!.uid) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    const { visibility, fileName, description } = req.body ?? {};
    if (visibility !== undefined) {
      if (visibility !== 'public' && visibility !== 'unlisted' && visibility !== 'private') {
        res.status(400).json({ error: 'Invalid visibility value.' });
        return;
      }
      record.visibility = visibility;
    }
    if (fileName !== undefined) {
      if (typeof fileName !== 'string' || fileName.trim().length < 1 || fileName.trim().length > 255) {
        res.status(400).json({ error: 'Invalid file name.' });
        return;
      }
      record.fileName = fileName.trim();
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > 500) {
        res.status(400).json({ error: 'Invalid description.' });
        return;
      }
      record.description = description;
    }
    record.updatedAt = new Date().toISOString();
    persistIndex();

    res.json({ ok: true, visibility: record.visibility, fileName: record.fileName });
  });

  // Delete uploaded binary & index record (owner only)
  app.delete('/api/files/:shareId', requireAuth, (req: AuthRequest, res: Response) => {
    const { shareId } = req.params;
    if (!SHARE_ID_PATTERN.test(shareId)) {
      res.status(400).json({ error: 'Invalid share ID.' });
      return;
    }
    const record = fileIndex[shareId];
    if (!record) {
      res.json({ ok: true });
      return;
    }
    if (record.ownerUid !== req.user!.uid) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    const filePath = resolveUploadPath(record.diskName);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Failed to delete file from disk:', err);
      }
    }
    delete fileIndex[shareId];
    persistIndex();
    res.json({ ok: true });
  });

  // Public/Owner metadata endpoint for share pages
  app.get('/api/meta/:shareId', optionalAuth, (req: AuthRequest, res: Response) => {
    const { shareId } = req.params;
    if (!SHARE_ID_PATTERN.test(shareId)) {
      res.status(400).json({ error: 'Invalid share link.' });
      return;
    }
    const record = fileIndex[shareId];
    if (!record) {
      res.status(404).json({ error: 'File not found or has been deleted.' });
      return;
    }
    if (!canAccessFile(record, req)) {
      res.status(403).json({ error: 'This file is private. Only the owner can access it.' });
      return;
    }

    if (req.query.track === '1') {
      record.views += 1;
      persistIndex();
    }

    const fullPath = resolveUploadPath(record.diskName);
    const available = Boolean(fullPath && fs.existsSync(fullPath));

    res.json({
      shareId: record.shareId,
      ownerDisplayName: record.ownerDisplayName,
      isOwner: Boolean(req.user && req.user.uid === record.ownerUid),
      fileName: record.fileName,
      originalName: record.originalName,
      mimeType: record.mimeType,
      category: record.category,
      extension: record.extension,
      sizeBytes: record.sizeBytes,
      sha256: record.sha256,
      visibility: record.visibility,
      description: record.description,
      views: record.views,
      downloads: record.downloads,
      available,
      directPath: `/api/raw/${record.shareId}`,
      downloadPath: `/api/download/${record.shareId}`,
      sharePath: `/s/${record.shareId}`,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  });

  // Direct media/file serving endpoint with HTTP Range streaming & XSS safeguards
  app.get('/api/raw/:shareId', optionalAuth, (req: AuthRequest, res: Response) => {
    const { shareId } = req.params;
    if (!SHARE_ID_PATTERN.test(shareId)) {
      res.status(400).send('Invalid file identifier');
      return;
    }
    const record = fileIndex[shareId];
    if (!record) {
      res.status(404).send('File not found');
      return;
    }
    if (!canAccessFile(record, req)) {
      res.status(403).send('This file is private');
      return;
    }

    const filePath = resolveUploadPath(record.diskName);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).send('File content unavailable');
      return;
    }

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;
    const isSafeInline = SAFE_INLINE_MIMES.has(record.mimeType.toLowerCase());
    const safeFilename = sanitizeHeaderFilename(record.fileName);

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; media-src 'self'; img-src 'self'; style-src 'none'; script-src 'none'; sandbox"
    );
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', record.visibility === 'private' ? 'private, no-store' : 'public, max-age=3600');

    if (isSafeInline) {
      res.setHeader('Content-Type', record.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    } else {
      // Force attachment for HTML, SVG, JS, XML, executables, etc. to prevent stored XSS
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    const rangeHeader = req.headers.range;
    if (rangeHeader && totalSize > 0) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
        return;
      }
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(parseInt(match[2], 10), totalSize - 1) : totalSize - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= totalSize) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
        return;
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', chunkSize);
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.setHeader('Content-Length', totalSize);
    fs.createReadStream(filePath).pipe(res);
  });

  // Forced download endpoint with download counter
  app.get('/api/download/:shareId', optionalAuth, (req: AuthRequest, res: Response) => {
    const { shareId } = req.params;
    if (!SHARE_ID_PATTERN.test(shareId)) {
      res.status(400).send('Invalid file identifier');
      return;
    }
    const record = fileIndex[shareId];
    if (!record) {
      res.status(404).send('File not found');
      return;
    }
    if (!canAccessFile(record, req)) {
      res.status(403).send('This file is private');
      return;
    }

    const filePath = resolveUploadPath(record.diskName);
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).send('File content unavailable');
      return;
    }

    record.downloads += 1;
    persistIndex();

    const stat = fs.statSync(filePath);
    const safeFilename = sanitizeHeaderFilename(record.fileName);

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(filePath).pipe(res);
  });

  // -------------------------------------------------------------------------
  // Vite Dev Middleware or Production Static Assets
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DropLink server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
