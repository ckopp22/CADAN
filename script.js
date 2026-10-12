console.log("CADAN loaded");

// Temporary Section 2 view: lists the transcribed Island One data for checking against the scan.
(function () {
  const out = document.getElementById("data-list");
  const rows = (items) => "<ul>" + items.map((i) => "<li>" + i + "</li>").join("") + "</ul>";
  let html = "<h2>Hexes</h2>" + rows(ISLAND_ONE.hexes.map((h) =>
    "Knight " + h.knight + ": " + h.resource + " (" + h.position + ")"));
  ["road", "settlement", "city", "knight"].forEach((type) => {
    const slots = ISLAND_ONE.buildSlots.filter((s) => s.type === type);
    html += "<h2>" + type + "s (" + slots.length + ")</h2>" + rows(slots.map((s) =>
      s.id + ": " + s.pointValue + " pts" + (s.free ? " (free)" : "") + (s.vertices ? ", joins " + s.vertices.join("-") : "") + (s.vertex ? ", at " + s.vertex : "") +
      (s.jokerResource ? ", joker " + s.jokerResource : "")));
  });
  out.innerHTML = html;
})();

// Screen switching
function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null ? fallback : v;
  } catch (e) { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
}

function renderLeaderboard() {
  const results = loadJSON("cadan-leaderboard", []).sort((a, b) => b.score - a.score).slice(0, 5);
  document.getElementById("leaderboard-list").innerHTML = results.length
    ? results.map((r) => '<div class="chip standing">' + r.name + " <small>" + r.date + "</small><b>" + r.score + "</b></div>").join("")
    : "<p>No games saved yet.</p>";
}

function showScreen(id) {
  if (id !== "scorecard") stopResultsMusic();
  if (id === "leaderboards") renderLeaderboard();
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
  fitScreen();
}

// No page scrolling: shrink the whole page to fit the viewport height when a screen is taller than it
const mainEl = document.querySelector("main");
let fitQueued = false;
function fitScreen() {
  mainEl.style.zoom = 1;
  const h = mainEl.offsetHeight;
  mainEl.style.zoom = h > window.innerHeight ? window.innerHeight / h : 1;
}
function queueFit() {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(() => { fitQueued = false; fitScreen(); });
}
new MutationObserver(queueFit).observe(mainEl, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden"] });
window.addEventListener("resize", queueFit);
window.addEventListener("load", queueFit);
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);
document.querySelectorAll("[data-go]").forEach((b) =>
  b.addEventListener("click", () => showScreen(b.dataset.go)));

// Player setup: 1-6 players with optional names
(function () {
  const names = document.getElementById("names");
  const saved = loadJSON("cadan-setup", { count: 1, names: [] });
  let n = Math.min(6, Math.max(1, saved.count || 1));
  function render() {
    document.getElementById("fewer").style.display = n > 1 ? "" : "none";
    const current = Array.from(names.querySelectorAll("input")).map((i) => i.value);
    const old = current.length ? current : saved.names || [];
    names.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const input = document.createElement("input");
      input.placeholder = "Player " + (i + 1);
      input.value = old[i] || "";
      names.appendChild(input);
    }
  }
  document.getElementById("fewer").addEventListener("click", () => { n = Math.max(1, n - 1); render(); });
  document.getElementById("more").addEventListener("click", () => { n = Math.min(6, n + 1); render(); });
  render();
})();

// Game state and turn shell
const state = { players: [], currentPlayerIndex: 0, turnNumber: 1, soundOn: true,
  dice: [], rollCount: 0, stopped: false, rolling: false, spent: {}, jokerPending: null, goldPending: false, builtThisTurn: 0 };

const DIE_ICONS = {};
CONSTANTS.dieFaces.forEach((f) => {
  DIE_ICONS[f] = '<img class="ico" src="icons/res-' + f.toLowerCase() + '.png" alt="' + f.toLowerCase() + '">';
});

function resetDice() {
  state.dice = CONSTANTS.dieFaces.map(() => ({ value: null, kept: false, spent: false }));
  state.rollCount = 0;
  state.stopped = false;
  state.rolling = false;
  state.spent = {};
  state.jokerPending = null;
  state.goldPending = false;
  state.builtThisTurn = 0;
  setMessage("");
}

function randomFace() {
  return CONSTANTS.dieFaces[Math.floor(Math.random() * CONSTANTS.dieFaces.length)];
}

