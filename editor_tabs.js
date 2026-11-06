/* 大会設定ブラウザの、追加のタブ（賞品・ポイント／デザイン／BAN/PICKのルール設定 など）。
   editor.html が読み込んで、タブとして並べる。各タブは { id, label, intro, render(box, K) }。
   K＝editor.html が渡す道具：K.el（要素を作る）／K.data()（BOTのデータ）／K.send(ops, 文)（保存して、最新を読み直す）／K.msg(種類, 文)／K.busy()（保存中か）。
   ここで押すボタンは、その場で保存する（画面の上の「💾 保存」を押さなくていい）。ほかのタブに保存していない変更があるときは、先に保存するよう言う。 */
(function () {
  "use strict";
  var TABS = [];
  function box(el, title, note) {                                                    // 見出しつきの枠
    var c = el("div", "card"); c.style.marginTop = "10px";
    var h = el("div", ""); h.style.fontWeight = "800"; h.textContent = title; c.appendChild(h);
    if (note) c.appendChild(el("div", "note", note));
    return c;
  }
  function field(el, label, node) {
    var w = el("div", ""); w.style.cssText = "margin:6px 0";
    w.appendChild(el("div", "note", label)); w.appendChild(node); return w;
  }
  function sel(el, options, value, onChange) {                                       // options: [[値, 表示]…]
    var s = document.createElement("select"); s.style.cssText = "font-size:16px;padding:8px;max-width:100%";
    options.forEach(function (o) { var x = document.createElement("option"); x.value = o[0]; x.textContent = o[1]; if (String(o[0]) === String(value)) x.selected = true; s.appendChild(x); });
    s.addEventListener("change", function () { onChange(s.value); }); return s;
  }
  function inp(el, value, max, ph) {
    var i = document.createElement("input"); i.type = "text"; i.maxLength = max || 200; i.value = value || ""; i.placeholder = ph || ""; i.style.cssText = "width:100%;font-size:16px;padding:8px"; return i;
  }

  // ───── 🎁 賞品・ポイント ─────
  var PZ = { rank: "1", target: "", character: "", text: "" };
  TABS.push({
    id: "pz", label: "🎁 賞品・ポイント",
    intro: "賞品（どのチーム・どの選手に、何を渡すか）と、吊り・逃げのポイント表を決めます。Discordの「⚙ 基本設定→🎁 賞品設定」「吊/逃ポイント」と同じものです。ここで押したボタンは、その場で保存されます。賞品は、大会ルールの「🎁 賞品」ページに、自動で入ります。",
    render: function (root, K) {
      var el = K.el, D = (K.data() || {}).prizes || {}, locked = !!D.locked;
      if (locked) root.appendChild(el("div", "note", "⚠ この大会は終了しているので、賞品・ポイントは変えられません。"));
      // 賞品の一覧
      var c = box(el, "🎁 賞品", "順位・対象を変えたいときは、消して、足し直します（内容の文だけは、その場で直せます）。");
      var rows = D.rows || [];
      if (!rows.length) c.appendChild(el("div", "note", "（賞品は、まだありません）"));
      ["1", "2", "any", ""].forEach(function (rk) {
        var list = rows.filter(function (r) { return (r.rank || "") === rk; });
        if (!list.length) return;
        var title = rk ? (D.ranks || {})[rk] : "🏆 MVP";
        var h = el("div", ""); h.style.cssText = "font-weight:800;margin-top:10px"; h.textContent = title; c.appendChild(h);
        list.forEach(function (r) {
          var row = el("div", ""); row.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:8px;margin:6px 0";
          var who = r.kind === "rank_character" ? (r.character_name || "指定のキャラ") + "を使用した選手" : ((D.targets || {})[r.kind] || r.kind);
          row.appendChild(el("div", "note", "受け取り：" + who));
          var ti = inp(el, r.text, D.text_max || 200); ti.disabled = locked; row.appendChild(ti);
          var br = el("div", "row");
          var sv = el("button", "primary", "💾 内容を直す"); sv.type = "button"; sv.disabled = locked;
          sv.addEventListener("click", function () { if (!ti.value.trim()) { K.msg("ng", "⚠ 賞品の内容を入れてください。"); return; } K.send([{ op: "prize_edit", id: r.id, text: ti.value }], "賞品を直しています…"); });
          var dl = el("button", "", "🗑 消す"); dl.type = "button"; dl.style.color = "#ff7070"; dl.disabled = locked;
          dl.addEventListener("click", function () { if (confirm("この賞品を消します。よろしいですか？\n（" + who + "：" + r.text + "）")) K.send([{ op: "prize_remove", id: r.id }], "賞品を消しています…"); });
          br.appendChild(sv); br.appendChild(dl); row.appendChild(br); c.appendChild(row);
        });
      });
      root.appendChild(c);
      // 賞品を足す
      var a = box(el, "＋ 賞品を足す");
      var ranks = Object.keys(D.ranks || {}).map(function (k) { return [k, D.ranks[k]]; });
      if (D.mvp) ranks.push(["mvp", "🏆 MVP"]);
      var isMvp = PZ.rank === "mvp";
      var targets = Object.keys(D.targets || {}).filter(function (k) { return isMvp ? k.indexOf("mvp_") === 0 : k.indexOf("rank_") === 0; }).map(function (k) { return [k, D.targets[k]]; });
      if (!targets.some(function (t) { return t[0] === PZ.target; })) PZ.target = targets.length ? targets[0][0] : "";
      a.appendChild(field(el, "どのチーム（MVP）への賞品か", sel(el, ranks, PZ.rank, function (v) { PZ.rank = v; PZ.target = ""; K.redraw(); })));
      a.appendChild(field(el, "どんな受け取り方か", sel(el, targets, PZ.target, function (v) { PZ.target = v; K.redraw(); })));
      if (PZ.target === "rank_character") {
        var hs = (D.hunters || []).map(function (h) { return [h[0], h[1]]; });
        if (!PZ.character && hs.length) PZ.character = hs[0][0];
        a.appendChild(field(el, "対象のハンターキャラ", sel(el, hs, PZ.character, function (v) { PZ.character = v; })));
      }
      var ti2 = inp(el, PZ.text, D.text_max || 200, "例：イタカe-sportsパック"); ti2.addEventListener("input", function () { PZ.text = ti2.value; });
      a.appendChild(field(el, "賞品の内容（自由記述・" + (D.text_max || 200) + "字まで）", ti2));
      var ar = el("div", "row"), ab = el("button", "primary", "＋ 賞品を足す"); ab.type = "button"; ab.disabled = locked;
      ab.addEventListener("click", function () {
        if (!PZ.text.trim()) { K.msg("ng", "⚠ 賞品の内容を入れてください。"); return; }
        var op = { op: "prize_add", target: PZ.target, text: PZ.text };
        if (PZ.rank !== "mvp") op.rank = PZ.rank;
        if (PZ.target === "rank_character") op.character = PZ.character;
        PZ.text = ""; K.send([op], "賞品を足しています…");
      });
      ar.appendChild(ab); a.appendChild(ar);
      if (!D.mvp) a.appendChild(el("div", "note", "MVPへの賞品を決めるには、「⚙ 大会設定」で、MVPを「使う」にしてください。"));
      root.appendChild(a);
      // 吊/逃ポイント
      var p = D.points || { table: {}, default: {} };
      var pc = box(el, "🏁 吊り・逃げのポイント", "サバイバーは逃げた人数、ハンターは吊った人数で、もらえるポイントが決まります（全セットのポイントの合計で、勝ち負けを決めます）。" + (p.is_default ? "いまは、標準の表です。" : "いまは、この大会で決めた表です。"));
      var grid = el("div", ""); grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin:8px 0";
      var ins = {};
      [0, 1, 2, 3, 4].forEach(function (n) {
        var w = el("label", ""); w.style.cssText = "display:flex;flex-direction:column;gap:2px;font-size:13px";
        w.appendChild(el("span", "", n + "人"));
        var i = document.createElement("input"); i.type = "number"; i.min = 0; i.max = 999; i.step = 1; i.value = (p.table || {})[String(n)]; i.disabled = locked; i.style.cssText = "font-size:16px;padding:8px;width:100%";
        ins[n] = i; w.appendChild(i); w.appendChild(el("span", "note", "標準：" + (p.default || {})[String(n)] + "ポイント")); grid.appendChild(w);
      });
      pc.appendChild(grid);
      var pr = el("div", "row"), ps = el("button", "primary", "💾 ポイント表を保存"); ps.type = "button"; ps.disabled = locked;
      ps.addEventListener("click", function () {
        var t = {}; for (var n = 0; n <= 4; n++) { var v = ins[n].value.trim(); if (!/^\d{1,3}$/.test(v)) { K.msg("ng", "⚠ " + n + "人のポイントは、0〜999の整数で入れてください。"); return; } t[String(n)] = parseInt(v, 10); }
        K.send([{ op: "points_set", table: t }], "ポイント表を保存しています…");
      });
      var pd = el("button", "", "標準に戻す"); pd.type = "button"; pd.disabled = locked || !!p.is_default;
      pd.addEventListener("click", function () { if (confirm("ポイント表を、標準に戻します。よろしいですか？")) K.send([{ op: "points_reset" }], "標準に戻しています…"); });
      pr.appendChild(ps); pr.appendChild(pd); pc.appendChild(pr); root.appendChild(pc);
    }
  });

  window.EDX = (window.EDX || []).concat(TABS);
  window.EDX_UI = { box: box, field: field, sel: sel, inp: inp };                  // ほかのタブ（あとで足すもの）が使う、小さな部品
})();
