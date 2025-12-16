
// pw-simple.js — inline password toggle with text
(function(){
  function addToggleNextTo(inputId){
    const input = document.getElementById(inputId);
    if (!input) return;
    // Wrap input + button as inline
    const parent = input.parentElement;
    const wrap = document.createElement('span');
    wrap.className = 'pw-inline-wrap';
    parent.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-inline-btn';
    btn.setAttribute('aria-label','Mostra/Nascondi password');
    btn.textContent = 'Mostra';
    wrap.appendChild(btn);

    btn.addEventListener('click', () => {
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.textContent = isPwd ? 'Nascondi' : 'Mostra';
      input.focus();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    addToggleNextTo('loginPassword');
    addToggleNextTo('registerPassword');
    addToggleNextTo('registerConfirmPassword');
  });
})();
