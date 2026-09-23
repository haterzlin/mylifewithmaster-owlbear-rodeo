# Můj život s Pánem

Lokální rozšíření pro [Owlbear Rodeo](https://www.owlbear.rodeo/) ke správě hry **Můj život s Pánem**.

## Spuštění

Vyžaduje Node.js a npm.

```bash
npm install
npm run dev -- --host 127.0.0.1
```

V Owlbear Rodeo přidej rozšíření pomocí manifestu:

```text
http://localhost:5173/manifest.json
```

Pro ověření produkčního sestavení:

```bash
npm run build
```

Testy:

```bash
npm test
```

Automatické testy ověřují normalizaci dat, oprávnění hráčů a Vypravěče,
vytváření a připojování známostí a úpravu sdílených známostí.

## Funkce

- společný popis Pána, sídla a prostředí;
- služebníci s atributy Sebenenávist, Únava, Více než lidský a Méně než lidský;
- sdílené známosti s individuální hodnotou Lásky pro každého služebníka;
- oprávnění Vypravěče a hráčů;
- samostatné panely pro služebníky a známosti;
- synchronizace dat v rámci místnosti Owlbear Rodeo.

## Stav vývoje

Projekt je zatím určen pouze pro lokální vývoj. Data se ukládají do metadat aktuální místnosti Owlbear Rodeo.
