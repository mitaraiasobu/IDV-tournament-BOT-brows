/* ブラウザ音楽（BGM）：配信用の画面（live.html）・トーナメント表（index.html）・ルールのページで、共通に使う。
   音源は、YouTube（{kind:"youtube", id, start}）か、音声ファイルのURL（{kind:"audio", url, start}）。start は、再生を始める位置（秒）。繰り返すときも、その位置に戻る。
   使い方：MusicPlayer.init({ ui: true|false, volume: 0〜1 }) → MusicPlayer.set(音源 or null)（音源が同じなら、何もしない）。
   ui:true（公開のページ）…… 左下に、音量のバーを出す。開くたびに、小さめ（volume）から始まる。バーで大きくできる。
   ui:false（OBSの配信用の画面）…… 音量は、そのまま（OBSの側で調整する）。
   ブラウザは、人が何も操作していないページで、音を鳴らすのを止めることがある。そのときは、画面を1回タップ（クリック）すると、鳴りはじめる。 */
(function () {
  var cfg = { ui: false, volume: 1 };
  var master = 1, cur = null, bar = null, hint = null, gestureBound = false, started = false;

  function key(src) { return src ? (src.kind || "") + "|" + (src.id || src.url || "") + "|" + (parseInt(src.start, 10) || 0) : ""; }

  // ── 音声ファイル ──
  function audioCtl(src, onBlocked) {
    var S = Math.max(0, parseInt(src.start, 10) || 0), a = new Audio(), dead = false;
    a.preload = "auto"; a.src = src.url; a.volume = master;
    a.addEventListener("loadedmetadata", function () { if (S) { try { a.currentTime = S; } catch (e) { /* 無視 */ } } });
    a.addEventListener("ended", function () { if (dead) return; try { a.currentTime = S; a.play().catch(function () { /* 無視 */ }); } catch (e) { /* 無視 */ } });
    function play() { a.play().then(function () { onBlocked(false); }).catch(function () { if (!dead) onBlocked(true); }); }
    return {
      play: play,
      setVolume: function (v) { a.volume = Math.max(0, Math.min(1, v)); },
      destroy: function () { dead = true; try { a.pause(); a.removeAttribute("src"); a.load(); } catch (e) { /* 無視 */ } }
    };
  }

  // ── YouTube（IFrame Player API。見えない場所に置いて、音だけ流す） ──
  var ytLoading = null;
  function loadYT() {
    if (ytLoading) return ytLoading;
    ytLoading = new Promise(function (resolve) {
      if (window.YT && window.YT.Player) { resolve(); return; }
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); resolve(); };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        var s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
    });
    return ytLoading;
  }
  function youtubeCtl(src, onBlocked) {
    var S = Math.max(0, parseInt(src.start, 10) || 0), dead = false, ready = false, player = null, want = false, check = null;
    var box = document.createElement("div");
    box.setAttribute("aria-hidden", "true");
    box.style.cssText = "position:fixed;left:-9999px;top:0;width:220px;height:140px;overflow:hidden;pointer-events:none;opacity:0";
    var host = document.createElement("div");
    box.appendChild(host);
    document.body.appendChild(box);
    loadYT().then(function () {
      if (dead) return;
      /* eslint-disable-next-line no-new */
      player = new YT.Player(host, {
        videoId: src.id, width: "220", height: "140",
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, playsinline: 1, start: S, origin: location.origin },
        events: {
          onReady: function (e) { ready = true; try { e.target.setVolume(Math.round(master * 100)); } catch (x) { /* 無視 */ } if (want) tryPlay(); },
          onAutoplayBlocked: function () { if (!dead) onBlocked(true); },
          onStateChange: function (e) {
            if (dead) return;
            if (e.data === 1) onBlocked(false);                                                      // 再生中
            else if (e.data === 0) { try { e.target.seekTo(S, true); e.target.playVideo(); } catch (x) { /* 無視 */ } }   // 終わったら、開始位置から繰り返す
          }
        }
      });
    });
    function tryPlay() {
      try { player.setVolume(Math.round(master * 100)); player.playVideo(); } catch (e) { /* 無視 */ }
      clearTimeout(check);
      check = setTimeout(function () {                                                               // しばらくたっても、再生中にならない：人の操作を待っている
        try { if (!dead && player.getPlayerState() !== 1 && player.getPlayerState() !== 3) onBlocked(true); } catch (e) { /* 無視 */ }
      }, 2500);
    }
    return {
      play: function () { want = true; if (ready) tryPlay(); },
      setVolume: function (v) { try { if (player && ready) player.setVolume(Math.round(Math.max(0, Math.min(1, v)) * 100)); } catch (e) { /* 無視 */ } },
      destroy: function () { dead = true; clearTimeout(check); try { if (player) player.destroy(); } catch (e) { /* 無視 */ } box.remove(); }
    };
  }

  // ── 音量のバー（公開のページだけ） ──
  function buildBar() {
    if (bar || !cfg.ui) return;
    var st = document.createElement("style");
    st.textContent =
      ".mp-bar{position:fixed;left:12px;bottom:12px;z-index:9999;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;" +
      "background:rgba(10,12,18,.82);color:#eceff6;font:600 13px/1 system-ui,sans-serif;border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(4px)}" +
      ".mp-bar[hidden]{display:none}.mp-bar input{width:110px;accent-color:#ffb020}.mp-bar .mp-hint{color:#ffb020}" +
      ".mp-bar button{all:unset;cursor:pointer;font-size:16px}";
    document.head.appendChild(st);
    bar = document.createElement("div");
    bar.className = "mp-bar";
    bar.hidden = true;
    var btn = document.createElement("button");
    btn.type = "button"; btn.title = "音を消す／出す"; btn.textContent = "🔊";
    var range = document.createElement("input");
    range.type = "range"; range.min = "0"; range.max = "100"; range.value = String(Math.round(master * 100)); range.setAttribute("aria-label", "音楽の音量");
    hint = document.createElement("span");
    hint.className = "mp-hint"; hint.hidden = true; hint.textContent = "タップして再生";
    var last = master;
    range.addEventListener("input", function () { master = range.value / 100; apply(); btn.textContent = master === 0 ? "🔇" : "🔊"; if (master > 0) last = master; });
    btn.addEventListener("click", function () {
      if (master > 0) { last = master; master = 0; } else { master = last || 0.2; }
      range.value = String(Math.round(master * 100)); btn.textContent = master === 0 ? "🔇" : "🔊"; apply();
    });
    bar.appendChild(btn); bar.appendChild(range); bar.appendChild(hint);
    document.body.appendChild(bar);
  }
  function apply() { if (cur) cur.ctl.setVolume(master * cur.gain); }
  // 音量を、ms ミリ秒かけて from → to に変える（切り替えのフェード用）
  function ramp(entry, from, to, ms, done) {
    var t0 = Date.now();
    (function step() {
      if (entry.dead) return;
      var k = Math.min(1, (Date.now() - t0) / ms);
      entry.gain = from + (to - from) * k;
      entry.ctl.setVolume(master * entry.gain);
      if (k < 1) setTimeout(step, 100); else if (done) done();
    })();
  }
  function kill(entry) { entry.dead = true; entry.ctl.destroy(); }

  // ── 人の操作を待つ（ブラウザが、操作の前の再生を止めたとき） ──
  function onBlocked(flag) {
    if (hint) hint.hidden = !flag;
    if (!flag) { started = true; return; }
    if (gestureBound) return;
    gestureBound = true;
    var go = function () {
      document.removeEventListener("pointerdown", go, true); document.removeEventListener("keydown", go, true);
      gestureBound = false;
      if (cur) cur.ctl.play();
    };
    document.addEventListener("pointerdown", go, true);
    document.addEventListener("keydown", go, true);
  }

  window.MusicPlayer = {
    init: function (opts) {
      cfg.ui = !!(opts && opts.ui);
      cfg.volume = opts && typeof opts.volume === "number" ? Math.max(0, Math.min(1, opts.volume)) : 1;
      master = cfg.volume;
    },
    // opts.fade：切り替えるとき、いまの音楽を小さくしながら、新しい音楽を大きくする時間（ミリ秒）
    set: function (src, opts) {
      var k = key(src), fade = opts && opts.fade > 0 ? opts.fade : 0;
      if (cur && cur.key === k) return;
      var old = cur;
      cur = null;
      if (old) {
        if (fade && src) ramp(old, old.gain, 0, fade, function () { kill(old); });
        else kill(old);
      }
      if (!src || !k) { if (bar) bar.hidden = true; return; }
      var ok = (src.kind === "youtube" && /^[A-Za-z0-9_-]{11}$/.test(src.id || "")) || (src.kind === "audio" && /^https:\/\//.test(src.url || ""));
      if (!ok) { if (bar) bar.hidden = true; return; }
      buildBar();
      if (bar) bar.hidden = false;
      var ctl = src.kind === "youtube" ? youtubeCtl(src, onBlocked) : audioCtl(src, onBlocked);
      cur = { key: k, ctl: ctl, gain: old && fade ? 0 : 1, dead: false };
      ctl.setVolume(master * cur.gain);
      ctl.play();
      if (old && fade) ramp(cur, 0, 1, fade);
    },
    volume: function () { return master; }
  };
})();
