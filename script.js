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
  const results = loadJSON("cadan-leaderboard", []);
  document.getElementById("leaderboard-list").innerHTML = results.length
    ? results.map((r) => '<div class="chip standing">' + r.name + " <small>" + r.date + "</small><b>" + r.score + "</b></div>").join("")
    : "<p>No games saved yet.</p>";
}

function showScreen(id) {
  if (id === "leaderboards") renderLeaderboard();
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
}
document.querySelectorAll("[data-go]").forEach((b) =>
  b.addEventListener("click", () => showScreen(b.dataset.go)));

// Player setup: 1-6 players with optional names
(function () {
  const names = document.getElementById("names");
  const count = document.getElementById("count");
  const saved = loadJSON("cadan-setup", { count: 1, names: [] });
  let n = Math.min(6, Math.max(1, saved.count || 1));
  function render() {
    count.textContent = n;
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
    if (++ticks >= 8) {
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

function toggleKnight(slot) {
  const player = state.players[state.currentPlayerIndex];
  if (player.jokersUsed.includes(slot.id)) return setMessage("That knight is already used.");
  if (!rollingOver()) return setMessage("Finish rolling before using a knight.");
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
  renderPlay();
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
      renderDice();
    });
    box.appendChild(el);
  });
  const over = state.stopped || state.rollCount >= CONSTANTS.maxRollsPerTurn;
  renderTally(over);
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

function renderMap(player) {
  const L = ISLAND_ONE.layout, V = L.vertices, r = L.hexRadius;
  let svg = '<svg viewBox="5 440 1060 1224" xmlns="http://www.w3.org/2000/svg"><rect x="-100" y="0" width="1300" height="1800" fill="#8fc1d4"/>';
  ISLAND_ONE.hexes.forEach((h) => {
    const [cx, cy] = L.hexCenters[h.id];
    svg += '<image href="icons/tile-' + h.resource.toLowerCase() + '.png" x="' + (cx - r) + '" y="' + (cy - r * 0.866).toFixed(0) +
      '" width="' + 2 * r + '" height="' + (2 * r * 0.866).toFixed(0) + '"/>';
  });
  ISLAND_ONE.buildSlots.forEach((s) => {
    const st = slotState(player, s);
    if (s.type === "road") {
      const [a, b] = s.vertices.map((v) => V[v]);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const deg = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      const rot = '" transform="rotate(' + deg.toFixed(1) + " " + mx + " " + my + ')"/>';
      svg += '<rect class="slot road ' + st + '" x="' + (mx - 55) + '" y="' + (my - 11) + '" width="110" height="22" rx="5' + rot;
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
    svg += '<g class="slot ' + st + (used ? " used" : "") + (active ? " active" : "") + '" data-slot="' + s.id + '" transform="translate(' + (x - 50 * sc) + " " + (y - 50 * sc) + ') scale(' + sc + ')">' +
      '<path class="shape" d="' + sh.d + '"/>' + (sh.extra || "") +
      '<text x="50" y="' + sh.ty + '" font-size="' + sh.fs + '" text-anchor="middle">' + (used ? "\u2713" : st === "built" ? "" : s.pointValue) + "</text></g>";
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

function playSound(name) {
  if (!state.soundOn) return;
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

function renderSoundToggles() {
  document.querySelectorAll(".sound-toggle").forEach((b) => {
    b.textContent = b.classList.contains("corner") ? (state.soundOn ? "🔊" : "🔇") : "Sound: " + (state.soundOn ? "On" : "Off");
  });
}
document.querySelectorAll(".sound-toggle").forEach((b) => b.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  saveJSON("cadan-sound", state.soundOn);
  renderSoundToggles();
  playSound("build");
}));
renderSoundToggles();

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
  if (!rollingOver()) return setMessage("Finish rolling before building.");
  const st = slotState(player, slot);
  if (st === "built") return slot.type === "knight" ? toggleKnight(slot) : undefined;
  if (st === "locked") return setMessage("That slot is locked: build in ascending order, next to a built road.");
  const cost = CONSTANTS.buildCosts[slot.type];
  const counts = countDice();
  const missing = Object.keys(cost).filter((r) => counts[r.toUpperCase()] < cost[r]);
  if (missing.length) return setMessage("Not enough resources for a " + slot.type + ".");
  Object.keys(cost).forEach((r) => {
    const f = r.toUpperCase();
    state.spent[f] = (state.spent[f] || 0) + cost[r];
  });
  player.builtSlotIds.push(slot.id);
  player.score += slot.pointValue;
  state.builtThisTurn++;
  playSound("build");
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

function showScorecard() {
  const ranked = state.players.slice().sort((a, b) => b.score - a.score);
  const top = ranked[0].score;
  const winners = ranked.filter((p) => p.score === top);
  playSound("win");
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
  renderPlay();
});

if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}
