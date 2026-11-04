/* =====================================================================
   Kero & Tota — Bible screen (separate file, loaded by index.html)
   Adds: bottom-bar Bible icon, Verse of the day, Read together,
         Our verses (saved / notes with replies + reactions),
         and the full Arabic Van Dyck Bible.
   Needs from index.html: db (Firestore), currentUser(), displayName(),
   profileOf(), switchScreen(), SCREEN_ORDER, showToast(), showWhoOverlay().
   Firestore collection used: "bible"  (one document per verse)
   ===================================================================== */
(function () {
  'use strict';
  if (window.__bibleLoaded) return;
  window.__bibleLoaded = true;

  var API = 'https://api.getbible.net/v2';
  var EN = 'kjv';                 // English text
  var AR_FALLBACK = 'arabicsv';   // Arabic Smith & Van Dyck

  // [English, Arabic (Van Dyck), chapters]
  var BOOKS = [
    ['Genesis','سفر التكوين',50],['Exodus','سفر الخروج',40],['Leviticus','سفر اللاويين',27],['Numbers','سفر العدد',36],['Deuteronomy','سفر التثنية',34],
    ['Joshua','سفر يشوع',24],['Judges','سفر القضاة',21],['Ruth','سفر راعوث',4],['1 Samuel','صموئيل الأول',31],['2 Samuel','صموئيل الثاني',24],
    ['1 Kings','الملوك الأول',22],['2 Kings','الملوك الثاني',25],['1 Chronicles','أخبار الأيام الأول',29],['2 Chronicles','أخبار الأيام الثاني',36],['Ezra','عزرا',10],
    ['Nehemiah','نحميا',13],['Esther','أستير',10],['Job','أيوب',42],['Psalms','المزامير',150],['Proverbs','الأمثال',31],
    ['Ecclesiastes','الجامعة',12],['Song of Solomon','نشيد الأنشاد',8],['Isaiah','إشعياء',66],['Jeremiah','إرميا',52],['Lamentations','مراثي إرميا',5],
    ['Ezekiel','حزقيال',48],['Daniel','دانيال',12],['Hosea','هوشع',14],['Joel','يوئيل',3],['Amos','عاموس',9],
    ['Obadiah','عوبديا',1],['Jonah','يونان',4],['Micah','ميخا',7],['Nahum','ناحوم',3],['Habakkuk','حبقوق',3],
    ['Zephaniah','صفنيا',3],['Haggai','حجي',2],['Zechariah','زكريا',14],['Malachi','ملاخي',4],
    ['Matthew','إنجيل متى',28],['Mark','إنجيل مرقس',16],['Luke','إنجيل لوقا',24],['John','إنجيل يوحنا',21],['Acts','أعمال الرسل',28],
    ['Romans','رومية',16],['1 Corinthians','كورنثوس الأولى',16],['2 Corinthians','كورنثوس الثانية',13],['Galatians','غلاطية',6],['Ephesians','أفسس',6],
    ['Philippians','فيلبي',4],['Colossians','كولوسي',4],['1 Thessalonians','تسالونيكي الأولى',5],['2 Thessalonians','تسالونيكي الثانية',3],['1 Timothy','تيموثاوس الأولى',6],
    ['2 Timothy','تيموثاوس الثانية',4],['Titus','تيطس',3],['Philemon','فليمون',1],['Hebrews','العبرانيين',13],['James','يعقوب',5],
    ['1 Peter','بطرس الأولى',5],['2 Peter','بطرس الثانية',3],['1 John','يوحنا الأولى',5],['2 John','يوحنا الثانية',1],['3 John','يوحنا الثالثة',1],
    ['Jude','يهوذا',1],['Revelation','رؤيا يوحنا',22]
  ];

  var COLOR = { Kero: 'rgba(251,191,36,.40)', Tota: 'rgba(167,139,250,.42)' };
  var DOT   = { Kero: '#f59e0b', Tota: '#8b5cf6' };
  var EMOJIS = ['❤️', '😍', '🙏', '🥹', '😂', '👍', '😮', '🔥', '👏'];

  var S = {
    tab: 'today', off: 0, tok: 0,
    read: { b: 43, c: 3, mode: 'both', stage: 'books' },
    lib: { b: null, c: null },
    filter: 'all',
    docs: {},
    open: null,       // { key, b, c, v, en, ar, replyTo }
    draft: '',
    picker: null, menu: null, editNote: null, editDraft: ''
  };
  try { var sv = JSON.parse(localStorage.getItem('bibleRead') || 'null'); if (sv && sv.b >= 1 && sv.b <= 66) { S.read = sv; if (!S.read.mode) S.read.mode = 'both'; if (!S.read.stage) S.read.stage = 'books'; } } catch (e) {}

  /* ---------------- small helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function me() { try { return currentUser(); } catch (e) { return null; } }
  function other(u) { return u === 'Kero' ? 'Tota' : u === 'Tota' ? 'Kero' : null; }
  function nm(id) { try { return displayName(id); } catch (e) { return id || ''; } }
  function emo(id) { try { return profileOf(id).emoji; } catch (e) { return id === 'Kero' ? '🐻' : '🦜'; } }
  function toast(m) { try { showToast(m); } catch (e) {} }
  function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function keyOf(b, c, v) { return b + '_' + c + '_' + v; }
  function refEn(b, c, v) { return BOOKS[b - 1][0] + ' ' + c + (v ? ':' + v : ''); }
  function refAr(b, c, v) { return BOOKS[b - 1][1] + ' ' + c + (v ? ':' + v : ''); }
  function ago(t) {
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 172800) return 'Yesterday';
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function needUser() {
    if (me()) return false;
    toast('Pick who you are first 💕');
    try { showWhoOverlay(false); } catch (e) {}
    return true;
  }

  /* ---------------- Bible text (getBible API) ---------------- */
  var cache = {}, arAbbr = null;
  function resolveAr() {
    if (arAbbr) return Promise.resolve(arAbbr);
    return fetch(API + '/translations.json').then(function (r) { return r.json(); }).then(function (j) {
      var list = Array.isArray(j) ? j : Object.keys(j).map(function (k) { return j[k]; });
      var hit = list.filter(function (t) {
        return t && /^ar/i.test(t.lang || '') && /van\s*dyck|smith/i.test(t.translation || t.name || '');
      })[0];
      arAbbr = (hit && hit.abbreviation) || AR_FALLBACK;
      return arAbbr;
    }).catch(function () { arAbbr = AR_FALLBACK; return arAbbr; });
  }
  function getChapter(tr, b, c) {
    var k = tr + '/' + b + '/' + c;
    if (cache[k]) return Promise.resolve(cache[k]);
    return fetch(API + '/' + tr + '/' + b + '/' + c + '.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var m = {};
      (j.verses || []).forEach(function (v) { m[v.verse] = String(v.text || '').replace(/\s+/g, ' ').trim(); });
      cache[k] = m; return m;
    });
  }
  function getEn(b, c) { return getChapter(EN, b, c); }
  function getAr(b, c) { return resolveAr().then(function (a) { return getChapter(a, b, c); }); }
  function cachedText(b, c, v) {
    var en = cache[EN + '/' + b + '/' + c], ar = arAbbr && cache[arAbbr + '/' + b + '/' + c];
    return { en: (en && en[v]) || '', ar: (ar && ar[v]) || '' };
  }

  /* ---------------- styles + markup ---------------- */
  var css = document.createElement('style');
  css.textContent = [
    '@import url("https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600&display=swap");',
    '.bottom-nav .nav-bubble { width: calc(100% / 6) !important; }',
    '.bb-card { background: #fff; border: 1px solid var(--c100); border-radius: 24px; padding: 14px; box-shadow: 0 1px 4px rgba(0,0,0,.04); }',
    /* Match the Our list controls by reusing its type-pill/sel classes. */
    '.bb-tabs { display: flex; gap: 8px; }',
    '.bb-tabs .bb-tab { min-width: 0; }',
    '.bb-ar { font-family: "Noto Naskh Arabic", "Amiri", serif; direction: rtl; text-align: right; line-height: 2.05; }',
    '.bb-votd { border-radius: 24px; padding: 18px; color: #fff; background: linear-gradient(135deg, var(--c400), var(--c500) 50%, var(--acc2)); box-shadow: 0 8px 22px rgb(var(--c500-rgb) / .28); }',
    '.bb-votd .lbl { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; opacity: .85; }',
    '.bb-votd .en { font-size: 16px; line-height: 1.6; font-weight: 500; margin-top: 8px; }',
    '.bb-votd .ar { font-size: 19px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.3); }',
    '.bb-votd .ref { font-size: 12px; font-weight: 700; margin-top: 10px; opacity: .95; }',
    '.bb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 14px; border-radius: 9999px; font-size: 12.5px; font-weight: 700; background: var(--c50); color: var(--c600); border: 1px solid var(--c100); transition: transform .12s; }',
    '.bb-btn:active { transform: scale(.95); }',
    '.bb-btn.solid { background: var(--c500); color: #fff; border-color: transparent; }',
    '.bb-btn.glass { background: rgba(255,255,255,.22); color: #fff; border-color: rgba(255,255,255,.35); }',
    '.bb-btn.on { background: var(--c100); border-color: var(--c400); }',
    '.bb-row { display: flex; flex-wrap: wrap; gap: 8px; }',
    '.bb-sel { flex: 1; min-width: 0; padding: 9px 10px; border-radius: 14px; border: 1px solid var(--c200); background: #fff; font-size: 13px; font-weight: 600; color: #334155; }',
    '.bb-seg { display: flex; background: var(--c50); border-radius: 9999px; padding: 3px; }',
    '.bb-seg button { flex: 1; padding: 7px 4px; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #64748b; }',
    '.bb-seg button.on { background: var(--c500); color: #fff; }',
    '.bv { position: relative; padding: 9px 10px; margin: 0 -4px; border-radius: 12px; cursor: pointer; line-height: 1.7; font-size: 15px; color: #334155; -webkit-tap-highlight-color: transparent; }',
    '.bv:active { background: var(--c50); }',
    '.bv .vn { display: inline-block; min-width: 1.4em; font-size: 10.5px; font-weight: 800; color: var(--c500); vertical-align: top; margin: 4px 4px 0 0; }',
    '.bv.rtl .vn { margin: 6px 0 0 4px; }',
    '.bv .bb-ar { font-size: 19px; margin-top: 2px; }',
    '.bv .vm { font-size: 11px; margin-inline-start: 6px; white-space: nowrap; }',
    '.bb-chapter-h { text-align: center; font-weight: 800; color: var(--c600); margin: 4px 0 8px; }',
    '.bb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; }',
    '.bb-grid.nums { grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); }',
    '.bb-bk { padding: 10px 6px; border-radius: 14px; background: var(--c50); border: 1px solid var(--c100); text-align: center; color: #334155; }',
    '.bb-bk b { display: block; font-family: "Noto Naskh Arabic", serif; font-size: 15px; line-height: 1.5; }',
    '.bb-bk small { font-size: 10px; color: #94a3b8; }',
    '.bb-sec { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; margin: 14px 2px 8px; }',
    '.bb-saved { border: 1px solid var(--c100); border-radius: 18px; padding: 12px; background: #fff; cursor: pointer; }',
    '.bb-saved + .bb-saved { margin-top: 10px; }',
    '.bb-saved .rf { font-size: 12px; font-weight: 800; color: var(--c600); }',
    '.bb-empty { text-align: center; color: #94a3b8; font-size: 13px; padding: 28px 10px; }',
    '.bb-err { text-align: center; padding: 22px 10px; color: #64748b; font-size: 13px; }',
    '.bb-skel { height: 14px; border-radius: 8px; background: linear-gradient(90deg, var(--c50), var(--c100), var(--c50)); background-size: 200% 100%; animation: bbsk 1.2s linear infinite; margin: 10px 0; }',
    '@keyframes bbsk { to { background-position: -200% 0; } }',
    '#bible-overlay { position: fixed; inset: 0; z-index: 95; display: none; background: rgba(15,10,25,.45); align-items: flex-end; justify-content: center; }',
    '#bible-overlay.open { display: flex; }',
    '#bible-panel { width: min(560px, 100%); max-height: 90vh; overflow-y: auto; background: #fff; border-radius: 24px 24px 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); }',
    '.bb-note { background: var(--c50); border-radius: 16px; padding: 10px 12px; }',
    '.bb-note + .bb-note { margin-top: 10px; }',
    '.bb-note .who { font-size: 12px; font-weight: 800; color: var(--c600); display: flex; justify-content: space-between; gap: 8px; }',
    '.bb-note .who span.t { font-weight: 500; color: #94a3b8; font-size: 10.5px; }',
    '.bb-note .tx { font-size: 14px; line-height: 1.55; color: #334155; margin-top: 3px; white-space: pre-wrap; word-break: break-word; }',
    '.bb-reply { margin: 8px 0 0 14px; padding: 8px 10px; background: #fff; border-radius: 12px; border-inline-start: 3px solid var(--c300); }',
    '.bb-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center; }',
    '.bb-chip { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 33px; min-height: 32px; font-size: 17px; line-height: 1.2; padding: 5px 7px; border-radius: 9999px; background: #fff; border: 1px solid var(--c200); color: #334155; opacity: 1; filter: none; transition: background .15s, border-color .15s, transform .15s; }',
    '.bb-chip:hover { background: var(--c50); border-color: var(--c400); }',
    '.bb-chip:active { transform: scale(.94); }',
    '.bb-chip:focus-visible { outline: 2px solid var(--c500); outline-offset: 2px; }',
    '.bb-chip.mine { border: 2px solid var(--c500); background: var(--c100); padding: 4px 6px; }',
    '.bb-chip-count { font-size: 11px; font-weight: 800; color: var(--c600); }',
    '.bb-preview-react { margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--c100); }',
    '.bb-react-caption { font-size: 11px; font-weight: 800; color: var(--c600); margin-right: 3px; }',
    /* Same compact action bar and heart buttons used by Journal. */
    '.bb-note-actions { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-top:10px; padding-top:8px; border-top:1px dashed var(--x2); }',
    '.bb-note-actions .bb-actions-right { display:flex; align-items:center; gap:5px; margin-left:auto; }',
    /* Compact Journal-style emoji + reactor badge, for Bible notes only. */
    '.bb-note-actions .bb-note-reactions { display:inline-flex; flex-wrap:wrap; align-items:center; gap:5px; }',
    '.bb-note-actions .bb-react-badge { display:inline-flex; align-items:center; justify-content:center; gap:4px; padding:3px 9px; min-height:25px; border-radius:9999px; border:1.5px solid transparent; background:rgb(var(--c500-rgb) / .08); font-size:14px; line-height:1.2; cursor:pointer; }',
    '.bb-note-actions .bb-react-badge small { font-size:10px; letter-spacing:-1px; }',
    '.bb-note-actions .bb-react-badge.mine { border-color:var(--c400); background:rgb(var(--c500-rgb) / .15); }',
    'html.dark .bb-note-actions .bb-react-badge { background:rgba(255,255,255,.1); color:var(--x8); }',
    'html.dark .bb-note-actions .bb-react-badge.mine { background:rgb(var(--c400-rgb) / .25); border-color:var(--c400); }',
    '.bb-note-actions .heart-btn { min-height:28px; color:#64748b; font-weight:700; cursor:pointer; }',
    '.bb-note-actions .heart-btn.liked { color:var(--c600); }',
    '.bb-note-actions .bb-reply-trigger { display:inline-flex; align-items:center; gap:4px; padding:5px 9px; border-radius:9999px; font-size:11px; background:rgba(255,255,255,.7); color:#64748b; font-weight:700; }',
    '.bb-note-actions button:focus-visible, .bb-note-menu button:focus-visible, .bb-note-picker button:focus-visible { outline:2px solid var(--c500); outline-offset:2px; }',
    '.bb-note-picker { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:6px; margin-top:9px; padding:9px 7px; border-radius:16px; background:rgba(255,255,255,.7); border:1px solid var(--c100); }',
    '.bb-note-picker .bb-chip { width:100%; min-width:0; min-height:38px; font-size:21px; }',
    '.bb-note-menu { display:grid; gap:5px; padding:8px; margin-top:8px; border-radius:14px; border:1px solid var(--c100); background:rgba(255,255,255,.7); }',
    '.bb-note-menu button { text-align:left; padding:9px 11px; font-size:13px; font-weight:700; color:var(--c600); border-radius:10px; }',
    '.bb-note-menu button:active { background:var(--c100); }',
    /* Journal / Memories bottom sheet interaction pattern for Bible note actions. */
    '#bb-actions-overlay { position:fixed; inset:0; z-index:110; display:none; align-items:flex-end; justify-content:center; background:rgba(15,23,42,.45); }',
    '#bb-actions-overlay.open { display:flex; }',
    '#bb-actions-panel { width:100%; max-width:28rem; max-height:88vh; max-height:88dvh; overflow-y:auto; -webkit-overflow-scrolling:touch; background:#fff; border-radius:24px 24px 0 0; padding:16px 20px calc(20px + env(safe-area-inset-bottom)); animation:sheetUp .25s ease; color:#334155; }',
    '.bb-sheet-handle { width:40px; height:4px; border-radius:999px; background:#e2e8f0; margin:0 auto 16px; }',
    '.bb-sheet-title { font-family:"Dancing Script",cursive; font-size:29px; font-weight:700; color:var(--c600); text-align:center; margin:0 0 14px; }',
    '.bb-sheet-btn { width:100%; min-height:50px; padding:14px; margin-bottom:10px; border-radius:16px; background:var(--c50); color:var(--c600); font-weight:700; font-size:15px; display:flex; justify-content:center; align-items:center; gap:8px; text-align:center; }',
    '.bb-sheet-btn.primary { background:var(--c500); color:#fff; }',
    '.bb-sheet-btn:active,.bb-react-pick:active { transform:scale(.98); }',
    '.bb-react-picker { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; margin-bottom:20px; }',
    '.bb-react-pick { width:100%; max-width:50px; aspect-ratio:1; border-radius:9999px; font-size:25px; display:flex; align-items:center; justify-content:center; background:var(--c50); border:2px solid transparent; }',
    '.bb-react-pick.sel { border-color:var(--c500); background:var(--c100); }',
    '.bb-sheet-quote { font-size:12px; color:#94a3b8; text-align:center; margin:-2px 0 15px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }',
    '.bb-sheet-reply { background:var(--c50); padding:12px; border-radius:17px; margin-bottom:10px; }',
    '.bb-sheet-reply.mine { background:var(--c100); }',
    '.bb-sheet-reply .tx { white-space:pre-wrap; overflow-wrap:anywhere; font-size:14px; margin:5px 0; }',
    '.bb-sheet-reply .who { display:flex; justify-content:space-between; align-items:center; gap:7px; color:var(--c600); font-weight:700; font-size:12px; }',
    '.bb-sheet-input { width:100%; border:1px solid var(--c100); background:var(--c50); border-radius:17px; padding:13px; font-size:16px; color:#334155; resize:vertical; margin:4px 0 12px; }',
    '.bb-sheet-reply-tools { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:8px; }',
    '.bb-sheet-mini { padding:5px 9px; background:var(--c100); color:var(--c600); border-radius:999px; font-size:15px; }',
    '.bb-sheet-mini.mine { outline:2px solid var(--c500); }',
    '.bb-sheet-btn:focus-visible,.bb-react-pick:focus-visible,.bb-sheet-mini:focus-visible { outline:2px solid var(--c500); outline-offset:2px; }',
    'html.dark #bb-actions-overlay { background:rgba(0,0,0,.62); }',
    'html.dark #bb-actions-panel { background:var(--x9); color:var(--x8); }',
    'html.dark .bb-sheet-btn { background:var(--x11); color:var(--c300); }',
    'html.dark .bb-sheet-btn.primary { background:var(--c500); color:#fff; }',
    'html.dark .bb-react-pick { background:var(--x11); }',
    'html.dark .bb-react-pick.sel { border-color:var(--c400); background:var(--x7); }',
    'html.dark .bb-sheet-reply { background:var(--x11); color:var(--x8); }',
    'html.dark .bb-sheet-reply.mine { background:var(--x7); }',
    'html.dark .bb-sheet-input { background:var(--x11); border-color:var(--x7); color:var(--x8); }',
    'html.dark .bb-sheet-mini { background:var(--x7); color:var(--x8); }',
    'html.dark .bb-sheet-handle { background:var(--x7); }',
    '.bb-note-edit { margin-top:8px; }',
    '.bb-note-edit .bb-input { font-size:16px; }',
    '.bb-preview-note { margin-top:10px; padding-top:8px; border-top:1px solid var(--c100); }',
    '.bb-mini { font-size: 11px; font-weight: 700; color: var(--c600); padding: 2px 6px; }',
    '.bb-mini.del { color: #94a3b8; }',
    '.bb-input { width: 100%; border: 1px solid var(--c200); border-radius: 14px; padding: 10px 12px; font-size: 14px; background: #fff; color: #334155; resize: none; }',
    '.bb-flash { animation: bbfl 2.2s ease; }',
    '@keyframes bbfl { 0%,60% { box-shadow: 0 0 0 3px var(--c400); } 100% { box-shadow: 0 0 0 0 transparent; } }',
    /* Bible headings: match the Our Bible title (#fb7185) in dark mode only. */
    'html.dark #screen-bible .bb-chapter-h { color: #fb7185; }',
    /* Verse numbers: use the same soft pink, only inside Bible dark mode. */
    'html.dark #screen-bible .bv .vn { color: #fb7185; }',
    /* Ours: saved-verse references use the same soft pink in Bible dark mode. */
    'html.dark #screen-bible .bb-saved .rf { color: #fb7185; }',
    /* dark mode */
    'html.dark .bb-votd { background: linear-gradient(135deg, var(--x3) 0%, var(--x4) 45%, var(--acc2d) 100%); box-shadow: 0 8px 22px rgba(0,0,0,.4); }',
    'html.dark .bb-card, html.dark #bible-panel, html.dark .bb-saved, html.dark .bb-reply { background: var(--x9); border-color: var(--x11); }',
    'html.dark .bb-seg, html.dark .bb-bk, html.dark .bb-btn { background: var(--x11); border-color: var(--x7); color: var(--x12); }',
    'html.dark .bb-btn.glass { background: linear-gradient(135deg, rgba(244,63,94,.38), rgba(168,85,247,.38)); border-color: rgba(255,255,255,.20); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }',
    'html.dark .bb-btn.glass.on { background: linear-gradient(135deg, rgba(244,63,94,.52), rgba(168,85,247,.52)); border-color: rgba(255,255,255,.32); color: #fff; }',
    'html.dark .bb-btn.solid, html.dark .bb-seg button.on { background: var(--c500); color: #fff; }',
    'html.dark .bb-btn.on { background: var(--x7); border-color: var(--c400); }',
    'html.dark .bb-sel, html.dark .bb-input { background: var(--x11); border-color: var(--x7); color: var(--x8); }',
    'html.dark .bb-seg button { color: var(--x13); }',
    'html.dark .bv, html.dark .bb-bk, html.dark .bb-note .tx { color: var(--x8); }',
    'html.dark .bv:active { background: var(--x11); }',
    'html.dark .bb-note { background: var(--x11); }',
    'html.dark #bible-panel div[style*="background:var(--c50)"] { background: var(--x11) !important; color: var(--x8) !important; }',
    'html.dark #bible-panel div[style*="background:var(--c50)"] div { color: var(--x8); }',
    'html.dark #bible-panel div[style*="background:var(--c50)"] .bb-ar { color: var(--x8) !important; }',
    'html.dark #bible-panel [style*="color:var(--c600)"] { color: var(--x8) !important; }',
    'html.dark #bible-panel .bb-empty { color: var(--x13); }',
    'html.dark .bb-chip { background: var(--x7); border-color: rgba(255,255,255,.22); color: var(--x8); opacity: 1; filter: none; }',
    'html.dark .bb-chip:hover { background: var(--x11); border-color: var(--c400); }',
    'html.dark .bb-chip.mine { background: rgba(244,63,94,.23); border-color: var(--c400); }',
    'html.dark .bb-chip-count, html.dark .bb-react-caption { color: var(--x8); }',
    'html.dark .bb-note-actions { border-top-color:var(--x36); }',
    'html.dark .bb-note-actions .bb-reply-trigger, html.dark .bb-note-picker, html.dark .bb-note-menu { background:rgba(255,255,255,.1); color:var(--x8); border-color:var(--x7); }',
    'html.dark .bb-note-actions .heart-btn { color:var(--x8); }',
    'html.dark .bb-note-actions .heart-btn.liked { color:#fda4af; }',
    'html.dark .bb-note-menu button { color:var(--x8); }',
    'html.dark .bb-preview-note { border-top-color:var(--x7); }',
    'html.dark .bb-preview-react { border-top-color: var(--x7); }',
    'html.dark .bb-skel { background: linear-gradient(90deg, var(--x11), var(--x7), var(--x11)); background-size: 200% 100%; }'
  ].join('\n');
  document.head.appendChild(css);

  // screen
  var section = document.createElement('section');
  section.id = 'screen-bible';
  section.className = 'space-y-4 hidden';
  section.innerHTML =
    '<div class="card-grad rounded-3xl p-5 border border-rose-100 shadow-sm space-y-4">' +
      '<div class="text-center"><h3 class="font-cursive text-3xl font-bold text-rose-600 leading-tight">Our Bible ✝️</h3></div>' +
      '<div class="bb-tabs" id="bb-tabs">' +
        '<button type="button" class="type-pill bb-tab sel on" data-t="today" aria-pressed="true">🌅 Today</button>' +
        '<button type="button" class="type-pill bb-tab" data-t="read" aria-pressed="false">📖 Read</button>' +
        '<button type="button" class="type-pill bb-tab" data-t="ours" aria-pressed="false">💛 Ours</button>' +
      '</div>' +
    '</div>' +
    '<div id="bb-body"></div>';
  var settings = $('screen-settings');
  settings.parentNode.insertBefore(section, settings);   // order doesn't matter visually; only one screen shows

  // bottom-bar icon, right beside the list icon
  var btn = document.createElement('button');
  btn.id = 'screen-bible-btn';
  btn.className = 'tab-btn';
  btn.setAttribute('aria-label', 'Bible');
  btn.setAttribute('onclick', "switchScreen('bible')");
  btn.innerHTML = '<i class="fas fa-bible"></i>';
  var listBtn = $('screen-list-btn');
  listBtn.parentNode.insertBefore(btn, listBtn.nextSibling);
  SCREEN_ORDER.splice(SCREEN_ORDER.indexOf('list') + 1, 0, 'bible');

  // verse sheet
  var overlay = document.createElement('div');
  overlay.id = 'bible-overlay';
  overlay.innerHTML = '<div id="bible-panel"></div>';
  document.body.appendChild(overlay);
  var panel = $('bible-panel');
  var body = $('bb-body');

  // Separate from Journal's global #sheet-overlay so its state and closeSheet()
  // cannot interfere with a Bible verse that is already open.
  var actionsOverlay = document.createElement('div');
  actionsOverlay.id = 'bb-actions-overlay';
  actionsOverlay.innerHTML = '<div id="bb-actions-panel" role="dialog" aria-modal="true" aria-label="Bible note actions"></div>';
  document.body.appendChild(actionsOverlay);
  var actionsPanel = $('bb-actions-panel');
  var actionSheet = null; // {type, key, nid, pickerReply, draft}
  actionsOverlay.addEventListener('click', function (e) { if (e.target === actionsOverlay) closeActionSheet(); });
  function closeActionSheet() {
    actionsOverlay.classList.remove('open');
    actionsPanel.innerHTML = '';
    if (actionSheet && actionSheet.restoreVerse && S.open) overlay.classList.add('open');
    actionSheet = null;
  }
  function sheetNote() {
    var d = actionSheet && S.docs[actionSheet.key];
    return d && findNote(d, actionSheet.nid);
  }
  function showActionSheet(type, nid, verse) {
    // Preview cards pass their own verse context: never open a verse behind the sheet.
    var ctx = verse || S.open;
    if (!ctx || !nid) return;
    var restoreVerse = !!(S.open && overlay.classList.contains('open'));
    if (restoreVerse) overlay.classList.remove('open');
    actionSheet = { type:type, key:ctx.key || keyOf(ctx.b,ctx.c,ctx.v), b:ctx.b, c:ctx.c, v:ctx.v, en:ctx.en, ar:ctx.ar, nid:String(nid), pickerReply:null, draft:'', restoreVerse:restoreVerse };
    actionsOverlay.classList.add('open');
    renderActionSheet(true);
  }
  function renderActionSheet(fresh) {
    if (!actionSheet) return;
    var a = actionSheet, n = sheetNote();
    if (!n) { closeActionSheet(); return; }
    var input = actionsPanel.querySelector('[data-bb-draft]');
    if (input) a.draft = input.value;
    var scroll = fresh ? 0 : actionsPanel.scrollTop;
    var id = esc(n.id), mine = n.by === me(), h = '<div class="bb-sheet-handle"></div>';
    if (a.type === 'menu') {
      h += '<button type="button" class="bb-sheet-btn" data-sheet="replies">💬 Reply</button>' +
        '<button type="button" class="bb-sheet-btn" data-sheet="pin">' + (n.pinned ? '📌 Unpin' : '📌 Pin to top') + '</button>' +
        (mine ? '<button type="button" class="bb-sheet-btn" data-sheet="edit">✏️ Edit note</button><button type="button" class="bb-sheet-btn" data-sheet="delete">🗑️ Delete note</button>' : '') +
        '<button type="button" class="bb-sheet-btn" data-sheet="close">Cancel</button>';
    } else if (a.type === 'react') {
      var options = ['😂','😍','🥹','😮','🔥','👏'];
      h += '<h3 class="bb-sheet-title">React 💕</h3><div class="bb-react-picker">' + options.map(function(e) {
        return '<button type="button" class="bb-react-pick' + ((n.reactions || {})[me()] === e ? ' sel' : '') + '" data-sheet="choose" data-e="' + e + '" aria-label="React ' + e + '">' + e + '</button>';
      }).join('') + '</div><button type="button" class="bb-sheet-btn" data-sheet="close">Cancel</button>';
    } else if (a.type === 'replies') {
      h += '<h3 class="bb-sheet-title">Replies 💬</h3><div class="bb-sheet-quote">“' + esc(clip(n.text, 90)) + '”</div>';
      var replies = (n.replies || []).slice().sort(function(x,y) {return Number(x.at || x.id)-Number(y.at || y.id);});
      if (!replies.length) h += '<p class="bb-sheet-quote">No replies yet. Be the first 💕</p>';
      replies.forEach(function(r) {
        var mineR = r.by === me();
        h += '<div class="bb-sheet-reply' + (mineR ? ' mine' : '') + '"><div class="who"><span>' + emo(r.by) + ' ' + esc(nm(r.by)) + ' <span style="font-weight:400;color:#94a3b8">· ' + ago(r.at || r.id) + '</span></span>' +
          (mineR ? '<button type="button" data-sheet="delreply" data-rid="' + esc(r.id) + '" aria-label="Delete reply">🗑️</button>' : '') + '</div><p class="tx">' + esc(r.text) + '</p>' +
          '<div class="bb-sheet-reply-tools">';
        var react = r.reactions || {}, counts = {};
        Object.keys(react).forEach(function(u) { if(react[u]) counts[react[u]] = (counts[react[u]] || 0)+1; });
        Object.keys(counts).forEach(function(e) {
          h += '<button type="button" class="bb-sheet-mini' + (react[me()] === e ? ' mine' : '') + '" data-sheet="replyreact" data-rid="' + esc(r.id) + '" data-e="' + esc(e) + '">' + esc(e) + (counts[e] > 1 ? ' ' + counts[e] : '') + '</button>';
        });
        h += '<button type="button" class="bb-sheet-mini" data-sheet="replypicker" data-rid="' + esc(r.id) + '" aria-label="React to reply"><i class="far fa-face-smile"></i></button></div>';
        if (String(a.pickerReply) === String(r.id)) h += '<div class="bb-react-picker" style="margin-top:9px;margin-bottom:0">' + ['😂','😍','🥹','😮','🔥','👏'].map(function(e) {
          return '<button type="button" class="bb-react-pick' + (react[me()] === e ? ' sel' : '') + '" data-sheet="replyreact" data-rid="' + esc(r.id) + '" data-e="' + e + '">' + e + '</button>';
        }).join('') + '</div>';
        h += '</div>';
      });
      h += '<textarea class="bb-sheet-input" rows="2" maxlength="500" data-bb-draft placeholder="Write a reply…"></textarea>' +
        '<button type="button" class="bb-sheet-btn primary" data-sheet="sendreply">Send reply 💕</button>' +
        '<button type="button" class="bb-sheet-btn" data-sheet="close">Close</button>';
    } else if (a.type === 'edit' && mine) {
      if (fresh) a.draft = n.text;
      h += '<h3 class="bb-sheet-title">Edit note ✏️</h3><textarea class="bb-sheet-input" rows="4" maxlength="5000" data-bb-draft></textarea>' +
        '<button type="button" class="bb-sheet-btn primary" data-sheet="saveedit">Save 💕</button><button type="button" class="bb-sheet-btn" data-sheet="close">Cancel</button>';
    } else if (a.type === 'delete' && mine) {
      h += '<h3 class="bb-sheet-title">Delete note? 🗑️</h3><button type="button" class="bb-sheet-btn primary" data-sheet="confirmdelete">Yes, delete it</button>' +
        '<button type="button" class="bb-sheet-btn" data-sheet="close">Keep it 💕</button>';
    } else { closeActionSheet(); return; }
    actionsPanel.innerHTML = h;
    var field = actionsPanel.querySelector('[data-bb-draft]'); if(field) field.value = a.draft;
    actionsPanel.scrollTop = scroll;
  }
  actionsPanel.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-sheet]'); if (!btn || !actionSheet) return;
    var type = btn.getAttribute('data-sheet'), a = actionSheet, n = sheetNote(), m = me();
    if (!n) return closeActionSheet();
    // Sheet actions can be launched directly from Ours, without opening a verse.
    var o = a;
    if (type === 'close') return closeActionSheet();
    if (type === 'replies' || type === 'edit' || type === 'delete') {
      if ((type === 'edit' || type === 'delete') && n.by !== m) return;
      a.type = type; a.pickerReply = null; a.draft = ''; return renderActionSheet(true);
    }
    if (needUser()) return;
    if (type === 'choose') {
      var emoji = btn.getAttribute('data-e');
      closeActionSheet(); return toggleReaction(o.b,o.c,o.v,o.en,o.ar,n.id,'',emoji);
    }
    if (type === 'pin') {
      closeActionSheet(); return mutate(o.b,o.c,o.v,o.en,o.ar,function(d) {var note=findNote(d,n.id); if(note) note.pinned=!note.pinned;});
    }
    if (type === 'replypicker') {
      var rid = btn.getAttribute('data-rid'); a.pickerReply = String(a.pickerReply) === String(rid) ? null : rid; return renderActionSheet(false);
    }
    if (type === 'replyreact') {
      var rr = btn.getAttribute('data-rid'), em = btn.getAttribute('data-e');
      a.pickerReply = null;
      return toggleReaction(o.b,o.c,o.v,o.en,o.ar,n.id,rr,em).then(function(){if(actionSheet) renderActionSheet(false);});
    }
    if (type === 'delreply') {
      var delid = btn.getAttribute('data-rid');
      var target = (n.replies || []).filter(function(r){return String(r.id) === String(delid);})[0];
      if (!target || target.by !== m || !confirm('Delete this reply?')) return;
      return mutate(o.b,o.c,o.v,o.en,o.ar,function(d){var note=findNote(d,n.id); if(note) note.replies=(note.replies||[]).filter(function(r){return String(r.id)!==String(delid) || r.by!==m;});});
    }
    var input = actionsPanel.querySelector('[data-bb-draft]'), value = input ? input.value.trim() : '';
    if (type === 'sendreply') {
      if (!value) return toast('Write a reply first 💕');
      a.draft = ''; if(input) input.value = '';
      return mutate(o.b,o.c,o.v,o.en,o.ar,function(d){var note=findNote(d,n.id); if(note){var id=Date.now();note.replies=note.replies||[]; note.replies.push({id:id,by:m,text:value,at:id,reactions:{}});}}).then(function(){ if(actionSheet) renderActionSheet(false); });
    }
    if (type === 'saveedit') {
      if (n.by !== m || !value) return toast('The note cannot be empty 💕');
      closeActionSheet(); return mutate(o.b,o.c,o.v,o.en,o.ar,function(d){var note=findNote(d,n.id);if(note && note.by===m) note.text=value;});
    }
    if (type === 'confirmdelete') {
      if (n.by !== m) return;
      closeActionSheet(); return mutate(o.b,o.c,o.v,o.en,o.ar,function(d){d.notes=(d.notes||[]).filter(function(note){return String(note.id)!==String(n.id) || note.by!==m;});});
    }
  });


  /* ---------------- tabs ---------------- */
  $('bb-tabs').addEventListener('click', function (e) {
    var t = e.target.closest('.bb-tab'); if (!t) return;
    setTab(t.getAttribute('data-t'));
  });
  function setTab(t) {
    S.tab = t;
    Array.prototype.forEach.call(document.querySelectorAll('#bb-tabs .bb-tab'), function (b) {
      var active = b.getAttribute('data-t') === t;
      b.classList.toggle('on', active);
      b.classList.toggle('sel', active);
      b.setAttribute('aria-pressed', String(active));
    });
    render();
  }
  function render() {
    if (S.tab === 'today') renderToday();
    else if (S.tab === 'read') renderRead();
    else if (S.tab === 'ours') renderOurs();
  }
  // render the first time the screen is opened
  var _switch = window.switchScreen;
  var firstShow = true;
  window.switchScreen = function (s) {
    var r = _switch.apply(this, arguments);
    if (s === 'bible' && firstShow) { firstShow = false; render(); }
    return r;
  };

  /* ---------------- marks (highlight colour, star, note count) ---------------- */
  function hlBg(d) {
    if (!d || !d.hl) return '';
    var k = d.hl.Kero, t = d.hl.Tota;
    if (k && t) return 'linear-gradient(90deg,' + COLOR.Kero + ',' + COLOR.Tota + ')';
    if (k) return COLOR.Kero;
    if (t) return COLOR.Tota;
    return '';
  }
  function marksHtml(d) {
    if (!d) return '';
    var s = '';
    ['Kero', 'Tota'].forEach(function (u) { if (d.fav && d.fav[u]) s += '<span title="' + esc(nm(u)) + '" style="color:' + DOT[u] + '">★</span>'; });
    var n = (d.notes || []).length;
    if (n) s += ' <span style="color:var(--c500)">💬' + n + '</span>';
    // Display the pin next to the note count at the top-right of the verse card.
    if ((d.notes || []).some(function(note) {return !!note.pinned;})) s += ' <span title="Pinned note" aria-label="Pinned note">📌</span>';
    return s;
  }
  function markVerses() {
    Array.prototype.forEach.call(document.querySelectorAll('#bb-body .bv'), function (el) {
      var d = S.docs[el.getAttribute('data-k')];
      el.style.background = '';
      var vm = el.querySelector('.vm'); if (vm) vm.innerHTML = marksHtml(d);
    });
  }

  /* ---------------- TODAY ---------------- */
  // Pick a stable real Bible reference using THIS phone's local calendar date.
  // The same date gets the same verse on both phones; midnight is local to each.
  // The text itself is loaded live from the getBible API below.
  function localBibleDateKey(off) {
    var d = new Date();
    d.setDate(d.getDate() + (off || 0));
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function dailyRandoms(off) {
    var seed = localBibleDateKey(off);
    function next() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }
    return [next(), next(), next()];
  }

  // Recheck on local midnight, and when the app returns from the background.
  var lastBibleDate = localBibleDateKey(0);
  function checkBibleMidnight() {
    var today = localBibleDateKey(0);
    if (today === lastBibleDate) return;
    lastBibleDate = today;
    if (S.tab === 'today' && !$('screen-bible').classList.contains('hidden')) {
      renderToday();
    }
  }
  setInterval(checkBibleMidnight, 15000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkBibleMidnight();
  });
  function dailyBookChapter(off) {
    var r = dailyRandoms(off);
    var b = Math.floor(r[0] * BOOKS.length) + 1;
    var c = Math.floor(r[1] * BOOKS[b - 1][2]) + 1;
    return { b: b, c: c, versePick: r[2] };
  }
  function errBox(msg, fn) {
    body.innerHTML = '<div class="bb-card bb-err">' + esc(msg) + '<br><button class="bb-btn solid" style="margin-top:12px" id="bb-retry">Try again</button></div>';
    $('bb-retry').onclick = fn;
  }
  function skeleton() { body.innerHTML = '<div class="bb-card"><div class="bb-skel" style="width:90%"></div><div class="bb-skel"></div><div class="bb-skel" style="width:60%"></div></div>'; }

  function renderToday() {
    var tok = ++S.tok;
    var pick = dailyBookChapter(0), b = pick.b, c = pick.c;
    skeleton();
    Promise.all([
      getEn(b, c).catch(function () { return null; }),
      getAr(b, c).catch(function () { return null; })
    ]).then(function (res) {
      if (tok !== S.tok) return;
      var enChapter = res[0], arChapter = res[1];
      var available = Object.keys(Object.assign({}, enChapter || {}, arChapter || {})).map(Number).filter(function (n) {
        return (enChapter && enChapter[n]) || (arChapter && arChapter[n]);
      }).sort(function (a, b) { return a - b; });
      if (!available.length) return errBox('Could not load a verse from the Bible. Check your internet connection and try again.', renderToday);
      var v = available[Math.min(available.length - 1, Math.floor(pick.versePick * available.length))];
      var en = enChapter && enChapter[v], ar = arChapter && arChapter[v];
      if (!en && !ar) return errBox('Could not load the verse. Check your internet connection.', renderToday);
      body.innerHTML =
        '<div class="bb-votd">' +
          '<div class="lbl">🌅 Verse of the day · for both of us</div>' +
          (en ? '<div class="en">“' + esc(en) + '”</div>' : '') +
          (ar ? '<div class="ar bb-ar">' + esc(ar) + '</div>' : '') +
          '<div class="ref">' + esc(refEn(b, c, v)) + ' · ' + esc(refAr(b, c, v)) + '</div>' +
          '<div class="bb-row" style="margin-top:14px;align-items:center;flex-wrap:wrap">' +
            '<button class="bb-btn glass" id="bb-chap">📖 Read chapter</button>' +
            '<div class="bb-row" id="bb-today-act" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"></div>' +
          '</div>' +
        '</div>';
      $('bb-chap').onclick = function () { S.read.b = b; S.read.c = c; S.read.stage = 'reader'; saveRead(); setTab('read'); };
      S.today = { b: b, c: c, v: v, en: en || '', ar: ar || '' };
      updateTodayAct();
    });
  }
  function updateTodayAct() {
    var el = $('bb-today-act'); if (!el || !S.today) return;
    var t = S.today, d = S.docs[keyOf(t.b, t.c, t.v)], m = me();
    var fav = d && d.fav && m && d.fav[m], n = d && d.notes ? d.notes.length : 0;
    el.innerHTML =
      '<button class="bb-btn glass" data-a="fav">' + (fav ? '★ Saved' : '☆ Save') + '</button>' +
      '<button class="bb-btn glass" data-a="note">💬 Note' + (n ? ' (' + n + ')' : '') + '</button>';
    el.onclick = function (e) {
      var a = e.target.closest('[data-a]'); if (!a) return;
      var act = a.getAttribute('data-a');
      if (act === 'note') return openSheet(t.b, t.c, t.v, t.en, t.ar);
      if (needUser()) return;
      mutate(t.b, t.c, t.v, t.en, t.ar, function (doc) {
        doc.fav[m] = !doc.fav[m];
      });
    };
  }

  /* ---------------- chapter rendering (shared by Read + Bible tabs) ---------------- */
  function saveRead() { try { localStorage.setItem('bibleRead', JSON.stringify(S.read)); } catch (e) {} }
  function stepChapter(st, dir) {
    var b = st.b, c = st.c + dir;
    if (c < 1) { if (b > 1) { b--; c = BOOKS[b - 1][2]; } else c = 1; }
    else if (c > BOOKS[b - 1][2]) { if (b < 66) { b++; c = 1; } else c = BOOKS[b - 1][2]; }
    st.b = b; st.c = c;
  }
  function chapterHtml(b, c, mode, en, ar) {
    var nums = {};
    Object.keys(en || {}).forEach(function (k) { nums[k] = 1; });
    Object.keys(ar || {}).forEach(function (k) { nums[k] = 1; });
    var list = Object.keys(nums).map(Number).sort(function (a, z) { return a - z; });
    if (!list.length) return '<div class="bb-empty">No text found for this chapter.</div>';
    return list.map(function (n) {
      var e = en && en[n], a = ar && ar[n];
      var inner = '<span class="vn">' + n + '</span>';
      if (mode !== 'ar' && e) inner += '<span>' + esc(e) + '</span>';
      if (mode !== 'en' && a) inner += '<div class="bb-ar">' + esc(a) + '</div>';
      inner += '<span class="vm"></span>';
      return '<div class="bv ' + (mode === 'ar' ? 'rtl bb-ar' : '') + '" data-k="' + keyOf(b, c, n) + '" data-b="' + b + '" data-c="' + c + '" data-v="' + n + '"' +
             (mode === 'ar' ? ' dir="rtl"' : '') + '>' + inner + '</div>';
    }).join('');
  }
  function loadChapter(b, c, mode) {
    var needEn = mode !== 'ar', needAr = mode !== 'en';
    return Promise.all([needEn ? getEn(b, c) : null, needAr ? getAr(b, c) : null]);
  }
  function wireVerses(el) {
    el.onclick = function (e) {
      var v = e.target.closest('.bv'); if (!v) return;
      var b = +v.getAttribute('data-b'), c = +v.getAttribute('data-c'), n = +v.getAttribute('data-v');
      var t = cachedText(b, c, n);
      openSheet(b, c, n, t.en, t.ar);
    };
  }

  /* ---------------- READ ---------------- */
  function renderRead() {
    var tok = ++S.tok, st = S.read;
    function bookGrid(from, to, title) {
      var h = '<div class="bb-sec" style="text-align:center">' + title + '</div><div class="bb-grid">';
      for (var i = from; i < to; i++) h += '<button class="bb-bk" data-b="' + (i + 1) + '"><b>' + esc(BOOKS[i][1]) + '</b><small>' + esc(BOOKS[i][0]) + '</small></button>';
      return h + '</div>';
    }
    if (st.stage === 'books') {
      body.innerHTML = '<div class="bb-card"><div class="bb-chapter-h bb-ar" style="font-size:20px;line-height:1.6">الكتاب المقدس</div>' +
        bookGrid(0, 39, 'العهد القديم') + bookGrid(39, 66, 'العهد الجديد') + '</div>';
      body.querySelector('.bb-card').onclick = function (e) {
        var k = e.target.closest('.bb-bk'); if (!k) return;
        st.b = +k.getAttribute('data-b'); st.c = 1; st.stage = 'chapters'; saveRead(); renderRead(); window.scrollTo(0, 0);
      };
      return;
    }
    if (st.stage === 'chapters') {
      var nums = '';
      for (var n = 1; n <= BOOKS[st.b - 1][2]; n++) nums += '<button class="bb-bk" data-c="' + n + '"><b>' + n + '</b></button>';
      body.innerHTML = '<div class="bb-card"><button class="bb-btn" id="bb-back-books">◀ Books / الكتب</button>' +
        '<div class="bb-chapter-h bb-ar" style="font-size:20px;margin-top:10px">' + esc(BOOKS[st.b - 1][1]) + '</div>' +
        '<p style="text-align:center;font-size:12px;color:#94a3b8">' + esc(BOOKS[st.b - 1][0]) + ' · Choose a chapter</p><div class="bb-grid nums">' + nums + '</div></div>';
      $('bb-back-books').onclick = function () { st.stage = 'books'; saveRead(); renderRead(); };
      body.querySelector('.bb-grid').onclick = function (e) {
        var k = e.target.closest('.bb-bk'); if (!k) return;
        st.c = +k.getAttribute('data-c'); st.stage = 'reader'; saveRead(); renderRead(); window.scrollTo(0, 0);
      };
      return;
    }
    var opts = BOOKS.map(function (bk, i) {
      return (i === 0 ? '<optgroup label="Old Testament">' : i === 39 ? '</optgroup><optgroup label="New Testament">' : '') +
        '<option value="' + (i + 1) + '"' + (st.b === i + 1 ? ' selected' : '') + '>' + esc(bk[0]) + ' · ' + esc(bk[1]) + '</option>';
    }).join('') + '</optgroup>';
    var chs = '';
    for (var i = 1; i <= BOOKS[st.b - 1][2]; i++) chs += '<option value="' + i + '"' + (i === st.c ? ' selected' : '') + '>' + i + '</option>';
    body.innerHTML =
      '<div class="bb-card" style="margin-bottom:14px">' +
        '<div class="bb-row" style="flex-wrap:nowrap"><button class="bb-btn" id="bb-back-chapters">◀ Chapters</button><button class="bb-btn" id="bb-back-books2">📚 Books / الكتب</button></div>' +
        '<div class="bb-row" style="flex-wrap:nowrap;margin-top:10px"><select id="bb-book" class="bb-sel" style="flex:3">' + opts + '</select>' +
        '<select id="bb-chap-sel" class="bb-sel" style="flex:1">' + chs + '</select></div>' +
        '<div class="bb-seg" style="margin-top:10px">' +
          ['en:English', 'ar:العربية', 'both:Both'].map(function (x) { var p = x.split(':'); return '<button data-m="' + p[0] + '" class="' + (st.mode === p[0] ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') +
        '</div>' +
      '</div>' +
      '<div class="bb-card"><div class="bb-chapter-h">' + esc(refEn(st.b, st.c)) + (st.mode !== 'en' ? ' · ' + esc(refAr(st.b, st.c)) : '') + '</div>' +
      '<div id="bb-verses"><div class="bb-skel"></div><div class="bb-skel" style="width:70%"></div><div class="bb-skel"></div></div>' +
      '<div class="bb-row" style="justify-content:space-between;margin-top:12px"><button class="bb-btn" id="bb-prev">◀ Previous</button><button class="bb-btn" id="bb-nxt">Next ▶</button></div>' +
      '<p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:10px">Tap any verse to save it with ★ or add a note 💕</p></div>';
    $('bb-back-chapters').onclick = function () { st.stage = 'chapters'; saveRead(); renderRead(); };
    $('bb-back-books2').onclick = function () { st.stage = 'books'; saveRead(); renderRead(); };
    $('bb-book').onchange = function () { st.b = +this.value; st.c = 1; saveRead(); renderRead(); };
    $('bb-chap-sel').onchange = function () { st.c = +this.value; saveRead(); renderRead(); };
    Array.prototype.forEach.call(body.querySelectorAll('.bb-seg button'), function (x) {
      x.onclick = function () { st.mode = x.getAttribute('data-m'); saveRead(); renderRead(); };
    });
    $('bb-prev').onclick = function () { stepChapter(st, -1); saveRead(); renderRead(); window.scrollTo(0, 0); };
    $('bb-nxt').onclick = function () { stepChapter(st, 1); saveRead(); renderRead(); window.scrollTo(0, 0); };
    loadChapter(st.b, st.c, st.mode).then(function (r) {
      if (tok !== S.tok) return;
      var box = $('bb-verses'); if (!box) return;
      box.innerHTML = chapterHtml(st.b, st.c, st.mode, r[0], r[1]);
      wireVerses(box); markVerses();
    }).catch(function () {
      if (tok !== S.tok) return;
      var box = $('bb-verses'); if (box) { box.innerHTML = '<div class="bb-err">Could not load this chapter.<br><button class="bb-btn solid" style="margin-top:10px" id="bb-retry2">Try again</button></div>'; $('bb-retry2').onclick = renderRead; }
    });
  }

  /* ---------------- BIBLE (Arabic Van Dyck) ---------------- */
  function renderLib() {
    var tok = ++S.tok, st = S.lib;
    if (st.b == null) {
      var sec = function (from, to, title) {
        var h = '<div class="bb-sec" style="text-align:center">' + title + '</div><div class="bb-grid">';
        for (var i = from; i < to; i++) h += '<button class="bb-bk" data-b="' + (i + 1) + '"><b>' + esc(BOOKS[i][1]) + '</b><small>' + esc(BOOKS[i][0]) + '</small></button>';
        return h + '</div>';
      };
      body.innerHTML = '<div class="bb-card"><div class="bb-chapter-h bb-ar" style="font-size:20px;line-height:1.6">الكتاب المقدس</div>' +
        sec(0, 39, 'العهد القديم') + sec(39, 66, 'العهد الجديد') + '</div>';
      body.querySelector('.bb-card').onclick = function (e) {
        var k = e.target.closest('.bb-bk'); if (!k) return;
        st.b = +k.getAttribute('data-b'); st.c = BOOKS[st.b - 1][2] === 1 ? 1 : null; renderLib(); window.scrollTo(0, 0);
      };
      return;
    }
    if (st.c == null) {
      var g = '';
      for (var i = 1; i <= BOOKS[st.b - 1][2]; i++) g += '<button class="bb-bk" data-c="' + i + '"><b>' + i + '</b></button>';
      body.innerHTML = '<div class="bb-card"><button class="bb-btn" id="bb-back">◀ الكتب</button>' +
        '<div class="bb-chapter-h bb-ar" style="font-size:20px;margin-top:10px">' + esc(BOOKS[st.b - 1][1]) + '</div>' +
        '<div class="bb-grid nums">' + g + '</div></div>';
      $('bb-back').onclick = function () { st.b = null; renderLib(); };
      body.querySelector('.bb-grid').onclick = function (e) {
        var k = e.target.closest('.bb-bk'); if (!k) return;
        st.c = +k.getAttribute('data-c'); renderLib(); window.scrollTo(0, 0);
      };
      return;
    }
    body.innerHTML = '<div class="bb-card"><div class="bb-row" style="justify-content:space-between"><button class="bb-btn" id="bb-back">◀ الإصحاحات</button><button class="bb-btn" id="bb-books">📚 الكتب</button></div>' +
      '<div class="bb-chapter-h bb-ar" style="font-size:20px;margin-top:10px">' + esc(refAr(st.b, st.c)) + '</div>' +
      '<div id="bb-verses"><div class="bb-skel"></div><div class="bb-skel" style="width:70%"></div><div class="bb-skel"></div></div>' +
      '<div class="bb-row" style="justify-content:space-between;margin-top:12px"><button class="bb-btn" id="bb-prev">◀ السابق</button><button class="bb-btn" id="bb-nxt">التالي ▶</button></div></div>';
    $('bb-back').onclick = function () { st.c = null; renderLib(); };
    $('bb-books').onclick = function () { st.b = null; st.c = null; renderLib(); };
    $('bb-prev').onclick = function () { stepChapter(st, -1); renderLib(); window.scrollTo(0, 0); };
    $('bb-nxt').onclick = function () { stepChapter(st, 1); renderLib(); window.scrollTo(0, 0); };
    loadChapter(st.b, st.c, 'ar').then(function (r) {
      if (tok !== S.tok) return;
      var box = $('bb-verses'); if (!box) return;
      box.innerHTML = chapterHtml(st.b, st.c, 'ar', null, r[1]);
      wireVerses(box); markVerses();
    }).catch(function () {
      if (tok !== S.tok) return;
      var box = $('bb-verses'); if (box) { box.innerHTML = '<div class="bb-err">تعذّر تحميل الإصحاح.<br><button class="bb-btn solid" style="margin-top:10px" id="bb-retry2">Try again</button></div>'; $('bb-retry2').onclick = renderLib; }
    });
  }

  /* ---------------- OURS (saved verses) ---------------- */
  function renderOurs() {
    var f = S.filter, m = me();
    var all = Object.keys(S.docs).map(function (k) { return S.docs[k]; }).filter(function (d) {
      return (d.fav && (d.fav.Kero || d.fav.Tota)) || (d.notes && d.notes.length);
    });
    var list = all.filter(function (d) {
      if (f === 'fav') return d.fav && (d.fav.Kero || d.fav.Tota);
      if (f === 'notes') return d.notes && d.notes.length;
      return true;
    }).sort(function (a, z) { return (z.updated || 0) - (a.updated || 0); });
    var fl = [['all', 'All'], ['fav', '★ Saved'], ['notes', '💬 Notes']];
    var h = '<div class="bb-card"><div class="bb-seg">' + fl.map(function (x) { return '<button data-f="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<p style="font-size:11px;color:#94a3b8;margin:10px 2px 12px"><span style="color:' + DOT.Kero + '">●</span> ' + esc(nm('Kero')) + ' &nbsp; <span style="color:' + DOT.Tota + '">●</span> ' + esc(nm('Tota')) + '</p>';
    if (!list.length) h += '<div class="bb-empty">Nothing here yet.<br>Tap a verse while reading to save it with ★ or leave a note 💕</div>';
    else h += list.map(function (d) {
      var last = d.notes && d.notes.length ? d.notes[d.notes.length - 1] : null;
      return '<div class="bb-saved" data-k="' + esc(d.key) + '">' +
        '<div class="rf">' + esc(refEn(d.book, d.chapter, d.verse)) + ' · ' + esc(refAr(d.book, d.chapter, d.verse)) + ' <span style="float:right">' + marksHtml(d) + '</span></div>' +
        (d.en ? '<div style="font-size:14px;line-height:1.55;margin-top:5px">' + esc(clip(d.en, 220)) + '</div>' : '') +
        (d.ar ? '<div class="bb-ar" style="font-size:16px;margin-top:4px">' + esc(clip(d.ar, 220)) + '</div>' : '') +
        (last ? '<div class="bb-preview-note"><div style="font-size:12px;color:#64748b">' + emo(last.by) + ' ' + esc(nm(last.by)) + ': ' + esc(clip(last.text, 90)) + '</div>' + noteActions(last, true) + '</div>' : '') +
        '</div>';
    }).join('');
    body.innerHTML = h + '</div>';
    Array.prototype.forEach.call(body.querySelectorAll('.bb-seg button'), function (x) {
      x.onclick = function () { S.filter = x.getAttribute('data-f'); renderOurs(); };
    });
    Array.prototype.forEach.call(body.querySelectorAll('.bb-saved'), function (x) {
      x.onclick = function (e) {
        var d = S.docs[x.getAttribute('data-k')]; if (!d) return;
        var action = e.target.closest('[data-act]');
        if (action && x.contains(action)) {
          e.preventDefault(); e.stopPropagation();
          var act = action.getAttribute('data-act'), nid = action.getAttribute('data-nid');
          if (act === 'love') {
            if (needUser()) return;
            return toggleNoteHeart(d.book, d.chapter, d.verse, d.en, d.ar, nid);
          }
          if (act === 'react') {
            if (needUser()) return;
            return toggleReaction(d.book, d.chapter, d.verse, d.en, d.ar, nid, '', action.getAttribute('data-e'));
          }
          // Open only the action sheet, not the full verse popup.
          if (act === 'reply') showActionSheet('replies', nid, {key:d.key, b:d.book, c:d.chapter, v:d.verse, en:d.en, ar:d.ar});
          else if (act === 'picknote') showActionSheet('react', nid, {key:d.key, b:d.book, c:d.chapter, v:d.verse, en:d.en, ar:d.ar});
          else if (act === 'notenmenu') showActionSheet('menu', nid, {key:d.key, b:d.book, c:d.chapter, v:d.verse, en:d.en, ar:d.ar});
          return;
        }
        openSheet(d.book, d.chapter, d.verse, d.en, d.ar);
      };
    });
  }

  /* ---------------- Firestore writes ---------------- */
  function mutate(b, c, v, en, ar, fn) {
    var key = keyOf(b, c, v), ref = db.collection('bible').doc(key);
    return db.runTransaction(function (tx) {
      return tx.get(ref).then(function (snap) {
        var d = snap.exists ? snap.data() : { key: key, book: b, chapter: c, verse: v, fav: {}, hl: {}, notes: [] };
        d.fav = d.fav || {}; d.hl = d.hl || {}; d.notes = d.notes || [];
        if (en && !d.en) d.en = en;
        if (ar && !d.ar) d.ar = ar;
        fn(d);
        d.updated = Date.now();
        tx.set(ref, d);
      });
    }).catch(function (e) { console.error('bible write', e); toast('Could not save. Check your internet connection.'); });
  }
  function findNote(d, id) { return (d.notes || []).filter(function (n) { return String(n.id) === String(id); })[0]; }

  // Shared by the Ours card and the verse sheet. Reuses the existing Firestore
  // note.reactions/reply.reactions format so both notification paths detect it.
  function toggleReaction(b, c, v, en, ar, nid, rid, emoji) {
    if (EMOJIS.indexOf(emoji) < 0) return;
    var m = me(); if (!m) return;
    return mutate(b, c, v, en, ar, function (d) {
      var note = findNote(d, nid); if (!note) return;
      var target = rid ? (note.replies || []).filter(function (r) { return String(r.id) === String(rid); })[0] : note;
      if (!target) return;
      target.reactions = target.reactions || {};
      if (target.reactions[m] === emoji) delete target.reactions[m];
      else target.reactions[m] = emoji;
    });
  }

  /* ---------------- Journal-style note actions ---------------- */
  // Unlike Journal's device-local count, Bible hearts are stored per person in
  // Firestore, so each device shows the same count and the same liked state.
  function toggleNoteHeart(b, c, v, en, ar, nid) {
    var m = me(); if (!m) return;
    return mutate(b, c, v, en, ar, function (d) {
      var n = findNote(d, nid); if (!n) return;
      n.hearts = n.hearts || {};
      if (n.hearts[m]) delete n.hearts[m]; else n.hearts[m] = true;
    });
  }
  // Same saved-reaction display as the Journal/Memories action row:
  // one compact emoji pill per reaction, with the reactors' profile emojis.
  function noteReactionBadges(n) {
    var r = n.reactions || {}, groups = {}, m = me(), id = esc(n.id);
    Object.keys(r).forEach(function (user) {
      var e = r[user];
      if (e) (groups[e] = groups[e] || []).push(user);
    });
    var emojis = Object.keys(groups);
    if (!emojis.length) return '';
    return '<span class="bb-note-reactions" role="group" aria-label="Note reactions">' + emojis.map(function (e) {
      var users = groups[e], mine = users.indexOf(m) !== -1;
      return '<button type="button" class="bb-react-badge' + (mine ? ' mine' : '') + '" data-act="react" data-nid="' + id + '" data-e="' + esc(e) + '" aria-label="Reaction ' + esc(e) + ' from ' + esc(users.map(nm).join(', ')) + '" aria-pressed="' + mine + '"><span>' + esc(e) + '</span><small>' + users.map(function (user) { return esc(emo(user)); }).join('') + '</small></button>';
    }).join('') + '</span>';
  }
  function noteActions(n, preview) {
    var m = me(), hearts = n.hearts || {}, liked = !!(m && hearts[m]);
    var count = Object.keys(hearts).filter(function (u) { return !!hearts[u]; }).length;
    var id = esc(n.id), replies = (n.replies || []).length;
    return '<div class="bb-note-actions" role="group" aria-label="Note actions">' +
      (replies ? '<button type="button" class="bb-reply-trigger" data-act="reply" data-nid="' + id + '" aria-label="View replies">💬 ' + replies + (replies === 1 ? ' reply' : ' replies') + '</button>' : '') +
      noteReactionBadges(n) +
      '<div class="bb-actions-right">' +
        '<button type="button" class="heart-btn' + (liked ? ' liked' : '') + '" data-act="love" data-nid="' + id + '" aria-pressed="' + liked + '" aria-label="Love note"><span>' + (liked ? '❤️' : '🤍') + '</span>' + (count ? '<span style="font-weight:800;color:var(--c500)">' + count + '</span>' : '') + '</button>' +
        '<button type="button" class="heart-btn" style="min-width:34px;justify-content:center" data-act="picknote" data-nid="' + id + '" aria-label="React with an emoji"><i class="far fa-face-smile"></i></button>' +
        '<button type="button" class="heart-btn" style="min-width:34px;justify-content:center" data-act="notenmenu" data-nid="' + id + '" aria-label="More note options"><i class="fas fa-ellipsis"></i></button>' +
      '</div></div>';
  }
  function noteExtras(n) {
    var id = esc(n.id), mine = me() && me() === n.by;
    var h = '';
    if (S.picker === String(n.id)) {
      h += '<div class="bb-note-picker" role="group" aria-label="Choose reaction">' + EMOJIS.map(function (e) {
        var selected = !!(n.reactions && n.reactions[me()] === e);
        return '<button type="button" class="bb-chip' + (selected ? ' mine' : '') + '" data-act="react" data-nid="' + id + '" data-e="' + e + '" aria-label="React ' + e + '" aria-pressed="' + selected + '">' + e + '</button>';
      }).join('') + '</div>';
    }
    if (S.menu === String(n.id)) {
      h += '<div class="bb-note-menu" role="group" aria-label="More note options">' +
        '<button type="button" data-act="reply" data-nid="' + id + '">💬 Reply</button>' +
        '<button type="button" data-act="pinnote" data-nid="' + id + '">' + (n.pinned ? '📌 Unpin' : '📌 Pin to top') + '</button>' +
        (mine ? '<button type="button" data-act="editnote" data-nid="' + id + '">✏️ Edit note</button><button type="button" data-act="delnote" data-nid="' + id + '">🗑️ Delete note</button>' : '') +
        '<button type="button" data-act="notenmenu" data-nid="' + id + '">Cancel</button></div>';
    }
    if (S.editNote === String(n.id) && mine) {
      h += '<div class="bb-note-edit"><textarea class="bb-input" rows="3" maxlength="5000" data-edit="' + id + '" aria-label="Edit note">' + esc(S.editDraft) + '</textarea>' +
        '<div class="bb-row" style="margin-top:8px"><button type="button" class="bb-btn solid" data-act="savenote" data-nid="' + id + '">Save 💕</button><button type="button" class="bb-btn" data-act="canceledit" data-nid="' + id + '">Cancel</button></div></div>';
    }
    return h;
  }

  /* ---------------- verse sheet ---------------- */
  function openSheet(b, c, v, en, ar, keepActions) {
    if (!keepActions) { S.picker = null; S.menu = null; }
    S.editNote = null; S.editDraft = '';
    var t = cachedText(b, c, v);
    S.open = { key: keyOf(b, c, v), b: b, c: c, v: v, en: en || t.en, ar: ar || t.ar, replyTo: null };
    S.draft = '';
    overlay.classList.add('open');
    renderSheet();
  }
  function closeSheet() { closeActionSheet(); overlay.classList.remove('open'); S.open = null; S.picker = null; S.menu = null; S.editNote = null; }
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeSheet(); });

  function reactRow(target, nid, rid, preview, compact) {
    var m = me(), r = (target && target.reactions) || {};
    var counts = {};
    Object.keys(r).forEach(function (u) { if (r[u]) counts[r[u]] = (counts[r[u]] || 0) + 1; });
    var labels = ['Love', 'Heart eyes', 'Pray', 'Touched', 'Laugh', 'Like', 'Surprised', 'Fire', 'Clap'];
    var h = '<div class="bb-chips' + (preview ? ' bb-preview-react' : '') + '" role="group" aria-label="React to ' + (rid ? 'reply' : 'note') + '">';
    if (preview) h += '<span class="bb-react-caption">React</span>';
    EMOJIS.forEach(function (e, i) {
      var mine = !!(m && r[m] === e), count = counts[e] || 0;
      if (compact && !count) return;
      h += '<button type="button" class="bb-chip' + (mine ? ' mine' : '') + '" data-act="react" data-nid="' + esc(nid) + '" data-rid="' + esc(rid || '') + '" data-e="' + e + '" aria-pressed="' + mine + '" aria-label="' + labels[i] + (count ? ', ' + count + ' reactions' : '') + '" title="' + labels[i] + '">' + e + (count ? '<span class="bb-chip-count">' + count + '</span>' : '') + '</button>';
    });
    return h + '</div>';
  }
  function renderSheet() {
    var o = S.open; if (!o) return;
    var ta = $('bb-note-in'); if (ta) S.draft = ta.value;
    var d = S.docs[o.key] || {}, m = me();
    var fav = d.fav || {}, notes = d.notes || [];
    var keepScroll = panel.scrollTop;
    var h = '';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div><div style="font-weight:800;color:var(--c600);font-size:14px">' + esc(refEn(o.b, o.c, o.v)) + '</div><div class="bb-ar" style="font-size:14px;line-height:1.6;color:#94a3b8">' + esc(refAr(o.b, o.c, o.v)) + '</div></div>' +
         '<button class="bb-btn" data-act="close">✕</button></div>';
    h += '<div style="margin:10px 0;padding:12px;border-radius:16px;background:var(--c50)">' +
         (o.en ? '<div style="font-size:15px;line-height:1.65">' + esc(o.en) + '</div>' : '') +
         (o.ar ? '<div class="bb-ar" style="font-size:19px;margin-top:6px">' + esc(o.ar) + '</div>' : '') +
         (!o.en && !o.ar ? '<div class="bb-empty" style="padding:6px">Loading…</div>' : '') + '</div>';
    h += '<div class="bb-row">' +
         '<button class="bb-btn ' + (m && fav[m] ? 'on' : '') + '" data-act="fav">' + (m && fav[m] ? '★ Saved' : '☆ Save') + '</button></div>';
    var o2 = other(m);
    if (o2 && fav[o2]) h += '<p style="font-size:11px;color:#94a3b8;margin-top:8px">' + emo(o2) + ' ' + esc(nm(o2)) + ' saved this ✨</p>';
    h += '<div class="bb-sec">Our notes 💌</div>';
    if (!notes.length) h += '<div class="bb-empty" style="padding:10px">No notes yet. Write the first one 💕</div>';
    notes.slice().sort(function (a, b) { return Number(!!b.pinned) - Number(!!a.pinned); }).forEach(function (n) {
      h += '<div class="bb-note" id="bn-' + esc(n.id) + '"><div class="who"><span>' + (n.pinned ? '📌 ' : '') + emo(n.by) + ' ' + esc(nm(n.by)) + '</span><span class="t">' + ago(n.at) + '</span></div>' +
           '<div class="tx">' + esc(n.text) + '</div>';
      (n.replies || []).forEach(function (r) {
        h += '<div class="bb-reply" id="br-' + esc(r.id) + '"><div class="who"><span>' + emo(r.by) + ' ' + esc(nm(r.by)) + '</span><span class="t">' + ago(r.at) + '</span></div>' +
             '<div class="tx">' + esc(r.text) + '</div>' + reactRow(r, n.id, r.id) +
             (m && r.by === m ? '<button class="bb-mini del" data-act="delreply" data-nid="' + esc(n.id) + '" data-rid="' + esc(r.id) + '">Delete</button>' : '') + '</div>';
      });
      h += noteActions(n, false) + '</div>';
    });
    var rt = o.replyTo && findNote(d, o.replyTo);
    h += '<div style="margin-top:14px">' +
         (rt ? '<div style="font-size:11.5px;color:var(--c600);font-weight:700;margin-bottom:4px">↩ Replying to ' + esc(nm(rt.by)) + ' <button class="bb-mini del" data-act="cancelreply">cancel</button></div>' : '') +
         '<textarea id="bb-note-in" class="bb-input" rows="2" placeholder="' + (rt ? 'Write a reply…' : 'Write a note on this verse…') + '"></textarea>' +
         '<button class="bb-btn solid" style="width:100%;margin-top:8px;padding:11px" data-act="send">Send 💌</button></div>';
    panel.innerHTML = h;
    panel.scrollTop = keepScroll;
    var ta2 = $('bb-note-in'); if (ta2) ta2.value = S.draft;
  }
  panel.addEventListener('input', function (e) {
    if (e.target && e.target.matches('[data-edit]')) S.editDraft = e.target.value;
  });
  panel.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'); if (!a || !S.open) return;
    var act = a.getAttribute('data-act'), o = S.open, m = me();
    var nid = a.getAttribute('data-nid'), rid = a.getAttribute('data-rid');
    if (act === 'close') return closeSheet();
    if (act === 'cancelreply') { o.replyTo = null; return renderSheet(); }
    if (act === 'reply') return showActionSheet('replies', nid);
    if (needUser()) return;
    function run(fn) { return mutate(o.b, o.c, o.v, o.en, o.ar, fn); }
    if (act === 'love') return toggleNoteHeart(o.b, o.c, o.v, o.en, o.ar, nid);
    if (act === 'picknote') return showActionSheet('react', nid);
    if (act === 'notenmenu') return showActionSheet('menu', nid);
    if (act === 'pinnote') { S.menu = null; return run(function (d) { var n = findNote(d, nid); if (n) n.pinned = !n.pinned; }); }
    if (act === 'editnote') {
      var n = findNote(S.docs[o.key] || {}, nid);
      if (!n || n.by !== m) return;
      S.menu = null; S.picker = null; S.editNote = String(nid); S.editDraft = n.text || ''; renderSheet();
      var edit = panel.querySelector('[data-edit]'); if (edit) edit.focus();
      return;
    }
    if (act === 'canceledit') { S.editNote = null; S.editDraft = ''; renderSheet(); return; }
    if (act === 'savenote') {
      var updatedText = S.editDraft.trim();
      if (!updatedText) { toast('The note cannot be empty 💕'); return; }
      return run(function (d) { var n = findNote(d, nid); if (n && n.by === m) n.text = updatedText; }).then(function () { S.editNote = null; S.editDraft = ''; renderSheet(); });
    }
    if (act === 'fav') return run(function (d) { d.fav[m] = !d.fav[m]; });
    if (act === 'react') {
      S.picker = null;
      return toggleReaction(o.b, o.c, o.v, o.en, o.ar, nid, rid, a.getAttribute('data-e'));
    }
    if (act === 'delnote') {
      if (!confirm('Delete this note?')) return;
      S.menu = null; S.editNote = null;
      return run(function (d) { d.notes = d.notes.filter(function (n) { return String(n.id) !== String(nid) || n.by !== m; }); });
    }
    if (act === 'delreply') {
      if (!confirm('Delete this reply?')) return;
      return run(function (d) { var n = findNote(d, nid); if (n) n.replies = (n.replies || []).filter(function (r) { return String(r.id) !== String(rid) || r.by !== m; }); });
    }
    if (act === 'send') {
      var ta = $('bb-note-in'), text = ta ? ta.value.trim() : '';
      if (!text) { toast('Write something first 💕'); return; }
      var replyTo = o.replyTo;
      S.draft = ''; if (ta) ta.value = ''; o.replyTo = null;
      return run(function (d) {
        var id = Date.now();
        if (replyTo) {
          var n = findNote(d, replyTo);
          if (n) { n.replies = n.replies || []; n.replies.push({ id: id, by: m, text: text, at: id, reactions: {} }); return; }
        }
        d.notes.push({ id: id, by: m, text: text, at: id, reactions: {}, replies: [] });
      }).then(function () { toast('Sent 💌'); });
    }
  });

  /* ---------------- live data ---------------- */
  db.collection('bible').onSnapshot(function (snap) {
    var docs = {};
    snap.forEach(function (x) { var d = x.data(); d.key = d.key || x.id; docs[x.id] = d; });
    S.docs = docs;
    // Open a verse referenced by a tapped phone notification when data arrives.
    try {
      var params = new URLSearchParams(window.location.search);
      var pushVerse = params.get('bibleVerse');
      if (pushVerse && /^\d+_\d+_\d+$/.test(pushVerse) && docs[pushVerse]) {
        var pushNote = params.get('bibleNote') || '';
        params.delete('bibleVerse'); params.delete('bibleNote');
        history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash);
        switchScreen('bible');
        setTimeout(function () { window.bibleOpenVerse(pushVerse, pushNote); }, 250);
      }
    } catch (err) { console.warn('Bible push link:', err); }
    if (!snap.metadata.fromCache || !snap.metadata.hasPendingWrites) diffNotes(docs);
    markVerses();
    updateTodayAct();
    if (S.open) renderSheet();
    if (actionSheet) renderActionSheet(false);
    if (S.tab === 'ours' && !firstShow && !$('screen-bible').classList.contains('hidden')) renderOurs();
  }, function (err) { console.error('bible listener', err); });

  /* ---------------- notifications for the other person's notes ---------------- */
  // Separate baselines by signed-in app profile so switching phones/users is safe.
  var BKEY = 'bibleBaseV2';
  function baseKey(user) { return BKEY + ':' + user; }
  function loadBase(user) { try { return JSON.parse(localStorage.getItem(baseKey(user)) || 'null'); } catch (e) { return null; } }
  function diffNotes(docs) {
    var m = me(); if (!m) return;
    var prev = loadBase(m), next = {}, events = [];
    function ev(actor, icon, msg, sub, key, nid) { events.push({ actor: actor, icon: icon, msg: msg, sub: sub || '', col: 'bible', item: key, rid: nid, why: 'bible' }); }
    Object.keys(docs).forEach(function (key) {
      var d = docs[key], nn = {}, pk = prev && prev[key] || {};
      var oldFav = prev && prev[key] && prev[key].__fav || {};
      var newFav = Object.assign({}, d.fav || {});
      var where = refEn(d.book, d.chapter, d.verse);
      if (prev && !oldFav[other(m)] && newFav[other(m)]) {
        ev(other(m), '⭐', nm(other(m)) + ' saved ' + where, '', key, '');
      }
      (d.notes || []).forEach(function (n) {
        var rp = {};
        (n.replies || []).forEach(function (r) { rp[r.id] = { by: r.by, r: Object.assign({}, r.reactions || {}) }; });
        var cur = { by: n.by, r: Object.assign({}, n.reactions || {}), h: Object.assign({}, n.hearts || {}), rp: rp };
        nn[n.id] = cur;
        if (!prev) return;
        var p = pk[n.id];
        if (!p) { if (n.by && n.by !== m) ev(n.by, '💌', nm(n.by) + ' wrote a note on ' + where, clip(n.text, 60), key, n.id); return; }
        Object.keys(cur.r).forEach(function (u) {
          if (u !== m && cur.r[u] && (!p.r || p.r[u] !== cur.r[u])) ev(u, cur.r[u], nm(u) + ' reacted ' + cur.r[u] + ' to ' + (n.by === m ? 'your' : n.by === u ? 'their own' : nm(n.by) + "'s") + ' note on ' + where, '', key, n.id);
        });
        Object.keys(cur.h).forEach(function (u) {
          if (u !== m && cur.h[u] && !(p.h && p.h[u])) ev(u, '❤️', nm(u) + ' loved ' + (n.by === m ? 'your' : 'a') + ' Bible note on ' + where, '', key, n.id);
        });
        Object.keys(rp).forEach(function (rid) {
          var c = rp[rid], pr = p.rp && p.rp[rid];
          if (!pr) {
            if (c.by && c.by !== m) {
              var rep = (n.replies || []).filter(function (x) { return String(x.id) === String(rid); })[0];
              ev(c.by, '💬', nm(c.by) + ' replied to ' + (n.by === m ? 'your' : n.by === c.by ? 'their own' : nm(n.by) + "'s") + ' note on ' + where, clip(rep && rep.text, 60), key, n.id);
            }
            return;
          }
          Object.keys(c.r).forEach(function (u) {
            if (u !== m && c.r[u] && (!pr.r || pr.r[u] !== c.r[u])) ev(u, c.r[u], nm(u) + ' reacted ' + c.r[u] + ' to ' + (c.by === m ? 'your' : 'a') + ' reply on ' + where, '', key, n.id);
          });
        });
      });
      nn.__fav = newFav;
      next[key] = nn;
    });
    try { localStorage.setItem(baseKey(m), JSON.stringify(next)); } catch (e) {}
    if (!prev) return;                                   // first time for this profile: just remember
    events.slice(0, 20).forEach(function (e) { if (typeof window.addNotification === 'function') window.addNotification(e); });
  }

  // used by the notification list: open the exact verse / note
  window.bibleOpenVerse = function (key, nid) {
    var p = String(key).split('_').map(Number), d = S.docs[key] || {};
    if (p.length !== 3 || !BOOKS[p[0] - 1]) return;
    getEn(p[0], p[1]).catch(function () {}).then(function () { return getAr(p[0], p[1]).catch(function () {}); }).then(function () {
      var t = cachedText(p[0], p[1], p[2]);
      openSheet(p[0], p[1], p[2], d.en || t.en, d.ar || t.ar);
      if (nid) setTimeout(function () {
        var el = $('bn-' + nid);
        if (el) { try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} el.classList.add('bb-flash'); }
      }, 150);
    });
  };
})();
