# Runaradio — sitio web

Sitio público de **Runaradio** (Estación Kus Medios, Irapuato, México):
https://runaradio.estacionkusmedios.com/

Player en vivo, noticias, programación semanal, chat en vivo, comentarios,
reacciones y "Pide tu canción". Sitio estático servido con GitHub Pages.

## Stack

- **Front:** HTML/CSS/JS sin framework (`index.html`, `css/`, `js/`).
- **Stream:** Zeno.fm (`js/script.js` apunta al mount de la estación y a la API
  de metadata de Zeno). Los horarios de la parrilla usan hora CDMX.
- **Backend:** Supabase Postgres (`js/backend.js`): `chat_messages`,
  `song_requests`, `news_reactions`, `news_comments`, `news_items`.
  La llave `anon` va en el código por diseño; las tablas están protegidas con
  RLS (verificado: escrituras ajenas rechazadas). Nunca meter la llave
  `service_role` en este repo.
- **Hosting:** GitHub Pages desde la rama `main`, dominio custom por CNAME en
  el DNS de Microsoft 365. Push a `main` = deploy.

## Estructura

- `index.html` — portada (player, noticias, programación, chat).
- `cabina-r4k7x2/` — panel admin (noticias, moderación). Ruta no listada;
  acceso con Supabase Auth, solo el UID admin entra.
- `news.json`, `schedule.json` — contenido de noticias y parrilla que consume
  el sitio.
- `aviso-de-privacidad.html`, `terminos-y-condiciones.html`,
  `politica-de-cookies.html`, `derechos-de-las-audiencias.html` — páginas
  legales. NO renombrar: tienen enlaces publicados.
- `img/shows/`, `img/news/` — imágenes de programas y notas.
- `manifest.json`, `service-worker.js` — PWA.

## Reglas de operación

- No despublicar noticias sin que Luis lo pida. Los fijados (homenajes,
  sorteos) van arriba hasta su fecha de baja.
- La parrilla del sitio debe coincidir con lo que Zeno realmente transmite.
- No mostrar "Comerciales" en el sitio.
- Commits directos a `main` con mensajes claros en español.

## Licencia

Fork de [jailsonsb2/RadioPlayer-ZenoRadio](https://github.com/jailsonsb2/RadioPlayer-ZenoRadio),
**AGPL-3.0** (ver `LICENSE`; avisos de copyright conservados).
