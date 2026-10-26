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
// canzone di esempio con un pulsante play/pausa, uno slider volume
// e (novità) un menu "Effetto" che simula in tempo reale, con la
// Web Audio API, alcuni degli effetti del bot.
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
// EFFETTI (Web Audio API)
//   • Un solo AudioContext condiviso da tutti i player, creato/ripreso
//     (.resume()) al click sul pulsante Play: i browser lo richiedono.
//   • Al primo Play di una card l'<audio> viene collegato UNA volta con
//     createMediaElementSource (il browser non permette di farlo due
//     volte sullo stesso elemento) a questo grafo:
//
//       sorgente → highpass → lowpass(×2) → lowshelf (bassi) → tremolo → pan (8D) ─┬→ master → uscita
//                                              └→ delay+feedback (eco) ─┘
//
//     Il volume passa dal nodo "master", perché dopo il collegamento
//     alcuni browser (Safari) ignorano audio.volume.
//   • "Nessuno" non rimuove i nodi: li riporta a valori neutri
//     (filtri aperti, bassi a 0 dB, eco spenta, playbackRate = 1).
//   • Nightcore / Slowed / Vaporwave cambiano playbackRate con
//     preservesPitch = false: velocità e tono cambiano insieme, come
//     nel bot (asetrate).
//   • NB: l'audio deve essere servito dallo stesso dominio (o con CORS).
//     Aprendo guide.html con file:// alcuni browser lo trattano come
//     cross-origin e il grafo Web Audio resta muto: usa un server
//     locale (es. "python -m http.server") o GitHub Pages.
//
// I file audio vanno messi in assets/audio/ con questi nomi:
//   youtube.mp3 · spotify.mp3 · soundcloud.mp3 · tiktok.mp3 · instagram.mp3
// Se usi un'estensione diversa da .mp3, aggiorna il src="..." nel
// <audio> dentro guide.html.

// ── Definizione degli effetti ────────────────────────────────────
// Per ritoccare un effetto basta cambiare i numeri qui sotto.
//   rate      playbackRate (1 = normale)
//   pitchLock true = il tono resta uguale; false = tono e velocità insieme
//   bass      guadagno in dB del lowshelf a 100 Hz
//   hp / lp   frequenze (Hz) di highpass / lowpass; null = filtro aperto
//   lpSteep   true = lowpass doppio (taglio più netto, come "discoteca")
//   trem      { freq, depth } tremolo: il volume pulsa; depth 0 = spento
//   echo      { time, feedback, wet } eco; wet 0 = spenta
//   pan       true = LFO sul panning stereo (audio rotante)
//   gain      correzione di livello (per evitare clipping coi bassi)
const AUDIO_FX_NEUTRAL = {
  rate: 1, pitchLock: true,
  bass: 0, hp: null, lp: null, lpSteep: false,
  trem: { freq: 0.5, depth: 0 },
  echo: { time: 0.06, feedback: 0.4, wet: 0 },
  pan: false, gain: 1,
};

const AUDIO_FX = {
  none:      { label: '✨ Nessuno' },
  nightcore: { label: '🌙 Nightcore',  rate: 1.25, pitchLock: false },
  slowed:    { label: '🐢 Slowed',     rate: 0.85, pitchLock: false, echo: { time: 0.06, feedback: 0.4, wet: 0.3 } },
  bassboost: { label: '🔊 Bassboost',  bass: 12, gain: 0.75 },
  eightd:    { label: '🎧 8D Audio',   pan: true },
  telefono:  { label: '📞 Telefono',   hp: 300, lp: 3400 },
  radio_vecchia: { label: '📻 Radio vecchia', hp: 500, lp: 2500, trem: { freq: 0.5, depth: 0.15 } },
  discoteca: { label: '🪩 Discoteca',  lp: 500, lpSteep: true, bass: 8 },
  vaporwave: { label: '🌊 Vaporwave',  rate: 0.8, pitchLock: false, lp: 4500, echo: { time: 0.35, feedback: 0.45, wet: 0.3 } },
};

// AudioContext unico, creato alla prima interazione.
let _fxCtx = null;
function getFxContext() {
  if (_fxCtx) return _fxCtx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try { _fxCtx = new Ctor(); } catch { _fxCtx = null; }
  return _fxCtx;
}

/** Imposta velocità e (opzionalmente) il blocco del tono sull'elemento <audio>. */
function setPlaybackRateSafe(audio, rate, pitchLock) {
  audio.defaultPlaybackRate = rate;
  audio.playbackRate = rate;
  audio.preservesPitch = pitchLock;
  audio.mozPreservesPitch = pitchLock;
  audio.webkitPreservesPitch = pitchLock;
}

