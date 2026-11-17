import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Imagini responsive: scripts/optimize-images.mjs genereaza variante WebP pentru tot ce
 * este in public/img (inclusiv pozele urcate din admin) si un manifest. Aici citim acel
 * manifest ca sa producem src/srcset/width/height. Daca manifestul lipseste, folosim
 * imaginea originala, deci site-ul functioneaza oricum.
 */
interface ManifestEntry {
  width: number;
  height: number;
  variants: Array<{ w: number; src: string }>;
}

export interface ResponsiveImage {
  src: string;
  srcset?: string;
  width?: number;
  height?: number;
}

export const PLACEHOLDER_IMAGE = "/img/placeholder.png";

const PUBLIC_DIR = resolve(process.cwd(), "public");
const MANIFEST_PATH = resolve(PUBLIC_DIR, "img-opt", "manifest.json");

let manifestCache: Record<string, ManifestEntry> | null = null;
const loadManifest = () => {
  if (manifestCache) return manifestCache;
  try {
    manifestCache = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    manifestCache = {};
  }
  return manifestCache!;
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isRemote = (path: string) => /^https?:\/\//i.test(path);

/** Calea decodata, cu slash la inceput (ex: "/img/scari/Scară A.png"). */
export const toDecodedPath = (path: string) => {
  const trimmed = (path ?? "").trim().split(/[?#]/)[0];
  if (!trimmed || isRemote(trimmed)) return trimmed;
  const decoded = safeDecode(trimmed);
  return decoded.startsWith("/") ? decoded : `/${decoded}`;
};

/** Calea sigura pentru atributul src (spatii/diacritice codificate). */
export const toUrlPath = (path: string) => {
  if (isRemote(path)) return path;
  return encodeURI(toDecodedPath(path));
};

export const assetExists = (path: string | undefined | null) => {
  if (!path) return false;
  if (isRemote(path)) return true;
  const decoded = toDecodedPath(path);
  return Boolean(decoded) && existsSync(resolve(PUBLIC_DIR, `.${decoded}`));
};

/** Pastreaza doar imaginile care exista efectiv, fara duplicate. */
export const existingImages = (paths: Array<string | undefined | null>) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of paths) {
    if (!path || !assetExists(path)) continue;
    const key = toDecodedPath(path);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(path);
  }
  return result;
};

export const responsiveImage = (path: string | undefined | null): ResponsiveImage => {
  const source = path && assetExists(path) ? path : PLACEHOLDER_IMAGE;
  if (isRemote(source)) return { src: source };

  const entry = loadManifest()[toDecodedPath(source)];
  if (!entry || entry.variants.length === 0) return { src: toUrlPath(source) };

  const variants = [...entry.variants].sort((a, b) => a.w - b.w);
  const largest = variants[variants.length - 1];
  return {
    src: largest.src,
    srcset: variants.map((v) => `${v.src} ${v.w}w`).join(", "),
    width: entry.width,
    height: entry.height,
  };
};

/** URL absolut, util pentru OpenGraph si JSON-LD (foloseste varianta optimizata). */
export const absoluteImageUrl = (path: string | undefined | null, domain: string) =>
  new URL(responsiveImage(path).src, domain).toString();
