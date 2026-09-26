/* Gera os favicons a partir de img/mascot.png (precisa do Playwright: npm i playwright). Uso: node scripts/gerar-favicon.js [preview]
   Recorte rente ao desenho, quadrado, reduzido em etapas
   (mais nítido que reduzir de uma vez). Saída: favicon.ico (16+32), favicon-32.png,
   favicon-16.png (só para conferir; pode apagar) e apple-touch-icon.png (180, com fundo). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..');
const OUT = process.argv[2] === 'preview' ? path.join(process.env.TEMP || '/tmp', 'fav-preview') : REPO;
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const src = 'data:image/png;base64,' + fs.readFileSync(path.join(REPO, 'img/mascot.png')).toString('base64');

  const r = await p.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    // 1) caixa dos pixels visíveis (alfa > 8), ignorando a margem transparente
    const c0 = document.createElement('canvas'); c0.width = img.width; c0.height = img.height;
    const g0 = c0.getContext('2d'); g0.drawImage(img, 0, 0);
    const d = g0.getImageData(0, 0, c0.width, c0.height).data;
    let x0 = c0.width, y0 = c0.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c0.height; y++) for (let x = 0; x < c0.width; x++) {
      if (d[(y * c0.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, side = Math.max(w, h);
    // 2) quadrado com o desenho centralizado; margem de 4% para não encostar na borda
    const pad = Math.round(side * 0.04), S = side + pad * 2;
    const sq = document.createElement('canvas'); sq.width = S; sq.height = S;
    sq.getContext('2d').drawImage(img, x0, y0, w, h, Math.round((S - w) / 2), Math.round((S - h) / 2), w, h);

    // 3) redução em etapas (metade de cada vez) até o tamanho final
    const shrink = (from, size) => {
      let cur = from;
      while (cur.width / 2 > size) {
        const n = document.createElement('canvas'); n.width = Math.round(cur.width / 2); n.height = n.width;
        const g = n.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(cur, 0, 0, n.width, n.height); cur = n;
      }
      const f = document.createElement('canvas'); f.width = size; f.height = size;
      const g = f.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(cur, 0, 0, size, size);
      return f;
    };
    const png = c => c.toDataURL('image/png').split(',')[1];
    const out = { bbox: [x0, y0, w, h], orig: [img.width, img.height] };
    out.f16 = png(shrink(sq, 16)); out.f32 = png(shrink(sq, 32)); out.f48 = png(shrink(sq, 48));
    // apple-touch-icon: iOS não aceita transparência, então vai sobre o roxo do site
    const at = document.createElement('canvas'); at.width = 180; at.height = 180;
    const ga = at.getContext('2d'); ga.fillStyle = '#1B0F3B'; ga.fillRect(0, 0, 180, 180);
    const inner = shrink(sq, 140); ga.drawImage(inner, 20, 20);
    out.apple = png(at);
    return out;
  }, src);
  console.log('imagem original:', r.orig.join('x'), '| desenho visível (x,y,l,a):', r.bbox.join(', '));

  const buf = k => Buffer.from(r[k], 'base64');
  fs.writeFileSync(path.join(OUT, 'img/favicon-32.png'), buf('f32'));
  fs.writeFileSync(path.join(OUT, 'img/favicon-16.png'), buf('f16'));
  fs.writeFileSync(path.join(OUT, 'img/apple-touch-icon.png'), buf('apple'));

  // .ico com PNGs embutidos (16 e 32): formato aceito por todos os navegadores atuais
  const imgs = [[16, buf('f16')], [32, buf('f32')]];
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
  let offset = 6 + 16 * imgs.length;
  const entries = imgs.map(([sz, data]) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(sz, 0); e.writeUInt8(sz, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    offset += data.length; return e;
  });
  fs.writeFileSync(path.join(OUT, 'favicon.ico'), Buffer.concat([head, ...entries, ...imgs.map(i => i[1])]));

  // folha de conferência: 16/32/48 sobre fundo claro e escuro, ampliada 6x para a gente enxergar
  const sheet = `<body style="margin:0;display:flex;font:14px sans-serif">${[['#ffffff', '#111'], ['#202124', '#eee'], ['#f2f2fb', '#1a2140'], ['#110728', '#eee']].map(([bg, fg]) =>
    `<div style="background:${bg};color:${fg};padding:16px 20px"><div>${bg}</div>
      <div style="display:flex;gap:14px;align-items:flex-end;margin:10px 0">
        <img src="data:image/png;base64,${r.f16}" width="16" height="16"><img src="data:image/png;base64,${r.f32}" width="32" height="32"><img src="data:image/png;base64,${r.f48}" width="48" height="48"></div>
      <div style="display:flex;gap:14px;align-items:flex-end">
        <img src="data:image/png;base64,${r.f16}" width="96" height="96" style="image-rendering:pixelated"><img src="data:image/png;base64,${r.f32}" width="192" height="192" style="image-rendering:pixelated"></div></div>`).join('')}</body>`;
  await p.setContent(sheet);
  await p.screenshot({ path: path.join(process.env.TEMP || '/tmp', 'favicon-folha.png'), fullPage: true });
  await b.close();
  console.log('gerado em:', OUT);
})();
