# CADAN - Web App MDD

Sep 22, 2026 · Updated Oct 10, 2026 · @Caden

A medieval-themed, single-page HTML/CSS/JavaScript adaptation of a Catan-style roll-and-write dice game, installable as a PWA, built by Claude Code in small sections and deployed via a new GitHub repo with GitHub Pages.

> **Scope change (Oct 10, 2026):** v1 builds **Island One only**. Island Two is deferred (see Section 12). The game is also built **in small, testable sections** (see Section 12, Build Plan), not all at once.

## 1. Overview & Objective

**Working title:** CADAN

**Elevator pitch:** A "roll-and-write" dice game for 1–6 players, sharing one device pass-and-play style. Each player has their own personal island map and scoring track. On a turn, the player rolls six resource dice (keeping any results they like across up to 3 rolls), then spends the resources they've collected to build roads, settlements, cities, and knights on their own map. After every player has taken exactly 15 turns, the highest score wins.

**Origin & theming:** CADAN is a personal adaptation of the *Catan Dice Game*'s mechanics (rules and reference board layouts provided by the user, see Section 2). The app uses **original medieval-themed artwork, icons, and copy throughout** rather than any Catan-branded assets, names, or trademarked art. It borrows the game mechanics, not the branding. "CADAN" replaces "Catan" as the product name everywhere in the UI.

**Primary objective (build):** Ship a single, self-contained web app (HTML/CSS/JS, no backend, no build tooling) that Claude Code generates **one small section at a time**, committing to a new GitHub repo after each section and deploying via GitHub Pages. The app must be installable as a PWA so it works offline once installed on a phone or tablet.

**Target platform:** Mobile-first responsive web, played pass-and-play on one shared device; also usable on desktop/laptop browsers.

**Out of scope for v1:** Island Two, accounts, networked multiplayer (separate devices), backend/database, native app store builds.

## 2. Source Material & Rules Reference

Two scanned reference documents were provided and are the **canonical source for exact numbers and layout**:

1. **Board scans:** the personal player map/scoring sheet. **Only the "Island One" (green) board is used in v1.** It shows the hex layout, the resource icon and dice-style number on each hex, and the point values printed at each road and building slot around the island.
2. **Rulebook scans:** the full rules booklet, covering the basics, Island One rules, building costs, resource jokers, gold trading, and end-of-game rules. (Island Two pages are kept in `reference/` for later but are not built now.)

**Important build note:** the exact per-hex resource types and the exact point values printed at each road/settlement/city/knight slot on Island One must be **transcribed directly from the board scan**, not guessed or approximated. Section 8 (Data Model) defines the *shape* the board data should take; Claude Code fills in the real coordinates/values by reading them off the reference image. If any number or symbol on the scan is unclear/ambiguous, flag it rather than guessing, and have the user confirm the transcription before building game logic on top of it (Build Plan, Section 1).

Section 3 summarizes the rules in plain language for quick reference while building, but the scanned rulebook remains the source of truth for any edge case not covered here.

## 3. Core Rules Summary (Island One)

**Dice:** 6 resource dice are rolled. Each die has 6 faces, one per resource: Brick, Lumber, Wool, Grain, Ore, and Gold.

**Turn structure (roll, keep, build):**

1. Roll all 6 dice.
2. Set aside any dice showing results you want to keep; roll the remaining dice again.
3. You get up to 3 rolls total per turn. After each roll you may set aside any number of dice (including none) and re-roll only the rest.
4. After your final roll (or once you choose to stop early), use the resources shown across all your set-aside + final dice to build.
5. If you build nothing on your turn, you must mark an "X" on your scoring track, worth **-2 points**.

**Building costs (fixed):**

| Structure | Cost |
| --- | --- |
| Road | 1 Brick + 1 Lumber |
| Settlement | 1 Lumber + 1 Brick + 1 Grain + 1 Wool |
| City | 3 Ore + 2 Grain |
| Knight | 1 Grain + 1 Wool + 1 Ore |

