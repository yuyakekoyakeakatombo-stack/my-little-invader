// ════════════════════════════════════════════════════════════
//  My Little Invader — Service Worker
//
//  役割：ゲーム一式を端末に保管して、圏外でも起動できるようにする。
//  ここが守るのは「ファイル」だけ。育てた子のセーブ（localStorage）は別物で、
//  このワーカーを入れても消えるときは消える。
//
//  ⚠ VERSION は、キャッシュ対象のファイルを1つでも直したら必ず上げること。
//    上げ忘れると、更新をpushしてもテスターの端末に古い版が出続ける。
//    tools/bump-sw.sh が自動で書き換える（pre-commitフックから呼ばれる）。
// ════════════════════════════════════════════════════════════
const VERSION = '2026-08-10-04';
const CACHE = 'mli-' + VERSION;

// 初回訪問時にまとめて取りに行くファイル
const ASSETS = [
  './',
  'index.html',
  'invader_game.html',
  'spacewalk_game.html',
  'shootingstar_game.html',
  'abduction_game.html',
  'manual.html',
  'fonts.css',
  'register-sw.js',
  'pressstart2p-latin.woff2',
  'apple-touch-icon.png',
  'manifest.json',
];

// ── install：一式を保管する ──
//  1つでも失敗すると install ごと失敗するので、個別に握りつぶして
//  「取れたものだけでも動く」状態にしておく（回線が不安定な初回対策）
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // cache.add() はブラウザのHTTPキャッシュを経由するので、版数を上げても
    //  古いファイルがそのまま新しいキャッシュに入ってしまうことがある。
    //  reload を指定してサーバーから取り直す（更新が届かない事故の防止）
    await Promise.all(ASSETS.map(u =>
      fetch(new Request(u, { cache: 'reload' }))
        .then(r => { if (r && r.ok) return c.put(u, r); })
        .catch(() => {})
    ));
    // ここで skipWaiting() は呼ばない。
    //  呼ぶと新しい版が即座に有効になり、遊んでいる最中にページが勝手にリロードされる。
    //  待機させておいて、画面に出した「よみこみなおす」を押されたときだけ切り替える。
  })());
});

// ── activate：古い世代のキャッシュを捨てる ──
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('mli-') && k !== CACHE)
                          .map(k => caches.delete(k)));
    await self.clients.claim();        // 開いているページも新しい版に引き継ぐ
  })());
});

// ── fetch：どこから返すかを決める ──
//  HTML＝ネットワーク優先：更新をすぐ届けたいので、まず取りに行く。
//        つながらなければ保管庫から出す（＝オフラインでも起動できる）。
//  それ以外（フォント・画像）＝キャッシュ優先：中身が変わらないので毎回取りに行かない。
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 他所のドメインには手を出さない

  const isHTML = req.mode === 'navigate' ||
                 req.destination === 'iframe' ||     // ミニゲームはiframeで開く
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');

  if (isHTML) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());                   // 次のオフラインに備えて更新
        return fresh;
      } catch (err) {
        const hit = await caches.match(req, { ignoreSearch: true });
        return hit || caches.match('invader_game.html');
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});

// ページ側から「今すぐ新しい版に切り替えて」と言われたとき
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
