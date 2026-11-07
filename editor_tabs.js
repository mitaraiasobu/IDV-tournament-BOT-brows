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
      // 衣装
      var CD = (K.data() || {}).costumes || {}, cs = box(el, "👗 衣装の設定（キャラごと）", "キャラがPICKされたあと、選手に、どの衣装かを聞きます（「⚙ 大会設定」の「使用する衣装を聞く」がオンのとき）。衣装ごとに、PICKされたときに画面いっぱいに出す画像・動画を決められます（無ければ、何も起こりません）。1キャラ" + (CD.max || 20) + "個まで。「その他」は、最後に自動で付きます。");
      if (!CD.enabled) cs.appendChild(el("div", "note", "※ いまは、「使用する衣装を聞く」がオフです（衣装を登録しても、聞きません）。"));
      (CD.chars || []).forEach(function (ch) {
        var d = document.createElement("details"); d.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:6px 0"; d.open = !!K.open("cs:" + ch.char); d.addEventListener("toggle", function () { K.open("cs:" + ch.char, d.open); });
        var sm = document.createElement("summary"); sm.style.cursor = "pointer"; sm.textContent = ch.name + "（衣装" + ch.costumes.length + "個）"; d.appendChild(sm);
        ch.costumes.forEach(function (c) {
          var w = el("div", ""); w.style.cssText = "border-top:1px dashed var(--line);padding-top:6px;margin-top:6px";
          var h = el("div", "", "👗 " + c.name); h.style.fontWeight = "800"; w.appendChild(h);
          mediaForm(el, K, w, c.media, "PICKされたときの画像・動画のURL（空＝何も起こらない）", "https://…",
            function (u, s) { K.send([{ op: "costume_media", char: ch.char, id: c.id, url: u, start: s }], "演出を保存しています…"); },
            function () { K.send([{ op: "costume_media", char: ch.char, id: c.id, url: "" }], "演出を消しています…"); });
          var dl = el("button", "", "🗑 この衣装を消す"); dl.type = "button"; dl.style.color = "#ff7070";
          dl.addEventListener("click", function () { if (confirm("衣装「" + c.name + "」を消します。よろしいですか？")) K.send([{ op: "costume_remove", char: ch.char, id: c.id }], "消しています…"); });
          w.appendChild(dl); d.appendChild(w);
        });
        cs.appendChild(d);
      });
      var CA = K.state("costume", { char: "", name: "", url: "", start: "" }), ca = el("div", ""); ca.style.cssText = "border-top:1px solid var(--line);margin-top:10px;padding-top:8px";
      ca.appendChild(el("div", "", "＋ 衣装を足す")).style.fontWeight = "800";
      var copts = [["", "キャラを選ぶ"]].concat(((CD.pick || {}).survivor || []).map(function (c) { return [c[0], "サバイバー：" + c[1]]; })).concat(((CD.pick || {}).hunter || []).map(function (c) { return [c[0], "ハンター：" + c[1]]; }));
      ca.appendChild(field(el, "キャラ", sel(el, copts, CA.char, function (v) { CA.char = v; })));
      var ni = inp(el, CA.name, 30, "衣装の名前（例：初期衣装）"); ni.addEventListener("input", function () { CA.name = ni.value; }); ca.appendChild(field(el, "衣装の名前", ni));
      var ui2 = inp(el, CA.url, 500, "https://…（空でもよい）"); ui2.addEventListener("input", function () { CA.url = ui2.value; }); ca.appendChild(field(el, "PICKされたときの画像・動画のURL（任意）", ui2));
      var si2 = inp(el, CA.start, 12, "00:00:00"); si2.style.maxWidth = "14em"; si2.addEventListener("input", function () { CA.start = si2.value; }); ca.appendChild(field(el, "再生を始める位置（任意）", si2));
      var car = el("div", "row"), cab = el("button", "primary", "＋ 衣装を足す"); cab.type = "button";
      cab.addEventListener("click", function () { if (!CA.char || !CA.name.trim()) { K.msg("ng", "⚠ キャラと衣装の名前を入れてください。"); return; } var o = { op: "costume_add", char: CA.char, name: CA.name, url: CA.url, start: CA.start }; CA.name = ""; CA.url = ""; CA.start = ""; K.send([o], "衣装を足しています…"); });
      car.appendChild(cab); ca.appendChild(car); cs.appendChild(ca);
      if ((CD.sources || []).length) {
        var cp = el("div", ""); cp.style.cssText = "border-top:1px solid var(--line);margin-top:10px;padding-top:8px";
        cp.appendChild(el("div", "", "📥 ほかの大会から（同じDiscordサーバーの大会だけ。同じ名前の衣装は、いまのものを残します）")).style.fontWeight = "800";
        var CP = K.state("costume_copy", { from: String(CD.sources[0].tid) });
        cp.appendChild(field(el, "コピー元の大会", sel(el, CD.sources.map(function (x) { return [x.tid, x.name + "（" + x.chars + "キャラ）"]; }), CP.from, function (v) { CP.from = v; })));
        var cr2 = el("div", "row"), cb1 = el("button", "", "📥 この大会の衣装を、全部コピー"); cb1.type = "button";
        cb1.addEventListener("click", function () { K.send([{ op: "costume_copy", from: CP.from }], "コピーを頼んでいます…"); });
        var cb2 = el("button", "", "📚 全大会の衣装を、統合して適用"); cb2.type = "button";
        cb2.addEventListener("click", function () { if (confirm("このDiscordサーバーの、ほかの大会の衣装の設定を、すべて、この大会に足します。よろしいですか？")) K.send([{ op: "costume_merge" }], "統合を頼んでいます…"); });
        cr2.appendChild(cb1); cr2.appendChild(cb2); cp.appendChild(cr2); cs.appendChild(cp);
      }
      root.appendChild(cs);
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
  // ───── 🎙 スタッフ・日程：管理者ロール・情報閲覧ロール・ロールの同期 ─────
  function renderRoles(root, K) {
    var el = K.el, R = (K.data() || {}).roles || {}, RS = K.state("roles", { a: null, v: null });
    var c = box(el, "🛡 ロール", "Discordの「🎙 スタッフ設定→🛡 管理者ロール／🎙 情報閲覧ロール」「🎭 ロールの同期」と同じです。ロールの名前は、BOTが1分ごとにDiscordから読み直します（すでにあるロールから選びます）。");
    if (!R.ready) c.appendChild(el("div", "note", "⏳ ロールの一覧は、まだ届いていません（BOTが動いていれば、1分ほどで届きます。開き直してください）。"));
    var opts = [["", "（指定しない）"]].concat((R.roles || []).map(function (r) { return [r.t, "@" + r.name]; }));
    function one(key, cur, label, note, op) {
      var w = el("div", ""); w.style.margin = "8px 0";
      w.appendChild(el("div", "", label + "：いま「" + (cur.name ? "@" + cur.name : "未設定") + "」"));
      w.appendChild(el("div", "note", note));
      var o = opts.slice(); if (cur.t && !opts.some(function (x) { return x[0] === cur.t; })) o.push([cur.t, cur.name]);
      var row = el("div", "row"); row.style.cssText = "align-items:center;gap:6px;flex-wrap:wrap";
      row.appendChild(sel(el, o, RS[key] != null ? RS[key] : cur.t, function (v) { RS[key] = v; }));
      var b = el("button", "primary", "保存"); b.type = "button";
      b.addEventListener("click", function () { var v = RS[key] != null ? RS[key] : cur.t; if (v === cur.t) { K.msg("ok", "変わっていません。"); return; } if (confirm(label + "を「" + (v ? (o.filter(function (x) { return x[0] === v; })[0] || [0, ""])[1] : "指定しない") + "」にします。よろしいですか？")) { RS[key] = null; K.send([{ op: op, role: v }], "保存中…"); } });
      row.appendChild(b); w.appendChild(row); c.appendChild(w);
    }
    one("a", R.admin || {}, "管理者ロール（この大会）", "このロールの人は、真の管理者と同じように、この大会の設定・運用ができます。キャスター・モデレーターの応募が来たときの、メンション先にもなります。変えると、BOTが「BOT管理」チャンネルに知らせます。", "role_admin_set");
    one("v", R.viewer || {}, "情報閲覧ロール（全大会で共通）", "管理者のほかに、このロールの人が、選手・チームの情報を見られます。", "role_viewer_set");
    var S = R.sync || {}, sw = el("div", ""); sw.style.marginTop = "10px";
    sw.appendChild(el("div", "", "🎭 ロールの同期"));
    sw.appendChild(el("div", "note", "大会・チームのロールを用意して、登録済みの全選手に付け直します（BOTが止まっていた間の抜けなどの補修）。"));
    var sb = el("button", "", S.waiting ? "⏳ 同期しています…" : "🎭 ロールを同期する"); sb.type = "button"; sb.disabled = !!S.waiting;
    sb.addEventListener("click", function () { K.send([{ op: "role_sync" }], "頼んでいます…"); });
    sw.appendChild(sb);
    if (S.text) { var at = S.at ? new Date(S.at * 1000) : null; sw.appendChild(el("div", "note", "前回の結果" + (at ? "（" + (at.getMonth() + 1) + "/" + at.getDate() + " " + ("0" + at.getHours()).slice(-2) + ":" + ("0" + at.getMinutes()).slice(-2) + "）" : "") + "：")); var pr = el("div", ""); pr.style.cssText = "white-space:pre-wrap;font-size:14px"; pr.textContent = String(S.text).replace(/\*\*/g, ""); sw.appendChild(pr); }
    c.appendChild(sw);
    root.appendChild(c);
  }

  TABS.push({
    id: "sf", label: "🎙 スタッフ・日程",
    intro: "選手・キャスター・モデレーターの応募で聞く「参加できる日・時間帯」の候補と、キャスター・モデレーターの応募の一覧（採用・不採用）です。応募を受け付けるか・締切は、「⚙ 大会設定」で決めます。採用・不採用は、Discordのボタンと同じ処理（ロールの付与・お知らせ）を、BOTがします。",
    render: function (root, K) {
      var el = K.el, D = (K.data() || {}).staff || {};
      renderRoles(root, K);
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
      // キャスターの装飾
      var DC = (K.data() || {}).deco || {}, dc = box(el, "🎀 キャスターの装飾", "キャスター表示（OBS）で、キャスターのアイコンのまわりに付ける飾りです。キャスターは、応募のときなどに、ここに登録した装飾から選びます。画像は、透明なPNGのURL（GitHubなど、ずっと残る場所）。" + (DC.max || 20) + "個まで。");
      var bl = el("a", "", "📥 基準画像をダウンロード（真ん中の透明な穴に、アイコンが入ります）"); bl.href = DC.base_url || "#"; bl.target = "_blank"; bl.rel = "noopener"; bl.style.cssText = "display:inline-block;margin:4px 0"; dc.appendChild(bl);
      if (!(DC.items || []).length) dc.appendChild(el("div", "note", "（まだ装飾はありません）"));
      (DC.items || []).forEach(function (d) {
        var row = el("div", "row"); row.style.alignItems = "center";
        var im = document.createElement("img"); im.src = d.url; im.alt = d.name; im.style.cssText = "width:48px;height:48px;object-fit:contain;background:#000;border-radius:6px"; im.referrerPolicy = "no-referrer"; row.appendChild(im);
        var t = el("span", "", d.name); t.style.flex = "1"; row.appendChild(t);
        var x = el("button", "", "🗑 消す"); x.type = "button"; x.style.color = "#ff7070";
        x.addEventListener("click", function () { if (confirm("装飾「" + d.name + "」を消します（選んでいたキャスターは、装飾なしになります）。よろしいですか？")) K.send([{ op: "deco_remove", id: d.id }], "消しています…"); });
        row.appendChild(x); dc.appendChild(row);
      });
      var DA = K.state("deco_add", { name: "", url: "" });
      var dn = inp(el, DA.name, DC.name_max || 20, "装飾の名前（例：王冠）"); dn.addEventListener("input", function () { DA.name = dn.value; }); dc.appendChild(field(el, "装飾の名前", dn));
      var du = inp(el, DA.url, 500, "https://…（透明なPNG）"); du.addEventListener("input", function () { DA.url = du.value; }); dc.appendChild(field(el, "画像のURL", du));
      var dr = el("div", "row"), db = el("button", "primary", "＋ 装飾を足す"); db.type = "button";
      db.addEventListener("click", function () { if (!DA.name.trim() || !DA.url.trim()) { K.msg("ng", "⚠ 名前と画像のURLを入れてください。"); return; } var o = { op: "deco_add", name: DA.name, url: DA.url }; DA.name = ""; DA.url = ""; K.send([o], "装飾を足しています…"); });
      dr.appendChild(db); dc.appendChild(dr);
      if ((DC.sources || []).length) {
        var DP = K.state("deco_copy", { from: String(DC.sources[0].tid) });
        dc.appendChild(field(el, "ほかの大会から（同じDiscordサーバーの大会だけ。同じ名前の装飾は、いまのものを残します）", sel(el, DC.sources.map(function (x2) { return [x2.tid, x2.name + "（" + x2.count + "個）"]; }), DP.from, function (v) { DP.from = v; })));
        var dr2 = el("div", "row"), dk = el("button", "", "📥 この大会の装飾をコピー"), dm = el("button", "", "📚 全大会の装飾を統合して適用"); dk.type = dm.type = "button";
        dk.addEventListener("click", function () { K.send([{ op: "deco_copy", from: DP.from }], "コピーを頼んでいます…"); });
        dm.addEventListener("click", function () { if (confirm("このDiscordサーバーの、ほかの大会の装飾を、すべて、この大会に足します。よろしいですか？")) K.send([{ op: "deco_merge" }], "統合を頼んでいます…"); });
        dr2.appendChild(dk); dr2.appendChild(dm); dc.appendChild(dr2);
      }
      root.appendChild(dc);
      // OBSの追加のCSS
      var oc = box(el, "🎬 キャスター表示（OBS）の追加のCSS", "キャスター表示のページのCSSの最後に付けます（文字の大きさ・色などを、細かく変えたいとき）。空にすると、消えます。場面ごとの配置は、キャスター表示の位置調整ページで変えられます。");
      var OC = K.state("overlay_css", { css: null });
      var ta = document.createElement("textarea"); ta.rows = 8; ta.maxLength = DC.css_max || 3900; ta.style.cssText = "width:100%;font-family:monospace;font-size:14px"; ta.value = OC.css != null ? OC.css : (DC.css || "");
      ta.addEventListener("input", function () { OC.css = ta.value; }); oc.appendChild(ta);
      var or = el("div", "row"), ob = el("button", "primary", "💾 CSSを保存"); ob.type = "button";
      ob.addEventListener("click", function () { var v = OC.css != null ? OC.css : (DC.css || ""); OC.css = null; K.send([{ op: "overlay_css", css: v }], "CSSを保存しています…"); });
      or.appendChild(ob); oc.appendChild(or); root.appendChild(oc);
    }
  });

  // ───── 📮 投稿（予約投稿・アンケート） ─────
  function dt(v) { return String(v || "").slice(0, 16); }                             // 2026-11-03T20:00 の形（日時の入力欄）
  function soon() { var d = new Date(Date.now() + 2 * 60000); d.setSeconds(0, 0); var p = function (n) { return ("0" + n).slice(-2); }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()); }
  function dtInput(value, onChange) { var i = document.createElement("input"); i.type = "datetime-local"; i.value = dt(value); i.style.cssText = "font-size:16px;padding:8px"; i.addEventListener("change", function () { onChange(i.value); }); return i; }
  function chanPicker(el, D, chosen, onChange) {                                      // チャンネルを選ぶ（いくつでも）
    var w = el("div", ""); w.style.cssText = "max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px";
    if (!(D.channels || []).length) w.appendChild(el("div", "note", D.ready ? "（チャンネルがありません）" : "チャンネルの一覧を、BOTから受け取っています（1分ほどで出ます。「最新を読み込む」を押してください）。"));
    var lastCat = null;
    (D.channels || []).forEach(function (c) {
      if (c.cat !== lastCat) { lastCat = c.cat; var h = el("div", "note", c.cat || "（カテゴリなし）"); h.style.marginTop = "4px"; w.appendChild(h); }
      var l = el("label", ""); l.style.cssText = "display:flex;gap:6px;align-items:center;padding:2px 0";
      var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = chosen.indexOf(c.t) >= 0;
      cb.addEventListener("change", function () { var k = chosen.indexOf(c.t); if (cb.checked && k < 0) chosen.push(c.t); if (!cb.checked && k >= 0) chosen.splice(k, 1); onChange && onChange(); });
      l.appendChild(cb); l.appendChild(el("span", "", "#" + c.name)); w.appendChild(l);
    });
    return w;
  }
  TABS.push({
    id: "ps", label: "📮 投稿",
    intro: "予約投稿（決めた日時に、決めたチャンネルへ、BOTが送る）と、アンケート（選手・キャスター・選んだチャンネルへ）です。Discordの「📮 投稿」と同じものです。アンケートは、ブラウザからは予約で送ります（すぐ送るときは「約2分後」を押してください）。",
    render: function (root, K) {
      var el = K.el, D = (K.data() || {}).posts || {};
      // 予約投稿
      var c = box(el, "📅 予約投稿（まだ送っていないもの：" + (D.posts || []).length + "件）");
      (D.posts || []).forEach(function (p) {
        var E = K.state("post_" + p.id, { content: p.content, send_at: dt(p.send_at), channels: (p.channels || []).slice(), live: !!p.live });
        var d = document.createElement("details"); d.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:6px 0"; d.open = !!K.open("ps:" + p.id); d.addEventListener("toggle", function () { K.open("ps:" + p.id, d.open); });
        var sm = document.createElement("summary"); sm.style.cursor = "pointer"; sm.textContent = dt(p.send_at).replace("T", " ") + "　→ " + p.targets + "　" + p.content.slice(0, 30) + (p.note ? "　⚠" + p.note : ""); d.appendChild(sm);
        d.appendChild(field(el, "送る日時", dtInput(E.send_at, function (v) { E.send_at = v; })));
        var ta = document.createElement("textarea"); ta.rows = 5; ta.maxLength = D.content_max || 1900; ta.value = E.content; ta.style.cssText = "width:100%;font-size:16px"; ta.addEventListener("input", function () { E.content = ta.value; }); d.appendChild(field(el, "本文", ta));
        d.appendChild(field(el, "送るチャンネル", chanPicker(el, D, E.channels)));
        var lr = el("label", ""); lr.style.cssText = "display:flex;gap:6px;align-items:center"; var lc = document.createElement("input"); lc.type = "checkbox"; lc.checked = E.live; lc.addEventListener("change", function () { E.live = lc.checked; }); lr.appendChild(lc); lr.appendChild(el("span", "", "送る時刻に、試合をしている対戦カードのチャンネル全部にも送る")); d.appendChild(lr);
        var r = el("div", "row"), sv2 = el("button", "primary", "💾 直す"), cx = el("button", "", "🗑 予約を取り消す"); sv2.type = cx.type = "button"; cx.style.color = "#ff7070";
        sv2.addEventListener("click", function () { K.send([{ op: "post_update", id: p.id, content: E.content, send_at: E.send_at, channels: E.channels, live: E.live }], "直しています…"); });
        cx.addEventListener("click", function () { if (confirm("この予約投稿を取り消します。よろしいですか？")) K.send([{ op: "post_cancel", id: p.id }], "取り消しています…"); });
        r.appendChild(sv2); r.appendChild(cx); d.appendChild(r); c.appendChild(d);
      });
      var N = K.state("post_new", { content: "", send_at: "", channels: [], live: false }), nw = el("div", ""); nw.style.cssText = "border-top:1px solid var(--line);margin-top:8px;padding-top:8px";
      nw.appendChild(el("div", "", "＋ 新しい予約投稿")).style.fontWeight = "800";
      nw.appendChild(field(el, "送る日時", dtInput(N.send_at, function (v) { N.send_at = v; })));
      var nt = document.createElement("textarea"); nt.rows = 5; nt.maxLength = D.content_max || 1900; nt.value = N.content; nt.style.cssText = "width:100%;font-size:16px"; nt.placeholder = "送るメッセージ（" + (D.content_max || 1900) + "文字まで）"; nt.addEventListener("input", function () { N.content = nt.value; }); nw.appendChild(field(el, "本文", nt));
      nw.appendChild(field(el, "送るチャンネル", chanPicker(el, D, N.channels)));
      var nl = el("label", ""); nl.style.cssText = "display:flex;gap:6px;align-items:center"; var nc = document.createElement("input"); nc.type = "checkbox"; nc.checked = N.live; nc.addEventListener("change", function () { N.live = nc.checked; }); nl.appendChild(nc); nl.appendChild(el("span", "", "送る時刻に、試合をしている対戦カードのチャンネル全部にも送る")); nw.appendChild(nl);
      var nr = el("div", "row"), nb = el("button", "primary", "📅 この内容で予約する"); nb.type = "button";
      nb.addEventListener("click", function () { if (!N.send_at || !N.content.trim()) { K.msg("ng", "⚠ 送る日時と本文を入れてください。"); return; } if (!N.channels.length && !N.live) { K.msg("ng", "⚠ 送るチャンネルを選んでください。"); return; } var o = { op: "post_create", content: N.content, send_at: N.send_at, channels: N.channels.slice(), live: N.live }; N.content = ""; N.channels.length = 0; K.send([o], "予約しています…"); });
      nr.appendChild(nb); nw.appendChild(nr); c.appendChild(nw);
      if ((D.done || []).length) { var dd = document.createElement("details"); dd.style.marginTop = "8px"; var ds = document.createElement("summary"); ds.textContent = "送った・送れなかった予約（最近）"; dd.appendChild(ds); D.done.forEach(function (x) { dd.appendChild(el("div", "note", dt(x.send_at).replace("T", " ") + "［" + (x.status === "sent" ? "送った" : "送れなかった") + "］→ " + x.targets + "：" + x.content.slice(0, 40) + (x.note ? "（" + x.note + "）" : ""))); }); c.appendChild(dd); }
      root.appendChild(c);
      // アンケート
      var sc = box(el, "📣 アンケート（" + (D.surveys || []).length + "件）");
      (D.surveys || []).forEach(function (s) {
        var E = K.state("sv_" + s.id, { question: s.question, options: (s.options || []).join("\n"), multi: s.multi, ask: s.ask, deadline: dt(s.deadline), send_at: dt(s.send_at) });
        var d = document.createElement("details"); d.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:6px 0"; d.open = !!K.open("sv:" + s.id); d.addEventListener("toggle", function () { K.open("sv:" + s.id, d.open); });
        var st = s.scheduled ? "📅 " + dt(s.send_at).replace("T", " ") + " に送る予約" + (s.error ? "（⚠ " + s.error + "）" : "") : s.closed ? "締め切り" : "送信済み";
        var sm = document.createElement("summary"); sm.style.cursor = "pointer"; sm.textContent = "［" + st + "］" + s.question.slice(0, 40) + "　→ " + s.target + "　回答" + s.voters + "人"; d.appendChild(sm);
        if (s.kind === "choice") { var cs = el("div", "note", "集計：" + Object.keys(s.counts || {}).map(function (k) { return k + " " + s.counts[k] + "人"; }).join("／")); d.appendChild(cs); }
        else if ((s.texts || []).length) { var tx = document.createElement("details"); var tsum = document.createElement("summary"); tsum.textContent = "回答を見る（" + s.texts.length + "件）"; tx.appendChild(tsum); s.texts.forEach(function (t) { tx.appendChild(el("div", "note", t.name + (t.group ? "（" + t.group + "）" : "") + "：" + t.text)); }); d.appendChild(tx); }
        var q = document.createElement("textarea"); q.rows = 4; q.maxLength = D.question_max || 1500; q.value = E.question; q.style.cssText = "width:100%;font-size:16px"; q.addEventListener("input", function () { E.question = q.value; }); d.appendChild(field(el, "アンケートの内容", q));
        if (s.kind === "choice") { var o = document.createElement("textarea"); o.rows = 4; o.value = E.options; o.style.cssText = "width:100%;font-size:16px"; o.addEventListener("input", function () { E.options = o.value; }); d.appendChild(field(el, "選択肢（1行に1つ。回答が届いたあとは、変えられません）", o));
          var ml = el("label", ""); ml.style.cssText = "display:flex;gap:6px;align-items:center"; var mc = document.createElement("input"); mc.type = "checkbox"; mc.checked = E.multi; mc.addEventListener("change", function () { E.multi = mc.checked; }); ml.appendChild(mc); ml.appendChild(el("span", "", "複数選んでよい")); d.appendChild(ml); }
        var al = el("label", ""); al.style.cssText = "display:flex;gap:6px;align-items:center"; var ac = document.createElement("input"); ac.type = "checkbox"; ac.checked = E.ask; ac.addEventListener("change", function () { E.ask = ac.checked; }); al.appendChild(ac); al.appendChild(el("span", "", "「💬 問い合わせ」ボタンを付ける")); d.appendChild(al);
        d.appendChild(field(el, "回答期限（空＝期限なし）", dtInput(E.deadline, function (v) { E.deadline = v; })));
        var r = el("div", "row"), sv3 = el("button", "primary", "💾 直す"); sv3.type = "button";
        sv3.addEventListener("click", function () { var op = { op: "survey_edit", id: s.id, question: E.question, ask: E.ask, deadline: E.deadline }; if (s.kind === "choice") { op.options = E.options.split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean); op.multi = E.multi; } K.send([op], "直しています…"); });
        r.appendChild(sv3);
        if (s.scheduled) {
          d.appendChild(field(el, "送る日時", dtInput(E.send_at, function (v) { E.send_at = v; })));
          var rs = el("button", "", "📅 送る日時を直す"), cx2 = el("button", "", "🗑 予約を取り消す"); rs.type = cx2.type = "button"; cx2.style.color = "#ff7070";
          rs.addEventListener("click", function () { K.send([{ op: "survey_resched", id: s.id, send_at: E.send_at }], "直しています…"); });
          cx2.addEventListener("click", function () { if (confirm("このアンケートの予約を取り消します（アンケートごと消えます）。よろしいですか？")) K.send([{ op: "survey_cancel", id: s.id }], "取り消しています…"); });
          r.appendChild(rs); r.appendChild(cx2);
        }
        d.appendChild(r); sc.appendChild(d);
      });
      var S = K.state("sv_new", { question: "", kind: "choice", options: "", target: "player", channels: [], multi: true, ask: true, deadline: "", send_at: "" });
      var sn = el("div", ""); sn.style.cssText = "border-top:1px solid var(--line);margin-top:8px;padding-top:8px"; sn.appendChild(el("div", "", "＋ 新しいアンケート")).style.fontWeight = "800";
      var sq = document.createElement("textarea"); sq.rows = 4; sq.maxLength = D.question_max || 1500; sq.value = S.question; sq.style.cssText = "width:100%;font-size:16px"; sq.addEventListener("input", function () { S.question = sq.value; }); sn.appendChild(field(el, "アンケートの内容", sq));
      sn.appendChild(field(el, "種類", sel(el, Object.keys(D.kinds || {}).map(function (k) { return [k, D.kinds[k]]; }), S.kind, function (v) { S.kind = v; K.redraw(); })));
      if (S.kind === "choice") { var so = document.createElement("textarea"); so.rows = 4; so.value = S.options; so.style.cssText = "width:100%;font-size:16px"; so.placeholder = "1行に1つ（" + (D.options_min || 2) + "〜" + (D.options_max || 10) + "個）"; so.addEventListener("input", function () { S.options = so.value; }); sn.appendChild(field(el, "選択肢", so));
        var sml = el("label", ""); sml.style.cssText = "display:flex;gap:6px;align-items:center"; var smc = document.createElement("input"); smc.type = "checkbox"; smc.checked = S.multi; smc.addEventListener("change", function () { S.multi = smc.checked; }); sml.appendChild(smc); sml.appendChild(el("span", "", "複数選んでよい")); sn.appendChild(sml); }
      sn.appendChild(field(el, "送る相手", sel(el, Object.keys(D.targets || {}).map(function (k) { return [k, D.targets[k]]; }), S.target, function (v) { S.target = v; K.redraw(); })));
      if (S.target === "channels") sn.appendChild(field(el, "送るチャンネル", chanPicker(el, D, S.channels)));
      var sal = el("label", ""); sal.style.cssText = "display:flex;gap:6px;align-items:center"; var sac = document.createElement("input"); sac.type = "checkbox"; sac.checked = S.ask; sac.addEventListener("change", function () { S.ask = sac.checked; }); sal.appendChild(sac); sal.appendChild(el("span", "", "「💬 問い合わせ」ボタンを付ける")); sn.appendChild(sal);
      sn.appendChild(field(el, "回答期限（空＝期限なし）", dtInput(S.deadline, function (v) { S.deadline = v; })));
      var sendRow = el("div", "row"); sendRow.style.alignItems = "center"; var sdi = dtInput(S.send_at, function (v) { S.send_at = v; }); sendRow.appendChild(sdi);
      var sb2 = el("button", "", "約2分後"); sb2.type = "button"; sb2.addEventListener("click", function () { S.send_at = soon(); sdi.value = S.send_at; }); sendRow.appendChild(sb2);
      sn.appendChild(field(el, "送る日時", sendRow));
      var sr2 = el("div", "row"), sgo = el("button", "primary", "📣 この内容で予約する"); sgo.type = "button";
      sgo.addEventListener("click", function () {
        if (!S.question.trim() || !S.send_at) { K.msg("ng", "⚠ アンケートの内容と、送る日時を入れてください。"); return; }
        var op = { op: "survey_create", question: S.question, kind: S.kind, target: S.target, multi: S.multi, ask: S.ask, deadline: S.deadline, send_at: S.send_at,
                   options: S.kind === "choice" ? S.options.split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean) : [], channels: S.target === "channels" ? S.channels.slice() : [] };
        S.question = ""; S.options = ""; K.send([op], "予約しています…");
      });
      sr2.appendChild(sgo); sn.appendChild(sr2); sc.appendChild(sn); root.appendChild(sc);
    }
  });

  // ───── 📊 当日・結果（集計・MVP・インタビュー・配信） ─────
  function pre(el, text) { var p = el("div", ""); p.style.cssText = "white-space:pre-wrap;font-size:14px;line-height:1.6"; p.textContent = String(text || "").replace(/\*\*/g, ""); return p; }
  function pickList(el, list, chosen, locked) {                                       // 押して選ぶ（複数）。locked の人は、外せない
    var w = el("div", "row"); w.style.flexWrap = "wrap";
    list.forEach(function (p) {
      var on = chosen.indexOf(p[0]) >= 0, fixed = locked.indexOf(p[0]) >= 0, b = el("button", on ? "primary" : "", (on ? "✅ " : "") + p[1]); b.type = "button"; b.disabled = fixed;
      if (fixed) b.title = "もう確認を送った人は、外せません";
      b.addEventListener("click", function () { var k = chosen.indexOf(p[0]); if (k >= 0) chosen.splice(k, 1); else chosen.push(p[0]); b.className = chosen.indexOf(p[0]) >= 0 ? "primary" : ""; b.textContent = (chosen.indexOf(p[0]) >= 0 ? "✅ " : "") + p[1]; });
      w.appendChild(b);
    });
    return w;
  }
  // ───── 📊 当日・結果：試合結果の管理・失格・保留・試合開始のやり直し・進行中のBAN/PICK ─────
  function btnx(el, cls, text, fn) { var b = el("button", cls, text); b.type = "button"; b.addEventListener("click", fn); return b; }
  function hangOpts(n) { var o = [["", "選んでください"]]; for (var i = 0; i <= n; i++) o.push([String(i), i + "吊 / " + (n - i) + "逃げ"]); return o; }
  function renderResults(root, K) {
    var el = K.el, R = (K.data() || {}).results || {};
    var rc = box(el, "🏁 試合結果の管理", "Discordの管理者メニュー「結果の管理」「保留の判断」「試合開始のやり直し」と同じ処理です。押すとすぐ保存され、控えやお知らせは、BOTがDiscordに送ります（お知らせは、大会名の専用チャンネルへ）。");
    if (!R.ready) { rc.appendChild(el("div", "note", "組み合わせの抽選が済むと、ここで試合結果を管理できます。")); root.appendChild(rc); return; }
    var N = R.survivors || 4, SM = K.state("res", { m: "", edit: null, h: "", n: "", t: "", ah: "", an: "", at: "", times: {}, dq: "", why: "" });
    var ms = (R.matches || []).filter(function (m) { return m.a[0] != null && m.b[0] != null && !m.bye; });
    rc.appendChild(field(el, "試合", sel(el, [["", "試合を選んでください"]].concat(ms.map(function (m) { return [m.id, m.round + "｜" + m.a[1] + " vs " + m.b[1] + "（" + m.status_text + (m.winner ? "：" + m.winner + "の勝ち" : "") + "）"]; })), SM.m, function (v) { SM.m = v; SM.edit = null; SM.ah = SM.an = SM.at = ""; K.redraw(); })));
    var m = ms.filter(function (x) { return x.id === SM.m; })[0];
    if (m) {
      var teams = [["", "選んでください"], [String(m.a[0]), m.a[1] + "がハンター"], [String(m.b[0]), m.b[1] + "がハンター"]];
      rc.appendChild(el("div", "", "いま：" + m.status_text + (m.winner ? "（勝者：" + m.winner + (m.by_dq ? "・相手チームの失格" : "") + "）" : "") + (m.next_label && m.status !== "finished" && m.status !== "undecided" ? "　次の入力：" + m.next_label : "")));
      if (!m.entries.length) rc.appendChild(el("div", "note", "まだ登録された結果はありません。"));
      m.entries.forEach(function (e) {
        var row = el("div", "row"); row.style.cssText = "align-items:center;flex-wrap:wrap;gap:6px;margin:4px 0";
        row.appendChild(el("span", "", "・" + e.label + (e.time ? "（" + e.time + "）" : "")));
        row.appendChild(btnx(el, "", "✏ 修正", function () { SM.edit = e.id; SM.h = String(e.hunter); SM.n = String(e.hangs); SM.t = e.time; K.redraw(); }));
        row.appendChild(btnx(el, "", "🗑 削除", function () { if (confirm("この結果を削除しますか？\n" + e.label + "\n（あとの結果が連動して変わることがあります。履歴には残ります）")) K.send([{ op: "res_delete", id: e.id }], "削除中…"); }));
        rc.appendChild(row);
        if (SM.edit === e.id) {
          var ed = el("div", "card"); ed.style.margin = "4px 0 8px 12px";
          ed.appendChild(el("div", "note", "ハンターを変えると、同じセットのもう片方も、自動で入れ替わります。"));
          ed.appendChild(field(el, "ハンター側のチーム", sel(el, teams, SM.h, function (v) { SM.h = v; })));
          ed.appendChild(field(el, "結果", sel(el, hangOpts(N), SM.n, function (v) { SM.n = v; })));
          if (e.ext) { var ti = inp(el, SM.t, 8, "例：05:07"); ti.addEventListener("input", function () { SM.t = ti.value; }); ed.appendChild(field(el, "試合時間（延長戦）", ti)); }
          var r2 = el("div", "row");
          r2.appendChild(btnx(el, "primary", "修正する", function () { if (!SM.h || SM.n === "") { K.msg("ng", "⚠ ハンター側と結果を選んでください。"); return; } K.send([{ op: "res_edit", id: e.id, hunter: SM.h, hangs: SM.n, time: SM.t }], "保存中…"); SM.edit = null; }));
          r2.appendChild(btnx(el, "", "やめる", function () { SM.edit = null; K.redraw(); }));
          ed.appendChild(r2); rc.appendChild(ed);
        }
      });
      if (m.need_time.length) {
        var tc = el("div", "card"); tc.style.marginTop = "8px";
        tc.appendChild(el("div", "", "⏱ 時間勝負：吊り人数が同数のため、延長戦の前半戦・後半戦の試合時間で決めます。"));
        m.need_time.forEach(function (id, k) { var t2 = inp(el, SM.times[id] || "", 8, "例：05:07"); t2.addEventListener("input", function () { SM.times[id] = t2.value; }); tc.appendChild(field(el, (k ? "後半戦" : "前半戦") + "の試合時間", t2)); });
        tc.appendChild(btnx(el, "primary", "試合時間を登録する", function () { var t = {}; m.need_time.forEach(function (id) { t[String(id)] = SM.times[id] || ""; }); K.send([{ op: "res_times", match: m.id, times: t }], "保存中…"); }));
        rc.appendChild(tc);
      } else if (m.next && m.status !== "finished" && m.status !== "undecided") {
        var ac = el("div", "card"); ac.style.marginTop = "8px";
        ac.appendChild(el("div", "", "➕ " + m.next_label + " の結果を入力"));
        ac.appendChild(el("div", "note", "管理者の入力です（スクリーンショットは付きません。相手チームへの確認依頼も出ません）。ふだんは、選手がDiscordで入力します。"));
        ac.appendChild(field(el, "ハンター側のチーム", sel(el, teams, SM.ah, function (v) { SM.ah = v; })));
        ac.appendChild(field(el, "結果", sel(el, hangOpts(N), SM.an, function (v) { SM.an = v; })));
        if (m.next_ext) { var at = inp(el, SM.at, 8, "例：05:07"); at.addEventListener("input", function () { SM.at = at.value; }); ac.appendChild(field(el, "試合時間（延長戦）", at)); }
        ac.appendChild(btnx(el, "primary", "登録する", function () { if (!SM.ah || SM.an === "") { K.msg("ng", "⚠ ハンター側と結果を選んでください。"); return; } if (confirm(m.next_label + " の結果を登録します。よろしいですか？")) { K.send([{ op: "res_add", match: m.id, hunter: SM.ah, hangs: SM.an, time: SM.at }], "保存中…"); SM.ah = SM.an = SM.at = ""; } }));
        rc.appendChild(ac);
      }
      if (m.status === "undecided") {
        var dc = el("div", "card"); dc.style.marginTop = "8px";
        dc.appendChild(el("div", "", "⚖ 保留の判断：延長戦でも決着しませんでした。勝者を選んでください。"));
        var dr = el("div", "row");
        [m.a, m.b].forEach(function (t) { dr.appendChild(btnx(el, "primary", t[1] + "の勝ち", function () { if (confirm(t[1] + " を勝者にしますか？")) K.send([{ op: "decide", match: m.id, winner: t[0] }], "保存中…"); })); });
        dc.appendChild(dr); rc.appendChild(dc);
      }
      var r3 = el("div", "row"); r3.style.marginTop = "8px";
      if (m.entries.length || m.status === "undecided") r3.appendChild(btnx(el, "", "♻ 試合結果をリセット", function () { if (confirm("この試合の登録済みの結果を、すべて取り消します（履歴には残ります）。よろしいですか？")) K.send([{ op: "res_reset", match: m.id }], "保存中…"); }));
      if (m.resettable) r3.appendChild(btnx(el, "", "🔄 試合開始のやり直し", function () { if (confirm("この枠（" + m.next_label + "）の試合開始を、なかったことにします。\n先攻ハンターの抽選もBAN/PICKも取り消され、もう一度「試合開始」の抽選からやり直せます。入力済みの試合結果は、そのままです。よろしいですか？")) K.send([{ op: "bp_reset", match: m.id }], "保存中…"); }));
      if (r3.childNodes.length) rc.appendChild(r3);
    }
    root.appendChild(rc);
    // 失格
    var qc = box(el, "🚫 失格・取り消し", "失格にすると、いまの試合（相手が未定なら次の試合）から、対戦相手の勝ちになります。前のラウンドの結果は動きません。");
    (R.teams || []).filter(function (t) { return t.dq; }).forEach(function (t) {
      var row = el("div", "row"); row.style.cssText = "align-items:center;gap:6px;margin:4px 0";
      row.appendChild(el("span", "", "🚫 " + t.name + (t.reason ? "（理由：" + t.reason + "）" : "")));
      row.appendChild(btnx(el, "", "失格を取り消す", function () { if (confirm(t.name + " の失格を取り消しますか？\n失格による勝敗の自動確定が、元に戻ります。")) K.send([{ op: "dq_undo", team: t.id }], "保存中…"); }));
      qc.appendChild(row);
    });
    var live = (R.teams || []).filter(function (t) { return !t.dq; });
    qc.appendChild(field(el, "失格にするチーム", sel(el, [["", "選んでください"]].concat(live.map(function (t) { return [String(t.id), t.name]; })), SM.dq, function (v) { SM.dq = v; })));
    var wi = inp(el, SM.why, 300, "例：規約違反・不参加 など（空欄でもよい）"); wi.addEventListener("input", function () { SM.why = wi.value; }); qc.appendChild(field(el, "理由", wi));
    qc.appendChild(btnx(el, "danger", "🚫 失格にする", function () { var t = live.filter(function (x) { return String(x.id) === SM.dq; })[0]; if (!t) { K.msg("ng", "⚠ チームを選んでください。"); return; } if (confirm(t.name + " を失格にしますか？\n対戦相手が自動で勝ち上がります（あとで取り消せます）。")) { K.send([{ op: "dq", team: t.id, reason: SM.why }], "保存中…"); SM.dq = ""; SM.why = ""; } }));
    root.appendChild(qc);
    // 進行中のBAN/PICK
    var bc = box(el, "🎬 進行中のBAN/PICK", "Discordの「BAN/PICK設定→🎬 進行中のBAN/PICK」と同じです。");
    if (!(R.sessions || []).length) bc.appendChild(el("div", "note", "進行中（または結果入力待ち）のBAN/PICKはありません。"));
    (R.sessions || []).forEach(function (s2) {
      var row = el("div", "row"); row.style.cssText = "align-items:center;flex-wrap:wrap;gap:6px;margin:4px 0";
      row.appendChild(el("span", "", "・" + s2.label + "（" + s2.status + "）"));
      row.appendChild(btnx(el, "", "📣 ボードを再投稿", function () { K.send([{ op: "bp_repost", id: s2.id }], "送信中…"); }));
      row.appendChild(btnx(el, "", "❌ 中止する", function () { if (confirm("このBAN/PICKを中止しますか？\n入力済みの内容は無効になり、最初からやり直しになります。")) K.send([{ op: "bp_cancel", id: s2.id }], "保存中…"); }));
      bc.appendChild(row);
    });
    root.appendChild(bc);
  }

  TABS.push({
    id: "lo", label: "📊 当日・結果",
    intro: "大会の当日や、終わったあとに押すもの（試合結果・失格・集計・MVP・インタビュー・配信）です。Discordの同じボタンと、同じ処理です（Discordでのお知らせは、BOTが送ります）。取り消せないものは、押す前に確認します。",
    render: function (root, K) {
      var el = K.el, D = (K.data() || {}).liveops || {};
      renderResults(root, K);
      // 配信
      var S = D.stream || {}, sc = box(el, "📡 配信（ライブブラウザの演出）", "配信開始は1回だけ押せます（最初からやり直すことはできません）。");
      var sr = el("div", "row");
      var so = el("button", "primary", "▶ 配信開始"); so.type = "button"; so.disabled = !!S.open_started; so.addEventListener("click", function () { if (confirm("ライブブラウザで、開会の演出を始めます（1回だけ）。よろしいですか？")) K.send([{ op: "stream_open" }], "配信開始を頼んでいます…"); });
      var sx = el("button", "", "⏹ 配信終了"); sx.type = "button"; sx.addEventListener("click", function () { if (confirm("閉会のごあいさつ →「大会終了」の画面 → 暗転、と進めます。よろしいですか？")) K.send([{ op: "stream_close" }], "配信終了を頼んでいます…"); });
      var sz = el("button", "", "↺ 最初（真っ黒）に戻す"); sz.type = "button"; sz.addEventListener("click", function () { if (confirm("ライブブラウザを、真っ黒に戻します。よろしいですか？")) K.send([{ op: "stream_reset" }], "戻しています…"); });
      sr.appendChild(so); sr.appendChild(sx); sr.appendChild(sz); sc.appendChild(sr);
      sc.appendChild(el("div", "note", "いま：" + (S.close_started ? "配信終了の演出を始めました" : S.open_started ? "配信の演出が始まっています" : "まだ始めていません") + "。主催者名・決め台詞は「⚙ 大会設定」、配信開始の時刻は「⏱ 時間管理」で決めます。"));
      root.appendChild(sc);
      // MVP
      var M = D.mvp || {}, mc = box(el, "🏆 MVP選出", M.enabled ? "チーム・選手のどちらでも、いくつでも選べます。確定すると取り消せません（大会名チャンネルに公開で通知し、本人（チームはリーダー）にもDMを送ります）。" : "MVP選出は「使わない」になっています（⚙ 大会設定で「使う」にできます）。");
      (M.awards || []).forEach(function (a) { mc.appendChild(el("div", "", "🏆 " + (a.kind === "team" ? "チーム" : "選手") + "：" + a.name + (a.reason ? "（" + a.reason + "）" : "") + (a.announced ? "" : "　⚠ 未発表"))); });
      if ((M.awards || []).some(function (a) { return !a.announced; })) { var ap = el("button", "primary", "📣 未発表のMVPを発表する"); ap.type = "button"; ap.addEventListener("click", function () { K.send([{ op: "mvp_announce_pending" }], "発表を頼んでいます…"); }); mc.appendChild(ap); }
      if (M.enabled) {
        var MV = K.state("mvp", { kind: "team", id: "", reason: "" });
        mc.appendChild(field(el, "選ぶもの", sel(el, [["team", "チーム"], ["player", "選手"]], MV.kind, function (v) { MV.kind = v; MV.id = ""; K.redraw(); })));
        var list = MV.kind === "team" ? (M.teams || []).map(function (t) { return [t[0], t[1]]; }) : (M.players || []).map(function (p) { var t = (M.teams || []).filter(function (x) { return x[0] === p[2]; })[0]; return [p[0], p[1] + (t ? "（" + t[1] + "）" : "")]; });
        mc.appendChild(field(el, MV.kind === "team" ? "チーム" : "選手", sel(el, [["", "選んでください"]].concat(list), MV.id, function (v) { MV.id = v; })));
        var ri = inp(el, MV.reason, 200, "選出理由（空でもよい）"); ri.addEventListener("input", function () { MV.reason = ri.value; }); mc.appendChild(field(el, "選出理由", ri));
        var mb = el("button", "primary", "🏆 MVPを確定する（取り消せません）"); mb.type = "button";
        mb.addEventListener("click", function () { if (!MV.id) { K.msg("ng", "⚠ 選んでください。"); return; } if (confirm("この内容で、MVPを確定します。確定すると取り消せません（大会名チャンネルに公開で通知し、DMも送ります）。よろしいですか？")) { var o = { op: "mvp_award", kind: MV.kind, id: MV.id, reason: MV.reason }; MV.id = ""; MV.reason = ""; K.send([o], "MVPを確定しています…"); } });
        mc.appendChild(mb);
      }
      root.appendChild(mc);
      // インタビュー
      var I = D.interview || {}, ic = box(el, "🎤 インタビュー", I.enabled ? "選んだ選手には、チーム専用チャンネルで「インタビューを受けますか？」（受ける／受けない）を送ります。送ったあとは、運営側から取り消せません。" : "インタビューは「使わない」になっています（⚙ 大会設定で「使う」にできます）。");
      if (I.enabled) {
        if (I.champion) {
          var CH = K.state("iv_ch", { ids: (I.chosen || []).slice() });
          ic.appendChild(el("div", "", "優勝チーム：" + I.champion)); ic.appendChild(pickList(el, I.players || [], CH.ids, I.chosen || []));
          var cb2 = el("button", "primary", "🎤 優勝チームのインタビュー選手に、確認を送る"); cb2.type = "button";
          cb2.addEventListener("click", function () { if (!CH.ids.length) { K.msg("ng", "⚠ 選手を選んでください。"); return; } if (confirm("選んだ選手に、確認を送ります（取り消せません）。よろしいですか？")) K.send([{ op: "interview_pick", kind: "champion", ids: CH.ids.slice() }], "確認を頼んでいます…"); });
          ic.appendChild(cb2);
        } else ic.appendChild(el("div", "note", "優勝チームが決まると、ここで選べます。"));
        if ((I.mvp_players || []).length) {
          var MP = K.state("iv_mvp", { ids: (I.mvp_chosen || []).slice() });
          ic.appendChild(el("div", "", "MVPインタビュー（MVPの選手・MVPチームのリーダー）")); ic.appendChild(pickList(el, I.mvp_players, MP.ids, I.mvp_chosen || []));
          var mb2 = el("button", "primary", "🎤 MVPインタビュー選手に、確認を送る"); mb2.type = "button";
          mb2.addEventListener("click", function () { if (!MP.ids.length) { K.msg("ng", "⚠ 選手を選んでください。"); return; } if (confirm("選んだ選手に、確認を送ります（取り消せません）。よろしいですか？")) K.send([{ op: "interview_pick", kind: "mvp", ids: MP.ids.slice() }], "確認を頼んでいます…"); });
          ic.appendChild(mb2);
        }
      }
      var fb = el("button", "", "🏁 最後のトーナメント表を映す"); fb.type = "button"; fb.disabled = !I.champion; fb.addEventListener("click", function () { K.send([{ op: "final_bracket" }], "切り替えています…"); }); ic.appendChild(fb);
      root.appendChild(ic);
      // 集計
      var ST = D.stats || {}, stc = box(el, "📊 集計（BAN/PICKが完了した試合" + (ST.sessions || 0) + "件）", "Discordの「📊 集計」と同じ内容です（勝率の最低戦数は2戦・引き分けは勝ちに含む）。");
      (ST.sections || []).forEach(function (s2) {
        var d = document.createElement("details"); d.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:6px 0";
        var sm = document.createElement("summary"); sm.style.cursor = "pointer"; sm.textContent = s2[1]; d.appendChild(sm); d.appendChild(pre(el, s2[2])); stc.appendChild(d);
      });
      if (ST.csv) { var a = el("a", "", "📥 CSVで保存（BAN/PICKの記録。Excelなどで集計できます）"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent("\ufeff" + ST.csv); a.download = "banpick.csv"; stc.appendChild(a); }
      root.appendChild(stc);
    }
  });

  // ───── 🔧 履歴・キャラ・マップ ─────
  TABS.push({
    id: "gm", label: "🔧 履歴・キャラ・マップ",
    intro: "Discordの「🔧 BOT操作履歴・管理」の「📜 履歴」と「🎮 ゲームのアプデで追加されたキャラ・マップを登録」と同じです。キャラ・マップは、すべての大会に共通です（変えると、ほかの大会にも反映されます）。",
    render: function (root, K) {
      var el = K.el, G = (K.data() || {}).game || {}, GS = K.state("gm", { f: "survivor", q: "", edit: null, add: { name: "", reading: "", aliases: "", emoji: "" }, ed: {}, more: false });
      // キャラ・マップ
      var kinds = G.kinds || { survivor: "サバイバー", hunter: "ハンター", map: "マップ" };
      var cc = box(el, "🎮 キャラ・マップ", "ゲームのアップデートでキャラやマップが増えたときは、ここから追加してください。消すことはできません（使わないものは「非表示」にします）。");
      var fr = el("div", "row"); fr.style.flexWrap = "wrap";
      Object.keys(kinds).forEach(function (f) { var n = ((G.chars || {})[f] || []).length; fr.appendChild(btnx(el, GS.f === f ? "primary" : "", kinds[f] + "（" + n + "）", function () { GS.f = f; GS.edit = null; K.redraw(); })); });
      cc.appendChild(fr);
      function four(o, onSave, label) {
        var w = el("div", "");
        [["name", "名前（30文字まで）", 30, ""], ["reading", "読み方（ひらがな。空でもよい）", 60, ""], ["aliases", "別名（「、」で区切って5つまで）", 160, "例：ナワーブ、傭兵"], ["emoji", "絵文字（1つ。空でもよい）", 8, ""]].forEach(function (x) {
          var i = inp(el, o[x[0]], x[2], x[3]); i.addEventListener("input", function () { o[x[0]] = i.value; }); w.appendChild(field(el, x[1], i));
        });
        w.appendChild(btnx(el, "primary", label, onSave)); return w;
      }
      var add = el("div", "card"); add.style.marginTop = "8px"; add.appendChild(el("div", "", "➕ " + kinds[GS.f] + "を追加"));
      add.appendChild(four(GS.add, function () { if (!GS.add.name.trim()) { K.msg("ng", "⚠ 名前を入れてください。"); return; } K.send([{ op: "char_add", faction: GS.f, name: GS.add.name, reading: GS.add.reading, aliases: GS.add.aliases, emoji: GS.add.emoji }], "追加しています…"); GS.add = { name: "", reading: "", aliases: "", emoji: "" }; }, "追加する"));
      cc.appendChild(add);
      var qi = inp(el, GS.q, 30, "名前・読み・別名で探す"); qi.addEventListener("input", function () { GS.q = qi.value; drawList(); }); cc.appendChild(field(el, "探す", qi));
      var list = el("div", ""); cc.appendChild(list);
      function drawList() {
        list.textContent = "";
        var q = GS.q.trim().toLowerCase();
        ((G.chars || {})[GS.f] || []).filter(function (c) { return !q || (c.name + " " + c.reading + " " + c.aliases.join(" ")).toLowerCase().indexOf(q) >= 0; }).forEach(function (c) {
          var row = el("div", "row"); row.style.cssText = "align-items:center;flex-wrap:wrap;gap:6px;margin:3px 0;border-bottom:1px solid var(--line);padding-bottom:3px";
          var lb = el("span", "", (c.emoji ? c.emoji + " " : "") + c.name + (c.reading ? "（" + c.reading + "）" : "") + (c.aliases.length ? "　別名：" + c.aliases.join("、") : "") + (c.active ? "" : "　※非表示")); lb.style.flex = "1"; if (!c.active) lb.style.opacity = ".6"; row.appendChild(lb);
          row.appendChild(btnx(el, "", "✏ 編集", function () { GS.edit = c.id; GS.ed = { name: c.name, reading: c.reading, aliases: c.aliases.join("、"), emoji: c.emoji }; drawList(); }));
          row.appendChild(btnx(el, c.active ? "" : "primary", c.active ? "🚫 非表示にする" : "👁 使えるように戻す", function () { if (!c.active || confirm("「" + c.name + "」を非表示にします（すべての大会の選択リストに出なくなります）。よろしいですか？")) K.send([{ op: "char_active", id: c.id, active: !c.active }], "保存中…"); }));
          list.appendChild(row);
          if (GS.edit === c.id) { var ec = el("div", "card"); ec.style.margin = "4px 0 8px 12px"; ec.appendChild(four(GS.ed, function () { K.send([{ op: "char_edit", id: c.id, name: GS.ed.name, reading: GS.ed.reading, aliases: GS.ed.aliases, emoji: GS.ed.emoji }], "保存中…"); GS.edit = null; }, "保存する")); ec.appendChild(btnx(el, "", "やめる", function () { GS.edit = null; drawList(); })); list.appendChild(ec); }
        });
      }
      drawList();
      root.appendChild(cc);
      // 履歴
      var H = G.history || [], hc = box(el, "📜 履歴（この大会）", "結果の登録・修正・失格・設定の変更などの記録です（新しい順）。");
      if (!H.length) hc.appendChild(el("div", "note", "履歴はまだありません。"));
      H.slice(0, GS.more ? H.length : 20).forEach(function (h) { var d = el("div", ""); d.style.cssText = "font-size:14px;margin:2px 0"; var t = el("span", "note", h[0] + "　"); d.appendChild(t); d.appendChild(document.createTextNode(h[1])); hc.appendChild(d); });
      if (H.length > 20 && !GS.more) hc.appendChild(btnx(el, "", "もっと見る（" + H.length + "件まで）", function () { GS.more = true; K.redraw(); }));
      root.appendChild(hc);
    }
  });

  // ───── 👥 選手・チーム ─────
  TABS.push({
    id: "pl", label: "👥 選手・チーム",
    intro: "Discordの「📋 チーム・選手設定」の「👥 チーム内選手を一括表示」「🔀 まとめてチーム移動」「🗑 チーム・選手削除」と、管理者メニューの「📌 現在の大会を選ぶ」「🔀 大会の選び方」「🎙 選手・チーム情報」と同じです。ゲーム内IDとプロフィール画像は、Discordの「🎙 選手・チーム情報」で見てください（ブラウザには出しません）。1人ずつの移動は「📣 チームとメンバー募集」でもできます。",
    render: function (root, K) {
      var el = K.el, P = (K.data() || {}).players || {}, PS = K.state("pl", { from: "", to: "", pick: [], open: {} });
      // 現在の大会・選び方
      var ac = box(el, "📌 現在の大会・大会の選び方", "現在の大会：参加者の画面・配信画面に出る大会です（ニックネームは、切り替えても変わりません）。");
      var cur = (P.tournaments || []).filter(function (t) { return t.active; })[0];
      ac.appendChild(el("div", "", "いま：" + (cur ? cur.name : "（なし）")));
      var ts = K.state("pl_act", { id: cur ? String(cur.id) : "" });
      var ar = el("div", "row"); ar.style.cssText = "align-items:center;gap:6px;flex-wrap:wrap";
      ar.appendChild(sel(el, (P.tournaments || []).map(function (t) { return [String(t.id), (t.active ? "📌 " : "") + t.name + "（" + t.state + "）"]; }), ts.id, function (v) { ts.id = v; }));
      ar.appendChild(btnx(el, "primary", "現在の大会にする", function () { if (cur && ts.id === String(cur.id)) { K.msg("ok", "もう現在の大会です。"); return; } K.send([{ op: "pl_active", id: ts.id }], "切り替えています…"); }));
      ac.appendChild(ar);
      ac.appendChild(el("div", "note", "大会の選び方：「管理者が選ぶ」＝管理者が切り替えた大会を、全員が使います。「参加者が自分で選ぶ」＝一部の画面で、対象の大会が複数あれば、そのつど選んでもらいます。"));
      var mr = el("div", "row");
      [["admin", "管理者が選ぶ"], ["self", "参加者が自分で選ぶ"]].forEach(function (m) { mr.appendChild(btnx(el, P.mode === m[0] ? "primary" : "", (P.mode === m[0] ? "✅ " : "") + m[1], function () { if (P.mode !== m[0]) K.send([{ op: "pl_select_mode", mode: m[0] }], "保存中…"); })); });
      ac.appendChild(mr); root.appendChild(ac);
      // 一覧
      var T = P.teams || [], lc = box(el, "👥 チーム内選手を一括表示（" + T.length + "チーム）", "チームを押すと、選手の一覧が開きます。");
      if (!T.length) lc.appendChild(el("div", "note", "まだチームが登録されていません。"));
      T.forEach(function (t) {
        var d = document.createElement("details"); d.style.cssText = "border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:6px 0"; d.open = !!PS.open[t.id];
        d.addEventListener("toggle", function () { PS.open[t.id] = d.open; });
        var sm = document.createElement("summary"); sm.style.cursor = "pointer"; sm.textContent = t.name + "（" + t.abbr + "）・" + t.players.length + "人"; d.appendChild(sm);
        if (t.reading) d.appendChild(el("div", "note", "読み方：" + t.reading));
        t.players.forEach(function (p) {
          var w = el("div", ""); w.style.cssText = "margin:6px 0;padding-top:6px;border-top:1px dashed var(--line)";
          var hd = el("div", "row"); hd.style.cssText = "align-items:center;gap:6px;flex-wrap:wrap";
          var nm = el("span", "", (p.leader ? "👑 " : "") + p.name + (p.reading ? "（" + p.reading + "）" : "") + "　" + p.faction + (p.pending ? "　※承認待ち" : "")); nm.style.cssText = "flex:1;font-weight:700"; hd.appendChild(nm);
          if (!P.locked) hd.appendChild(btnx(el, "", "🗑 選手を削除", function () { if (confirm("「" + p.name + "」の登録を削除しますか？（ロールも外れます。取り消せません）")) K.send([{ op: "pl_player_delete", player: p.id }], "削除中…"); }));
          w.appendChild(hd);
          var inf = el("div", ""); inf.style.cssText = "white-space:pre-wrap;font-size:14px"; inf.textContent = p.info; w.appendChild(inf);
          d.appendChild(w);
        });
        if (!t.players.length) d.appendChild(el("div", "note", "まだ選手がいません。"));
        if (!P.locked && !P.drawn) { var db = btnx(el, "danger", "🗑 このチームを削除（抽選前のみ）", function () { if (confirm("「" + t.name + "」を削除します。所属選手" + t.players.length + "人の登録・チームのロール・専用チャンネルも削除されます。取り消せません。よろしいですか？")) K.send([{ op: "pl_team_delete", team: t.id }], "削除中…"); }); db.style.marginTop = "6px"; d.appendChild(db); }
        lc.appendChild(d);
      });
      if (P.drawn) lc.appendChild(el("div", "note", "組み合わせを抽選したあとは、チームを削除できません（棄権などは「📊 当日・結果」の「失格」にします）。"));
      root.appendChild(lc);
      // まとめて移動
      if (!P.locked) {
        var mc = box(el, "🔀 まとめてチーム移動", "リーダーが含まれる場合、元のチームのリーダー権限は、残りのメンバーへ自動で移ります。全員が移動して元のチームが空になる場合は、そのチームを解散します（抽選前のみ）。");
        var withP = T.filter(function (t) { return t.players.length; });
        mc.appendChild(field(el, "① 元のチーム", sel(el, [["", "選んでください"]].concat(withP.map(function (t) { return [String(t.id), t.name + "（" + t.players.length + "人）"]; })), PS.from, function (v) { PS.from = v; PS.pick = []; K.redraw(); })));
        var src = T.filter(function (t) { return String(t.id) === PS.from; })[0];
        if (src) {
          mc.appendChild(el("div", "note", "② 移動させる選手（押して選ぶ。複数選べます）"));
          mc.appendChild(pickList(el, src.players.map(function (p) { return [p.id, p.name]; }), PS.pick, []));
          mc.appendChild(field(el, "③ 移動先のチーム", sel(el, [["", "選んでください"]].concat(T.filter(function (t) { return t.id !== src.id; }).map(function (t) { return [String(t.id), t.name + "（" + t.players.length + "人）"]; })), PS.to, function (v) { PS.to = v; })));
          mc.appendChild(btnx(el, "primary", "🔀 移動する", function () {
            if (!PS.pick.length || !PS.to) { K.msg("ng", "⚠ 選手と移動先を選んでください。"); return; }
            var dst = T.filter(function (t) { return String(t.id) === PS.to; })[0];
            if (confirm(src.name + " → " + (dst ? dst.name : "") + "\n" + PS.pick.length + "人を移動します。よろしいですか？")) { K.send([{ op: "pl_bulk_move", from: src.id, to: PS.to, players: PS.pick.slice() }], "移動しています…"); PS.pick = []; PS.from = ""; PS.to = ""; }
          }));
        }
        root.appendChild(mc);
      }
    }
  });

  // ───── ⚠ やり直し・削除（取り返しがつかない操作） ─────
  TABS.push({
    id: "dg", label: "⚠ やり直し・削除・URL",
    intro: "Discordの「⚙ 基本設定」の「♻ 大会の試合をやり直す」「🗑 大会を削除」と同じです。取り消せないので、確認のため、大会名を入力してから押します。押すと、BOTが「BOT管理」チャンネルに知らせます。",
    render: function (root, K) {
      var el = K.el, X = (K.data() || {}).danger || {}, DS = K.state("dg", { r: "", d: "" });
      function nameBox(key) { var i = inp(el, DS[key], 60, X.name); i.addEventListener("input", function () { DS[key] = i.value; }); return i; }
      var rc = box(el, "♻ 大会の試合をやり直す（応募はそのまま）", "組み合わせ抽選・試合結果・BAN/PICKの進行を、すべて取り消して、抽選の前に戻します。登録済みのチーム" + (X.teams || 0) + "件・選手" + (X.players || 0) + "人は、そのまま残ります（応募し直す必要はありません）。対戦カードのチャンネルは削除します。開催日時・エントリー締切などの大会設定は、変わりません。");
      if (!X.drawn) rc.appendChild(el("div", "note", "まだ抽選していないので、やり直す必要はありません。"));
      else if (!X.resettable) rc.appendChild(el("div", "note", "チュートリアル大会は、Discordのチュートリアルの手順で進めてください。"));
      else {
        rc.appendChild(field(el, "確認のため、大会名「" + X.name + "」を入力", nameBox("r")));
        rc.appendChild(btnx(el, "danger", "♻ 試合をやり直す（取り消せません）", function () { if (DS.r.trim() !== X.name) { K.msg("ng", "⚠ 大会名が一致しません。"); return; } if (confirm("「" + X.name + "」の試合を、すべてやり直します。取り消せません。よろしいですか？")) { K.send([{ op: "t_reset_matches", name: DS.r.trim() }], "やり直しています…"); DS.r = ""; } }));
      }
      root.appendChild(rc);
      var dc = box(el, "🗑 大会を削除", "チーム" + (X.teams || 0) + "件・選手" + (X.players || 0) + "人・試合結果" + (X.results || 0) + "件を、すべて削除します。大会のロール・各チームのロール・この大会用に作ったチャンネルも削除します。取り消せません（念のため、控えのファイルを、BOTのパソコンに自動で保存します）。削除すると、このページは使えなくなります。");
      if (X.deleting) dc.appendChild(el("div", "", "⏳ 削除をBOTに頼みました。1分ほどで終わります。"));
      else if (!X.deletable) dc.appendChild(el("div", "note", "チュートリアル大会・開発者用大会は、削除できません。"));
      else {
        dc.appendChild(field(el, "確認のため、大会名「" + X.name + "」を入力", nameBox("d")));
        dc.appendChild(btnx(el, "danger", "🗑 大会を削除する（取り消せません）", function () { if (DS.d.trim() !== X.name) { K.msg("ng", "⚠ 大会名が一致しません。"); return; } if (confirm("「" + X.name + "」を削除します。チーム・選手・試合結果・ロール・チャンネルもすべて削除されます。取り消せません。本当によろしいですか？")) { K.send([{ op: "t_delete", name: DS.d.trim() }], "頼んでいます…"); DS.d = ""; } }));
      }
      root.appendChild(dc);
      var uc = box(el, "🔄 このページのURLを作り直す（漏れたとき）", "Discordの「🖥 大会設定用ブラウザ」の「🔄 URLを作り直す」と同じです。いまのURLは使えなくなり、パスワードも決め直しになります。新しいURLは、Discordの管理者メニューの「🖥 大会設定用ブラウザ」から出してください。");
      uc.appendChild(btnx(el, "danger", "🔄 URLを作り直す", function () { if (confirm("このページのURLを作り直します。いまのURLは使えなくなります（このページも閉じることになります）。よろしいですか？")) K.send([{ op: "editor_regen" }], "頼んでいます…"); }));
      root.appendChild(uc);
    }
  });

  window.EDX = (window.EDX || []).concat(TABS);
  window.EDX_UI = { box: box, field: field, sel: sel, inp: inp };                  // ほかのタブ（あとで足すもの）が使う、小さな部品
})();
