(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;

  /* ---------- «показать больше» в блоке «Мой опыт» ---------- */
  // Высоту анимируем через Web Animations API (без grid-template-rows и без
  // вложенных анимаций внутри блока) — так в Safari не остаётся артефактов.
  const DURATION = reduceMotion ? 0 : 450;
  const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

  const setExpanded = (el, expand) => {
    if (!DURATION || typeof el.animate !== 'function') {
      el.classList.toggle('is-expanded', expand);
      return;
    }

    // текущее состояние (на случай, если нажали посреди анимации)
    const from = el.getBoundingClientRect().height;
    const opacity = parseFloat(getComputedStyle(el).opacity);
    if (el._anim) {
      el._anim.cancel();
      el._anim = null;
    }

    el.style.overflow = 'hidden';
    if (expand) el.classList.add('is-expanded');
    const to = expand ? el.getBoundingClientRect().height : 0;

    const anim = el.animate(
      [
        { height: `${from}px`, opacity },
        { height: `${to}px`, opacity: expand ? 1 : 0 },
      ],
      { duration: DURATION, easing: EASE, fill: 'forwards' }
    );
    el._anim = anim;

    anim.onfinish = () => {
      if (!expand) el.classList.remove('is-expanded');
      el.style.overflow = '';
      anim.cancel();
      if (el._anim === anim) el._anim = null;
    };
  };

  document.querySelectorAll('.exp-row').forEach((row) => {
    const btn = row.querySelector('.exp-toggle');
    if (!btn) return;
    const panels = Array.from(row.querySelectorAll('.collapse'));

    btn.addEventListener('click', () => {
      const open = row.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      panels.forEach((panel) => setExpanded(panel, open));

      // при сворачивании длинной строки возвращаем её начало в поле зрения,
      // чтобы не «провалиться» на следующую запись
      if (!open && row.getBoundingClientRect().top < 0) {
        row.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    });
  });

  /* ---------- фильтр проектов: активен только один тег ---------- */
  const filters = Array.from(document.querySelectorAll('.filter'));
  const cards = Array.from(document.querySelectorAll('.card'));
  const empty = document.querySelector('.cases__empty');
  const allBtn = filters.find((f) => f.dataset.filter === '');

  const casesSection = document.querySelector('.cases');
  const moreBtn = document.querySelector('.cases__more');
  const FIRST = 2;            // сколько карточек видно, пока список свёрнут
  let expanded = false;

  const applyFilter = (animateFrom = -1) => {
    const active = filters.find((f) => f.classList.contains('is-active'));
    const tag = active ? active.dataset.filter : '';
    let matched = 0;

    cards.forEach((card) => {
      const tags = (card.dataset.tags || '').split(/\s+/);
      const ok = !tag || tags.includes(tag);
      const show = ok && (expanded || matched < FIRST);
      if (ok) matched += 1;
      const wasHidden = card.hidden;
      card.hidden = !show;
      card.classList.remove('is-entering');
      if (show && wasHidden && animateFrom >= 0 && !reduceMotion) {
        card.style.setProperty('--k', String(Math.max(0, matched - 1 - animateFrom)));
        void card.offsetWidth;
        card.classList.add('is-entering');
        card.addEventListener('animationend', () => card.classList.remove('is-entering'), { once: true });
        card.classList.remove('reveal', 'is-in');
      }
    });

    if (empty) empty.hidden = matched !== 0;
    if (moreBtn) {
      moreBtn.hidden = matched <= FIRST;
      moreBtn.textContent = expanded ? 'свернуть ↖' : 'показать больше ↗';
      moreBtn.setAttribute('aria-expanded', String(expanded));
    }
    if (casesSection) {
      casesSection.classList.toggle('is-expanded', expanded && matched > FIRST);
      casesSection.classList.toggle('has-row4', matched > 6);
      fitDecos();
      if (window.__placeGaps) window.__placeGaps();
    }
    if (window.__pfDockSync) window.__pfDockSync();
  };

  /* декорации, которые не помещаются в высоту секции при текущем фильтре, скрываем */
  const frame = casesSection && casesSection.querySelector('.frame');
  /* когда раскрыт весь список, он заметно длиннее макета: продлеваем украшения,
     повторяя их узор (период 1147 в единицах макета) вниз по секции */
  if (frame) {
    const base = [...frame.querySelectorAll('.deco--more:not(.deco--r4)')];
    const PERIOD = 1147;
    for (let k = 1; k <= 8; k += 1) {
      base.forEach((d) => {
        const m = /top:\s*calc\(var\(--u\)\s*\*\s*(-?[\d.]+)\)/.exec(d.getAttribute('style') || '');
        if (!m) return;
        const c = d.cloneNode(true);
        c.style.top = `calc(var(--u) * ${parseFloat(m[1]) + k * PERIOD})`;
        c.dataset.clone = '1';
        c.style.setProperty('--d', `${(k * 0.7) % 3}s`);
        d.parentNode.insertBefore(c, d.parentNode.querySelector('.deco--r4') || null);
      });
    }
  }

  /* ---------- мобильные украшения вокруг карточек кейсов: «рассыпаны» случайно по краям ---------- */
  if (frame) {
    const IMGS = ['05-blue', '06-orange', '14-lime', '02-pink', '10-lilac', '11-cyan', '17-orange', '20-lilac'];
    const pool = [];
    for (let i = 0; i < 80; i += 1) {
      const d = document.createElement('span');
      d.className = 'deco deco--gap';
      d.setAttribute('aria-hidden', 'true');
      d.innerHTML = '<img alt="" src="assets/projects-section/projects-section-deco/expanded/cases-decoration-' + IMGS[i % IMGS.length] + '.svg">';
      frame.appendChild(d);
      pool.push(d);
    }
    const mq = window.matchMedia('(max-width: 1023px)');
    const desk = Array.from(frame.querySelectorAll('.deco:not(.deco--gap)'));
    desk.forEach((d) => { if (!d.dataset.clone) d.dataset.orig = d.getAttribute('style') || ''; });
    // «случайность» воспроизводима: у каждой карточки свой набор, и он не прыгает при перерисовке
    const prng = (seed) => () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // положение элемента внутри frame без учёта transform (карточки анимируются при появлении)
    const relBox = (el) => {
      let x = 0, y = 0, e = el;
      while (e && e !== frame) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
    };
    const place = () => {
      const mobile = mq.matches;
      // десктопные украшения: на телефоне прячем (иначе они копятся по бокам), на десктопе возвращаем как было
      desk.forEach((d) => {
        if (mobile) d.style.setProperty('display', 'none', 'important');
        else if (d.dataset.orig !== undefined) d.setAttribute('style', d.dataset.orig);
        else d.style.removeProperty('display');
      });
      pool.forEach((d) => d.style.setProperty('display', 'none', 'important'));
      if (!mobile) return;
      const vis = cards.filter((c) => !c.hidden);
      const W = frame.clientWidth;
      const boxes = { l: [], r: [] };
      let used = 0;
      vis.forEach((c, i) => {
        const rng = prng(i * 7919 + 101);
        const box = relBox(c);
        const n = rng() < 0.35 ? 3 : 2;
        const sides = i % 2 ? ['l', 'r'] : ['r', 'l'];
        if (n === 3) sides.push(rng() < 0.5 ? 'l' : 'r');
        sides.forEach((side) => {
          if (used >= pool.length) return;
          // часть элементов «сидит» на углу карточки поверх неё (на стыке карточек), остальные прячутся за ней
          const front = rng() < 0.3;
          const size = front ? Math.round(52 + rng() * 22) : Math.round(58 + rng() * 42);
          const show = front ? Math.round(size * 0.62) : Math.round(22 + rng() * 16);
          const lo = box.top - size * 0.4, hi = box.top + box.height - size * 0.6;
          let y = lo + rng() * (hi - lo), ok = false;
          for (let t = 0; t < 8 && !ok; t += 1) {
            y = front ? (rng() < 0.5 ? box.top : box.top + box.height) - size * 0.5 : lo + rng() * (hi - lo);
            ok = boxes[side].every((b) => y > b[1] + 8 || y + size < b[0] - 8);
          }
          if (!ok) return;
          boxes[side].push([y, y + size]);
          const x = side === 'l' ? box.left - show : box.left + box.width + show - size;
          const d = pool[used];
          used += 1;
          d.style.setProperty('display', 'flex', 'important');
          d.style.setProperty('inset', 'auto', 'important');
          d.style.setProperty('left', Math.min(x, W - 8) + 'px', 'important');
          d.style.setProperty('top', y + 'px', 'important');
          d.style.setProperty('width', size + 'px', 'important');
          d.style.setProperty('height', size + 'px', 'important');
          d.style.setProperty('z-index', front ? '2' : '0', 'important');
          d.firstElementChild.style.setProperty('--r', Math.round(rng() * 70 - 35) + 'deg');
        });
      });
    };
    window.__placeGaps = place;
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(frame);
    window.addEventListener('resize', place);
    window.addEventListener('load', place);
    place();
  }

  const decos = casesSection ? [...casesSection.querySelectorAll('.deco:not(.deco--gap)')] : [];
  const fitDecos = () => {
    if (!frame) return;
    decos.forEach((d) => d.classList.remove('deco--off'));
    const H = frame.offsetHeight;
    const u = Math.min(1, frame.offsetWidth / 1440);
    const hasRow4 = casesSection.classList.contains('has-row4');
    decos.forEach((d) => {
      if (!d.offsetHeight) return;
      const bottom = d.offsetTop + d.offsetHeight;
      /* копии не должны наезжать на нижний ряд украшений */
      const limit = d.dataset.clone && hasRow4 ? H - 700 * u : H + 2;
      if (bottom > limit) d.classList.add('deco--off');
    });
  };
  if (frame && 'ResizeObserver' in window) new ResizeObserver(fitDecos).observe(frame);
  window.addEventListener('load', fitDecos);

  /* переход по ссылке на конкретную карточку (из кейсов): раскрыть список и подъехать к ней */
  let restored = false;
  const openCardFromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const card = id && cards.find((c) => c.id === id);
    if (!card) return;
    if (allBtn && !allBtn.classList.contains('is-active')) {
      filters.forEach((f) => f.classList.toggle('is-active', f === allBtn));
    }
    expanded = true;
    applyFilter(-1);
    card.classList.remove('reveal');
    card.classList.add('is-in');
    requestAnimationFrame(() => card.scrollIntoView({ block: 'start', behavior: 'auto' }));
  };
  window.addEventListener('load', () => { if (!restored) openCardFromHash(); });
  window.addEventListener('hashchange', openCardFromHash);

  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      expanded = !expanded;
      applyFilter(expanded ? FIRST : -1);
      if (!expanded && casesSection && casesSection.getBoundingClientRect().top < 0) {
        casesSection.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    });
  }

  /* плавающая плашка внизу: «фильтр: все · N» открывает шторку с тегами; рядом — «свернуть», пока раскрыт список */
  if (casesSection && filters.length) {
    const mqMobile = window.matchMedia('(max-width: 1023px)');
    const countFor = (tag) => cards.filter((c) => !tag || (c.dataset.tags || '').split(/\s+/).includes(tag)).length;

    // плашка
    const dock = document.createElement('div');
    dock.className = 'cases__dock';
    const dockFilter = document.createElement('button');
    dockFilter.type = 'button';
    dockFilter.className = 'cases__fbtn';
    dockFilter.setAttribute('aria-haspopup', 'dialog');
    dockFilter.setAttribute('aria-expanded', 'false');
    dockFilter.innerHTML = '<i class="cases__fdot"></i><span class="cases__flabel"></span>';
    dock.appendChild(dockFilter);
    let floatBtn = null;
    if (moreBtn) {
      floatBtn = document.createElement('button');
      floatBtn.type = 'button';
      floatBtn.className = 'cases__float';
      floatBtn.textContent = 'свернуть ↖';
      floatBtn.hidden = true;
      floatBtn.addEventListener('click', () => moreBtn.click());
      dock.appendChild(floatBtn);
    }
    document.body.appendChild(dock);

    // шторка (на телефоне — снизу, на десктопе — над плашкой)
    const dim = document.createElement('div');
    dim.className = 'fsheet__dim';
    const sheet = document.createElement('div');
    sheet.className = 'fsheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Фильтр проектов');
    sheet.innerHTML = '<h4 class="fsheet__h">показать проекты</h4><div class="fsheet__row"></div>';
    const row = sheet.querySelector('.fsheet__row');
    const items = filters.map((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pill fs-pill ' + [...f.classList].filter((c) => c.startsWith('pill--')).join(' ') + (f.dataset.filter === '' ? ' fs-pill--all' : '');
      b.innerHTML = f.innerHTML + '<em>' + countFor(f.dataset.filter) + '</em>';
      b.addEventListener('click', () => {
        f.click();
        setSheet(false);
        if (casesSection.getBoundingClientRect().top < 0) {
          casesSection.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      });
      row.appendChild(b);
      return { f, b };
    });
    document.body.append(dim, sheet);

    const root = document.documentElement;
    let sheetOpen = false;
    const setSheet = (open) => {
      sheetOpen = open;
      sheet.classList.toggle('is-open', open);
      dim.classList.toggle('is-open', open);
      dockFilter.setAttribute('aria-expanded', String(open));
      root.classList.toggle('fsheet-open', open && mqMobile.matches);
      if (open) { const cur = items.find((x) => x.f.classList.contains('is-active')); (cur ? cur.b : items[0].b).focus({ preventScroll: true }); }
      else if (document.activeElement && sheet.contains(document.activeElement)) dockFilter.focus({ preventScroll: true });
      syncDock();
    };
    dockFilter.addEventListener('click', () => setSheet(!sheetOpen));
    dim.addEventListener('click', () => setSheet(false));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetOpen) setSheet(false); });

    // подпись на плашке и состояние тегов в шторке — по текущему фильтру
    const dot = dockFilter.querySelector('.cases__fdot');
    const label = dockFilter.querySelector('.cases__flabel');
    const dockRefresh = () => {
      const act = filters.find((f) => f.classList.contains('is-active')) || allBtn;
      const tag = act ? act.dataset.filter : '';
      label.textContent = 'фильтр: ' + (tag || 'все') + ' · ' + countFor(tag);
      const pillCls = [...act.classList].find((c) => c.startsWith('pill--'));
      dot.className = 'cases__fdot' + (pillCls ? ' ' + pillCls : '');
      items.forEach(({ f, b }) => { const on = f === act; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    };
    window.__pfDockSync = dockRefresh;
    dockRefresh();

    // когда показывать
    let raf = 0;
    const syncDock = () => {
      raf = 0;
      const vh = window.innerHeight;
      const r = casesSection.getBoundingClientRect();
      const inView = r.top < vh * 0.45 && r.bottom > vh * 0.7;
      const fr = filters[0].parentElement.getBoundingClientRect();
      const rowVisible = !mqMobile.matches && fr.bottom > 70 && fr.top < vh - 70;
      const on = (inView && !rowVisible) || sheetOpen;
      dock.classList.toggle('is-on', on);
      dock.classList.toggle('is-covered', sheetOpen && mqMobile.matches);
      if (floatBtn) {
        const b = moreBtn.getBoundingClientRect();
        const btnVisible = !moreBtn.hidden && b.bottom > 0 && b.top < vh;
        const showCollapse = expanded && !moreBtn.hidden && r.top < vh * 0.35 && r.bottom > vh * 0.65 && !btnVisible;
        floatBtn.hidden = !showCollapse;
      }
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(syncDock); };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', () => { if (sheetOpen && !mqMobile.matches) root.classList.remove('fsheet-open'); queue(); });
    if (moreBtn) moreBtn.addEventListener('click', () => setTimeout(syncDock, 0));
    syncDock();
  }

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      const isAll = btn.dataset.filter === '';
      const turnOn = !btn.classList.contains('is-active') && !isAll;

      // выбор нового тега отключает предыдущий; повторный клик снимает выбор (показываются все кейсы)
      filters.forEach((f) => {
        f.classList.remove('is-active');
        f.setAttribute('aria-pressed', 'false');
      });
      // без выбранного тега активна кнопка «все»
      const on = turnOn ? btn : allBtn;
      on.classList.add('is-active');
      on.setAttribute('aria-pressed', 'true');

      expanded = false;
      applyFilter();
    });
  });

  applyFilter();

  /* ---------- возврат «назад» на то же место: запоминаем прокрутку, фильтр и «показать больше» ---------- */
  const STATE_KEY = 'pf-index-state';
  const saveState = () => {
    try {
      const active = filters.find((f) => f.classList.contains('is-active'));
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        y: Math.round(window.scrollY), exp: expanded, f: active ? active.dataset.filter : '',
      }));
    } catch (e) { /* хранилище недоступно */ }
  };
  window.addEventListener('pagehide', saveState);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveState(); });
  document.addEventListener('click', (e) => { if (e.target.closest('a[href]') || e.target.closest('.card')) saveState(); }, true);

  try {
    const nav = (performance.getEntriesByType('navigation')[0] || {}).type;
    let fromSite = false;
    try { const r = new URL(document.referrer); fromSite = r.origin === location.origin && !/(^|\/)(index\.html)?$/.test(r.pathname); } catch (e) { /* нет referrer */ }
    const raw = sessionStorage.getItem(STATE_KEY);
    if (raw && (nav === 'back_forward' || fromSite)) {
      const st = JSON.parse(raw);
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      const want = filters.find((f) => f.dataset.filter === st.f) || allBtn;
      filters.forEach((f) => { f.classList.toggle('is-active', f === want); f.setAttribute('aria-pressed', String(f === want)); });
      expanded = !!st.exp;
      applyFilter(-1);
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
      const go = () => window.scrollTo(0, st.y);
      go();
      requestAnimationFrame(go);
      window.addEventListener('load', () => { go(); setTimeout(go, 250); setTimeout(go, 700); });
      restored = true;
    }
  } catch (e) { /* ничего страшного */ }

  // клик в любом месте карточки открывает кейс
  cards.forEach((card) => {
    const link = card.querySelector('.card__go');
    if (!link) return;
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      window.location.href = link.href;
    });
  });

  /* ---------- почта: при нажатии адрес копируется (и открывается почтовая программа) ---------- */
  let toastTimer;
  const showToast = (text) => {
    const toast = document.querySelector('.toast');
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  };
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.append(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { /* ничего */ }
      ta.remove();
      return ok;
    }
  };
  // то же самое доступно мобильному меню (оно собирается в другом блоке)
  window.pfCopyMail = async (addr) => {
    const ok = await copyText(addr);
    showToast(ok ? `Почта скопирована: ${addr}` : `Моя почта: ${addr}`);
  };
  document.querySelectorAll('[data-copy]').forEach((a) => {
    a.addEventListener('click', async () => {
      const ok = await copyText(a.dataset.copy);
      showToast(ok ? `Почта скопирована: ${a.dataset.copy}` : `Моя почта: ${a.dataset.copy}`);
    });
  });

  /* ---------- лёгкая анимация ---------- */

  // порядковый номер плашек в шапке — для каскада при загрузке
  document.querySelectorAll('.hero__tags .pill').forEach((el, i) => el.style.setProperty('--i', i));

  // бегущая строка тегов на мобильной главной: вторая копия плашек для бесшовной петли (на десктопе скрыта)
  const heroTags = document.querySelector('.hero__tags');
  if (heroTags) {
    [...heroTags.children].forEach((li) => {
      const c = li.cloneNode(true);
      c.classList.add('is-clone');
      c.setAttribute('aria-hidden', 'true');
      heroTags.appendChild(c);
    });
    // запускаем бег, только когда шрифт загружен и ширина дорожки уже не изменится — иначе строка «прыгает»
    let started = false;
    const run = () => { if (!started) { started = true; heroTags.classList.add('is-run'); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run); else run();
    setTimeout(run, 2500);
  }

  // у украшений — своя задержка и скорость «плавания», чтобы не двигались синхронно
  document.querySelectorAll('.band').forEach((band) => {
    band.querySelectorAll('.deco').forEach((el, i) => {
      el.style.setProperty('--d', `${(i * 0.09).toFixed(2)}s`);
      el.style.setProperty('--dur', `${(6 + (i % 4) * 0.8).toFixed(1)}s`);
    });
  });

  const bands = Array.from(document.querySelectorAll('.band'));

  if (reduceMotion || !hasIO) {
    // без анимации просто показываем всё
    bands.forEach((b) => b.classList.add('is-in'));
    return;
  }

  // блоки, которые плавно «выезжают» при прокрутке
  const targets = Array.from(document.querySelectorAll(
    '.section-title, .filters, .card, .tile, .about__col, .about__photo, .tools, ' +
    '.exp-head, .exp-row, .contact'
  )).filter((el) => !el.closest('.hero'));

  // небольшой каскад для соседних элементов (карточки, плитки, контакты)
  const groups = new Map();
  targets.forEach((el) => {
    const parent = el.parentElement;
    const n = groups.get(parent) || 0;
    groups.set(parent, n + 1);
    el.style.setProperty('--d', `${Math.min(n, 5) * 0.08}s`);
    el.classList.add('reveal');
  });

  // после появления убираем служебные классы — чтобы они не мешали ховерам и sticky
  const settle = (el) => {
    const delay = (parseFloat(el.style.getPropertyValue('--d')) || 0) * 1000 + 900;
    window.setTimeout(() => el.classList.remove('reveal', 'is-in'), delay);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      io.unobserve(el);
      el.classList.add('is-in');
      if (!el.classList.contains('band')) settle(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

  bands.forEach((b) => io.observe(b));
  targets.forEach((el) => io.observe(el));

  // главная видна сразу
  const hero = document.querySelector('.hero');
  if (hero) hero.classList.add('is-in');
})();


/* «обо мне»: маленькие элементы в свободных местах справа от строк образования */
(function () {
  const frame = document.querySelector('.about .frame');
  if (!frame) return;
  const mq = window.matchMedia('(max-width: 1023px)');
  const decos = Array.from(frame.querySelectorAll('.deco--m'));
  decos.forEach((d) => { d.dataset.orig = d.getAttribute('style') || ''; });
  const RIGHT = [58, 16, 70, 40, 92, 20];
  const SIZE = [44, 52, 48, 44, 50, 46];
  const place = () => {
    const entries = Array.from(frame.querySelectorAll('.about__col--left .entry'));
    const pink = frame.querySelector('.about__h--pink');
    const anchors = [entries[0], pink, entries[2], entries[3], entries[4], entries[5]];
    const fr = frame.getBoundingClientRect();
    decos.forEach((d, k) => {
      const a = anchors[k];
      if (!mq.matches || !a) { d.setAttribute('style', d.dataset.orig); return; }
      const r = a.getBoundingClientRect();
      const top = r.top - fr.top + r.height / 2 - SIZE[k] / 2;
      d.style.cssText = d.dataset.orig + ';display:flex !important;inset:auto !important;left:auto !important;right:' + RIGHT[k] + 'px !important;top:' + top + 'px !important;width:' + SIZE[k] + 'px !important;height:' + SIZE[k] + 'px !important';
    });
  };
  place();
  window.addEventListener('load', place);
  window.addEventListener('resize', place);
  if ('ResizeObserver' in window) new ResizeObserver(place).observe(frame);

  /* ---------- шапка показывает, где мы: подсвечиваем пункт текущего раздела ---------- */
  const navLinks = Array.from(document.querySelectorAll('.topbar__nav a[href^="#"]'));
  const spy = navLinks
    .map((a) => ({ a, sec: document.getElementById(a.getAttribute('href').slice(1)) }))
    .filter((x) => x.sec);
  if (spy.length) {
    let spyRaf = 0;
    let edgeColor = '';
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const setActive = () => {
      spyRaf = 0;
      const bar = document.querySelector('.topbar');
      const probe = (bar ? bar.offsetHeight : 0) + window.innerHeight * 0.3;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let cur = spy[0];
      spy.forEach((x) => { if (x.sec.getBoundingClientRect().top <= probe) cur = x; });
      if (atEnd) cur = spy[spy.length - 1];
      const heroEl = document.getElementById('top');
      if (bar && heroEl) {
        // на телефоне шапка без фона: тёмная плашка «меню» появляется, как только страница сдвинулась
        const phone = window.innerWidth <= 600 && !!document.querySelector('.topbar__menu');
        bar.classList.toggle('is-pill', phone ? window.scrollY > 8 : heroEl.getBoundingClientRect().bottom <= bar.offsetHeight);
      }
      // цвет под верхней кромкой экрана: iOS Safari красит «лоб» браузера цветом фона страницы (body) —
      // пусть он совпадает с разделом, который сейчас под ним
      const secs = document.querySelectorAll('main > .band');
      for (const sec of secs) {
        const r = sec.getBoundingClientRect();
        if (r.top <= 2 && r.bottom > 2) {
          const bg = getComputedStyle(sec).backgroundColor;
          if (bg && bg !== edgeColor && bg !== 'rgba(0, 0, 0, 0)') {
            edgeColor = bg;
            document.documentElement.style.backgroundColor = bg;
            document.body.style.backgroundColor = bg;
            if (themeMeta) themeMeta.setAttribute('content', bg);
          }
          break;
        }
      }
      spy.forEach((x) => {
        const on = x === cur;
        x.a.classList.toggle('is-current', on);
        if (on) x.a.setAttribute('aria-current', 'true'); else x.a.removeAttribute('aria-current');
      });
    };
    const queueSpy = () => { if (!spyRaf) spyRaf = requestAnimationFrame(setActive); };
    window.addEventListener('scroll', queueSpy, { passive: true });
    window.addEventListener('resize', queueSpy);
    window.addEventListener('load', setActive);
    setActive();
  }

  /* ---------- мобильное меню: «меню ⋮» открывает экран со списком разделов ---------- */
  const menuBtn = document.querySelector('.topbar__menu');
  if (menuBtn && navLinks.length) {
    const allLinks = Array.from(document.querySelectorAll('.topbar__nav a'));
    const menu = document.createElement('div');
    menu.className = 'mmenu';
    menu.id = 'mmenu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Меню');
    menu.innerHTML = '<div class="mmenu__bar"><button type="button" class="mmenu__close"><span>закрыть</span><i class="x" aria-hidden="true"></i></button></div><ul class="mmenu__list"></ul>';
    const list = menu.querySelector('.mmenu__list');
    allLinks.forEach((a, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--k', i);
      const c = a.cloneNode(true);
      c.removeAttribute('aria-current');
      c.classList.remove('is-current');
      li.appendChild(c);
      list.appendChild(li);
    });
    // связь: тг, вк и почта (почта копируется при нажатии, как в «связи» ниже)
    const soc = document.createElement('div');
    soc.className = 'mmenu__soc';
    soc.innerHTML =
      '<a href="https://t.me/acva_acva" target="_blank" rel="noopener" aria-label="Telegram"><img src="assets/contact-section/telegram-contact-logo.svg" alt=""></a>' +
      '<a href="https://vk.ru/acva.acva" target="_blank" rel="noopener" aria-label="ВКонтакте"><img src="assets/contact-section/vk-contact-logo.svg" alt=""></a>' +
      '<a href="mailto:mikh.so@mail.ru" data-copy="mikh.so@mail.ru" aria-label="Почта: mikh.so@mail.ru (адрес скопируется при нажатии)"><img src="assets/contact-section/email-contact-icon.svg" alt=""></a>';
    soc.querySelector('[data-copy]').addEventListener('click', (e) => {
      if (window.pfCopyMail) window.pfCopyMail(e.currentTarget.dataset.copy);
    });
    menu.appendChild(soc);
    document.body.appendChild(menu);
    const closeBtn = menu.querySelector('.mmenu__close');
    const root = document.documentElement;
    const setOpen = (open) => {
      if (open) {
        // подсветка текущего раздела — как в шапке
        allLinks.forEach((a, i) => list.children[i].firstChild.classList.toggle('is-current', a.classList.contains('is-current')));
      }
      menu.classList.toggle('is-open', open);
      root.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      (open ? closeBtn : menuBtn).focus({ preventScroll: true });
    };
    menuBtn.addEventListener('click', () => setOpen(true));
    closeBtn.addEventListener('click', () => setOpen(false));
    list.addEventListener('click', (e) => {
      if (e.target.closest('a')) { menu.classList.remove('is-open'); root.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded', 'false'); }
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 600 && menu.classList.contains('is-open')) setOpen(false); });
  }
})();