function rollDice() {
  if (state.rolling || state.stopped || state.rollCount >= CONSTANTS.maxRollsPerTurn) return;
  if (state.dice.every((d) => d.kept)) return;
  state.rolling = true;
  state.rollCount++;
  playSound("roll");
  let ticks = 0;
  const timer = setInterval(() => {
    state.dice.forEach((d) => { if (!d.kept) d.value = randomFace(); });
    renderDice();
    if (++ticks >= 19) { // 19 x 60ms ~ length of dice-shake.mp3
      clearInterval(timer);
      state.rolling = false;
      if (state.rollCount >= CONSTANTS.maxRollsPerTurn) state.dice.forEach((d) => { d.kept = false; });
      renderDice();
    }
  }, 60);
}

function countDice() {
  const counts = {};
  CONSTANTS.dieFaces.forEach((f) => { counts[f] = 0; });
  state.dice.forEach((d) => { if (d.value && !d.spent) counts[d.value]++; });
  Object.keys(state.spent).forEach((f) => { counts[f] -= state.spent[f]; });
  return counts;
}

function renderTally(rollingOver) {
  const counts = countDice();
  const gb = document.getElementById("gold-trade");
  const ok = rollingOver && counts.GOLD >= CONSTANTS.goldTradeRate;
  if (!ok && state.goldPending) state.goldPending = false;
  gb.hidden = !ok;
  gb.classList.toggle("active", !!state.goldPending);
}

document.getElementById("gold-trade").addEventListener("click", () => {
  state.goldPending = !state.goldPending;
  state.jokerPending = null;
  setMessage(state.goldPending ? "Tap a hex to trade 2 gold for it." : "");
  renderPlay();
});

function denyMessage(text) {
  playSound("deny");
  setMessage(text);
}

function toggleKnight(slot) {
  const player = state.players[state.currentPlayerIndex];
  if (player.jokersUsed.includes(slot.id)) return denyMessage("That knight is already used.");
  if (!rollingOver()) return denyMessage("Finish rolling before using a knight.");
  const pending = state.jokerPending;
  state.goldPending = false;
  if (pending && pending.knightId === slot.id) state.jokerPending = null;
  else state.jokerPending = { knightId: slot.id, face: slot.jokerResource === "ANY" ? null : slot.jokerResource };
  setMessage(state.jokerPending ? (state.jokerPending.face ? "Tap a die to swap." : "Tap a hex to choose a resource.") : "");
  renderPlay();
}

function useJoker(die) {
  const player = state.players[state.currentPlayerIndex];
  const { knightId, face } = state.jokerPending;
  die.value = face;
  player.jokersUsed.push(knightId);
  state.jokerPending = null;
  playSound("trade");
  setMessage("Knight used.");
  renderPlay();
}

function tradeGold(face) {
  const golds = state.dice.filter((d) => d.value === "GOLD" && !d.spent);
  if (golds.length < CONSTANTS.goldTradeRate) return;
  golds[0].value = face;
  golds[1].spent = true;
  setMessage("");
  state.goldPending = false;
  playSound("trade");
  renderPlay();
}

// Slowly wobble every piece the current player can build with their unspent dice
function refreshWobble() {
  const cur = state.players[state.currentPlayerIndex];
  const on = cur && state.rollCount > 0 && !state.rolling && state.turnNumber <= CONSTANTS.turnsPerPlayer &&
    !state.jokerPending && !state.goldPending;
  const counts = countDice();
  document.querySelectorAll("#map [data-wb]").forEach((el) => {
    let ok = false;
    if (on) {
      const slot = ISLAND_ONE.buildSlots.find((s) => s.id === el.dataset.wb);
      const cost = CONSTANTS.buildCosts[slot.type];
      ok = slotState(cur, slot) === "buildable" && Object.keys(cost).every((r) => counts[r.toUpperCase()] >= cost[r]);
    }
    el.classList.toggle("wobble", ok);
    el.firstElementChild.classList.toggle("afford", ok);
  });
}

