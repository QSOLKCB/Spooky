# Battlefield and display upgrade validation

Starting from merged Spooky `4d23b20c1af203fcc72022b82e196b645389e63d`, with VANILLAJS pinned to `3c35784636288bafe4923537463f853b6bcf0cb4` and Outruin's display controller at `94ae4abdcd3e29721d5d4f5d2415246a9551f8b9`.

## Executed locally

- **30 Node tests passed.** Seeded state repetition, nine-round progression with weapon switching, frame scheduling at 30/60/120/144 Hz, shell trajectories, collision/steering, blast impulse, single-use fuel chains, head picking and damage, bounded debris, distinct repeatable full station WAVs, spatial FX, voice limits and device-failure cleanup.
- **16 packaged Chromium checks passed.** Actual gunship/artillery/M2 rounds, upgrade selection, keyboard and separate touch pointers, reload/heat UI, focus/history cancellation, retry, offline reload under `/Spooky/`, native fullscreen lifecycle, denied-fullscreen fallback, saved window preference, scrollable short menus, render non-mutation and repeatability, and all three UI WAV exports compared byte-for-byte to the pure score output.
- Fit bounds checked for canvas, health/contact telemetry, weapon/ammunition controls, display selector and fire/reload buttons at **1836×890, 1366×650, 1280×600, 844×390, 320×844, 390×844 and 320×568**. Wide touchscreen firing checked at **1024×768 and 1366×1024**.
- Source/import/provenance checks and the **26-file public build** passed. Ten upstream files are byte-verified. Simulation, physics and world modules are checked for ambient clock/DOM/audio/random dependencies. The service worker includes the new modules and source revision.

Local browser tooling: **Chromium 141.0.7390.37**, headless shell, **Playwright 1.62.1**. Node **24** is used for checks. CI retains its existing separately pinned Playwright 1.56.0 installation. Native fullscreen exit was exercised with `exitFullscreen()` and its real event; the physical browser Esc shortcut was not exercised.

[Source hashes, full receipts and captures](evidence/battlefield-upgrade/) identify the exact tested files. The three battlefield images use an explicitly constructed horde fixture, advanced through the real pure simulation and renderer; they are visual coverage scenes, not claims of human play. Full-round tests separately drive the live application's input handlers and compare score/kills to the pure model. Intermediate failures are retained in the development notes.

## Limits

Physical mobile hardware and controllers, Firefox/WebKit, audible speaker/headphone mix balance and extreme late-round performance have not been measured. Browser emulation verifies geometry and input behaviour, not mobile GPU throughput. Automated play is a regression check, not a balance certification. Physics uses JavaScript Number arithmetic in fictional arcade units; no cross-engine bit-exact or formal-proof claim is made.
