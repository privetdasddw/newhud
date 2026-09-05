/* DOM renderer. Каждое поле NUI-контракта имеет ровно один апдейтер;
   выполняются только реально изменившиеся поля.

   Контракт Lua не менялся: приходят все прежние поля. Поля, которых
   нет в этой композиции (time, night, limit, delta, cruise, seatbelt,
   radioChannel, radioTalking), принимаются и игнорируются — блоков
   под них в HUD нет намеренно. */
(function () {
  const S = window.HUDState;
  const $ = (id) => document.getElementById(id);

  const GEAR_ORDER = ['P', 'R', 'N', 'D', 'S'];

  let hud, micwrap, fuelrow, speedEl;
  let fuelPlaced = false;

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

  const noop = function () {};

  const renderers = {
    visible(v) { hud.classList.toggle('hidden', !v); },

    /* Кластер живёт только за рулём (opacity, место держится). */
    drive(v) { hud.classList.toggle('veh', !!v); },

    weather(v) { setIcon($('wxicon'), v || 'cloud'); },

    temperature(v) { setTxt($('temp'), v || '--°'); },

    street(v) { setTxt($('street'), v || '...'); },

    postal(v) { setTxt($('postal'), v || '----'); },

    direction(v) { setTxt($('compass'), v || '?'); },

    unit(v) { setTxt($('unit'), v || ''); },

    /* Скорость эталона: три знака с ведущими нулями, все белые.
       UI ничего не додумывает — значение приходит из Lua. */
    speed(v) {
      if (!speedEl) return;
      const n = Math.max(0, Math.round(Number(v) || 0));
      const s = String(n).padStart(3, '0');
      setTxt(speedEl, s);
      speedEl.classList.toggle('wide', s.length > 3);
    },

    /* Селектор PRNDS: активная буква белая, R и S в активе акцентные. */
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
      const pct = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
      const bar = $('fuelbar');
      if (bar) {
        /* Первое значение — без перехода: иначе шкала едет от нуля. */
        if (!fuelPlaced) bar.style.transition = 'none';
        bar.style.width = pct + '%';
        if (!fuelPlaced) {
          void bar.offsetWidth;
          bar.style.transition = '';
          fuelPlaced = true;
        }
      }
      setTxt($('fuel'), pct + '%');
      if (fuelrow) fuelrow.classList.toggle('low', pct <= S.lowFuel);
    },

    /* МИКРОФОН: off — приглушён и перечёркнут, idle — монохромный чип,
       talking — зелёный чип с расходящимися кругами. */
    mic(v) {
      if (!micwrap) return;
      micwrap.classList.toggle('talking', v === 'talking');
      micwrap.classList.toggle('off', v === 'off');
    },

    /* Поля контракта без блока в этой композиции. */
    time: noop,
    night: noop,
    limit: noop,
    delta: noop,
    cruise: noop,
    seatbelt: noop,
    radioChannel: noop,
    radioTalking: noop
  };

  let first = true;

  window.HUD = {
    init() {
      hud = $('hud');
      micwrap = $('micwrap');
      fuelrow = $('fuelrow');
      speedEl = $('speed');
      first = true;   /* следующий apply() прогонит все поля заново */
      fuelPlaced = false;

      document.querySelectorAll('[data-icon]').forEach((el) => {
        const svg = window.HUDIcons[el.dataset.icon];
        if (svg) el.innerHTML = svg;
      });
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

      /* Цвет волн микрофона: сам круг + мягкое свечение чипа. */
      if (typeof data.micColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(data.micColor)) {
        const hex = data.micColor;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        root.setProperty('--mic', hex);
        root.setProperty('--mic-soft', 'rgba(' + r + ', ' + g + ', ' + b + ', .28)');
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
