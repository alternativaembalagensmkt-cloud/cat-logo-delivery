#!/usr/bin/env node
// build.js — Gera index.html a partir de _template.html + products.json + slides.json
// + fotos (webp/png/jpg) + fontes.
// Fotos que ainda não foram colocadas em webp/ viram um placeholder automático
// ("FOTO PENDENTE") — o build nunca trava por falta de imagem.
// Reexecute sempre que editar o template, o products.json, o slides.json ou trocar fotos.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const log = (msg) => console.log(msg);

log('Lendo template...');
let out = fs.readFileSync(path.join(ROOT, '_template.html'), 'utf8');

// split/join = substituição literal, sem interpretar $&, $1 etc. como regex faria
function replaceAll(str, token, value) {
  return str.split(token).join(String(value));
}

log('Injetando dados dos produtos (products.json)...');
const produtos = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
const produtosJs = JSON.stringify(produtos).replace(/<\//g, '<\\/');
out = replaceAll(out, '__PRODUTOS_JSON__', produtosJs);

log('Injetando títulos das páginas (slides.json)...');
const slides = JSON.parse(fs.readFileSync(path.join(ROOT, 'slides.json'), 'utf8'));
for (const [num, texto] of Object.entries(slides.titles || {})) {
  out = replaceAll(out, `__TITLE_${num}__`, texto);
}
for (const [id, texto] of Object.entries(slides.pills || {})) {
  out = replaceAll(out, `__PILL_${id}__`, texto);
}

log('Resolvendo fotos (webp/png/jpg — placeholder automático se ainda não existir)...');
// Nome do arquivo esperado em webp/ pra cada slide. Aceita .webp, .png, .jpg ou .jpeg
// (o que for encontrado primeiro é usado — .webp tem prioridade por ser mais leve).
const IMG_MAP = {
  CAPA: 'Capa',
  P1: 'Sacos Kraft',
  P2: 'Papeis Especiais',
  P3: 'Guardanapos Envelopados',
  P4: 'Lacres e Etiquetas',
  P5: 'Caixas Delivery',
  P6: 'Sacos e Saquinhos',
  P7: 'A Pronta Entrega',
};
const EXT_MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

function placeholderDataUri(label) {
  const safeLabel = String(label).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
    <rect width="1200" height="1500" fill="#0c1f1d"/>
    <rect x="36" y="36" width="1128" height="1428" fill="none" stroke="#00A499" stroke-width="4" stroke-dasharray="18 14"/>
    <text x="600" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" fill="#00A499" font-weight="700">FOTO PENDENTE</text>
    <text x="600" y="770" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="#ffffff">${safeLabel}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

const faltando = [];
for (const [key, label] of Object.entries(IMG_MAP)) {
  const exts = ['.webp', '.png', '.jpg', '.jpeg'];
  let found = null;
  for (const ext of exts) {
    const p = path.join(ROOT, 'webp', label + ext);
    if (fs.existsSync(p)) { found = p; break; }
  }
  let dataUri;
  if (found) {
    const mime = EXT_MIME[path.extname(found).toLowerCase()];
    const b64 = fs.readFileSync(found).toString('base64');
    dataUri = `data:${mime};base64,${b64}`;
  } else {
    faltando.push(label);
    dataUri = placeholderDataUri(label);
  }
  out = replaceAll(out, `__${key}_DATAURI__`, dataUri);
}
if (faltando.length) {
  log(`AVISO: ${faltando.length} foto(s) ainda não encontrada(s) em webp/ — usando placeholder:`);
  faltando.forEach(l => log(`   - ${l} (esperado: webp/${l}.webp)`));
}

log('Convertendo fontes para base64...');
const FONT_MAP = {
  FONT_LIGHT: 'NiveauGrotesk-Light.otf',
  FONT_REGULAR: 'NiveauGrotesk-Regular.otf',
  FONT_BLACK: 'NiveauGrotesk-Black.otf',
};
for (const [key, filename] of Object.entries(FONT_MAP)) {
  const b64 = fs.readFileSync(path.join(ROOT, 'fonts', filename)).toString('base64');
  out = replaceAll(out, `__${key}_B64__`, b64);
}

log('Verificando integridade...');
const pendentes = out.match(/__[A-Z0-9_]+__/g);
if (pendentes) {
  console.error('ERRO: placeholders nao substituidos:', [...new Set(pendentes)].join(', '));
  process.exit(1);
}

log('Gravando index.html (UTF-8 sem BOM)...');
fs.writeFileSync(path.join(ROOT, 'index.html'), out, 'utf8');

const size = fs.statSync(path.join(ROOT, 'index.html')).size;
log(`OK: index.html gerado (${size.toLocaleString('pt-BR')} bytes / ${(size / 1024).toFixed(1)} KB)`);
if (faltando.length) {
  log(`Lembrete: quando as fotos estiverem prontas, salve em webp/ com o nome exato de cada item acima e rode "node build.js" de novo.`);
}
