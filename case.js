(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- плавное появление блоков при прокрутке ---------- */
  const targets = Array.from(document.querySelectorAll(
    '.toc, .part, .section h2, .section > p, .section > h3, .section > ul, .section > figure, .section > ol, .section > .ph-row, .section > .rubrics, .section > .table-wrap, .system, .gallery, .back'
  ));

  if (!reduceMotion && 'IntersectionObserver' in window) {
    targets.forEach((el) => el.classList.add('reveal'));

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        el.classList.add('is-in');
        // после появления убираем служебные классы, чтобы не мешали ховерам
        window.setTimeout(() => el.classList.remove('reveal', 'is-in'), 800);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });

    targets.forEach((el) => io.observe(el));
  }

  /* ---------- меню «разделы» в верхней панели ---------- */
  const toggle = document.querySelector('.topbar__toggle');
  const menu = document.getElementById('sections-menu');
  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
    };
    toggle.addEventListener('click', () => setOpen(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.topbar__menu')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  /* ---------- «Посмотреть журнал»: страницы PDF прямо на сайте ---------- */
  const viewBtn = document.querySelector('[data-magazine]');
  if (viewBtn && typeof HTMLDialogElement === 'function') {
    const total = Number(viewBtn.dataset.pages) || 0;
    const dir = viewBtn.dataset.dir;
    const pdf = viewBtn.dataset.magazine;
    let reader;

    const build = () => {
      reader = document.createElement('dialog');
      reader.className = 'reader';
      reader.setAttribute('aria-label', 'Журнал «История 5 редчайших виниловых пластинок»');
      reader.innerHTML =
        '<div class="reader__bar"><span>Журнал · <span class="reader__num">' + total + ' стр.</span></span>' +
        '<span><a href="' + pdf + '" download>скачать PDF ↓</a></span>' +
        '<button type="button" class="reader__close" aria-label="Закрыть">×</button></div>' +
        '<div class="reader__pages"></div>';
      const list = reader.querySelector('.reader__pages');
      for (let i = 1; i <= total; i += 1) {
        const img = document.createElement('img');
        img.src = dir + String(i).padStart(2, '0') + '.jpg';
        img.alt = 'Страница ' + i + ' из ' + total;
        img.loading = i <= 2 ? 'eager' : 'lazy';
        img.width = 1126; img.height = 1593;
        list.append(img);
      }
      reader.querySelector('.reader__close').addEventListener('click', () => reader.close());
      reader.addEventListener('close', () => { document.documentElement.style.overflow = ''; });
      document.body.append(reader);
    };

    viewBtn.addEventListener('click', () => {
      if (!reader) build();
      document.documentElement.style.overflow = 'hidden';
      reader.showModal();
      reader.querySelector('.reader__pages').scrollTop = 0;
    });
  }

  /* ---------- видео: широкое «листаю PDF» играет, пока его видно ---------- */
  const wide = document.querySelector('.video--wide');
  if (wide && 'IntersectionObserver' in window && !reduceMotion) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) wide.play().catch(() => {});
        else wide.pause();
      });
    }, { threshold: 0.4 }).observe(wide);
  }

  /* ---------- «наверх» ---------- */
  const up = document.querySelector('.to-top');
  if (up) up.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  /* ---------- «наверх»: на телефоне появляется после прокрутки ---------- */
  if (up) {
    const sync = () => up.classList.toggle('is-shown', window.scrollY > 600);
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  /* ---------- фоновые элементы: на длинной мобильной странице растягиваем по всей высоте ---------- */
  const decoBox = document.querySelector('.case-deco');
  if (decoBox) {
    const mq = window.matchMedia('(max-width: 820px)');
    let raf = 0;
    let slots = 0;
    /* каждому элементу один раз достаётся постоянное место: высота страницы (вкладки, раскрытие частей) его уже не двигает */
    const place = () => {
      raf = 0;
      const imgs = Array.from(decoBox.querySelectorAll('img'));
      imgs.forEach((i) => { if (i.dataset.top === undefined) i.dataset.top = parseFloat(i.style.top) || 0; });
      if (!mq.matches) { imgs.forEach((i) => { i.style.top = i.dataset.top + 'px'; i.style.display = ''; delete i.dataset.side; }); return; }
      imgs.forEach((i) => {
        if (i.dataset.slot === undefined) { i.dataset.slot = String(slots); slots += 1; }
      });
      let q = 0;
      imgs.sort((x, y) => x.dataset.slot - y.dataset.slot).forEach((i) => {
        if (Number(i.dataset.slot) % 3 === 2) { i.style.display = 'none'; return; }
        i.style.display = '';
        i.style.top = (q * 200 + 20) + 'px';
        i.dataset.side = q % 2 ? 'r' : 'l';
        q += 1;
      });
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(place); };
    place();
    window.addEventListener('load', queue);
    window.addEventListener('resize', queue);
    if ('MutationObserver' in window) new MutationObserver(queue).observe(decoBox, { childList: true });
  }

  /* галерея: листается мышью (зажать и тянуть), пальцем и колёсиком */
  const gal = document.querySelector('.gallery');
  if (gal) {
    let down = false, sx = 0, sl = 0;
    gal.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      down = true; sx = e.clientX; sl = gal.scrollLeft;
      gal.classList.add('is-drag'); gal.setPointerCapture(e.pointerId);
    });
    gal.addEventListener('pointermove', (e) => { if (down) gal.scrollLeft = sl - (e.clientX - sx); });
    const end = () => { down = false; gal.classList.remove('is-drag'); };
    gal.addEventListener('pointerup', end);
    gal.addEventListener('pointercancel', end);
    gal.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') gal.scrollBy({ left: 300, behavior: 'smooth' });
      if (e.key === 'ArrowLeft') gal.scrollBy({ left: -300, behavior: 'smooth' });
    });
  }

  /* кнопка «играть» поверх видео, пока оно не запущено */
  document.querySelectorAll('.video').forEach((v) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'video-play';
    btn.setAttribute('aria-label', 'Смотреть видео');
    v.parentElement.append(btn);
    btn.addEventListener('click', () => { v.play().catch(() => {}); });
    v.addEventListener('play', () => { btn.hidden = true; });
    v.addEventListener('pause', () => { if (v.currentTime < 0.1 || v.ended) btn.hidden = false; });
    v.addEventListener('ended', () => { btn.hidden = false; });
    if (!v.paused) btn.hidden = true;
  });
})();

