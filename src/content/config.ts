import { defineCollection, z } from "astro:content";

const productsCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    category: z.string(),
    featured: z.boolean().optional().default(false),
    priceFrom: z.number().optional(),
    sizeOptions: z
      .array(
        z.object({
          size: z.string(),
          price: z.number(),
        })
      )
      .optional()
      .default([]),
    leadTimeDays: z.number().optional(),
    materials: z.array(z.string()).optional(),
    finishes: z.array(z.string()).optional(),
    shortDesc: z.string(),
    longDesc: z.string(),
    images: z
      .array(
        z.object({
          image: z.string(),
        })
      )
      .optional()
      .default([]),
    seoTitle: z.string().optional(),
    seoDesc: z.string().optional(),
  }),
});

const projectsCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    year: z.number().optional(),
    location: z.string().optional(),
    story: z.string().optional(),
    shortDesc: z.string().optional(),
    featured: z.boolean().optional().default(false),
    images: z
      .array(
        z.object({
          image: z.string(),
        })
      )
      .optional()
      .default([]),
    seoTitle: z.string().optional(),
    seoDesc: z.string().optional(),
  }),
});

export const collections = {
  products: productsCollection,
  projects: projectsCollection,
};
