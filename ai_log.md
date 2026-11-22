# AI log

Format: date | tool | asked | kept | cut/changed and why

- 2026-11-22 | Claude Opus (Claude Code) | wrote PLAN_FOR_SONNET.md from the email and test doc | kept | n/a

- 2026-11-22 | Claude Sonnet | web searches for Lila BLACK, RR3, CPM, Survivor.io | kept sourced facts only | search snippets are secondary; flagged gaps instead of filling from memory

## Where the AI got it wrong, and the fix

1. 2026-11-22 | Claude Sonnet | wrote 67 Handler lines (first draft saved as `handler_lines_RAW_first_draft.json`) | kept 61 as drafted, rewrote 6. Wrong: "Drones. Drones got you." was a restatement of the next line; "Small bag, big smile" was greeting-card tone for a handler who is meant to be dry; the bored line said "You're getting out too clean" in a contraction-heavy style that did not match the rest. Fix: shorter, drier rewrites, same facts. The bigger error was not in the words: the lines with `{n}` and `{type}` variables were never wired up, so the title would have shown a literal "{n}". Found by reading the Title scene against the line bank; fixed by passing the variables and showing the grudge line when a grudge is active.
2. 2026-11-22 | Claude Sonnet | wrote the extraction fill timer | used the browser's frame delta, not the game's own step. Wrong when the game is stepped headlessly: the ring never filled at the right speed. Fix: one `dtNow` per update, used everywhere. Caught by running bot playtests through `game.step`.
3. 2026-11-22 | Claude Sonnet | first economy numbers | AI set upgrade prices so a bot earned about 250 cash per run, which buys about 6 upgrades in 10 minutes against my target of 2 to 3. Fix: doubled cash costs. The target itself is an estimate, since there are no outside playtesters.
4. 2026-11-22 | Claude Sonnet | first bot sim | crude bot steering straight at loot got stuck on walls and collected 2 cubes in 82 s, which would have read as "the game is too hard". Fix: grid BFS pathing in the bot, which is what a person does by eye. Lesson: a dumb bot measures the bot.
