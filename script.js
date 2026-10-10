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
const state = { players: [], currentPlayerIndex: 0, turnNumber: 1, soundOn: true };

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
  renderPlay();
});