function renderDice() {
  const canKeep = state.rollCount > 0 && !state.stopped && !state.rolling &&
    state.rollCount < CONSTANTS.maxRollsPerTurn;
  const box = document.getElementById("dice");
  box.innerHTML = "";
  const usedLeft = Object.assign({}, state.spent);
  state.dice.forEach((d, i) => {
    const el = document.createElement("button");
    const used = !d.spent && usedLeft[d.value] > 0 && usedLeft[d.value]--;
    el.className = "die" + (d.spent ? " spent" : "") + (d.kept || used ? " kept" : "") + (state.rolling && !d.kept ? " rolling" : "");
    if (state.jokerPending && state.jokerPending.face && !d.spent && !used) el.className += " wobble";
    el.innerHTML = d.value ? DIE_ICONS[d.value] : "?";
    el.title = d.value || "";
    const jokerMode = !!(state.jokerPending && state.jokerPending.face);
    el.disabled = d.spent || !(canKeep || (jokerMode && !used));
    el.addEventListener("click", () => {
      if (jokerMode) return useJoker(d);
      d.kept = !d.kept;
      playSound("select");
      renderDice();
    });
    box.appendChild(el);
  });
  const over = state.stopped || state.rollCount >= CONSTANTS.maxRollsPerTurn;
  renderTally(over);
  refreshWobble();
  const rollBtn = document.getElementById("roll");
  rollBtn.textContent = (state.rollCount === 0 ? "Roll" : "Roll Again") + " (" + Math.min(state.rollCount + 1, CONSTANTS.maxRollsPerTurn) + "/" + CONSTANTS.maxRollsPerTurn + ")";
  if (over && state.rollCount > 0) rollBtn.textContent = "Finished (" + state.rollCount + "/" + CONSTANTS.maxRollsPerTurn + ")";
  const allKept = state.rollCount > 0 && state.dice.every((d) => d.kept);
  if (allKept && !over) rollBtn.textContent = "Stop Rolling";
  rollBtn.disabled = over || state.rolling;
  document.getElementById("end-turn").hidden = !(over && state.rollCount > 0);
}

document.getElementById("roll").addEventListener("click", () => {
  if (state.rollCount > 0 && state.dice.every((d) => d.kept)) { state.stopped = true; renderDice(); }
  else rollDice();
});


// A slot is built, buildable (next in order and next to a built road where required), or locked.
function slotState(player, slot) {
  if (player.builtSlotIds.includes(slot.id)) return "built";
  const slots = ISLAND_ONE.buildSlots;
  const builtRoads = slots.filter((s) => s.type === "road" && player.builtSlotIds.includes(s.id));
  if (slot.type === "road") {
    return builtRoads.some((r) => r.vertices.some((v) => slot.vertices.includes(v))) ? "buildable" : "locked";
  }
  const nextInOrder = slots.filter((s) => s.type === slot.type && !player.builtSlotIds.includes(s.id))
    .sort((a, b) => a.order - b.order)[0];
  if (nextInOrder.id !== slot.id) return "locked";
  if (slot.type === "knight") return "buildable";
  return builtRoads.some((r) => r.vertices.includes(slot.vertex)) ? "buildable" : "locked";
}

// Outline shapes from house-outline.svg, city-outline.svg and knight-outline.svg (100x100), number inside.
const SHAPES = {
  settlement: { d: "M18 90 V46 L50 16 L82 46 V90 Z", ty: 75, fs: 30, scale: 1.1 },
  city: { d: "M10 90 V38 H16 V32 H24 V38 H30 V32 H38 V38 H38 V50 H62 V38 H62 V32 H70 V38 H76 V32 H84 V38 H90 V90 Z", ty: 78, fs: 28 },
  knight: { d: "M28 92 V42 C28 26 38 16 50 16 C62 16 72 26 72 42 V92 Z", ty: 78, fs: 26,
    extra: '<path d="M50 16 C48 6 62 3 72 11 C64 10 58 12 54 17" class="line"/><rect x="35" y="34" width="30" height="8" rx="4" class="line"/>' }
};

function structIcon(type) {
  const body = type === "road"
    ? '<path d="M14 72 L86 28" stroke-width="14"/>'
    : '<path d="' + SHAPES[type].d + '"/>' + (SHAPES[type].extra || "").replace(/class="line"/g, "");
  return '<svg class="struct" viewBox="0 0 100 100" fill="none" stroke="#3b2a1a" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">' + body + "</svg>";
}

function buildKey() {
  document.getElementById("map-key").innerHTML = ["road", "settlement", "city", "knight"].map((type) => {
    const cost = CONSTANTS.buildCosts[type];
    const icons = Object.keys(cost).map((r) => DIE_ICONS[r.toUpperCase()].repeat(cost[r])).join("");
    return '<div class="key-row">' + structIcon(type) + '<span class="key-cost">' + icons + "</span></div>";
  }).join("");
}
buildKey();

