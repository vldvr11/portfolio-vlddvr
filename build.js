#!/usr/bin/env node
/**
 * build.js — собирает статический сайт-портфолио из data/*.json.
 * Без зависимостей, чистый Node.js. Запуск: node build.js
 *
 * Источники данных:
 *   data/site.json      — контакты, PUBLIC, baseUrl
 *   data/taxonomy.json  — направления, ответвления (branches), группы тегов
 *   data/projects.json  — кейсы
 *
 * Генерирует:
 *   index.html, about.html, projects/<slug>.html, directions/<id>.html   (RU, корень)
 *   en/index.html, en/about.html, en/projects/<slug>.html, en/directions/<id>.html (EN)
 *   robots.txt
 *   sitemap.xml — только если site.json: PUBLIC = true
 */

"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");

const site = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "site.json"), "utf8"));
const taxonomy = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "taxonomy.json"), "utf8"));
const projects = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "projects.json"), "utf8"));

const PUBLIC = site.PUBLIC === true;
const BASE_URL = site.baseUrl.endsWith("/") ? site.baseUrl : site.baseUrl + "/";

const sortedProjects = projects.slice().sort((a, b) => (a.order || 0) - (b.order || 0));

/* ------------------------------------------------------------------ */
/* Таксономия: направления и ответвления, только те, где есть кейсы   */
/* ------------------------------------------------------------------ */
function projectHasDirection(p, dirId) {
  return (p.directions || []).includes(dirId);
}
function projectHasBranch(p, branchId) {
  return (p.branches || []).includes(branchId);
}

const visibleDirections = taxonomy.directions
  .filter((d) => !d.hidden)
  .filter((d) => sortedProjects.some((p) => projectHasDirection(p, d.id)))
  .map((d) => {
    const branches = (d.branches || []).filter((b) =>
      sortedProjects.some((p) => projectHasDirection(p, d.id) && projectHasBranch(p, b.id))
    );
    return Object.assign({}, d, { branches });
  });

const branchToDirection = {};
taxonomy.directions.forEach((d) => {
  (d.branches || []).forEach((b) => {
    branchToDirection[b.id] = d.id;
  });
});

const industryById = {};
(taxonomy.tagGroups.industry || []).forEach((t) => {
  industryById[t.id] = t;
});


const formatById = {};
(taxonomy.tagGroups.format || []).forEach((t) => {
  formatById[t.id] = t;
});

const directionById = {};
taxonomy.directions.forEach((d) => {
  directionById[d.id] = d;
});

/* ------------------------------------------------------------------ */
/* Словари интерфейса                                                 */
/* ------------------------------------------------------------------ */
const L = {
  ru: {
    skip: "К содержанию",
    nav_works: "Работы",
    nav_about: "Обо мне",
    nav_label: "Основное меню",
    lang_label: "Язык",
    write_btn: "Написать",
    hero_eyebrow: "vlddvr — универсальный дизайнер",
    hero_lines: ["Стенды.", "Бренды.", "Моушен."],
    hero_subtitle:
      "Брендинг, 3D, моушен, печать, веб и AI-визуалы. Ниже — избранные работы по направлениям.",
    contact_btn: "Обсудить проект",
    works_title: "Работы",
    works_btn: "Работы",
    clients_label: "Клиенты",
    filter_label: "Фильтр по направлениям",
    branch_filter_label: "Фильтр по ответвлениям",
    filter_all: "Все",
    filter_all_branches: "Все ответвления",
    view_case: "Смотреть кейс",
    back: "Все работы",
    task: "Задача",
    approach: "Подход",
    result: "Результат",
    act: "Акт",
    discuss: "Обсудить проект",
    cta_title: "Есть похожая задача?",
    cta_text: "Напишите в Telegram — обсудим сроки, формат и бюджет.",
    behance: "Смотреть на Behance",
    next_case: "Следующий кейс",
    download_pdf: "Скачать PDF",
    open_demo: "Открыть демо",
    ai_badge: "Сделано с ИИ",
    personal_badge: "Личный проект",
    about_title: "Обо мне",
    about_bio: "Короткий текст о себе: опыт, специализация, подход к работе. Заполняется позже.",
    tools_title: "Инструменты",
    contacts_title: "Контакты",
    contact_lines: ["Есть", "задача?"],
    email_label: "Почта",
    footer_rights: "Все права защищены.",
    footer_tagline: "дизайн-портфолио",
    client_label: "Клиент",
    direction_label: "Направление",
    format_label: "Формат",
    tools_label: "Инструменты",
    featured_label: "Избранная работа",
    branches_label: "Ответвления",
    industry_label: "Индустрия",
    direction_back: "На главную",
    direction_no_branch: "Без ответвления",
    directions_title: "Направление",
    cases_word: "кейсов",
  },
  en: {
    skip: "Skip to content",
    nav_works: "Work",
    nav_about: "About",
    nav_label: "Main menu",
    lang_label: "Language",
    write_btn: "Message",
    hero_eyebrow: "vlddvr — versatile designer",
    hero_lines: ["Stands.", "Brands.", "Motion."],
    hero_subtitle:
      "Branding, 3D, motion, print, web and AI visuals. Selected work by direction below.",
    contact_btn: "Discuss a project",
    works_title: "Work",
    works_btn: "Work",
    clients_label: "Clients",
    filter_label: "Filter by direction",
    branch_filter_label: "Filter by branch",
    filter_all: "All",
    filter_all_branches: "All branches",
    view_case: "View case",
    back: "All work",
    task: "Task",
    approach: "Approach",
    result: "Result",
    act: "Act",
    discuss: "Discuss a project",
    cta_title: "Got a similar task?",
    cta_text: "Message me on Telegram — let's talk timing, format and budget.",
    behance: "View on Behance",
    next_case: "Next case",
    download_pdf: "Download PDF",
    open_demo: "Open demo",
    ai_badge: "Made with AI",
    personal_badge: "Personal project",
    about_title: "About",
    about_bio: "A short bio: experience, specialization, approach to work. To be filled in later.",
    tools_title: "Tools",
    contacts_title: "Contacts",
    contact_lines: ["Got a", "project?"],
    email_label: "Email",
    footer_rights: "All rights reserved.",
    footer_tagline: "design portfolio",
    client_label: "Client",
    direction_label: "Direction",
    format_label: "Format",
    tools_label: "Tools",
    featured_label: "Featured work",
    branches_label: "Branches",
    industry_label: "Industry",
    direction_back: "Back to home",
    direction_no_branch: "No branch",
    directions_title: "Direction",
    cases_word: "cases",
  },
};

