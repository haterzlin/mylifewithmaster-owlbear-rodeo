# My Life with Master

English version · [Česky](README.cs.md)

Local [Owlbear Rodeo](https://www.owlbear.rodeo/) extension for managing a **My Life with Master** game.

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

To verify a production build:

```bash
npm run build
```

Tests:

```bash
npm test
```

The automated tests cover data normalization, player and Master permissions,
creating and connecting Connections, editing shared Connections, d4 rolls and
their effects on minion stats, Horror Reveals, the Endgame, ties, and removing
Connections. There are currently 12 tests.

## Features

- shared description of the Master, the estate, and the surroundings;
- minions with Self-Loathing, Weariness, More Than Human, and Less Than Human attributes;
- shared Connections with an individual Love value for each minion;
- removing a Connection and all its links by the Master;
- Master and player permissions;
- separate minion and Connection panels;
- game actions with d4 rolls: the Master's Command, Violence, Villainy, and State of Grace;
- bonus dice: Intimacy d4, Desperation d6, and Sincerity d8;
- assistance, capture and escape, Horror Reveals, and the Endgame;
- a separate Endgame panel with multiple helpers and separate bonuses for both sides;
- automatic changes to Love, Self-Loathing, and Weariness after rolls;
- a live action feed synchronized between players in the room;
- data synchronization within an Owlbear Rodeo room;
- support for Owlbear Rodeo's light and dark themes, including live theme changes;
- switching between Czech and English; the language choice is saved in the browser.

## Development status

The project is currently intended for local development only. Data is stored in
the metadata of the current Owlbear Rodeo room.
