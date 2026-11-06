/* 大会ルールの本文：書き方（記号）⇔ 見た目、見たままの編集欄（装飾ボタン）、ページの色。
   大会ルールのページ（rulebook.html）と、大会設定ブラウザ（editor.html）で共通。HTMLは使わない（記号から、安全に組み立てる）。

   書き方（保存される形）
     # 大きい見出し / ## 中くらいの見出し / ### 小さい見出し
     **太字**  *斜体*  __下線__  ~~取り消し線~~  {color:#ff5a5a}文字色{/color}  [リンクの文字](https://…)
     - 箇条書き（行の頭に空白2つで、一段下）  > 引用   [[タブの名前]]＝そのタブへのリンク（ページだけ）
   装飾は入れ子にできる（例：**{color:#ff5a5a}赤い太字{/color}**）。内側に文字を書き足しても、装飾はそのまま。 */
(function () {
  "use strict";
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // ───── 読んだ印（この端末に。大会ルールのページと、エントリーのページで共通。中身が変わったら、もう一度未読） ─────
  var MEM = {};
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function readId(pub, s) { return "rb_read:" + pub + ":" + hash((s.title || "") + "\n" + (s.body || "")); }
  function isRead(pub, s) { var k = readId(pub, s); if (MEM[k]) return true; try { return localStorage.getItem(k) === "1"; } catch (e) { return false; } }
  function setRead(pub, s, v) { var k = readId(pub, s); if (v) MEM[k] = 1; else delete MEM[k]; try { if (v) localStorage.setItem(k, "1"); else localStorage.removeItem(k); } catch (e) { /* そのまま */ } }
  function progress(pub, doc) {                                                       // 全部のタブの、セクションの数と、読んだ数（BAN/PICK・トーナメント表のタブは、数えない）
    var n = 0, r = 0;
    ((doc && doc.tabs) || []).forEach(function (t) { (t.sections || []).forEach(function (s) { n++; if (isRead(pub, s)) r++; }); });
    return { read: r, total: n };
  }
  function logoBox() {                                                                // ロゴのテンプレート画像と、ダウンロードボタン
    var w = el("div", "logo-tpl"); w.style.cssText = "text-align:center;margin:10px 0";
    if (!window.LOGO_TEMPLATE) return w;
    var i = el("img"); i.src = window.LOGO_TEMPLATE; i.alt = "ロゴのテンプレート"; i.style.cssText = "width:160px;height:160px;background:#000;border-radius:10px;display:block;margin:0 auto 8px"; w.appendChild(i);
    var a = el("a", "", "⬇ テンプレート画像をダウンロード"); a.href = window.LOGO_TEMPLATE; a.download = "logo_template.png";
    a.style.cssText = "display:inline-block;padding:10px 16px;border-radius:8px;background:var(--accent,#6f95ff);color:var(--on-accent,#fff);text-decoration:none;font-weight:800"; w.appendChild(a);
    return w;
  }

  // ───── 記号 → 見た目 ─────
  function rx(re, build, pageOnly) {                                                  // 正規表現で見つける
    return { page: !!pageOnly, find: function (s) { var m = re.exec(s); return m ? { i: m.index, n: m[0].length, m: m, build: build } : null; } };
  }
  function wrapTag(tag, g) { return function (m, o) { var e = el(tag); inline(m[g], e, o); return e; }; }
  var COLOR_OPEN = /\{color:(#[0-9a-fA-F]{6})\}/g;
  var PATS = [
    rx(/\*\*\*([\s\S]+?)\*\*\*/, function (m, o) { var b = el("b"), i = el("i"); b.appendChild(i); inline(m[1], i, o); return b; }),
    rx(/\*\*([\s\S]+?)\*\*(?!\*)/, wrapTag("b", 1)),
    rx(/__([\s\S]+?)__/, wrapTag("u", 1)),
    { page: false, find: function (s) { var m = /~~([\s\S]+?)~~/.exec(s); return m ? { i: m.index, n: m[0].length, m: m, build: function (mm, o) { var e = el(o.edit ? "strike" : "s"); inline(mm[1], e, o); return e; } } : null; } },
    rx(/\*([^*\s][^*]*?)\*/, wrapTag("i", 1)),
    { page: false, find: function (s) {                                               // 文字色：入れ子にできるよう、対応する {/color} を数えて探す
      COLOR_OPEN.lastIndex = 0; var m = COLOR_OPEN.exec(s); if (!m) return null;
      var depth = 1, pos = m.index + m[0].length, re = /\{color:#[0-9a-fA-F]{6}\}|\{\/color\}/g; re.lastIndex = pos; var t;
      while ((t = re.exec(s))) { if (t[0] === "{/color}") { depth--; if (!depth) break; } else depth++; }
      if (!t || depth) return null;
      var inner = s.slice(pos, t.index);
      return { i: m.index, n: t.index + t[0].length - m.index, m: [null, m[1], inner], build: function (mm, o) {
        var e; if (o.edit) { e = el("font"); e.setAttribute("color", mm[1].toLowerCase()); } else { e = el("span"); e.style.color = mm[1]; }
        inline(mm[2], e, o); return e; } };
    } },
    rx(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+)\)/, function (m, o) { var a = el("a"); a.href = m[2]; if (!o.edit) { a.target = "_blank"; a.rel = "noopener noreferrer"; } inline(m[1], a, o); return a; }),
    rx(/\[\[([^\]]+)\]\]/, function (m, o) { var a = el("a", "", "「" + m[1] + "」"); a.href = "#"; a.addEventListener("click", function (e) { e.preventDefault(); if (o.tabLink) o.tabLink(m[1]); }); return a; }, true),
    rx(/https?:\/\/[^\s　）)」]+/, function (m) { var a = el("a", "", m[0]); a.href = m[0]; a.target = "_blank"; a.rel = "noopener noreferrer"; return a; }, true)
  ];
  function inline(text, parent, o) {
    var s = String(text);
    while (s) {
      var best = null;
      for (var k = 0; k < PATS.length; k++) {
        if (PATS[k].page && o.edit) continue;                                         // 編集欄では、[[ ]]・URLは、文字のまま
        var f = PATS[k].find(s);
        if (f && (best === null || f.i < best.i)) best = f;
      }
      if (!best) { parent.appendChild(document.createTextNode(s)); return; }
      if (best.i > 0) parent.appendChild(document.createTextNode(s.slice(0, best.i)));
      parent.appendChild(best.build(best.m, o));
      s = s.slice(best.i + best.n);
    }
  }
  function render(text, opts) {                                                       // 本文 → 見た目。opts.edit＝編集欄に入れる形（断片を返す）。opts.tabLink＝[[タブ名]]を押したとき
    var o = opts || {}, frag = document.createDocumentFragment();
    String(text || "").split("\n").forEach(function (line) {
      if (!o.edit && line.trim() === "{{logo_template}}") { frag.appendChild(logoBox()); return; }       // ロゴのテンプレート画像とダウンロードボタン
      var m = /^(#{1,3})\s+(.*)$/.exec(line), node;
      if (m) { node = el(m[1].length === 1 ? "h3" : m[1].length === 2 ? "h4" : "h5"); line = m[2]; }
      else if (/^\s{2,}[-・*]\s+/.test(line)) { node = el("div", o.edit ? "" : "li2"); line = (o.edit ? "  ・ " : "・") + line.replace(/^\s*[-・*]\s+/, ""); }
      else if (/^\s*[-・*]\s+/.test(line)) { node = el("div", o.edit ? "" : "li"); line = (o.edit ? "・ " : "・") + line.replace(/^\s*[-・*]\s+/, ""); }
      else if (/^>\s?/.test(line) && !o.edit) { node = el("div", "bq"); line = line.replace(/^>\s?/, ""); }
      else { node = el("div"); if (!line.trim() && !o.edit) node.style.height = ".6em"; }
      inline(line, node, o);
      if (o.edit && !node.childNodes.length) node.appendChild(el("br"));
      frag.appendChild(node);
    });
    if (o.edit) return frag;
    var box = el("div", "md"); box.appendChild(frag); return box;
  }

  // ───── 見た目（編集欄の中身）→ 記号 ─────
  function hexOf(c) {
    c = String(c || "").trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(c)) return c;
    if (/^#[0-9a-f]{3}$/.test(c)) return "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    if (m) return "#" + [m[1], m[2], m[3]].map(function (x) { return ("0" + (+x).toString(16)).slice(-2); }).join("");
    return null;
  }
  var BLOCK = /^(div|p|h[1-6]|li|ul|ol|blockquote|section|article)$/;
  function mark(open, close, s) {                                                     // 行ごとに、前後の空白は外に出して、装飾の記号で包む（中身が無ければ、書かない）
    return s.split("\n").map(function (ln) {
      var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(ln);
      return m[2] ? m[1] + open + m[2] + close + m[3] : ln;
    }).join("\n");
  }
  function inl(n) {                                                                   // 1つの要素の中身を、記号つきの文字に（改行は \n）
    if (n.nodeType === 3) return n.nodeValue.replace(/ /g, " ").replace(/​/g, "").replace(/\r?\n/g, " ");
    if (n.nodeType !== 1) return "";
    var tg = n.tagName.toLowerCase();
    if (tg === "br") return "\n";
    var s = ""; for (var c = n.firstChild; c; c = c.nextSibling) s += inl(c);
    var st = n.style || {}, td = (st.textDecoration || "") + " " + (st.textDecorationLine || "");
    var href = tg === "a" ? (n.getAttribute("href") || "") : "";
    var col = hexOf(tg === "font" ? n.getAttribute("color") : st.color);
    if (/^https?:\/\/\S+$/.test(href)) s = mark("[", "](" + href.replace(/[()\s]/g, encodeURIComponent) + ")", s);
    if (col) s = mark("{color:" + col + "}", "{/color}", s);
    if (tg === "s" || tg === "strike" || tg === "del" || /line-through/.test(td)) s = mark("~~", "~~", s);
    if (tg === "u" || /underline/.test(td)) s = mark("__", "__", s);
    if (tg === "i" || tg === "em" || st.fontStyle === "italic") s = mark("*", "*", s);
    if (tg === "b" || tg === "strong" || /^(bold|[6-9]00)$/.test(st.fontWeight || "")) s = mark("**", "**", s);
    return s;
  }
  function linesOf(root) {                                                            // ブロック（行のまとまり）→ 行の配列
    var out = [], buf = "", had = false;
    function endBuf() {
      if (!had) return;
      var parts = buf.split("\n"); if (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
      parts.forEach(function (p) { out.push(p); }); buf = ""; had = false;
    }
    for (var c = root.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && BLOCK.test(c.tagName.toLowerCase())) {
        endBuf();
        var tg = c.tagName.toLowerCase(), pre = /^h[12]$/.test(tg) || tg === "h3" ? "# " : tg === "h4" ? "## " : /^h[56]$/.test(tg) ? "### " : "";
        var sub = linesOf(c); if (!sub.length) sub = [""];
        sub.forEach(function (ln) { out.push(pre + ln); });
      } else { buf += inl(c); had = true; }
    }
    endBuf();
    return out;
  }
  function serialize(root) {
    var lines = linesOf(root).map(function (ln) {
      return ln.replace(/^(#{1,3} )?\s{2,}・\s?/, function (m0, h) { return (h || "") + "  - "; }).replace(/^(#{1,3} )?・\s?/, function (m0, h) { return (h || "") + "- "; });
    });
    return lines.join("\n").replace(/\s+$/, "");
  }

  // ───── ページの色（背景色・装飾色から、パネルや文字の色を決める） ─────
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function lum(h) { var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return "#" + x.map(function (v, i) { return ("0" + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join(""); }
  function contrast(a, b) { var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  var HEX = /^#[0-9a-fA-F]{6}$/;
  function theme(th) {                                                                // 無ければ null（いつもの色）
    th = th || {};
    if (!HEX.test(th.bg || "") && !HEX.test(th.accent || "")) return null;
    var bg = HEX.test(th.bg || "") ? th.bg.toLowerCase() : "#12141b", ac = HEX.test(th.accent || "") ? th.accent.toLowerCase() : "#6f95ff";
    var dark = lum(bg) < 0.4, toward = dark ? "#ffffff" : "#000000", text = dark ? "#e8eaf2" : "#1d2130";
    return { dark: dark, vars: { "--bg": bg, "--panel": mix(bg, toward, 0.06), "--panel2": mix(bg, toward, 0.11), "--line": mix(bg, toward, 0.2),
      "--text": text, "--sub": mix(text, bg, 0.35), "--accent": ac, "--link": contrast(ac, bg) >= 3 ? ac : (dark ? "#ffd54a" : "#1a56c4"),
      "--on-accent": lum(ac) > 0.45 ? "#111111" : "#ffffff" } };
  }
  var VARS = ["--bg", "--panel", "--panel2", "--line", "--text", "--sub", "--accent", "--link", "--on-accent"];
  function applyTheme(target, th) {                                                   // target の style に、色の変数を入れる（無ければ外す）。戻り値：使った色（無ければ null）
    VARS.forEach(function (n) { target.style.removeProperty(n); });
    var t = theme(th); if (!t) return null;
    VARS.forEach(function (n) { target.style.setProperty(n, t.vars[n]); });
    return t;
  }

  // ───── 見たままの編集欄（装飾ボタンつき） ─────
  var COLORS = [["赤", "#ff5a5a"], ["橙", "#ffa040"], ["黄", "#ffd54a"], ["緑", "#45c07c"], ["水色", "#4fc3f7"], ["青", "#6f95ff"], ["紫", "#b388ff"], ["桃", "#ff80ab"], ["白", "#ffffff"], ["灰", "#9aa1b5"], ["黒", "#222222"]];
  function css() {
    if (document.getElementById("rbf-css")) return;
    var s = el("style"); s.id = "rbf-css";
    s.textContent = ".rte{border:1px solid var(--rte-line,#3a4157);border-radius:10px;margin:8px 0;position:relative;background:var(--rte-bg,transparent)}" +
      ".rte .tbar{display:flex;flex-wrap:wrap;gap:6px;padding:8px;border-bottom:1px solid var(--rte-line,#3a4157);background:var(--rte-bar,#232838);border-radius:10px 10px 0 0}" +
      ".rte .tbar button{min-width:40px;min-height:40px;padding:6px 10px;font-size:15px;line-height:1.2;border-radius:8px;cursor:pointer;touch-action:manipulation}" +
      ".rte .tbar button.on{outline:2px solid var(--rte-ac,#6f95ff);background:var(--rte-ac,#6f95ff)!important;color:var(--rte-on,#fff)!important}" +
      ".rte .tbar .sep{width:1px;background:var(--rte-line,#3a4157);margin:0 2px}" +
      ".rte .tbar .grow{flex:1}" +
      ".rte .area{min-height:240px;padding:14px 16px;line-height:1.85;font-size:16px;outline:none;border-radius:0 0 10px 10px;white-space:pre-wrap;overflow-wrap:anywhere;-webkit-user-select:text;user-select:text}" +
      ".rte .area h3{font-size:21px;margin:8px 0 3px}.rte .area h4{font-size:18px;margin:6px 0 3px}.rte .area h5{font-size:16px;margin:4px 0}" +
      ".rte .area:empty:before{content:attr(data-ph);opacity:.5}.rte .area a{color:var(--rte-link,#ffd54a);text-decoration:underline}" +
      ".rte .pal{position:absolute;z-index:10;background:var(--rte-bar,#232838);border:1px solid var(--rte-line,#3a4157);border-radius:10px;padding:10px;display:flex;flex-wrap:wrap;gap:8px;max-width:320px;box-shadow:0 6px 20px rgba(0,0,0,.4)}" +
      ".rte .pal .sw{width:36px;height:36px;min-width:0;min-height:0;padding:0;border-radius:50%;border:2px solid rgba(128,128,128,.6);cursor:pointer}" +
      ".rte .pal .row2{display:flex;gap:8px;align-items:center;flex-wrap:wrap;width:100%;font-size:13px;color:var(--rte-tx,#e8eaf2)}" +
      ".rte .ttl{display:none;align-self:center;font-weight:800;margin-right:6px;max-width:40vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".rte.full{position:fixed;left:0;top:0;right:0;bottom:0;height:100vh;height:100dvh;z-index:1000;margin:0;border-radius:0;border:0;display:flex;flex-direction:column}" +
      ".rte.full .ttl{display:block}" +
      ".rte.full .tbar{border-radius:0;flex:none;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch}" +
      ".rte.full .tbar button{flex:none;white-space:nowrap}" +
      ".rte.full .area{flex:1;min-height:0;overflow-y:auto;border-radius:0;font-size:17px;padding:16px 18px 40vh}" +
      "@media (pointer:coarse){.rte .tbar button{min-width:44px;min-height:44px}.rte .pal .sw{width:42px;height:42px}}" +
      "@media (max-width:640px){.rte .area{min-height:300px}}";
    document.head.appendChild(s);
  }
  function editor(value, onChange, opts) {
    css(); var o = opts || {};
    var wrap = el("div", "rte"), bar = el("div", "tbar"), area = el("div", "area");
    area.contentEditable = "true"; area.spellcheck = false; area.setAttribute("data-ph", o.placeholder || "本文");
    area.appendChild(render(value, { edit: true }));
    if (String(value || "") === "") area.textContent = "";
    var saved = null, pal = null, btns = {}, full = false;
    function keep() { var s = window.getSelection(); if (s.rangeCount && area.contains(s.getRangeAt(0).commonAncestorContainer)) saved = s.getRangeAt(0).cloneRange(); }
    function back() { area.focus(); if (saved) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(saved); } }
    function changed() { onChange(serialize(area)); refresh(); }
    function cmd(c, v) { back(); try { document.execCommand("styleWithCSS", false, false); } catch (e) { /* そのまま */ } document.execCommand(c, false, v == null ? null : v); keep(); changed(); }
    function bt(key, label, title, fn, style) {
      var b = el("button", "", label); b.type = "button"; b.title = title; if (style) b.style.cssText = style;
      b.addEventListener("mousedown", function (e) { e.preventDefault(); keep(); });
      b.addEventListener("click", function (e) { e.preventDefault(); fn(b); });
      bar.appendChild(b); if (key) btns[key] = b; return b;
    }
    function sep() { bar.appendChild(el("span", "sep")); }
    if (o.title) { var ttl = el("span", "ttl", "✏ " + o.title); bar.appendChild(ttl); }
    function setFull(on) {                                                            // 画面いっぱいに広げる（スマホで書きやすい）。広げている間は、ページの動きを止める
      full = on; wrap.classList.toggle("full", on); btns.full.textContent = on ? "✕ 閉じる" : "⤢ 広げる";
      try { document.documentElement.style.overflow = on ? "hidden" : ""; } catch (e) { /* そのまま */ }
      if (on) { bar.scrollLeft = 0; area.focus(); } else { try { wrap.scrollIntoView({ block: "nearest" }); } catch (e) { /* そのまま */ } }
    }
    var fb0 = bt("full", "⤢ 広げる", "画面いっぱいに広げて書く（もう一度押すと、もどる）", function () { setFull(!full); }, "font-weight:800");
    function block(tag) { back(); var cur = String(document.queryCommandValue("formatBlock") || "").toLowerCase(); cmd("formatBlock", cur === tag ? "<div>" : "<" + tag + ">"); }
    bt("h3", "大", "大きい見出し（もう一度押すと、ふつうの文字）", function () { block("h3"); }, "font-weight:800;font-size:15px");
    bt("h4", "中", "中くらいの見出し", function () { block("h4"); }, "font-weight:800");
    bt("h5", "小", "小さい見出し", function () { block("h5"); }, "font-weight:800;font-size:12px");
    sep();
    bt("bold", "B", "太字（押してから打つと太字。もう一度押すと終わり。選んでから押すと、その文字が太字に）", function () { cmd("bold"); }, "font-weight:900");
    bt("italic", "I", "斜体", function () { cmd("italic"); }, "font-style:italic;font-family:serif");
    bt("underline", "U", "下線", function () { cmd("underline"); }, "text-decoration:underline");
    bt("strikeThrough", "S", "取り消し線", function () { cmd("strikeThrough"); }, "text-decoration:line-through");
    sep();
    function colorAncestor(node) { while (node && node !== area) { if (node.nodeType === 1 && ((node.tagName === "FONT" && node.getAttribute("color")) || (node.style && node.style.color))) return node; node = node.parentNode; } return null; }
    function closePal() { if (pal) { pal.remove(); pal = null; } }
    function noColor() {                                                              // 色をやめる：選んでいれば、その部分の色を外す。選んでいなければ、ここから先は、色なし
      back(); var s = window.getSelection(); if (!s.rangeCount) return;
      var r = s.getRangeAt(0);
      if (r.collapsed) {
        var fa = colorAncestor(r.startContainer); if (!fa) return;
        var z = document.createTextNode("​"); fa.parentNode.insertBefore(z, fa.nextSibling);
        var nr = document.createRange(); nr.setStart(z, 1); nr.collapse(true); s.removeAllRanges(); s.addRange(nr);
      } else {
        var list = [].slice.call(area.querySelectorAll("font[color],span")).filter(function (f) { return r.intersectsNode(f) && (f.tagName === "FONT" || (f.style && f.style.color)); });
        list.forEach(function (f) { if (f.tagName === "SPAN") { f.style.color = ""; return; } while (f.firstChild) f.parentNode.insertBefore(f.firstChild, f); f.remove(); });
      }
      keep(); changed();
    }
    var cb = bt("color", "A", "文字の色（押してから打つと、その色。選んでから押すと、その文字がその色に）", function () {
      if (pal) { closePal(); return; }
      pal = el("div", "pal"); pal.style.top = (bar.offsetHeight + 2) + "px"; pal.style.left = Math.max(0, cb.offsetLeft - 40) + "px";
      COLORS.forEach(function (c) {
        var sw = el("button", "sw"); sw.type = "button"; sw.title = c[0]; sw.style.background = c[1];
        sw.addEventListener("mousedown", function (e) { e.preventDefault(); });
        sw.addEventListener("click", function () { closePal(); cmd("foreColor", c[1]); });
        pal.appendChild(sw);
      });
      var r2 = el("div", "row2"), ci = el("input"); ci.type = "color"; ci.value = "#ff5a5a";
      ci.addEventListener("change", function () { closePal(); cmd("foreColor", ci.value); });
      r2.appendChild(el("span", "", "ほかの色：")); r2.appendChild(ci);
      var nc = el("button", "", "色をやめる"); nc.type = "button"; nc.addEventListener("mousedown", function (e) { e.preventDefault(); });
      nc.addEventListener("click", function () { closePal(); noColor(); });
      r2.appendChild(nc); pal.appendChild(r2); wrap.appendChild(pal);
    }, "font-weight:900");
    bt("link", "🔗", "リンク（文字を選んでから押すと、その文字がリンクに）", function () {
      back(); var s = window.getSelection(), has = s.rangeCount && !s.getRangeAt(0).collapsed;
      var url = prompt("リンク先のURL（https://…）", "https://"); if (!url) return; url = url.trim();
      if (!/^https?:\/\/\S+$/.test(url)) { alert("https:// で始まるURLを入れてください。"); return; }
      if (has) { cmd("createLink", url); return; }
      var t = prompt("リンクにする文字", url); if (!t) return;
      back(); var r = s.getRangeAt(0), a = el("a", "", t); a.href = url; r.insertNode(a);
      var nr = document.createRange(); nr.setStartAfter(a); nr.collapse(true); s.removeAllRanges(); s.addRange(nr); keep(); changed();
    });
    bt("", "・", "箇条書き（行の頭に「・」）", function () { cmd("insertText", "・ "); });
    bt("", "⌫ 装飾をはずす", "選んだところの装飾を、全部はずす", function () { cmd("removeFormat"); cmd("unlink"); });
    function refresh() {
      var s = window.getSelection(); if (!s.rangeCount || !area.contains(s.anchorNode)) return;
      ["bold", "italic", "underline", "strikeThrough"].forEach(function (c) { var on = false; try { on = document.queryCommandState(c); } catch (e) { on = false; } btns[c].classList.toggle("on", !!on); });
      var fb = String(document.queryCommandValue("formatBlock") || "").toLowerCase();
      ["h3", "h4", "h5"].forEach(function (h) { btns[h].classList.toggle("on", fb === h); });
      var ca = colorAncestor(s.anchorNode), cc = ca ? hexOf(ca.getAttribute("color") || ca.style.color) : null; btns.color.style.borderBottom = cc ? "4px solid " + cc : "";
      var a = s.anchorNode; while (a && a !== area && a.nodeName !== "A") a = a.parentNode; btns.link.classList.toggle("on", !!(a && a !== area));
    }
    area.addEventListener("input", changed);
    area.addEventListener("keyup", function () { keep(); refresh(); });
    area.addEventListener("mouseup", function () { keep(); refresh(); });
    area.addEventListener("focus", refresh);
    area.addEventListener("paste", function (e) {                                       // 貼りつけは、文字だけ（よそのページの見た目は、持ちこまない）
      e.preventDefault(); var t = (e.clipboardData || window.clipboardData).getData("text/plain") || ""; document.execCommand("insertText", false, t);
    });
    area.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) e.preventDefault(); });
    document.addEventListener("selectionchange", function () { if (document.activeElement === area) refresh(); });
    document.addEventListener("mousedown", function (e) { if (pal && !pal.contains(e.target) && e.target !== cb) closePal(); });
    document.addEventListener("keydown", function (e) { if (full && e.key === "Escape") setFull(false); });
    wrap.appendChild(bar); wrap.appendChild(area);
    wrap.setColors = function (th) {                                                    // 編集欄も、ページと同じ色で（無ければ、いつもの色）
      var t = theme(th) || theme({ bg: "#12141b", accent: "#6f95ff" });
      area.style.background = t.vars["--bg"]; area.style.color = t.vars["--text"]; wrap.style.setProperty("--rte-bg", t.vars["--bg"]);
      wrap.style.setProperty("--rte-bar", t.vars["--panel2"]); wrap.style.setProperty("--rte-line", t.vars["--line"]); wrap.style.setProperty("--rte-tx", t.vars["--text"]);
      wrap.style.setProperty("--rte-ac", t.vars["--accent"]); wrap.style.setProperty("--rte-on", t.vars["--on-accent"]);
      [].slice.call(bar.querySelectorAll("button")).forEach(function (b) { b.style.background = t.vars["--panel"]; b.style.color = t.vars["--text"]; b.style.border = "1px solid " + t.vars["--line"]; });
      wrap.style.setProperty("--rte-link", t.vars["--link"]);
    };
    wrap.setColors(o.theme);
    return wrap;
  }

  window.RBF = { render: render, serialize: serialize, editor: editor, theme: theme, applyTheme: applyTheme, COLORS: COLORS, isRead: isRead, setRead: setRead, progress: progress };
})();
