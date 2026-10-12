#!/usr/bin/env node
/**
 * optimize-uploads.js — картинки, загруженные через админку (assets/img/uploads),
 * переводит в WebP: качество 80, ширина до 1600 px (без увеличения).
 * Исходный jpg/jpeg/png удаляется, расширение в data/projects.json меняется на .webp.
 * Запускается в GitHub Actions перед сборкой (нужен sharp: npm i --no-save sharp).
 * Запуск вручную: node scripts/optimize-uploads.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const UPLOADS = path.join(ROOT, "assets", "img", "uploads");
const DATA = path.join(ROOT, "data", "projects.json");
const RE = /\.(jpe?g|png)$/i;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (RE.test(e.name)) out.push(full);
  });
  return out;
}

(async () => {
  const files = walk(UPLOADS, []);
  if (!files.length) { console.log("optimize-uploads: нечего конвертировать"); return; }
  const sharp = require("sharp");
  const renamed = {}; // "assets/img/uploads/a.jpg" -> "assets/img/uploads/a.webp"
  for (const file of files) {
    const webp = file.replace(RE, ".webp");
    const relOld = path.relative(ROOT, file).split(path.sep).join("/");
    try {
      if (!fs.existsSync(webp)) {
        await sharp(file).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(webp);
      }
      fs.unlinkSync(file);
      renamed[relOld] = relOld.replace(RE, ".webp");
      console.log("optimize-uploads:", relOld, "→ webp");
    } catch (e) {
      console.warn("optimize-uploads: не удалось обработать", relOld, "-", e.message);
    }
  }
  // поправить пути в данных; размеры w/h сбрасываем — build.js прочитает их из нового файла
  const raw = fs.readFileSync(DATA, "utf8");
  const data = JSON.parse(raw);
  let changed = 0;
  (function fix(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(fix);
    if (typeof node.src === "string") {
      const key = node.src.replace(/^\/+/, "");
      if (renamed[key]) {
        node.src = (node.src.startsWith("/") ? "/" : "") + renamed[key];
        delete node.w;
        delete node.h;
        changed++;
      }
    }
    Object.values(node).forEach(fix);
  })(data);
  if (changed) fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
  console.log(`optimize-uploads: файлов ${Object.keys(renamed).length}, ссылок в projects.json исправлено ${changed}`);
})().catch((e) => { console.error(e); process.exit(1); });
