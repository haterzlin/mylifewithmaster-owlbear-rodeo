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
  captured?: boolean;
  horrorPending?: boolean;
};

export type Acquaintance = { id: string; name: string; description: string };

export type GameState = {
  master: { name: string; description: string; reason: number; fear: number };
  environment: string;
  servants: Servant[];
  acquaintances: Acquaintance[];
  finaleServantId?: string;
};

export type ActionKind = "command" | "violence" | "villainy" | "approach";
export type BonusKind = "none" | "intimacy" | "despair" | "honesty";

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

export function removeAcquaintance(state: GameState, acquaintanceId: string): GameState {
  return {
    ...structuredClone(state),
    acquaintances: state.acquaintances.filter((item) => item.id !== acquaintanceId),
    servants: state.servants.map((servant) => ({
      ...servant,
      acquaintances: servant.acquaintances.filter((link) => link.acquaintanceId !== acquaintanceId),
    })),
  };
}

export function rollDice(dice: number, sides = 4, random = Math.random): DiceRoll {
  const rolls = Array.from({ length: Math.max(1, dice) }, () => Math.floor(random() * sides) + 1);
  return { dice: Math.max(1, dice), rolls, total: rolls.reduce((sum, roll) => sum + (sides === 4 && roll === 4 ? 0 : roll), 0) };
}

export function poolSize(value: number) {
  return Math.max(1, Math.floor(value));
}

export function applyActionOutcome(state: GameState, servantId: string, kind: ActionKind, acquaintanceId: string, won: boolean, horror = false, helperId?: string, tied = false): GameState {
  if (kind === "command") return structuredClone(state);
  if (tied) return structuredClone(state);
  const result = {
    ...structuredClone(state),
    servants: state.servants.map((servant) => {
      if (servant.id !== servantId) return servant;
      if (kind === "approach") return {
        ...servant,
        selfHatred: servant.selfHatred + (won || horror ? 0 : 1),
        horrorPending: horror || servant.horrorPending,
        acquaintances: servant.acquaintances.map((link) => link.acquaintanceId === acquaintanceId ? { ...link, love: link.love + 1 } : link),
      };
      return {
        ...servant,
        selfHatred: servant.selfHatred + (won && !horror ? 1 : 0),
        horrorPending: horror || servant.horrorPending,
        fatigue: servant.fatigue + (!won && kind === "violence" ? 1 : 0),
      };
    }),
  };
  if (helperId && !won) {
    result.servants = result.servants.map((servant) => servant.id === helperId
      ? { ...servant, selfHatred: servant.selfHatred + (kind === "violence" ? 0 : 1), fatigue: servant.fatigue + (kind === "violence" ? 1 : 0) }
      : servant);
  }
  return result;
}

export function applyFinaleOutcome(state: GameState, servantId: string, won: boolean, tied = false, helperIds: string[] = []): GameState {
  return {
    ...structuredClone(state),
    servants: state.servants.map((servant) => !won && !tied && (servant.id === servantId || helperIds.includes(servant.id))
      ? { ...servant, fatigue: servant.fatigue + 1 }
      : servant),
    finaleServantId: won ? undefined : state.finaleServantId,
  };
}