const ROMAN = ["I", "II", "III", "IV", "V"];

/* ------------------------------------------------------------------ */
/* Обо мне: факты только из facts.md («Резюме hh.uz»).                */
/* Не публикуются: телефон, дата рождения, зарплата, канал lvgprtl.   */
/* Дата рождения нужна только для расчёта возраста при сборке —       */
/* сама на сайте не выводится.                                        */
/* ------------------------------------------------------------------ */
const BIRTH_DATE = "2001-09-11";

function ageOn(birthIso, now) {
  const [y, m, d] = birthIso.split("-").map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}
function ruYears(n) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "год";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "года";
  return "лет";
}
const AGE = ageOn(BIRTH_DATE, new Date());

const ABOUT = {
  ru: {
    name: ["Владлен", "Лукин"],
    who_title: "Кто я",
    more: "Подробнее обо мне",
    place: `${AGE} ${ruYears(AGE)} · Ташкент`,
    positioning:
      "Дизайнер из Ташкента. Больше шести лет работаю в пяти направлениях: моушн-графика, графический дизайн, веб-дизайн, 3D и нейросети — in-house, в агентстве и на аутсорсе.",
    facts: [
      { n: "6+", label: "лет опыта" },
      { n: "5", label: "направлений" },
      { n: "5", label: "компаний в штате" },
    ],
    directions: ["Моушн-графика", "Графический дизайн", "Веб-дизайн", "3D", "Нейросети"],
    directions_label: "Направления",
    tools_label: "Инструменты",
    companies_label: "Работал в",
    experience_title: "Опыт",
    skills_title: "Навыки",
    present: "н. в.",
    skills: ["Моушн", "VFX", "Композитинг", "Нейровизуализация", "Веб-дизайн", "Инфографика", "Цветокоррекция"],
    photo_alt: "Владлен Лукин (vlddvr) — портрет",
    photo2_alt: "Портрет Владлена Лукина в студии",
    timeline: [
      { from: "апр 2026", to: null, company: "THE ONE (Terra Pro)", note: "Розничная сеть: одежда, обувь, аксессуары", role: "Графический дизайнер (нейросети)", what: "" },
      { from: "дек 2025", to: "фев 2026", company: "Great Wall Motors", note: "", role: "Дизайнер", what: "Идеи и образы, дизайн рекламы для соцсетей, визуальные эффекты в компьютерной графике, презентации." },
      { from: "май 2024", to: "ноя 2025", company: "Dream City", note: "", role: "Моушн-дизайнер", what: "Видео для SMM и офлайн-рекламы; единственный моушн-дизайнер компании за всё время; нейросети и 3D." },
      { from: "май 2023", to: "апр 2024", company: "MOLLEQULA Agency", note: "", role: "Старший дизайнер с основания агентства", what: "Видео, SMM-посты, рилс и сторис, полное оформление бренда: брендбук, логотип, типографика, айдентика." },
      { from: "янв 2020", to: "май 2023", company: "EXZAP HOLDING", note: "Автозапчасти, шины", role: "Дизайнер", what: "Сайты, брендбуки, упаковка новых товаров, визитки, логотипы, видео, 3D-презентации, SMM." },
    ],
  },
  en: {
    name: ["Vladlen", "Lukin"],
    who_title: "About me",
    more: "More about me",
    place: `${AGE} y.o. · Tashkent`,
    positioning:
      "Designer based in Tashkent. For over six years I've worked across five directions: motion graphics, graphic design, web design, 3D and AI — in-house, in an agency and as an outsourcer.",
    facts: [
      { n: "6+", label: "years of experience" },
      { n: "5", label: "directions" },
      { n: "5", label: "in-house companies" },
    ],
    directions: ["Motion graphics", "Graphic design", "Web design", "3D", "AI"],
    directions_label: "Directions",
    tools_label: "Tools",
    companies_label: "Worked at",
    experience_title: "Experience",
    skills_title: "Skills",
    present: "present",
    skills: ["Motion", "VFX", "Compositing", "AI visualization", "Web design", "Infographics", "Color grading"],
    photo_alt: "Vladlen Lukin (vlddvr) — portrait",
    photo2_alt: "Studio portrait of Vladlen Lukin",
    timeline: [
      { from: "Apr 2026", to: null, company: "THE ONE (Terra Pro)", note: "Retail chain: clothing, footwear, accessories", role: "Graphic designer (AI)", what: "" },
      { from: "Dec 2025", to: "Feb 2026", company: "Great Wall Motors", note: "", role: "Designer", what: "Ideas and concepts, social media ad design, CG visual effects, presentations." },
      { from: "May 2024", to: "Nov 2025", company: "Dream City", note: "", role: "Motion designer", what: "Videos for social media and offline ads; the company's only motion designer throughout; AI and 3D." },
      { from: "May 2023", to: "Apr 2024", company: "MOLLEQULA Agency", note: "", role: "Senior designer since the agency's founding", what: "Video, social posts, reels and stories, full brand design: brand book, logo, typography, identity." },
      { from: "Jan 2020", to: "May 2023", company: "EXZAP HOLDING", note: "Auto parts, tyres", role: "Designer", what: "Websites, brand books, packaging for new products, business cards, logos, video, 3D presentations, SMM." },
    ],
  },
};
// Компании строкой (как в резюме) и инструменты
const ABOUT_COMPANIES = ["Great Wall Motors", "Dream City", "MOLLEQULA", "EXZAP HOLDING", "THE ONE / Terra Pro"];
const ABOUT_TOOLS_SHORT = ["Blender", "Cinema 4D", "After Effects", "Photoshop", "Illustrator", "Figma"];
const ABOUT_TOOLS_FULL = ["Blender", "Cinema 4D", "Photoshop", "Illustrator", "InDesign", "After Effects", "Premiere Pro", "Figma"];

// Портреты: ч/б дуотон, WebP + JPEG, ширины без апскейла
const PORTRAITS = {
  main: { base: "assets/img/about/portrait-main", widths: [800, 1159], w: 1159, h: 1449, focus: "56% 40%" },
  alt: { base: "assets/img/about/portrait-alt", widths: [800, 1480], w: 1480, h: 1480, focus: "50% 30%" },
};

