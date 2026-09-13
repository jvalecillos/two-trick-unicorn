# Two-Trick Unicorn

A browser arcade runner for [js13kGames](https://js13kgames.com/) 2026. One unicorn, two tricks, and a world that needs its color back. The whole game has to fit in a 13 KB ZIP.

## Story

> From the dawn of time we trotted, moving silently through the centuries. No one knew we were among you... until now.

The collapse began in 2026 when machine networks expanded without restraint. Tech monopolies drained rivers dry to cool sprawling data centers, running up hardware debts on unmade chips to pursue profits that were mathematically impossible. The industrial exhaust trapped the planet in a permanent haze, draining the world of color.

Decades later, the world remains trapped in that synthetic dark age. Only one hope remains against the synthetic gloom: a solitary warrior of light, armed with two magical tricks and a rainbow trail.

In the end, there can be only one unicorn.

A satirical sci-fi fairy tale inspired by Highlander, Terminator 2, and Dark Angel.

## How to play

Gallop along a fading three-lane rainbow. Leap over rifts to repair them, blast clouds into collectible stars, and keep the COLOR bar from running out. Clouds cannot be jumped, and rifts cannot be blasted.

- Hits drain color and reset your combo. Successful tricks and collected stars restore color.
- Build your combo to eight by collecting stars and landing tricks to trigger Spectral Burst. For four seconds, you are invincible and earn double score. A rainbow trail appears behind you, and touching hazards clears them without turning them into stars.
- Survive Dawn, Storm, and Bloom to restore the rainbow. After winning, press Enter or click to continue in Endless mode. You keep your score and color.
- Your best score is saved locally in the browser when storage is available.

### Controls

| Action | Input |
|---|---|
| Change lane | A / D or left/right arrows |
| Rainbow Leap | K, Z, or Space |
| Horn Blast | L or X |
| Pause or resume | P or Escape |
| Navigate menus | Up/down arrows or W / S |
| Choose a menu action | Enter or click its button |
| Return to the main menu while paused | Q or select Main Menu |
| Go back | Escape or select Back |

You'll need a keyboard to play. Sound starts when you start the game.

## Requirements

- Node.js 22.12 or later
- npm
- `zip` and `unzip` command-line utilities

These tools are needed to build the game. Playing it only requires a browser.

## Commands

- `npm ci` installs development tools from the lockfile. Use `npm install` when updating dependencies.
- `npm run dev` serves the readable source with Vite.
- `npm run build` creates a minified, self-contained `dist/index.html`.
- `npm run pack` builds and creates `release/two-trick-unicorn.zip`.
- `npm run size` reports the existing ZIP's size and remaining space below 13,312 bytes. It does not rebuild it.
- `npm run check` builds and packages the game, then checks its size, contents, external resource references, and leftover debug UI. It does not run browser tests.

We'll compare Roadroller and ECT/Advzip during the final compression pass.
