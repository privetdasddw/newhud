/* Central state store. render.js reads this; Lua pushes diffs into it.
   Everything starts as null: nothing is assumed until real data arrives,
   so the first snapshot always renders (no skipped equal values). */
(function () {
  window.HUDState = {
    visible: null,
    drive: null,

    time: null,
    night: null,
    weather: null,
    temperature: null,

    street: null,
    postal: null,
    direction: null,

    speed: null,
    unit: null,
    gear: null,
    fuel: null,
    delta: null,
    limit: null,
    cruise: null,
    seatbelt: null,

    mic: null,
    radioChannel: null,
    radioTalking: null,

    lowFuel: 15
  };
})();
