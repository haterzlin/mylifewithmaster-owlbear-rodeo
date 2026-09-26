import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addAcquaintance,
  applyFinaleOutcome,
  applyActionOutcome,
  canEditServant,
  emptyState,
  epilogueOptions,
  normalizeState,
  poolSize,
  removeAcquaintance,
  rollDice,
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
  assert.deepEqual(state.acquaintances, []);
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
  assert.deepEqual(state.acquaintances, []);
});

test("hráč upravuje jen vlastního služebníka, Vypravěč všechny", () => {
  assert.equal(canEditServant("PLAYER", "player-1", servant), true);
  assert.equal(canEditServant("PLAYER", "player-2", servant), false);
  assert.equal(canEditServant("GM", "player-2", servant), true);
});

test("nová známost se uloží všem služebníkům s vlastní Láskou", () => {
  const state = { ...emptyState, servants: [{ ...servant }, { ...servant, id: "servant-2", ownerId: "player-2" }] };
  const acquaintance = { id: "acq-1", name: "Mlynář" };
  const result = addAcquaintance(state, acquaintance);
  assert.deepEqual(result.acquaintances, [acquaintance]);
  assert.deepEqual(result.servants.map((item) => item.acquaintances), [[{ acquaintanceId: "acq-1", love: 0 }], [{ acquaintanceId: "acq-1", love: 0 }]]);
});

test("normalizace doplní každému služebníkovi všechny známosti", () => {
  const state = normalizeState({ acquaintances: [{ id: "acq-1", name: "Mlynář" }], servants: [{ ...servant }] });
  assert.deepEqual(state.servants[0].acquaintances, [{ acquaintanceId: "acq-1", love: 0 }]);
});

test("odstranění známosti smaže záznam i vazby všech služebníků", () => {
  const state = { ...emptyState, acquaintances: [{ id: "acq-1", name: "Mlynář" }], servants: [
    { ...servant, acquaintances: [{ acquaintanceId: "acq-1", love: 2 }] },
    { ...servant, id: "servant-2", acquaintances: [{ acquaintanceId: "acq-1", love: 1 }] },
  ] };
  const result = removeAcquaintance(state, "acq-1");
  assert.deepEqual(result.acquaintances, []);
  assert.deepEqual(result.servants.map((item) => item.acquaintances), [[], []]);
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
  const state = { ...emptyState, servants: [{ ...servant, acquaintances: [{ acquaintanceId: "acq-1", love: 0 }] }] };
  const result = applyActionOutcome(state, servant.id, "approach", "acq-1", false);
  assert.equal(result.servants[0].acquaintances[0].love, 1);
  assert.equal(result.servants[0].selfHatred, servant.selfHatred + 1);
});

test("Projev hrůzy zabrání zvýšení Sebenenávisti a označí další scénu", () => {
  const state = { ...emptyState, servants: [{ ...servant, selfHatred: 3 }] };
  const result = applyActionOutcome(state, servant.id, "villainy", "npc", true, true);
  assert.equal(result.servants[0].selfHatred, 3);
  assert.equal(result.servants[0].horrorPending, true);
});

test("neúspěšné Finále zvýší Únavu, úspěšné ho ukončí", () => {
  const helper = { ...servant, id: "helper-1", fatigue: 2 };
  const state = { ...emptyState, finaleServantId: servant.id, servants: [{ ...servant, fatigue: 1 }, helper] };
  assert.equal(applyFinaleOutcome(state, servant.id, false, false, [helper.id]).servants[0].fatigue, 2);
  assert.equal(applyFinaleOutcome(state, servant.id, false, false, [helper.id]).servants[1].fatigue, 3);
  assert.equal(applyFinaleOutcome(state, servant.id, true).finaleServantId, undefined);
});

test("Epilog vrátí všechny platné možnosti podle konečných statistik", () => {
  assert.deepEqual(epilogueOptions({ ...servant, selfHatred: 2, fatigue: 1, acquaintances: [{ acquaintanceId: "a", love: 4 }] }, 2), ["joinVillagers"]);
  assert.deepEqual(epilogueOptions({ ...servant, selfHatred: 5, fatigue: 2, acquaintances: [] }, 2), ["killed", "selfDestruct", "sourceOfFear"]);
});

test("remíza nepřidá následky akce", () => {
  const state = { ...emptyState, servants: [{ ...servant, fatigue: 2 }] };
  const result = applyActionOutcome(state, servant.id, "violence", "npc", false, false, undefined, true);
  assert.deepEqual(result, state);
});
