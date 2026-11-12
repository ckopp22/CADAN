// Online play vs a friend over PeerJS (WebRTC). The player whose turn it is sends a snapshot of the game after every change;
// the other device just displays it, so there is no rules logic on the network side.
let online = null; // { peer, conn, me, name, started, applying, sentRolling }
const NET_PREFIX = "cadan-";
const NET_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const netEl = (id) => document.getElementById(id);

function netClose() {
  const o = online;
  online = null;
  netEl("play").classList.remove("bot-turn");
  if (!o) return;
  clearTimeout(o.timer);
  try { if (o.conn) o.conn.close(); if (o.peer) o.peer.destroy(); } catch (e) { /* already closed */ }
}

function netFail(msg) {
  netClose();
  showToast(msg);
  showScreen("friend");
}

function netSend() {
  if (!online || !online.conn || !online.conn.open) return;
  const s = {};
  ["players", "currentPlayerIndex", "turnNumber", "dice", "rollCount", "stopped", "rolling", "spent", "builtThisTurn", "jackpot"].forEach((k) => { s[k] = state[k]; });
  online.conn.send({ t: "state", s: JSON.parse(JSON.stringify(s)) });
}

// Called after every dice render: send only while it is my turn, and only once per roll animation
function netSync() {
  if (!online || online.applying || !online.started || state.currentPlayerIndex !== online.me) return;
  if (state.rolling) {
    if (online.sentRolling) return;
    online.sentRolling = true;
  } else online.sentRolling = false;
  netSend();
}

function netApply(s) {
  if (!online) return;
  online.applying = true;
  const before = state.players[s.currentPlayerIndex];
  const builtBefore = before ? before.builtSlotIds.length : 0;
  const wasRolling = state.rolling, oldTurn = state.turnNumber, oldIdx = state.currentPlayerIndex;
  Object.assign(state, s, { jokerPending: null, goldPending: false });
  online.started = true;
  if (state.turnNumber > CONSTANTS.turnsPerPlayer) showScorecard();
  else {
    if (state.turnNumber !== oldTurn || state.currentPlayerIndex !== oldIdx) { waveNext = true; playSound("turnEnd"); }
    else if (state.rolling && !wasRolling) playSound("roll");
    else if (state.players[state.currentPlayerIndex].builtSlotIds.length > builtBefore) playSound("build");
    renderPlay();
    showScreen("play");
    maybeBotTurn();
  }
  online.applying = false;
}

function netData(m) {
  if (!online) return;
  if (m.t === "hello" && online.me === 0 && !online.started) {
    state.players = [makePlayer("p1", online.name), makePlayer("p2", m.name)];
    state.currentPlayerIndex = 0;
    state.turnNumber = 1;
    resetDice();
    online.started = true;
    renderPlay();
    showScreen("play");
    maybeBotTurn();
    netSend();
  } else if (m.t === "state") netApply(m.s);
  else if (m.t === "end") showScorecard();
}

function netSetupConn(conn) {
  conn.on("data", netData);
  const gone = () => {
    if (!online || online.conn !== conn) return;
    const playing = netEl("play").classList.contains("active");
    netClose();
    if (playing) { showToast("Friend disconnected"); showScreen("menu"); }
  };
  conn.on("close", gone);
  conn.on("error", gone);
}

function netName(fallback) {
  const v = netEl("net-name").value.trim();
  saveJSON("cadan-net-name", v);
  return v || fallback;
}

function netHost() {
  netClose();
  const name = netName("Player 1");
  let tries = 0;
  const attempt = () => {
    let code = "";
    for (let i = 0; i < 4; i++) code += NET_LETTERS[Math.floor(Math.random() * NET_LETTERS.length)];
    let peer;
    try { peer = new Peer(NET_PREFIX + code); } catch (e) { return netFail("Online play unavailable"); }
    online = { peer, conn: null, me: 0, name, started: false };
    peer.on("open", () => { netEl("lobby-code").textContent = code; showScreen("lobby"); });
    peer.on("error", (e) => {
      if (online && online.peer !== peer) return;
      if (e.type === "unavailable-id" && tries++ < 5) { online = null; peer.destroy(); attempt(); }
      else netFail("Could not create a room");
    });
    peer.on("connection", (conn) => {
      if (!online || online.conn) { conn.on("open", () => conn.close()); return; }
      online.conn = conn;
      netSetupConn(conn);
    });
  };
  attempt();
}

function netJoin() {
  const code = netEl("room-code").value.trim().toUpperCase();
  if (code.length !== 4) return showToast("Enter the 4-letter code");
  netClose();
  const name = netName("Player 2");
  let peer;
  try { peer = new Peer(); } catch (e) { return showToast("Online play unavailable"); }
  online = { peer, conn: null, me: 1, name, started: false };
  showToast("Connecting...");
  online.timer = setTimeout(() => { if (online && online.peer === peer && !online.started) netFail("Room not found"); }, 12000);
  peer.on("error", (e) => { if (online && online.peer === peer) netFail(e.type === "peer-unavailable" ? "Room not found" : "Could not connect"); });
  peer.on("open", () => {
    const conn = peer.connect(NET_PREFIX + code, { reliable: true });
    online.conn = conn;
    netSetupConn(conn);
    conn.on("open", () => conn.send({ t: "hello", name }));
  });
}

netEl("create-room").addEventListener("click", netHost);
netEl("join-room").addEventListener("click", netJoin);
netEl("room-code").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ""); });
try { netEl("net-name").value = loadJSON("cadan-net-name", ""); } catch (e) { /* ignore */ }
