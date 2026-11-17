import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// Campurile de mai jos trebuie sa ramana sincronizate cu public/admin/config.yml (Decap CMS).
// Accepta atat { image, alt } cat si un simplu sir (cale), ca sa nu pice build-ul.
const imageItem = z.union([
  z.string().transform((image) => ({ image, alt: undefined as string | undefined })),
  z.object({ image: z.string(), alt: z.string().optional() }),
]);
const imageList = z.array(imageItem).optional().default([]);

const seo = {
  seoTitle: z.string().optional(),
  seoDesc: z.string().optional(),
};

const products = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/products" }),
  schema: z.object({
    title: z.string(),
    category: z.string(),
    featured: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
    price: z.number().optional(),
    priceFrom: z.number().optional(),
    leadTimeDays: z.number().optional(),
    materials: z.array(z.string()).optional(),
    finishes: z.array(z.string()).optional(),
    shortDesc: z.string(),
    longDesc: z.string(),
    materialsText: z.string().optional(),
    dimensionsText: z.string().optional(),
    careText: z.string().optional(),
    shippingText: z.string().optional(),
    returnText: z.string().optional(),
    benefits: z.array(z.string()).optional(),
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    options: z
      .array(
        z.object({
          cod: z.string().optional(),
          nume: z.string(),
          valori: z.array(
            z.object({
              nume: z.string(),
              cost_add: z.number().optional().default(0),
              data_attr: z.string().optional(),
            }),
          ),
        }),
      )
      .optional(),
    images: imageList,
    ...seo,
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    category: z.string().optional(),
    year: z.number().optional(),
    location: z.string().optional(),
    story: z.string().optional(),
    shortDesc: z.string().optional(),
    featured: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
    products: z.array(z.string()).optional(),
    images: imageList,
    ...seo,
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string(),
    coverImage: z.string().optional(),
    draft: z.boolean().optional().default(false),
    ...seo,
  }),
});

export const collections = { products, projects, blog };