function renderPortrait(key, alt, depth, sizes, opts) {
  opts = opts || {};
  const p = PORTRAITS[key];
  const set = (ext) => p.widths.map((w) => `${rel(`${p.base}-${w}.${ext}`, depth)} ${w}w`).join(", ");
  const loading = opts.eager ? ` fetchpriority="high"` : ` loading="lazy" decoding="async"`;
  return (
    `<picture>` +
    `<source type="image/webp" srcset="${set("webp")}" sizes="${sizes}">` +
    `<img src="${rel(`${p.base}-${p.widths[0]}.jpg`, depth)}" srcset="${set("jpg")}" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(alt)}" style="object-position:${p.focus}"${loading}>` +
    `</picture>`
  );
}

function renderFactPlates(a) {
  return `<ul class="fact-plates">
          ${a.facts.map((f) => `<li><b>${esc(f.n)}</b><span>${esc(f.label)}</span></li>`).join("\n          ")}
        </ul>`;
}

/* Блок «Кто я» на главной — после работ */
function renderWhoBlock(lang, depth) {
  const t = L[lang];
  const a = ABOUT[lang];
  const aboutHref = rel(rootPathFor("about", null, lang), depth);
  const fit = Math.max(...a.name.map((w) => fitOf(w)));
  return `<section class="who" id="who" aria-labelledby="who-title">
    <div class="container">
      <div class="sec-head"><span class="h2 who-kicker">${a.who_title}</span><span class="count">vlddvr</span></div>
      <h2 class="h-giant who-name" id="who-title" style="--fit:${fit}"><span>${esc(a.name[0])}</span> <span class="acid">${esc(a.name[1])}</span></h2>
      <div class="who-grid">
        <figure class="who-photo">
          ${renderPortrait("main", a.photo_alt, depth, "(min-width: 1100px) 520px, (min-width: 720px) 45vw, 100vw")}
          <figcaption class="photo-plate">${esc(a.place)}</figcaption>
        </figure>
        <div class="who-copy">
          <p class="eyebrow">${esc(a.place)}</p>
          <p class="lead">${esc(a.positioning)}</p>
          ${renderFactPlates(a)}
          <dl class="who-lists">
            <div><dt>${a.directions_label}</dt><dd>${a.directions.map(esc).join(" · ")}</dd></div>
            <div><dt>${a.tools_label}</dt><dd>${ABOUT_TOOLS_SHORT.map(esc).join(" · ")}</dd></div>
          </dl>
          <div class="hero-ctas">
            <a class="btn" href="${esc(site.contacts.telegram)}" target="_blank" rel="noopener">${t.contact_btn} →</a>
            <a class="btn btn--ghost" href="${aboutHref}">${a.more}</a>
          </div>
        </div>
      </div>
    </div>
    <div class="company-strip" aria-label="${a.companies_label}">
      <div class="container"><span class="company-label">${a.companies_label}</span>${ABOUT_COMPANIES.map((c) => `<span class="company">${esc(c)}</span>`).join("")}</div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* Утилиты путей                                                      */
/* ------------------------------------------------------------------ */
function rel(targetFromRoot, depth) {
  return "../".repeat(depth) + targetFromRoot;
}

function rootPathFor(kind, slug, lang) {
  if (kind === "index") return lang === "ru" ? "index.html" : "en/index.html";
  if (kind === "about") return lang === "ru" ? "about.html" : "en/about.html";
  if (kind === "project")
    return lang === "ru" ? `projects/${slug}.html` : `en/projects/${slug}.html`;
  if (kind === "direction")
    return lang === "ru" ? `directions/${slug}.html` : `en/directions/${slug}.html`;
  throw new Error("unknown kind " + kind);
}

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/* ------------------------------------------------------------------ */
/* Пропорции и кадрирование                                           */
/* Работы НЕ обрезаются: aspect-ratio берётся из w/h в данных.        */
/* Обрезка (object-fit: cover) только в hero и «следующем кейсе»,     */
/* с точкой фокуса из необязательного поля cover.focus ("60% 40%").   */
/* ------------------------------------------------------------------ */
function ratioOf(img) {
  return img && img.w > 0 && img.h > 0 ? img.w / img.h : 16 / 9;
}

// wide — 2.39:1, баннеры 1200x628 и т.п.; land — 16:9, 4:3, 3:2; square; tall — 4:5, 9:16, листы A4
function shapeOf(img) {
  const r = ratioOf(img);
  if (r >= 1.85) return "wide";
  if (r >= 1.2) return "land";
  if (r >= 0.9) return "square";
  return "tall";
}

function focusOf(img) {
  const f = img && typeof img.focus === "string" ? img.focus.trim() : "";
  return /^[a-z0-9%.\s-]{1,40}$/i.test(f) ? f : "50% 50%";
}

function frameStyle(img) {
  const w = img && img.w > 0 ? img.w : 16;
  const h = img && img.h > 0 ? img.h : 9;
  return `--ar:${w} / ${h};--focus:${esc(focusOf(img))}`;
}

// Длина самого длинного слова — для подгонки капс-заголовка под ширину экрана (CSS: --fit)
function fitOf(text) {
  // перенос возможен по пробелу и после дефиса, поэтому делим и по ним
  const words = String(text || "")
    .split(/\s+/)
    .reduce((acc, w) => acc.concat(w.split(/(?<=[-‐-–])/)), [])
    .filter(Boolean)
    .map((w) => Array.from(w).length);
  return Math.max(5, ...(words.length ? words : [5]));
}

/* ------------------------------------------------------------------ */
/* Рендер изображений: <picture> webp+jpg, либо прямой <img> для svg  */
/* ------------------------------------------------------------------ */
function renderImg(img, lang, depth, opts) {
  opts = opts || {};
  const alt = esc((img.alt && img.alt[lang]) || "");
  const srcRoot = img.src;
  const srcRel = rel(srcRoot, depth);
  const cls = opts.class ? ` class="${opts.class}"` : "";
  const loading = opts.eager ? ` fetchpriority="high"` : ` loading="lazy" decoding="async"`;

  if (/\.svg$/i.test(srcRoot)) {
    return `<img src="${srcRel}" width="${img.w}" height="${img.h}" alt="${alt}"${cls}${loading}>`;
  }

  // src может быть «…-1600.webp», «…-1200.webp», «….jpg» — собираем набор из реально существующих файлов
  const exists = (p) => fs.existsSync(path.join(__dirname, p));
  const m = srcRoot.match(/^(.*?)(?:-(\d+))?\.(webp|jpe?g|png)$/i);
  const base = m ? m[1] : srcRoot;
  const webps = [800, 1200, 1600].filter((w) => exists(`${base}-${w}.webp`));
  if (!webps.length && /\.webp$/i.test(srcRoot)) webps.push(null);
  const jpg = ["1600.jpg", "1200.jpg", "800.jpg"].map((s) => `${base}-${s}`).find(exists) ||
    (exists(base + ".jpg") ? base + ".jpg" : srcRoot);
  const srcset = webps.map((w) => (w ? `${rel(`${base}-${w}.webp`, depth)} ${w}w` : rel(srcRoot, depth))).join(", ");
  const sizes = opts.sizes || "(min-width: 900px) 60vw, 100vw";
  return (
    `<picture>` +
    (srcset ? `<source srcset="${srcset}"${webps[0] ? ` sizes="${sizes}"` : ""} type="image/webp">` : "") +
    `<img src="${rel(jpg, depth)}" width="${img.w}" height="${img.h}" alt="${alt}"${cls}${loading}>` +
    `</picture>`
  );
}

/* ------------------------------------------------------------------ */
/* Метки: «Личный проект» (p.personal) и «Сделано с ИИ» (p.aiContent) */
/* ------------------------------------------------------------------ */
function renderBadges(p, t) {
  const out = [];
  if (p.personal === true) out.push(`<span class="badge">${t.personal_badge}</span>`);
  if (p.aiContent) out.push(`<span class="badge badge--ai">${t.ai_badge}</span>`);
  return out.join(" ");
}

/* ------------------------------------------------------------------ */
/* Рендер блоков кейса                                                */
/* ------------------------------------------------------------------ */
function renderShot(img, lang, depth) {
  return `<figure class="shot shape-${shapeOf(img)}">${renderImg(img, lang, depth)}</figure>`;
}

function renderBlock(block, lang, depth, t) {
  switch (block.type) {
    case "text": {
      const text = esc((block.text && block.text[lang]) || "");
      const title = esc((block.title && block.title[lang]) || "");
      return `<div class="case-block block-text reveal">${title ? `<h2 class="block-title">${title}</h2>` : ""}${text ? `<p>${text}</p>` : ""}</div>`;
    }
    case "images": {
      const imgs = (block.images || []).map((img) => renderShot(img, lang, depth)).join("\n      ");
      return `<div class="case-block block-images">
      <div class="images-grid storyboard" data-lightbox>
      ${imgs}
      </div>
    </div>`;
    }
    case "pdf": {
      const pages = (block.pages || [])
        .map((p) => `<figure class="pdf-page">${renderImg(p, lang, depth)}</figure>`)
        .join("\n      ");
      const fileLink = block.file
        ? `<a class="btn btn--ghost pdf-download" href="${rel(block.file, depth)}" download>${t.download_pdf} ↓</a>`
        : "";
      return `<div class="case-block block-pdf">
      <div class="pdf-pages" data-lightbox>
      ${pages}
      </div>
      ${fileLink}
    </div>`;
    }
    case "video": {
      const poster = block.poster ? renderImg(block.poster, lang, depth) : "";
      const caption = esc((block.caption && block.caption[lang]) || "");
      let media = "";
      if (block.src) {
        const ar = block.poster ? ` style="aspect-ratio:${block.poster.w} / ${block.poster.h}"` : "";
        media = `<video controls preload="none" playsinline${ar} poster="${block.poster ? rel(block.poster.src, depth) : ""}"><source src="${rel(block.src, depth)}"></video>`;
      } else if (block.embed) {
        media = `<div class="video-embed-wrap"><iframe src="${esc(block.embed)}" loading="lazy" allowfullscreen title="video"></iframe></div>`;
      } else {
        media = `<div class="video-poster">${poster}</div>`;
      }
      return `<figure class="case-block block-video reveal">
      ${media}
      ${caption ? `<figcaption>${caption}</figcaption>` : ""}
    </figure>`;
    }
    case "embed": {
      const caption = esc((block.caption && block.caption[lang]) || "");
      const label = esc((block.label && block.label[lang]) || t.open_demo);
      const url = /^https?:/.test(block.url) ? block.url : rel(block.url, depth);
      return `<div class="case-block block-embed reveal">
      <div class="embed-frame-wrap"><iframe src="${esc(url)}" loading="lazy" title="demo"></iframe></div>
      <div class="embed-actions">
        <a class="btn btn--ghost" href="${esc(url)}" target="_blank" rel="noopener">${label} ↗</a>
        ${caption ? `<p>${caption}</p>` : ""}
      </div>
    </div>`;
    }
    case "sketchfab": {
      const title = esc((block.title && block.title[lang]) || "");
      const src = `https://sketchfab.com/models/${encodeURIComponent(block.modelId)}/embed`;
      return `<div class="case-block block-sketchfab reveal">
      <div class="sketchfab-wrap"><iframe src="${src}" loading="lazy" allow="autoplay; fullscreen; xr-spatial-tracking" title="${title}"></iframe></div>
    </div>`;
    }
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/* head / header / footer                                             */
/* ------------------------------------------------------------------ */
function renderHead(opts) {
  const { title, description, lang, depth, kind, slug, ogImage } = opts;
  const robots = PUBLIC
    ? `<meta name="robots" content="index, follow">`
    : `<meta name="robots" content="noindex, nofollow">`;

  const ruRoot = rootPathFor(kind, slug, "ru");
  const enRoot = rootPathFor(kind, slug, "en");
  const hreflang = `<link rel="alternate" hreflang="ru" href="${BASE_URL}${ruRoot}">
  <link rel="alternate" hreflang="en" href="${BASE_URL}${enRoot}">
  <link rel="alternate" hreflang="x-default" href="${BASE_URL}${ruRoot}">`;

  let og = "";
  if (PUBLIC) {
    const selfRoot = rootPathFor(kind, slug, lang);
    const ogImgAbs = ogImage ? BASE_URL + ogImage : "";
    og = `<meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${BASE_URL}${selfRoot}">
  <meta property="og:type" content="website">
  ${ogImgAbs ? `<meta property="og:image" content="${ogImgAbs}">` : ""}
  <meta name="twitter:card" content="summary_large_image">`;
  }

  return `<!doctype html>
<html lang="${lang === "ru" ? "ru" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${robots}
  ${hreflang}
  ${og}
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#0a0a0a">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;700&amp;family=Unbounded:wght@500;700;900&amp;display=swap">
  <link rel="stylesheet" href="${rel("assets/css/style.css", depth)}">
  <link rel="icon" href="${rel("assets/img/placeholder/square.svg", depth)}" type="image/svg+xml">
</head>`;
}

