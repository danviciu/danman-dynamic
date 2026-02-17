import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const IMG_ROOT = path.join(ROOT_DIR, "public", "img");
const DATA_DIR = path.join(ROOT_DIR, "src", "data");
const PRODUCTS_PATH = path.join(DATA_DIR, "products.json");
const CATEGORIES_PATH = path.join(DATA_DIR, "categories.json");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const FORMAT_PRIORITY = new Map([
  [".avif", 5],
  [".webp", 4],
  [".jpg", 3],
  [".jpeg", 3],
  [".png", 2],
]);
const MAX_IMAGES_PER_PRODUCT = 18;
const DEFAULT_FINISHES = ["ulei", "lac", "bait"];

const CATEGORY_RULES = {
  bar: {
    shortDesc: "Bar la comanda din lemn masiv, configurat pentru uz rezidential sau comercial.",
    priceFrom: 7800,
    leadTimeDays: 20,
    materials: ["lemn masiv", "metal"],
  },
  biblioteca: {
    shortDesc: "Biblioteca personalizata pentru living, birou sau zona de lucru.",
    priceFrom: 4600,
    leadTimeDays: 16,
    materials: ["lemn masiv", "MDF furniruit"],
  },
  blaturi: {
    shortDesc: "Blaturi din lemn masiv, finisate premium pentru rezistenta zilnica.",
    priceFrom: 3200,
    leadTimeDays: 14,
    materials: ["lemn masiv", "stejar"],
  },
  bucatarie: {
    shortDesc: "Bucatarie la comanda cu compartimentare optimizata si finisaj premium.",
    priceFrom: 9800,
    leadTimeDays: 25,
    materials: ["lemn masiv", "MDF vopsit"],
  },
  cadouri: {
    shortDesc: "Cadouri personalizate din lemn masiv, realizate artizanal.",
    priceFrom: 900,
    leadTimeDays: 7,
    materials: ["lemn masiv", "esente selectate"],
  },
  categorii: {
    shortDesc: "Selectie de piese realizate la comanda din lemn masiv.",
    priceFrom: 3500,
    leadTimeDays: 15,
    materials: ["lemn masiv"],
  },
  "din-palet": {
    shortDesc: "Mobilier rustic din lemn recuperat si palet, refinisat profesional.",
    priceFrom: 2400,
    leadTimeDays: 12,
    materials: ["lemn masiv", "lemn recuperat"],
  },
  diverse: {
    shortDesc: "Proiecte diverse la comanda, adaptate exact pe dimensiunile spatiului.",
    priceFrom: 2800,
    leadTimeDays: 15,
    materials: ["lemn masiv"],
  },
  "dulap-de-baie": {
    shortDesc: "Dulap de baie la comanda, rezistent la umiditate si usor de intretinut.",
    priceFrom: 4200,
    leadTimeDays: 16,
    materials: ["lemn masiv", "MDF rezistent la umiditate"],
  },
  foisoare: {
    shortDesc: "Foisoare si structuri exterioare din lemn masiv, proiectate la comanda.",
    priceFrom: 14500,
    leadTimeDays: 30,
    materials: ["lemn masiv", "elemente structurale"],
  },
  jucarii: {
    shortDesc: "Jucarii din lemn masiv, finisate cu produse sigure pentru copii.",
    priceFrom: 650,
    leadTimeDays: 8,
    materials: ["lemn masiv", "vopsea non-toxica"],
  },
  marchize: {
    shortDesc: "Marchize din lemn cu protectie la intemperii si design personalizat.",
    priceFrom: 7600,
    leadTimeDays: 24,
    materials: ["lemn masiv", "metal"],
  },
  mese: {
    shortDesc: "Mese din lemn masiv, dimensionate pentru dining, living sau birou.",
    priceFrom: 5600,
    leadTimeDays: 22,
    materials: ["lemn masiv", "stejar"],
  },
  paturi: {
    shortDesc: "Paturi din lemn masiv cu structura robusta si finisaje premium.",
    priceFrom: 7200,
    leadTimeDays: 24,
    materials: ["lemn masiv", "furnir natural"],
  },
  porti: {
    shortDesc: "Porti din lemn masiv cu feronerie premium si executie rezistenta.",
    priceFrom: 8900,
    leadTimeDays: 26,
    materials: ["lemn masiv", "feronerie premium"],
  },
  rafturi: {
    shortDesc: "Rafturi la comanda pentru depozitare eficienta si aspect coerent.",
    priceFrom: 2200,
    leadTimeDays: 12,
    materials: ["lemn masiv", "MDF furniruit"],
  },
  riflaj: {
    shortDesc: "Riflaj decorativ din lemn pentru pereti, scari si separari de spatiu.",
    priceFrom: 3000,
    leadTimeDays: 12,
    materials: ["lemn masiv", "furnir"],
  },
  scari: {
    shortDesc: "Scari din lemn masiv si metal, proiectate pentru trafic intensiv.",
    priceFrom: 12500,
    leadTimeDays: 28,
    materials: ["lemn masiv", "metal"],
  },
  usi: {
    shortDesc: "Usi interioare la comanda, cu toc, feronerie si finisaj premium.",
    priceFrom: 4300,
    leadTimeDays: 18,
    materials: ["lemn masiv", "MDF"],
  },
};

