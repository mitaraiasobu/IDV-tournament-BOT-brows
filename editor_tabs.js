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

  // ───── 🎨 デザイン ─────
  function mediaForm(el, K, c, cur, labelUrl, ph, onSave, onClear) {                // URL＋再生を始める位置の入力と、保存・消すボタン
    var ui = inp(el, cur.url, 500, ph), st = inp(el, cur.start, 12, "00:00:00（空なら最初から）"); st.style.maxWidth = "14em";
    c.appendChild(field(el, labelUrl, ui)); c.appendChild(field(el, "再生を始める位置（動画・YouTube・音楽。時:分:秒）", st));
    if (cur.text) c.appendChild(el("div", "note", "いま：" + cur.text));
    var r = el("div", "row"), sv = el("button", "primary", "💾 保存"); sv.type = "button";
    sv.addEventListener("click", function () { if (!ui.value.trim()) { K.msg("ng", "⚠ URLを入れてください（消すときは、「消す」を押します）。"); return; } onSave(ui.value, st.value); });
    var cl = el("button", "", "消す"); cl.type = "button"; cl.disabled = !cur.url; cl.addEventListener("click", function () { onClear(); });
    r.appendChild(sv); r.appendChild(cl); c.appendChild(r);
  }
  TABS.push({
    id: "dz", label: "🎨 デザイン",
    intro: "配信・ルール・トーナメント表のページの見た目（デザイン・色・背景・音楽）を決めます。Discordの「🎨 ブラウザデザイン」と同じものです。ここで押したボタンは、その場で保存されて、ページには数秒で反映されます。",
    render: function (root, K) {
      var el = K.el, D = (K.data() || {}).design || {};
      // デザイン
      var c = box(el, "🖼 デザイン（形・質感・文字の雰囲気）", "色は、下の「テーマカラー」で変えます（どのデザインでも、テーマカラーが効きます）。");
      (D.designs || []).forEach(function (d) {
        var on = d[0] === D.design, row = el("div", ""); row.style.cssText = "border:2px solid " + (on ? "var(--ac,#6f95ff)" : "var(--line)") + ";border-radius:10px;padding:8px 10px;margin:6px 0";
        var h = el("div", "", (on ? "✅ " : "") + d[1]); h.style.fontWeight = "800"; row.appendChild(h); row.appendChild(el("div", "note", d[2]));
        var b = el("button", on ? "" : "primary", on ? "いま使っています" : "このデザインにする"); b.type = "button"; b.disabled = on;
        b.addEventListener("click", function () { K.send([{ op: "design_set", design: d[0] }], "デザインを変えています…"); }); row.appendChild(b); c.appendChild(row);
      });
      root.appendChild(c);
      // テーマカラー
      var th = D.theme, tc = box(el, "🌈 テーマカラー", "ブラウザのページの色を、大会のテーマに合わせて変えます。ベース色は背景の色（明るい色なら文字が暗く、暗い色なら明るく、自動で切り替わります）。アクセント色は、タイトルの線・優勝の枠などの色です。" + (th ? "" : "いまは、標準（ダーク）です。"));
      var bi = document.createElement("input"), ai = document.createElement("input");
      bi.type = ai.type = "color"; bi.value = th ? th.base : "#0b0f1a"; ai.value = th ? th.accent : "#3b82f6"; bi.style.cssText = ai.style.cssText = "width:60px;height:40px;padding:0;border:none;background:none;cursor:pointer";
      var cr = el("div", "row"); cr.style.cssText = "align-items:center;gap:14px;flex-wrap:wrap";
      var w1 = el("label", ""); w1.style.cssText = "display:flex;align-items:center;gap:6px"; w1.appendChild(el("span", "", "ベース色")); w1.appendChild(bi);
      var w2 = el("label", ""); w2.style.cssText = "display:flex;align-items:center;gap:6px"; w2.appendChild(el("span", "", "アクセント色")); w2.appendChild(ai);
      cr.appendChild(w1); cr.appendChild(w2); tc.appendChild(cr);
      var tr = el("div", "row"), ts = el("button", "primary", "💾 色を保存"); ts.type = "button";
      ts.addEventListener("click", function () { K.send([{ op: "theme_set", base: bi.value, accent: ai.value }], "色を保存しています…"); });
      var tz = el("button", "", "標準の色に戻す"); tz.type = "button"; tz.disabled = !th; tz.addEventListener("click", function () { K.send([{ op: "theme_reset" }], "標準の色に戻しています…"); });
      tr.appendChild(ts); tr.appendChild(tz); tc.appendChild(tr); root.appendChild(tc);
      // 背景
      var bc = box(el, "🖼 背景（画像・動画・YouTube）", "URLは https:// で始まる、画像（.png .jpg .gif .webp）・動画（.mp4 .webm）のファイル、またはYouTubeのURLです（GitHubのファイルのページのURLも使えます）。動画は、音を出さずに繰り返し再生します。⚠ YouTubeは、再生ボタンなどが出てしまうことがあるので、非推奨です（自分のGitHubに動画をあげて、そのURLを入れてください）。DiscordにアップロードしたファイルのURLは、しばらくすると見られなくなります。");
      mediaForm(el, K, bc, D.bg || {}, "背景のURL", "https://…（空にすると、背景を消します）",
        function (u, s) { K.send([{ op: "bg_set", url: u, start: s }], "背景を保存しています…"); }, function () { K.send([{ op: "bg_set", url: "" }], "背景を消しています…"); });
      root.appendChild(bc);
      // 音楽
      var mc = box(el, "🎵 ブラウザ音楽（場面ごと）", "配信用の画面（OBSのブラウザソース）に、場面ごとに音楽を流します。URLは、YouTube か、音声ファイル（.mp3 .wav .ogg .m4a など）です。⚠ 音楽の利用規約・著作権に、ご注意ください。配信や大会のページで流してよいか、必ず確認してから設定してください。ブラウザによっては、ページを開いたあと、1回タップするまで、音が出ないことがあります。");
      (D.music || []).forEach(function (m) {
        var d = document.createElement("details"); d.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:6px 0"; d.open = !!K.open("mz:" + m.key); d.addEventListener("toggle", function () { K.open("mz:" + m.key, d.open); });
        var sm = document.createElement("summary"); sm.style.cursor = "pointer"; sm.textContent = (m.url ? "✅ " : "🎵 ") + m.label; d.appendChild(sm);
        mediaForm(el, K, d, m, "音楽のURL", "https://…（YouTube・音声ファイル）",
          function (u, s) { K.send([{ op: "music_set", scene: m.key, url: u, start: s }], "音楽を保存しています…"); }, function () { K.send([{ op: "music_set", scene: m.key, url: "" }], "音楽を消しています…"); });
        mc.appendChild(d);
      });
      root.appendChild(mc);
      root.appendChild(el("div", "note", "キャラがPICKされたときに出す画像・動画（衣装の設定）は、まだブラウザでは設定できません（Discordの「🎨 ブラウザデザイン」→「👗 衣装の設定」）。"));
    }
  });

  // ───── 🚫 BAN/PICKのルール ─────
  var BZ = { ban: {}, allow: {}, combo: { items: ["", ""], mode: "partial" }, req: {} };
  function chooser(el, D, faction, value, onChange, label) {                           // キャラ（サバイバー・ハンター・マップ）を選ぶ
    var list = (D.chars || {})[faction] || [], opts = [["", label || "選んでください"]].concat(list.map(function (c) { return [c[0], c[1]]; }));
    return sel(el, opts, value, onChange);
  }
  function scopePick(el, K, D, st, key) {                                              // 範囲：大会全体／ラウンド／ラウンドの1試合
    var w = el("div", ""); w.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
    var rounds = [["", "大会全体（どの試合でも）"]].concat((D.rounds || []).map(function (r) { return [r.no, r.name]; }));
    w.appendChild(sel(el, rounds, st.round || "", function (v) { st.round = v; st.match = ""; K.redraw(); }));
    if (st.round) {
      var rr = (D.rounds || []).filter(function (r) { return String(r.no) === String(st.round); })[0], ms = [["", "そのラウンドのすべての試合"]];
      for (var i = 1; i <= (rr ? rr.matches : 0); i++) ms.push([i, i + "試合目"]);
      w.appendChild(sel(el, ms, st.match || "", function (v) { st.match = v; }));
    }
    return w;
  }
  function listRows(el, K, c, rows, text, removeOp, locked) {
    if (!rows.length) { c.appendChild(el("div", "note", "（ありません）")); return; }
    rows.forEach(function (r) {
      var row = el("div", "row"); row.style.alignItems = "center";
      var t = el("span", "", text(r)); t.style.flex = "1"; row.appendChild(t);
      var d = el("button", "", "🗑 消す"); d.type = "button"; d.style.color = "#ff7070"; d.disabled = locked;
      d.addEventListener("click", function () { if (confirm("「" + text(r) + "」を消します。よろしいですか？")) K.send([removeOp(r)], "消しています…"); });
      row.appendChild(d); c.appendChild(row);
    });
  }
  TABS.push({
    id: "bz", label: "🚫 BAN/PICKのルール",
    intro: "どのキャラ・マップを、禁止・許可・必須にするか（ローカルBAN／ローカル許可／組み合わせローカルBAN／ローカル必須）を決めます。Discordの「🎯 BAN/PICK」と同じものです。ここで押したボタンは、その場で保存されます。手順（誰が何をBAN/PICKするか）は、「🎯 BAN/PICKの手順」のタブです。",
    render: function (root, K) {
      var el = K.el, D = (K.data() || {}).bprules || {}, locked = !!D.locked;
      if (locked) root.appendChild(el("div", "note", "⚠ この大会は終了しているので、BAN/PICKのルールは変えられません。"));
      if (!D.enabled) root.appendChild(el("div", "note", "※ いまは、「⚙ 大会設定」で、BAN/PICKを「使わない」にしています（ルールは、使うときに効きます）。"));
      function banBlock(kind, title, note, rows) {
        var c = box(el, title, note), st = BZ[kind];
        listRows(el, K, c, rows, function (r) { return r.item + "　（" + r.scope + "）"; }, function (r) { return { op: "bpr_ban_remove", kind: kind, id: r.id }; }, locked);
        var chs = el("div", ""); chs.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:8px";
        ["survivor", "hunter", "map"].forEach(function (f) {
          var lbl = { survivor: "サバイバーを選ぶ", hunter: "ハンターを選ぶ", map: "マップを選ぶ" }[f];
          chs.appendChild(chooser(el, D, f, st.faction === f ? st.item : "", function (v) { st.item = v; st.faction = v ? f : ""; K.redraw(); }, lbl));
        });
        c.appendChild(field(el, "足すもの（どれか1つ）", chs));
        c.appendChild(field(el, "範囲", scopePick(el, K, D, st)));
        var r = el("div", "row"), b = el("button", "primary", "＋ 足す"); b.type = "button"; b.disabled = locked;
        b.addEventListener("click", function () { if (!st.item) { K.msg("ng", "⚠ キャラ・マップを選んでください。"); return; } var o = { op: "bpr_ban_add", kind: kind, item: st.item, round: st.round || "", match: st.match || "" }; st.item = ""; st.faction = ""; K.send([o], "足しています…"); });
        r.appendChild(b); c.appendChild(r); root.appendChild(c);
      }
      banBlock("ban", "🚫 ローカルBAN（この大会で、絶対に選べない）", "キャラ・マップを指定します。範囲は、大会全体・ラウンド・ラウンドの1試合から選べます。ローカル許可・ローカル必須と、同じ試合で重なる指定はできません。", D.ban || []);
      banBlock("allow", "✅ ローカル許可（いつでも使えて、BANもされない）", "BANされたくない（いつでも使いたい）キャラ・マップを指定します。", D.allow || []);
      // 組み合わせ
      var cc = box(el, "🧩 組み合わせローカルBAN（サバイバーの組み合わせを禁止）", "2〜4キャラ。「部分一致」は、指定したキャラが全員そろったらだめ。「完全一致」は、指定した組み合わせと全く同じ編成だけだめ（3キャラ以上のとき）。ハンターは、1人しか出ないので、指定できません。");
      listRows(el, K, cc, D.combo || [], function (r) { return r.items.join("・") + "　（" + (r.mode === "exact" ? "完全一致" : "部分一致") + "／" + r.scope + "）"; }, function (r) { return { op: "bpr_combo_remove", id: r.id }; }, locked);
      var st = BZ.combo;
      for (var i = 0; i < st.items.length; i++) (function (i) {
        cc.appendChild(field(el, (i + 1) + "人目", chooser(el, D, "survivor", st.items[i], function (v) { st.items[i] = v; }, "サバイバーを選ぶ")));
      })(i);
      var cr = el("div", "row");
      var more = el("button", "", "＋ 1人増やす"); more.type = "button"; more.disabled = st.items.length >= 4; more.addEventListener("click", function () { st.items.push(""); K.redraw(); });
      var less = el("button", "", "− 1人減らす"); less.type = "button"; less.disabled = st.items.length <= 2; less.addEventListener("click", function () { st.items.pop(); K.redraw(); });
      cr.appendChild(more); cr.appendChild(less); cc.appendChild(cr);
      cc.appendChild(field(el, "一致の種類", sel(el, [["partial", "部分一致"], ["exact", "完全一致"]], st.mode, function (v) { st.mode = v; })));
      cc.appendChild(field(el, "範囲", scopePick(el, K, D, st)));
      var ar = el("div", "row"), ab = el("button", "primary", "＋ 足す"); ab.type = "button"; ab.disabled = locked;
      ab.addEventListener("click", function () {
        var ids = st.items.filter(function (x) { return x; }); if (ids.length < 2) { K.msg("ng", "⚠ 2キャラ以上、選んでください。"); return; }
        var o = { op: "bpr_combo_add", items: ids, mode: st.mode, round: st.round || "", match: st.match || "" }; st.items = ["", ""]; K.send([o], "足しています…");
      });
      ar.appendChild(ab); cc.appendChild(ar); root.appendChild(cc);
      // ローカル必須
      var rc = box(el, "📌 ローカル必須（そのキャラを、必ず使う）", "キャラを足して、ラウンドごとに「必須」「自由」を決めます（「ぜんぶ必須」「ぜんぶ自由」も押せます）。シーンごとの細かい設定（組み分けなど）は、Discordの「🎯 BAN/PICK→📌 ローカル必須」で決められます。");
      if (!(D.required || []).length) rc.appendChild(el("div", "note", "（ありません）"));
      (D.required || []).forEach(function (r) {
        var row = el("div", ""); row.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:8px;margin:6px 0";
        var on = (r.rounds || []).length ? "必須のラウンド：" + r.rounds.map(function (n) { var rr = (D.rounds || []).filter(function (x) { return x.no === n; })[0]; return rr ? rr.name : n; }).join("、") : "いまは、どのラウンドも自由";
        var h = el("div", "", r.item); h.style.fontWeight = "800"; row.appendChild(h); row.appendChild(el("div", "note", on + ((r.groups || []).length ? "（組み分けあり：Discordで設定）" : "")));
        var br = el("div", "row");
        var all = el("button", "primary", "ぜんぶ必須"); all.type = "button"; all.disabled = locked; all.addEventListener("click", function () { K.send([{ op: "bpr_req_all", id: r.id, state: "req" }], "必須にしています…"); });
        var fr = el("button", "", "ぜんぶ自由"); fr.type = "button"; fr.disabled = locked; fr.addEventListener("click", function () { K.send([{ op: "bpr_req_all", id: r.id, state: "free" }], "自由にしています…"); });
        br.appendChild(all); br.appendChild(fr);
        (D.rounds || []).forEach(function (rd) {
          var isReq = (r.rounds || []).indexOf(rd.no) >= 0, b = el("button", isReq ? "primary" : "", (isReq ? "✅ " : "") + rd.name); b.type = "button"; b.disabled = locked;
          b.title = isReq ? "押すと、このラウンドを自由にします" : "押すと、このラウンドを必須にします";
          b.addEventListener("click", function () { K.send([{ op: "bpr_req_all", id: r.id, state: isReq ? "free" : "req", round: rd.no }], "変えています…"); });
          br.appendChild(b);
        });
        var dl = el("button", "", "🗑 ローカル必須から外す"); dl.type = "button"; dl.style.color = "#ff7070"; dl.disabled = locked;
        dl.addEventListener("click", function () { if (confirm("「" + r.item + "」を、ローカル必須から外します。よろしいですか？")) K.send([{ op: "bpr_req_remove", id: r.id }], "外しています…"); });
        br.appendChild(dl); row.appendChild(br);
        var sd = document.createElement("details"); sd.style.marginTop = "6px"; sd.open = !!K.open("rq:" + r.id); sd.addEventListener("toggle", function () { K.open("rq:" + r.id, sd.open); });
        var ss = document.createElement("summary"); ss.style.cursor = "pointer"; ss.textContent = "🔧 シーンごとに決める（必須・自由・組A〜E）"; sd.appendChild(ss);
        sd.appendChild(el("div", "note", "組（A〜E）にしたシーンは、そのうち決めた回数だけ、使えばよくなります（例：組Aを3シーンにして、必要回数2＝3シーンのうち2回使う）。"));
        var stOpts = [["free", "自由"], ["req", "必須"]].concat((D.letters || []).map(function (g) { return [g, "組" + g]; }));
        (r.scenes || []).forEach(function (sc) {
          var w = el("div", "row"); w.style.alignItems = "center";
          var lb = el("span", "", sc.label); lb.style.cssText = "flex:1;min-width:9em"; w.appendChild(lb);
          var sl = sel(el, stOpts, sc.state, function (v) { K.send([{ op: "bpr_req_scene", id: r.id, key: sc.key, state: v }], "シーンを変えています…"); }); sl.disabled = locked; w.appendChild(sl);
          sd.appendChild(w);
        });
        (r.groups || []).forEach(function (g) {
          var w = el("div", "row"); w.style.alignItems = "center";
          w.appendChild(el("span", "", "組" + g + "の必要回数（" + ((r.sizes || {})[g] || 1) + "シーンのうち）"));
          var opts = []; for (var n = 1; n <= ((r.sizes || {})[g] || 1); n++) opts.push([n, n + "回"]);
          var gs = sel(el, opts, (r.counts || {})[g] || 1, function (v) { K.send([{ op: "bpr_req_group", id: r.id, letter: g, n: v }], "必要回数を変えています…"); }); gs.disabled = locked;
          w.appendChild(gs); sd.appendChild(w);
        });
        row.appendChild(sd); rc.appendChild(row);
      });
      var rst = BZ.req, rrw = el("div", ""); rrw.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:8px";
      ["survivor", "hunter"].forEach(function (f) {
        rrw.appendChild(chooser(el, D, f, rst.faction === f ? rst.item : "", function (v) { rst.item = v; rst.faction = v ? f : ""; K.redraw(); }, f === "survivor" ? "サバイバーを選ぶ" : "ハンターを選ぶ"));
      });
      rc.appendChild(field(el, "足すキャラ", rrw));
      var rr2 = el("div", "row"), rb = el("button", "primary", "＋ ローカル必須に足す"); rb.type = "button"; rb.disabled = locked;
      rb.addEventListener("click", function () { if (!rst.item) { K.msg("ng", "⚠ キャラを選んでください。"); return; } var o = { op: "bpr_req_add", item: rst.item }; rst.item = ""; rst.faction = ""; K.send([o], "足しています…"); });
      rr2.appendChild(rb); rc.appendChild(rr2); root.appendChild(rc);
      // グローバルBAN（前のセットで使ったキャラを、あとのセットで使えない）
      var gc = box(el, "🔁 グローバルBAN（前のセットで使ったキャラは、あとのセットで使えない）", "ラウンドごと・セットごとに、サバイバー・ハンターそれぞれ、オン／オフを決めます（第1セットは、前のセットが無いので、ありません）。「積み上がる上限」は、どのセットまでに使ったキャラを数えるかです。");
      (D.norepeat || []).forEach(function (rd) {
        var w = el("div", ""); w.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:8px;margin:6px 0";
        var h = el("div", "", rd.name); h.style.fontWeight = "800"; w.appendChild(h);
        (rd.slots || []).forEach(function (sl) {
          var row = el("div", "row"); row.style.alignItems = "center";
          var lb = el("span", "", sl.label); lb.style.cssText = "min-width:6em"; row.appendChild(lb);
          [["survivor", "サバイバー"], ["hunter", "ハンター"]].forEach(function (t) {
            var on = !!sl[t[0]], b = el("button", on ? "primary" : "", (on ? "🔒 " : "— ") + t[1]); b.type = "button"; b.disabled = locked;
            b.title = on ? "押すと、オフにします" : "押すと、オンにします";
            b.addEventListener("click", function () { K.send([{ op: "bpr_norepeat", round: rd.round, slot: sl.key, target: t[0], on: !on }], "変えています…"); });
            row.appendChild(b);
          });
          w.appendChild(row);
        });
        var r2 = el("div", "row"); r2.style.alignItems = "center";
        var bo = el("button", "", "このラウンドを全部オン"); bo.type = "button"; bo.disabled = locked; bo.addEventListener("click", function () { K.send([{ op: "bpr_norepeat_bulk", round: rd.round, on: true }], "変えています…"); });
        var bf = el("button", "", "全部オフ"); bf.type = "button"; bf.disabled = locked; bf.addEventListener("click", function () { K.send([{ op: "bpr_norepeat_bulk", round: rd.round, on: false }], "変えています…"); });
        r2.appendChild(bo); r2.appendChild(bf);
        var uo = [["all", "延長戦まで全部"]]; for (var n = 1; n <= (rd.sets || 1); n++) uo.push([n, "第" + n + "セットまで"]);
        r2.appendChild(el("span", "note", "積み上がる上限："));
        var us = sel(el, uo, rd.until == null ? "all" : rd.until, function (v) { K.send([{ op: "bpr_until", round: rd.round, until: v }], "変えています…"); }); us.disabled = locked; r2.appendChild(us);
        w.appendChild(r2); gc.appendChild(w);
      });
      root.appendChild(gc);
    }
  });

  // ───── 🎙 スタッフ・日程 ─────
  var SF = { dates: null, times: null };
  TABS.push({
    id: "sf", label: "🎙 スタッフ・日程",
    intro: "選手・キャスター・モデレーターの応募で聞く「参加できる日・時間帯」の候補と、キャスター・モデレーターの応募の一覧（採用・不採用）です。応募を受け付けるか・締切は、「⚙ 大会設定」で決めます。採用・不採用は、Discordのボタンと同じ処理（ロールの付与・お知らせ）を、BOTがします。",
    render: function (root, K) {
      var el = K.el, D = (K.data() || {}).staff || {};
      // 候補日・時間帯
      var c = box(el, "📅 参加できる日・時間帯の候補", "1行に1つ（または「、」で区切る）。例：2026-12-05 ／ 夜（20時〜）。空にすると、聞きません。");
      function area(key, rows) {
        var t = document.createElement("textarea"); t.rows = rows; t.style.cssText = "width:100%;font-size:16px;padding:8px";
        t.value = SF[key] != null ? SF[key] : (D[key] || []).join("\n"); t.addEventListener("input", function () { SF[key] = t.value; }); return t;
      }
      c.appendChild(field(el, "候補日", area("dates", 5))); c.appendChild(field(el, "候補の時間帯", area("times", 3)));
      var r = el("div", "row"), sv = el("button", "primary", "💾 候補を保存"); sv.type = "button";
      function split(t) { return String(t || "").split(/[\n、,]/).map(function (x) { return x.trim(); }).filter(Boolean); }
      sv.addEventListener("click", function () {
        var d = split(SF.dates != null ? SF.dates : (D.dates || []).join("\n")), t2 = split(SF.times != null ? SF.times : (D.times || []).join("\n"));
        SF.dates = SF.times = null; K.send([{ op: "staff_calendar", dates: d, times: t2 }], "候補を保存しています…");
      });
      r.appendChild(sv); c.appendChild(r); root.appendChild(c);
      // 応募
      ["caster", "moderator"].forEach(function (kind) {
        var k = (D.kinds || {})[kind]; if (!k) return;
        var apps = k.apps || [], pend = apps.filter(function (a) { return a.status === "pending"; }).length;
        var b = box(el, (kind === "caster" ? "🎙 " : "🛡 ") + k.label + "の応募（" + apps.length + "件・審査中" + pend + "件）", k.enabled ? "" : "※ いまは、「⚙ 大会設定」で、応募を受け付けていません。");
        if (!apps.length) b.appendChild(el("div", "note", "（まだ応募はありません）"));
        apps.forEach(function (a) {
          var row = el("details", ""); row.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:6px 0"; row.open = a.status === "pending";
          var sm = document.createElement("summary"); sm.style.cursor = "pointer"; sm.textContent = a.name + "　［" + ((D.status || {})[a.status] || a.status) + (a.queued ? "・処理待ち" : "") + "］"; row.appendChild(sm);
          var lines = [];
          if (a.role) lines.push("希望：" + a.role); if (a.sex) lines.push("身体的性別：" + a.sex);
          lines.push("志望動機：" + (a.message || "（なし）")); lines.push("経験：" + (a.exp ? "あり" + (a.exp_detail ? "（" + a.exp_detail + "）" : "") : "なし"));
          if ((a.dates || []).length) lines.push("参加できる日：" + a.dates.join("、")); if ((a.times || []).length) lines.push("時間帯：" + a.times.join("、"));
          lines.forEach(function (t) { var d = el("div", "", t); d.style.cssText = "font-size:14px;margin:2px 0;white-space:pre-wrap"; row.appendChild(d); });
          if (a.status === "pending") {
            var br = el("div", "row"), ok = el("button", "primary", "✅ 採用する"), ng = el("button", "", "❌ 不採用にする"); ok.type = ng.type = "button"; ok.disabled = ng.disabled = !!a.queued;
            ok.addEventListener("click", function () { if (confirm(a.name + " さんを採用します（ロールの付与・お知らせが、BOTから行われます）。よろしいですか？")) K.send([{ op: "staff_decide", app: a.id, adopt: true }], "採用を頼んでいます…"); });
            ng.addEventListener("click", function () { if (confirm(a.name + " さんを不採用にします（DMでお知らせします）。よろしいですか？")) K.send([{ op: "staff_decide", app: a.id, adopt: false }], "不採用を頼んでいます…"); });
            br.appendChild(ok); br.appendChild(ng); row.appendChild(br);
          }
          b.appendChild(row);
        });
        root.appendChild(b);
      });
    }
  });

  window.EDX = (window.EDX || []).concat(TABS);
  window.EDX_UI = { box: box, field: field, sel: sel, inp: inp };                  // ほかのタブ（あとで足すもの）が使う、小さな部品
})();
