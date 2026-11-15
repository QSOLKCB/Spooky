# Repository engineering rules

- Preserve Apache-2.0 licences and vendor provenance. Keep VANILLAJS files byte-identical to their recorded source; make game changes in `js/`.
- Use native ES modules and browser standards. No runtime package manager, CDN, backend or third-party engine is required. Node and Playwright are verification tools only.
- Keep simulation independent of DOM, device audio, wall clocks and unseeded randomness. Do not claim cross-engine bit-exactness or formal proof without executed evidence.
- Preserve fixed-step timing, bounded catch-up, input cancellation and explicit resume after focus loss. Keyboard Space must still fire after combat toolbar clicks. Mobile aiming and firing pointers are independent.
- Test changes with `node --test tests/*.test.js`, `node scripts/build.mjs`, and `node scripts/check.mjs`. Browser changes also require `node tests/browser.mjs` using the documented Playwright module. Preserve failure receipts and distinguish software checks from device testing.
- Rebuild `sw.js` whenever a public file changes. Keep publication allowlisted and gated by verification. Do not ship test dependencies or evidence directories in `dist/`.
- Submit implementation through a PR. Do not merge, create releases, move tags or change repository visibility without explicit owner authorization.
