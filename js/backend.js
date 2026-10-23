
/* Cuerpo de nota con medios: lineas [[img: URL | credito]] y [[yt: ID | pie]]. Sin marcas, se muestra texto plano como antes. */
window.renderNewsBody = function(el, cuerpo){
  el.textContent = '';
  var txt = String(cuerpo || '');
  if (txt.indexOf('[[') === -1){ el.textContent = txt; return; }
  var buf = [];
  function flush(){
    var s = buf.join('\n').replace(/^\n+|\n+$/g, '');
    buf = [];
    if (!s) return;
    var p = document.createElement('div'); p.textContent = s; el.appendChild(p);
  }
  txt.split('\n').forEach(function(line){
    var m = line.match(/^\s*\[\[(img|yt):\s*([^|\]]+?)\s*(?:\|\s*(.*?))?\s*\]\]\s*$/);
    if (!m){ buf.push(line); return; }
    flush();
    var fig = document.createElement('figure'); fig.className = 'nmedia';
    if (m[1] === 'img'){
      if (!/^https:\/\//.test(m[2])){ return; }
      var im = document.createElement('img'); im.src = m[2]; im.loading = 'lazy'; im.alt = m[3] || ''; fig.appendChild(im);
    } else {
      if (!/^[\w-]{11}$/.test(m[2])){ return; }
      var wrap = document.createElement('div'); wrap.className = 'nvideo';
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + m[2];
      f.title = m[3] || 'Video'; f.loading = 'lazy'; f.allowFullscreen = true;
      f.setAttribute('allow', 'accelerometer; encrypted-media; gyroscope; picture-in-picture');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      wrap.appendChild(f); fig.appendChild(wrap);
    }
    if (m[3]){ var c = document.createElement('figcaption'); c.textContent = m[3]; fig.appendChild(c); }
    el.appendChild(fig);
  });
  flush();
};

/* Runaradio backend (Supabase Postgres): chat en vivo, reacciones, comentarios y pide tu cancion.
   La llave anon es publica por diseno; la base esta protegida con RLS (solo leer/insertar),
   limites de ritmo y filtro de palabras/enlaces del lado del servidor. */
