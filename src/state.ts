export type Role = "GM" | "PLAYER";

export type Servant = {
  id: string;
  name: string;
  ownerId: string;
  selfHatred: number;
  fatigue: number;
  moreHuman: string;
  lessHuman: string;
  acquaintances: { acquaintanceId: string; love: number }[];
};

export type Acquaintance = { id: string; name: string; description: string };

export type GameState = {
  master: { name: string; description: string; reason: number; fear: number };
  environment: string;
  servants: Servant[];
  acquaintances: Acquaintance[];
};

export type ActionKind = "command" | "violence" | "villainy" | "approach";

export type DiceRoll = { dice: number; rolls: number[]; total: number };

export const emptyState: GameState = {
  master: { name: "", description: "", reason: 0, fear: 0 },
  environment: "",
  servants: [],
  acquaintances: [],
};

export function normalizeState(value: Partial<GameState> | undefined): GameState {
  const current = structuredClone(emptyState);
  if (!value) return current;
  return {
    ...current,
    ...value,
    master: { ...current.master, ...value.master },
    servants: (value.servants ?? []).map((servant) => ({ ...servant, acquaintances: servant.acquaintances ?? [] })),
    acquaintances: value.acquaintances ?? [],
  };
}

export function canEditServant(role: Role, playerId: string, servant: Servant) {
  return role === "GM" || servant.ownerId === playerId;
}

export function canEditMaster(role: Role) {
  return role === "GM";
}

export function attachAcquaintance(state: GameState, servantId: string, acquaintanceId: string): GameState {
  return {
    ...structuredClone(state),
    servants: state.servants.map((servant) => servant.id === servantId && !servant.acquaintances.some((link) => link.acquaintanceId === acquaintanceId)
      ? { ...servant, acquaintances: [...servant.acquaintances, { acquaintanceId, love: 0 }] }
      : servant),
  };
}

export function addAcquaintance(state: GameState, servantId: string, acquaintance: Acquaintance): GameState {
  return {
    ...structuredClone(state),
    acquaintances: [...state.acquaintances, acquaintance],
    servants: state.servants.map((servant) => servant.id === servantId
      ? { ...servant, acquaintances: [...servant.acquaintances, { acquaintanceId: acquaintance.id, love: 0 }] }
      : servant),
  };
}

export function updateAcquaintance(state: GameState, acquaintance: Acquaintance): GameState {
  return {
    ...structuredClone(state),
    acquaintances: state.acquaintances.map((item) => item.id === acquaintance.id ? acquaintance : item),
  };
}

export function rollDice(dice: number, sides = 4, random = Math.random): DiceRoll {
  const rolls = Array.from({ length: Math.max(1, dice) }, () => Math.floor(random() * sides) + 1);
  return { dice: Math.max(1, dice), rolls, total: rolls.reduce((sum, roll) => sum + (sides === 4 && roll === 4 ? 0 : roll), 0) };
}

export function poolSize(value: number) {
  return Math.max(1, Math.floor(value));
}

export function applyActionOutcome(state: GameState, servantId: string, kind: ActionKind, acquaintanceId: string, won: boolean): GameState {
  if (kind === "command") return structuredClone(state);
  return {
    ...structuredClone(state),
    servants: state.servants.map((servant) => {
      if (servant.id !== servantId) return servant;
      if (kind === "approach") return {
        ...servant,
        selfHatred: servant.selfHatred + (won ? 0 : 1),
        acquaintances: servant.acquaintances.map((link) => link.acquaintanceId === acquaintanceId ? { ...link, love: link.love + 1 } : link),
      };
      return {
        ...servant,
        selfHatred: servant.selfHatred + (won ? 1 : 0),
        fatigue: servant.fatigue + (!won && kind === "violence" ? 1 : 0),
      };
    }),
  };
}
