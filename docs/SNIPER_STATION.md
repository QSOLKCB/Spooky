# Long watch — 20 mm sniper station

The rotation is now **AC-130 → artillery → M2 → sniper**, repeating on rounds 1/5/9, 2/6/10, 3/7/11 and 4/8/12. The fourth emplacement uses a fixed 20 mm anti-materiel rifle with a five-round magazine. Its rules are fictional arcade tuning.

## Firing and scope

- Hold right mouse, either Shift key or standard-gamepad left trigger to scope. Q and the SCOPE button toggle it. Magnification is 3.2× around the aim point; the scope and reticle follow absolute pointer coordinates. Bolt cycling and reload do not switch input mapping.
- Click left mouse, tap FIRE or press Space/right trigger/A once per round. Holding the trigger cannot fire again. The bolt cycles automatically in 54 ticks (0.9 seconds); reload takes 132 ticks (2.2 seconds), before upgrades.
- A settled scope is accurate after nine ticks (0.15 seconds). A scoped hit within ticks 9–33 records a quickscope; quickscope kills add 100 points before the existing difficulty/chain multiplier. Hip fire has seeded dispersion.
- Head hits deal 2.5× damage; torso hits deal 200 base damage; limb/leg hits deal 65%. A headshot kill adds 50 points before difficulty/chain multiplication. Rendered voxel boxes and traced hit regions share the same animated geometry.
- A bullet hits up to three aligned enemies, nearest first, retaining 70% damage after each penetration. Two or more kills earn a collateral bonus of 150 points per additional kill. Buildings stop the shot, including later collateral targets. Fuel drums remain blast-reactive scenery rather than rifle targets; trees and the relay antenna are decorative.
- A click in the last 11 ticks of bolt cycling may buffer briefly. Reload, cancelled pointers/capture, pause and focus loss cancel pending shots. Ordinary trigger release permits a deliberate quick tap to finish raising the scope. Controller disconnect pauses and requires explicit resume.

## Station upgrades

| Card | Effect |
| --- | --- |
| Heavy punch | +25% base rifle damage per rank |
| Through and through | +1 penetrated target per rank, from 3 up to 9 |
| Slick bolt | +14% bolt/reload speed per rank |
| Deep pockets | +25% magazine capacity per rank |
| Follow-through | +5 percentage points of retained damage per penetration, from 70% up to 95% |
| Hold the line | Restore 25 outpost integrity |

Rifle upgrades belong to the sniper station. Existing gunship, artillery and M2 upgrades retain their mechanics. Horde growth and lighting sectors now follow the four-station cycle. Long Watch also has an original rifle report, timed mechanical bolt sound and a quieter, high-register arrangement of Last Light March, with full deterministic WAV export.

## Source adaptation

Source: [QSOLKCB/QUICKSCOPER](https://github.com/QSOLKCB/QUICKSCOPER/tree/8da5569b1ee7565d9ae5fb0588847d262c896648), commit `8da5569b1ee7565d9ae5fb0588847d262c896648`, Apache-2.0.

`src/math.js` ray slabs and `src/game.js` nearest-region / wall-blocked collateral tracing, scope settle and short trigger buffering are adapted in `js/sniper.js` and `js/sim.js`. The original smooth ADS and bolt presentation informed the Canvas implementation in `js/render.js`. The source geometry, movement and WebGL engine are not imported wholesale. [The adaptation manifest](../vendor/QUICKSCOPER.json) records exact upstream file identities; the upstream licence and attribution are retained. VANILLAJS and Outruin files remain byte-identical to their existing pins.

## Validation

The subsequent [Cadet and pointer-alignment fix](CADET_AND_AIM.md) has the current validation results.

**The original station update passed 48 pure tests and 20 packaged Chromium scenarios.** [Source hashes, receipts, failed attempts and screenshots](evidence/sniper-station/) bind the local evidence to the tested files, based on Spooky main `6330ff054b4ee15225e05ae7c6ef06a6204eb2c6`.

Pure coverage includes head/body/miss geometry, animated poses at different distances, one region per target, stable collateral order, attenuation/caps, cover ties and intervening walls, trigger edges, short buffering, reload and cancellation, timing at 30/60/120/144 Hz, seeded repetition, a twelve-round Cadet run with retained upgrades, four distinct complete march WAVs and bounded audio effects.

The packaged browser suite drives all four rounds through real input handlers and compares score/kills to the pure model. It exercises scope and mouse-button chords, held-trigger suppression, Shift/touch/gamepad scope, 320-pixel and landscape-tablet controls, queued-shot cancellation, focus/controller disconnect, reload, fullscreen, four exact WAV downloads, and offline reload under `/Spooky/`. Scope/collateral images are controlled simulation fixtures; the tablet capture is the actual live UI. All rendering is checked separately from simulation state.

Executed locally with Node 24.22.1, Playwright 1.62.1 and Chromium 141.0.7390.37 (headless shell). Device inputs are emulated; physical controller ergonomics, phone performance, Firefox/Safari and audible mix balance were not tested. No cross-engine bit-exactness or unlimited-wave balance claim is made.

The initial twelve-round automated Night-watch pilot exhausted integrity on round 12. That rotation/persistence test used Cadet; the original live browser cycle used Night watch. An expanded browser assertion initially inspected the throttled HUD before it had displayed the settled scope; its wait now includes a HUD refresh. Both failures are retained alongside the passing receipts. Final review also kept scoped aim continuous through bolt cycling, confined bolt FX to their own station and cancelled pending shots on pointer cancellation.