let waveNext = false;
function renderMap(player) {
  const wave = waveNext; waveNext = false;
  const L = ISLAND_ONE.layout, V = L.vertices, r = L.hexRadius;
  let svg = '<svg viewBox="5 440 1060 1224" xmlns="http://www.w3.org/2000/svg"><rect x="-100" y="0" width="1300" height="1800" fill="#8fc1d4"/>';
  if (wave) for (let o = 0; o < 2; o++) {
    let d = "";
    for (let y = 440; y <= 1664; y += 20) d += (y === 440 ? "M" : "L") + (225 + o * 50 - y * 0.5 + Math.sin(y / 19) * 16).toFixed(0) + " " + y;
    svg += '<path class="water-wave" d="' + d + '" style="animation-delay:' + o * 80 + 'ms"/>';
  }
  ISLAND_ONE.hexes.forEach((h) => {
    const [cx, cy] = L.hexCenters[h.id];
    svg += '<image' + (wave ? ' class="wave" style="animation-delay:' + Math.round((cx + cy * 0.5) * 0.6 - 300) + 'ms"' : '') + ' href="icons/tile-' + h.resource.toLowerCase() + '.png" x="' + (cx - r) + '" y="' + (cy - r * 0.866).toFixed(0) +
      '" width="' + 2 * r + '" height="' + (2 * r * 0.866).toFixed(0) + '"/>';
  });
  ISLAND_ONE.buildSlots.forEach((s) => {
    const st = slotState(player, s);
    if (s.type === "road") {
      const [a, b] = s.vertices.map((v) => V[v]);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const deg = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      const rot = '" transform="rotate(' + deg.toFixed(1) + " " + mx + " " + my + ')"/>';
      svg += '<g class="wb" data-wb="' + s.id + '">' + '<rect class="slot road ' + st + '" x="' + (mx - 55) + '" y="' + (my - 11) + '" width="110" height="22" rx="5' + rot + "</g>";
      // Invisible larger tap area for the road
      svg += '<rect class="hit" fill="transparent" data-slot="' + s.id + '" x="' + (mx - 65) + '" y="' + (my - 30) + '" width="130" height="60' + rot;
    }
  });
  ISLAND_ONE.buildSlots.forEach((s) => {
    if (s.type === "road") return;
    const st = slotState(player, s);
    let x, y;
    if (s.type === "knight") {
      const hex = ISLAND_ONE.hexes.find((h) => h.knight === s.order);
      [x, y] = L.hexCenters[hex.id];
      y -= 85;
      const shift = (L.knightShift && L.knightShift[hex.id]) || [0, 0];
      x += shift[0];
      y += shift[1];
    } else {
      [x, y] = V[s.vertex];
      const out = (L.slotShift && L.slotShift[s.id]) || [0, 0];
      x += out[0];
      y += out[1];
    }
    const sh = SHAPES[s.type];
    const used = s.type === "knight" && player.jokersUsed.includes(s.id);
    const active = state.jokerPending && state.jokerPending.knightId === s.id;
    const sc = (sh.scale || 1.24) * (active ? 1.4 : 1);
    svg += '<g class="wb" data-wb="' + s.id + '"><g class="slot ' + st + (used ? " used" : "") + (active ? " active" : "") + '" data-slot="' + s.id + '" transform="translate(' + (x - 50 * sc) + " " + (y - 50 * sc) + ') scale(' + sc + ')">' +
      '<path class="shape" d="' + sh.d + '"/>' + (sh.extra || "") +
      '<text x="50" y="' + sh.ty + '" font-size="' + sh.fs + '" text-anchor="middle">' + (used ? "\u2713" : st === "built" ? "" : s.pointValue) + "</text></g></g>";
  });
  const knightPick = state.jokerPending && !state.jokerPending.face;
  if (state.goldPending || knightPick) {
    ISLAND_ONE.hexes.filter((h) => h.resource !== "ANY").forEach((h) => {
      const [cx, cy] = L.hexCenters[h.id], w = 2 * r * 1.3, ht = w * 0.866;
      svg += '<image class="pick" data-trade="' + h.resource + '" href="icons/tile-' + h.resource.toLowerCase() + '.png" x="' + (cx - w / 2) +
        '" y="' + (cy - ht / 2).toFixed(0) + '" width="' + w + '" height="' + ht.toFixed(0) + '"/>';
    });
  }
  document.getElementById("map").innerHTML = svg + "</svg>";
}

