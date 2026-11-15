# Intermediate findings

These observations are from uncommitted development builds, before the final source-hash receipt. They are not final release evidence.

The first simulation check after adding collisions and knockback passed 17 of 18 tests. The existing nine-round autopilot stopped at round 7 (`AssertionError: 7 !== 10`, `tests/sim.test.js:44`). That autopilot used only the 105 mm during gunship rounds. It now cycles available gunship weapons between heavy salvos, exercising the intended multi-weapon combat path. The required nine-round outcome remains unchanged and passes; no progression assertion was removed.

A broad-phase filter was added before VANILLAJS swept collision calls so creatures far from structures do not validate and sweep all five boxes every tick. Collision/navigation tests still check penetration and progress through every authored building lane.

The original 11 browser scenarios passed with the new presentation. Display and visual checks then brought coverage to 15 passing scenarios; selectable soundtrack export brought the final suite to 16. Final results are recorded separately alongside exact file hashes.
