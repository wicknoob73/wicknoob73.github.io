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
  'https://birth-burton-salaries-forge.trycloudflare.com/stats',
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


// ══════════════════════════════════════════════════════════════
// LISTEN — player audio dentro i pannelli piattaforma (guide.html)
// ══════════════════════════════════════════════════════════════
// Ogni pannello di piattaforma nella pagina Guida contiene una
// canzone di esempio con un pulsante play/pausa e uno slider volume.
//
// Comportamento:
//   • Un solo brano alla volta: avviandone uno, gli altri si fermano
//     e la loro barra di progresso torna a 0.
//   • La barra colorata in basso al player avanza in tempo reale.
//   • A fine brano il pulsante torna a ▶ e la barra a 0.
//   • Volume iniziale al 30% per non spaventare le orecchie.
//   • Se il file audio non esiste (o è corrotto), il pulsante
//     diventa ⏳ disabilitato — nessun errore in console.
//
// I file audio vanno messi in assets/audio/ con questi nomi:
//   youtube.mp3 · spotify.mp3 · soundcloud.mp3 · tiktok.mp3 · instagram.mp3
// Se usi un'estensione diversa da .mp3, aggiorna il src="..." nel
// <audio> dentro guide.html.

function initListenPlayers() {
  const buttons = document.querySelectorAll('.listen-play');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    const audioId = 'audio-' + btn.dataset.audio;
    const audio = document.getElementById(audioId);
    if (!audio) return;

    const card = btn.closest('.listen-card');
    const bar = card ? card.querySelector('.listen-progress-bar') : null;
    
    // Setup Volume
    audio.volume = 0.3; // Volume predefinito al 30%
    const volSlider = card.querySelector('.volume-slider');
    const volBtn = card.querySelector('.volume-btn');
    const iconUp = card.querySelector('.icon-vol-up');
    const iconMute = card.querySelector('.icon-vol-mute');
    let lastVolume = 0.3;

    if (volSlider && volBtn) {
      // Cambio volume tramite slider
      volSlider.addEventListener('input', (e) => {
        audio.volume = e.target.value;
        audio.muted = audio.volume === 0;
        updateVolumeIcon();
        if (audio.volume > 0) lastVolume = audio.volume;
      });

      // Click sull'icona per mutare
      volBtn.addEventListener('click', () => {
        if (audio.muted || audio.volume === 0) {
          audio.muted = false;
          audio.volume = lastVolume || 0.3;
          volSlider.value = audio.volume;
        } else {
          audio.muted = true;
          volSlider.value = 0;
        }
        updateVolumeIcon();
      });

      function updateVolumeIcon() {
        if (audio.muted || audio.volume === 0) {
          iconUp.style.display = 'none';
          iconMute.style.display = 'block';
        } else {
          iconUp.style.display = 'block';
          iconMute.style.display = 'none';
        }
      }
    }

    // Se il file audio non esiste o è corrotto, il pulsante si blocca su ⏳
    audio.addEventListener('error', () => {
      btn.classList.add('missing');
      btn.disabled = true;
      btn.title = 'File audio non ancora disponibile';
    });

    // Play/Pausa
    btn.addEventListener('click', () => {
      if (btn.classList.contains('missing')) return;

      // Ferma tutti gli altri player (uno solo alla volta)
      document.querySelectorAll('.listen-play.playing').forEach(other => {
        if (other === btn) return;
        other.classList.remove('playing');
        const otherCard = other.closest('.listen-card');
        if (otherCard) {
          const otherBar = otherCard.querySelector('.listen-progress-bar');
          if (otherBar) otherBar.style.width = '0%';
        }
        const otherAudio = document.getElementById('audio-' + other.dataset.audio);
        if (otherAudio) {
          otherAudio.pause();
          otherAudio.currentTime = 0;
        }
      });

      if (audio.paused) {
        audio.play().then(() => {
          btn.classList.add('playing');
        }).catch(() => {
          btn.classList.add('missing');
          btn.disabled = true;
          btn.title = 'File audio non ancora disponibile';
        });
      } else {
        audio.pause();
        btn.classList.remove('playing');
      }
    });

    // Progress bar
    audio.addEventListener('timeupdate', () => {
      if (bar && audio.duration && isFinite(audio.duration)) {
        bar.style.width = (audio.currentTime / audio.duration * 100) + '%';
      }
    });

    // Fine brano
    audio.addEventListener('ended', () => {
      btn.classList.remove('playing');
      if (bar) bar.style.width = '0%';
      audio.currentTime = 0;
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initListenPlayers);
} else {
  initListenPlayers();
}