# Bot sim results (model, not human data)

I dropped the abstract "collection rate and death hazard" model I planned first. Stepping the real Phaser scene with a bot tests the actual code, loot placement, collisions and economy, and it was no more work. So "sim" here means: the real game, played by a scripted bot, headless, labelled as such in every file.

Source of the numbers: `playtests/session_dev_01.md` (15 runs, 3 policies). One batch, one bot. Treat all of it as a smoke test of the loop and a sanity check on the economy, not as evidence of how people play.

| quantity | value | note |
|---|---|---|
| extract rate | 12/15 = 80% | bot never dodges; humans will be lower |
| avg run length | 51 s | humans slower |
| cash per run (mean) | about 250 | before the cost change |
| greedy policy deaths | 3/5 | all at heat 100 after waiting 40 s |

Tuning applied after this batch: all upgrade cash costs x2 (L1 240 to 400, L2 700 to 1000, L3 1600 to 2200). Reason: [estimate - reasoning: a human extracts about 60% of runs at about 200 cash, so 10 runs is about 1200 cash, which buys 3 L1 upgrades at the new prices].
