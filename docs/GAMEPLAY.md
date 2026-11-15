# Field manual

Outpost Echo shares one integrity pool across all three stations. Protect the illuminated wire. A shambler or runner breach costs 5 integrity on Night watch; a bulwark costs 14. Cadet reduces incoming pressure and damage; Blackout increases both. A run ends at zero integrity.

## The station rotation

1. **Spectre orbit:** the 25 mm weapon handles single targets; the 40 mm rapidly clears clusters with 135 base damage and an 11-unit radius; the 105 mm delivers 400 base damage over a 26-unit radius. Its slower salvo covers about 5.6 times the nominal area of the 40 mm. Each weapon owns its ammunition, reload and firing cooldown. Switching does not refill a magazine or cancel a reload. All gunship upgrades apply to every onboard weapon.
2. **Thunder battery:** a five-shell supply feeds the artillery. Impact is delayed, so aim along a group's approach path. The landing ellipse is a visual guide to the pending impact. Splash damage falls off towards its edge.
3. **Last line:** the M2 hits immediately. Hold fire for bursts, release to cool and use quieter intervals to change belts. At maximum heat the weapon refuses fire until it has cooled sufficiently. Ammunition is unlimited between reloads; reloading and overheating still cost time.

The sequence repeats indefinitely. A wave contains `17 + 7 × round + 5 × floor((round − 1) / 3)` enemies: 24, 31, 38, 50, 57, 64… They spawn progressively, rather than all appearing at once. Later rounds also increase health and movement pressure. Bulwarks are probabilistic from round 3, not guaranteed in every small sample.

## Work the battlefield

Orange fuel drums detonate once, damage nearby creatures and chain into neighbouring drums. Each awards 25 points and is replenished with the next round. Heavy blasts stagger and push surviving targets; bulwarks resist displacement. Creatures separate and steer around buildings, so their path can change while a shell is airborne. Switch gunship weapons between heavy salvos to keep scattered runners under pressure.

Aim at a creature's head with the 25 mm or M2 for 1.65× damage to that creature. Other targets caught by the shot take normal damage. Artillery and the 40/105 mm rely on their area damage.

## Upgrade draft

After every wave, choose one of three distinct cards for the **outgoing** station. Cards are selected from a seeded shuffle; the same run seed and round give the same offers for the same installed ranks. An upgrade takes effect for that station's next deployment. Clearing a round also repairs 8 integrity, up to 100. No combat advances during the draft.

| Card | Effect per rank | Rank limit |
| --- | --- | --- |
| Overpressure | +25% base damage | 8 |
| Wide awake | +16% base impact radius | 6 |
| Fast hands | +14% firing/reload speed; times are rounded to ticks | 6 |
| Deep pockets | +25% base magazine capacity | 6 |
| Cold iron | Heat divided by `1 + 0.3 × rank`; shell time divided by `1 + 0.12 × rank` | 5 |
| Hold the line | Restore 25 outpost integrity now | Repeatable |

Maxed upgrades normally leave the draft pool. If fewer than three distinct cards remain, a maxed card is explicitly shown as **Field repairs** and repairs 25 integrity; it does not add a hidden rank. Repair cards can be selected at full integrity, but do not exceed the cap.

## Score and persistence

Kill values are 100 / 140 / 350 before difficulty and chain multipliers. Every five rapid kills increase the multiplier by 0.25, up to 2×. Chains expire after 130 simulation ticks and reset on a breach. Clearing a wave also grants `round × 200` points.

Best scores are stored separately for Cadet, Night watch and Blackout. Sound and fit/page display preferences are also stored locally. Blocked storage never prevents play. A refresh starts a fresh run; active runs are not saved. Audio-device failures suppress sound for the session without rewriting the saved music preference. A later user gesture retries audio.

## Display and sound

The header's **DISPLAY** selector offers **Fit window** (default), **Fullscreen** and **Windowed page**. Fit window contains the complete battlefield and primary controls within the screen. Native fullscreen uses the same layout. Exiting fullscreen restores your previous windowed choice; a denied request falls back to Fit window. Every change pauses combat and clears held inputs. Short-screen menus scroll internally. The field manual's fullscreen shortcut uses the same controller.

Last Light March is an original 120 BPM military-style soundtrack with marching bass drums, field snares, rolls and brass-style calls. Each station has its own deterministic arrangement of the 32-second theme. The field manual lets you select and download any of the three complete 32-second WAVs. Music and FX toggle independently. Weapon reports and impacts are positioned across the stereo field and attenuated with distance; headphones make the difference clearer.

## Input and accessibility

Keyboard aiming works without a mouse. Upgrade cards are ordinary keyboard-accessible buttons and support 1–3. Gameplay Space takes precedence even after clicking a sound or weapon button. Native button activation remains available in menus. On touch screens the aiming finger and fire-button finger are tracked independently.

Hidden tabs, lost focus and history restoration pause active combat and clear held input. Resume is explicit. Reduced-motion preference suppresses muzzle flashes, impact lighting pulses and gun recoil. The camera stays fixed so pointer aiming remains aligned. High-contrast HUD labels, visible focus outlines and a field manual complement the canvas; the combat scene itself is visual and is not a screen-reader equivalent.

Gamepad support is for browsers reporting the standard mapping. The software path is implemented; physical controller and mobile-device ergonomics still need device testing.