// Sound effects (Web Audio, no files) and the persistent sound toggle
state.soundOn = loadJSON("cadan-sound", true) !== false;
let audioCtx = null;
const SOUNDS = {
  roll: [[300, 0], [450, 0.06], [350, 0.12], [500, 0.18]],
  build: [[440, 0], [660, 0.12]],
  turnEnd: [[260, 0], [200, 0.12]],
  win: [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45]]
};

const FILE_SOUNDS = {
  roll: new Audio("sounds/dice-shake.mp3"),
  build: new Audio("sounds/build.mp3"),
  knight: new Audio("sounds/knight.mp3"),
  turnEnd: new Audio("sounds/end-turn.mp3"),
  trade: new Audio("sounds/trade.mp3"),
  menu: new Audio("sounds/select.mp3"),
  deny: new Audio("sounds/nope.mp3"),
  select: new Audio("sounds/deny.mp3")
};
Object.values(FILE_SOUNDS).forEach((a) => { a.preload = "auto"; a.load(); });

// Seconds of leading silence in each file, skipped on playback (measured from the decoded audio)
const SOUND_START = { roll: 0.02, build: 0.113, knight: 0.02, turnEnd: 0.02, trade: 0.305, menu: 0.008, deny: 0.096, select: 0.008 };

// Decoded buffers start instantly; the Audio elements are the fallback (e.g. file:// or before audio is unlocked)
const SOUND_BUFFERS = {};
try {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  Object.keys(FILE_SOUNDS).forEach((name) => {
    fetch(FILE_SOUNDS[name].src).then((r) => r.arrayBuffer())
      .then((data) => new Promise((ok, fail) => audioCtx.decodeAudioData(data, ok, fail)))
      .then((buf) => { SOUND_BUFFERS[name] = buf; })
      .catch(() => {});
  });
  ["pointerdown", "keydown"].forEach((t) => document.addEventListener(t, () => {
    if (audioCtx.state === "suspended") audioCtx.resume();
  }, { passive: true }));
} catch (e) { /* Web Audio unavailable */ }

function playSound(name) {
  if (!state.soundOn) return;
  if (FILE_SOUNDS[name]) {
    const start = SOUND_START[name] || 0;
    if (SOUND_BUFFERS[name] && audioCtx.state === "running") {
      const src = audioCtx.createBufferSource();
      src.buffer = SOUND_BUFFERS[name];
      src.connect(audioCtx.destination);
      src.start(0, start);
      return;
    }
    FILE_SOUNDS[name].currentTime = start;
    FILE_SOUNDS[name].play().catch(() => {});
    return;
  }
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    SOUNDS[name].forEach(([freq, at]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = name === "roll" ? "square" : "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + at + 0.12);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.13);
    });
  } catch (e) { /* audio unavailable */ }
}

document.addEventListener("click", (e) => {
  if (e.target.closest("button[data-go], #start, #save-result, #more, #fewer")) playSound("menu");
});

function renderSoundToggles() {
  document.querySelectorAll(".sound-toggle").forEach((b) => b.classList.toggle("off", !state.soundOn));
}
document.querySelectorAll(".sound-toggle").forEach((b) => b.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  saveJSON("cadan-sound", state.soundOn);
  renderSoundToggles();
  playSound("build");
}));
renderSoundToggles();

// Background music: whistler intro, then the two loops alternate. Starts on the splash tap.
state.musicOn = loadJSON("cadan-music", true) !== false;
const MUSIC_INTRO = "sounds/whistler.mp3";
const MUSIC_LOOP = ["sounds/medieval_whistle_loop.mp3", "sounds/gameplay_1_tavern_jig.mp3"];
const music = new Audio(MUSIC_INTRO);
music.volume = 0.15;
let musicNext = 0;
let musicStarted = false;
music.addEventListener("ended", () => {
  music.src = MUSIC_LOOP[musicNext++ % MUSIC_LOOP.length];
  music.play().catch(() => {});
});
// Final standings: fanfare, then the scoreboard tune loops until the player leaves the screen
const FANFARE = new Audio("sounds/fanfare.mp3");
const SCOREBOARD = new Audio("sounds/scoreboard.mp3");
FANFARE.volume = 0.8;
SCOREBOARD.volume = 0.3;
SCOREBOARD.loop = true;
let resultsActive = false;
function playScoreboard() {
  if (resultsActive && state.musicOn) SCOREBOARD.play().catch(() => {});
}
FANFARE.addEventListener("ended", playScoreboard);
function startResultsMusic() {
  resultsActive = true;
  music.pause();
  FANFARE.pause(); FANFARE.currentTime = 0.028; // skip leading silence
  SCOREBOARD.pause(); SCOREBOARD.currentTime = 0;
  if (state.soundOn) FANFARE.play().catch(() => {});
  else playScoreboard();
}
function stopResultsMusic() {
  if (!resultsActive) return;
  resultsActive = false;
  FANFARE.pause();
  SCOREBOARD.pause();
  if (state.musicOn && musicStarted) music.play().catch(() => {});
}
function startMusic() {
  musicStarted = true;
  if (state.musicOn) music.play().catch(() => {});
}
function renderMusicToggles() {
  document.querySelectorAll(".music-toggle").forEach((b) => b.classList.toggle("off", !state.musicOn));
}
document.querySelectorAll(".music-toggle").forEach((b) => b.addEventListener("click", () => {
  state.musicOn = !state.musicOn;
  saveJSON("cadan-music", state.musicOn);
  renderMusicToggles();
  if (state.musicOn) {
    musicStarted = true;
    if (!resultsActive) music.play().catch(() => {});
    else if (FANFARE.paused) playScoreboard();
  } else { music.pause(); SCOREBOARD.pause(); }
}));
renderMusicToggles();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) music.pause();
  else if (state.musicOn && musicStarted && !resultsActive) music.play().catch(() => {});
});

