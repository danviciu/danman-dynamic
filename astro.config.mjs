// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const EXCLUDED = ["/admin", "/confirm", "/404"];

// https://astro.build/config
export default defineConfig({
  site: "https://danman.ro",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [
    sitemap({
      filter: (page) => !EXCLUDED.some((path) => new URL(page).pathname.startsWith(path)),
      changefreq: "weekly",
      lastmod: new Date(),
    }),
  ],
});
