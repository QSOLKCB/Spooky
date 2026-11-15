# Engineering notes

## Boundaries

`js/sim.js` is a DOM-free 60 Hz simulation over explicit state. `js/content.js` holds arcade weapon, enemy, difficulty and upgrade data. `js/app.js` owns focus, DOM input, storage, audio presentation and the animation clock. `js/render.js` owns canvas projection, upright sprite picking and presentation. `js/audio.js` defines the original integer PCM score and sound recipes.

World X crosses the valley; world Z increases towards the wire at Z=91. These are game coordinates, not SI ballistic measurements. Top-down, artillery and infantry views project the same ground plane differently. Pointer picking checks displayed creature bodies before intersecting that plane, choosing the nearer creature when silhouettes overlap. The renderer does not decide damage: it submits a world-space aim point to the simulation, which resolves travel, blast falloff, kills and breaches.

Combat uses ordinary JavaScript Number arithmetic. Same seed, difficulty, per-tick inputs and upgrade choices reproduce state in tested JavaScript execution. Tests compare 30, 60, 120 and 144 Hz frame schedules. This is not a claim of formal verification, fixed-point combat or cross-engine bit-exactness. Browser rendering and device audio are presentation only.

## Actual VANILLAJS integration

Pinned source: `QSOLKCB/VANILLAJS` at `987c8d9be0af418307ea7cda05cbf56b5f130c71`.

| Upstream file | Used for |
| --- | --- |
| `modules/time/index.js` | FixedClock, bounded catch-up and pause reset |
| `modules/math/index.js` | Seeded random streams and clamping |
| `modules/audio2d/index.js` | Pure integer PCM effects and phrase synthesis |
| `modules/soundtrack/index.js` | Eight-phrase score, tick positions and full-loop WAV export |
| `api/audio/index.js` | Web Audio presentation synchronised to combat ticks |

These files are vendored unmodified with the upstream LICENSE and NOTICE. `vendor/PROVENANCE.json` records source paths, the exact commit and original Git blob hashes. `node scripts/check.mjs` recomputes the object hashes from local bytes. A documented vendor update must update the pin and hashes together; do not silently patch vendor code.

## Runtime safeguards

- FixedClock clamps a frame to 150 ms and executes at most eight simulation steps per animation frame. Excess wall time is dropped; it is not an enormous catch-up burst.
- Status transitions freeze combat, with terminal loss taking precedence over a cleared wave. In-flight shells resolve before a draft opens.
- Every station resupplies only when a round begins. Each gunship weapon owns cooldown/reload/ammunition/heat state, including while another gun is selected.
- Enemy records disappear after death or breach; each is resolved once. Presentation effects are capped at 180; Web Audio voices at 20. Wave population increases without a fixed campaign endpoint, so extreme late-round performance has no benchmark claim.
- Inputs clear on pause, focus loss, hidden tabs and page history transitions. Gamepads must return to neutral after cancellation before firing again.
- Audio creation, playback and export errors are contained. Preferences and session fallback state are separate.

## Offline and publication

`scripts/files.mjs` defines the public allowlist. `scripts/build.mjs` copies it to `dist/` and generates a source-hashed `sw.js`; `scripts/check.mjs` rejects stale worker manifests and missing local imports. No test fixtures, tools or repository metadata are shipped. The worker precaches the full game under its own scope, including repository subpaths. Updates wait until all old tabs close; no forced activation replaces modules in an active run.

`verify-and-deploy.yml` tests every PR and main push. Only a successful main push can publish the exact staged distribution through Pages. It does not merge PRs or create release tags. An already configured branch-based Pages site may also have GitHub's legacy deployment; use the GitHub Actions Pages source for the explicit verification gate.

## Verification and limits

Pure tests exercise seeded repetition, nine-round progression, the actual weapon lifecycle, splash/flight, rank limits, invalid input, terminal state, body picking, frame schedules, seed sweeps and PCM generation. Browser tests drive the real app handlers with an owned animation clock, compare full-wave score/kills to the pure model, and verify three station transitions, keyboard/touch input, pause, retry, audio failure and offline reload. They create a receipt before launching and preserve failures and screenshots.

The browser suite uses Chromium. Firefox, Safari, physical controllers, audible mix balance and physical touch-device performance are not certified by these checks. Automated aim is an execution test, not evidence that every difficulty is balanced for every player.