// Splash: tap the die to roll it, which also unlocks audio, then go to the menu
const ROLL_ANIM = new Image();
ROLL_ANIM.src = "ui/dice_roll.webp";
document.addEventListener("click", function (e) {
  if (!document.getElementById("splash").classList.contains("active") || e.target.closest("#audio-toggles")) return;
  const die = document.getElementById("splash-die");
  if (die.classList.contains("rolling")) return;
  die.classList.add("rolling");
  die.src = ROLL_ANIM.src;
  playSound("roll");
  startMusic();
  setTimeout(() => die.classList.add("shrink"), 600);
  setTimeout(() => showScreen("menu"), 1300);
});

let messageTimer;
function setMessage(text) {
  document.getElementById("message").textContent = text;
  clearTimeout(messageTimer);
  if (text) messageTimer = setTimeout(() => { document.getElementById("message").textContent = ""; }, 4000);
}

function rollingOver() {
  return state.rollCount > 0 && (state.stopped || state.rollCount >= CONSTANTS.maxRollsPerTurn);
}

function buildSlot(slotId) {
  const player = state.players[state.currentPlayerIndex];
  const slot = ISLAND_ONE.buildSlots.find((s) => s.id === slotId);
  if (!slot || state.turnNumber > CONSTANTS.turnsPerPlayer) return;
  if (!rollingOver()) return denyMessage("Finish rolling before building.");
  const st = slotState(player, slot);
  if (st === "built") return slot.type === "knight" ? toggleKnight(slot) : undefined;
  if (st === "locked") return denyMessage("That slot is locked: build in ascending order, next to a built road.");
  const cost = CONSTANTS.buildCosts[slot.type];
  const counts = countDice();
  const missing = Object.keys(cost).filter((r) => counts[r.toUpperCase()] < cost[r]);
  if (missing.length) return denyMessage("Not enough resources for a " + slot.type + ".");
  Object.keys(cost).forEach((r) => {
    const f = r.toUpperCase();
    state.spent[f] = (state.spent[f] || 0) + cost[r];
  });
  player.builtSlotIds.push(slot.id);
  player.score += slot.pointValue;
  state.builtThisTurn++;
  playSound(slot.type === "knight" ? "knight" : "build");
  setMessage("Built " + slot.type + " for " + slot.pointValue + " point" + (slot.pointValue === 1 ? "" : "s") + ".");
  renderPlay();
}

document.getElementById("map").addEventListener("click", (e) => {
  const pick = e.target.closest("[data-trade]");
  if (pick) {
    if (state.jokerPending && !state.jokerPending.face) {
      state.jokerPending.face = pick.dataset.trade;
      setMessage("Tap a die to swap.");
      return renderPlay();
    }
    return tradeGold(pick.dataset.trade);
  }
  const el = e.target.closest("[data-slot]");
  if (el) buildSlot(el.dataset.slot);
});

document.getElementById("score").addEventListener("click", () => {
  document.getElementById("score-list").innerHTML = "<h3>Scores</h3>" + state.players.map((p) =>
    '<div class="chip standing' + (p === state.players[state.currentPlayerIndex] ? " active" : "") + '">' + p.name + "<b>" + p.score + "</b></div>").join("");
  document.getElementById("score-pop").hidden = false;
});
document.getElementById("score-pop").addEventListener("click", (e) => { e.currentTarget.hidden = true; });

