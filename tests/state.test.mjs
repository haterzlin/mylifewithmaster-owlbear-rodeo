import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addAcquaintance,
  applyActionOutcome,
  attachAcquaintance,
  canEditMaster,
  canEditServant,
  emptyState,
  normalizeState,
  poolSize,
  rollDice,
  updateAcquaintance,
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

test("hráč upravuje jen vlastního služebníka, Vypravěč všechny", () => {
  assert.equal(canEditServant("PLAYER", "player-1", servant), true);
  assert.equal(canEditServant("PLAYER", "player-2", servant), false);
  assert.equal(canEditServant("GM", "player-2", servant), true);
  assert.equal(canEditMaster("PLAYER"), false);
  assert.equal(canEditMaster("GM"), true);
});

test("nová známost se uloží a připojí služebníkovi", () => {
  const state = { ...emptyState, servants: [{ ...servant }] };
  const acquaintance = { id: "acq-1", name: "Mlynář", description: "Pomáhá vesnici." };
  const result = addAcquaintance(state, servant.id, acquaintance);
  assert.deepEqual(result.acquaintances, [acquaintance]);
  assert.deepEqual(result.servants[0].acquaintances, [{ acquaintanceId: "acq-1", love: 0 }]);
});

test("známost lze připojit více služebníkům, ale ne dvakrát stejnému", () => {
  const state = { ...emptyState, servants: [{ ...servant }, { ...servant, id: "servant-2", ownerId: "player-2" }], acquaintances: [{ id: "acq-1", name: "Mlynář", description: "" }] };
  const once = attachAcquaintance(state, "servant-1", "acq-1");
  const twice = attachAcquaintance(once, "servant-1", "acq-1");
  const other = attachAcquaintance(twice, "servant-2", "acq-1");
  assert.equal(twice.servants[0].acquaintances.length, 1);
  assert.equal(other.servants[1].acquaintances.length, 1);
});

test("úprava známosti změní sdílený záznam", () => {
  const state = { ...emptyState, acquaintances: [{ id: "acq-1", name: "Mlynář", description: "Původní popis" }] };
  const result = updateAcquaintance(state, { id: "acq-1", name: "Starý mlynář", description: "Nový popis" });
  assert.deepEqual(result.acquaintances[0], { id: "acq-1", name: "Starý mlynář", description: "Nový popis" });
});

test("hod k4 ignoruje čtyřky a nikdy nevytvoří prázdnou hromádku", () => {
  const result = rollDice(3, 4, () => 0.99);
  assert.deepEqual(result.rolls, [4, 4, 4]);
  assert.equal(result.total, 0);
  assert.equal(poolSize(-3), 1);
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
