/* Browser-only preview: макетная ночная сцена, круг radar на месте
   fh4map и демо-данные. Загружается из main.js ТОЛЬКО вне FiveM.

   Флаги:
     ?veh     — за рулём (виден кластер)
     ?bright  — дневная сцена (проверка читаемости плашек)
     ?long    — самая длинная улица + 5-значный postal
     ?low     — низкий уровень топлива
     ?mic=talking|idle|off — зафиксировать состояние микрофона
                             (по умолчанию состояния сменяются циклом) */
(function () {
  document.body.classList.add('dev');

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
      'body.bright #devscene .vignette{box-shadow:inset 0 0 220px 60px rgba(25,35,50,.22)}'
    ].join('');
    document.head.appendChild(st);
  }

  window.HUD.config({ accent: '#f2b13c', micColor: '#34d17a', lowFuel: 15 });

  window.HUD.apply({
    visible: true,
    time: bright ? '2:41 PM' : '7:26 AM',
    weather: bright ? 'sun' : 'cloud',
    temperature: bright ? '84°F' : '70°F',
    street: 'Los Santos Freeway',
    postal: '7285',
    direction: 'С',
    unit: 'MPH',
    mic: 'talking',
    radioChannel: 4,
    radioTalking: false
  });

  if (params.has('long')) {
    window.HUD.apply({ street: 'Great Ocean Highway Underpass', postal: '10243' });
  }

  if (veh) {
    window.HUD.apply({
      drive: true,
      speed: 41,
      gear: 'D',
      fuel: params.has('low') ? 11 : 100
    });
  } else {
    window.HUD.apply({ drive: false });
  }

  /* Микрофон: либо зафиксированное состояние, либо цикл
     talking → idle → off, чтобы было видно зелёные волны. */
  const fixed = params.get('mic');
  if (fixed) {
    window.HUD.apply({ mic: fixed });
  } else {
    const cycle = ['talking', 'idle', 'off'];
    let i = 0;
    setInterval(() => {
      i = (i + 1) % cycle.length;
      window.HUD.apply({ mic: cycle[i] });
    }, 4000);
  }
})();
