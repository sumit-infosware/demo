import fs from "node:fs/promises";
import path from "node:path";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const SESSION_DIR = path.join(UPLOAD_ROOT, "sessions");
const TAGS_DIR = path.join(UPLOAD_ROOT, "tags");

export interface StoredPhoto {
  sequence: number;
  path: string; // relative path (uploads/...)
  url: string; // "/uploads/..."
  size: number;
  capturedAt: string;
}

// ─── Utility ─────────────────────────────────────────────────

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

/** Parse "data:image/jpeg;base64,..." OR raw base64 */
function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (match) {
    return {
      mime: match[1] ?? "image/jpeg",
      buffer: Buffer.from(match[2] ?? "", "base64"),
    };
  }
  // treat as raw base64
  return { mime: "image/jpeg", buffer: Buffer.from(dataUrl, "base64") };
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function sanitizeId(raw: string): string {
  // strip anything not alphanumeric / dash / underscore
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
}

// ─── Session-scoped save (BEFORE tag exists) ─────────────────

/**
 * Save photo to uploads/sessions/{sessionId}/tmp-{seq}.jpg
 * Called from handheld/submit-photo when tag doesn't yet exist.
 */
export async function saveSessionPhoto(
  sessionId: string,
  sequence: number,
  dataUrlOrBase64: string,
): Promise<StoredPhoto> {
  const sid = sanitizeId(sessionId);
  const { mime, buffer } = parseDataUrl(dataUrlOrBase64);

  // Hard size guard — client compresses to ~500 KB, allow up to 1.5 MB
  if (buffer.length > 1_500_000) {
    throw new Error(`Photo too large (${buffer.length} bytes). Client must compress under 1MB.`);
  }

  const dir = path.join(SESSION_DIR, sid);
  await ensureDir(dir);

  const ext = extFromMime(mime);
  const fileName = `tmp-${sequence}.${ext}`;
  const abs = path.join(dir, fileName);
  await fs.writeFile(abs, buffer);

  const rel = `uploads/sessions/${sid}/${fileName}`;
  return {
    sequence,
    path: rel,
    url: `/${rel}`,
    size: buffer.length,
    capturedAt: new Date().toISOString(),
  };
}

// ─── Move session photos → tag folder (on tag generate) ──────

/**
 * Move all tmp-N.* from uploads/sessions/{sid}/ → uploads/tags/{tagId}/photo-N.*
 * Called from tagService.generateTag when photoRequestId is passed.
 */
export async function moveSessionPhotosToTag(
  sessionId: string,
  tagId: string,
): Promise<StoredPhoto[]> {
  const sid = sanitizeId(sessionId);
  const tid = sanitizeId(tagId);

  const srcDir = path.join(SESSION_DIR, sid);
  const dstDir = path.join(TAGS_DIR, tid);
  await ensureDir(dstDir);

  const moved: StoredPhoto[] = [];
  try {
    const files = await fs.readdir(srcDir);
    for (const f of files.sort()) {
      const m = f.match(/^tmp-(\d+)\.(\w+)$/);
      if (!m) continue;
      const seq = Number(m[1]);
      const ext = m[2];
      const srcAbs = path.join(srcDir, f);
      const dstName = `photo-${seq}.${ext}`;
      const dstAbs = path.join(dstDir, dstName);
      await fs.rename(srcAbs, dstAbs);
      const stat = await fs.stat(dstAbs);
      moved.push({
        sequence: seq,
        path: `uploads/tags/${tid}/${dstName}`,
        url: `/uploads/tags/${tid}/${dstName}`,
        size: stat.size,
        capturedAt: stat.mtime.toISOString(),
      });
    }
    // best-effort cleanup — ignore if it isn't empty (should be)
    await fs.rmdir(srcDir).catch(() => {});
  } catch (err) {
    console.warn(`[photo-storage] moveSessionPhotosToTag(${sid} → ${tid}) failed:`, err);
  }
  return moved.sort((a, b) => a.sequence - b.sequence);
}

// ─── Direct tag photo save (legacy /tags/:id/photo endpoint) ──

/**
 * Save photo directly to uploads/tags/{tagId}/photo-{seq}.jpg
 * Legacy path for the older single-photo endpoint.
 */
export async function saveTagPhoto(
  tagId: string,
  sequence: number,
  dataUrlOrBase64: string,
): Promise<StoredPhoto> {
  const tid = sanitizeId(tagId);
  const { mime, buffer } = parseDataUrl(dataUrlOrBase64);

  if (buffer.length > 1_500_000) {
    throw new Error(`Photo too large (${buffer.length} bytes)`);
  }

  const dir = path.join(TAGS_DIR, tid);
  await ensureDir(dir);

  const ext = extFromMime(mime);
  const fileName = `photo-${sequence}.${ext}`;
  const abs = path.join(dir, fileName);
  await fs.writeFile(abs, buffer);

  const rel = `uploads/tags/${tid}/${fileName}`;
  return {
    sequence,
    path: rel,
    url: `/${rel}`,
    size: buffer.length,
    capturedAt: new Date().toISOString(),
  };
}

// ─── List saved tag photos ───────────────────────────────────

export async function listTagPhotos(tagId: string): Promise<StoredPhoto[]> {
  const tid = sanitizeId(tagId);
  const tagDir = path.join(TAGS_DIR, tid);
  try {
    const files = await fs.readdir(tagDir);
    const photos: StoredPhoto[] = [];
    for (const f of files.sort()) {
      const m = f.match(/^photo-(\d+)\.\w+$/);
      if (!m) continue;
      const abs = path.join(tagDir, f);
      const stat = await fs.stat(abs);
      photos.push({
        sequence: Number(m[1]),
        path: `uploads/tags/${tid}/${f}`,
        url: `/uploads/tags/${tid}/${f}`,
        size: stat.size,
        capturedAt: stat.mtime.toISOString(),
      });
    }
    return photos.sort((a, b) => a.sequence - b.sequence);
  } catch {
    return [];
  }
}
