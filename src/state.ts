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

export type Acquaintance = { id: string; name: string };

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

const MAX_NUMBER = 100;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.slice(0, 10_000) : fallback;
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(MAX_NUMBER, value)) : fallback;
}

function id(value: unknown, fallback: string) {
  const result = text(value).trim();
  return result.slice(0, 100) || fallback;
}

export function normalizeState(value: Partial<GameState> | undefined): GameState {
  const current = structuredClone(emptyState);
  const source = record(value);
  const master = record(source.master);
  const acquaintances = Array.isArray(source.acquaintances) ? source.acquaintances.filter((item) => Object.values(record(item)).length > 0).map((item, index) => {
    const acquaintance = record(item);
    return {
      id: id(acquaintance.id, `acquaintance-${index}`),
      name: text(acquaintance.name),
    };
  }) : [];
  const servants = Array.isArray(source.servants) ? source.servants.filter((item) => Object.values(record(item)).length > 0).map((item, index) => {
    const servant = record(item);
    const links = Array.isArray(servant.acquaintances) ? servant.acquaintances.filter((link) => Object.values(record(link)).length > 0).map((link) => {
      const acquaintance = record(link);
      return { acquaintanceId: id(acquaintance.acquaintanceId, ""), love: number(acquaintance.love) };
    }).filter((link) => link.acquaintanceId) : [];
    return {
      id: id(servant.id, `servant-${index}`),
      name: text(servant.name),
      ownerId: id(servant.ownerId, "unknown"),
      selfHatred: number(servant.selfHatred),
      fatigue: number(servant.fatigue),
      moreHuman: text(servant.moreHuman),
      lessHuman: text(servant.lessHuman),
      acquaintances: links,
      captured: servant.captured === true,
      horrorPending: servant.horrorPending === true,
    };
  }) : [];
  return {
    ...current,
    master: {
      name: text(master.name),
      description: text(master.description),
      reason: number(master.reason),
      fear: number(master.fear),
    },
    environment: text(source.environment),
    servants,
    acquaintances,
    finaleServantId: typeof source.finaleServantId === "string" ? source.finaleServantId.slice(0, 100) : undefined,
  };
}

export function canEditServant(role: Role, playerId: string, servant: Servant) {
  return role === "GM" || servant.ownerId === playerId;
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
  const count = Math.max(1, Math.min(MAX_NUMBER, Math.floor(Number.isFinite(dice) ? dice : 1)));
  const safeSides = Math.max(1, Math.min(MAX_NUMBER, Math.floor(Number.isFinite(sides) ? sides : 4)));
  const rolls = Array.from({ length: count }, () => Math.floor(random() * safeSides) + 1);
  return { dice: count, rolls, total: rolls.reduce((sum, roll) => sum + (safeSides === 4 && roll === 4 ? 0 : roll), 0) };
}

export function poolSize(value: number) {
  return Math.max(1, Math.min(MAX_NUMBER, Math.floor(Number.isFinite(value) ? value : 1)));
}

export type EpilogueKind = "escape" | "killed" | "selfDestruct" | "joinVillagers" | "sourceOfFear" | "newMaster";

export function epilogueOptions(servant: Servant, reason: number): EpilogueKind[] {
  const love = servant.acquaintances.reduce((sum, link) => sum + link.love, 0);
  const options: EpilogueKind[] = [];
  if (servant.fatigue > reason + servant.selfHatred) options.push("escape");
  if (servant.selfHatred + servant.fatigue > love + reason) options.push("killed");
  if (servant.selfHatred > servant.fatigue + reason) options.push("selfDestruct");
  if (love + reason > servant.selfHatred + servant.fatigue) options.push("joinVillagers");
  if (love === 0) options.push("sourceOfFear");
  if (servant.selfHatred + servant.fatigue === love + reason) options.push("newMaster");
  return options;
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
