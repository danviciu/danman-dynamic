// Genereaza variante WebP optimizate (mai multe latimi) pentru toate pozele din public/img.
// Rezultatul ajunge in public/img-opt/ (ignorat de git) + un manifest folosit la build
// pentru srcset/width/height. Pozele originale raman neatinse, deci pozele urcate din
// admin (de pe telefon, tableta sau PC) sunt optimizate automat la fiecare build.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { cpus } from "node:os";
import sharp from "sharp";

const ROOT = resolve(process.cwd(), "public");
const SRC_DIR = join(ROOT, "img");
const OUT_DIR = join(ROOT, "img-opt");
const MANIFEST = join(OUT_DIR, "manifest.json");
const WIDTHS = [480, 960, 1600];
const QUALITY = 78;
const SUPPORTED = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".tif", ".tiff"]);

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    }),
  );
  return files.flat();
};

const readManifest = async () => {
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return {};
  }
};

const toPublicPath = (absPath) => "/" + relative(ROOT, absPath).split(sep).join("/");

const outName = (relPath, width) => {
  // nume scurt si sigur pentru URL (fara spatii/diacritice), stabil intre build-uri
  const hash = createHash("sha1").update(relPath).digest("hex").slice(0, 10);
  const base = relPath
    .replace(/\.[^.]+$/, "")
    .split("/")
    .pop()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 48);
  return `${base || "img"}-${hash}-${width}.webp`;
};

const processFile = async (absPath, previous) => {
  const publicPath = toPublicPath(absPath);
  const info = await stat(absPath);
  const mtime = Math.round(info.mtimeMs);
  const cached = previous[publicPath];
  if (cached && cached.mtime === mtime && cached.size === info.size) {
    const allExist = await Promise.all(
      cached.variants.map((v) => stat(join(ROOT, v.src)).then(() => true, () => false)),
    );
    if (allExist.every(Boolean)) return [publicPath, cached];
  }

  const image = sharp(absPath, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  // dupa rotate() orientarea EXIF 5-8 inverseaza dimensiunile
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;
  if (!width || !height) return null;

  const rel = relative(SRC_DIR, absPath).split(sep).join("/");
  const targets = [...new Set(WIDTHS.map((w) => Math.min(w, width)))];
  const variants = [];
  for (const w of targets) {
    const file = join(OUT_DIR, outName(rel, w));
    await mkdir(dirname(file), { recursive: true });
    await sharp(absPath, { failOn: "none" })
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 4 })
      .toFile(file);
    variants.push({ w, src: toPublicPath(file) });
  }

  return [publicPath, { width, height, mtime, size: info.size, variants }];
};

const run = async () => {
  const started = Date.now();
  await mkdir(OUT_DIR, { recursive: true });
  const previous = await readManifest();
  const files = (await walk(SRC_DIR)).filter((f) => SUPPORTED.has(extname(f).toLowerCase()));

  const manifest = {};
  let index = 0;
  let failed = 0;
  const worker = async () => {
    while (index < files.length) {
      const file = files[index++];
      try {
        const result = await processFile(file, previous);
        if (result) manifest[result[0]] = result[1];
      } catch (error) {
        failed += 1;
        console.warn(`[images] nu am putut procesa ${toPublicPath(file)}: ${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(4, cpus().length)) }, worker));

  await writeFile(MANIFEST, JSON.stringify(manifest));
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[images] ${Object.keys(manifest).length} imagini optimizate (${failed} erori) in ${seconds}s`);
};

run().catch((error) => {
  // nu blocam build-ul: fara manifest site-ul foloseste pozele originale
  console.error("[images] optimizarea a esuat:", error);
});
