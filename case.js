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


/* плашки в строках: плотная упаковка (самые длинные первыми, короткие дозаполняют строки), без пустых «хвостов» (телефон) */
(function () {
  var mq = window.matchMedia('(max-width: 820px)');
  var lists = Array.prototype.slice.call(document.querySelectorAll('.tags, .tools-used'));
  function pack() {
    lists.forEach(function (ul) {
      var items = Array.prototype.slice.call(ul.children);
      items.forEach(function (li) { li.style.order = ''; });
      if (!mq.matches) return;
      var W = ul.clientWidth; if (!W) return;
      var gap = parseFloat(getComputedStyle(ul).columnGap) || 8;
      var list = items.map(function (li, i) { return { li: li, i: i, w: li.getBoundingClientRect().width }; })
        .sort(function (a, b) { return b.w - a.w || a.i - b.i; });
      var rows = [];
      list.forEach(function (o) {
        var row = null;
        for (var r = 0; r < rows.length; r += 1) { if (rows[r].w + gap + o.w <= W + 0.5) { row = rows[r]; break; } }
        if (!row) { row = { w: -gap, items: [] }; rows.push(row); }
        row.items.push(o); row.w += gap + o.w;
      });
      var k = 0;
      rows.forEach(function (row) { row.items.forEach(function (o) { o.li.style.order = k; k += 1; }); });
    });
  }
  pack();
  if (mq.addEventListener) mq.addEventListener('change', pack);
  window.addEventListener('resize', pack);
  window.addEventListener('load', pack);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(pack);
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

/* ===== ровный правый край: подбор переносов по всему абзацу (телефон и планшет) ===== */
(function () {
  var SEL = '.section p, .section li, .fig__cap, .lead, .part__sub';
  var mq = window.matchMedia('(max-width: 820px)');
  var WORD = /[^ \t\n\r]+/g;
  var BLOCK = 'img,svg,video,button,input,iframe,ul,ol,table,p,div,figure,h1,h2,h3,h4';
  function eligible(el) {
    if (el.querySelector(BLOCK)) return false;
    var d = getComputedStyle(el).display;
    return d === 'block' || d === 'list-item';
  }
  function clear(el) {
    var brs = el.querySelectorAll('br.jb');
    if (!brs.length) return false;
    Array.prototype.forEach.call(brs, function (b) { b.parentNode.removeChild(b); });
    el.normalize();
    return true;
  }
  function measure(el) {
    var cs = getComputedStyle(el);
    var W = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 0.5;
    var words = [], r = document.createRange(), tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, m;
    while ((n = tw.nextNode())) {
      if (n.parentNode.closest && n.parentNode.closest('.callout__icon')) continue;
      var t = n.nodeValue; WORD.lastIndex = 0;
      while ((m = WORD.exec(t))) {
        r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        var b = r.getBoundingClientRect();
        words.push({ n: n, s: m.index, l: b.left, r: b.right, t: b.top, glue: m.index === 0 && words.length > 0 && !/[ \t\n\r]$/.test(words[words.length - 1].n.nodeValue) });
      }
    }
    return { W: W, words: words };
  }
  function breaksFor(seg, W) {
    var n = seg.length;
    function width(i, j) { return seg[j - 1].r - seg[i].l; }
    var lines = [], i = 0, j;
    while (i < n) { j = i + 1; while (j < n && width(i, j + 1) <= W) j++; lines.push([i, j]); i = j; }
    var L = lines.length;
    if (L < 2) return [];
    var INF = 1e18;
    function cost(a, b, last) {
      var w = width(a, b);
      if (b - a > 1 && w > W) return INF;
      if (!last) { var c0 = (W - w) * (W - w); return (b < n && width(a, b + 1) <= W) ? c0 + 0.05 * W * W : c0; }
      var m = 0.45 * W - w;
      return m > 0 ? m * m : 0;
    }
    var dp = [], prv = [], k;
    function can(i) { return i === 0 || !seg[i].glue; }
    for (k = 0; k <= L; k++) { dp.push(new Array(n + 1).fill(INF)); prv.push(new Array(n + 1).fill(-1)); }
    dp[0][0] = 0;
    for (k = 1; k <= L; k++) {
      for (var e = k; e <= n; e++) {
        for (var s = k - 1; s < e; s++) {
          if (dp[k - 1][s] >= INF || !can(s)) continue;
          var c = cost(s, e, k === L && e === n);
          if (k === L && e !== n) continue;
          if (c >= INF) continue;
          if (dp[k - 1][s] + c < dp[k][e]) { dp[k][e] = dp[k - 1][s] + c; prv[k][e] = s; }
        }
      }
    }
    if (dp[L][n] >= INF) return [];
    var starts = [], e2 = n;
    for (k = L; k >= 1; k--) { var s2 = prv[k][e2]; if (k > 1) starts.push(s2); e2 = s2; }
    return starts;   // индексы слов, перед которыми ставим перенос (по убыванию)
  }
  function apply(seg, starts) {
    starts.forEach(function (idx) {
      var w = seg[idx], br = document.createElement('br');
      br.className = 'jb';
      if (w.s > 0) { var rest = w.n.splitText(w.s - 1); rest.parentNode.insertBefore(br, rest); }
      else w.n.parentNode.insertBefore(br, w.n);
    });
  }
  function run(list) {
    list = list.filter(function (el) { return el.isConnected; });
    var items = [];
    list.forEach(function (el) { clear(el); });
    if (!mq.matches) return;
    list = list.filter(function (el) { return el.offsetWidth > 0 && eligible(el); });
    list.forEach(function (el) { el.__ws = el.style.whiteSpace; el.style.whiteSpace = 'nowrap'; });
    list.forEach(function (el) { items.push({ el: el, d: measure(el) }); });
    list.forEach(function (el) { el.style.whiteSpace = el.__ws; });
    items.forEach(function (it) {
      var words = it.d.words, seg = [], all = [];
      function flush() { if (seg.length > 1) all.push(seg); seg = []; }
      words.forEach(function (w) {
        if (seg.length && Math.abs(w.t - seg[seg.length - 1].t) > 3) flush();
        seg.push(w);
      });
      flush();
      var ops = [];
      all.forEach(function (sg) { ops.push([sg, breaksFor(sg, it.d.W)]); });
      for (var q = ops.length - 1; q >= 0; q--) apply(ops[q][0], ops[q][1]);
    });
  }
  var pend = new Set(), raf = 0;
  function queue(el) { pend.add(el); if (!raf) raf = requestAnimationFrame(function () { raf = 0; var l = Array.from(pend); pend.clear(); run(l); }); }
  function start() {
    var els = Array.prototype.slice.call(document.querySelectorAll(SEL));
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function (es) {
        es.forEach(function (e) {
          var w = Math.round(e.contentRect.width);
          if (e.target.__jw === w) return;
          e.target.__jw = w; queue(e.target);
        });
      });
      els.forEach(function (el) { ro.observe(el); });
    } else { run(els); window.addEventListener('resize', function () { run(els); }); }
    var onmq = function () { run(els); };
    if (mq.addEventListener) mq.addEventListener('change', onmq);
  }
  var go = function () { start(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else window.addEventListener('load', go);
})();


/* «слева длинная, справа три»: пропорции колонок по реальным пропорциям картинок */
(function () {
  function ar(img) { var w = +img.getAttribute('width'), h = +img.getAttribute('height'); return w && h ? w / h : 0; }
  document.querySelectorAll('.rubrics__track--tall').forEach(function (t) {
    var first = t.querySelector(':scope > img');
    var rest = t.querySelectorAll('.tall__col img');
    if (!first || !rest.length) return;
    var a1 = ar(first), a2 = 0;
    Array.prototype.forEach.call(rest, function (i) { a2 += ar(i); });
    a2 /= rest.length;
    if (!a1 || !a2) return;
    t.style.setProperty('--tcols', (rest.length * a1 / a2).toFixed(3) + 'fr 1fr');
  });
})();
