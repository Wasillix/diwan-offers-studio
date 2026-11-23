// Filing new product photos in the photo library (D:\Diwan\005 - FMCG Items\001 - Isolated Items).
//
// The agent never writes there: it suggests a folder and file name in review.json "library", and the
// Studio copies the photo only when Waseem clicks Save. Rules: the target stays inside the library, an
// existing file is never overwritten (409, pick another name), every save is logged in
// data/library-log.jsonl and on the job, and Undo moves a file the Studio added to data/trash/library/
// (only if it's unchanged since).
import fs from 'node:fs';
import path from 'node:path';

export const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
const err = (msg, code = 400) => Object.assign(new Error(msg), { code });
const norm = (p) => path.resolve(p).toLowerCase();
const inside = (p, dir) => norm(p).startsWith(norm(dir) + path.sep);

function requireLibrary(lib) {
  if (!lib || !fs.existsSync(lib) || !fs.statSync(lib).isDirectory()) throw err(`The photo library folder isn't there (${lib || 'not set'}). Set it in Settings → Folders.`, 409);
  return path.resolve(lib);
}

/** Folder names a photo can go in, two levels deep ("Dairy & Eggs", "Dairy & Eggs/Labneh"). */
export function libraryFolders(lib, depth = 2) {
  const root = requireLibrary(lib);
  const out = [];
  const walk = (dir, rel, d) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries.filter((x) => x.isDirectory() && !x.name.startsWith('.')).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      out.push(r);
      if (d < depth) walk(path.join(dir, e.name), r, d + 1);
    }
  };
  walk(root, '', 1);
  return out;
}

/** How many photos and category folders a library has (for Setup and Settings). */
export function libraryStats(lib) {
  if (!lib || !fs.existsSync(lib)) return { exists: false, images: 0, folders: 0 };
  let images = 0, folders = 0;
  try {
    for (const e of fs.readdirSync(lib, { withFileTypes: true, recursive: true })) {
      if (e.isDirectory()) folders++;
      else if (IMAGE_RE.test(e.name)) images++;
    }
  } catch { /* unreadable: counts stay partial */ }
  return { exists: true, images, folders };
}

/** A file name Windows accepts, keeping the source's extension. */
export function cleanName(name, sourceExt) {
  let n = String(name || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  const ext = (sourceExt || '.png').toLowerCase();
  n = n.replace(IMAGE_RE, '').trim();
  if (!n) throw err('The file name is empty.');
  if (n.length > 150) n = n.slice(0, 150).trim();
  return `${n}${ext === '.jpeg' ? '.jpg' : ext}`;
}

/** Where a photo would go: { file, rel, folderExists }. Throws if it leaves the library. */
export function resolveTarget(lib, folder, name, sourceExt) {
  const root = requireLibrary(lib);
  const parts = String(folder || '').split(/[\\/]+/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) throw err('Pick a folder in the photo library.');
  if (parts.some((p) => p === '.' || p === '..' || /[<>:"|?*\x00-\x1f]/.test(p))) throw err(`"${folder}" isn't a folder name the library can use.`);
  const dir = path.join(root, ...parts);
  if (!inside(dir, root)) throw err('That folder is outside the photo library.');
  const file = path.join(dir, cleanName(name, sourceExt));
  if (!inside(file, root)) throw err('That file is outside the photo library.');
  return { file, dir, rel: path.relative(root, file).split(path.sep).join('/'), folderExists: fs.existsSync(dir) };
}

/**
 * Copy a photo from the job folder into the library. `source` is relative to the job folder.
 * Never overwrites: an existing file throws 409 { exists: true }.
 */
export function saveToLibrary({ lib, jobDir, source, folder, name }) {
  const src = path.resolve(jobDir, String(source || ''));
  if (!inside(src, jobDir) || !fs.existsSync(src) || !fs.statSync(src).isFile()) throw err(`The photo ${source} isn't in this week's folder.`, 404);
  if (!IMAGE_RE.test(src)) throw err('Only PNG, JPG and WebP photos go in the library.');
  const t = resolveTarget(lib, folder, name, path.extname(src));
  if (fs.existsSync(t.file)) throw Object.assign(err(`"${t.rel}" is already in the library. Pick another name.`, 409), { exists: true, rel: t.rel });
  fs.mkdirSync(t.dir, { recursive: true });
  fs.copyFileSync(src, t.file, fs.constants.COPYFILE_EXCL);
  return { rel: t.rel, file: t.file, size: fs.statSync(t.file).size, newFolder: !t.folderExists };
}

/** Undo a save: move the file to data/trash/library/ if it's unchanged since the Studio added it. */
export function undoSave({ lib, rel, size, trashDir }) {
  const root = requireLibrary(lib);
  const file = path.join(root, ...String(rel || '').split('/'));
  if (!inside(file, root)) throw err('That file is outside the photo library.');
  if (!fs.existsSync(file)) return { gone: true };
  if (size != null && fs.statSync(file).size !== size) throw err(`"${rel}" changed since the Studio added it, so it was left alone.`, 409);
  fs.mkdirSync(trashDir, { recursive: true });
  const dest = path.join(trashDir, `${Date.now()}-${path.basename(file)}`);
  try { fs.renameSync(file, dest); } catch { fs.copyFileSync(file, dest); fs.rmSync(file); } // other drive
  return { movedTo: dest };
}

export function logLibrary(dataDir, entry) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.appendFileSync(path.join(dataDir, 'library-log.jsonl'), JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n', 'utf8');
}
