/* Мини-игра «Доделай кейс»: открывается по клику на карточку «пока оформляю». */
(() => {
  'use strict';

  const triggers = Array.from(document.querySelectorAll('.card')).filter((c) => c.querySelector('.badge'));
  if (!triggers.length || typeof HTMLDialogElement !== 'function') return;

  const W = 360, H = 520;                       // логические размеры поля
  const COLORS = ['#d4ff34', '#ff5b23', '#afe5ed', '#3a38f5', '#dcb8ff', '#ff4269'];

  /* пиксельные картинки: 1 — закрашено */
  const SPRITES = {
    star:   ['0001000', '0001000', '0011100', '1111111', '0011100', '0001000', '0001000'],
    heart:  ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'],
    flower: ['0011100', '0111110', '1101011', '1110111', '1101011', '0111110', '0011100'],
    gem:    ['0001000', '0011100', '0111110', '1111111', '0111110', '0011100', '0001000'],
    bug:    ['1001001', '0100010', '0011100', '1111111', '0111110', '1111111', '1001001'],
  };
  const GOOD = ['star', 'heart', 'flower', 'gem'];

  let dlg, canvas, ctx, ui, raf = 0, last = 0, state = 'idle';
  let items, particles, progress, lives, spawnT, elapsed, player, keys = {};

  const build = () => {
    dlg = document.createElement('dialog');
    dlg.className = 'game';
    dlg.setAttribute('aria-label', 'Мини-игра: доделай кейс');
    dlg.innerHTML =
      '<div class="game__box">' +
        '<div class="game__hud">' +
          '<div class="game__bar" role="progressbar" aria-label="Кейс оформлен" aria-valuemin="0" aria-valuemax="100"><i></i></div>' +
          '<span class="game__pct">0%</span>' +
          '<span class="game__lives" aria-label="Жизни"></span>' +
          '<button type="button" class="game__close" aria-label="Закрыть"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>' +
        '</div>' +
        '<canvas class="game__canvas" aria-label="Игровое поле"></canvas>' +
        '<div class="game__screen" data-screen>' +
          '<div class="game__art" hidden></div>' +
          '<h3 class="game__title"></h3>' +
          '<p class="game__text"></p>' +
          '<div class="game__actions">' +
            '<button type="button" class="game__btn"></button>' +
            '<button type="button" class="game__btn game__btn--ghost"></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.append(dlg);
    canvas = dlg.querySelector('canvas');
    ctx = canvas.getContext('2d');
    ui = {
      bar: dlg.querySelector('.game__bar i'),
      barWrap: dlg.querySelector('.game__bar'),
      pct: dlg.querySelector('.game__pct'),
      lives: dlg.querySelector('.game__lives'),
      screen: dlg.querySelector('.game__screen'),
      art: dlg.querySelector('.game__art'),
      title: dlg.querySelector('.game__title'),
      text: dlg.querySelector('.game__text'),
      btn: dlg.querySelector('.game__btn'),
      btn2: dlg.querySelector('.game__btn--ghost'),
    };

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const k = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * k);
      canvas.height = Math.round(H * k);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.imageSmoothingEnabled = false;
      return r;
    };
    fit();

    dlg.querySelector('.game__close').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => { stop(); document.documentElement.style.overflow = ''; });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    ui.btn.addEventListener('click', () => { if (ui.btn.dataset.act === 'close') dlg.close(); else start(); });
    ui.btn2.addEventListener('click', () => { if (ui.btn2.dataset.act === 'close') dlg.close(); else start(); });

    // управление: мышь / палец — тянем карточку, стрелки / A D — двигаем
    const moveTo = (clientX) => {
      const r = canvas.getBoundingClientRect();
      player.x = ((clientX - r.left) / r.width) * W - player.w / 2;
      clampPlayer();
    };
    canvas.addEventListener('pointermove', (e) => { if (state === 'play') moveTo(e.clientX); });
    canvas.addEventListener('pointerdown', (e) => { if (state === 'play') moveTo(e.clientX); });
    window.addEventListener('keydown', (e) => { if (dlg.open) keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  };

  const clampPlayer = () => { player.x = Math.max(0, Math.min(W - player.w, player.x)); };


  /* пиксельная картинка из строк в SVG: цифра — ключ цвета, 0 — пусто */
  const pixSvg = (rows, colors, cell) => {
    let r = '';
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (colors[ch]) r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + colors[ch] + '"/>';
    }));
    return '<svg viewBox="0 0 ' + rows[0].length + ' ' + rows.length + '" width="' + rows[0].length * cell +
      '" height="' + rows.length * cell + '" shape-rendering="crispEdges" aria-hidden="true">' + r + '</svg>';
  };
  const HEART_HUD = ['011000110', '111101111', '111111111', '111111111', '011111110', '001111100', '000111000', '000010000'];
  const FACE_HAPPY = ['00111111100', '01111111110', '11111111111', '11221112211', '11221112211', '11111111111', '12111111121', '11222222211', '01111111110', '00111111100'];
  const FACE_SAD = ['00111111100', '01111111110', '11111111111', '11221112211', '11221112211', '11311111111', '11322222111', '11211111211', '01111111110', '00111111100'];
  const CONFETTI = ['#d4ff34', '#ff4269', '#afe5ed', '#dcb8ff', '#ff5b23'];

  const setArt = (kind) => {
    const a = ui.art;
    if (!kind) { a.hidden = true; a.innerHTML = ''; return; }
    const win = kind === 'win';
    let h = pixSvg(win ? FACE_HAPPY : FACE_SAD,
      { 1: win ? '#d4ff34' : '#dcb8ff', 2: '#1a1a1a', 3: '#afe5ed' }, 8);
    if (win) {
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 1 : -1, d = 70 + (i * 23) % 90, y = ((i * 29) % 90) - 45;
        h += '<i class="game__conf" style="--x:' + side * d + 'px;--y:' + y + 'px;--d:' + (i * 40) + 'ms;background:' + CONFETTI[i % 5] + '"></i>';
      }
    }
    a.innerHTML = h; a.className = 'game__art game__art--' + kind; a.hidden = false;
  };

  /* заголовок всегда в одну строку: при необходимости уменьшаем шрифт */
  const fitTitle = () => {
    const t = ui.title; let s = 26; t.style.fontSize = s + 'px';
    while (t.scrollWidth > t.clientWidth && s > 14) { s -= 1; t.style.fontSize = s + 'px'; }
  };

  /* предлоги, союзы и короткие слова не остаются в конце строки; тире не отрывается от слова */
  document.addEventListener('keydown', (e) => { if (e.key === 'Tab') document.documentElement.classList.add('kbd'); });
  document.addEventListener('pointerdown', () => document.documentElement.classList.remove('kbd'));

  const nb = (s) => s
    .replace(/(^|[\s\u00a0])([А-Яа-яЁё]{1,3})\s+/g, '$1$2\u00a0')
    .replace(/\s+—/g, '\u00a0—');

  const showScreen = (title, text, btn, btn2, art) => {
    setArt(art);
    ui.title.textContent = nb(title);
    ui.text.textContent = nb(text);
    ui.btn.textContent = btn[0]; ui.btn.dataset.act = btn[1];
    ui.btn2.hidden = !btn2;
    if (btn2) { ui.btn2.textContent = btn2[0]; ui.btn2.dataset.act = btn2[1]; }
    ui.screen.classList.remove('is-pop'); void ui.screen.offsetWidth; ui.screen.classList.add('is-pop');
    ui.screen.hidden = false;
    fitTitle();
    ui.btn.focus({ preventScroll: true });
  };

  const renderHud = () => {
    const p = Math.round(progress);
    ui.bar.style.width = p + '%';
    ui.pct.textContent = p + '%';
    ui.barWrap.setAttribute('aria-valuenow', String(p));
    ui.lives.innerHTML = [0, 1, 2].map((i) => pixSvg(HEART_HUD, { 1: i < lives ? '#ff4269' : '#4a4a4a' }, 2)).join('');
  };

  function start() {
    items = []; particles = [];
    progress = 0; lives = 3; spawnT = 0; elapsed = 0;
    player = { w: 84, h: 22, x: W / 2 - 42, y: H - 44 };
    keys = {};
    ui.screen.hidden = true;
    renderHud();
    state = 'play';
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function stop() { state = 'idle'; cancelAnimationFrame(raf); }

  const spawn = () => {
    const bug = Math.random() < 0.22 + Math.min(0.15, progress / 600);
    const kind = bug ? 'bug' : GOOD[(Math.random() * GOOD.length) | 0];
    const px = 4 + ((Math.random() * 2) | 0);          // размер «пикселя»
    const w = 7 * px;
    items.push({
      kind, bug, px, w, h: SPRITES[kind].length * px,
      x: Math.random() * (W - w), y: -w,
      vy: 90 + progress * 1.4 + Math.random() * 50,
      color: bug ? '#8b8b8b' : COLORS[(Math.random() * COLORS.length) | 0],
    });
  };

  const burst = (x, y, color) => {
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      particles.push({ x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 30, life: 0.45, color });
    }
  };

  const drawSprite = (name, x, y, px, color) => {
    ctx.fillStyle = color;
    SPRITES[name].forEach((row, j) => {
      for (let i = 0; i < row.length; i += 1) {
        if (row[i] === '1') ctx.fillRect(Math.round(x + i * px), Math.round(y + j * px), px, px);
      }
    });
  };

  const draw = () => {
    ctx.fillStyle = '#191919';
    ctx.fillRect(0, 0, W, H);

    // фон: тихая сетка из пикселей
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let gx = 20; gx < W; gx += 40) for (let gy = 20; gy < H; gy += 40) ctx.fillRect(gx, gy, 2, 2);

    items.forEach((it) => {
      drawSprite(it.kind, it.x, it.y, it.px, it.color);
      if (it.bug) { ctx.fillStyle = '#ff4269'; ctx.fillRect(Math.round(it.x + 3 * it.px), Math.round(it.y + 3 * it.px), it.px, it.px); }
    });

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / 0.45);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 4, 4);
    });
    ctx.globalAlpha = 1;

    if (player) {
      // карточка кейса
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath(); ctx.roundRect(player.x, player.y, player.w, player.h, 8); ctx.fill();
      ctx.strokeStyle = '#d4ff34'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(player.x + 1, player.y + 1, player.w - 2, player.h - 2, 7); ctx.stroke();
      ctx.fillStyle = '#d4ff34';
      ctx.fillRect(player.x + 10, player.y + 8, 22, 6);
      ctx.fillStyle = '#6b6b6b';
      ctx.fillRect(player.x + 38, player.y + 8, 36, 6);
    }
  };

  function loop(now) {
    if (state !== 'play') return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;

    const sp = 260;
    if (keys.arrowleft || keys.a || keys['ф']) player.x -= sp * dt;
    if (keys.arrowright || keys.d || keys['в']) player.x += sp * dt;
    clampPlayer();

    spawnT -= dt;
    if (spawnT <= 0) { spawn(); spawnT = Math.max(0.35, 0.8 - progress / 220); }

    for (let i = items.length - 1; i >= 0; i -= 1) {
      const it = items[i];
      it.y += it.vy * dt;
      const hit = it.y + it.h >= player.y && it.y <= player.y + player.h &&
                  it.x + it.w >= player.x && it.x <= player.x + player.w;
      if (hit) {
        burst(it.x + it.w / 2, it.y + it.h / 2, it.bug ? '#ff4269' : it.color);
        if (it.bug) { lives -= 1; } else { progress = Math.min(100, progress + 8); }
        items.splice(i, 1);
        renderHud();
      } else if (it.y > H) {
        items.splice(i, 1);
      }
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    draw();

    if (progress >= 100) {
      state = 'win';
      showScreen('кейс готов. но есть нюанс', 'Игра пройдена, а настоящий кейс ещё в разработке. Скоро он появится здесь', ['← все проекты', 'close'], ['↻ сыграть ещё раз', 'play'], 'win');
      return;
    }
    if (lives <= 0) {
      state = 'lose';
      showScreen('победили баги', 'Кейс оформлен на ' + Math.round(progress) + '%. Лови пиксели, баги обходи', ['↻ попробовать снова', 'play'], ['← все проекты', 'close'], 'lose');
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  const open = () => {
    if (!dlg) build();
    document.documentElement.style.overflow = 'hidden';
    dlg.showModal();
    items = []; particles = []; progress = 0; lives = 3;
    player = { w: 84, h: 22, x: W / 2 - 42, y: H - 44 };
    renderHud();
    draw();
    state = 'idle';
    showScreen('доделай кейс', 'Лови пиксели — так оформляется кейс. Баги обходи. Двигай карточку мышью, пальцем или стрелками', ['начать', 'play'], ['← все проекты', 'close']);
  };

  /* подсказка у курсора при наведении на карточку */
  const tip = document.createElement('div');
  tip.className = 'game-tip';
  tip.setAttribute('role', 'tooltip');
  tip.textContent = 'Упс, пока\u00a0нельзя посмотреть, но\u00a0можешь поиграть';
  tip.hidden = true;
  document.body.append(tip);
  const placeTip = (e) => {
    const w = tip.offsetWidth;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX - w / 2));
    tip.style.left = x + 'px';
    tip.style.top = Math.max(8, e.clientY - tip.offsetHeight - 14) + 'px';
  };

  triggers.forEach((card) => {
    card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { tip.hidden = false; placeTip(e); } });
    card.addEventListener('pointermove', (e) => { if (!tip.hidden) placeTip(e); });
    card.addEventListener('pointerleave', () => { tip.hidden = true; });
    card.addEventListener('click', () => { tip.hidden = true; });
    card.addEventListener('focus', () => {
      const r = card.getBoundingClientRect();
      tip.hidden = false;
      placeTip({ clientX: r.left + r.width / 2, clientY: r.top + 40 });
    });
    card.addEventListener('blur', () => { tip.hidden = true; });

    card.classList.add('card--game');
    card.addEventListener('click', (e) => { if (e.target.closest('a')) return; open(); });
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); open(); }
    });
  });
})();
