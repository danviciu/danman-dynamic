import site from "../data/site.json";
import { absoluteImageUrl } from "./images";

export const absoluteUrl = (path: string) => new URL(path, site.domain).toString();

/** JSON pentru <script type="application/ld+json">, protejat impotriva "</script>" din continutul CMS. */
export const serializeJsonLd = (data: unknown) =>
  JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));

export const addressText = () =>
  [site.address.street, site.address.locality, site.address.region ? `jud. ${site.address.region}` : ""]
    .filter(Boolean)
    .join(", ");

export const businessSchema = () => ({
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  "@id": `${site.domain}/#business`,
  name: site.brandName,
  url: site.domain,
  logo: absoluteImageUrl(site.logo, site.domain),
  image: absoluteImageUrl(site.seo.ogImage, site.domain),
  telephone: site.phone,
  email: site.email,
  description: site.seo.defaultDescription,
  address: {
    "@type": "PostalAddress",
    streetAddress: site.address.street,
    addressLocality: site.address.locality,
    addressRegion: site.address.region,
    ...(site.address.postalCode ? { postalCode: site.address.postalCode } : {}),
    addressCountry: site.address.country,
  },
  ...(site.openingHours ? { openingHours: site.openingHours } : {}),
  areaServed: site.areaServed,
  sameAs: site.social.map((s) => s.url).filter(Boolean),
});

export interface Crumb {
  label: string;
  href: string;
}

export const breadcrumbSchema = (crumbs: Crumb[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.label,
    item: absoluteUrl(crumb.href),
  })),
});

export const faqSchema = (faqs: Array<{ q: string; a: string }>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
});