/**
 * Costruisce il grafo Web Audio per un <audio>. Ritorna un oggetto con i
 * nodi, oppure null se il browser non lo permette (in quel caso restano
 * disponibili solo gli effetti basati su playbackRate).
 */
function buildFxGraph(ctx, audio) {
  try {
    const src = ctx.createMediaElementSource(audio);

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 10;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = ctx.sampleRate / 2;

    // Secondo lowpass in cascata: attivo solo per "discoteca" (taglio più netto).
    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.value = ctx.sampleRate / 2;

    const bass = ctx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 100;
    bass.gain.value = 0;

    // Tremolo: il volume oscilla tra (1 - depth) e 1 con un LFO.
    const trem = ctx.createGain();
    trem.gain.value = 1;
    const tremLfo = ctx.createOscillator();
    tremLfo.type = 'sine';
    tremLfo.frequency.value = 0.5;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0;              // 0 = spento
    tremLfo.connect(tremDepth);
    tremDepth.connect(trem.gain);
    tremLfo.start();

    // 8D: un oscillatore lento che muove il pan da -1 a +1.
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    let lfo = null, lfoDepth = null;
    if (panner) {
      lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.1;           // un giro completo ogni 10 s
      lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0;             // 0 = fermo (effetto spento)
      lfo.connect(lfoDepth).connect(panner.pan);
      lfo.start();
    }

    // Eco: delay con feedback, miscelato in parallelo al segnale diretto.
    const delay = ctx.createDelay(1.5);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    delay.delayTime.value = 0.06;
    feedback.gain.value = 0.4;
    wet.gain.value = 0;
    delay.connect(feedback).connect(delay);

    const master = ctx.createGain();

    src.connect(hp);
    hp.connect(lp);
    lp.connect(lp2);
    lp2.connect(bass);
    bass.connect(trem);
    const tail = panner || trem;
    if (panner) trem.connect(panner);
    tail.connect(master);                   // segnale diretto
    tail.connect(delay);                    // ramo eco
    delay.connect(wet).connect(master);
    master.connect(ctx.destination);

    return { hp, lp, lp2, bass, trem, tremLfo, tremDepth, panner, lfoDepth, delay, feedback, wet, master };
  } catch (err) {
    // Es. createMediaElementSource già chiamato, o audio cross-origin.
    return null;
  }
}

