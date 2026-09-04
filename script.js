/* ══════════════════════════════════════════════════════
   Music Pilot · Árkád — interakciók
   1. fejléc állapot   2. hero hullám berajzolás
   3. scrollytelling zónatérkép   4. zöldfal-hangkulissza
   ══════════════════════════════════════════════════════ */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── 1. fejléc: a hero után kap hátteret ── */
const head = document.querySelector(".site-head");
const hero = document.querySelector(".hero");
new IntersectionObserver(
  ([e]) => head.classList.toggle("scrolled", !e.isIntersecting),
  { rootMargin: "-80px 0px 0px 0px" }
).observe(hero);

/* ── 2. hero hullám: egyszeri berajzolás betöltéskor ── */
const wave = document.getElementById("wavepath");
if (wave && !reducedMotion) {
  const len = wave.getTotalLength();
  wave.style.strokeDasharray = len;
  wave.style.strokeDashoffset = len;
  wave.getBoundingClientRect(); // force layout
  wave.style.transition = "stroke-dashoffset 2.6s cubic-bezier(.4,0,.2,1) .3s";
  wave.style.strokeDashoffset = "0";
}

/* ── 3. scrollytelling: lépések vezérlik a térképet ── */
const mapStage = document.querySelector(".map-stage");
const steps = [...document.querySelectorAll(".step")];

const stepObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const step = entry.target.dataset.goto;
        mapStage.dataset.step = step;
        steps.forEach((s) => s.classList.toggle("active", s === entry.target));
      }
    });
  },
  { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
);
steps.forEach((s) => stepObserver.observe(s));

/* ══════════════════════════════════════════════════════
   4. Zöldfal-hangkulissza — Web Audio API
   Szintetizált madárcsicsergés + halk levélsusogás.
   Csak felhasználói kattintásra indul; a szakasz
   elhagyásakor elhalkul, visszatéréskor visszaúszik.
   ══════════════════════════════════════════════════════ */

class NatureAmbience {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.running = false;   // a felhasználó bekapcsolta-e
    this.audible = false;   // épp hallható-e (szakasz látható)
    this.chirpTimer = null;
  }

  ensureContext() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this.buildBreeze();
  }

  /* halk, szűrt zaj — levelek, légmozgás */
  buildBreeze() {
    const ctx = this.ctx;
    const seconds = 3;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      // egyszerű "rózsaszín-szerű" zaj: fehér zaj lassítva
      const white = Math.random() * 2 - 1;
      last = 0.97 * last + 0.03 * white;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 620;
    filter.Q.value = 0.6;

    // lassú hullámzás a szűrő frekvenciáján — "szellő"
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    const breezeGain = ctx.createGain();
    breezeGain.gain.value = 0.055;

    src.connect(filter).connect(breezeGain).connect(this.master);
    src.start();
  }

  /* egy madárfütty: 2–5 gyors, lecsúszó szinuszhang */
  chirp() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 4);
    const baseFreq = 2300 + Math.random() * 1700;
    const pan = ctx.createStereoPanner
      ? ctx.createStereoPanner()
      : null;
    if (pan) {
      pan.pan.value = Math.random() * 1.4 - 0.7;
      pan.connect(this.master);
    }
    const out = pan || this.master;

    let t = now;
    for (let i = 0; i < notes; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const f0 = baseFreq * (0.92 + Math.random() * 0.18);
      const dur = 0.05 + Math.random() * 0.09;

      osc.type = "sine";
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(
        f0 * (Math.random() > 0.5 ? 1.35 : 0.72),
        t + dur
      );
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 + Math.random() * 0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + 0.03 + Math.random() * 0.08;
    }
  }

  scheduleChirps() {
    const next = 900 + Math.random() * 2800;
    this.chirpTimer = setTimeout(() => {
      if (this.running && this.audible) this.chirp();
      if (this.running) this.scheduleChirps();
    }, next);
  }

  fadeTo(value, seconds = 1.2) {
    const g = this.master.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(g.value, 0.0001), now);
    g.linearRampToValueAtTime(value, now + seconds);
  }

  start() {
    this.ensureContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.running = true;
    this.audible = true;
    this.fadeTo(1, 1.5);
    clearTimeout(this.chirpTimer);
    this.scheduleChirps();
    setTimeout(() => { if (this.running) this.chirp(); }, 350);
  }

  stop() {
    if (!this.ctx) return;
    this.running = false;
    this.fadeTo(0, 0.8);
    clearTimeout(this.chirpTimer);
  }

  /* a szakasz láthatósága szerint úszik ki-be */
  setSectionVisible(visible) {
    if (!this.ctx || !this.running) {
      this.audible = visible;
      return;
    }
    this.audible = visible;
    this.fadeTo(visible ? 1 : 0, 1.2);
  }
}

const ambience = new NatureAmbience();
const toggle = document.getElementById("natureToggle");
const toggleLabel = toggle.querySelector("span");
const greenwallSection = document.getElementById("zoldfal");

toggle.addEventListener("click", () => {
  const isOn = toggle.getAttribute("aria-pressed") === "true";
  if (isOn) {
    ambience.stop();
    toggle.setAttribute("aria-pressed", "false");
    toggleLabel.textContent = toggleLabel.dataset.off;
  } else {
    ambience.start();
    toggle.setAttribute("aria-pressed", "true");
    toggleLabel.textContent = toggleLabel.dataset.on;
  }
});

new IntersectionObserver(
  ([e]) => ambience.setSectionVisible(e.isIntersecting),
  { threshold: 0.25 }
).observe(greenwallSection);