function toSlug(input) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toName(input) {
  return input
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toWebImagePath(relativePath) {
  // Public assets are referenced from web root, e.g. /img/paturi/file.webp
  const normalized = relativePath.split(path.sep).join("/");
  const encoded = normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/img/${encoded}`;
}

function extensionPriority(extension) {
  return FORMAT_PRIORITY.get(extension.toLowerCase()) ?? 0;
}

async function collectImageFilesRecursively(absoluteDir, relativeDir = "") {
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const imageFiles = [];

  for (const entry of entries) {
    const absoluteEntryPath = path.join(absoluteDir, entry.name);
    const relativeEntryPath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

    if (entry.isDirectory()) {
      imageFiles.push(...(await collectImageFilesRecursively(absoluteEntryPath, relativeEntryPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) {
      continue;
    }

    const relativeWithoutExt = relativeEntryPath.slice(0, -extension.length).toLowerCase();
    imageFiles.push({
      absolutePath: absoluteEntryPath,
      relativePath: relativeEntryPath,
      relativeWithoutExt,
      extension,
      webPath: toWebImagePath(relativeEntryPath),
    });
  }

  return imageFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "ro", { sensitivity: "base" }));
}

function dedupeByPreferredFormat(imageFiles) {
  const bestByBaseName = new Map();

  for (const image of imageFiles) {
    const current = bestByBaseName.get(image.relativeWithoutExt);
    if (!current) {
      bestByBaseName.set(image.relativeWithoutExt, image);
      continue;
    }

    if (extensionPriority(image.extension) > extensionPriority(current.extension)) {
      bestByBaseName.set(image.relativeWithoutExt, image);
    }
  }

  return [...bestByBaseName.values()].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, "ro", { sensitivity: "base" }),
  );
}

async function sha1ForFile(filePath) {
  const buffer = await fs.readFile(filePath);
  return createHash("sha1").update(buffer).digest("hex");
}

async function dedupeByContent(imageFiles) {
  const unique = [];
  const seenHashes = new Set();

  for (const image of imageFiles) {
    const sha1 = await sha1ForFile(image.absolutePath);
    if (seenHashes.has(sha1)) {
      continue;
    }

    seenHashes.add(sha1);
    unique.push(image);
  }

  return unique;
}

function buildProductFromCategory({ folderName, slug, imagePaths, totalImageCount }) {
  const name = toName(folderName);
  const rule = CATEGORY_RULES[slug] ?? {
    shortDesc: "Realizat la comanda din lemn masiv, finisaj premium.",
    priceFrom: 3500,
    leadTimeDays: 15,
    materials: ["lemn masiv"],
  };

  const visibleImages = imagePaths.slice(0, MAX_IMAGES_PER_PRODUCT);
  const coverImage = visibleImages[0] ?? "/img/placeholder.png";
  const longDesc = `${name} personalizat in functie de dimensiuni, stil si utilizare. Executam din lemn masiv, cu atentie la detalii, finisaje premium si montaj profesionist pentru un rezultat durabil.`;

  return {
    id: slug,
    slug,
    name,
    category: name,
    shortDesc: rule.shortDesc,
    longDesc,
    priceFrom: rule.priceFrom,
    leadTimeDays: rule.leadTimeDays,
    materials: rule.materials,
    finishes: DEFAULT_FINISHES,
    images: visibleImages.length > 0 ? visibleImages : ["/img/placeholder.png"],
    coverImage,
    featured: false,
    totalImages: totalImageCount,
    hasMoreImages: totalImageCount > MAX_IMAGES_PER_PRODUCT,
    seo: {
      title: `${name} la comanda | DanMan`,
      description: `${name} realizat la comanda din lemn masiv, finisaje premium si montaj profesionist - DanMan.`,
    },
  };
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const rootEntries = await fs.readdir(IMG_ROOT, { withFileTypes: true });
  const categoryDirs = rootEntries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, "ro", { sensitivity: "base" }));

  const products = [];

  for (const categoryDir of categoryDirs) {
    const folderName = categoryDir.name;
    const slug = toSlug(folderName);

    if (!slug) {
      continue;
    }

    const absoluteCategoryDir = path.join(IMG_ROOT, folderName);
    const allImageFiles = await collectImageFilesRecursively(absoluteCategoryDir, folderName);
    const formatDeduped = dedupeByPreferredFormat(allImageFiles);
    const contentDeduped = await dedupeByContent(formatDeduped);
    const imagePaths = contentDeduped.map((image) => image.webPath);

    products.push(
      buildProductFromCategory({
        folderName,
        slug,
        imagePaths,
        totalImageCount: imagePaths.length,
      }),
    );
  }

  const featuredSlugs = new Set(
    [...products]
      .sort((a, b) => {
        if (b.totalImages !== a.totalImages) {
          return b.totalImages - a.totalImages;
        }
        return a.name.localeCompare(b.name, "ro", { sensitivity: "base" });
      })
      .slice(0, 6)
      .map((product) => product.slug),
  );

  const normalizedProducts = products.map((product) => ({
    ...product,
    featured: featuredSlugs.has(product.slug),
  }));

  const categories = normalizedProducts.map((product) => ({
    name: product.name,
    slug: product.slug,
    imageCount: product.totalImages,
    coverImage: product.coverImage,
  }));

  await fs.writeFile(PRODUCTS_PATH, `${JSON.stringify(normalizedProducts, null, 2)}\n`, "utf8");
  await fs.writeFile(CATEGORIES_PATH, `${JSON.stringify(categories, null, 2)}\n`, "utf8");

  console.log(`Catalog generated: ${normalizedProducts.length} categorii`);
  console.log(`Products JSON: ${path.relative(ROOT_DIR, PRODUCTS_PATH)}`);
  console.log(`Categories JSON: ${path.relative(ROOT_DIR, CATEGORIES_PATH)}`);
}

main().catch((error) => {
  console.error("Failed to build catalog:", error);
  process.exitCode = 1;
});
