
// toast.js — lightweight toast notifications
(function(){
  const container = document.getElementById('toast-container') || (() => {
    const c = document.createElement('div'); c.id='toast-container'; c.setAttribute('aria-live','polite'); document.body.appendChild(c); return c;
  })();
  function show(type, message, ms=3000){
    const el = document.createElement('div');
    el.className = 'toast ' + (type ? 'toast-' + type : 'toast-info');
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s';
      setTimeout(() => el.remove(), 300);
    }, ms);
  }
  window.toast = { show };
})();
