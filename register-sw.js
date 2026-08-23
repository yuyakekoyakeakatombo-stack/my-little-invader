// Service Worker の登録。ゲーム一式を端末に保管して、圏外でも起動できるようにする。
//  新しい版が出たら、勝手に切り替えず「よみこみなおす」ボタンを出す
//  （プレイ中に画面が入れ替わらないように）。
(function () {
  if (!('serviceWorker' in navigator)) return;   // 非対応でも通常どおり遊べる
  // 説明書はゲームの中に重ねて開くことがある。埋め込みで動くときは何もしない
  //  （親ページがすでに登録しているし、枠の中で更新バーが出ても押しどころがない）
  if (window.top !== window.self) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {

      function watch(worker) {
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          // installed かつ既存のSWがいる＝更新が用意できた状態
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBar(worker);
          }
        });
      }

      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg.waiting);
      watch(reg.installing);
      reg.addEventListener('updatefound', function () { watch(reg.installing); });

      // 起動のたびに更新を確認する
      reg.update().catch(function () {});
    }).catch(function () {});
  });

  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  function showUpdateBar(worker) {
    if (document.getElementById('sw-update-bar')) return;

    var css = document.createElement('style');
    css.textContent =
      '#sw-update-bar{position:fixed;left:0;right:0;bottom:0;z-index:99999;' +
      'background:#1a2410;color:#b8c890;box-shadow:0 -2px 10px rgba(0,0,0,.35);' +
      'font-family:"Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif;' +
      'padding:11px 14px calc(11px + env(safe-area-inset-bottom));' +
      'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 12px}' +
      '#sw-update-bar .m{font-size:12.5px;line-height:1.5;flex:1 1 100%;text-align:center}' +
      '#sw-update-bar button{font-family:inherit;border:0;cursor:pointer;white-space:nowrap}' +
      '#sw-update-bar .go{background:#b8c890;color:#1a2410;border-radius:4px;padding:8px 18px;font-size:13px}' +
      '#sw-update-bar .later{background:none;color:#8aaa6a;padding:8px 6px;font-size:12px}' +
      /* 横に余裕があれば1行に収める */
      '@media(min-width:420px){#sw-update-bar .m{flex:0 1 auto;text-align:left}}';

    var bar = document.createElement('div');
    bar.id = 'sw-update-bar';
    // 文言は 設定した言語で出す（説明書は英語で読めるので、ここだけ日本語だと浮く）
    var en = false;
    try{ en = localStorage.getItem('myvader_lang') === 'en'; }catch(e){}
    bar.innerHTML = '<span class="m">' + (en ? 'A new version is available' : 'あたらしい バージョンが あります') + '</span>' +
                    '<button class="go">' + (en ? 'Reload' : 'よみこみなおす') + '</button>' +
                    '<button class="later">' + (en ? 'Later' : 'あとで') + '</button>';
    // 押された時点の待機ワーカーを取り直してから送る。
    //  バーを出した時に掴んだ参照は、その後の更新で古くなっていることがあるため
    bar.querySelector('.go').onclick = function () {
      navigator.serviceWorker.getRegistration().then(function (reg) {
        var w = (reg && reg.waiting) || worker;
        if (w) w.postMessage('skipWaiting');
      }).catch(function () { if (worker) worker.postMessage('skipWaiting'); });
    };
    bar.querySelector('.later').onclick = function () { bar.remove(); css.remove(); };

    document.head.appendChild(css);
    document.body.appendChild(bar);
  }
})();
