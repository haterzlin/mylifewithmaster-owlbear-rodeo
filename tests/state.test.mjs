import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addAcquaintance,
  applyFinaleOutcome,
  applyActionOutcome,
  canEditLove,
  canEditServant,
  emptyState,
  epilogueOptions,
  normalizeState,
  poolSize,
  removeAcquaintance,
  rollDice,
  validStartingStats,
} from "../src/state.ts";

const servant = {
  id: "servant-1",
  name: "Anna",
  ownerId: "player-1",
  selfHatred: 2,
  fatigue: 1,
  moreHuman: "",
  lessHuman: "",
  acquaintances: [],
};

test("normalizace doplní výchozí hodnoty a prázdné známosti", () => {
  const state = normalizeState({ servants: [{ ...servant }] });
  assert.deepEqual(state.master, emptyState.master);
  assert.deepEqual(state.servants[0].acquaintances, []);
});

test("normalizace odmítne poškozené typy a omezí čísla", () => {
  const state = normalizeState({
    master: { reason: Infinity, fear: "<script>" },
    environment: 42,
    servants: [null, { ...servant, selfHatred: 999999, acquaintances: "bad" }],
    acquaintances: "bad",
  });
  assert.equal(state.master.reason, 0);
  assert.equal(state.master.fear, 0);
  assert.equal(state.environment, "");
  assert.equal(state.servants.length, 1);
  assert.equal(state.servants[0].selfHatred, 100);
  assert.deepEqual(state.servants[0].acquaintances, []);
});

test("normalizace doplní Pozadí služebníka", () => {
  assert.equal(normalizeState({ servants: [{ ...servant, background: "Dříve žil ve městě." }] }).servants[0].background, "Dříve žil ve městě.");
  assert.equal(normalizeState({ servants: [{ ...servant }] }).servants[0].background, "");
});

test("hráč upravuje jen vlastního služebníka, Vypravěč všechny", () => {
  assert.equal(canEditServant("PLAYER", "player-1", servant), true);
  assert.equal(canEditServant("PLAYER", "player-2", servant), false);
  assert.equal(canEditServant("GM", "player-2", servant), true);
});

test("Lásku může ručně upravovat jen Vypravěč", () => {
  assert.equal(canEditLove("PLAYER"), false);
  assert.equal(canEditLove("GM"), true);
});

test("počáteční body musí být přesně tři celé nezáporné body", () => {
  assert.equal(validStartingStats(2, 1), true);
  assert.equal(validStartingStats(3, 0), true);
  assert.equal(validStartingStats(1.5, 1.5), false);
  assert.equal(validStartingStats(2, 2), false);
});

test("nová známost se uloží pouze vybranému služebníkovi", () => {
  const state = { ...emptyState, servants: [{ ...servant }, { ...servant, id: "servant-2", ownerId: "player-2" }] };
  const result = addAcquaintance(state, servant.id, { id: "acq-1", name: "Mlynář" });
  assert.deepEqual(result.servants[0].acquaintances, [{ id: "acq-1", name: "Mlynář", love: 0, description: "" }]);
  assert.deepEqual(result.servants[1].acquaintances, []);
});

test("normalizace zachová pouze vlastní známosti", () => {
  const state = normalizeState({ acquaintances: [{ id: "acq-1", name: "Mlynář" }], servants: [{ ...servant }] });
  assert.deepEqual(state.servants[0].acquaintances, [{ id: "acq-1", name: "Mlynář", love: 0, description: "" }]);
});

test("normalizace zachová Lásku a nepřidá cizí známosti", () => {
  const state = normalizeState({
    acquaintances: [{ id: "acq-1", name: "Mlynář" }, { id: "acq-2", name: "Kovář" }],
    servants: [{ ...servant, acquaintances: [{ acquaintanceId: "acq-1", love: 3 }] }],
  });
  assert.deepEqual(state.servants[0].acquaintances, [
    { id: "acq-1", name: "Mlynář", love: 3, description: "" },
  ]);
});

test("stejná známost má u každého služebníka vlastní popis", () => {
  const state = normalizeState({
    acquaintances: [{ id: "acq-1", name: "Mlynář" }],
    servants: [
      { ...servant, acquaintances: [{ id: "acq-1", name: "Mlynář", love: 1, description: "Připomíná mi otce." }] },
      { ...servant, id: "servant-2", acquaintances: [{ id: "acq-1", name: "Mlynář", love: 2, description: "Obdivuji její odvahu." }] },
    ],
  });
  assert.equal(state.servants[0].acquaintances[0].description, "Připomíná mi otce.");
  assert.equal(state.servants[1].acquaintances[0].description, "Obdivuji její odvahu.");
});

test("odstranění známosti smaže pouze záznam vybraného služebníka", () => {
  const state = { ...emptyState, servants: [
    { ...servant, acquaintances: [{ id: "acq-1", name: "Mlynář", love: 2, description: "" }] },
    { ...servant, id: "servant-2", acquaintances: [{ id: "acq-1", name: "Mlynář", love: 1, description: "" }] },
  ] };
  const result = removeAcquaintance(state, servant.id, "acq-1");
  assert.deepEqual(result.servants.map((item) => item.acquaintances), [[], [{ id: "acq-1", name: "Mlynář", love: 1, description: "" }]]);
});

