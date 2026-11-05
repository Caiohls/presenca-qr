const VERSAO = 'pulsescan-v1';
const CDN = 'https://cdn.jsdelivr.net/';
const TEMPO_REDE = 2000;
const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/db.js',
  'js/codigo.js',
  'js/ui.js',
  'js/alunos.js',
  'js/leitor.js',
  'js/relatorio.js',
  'js/app.js',
  'icons/logo.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  `${CDN}npm/html5-qrcode@2.3.8/html5-qrcode.min.js`,
  `${CDN}npm/qrcode-generator@1.4.4/qrcode.js`,
  `${CDN}npm/xlsx@0.18.5/dist/xlsx.full.min.js`,
  `${CDN}npm/jszip@3.10.1/dist/jszip.min.js`,
  `${CDN}npm/@fontsource-variable/inter@5.2.8/wght.css`,
  `${CDN}npm/@fontsource-variable/inter@5.2.8/files/inter-latin-wght-normal.woff2`,
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function cacheOuRede(pedido) {
  const cache = await caches.open(VERSAO);
  const salvo = await cache.match(pedido.url);
  if (salvo) return salvo;
  const resposta = await fetch(pedido.url, { mode: 'cors' });
  if (resposta.ok) cache.put(pedido.url, resposta.clone());
  return resposta;
}

async function redeOuCache(pedido) {
  const cache = await caches.open(VERSAO);
  try {
    const resposta = await Promise.race([
      fetch(pedido),
      new Promise((_, recusar) => setTimeout(recusar, TEMPO_REDE)),
    ]);
    if (resposta.ok) cache.put(pedido, resposta.clone());
    return resposta;
  } catch {
    const salvo = await cache.match(pedido, { ignoreSearch: true })
      || (pedido.mode === 'navigate' ? await cache.match('index.html') : null);
    return salvo || fetch(pedido);
  }
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.startsWith(CDN)) e.respondWith(cacheOuRede(e.request));
  else if (new URL(e.request.url).origin === location.origin) e.respondWith(redeOuCache(e.request));
});