**Ascending build order:** On your personal map, roads/settlements/cities/knights each have several build slots with increasing point values. You must build each structure type in **strict ascending point order**. For example, you must build your lower-value settlement before a higher-value one becomes available, and likewise for roads, cities, and knights. The very first road on the map is pre-built for free (the "starting road").

**Scoring a build:** Building a structure on a slot credits you the point value printed at that slot. Building multiple times in one turn adds up the points from every slot you filled that turn.

**Resource Joker (from Knights):** Every knight you build has a resource icon printed beneath its slot. Once per game, for each knight you've built, you may use that knight's resource as a wildcard: turn one already-rolled die to show that resource face-up (as if you'd rolled it) to help meet a build cost, then mark that knight's joker as used for the rest of the game.

**Gold Trade (2:1):** After your final roll, any Gold results can be traded 2-for-1 toward any other resource of your choice (turn one gold die to show the traded-for resource; the other gold die used in the trade is set aside and can't be reused this turn). This can be repeated multiple times in a turn if you have enough Gold.

**End of game:** The game ends after every player has completed exactly **15 turns**. Sum each player's recorded points (subtracting 2 per "X"); the highest total wins. Ties are shown as ties.

## 4. Core Gameplay Loop / App Flow

1. **Main Menu:** PLAY, How to Play, Leaderboards, Sound On/Off toggle.
2. **Player Setup:** Choose number of players, 1–6, with optional per-player names. "Start Game" begins Player 1's first turn. (There is no island select screen in v1; the game always uses Island One.)
3. **Play Screen (repeats each turn):**
   - The active player's own personal island map, scoring track, and resource tray are shown.
   - Player taps "Roll": all un-kept dice animate and land on results.
   - Player taps individual dice to "keep" them (locking that result aside) or leaves them to be re-rolled; player taps "Roll Again" to re-roll only the un-kept dice (up to 3 rolls total per turn), or taps "Stop Rolling" to move straight to building.
   - Player taps available build slots on their map (those they can currently afford and that are next in ascending order) to construct them, spending the matching resources; resource jokers and gold trades are available as build-time options.
   - Player taps "End Turn" to lock in this turn's points (or mark an "X" if nothing was built) and pass to the next player.
4. **End conditions:**
   - **Automatic:** after every player's 15th turn.
   - **Manual:** an "End Game" button is always available for the host to end the game early.
5. **Scorecard:** Final standings for all players, winner highlighted, with an option to save the result to the Leaderboards, plus "Play Again" and "Back to Menu".
6. **Leaderboards (from Main Menu):** Browsable list of past game results (player name, score, date), viewable without starting a new game.

## 5. Screens & UI

**Medieval theme (applies throughout):** parchment/aged-paper backgrounds, a serif/blackletter-inspired display font for headings (with a highly legible body font for numbers/readability), a palette of deep reds, forest greens, aged gold, and stone gray, wax-seal or banner-style buttons, and original iconography for resources (brick as a castle-stone block, lumber as a timber log, wool as a sheep/fleece, grain as a wheat sheaf, ore as a raw ore chunk, gold as a coin), all drawn fresh rather than reusing Catan's artwork. Knights are illustrated as medieval knight figures; roads as cobblestone paths; settlements/cities as village/castle icons.

**A. Main Menu**
- CADAN title/crest, "PLAY" primary button, "How to Play", "Leaderboards", and a sound on/off toggle icon.

**B. How to Play**
- Plain-language rules covering dice/rolling, build order, resource jokers, gold trade, and the 15-turn win condition. "Back" button.

**C. Leaderboards**
- List of saved past results (name, score, date), newest first; "Back" button.

**D. Player Setup**
- Number stepper for player count (1–6), optional name field per player, "Start Game" button.

**E. Play Screen (core screen)**
- Active player's name/turn indicator, prominent, plus a "Turn X of 15" counter.
- Dice tray: 6 dice rendered visually with resource icons, each individually tappable to "keep"/"unkeep" between rolls, with a roll animation on each roll; a roll counter ("Roll 1 of 3", etc.).
- The active player's personal Island One map, showing which slots are already built (checked off), which are currently buildable (highlighted), and which are locked (grayed out, per ascending-order rules).
- Running resource tally (current dice results + kept resources) and current score clearly visible, including the scoring track with any "X" marks.
- "Roll Again", "Stop Rolling", buildable-slot taps, and "End Turn" as the core actions.
- A compact scoreboard strip showing every player's current score, active player highlighted.

**F. Scorecard (end of game)**
- All players ranked by final score, winner highlighted, "Save to Leaderboard", "Play Again", and "Back to Menu" buttons.

Layout must work in portrait and landscape; the personal map and dice tray are the most information-dense elements and must stay legible and tappable on a phone screen.

## 6. Technical Architecture

- **Stack:** Plain HTML5 + CSS3 + vanilla JavaScript. No framework, no bundler, no npm build step. Deployable files are the built files.
- **Rendering:** Single-page app with JS-driven screen switching (show/hide `<section>`s or a small state machine), with no reload flicker mid-game.
- **Pass-and-play model:** One device is shared; the app tracks whose turn it is and shows that player's own board/resources/score. No networking, no separate device sync.
- **State management:** An in-memory JS object holds: player list (name, score, per-player board state: which slots are built, which knight jokers are used, X count), current player index, current turn number (for the 15-turn cap), current dice values + kept/unkept state, roll count this turn, and sound-on/off setting. No backend, no database.
- **Persistence:** `localStorage` stores completed game results for the Leaderboards screen, and the sound on/off preference, across sessions. Optionally remembers last-used player names/count.
- **Sound handling:** Short sound effects (dice roll, build/construct, turn end, game win) played via `<audio>` or Web Audio API, gated by the sound toggle (available both on the Main Menu and during gameplay), cached by the service worker for offline play.
- **PWA support (v1 requirement):**
  - `manifest.json` (name "CADAN", short_name, icons at 192px/512px, `start_url`, `display: standalone`, medieval color theme) so it's installable to a home screen.
  - A service worker (`service-worker.js`) registered from `index.html` that caches the app shell (HTML/CSS/JS/board data/sounds/icons) on install and serves from cache first, so the game works offline once installed/visited.
  - Must pass basic installability checks (served over HTTPS, valid manifest, registered service worker) so browsers show an install/"Add to Home Screen" prompt.
- **Responsiveness:** CSS flexbox/grid, relative units, touch-friendly hit targets (min ~48px), with special attention to the density of the personal map and dice tray on small screens.
- **Browser support target:** Latest 2 versions of Chrome, Safari (iOS), Firefox, Edge.

## 7. Data Model

**Game constants:**

```json
{
  "dieFaces": ["BRICK", "LUMBER", "WOOL", "GRAIN", "ORE", "GOLD"],
  "buildCosts": {
    "road": {"brick": 1, "lumber": 1},
    "settlement": {"lumber": 1, "brick": 1, "grain": 1, "wool": 1},
    "city": {"ore": 3, "grain": 2},
    "knight": {"grain": 1, "wool": 1, "ore": 1}
  },
  "goldTradeRate": 2,
  "maxRollsPerTurn": 3,
  "turnsPerPlayer": 15,
  "xPenalty": -2
}
```

**Board layout (Island One)**: shape only; real values come from the reference scan (Section 2):

```json
{
  "islandId": "island-one",
  "hexes": [
    {"id": "hex-1", "resource": "ORE", "diceNumber": 1}
    // ...one entry per hex, transcribed from the scan
  ],
  "buildSlots": [
    {"id": "road-1", "type": "road", "pointValue": 1, "order": 1, "free": true},
    {"id": "settlement-1", "type": "settlement", "pointValue": 3, "order": 1},
    {"id": "city-1", "type": "city", "pointValue": 7, "order": 1},
    {"id": "knight-1", "type": "knight", "pointValue": 1, "order": 1, "jokerResource": "ORE"}
    // ...one entry per buildable slot, transcribed from the scan, in ascending order per type
  ],
  "winCondition": {"mode": "turnLimit", "turns": 15}
}
```

**Runtime player state** (in-memory):

```json
{
  "players": [
    {
      "id": "p1",
      "name": "Alex",
      "score": 0,
      "xCount": 0,
      "builtSlotIds": ["road-1"],
      "jokersUsed": [],
      "turnsTaken": 0
    }
  ],
  "currentPlayerIndex": 0,
  "turnNumber": 1,
  "dice": [{"value": "BRICK", "kept": false}],
  "rollCount": 0,
  "soundOn": true
}
```

**Rules encoded in data, not code:** the Island One board layout (hexes + build slots + point values) and the fixed build costs, so a transcription fix or a future second island is a data edit, not a logic change. Turn structure, ascending-order enforcement, joker/gold-trade mechanics, and the end-of-game check are game logic.

## 8. File Structure & Repo Layout

```
cadan/
├── index.html          # markup + screen containers, registers the service worker
├── style.css           # medieval theme styling, responsive rules, dice/board animations
├── script.js           # game logic: turn structure, build-order rules, scoring, end of game
├── manifest.json       # PWA manifest (name: CADAN, icons, start_url, display: standalone)
├── service-worker.js   # caches the app shell for offline/installed use
├── data/
│   ├── island-one.js   # island one hex + build-slot data (transcribed from the scan)
│   └── constants.js    # dieFaces, buildCosts, goldTradeRate, turn limits
├── sounds/
│   ├── roll.mp3
│   ├── build.mp3
│   ├── turn-end.mp3
│   └── win.mp3
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── reference/
│   └── (the original rulebook/board scans, kept for future edits/verification)
└── README.md           # how to run locally + how to adjust board data or rules
```

Plain relative paths only so the same files work identically opened locally as `file://index.html` or served from the repo's Pages URL. Board data, constants, logic, and styling stay in separate files so fixing a transcription error or rebalancing a cost never requires touching unrelated code. Files are added as the build plan reaches them (for example, `service-worker.js` does not exist until the PWA section).

## 9. Deployment

1. **Create the repo:** A new GitHub repository (e.g. `cadan`) is created for this project, public so GitHub Pages can serve it for free.
2. **Build in sections:** Claude Code builds one section of the Build Plan (Section 12) at a time. No compilation step.
3. **Commit after every section:** Each completed section is committed and pushed (e.g. `git add .`, `git commit -m "Section 4: dice rolling"`, `git push`) so there is always a working, deployed version to fall back on.
4. **Enable Pages:** GitHub Pages is turned on for the repo (serving from `main` branch root, or a `/docs` folder), giving a public URL like `https://<username>.github.io/cadan/`. This happens in the first section so every later section can be tested live.
5. **PWA requirement:** GitHub Pages serves over HTTPS automatically, which is required for the service worker and install prompt to work, with no extra config needed.
6. **No environment variables or secrets** are needed since there's no backend or API calls.

## 10. Acceptance Criteria (v1, Island One)

- [ ] App is live at a public GitHub Pages URL and loads on mobile and desktop browsers, no login.
- [ ] App is installable as a PWA (manifest + service worker pass installability checks) and its shell loads offline once installed.
- [ ] Main Menu offers Play, How to Play, Leaderboards, and a sound toggle that persists between sessions.
- [ ] Play always uses the Island One board and rules (no island select).
- [ ] Player setup accepts 1–6 players with optional names.
- [ ] Six dice roll, individual dice can be kept/unkept between rolls, and a player gets no more than 3 rolls per turn.
- [ ] Island One hex and slot data matches the board scan exactly (confirmed by the user).
- [ ] Build slots enforce strict ascending point order per structure type; the starting road is pre-built.
- [ ] Building a slot deducts the correct resources, credits the correct points, and marks the slot built on that player's own map.
- [ ] A turn with no build correctly applies the -2 "X" penalty.
- [ ] Resource jokers can be used once per built knight, and gold can be traded 2:1, both at build time.
- [ ] The game ends automatically after every player's 15th turn and totals scores correctly, including X penalties.
- [ ] "End Game" button ends the game early at any time and shows the scorecard with current standings.
- [ ] Completed games can be saved to and browsed from the Leaderboards screen.
- [ ] Sound effects (menu and in-game) respect the sound on/off toggle.
- [ ] Medieval theme (typography, iconography, palette) is applied consistently and uses no Catan-branded assets.
- [ ] Works over touch and mouse input; layout holds up in portrait and landscape.

## 11. Working Agreement for Claude Code

- Build **one section at a time** from the plan below. Do not start the next section until the current one is working and the user has tried it.
- At the start of each section, state what will be built and what the user should be able to test when it is done.
- Keep each section's changes small and scoped to the files it needs.
- Commit and push at the end of every section.
- Island One only. Do not add Island Two code, data, screens, or settings.
- If a board number or rule is unclear, stop and ask instead of guessing.

## 12. Build Plan (Small Sections)

Each section is independently testable and ends with a commit.

| # | Section | What gets built | How the user tests it |
| --- | --- | --- | --- |
| 1 | Repo & skeleton | New `cadan` repo, `index.html`, `style.css`, `script.js`, a "CADAN" placeholder page, GitHub Pages turned on | Open the live Pages URL and see the placeholder |
| 2 | Constants & Island One data | `data/constants.js` and `data/island-one.js`, transcribed from the board scan; a simple temporary view that lists every hex and slot | Compare the list against the scan; user confirms or corrects it |
| 3 | Screens & navigation | Main Menu, How to Play, Leaderboards (empty), Player Setup, with screen switching | Tap through every screen and back |
| 4 | Medieval theme base | Fonts, parchment background, palette, banner/wax-seal buttons applied to existing screens | Screens look consistently medieval on phone and desktop |
| 5 | Game state & turn shell | State object, player creation from setup, turn/player indicator, "Turn X of 15", scoreboard strip, End Turn passes to the next player (no dice yet) | Start a game and pass turns around the table |
| 6 | Dice rolling | Six dice, roll animation, tap to keep/unkeep, Roll Again, Stop Rolling, 3-roll limit, roll counter | Roll, keep, re-roll, and confirm the limit of 3 |
| 7 | Resource tally & gold trade | Live resource tally from dice, 2:1 gold trade | Roll gold and trade it; tally updates correctly |
| 8 | Personal map (display only) | Render the Island One map with hexes and slots; built / buildable / locked visual states | Map is legible and tappable-sized on a phone |
| 9 | Building & scoring | Tap a slot to build, cost check and deduction, strict ascending order, starting road pre-built, points added | Build a road, settlement, city, and knight; out-of-order slots stay locked |
| 10 | Knight jokers | Joker resource per knight, once-per-game use, marked as used | Build a knight and use its joker once only |
| 11 | Turn end, X penalty & game end | -2 "X" on an empty turn, 15-turn end for all players, End Game button, Scorecard with winner and ties | Play a full short game to the Scorecard |
| 12 | Leaderboards & saved settings | Save results to `localStorage`, browse them, remember names/count | Save a game, reload the page, see it listed |
| 13 | Sound | Sound effects for roll, build, turn end, win; persistent sound toggle on menu and in game | Toggle sound and confirm effects follow it |
| 14 | PWA | `manifest.json`, icons, `service-worker.js`, offline caching | Install to home screen and play offline |
| 15 | Polish & QA | Original resource/knight/castle art, portrait and landscape checks, full run against the Acceptance Criteria | Every box in Section 10 is checked |

Sections 1–3 can be done in one sitting; later sections should each be their own session or conversation with Claude Code.

## 13. Future Enhancements (Out of Scope for v1)

- **Island Two:** the red board with escalating dice counts (3 → 4 → 5 → 6), standard victory points (Settlement = 1 VP, City = 2 VP), Longest Road and Largest Army bonuses (+2 VP each), a relaxed build order among available sites, and an instant win at 10 VP. Rules and board scan are kept in `reference/` for when this is picked up. Adding it would mean a new `data/island-two.js`, an Island Select screen, and an island-aware win-condition check.
- Additional islands/boards beyond the two scanned reference layouts.
- Haptic feedback on build/win events, in addition to sound.
- Networked multiplayer across separate devices.
- Turn history/log so players can review a completed game's build order.
- Difficulty or house-rule variants (e.g. adjustable turn limit) as settings.
- Light/dark theme toggle alongside the medieval theme.
- Animated hex-by-hex build placement effects for extra flair.
