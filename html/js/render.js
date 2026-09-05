/* DOM renderer. Каждое поле NUI-контракта имеет ровно один апдейтер;
   выполняются только реально изменившиеся поля.

   Контракт Lua не менялся. Поля, которым нет блока в композиции
   (night, limit, delta, cruise, seatbelt), принимаются и игнорируются. */
(function () {
  const S = window.HUDState;
  const $ = (id) => document.getElementById(id);

  const GEAR_ORDER = ['P', 'R', 'N', 'D', 'S'];

  let hud, micwrap, fuelrow, speedEl, radioChip;
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

  /* Адрес одной строкой: «7285, Los Santos Freeway». Пока нет одной из
     половин — показываем ту, что есть, без висячей запятой. */
  function updateAddress() {
    const postal = S.postal ? String(S.postal) : '';
    const street = S.street ? String(S.street) : '';
    let text = postal && street ? postal + ', ' + street : (postal || street);
    if (!text) text = '...';
    setTxt($('street'), text);
  }

  /* Радиоканал — маленький чип слева сверху: без канала его нет
     вовсе, в эфире цифра зеленеет. */
  function updateRadio() {
    if (!radioChip) return;
    const ch = Number(S.radioChannel) || 0;
    radioChip.classList.toggle('hide', !(ch > 0));
    radioChip.classList.toggle('live', !!S.radioTalking && ch > 0);
    if (ch > 0) setTxt($('radiolabel'), String(ch));
  }

  const noop = function () {};

  const renderers = {
    visible(v) { hud.classList.toggle('hidden', !v); },

    /* Кластер живёт только за рулём (opacity, место держится). */
    drive(v) { hud.classList.toggle('veh', !!v); },

    time(v) { setTxt($('time'), v || '--:--'); },

    weather(v) { setIcon($('wxicon'), v || 'cloud'); },

    temperature(v) { setTxt($('temp'), v || '--°'); },

    street() { updateAddress(); },
    postal() { updateAddress(); },

    direction(v) { setTxt($('compass'), v || '?'); },

    unit(v) { setTxt($('unit'), v || ''); },

    /* Скорость: три знака с ведущими нулями, все белые — как на
       референсе. UI ничего не додумывает, значение идёт из Lua. */
    speed(v) {
      if (!speedEl) return;
      const n = Math.max(0, Math.round(Number(v) || 0));
      setTxt(speedEl, String(n).padStart(3, '0'));
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

    /* МИКРОФОН: off — приглушён и перечёркнут, idle — тихие серые
       линии, talking — зелёные круговые линии одна за другой. */
    mic(v) {
      if (!micwrap) return;
      micwrap.classList.toggle('talking', v === 'talking');
      micwrap.classList.toggle('off', v === 'off');
    },

    radioChannel() { updateRadio(); },
    radioTalking() { updateRadio(); },

    /* Поля контракта без блока в этой композиции. */
    night: noop,
    limit: noop,
    delta: noop,
    cruise: noop,
    seatbelt: noop
  };

  let first = true;

  window.HUD = {
    init() {
      hud = $('hud');
      micwrap = $('micwrap');
      fuelrow = $('fuelrow');
      speedEl = $('speed');
      radioChip = $('radiochip');
      first = true;   /* следующий apply() прогонит все поля заново */
      fuelPlaced = false;

      document.querySelectorAll('[data-icon]').forEach((el) => {
        const svg = window.HUDIcons[el.dataset.icon];
        if (svg) el.innerHTML = svg;
      });

      updateAddress();
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

      /* Цвет круговых линий микрофона + мягкое свечение капсулы. */
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
