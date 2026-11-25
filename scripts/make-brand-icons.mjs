// Genereaza iconitele site-ului din logo-ul original (public/img/logo-danman-woodworks1.webp).
// Ruleaza manual cand se schimba logo-ul: node scripts/make-brand-icons.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const SRC = "public/img/logo-danman-woodworks1.webp";
const OUT = "public/img/brand";
// zona cu hexagonul si brazii (fara text), din imaginea de 963x1000
const MARK = { left: 140, top: 25, width: 690, height: 690 };

const mark = () => sharp(SRC).extract(MARK);

await mark().resize(256).png().toFile(`${OUT}/logo-mark.png`);
await mark().resize(256).webp({ quality: 90 }).toFile(`${OUT}/logo-mark.webp`);
await sharp(SRC).resize(400).webp({ quality: 90 }).toFile(`${OUT}/logo-full.webp`);
await mark().resize(180).png().toFile("public/apple-touch-icon.png");
await mark().resize(192).png().toFile("public/icon-192.png");
await mark().resize(512).png().toFile("public/icon-512.png");
const png32 = await mark().resize(32).png().toBuffer();
await writeFile("public/favicon-32.png", png32);

// favicon.ico cu PNG incorporat (format acceptat de toate browserele moderne)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0);
entry.writeUInt8(32, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png32.length, 8);
entry.writeUInt32LE(22, 12);
await writeFile("public/favicon.ico", Buffer.concat([header, entry, png32]));
console.log("iconite generate");
