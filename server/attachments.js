// Images attached to edits: a client's marked-up screenshot, a new product photo, or a reference.
// Saved in the week's attachments/<stage>/ folder; edits point at them by path relative to the job folder,
// and the agent opens them with Read in the next round.
import fs from 'node:fs';
import path from 'node:path';

export const ROLES = { markup: 'client markup', photo: 'new product photo', reference: 'reference' };
export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_PER_EDIT = 8;
const PATH_RE = /^attachments\/[a-z]+\/[^/\\]+\.(png|jpe?g|webp)$/i;

const err = (msg, code = 400) => Object.assign(new Error(msg), { code });

/** The real format from the first bytes (a pasted screenshot is often called image.png whatever it is). */
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return '.png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return '.webp';
  if (buf.toString('latin1', 4, 8) === 'ftyp' && /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(buf.toString('latin1', 8, 12))) return '.heic';
  return null;
}

const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15); // 20261123-101500

/** Save one uploaded image for a stage. Returns { path, name, size } (path relative to the job folder). */
export function saveAttachment(jobDir, stage, { originalname = 'image', buffer }) {
  if (!/^[a-z]+$/.test(stage || '')) throw err('unknown stage');
  const ext = sniffImage(buffer);
  if (ext === '.heic') throw err('iPhone HEIC photos aren\'t supported. Send it as JPG (on the iPhone: Settings → Camera → Formats → Most Compatible), or take a screenshot of it.', 415);
  if (!ext) throw err(`${originalname} isn't a JPG, PNG or WebP image.`, 415);
  if (buffer.length > MAX_BYTES) throw err('The image is over 25 MB.', 413);
  const base = path.basename(originalname, path.extname(originalname))
    .normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase() || 'image';
  const dir = path.join(jobDir, 'attachments', stage);
  fs.mkdirSync(dir, { recursive: true });
  let name = `${stamp()}-${base}${ext}`;
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${stamp()}-${base}-${n}${ext}`;
  fs.writeFileSync(path.join(dir, name), buffer);
  return { path: `attachments/${stage}/${name}`, name: originalname, size: buffer.length };
}

/** Attachment list on an edit, cleaned: only files under attachments/, known roles, at most 8. */
export function cleanImages(list, defaultRole = 'markup') {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const i of list) {
    const p = typeof i === 'string' ? i : i?.path;
    if (typeof p !== 'string' || !PATH_RE.test(p) || p.includes('..')) continue;
    if (out.some((x) => x.path === p)) continue;
    out.push({ path: p, role: ROLES[i?.role] ? i.role : defaultRole });
  }
  return out.slice(0, MAX_PER_EDIT);
}
