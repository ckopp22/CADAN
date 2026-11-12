// Bot opponent. It plays through the same roll/build functions as a human, so the rules stay in one place.
let botToken = 0; // bumped to cancel a bot turn in progress (leaving the game screen)
const botSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BOT_RESOURCES = ["BRICK", "LUMBER", "WOOL", "GRAIN", "ORE"];
const BOT_SAMPLES = { easy: 0, medium: 10, hard: 30 };

const botCounts = (vals) => {
  const c = {};
  CONSTANTS.dieFaces.forEach((f) => { c[f] = 0; });
  vals.forEach((v) => { c[v]++; });
  return c;
};

// Slots buildable given a list of built slot ids (same rules as slotState, but fast for simulation)
function botBuildable(built) {
  const slots = ISLAND_ONE.buildSlots, out = [], verts = new Set(), next = {};
  slots.forEach((s) => {
    if (built.includes(s.id)) { if (s.type === "road") s.vertices.forEach((v) => verts.add(v)); return; }
    if (s.type !== "road" && (!next[s.type] || s.order < next[s.type].order)) next[s.type] = s;
  });
  slots.forEach((s) => {
    if (s.type === "road" && !built.includes(s.id) && s.vertices.some((v) => verts.has(v))) out.push(s);
  });
  ["settlement", "city"].forEach((t) => { if (next[t] && verts.has(next[t].vertex)) out.push(next[t]); });
  if (next.knight) out.push(next.knight);
  return out;
}

// Pay for a cost from dice counts, trading 2 gold per missing resource if allowed. Returns null if unaffordable.
function botAfford(c, cost, useGold) {
  const next = Object.assign({}, c), trades = [];
  for (const r in cost) {
    const f = r.toUpperCase(), d = cost[r] - next[f];
    if (d > 0) {
      if (!useGold || next.GOLD < 2 * d) return null;
      next.GOLD -= 2 * d;
      next[f] += d;
      for (let i = 0; i < d; i++) trades.push(f);
    }
    next[f] -= cost[r];
  }
  return { next, trades };
}

// Highest-scoring sequence of builds from these dice
function botBestPlan(built, c, useGold) {
  let best = { points: 0, steps: [] };
  const seen = new Set();
  (function dfs(b, cnt, points, steps) {
    if (points > best.points) best = { points, steps };
    botBuildable(b).forEach((slot) => {
      const a = botAfford(cnt, CONSTANTS.buildCosts[slot.type], useGold);
      if (!a) return;
      const nb = b.concat(slot.id), key = nb.slice().sort().join();
      if (seen.has(key)) return;
      seen.add(key);
      dfs(nb, a.next, points + slot.pointValue, steps.concat({ slot, trades: a.trades }));
    });
  })(built, c, 0, []);
  return best;
}

// How close the dice are to an unfinished build (used while rerolls remain)
function botPartial(built, c) {
  let best = 0;
  botBuildable(built).forEach((s) => {
    const cost = CONSTANTS.buildCosts[s.type];
    let have = 0, total = 0;
    for (const r in cost) { total += cost[r]; have += Math.min(c[r.toUpperCase()], cost[r]); }
    have = Math.min(total, have + Math.floor(c.GOLD / 2));
    if (have < total) best = Math.max(best, s.pointValue * Math.pow(have / total, 2));
  });
  return best;
}

// Medium/Hard: try each set of dice to keep, simulate the reroll, keep the set with the best average
function botChooseKeeps(vals, built, rerolls, samples) {
  const score = (v) => {
    const c = botCounts(v);
    return botBestPlan(built, c, true).points + (rerolls > 1 ? 0.5 * botPartial(built, c) : 0);
  };
  const seen = new Set();
  let bestMask = 63, bestScore = -1;
  for (let m = 0; m < 64; m++) {
    const kept = vals.filter((_, i) => m & (1 << i));
    const key = kept.slice().sort().join();
    if (seen.has(key)) continue;
    seen.add(key);
    let total = 0;
    if (kept.length === 6) total = botBestPlan(built, botCounts(kept), true).points;
    else {
      for (let s = 0; s < samples; s++) {
        const roll = kept.slice();
        while (roll.length < 6) roll.push(randomFace());
        total += score(roll);
      }
      total /= samples;
    }
    if (total > bestScore) { bestScore = total; bestMask = m; }
  }
  return vals.map((_, i) => !!(bestMask & (1 << i)));
}

// Easy: aim at a random buildable piece, sometimes drop a needed die, sometimes stop early
function botRandomPlan(built, c) {
  const steps = [];
  let b = built, cnt = c;
  for (;;) {
    const opts = botBuildable(b).map((slot) => ({ slot, a: botAfford(cnt, CONSTANTS.buildCosts[slot.type], false) })).filter((o) => o.a);
    if (!opts.length) return steps;
    const o = opts[Math.floor(Math.random() * opts.length)];
    steps.push({ slot: o.slot, trades: [] });
    b = b.concat(o.slot.id);
    cnt = o.a.next;
  }
}

