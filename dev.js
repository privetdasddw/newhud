/* Browser-only preview: fake night scene, radar placeholder, mock data.
   Loaded by main.js ONLY outside FiveM. */
(function () {
  document.body.classList.add('dev');

  const style = document.createElement('style');
  style.textContent = 'body.dev #hud{position:fixed}';
  document.head.appendChild(style);

  const scene = document.createElement('div');
  scene.id = 'devscene';
  scene.innerHTML = `
    <div class="base"></div>
    <span class="bokeh" style="left:66%;top:20%;width:8px;height:8px;background:#5a6a85;"></span>
    <span class="bokeh" style="left:74%;top:29%;width:6px;height:6px;background:#6a7fa8;"></span>
    <span class="bokeh" style="left:58%;top:33%;width:4px;height:4px;background:#7a8db5;"></span>
    <span class="bokeh" style="left:83%;top:38%;width:7px;height:7px;background:#5f729c;"></span>
    <span class="bokeh" style="left:51%;top:24%;width:5px;height:5px;background:#6a7fa8;"></span>
    <span class="bokeh" style="left:31%;top:22%;width:5px;height:5px;background:#4f628a;"></span>
    <span class="bokeh" style="left:88%;top:24%;width:4px;height:4px;background:#5a6a85;"></span>
    <div class="road"></div>
    <div class="lane"></div>
    <div class="vignette"></div>
    <div class="radar">
      <span class="st h1"></span><span class="st h2"></span>
      <span class="st v1"></span><span class="st v2"></span>
      <span class="player"></span>
    </div>`;
  document.body.prepend(scene);

  /* ?bright — дневная сцена: проверяет читаемость плашек на светлом
     небе и снегу (ночная — дефолт, как в реальном вечернем кадре). */
  const params = new URLSearchParams(location.search);
  const veh = params.has('veh');
  const bright = params.has('bright');

  if (bright) {
    document.body.classList.add('bright');
    const st = document.createElement('style');
    st.textContent = [
      'body.bright #devscene .base{background:linear-gradient(180deg,#93a7bd 0%,#bfcad6 46%,#d8dfe6 100%)}',
      'body.bright #devscene .bokeh{display:none}',
      'body.bright #devscene .road{background:linear-gradient(180deg,rgba(122,132,142,0) 0%,rgba(104,114,125,.92) 30%,#78838f 100%)}',
      'body.bright #devscene .lane{background:repeating-linear-gradient(180deg,rgba(255,255,255,.55) 0 26px,transparent 26px 66px);opacity:.55}',
      'body.bright #devscene .vignette{box-shadow:inset 0 0 220px 60px rgba(25,35,50,.22)}',
      'body.bright #devscene .radar{border-color:rgba(0,0,0,.28)}'
    ].join('');
    document.head.appendChild(st);
  }

  /* Preview использует тот же accent, что стоит в config.lua
     (Config.Accent = '#f2b13c') — единственный функциональный цвет HUD. */
  window.HUD.config({ accent: '#f2b13c', lowFuel: 15 });

  window.HUD.apply({
    visible: true,
    time: bright ? '2:41 PM' : '8:56 PM',
    night: !bright,
    weather: bright ? 'sun' : 'cloud',
    temperature: bright ? '84°F' : '70°F',
    street: 'Innocence Blvd.',
    postal: '9146',
    direction: 'В',
    unit: 'MPH',
    mic: veh ? 'idle' : 'talking',
    radioChannel: 2,
    radioTalking: false
  });

  /* ?long — самое длинное название улицы Лос-Сантоса + 5-значный postal:
     плашка не должна вылезать за диаметр круга (ellipsis раньше). */
  if (params.has('long')) {
    window.HUD.apply({ street: 'Mount Vinewood Dr.', postal: '10243' });
  }

  if (veh) {
    /* Штатное состояние: скорость ниже лимита, знак не инвертирован. */
    window.HUD.apply({
      drive: true,
      speed: 41,
      gear: 'S',
      fuel: 62,
      limit: 50,
      delta: 0,
      seatbelt: false
    });

    /* ?over — стресс-тест состояний: превышение (+delta, инверсия знака),
       низкий топливо (акцент), эфир радио, пристёгнутый ремень. */
    if (params.has('over')) {
      window.HUD.apply({
        speed: 58,
        gear: 'D',
        fuel: 12,
        seatbelt: true,
        radioTalking: true
      });
    }
  } else {
    window.HUD.apply({ drive: false, seatbelt: null, limit: 0, delta: 0 });
  }
})();