(function(){
  'use strict';
  var SUPABASE_URL = 'https://saqyplbhhojyzusarkzq.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhcXlwbGJoaG9qeXp1c2Fya3pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDU4MjYsImV4cCI6MjEwNzgyMTgyNn0.OxhwQoRvQjoJXqTp30miW7LeRqNO6B-EHSKCJ-EZwQ8';
  if (!window.supabase || !window.supabase.createClient) return;
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function say(msg){ if (window.toast) { window.toast(msg); return; } try { alert(msg); } catch(e){} }

  var CID = (function(){
    try {
      var k = 'rr-client-id', v = localStorage.getItem(k);
      if (!v) { v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('c' + Date.now() + Math.random().toString(36).slice(2, 12)); localStorage.setItem(k, v); }
      return v;
    } catch(e){ return 'c' + Date.now() + Math.random().toString(36).slice(2, 12); }
  })();

  function slug(t){
    return (t || 'noticia').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'noticia';
  }
  function el(tag, cls, text){ var d = document.createElement(tag); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; }
  function cloneReplace(node){ var c = node.cloneNode(true); node.parentNode.replaceChild(c, node); return c; }
  function hora(ts){ try { return new Date(ts).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'}); } catch(e){ return ''; } }

  /* ================= CHAT EN VIVO ================= */
  (function(){
    var wrap = document.querySelector('.chat-wrap');
    if (!wrap) return;
    var soon = wrap.querySelector('.soon'); if (soon) soon.remove();
    var body = wrap.querySelector('.chat-body');
    var inputRow = wrap.querySelector('.chat-input');
    var msgInput = inputRow.querySelector('input');
    var sendBtn = cloneReplace(document.getElementById('chatSend'));
    msgInput = cloneReplace(msgInput);
    msgInput.maxLength = 280;

    var nick = localStorage.getItem('rr-nick') || '';
    var nickInput = el('input');
    nickInput.type = 'text'; nickInput.placeholder = 'Tu nombre'; nickInput.maxLength = 24;
    nickInput.value = nick; nickInput.setAttribute('aria-label', 'Tu nombre');
    nickInput.style.cssText = 'flex:0 0 110px;min-width:0;padding:13px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(7,11,29,.55);color:var(--text);font-family:inherit;font-size:14px;outline:none';
    inputRow.insertBefore(nickInput, msgInput);
    if (!nick) msgInput.placeholder = 'Escribe tu mensaje…';

    body.innerHTML = '';
    var vacio = el('p', null, 'Todavía no hay mensajes. ¡Saluda a la cabina! 👋');
    vacio.style.cssText = 'color:var(--muted);font-size:13.5px;text-align:center;margin:auto';
    body.appendChild(vacio);

    function pintarMsg(m){
      if (vacio.parentNode) vacio.remove();
      var mio = m.client_id === CID;
      var d = el('div', 'msg ' + (mio ? 'me' : 'them'));
      var who = el('span', 'who', mio ? 'Tú' : (m.nickname || 'Oyente'));
      d.appendChild(who);
      d.appendChild(document.createTextNode(m.message || ''));
      var h = el('span', null, hora(m.created_at));
      h.style.cssText = 'display:block;font-size:10.5px;opacity:.55;margin-top:4px;text-align:right';
      d.appendChild(h);
      body.appendChild(d);
      while (body.children.length > 80) body.removeChild(body.firstChild);
      body.scrollTop = body.scrollHeight;
    }

    sb.from('chat_messages').select('nickname,message,client_id,created_at')
      .order('created_at', {ascending:false}).limit(50)
      .then(function(r){
        if (r.error) { vacio.textContent = 'El chat no pudo cargar. Intenta recargar.'; return; }
        (r.data || []).reverse().forEach(pintarMsg);
      });

    var canal = sb.channel('runa-chat', {config:{presence:{key:CID}}});
    canal.on('postgres_changes', {event:'INSERT', schema:'public', table:'chat_messages'}, function(p){ pintarMsg(p.new); });
    canal.on('presence', {event:'sync'}, function(){
      var n = Object.keys(canal.presenceState() || {}).length;
      var c = wrap.querySelector('.count');
      if (c) c.textContent = n + (n === 1 ? ' oyente conectado' : ' oyentes conectados');
    });
    canal.subscribe(function(st){ if (st === 'SUBSCRIBED') canal.track({}); });

    var enviando = false;
    function enviar(){
      var txt = (msgInput.value || '').trim();
      var nombre = (nickInput.value || '').trim() || 'Oyente';
      if (!txt || enviando) return;
      enviando = true; sendBtn.disabled = true;
      sb.from('chat_messages').insert({nickname: nombre, message: txt, client_id: CID})
        .then(function(r){
          enviando = false; sendBtn.disabled = false;
          if (r.error) { say(r.error.message || 'No se pudo enviar.'); return; }
          try { localStorage.setItem('rr-nick', nombre); } catch(e){}
          msgInput.value = ''; msgInput.focus();
        });
    }
    sendBtn.addEventListener('click', enviar);
    msgInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') enviar(); });
  })();

  /* ================= PIDE TU CANCION ================= */
  (function(){
    var form = document.getElementById('reqForm');
    if (!form) return;
    form = cloneReplace(form);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var name = document.getElementById('reqName').value.trim();
      var song = document.getElementById('reqSong').value.trim();
      if (!name || !song) return;
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      sb.from('song_requests').insert({name: name, song: song, client_id: CID})
        .then(function(r){
          btn.disabled = false;
          if (r.error) { say(r.error.message || 'No se pudo enviar tu petición.'); return; }
          document.getElementById('reqSong').value = '';
          say('¡Petición enviada! La leemos al aire en cuanto podamos. 🎙️');
        });
    });
  })();

  /* ================= NOTICIAS: REACCIONES Y COMENTARIOS ================= */
  (function(){
    var modal = document.getElementById('modalNews');
    if (!modal) return;
    var REACCIONES = [['like','👍'],['love','❤️'],['wow','😮']];
    var commentForm = cloneReplace(document.getElementById('commentForm'));
    var noticiaId = null;

    function pintarReacciones(){
      var box = document.getElementById('newsReact');
      box.innerHTML = '';
      sb.from('news_reactions').select('kind,client_id').eq('news_id', noticiaId)
        .then(function(r){
          var rows = r.data || [];
          box.innerHTML = '';
          REACCIONES.forEach(function(par){
            var kind = par[0], emoji = par[1];
            var total = 0, mia = false;
            rows.forEach(function(x){ if (x.kind === kind){ total++; if (x.client_id === CID) mia = true; } });
            var b = el('button', 'react-btn' + (mia ? ' on' : ''));
            b.type = 'button';
            b.appendChild(el('span', null, emoji));
            b.appendChild(el('span', 'count', String(total)));
            b.addEventListener('click', function(){
              if (mia) { say('Ya reaccionaste a esta nota.'); return; }
              b.disabled = true;
              sb.from('news_reactions').insert({news_id: noticiaId, kind: kind, client_id: CID})
                .then(function(rr){
                  b.disabled = false;
                  if (rr.error) { say(rr.error.code === '23505' ? 'Ya reaccionaste a esta nota.' : (rr.error.message || 'No se pudo guardar.')); return; }
                  pintarReacciones();
                });
            });
            box.appendChild(b);
          });
        });
    }

    function pintarComentarios(){
      var list = document.getElementById('commentList');
      sb.from('news_comments').select('name,body,created_at').eq('news_id', noticiaId)
        .order('created_at', {ascending:false}).limit(100)
        .then(function(r){
          var items = r.data || [];
          list.innerHTML = '';
          if (!items.length){ list.appendChild(el('p', 'comments-empty', 'Sé la primera persona en comentar.')); return; }
          items.forEach(function(c){
            var d = el('div', 'comment');
            var b = el('b', null, c.name || 'Anónimo');
            b.appendChild(el('span', null, ' · ' + hora(c.created_at)));
            b.lastChild.style.cssText = 'font-weight:400;opacity:.55;font-size:11px';
            d.appendChild(b);
            d.appendChild(el('span', null, c.body || ''));
            list.appendChild(d);
          });
        });
    }

    commentForm.addEventListener('submit', function(e){
      e.preventDefault();
      if (!noticiaId) return;
      var name = document.getElementById('commentName').value.trim();
      var text = document.getElementById('commentText').value.trim();
      if (!name || !text) return;
      var btn = commentForm.querySelector('button');
      btn.disabled = true;
      sb.from('news_comments').insert({news_id: noticiaId, name: name, body: text, client_id: CID})
        .then(function(r){
          btn.disabled = false;
          if (r.error) { say(r.error.message || 'No se pudo publicar.'); return; }
          document.getElementById('commentText').value = '';
          pintarComentarios();
        });
    });

    var obs = new MutationObserver(function(){
      if (modal.style.display === 'grid'){
        var titulo = (document.getElementById('newsTitle') || {}).textContent || '';
        noticiaId = slug(titulo);
        pintarReacciones();
        pintarComentarios();
      }
    });
    obs.observe(modal, {attributes:true, attributeFilter:['style']});
  })();
})();

