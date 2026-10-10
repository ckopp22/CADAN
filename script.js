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
      s.id + ": " + s.pointValue + " pts" + (s.free ? " (free)" : "") +
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
