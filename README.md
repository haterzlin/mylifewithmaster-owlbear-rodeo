# My Life with Master

English version · [Česky](README.cs.md)

Public beta [Owlbear Rodeo](https://www.owlbear.rodeo/) extension for managing a **My Life with Master** game.

## Running

Requires Node.js and npm.

```bash
npm install
npm run dev -- --host 127.0.0.1
```

In Owlbear Rodeo, add the extension using the manifest:

```text
http://localhost:5173/manifest.json
```

Production manifest:

```text
https://lubomir.mlich.cz/lifewithmymaster/dist/manifest.json
```

To verify a production build:

```bash
npm run build
```

Tests:

```bash
npm test
```

The automated tests cover data normalization, player and Master permissions,
shared Acquaintances with individual Love values, d4 rolls and their effects
on minion stats, Horror manifestations, the Finale, ties, and removing
Acquaintances. There are currently 14 tests.

## Features

- shared description of the Master, the estate, and the surroundings;
- minions with Self-Loathing, Weariness, More Than Human, and Less Than Human attributes;
- all Acquaintances are visible to every minion, with an individual Love value
  for each minion;
- renaming and removing Acquaintances and their links by the Master;
- Master and player permissions;
- a separate Acquaintances section in the minion panel;
- game actions with d4 rolls: defying the Master's command, Violence, Villainy, and Approach;
- bonus dice: Intimacy d4, Desperation d6, and Sincerity d8;
- assistance, capture and escape, Horror Reveals, and the Endgame;
- a separate Endgame panel with multiple helpers and separate bonuses for both sides;
- automatic changes to Love, Self-Loathing, and Weariness after rolls;
- a Game Log synchronized between players in the room;
- data synchronization within an Owlbear Rodeo room;
- support for Owlbear Rodeo's light and dark themes, including live theme changes;
- switching between Czech and English; the language choice is saved in the browser.

## Development status

The project is available as a public beta. Data is stored in the metadata of
the current Owlbear Rodeo room. The extension is hosted at the production
manifest URL above but is not yet listed in the official Owlbear Rodeo
extension catalog.

This project is distributed under the [MIT License](LICENSE).
