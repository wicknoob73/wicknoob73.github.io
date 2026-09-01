// config.js
// ─────────────────────────────────────────────────────────────
// Unico punto in cui vive l'URL del tunnel Cloudflare del bot.
// Prima era duplicato a mano in version.js, stats.html e index.html:
// ogni volta che "cloudflared" veniva riavviato generava un nuovo
// indirizzo casuale (i tunnel gratuiti "quick tunnel" di
// trycloudflare.com non hanno un hostname fisso), e bastava
// dimenticarselo in un solo file per far apparire "v0" ovunque.
//
// Da qui in poi: se il tunnel cambia URL, va aggiornato SOLO qui.
//
// IMPORTANTE: questo script va incluso PRIMA di version.js in ogni
// pagina, e SENZA l'attributo "defer" — deve eseguirsi subito, in
// modo che STATS_URL esista già come variabile globale quando gli
// altri script (compresi quelli inline non-deferred di stats.html
// e index.html) vengono eseguiti.
// ─────────────────────────────────────────────────────────────
const STATS_URL = 'https://months-consequently-bandwidth-player.trycloudflare.com/stats';
