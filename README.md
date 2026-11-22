# Bag Run

**Play it: https://nikhilxd.github.io/bag-run/** (phone or desktop browser, about 60 seconds a run)

A push-your-luck extraction run for mobile, made as the prototype for the LILA Games Game Designer written test (Question 1).

You drop into a small facility, grab glowing cubes, and get out through a green ring before the heat brings the hunters down. Every cube slows you. Every second you stay after the exit opens multiplies your payout and your risk. Die, and you keep 10% scrap plus any cubes you insured.

## Controls
- Mobile: drag anywhere to move (floating joystick), tap the gadget button to use it. Shooting is automatic.
- Desktop: WASD or arrows, Space for the gadget.

## Reviewer shortcuts
Add `?review=1` to the URL, or use the "reviewer tools" link on the title screen: skip to tomorrow, give 1000 cash, reset save, show telemetry, copy my stats. They let you see the day-2 hooks (Courier crate, Daily Contract, Handler's grudge) without waiting a day.

## What is in here
- `src/systems/`: pure game logic (map generator, economy, heat, save, handler director, meta hooks), unit tested.
- `src/scenes/`: Phaser scenes (title, run, end, stash, reviewer).
- `src/data/`: all tuning numbers (`economy.json`), contracts, Handler lines. Balance changes never touch code.
- `playtests/`: bot-played session logs and the sim summary. These are internal dev playtests (designer plus AI agent), not outside playtesters. See the files for what they do and do not show.
- `research/`, `docs/`: source notes and the written answers.

## Run locally
```
npm install
npm run dev      # http://localhost:5173/bag-run/
npm test
npm run build
```

Phaser 3 + TypeScript + Vite. No backend, no API keys, one localStorage key (`bagrun.save.v1`).

## AI use

Claude Opus wrote the plan. Claude Sonnet in Claude Code wrote the code, tests, Handler line bank and first drafts of the writeups. Nikhil Dhamjevar set the concept, targets and honesty rules and edited the drafts. No AI model runs inside the game. The full log, including where the AI got things wrong, is in [ai_log.md](ai_log.md); the unedited first draft of the Q3 Duo section is in [ai_drafts/](ai_drafts/).

## Notes

- No outside player has tested this build. Run numbers in `playtests/` come from a bot sim, not human data.
- The written test answers (Q1 writeup, Q2 strategy, Q3 feature spec) are submitted separately as PDFs.
