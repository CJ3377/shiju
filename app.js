/* 拾句 — 畫面與互動。每個分頁是一個 render 函式，回傳 HTML 字串。
   按鈕用 data-act 指定動作，統一在最下面的 click 事件處理。 */
(function () {
  const { S, save, get, ensureDay, todayIds, aiStatus, requestPrompt, hasAI, clearFailed, addReflection, books, hash } = window.Shiju;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 只在這次開啟期間存在、不需要存檔的畫面狀態
  const U = { tab: 'today', book: null, composing: false, draft: '', search: { lib: false, t: false, b: false }, q: { lib: '', t: '', b: '' }, importMsg: '' };

  const ico = (d, size = 18, w = 1.7) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const I = {
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    lib: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
    pen: '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>',
    sliders: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>'
  };
  const WAVE = '<svg viewBox="0 0 358 40" preserveAspectRatio="none"><path d="M0 40V22C64 -2 148 2 212 20S318 36 358 9V40Z" fill="#fff"/></svg>';

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 11 ? ['早安', '☀️'] : h < 18 ? ['午安', '🌤️'] : ['晚安', '🌙'];
  }
  function dateLabel() {
    const d = new Date();
    return `${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`;
  }
  function coverStyle(title) {
    const img = S.covers[title];
    if (img) return { cls: 'has-img', style: `background-image:url('${esc(img)}')` };
    const n = hash(title) % 5;
    return { cls: '', style: `background:linear-gradient(160deg, hsl(212 ${18 + n * 2}% ${88 - n * 3}%), hsl(214 ${16 + n * 2}% ${74 - n * 4}%))` };
  }
  function cover(title) {
    const c = coverStyle(title);
    return `<div class="cover ${c.cls}" style="${c.style}"><div class="cover-title">${esc(title)}</div></div>`;
  }
  const searchBtn = which => `<button class="round-btn" data-act="toggleSearch" data-arg="${which}" aria-label="搜尋">${ico(I.search)}</button>`;
  const searchInput = (which, ph) => U.search[which] ? `<input class="search-input" data-in="${which}" value="${esc(U.q[which])}" placeholder="${ph}" enterkeyhint="search">` : '';

  /* ---------- 今日 ---------- */
  function renderToday() {
    ensureDay();
    const ids = todayIds(), done = S.idx >= ids.length, h = done ? null : get(ids[S.idx]);
    const [hi, emoji] = greeting();
    const dots = ids.map((_, i) => `<span class="dot ${i === S.idx ? 'on' : i < S.idx ? 'done' : ''}"></span>`).join('');
    let body;
    if (done) {
      body = `<div class="done-card"><h2>今天的句子讀完了</h2><p class="small">明天會再為你挑 ${S.perDay} 則</p><button class="btn dark" data-act="restart">從頭再看一次</button></div>`;
    } else {
      const on = !!S.starred[h.id];
      const st = aiStatus(h);
      let prompt, loading = false, needKey = false;
      if (st.text) prompt = st.text;
      else if (st.state === 'nokey') { prompt = '還沒設定 Gemini 金鑰。到「設定」貼上金鑰，就會依今天的句子出題。'; needKey = true; }
      else if (st.state === 'error') prompt = '暫時無法出題，按「換一題」再試一次。';
      else { prompt = '正在依這句話想一個問題…'; loading = true; requestPrompt(h, render); }
      body = `<div class="today-cards">
        <article class="card card-quote" id="quoteCard">
          <div class="card-body">
            <span class="pill">今日精選</span>
            <div class="qmark open">“</div>
            <p class="quote">${esc(h.text)}</p>
            <div class="qmark close">”</div>
          </div>
          <div class="band">${WAVE}<div class="band-row">
            <button class="icon-btn star ${on ? 'on' : ''}" data-act="star" data-arg="${h.id}" aria-label="收藏"><svg width="18" height="18" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${I.star}</svg></button>
            <button class="icon-btn" data-act="prev" aria-label="上一則" ${S.idx === 0 ? 'disabled' : ''}>${ico(I.left)}</button>
            <button class="icon-btn solid" data-act="next" aria-label="下一則">${ico(I.right, 18, 1.9)}</button>
            <span class="by">— ${esc(h.book)}</span>
          </div></div>
        </article>
        <article class="card card-prompt">
          <div class="card-body">
            <div class="row"><span class="pill">今日想一想</span><button class="chip-btn" data-act="shuffle" data-arg="${h.id}">${ico(I.refresh, 13)}換一題</button></div>
            <p class="prompt ${loading ? 'loading' : ''}" id="promptText">${esc(prompt)}</p>
          </div>
          <div class="band">${WAVE}<div class="band-row end">${needKey ? '<button class="btn dark" data-act="tab" data-arg="set">去設定金鑰</button>' : '<button class="btn dark" data-act="compose">寫下來</button>'}</div></div>
        </article>
        ${U.composing ? `<div class="composer"><textarea id="draft" data-in="draft" placeholder="用自己的話說一次，或寫下它讓你想起的事">${esc(U.draft)}</textarea><div class="row"><button class="btn soft" data-act="cancelCompose">取消</button><button class="btn" data-act="saveCompose" data-arg="${h.id}">儲存</button></div></div>` : ''}
      </div>`;
    }
    return `<section class="page">
      <div class="head" style="flex-direction:column;gap:0">
        <div class="row" style="width:100%"><span class="eyebrow">${dateLabel()}</span><span class="dots">${dots}</span></div>
        <h1 class="greet">${hi}！${esc(S.name)}！${emoji}</h1>
      </div>
      ${body}
    </section>`;
  }

  /* ---------- 書庫 ---------- */
  function libList() {
    const q = U.q.lib.trim().toLowerCase();
    if (U.search.lib && q) {
      const res = S.hs.filter(h => (h.text + h.note + h.book + h.author).toLowerCase().includes(q));
      if (!res.length) return '<div class="empty">找不到符合的劃線或註記</div>';
      return `<p class="small" style="padding:0 10px">找到 ${res.length} 則</p>` + res.map(h => `<button class="result" data-act="openBook" data-arg="${esc(h.book)}"><span class="text">${esc(h.text)}</span>${h.note ? `<span class="note">${esc(h.note)}</span>` : ''}<span class="right">— ${esc(h.book)}</span></button>`).join('');
    }
    return `<div class="grid3">${books().map(b => `<button class="book" data-act="openBook" data-arg="${esc(b.title)}">${cover(b.title)}<span><span class="book-name" style="display:block">${esc(b.title)}</span><span class="book-author">${esc(b.author)}</span></span></button>`).join('')}</div>`;
  }
  function renderLib() {
    const bs = books();
    return `<section class="page">
      <div class="head"><div><div class="eyebrow">${S.sample ? '範例資料' : '來自 ' + esc(S.source)}</div><h1 class="title">書庫</h1><div class="small">${bs.length} 本書 · ${S.hs.length} 則劃線</div></div>${searchBtn('lib')}</div>
      ${searchInput('lib', '搜尋所有書的劃線與註記')}
      <div id="list-lib" style="display:flex;flex-direction:column;gap:12px">${libList()}</div>
    </section>`;
  }

  /* ---------- 書籍頁 ---------- */
  function bookList() {
    const q = U.q.b.trim().toLowerCase();
    const hs = S.hs.filter(h => h.book === U.book && (!q || (h.text + h.note + (S.refl[h.id] || []).map(r => r.text).join('')).toLowerCase().includes(q)));
    if (!hs.length) return '<div class="empty">找不到符合的劃線</div>';
    return hs.map(h => {
      const on = !!S.starred[h.id], rf = S.refl[h.id] || [];
      return `<div class="hl"><p class="text">${esc(h.text)}</p>
        ${h.note ? `<div class="note"><b>我的註記　</b>${esc(h.note)}</div>` : ''}
        ${rf.length ? `<div class="refl-box">${rf.map(r => `<div><div class="refl-label">我的想法 · ${esc(r.date)}</div><div style="font-size:13px;line-height:1.8">${esc(r.text)}</div></div>`).join('')}</div>` : ''}
        <div class="row"><span class="small">${h.date ? esc(h.date.replace(/-/g, '/')) + ' 劃線' : ''}</span><button class="icon-btn star ${on ? 'on' : ''}" style="width:36px;height:36px" data-act="star" data-arg="${h.id}" aria-label="收藏"><svg width="16" height="16" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">${I.star}</svg></button></div>
      </div>`;
    }).join('');
  }
  function renderBook() {
    const b = books().find(x => x.title === U.book);
    if (!b) return '';
    return `<div class="book-head">
        <div class="row"><button class="back" data-act="closeBook">${ico(I.left)}書庫</button>${searchBtn('b')}</div>
        <div style="display:flex;gap:18px;align-items:flex-end">${cover(b.title)}<div><h2 style="margin:0;font-size:24px;line-height:1.25">${esc(b.title)}</h2><div class="small">${esc(b.author)}</div><span class="count-pill">${b.count} 則劃線</span></div></div>
        ${searchInput('b', '搜尋這本書的劃線、註記與想法')}
      </div>
      <div id="list-b" style="padding:22px 16px 40px;display:flex;flex-direction:column;gap:22px">${bookList()}</div>`;
  }

  /* ---------- 想法 ---------- */
  function thoughtList() {
    const q = U.q.t.trim().toLowerCase(), all = [];
    Object.keys(S.refl).forEach(id => { const h = get(id); if (h) S.refl[id].forEach(r => all.push(Object.assign({ h }, r))); });
    all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const shown = q ? all.filter(t => (t.text + t.h.text + t.h.book + (t.q || '')).toLowerCase().includes(q)) : all;
    if (!shown.length) return `<div class="empty">${q ? '找不到符合的想法' : '還沒有寫下任何想法。<br>在「今日」按「寫下來」開始。'}</div>`;
    return shown.map(t => `<div class="thought"><span class="small">${esc(t.date)}</span>${t.q ? `<span class="q">${esc(t.q)}</span>` : ''}<p class="text">${esc(t.text)}</p>
      <button class="thought-quote" data-act="openBook" data-arg="${esc(t.h.book)}"><span style="font-size:15px;line-height:1.6">“${esc(t.h.text)}”</span><span class="right">— ${esc(t.h.book)}</span></button></div>`).join('');
  }
  function renderThoughts() {
    const n = Object.values(S.refl).reduce((a, l) => a + l.length, 0);
    return `<section class="page">
      <div class="head"><div><div class="eyebrow">${n ? n + ' 則想法' : '從每天的句子開始'}</div><h1 class="title">想法</h1></div>${searchBtn('t')}</div>
      ${searchInput('t', '搜尋想法、劃線或書名')}
      <div id="list-t" style="display:flex;flex-direction:column;gap:16px">${thoughtList()}</div>
    </section>`;
  }

  /* ---------- 設定 ---------- */
  function renderSettings() {
    return `<section class="page">
      <div class="head"><h1 class="title">設定</h1></div>
      <div class="panel"><span class="panel-label">你的名字</span><input class="text-input" data-in="name" value="${esc(S.name)}" maxlength="20"></div>
      <div class="panel white"><span class="panel-label">AI 出題（Gemini 金鑰）</span>
        <p>到 aistudio.google.com 用 Google 帳號登入，按「Get API key」建立金鑰，複製後貼在這裡。金鑰只存在這支手機。</p>
        <input class="text-input" style="background:var(--sky)" type="password" data-in="geminiKey" value="${esc(S.geminiKey)}" placeholder="貼上金鑰" autocomplete="off" autocapitalize="off" spellcheck="false">
        <span class="small" id="keyNote">${hasAI() ? '已設定，今日想一想會依句子出題。' : '尚未設定。'}</span>
      </div>
      <div class="panel"><div class="row"><span style="font-size:15px">每天幾則</span><div class="seg">${[1, 3, 5].map(n => `<button class="${S.perDay === n ? 'on' : ''}" data-act="perDay" data-arg="${n}">${n}</button>`).join('')}</div></div></div>
      <div class="panel"><span class="panel-label">從 Kobo 匯入</span>
        <p>選擇 Kobo 裡 .kobo 資料夾的 KoboReader.sqlite。檔案只在這支手機上讀取，重新匯入會保留你的收藏與想法。</p>
        <label class="btn file-btn">${ico(I.upload, 16)}選擇 KoboReader.sqlite<input type="file" data-file="kobo"></label>
        <span class="small">${esc(U.importMsg || (S.sample ? '目前顯示的是範例劃線。' : `目前資料：${S.source}`))}</span>
      </div>
      <div class="panel white"><span class="panel-label">備份</span>
        <p>資料只存在這支手機的瀏覽器裡。清除 Safari 網站資料會一起刪除，建議偶爾匯出備份。</p>
        <div class="row"><button class="btn" style="flex:1" data-act="export">匯出備份</button><label class="btn soft file-btn" style="flex:1">還原備份<input type="file" data-file="backup"></label></div>
      </div>
    </section>`;
  }

  /* ---------- 共用 ---------- */
  function render() {
    const views = { today: renderToday, lib: renderLib, thoughts: renderThoughts, set: renderSettings };
    $('#view').innerHTML = views[U.tab]();
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.arg === U.tab));
    const ov = $('#overlay');
    ov.hidden = !U.book;
    ov.innerHTML = U.book ? renderBook() : '';
  }

  const actions = {
    tab: t => { U.tab = t; U.book = null; U.composing = false; render(); $('#view').scrollTop = 0; },
    star: id => { S.starred[id] = !S.starred[id]; if (!S.starred[id]) delete S.starred[id]; save(); toast(S.starred[id] ? '已收藏，之後會更常出現' : '已取消收藏'); render(); },
    prev: () => { if (S.idx > 0) { S.idx--; U.composing = false; save(); render(); } },
    next: () => { S.idx = Math.min(todayIds().length, S.idx + 1); U.composing = false; save(); render(); },
    restart: () => { S.idx = 0; save(); render(); },
    shuffle: id => { S.promptShift[id] = (S.promptShift[id] || 0) + 1; save(); render(); },
    compose: () => { U.composing = true; U.draft = ''; render(); const d = $('#draft'); if (d) { d.focus(); d.closest('.composer').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } },
    cancelCompose: () => { U.composing = false; render(); },
    saveCompose: id => {
      if (!U.draft.trim()) { toast('先寫一點什麼吧'); return; }
      addReflection(id, U.draft.trim(), aiStatus(get(id)).text || '');
      U.composing = false; U.draft = ''; render(); toast('已存到「想法」');
    },
    toggleSearch: w => { U.search[w] = !U.search[w]; U.q[w] = ''; render(); const i = document.querySelector(`[data-in="${w}"]`); if (i) i.focus(); },
    openBook: title => { U.book = title; U.search.b = false; U.q.b = ''; render(); $('#overlay').scrollTop = 0; },
    closeBook: () => { U.book = null; render(); },
    perDay: n => { S.perDay = +n; S.idx = 0; save(); render(); toast(`每天 ${n} 則`); },
    export: () => { window.Shiju.exportBackup(); toast('備份檔已產生，請存到「檔案」'); }
  };

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && actions[el.dataset.act]) actions[el.dataset.act](el.dataset.arg);
  });

  document.addEventListener('input', e => {
    const k = e.target.dataset.in;
    if (!k) return;
    if (k === 'draft') U.draft = e.target.value;
    else if (k === 'name') { S.name = e.target.value.trim() || 'Catherine'; save(); }
    else if (k === 'geminiKey') { S.geminiKey = e.target.value.trim(); clearFailed(); save(); const n = $('#keyNote'); if (n) n.textContent = S.geminiKey ? '已設定，今日想一想會依句子出題。' : '尚未設定。'; }
    else {
      U.q[k] = e.target.value;
      const box = $('#list-' + k);
      if (box) box.innerHTML = k === 'lib' ? libList() : k === 't' ? thoughtList() : bookList();
    }
  });

  document.addEventListener('change', async e => {
    const kind = e.target.dataset.file, f = e.target.files && e.target.files[0];
    if (!kind || !f) return;
    try {
      if (kind === 'kobo') {
        U.importMsg = '讀取中…'; render();
        const r = await window.Shiju.importKobo(f);
        U.importMsg = `已匯入 ${r.count} 則劃線，來自 ${r.books} 本書。`;
        toast('匯入完成，今日精選已更新');
        window.Shiju.fetchCovers(() => { if (U.tab === 'lib' || U.book) render(); });
      } else {
        await window.Shiju.importBackup(f);
        U.importMsg = '';
        toast('備份已還原');
      }
    } catch (err) {
      U.importMsg = kind === 'kobo' ? '無法讀取這個檔案。請確認選的是 KoboReader.sqlite，並且手機有連上網路。' : '';
      if (kind !== 'kobo') toast('這不是拾句的備份檔');
    }
    render();
  });

  // 左右滑動今日精選卡片換句
  let sx = null;
  document.addEventListener('touchstart', e => { sx = e.target.closest('#quoteCard') ? e.touches[0].clientX : null; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (dx < -50) actions.next(); else if (dx > 50) actions.prev();
  }, { passive: true });

  // 隔天打開 App（或從背景回來）時換成新的一天
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.day !== window.Shiju.dayKey()) render(); });

  if (!window.Shiju.save()) toast('無法儲存資料，請關閉 Safari 的無痕模式');
  render();
  window.Shiju.fetchCovers(() => { if (U.tab === 'lib' || U.book) render(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