/* ---------- раскрывающиеся части кейса «Визуал соцсетей» ---------- */
(() => {
  const parts = Array.from(document.querySelectorAll('.part[aria-controls]'));
  if (!parts.length) return;

  const setState = (part, open) => {
    const body = document.getElementById(part.getAttribute('aria-controls'));
    if (!body) return;
    body.hidden = !open;
    part.setAttribute('aria-expanded', String(open));
    const label = part.querySelector('.part__toggle-text');
    if (label) label.textContent = open ? 'свернуть' : 'раскрыть';
  };
  const partOf = (el) => {
    const body = el && el.closest('.part-body');
    return body ? document.querySelector('.part[aria-controls="' + body.id + '"]') : null;
  };

  parts.forEach((part, i) => {
    setState(part, i === 0);
    const toggle = () => setState(part, part.getAttribute('aria-expanded') !== 'true');
    part.addEventListener('click', toggle);
    part.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  // переход по ссылке на главу в свёрнутой части — сначала раскрываем её
  const openFor = (id) => {
    const part = partOf(document.getElementById(id));
    if (part && part.getAttribute('aria-expanded') !== 'true') setState(part, true);
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href').length > 1) openFor(a.getAttribute('href').slice(1));
  }, true);
  if (location.hash.length > 1) {
    openFor(decodeURIComponent(location.hash.slice(1)));
    const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t) t.scrollIntoView();
  }
})();

/* ---------- содержание: части 2 и 3 раскрываются по клику ---------- */
(() => {
  document.querySelectorAll('.toc__part--btn').forEach((btn) => {
    const group = document.getElementById(btn.getAttribute('aria-controls'));
    if (!group) return;
    group.hidden = btn.getAttribute('aria-expanded') !== 'true';
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      group.hidden = !open;
    });
  });
})();

/* ---------- интерактив: рубрики — вкладки, все слайды поста в одной области ---------- */
(() => {
  document.querySelectorAll('[data-rubrics]').forEach((root) => {
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const tracks = Array.from(root.querySelectorAll('.rubrics__track'));
    const select = (tab) => {
      tabs.forEach((b) => b.setAttribute('aria-selected', String(b === tab)));
      tracks.forEach((t) => { t.hidden = t.id !== tab.getAttribute('aria-controls'); });
      tracks.forEach((t) => t.querySelectorAll('video').forEach((v) => { if (t.hidden) v.pause(); else v.play().catch(() => {}); }));
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        const n = tabs[(i + d + tabs.length) % tabs.length];
        n.focus(); select(n);
      });
    });
  });
})();

/* ---------- палитра: клик копирует код цвета ---------- */
(() => {
  document.querySelectorAll('[data-palette]').forEach((root) => {
    const toast = root.querySelector('.palette__toast');
    let timer;
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-hex]');
      if (!b) return;
      const hex = b.dataset.hex;
      try { await navigator.clipboard.writeText(hex); } catch (_) {
        const ta = document.createElement('textarea'); ta.value = hex; document.body.append(ta); ta.select();
        try { document.execCommand('copy'); } catch (__) {} ta.remove();
      }
      toast.textContent = 'Скопировано ' + hex;
      toast.classList.add('is-on');
      clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('is-on'), 1400);
    });
  });
})();

