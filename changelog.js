/* 変更履歴（✏）：BAN/PICKとトーナメント表に関わる設定の変更を、日時つきで見られる。公開のページ（トーナメント表・ルール）と、編集用のページで共通に使う。
   使い方：Changelog.update(data.changes)。データは [{t: 日時（ISO）, k: 分類, s: 文}]（新しい順）。
   3日以内の変更は、文字の色はそのままで、赤い下線をつけて目立たせる。ボタンの✏は、目立つ色（オレンジ）で、3日以内の変更があれば、赤い数字が付く。 */
(function () {
  var RECENT_MS = 3 * 24 * 60 * 60 * 1000;
  var btn = null, panel = null, items = [];
  function fmt(t) {
    var d = new Date(t);
    if (isNaN(d.getTime())) return String(t || "").replace("T", " ").slice(0, 16);
    try {
      return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    } catch (e) { return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " " + d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2); }
  }
  function isRecent(t) { var d = new Date(t).getTime(); return !isNaN(d) && Date.now() - d <= RECENT_MS; }
  function css() {
    if (document.getElementById("cl-style")) return;
    var st = document.createElement("style"); st.id = "cl-style";
    st.textContent =
      ".cl-btn{position:fixed;right:12px;top:10px;z-index:9998;display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;border:2px solid #ffb020;" +
      "background:rgba(10,12,18,.88);color:#ffb020;font:700 12px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 0 10px rgba(255,176,32,.45)}" +
      ".cl-btn[hidden]{display:none}.cl-btn b{background:#ff3b3b;color:#fff;border-radius:999px;padding:2px 7px;font-size:11px}" +
      ".cl-back{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.7);display:flex;align-items:flex-start;justify-content:center;padding:36px 14px;overflow:auto}" +
      ".cl-back[hidden]{display:none}" +
      ".cl-card{width:min(680px,100%);background:#12161f;color:#eceff6;border:2px solid #ffb020;border-radius:12px;padding:16px 18px;font:14px/1.7 system-ui,sans-serif}" +
      ".cl-card h2{margin:0 0 4px;font-size:18px;color:#ffb020}.cl-card .sub{color:#9aa3b5;font-size:12px;margin-bottom:10px}" +
      ".cl-row{padding:6px 2px;border-top:1px solid rgba(255,255,255,.12)}.cl-row .when{color:#9aa3b5;font-size:12px}" +
      ".cl-row .kind{display:inline-block;margin:0 8px;padding:0 8px;border-radius:6px;background:rgba(255,176,32,.18);color:#ffb020;font-size:12px}" +
      ".cl-row.recent .txt{text-decoration:underline;text-decoration-color:#ff3b3b;text-decoration-thickness:2px;text-underline-offset:4px;text-shadow:0 0 1px #ff3b3b}" +
      ".cl-close{margin-top:12px;padding:8px 18px;border-radius:8px;border:1px solid #6f84ad;background:#1d2433;color:#eceff6;font:inherit;cursor:pointer}";
    document.head.appendChild(st);
  }
  function build() {
    if (btn) return;
    css();
    btn = document.createElement("button"); btn.type = "button"; btn.className = "cl-btn"; btn.hidden = true;
    btn.addEventListener("click", function () { render(); panel.hidden = false; });
    panel = document.createElement("div"); panel.className = "cl-back"; panel.hidden = true;
    panel.addEventListener("click", function (e) { if (e.target === panel) panel.hidden = true; });
    document.body.appendChild(btn); document.body.appendChild(panel);
  }
  function render() {
    var card = document.createElement("div"); card.className = "cl-card";
    var h = document.createElement("h2"); h.textContent = "✏ 更新履歴"; card.appendChild(h);
    var sub = document.createElement("div"); sub.className = "sub"; sub.textContent = "BAN/PICKとトーナメント表に関わる変更の記録です（新しい順）。赤い下線は、3日以内の変更です。"; card.appendChild(sub);
    if (!items.length) { var none = document.createElement("div"); none.textContent = "まだ、変更の記録はありません。"; card.appendChild(none); }
    items.forEach(function (it) {
      var row = document.createElement("div"); row.className = "cl-row" + (isRecent(it.t) ? " recent" : "");
      var when = document.createElement("span"); when.className = "when"; when.textContent = "✏ " + fmt(it.t);
      var kind = document.createElement("span"); kind.className = "kind"; kind.textContent = it.k || "";
      var txt = document.createElement("span"); txt.className = "txt"; txt.textContent = it.s || "";
      row.appendChild(when); row.appendChild(kind); row.appendChild(txt); card.appendChild(row);
    });
    var close = document.createElement("button"); close.type = "button"; close.className = "cl-close"; close.textContent = "閉じる";
    close.addEventListener("click", function () { panel.hidden = true; });
    card.appendChild(close);
    panel.textContent = ""; panel.appendChild(card);
  }
  window.Changelog = {
    update: function (list) {
      items = Array.isArray(list) ? list.filter(function (x) { return x && typeof x === "object"; }) : [];
      build();
      var n = items.filter(function (x) { return isRecent(x.t); }).length;
      btn.textContent = "";
      btn.appendChild(document.createTextNode("✏ 更新履歴"));
      if (n) { var b = document.createElement("b"); b.textContent = String(n); btn.appendChild(b); }
      btn.hidden = !items.length;
      if (!panel.hidden) render();
    }
  };
})();
