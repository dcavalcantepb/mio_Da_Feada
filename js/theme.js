/* Alterna entre o tema do sistema e uma escolha manual (dia/noite),
   lembrada no navegador de quem lê. Roda cedo, antes da página pintar,
   pra não piscar do tema errado pro certo. */
(function(){
  const KEY = 'cronica-theme';
  const root = document.documentElement;
  const stored = localStorage.getItem(KEY);
  if(stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);

  function apply(theme){
    if(theme){
      root.setAttribute('data-theme', theme);
      localStorage.setItem(KEY, theme);
    } else {
      root.removeAttribute('data-theme');
      localStorage.removeItem(KEY);
    }
  }

  function current(){
    const attr = root.getAttribute('data-theme');
    if(attr) return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    if(!btn) return;
    btn.addEventListener('click', () => apply(current() === 'dark' ? 'light' : 'dark'));
  });
})();