/* ---------- шаблоны рубрик: вкладки и варианты ---------- */
(() => {
  document.querySelectorAll('[data-templates]').forEach((root) => {
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const tracks = Array.from(root.querySelectorAll('.rubrics__track'));
    const box = root.querySelector('.rubrics__variants');
    const show = (id) => tracks.forEach((t) => { t.hidden = t.id !== id; });
    const select = (tab) => {
      tabs.forEach((b) => b.setAttribute('aria-selected', String(b === tab)));
      const ids = tab.dataset.tracks.split(',');
      const labels = tab.dataset.labels.split('|');
      box.textContent = '';
      if (ids.length > 1) {
        ids.forEach((id, i) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'rubrics__var'; b.textContent = labels[i];
          b.setAttribute('aria-pressed', String(i === 0));
          b.addEventListener('click', () => {
            box.querySelectorAll('.rubrics__var').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            show(id);
          });
          box.append(b);
        });
        box.hidden = false;
      } else box.hidden = true;
      show(ids[0]);
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        const n = tabs[(i + d + tabs.length) % tabs.length];
        n.focus(); select(n);
      });
    });
    select(tabs[0]);
  });
})();

/* видео: при запуске одного остальные ставятся на паузу */
(function () {
  const vids = document.querySelectorAll('.rubrics--video video');
  vids.forEach((v) => v.addEventListener('play', () => vids.forEach((o) => { if (o !== v) o.pause(); })));
})();

/* фоновые украшения: узор повторяется с шагом 1970px и достраивается на всю высоту страницы
   (в том числе когда раскрывают части кейса); неполный повтор в конце исходного узора заменяется полным */
(function () {
  const box = document.querySelector('.case-deco');
  if (!box) return;
  const PERIOD = 1970;
  const imgs = [...box.querySelectorAll('img')];
  const topOf = (i) => parseFloat(i.dataset.top !== undefined ? i.dataset.top : i.style.top);
  const idx = (i) => Math.floor((topOf(i) + 40) / PERIOD);
  const base = imgs.filter((i) => idx(i) === 0);
  if (!base.length) return;
  const count = {};
  imgs.forEach((i) => { count[idx(i)] = (count[idx(i)] || 0) + 1; });
  const present = new Set(Object.keys(count).map(Number).filter((k) => count[k] >= base.length));
  imgs.forEach((i) => { if (!present.has(idx(i))) i.remove(); });
  const make = (k) => {
    base.forEach((d) => {
      const c = d.cloneNode(true);
      const t = topOf(d) + k * PERIOD;
      delete c.dataset.slot; delete c.dataset.side;
      c.dataset.top = t;
      c.style.top = `${t}px`;
      box.appendChild(c);
    });
    present.add(k);
  };
  const fill = () => {
    const need = Math.ceil(document.documentElement.scrollHeight / PERIOD);
    for (let k = 1; k <= need; k += 1) if (!present.has(k)) make(k);
  };
  fill();
  if ('ResizeObserver' in window) new ResizeObserver(fill).observe(document.body);
  window.addEventListener('load', fill);
})();

/* «← все проекты»: если пришли с главной, возвращаемся туда же, где были */
(function () {
  try {
    var r = new URL(document.referrer);
    var fromIndex = r.origin === location.origin && /(^|\/)(index\.html)?$/.test(r.pathname) && history.length > 1;
    if (!fromIndex) return;
    document.querySelectorAll('a.topbar__back, a.more-link[href^="index.html"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();
        history.back();
      });
    });
  } catch (err) { /* без referrer — обычная ссылка */ }
})();


/* плашки в строке: от длинных к коротким, чтобы правый край получался ровным (только на телефоне) */
(function () {
  var mq = window.matchMedia('(max-width: 820px)');
  var lists = Array.prototype.slice.call(document.querySelectorAll('.tags, .tools-used'));
  function sort() {
    lists.forEach(function (ul) {
      var items = Array.prototype.slice.call(ul.children);
      if (!mq.matches) { items.forEach(function (li) { li.style.order = ''; }); return; }
      items.map(function (li, i) { return { li: li, i: i, n: li.textContent.trim().length }; })
        .sort(function (a, b) { return b.n - a.n || a.i - b.i; })
        .forEach(function (o, k) { o.li.style.order = k; });
    });
  }
  sort();
  if (mq.addEventListener) mq.addEventListener('change', sort);
})();


/* таблицы: подписи колонок для одноколоночного вида на телефоне */
(function () {
  document.querySelectorAll('.data-table').forEach(function (t) {
    var heads = Array.prototype.map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
    var first = t.querySelector('tbody td');
    var hash = first && /^#/.test(first.textContent.trim());
    if (hash) { t.classList.add('data-table--tags'); return; }
    t.querySelectorAll('tbody tr').forEach(function (tr) {
      Array.prototype.forEach.call(tr.children, function (td, i) { if (heads[i]) td.setAttribute('data-label', heads[i]); });
    });
  });
})();

/* широкие картинки в рядах помечаем, чтобы на телефоне растянуть их на всю ширину */
(function () {
  document.querySelectorAll('.shots__item[style*="--ar"]').forEach(function (it) {
    var m = /--ar:\s*([\d.]+)/.exec(it.getAttribute('style'));
    if (m && parseFloat(m[1]) >= 1.4) it.setAttribute('data-wide', '');
  });
})();