function initListenPlayers() {
  const buttons = document.querySelectorAll('.listen-play');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    const audioId = 'audio-' + btn.dataset.audio;
    const audio = document.getElementById(audioId);
    if (!audio) return;

    const card = btn.closest('.listen-card');
    const bar = card ? card.querySelector('.listen-progress-bar') : null;

    // ── Stato del player ────────────────────────────────────────
    let volume = 0.3;          // volume scelto dall'utente (0-1)
    let lastVolume = 0.3;
    let muted = false;
    let fxName = 'none';       // effetto selezionato
    let graph = null;          // grafo Web Audio (creato al primo Play)
    let graphTried = false;

    // ── Volume ──────────────────────────────────────────────────
    // Prima del collegamento al grafo si usa audio.volume; dopo, il
    // volume passa dal nodo master (più affidabile tra i browser).
    function applyVolume() {
      const v = muted ? 0 : volume;
      if (graph) {
        const comp = (AUDIO_FX[fxName] && AUDIO_FX[fxName].gain) || 1;
        graph.master.gain.setTargetAtTime(v * comp, _fxCtx.currentTime, 0.02);
      } else {
        audio.volume = v;
      }
    }
    applyVolume();

    const volSlider = card ? card.querySelector('.volume-slider') : null;
    const volBtn = card ? card.querySelector('.volume-btn') : null;
    const iconUp = card ? card.querySelector('.icon-vol-up') : null;
    const iconMute = card ? card.querySelector('.icon-vol-mute') : null;

    function updateVolumeIcon() {
      if (!iconUp || !iconMute) return;
      const off = muted || volume === 0;
      iconUp.style.display = off ? 'none' : 'block';
      iconMute.style.display = off ? 'block' : 'none';
    }

    if (volSlider && volBtn) {
      // Cambio volume tramite slider
      volSlider.addEventListener('input', (e) => {
        volume = parseFloat(e.target.value);
        muted = volume === 0;
        if (volume > 0) lastVolume = volume;
        applyVolume();
        updateVolumeIcon();
      });

      // Click sull'icona per mutare
      volBtn.addEventListener('click', () => {
        if (muted || volume === 0) {
          muted = false;
          volume = lastVolume || 0.3;
          volSlider.value = volume;
        } else {
          muted = true;
          volSlider.value = 0;
        }
        applyVolume();
        updateVolumeIcon();
      });
    }

    // ── Effetti ─────────────────────────────────────────────────
    // Applica l'effetto corrente: velocità sempre, filtri solo se il
    // grafo esiste (altrimenti verranno applicati alla creazione).
    function applyEffect(name) {
      fxName = AUDIO_FX[name] ? name : 'none';
      const fx = Object.assign({}, AUDIO_FX_NEUTRAL, AUDIO_FX[fxName]);
      fx.echo = Object.assign({}, AUDIO_FX_NEUTRAL.echo, AUDIO_FX[fxName].echo);
      fx.trem = Object.assign({}, AUDIO_FX_NEUTRAL.trem, AUDIO_FX[fxName].trem);

      setPlaybackRateSafe(audio, fx.rate, fx.pitchLock);

      if (graph && _fxCtx) {
        const t = _fxCtx.currentTime, k = 0.03;
        graph.hp.frequency.setTargetAtTime(fx.hp || 10, t, k);
        graph.lp.frequency.setTargetAtTime(fx.lp || _fxCtx.sampleRate / 2, t, k);
        graph.lp2.frequency.setTargetAtTime(fx.lpSteep && fx.lp ? fx.lp : _fxCtx.sampleRate / 2, t, k);
        graph.bass.gain.setTargetAtTime(fx.bass, t, k);
        // Tremolo: base = 1 - depth/2, oscillazione ± depth/2 (come ffmpeg tremolo)
        graph.trem.gain.setTargetAtTime(1 - fx.trem.depth / 2, t, k);
        graph.tremDepth.gain.setTargetAtTime(fx.trem.depth / 2, t, k);
        graph.tremLfo.frequency.setTargetAtTime(fx.trem.freq, t, k);
        graph.delay.delayTime.setTargetAtTime(fx.echo.time, t, k);
        graph.feedback.gain.setTargetAtTime(fx.echo.feedback, t, k);
        graph.wet.gain.setTargetAtTime(fx.echo.wet, t, k);
        if (graph.lfoDepth) graph.lfoDepth.gain.setTargetAtTime(fx.pan ? 1 : 0, t, k);
        if (graph.panner && !fx.pan) graph.panner.pan.setTargetAtTime(0, t, k);
        applyVolume();
      }
    }

    // Crea il menu "Effetto" dentro la card, prima del controllo volume.
    let fxSelect = null;
    if (card) {
      const wrap = document.createElement('div');
      wrap.className = 'fx-control';

      fxSelect = document.createElement('select');
      fxSelect.className = 'fx-select';
      fxSelect.setAttribute('aria-label', 'Effetto audio');
      fxSelect.title = 'Effetto audio (simulazione nel browser)';
      Object.keys(AUDIO_FX).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = AUDIO_FX[key].label;
        fxSelect.appendChild(opt);
      });
      wrap.appendChild(fxSelect);

      const volCtl = card.querySelector('.volume-control');
      if (volCtl) card.insertBefore(wrap, volCtl);
      else card.insertBefore(wrap, btn);

      fxSelect.addEventListener('change', () => {
        applyEffect(fxSelect.value);
        fxSelect.classList.toggle('active', fxSelect.value !== 'none');
      });
    }

    // Crea (una volta sola) il grafo e riprende l'AudioContext.
    // Va chiamata DENTRO un gestore di click: i browser lo richiedono.
    function ensureAudioGraph() {
      const ctx = getFxContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!graph && !graphTried) {
        graphTried = true;
        // Con file:// l'audio è "cross-origin" e il grafo Web Audio resterebbe
        // muto: meglio lasciare l'audio diretto (solo effetti di velocità).
        if (location.protocol === 'file:') return;
        graph = buildFxGraph(ctx, audio);
        if (graph) {
          audio.volume = 1;      // da qui il volume lo gestisce il nodo master
          applyEffect(fxName);   // applica subito l'effetto già scelto
        }
      }
    }

    // Se il file audio non esiste o è corrotto, il pulsante si blocca su ⏳
    audio.addEventListener('error', () => {
      btn.classList.add('missing');
      btn.disabled = true;
      btn.title = 'File audio non ancora disponibile';
      if (fxSelect) fxSelect.disabled = true;
    });

    // Play/Pausa
    btn.addEventListener('click', () => {
      if (btn.classList.contains('missing')) return;

      // Primo click: crea/riprende l'AudioContext e collega i filtri
      ensureAudioGraph();

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
          if (fxSelect) fxSelect.disabled = true;
        });
      } else {
        audio.pause();
        btn.classList.remove('playing');
      }
    });

    // Progress bar (currentTime/duration non dipendono dal playbackRate)
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