function renderPlay() {
  const done = state.turnNumber > CONSTANTS.turnsPerPlayer;
  const current = state.players[state.currentPlayerIndex];
  document.getElementById("turn-player").textContent = done ? "Game complete" : current.name;
  document.getElementById("turn-count").textContent = done ? "" : "Turn " + state.turnNumber + "/" + CONSTANTS.turnsPerPlayer;
  document.getElementById("score").textContent = current.score;
  document.getElementById("end-turn").disabled = done;
  if (current) renderMap(current);
  renderDice();
}

document.getElementById("start").addEventListener("click", () => {
  const inputs = document.querySelectorAll("#names input");
  saveJSON("cadan-setup", { count: inputs.length, names: Array.from(inputs).map((i) => i.value.trim()) });
  state.players = Array.from(inputs).map((input, i) => ({
    id: "p" + (i + 1),
    name: input.value.trim() || "Player " + (i + 1),
    score: 0,
    xCount: 0,
    builtSlotIds: ["road-1"],
    jokersUsed: [],
    turnsTaken: 0
  }));
  state.currentPlayerIndex = 0;
  state.turnNumber = 1;
  resetDice();
  renderPlay();
  showScreen("play");
});

let lastRanked = [];
function showScorecard() {
  const ranked = state.players.slice().sort((a, b) => b.score - a.score);
  lastRanked = ranked;
  const top = ranked[0].score;
  const winners = ranked.filter((p) => p.score === top);
  startResultsMusic();
  document.getElementById("winner").textContent = winners.length === 1
    ? winners[0].name + " wins!"
    : "Tie: " + winners.map((p) => p.name).join(" & ");
  let rank = 0;
  document.getElementById("standings").innerHTML = ranked.map((p, i) => {
    if (i === 0 || p.score !== ranked[i - 1].score) rank = i + 1;
    return '<div class="chip standing' + (p.score === top ? " active" : "") + '">' + rank + ". " + p.name +
      "<b>" + p.score + "</b>" + (p.xCount ? " <small>(" + p.xCount + " X)</small>" : "") + "</div>";
  }).join("");
  const saveBtn = document.getElementById("save-result");
  saveBtn.disabled = false;
  saveBtn.textContent = "Save to Leaderboard";
  saveBtn.onclick = () => {
    const date = new Date().toLocaleDateString();
    const results = loadJSON("cadan-leaderboard", []);
    saveJSON("cadan-leaderboard", ranked.map((p) => ({ name: p.name, score: p.score, date })).concat(results));
    saveBtn.disabled = true;
    saveBtn.textContent = "Saved";
  };
  showScreen("scorecard");
}

document.getElementById("end-game").addEventListener("click", () => {
  if (confirm("End the game now and show the final standings?")) showScorecard();
});

document.getElementById("end-turn").addEventListener("click", () => {
  const player = state.players[state.currentPlayerIndex];
  if (state.builtThisTurn === 0) {
    player.xCount++;
    player.score += CONSTANTS.xPenalty;
  }
  player.turnsTaken++;
  playSound("turnEnd");
  state.currentPlayerIndex++;
  if (state.currentPlayerIndex >= state.players.length) {
    state.currentPlayerIndex = 0;
    state.turnNumber++;
  }
  if (state.turnNumber > CONSTANTS.turnsPerPlayer) return showScorecard();
  resetDice();
  waveNext = true;
  renderPlay();
});

if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}

// iOS Safari ignores user-scalable=no, so block pinch zoom explicitly
["gesturestart", "gesturechange"].forEach((t) => document.addEventListener(t, (e) => e.preventDefault()));

