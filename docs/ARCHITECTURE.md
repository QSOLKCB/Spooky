# Engineering notes

## Boundaries

`js/sim.js` is a DOM-free 60 Hz simulation over explicit state. `js/content.js` holds arcade weapon, enemy, difficulty and upgrade data. `js/app.js` owns focus, DOM input, storage, audio presentation and the animation clock. `js/render.js` owns canvas projection, upright sprite picking and presentation. `js/audio.js` defines the original integer PCM score and sound recipes.

World X crosses the valley; world Z increases towards the wire at Z=91. These are game coordinates, not SI ballistic measurements. Top-down, artillery and infantry views project the same ground plane differently. Pointer picking checks displayed creature bodies before intersecting that plane, choosing the nearer creature when silhouettes overlap. The renderer does not decide damage: it submits a world-space aim point to the simulation, which resolves travel, blast falloff, kills and breaches.

Combat uses ordinary JavaScript Number arithmetic. Same seed, difficulty, per-tick inputs and upgrade choices reproduce state in tested JavaScript execution. Tests compare 30, 60, 120 and 144 Hz frame schedules. This is not a claim of formal verification, fixed-point combat or cross-engine bit-exactness. Browser rendering and device audio are presentation only.

## Actual VANILLAJS integration

Pinned source: `QSOLKCB/VANILLAJS` at `3c35784636288bafe4923537463f853b6bcf0cb4`.

| Upstream file | Used for |
| --- | --- |
| `modules/time/index.js` | FixedClock, bounded catch-up and pause reset |
| `modules/math/index.js` | Seeded random streams and clamping |
| `modules/ballistics/index.js` | Gravity integration for shells, debris and ejected brass |
| `modules/collision/index.js` | Swept AABB collision and sliding around building footprints |
| `modules/audio2d/index.js` | Pure integer PCM effects and phrase synthesis |
| `modules/soundtrack/index.js` | Eight-phrase score, tick positions and full-loop WAV export |
| `api/audio/index.js` | Web Audio presentation synchronised to combat ticks |

These files are vendored unmodified with the upstream LICENSE and NOTICE. `vendor/PROVENANCE.json` records source paths, the exact commit and original Git blob hashes. `node scripts/check.mjs` recomputes the object hashes from local bytes. A documented vendor update must update the pin and hashes together; do not silently patch vendor code.

## Battlefield and presentation

`js/world.js` owns building footprints, fuel-drum positions and three lighting palettes. `js/physics.js` applies VANILLAJS gravity to shells and debris, broad-phase collision filtering before swept AABB motion, spatial-bin crowd separation and deterministic blast impulses. Buildings block horde movement; they are not destructible projectile shields. Shell velocities are chosen to reach the selected ground point on the existing weapon flight tick. These are arcade game units.

Fuel drums are marked destroyed before their blast enters the chain queue. Each can detonate once per round; it awards 25 points but never counts as a creature kill or a fired shot. Direct-fire head picking sends a target ID and world aim to the simulation. A 1.65× critical applies only to that target, only with the 25 mm/M2, and only if the actual impact is in range. Bulwark mass reduces knockback.

The renderer caches terrain by station and lighting palette, then draws depth-sorted structures, drums and characters, persistent marks and live effects. Character stride comes from distance travelled. Presentation draws do not change simulation state or consume spawning randomness. There is no camera shake to offset the pointer transform. Reduced motion suppresses muzzle flashes, impact lighting pulses and gun recoil.

Last Light March uses an original 16-bar D-minor theme at 120 BPM. Each station has an eight-phrase, 32-second integer PCM arrangement. Four non-overlapping lanes carry marching bass drums/bass responses, seeded field snares and rolls, a saw/square brass lead and triangle horn harmony. Every phrase ends on the 60 Hz tick grid; both full-loop exports and arbitrary cross-phrase chunks are verified. Weapon sounds layer a crack, falling low-frequency body, debris and reflected report, with four deterministic variants. Web Audio adds stereo pan, distance gain and output compression. Music and effects remain independently switchable; station changes stop the old score. Explicit lifecycle stop releases both music and FX voices. Export selects any station's complete WAV in the field manual.

The 40 mm and 105 mm have separate damage/radius budgets and the 105 mm has a dedicated explosion profile. Shared profile values drive lifetime, flame/smoke timing, debris throw, survivor impulse and the audio recipe. Landing guides and shockwaves project a sampled circle in world coordinates, clipped to the field before perspective projection, instead of using character sprite scale. A fixed small crosshair preserves precise aiming even at the maximum radius upgrade. See [the balance record](GUNSHIP_BALANCE.md).

## Display modes

`js/display.js` is copied byte-for-byte from `QSOLKCB/Outruin` PR #4 at `94ae4abdcd3e29721d5d4f5d2415246a9551f8b9`; `vendor/OUTRUIN.json` records its Git blob identity. Spooky's layout and input integration are original. The checker verifies both upstream pins.

Fit window and native fullscreen reserve room for the header, telemetry, weapon/ammo controls and touch buttons, then contain the fixed 1152×720 canvas in the remaining space. Pointer conversion uses the same contain scale and letterbox offsets. Windowed page preserves scrolling. Overlay content scrolls internally on short screens. The native fullscreen event owns the displayed state; only fit/page preferences are saved, never a fullscreen request. Changes pause combat and clear held controls. Denied/unavailable fullscreen falls back to Fit window.

## Runtime safeguards

- FixedClock clamps a frame to 150 ms and executes at most eight simulation steps per animation frame. Excess wall time is dropped; it is not an enormous catch-up burst.
- Status transitions freeze combat, with terminal loss taking precedence over a cleared wave. In-flight shells resolve before a draft opens.
- Every station resupplies only when a round begins. Each gunship weapon owns cooldown/reload/ammunition/heat state, including while another gun is selected.
- Enemy records disappear after death or breach; each is resolved once. Presentation effects are capped at 180, particles at 260, craters at 40 and remains at 24; Web Audio effect voices at 24. Wave population increases without a fixed campaign endpoint, so extreme late-round performance has no benchmark claim.
- Inputs clear on pause, focus loss, hidden tabs and page history transitions. Gamepads must return to neutral after cancellation before firing again.
- Audio creation, playback and export errors are contained. Preferences and session fallback state are separate.

## Offline and publication

`scripts/files.mjs` defines the public allowlist. `scripts/build.mjs` copies it to `dist/` and generates a source-hashed `sw.js`; `scripts/check.mjs` rejects stale worker manifests and missing local imports. No test fixtures, tools or repository metadata are shipped. The worker precaches the full game under its own scope, including repository subpaths. Updates wait until all old tabs close; no forced activation replaces modules in an active run.

`verify-and-deploy.yml` tests every PR and main push. Only a successful main push can publish the exact staged distribution through Pages. It does not merge PRs or create release tags. An already configured branch-based Pages site may also have GitHub's legacy deployment; use the GitHub Actions Pages source for the explicit verification gate.

## Verification and limits

Pure tests exercise seeded repetition, nine-round progression, the actual weapon lifecycle, splash/flight, rank limits, invalid input, terminal state, body picking, frame schedules, seed sweeps and PCM generation. Browser tests drive the real app handlers with an owned animation clock, compare full-wave score/kills to the pure model, and verify three station transitions, keyboard/touch input, pause, retry, audio failure and offline reload. They create a receipt before launching and preserve failures and screenshots.

The browser suite uses Chromium. Firefox, Safari, physical controllers, audible mix balance and physical touch-device performance are not certified by these checks. Automated aim is an execution test, not evidence that every difficulty is balanced for every player.
