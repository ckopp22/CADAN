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
  dice: [], rollCount: 0, stopped: false, rolling: false, spent: {}, jokerPending: null, builtThisTurn: 0 };

const DIE_ICONS = { BRICK: "\u{1F9F1}", LUMBER: "\u{1FAB5}", WOOL: "\u{1F411}", GRAIN: "\u{1F33E}", ORE: "\u{1FAA8}", GOLD: "\u{1FA99}" };

function resetDice() {
  state.dice = CONSTANTS.dieFaces.map(() => ({ value: null, kept: false, spent: false }));
  state.rollCount = 0;
  state.stopped = false;
  state.rolling = false;
  state.spent = {};
  state.jokerPending = null;
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
  let ticks = 0;
  const timer = setInterval(() => {
    state.dice.forEach((d) => { if (!d.kept) d.value = randomFace(); });
    renderDice();
    if (++ticks >= 8) {
      clearInterval(timer);
      state.rolling = false;
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
  document.getElementById("tally").innerHTML = CONSTANTS.dieFaces.map((f) =>
    '<div class="tally-item"><span>' + DIE_ICONS[f] + "</span><b>" + counts[f] + "</b></div>").join("");
  const trade = document.getElementById("trade");
  trade.innerHTML = "";
  CONSTANTS.dieFaces.filter((f) => f !== "GOLD").forEach((f) => {
    const b = document.createElement("button");
    b.className = "trade-btn";
    b.textContent = "2" + DIE_ICONS.GOLD + " \u2192 " + DIE_ICONS[f];
    b.disabled = !rollingOver || counts.GOLD < CONSTANTS.goldTradeRate;
    b.addEventListener("click", () => tradeGold(f));
    trade.appendChild(b);
  });
}

function renderJokers(over) {
  const player = state.players[state.currentPlayerIndex];
  const box = document.getElementById("jokers");
  box.innerHTML = "";
  if (!player) return;
  const pending = state.jokerPending;
  ISLAND_ONE.buildSlots.filter((s) => s.type === "knight" && player.builtSlotIds.includes(s.id)).forEach((k) => {
    const used = player.jokersUsed.includes(k.id);
    const b = document.createElement("button");
    b.className = "trade-btn";
    b.textContent = "Joker " + (k.jokerResource === "ANY" ? "?" : DIE_ICONS[k.jokerResource]) + (used ? " (used)" : "");
    b.disabled = used || !over;
    b.addEventListener("click", () => {
      if (pending && pending.knightId === k.id) state.jokerPending = null;
      else state.jokerPending = { knightId: k.id, face: k.jokerResource === "ANY" ? null : k.jokerResource };
      setMessage(state.jokerPending ? (state.jokerPending.face ? "Tap a die to turn it." : "Choose a resource.") : "");
      renderDice();
    });
    box.appendChild(b);
  });
  if (pending && !pending.face) {
    CONSTANTS.dieFaces.filter((f) => f !== "GOLD").forEach((f) => {
      const b = document.createElement("button");
      b.className = "trade-btn";
      b.textContent = DIE_ICONS[f];
      b.addEventListener("click", () => { pending.face = f; setMessage("Tap a die to turn it."); renderDice(); });
      box.appendChild(b);
    });
  }
}

function useJoker(die) {
  const player = state.players[state.currentPlayerIndex];
  const { knightId, face } = state.jokerPending;
  die.value = face;
  player.jokersUsed.push(knightId);
  state.jokerPending = null;
  setMessage("Joker used.");
  renderDice();
}

function tradeGold(face) {
  const golds = state.dice.filter((d) => d.value === "GOLD" && !d.spent);
  if (golds.length < CONSTANTS.goldTradeRate) return;
  golds[0].value = face;
  golds[1].spent = true;
  renderDice();
}

function renderDice() {
  const canKeep = state.rollCount > 0 && !state.stopped && !state.rolling &&
    state.rollCount < CONSTANTS.maxRollsPerTurn;
  const box = document.getElementById("dice");
  box.innerHTML = "";
  state.dice.forEach((d, i) => {
    const el = document.createElement("button");
    el.className = "die" + (d.spent ? " spent" : "") + (d.kept ? " kept" : "") + (state.rolling && !d.kept ? " rolling" : "");
    el.textContent = d.value ? DIE_ICONS[d.value] : "?";
    el.title = d.value || "";
    const jokerMode = !!(state.jokerPending && state.jokerPending.face);
    el.disabled = d.spent || !(canKeep || jokerMode);
    el.addEventListener("click", () => {
      if (jokerMode) return useJoker(d);
      d.kept = !d.kept;
      renderDice();
    });
    box.appendChild(el);
  });
  const over = state.stopped || state.rollCount >= CONSTANTS.maxRollsPerTurn;
  document.getElementById("roll-count").textContent = over && state.rollCount > 0
    ? "Rolling finished (" + state.rollCount + " of " + CONSTANTS.maxRollsPerTurn + ")"
    : "Roll " + Math.min(state.rollCount + 1, CONSTANTS.maxRollsPerTurn) + " of " + CONSTANTS.maxRollsPerTurn;
  renderTally(over);
  renderJokers(over);
  const rollBtn = document.getElementById("roll");
  rollBtn.textContent = state.rollCount === 0 ? "Roll" : "Roll Again";
  rollBtn.disabled = over || state.rolling || state.dice.every((d) => d.kept);
  document.getElementById("stop").disabled = state.rollCount === 0 || over || state.rolling;
}

document.getElementById("roll").addEventListener("click", rollDice);
document.getElementById("stop").addEventListener("click", () => { state.stopped = true; renderDice(); });

const HEX_COLORS = { ORE: "#8a8a94", ANY: "#d8c28a", BRICK: "#b0583a", LUMBER: "#3f6b3a", WOOL: "#8fc36a", GRAIN: "#e0b84a" };
const SLOT_ICONS = { road: "", settlement: "\u{1F3E0}", city: "\u{1F3F0}", knight: "\u{1F6E1}\uFE0F" };

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

function renderMap(player) {
  const L = ISLAND_ONE.layout, V = L.vertices, r = L.hexRadius;
  const mark = (state) => (state === "built" ? "\u2713" : "");
  let svg = '<svg viewBox="20 600 960 1000" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1000" height="1700" fill="#4a90c8"/>';
  ISLAND_ONE.hexes.forEach((h) => {
    const [cx, cy] = L.hexCenters[h.id];
    const pts = [0, 60, 120, 180, 240, 300].map((a) =>
      (cx + r * Math.cos(a * Math.PI / 180)).toFixed(0) + "," + (cy + r * Math.sin(a * Math.PI / 180)).toFixed(0)).join(" ");
    svg += '<polygon points="' + pts + '" fill="' + HEX_COLORS[h.resource] + '" stroke="#e8d9a8" stroke-width="10"/>';
    svg += '<text x="' + cx + '" y="' + (cy + 55) + '" font-size="90" text-anchor="middle">' +
      (h.resource === "ANY" ? "?" : DIE_ICONS[h.resource]) + "</text>";
  });
  ISLAND_ONE.buildSlots.forEach((s) => {
    const st = slotState(player, s);
    if (s.type === "road") {
      const [a, b] = s.vertices.map((v) => V[v]);
      svg += '<line class="slot ' + st + '" data-slot="' + s.id + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke-linecap="round"/>';
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
    } else {
      [x, y] = V[s.vertex];
    }
    const w = s.type === "city" ? 120 : 100;
    svg += '<g class="slot ' + st + '" data-slot="' + s.id + '"><rect x="' + (x - w / 2) + '" y="' + (y - 50) + '" width="' + w +
      '" height="100" rx="' + (s.type === "knight" ? 50 : 14) + '"/><text x="' + x + '" y="' + (y + 22) +
      '" font-size="62" text-anchor="middle">' + (mark(st) || s.pointValue) + "</text></g>";
  });
  document.getElementById("map").innerHTML = svg + "</svg>";
}

function setMessage(text) {
  document.getElementById("message").textContent = text;
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
  if (st === "built") return;
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
  setMessage("Built " + slot.type + " for " + slot.pointValue + " point" + (slot.pointValue === 1 ? "" : "s") + ".");
  renderPlay();
}

document.getElementById("map").addEventListener("click", (e) => {
  const el = e.target.closest("[data-slot]");
  if (el) buildSlot(el.dataset.slot);
});

function renderPlay() {
  const done = state.turnNumber > CONSTANTS.turnsPerPlayer;
  const current = state.players[state.currentPlayerIndex];
  document.getElementById("scoreboard").innerHTML = state.players.map((p, i) =>
    '<div class="chip' + (i === state.currentPlayerIndex && !done ? " active" : "") + '">' +
    p.name + "<b>" + p.score + "</b></div>").join("");
  document.getElementById("turn-player").textContent = done ? "Game complete" : current.name + "'s Turn";
  document.getElementById("turn-count").textContent =
    "Turn " + Math.min(state.turnNumber, CONSTANTS.turnsPerPlayer) + " of " + CONSTANTS.turnsPerPlayer;
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
  state.currentPlayerIndex++;
  if (state.currentPlayerIndex >= state.players.length) {
    state.currentPlayerIndex = 0;
    state.turnNumber++;
  }
  if (state.turnNumber > CONSTANTS.turnsPerPlayer) return showScorecard();
  resetDice();
  renderPlay();
});