// Share the game link: native share sheet where available, otherwise copy it
function showToast(text) {
  const old = document.getElementById("toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.id = "toast";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}
document.getElementById("share-btn").addEventListener("click", async () => {
  const url = location.protocol === "file:" ? location.href : location.origin + location.pathname;
  playSound("menu");
  if (navigator.share) {
    try { await navigator.share({ title: "CADAN", text: "Play CADAN with me!", url }); } catch (e) { /* share cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copied!");
  } catch (e) {
    prompt("Copy this link to share:", url);
  }
});

// Share the final score as a parchment image (native share sheet, or a download as fallback)
function loadImage(src) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  });
}

function fitText(ctx, text, maxWidth, size, weight, family) {
  for (let s = size; s >= 20; s -= 2) {
    ctx.font = weight + " " + s + "px " + family;
    if (ctx.measureText(text).width <= maxWidth) return;
  }
}

async function buildShareImage(url) {
  const W = 1080, H = 1350, SERIF = '"Lora", Georgia, serif', DECOR = '"Cinzel Decorative", Georgia, serif';
  try { await Promise.all([document.fonts.load('700 100px ' + DECOR), document.fonts.load('700 40px ' + SERIF)]); } catch (e) { /* fonts optional */ }
  const [tile, panel, divider] = await Promise.all(["ui/bg_parchment_tile.png", "ui/panel_parchment.png", "ui/divider.png"].map(loadImage));
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = ctx.createPattern(tile, "repeat");
  ctx.fillRect(0, 0, W, H);
  // nine-slice the parchment panel (72px slices, drawn 100px wide)
  const px = 40, py = 40, pw = W - 80, ph = H - 80, sl = 72, b = 100, iw = panel.width, ih = panel.height;
  const xs = [[0, sl, px, b], [sl, iw - 2 * sl, px + b, pw - 2 * b], [iw - sl, sl, px + pw - b, b]];
  const ys = [[0, sl, py, b], [sl, ih - 2 * sl, py + b, ph - 2 * b], [ih - sl, sl, py + ph - b, b]];
  ys.forEach(([sy, sh, dy, dh]) => xs.forEach(([sx, sw, dx, dw]) => ctx.drawImage(panel, sx, sy, sw, sh, dx, dy, dw, dh)));
  ctx.textAlign = "center";
  ctx.fillStyle = "#8b2e2e";
  ctx.font = "700 130px " + DECOR;
  ctx.fillText("CADAN", W / 2, 290);
  ctx.drawImage(divider, W / 2 - 280, 320, 560, 41);
  const top = lastRanked[0].score;
  const winners = lastRanked.filter((p) => p.score === top);
  const headline = lastRanked.length === 1 ? lastRanked[0].name + " scored " + top + "!"
    : winners.length === 1 ? winners[0].name + " wins!" : "Tie: " + winners.map((p) => p.name).join(" & ");
  ctx.fillStyle = "#3b2a1a";
  fitText(ctx, headline, 700, 64, "700", SERIF);
  ctx.fillText(headline, W / 2, 450);
  ctx.font = "700 30px " + SERIF;
  ctx.fillText("FINAL STANDINGS", W / 2, 510);
  let rank = 0;
  lastRanked.slice(0, 6).forEach((p, i) => {
    if (i === 0 || p.score !== lastRanked[i - 1].score) rank = i + 1;
    const y = 610 + i * 78;
    ctx.fillStyle = p.score === top ? "#2f5d3a" : "#3b2a1a";
    ctx.textAlign = "left";
    fitText(ctx, rank + ". " + p.name, 520, 44, "700", SERIF);
    ctx.fillText(rank + ". " + p.name, 220, y);
    ctx.textAlign = "right";
    ctx.font = "700 48px " + SERIF;
    ctx.fillText(String(p.score), 860, y);
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "#8b2e2e";
  ctx.font = "700 38px " + SERIF;
  ctx.fillText("Can you beat that?", W / 2, 1120);
  ctx.fillStyle = "#3b2a1a";
  fitText(ctx, url, 640, 28, "400", SERIF);
  ctx.fillText(url, W / 2, 1165);
  return new Promise((ok, fail) => canvas.toBlob((blob) => (blob ? ok(blob) : fail()), "image/png"));
}

document.getElementById("share-score").addEventListener("click", async () => {
  const url = location.protocol === "file:" ? location.href : location.origin + location.pathname;
  const top = lastRanked.length ? lastRanked[0].score : 0;
  const text = "I scored " + top + " points in CADAN! Can you beat it? " + url;
  playSound("menu");
  let file = null;
  try { file = new File([await buildShareImage(url)], "cadan-score.png", { type: "image/png" }); } catch (e) { /* image unavailable: share text only */ }
  if (navigator.share) {
    const data = file && navigator.canShare && navigator.canShare({ files: [file] }) ? { files: [file], text } : { text };
    try { await navigator.share(data); } catch (e) { /* share cancelled */ }
    return;
  }
  if (file) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast("Score image saved!");
  } else {
    try { await navigator.clipboard.writeText(text); showToast("Message copied!"); } catch (e) { prompt("Copy this message to share:", text); }
  }
});
