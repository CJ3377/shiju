/* 拾句 — 資料層：讀寫手機本機儲存、每日挑句、題目、Kobo 匯入、備份。
   畫面相關的程式在 app.js。 */
(function () {
  const KEY = 'shiju-v1';
  const SQL_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
  const KOBO_QUERY = "SELECT b.BookmarkID, b.Text, b.Annotation, b.DateCreated, c.Title, c.Attribution, c.ImageId " +
    "FROM Bookmark b LEFT JOIN content c ON c.ContentID = b.VolumeID " +
    "WHERE b.Text IS NOT NULL AND trim(b.Text) <> '' ORDER BY b.DateCreated";
  // 真正購買的書：Accessibility = 1。試讀本（6）、Kobo Plus／借閱（9）、書店書目（-1、0）都不列入
  const KOBO_BOOKS = "SELECT Title, Attribution, ImageId FROM content " +
    "WHERE ContentType = 6 AND Accessibility = 1 AND ifnull(Title, '') <> '' ORDER BY DateLastRead DESC";
  // Kobo 書店的封面圖（ImageId 是書店的書籍編號）
  const koboCover = id => /^[0-9a-f-]{36}$/i.test(id || '') ? `https://cdn.kobo.com/book-images/${id}/353/569/90/False/image.jpg` : '';

  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  function defaults() {
    return {
      v: 1, name: 'Kobo', perDay: 3,
      hs: window.SHIJU_SAMPLE, refl: window.SHIJU_SAMPLE_REFL, starred: {}, lib: [],
      covers: {}, source: '', sample: true, geminiKey: '', aiCache: {},
      day: '', todayIds: [], idx: 0, promptShift: {}
    };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1) {
        if (s.name === 'Catherine') s.name = 'Kobo'; // 舊版的預設名字
        return Object.assign(defaults(), s);
      }
    } catch (e) {}
    return defaults();
  }

  const S = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
    catch (e) { return false; }
  }

  function get(id) { return S.hs.find(h => h.id === id); }

  // 每天依日期挑一組句子：收藏的機率較高，昨天出現過的機率較低
  function ensureDay(force) {
    const k = dayKey();
    if (!force && S.day === k && S.todayIds.length && S.todayIds.every(get)) return;
    const r = rng(hash(k + S.hs.length));
    const prev = new Set(S.todayIds);
    const scored = S.hs.map(h => ({ id: h.id, w: r() * (S.starred[h.id] ? 3 : 1) * (prev.has(h.id) ? 0.2 : 1) }));
    scored.sort((a, b) => b.w - a.w);
    S.todayIds = scored.slice(0, 5).map(x => x.id);
    S.day = k; S.idx = 0; S.promptShift = {};
    save();
  }

  function todayIds() { return S.todayIds.slice(0, S.perDay); }

  /* ---------- 今日想一想：用 Gemini 依當天的句子出題 ----------
     金鑰在「設定」填入，只存在這支手機。也可以改用 ai-worker.js 中繼服務（index.html 的 aiEndpoint）。
     同一天、同一句、同一次「換一題」只會問一次 AI，結果會存起來，省下免費額度。 */
  const cfg = () => window.SHIJU_CONFIG || {};
  const MODEL = () => cfg().model || 'gemini-flash-latest';
  const pending = {}, failed = {};
  const aiKey = h => S.day + ':' + h.id + ':' + (S.promptShift[h.id] || 0);
  const hasAI = () => !!(S.geminiKey || cfg().aiEndpoint);

  function aiStatus(h) {
    const k = aiKey(h);
    if (S.aiCache[k]) return { text: S.aiCache[k] };
    if (!hasAI()) return { state: 'nokey' };
    if (failed[k]) return { state: 'error', msg: failed[k] };
    return { state: 'loading' };
  }

  function coachPrompt(h, prev) {
    return '你是一位溫和的閱讀教練。讀者今天早上重看了自己在 Kobo 劃線的一句話。' +
      '請用繁體中文出一個簡短的反思問題（30 字以內），問題必須緊扣這句話的內容，幫助讀者把它連結到自己今天的生活、工作，或其他讀過的書。' +
      '只輸出問題本身，不要加引號、編號或其他文字。\n\n' +
      '句子：「' + h.text + '」\n出處：《' + h.book + '》' +
      (h.note ? '\n讀者當時的註記：' + h.note : '') +
      (prev ? '\n之前問過：' + prev + '\n請換一個不同角度的問題。' : '');
  }

  const clean = t => (String(t || '').split('\n').map(x => x.trim()).find(Boolean) || '').replace(/^["「『“]+|["」』”]+$/g, '');

  async function requestPrompt(h, onDone) {
    const k = aiKey(h);
    if (S.aiCache[k] || pending[k] || failed[k] || !hasAI()) return;
    pending[k] = true;
    const shift = S.promptShift[h.id] || 0;
    const prev = shift ? S.aiCache[S.day + ':' + h.id + ':' + (shift - 1)] || '' : '';
    try {
      let q = '';
      if (S.geminiKey) {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL() + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': S.geminiKey },
          body: JSON.stringify({ contents: [{ parts: [{ text: coachPrompt(h, prev) }] }] })
        });
        const j = await res.json();
        if (!res.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + res.status));
        const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
        q = parts.filter(p => !p.thought).map(p => p.text || '').join('');
      } else {
        const res = await fetch(cfg().aiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: h.text, book: h.book, note: h.note, prev }) });
        q = (await res.json()).question;
      }
      q = clean(q);
      if (!q) throw new Error('AI 沒有回傳題目');
      Object.keys(S.aiCache).forEach(x => { if (!x.startsWith(S.day)) delete S.aiCache[x]; });
      S.aiCache[k] = q;
      save();
    } catch (e) { failed[k] = String((e && e.message) || e); }
    delete pending[k];
    onDone && onDone();
  }

  function clearFailed() { Object.keys(failed).forEach(k => delete failed[k]); }

  function addReflection(id, text, q) {
    const d = new Date();
    (S.refl[id] = S.refl[id] || []).unshift({ date: `${d.getMonth() + 1}/${d.getDate()}`, ts: d.getTime(), q: q || '', text });
    save();
  }

  // 有劃線的書在前，其他已購買、還沒劃線的書接在後面
  function books() {
    const map = {};
    S.hs.forEach(h => { (map[h.book] = map[h.book] || { title: h.book, author: h.author, count: 0 }).count++; });
    (S.lib || []).forEach(b => { if (!map[b.title]) map[b.title] = { title: b.title, author: b.author, count: 0 }; });
    return Object.values(map);
  }

  async function loadSql() {
    if (!window.initSqlJs) {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = SQL_CDN + 'sql-wasm.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    return window.initSqlJs({ locateFile: f => SQL_CDN + f });
  }

  async function importKobo(file) {
    const SQL = await loadSql();
    const db = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
    const r = db.exec(KOBO_QUERY);
    let owned = [];
    try { const o = db.exec(KOBO_BOOKS); owned = o[0] ? o[0].values : []; } catch (e) {}
    db.close();
    const rows = r[0] ? r[0].values : [];
    if (!rows.length && !owned.length) throw new Error('沒有找到劃線或書籍');
    const covers = {};
    rows.forEach(v => { const u = koboCover(v[6]); if (u && v[4]) covers[v[4]] = u; });
    const seen = new Set();
    const lib = owned.filter(v => !seen.has(v[0]) && seen.add(v[0])).map(v => {
      const u = koboCover(v[2]); if (u) covers[v[0]] = u;
      return { title: v[0], author: v[1] || '' };
    });
    const hs = rows.map(v => ({
      id: 'k' + hash(String(v[0]) + v[1]),
      text: String(v[1]).trim().replace(/\s+/g, ' '),
      note: v[2] ? String(v[2]).trim() : '',
      date: v[3] ? String(v[3]).slice(0, 10) : '',
      book: v[4] || '未知書名', author: v[5] || '', imported: true
    }));
    // 保留同一則劃線之前的收藏與想法（重新匯入不會遺失）
    const keep = new Set(hs.map(h => h.id));
    const refl = {}, starred = {};
    Object.keys(S.refl).forEach(id => { if (keep.has(id)) refl[id] = S.refl[id]; });
    Object.keys(S.starred).forEach(id => { if (keep.has(id)) starred[id] = S.starred[id]; });
    Object.assign(S, { hs, lib, refl, starred, sample: false, source: file.name, todayIds: [] });
    Object.assign(S.covers, covers);
    if (hs.length) ensureDay(true); else save();
    return { count: hs.length, books: books().length };
  }

  // 用書名到 Open Library 找封面，找不到就用藍灰漸層
  async function fetchCovers(onUpdate) {
    for (const b of books()) {
      if (b.title in S.covers) continue;
      if (S.sample) { S.covers[b.title] = ''; continue; }
      try {
        const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(b.title)}&author=${encodeURIComponent(b.author)}&limit=1&fields=cover_i`;
        const j = await (await fetch(url)).json();
        const id = j.docs && j.docs[0] && j.docs[0].cover_i;
        S.covers[b.title] = id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : '';
      } catch (e) { continue; }
      save(); onUpdate && onUpdate();
    }
    save();
  }

  function exportBackup() {
    const data = Object.assign({}, S, { geminiKey: '' }); // 備份檔不含金鑰
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `拾句備份-${dayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function importBackup(file) {
    const data = JSON.parse(await file.text());
    if (!data || data.v !== 1 || !Array.isArray(data.hs)) throw new Error('格式不符');
    const key = S.geminiKey;
    Object.assign(S, defaults(), data, { geminiKey: key });
    save();
  }

  window.Shiju = { S, save, get, ensureDay, todayIds, aiStatus, requestPrompt, hasAI, clearFailed, addReflection, books, importKobo, fetchCovers, exportBackup, importBackup, hash, dayKey };
})();
