#!/usr/bin/env node
/**
 * check-links.js — проверяет, что относительные ссылки (href/src) во всех
 * сгенерированных .html-файлах ведут на существующие файлы.
 * Внешние (http/https), mailto:, tel:, javascript: и якоря (#...) не проверяются,
 * хэш-фрагмент у внутренней ссылки отбрасывается перед проверкой файла.
 * Запуск: node check-links.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

function walk(dir, out) {
  out = out || [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") return;
      walk(full, out);
    } else if (entry.name.endsWith(".html")) {
      out.push(full);
    }
  });
  return out;
}

function extractRefs(html) {
  const refs = [];
  const re = /(?:href|src)="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    refs.push(m[1]);
  }
  return refs;
}

function isSkippable(ref) {
  if (!ref) return true;
  if (ref.startsWith("#")) return true;
  if (ref.startsWith("http://") || ref.startsWith("https://")) return true;
  if (ref.startsWith("mailto:") || ref.startsWith("tel:")) return true;
  if (ref.startsWith("javascript:")) return true;
  if (ref.startsWith("about:")) return true;
  if (ref.startsWith("//")) return true;
  return false;
}

function main() {
  const files = walk(ROOT);
  let errors = 0;
  let checked = 0;

  files.forEach((file) => {
    const html = fs.readFileSync(file, "utf8");
    const refs = extractRefs(html);
    const dir = path.dirname(file);

    refs.forEach((ref) => {
      if (isSkippable(ref)) return;
      const withoutHash = ref.split("#")[0].split("?")[0];
      if (!withoutHash) return; // ссылка была чисто якорем в пределах той же страницы
      if (ref.startsWith("/")) {
        console.error(`[ABS PATH] ${path.relative(ROOT, file)} -> "${ref}" (путь с ведущим / запрещён)`);
        errors++;
        return;
      }
      checked++;
      const target = path.resolve(dir, withoutHash);
      if (!fs.existsSync(target)) {
        console.error(`[BROKEN] ${path.relative(ROOT, file)} -> "${ref}"`);
        errors++;
      }
    });
  });

  console.log(`\nПроверено файлов: ${files.length}. Проверено ссылок: ${checked}. Битых: ${errors}.`);
  if (errors > 0) process.exit(1);
}

main();
