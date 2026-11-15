# Cadet pacing and pointer alignment

This corrects the crowding and sight offset reported after the sniper station merged. The reproduced baseline is main commit `a73c89e6dd6276b253f3eff3c38c4eb5b3a64e3a`.

## Cadet gives the bolt action room to breathe

Previously, Cadet reduced movement speed and breach damage but still scheduled the same number of enemies as Night watch: 45 in the first sniper wave. Its arrivals also used the same interval, so targets accumulated while the player aimed, cycled the bolt and reloaded.

| First rotation | Previous Cadet | Updated Cadet |
| --- | ---: | ---: |
| Gunship, round 1 | 24 | 11 |
| Artillery, round 2 | 31 | 14 |
| Infantry, round 3 | 38 | 17 |
| Sniper, round 4 | 45 | 20 |

Cadet now rounds 45% of the existing wave count to whole enemies. Arrival intervals are 1.35 times longer, with a further factor of two at the sniper station. The sniper deployment allows 2.5 seconds before the first contact and admits at most four attackers during the first watch. The cap grows by one each return, reaching eight on round 20. The arrival clock waits while the field is full; remaining contacts are neither discarded nor released as a backlog. Waves still grow every round. Night watch and Blackout retain their existing sizes and arrival schedules.

## The scope stays with the pointer

The old scope interpolated the drawn reticle towards the centre of the field while input changed from absolute coordinates to relative mouse deltas divided by zoom. The native cursor remained at its original position. Firing and reloading also changed magnification, making that mismatch harder to follow.

Mouse, pen and touch now use absolute canvas coordinates throughout. Conversion includes the canvas contain scale and letterbox offsets in all display modes. The scope magnifies the scene around that same point: for aim point `a`, the transform is `a + zoom × (p − a)`. Consequently, `a` stays fixed at every zoom level, including scope transitions, bolt cycling and reload. The sight ray continues to use the unzoomed aim point, matching the target under the reticle. The lens follows the pointer and can extend beyond the field at its edges.

## Executed verification

- **51 unit tests passed**, including smaller and strictly growing waves, unchanged harder-mode counts, spawn admission and spacing, and later sniper caps.
- A deliberate-play simulation cleared all 20 rifle targets on each of seeds 9, 47, 13013 and 2026. It attempted one shot every 2.5 seconds and deliberately aimed away on every fourth attempt. Actual misses and magazine changes occurred; the active count never exceeded four. All four runs ended at 100 integrity. This is a reproducible pacing check, not a claim about every player's skill.
- **21 packaged Chromium scenarios passed**, including a complete Cadet rotation through actual input handlers, rifle mouse chords and one-shot triggers, emulated independent touch controls, gamepad input, lifecycle cancellation and offline loading.
- The alignment check records native mouse events and observes the canvas draw calls without modifying game state. It measures the rendered reticle and zoom pivot through scope-in, scope-out, movement, bolt cycling and reload in Fit window (1440×1000 and 844×390), native fullscreen (2048×1152) and Windowed page (1280×900). Across 112 samples, the largest pointer/reticle distance was **0.889 CSS pixels**; the largest zoom-pivot error was **0.000155 canvas pixels**. Pixel rounding accounts for the subpixel reticle difference.
- Build, pinned vendor provenance, local imports and the generated offline manifest passed their checks. No runtime dependency was added.

The new regressions were also run against the unchanged merged runtime in a separate checkout. The Cadet-count assertion failed on the previous 24/31/38/45 counts. The browser check failed on the first scope-in tick with a **7.95 CSS-pixel** reticle offset and **8.11 canvas-pixel** pivot error. These expected failures are retained alongside the passing results.

Receipts and SHA-256 hashes of the tested inputs are in [evidence/cadet-aim](evidence/cadet-aim/). `baseline-*` files preserve the old-runtime reproduction; other receipts describe the fixed build. The baseline used the new regression harness against the old runtime. The fullscreen screenshot includes a temporary magenta ring at the observed native pointer position because browser screenshots omit the operating-system cursor; it is test instrumentation, not shipped UI. Chromium and touch/controller emulation were exercised here; physical-device ergonomics were not tested.

```sh
node --test tests/*.test.js
node scripts/build.mjs
node scripts/check.mjs
node tests/browser.mjs
```

For a locally supplied Playwright module or Chromium binary, use the `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` variables documented in the README. After this change deploys, close **all** existing Spooky tabs and reopen the game to activate the new offline cache.
