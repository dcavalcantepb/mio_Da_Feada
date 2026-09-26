/* Alterna entre o tema do sistema e uma escolha manual (dia/noite),
   lembrada no navegador de quem lê. Roda cedo, antes da página pintar,
   pra não piscar do tema errado pro certo. */
(function(){
  const KEY = 'cronica-theme';
  const root = document.documentElement;
  try{
    const stored = localStorage.getItem(KEY);
    if(stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);
  }catch(_){}

  function current(){
    const attr = root.getAttribute('data-theme');
    if(attr) return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function paint(btn){
    const dark = current() === 'dark';
    btn.textContent = dark ? '☀' : '☾';
    btn.setAttribute('aria-label', dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
    btn.title = btn.getAttribute('aria-label');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    if(!btn) return;
    paint(btn);
    btn.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try{ localStorage.setItem(KEY, next); }catch(_){}
      paint(btn);
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => paint(btn));
  });
})();