function renderHeader(lang, depth, activeKind) {
  const t = L[lang];
  const indexHref = rel(rootPathFor("index", null, lang), depth);
  const aboutHref = rel(rootPathFor("about", null, lang), depth);
  const ruHref = rel(rootPathFor(activeKind.kind, activeKind.slug, "ru"), depth);
  const enHref = rel(rootPathFor(activeKind.kind, activeKind.slug, "en"), depth);
  const cur = (k) => (activeKind.kind === k ? ' class="is-active" aria-current="page"' : "");

  return `<a class="skip-link" href="#main">${t.skip}</a>
  <header class="site-header">
    <div class="container">
      <a class="logo" href="${indexHref}">vlddvr<b>.</b></a>
      <nav class="main-nav" aria-label="${t.nav_label}">
        <ul>
          <li><a href="${indexHref}"${cur("index")}>${t.nav_works}</a></li>
          <li><a href="${aboutHref}"${cur("about")}>${t.nav_about}</a></li>
        </ul>
      </nav>
      <div class="lang-switch" aria-label="${t.lang_label}">
        <a href="${ruHref}" hreflang="ru" lang="ru"${lang === "ru" ? ' class="is-active" aria-current="true"' : ""}>RU</a>
        <a href="${enHref}" hreflang="en" lang="en"${lang === "en" ? ' class="is-active" aria-current="true"' : ""}>EN</a>
      </div>
      <a class="btn btn--sm header-cta" href="${esc(site.contacts.telegram)}" target="_blank" rel="noopener">${t.write_btn}</a>
    </div>
  </header>`;
}

