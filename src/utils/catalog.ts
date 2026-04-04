import { existsSync } from "node:fs";
import { resolve } from "node:path";
import rawCategories from "../data/categories.json";

interface CategoryRecord {
  name: string;
  slug: string;
  imageCount: number;
  coverImage: string;
}

export const PLACEHOLDER_IMAGE = "/img/placeholder.png";

const PUBLIC_DIR = resolve(process.cwd(), "public");
const CATEGORY_SLUG_BLACKLIST = new Set(["categorii", "uploads"]);

const categories = (rawCategories as CategoryRecord[]).filter(
  (category) => category.imageCount > 0 && !CATEGORY_SLUG_BLACKLIST.has(category.slug),
);

const normalizePublicPath = (path: string) => {
  const trimmedPath = path.trim();
  if (!trimmedPath) return "";
  if (/^https?:\/\//i.test(trimmedPath)) return trimmedPath;
  return trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
};

const decodePublicAssetPath = (path: string) => {
  const withoutLeadingSlash = path.replace(/^\/+/, "");
  try {
    return decodeURIComponent(withoutLeadingSlash);
  } catch {
    return withoutLeadingSlash;
  }
};

export const normalizeCategoryKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const hasPublicAsset = (path: string) => {
  const normalizedPath = normalizePublicPath(path);
  if (!normalizedPath) return false;
  if (/^https?:\/\//i.test(normalizedPath)) return true;

  const withoutSearch = normalizedPath.split(/[?#]/)[0];
  const decoded = decodePublicAssetPath(withoutSearch);
  if (!decoded) return false;

  return existsSync(resolve(PUBLIC_DIR, decoded));
};

export const getExistingImages = (paths: Array<string | undefined | null>) => {
  const normalizedPaths = paths
    .map((path) => normalizePublicPath(path ?? ""))
    .filter((path): path is string => Boolean(path));

  return normalizedPaths.filter((path) => hasPublicAsset(path));
};

export const pickBestImage = (
  paths: Array<string | undefined | null>,
  fallback = PLACEHOLDER_IMAGE,
) => {
  const validImages = getExistingImages(paths);
  if (validImages.length > 0) return validImages[0];
  return hasPublicAsset(fallback) ? fallback : PLACEHOLDER_IMAGE;
};

const categoryCoverByKey = new Map<string, string>();
for (const category of categories) {
  categoryCoverByKey.set(
    normalizeCategoryKey(category.name),
    pickBestImage([category.coverImage]),
  );
}

export const getCategoryCoverImage = (categoryName: string) =>
  categoryCoverByKey.get(normalizeCategoryKey(categoryName));

export interface FallbackCategory {
  name: string;
  slug: string;
  imageCount: number;
  coverImage: string;
}

export const getFallbackCategories = (
  existingCategoryKeys: Set<string>,
): FallbackCategory[] => {
  const fallbackCategories: FallbackCategory[] = [];

  for (const category of categories) {
    if (existingCategoryKeys.has(normalizeCategoryKey(category.name))) continue;
    fallbackCategories.push({
      name: category.name,
      slug: category.slug,
      imageCount: category.imageCount,
      coverImage: pickBestImage([category.coverImage]),
    });
  }

  return fallbackCategories;
};
