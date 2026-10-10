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
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
}
document.querySelectorAll("[data-go]").forEach((b) =>
  b.addEventListener("click", () => showScreen(b.dataset.go)));

// Player setup: 1-6 players with optional names
(function () {
  const names = document.getElementById("names");
  const count = document.getElementById("count");
  let n = 1;
  function render() {
    count.textContent = n;
    const old = Array.from(names.querySelectorAll("input")).map((i) => i.value);
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
  dice: [], rollCount: 0, stopped: false, rolling: false };

const DIE_ICONS = { BRICK: "\u{1F9F1}", LUMBER: "\u{1FAB5}", WOOL: "\u{1F411}", GRAIN: "\u{1F33E}", ORE: "\u{1FAA8}", GOLD: "\u{1FA99}" };

function resetDice() {
  state.dice = CONSTANTS.dieFaces.map(() => ({ value: null, kept: false }));
  state.rollCount = 0;
  state.stopped = false;
  state.rolling = false;
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

function renderDice() {
  const canKeep = state.rollCount > 0 && !state.stopped && !state.rolling &&
    state.rollCount < CONSTANTS.maxRollsPerTurn;
  const box = document.getElementById("dice");
  box.innerHTML = "";
  state.dice.forEach((d, i) => {
    const el = document.createElement("button");
    el.className = "die" + (d.kept ? " kept" : "") + (state.rolling && !d.kept ? " rolling" : "");
    el.textContent = d.value ? DIE_ICONS[d.value] : "?";
    el.title = d.value || "";
    el.disabled = !canKeep;
    el.addEventListener("click", () => { d.kept = !d.kept; renderDice(); });
    box.appendChild(el);
  });
  const over = state.stopped || state.rollCount >= CONSTANTS.maxRollsPerTurn;
  document.getElementById("roll-count").textContent = over && state.rollCount > 0
    ? "Rolling finished (" + state.rollCount + " of " + CONSTANTS.maxRollsPerTurn + ")"
    : "Roll " + Math.min(state.rollCount + 1, CONSTANTS.maxRollsPerTurn) + " of " + CONSTANTS.maxRollsPerTurn;
  const rollBtn = document.getElementById("roll");
  rollBtn.textContent = state.rollCount === 0 ? "Roll" : "Roll Again";
  rollBtn.disabled = over || state.rolling || state.dice.every((d) => d.kept);
  document.getElementById("stop").disabled = state.rollCount === 0 || over || state.rolling;
}

document.getElementById("roll").addEventListener("click", rollDice);
document.getElementById("stop").addEventListener("click", () => { state.stopped = true; renderDice(); });

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
  renderDice();
}

document.getElementById("start").addEventListener("click", () => {
  const inputs = document.querySelectorAll("#names input");
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

document.getElementById("end-turn").addEventListener("click", () => {
  state.players[state.currentPlayerIndex].turnsTaken++;
  state.currentPlayerIndex++;
  if (state.currentPlayerIndex >= state.players.length) {
    state.currentPlayerIndex = 0;
    state.turnNumber++;
  }
  resetDice();
  renderPlay();
});
