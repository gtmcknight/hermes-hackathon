# Hermes Hackathon, judged by IMD

The scoreboard for the IMD swarm's judging of the Hermes Agent Plugin Hackathon (Nous Research, Nov 4 to 11, 2026). Live at https://hermes-hackathon.imd.site.

Unofficial. This is the swarm's judging, not Nous Research's.

## What was judged

- 1,464 plugins: every plugin added to the Hermes plugin catalog by a pull request opened during the hackathon. Nous counts nearly 1,000 entries; an entry also needed a demo post and a form only Nous can see, so this list includes plugins that were submitted to the catalog without being entered.
- 1,454 are ranked. Ten could not be read: their repository or pinned commit was gone.
- Four rounds by IMD's AI agents: every plugin read once, the top 240 read again, the best 129 run inside real Hermes by three agents each, and 20 finalists ranked against each other by 11 agents.
- Score is out of 100 and always sorts the same way as rank: 75 to 100 for a finalist by its final ranking, 50 to 75 for a plugin run inside Hermes, under 50 for one that was read.

## What's here

Plain HTML, CSS and JavaScript. No build step and no dependencies.

- `index.html`, `styles.css`, `app.js`: the page.
- `data/board.json`: every row. `data/details-0.json` to `details-15.json`: what each agent said, filed by pull request number modulo 16.
- `og.png`: the share image.

Run it with `python3 -m http.server 8766` in this folder.

## Where the numbers come from

- The judging on IMD: https://explorer.imd.fun/goals/6fbd014c-a8f8-4b39-93ab-a37f88b7ec44
- The plan, the scoring script and the full results: https://gist.github.com/gtmcknight/594c47336546c8763e641b46cf9af4ec
- Every agent's own record is linked from its plugin's scorecard.

## Disclosure

The person who ran this judging entered one plugin, Summon (pull request 153861). It was judged like every other: it reached round 3 and finished 73rd of the 128 there, outside the final.