/* ================= NOTICIAS DESDE LA BASE DE DATOS =================
   Las noticias se publican desde el panel administrativo (tabla news_items).
   Si la base no responde o no hay noticias publicadas, se conserva el
   contenido estatico de news.json que ya pinto el script inline. */
(function(){
  if (!window.supabase || !window.supabase.createClient) return;
  var sb = window.supabase.createClient('https://saqyplbhhojyzusarkzq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhcXlwbGJoaG9qeXp1c2Fya3pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDU4MjYsImV4cCI6MjEwNzgyMTgyNn0.OxhwQoRvQjoJXqTp30miW7LeRqNO6B-EHSKCJ-EZwQ8');
  var grid = document.getElementById('newsGrid');
  var feat = document.getElementById('newsFeat');
  var modal = document.getElementById('modalNews');
  if (!grid || !modal) return;

  function pintar(items){
    grid.innerHTML = '';
    if (feat) feat.innerHTML = '';
    items.forEach(function(n, idx){
      var card = document.createElement('article');
      card.className = 'news-card';
      if (n.urgente) card.style.cssText = 'border-color:rgba(248,113,113,.55);box-shadow:0 0 0 1px rgba(248,113,113,.35)';
      var art = document.createElement('div'); art.className = 'art';
      if (n.imagen){ art.classList.add('has-img'); art.style.backgroundImage = "url('" + n.imagen + "')"; }
      else { art.textContent = n.emoji || '\u{1F4F0}'; }
      var body = document.createElement('div'); body.className = 'body';
      if (n.urgente){
        var u = document.createElement('span');
        u.textContent = '\u{1F534} URGENTE';
        u.style.cssText = 'display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.6px;color:#f87171;margin-bottom:4px';
        body.appendChild(u);
      }
      var tag = document.createElement('span'); tag.className = 'news-tag'; tag.textContent = n.tag || 'Noticia';
      var b = document.createElement('b'); b.textContent = n.titulo || '';
      var t = document.createElement('span'); t.className = 'teaser'; t.textContent = n.teaser || '';
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'news-more'; btn.textContent = 'Ver más';
      btn.addEventListener('click', function(){
        var hero = document.getElementById('newsHero');
        var credit = document.getElementById('newsCredit');
        if (n.imagen){ hero.src = n.imagen; hero.alt = n.titulo || ''; hero.style.display = 'block'; }
        else { hero.style.display = 'none'; hero.removeAttribute('src'); }
        if (n.imagen && n.credito){ credit.textContent = n.credito; credit.style.display = 'block'; }
        else { credit.style.display = 'none'; credit.textContent = ''; }
        document.getElementById('newsTag').textContent = (n.urgente ? '\u{1F534} URGENTE · ' : '') + (n.tag || 'Noticia');
        document.getElementById('newsTitle').textContent = n.titulo || '';
        window.renderNewsBody(document.getElementById('newsBody'), n.cuerpo);
        var src = document.getElementById('newsSrc');
        if (n.url){ src.textContent = 'Fuente: ' + (n.fuente || n.url); src.href = n.url; src.style.display = 'inline-block'; }
        else { src.style.display = 'none'; src.removeAttribute('href'); }
        modal.style.display = 'grid';
      });
      body.appendChild(tag); body.appendChild(b); body.appendChild(t); body.appendChild(btn);
      card.appendChild(art); card.appendChild(body);
      if (feat && idx < 3){ card.classList.add(idx === 0 ? 'news-card--big' : 'news-card--side'); feat.appendChild(card); }
      else { grid.appendChild(card); }
    });
  }

  var ultimos = null;
  function cargar(){
    sb.from('news_items').select('id,emoji,tag,titulo,teaser,cuerpo,fuente,url,imagen,credito,urgente,created_at')
      .eq('published', true).order('created_at', {ascending:false}).limit(60)
      .then(function(r){
        if (r.error || !r.data || !r.data.length) return; // conserva news.json
        var items = r.data.slice().sort(function(a, b){ return (b.urgente?1:0)-(a.urgente?1:0); });
        ultimos = items;
        pintar(items);
      });
  }
  cargar();
  /* Si el script inline termino de pintar news.json despues que la base, reaplicar una vez. */
  setTimeout(function(){
    if (!ultimos || !ultimos.length) return;
    var first = (feat && feat.querySelector('.news-card b')) || grid.querySelector('.news-card b');
    if (first && first.textContent !== ultimos[0].titulo) pintar(ultimos);
  }, 2500);
  /* Refresca al volver a la pestana y cada 3 min (noticias urgentes). */
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) cargar(); });
  setInterval(cargar, 180000);
})();
