(function () {
  "use strict";

  var LANG = (document.documentElement.getAttribute("lang") || "ru").slice(0, 2);
  var T = {
    ru: { close: "Закрыть", prev: "Предыдущее", next: "Следующее", dialog: "Просмотр изображения", open: "Открыть изображение" },
    en: { close: "Close", prev: "Previous", next: "Next", dialog: "Image viewer", open: "Open image" },
  }[LANG === "en" ? "en" : "ru"];

  function toArray(list) { return Array.prototype.slice.call(list); }

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- Появление при прокрутке ----------
     Контент виден в покое: прячем (.reveal-pending) только то, что
     сейчас ниже первого экрана. Видимое при загрузке не трогаем.
     При prefers-reduced-motion ничего не прячем. */
  function initReveal() {
    var items = toArray(document.querySelectorAll(".reveal"));
    if (!items.length || reduceMotion || !("IntersectionObserver" in window)) return;

    var vh = window.innerHeight || document.documentElement.clientHeight;
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.remove("reveal-pending");
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.01 }
    );

    items.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var hiddenByFilter = r.width === 0 && r.height === 0;
      if (!hiddenByFilter && r.top < vh && r.bottom > 0) {
        el.classList.add("is-visible");
        return;
      }
      if (!hiddenByFilter && r.bottom <= 0) {
        // уже над экраном (переход по якорю) — не прячем
        el.classList.add("is-visible");
        return;
      }
      el.classList.add("reveal-pending");
      observer.observe(el);
    });

    window.addEventListener("beforeprint", function () {
      toArray(document.querySelectorAll(".reveal-pending")).forEach(function (el) {
        el.classList.remove("reveal-pending");
      });
    });
  }

  /* ---------- Двухуровневый фильтр направлений (направление -> ответвление) ----------
     Состояние в хэше: #3d, #3d/stands */
  function initFilter() {
    var filtersRoot = document.querySelector("[data-filters]");
    var dirFilter = document.querySelector(".direction-filter");
    var grid = document.querySelector(".project-grid");
    if (!filtersRoot || !dirFilter || !grid) return;

    var branchGroups = toArray(document.querySelectorAll(".branch-filter"));
    var cards = toArray(grid.querySelectorAll(".project-card"));
    var dirButtons = toArray(dirFilter.querySelectorAll("button[data-direction]"));
    var countEl = document.querySelector("[data-works-count]");

    var state = { dir: "all", branch: "all", industry: null };

    function groupFor(dir) {
      return branchGroups.filter(function (g) { return g.getAttribute("data-for") === dir; })[0];
    }

    function setPressed(btn, on) {
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }

    function applyFilterToCards() {
      var visible = 0;
      cards.forEach(function (card) {
        var dirs = (card.getAttribute("data-directions") || "").split(",");
        var branches = (card.getAttribute("data-branches") || "").split(",");
        var show = state.dir === "all" || dirs.indexOf(state.dir) !== -1;
        if (show && state.branch !== "all") {
          show = branches.indexOf(state.branch) !== -1;
        }
        card.style.display = show ? "" : "none";
        if (show) visible++;
      });
      if (countEl) countEl.textContent = (visible < 10 ? "0" : "") + visible;
    }

    function render() {
      dirButtons.forEach(function (b) {
        setPressed(b, !state.industry && b.getAttribute("data-direction") === state.dir);
      });
      branchGroups.forEach(function (g) {
        var isCurrent = !state.industry && g.getAttribute("data-for") === state.dir;
        g.hidden = !isCurrent;
        if (isCurrent) {
          toArray(g.querySelectorAll("button[data-branch]")).forEach(function (b) {
            setPressed(b, b.getAttribute("data-branch") === state.branch);
          });
        }
      });
      applyFilterToCards();
    }

    function updateHash() {
      var hash = "";
      if (state.industry) {
        hash = "industry/" + state.industry;
      } else if (state.dir !== "all") {
        hash = state.branch !== "all" ? state.dir + "/" + state.branch : state.dir;
      }
      var url = window.location.pathname + window.location.search + (hash ? "#" + hash : "");
      window.history.replaceState(null, "", url);
    }

    function setDirection(dir) {
      state.industry = null;
      state.dir = dir;
      state.branch = "all";
      render();
      updateHash();
    }

    function setBranch(branch) {
      state.industry = null;
      state.branch = branch;
      render();
      updateHash();
    }

    function applyFromHash() {
      var hash = window.location.hash.replace(/^#/, "");
      if (!hash || hash === "works" || hash === "contact" || hash === "main") {
        state.dir = "all";
        state.branch = "all";
        state.industry = null;
        render();
        return;
      }
      var parts = hash.split("/");
      var dirId = parts[0];
      var known = dirButtons.some(function (b) { return b.getAttribute("data-direction") === dirId; });
      if (!known) {
        state.dir = "all";
        state.branch = "all";
        state.industry = null;
        render();
        return;
      }
      state.industry = null;
      state.dir = dirId;
      state.branch = parts[1] && groupFor(dirId) ? parts[1] : "all";
      render();
      scrollToWorks();
    }

    // Ссылка с фильтром (#3d/stands) открывает страницу сразу на сетке работ
    function scrollToWorks() {
      var works = document.getElementById("works");
      if (works && works.scrollIntoView) works.scrollIntoView({ block: "start" });
    }

    dirFilter.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-direction]");
      if (!btn) return;
      setDirection(btn.getAttribute("data-direction"));
    });

    branchGroups.forEach(function (g) {
      g.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-branch]");
        if (!btn) return;
        setBranch(btn.getAttribute("data-branch"));
      });
    });

    window.addEventListener("hashchange", applyFromHash);
    applyFromHash();
  }

  /* ---------- Лайтбокс: кадр целиком, клавиатура, свайп ---------- */
  function initLightbox() {
    var triggers = toArray(document.querySelectorAll("[data-lightbox] img"));
    if (!triggers.length) return;

    var lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", T.dialog);
    lightbox.innerHTML =
      '<button type="button" class="lightbox-close" aria-label="' + T.close + '">&times;</button>' +
      '<button type="button" class="lightbox-prev" aria-label="' + T.prev + '">&#8249;</button>' +
      '<img src="" alt="">' +
      '<span class="lightbox-count" aria-live="polite"></span>' +
      '<button type="button" class="lightbox-next" aria-label="' + T.next + '">&#8250;</button>';
    document.body.appendChild(lightbox);

    var imgEl = lightbox.querySelector("img");
    var closeBtn = lightbox.querySelector(".lightbox-close");
    var prevBtn = lightbox.querySelector(".lightbox-prev");
    var nextBtn = lightbox.querySelector(".lightbox-next");
    var countEl = lightbox.querySelector(".lightbox-count");
    var buttons = [closeBtn, prevBtn, nextBtn];
    var current = 0;
    var lastFocus = null;
    var single = triggers.length < 2;
    prevBtn.hidden = single;
    nextBtn.hidden = single;

    function show(index) {
      current = (index + triggers.length) % triggers.length;
      var el = triggers[current];
      imgEl.src = el.currentSrc || el.src;
      imgEl.alt = el.alt || "";
      countEl.textContent = single ? "" : current + 1 + " / " + triggers.length;
    }
    function open(index) {
      lastFocus = document.activeElement;
      show(index);
      lightbox.classList.add("is-open");
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    }
    function close() {
      lightbox.classList.remove("is-open");
      imgEl.removeAttribute("src");
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    triggers.forEach(function (el, i) {
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      if (el.alt) el.setAttribute("aria-label", T.open + ": " + el.alt);
      el.addEventListener("click", function () { open(i); });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(i);
        }
      });
    });
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", function () { show(current - 1); });
    nextBtn.addEventListener("click", function () { show(current + 1); });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) close();
    });
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft" && !single) show(current - 1);
      else if (e.key === "ArrowRight" && !single) show(current + 1);
      else if (e.key === "Tab") {
        // фокус не уходит из диалога
        var focusable = buttons.filter(function (b) { return !b.hidden; });
        var idx = focusable.indexOf(document.activeElement);
        e.preventDefault();
        var nextIdx = e.shiftKey ? idx - 1 : idx + 1;
        focusable[(nextIdx + focusable.length) % focusable.length].focus();
      }
    });

    // свайп на телефоне
    var startX = null;
    lightbox.addEventListener("touchstart", function (e) {
      startX = e.touches && e.touches.length === 1 ? e.touches[0].clientX : null;
    }, { passive: true });
    lightbox.addEventListener("touchend", function (e) {
      if (startX === null || single) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });
  }

  /* ---------- Hero-слайдер: кроссфейд + наезд, полоски прогресса ----------
     Смена — по окончании CSS-анимации полоски (5 с). Пауза: наведение,
     фокус внутри, скрытая вкладка. При reduced motion анимаций нет —
     значит и автопрокрутки нет, только ручное переключение. */
  function initHeroSlider() {
    var root = document.querySelector("[data-hero-slider]");
    if (!root) return;
    var slides = toArray(root.querySelectorAll(".hero-slide"));
    var dots = toArray(root.querySelectorAll(".hero-dot"));
    if (slides.length < 2) return;
    var current = 0;

    function go(i) {
      i = (i + slides.length) % slides.length;
      if (i === current) return;
      var prev = slides[current];
      prev.classList.remove("is-active");
      prev.setAttribute("aria-hidden", "true");
      prev.setAttribute("tabindex", "-1");
      dots[current].classList.remove("is-active");
      dots[current].removeAttribute("aria-current");
      current = i;
      var s = slides[current];
      var img = s.querySelector("img");
      if (img && img.loading === "lazy") img.loading = "eager";
      s.classList.add("is-active");
      s.removeAttribute("aria-hidden");
      s.removeAttribute("tabindex");
      // перезапуск полоски и наезда
      var d = dots[current];
      d.classList.remove("is-active");
      void d.offsetWidth;
      d.classList.add("is-active");
      d.setAttribute("aria-current", "true");
      // подгрузить следующий кадр заранее
      var nextImg = slides[(current + 1) % slides.length].querySelector("img");
      if (nextImg && nextImg.loading === "lazy") nextImg.loading = "eager";
    }

    dots.forEach(function (d, i) {
      d.addEventListener("click", function () { go(i); });
      d.addEventListener("animationend", function (e) {
        if (e.target.tagName === "I" && d.classList.contains("is-active")) go(current + 1);
      });
    });

    function setPaused(on) { root.classList.toggle("is-paused", on); }
    root.addEventListener("mouseenter", function () { setPaused(true); });
    root.addEventListener("mouseleave", function () { setPaused(root.contains(document.activeElement)); });
    root.addEventListener("focusin", function () { setPaused(true); });
    root.addEventListener("focusout", function (e) {
      if (!root.contains(e.relatedTarget)) setPaused(false);
    });
    document.addEventListener("visibilitychange", function () {
      root.classList.toggle("is-hidden-tab", document.hidden);
    });

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
    });

    var startX = null, startY = null;
    root.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    }, { passive: true });
    root.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(current + (dx < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });
    // свайп не должен открывать ссылку слайда
    root.addEventListener("click", function (e) {
      if (root.classList.contains("is-swiping")) e.preventDefault();
    });
  }

  /* ---------- Ролики в сетках кейса ----------
     Пока ролик виден — тихо играет по кругу без звука (preload="none": файл
     начинает грузиться только в зоне видимости). Кнопка «Звук» (data-sound)
     запускает ролик с начала со звуком и включает controls; остальные ролики
     при этом ставятся на паузу и мьютятся. Где WebM не играет (старые iPhone),
     остаётся MP4-луп без звука — кнопка убирается, как раньше. */
  function initAutoplay() {
    var vids = toArray(document.querySelectorAll("video[data-autoplay]"));
    if (!vids.length) return;
    var active = null; // ролик, который сейчас играет со звуком

    function safePlay(v) {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    function quiet(v) { return !reduceMotion && v._inView && v !== active; }
    function btnOf(v) { return v.parentNode.querySelector("[data-sound]"); }

    // выйти из режима «со звуком»: ролик снова тихий луп с кнопкой
    function stopSound(v, resume) {
      if (active !== v) return;
      active = null;
      v.muted = true;
      v.loop = true;
      v.controls = false;
      var b = btnOf(v);
      if (b) b.hidden = false;
      if (resume) vids.forEach(function (o) { if (quiet(o)) safePlay(o); });
    }

    function startSound(v) {
      if (active && active !== v) stopSound(active, false);
      vids.forEach(function (o) {
        if (o !== v) { o.muted = true; if (!o.paused) o.pause(); }
      });
      active = v;
      v.loop = false;
      v.muted = false;
      v.volume = 1;
      v.controls = true;
      try { v.currentTime = 0; } catch (e) {}
      var b = btnOf(v);
      if (b) b.hidden = true;
      safePlay(v);
      v.focus();
    }

    var webmOk = (function () {
      try { return !!document.createElement("video").canPlayType('video/webm; codecs="vp9, opus"'); }
      catch (e) { return false; }
    })();

    vids.forEach(function (v) {
      var b = btnOf(v);
      if (!b) return;
      if (!webmOk) { // запасной MP4-луп без звука: кнопка не нужна
        b.parentNode.removeChild(b);
        v.controls = true;
        return;
      }
      v.setAttribute("tabindex", "-1");
      b.addEventListener("click", function () { startSound(v); });
      v.addEventListener("ended", function () { stopSound(v, true); });
    });

    if (!("IntersectionObserver" in window)) {
      vids.forEach(function (v) { v.controls = true; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        v._inView = en.isIntersecting;
        if (en.isIntersecting) {
          if (quiet(v) && !active) { v.muted = true; safePlay(v); }
        } else {
          if (v === active) stopSound(v, true);
          if (!v.paused) v.pause();
        }
      });
    }, { threshold: 0.35 });
    vids.forEach(function (v) { io.observe(v); });
  }

  function init() {
    initHeroSlider();
    initAutoplay();
    initFilter(); // сначала фильтр из хэша, потом reveal — чтобы скрытые карточки не мерили
    initReveal();
    initLightbox();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* Логотип: vlddvr ⇄ vladdiviart — медленные горизонтальные растяжения букв (как лотти-анимация), скрытые буквы раскрываются по ширине */
(function () {
  "use strict";
  var FULL = "vladdiviart", SHORT = "vlddvr";
  function setup(logo) {
    if (logo.dataset.logoReady) return;
    logo.dataset.logoReady = "1";
    var dot = logo.querySelector("b");
    logo.setAttribute("aria-label", SHORT);
    var wrap = document.createElement("span");
    wrap.className = "logo-word";
    wrap.setAttribute("aria-hidden", "true");
    var chars = [], si = 0;
    FULL.split("").forEach(function (ch, i) {
      var s = document.createElement("span");
      var core = SHORT[si] === ch;
      if (core) si++;
      s.className = "logo-ch" + (core ? "" : " logo-ch--x");
      s.textContent = ch;
      wrap.appendChild(s);
      chars.push({ el: s, core: core, i: i, cur: core ? 1 : 0, w: 0 });
    });
    while (logo.firstChild) logo.removeChild(logo.firstChild);
    logo.appendChild(wrap);
    if (dot) logo.appendChild(dot);
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; /* без анимации остаётся статичный vlddvr */
    logo.classList.add("logo-live");
    function measure() { chars.forEach(function (c) { c.el.style.transform = ""; c.el.style.marginRight = ""; c.w = c.el.getBoundingClientRect().width; }); }
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);
    var open = false, hover = false, t0 = performance.now(), last = t0;
    function frame(now) {
      var dt = Math.min(64, now - last); last = now;
      var t = (now - t0) / 1000;
      /* цикл 14 с: 0–5 с короткий логотип, 5–11 с раскрыт, дальше снова короткий */
      var phase = t % 14;
      open = hover || (phase > 5 && phase < 11);
      for (var k = 0; k < chars.length; k++) {
        var c = chars[k];
        var target = c.core ? 1 : (open ? 1 : 0);
        c.cur += (target - c.cur) * (1 - Math.pow(0.0025, dt / 1000));   /* плавное, медленное раскрытие */
        var wave = 1 + 0.16 * Math.sin(t * 0.9 + c.i * 0.75);             /* медленное горизонтальное «дыхание» */
        var s = Math.max(0, c.cur * wave);
        c.el.style.transform = "scaleX(" + s.toFixed(3) + ")";
        c.el.style.marginRight = (c.w * (s - 1)).toFixed(2) + "px";
        c.el.style.opacity = c.core ? "" : Math.min(1, c.cur * 1.4).toFixed(2);
      }
      if (!document.hidden) requestAnimationFrame(frame); else setTimeout(function () { last = performance.now(); requestAnimationFrame(frame); }, 500);
    }
    requestAnimationFrame(frame);
    logo.addEventListener("mouseenter", function () { hover = true; });
    logo.addEventListener("mouseleave", function () { hover = false; });
  }
  function initLogo() { document.querySelectorAll("a.logo").forEach(setup); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initLogo); else initLogo();
})();