/* Крупный блок контактов в стиле A (лайм, капс, строки-ссылки) */
function renderContactBlock(lang, headingTag) {
  const t = L[lang];
  const c = site.contacts;
  const tag = headingTag || "h2";
  const lines = t.contact_lines;
  const fit = Math.max(...lines.map((l) => fitOf(l)));
  return `<section class="contact on-acid" id="contact" aria-labelledby="contact-title">
    <div class="container">
      <${tag} class="h-giant" id="contact-title" style="--fit:${fit}"><span>${esc(lines[0])}</span> <span class="out">${esc(lines[1])}</span></${tag}>
      <div class="contact-links">
        <a href="${esc(c.telegram)}" target="_blank" rel="noopener"><span>Telegram</span><span aria-hidden="true">↗</span></a>
        <a href="mailto:${esc(c.email)}"><span>${t.email_label}</span><span aria-hidden="true">↗</span></a>
        <a href="${esc(c.behance)}" target="_blank" rel="noopener"><span>Behance</span><span aria-hidden="true">↗</span></a>
      </div>
      <p class="contact-email">${esc(c.email)}</p>
    </div>
  </section>`;
}

function renderFooter(lang, depth) {
  const t = L[lang];
  const c = site.contacts;
  return `<footer class="site-footer">
    <div class="container">
      <span>&copy; ${new Date().getFullYear()} vlddvr — ${t.footer_tagline}. ${t.footer_rights}</span>
      <span class="footer-contacts">
        <a href="${esc(c.telegram)}" target="_blank" rel="noopener">Telegram</a>
        <a href="mailto:${esc(c.email)}">${t.email_label}</a>
        <a href="${esc(c.behance)}" target="_blank" rel="noopener">Behance</a>
      </span>
    </div>
  </footer>
  <script src="${rel("assets/js/main.js", depth)}"></script>`;
}

