# Můj život s Pánem

[English](README.md) · Česká verze

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
vytváření a připojování známostí, úpravu sdílených známostí, hody k4 a následky
akcí na statistiky služebníků, Projevy hrůzy, Finále, remízy a odstranění známostí. Aktuálně je k dispozici 12 testů.

## Funkce

- společný popis Pána, sídla a prostředí;
- služebníci s atributy Sebenenávist, Únava, Více než lidský a Méně než lidský;
- sdílené známosti s individuální hodnotou Lásky pro každého služebníka;
- odstranění známosti Vypravěčem včetně jejích vazeb;
- oprávnění Vypravěče a hráčů;
- samostatné panely pro služebníky a známosti;
- herní akce s hody k4: Pánův příkaz, Násilí, Zlotřilost a Sbližování;
- bonusové kostky Intimita k4, Zoufalství k6 a Upřímnost k8;
- vzájemná výpomoc, zajetí a vymanění, Projevy hrůzy a Finále;
- samostatný panel Finále s více pomocníky a oddělenými bonusy obou stran;
- automatické změny Lásky, Sebenenávisti a Únavy po hodech;
- živý feed akcí synchronizovaný mezi hráči v místnosti;
- synchronizace dat v rámci místnosti Owlbear Rodeo.
- přebírání světlého/tmavého motivu Owlbear Rodeo včetně jeho změn za běhu.
- přepínání mezi českou a anglickou verzí; volba jazyka se uloží v prohlížeči.

## Stav vývoje

Projekt je zatím určen pouze pro lokální vývoj. Data se ukládají do metadat aktuální místnosti Owlbear Rodeo.