function botEasyKeeps(vals, built) {
  if (botRandomPlan(built, botCounts(vals)).length && Math.random() < 0.5) return vals.map(() => true);
  const opts = botBuildable(built);
  const need = Object.assign({}, CONSTANTS.buildCosts[opts[Math.floor(Math.random() * opts.length)].type]);
  return vals.map((v) => {
    const k = v.toLowerCase();
    if (need[k] > 0 && Math.random() < 0.8) { need[k]--; return true; }
    return false;
  });
}

// Hard: spend a knight joker when it lifts this turn's score by 3 or more
async function botJokers(player, alive) {
  for (;;) {
    const c = countDice(), base = botBestPlan(player.builtSlotIds, c, true).points;
    let best = null;
    ISLAND_ONE.buildSlots.filter((s) => s.type === "knight" && player.builtSlotIds.includes(s.id) && !player.jokersUsed.includes(s.id)).forEach((k) => {
      (k.jokerResource === "ANY" ? BOT_RESOURCES : [k.jokerResource]).forEach((face) => {
        CONSTANTS.dieFaces.forEach((v) => {
          if (v === face || c[v] < 1) return;
          const c2 = Object.assign({}, c);
          c2[v]--; c2[face]++;
          const gain = botBestPlan(player.builtSlotIds, c2, true).points - base;
          if (gain >= 3 && (!best || gain > best.gain)) best = { knight: k, face, v, gain };
        });
      });
    });
    if (!best) return;
    state.jokerPending = { knightId: best.knight.id, face: best.face };
    useJoker(state.dice.find((d) => !d.spent && d.value === best.v));
    await botSleep(800);
    if (!alive()) return;
  }
}

async function botTurn(token) {
  const alive = () => token === botToken;
  const player = state.players[state.currentPlayerIndex];
  const diff = player.difficulty;
  await botSleep(900);
  while (alive() && state.rollCount < CONSTANTS.maxRollsPerTurn && !state.stopped) {
    rollDice();
    while (state.rolling && alive()) await botSleep(100);
    if (!alive()) return;
    await botSleep(500);
    if (state.rollCount >= CONSTANTS.maxRollsPerTurn) break;
    const vals = state.dice.map((d) => d.value);
    const keep = diff === "easy" ? botEasyKeeps(vals, player.builtSlotIds)
      : botChooseKeeps(vals, player.builtSlotIds, CONSTANTS.maxRollsPerTurn - state.rollCount, BOT_SAMPLES[diff]);
    state.dice.forEach((d, i) => { d.kept = keep[i]; });
    if (keep.every(Boolean)) state.stopped = true;
    renderDice();
    if (state.stopped) break;
    await botSleep(700);
    if (!alive()) return;
  }
  if (!alive()) return;
  if (diff === "hard") { await botJokers(player, alive); if (!alive()) return; }
  const steps = diff === "easy" ? botRandomPlan(player.builtSlotIds, countDice()) : botBestPlan(player.builtSlotIds, countDice(), true).steps;
  for (const step of steps) {
    for (const face of step.trades) {
      tradeGold(face);
      await botSleep(500);
      if (!alive()) return;
    }
    buildSlot(step.slot.id);
    await botSleep(900);
    if (!alive()) return;
  }
  await botSleep(600);
  if (alive()) document.getElementById("end-turn").click();
}

// Called whenever a turn begins: locks the board during the bot's turn and starts it
function maybeBotTurn() {
  const p = state.players[state.currentPlayerIndex];
  const on = !!(p && p.isBot && state.turnNumber <= CONSTANTS.turnsPerPlayer);
  document.getElementById("play").classList.toggle("bot-turn", on || (!!online && state.currentPlayerIndex !== online.me));
  if (on) botTurn(++botToken);
}

const makePlayer = (id, name, extra) => Object.assign({ id, name, score: 0, xCount: 0, builtSlotIds: ["road-1"], jokersUsed: [], turnsTaken: 0 }, extra);

document.querySelectorAll("[data-diff]").forEach((b) => b.addEventListener("click", () => {
  const d = b.dataset.diff;
  state.players = [makePlayer("p1", "You"), makePlayer("p2", "Bot (" + d[0].toUpperCase() + d.slice(1) + ")", { isBot: true, difficulty: d })];
  state.currentPlayerIndex = 0;
  state.turnNumber = 1;
  resetDice();
  renderPlay();
  showScreen("play");
  maybeBotTurn();
}));