test("hod k4 ignoruje čtyřky a nikdy nevytvoří prázdnou hromádku", () => {
  const result = rollDice(3, 4, () => 0.99);
  assert.deepEqual(result.rolls, [4, 4, 4]);
  assert.equal(result.total, 0);
  assert.equal(poolSize(-3), 1);
});

test("hod kostkami omezí neplatný nebo nebezpečně velký počet kostek", () => {
  const result = rollDice(Infinity, 4, () => 0);
  assert.equal(result.dice, 1);
  assert.equal(result.total, 1);
});

test("neúspěšné násilí zvýší Únavu o jedna", () => {
  const state = { ...emptyState, servants: [{ ...servant, fatigue: 2 }] };
  const result = applyActionOutcome(state, servant.id, "violence", "npc", false);
  assert.equal(result.servants[0].fatigue, 3);
  assert.equal(result.servants[0].selfHatred, servant.selfHatred);
});

test("sblížení vždy zvýší Lásku a při neúspěchu i Sebenenávist", () => {
  const state = { ...emptyState, servants: [{ ...servant, acquaintances: [{ id: "acq-1", name: "Mlynář", love: 0, description: "" }] }] };
  const result = applyActionOutcome(state, servant.id, "approach", "acq-1", false);
  assert.equal(result.servants[0].acquaintances[0].love, 1);
  assert.equal(result.servants[0].selfHatred, servant.selfHatred + 1);
});

test("Projev hrůzy zabrání zvýšení Sebenenávisti", () => {
  const state = { ...emptyState, servants: [{ ...servant, selfHatred: 3 }] };
  const result = applyActionOutcome(state, servant.id, "villainy", "npc", true, true);
  assert.equal(result.servants[0].selfHatred, 3);
});

test("neúspěšné Finále zvýší Únavu, úspěšné ho ukončí", () => {
  const helper = { ...servant, id: "helper-1", fatigue: 2 };
  const state = { ...emptyState, finaleServantId: servant.id, servants: [{ ...servant, fatigue: 1 }, helper] };
  assert.equal(applyFinaleOutcome(state, servant.id, false, false, [helper.id]).servants[0].fatigue, 2);
  assert.equal(applyFinaleOutcome(state, servant.id, false, false, [helper.id]).servants[1].fatigue, 3);
  assert.equal(applyFinaleOutcome(state, servant.id, true).finaleServantId, undefined);
});

test("Epilog vrátí všechny platné možnosti podle konečných statistik", () => {
  assert.deepEqual(epilogueOptions({ ...servant, selfHatred: 2, fatigue: 1, acquaintances: [{ id: "a", name: "A", love: 4, description: "" }] }, 2), ["joinVillagers"]);
  assert.deepEqual(epilogueOptions({ ...servant, selfHatred: 5, fatigue: 2, acquaintances: [] }, 2), ["killed", "selfDestruct", "sourceOfFear"]);
});

test("remíza nepřidá následky akce", () => {
  const state = { ...emptyState, servants: [{ ...servant, fatigue: 2 }] };
  const result = applyActionOutcome(state, servant.id, "violence", "npc", false, false, undefined, true);
  assert.deepEqual(result, state);
});

test("neúspěšná akce zvýší následky pomocníkovi", () => {
  const helper = { ...servant, id: "helper-1", fatigue: 2 };
  const state = { ...emptyState, servants: [{ ...servant }, helper] };
  const result = applyActionOutcome(state, servant.id, "violence", "npc", false, false, helper.id);
  assert.equal(result.servants[1].fatigue, 3);
  assert.equal(result.servants[1].selfHatred, helper.selfHatred);
});

test("pomocník při zlotřilosti ani při úspěchu nepřidá nesprávný následek", () => {
  const helper = { ...servant, id: "helper-1", selfHatred: 2, fatigue: 2 };
  const state = { ...emptyState, servants: [{ ...servant }, helper] };
  const result = applyActionOutcome(state, servant.id, "villainy", "npc", false, false, helper.id);
  assert.equal(result.servants[1].selfHatred, helper.selfHatred);
  assert.equal(result.servants[1].fatigue, helper.fatigue);
});

test("remíza ve Finále nezvýší Únavu a Finále pokračuje", () => {
  const state = { ...emptyState, finaleServantId: servant.id, servants: [{ ...servant, fatigue: 2 }] };
  const result = applyFinaleOutcome(state, servant.id, false, true);
  assert.equal(result.servants[0].fatigue, 2);
  assert.equal(result.finaleServantId, servant.id);
});

test("běžný hod k6 započítá šestku", () => {
  const result = rollDice(1, 6, () => 0.99);
  assert.deepEqual(result.rolls, [6]);
  assert.equal(result.total, 6);
});
