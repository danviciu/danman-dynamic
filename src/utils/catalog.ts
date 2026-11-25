import { getCollection, type CollectionEntry } from "astro:content";
import categoriesData from "../data/categories.json";
import { existingImages, PLACEHOLDER_IMAGE } from "./images";

/* ---------- utilitare generale ---------- */

export const compareRo = (a: string, b: string) =>
  a.localeCompare(b, "ro", { sensitivity: "base" });

const numberFormatter = new Intl.NumberFormat("ro-RO");
export const formatAmount = (value: number) => numberFormatter.format(value);

export const formatPrice = (
  { price, priceFrom }: { price?: number; priceFrom?: number },
  fallback = "Preț la cerere",
) => {
  if (typeof price === "number" && price > 0) return `${formatAmount(price)} RON`;
  if (typeof priceFrom === "number" && priceFrom > 0) return `De la ${formatAmount(priceFrom)} RON`;
  return fallback;
};

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" });
export const formatDate = (date: Date) => dateFormatter.format(date);

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const PRODUCT_CODE_LINE = /^\s*cod\s*produs\b.*$/gim;
const cleanText = (value: string | undefined | null) =>
  String(value ?? "")
    .replace(PRODUCT_CODE_LINE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Imparte un text lung in paragrafe (pentru afisare). */
export const paragraphs = (value: string | undefined | null) =>
  cleanText(value)
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

/** Rezumat automat (pentru carduri/Google) din descriere: prima propozitie, max ~160 caractere. */
export const summarize = (value: string | undefined | null, max = 160) => {
  const text = paragraphs(value).join(" ");
  if (text.length <= max) return text;
  const firstSentence = text.match(/^.{40,}?[.!?](\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length <= max) return firstSentence;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};

/* ---------- categorii ---------- */

export interface Category {
  name: string;
  slug: string;
  icon: string;
  order: number;
  description: string;
  coverImage?: string;
  seoTitle?: string;
  seoDesc?: string;
}

export const categories: Category[] = [...(categoriesData.categories as Category[])].sort(
  (a, b) => (a.order ?? 99) - (b.order ?? 99) || compareRo(a.name, b.name),
);

/** Accepta atat slug-ul ("dulap-de-baie") cat si un nume ("Dulapuri de baie"). */
export const getCategory = (value: string | undefined): Category | undefined => {
  if (!value) return undefined;
  const key = slugify(value);
  return categories.find((c) => c.slug === key || slugify(c.name) === key);
};

const categoryFor = (value: string): Category =>
  getCategory(value) ?? { name: value, slug: slugify(value), icon: "category", order: 99, description: "" };

export const categoryUrl = (category: Pick<Category, "slug">) => `/produse/${category.slug}/`;

/* ---------- produse ---------- */

export interface ProductView {
  slug: string;
  url: string;
  title: string;
  category: Category;
  featured: boolean;
  shortDesc: string;
  price?: number;
  priceFrom?: number;
  priceLabel: string;
  images: string[];
  cover: string;
  entry: CollectionEntry<"products">;
}

const toProductView = (entry: CollectionEntry<"products">): ProductView => {
  const data = entry.data;
  const category = categoryFor(data.category);
  const images = existingImages(data.images.map((item) => item.image));
  const cover = images[0] ?? existingImages([category.coverImage])[0] ?? PLACEHOLDER_IMAGE;
  return {
    slug: entry.id,
    url: `/produs/${entry.id}/`,
    title: data.title,
    category,
    featured: data.featured,
    shortDesc: cleanText(data.shortDesc) || summarize(data.longDesc),
    price: data.price,
    priceFrom: data.priceFrom,
    priceLabel: formatPrice(data),
    images: images.length > 0 ? images : [cover],
    cover,
    entry,
  };
};

let productsCache: ProductView[] | undefined;
export const getProducts = async () => {
  productsCache ??= (await getCollection("products", ({ data }) => !data.draft))
    .map(toProductView)
    .sort(
      (a, b) =>
        a.category.order - b.category.order ||
        compareRo(a.category.name, b.category.name) ||
        compareRo(a.title, b.title),
    );
  return productsCache;
};

export interface CategoryWithProducts extends Category {
  url: string;
  cover: string;
  products: ProductView[];
}

/** Doar categoriile care au cel putin un produs publicat. */
export const getActiveCategories = async (): Promise<CategoryWithProducts[]> => {
  const products = await getProducts();
  const bySlug = new Map<string, { category: Category; products: ProductView[] }>();
  for (const product of products) {
    const group = bySlug.get(product.category.slug) ?? { category: product.category, products: [] };
    group.products.push(product);
    bySlug.set(product.category.slug, group);
  }
  return [...bySlug.values()]
    .sort((a, b) => a.category.order - b.category.order || compareRo(a.category.name, b.category.name))
    .map(({ category, products: list }) => ({
      ...category,
      url: categoryUrl(category),
      cover: existingImages([category.coverImage])[0] ?? list[0]?.cover ?? PLACEHOLDER_IMAGE,
      products: list,
    }));
};

/* ---------- proiecte ---------- */

export interface ProjectView {
  slug: string;
  url: string;
  title: string;
  category?: Category;
  location?: string;
  year?: number;
  summary: string;
  story: string;
  featured: boolean;
  images: string[];
  cover: string;
  productSlugs: string[];
  entry: CollectionEntry<"projects">;
}

const toProjectView = (entry: CollectionEntry<"projects">): ProjectView => {
  const data = entry.data;
  const images = existingImages(data.images.map((item) => item.image));
  const cover = images[0] ?? PLACEHOLDER_IMAGE;
  return {
    slug: entry.id,
    url: `/proiecte/${entry.id}/`,
    title: data.title,
    category: data.category ? categoryFor(data.category) : undefined,
    location: data.location,
    year: data.year,
    summary: cleanText(data.shortDesc || data.story),
    story: cleanText(data.story || data.shortDesc),
    featured: data.featured,
    images: images.length > 0 ? images : [cover],
    cover,
    productSlugs: data.products ?? [],
    entry,
  };
};

let projectsCache: ProjectView[] | undefined;
export const getProjects = async () => {
  projectsCache ??= (await getCollection("projects", ({ data }) => !data.draft))
    .map(toProjectView)
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        (b.year ?? 0) - (a.year ?? 0) ||
        compareRo(a.title, b.title),
    );
  return projectsCache;
};

/* ---------- blog ---------- */

export const getPosts = async () =>
  (await getCollection("blog", ({ data }) => !data.draft))
    .map((entry) => ({
      slug: entry.id,
      url: `/blog/${entry.id}/`,
      title: entry.data.title,
      date: entry.data.date,
      excerpt: entry.data.excerpt,
      cover: existingImages([entry.data.coverImage])[0],
      entry,
    }))
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());
