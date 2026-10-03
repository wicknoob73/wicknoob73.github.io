// config.js
// ─────────────────────────────────────────────────────────────
// Unico punto in cui vive l'URL (o gli URL) del tunnel Cloudflare
// del bot. Prima era duplicato a mano in version.js, stats.html e
// index.html: ogni volta che "cloudflared" veniva riavviato
// generava un nuovo indirizzo casuale (i tunnel gratuiti "quick
// tunnel" di trycloudflare.com non hanno un hostname fisso), e
// bastava dimenticarselo in un solo file per far apparire "v0"
// ovunque.
//
// Da qui in poi: se il tunnel cambia URL, va aggiornato SOLO qui.
//
// STATS_URLS è un elenco in ordine di priorità: fetchStatsWithFallback()
// prova ogni URL in cascata e usa il primo che risponde. Se in futuro
// avrai un secondo tunnel di backup o un dominio fisso, aggiungilo
// semplicemente come nuova voce dell'array qui sotto.
//
// IMPORTANTE: questo script va incluso PRIMA di version.js in ogni
// pagina, e SENZA l'attributo "defer" — deve eseguirsi subito, in
// modo che STATS_URL / STATS_URLS esistano già come variabili globali
// quando gli altri script (compresi quelli inline non-deferred di
// stats.html e index.html) vengono eseguiti.
// ─────────────────────────────────────────────────────────────
const STATS_URLS = [
  'https://bedford-dog-odds-addresses.trycloudflare.com/stats',
  // 'https://un-eventuale-tunnel-di-backup.trycloudflare.com/stats',
];

// Retro-compatibilità con codice esistente che usa ancora STATS_URL:
// punta sempre al primo URL della lista.
const STATS_URL = STATS_URLS[0];

/**
 * Prova ogni URL di STATS_URLS in cascata, nell'ordine in cui compaiono,
 * finché uno risponde con esito positivo (res.ok).
 * Ritorna { url, response } del primo che ha successo, oppure null se
 * falliscono tutti (bot offline, tunnel scaduto, rete assente, ecc.).
 */
async function fetchStatsWithFallback(query = '', options = {}) {
  for (const base of STATS_URLS) {
    try {
      const res = await fetch(base + query, options);
      if (res.ok) return { url: base, response: res };
    } catch {
      // Questo URL non risponde: si passa al successivo della lista.
    }
  }
  return null;
}
