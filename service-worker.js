const CACHE = "cadan-v109";
const SHELL = [
  "./", "index.html", "style.css", "script.js", "manifest.json",
  "sounds/dice-shake.mp3", "sounds/build.mp3", "ui/bg_parchment_tile.png", "ui/scroll_banner.png", "ui/panel_parchment.png", "ui/menu_bg.jpg", "ui/divider.png", "ui/dice_tap_to_roll.webp", "ui/dice_tap_poster.webp", "ui/dice_roll.webp", "ui/btn_royal_normal.png", "ui/btn_royal_hover.png", "ui/btn_royal_pressed.png", "ui/btn_royal_disabled.png", "ui/seal_red_sword_normal.png", "ui/seal_red_sword_hover.png", "ui/seal_red_sword_pressed.png", "sounds/knight.mp3", "sounds/fanfare.mp3", "sounds/trade.mp3", "sounds/select.mp3", "sounds/deny.mp3", "sounds/nope.mp3", "sounds/scoreboard.mp3", "sounds/whistler.mp3", "sounds/medieval_whistle_loop.mp3", "sounds/gameplay_1_tavern_jig.mp3", "sounds/end-turn.mp3", "data/constants.js", "data/island-one.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
  "icons/res-brick.png", "icons/res-lumber.png", "icons/res-wool.png", "icons/res-grain.png",
  "icons/res-ore.png", "icons/res-gold.png", "icons/res-any.png",
  "icons/tile-brick.png", "icons/tile-lumber.png", "icons/tile-wool.png", "icons/tile-grain.png",
  "icons/tile-ore.png", "icons/tile-any.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache first; anything else (such as the Google Fonts files) is cached the first time it loads.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match("index.html")))
  );
});
