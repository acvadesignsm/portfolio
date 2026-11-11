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

  /* ---------- мобильные «стикеры» между карточками кейсов ---------- */
  if (frame) {
    const IMGS = ['05-blue', '06-orange', '14-lime', '02-pink', '10-lilac', '11-cyan', '17-orange', '20-lilac'];
    const SIZES = [64, 72, 60, 70, 62, 74];
    const XS = [0.12, 0.7, 0.38, 0.82, 0.2, 0.55];
    const gaps = [];
    for (let i = 0; i < 60; i += 1) {
      const d = document.createElement('span');
      d.className = 'deco deco--gap';
      d.setAttribute('aria-hidden', 'true');
      d.innerHTML = '<img alt="" src="assets/projects-section/projects-section-deco/expanded/cases-decoration-' + IMGS[i % IMGS.length] + '.svg">';
      frame.appendChild(d);
      gaps.push(d);
    }
    const mq = window.matchMedia('(max-width: 1023px)');
    const origs = Array.from(frame.querySelectorAll('.deco:not(.deco--gap)')).filter((d) => !d.dataset.clone).slice(0, 25);
    origs.forEach((d) => { d.dataset.orig = d.getAttribute('style') || ''; });
    const place = () => {
      const vis = cards.filter((c) => !c.hidden);
      const fr = frame.getBoundingClientRect();
      /* стикеры в промежутках между карточками: по одному, наполовину прячутся за карточками */
      gaps.forEach((d, i) => {
        const g = i >> 1;
        const a = vis[g], b = vis[g + 1];
        if (i & 1 || !mq.matches || !a || !b) { d.style.setProperty('display', 'none', 'important'); return; }
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const size = SIZES[g % SIZES.length];
        const mid = (ra.bottom + rb.top) / 2 - fr.top;
        const x = 14 + (fr.width - 28 - size) * XS[g % XS.length];
        d.style.setProperty('display', 'flex', 'important');
        d.style.setProperty('inset', 'auto', 'important');
        d.style.setProperty('left', x + 'px', 'important');
        d.style.setProperty('top', (mid - size / 2) + 'px', 'important');
        d.style.setProperty('width', size + 'px', 'important');
        d.style.setProperty('height', size + 'px', 'important');
      });
      /* боковые элементы: по одному у каждой видимой карточки, стороны чередуются */
      origs.forEach((d, k) => {
        if (!mq.matches) { d.setAttribute('style', d.dataset.orig); return; }
        const c = vis[k];
        if (!c) { d.style.cssText = d.dataset.orig + ';display:none !important'; return; }
        const rc = c.getBoundingClientRect();
        const size = 84;
        const top = rc.top - fr.top + rc.height * 0.4 - size / 2;
        const side = k % 2 ? 'left:calc(100% - 30px)' : 'right:calc(100% - 30px)';
        d.style.cssText = d.dataset.orig + ';display:flex !important;inset:auto !important;' + side + ' !important;top:' + top + 'px !important;width:' + size + 'px !important;height:' + size + 'px !important';
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

  /* «свернуть» на полупрозрачной плашке: плавает внизу, пока листаешь раскрытый список кейсов */
  if (moreBtn && casesSection) {
    const floatBtn = document.createElement('button');
    floatBtn.type = 'button';
    floatBtn.className = 'cases__float';
    floatBtn.textContent = 'свернуть ↖';
    floatBtn.hidden = true;
    floatBtn.addEventListener('click', () => moreBtn.click());
    document.body.appendChild(floatBtn);
    let raf = 0;
    const syncFloat = () => {
      raf = 0;
      const vh = window.innerHeight;
      const r = casesSection.getBoundingClientRect();
      const b = moreBtn.getBoundingClientRect();
      const btnVisible = !moreBtn.hidden && b.bottom > 0 && b.top < vh;
      const show = expanded && !moreBtn.hidden && r.top < vh * 0.35 && r.bottom > vh * 0.65 && !btnVisible;
      floatBtn.classList.toggle('is-on', show);
      if (show) floatBtn.hidden = false;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(syncFloat); };
    floatBtn.addEventListener('transitionend', () => { if (!floatBtn.classList.contains('is-on')) floatBtn.hidden = true; });
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    moreBtn.addEventListener('click', () => setTimeout(syncFloat, 0));
    syncFloat();
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
  document.querySelectorAll('[data-copy]').forEach((a) => {
    a.addEventListener('click', async () => {
      const ok = await copyText(a.dataset.copy);
      showToast(ok ? `Почта скопирована: ${a.dataset.copy}` : `Моя почта: ${a.dataset.copy}`);
    });
  });

  /* ---------- лёгкая анимация ---------- */

  // порядковый номер плашек в шапке — для каскада при загрузке
  document.querySelectorAll('.hero__tags .pill').forEach((el, i) => el.style.setProperty('--i', i));

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
    const setActive = () => {
      spyRaf = 0;
      const bar = document.querySelector('.topbar');
      const probe = (bar ? bar.offsetHeight : 0) + window.innerHeight * 0.3;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let cur = spy[0];
      spy.forEach((x) => { if (x.sec.getBoundingClientRect().top <= probe) cur = x; });
      if (atEnd) cur = spy[spy.length - 1];
      const heroEl = document.getElementById('top');
      if (bar && heroEl) bar.classList.toggle('is-pill', heroEl.getBoundingClientRect().bottom <= bar.offsetHeight);
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
})();
