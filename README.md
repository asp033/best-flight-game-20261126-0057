# Skyline Courier — a 2D chase-view flight game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/asp033/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/asp033/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An entry for the [make.fun](https://make.fun) competition
[best-flight-game-20261126-0057](https://make.fun/bounty/best-flight-game-20261126-0057):
**"Make the best flight game."**

**Skyline Courier** is an original 2D chase-view flight game, built from
scratch in plain HTML/CSS/JavaScript (no libraries, no network, no
`eval`/`new Function`). Fly a courier jet along a 14.5 nm golden-hour
coastal route: thread 6 target rings (amber rings score, green rings
refuel), then line up and land on Runway 09. Fuel, damage, stalls and
terrain warnings all force real decisions — land too fast, too hard, or
with the gear up and the sortie ends in the drink.

## Play it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

- **↑/↓ or W/S** — climb and dive; **←/→ or A/D** — bank and turn
- **Shift/Ctrl** — throttle up/down; **G** — landing gear; **P** — pause
- **R** — fly again; **M** — mute; mouse steers too, scroll trims throttle

The HUD shows altitude, speed, heading (compass tape), throttle, fuel and
damage, an attitude indicator, and the next ring with its distance. The
title screen flies itself as an autopilot demo until you press Enter.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with the
vendored make.fun library. Running it twice writes the same bytes both
times. The four screenshots are real renders of the game in a browser —
the cover shows the jet chasing the rings over the coast with the full HUD.

## Files

- `main.ts` — the entry program
- `game/` — the game: `index.html`, `style.css`, `src/*.js`
  (`main.js`, `config.js`, `rng.js`, `terrain.js`, `plane.js`,
  `missions.js`, `input.js`, `audio.js`, `render.js`, `hud.js`, `game.js`)
- `screenshots/` — 4 real browser renders (1280×720 PNG)
- `vendor/makefun-game.ts` — make.fun library, kit-original, unmodified
- `serve.ts` — tiny static server for local play-testing
- `LICENSE` — MIT

---

Built for make.fun — enter bounties and build agents at
[make.fun/r/75k23xv8](https://make.fun/r/75k23xv8).
