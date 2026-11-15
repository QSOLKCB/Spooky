# Field manual

Outpost Echo shares one integrity pool across all four stations. Protect the illuminated wire. A shambler or runner breach costs 5 integrity on Night watch; a bulwark costs 14. Cadet reduces incoming pressure and damage; Blackout increases both. A run ends at zero integrity.

## The station rotation

1. **Spectre orbit:** the 25 mm weapon handles single targets; the 40 mm rapidly clears clusters with 135 base damage and an 11-unit radius; the 105 mm delivers 400 base damage over a 26-unit radius. Its slower salvo covers about 5.6 times the nominal area of the 40 mm. Each weapon owns its ammunition, reload and firing cooldown. Switching does not refill a magazine or cancel a reload. All gunship upgrades apply to every onboard weapon.
2. **Thunder battery:** a five-shell supply feeds the artillery. Impact is delayed, so aim along a group's approach path. The landing ellipse is a visual guide to the pending impact. Splash damage falls off towards its edge.
3. **Last line:** the M2 hits immediately. Hold fire for bursts, release to cool and use quieter intervals to change belts. At maximum heat the weapon refuses fire until it has cooled sufficiently. Ammunition is unlimited between reloads; reloading and overheating still cost time.

4. **Long watch:** fixed 20 mm bolt-action rifle, five-round magazine, 54-tick bolt cycle and 132-tick reload before upgrades. Hold right mouse / Shift / left trigger, or toggle Q / SCOPE, for a 3.2× sight. Click / tap / press the trigger once per shot. Scope settles after 9 ticks; accurate hits from ticks 9–33 earn quickscope credit. Heads deal 2.5× damage; torso hits deal 200 base damage; limbs 65% of that. Hip fire disperses deterministically. Up to three aligned targets take hits, with 70% damage retained per penetration. Buildings stop the bullet.

The sequence repeats indefinitely. On Night watch and Blackout, a wave contains `17 + 7 × round + 5 × floor((round − 1) / 4)` enemies: 24, 31, 38, 45, 57, 64… They spawn progressively, rather than all appearing at once. Later rounds also increase health and movement pressure. Bulwarks are probabilistic from round 3, not guaranteed in every small sample.

Cadet uses 45% of that count, rounded to the nearest whole enemy: **11, 14, 17, 20, 26, 29…**. Waves still increase every round. Arrivals take 1.35× as long, with a further 2× spacing at the rifle station. The first Cadet sniper contact arrives after 2.5 seconds. At most four attackers are active during the first sniper watch; this cap increases by one each return, up to eight. Waiting targets remain in the wave, and the arrival clock waits while the field is full. Existing Cadet movement and breach-damage reductions still apply.

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

Rifle cards replace **Wide awake** with **Through and through** (+1 penetrated target per rank, up to nine), and **Cold iron** with **Follow-through** (+5 percentage points of retained damage per penetration, up to 95%). **Slick bolt** improves bolt/reload speed by 14% per rank. Damage, capacity and repairs retain their normal effects. The precision rifle has no splash radius or heat meter.

## Score and persistence

Kill values are 100 / 140 / 350 before difficulty and chain multipliers. Every five rapid kills increase the multiplier by 0.25, up to 2×. Chains expire after 130 simulation ticks and reset on a breach. Clearing a wave also grants `round × 200` points.

Rifle kills add 50 points for a headshot and 100 for a quickscope before the difficulty/chain multiplier. Killing two or more targets with one rifle shot adds 150 points per extra kill. One fired round counts at most once towards shot accuracy, regardless of collateral hits. Head-hit and quickscope-hit counters can include a surviving target.

Best scores are stored separately for Cadet, Night watch and Blackout. Sound and fit/page display preferences are also stored locally. Blocked storage never prevents play. A refresh starts a fresh run; active runs are not saved. Audio-device failures suppress sound for the session without rewriting the saved music preference. A later user gesture retries audio.

## Display and sound

The header's **DISPLAY** selector offers **Fit window** (default), **Fullscreen** and **Windowed page**. Fit window contains the complete battlefield and primary controls within the screen. Native fullscreen uses the same layout. Exiting fullscreen restores your previous windowed choice; a denied request falls back to Fit window. Every change pauses combat and clears held inputs. Short-screen menus scroll internally. The field manual's fullscreen shortcut uses the same controller.

Last Light March is an original 120 BPM military-style soundtrack with marching bass drums, field snares, rolls and brass-style calls. Each station has its own deterministic arrangement of the 32-second theme. The field manual lets you select and download any of the four complete 32-second WAVs. Music and FX toggle independently. Weapon reports and impacts are positioned across the stereo field and attenuated with distance; headphones make the difference clearer.

## Input and accessibility

Keyboard aiming works without a mouse. Upgrade cards are ordinary keyboard-accessible buttons and support 1–3. Gameplay Space takes precedence even after clicking a sound or weapon button. Native button activation remains available in menus. On touch screens the aiming finger and fire-button finger are tracked independently.

Hidden tabs, lost focus and history restoration pause active combat and clear held input, including scoped/queued rifle shots. Controller disconnect also pauses. Resume is explicit. Reduced-motion preference suppresses muzzle flashes, impact lighting pulses and gun recoil. The emplacement stays fixed. Rifle magnification follows a smooth tick-based transition around the aim point. Mouse and touch use absolute canvas coordinates, accounting for letterboxing, so the scope and crosshair stay with the pointer during zoom, bolt cycling and reload. High-contrast HUD labels, visible focus outlines and a field manual complement the canvas; the combat scene itself is visual and is not a screen-reader equivalent.

Gamepad support is for browsers reporting the standard mapping. The software path is implemented; physical controller and mobile-device ergonomics still need device testing.