/* ------------------------------------------------------------------ */
/* Бегущая строка клиентов — из поля client у кейсов                  */
/* ------------------------------------------------------------------ */
function renderTicker(lang) {
  const t = L[lang];
  const clients = [];
  sortedProjects.forEach((p) => {
    const c = (p.client || "").trim();
    if (c && !clients.includes(c)) clients.push(c);
  });
  if (!clients.length) return "";
  let seq = clients.slice();
  while (seq.length < 8) seq = seq.concat(clients);
  const half = seq.map((c) => `<span>${esc(c)}</span>`).join("");
  return `<div class="ticker" role="region" aria-label="${t.clients_label}">
    <p class="sr-only">${t.clients_label}: ${clients.map(esc).join(", ")}</p>
    <div class="ticker-track" aria-hidden="true"><div class="ticker-half">${half}</div><div class="ticker-half">${half}</div></div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Карточка проекта (кадр раскадровки)                                */
/* ------------------------------------------------------------------ */
function projectNumber(p) {
  return pad2(sortedProjects.findIndex((x) => x.slug === p.slug) + 1);
}

function renderCard(p, lang, depth, t) {
  const href = rel(rootPathFor("project", p.slug, lang), depth);
  const title = esc(p.title[lang]);
  const client = esc(p.client);
  const badges = renderBadges(p, t);
  const directionsAttr = esc((p.directions || []).join(","));
  const branchesAttr = esc((p.branches || []).join(","));
  const industryAttr = esc(((p.tags && p.tags.industry) || []).join(","));
  return `<a class="project-card shape-${shapeOf(p.cover)} reveal" href="${href}" data-directions="${directionsAttr}" data-branches="${branchesAttr}" data-industry="${industryAttr}">
      <div class="thumb">${renderImg(p.cover, lang, depth)}<span class="go" aria-hidden="true">${t.view_case} →</span></div>
      <div class="card-meta">
        <span class="no">${projectNumber(p)}</span>
        <div class="card-text">
          <h3>${title}</h3>
          <p class="client">${client}</p>
          ${badges ? `<div class="badges">${badges}</div>` : ""}
        </div>
      </div>
    </a>`;
}

/* ------------------------------------------------------------------ */
/* Двухуровневый фильтр на главной                                    */
/* ------------------------------------------------------------------ */
function renderFilters(lang, t) {
  const countDir = (id) => sortedProjects.filter((p) => projectHasDirection(p, id)).length;
  const level1 =
    `<button type="button" class="chip is-active" data-direction="all" aria-pressed="true">${t.filter_all}<sup>${pad2(sortedProjects.length)}</sup></button>` +
    visibleDirections
      .map(
        (d) =>
          `<button type="button" class="chip" data-direction="${d.id}" aria-pressed="false">${esc(d[lang])}<sup>${pad2(countDir(d.id))}</sup></button>`
      )
      .join("\n      ");

  const level2Groups = visibleDirections
    .filter((d) => d.branches.length > 0)
    .map((d) => {
      const chips =
        `<button type="button" class="chip chip--sub is-active" data-branch="all" aria-pressed="true">${t.filter_all_branches}</button>` +
        d.branches
          .map(
            (b) =>
              `<button type="button" class="chip chip--sub" data-branch="${b.id}" aria-pressed="false">${esc(b[lang])}</button>`
          )
          .join("\n      ");
      return `<div class="branch-filter" data-for="${d.id}" role="group" aria-label="${t.branch_filter_label}: ${esc(d[lang])}" hidden>
      ${chips}
      </div>`;
    })
    .join("\n    ");

  return `<div class="direction-filter" role="group" aria-label="${t.filter_label}">
      ${level1}
      </div>
    ${level2Groups}`;
}

/* ------------------------------------------------------------------ */
/* Страница: index                                                    */
/* ------------------------------------------------------------------ */
function buildIndex(lang) {
  const t = L[lang];
  const depth = lang === "ru" ? 0 : 1;
  const featured = sortedProjects.find((p) => p.featured) || sortedProjects[0];

  const head = renderHead({
    title: `vlddvr — ${lang === "ru" ? "портфолио" : "portfolio"}`,
    description: t.hero_subtitle,
    lang,
    depth,
    kind: "index",
    slug: null,
    ogImage: featured ? featured.cover.src : null,
  });

  const header = renderHeader(lang, depth, { kind: "index", slug: null });
  const footer = renderFooter(lang, depth);
  const filters = renderFilters(lang, t);
  const cards = sortedProjects.map((p) => renderCard(p, lang, depth, t)).join("\n    ");
  const featuredHref = featured ? rel(rootPathFor("project", featured.slug, lang), depth) : "#works";
  const heroFit = Math.max(...t.hero_lines.map((l) => fitOf(l)));
  const lineCls = ["", "acid", "out"];
  const heroLines = t.hero_lines
    .map((l, i) => (lineCls[i] ? `<span class="${lineCls[i]}">` : `<span>`) + `${esc(l)}</span>`)
    .join(" ");

  const heroMedia = featured
    ? `<a class="hero-media" href="${featuredHref}" style="${frameStyle(featured.cover)}">
        ${renderImg(featured.cover, lang, depth, { eager: true, class: "kb" })}
        <span class="hero-tag"><small>★ ${t.featured_label}${featured.client ? " · " + esc(featured.client) : ""}</small>${esc(featured.title[lang])} →</span>
      </a>`
    : "";

  const html = `${head}
<body class="page-index">
  ${header}
  <main id="main">
    <section class="hero${featured ? "" : " hero--plain"}" aria-labelledby="hero-title">
      ${heroMedia}
      <div class="hero-copy container" style="--fit:${heroFit}">
        <p class="eyebrow">${t.hero_eyebrow}</p>
        <h1 class="h-giant" id="hero-title">${heroLines}</h1>
        <div class="hero-row">
          <p class="lead">${t.hero_subtitle}</p>
          <div class="hero-ctas">
            <a class="btn" href="${esc(site.contacts.telegram)}" target="_blank" rel="noopener">${t.contact_btn} →</a>
            <a class="btn btn--ghost" href="#works">${t.works_btn}</a>
          </div>
        </div>
      </div>
    </section>
    ${renderTicker(lang)}
    <section class="container works" id="works" aria-labelledby="works-title">
      <div class="sec-head">
        <h2 class="h2" id="works-title">${t.works_title}</h2>
        <span class="count"><span data-works-count>${pad2(sortedProjects.length)}</span> / ${pad2(sortedProjects.length)}</span>
      </div>
      <div class="filters" data-filters>
      ${filters}
      </div>
      <div class="project-grid storyboard">
      ${cards}
      </div>
    </section>
    ${renderWhoBlock(lang, depth)}
    ${renderContactBlock(lang)}
  </main>
  ${footer}
</body>
</html>`;
  return html;
}

/* ------------------------------------------------------------------ */
/* Страница: about                                                  */
/* ------------------------------------------------------------------ */
function buildAbout(lang) {
  const t = L[lang];
  const a = ABOUT[lang];
  const depth = lang === "ru" ? 0 : 1;
  const head = renderHead({
    title: `${a.name.join(" ")} (vlddvr) — ${t.about_title}`,
    description: a.positioning,
    lang,
    depth,
    kind: "about",
    slug: null,
    ogImage: `${PORTRAITS.main.base}-800.jpg`,
  });
  const header = renderHeader(lang, depth, { kind: "about", slug: null });
  const footer = renderFooter(lang, depth);
  const fit = Math.max(...a.name.map((w) => fitOf(w)));

  const timeline = a.timeline
    .map(
      (job) => `<li class="job reveal">
          <p class="job-years">${esc(job.from)} — ${esc(job.to || a.present)}</p>
          <div class="job-main">
            <h3>${esc(job.company)}</h3>
            ${job.note ? `<p class="job-note">${esc(job.note)}</p>` : ""}
          </div>
          <div class="job-side">
            <p class="job-role">${esc(job.role)}</p>
            ${job.what ? `<p class="job-what">${esc(job.what)}</p>` : ""}
          </div>
        </li>`
    )
    .join("\n        ");

  const html = `${head}
<body class="page-about">
  ${header}
  <main id="main">
    <section class="about-hero" aria-labelledby="about-title">
      <div class="container">
        <p class="eyebrow">vlddvr · ${esc(a.place)}</p>
        <h1 class="h-giant about-name" id="about-title" style="--fit:${fit}"><span>${esc(a.name[0])}</span> <span class="acid">${esc(a.name[1])}</span></h1>
      </div>
      <div class="container about-grid">
        <figure class="who-photo about-photo">
          ${renderPortrait("main", a.photo_alt, depth, "(min-width: 1100px) 620px, (min-width: 720px) 50vw, 100vw", { eager: true })}
          <figcaption class="photo-plate">${esc(a.place)}</figcaption>
        </figure>
        <div class="about-copy">
          <p class="lead">${esc(a.positioning)}</p>
          ${renderFactPlates(a)}
          <dl class="who-lists">
            <div><dt>${a.directions_label}</dt><dd>${a.directions.map(esc).join(" · ")}</dd></div>
          </dl>
          <figure class="about-insert">
            ${renderPortrait("alt", a.photo2_alt, depth, "(min-width: 720px) 320px, 70vw")}
          </figure>
          <div class="hero-ctas">
            <a class="btn" href="${esc(site.contacts.telegram)}" target="_blank" rel="noopener">${t.contact_btn} →</a>
          </div>
        </div>
      </div>
    </section>
    <section class="container about-experience" aria-labelledby="exp-title">
      <div class="sec-head"><h2 class="h2" id="exp-title">${a.experience_title}</h2><span class="count">2020 — ${new Date().getFullYear()}</span></div>
      <ol class="timeline">
        ${timeline}
      </ol>
    </section>
    <section class="container about-skills" aria-labelledby="skills-title">
      <div class="sec-head"><h2 class="h2" id="skills-title">${a.skills_title}</h2></div>
      <div class="skills-grid">
        <div>
          <p class="skills-label">${a.tools_label}</p>
          <div class="tools-list">${ABOUT_TOOLS_FULL.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
        </div>
        <div>
          <p class="skills-label">${a.skills_title}</p>
          <div class="tools-list tools-list--soft">${a.skills.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
        </div>
      </div>
    </section>
    ${renderContactBlock(lang)}
  </main>
  ${footer}
</body>
</html>`;
  return html;
}

/* ------------------------------------------------------------------ */
/* Метки ответвлений / индустрии на странице кейса                    */
/* ------------------------------------------------------------------ */
function renderCaseTagLinks(p, lang, depth, t, indexHref) {
  const branchLinks = (p.branches || [])
    .map((branchId) => {
      const dirId = branchToDirection[branchId];
      if (!dirId) return "";
      const dir = visibleDirections.find((d) => d.id === dirId);
      if (!dir) return "";
      const branch = (dir.branches || []).find((b) => b.id === branchId);
      if (!branch) return "";
      return `<a class="tag-link" href="${indexHref}#${dirId}/${branchId}">${esc(branch[lang])}</a>`;
    })
    .filter(Boolean);

  const industryLinks = ((p.tags && p.tags.industry) || [])
    .map((indId) => {
      const ind = industryById[indId];
      if (!ind) return "";
      return `<a class="tag-link" href="${indexHref}#industry/${indId}">${esc(ind[lang])}</a>`;
    })
    .filter(Boolean);

  if (!branchLinks.length && !industryLinks.length) return "";

  return `<div class="case-tag-links">
        ${branchLinks.length ? `<div class="tag-row"><span class="tag-row-label">${t.branches_label}</span> ${branchLinks.join(" ")}</div>` : ""}
        ${industryLinks.length ? `<div class="tag-row"><span class="tag-row-label">${t.industry_label}</span> ${industryLinks.join(" ")}</div>` : ""}
      </div>`;
}

/* ------------------------------------------------------------------ */
/* Страница: кейс проекта                                             */
/* ------------------------------------------------------------------ */
function buildProjectPage(p, lang) {
  const t = L[lang];
  const depth = lang === "ru" ? 1 : 2;
  const head = renderHead({
    title: `${p.title[lang]} — vlddvr`,
    description: p.summary[lang],
    lang,
    depth,
    kind: "project",
    slug: p.slug,
    ogImage: p.cover.src,
  });
  const header = renderHeader(lang, depth, { kind: "project", slug: p.slug });
  const footer = renderFooter(lang, depth);
  const indexHref = rel(rootPathFor("index", null, lang), depth);

  // Три акта: Задача / Подход / Результат (пустые блоки не выводятся)
  const actKeys = ["task", "approach", "result"].filter((key) => p[key] && p[key][lang]);
  const acts = actKeys
    .map(
      (key, i) => `<article class="act reveal">
        <div class="act-head"><span class="act-n">${pad2(i + 1)}</span><h2><small>${t.act} ${ROMAN[i]}</small>${t[key]}</h2></div>
        <p class="act-text">${esc(p[key][lang])}</p>
      </article>`
    )
    .join("\n      ");

  const blocks = (p.blocks || []).map((b) => renderBlock(b, lang, depth, t)).join("\n    ");

  const idx = sortedProjects.findIndex((x) => x.slug === p.slug);
  const next = sortedProjects[(idx + 1) % sortedProjects.length];
  const nextHref = rel(rootPathFor("project", next.slug, lang), depth);

  const badges = renderBadges(p, t);
  const behanceLink = p.behance
    ? `<a class="btn btn--dark-ghost" href="${esc(p.behance)}" target="_blank" rel="noopener">${t.behance} ↗</a>`
    : "";

  const tagLinks = renderCaseTagLinks(p, lang, depth, t, indexHref);

  const dirNames = (p.directions || [])
    .map((id) => directionById[id])
    .filter((d) => d && !d.hidden)
    .map((d) => esc(d[lang]));
  const formats = ((p.tags && p.tags.format) || []).map((f) =>
    esc(formatById[f] ? formatById[f][lang] : f)
  );
  const tools = ((p.tags && p.tags.tools) || []).map(esc);

  const facts = [
    [t.client_label, esc(p.client)],
    [t.direction_label, dirNames.join(" · ")],
    [t.format_label, formats.join(" · ")],
    [t.tools_label, tools.join(" · ")],
  ]
    .filter((f) => f[1])
    .map((f) => `<div><dt>${f[0]}</dt><dd>${f[1]}</dd></div>`)
    .join("\n        ");

  const nextTitle = esc(next.title[lang]);

  const html = `${head}
<body class="page-case">
  ${header}
  <main id="main">
    <section class="case-opening" aria-labelledby="case-title">
      <div class="container case-backbar"><a class="case-back" href="${indexHref}#works">← ${t.back}</a></div>
      <div class="case-media" style="${frameStyle(p.cover)}">${renderImg(p.cover, lang, depth, { eager: true, class: "kb" })}</div>
      <div class="container case-head" style="--fit:${fitOf(p.title[lang])}">
        <div class="case-tags">
          <span class="tag tag--acid">★ ${projectNumber(p)}</span>
          ${dirNames.map((d) => `<span class="tag">${d}</span>`).join("\n          ")}
          ${badges}
        </div>
        <h1 class="case-title" id="case-title">${esc(p.title[lang])}</h1>
        <p class="lead">${esc(p.summary[lang])}</p>
      </div>
    </section>
    <div class="container">
      <dl class="facts">
        ${facts}
      </dl>
      ${tagLinks}
    </div>
    ${acts ? `<section class="container acts">\n      ${acts}\n    </section>` : ""}
    <div class="container case-blocks">
    ${blocks}
    </div>
    <section class="cta-band on-acid">
      <div class="container">
        <h2 class="cta-title">${t.cta_title}</h2>
        <div class="cta-side">
          <p>${t.cta_text}</p>
          <div class="cta-actions">
            <a class="btn btn--dark" href="${esc(site.contacts.telegram)}" target="_blank" rel="noopener">${t.discuss} →</a>
            ${behanceLink}
          </div>
        </div>
      </div>
    </section>
    <a class="next-case" href="${nextHref}">
      <span class="next-media" style="${frameStyle(next.cover)}">${renderImg(next.cover, lang, depth)}</span>
      <span class="container next-copy" style="--fit:${fitOf(next.title[lang])}">
        <span class="lbl">${t.next_case} · ${projectNumber(next)}</span>
        <span class="nm">${nextTitle} <i aria-hidden="true">→</i></span>
      </span>
    </a>
  </main>
  ${footer}
</body>
</html>`;
  return html;
}

/* ------------------------------------------------------------------ */
/* Страница: направление (опционально, с секциями по ответвлениям)    */
/* ------------------------------------------------------------------ */
function buildDirectionPage(dir, lang) {
  const t = L[lang];
  const depth = lang === "ru" ? 1 : 2;
  const head = renderHead({
    title: `${esc(dir[lang])} — vlddvr`,
    description: dir[lang],
    lang,
    depth,
    kind: "direction",
    slug: dir.id,
    ogImage: null,
  });
  const header = renderHeader(lang, depth, { kind: "direction", slug: dir.id });
  const footer = renderFooter(lang, depth);
  const indexHref = rel(rootPathFor("index", null, lang), depth);

  const casesInDir = sortedProjects.filter((p) => projectHasDirection(p, dir.id));

  const sections = [];
  dir.branches.forEach((b) => {
    const cases = casesInDir.filter((p) => projectHasBranch(p, b.id));
    if (!cases.length) return;
    sections.push(`<section class="direction-section">
      <div class="sec-head"><h2 class="h2">${esc(b[lang])}</h2><span class="count">${pad2(cases.length)}</span></div>
      <div class="project-grid storyboard">
      ${cases.map((p) => renderCard(p, lang, depth, t)).join("\n      ")}
      </div>
    </section>`);
  });
  const noBranchCases = casesInDir.filter((p) => {
    const ps = p.branches || [];
    return !dir.branches.some((b) => ps.includes(b.id));
  });
  if (noBranchCases.length) {
    sections.push(`<section class="direction-section">
      <div class="sec-head"><h2 class="h2">${t.direction_no_branch}</h2><span class="count">${pad2(noBranchCases.length)}</span></div>
      <div class="project-grid storyboard">
      ${noBranchCases.map((p) => renderCard(p, lang, depth, t)).join("\n      ")}
      </div>
    </section>`);
  }

  const html = `${head}
<body class="page-direction">
  ${header}
  <main id="main">
    <div class="container">
      <header class="page-head" style="--fit:${fitOf(dir[lang])}">
        <a class="case-back" href="${indexHref}">← ${t.direction_back}</a>
        <p class="eyebrow">${t.directions_title} · ${pad2(casesInDir.length)} ${t.cases_word}</p>
        <h1 class="case-title">${esc(dir[lang])}</h1>
      </header>
      ${sections.join("\n      ")}
    </div>
  </main>
  ${footer}
</body>
</html>`;
  return html;
}

/* ------------------------------------------------------------------ */
/* robots.txt / sitemap.xml                                           */
/* ------------------------------------------------------------------ */
function buildRobots() {
  if (PUBLIC) {
    return `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}sitemap.xml\n`;
  }
  return `User-agent: *\nDisallow: /\n`;
}

function buildSitemap() {
  const urls = [];
  urls.push(rootPathFor("index", null, "ru"));
  urls.push(rootPathFor("index", null, "en"));
  urls.push(rootPathFor("about", null, "ru"));
  urls.push(rootPathFor("about", null, "en"));
  sortedProjects.forEach((p) => {
    urls.push(rootPathFor("project", p.slug, "ru"));
    urls.push(rootPathFor("project", p.slug, "en"));
  });
  visibleDirections.forEach((d) => {
    urls.push(rootPathFor("direction", d.id, "ru"));
    urls.push(rootPathFor("direction", d.id, "en"));
  });
  const body = urls.map((u) => `  <url><loc>${BASE_URL}${u}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/* ------------------------------------------------------------------ */
/* Запись файлов                                                      */
/* ------------------------------------------------------------------ */
function writeFile(relPathFromRoot, content) {
  const full = path.join(ROOT, relPathFromRoot);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  console.log("wrote", relPathFromRoot);
}

function main() {
  writeFile("index.html", buildIndex("ru"));
  writeFile("about.html", buildAbout("ru"));
  writeFile("en/index.html", buildIndex("en"));
  writeFile("en/about.html", buildAbout("en"));

  sortedProjects.forEach((p) => {
    writeFile(`projects/${p.slug}.html`, buildProjectPage(p, "ru"));
    writeFile(`en/projects/${p.slug}.html`, buildProjectPage(p, "en"));
  });

  visibleDirections.forEach((d) => {
    writeFile(`directions/${d.id}.html`, buildDirectionPage(d, "ru"));
    writeFile(`en/directions/${d.id}.html`, buildDirectionPage(d, "en"));
  });

  writeFile("robots.txt", buildRobots());
  if (PUBLIC) {
    writeFile("sitemap.xml", buildSitemap());
  } else {
    const sitemapPath = path.join(ROOT, "sitemap.xml");
    if (fs.existsSync(sitemapPath)) fs.unlinkSync(sitemapPath);
  }

  console.log(
    `\nГотово. PUBLIC = ${PUBLIC}. Проектов: ${sortedProjects.length}. Направлений на сайте: ${visibleDirections.length}.`
  );
}

main();
