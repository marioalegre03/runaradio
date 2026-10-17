/* Runaradio backend (Supabase Postgres): chat en vivo, reacciones, comentarios y pide tu cancion.
   La llave anon es publica por diseno; la base esta protegida con RLS (solo leer/insertar),
   limites de ritmo y filtro de palabras/enlaces del lado del servidor. */
(function(){
  'use strict';
  var SUPABASE_URL = 'https://saqyplbhhojyzusarkzq.supabase.co';
  var SUPABASE_ANON_KEY = '1001cat anon_key)';
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
