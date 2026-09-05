/* Entry point: NUI message router + readiness handshake + dev mode. */
(function () {
  const IS_FIVEM = typeof GetParentResourceName === 'function';

  function handshake() {
    fetch(`https://${GetParentResourceName()}/uiReady`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: '{}'
    }).catch(() => {});
  }

  window.addEventListener('message', (event) => {
    const msg = event.data || {};
    if (msg.action === 'hud') {
      window.HUD.apply(msg);
    } else if (msg.action === 'config') {
      window.HUD.config(msg);
    } else if (msg.action === 'reset') {
      /* Resource restarted: re-init HUD and re-handshake. */
      window.HUD.init();
      if (IS_FIVEM) handshake();
    }
  });

  window.addEventListener('load', () => {
    window.HUD.init();
    if (IS_FIVEM) {
      handshake();
    } else {
      const script = document.createElement('script');
      script.src = 'js/dev.js';
      document.body.appendChild(script);
    }
  });
})();
