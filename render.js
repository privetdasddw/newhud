/* DOM renderer. Every field has one updater; only changed fields run. */
(function () {
  const S = window.HUDState;
  const $ = (id) => document.getElementById(id);

  const GEAR_ORDER = ['P', 'R', 'N', 'D', 'S'];

  let hud, micwrap, beltpair, fuelrow;

  function setTxt(el, v) {
    if (el && el.textContent !== v) el.textContent = v;
  }

  function setIcon(el, name) {
    if (!el) return;
    const svg = window.HUDIcons[name];
    if (svg && el.dataset.icon !== name) {
      el.innerHTML = svg;
      el.dataset.icon = name;
    }
  }

  let fuelPlaced = false;

  function updateDelta() {
    const el = $('delta');
    if (!el) return;
    const box = $('limitbox');
    const hasLimit = S.limit > 0;
    const over = hasLimit && S.speed > S.limit;
    el.textContent = over ? '+' + (S.speed - S.limit) : '';
    if (box) box.classList.toggle('over', over);
  }

  function updateRadio() {
    const label = $('radiolabel');
    if (!label) return;
    /* Точка-статус уже несёт смысл «радио», поэтому текст — только канал
       (или RDO в тишине): без дублирующего «RDO ·». */
    const ch = S.radioChannel || 0;
    const text = ch > 0 ? 'CH-' + ch : 'RDO';
    if (label.textContent !== text) label.textContent = text;
    const g = $('radio');
    if (g) g.classList.toggle('live', !!S.radioTalking);
  }

  const renderers = {
    visible(v) { hud.classList.toggle('hidden', !v); },

    drive(v) { hud.classList.toggle('veh', !!v); },

    time(v) { setTxt($('time'), v); },

    /* Ночью — луна, днём — часы (солнце занято погодным чипом). */
    night(v) { setIcon($('dayicon'), v ? 'moon' : 'clock'); },

    weather(v) {
      /* Map Lua weather key to icon name. Keys: sun, cloud, fog, rain, thunder, snow. */
      const icon = v || 'cloud';
      setIcon($('wxicon'), icon);
    },

    temperature(v) { setTxt($('temp'), v); },

    street(v) { setTxt($('street'), v); },

    postal(v) { setTxt($('postal'), v || ''); },

    direction(v) { setTxt($('compass'), v); },

    unit(v) { setTxt($('unit'), v); },

    speed(v) {
      /* Гашёные ведущие нули: «041» → [0]41. Ширина строки стабильна
         (3 табличных цифры), но читается значение как 41. «000» гасит
         первые две цифры — на стоянке кластер показывает чистый 0. */
      const el = $('speed');
      if (el) {
        const s = String(Math.max(0, Math.min(999, Math.round(v)))).padStart(3, '0');
        if (el.dataset.v !== s) {
          el.dataset.v = s;
          const cut = s.search(/[1-9]/);
          const lead = cut === -1 ? 2 : cut;
          el.innerHTML = lead > 0
            ? '<span class="dz">' + s.slice(0, lead) + '</span>' + s.slice(lead)
            : s;
        }
      }
      updateDelta();
    },

    /* Строка селектора PRNDS: активная буква подсвечена классом .on
       (R/S в активе — акцентные через CSS). Неизвестное значение —
       D, как раньше. */
    gear(v) {
      const strip = $('gearstrip');
      if (!strip) return;
      const val = GEAR_ORDER.indexOf(v) >= 0 ? v : 'D';
      const kids = strip.children;
      for (let i = 0; i < kids.length; i++) {
        kids[i].classList.toggle('on', kids[i].dataset.g === val);
      }
    },

    fuel(v) {
      const bar = $('fuelbar');
      if (bar) {
        /* Первое значение выставляется без перехода: иначе шкала едет
           от нуля, а если кадр снят до конца анимации — выглядит пустой. */
        if (!fuelPlaced) bar.style.transition = 'none';
        bar.style.width = Math.max(0, Math.min(100, v)) + '%';
        if (!fuelPlaced) {
          void bar.offsetWidth;
          bar.style.transition = '';
          fuelPlaced = true;
        }
      }
      setTxt($('fuel'), v + '%');
      if (fuelrow) fuelrow.classList.toggle('low', v <= S.lowFuel);
    },

    delta() { updateDelta(); },

    limit(v) {
      setTxt($('limit'), v > 0 ? String(v) : '');
      const wrap = $('limitwrap');
      if (wrap) wrap.classList.toggle('hide', !(v > 0));
      updateDelta();
    },

    /* Круиз-контроль полностью убран из интерфейса.
       Statebag и поле состояния сохранены для совместимости с Lua,
       но UI его игнорирует. */
    cruise() {},

    seatbelt(v) {
      if (!beltpair) return;
      const unknown = v === null || v === undefined;
      beltpair.classList.toggle('nodata', unknown);
      if (!unknown) beltpair.classList.toggle('warn', v !== true);
    },

    mic(v) {
      if (!micwrap) return;
      micwrap.classList.toggle('talking', v === 'talking');
      micwrap.classList.toggle('off', v === 'off');
    },

    radioChannel() { updateRadio(); },
    radioTalking() { updateRadio(); }
  };

  let first = true;

  window.HUD = {
    init() {
      hud = $('hud');
      micwrap = $('micwrap');
      beltpair = $('beltpair');
      fuelrow = $('fuelrow');
      first = true;  /* reset so the next apply() processes all fields */

      document.querySelectorAll('[data-icon]').forEach((el) => {
        const svg = window.HUDIcons[el.dataset.icon];
        if (svg) el.innerHTML = svg;
      });

      /* Пока данных ремня нет — элемент скрыт. */
      if (beltpair) beltpair.classList.add('nodata');

      updateRadio();
    },

    apply(data) {
      for (const key in data) {
        const fn = renderers[key];
        if (!fn) continue;
        if (!first && S[key] === data[key]) continue;
        S[key] = data[key];
        fn(data[key]);
      }
      first = false;
    },

    config(data) {
      if (!data) return;
      const root = document.documentElement.style;

      if (typeof data.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.accent)) {
        root.setProperty('--acc', data.accent);
      }

      if (typeof data.lowFuel === 'number') S.lowFuel = data.lowFuel;

      if (data.radar) {
        if (typeof data.radar.cx === 'number') root.setProperty('--radar-cx', data.radar.cx + 'vh');
        if (typeof data.radar.cy === 'number') root.setProperty('--radar-cy', data.radar.cy + 'vh');
        if (typeof data.radar.r === 'number') root.setProperty('--radar-r', data.radar.r + 'vh');
      }
    }
  };
})();
