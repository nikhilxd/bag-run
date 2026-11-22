# Internal dev playtest 01 (designer + AI agent). Not outside playtesters.

**What this is.** An in-engine bot played 15 consecutive runs of the real game code (Phaser scene stepped headlessly in the browser, 16.7 ms fixed steps, fresh save). The bot paths with a 30 px grid BFS, grabs the nearest cube (weighting rare and prime), and heads to the beacon by one of three policies. It does not dodge and does not shoot on purpose (auto-fire does that). It stands in for a careful-but-not-clever player. It is NOT a human and the numbers below are not human retention or win-rate data.

Policies, rotating per run: cautious (leave at bag value 80, no greed wait), mid (leave at 150 or 15 s after beacon), greedy (leave at 400 or 40 s after beacon).

| # | result | s | heat max | bag value | greed | killed by | kills | dmg taken |
|---|---|---|---|---|---|---|---|---|
| 1 | extracted | 32.4 | 53 | 110 | 1.1 | | 1 | 0 |
| 2 | extracted | 66.0 | 90 | 392 | 1.4 | | 9 | 0 |
| 3 | extracted | 70.3 | 100 | 585 | 1.5 | | 9 | 1 |
| 4 | extracted | 33.1 | 48 | 121 | 1.1 | | 3 | 0 |
| 5 | extracted | 40.1 | 67 | 180 | 1.2 | | 5 | 0 |
| 6 | lost | 79.6 | 100 | 0 | 1.5 | drone | 11 | 3 |
| 7 | extracted | 34.1 | 49 | 121 | 1.1 | | 1 | 0 |
| 8 | extracted | 40.9 | 65 | 336 | 1.2 | | 4 | 0 |
| 9 | lost | 76.5 | 100 | 0 | 1.5 | drone | 11 | 3 |
| 10 | extracted | 40.3 | 61 | 156 | 1.2 | | 4 | 0 |
| 11 | extracted | 44.8 | 51 | 96 | 1.2 | | 1 | 0 |
| 12 | lost | 63.8 | 100 | 0 | 1.4 | brute | 10 | 4 |
| 13 | extracted | 26.4 | 38 | 100 | 1.0 | | 0 | 0 |
| 14 | extracted | 43.7 | 62 | 180 | 1.2 | | 1 | 0 |
| 15 | extracted | 94.7 | 100 | 595 | 1.7 | | 13 | 0 |

(Run 12 took 4 damage: a 2-damage brute hit landing on 1 HP.)

**Reading it (what this does and does not show).**
- Every death came from the greedy policy sitting at heat 100 for 40 s. Cautious and mid runs never died. That is the intended shape: danger lives in the waiting, not in the grabbing. It also means the bot never meets the "mid-game death by bad luck" a human will.
- Greedy extractions paid 392 to 595 against 96 to 180 for cautious, about 3 to 4 times as much, for about twice the time. Greedy died 3 of 5 times. Expected value of greedy was roughly equal to mid for this bot. I want a human to feel "greed is a close call", so I left it.
- Average run 51 s for the bot; the design target is 60 to 90 s for a human, who is slower at pathing. Not adjusted.
- No console errors across the 15 runs. localStorage save and telemetry round-tripped (15 `run_end` events).

**Found and fixed during this session**
- Extraction fill used the browser frame delta instead of the game step, so it was wrong in headless stepping. Fixed (`dtNow`).
- Income was too fast: cash per run averaged about 250, so about 6 upgrades in 10 minutes. Upgrade cash costs doubled to hit "2 to 3 upgrades in 10 minutes" for a human who extracts 60 percent of runs. That target is an estimate, see `sim_results.md`.
