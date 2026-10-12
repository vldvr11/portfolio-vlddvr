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

// Переключатели из админки (data/settings.json) перекрывают site.json
try {
  Object.assign(site, JSON.parse(fs.readFileSync(path.join(DATA_DIR, "settings.json"), "utf8")));
} catch (e) { /* файла может не быть */ }

/* Размеры картинок: если w/h не заданы (кейс добавлен через админку), читаем их из файла */
function imageSize(file) {
  try {
    const b = fs.readFileSync(path.join(ROOT, file));
    if (b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const t = b.toString("ascii", 12, 16);
      if (t === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (t === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (t === "VP8L") { const n = b.readUInt32LE(21); return { w: 1 + (n & 0x3fff), h: 1 + ((n >> 14) & 0x3fff) }; }
    }
    if (/\.svg$/i.test(file)) {
      const s = b.toString("utf8"), vb = s.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/);
      if (vb) return { w: Math.round(+vb[1]), h: Math.round(+vb[2]) };
    }
  } catch (e) { /* нет файла — оставим значения по умолчанию */ }
  return null;
}
(function normalizeMedia(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach(normalizeMedia);
  if (typeof node.src === "string" && /\.(png|jpe?g|webp|svg)$/i.test(node.src)) {
    node.src = node.src.replace(/^\/+/, "");
    if (!node.w || !node.h) Object.assign(node, imageSize(node.src) || { w: 1600, h: 900 });
    if (!node.alt) node.alt = { ru: "", en: "" };
  } else if (typeof node.src === "string") {
    node.src = node.src.replace(/^\/+/, "");
  }
  Object.values(node).forEach(normalizeMedia);
})(projects);
projects.forEach((p) => {
  ["directions", "branches", "blocks"].forEach((k) => { if (!Array.isArray(p[k])) p[k] = p[k] ? [p[k]] : []; });
  if (!p.tags) p.tags = {};
  if (!p.title) p.title = { ru: p.slug, en: p.slug };
  if (!p.summary) p.summary = { ru: "", en: "" };
});

const PUBLIC = site.PUBLIC === true;
// CONTACTS_ENABLED = false — контакты-заглушки: реальные ссылки/почта в HTML не попадают вообще
const CONTACTS = site.CONTACTS_ENABLED === true;
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
    nav_works: "Все работы",
    featured_title: "Избранное",
    all_projects_title: "Все проекты",
    all_works_title: "Все работы",
    all_works_link: "Все работы",
    hero_status: "Открыт к проектам",
    proof_title: "Лучшие кадры",
    hero_tiles_label: "Направления",
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
    soon: "скоро",
    contacts_soon: "Контакты скоро",
    contacts_soon_note: "Контакты появятся здесь в ближайшее время.",
    hero_slider_label: "Избранные работы",
    hero_slide_go: "Слайд",
    endings_title: "Эндинги для SMM",
    sound_btn: "Звук",
    sound_aria: "Включить ролик со звуком с начала",
  },
  en: {
    skip: "Skip to content",
    nav_works: "All work",
    featured_title: "Featured",
    all_projects_title: "All projects",
    all_works_title: "All work",
    all_works_link: "All work",
    hero_status: "Open to projects",
    proof_title: "Highlights",
    hero_tiles_label: "Directions",
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
    soon: "coming soon",
    contacts_soon: "Contacts coming soon",
    contacts_soon_note: "Contacts will appear here soon.",
    hero_slider_label: "Featured work",
    hero_slide_go: "Slide",
    endings_title: "SMM endings",
    sound_btn: "Sound",
    sound_aria: "Play the video with sound from the start",
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
    photo_alt: "Портрет дизайнера",
    photo2_alt: "Портрет дизайнера в студии",
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
    photo_alt: "Designer portrait",
    photo2_alt: "Designer studio portrait",
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
// Свежие первыми; to: null — «н. в.» / «now»

// Отрасли — только те, что подтверждены кейсами на сайте (обновлять вместе с кейсами)
const INDUSTRIES = [
  { ru: "Автомобили", en: "Automotive" }, { ru: "Автозапчасти и масла", en: "Auto parts & oils" },
  { ru: "FMCG и еда", en: "FMCG & food" }, { ru: "Рестораны", en: "Restaurants" },
  { ru: "Недвижимость", en: "Real estate" }, { ru: "Торговые центры", en: "Shopping malls" },
  { ru: "Энергетика", en: "Energy" }, { ru: "Электроника и ритейл", en: "Electronics & retail" },
  { ru: "Мебель и интерьер", en: "Furniture & interiors" }, { ru: "Медицина", en: "Healthcare" },
  { ru: "Оптика", en: "Optics" }, { ru: "Финансы и лизинг", en: "Finance & leasing" },
  { ru: "IT", en: "IT" }, { ru: "Развлечения для детей", en: "Kids entertainment" },
  { ru: "Мероприятия и выставки", en: "Events & exhibitions" },
];
const ABOUT_COMPANIES = [
  { name: "THE ONE / Terra Pro", from: "2026", to: null },
  { name: "Great Wall Motors", from: "2025", to: "2026" },
  { name: "Dream City", from: "2024", to: "2025" },
  { name: "MOLLEQULA", from: "2023", to: "2024" },
  { name: "EXZAP HOLDING", from: "2020", to: "2023" },
];
function companyYears(c, lang) {
  return c.to ? `${c.from}–${c.to}` : `${c.from} — ${lang === "ru" ? "н. в." : "now"}`;
}
const ABOUT_TOOLS_SHORT = ["Blender", "Cinema 4D", "After Effects", "Photoshop", "Illustrator", "Figma"];
const ABOUT_TOOLS_FULL = ["Blender", "Cinema 4D", "Photoshop", "Illustrator", "InDesign", "After Effects", "Premiere Pro", "Figma"];

// Портреты: ч/б дуотон, только WebP, ширины без апскейла
const PORTRAITS = {
  main: { base: "assets/img/about/portrait-main", widths: [800, 1159], w: 1159, h: 1449, focus: "56% 40%" },
  alt: { base: "assets/img/about/portrait-alt", widths: [800, 1480], w: 1480, h: 1480, focus: "50% 30%" },
};

function renderPortrait(key, alt, depth, sizes, opts) {
  opts = opts || {};
  const p = PORTRAITS[key];
  const set = (ext) => p.widths.map((w) => `${rel(`${p.base}-${w}.${ext}`, depth)} ${w}w`).join(", ");
  const loading = opts.eager ? ` fetchpriority="high"` : ` loading="lazy" decoding="async"`;
  return `<img src="${rel(`${p.base}-${p.widths[0]}.webp`, depth)}" srcset="${set("webp")}" sizes="${sizes}" width="${p.w}" height="${p.h}" alt="${esc(alt)}" style="object-position:${p.focus}"${loading}>`;
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
            ${contactBtn(t.contact_btn, "btn", lang)}
            <a class="btn btn--ghost" href="${aboutHref}">${a.more}</a>
          </div>
        </div>
      </div>
    </div>
    <div class="company-strip" aria-label="${a.companies_label}">
      <div class="container"><span class="company-label">${a.companies_label}</span>${ABOUT_COMPANIES.map((c) => `<span class="company">${esc(c.name)} <small class="company-years">${companyYears(c, lang)}</small></span>`).join("")}</div>
    </div>
    <div class="industry-strip" aria-label="${lang === "ru" ? "Отрасли" : "Industries"}">
      <div class="container">
        <h3 class="industry-title">${lang === "ru" ? "Отрасли, с которыми <em>работал</em>" : "Industries I’ve <em>worked with</em>"}</h3>
        <ul class="industry-chips">${INDUSTRIES.map((i) => `<li>${esc(i[lang])}</li>`).join("")}</ul>
      </div>
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
  if (kind === "works") return lang === "ru" ? "works.html" : "en/works.html";
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

/* ------------------------------------------------------------------ */
/* Контакты: при CONTACTS_ENABLED=false — неактивные заглушки без href */
/* и без реальных значений (в HTML не попадают ни t.me, ни почта).     */
/* ------------------------------------------------------------------ */
function contactBtn(label, cls, lang) {
  if (CONTACTS) {
    return `<a class="${cls}" href="${esc(site.contacts.telegram)}" target="_blank" rel="noopener">${label} →</a>`;
  }
  return `<span class="${cls} is-disabled" role="button" aria-disabled="true" title="${esc(L[lang].contacts_soon)}">${label} · ${L[lang].soon}</span>`;
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
/* Рендер изображений: только WebP (<img> + srcset), прямой <img> для svg */
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

  // src может быть «…-1600.webp», «…-1200.webp», «….webp» — собираем набор ширин из реально существующих файлов.
  // JPEG/PNG не выводим: загруженные через админку картинки переводит в WebP scripts/optimize-uploads.js.
  const exists = (p) => fs.existsSync(path.join(__dirname, p));
  const m = srcRoot.match(/^(.*?)(?:-(\d+))?\.(webp|jpe?g|png)$/i);
  const base = m ? m[1] : srcRoot;
  const webps = [800, 1200, 1600].filter((w) => exists(`${base}-${w}.webp`));
  if (webps.length) {
    const srcset = webps.map((w) => `${rel(`${base}-${w}.webp`, depth)} ${w}w`).join(", ");
    const sizes = opts.sizes || "(min-width: 900px) 60vw, 100vw";
    return `<img src="${rel(`${base}-${webps[webps.length - 1]}.webp`, depth)}" srcset="${srcset}" sizes="${sizes}" width="${img.w}" height="${img.h}" alt="${alt}"${cls}${loading}>`;
  }
  // один файл: сам src, либо его WebP-двойник, если в данных осталось старое расширение
  const noExt = srcRoot.replace(/\.(jpe?g|png)$/i, "");
  const single = noExt !== srcRoot && exists(noExt + ".webp") ? noExt + ".webp" : srcRoot;
  return `<img src="${rel(single, depth)}" width="${img.w}" height="${img.h}" alt="${alt}"${cls}${loading}>`;
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

/* Полный ролик WebM (поле webm): есть ли файл и есть ли в нём звуковая дорожка.
   Звук определяем по заголовку файла (кодек A_OPUS / A_VORBIS) — без ffprobe, работает и в GitHub Actions. */
const webmCache = {};
function webmInfo(file) {
  if (!file || !/\.webm$/i.test(file)) return null;
  if (file in webmCache) return webmCache[file];
  let info = null;
  try {
    const fd = fs.openSync(path.join(ROOT, file), "r");
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const head = buf.toString("latin1", 0, n);
    info = { audio: head.includes("A_OPUS") || head.includes("A_VORBIS") };
  } catch (e) { /* файла нет — работаем как раньше, только луп */ }
  return (webmCache[file] = info);
}
const SOUND_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/></svg>';

/* Видео-кадр сетки: полный WebM со звуком (если есть) + MP4-луп как запасной; пропорции из poster.w/h.
   В сетке ролик играет тихо, пока виден; кнопка «Звук» запускает его с начала со звуком (main.js). */
function renderVideoShot(block, lang, depth) {
  const t = L[lang];
  const p = block.poster;
  const shape = shapeOf(p);
  const caption = esc((block.caption && block.caption[lang]) || "");
  const alt = esc((p && p.alt && p.alt[lang]) || "");
  let media;
  if (block.src) {
    const ar = p ? ` style="aspect-ratio:${p.w} / ${p.h}"` : "";
    const w = p ? ` width="${p.w}" height="${p.h}"` : "";
    const full = webmInfo(block.webm);
    const mp4 = `<source src="${rel(block.src, depth)}" type="video/mp4">`;
    if (full) {
      // WebM первым; старые iPhone, где WebM не играет, возьмут MP4-луп
      const sources = `<source src="${rel(block.webm, depth)}" type="video/webm">${mp4}`;
      const btn = full.audio
        ? `<button type="button" class="vid-sound" data-sound aria-label="${t.sound_aria}${alt ? ": " + alt : ""}">${SOUND_ICON}<span>${t.sound_btn}</span></button>`
        : "";
      media = `<div class="vid-wrap"><video${full.audio ? "" : " controls"} muted loop playsinline preload="none" data-autoplay${full.audio ? " data-full" : ""}${w}${ar}${alt ? ` aria-label="${alt}"` : ""} poster="${p ? rel(p.src, depth) : ""}">${sources}</video>${btn}</div>`;
    } else {
      media = `<video controls muted loop playsinline preload="none" data-autoplay${w}${ar}${alt ? ` aria-label="${alt}"` : ""} poster="${p ? rel(p.src, depth) : ""}">${mp4}</video>`;
    }
  } else {
    media = p ? renderImg(p, lang, depth, { sizes: "(min-width: 1100px) 30vw, (min-width: 720px) 45vw, 100vw" }) : "";
  }
  return `<figure class="shot shot--video shape-${shape}">${media}${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
}

/* Подряд идущие видео-блоки (свой файл или постер) собираются в одну сетку
   по тем же правилам, что и картинки: вертикальные/квадраты — 3 в ряд,
   горизонтальные — 2, очень широкие — на всю ширину. Embed-видео — отдельно. */
function renderBlocks(blocks, lang, depth, t) {
  const out = [];
  let group = [];
  const flush = () => {
    if (!group.length) return;
    out.push(`<div class="case-block block-videos">
      <div class="storyboard media-grid">
      ${group.map((b) => renderVideoShot(b, lang, depth)).join("\n      ")}
      </div>
    </div>`);
    group = [];
  };
  blocks.forEach((b) => {
    if (b.type === "video" && !b.embed && (b.src || b.poster)) {
      group.push(b);
      return;
    }
    flush();
    out.push(renderBlock(b, lang, depth, t));
  });
  flush();
  return out.join("\n    ");
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
        media = `<video controls preload="none" playsinline${ar} poster="${block.poster ? rel(block.poster.src, depth) : ""}">${webmInfo(block.webm) ? `<source src="${rel(block.webm, depth)}" type="video/webm">` : ""}<source src="${rel(block.src, depth)}" type="video/mp4"></video>`;
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
    : ["robots", "googlebot", "yandex"]
        .map((n) => `<meta name="${n}" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate">`)
        .join("\n  ");

  const ruRoot = rootPathFor(kind, slug, "ru");
  const enRoot = rootPathFor(kind, slug, "en");
  const hreflang = !PUBLIC ? "" : `<link rel="alternate" hreflang="ru" href="${BASE_URL}${ruRoot}">
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
  <link rel="stylesheet" href="${rel("assets/css/style.css", depth)}?v=${assetVer("assets/css/style.css")}">
  <link rel="icon" href="${rel("favicon.ico", depth)}" sizes="any">
  <link rel="icon" href="${rel("assets/img/icons/favicon-32.png", depth)}" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="${rel("assets/img/icons/apple-touch-icon.png", depth)}">
  <link rel="manifest" href="${rel("site.webmanifest", depth)}">
  <script>
  /* Вступительный экран «Портфолио»: один раз за сессию, не при reduced-motion */
  (function(){try{var d=document.documentElement;if(sessionStorage.getItem("intro"))return;if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;sessionStorage.setItem("intro","1");d.setAttribute("data-intro","${lang === "ru" ? "Портфолио" : "Portfolio"}");d.classList.add("intro");setTimeout(function(){d.classList.add("intro-out")},1900);setTimeout(function(){d.classList.remove("intro","intro-out")},2700);}catch(e){}})();
  </script>
</head>`;
}

function renderHeader(lang, depth, activeKind) {
  const t = L[lang];
  const indexHref = rel(rootPathFor("index", null, lang), depth);
  const aboutHref = rel(rootPathFor("about", null, lang), depth);
  const ruHref = rel(rootPathFor(activeKind.kind, activeKind.slug, "ru"), depth);
  const enHref = rel(rootPathFor(activeKind.kind, activeKind.slug, "en"), depth);
  const cur = (k) => (activeKind.kind === k ? ' class="is-active" aria-current="page"' : "");

  const testStrip = PUBLIC ? "" : `<div class="test-strip" role="note">${lang === "ru" ? "Сайт в тестовом режиме" : "Site in test mode"}</div>
  `;
  return `<a class="skip-link" href="#main">${t.skip}</a>
  ${testStrip}<header class="site-header">
    <div class="container">
      <a class="logo" href="${indexHref}">vlddvr<b>.</b></a>
      <nav class="main-nav" aria-label="${t.nav_label}">
        <ul>
          <li><a href="${rel(rootPathFor("works", null, lang), depth)}"${cur("works")}>${t.nav_works}</a></li>
          <li><a href="${aboutHref}"${cur("about")}>${t.nav_about}</a></li>
        </ul>
      </nav>
      <div class="lang-switch" aria-label="${t.lang_label}">
        <a href="${ruHref}" hreflang="ru" lang="ru"${lang === "ru" ? ' class="is-active" aria-current="true"' : ""}>RU</a>
        <a href="${enHref}" hreflang="en" lang="en"${lang === "en" ? ' class="is-active" aria-current="true"' : ""}>EN</a>
      </div>
      ${contactBtn(t.write_btn, "btn btn--sm header-cta", lang)}
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
      ${CONTACTS ? `<div class="contact-links">
        <a href="${esc(c.telegram)}" target="_blank" rel="noopener"><span>Telegram</span><span aria-hidden="true">↗</span></a>
        <a href="mailto:${esc(c.email)}"><span>${t.email_label}</span><span aria-hidden="true">↗</span></a>
        <a href="${esc(c.behance)}" target="_blank" rel="noopener"><span>Behance</span><span aria-hidden="true">↗</span></a>
      </div>
      <p class="contact-email">${esc(c.email)}</p>` : `<div class="contact-links">
        ${["Telegram", t.email_label, "Behance"].map((n) => `<span class="is-disabled" aria-disabled="true"><span>${esc(n)}</span><span>${t.soon}</span></span>`).join("\n        ")}
      </div>
      <p class="contact-email">${t.contacts_soon_note}</p>`}
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
        ${CONTACTS ? `<a href="${esc(c.telegram)}" target="_blank" rel="noopener">Telegram</a>
        <a href="mailto:${esc(c.email)}">${t.email_label}</a>
        <a href="${esc(c.behance)}" target="_blank" rel="noopener">Behance</a>` : `<span aria-disabled="true">${t.contacts_soon}</span>`}
      </span>
    </div>
  </footer>
  <script src="${rel("assets/js/main.js", depth)}?v=${assetVer("assets/js/main.js")}"></script>`;
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
  return `<a class="project-card shape-${shapeOf(p.cover)} reveal" href="${href}" data-directions="${directionsAttr}" data-branches="${branchesAttr}">
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
/* ------------------------------------------------------------------ */
/* Hero-слайдер: кейсы с featured:true (до 7), по heroOrder, иначе order */
/* ------------------------------------------------------------------ */
function heroProjects() {
  const list = sortedProjects
    .filter((p) => p.featured)
    .sort((a, b) => {
      const ha = typeof a.heroOrder === "number" ? a.heroOrder : Infinity;
      const hb = typeof b.heroOrder === "number" ? b.heroOrder : Infinity;
      return ha !== hb ? ha - hb : (a.order || 0) - (b.order || 0);
    })
    .slice(0, 7);
  return list.length ? list : sortedProjects.slice(0, 1);
}

function renderHeroSlider(list, lang, depth, t) {
  const first = list[0];
  const slides = list
    .map((p, i) => {
      const href = rel(rootPathFor("project", p.slug, lang), depth);
      return `<a class="hero-slide${i === 0 ? " is-active" : ""}" href="${href}" style="--focus:${esc(focusOf(p.cover))}"${i === 0 ? "" : ' aria-hidden="true" tabindex="-1"'} data-slide="${i}">
          ${renderImg(p.cover, lang, depth, { eager: i === 0, class: "kb", sizes: "100vw" })}
          <span class="hero-tag"><small>★ ${t.featured_label}${p.client ? " · " + esc(p.client) : ""}</small>${esc(p.title[lang])} →</span>
        </a>`;
    })
    .join("\n        ");
  const dots =
    list.length > 1
      ? `<div class="hero-dots" role="group" aria-label="${t.hero_slider_label}">
        ${list
          .map(
            (p, i) =>
              `<button type="button" class="hero-dot${i === 0 ? " is-active" : ""}" data-go="${i}" aria-label="${t.hero_slide_go} ${i + 1}: ${esc(p.title[lang])}"${i === 0 ? ' aria-current="true"' : ""}><i></i></button>`
          )
          .join("")}
      </div>`
      : "";
  return `<div class="hero-slider" data-hero-slider tabindex="-1" aria-roledescription="carousel" aria-label="${t.hero_slider_label}">
      <div class="hero-media" style="${frameStyle(first.cover)}">
        ${slides}
      </div>
      ${dots}
    </div>`;
}

/* Компактная карточка «Все проекты»: обложка целиком + название + направление */
function renderMiniCard(p, lang, depth, t) {
  const href = rel(rootPathFor("project", p.slug, lang), depth);
  const dir = (p.directions || []).map((id) => directionById[id]).filter((d) => d && !d.hidden)[0];
  return `<a class="mini-card" href="${href}">
        <span class="mini-thumb">${renderImg(p.cover, lang, depth, { sizes: "(min-width: 1100px) 220px, (min-width: 720px) 30vw, 50vw" })}</span>
        <span class="mini-title">${esc(p.title[lang])}</span>
        ${dir ? `<span class="mini-dir">${esc(dir[lang])}</span>` : ""}
      </a>`;
}

/* Плитки-направления в hero (идея «окна с плитками», в стиле сайта: линии 1px, лайм) */
const HERO_TILES = [
  { dirs: ["3d"], hash: "3d", ru: "3D и стенды", en: "3D & Stands",
    icon: '<path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/>' },
  { dirs: ["motion"], hash: "motion", ru: "Моушен и SMM", en: "Motion & Social",
    icon: '<rect x="2.5" y="5" width="19" height="14"/><path d="M10 9.5v5l4.5-2.5z"/>' },
  { dirs: ["branding", "print"], hash: "branding", ru: "Брендинг и печать", en: "Branding & Print",
    icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/>' },
  { dirs: ["web", "ai-fashion"], hash: "web", ru: "Веб и AI", en: "Web & AI",
    icon: '<rect x="2.5" y="4" width="19" height="16"/><path d="M2.5 8.5h19M8 12.5l-2 2 2 2M16 12.5l2 2-2 2"/>' },
];
function renderHeroPanel(lang, depth, t) {
  const worksHref = rel(rootPathFor("works", null, lang), depth);
  const a = ABOUT[lang];
  const tiles = HERO_TILES.map((tile) => {
    const n = sortedProjects.filter((p) =>
      tile.dirs.some((d) => projectHasDirection(p, d) && directionById[d] && !directionById[d].hidden)
    ).length;
    const known = visibleDirections.some((d) => d.id === tile.hash);
    return `<li><a class="hero-tile" href="${worksHref}${known ? "#" + tile.hash : ""}">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${tile.icon}</svg>
            <span class="tile-name">${esc(tile[lang])}</span>
            <span class="tile-n">${pad2(n)}</span>
          </a></li>`;
  }).join("\n          ");
  return `<div class="hero-panel">
          <div class="hero-status">
            <span class="status-fact"><b>${esc(a.facts[0].n)}</b> ${esc(a.facts[0].label)}</span>
            <span class="status-fact"><b>${esc(a.facts[2].n)}</b> ${lang === "ru" ? "компаний" : "companies"}</span>
          </div>
          <ul class="hero-tiles" aria-label="${t.hero_tiles_label}">
          ${tiles}
          </ul>
        </div>`;
}

/* Страница «Все работы»: полный список с двухуровневым фильтром */
function buildWorks(lang) {
  const t = L[lang];
  const depth = lang === "ru" ? 0 : 1;
  const head = renderHead({
    title: `${t.all_works_title} — vlddvr`,
    description: t.hero_subtitle,
    lang, depth, kind: "works", slug: null, ogImage: null,
  });
  const header = renderHeader(lang, depth, { kind: "works", slug: null });
  const footer = renderFooter(lang, depth);
  const cards = sortedProjects.map((p) => renderCard(p, lang, depth, t)).join("\n    ");
  return `${head}
<body class="page-works">
  ${header}
  <main id="main">
    <section class="container works works--all" id="works" aria-labelledby="works-title">
      <header class="page-head" style="--fit:${fitOf(t.all_works_title)}">
        <p class="eyebrow">vlddvr · ${pad2(sortedProjects.length)} ${t.cases_word}</p>
        <h1 class="case-title" id="works-title">${t.all_works_title}</h1>
      </header>
      <div class="sec-head sec-head--tight">
        <span class="count"><span data-works-count>${pad2(sortedProjects.length)}</span> / ${pad2(sortedProjects.length)}</span>
      </div>
      <div class="filters" data-filters>
      ${renderFilters(lang, t)}
      </div>
      <div class="project-grid card-grid">
      ${cards}
      </div>
    </section>
    ${renderContactBlock(lang)}
  </main>
  ${footer}
</body>
</html>`;
}

/* Экран 2 — «доказательства»: 3–4 самых сильных кадра крупно, кадр целиком */
const PROOF_SLUGS = ["shell-stand", "haval-gwm", "nout-uz-store", "exzap-showroom"];
function renderProof(lang, depth, t) {
  const list = PROOF_SLUGS.map((sl) => sortedProjects.find((p) => p.slug === sl)).filter(Boolean);
  if (!list.length) return "";
  const items = list.map((p, i) => {
    const href = rel(rootPathFor("project", p.slug, lang), depth);
    return `<li class="proof-item">
        <a class="proof-link" href="${href}">
          <span class="proof-media" style="${frameStyle(p.cover)}">${renderImg(p.cover, lang, depth, { sizes: "(min-width: 1100px) 860px, 100vw" })}</span>
          <span class="proof-cap">
            <span class="proof-n" aria-hidden="true">${pad2(i + 1)}</span>
            <span class="proof-title">${esc(p.title[lang])}</span>
            ${p.client ? `<span class="proof-client">${esc(p.client)}</span>` : ""}
            <span class="proof-go">${t.view_case} →</span>
          </span>
        </a>
      </li>`;
  }).join("\n      ");
  return `<section class="proof" id="proof" aria-labelledby="proof-title">
    <div class="container">
      <div class="sec-head"><h2 class="h2" id="proof-title">${t.proof_title}</h2><span class="count">${pad2(list.length)}</span></div>
      <ol class="proof-list">
      ${items}
      </ol>
    </div>
  </section>`;
}

function buildIndex(lang) {
  const t = L[lang];
  const depth = lang === "ru" ? 0 : 1;
  const heroSlides = heroProjects();
  const featured = heroSlides[0] || null;

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
  const featuredList = sortedProjects.filter((p) => p.featured);
  const restList = sortedProjects.filter((p) => !p.featured);
  const cards = featuredList.map((p) => renderCard(p, lang, depth, t)).join("\n    ");
  const miniCards = restList.map((p) => renderMiniCard(p, lang, depth, t)).join("\n      ");
  const worksHref = rel(rootPathFor("works", null, lang), depth);
  const heroFit = Math.max(...t.hero_lines.map((l) => fitOf(l)));
  const lineCls = ["", "acid", "out"];
  const heroLines = t.hero_lines
    .map((l, i) => (lineCls[i] ? `<span class="${lineCls[i]}">` : `<span>`) + `${esc(l)}</span>`)
    .join(" ");

  const heroMedia = heroSlides.length ? renderHeroSlider(heroSlides, lang, depth, t) : "";

  const html = `${head}
<body class="page-index">
  ${header}
  <main id="main">
    <section class="hero${featured ? "" : " hero--plain"}" aria-labelledby="hero-title">
      ${heroMedia}
      <div class="hero-copy container" style="--fit:${heroFit}">
        <div class="hero-kicker"><span class="status-pill"><i aria-hidden="true"></i>${t.hero_status}</span><p class="eyebrow">${t.hero_eyebrow}</p></div>
        <h1 class="h-giant" id="hero-title">${heroLines}</h1>
        <div class="hero-row">
          <p class="lead">${t.hero_subtitle}</p>
          <div class="hero-ctas">
            ${contactBtn(t.contact_btn, "btn", lang)}
            <a class="btn btn--ghost" href="#proof">${t.works_btn}</a>
          </div>
        </div>
      </div>
    </section>
    ${renderTicker(lang)}
    ${renderProof(lang, depth, t)}
    <section class="container dirs" aria-labelledby="dirs-title">
      <div class="sec-head"><h2 class="h2" id="dirs-title">${t.hero_tiles_label}</h2><span class="count">${pad2(sortedProjects.length)} ${t.cases_word}</span></div>
      ${renderHeroPanel(lang, depth, t)}
    </section>
    <section class="container works" id="works" aria-labelledby="works-title">
      <div class="sec-head">
        <h2 class="h2" id="works-title">${t.featured_title}</h2>
        <span class="count">${pad2(featuredList.length)} / ${pad2(sortedProjects.length)}</span>
      </div>
      <div class="project-grid card-grid">
      ${cards}
      </div>
      ${restList.length ? `<div class="sec-head sec-head--sub">
        <h2 class="h2 h2--sm">${t.all_projects_title}</h2>
        <span class="count">${pad2(restList.length)}</span>
      </div>
      <div class="mini-grid">
      ${miniCards}
      </div>` : ""}
      <p class="works-more"><a class="btn btn--ghost" href="${worksHref}">${t.all_works_link} · ${pad2(sortedProjects.length)} →</a></p>
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
    title: PUBLIC ? `${a.name.join(" ")} (vlddvr) — ${t.about_title}` : `vlddvr — ${t.about_title}`,
    description: a.positioning,
    lang,
    depth,
    kind: "about",
    slug: null,
    ogImage: `${PORTRAITS.main.base}-800.webp`,
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
            ${contactBtn(t.contact_btn, "btn", lang)}
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

  // Индустрия на странице кейса не выводится (решение пользователя); данные tags.industry остаются

  if (!branchLinks.length) return "";

  return `<div class="case-tag-links">
        ${branchLinks.length ? `<div class="tag-row"><span class="tag-row-label">${t.branches_label}</span> ${branchLinks.join(" ")}</div>` : ""}
        
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

  const blocks = renderBlocks(p.blocks || [], lang, depth, t);

  const idx = sortedProjects.findIndex((x) => x.slug === p.slug);
  const next = sortedProjects[(idx + 1) % sortedProjects.length];
  const nextHref = rel(rootPathFor("project", next.slug, lang), depth);

  const badges = renderBadges(p, t);
  const behanceLink = CONTACTS && p.behance
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
      <div class="container case-backbar"><a class="case-back" href="${rel(rootPathFor("works", null, lang), depth)}">← ${t.back}</a></div>
      <div class="case-media" style="${frameStyle(p.cover)}">${renderImg(p.cover, lang, depth, { eager: true, class: "kb" })}</div>
      <div class="container case-intro">
      <div class="case-head" style="--fit:${fitOf(p.title[lang])}">
        <div class="case-tags">
          <span class="tag tag--acid">★ ${projectNumber(p)}</span>
          ${dirNames.map((d) => `<span class="tag">${d}</span>`).join("\n          ")}
          ${badges}
        </div>
        <h1 class="case-title" id="case-title">${esc(p.title[lang])}</h1>
        <p class="lead">${esc(p.summary[lang])}</p>
      </div>
      <aside class="case-aside">
        <dl class="facts">
        ${facts}
        </dl>
        ${tagLinks}
      </aside>
      </div>
    </section>
    ${acts ? `<section class="container acts">\n      ${acts}\n    </section>` : ""}
    <div class="container case-blocks">
    ${blocks}
    </div>
    <section class="cta-band on-acid">
      <div class="container">
        <h2 class="cta-title">${t.cta_title}</h2>
        <div class="cta-side">
          <p>${CONTACTS ? t.cta_text : t.contacts_soon_note}</p>
          <div class="cta-actions">
            ${contactBtn(t.discuss, "btn btn--dark", lang)}
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
  urls.push(rootPathFor("works", null, "ru"));
  urls.push(rootPathFor("works", null, "en"));
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
  writeFile("works.html", buildWorks("ru"));
  writeFile("en/works.html", buildWorks("en"));
  writeFile("en/index.html", buildIndex("en"));
  writeFile("en/about.html", buildAbout("en"));

  // удалить страницы кейсов, которых больше нет в данных (слияния/переименования)
  const slugs = new Set(sortedProjects.map((p) => p.slug + ".html"));
  ["projects", "en/projects"].forEach((dir) => {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) return;
    fs.readdirSync(full).filter((f) => f.endsWith(".html") && !slugs.has(f)).forEach((f) => {
      fs.unlinkSync(path.join(full, f));
      console.log("removed stale", dir + "/" + f);
    });
  });

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

/* Версия файла в адресе (?v=…), чтобы браузеры не держали старые стили и скрипты после обновления */
function assetVer(p) { return require("crypto").createHash("md5").update(require("fs").readFileSync(require("path").join(__dirname, p))).digest("hex").slice(0, 8); }
