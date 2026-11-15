# SPOOKY — Last Light

**Three stations. One last line.**

An original, offline-first horde defence game built with [VANILLAJS](https://github.com/QSOLKCB/VANILLAJS). Command an AC-130 gunship, move to the artillery battery, then take the M2 at the wire. The next wave is bigger. Your upgrades stay with you.

[Play on GitHub Pages](https://qsolkcb.github.io/Spooky/) · [Field manual](docs/GAMEPLAY.md) · [Engineering and provenance](docs/ARCHITECTURE.md)

## The operation

| Round | Station | Your job |
| --- | --- | --- |
| 1, 4, 7… | AC-130 / Spectre orbit | Thermal overhead view. Switch between a 25 mm Gatling, 40 mm cannon and 105 mm howitzer. |
| 2, 5, 8… | Artillery / Thunder battery | Place delayed high-explosive impacts ahead of moving groups. |
| 3, 6, 9… | Infantry / Last line | Work the M2 .50 cal from ground level. Manage the belt and barrel heat. |

Clear a round and choose **one of three upgrades** for the station you just used. Damage, blast radius, firing/reload speed, ammunition capacity and cooling upgrades persist across rotations. Field repairs restore the shared outpost instead. Each gunship upgrade applies to all three aircraft weapons.

The outpost automatically recovers 8 integrity between rounds; the incoming station is resupplied. Runners enter from round 2 and armoured bulwarks from round 3. There is no final wave: survive until the perimeter falls.

## Included

- Three distinct pixel/voxel-style views, procedural terrain, thermal imaging, visible shell flight, explosions, tracers and weapon recoil.
- Increasing hordes, three enemy classes, three difficulty settings, chain bonuses and separate local best scores per difficulty.
- Six upgrade choices, deterministic three-card drafts, persistent station builds and independent gunship ammunition/reload state.
- An original 32-second procedural soundtrack, distinct weapon effects and WAV soundtrack export from the field manual.
- Mouse, keyboard, touch and standard gamepad controls. Automatic pause on focus loss and explicit resume.
- Offline caching after the first complete visit. No account, backend, CDN, runtime package install or downloaded art.
- Pure fixed-tick combat, seeded encounters, executable tests and byte-verified VANILLAJS provenance.

## Controls

| Input | Action |
| --- | --- |
| Pointer / WASD / arrows | Aim |
| Hold left mouse / Space | Fire |
| 1 / 2 / 3 | Switch gunship weapon; select an upgrade when the draft is open |
| R | Reload |
| P / Esc | Pause or resume |
| Touch | Drag the battlefield to aim; hold the separate FIRE button |
| Standard gamepad | Left stick aims; right trigger or A fires; X reloads; shoulders switch weapon; Start pauses |

Use the mouse on the creature's visible body, or aim ahead on the ground to place a blast. There is no pointer lock. Leaving the tab clears held inputs and pauses the run.

## Run locally

Serve the repository with a small local server:

```sh
uv run --no-project python -m http.server 8000
```

Then open `http://localhost:8000`. Python's built-in `python3 -m http.server 8000` also works. Native ES modules need HTTP; double-clicking `index.html` is not supported.

To create a clean static distribution with Node 24 or newer:

```sh
node scripts/build.mjs
```

Serve `dist/`. The build uses only Node's standard library and copies an explicit public allowlist. No bundler is involved. The checked-in service worker also supports serving the repository root.

## Verify

```sh
node scripts/check.mjs
node --test tests/*.test.js
node scripts/build.mjs
```

Browser verification uses Playwright as a **development-only** tool. CI installs Playwright 1.56.0 in a temporary directory, plays all three stations through real DOM input handlers, and uploads screenshots plus `test-results/browser.json`, including failures. If Playwright is already installed:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/browser.mjs
```

`CHROMIUM_PATH` optionally selects an installed Chromium binary. Tests cover complete rounds, actual damage, draft choices, reload and heat, pause/focus cancellation, projected body picking, keyboard toolbar focus, mobile multitouch, audio failure, restart and offline operation under `/Spooky/`.

CI runs on every PR and main-branch push. A successful main run publishes its verified `dist/` artifact to Pages; select **GitHub Actions** as the Pages source in repository settings if the repository still uses branch-based Pages. Implementation is delivered through a PR; merging and tagging remain owner actions.

## Build your own night

Game data lives in `js/content.js`; combat and wave rules in `js/sim.js`; the three views in `js/render.js`; soundtrack and effects in `js/audio.js`. These are ordinary inspectable ES modules. See [the architecture notes](docs/ARCHITECTURE.md) before changing simulation or vendor files. This release supports source edits, not an in-game mod-pack editor.

Apache-2.0. Copyright 2026 Trent Slade / QSOL-IMC and contributors. Upstream licences and notices are preserved. An original arcade game, with no Call of Duty assets, music or code; weapon names are fictional gameplay context, not real weapon training.
