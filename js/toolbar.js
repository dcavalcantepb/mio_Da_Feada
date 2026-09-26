/* Barra de ferramentas de texto do editor (editor.html).
   Trabalha em cima do campo de texto principal (#fContent), que é o mesmo nos
   três modos: o Texto da Campanha, o Texto da Lore e a História do Personagem.
   Cada botão só insere ou tira as marcas simples que renderMarkdownLite()
   (render.js) entende — o texto continua sendo texto puro no banco. */
(function(){
  const ta = document.getElementById('fContent');
  const mount = document.getElementById('toolbarMount');
  if(!ta || !mount) return;

  const svg = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const ICON = {
    undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
    mark: svg('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
    ul: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    ol: svg('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5.5 5.5 5v4.5"/><path d="M4 9.5h3"/><path d="M4 14.5c1-1 2.5-.8 2.5.3 0 1.3-2.5 1.7-2.5 3h3"/>'),
    quote: svg('<path d="M9 7H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3v-2H6"/><path d="M9 14v1a3 3 0 0 1-3 3"/><path d="M19 7h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3v-2h-3"/><path d="M19 14v1a3 3 0 0 1-3 3"/>'),
    hr: svg('<path d="M3 12h5M16 12h5"/><path d="m12 8 1.6 4-1.6 4-1.6-4z"/>'),
    mention: svg('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>'),
    link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
    spoiler: svg('<path d="M3 3l18 18"/><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a12 12 0 0 1-2.6 3.4"/><path d="M6.2 6.9A12 12 0 0 0 2.5 12c1 2 4.5 6 9.5 6a9.7 9.7 0 0 0 3.4-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
    clear: svg('<path d="m7 21-4-4a2 2 0 0 1 0-2.8l10-10a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L11 21"/><path d="M7 21h14"/><path d="m6 13 5 5"/>'),
    esquerda: svg('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
    centro: svg('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
    direita: svg('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
    justificado: svg('<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>')
  };

  /* [comando, dica, conteúdo do botão] — 'sep' separa os grupos */
  const ITEMS = [
    ['undo', 'Desfazer (Ctrl+Z)', ICON.undo], ['redo', 'Refazer (Ctrl+Y)', ICON.redo], 'sep',
    ['h1', 'Título 1', 'H1'], ['h2', 'Título 2', 'H2'], ['h3', 'Título 3', 'H3'], 'sep',
    ['esquerda', 'Alinhar à esquerda (tira o alinhamento)', ICON.esquerda], ['centro', 'Centralizar', ICON.centro],
    ['direita', 'Alinhar à direita', ICON.direita], ['justificado', 'Justificar', ICON.justificado], 'sep',
    ['bold', 'Negrito (Ctrl+B)', '<b>B</b>'], ['italic', 'Itálico (Ctrl+I)', '<i>I</i>'],
    ['underline', 'Sublinhado (Ctrl+U)', '<u>U</u>'], ['strike', 'Riscado', '<s>S</s>'],
    ['mark', 'Marca-texto', ICON.mark], ['color', 'Cor do texto', '<span class="tb__a">A</span>'], 'sep',
    ['ul', 'Lista de marcadores', ICON.ul], ['ol', 'Lista numerada', ICON.ol],
    ['quote', 'Citação', ICON.quote], ['hr', 'Divisor', ICON.hr], 'sep',
    ['mention', 'Menção: link para um personagem, tomo ou sessão', ICON.mention],
    ['link', 'Link', ICON.link], ['spoiler', 'Spoiler: o leitor clica para revelar', ICON.spoiler], 'sep',
    ['clear', 'Limpar formatação', ICON.clear]
  ];

  /* ---------- montagem ---------- */
  const wrap = document.createElement('div');
  wrap.className = 'tbar-wrap';
  const bar = document.createElement('div');
  bar.className = 'tbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Formatação do texto');
  bar.innerHTML = ITEMS.map(it => it === 'sep'
    ? '<span class="tbar__sep" aria-hidden="true"></span>'
    : `<button class="tb${it[0] === 'color' ? ' tb--color' : ''}" type="button" data-cmd="${it[0]}" title="${it[1]}" aria-label="${it[1]}"${it[0] === 'color' ? ' aria-haspopup="true" aria-expanded="false"' : ''}>${it[2]}</button>`
  ).join('');

  const tray = document.createElement('div');
  tray.className = 'tray';
  tray.hidden = true;
  tray.setAttribute('role', 'group');
  tray.setAttribute('aria-label', 'Cores do texto');
  tray.innerHTML = TEXT_COLORS.map(([id, nome]) =>
    `<button class="swatch" type="button" data-color="${id}" style="--sw:var(--c-${id})" title="${nome}" aria-label="${nome}"></button>`
  ).join('') + '<button class="swatch swatch--none" type="button" data-color="" title="Sem cor" aria-label="Sem cor"></button>';
  bar.appendChild(tray);
  wrap.appendChild(bar);
  mount.appendChild(wrap);

  const colorBtn = bar.querySelector('[data-cmd="color"]');
  function closeTray(){ tray.hidden = true; colorBtn.setAttribute('aria-expanded', 'false'); }
  function toggleTray(){
    const open = tray.hidden;
    tray.hidden = !open;
    colorBtn.setAttribute('aria-expanded', String(open));
    if(open){
      tray.style.left = Math.max(0, Math.min(colorBtn.offsetLeft - 8, bar.clientWidth - tray.offsetWidth)) + 'px';
      tray.querySelector('.swatch').focus();
    }
  }

  /* ---------- edição no textarea (mantém o Ctrl+Z nativo) ---------- */
  function replace(start, end, text, selStart, selEnd){
    ta.focus();
    ta.setSelectionRange(start, end);
    let ok = false;
    try{ ok = text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, text); }catch(_){}
    if(!ok){
      ta.setRangeText(text, start, end, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ta.setSelectionRange(selStart, selEnd);
  }

  /* envolve a seleção com marcas; se já estiver envolvida, tira (liga/desliga) */
  function wrapInline(open, close, placeholder){
    const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, sel = v.slice(s, e);
    const italic = open === '*';   // não confundir *itálico* com **negrito**
    if(v.slice(s - open.length, s) === open && v.slice(e, e + close.length) === close &&
       !(italic && (v[s - 2] === '*' || v[e + 1] === '*'))){
      replace(s - open.length, e + close.length, sel, s - open.length, s - open.length + sel.length);
      return;
    }
    if(sel.length >= open.length + close.length && sel.startsWith(open) && sel.endsWith(close) &&
       !(italic && sel.startsWith('**'))){
      const inner = sel.slice(open.length, sel.length - close.length);
      replace(s, e, inner, s, s + inner.length);
      return;
    }
    if(sel.includes('\n') || ALIGN_LINE.test(sel)){   // marcas valem por linha: envolve cada linha separadamente
      const out = sel.split('\n').map(l => { if(!l.trim()) return l; const [al, rest] = splitAlign(l); return al + open + rest + close; }).join('\n');
      replace(s, e, out, s, s + out.length);
      return;
    }
    const text = sel || placeholder;
    replace(s, e, open + text + close, s + open.length, s + open.length + text.length);
  }

  function setColor(name){
    const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, sel = v.slice(s, e);
    const m = /\[cor=[a-z]+\]$/.exec(v.slice(0, s));
    if(m && v.slice(e).startsWith('[/cor]')){   // já tem cor: troca ou tira
      const start = s - m[0].length, end = e + 6;
      if(!name){ replace(start, end, sel, start, start + sel.length); return; }
      const open = `[cor=${name}]`;
      replace(start, end, open + sel + '[/cor]', start + open.length, start + open.length + sel.length);
      return;
    }
    if(name) wrapInline(`[cor=${name}]`, '[/cor]', 'texto colorido');
  }

  /* linhas inteiras que a seleção toca */
  function lineRange(){
    const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    const ls = s === 0 ? 0 : v.lastIndexOf('\n', s - 1) + 1;
    const end = e > s && v[e - 1] === '\n' ? e - 1 : e;
    let le = v.indexOf('\n', end);
    if(le === -1) le = v.length;
    return [ls, le];
  }
  const PREFIX = /^(#{1,3}\s+|-\s+|\d+[.)]\s+|>\s?)/;
  /* alinhamento fica no começo da linha, antes de #, - etc.: {centro}## Título */
  const ALIGN_LINE = /^\{(esquerda|centro|direita|justificado)\}\s?/;
  const splitAlign = l => { const m = ALIGN_LINE.exec(l); return m ? [m[0], l.slice(m[0].length)] : ['', l]; };
  const TEST = { h1: /^#\s+/, h2: /^##\s+/, h3: /^###\s+/, ul: /^-\s+/, ol: /^\d+[.)]\s+/, quote: /^>\s?/ };
  const MARK = { h1: () => '# ', h2: () => '## ', h3: () => '### ', ul: () => '- ', ol: n => `${n}. `, quote: () => '> ' };
  const HOLD = { h1: 'Título', h2: 'Título', h3: 'Título', ul: 'item', ol: 'item', quote: 'citação' };

  function lineTool(kind){
    const [ls, le] = lineRange();
    const lines = ta.value.slice(ls, le).split('\n');
    if(!lines.some(l => l.trim())){   // linha vazia: já entra com texto de exemplo selecionado
      const pre = MARK[kind](1);
      replace(ls, le, pre + HOLD[kind], ls + pre.length, ls + pre.length + HOLD[kind].length);
      return;
    }
    const filled = lines.filter(l => l.trim());
    const allHave = filled.every(l => TEST[kind].test(splitAlign(l)[1]));   // já está assim: tira (liga/desliga)
    let n = 0;
    const out = lines.map(l => {
      if(!l.trim()) return l;
      const [al, rest] = splitAlign(l);   // o alinhamento da linha é preservado
      return al + (allHave ? rest.replace(PREFIX, '') : MARK[kind](++n) + rest.replace(PREFIX, ''));
    }).join('\n');
    replace(ls, le, out, ls, ls + out.length);
  }

  /* alinhamento das linhas tocadas pela seleção; clicar de novo no mesmo tira; "esquerda" só remove */
  function alignTool(kind){
    const [ls, le] = lineRange();
    const lines = ta.value.slice(ls, le).split('\n');
    if(!lines.some(l => l.trim())){   // linha vazia: entra com texto de exemplo selecionado
      if(kind === 'esquerda') return;
      const pre = `{${kind}}`, hold = 'texto';
      replace(ls, le, pre + hold, ls + pre.length, ls + pre.length + hold.length);
      return;
    }
    const filled = lines.filter(l => l.trim());
    const allHave = kind !== 'esquerda' && filled.every(l => splitAlign(l)[0].startsWith(`{${kind}}`));
    const out = lines.map(l => {
      if(!l.trim()) return l;
      const rest = splitAlign(l)[1];
      return kind === 'esquerda' || allHave ? rest : `{${kind}}` + rest;
    }).join('\n');
    replace(ls, le, out, ls, ls + out.length);
  }

  function divider(){
    const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, before = v.slice(0, s);
    const pre = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const text = pre + '---\n' + (v.slice(e).startsWith('\n') ? '' : '\n');
    replace(s, e, text, s + text.length, s + text.length);
  }

  function link(){
    const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, sel = v.slice(s, e);
    if(/^https?:\/\/\S+$/.test(sel)){   // selecionou um endereço: vira o destino do link
      const out = `[texto do link](${sel})`;
      replace(s, e, out, s + 1, s + 1 + 'texto do link'.length);
      return;
    }
    const label = sel || 'texto do link';
    const out = `[${label}](https://)`;
    const urlStart = s + label.length + 3;
    replace(s, e, out, urlStart, urlStart + 'https://'.length);   // deixa o endereço selecionado para colar por cima
  }

  /* botão de menção: abre "[[" no cursor (ou em volta da seleção) e mostra as sugestões */
  function mentionTool(){
    const v = ta.value, s = ta.selectionStart, e = ta.selectionEnd, sel = v.slice(s, e);
    if(sel){ replace(s, e, `[[${sel}]]`, s + 2, s + 2 + sel.length); return; }
    replace(s, e, '[[', s + 2, s + 2);
  }

  function clearFormat(){
    let [s, e] = [ta.selectionStart, ta.selectionEnd];
    if(s === e){ [s, e] = lineRange(); }
    const clean = t => t
      .replace(/\[cor=[a-z]+\]|\[\/cor\]/g, '')
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, nome, texto) => texto || nome)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
      .replace(/\|\||==|~~|\*\*|__/g, '')
      .replace(/\*(.+?)\*/g, '$1')
      .split('\n').map(l => splitAlign(l)[1].replace(PREFIX, '')).join('\n');
    const out = clean(ta.value.slice(s, e));
    replace(s, e, out, s, s + out.length);
  }

  const RUN = {
    undo: () => { ta.focus(); document.execCommand('undo'); },
    redo: () => { ta.focus(); document.execCommand('redo'); },
    h1: () => lineTool('h1'), h2: () => lineTool('h2'), h3: () => lineTool('h3'),
    bold: () => wrapInline('**', '**', 'negrito'),
    italic: () => wrapInline('*', '*', 'itálico'),
    underline: () => wrapInline('__', '__', 'sublinhado'),
    strike: () => wrapInline('~~', '~~', 'riscado'),
    mark: () => wrapInline('==', '==', 'destaque'),
    ul: () => lineTool('ul'), ol: () => lineTool('ol'), quote: () => lineTool('quote'),
    hr: divider, link, mention: mentionTool,
    spoiler: () => wrapInline('||', '||', 'texto escondido'),
    clear: clearFormat,
    esquerda: () => alignTool('esquerda'), centro: () => alignTool('centro'),
    direita: () => alignTool('direita'), justificado: () => alignTool('justificado')
  };

  /* ---------- eventos ---------- */
  // o clique não pode tirar o foco (nem a seleção) do campo de texto
  bar.addEventListener('mousedown', e => { if(e.target.closest('button')) e.preventDefault(); });
  bar.addEventListener('click', e => {
    const sw = e.target.closest('[data-color]');
    if(sw){ closeTray(); setColor(sw.dataset.color); return; }
    const b = e.target.closest('[data-cmd]');
    if(!b) return;
    if(b.dataset.cmd === 'color'){ toggleTray(); return; }
    closeTray();
    RUN[b.dataset.cmd]();
    ta.focus();
  });
  document.addEventListener('click', e => { if(!tray.hidden && !e.target.closest('.tbar')) closeTray(); });
  bar.addEventListener('keydown', e => { if(e.key === 'Escape' && !tray.hidden){ closeTray(); colorBtn.focus(); e.stopPropagation(); } });

  ta.addEventListener('keydown', e => {
    if(!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const k = e.key.toLowerCase();
    const cmd = { b: 'bold', i: 'italic', u: 'underline' }[k];
    if(cmd){ e.preventDefault(); RUN[cmd](); }
  });

  /* ---------- sugestões de menção ao digitar [[ ---------- */
  const pop = document.createElement('div');
  pop.className = 'mpop';
  pop.hidden = true;
  pop.setAttribute('role', 'listbox');
  pop.setAttribute('aria-label', 'Sugestões de menção');
  document.body.appendChild(pop);
  let items = [], active = 0, trigger = null;   // trigger: { start, query }

  const norm = t => (typeof mentionKey === 'function' ? mentionKey(t) : String(t).toLowerCase());
  const closePop = () => { pop.hidden = true; trigger = null; };

  /* posição do cursor dentro do textarea, medida com uma cópia invisível do texto */
  function caretXY(){
    const cs = getComputedStyle(ta), m = document.createElement('div');
    ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','wordSpacing','textIndent','lineHeight','tabSize',
     'paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth',
     'borderLeftWidth','boxSizing'].forEach(k => { m.style[k] = cs[k]; });
    m.style.cssText += ';position:absolute;visibility:hidden;top:0;left:-9999px;white-space:pre-wrap;overflow-wrap:break-word;';
    m.style.width = ta.offsetWidth + 'px';
    m.textContent = ta.value.slice(0, ta.selectionStart);
    const mark = document.createElement('span');
    mark.textContent = '\u200b';
    m.appendChild(mark);
    document.body.appendChild(m);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    const r = ta.getBoundingClientRect();
    const out = { x: r.left + mark.offsetLeft, y: r.top + mark.offsetTop - ta.scrollTop, lh };
    document.body.removeChild(m);
    return out;
  }

  function renderPop(){
    if(!items.length){
      pop.innerHTML = `<p class="mpop__hint">Nada com esse nome. A menção fica sem link até existir uma página assim.</p>`;
      return;
    }
    pop.innerHTML = items.map((it, i) =>
      `<button type="button" class="mitem" role="option" data-i="${i}" aria-selected="${i === active}">` +
      `<span class="mkind mkind--${it.kind}">${MENTION_KINDS[it.kind]}</span><span class="mname">${escapeHtml(it.name)}</span></button>`
    ).join('');
    const cur = pop.querySelector('[aria-selected="true"]');
    if(cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function placePop(){
    const c = caretXY();
    pop.hidden = false;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(c.x, window.innerWidth - w - 8);
    let top = c.y + c.lh + 4;
    if(top + h > window.innerHeight - 8) top = Math.max(8, c.y - h - 4);   // sem espaço embaixo: abre por cima
    pop.style.left = Math.max(8, left) + 'px';
    pop.style.top = top + 'px';
  }

  /* olha o texto antes do cursor: há um "[[" aberto, ainda sem "]]"? */
  function updateMention(){
    if(ta.selectionStart !== ta.selectionEnd){ closePop(); return; }
    const before = ta.value.slice(0, ta.selectionStart);
    const m = /\[\[([^\[\]\n|]*)$/.exec(before);
    if(!m){ closePop(); return; }
    const q = norm(m[1]);
    const hits = (typeof MENTION_LIST !== 'undefined' ? MENTION_LIST : [])
      .map(it => ({ it, k: norm(it.name) }))
      .filter(x => !q || x.k.includes(q))
      .sort((a, b) => (b.k.startsWith(q) - a.k.startsWith(q)))
      .slice(0, 8).map(x => x.it);
    trigger = { start: before.length - m[0].length, query: m[1] };
    items = hits;
    active = 0;
    renderPop();
    placePop();
  }

  function acceptMention(i){
    const it = items[i];
    if(!it || !trigger) return;
    const end = ta.selectionStart;
    const text = `[[${it.name}]]`;
    replace(trigger.start, end, text, trigger.start + text.length, trigger.start + text.length);
    closePop();
  }

  ta.addEventListener('input', updateMention);
  ta.addEventListener('click', updateMention);
  ta.addEventListener('blur', () => setTimeout(() => { if(document.activeElement !== ta) closePop(); }, 120));
  ta.addEventListener('scroll', () => { if(!pop.hidden) placePop(); });
  window.addEventListener('resize', () => { if(!pop.hidden) placePop(); });
  ta.addEventListener('keydown', e => {
    if(pop.hidden) return;
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      if(!items.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      renderPop();
    } else if((e.key === 'Enter' || e.key === 'Tab') && items.length){
      e.preventDefault();
      acceptMention(active);
    } else if(e.key === 'Escape'){
      e.preventDefault();
      e.stopPropagation();
      closePop();
    }
  }, true);
  pop.addEventListener('mousedown', e => e.preventDefault());   // não tira o foco do texto
  pop.addEventListener('click', e => {
    const b = e.target.closest('.mitem');
    if(b) acceptMention(+b.dataset.i);
  });
})();
