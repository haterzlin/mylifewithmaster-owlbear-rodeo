import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { addAcquaintance, applyActionOutcome, applyFinaleOutcome, canEditServant, emptyState, epilogueOptions, normalizeState, poolSize, removeAcquaintance as removeAcquaintanceState, rollDice } from "./state";
import type { ActionKind, BonusKind, EpilogueKind, GameState, Servant } from "./state";

const KEY = "com.mujzivotspanem/state";
const app = document.querySelector<HTMLDivElement>("#app")!;

let state = structuredClone(emptyState);
let role: "GM" | "PLAYER" = "PLAYER";
let playerId = "local";
type FeedEntry = { cs: string; en: string };
let feed: FeedEntry[] = [];
let finaleCompleted = false;
let view: { kind: "master" } | { kind: "servant"; id: string } | { kind: "finale"; servantId: string } | null = null;
type Language = "cs" | "en";
let language: Language = (localStorage.getItem("mlwm-language") as Language) || (navigator.language.toLowerCase().startsWith("cs") ? "cs" : "en");

function t(cs: string, en: string) {
  return language === "cs" ? cs : en;
}

function die(sides: number) {
  return `${language === "cs" ? "k" : "d"}${sides}`;
}

function applyTheme(theme: Awaited<ReturnType<typeof OBR.theme.getTheme>>) {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", theme.primary.main);
  root.style.setProperty("--color-primary-contrast", theme.primary.contrastText);
  root.style.setProperty("--color-background", theme.background.default);
  root.style.setProperty("--color-paper", theme.background.paper);
  root.style.setProperty("--color-text", theme.text.primary);
  root.style.setProperty("--color-text-secondary", theme.text.secondary);
  root.style.setProperty("--color-text-muted", theme.text.disabled);
  root.style.setProperty("--color-border", theme.text.disabled);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}

function selectorValue(value: string) {
  return CSS.escape(value);
}

function numberInput(label: string, name: string, value: number) {
  return `<label>${label}<input name="${name}" type="number" min="0" value="${escapeHtml(String(value))}" /></label>`;
}

function render() {
  const own = state.servants.find((servant) => servant.ownerId === playerId);
  const viewingServantId = view?.kind === "servant" ? view.id : view?.kind === "finale" ? view.servantId : undefined;
  if (viewingServantId && !state.servants.some((servant) => servant.id === viewingServantId)) view = null;
  if (view?.kind === "finale" && state.finaleServantId !== view.servantId) view = null;
  const header = `<header><div><h1>${t("Můj život s Pánem", "My Life with Master")}</h1><small>${t("Režim", "Role")}: ${role === "GM" ? t("Vypravěč", "Game Master") : t("Hráč", "Player")}</small></div><div class="header-actions">${view ? `<button id="back-to-characters">${t("← Zpět na seznam postav", "← Back to characters")}</button>` : ""}<button id="toggle-language" title="${t("Přepnout do angličtiny", "Switch to Czech")}">${language === "cs" ? "EN" : "CS"}</button></div></header>`;
  if (!view) {
    app.innerHTML = `${header}
      <section class="card"><div class="section-title"><h2>${t("Postavy", "Characters")}</h2>${own ? "" : `<button id="new-servant">${t("Vytvořit postavu", "Create character")}</button>`}</div>
        <div class="character-list"><button class="character" data-open-master><strong>${t("Pán", "Master")}</strong><span>${escapeHtml(state.master.name || t("Bezejmenný Pán", "Unnamed Master"))}</span></button>
        ${state.servants.map((servant) => `<button class="character" data-open-servant="${escapeHtml(servant.id)}"><strong>${t("Služebník", "Servant")}</strong><span>${escapeHtml(servant.name || t("Bezejmenný služebník", "Unnamed servant"))}</span></button>`).join("") || `<p class=muted>${t("Zatím není vytvořen žádný služebník.", "No servant has been created yet.")}</p>`}</div>
      </section>${finaleCompleted ? epilogueCard() : ""}${feedCard()}`;
    bindEvents();
    return;
  }
  if (view.kind === "master") app.innerHTML = `${header}${masterCard()}${feedCard()}`;
  else if (view.kind === "servant") app.innerHTML = `${header}${servantCard(state.servants.find((servant) => servant.id === viewingServantId)!)}${feedCard()}`;
  else app.innerHTML = `${header}${finaleCard(view.servantId)}${feedCard()}`;
  bindEvents();
}

function masterCard() {
  return `<section class="card ${role === "GM" ? "" : "readonly"}">
      <h2>${t("Pán", "Master")}</h2>
      <label>${t("Jméno", "Name")}<input id="master-name" value="${escapeHtml(state.master.name)}" ${role === "GM" ? "" : "disabled"} /></label>
      <label>${t("Popis", "Description")}<textarea id="master-description" rows="7" ${role === "GM" ? "" : "disabled"}>${escapeHtml(state.master.description)}</textarea></label>
      <h2>${t("Sídlo a prostředí", "Lair and environment")}</h2>
      <label><textarea id="environment" rows="6" ${role === "GM" ? "" : "disabled"}>${escapeHtml(state.environment)}</textarea></label>
      <div class="grid">${numberInput(t("Rozum", "Reason"), "master-reason", state.master.reason)}${numberInput(t("Strach", "Fear"), "master-fear", state.master.fear)}</div>
      ${role === "GM" ? `<button id="save-master">${t("Uložit Pána", "Save Master")}</button>` : ""}
    </section>${role === "GM" ? commandCard() : ""}`;
}

function commandCard() {
  return `<section class="card"><h2>${t("Pánův příkaz", "Master's command")}</h2><label>${t("Cíl", "Target")}<select id="command-target">${state.servants.length ? state.servants.map((servant) => `<option value="${escapeHtml(servant.id)}">${escapeHtml(servant.name || t("Služebník bez jména", "Unnamed servant"))}</option>`).join("") : `<option disabled selected>${t("Nejdříve vytvoř služebníka", "Create a servant first")}</option>`}</select></label><label>${t("Bonus Pána", "Master bonus")}<select id="command-master-bonus"><option value="none">${t("Bez bonusové kostky", "No bonus die")}</option><option value="intimacy">${t("Intimita", "Intimacy")} (${die(4)})</option><option value="despair">${t("Zoufalství", "Despair")} (${die(6)})</option></select></label><label>${t("Bonus služebníka", "Servant bonus")}<select id="command-servant-bonus"><option value="none">${t("Bez bonusové kostky", "No bonus die")}</option><option value="intimacy">${t("Intimita", "Intimacy")} (${die(4)})</option><option value="despair">${t("Zoufalství", "Despair")} (${die(6)})</option><option value="honesty">${t("Upřímnost", "Honesty")} (${die(8)})</option></select></label><button id="run-command" ${state.servants.length ? "" : "disabled"}>${t("Hodit", "Roll")}</button>${state.finaleServantId ? `<button data-open-finale="${escapeHtml(state.finaleServantId)}">${t("Otevřít Finále", "Open Finale")}</button>` : ""}</section>`;
}

function feedCard() {
  return `<section class="card feed"><h2>${t("Záznam hry", "Game Log")}</h2>${feed.length ? feed.map((item) => `<p>${escapeHtml(item[language]).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`).join("") : `<p class="muted">${t("Zatím zde nejsou žádné akce.", "No actions yet.")}</p>`}</section>`;
}

function servantCard(servant: Servant) {
  const editable = role === "GM" || servant.ownerId === playerId;
  return `<article class="servant ${editable ? "" : "readonly"}">
    ${editable ? `<label>${t("Jméno", "Name")}<input class="servant-name" name="name" value="${escapeHtml(servant.name)}" placeholder="${t("Jméno služebníka", "Servant name")}" /></label>` : `<h3>${escapeHtml(servant.name || t("Bezejmenný služebník", "Unnamed servant"))}</h3>`}
    ${servant.captured ? `<p class="notice">${t("Zajatý", "Captured")}</p>` : ""}${servant.horrorPending ? `<p class="notice">${t("Čeká Projev hrůzy", "Horror manifestation pending")}</p>` : ""}
    <div class="grid">${numberInput(t("Sebenenávist", "Self-hatred"), "selfHatred", servant.selfHatred).replace("<input", `<input ${editable ? "" : "disabled"}`)}${numberInput(t("Únava", "Fatigue"), "fatigue", servant.fatigue).replace("<input", `<input ${editable ? "" : "disabled"}`)}</div>
    <label>${t("Více než lidský", "More than human")}<textarea name="moreHuman" rows="2" ${editable ? "" : "disabled"}>${escapeHtml(servant.moreHuman)}</textarea></label>
    <label>${t("Méně než lidský", "Less than human")}<textarea name="lessHuman" rows="2" ${editable ? "" : "disabled"}>${escapeHtml(servant.lessHuman)}</textarea></label>
    ${editable ? `<button data-save-servant="${escapeHtml(servant.id)}">${t("Uložit služebníka", "Save servant")}</button>` : `<small class="muted">${t("Postava jiného hráče", "Another player's character")}</small>`}
  </article>${acquaintanceCard(servant)}${editable ? actionCard(servant) : ""}`;
}

function acquaintanceCard(servant: Servant) {
  const editable = role === "GM" || servant.ownerId === playerId;
  const linked = servant.acquaintances ?? [];
  const sortedLinked = [...linked].sort((a, b) => b.love - a.love);
  return `<section class="card acquaintances-section"><h2>${t("Známosti", "Acquaintances")}</h2>
    <table class="acquaintances"><thead><tr><th>${t("Jméno", "Name")}</th><th>${t("Láska", "Love")}</th><th></th></tr></thead><tbody>${sortedLinked.map((link) => {
      const acquaintance = state.acquaintances.find((item) => item.id === link.acquaintanceId);
      if (!acquaintance) return "";
      return `<tr><td>${escapeHtml(acquaintance.name)}</td><td><input class="love" type="number" min="0" value="${escapeHtml(String(link.love))}" data-love="${escapeHtml(servant.id)}" data-acquaintance="${escapeHtml(acquaintance.id)}" ${editable ? "" : "disabled"} /></td><td>${role === "GM" ? `<button class="remove-acquaintance" title="${t("Odebrat známost", "Remove acquaintance")}" data-remove-acquaintance="${escapeHtml(acquaintance.id)}">×</button>` : ""}</td></tr>`;
    }).join("")}${editable ? `<tr class="new-acquaintance"><td><input data-new-acquaintance-name="${escapeHtml(servant.id)}" placeholder="${t("Jméno nové známosti", "New acquaintance name")}" /></td><td></td><td><button data-create-acquaintance="${escapeHtml(servant.id)}" title="${t("Přidat známost", "Add acquaintance")}">+</button></td></tr>` : ""}</tbody></table>
    ${editable ? `<button data-save-servant="${escapeHtml(servant.id)}">${t("Uložit změny", "Save changes")}</button>` : ""}
  </section>`;
}

function actionCard(servant: Servant) {
  const targets = state.servants.filter((item) => item.id !== servant.id).map((item) => `<option value="servant:${escapeHtml(item.id)}">${escapeHtml(item.name || t("Bezejmenný služebník", "Unnamed servant"))}</option>`).join("");
  const acquaintances = servant.acquaintances.map((link) => state.acquaintances.find((item) => item.id === link.acquaintanceId)).filter(Boolean).map((item) => `<option value="acquaintance:${escapeHtml(item!.id)}">${escapeHtml(item!.name)}</option>`).join("");
  const helpers = state.servants.filter((item) => item.id !== servant.id).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || t("Bezejmenný služebník", "Unnamed servant"))}</option>`).join("");
  return `<section class="card action-box"><h2>${t("Herní akce", "Game actions")}</h2><select data-action-kind="${escapeHtml(servant.id)}"><option value="violence">${t("Násilí", "Violence")}</option><option value="villainy">${t("Zlotřilost", "Villainy")}</option><option value="approach">${t("Sbližování", "Approach")}</option></select><select data-action-target="${escapeHtml(servant.id)}"><option value="npc">${t("Vesničané / cizinci", "Villagers / strangers")}</option>${targets}${acquaintances}</select><select data-action-bonus="${escapeHtml(servant.id)}"><option value="none">${t("Bez bonusové kostky", "No bonus die")}</option><option value="intimacy">${t("Intimita", "Intimacy")} (${die(4)})</option><option value="despair">${t("Zoufalství", "Despair")} (${die(6)})</option><option value="honesty">${t("Upřímnost", "Honesty")} (${die(8)})</option></select><select data-action-helper="${escapeHtml(servant.id)}"><option value="">${t("Bez pomoci", "No help")}</option>${helpers}</select><button data-run-action="${escapeHtml(servant.id)}">${t("Hodit", "Roll")}</button>${servant.captured ? `<button data-escape="${escapeHtml(servant.id)}">${t("Vymanění ze zajetí", "Escape captivity")}</button>` : ""}${servant.horrorPending ? `<button data-clear-horror="${escapeHtml(servant.id)}">${t("Dokončit Projev hrůzy", "Complete horror manifestation")}</button>` : ""}</section>`;
}

function finaleCard(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId)!;
  const helpers = state.servants.filter((item) => item.id !== servantId).map((item) => `<label class="check"><input type="checkbox" data-finale-helper="${escapeHtml(item.id)}" /> ${escapeHtml(item.name || t("Bezejmenný služebník", "Unnamed servant"))} — ${t("Láska", "Love")} ${totalLove(item)} − ${t("Únava", "Fatigue")} ${item.fatigue}</label>`).join("");
  return `<section class="card finale"><h2>${t("Finále", "Finale")}</h2><p><strong>${escapeHtml(servant.name || t("Bezejmenný služebník", "Unnamed servant"))}</strong> ${t("se střetává s Pánem.", "faces the Master.")}</p><h3>${t("Pomocníci", "Helpers")}</h3>${helpers || `<p class="muted">${t("Nejsou k dispozici další služebníci.", "No other servants are available.")}</p>`}<label>${t("Bonus Pána", "Master bonus")}<select id="finale-master-bonus"><option value="none">${t("Bez bonusové kostky", "No bonus die")}</option><option value="intimacy">${t("Intimita", "Intimacy")} (${die(4)})</option><option value="despair">${t("Zoufalství", "Despair")} (${die(6)})</option></select></label><label>${t("Bonus služebníka", "Servant bonus")}<select id="finale-servant-bonus"><option value="none">${t("Bez bonusové kostky", "No bonus die")}</option><option value="intimacy">${t("Intimita", "Intimacy")} (${die(4)})</option><option value="despair">${t("Zoufalství", "Despair")} (${die(6)})</option><option value="honesty">${t("Upřímnost", "Honesty")} (${die(8)})</option></select></label><button data-run-finale="${escapeHtml(servantId)}">${t("Hodit Finále", "Roll Finale")}</button></section>`;
}

function epilogueCard() {
  const labels: Record<EpilogueKind, [string, string]> = {
    escape: ["uprchne, schová se nebo odejde pryč", "escapes, hides, or leaves"],
    killed: ["bude zabit", "is killed"],
    selfDestruct: ["zničí sám sebe", "destroys themselves"],
    joinVillagers: ["začlení se mezi vesničany", "joins the villagers"],
    sourceOfFear: ["povstane z popela Finále a stane se zdrojem Strachu", "rises from the ashes of the Finale and becomes a source of Fear"],
    newMaster: ["najde si nového Pána", "finds a new Master"],
  };
  return `<section class="card finale-results"><h2>${t("Epilogy", "Epilogues")}</h2><p class="muted">${t("Pán zemřel. U každé postavy vyberte jednu z platných možností; při více možnostech rozhoduje hráč.", "The Master is dead. Choose one valid ending for each character; when several apply, the player decides.")}</p>${state.servants.map((servant) => {
    const options = epilogueOptions(servant, state.master.reason);
    return `<div class="epilogue"><h3>${escapeHtml(servant.name || t("Bezejmenný služebník", "Unnamed servant"))}</h3><small>${t("Sebenenávist", "Self-hatred")} ${servant.selfHatred} · ${t("Únava", "Fatigue")} ${servant.fatigue} · ${t("Láska", "Love")} ${totalLove(servant)}</small><ul>${options.map((option) => `<li>${t(...labels[option])}</li>`).join("")}</ul></div>`;
  }).join("")}</section>`;
}

function formValue(selector: string) {
  return (document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? "").trim();
}

function inputNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
}

async function updateState(update: (current: GameState) => GameState) {
  const metadata = await OBR.room.getMetadata();
  const current = normalizeState(metadata[KEY] as Partial<GameState> | undefined);
  const next = update(structuredClone(current));
  await OBR.room.setMetadata({ [KEY]: next });
  state = next;
  return next;
}

async function publish(build: () => string) {
  const originalLanguage = language;
  language = "cs";
  const cs = build();
  language = "en";
  const en = build();
  language = originalLanguage;
  const entry = { cs: cs.slice(0, 2_000), en: en.slice(0, 2_000) };
  feed = [entry, ...feed].slice(0, 20);
  render();
  await OBR.broadcast.sendMessage(KEY, JSON.stringify(entry), { destination: "REMOTE" });
}

function totalLove(servant: Servant) {
  return servant.acquaintances.reduce((sum, link) => sum + link.love, 0);
}

function bonusSides(bonus: BonusKind) {
  return bonus === "intimacy" ? 4 : bonus === "despair" ? 6 : bonus === "honesty" ? 8 : 0;
}

function rollPool(pool: number, bonus: BonusKind) {
  const result = rollDice(pool);
  const sides = bonusSides(bonus);
  const extra = sides ? Math.floor(Math.random() * sides) + 1 : 0;
  return { ...result, total: result.total + extra, bonusRoll: extra, bonusSides: sides };
}

function rollLine(prefix: string, expression: string, values: string, roll: ReturnType<typeof rollPool>, bonus: BonusKind) {
  const bonusText = bonus === "intimacy" ? ` + ${t("Intimita", "Intimacy")}` : bonus === "despair" ? ` + ${t("Zoufalství", "Despair")}` : bonus === "honesty" ? ` + ${t("Upřímnost", "Honesty")}` : "";
  const diceText = `${roll.dice}${die(4)}${bonusSides(bonus) ? " + " + die(bonusSides(bonus)) : ""}`;
  const rollsText = `${roll.rolls.map((value) => value === 4 ? "4̶" : value).join(", ")}${roll.bonusRoll ? ` + ${roll.bonusRoll}` : ""}`;
  return `${prefix} (${expression})${bonusText} -> (${values}) = ${diceText} -> ${t("padlo", "rolled")} ${rollsText} -> ${roll.total}`;
}

async function runAction(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant || !canEditServant(role, playerId, servant)) return;
  const safeServantId = selectorValue(servantId);
  const kindValue = document.querySelector<HTMLSelectElement>(`[data-action-kind="${safeServantId}"]`)?.value;
  if (kindValue !== "violence" && kindValue !== "villainy" && kindValue !== "approach") return;
  const kind = kindValue as ActionKind;
  const target = document.querySelector<HTMLSelectElement>(`[data-action-target="${safeServantId}"]`)?.value;
  const bonusValue = document.querySelector<HTMLSelectElement>(`[data-action-bonus="${safeServantId}"]`)?.value || "none";
  if (!["none", "intimacy", "despair", "honesty"].includes(bonusValue)) return;
  const bonus = bonusValue as BonusKind;
  const helperId = document.querySelector<HTMLSelectElement>(`[data-action-helper="${safeServantId}"]`)?.value || undefined;
  if (!target) return;
  if (kind === "approach" && !target.startsWith("acquaintance:")) {
    await publish(() => t("Sbližovat se lze jenom se Známostí.", "You can only approach an Acquaintance."));
    return;
  }
  const targetId = target.split(":")[1];
  let opponent = 1;
  let actorRule = "Strach + Sebenenávist";
  let actorValues = `${state.master.fear} + ${servant.selfHatred}`;
  let opponentRule = "Rozum";
  let opponentValues = `${state.master.reason}`;
  let targetName = "vesničanů / cizinců";
  let opponentName = "Vesničané / cizinci";
  if (kind === "approach") {
    const acquaintance = state.acquaintances.find((item) => item.id === targetId);
    if (!acquaintance || !servant.acquaintances.some((link) => link.acquaintanceId === targetId)) return;
    opponent = poolSize(state.master.fear - state.master.reason);
    actorRule = "Rozum − Sebenenávist";
    actorValues = `${state.master.reason} - ${servant.selfHatred}`;
    opponentRule = "Strach − Rozum";
    opponentValues = `${state.master.fear} - ${state.master.reason}`;
    targetName = acquaintance.name;
    opponentName = acquaintance.name;
  } else if (target.startsWith("servant:")) {
    const other = state.servants.find((item) => item.id === targetId);
    if (!other) return;
    opponent = poolSize(state.master.fear + other.selfHatred);
    opponentRule = "Strach + Sebenenávist";
    opponentValues = `${state.master.fear} + ${other.selfHatred}`;
    targetName = other.name;
    opponentName = other.name;
  } else {
    const acquaintance = state.acquaintances.find((item) => item.id === targetId);
    if (target.startsWith("acquaintance:") && !acquaintance) return;
    opponent = poolSize(state.master.reason + (kind === "violence" ? servant.fatigue : 0));
    opponentRule = kind === "violence" ? "Rozum + Únava" : "Rozum";
    opponentValues = kind === "violence" ? `${state.master.reason} + ${servant.fatigue}` : `${state.master.reason}`;
    targetName = acquaintance?.name || "vesničanům / cizincům";
    opponentName = acquaintance?.name || "Vesničané / cizinci";
  }
  const helper = helperId ? state.servants.find((item) => item.id === helperId) : undefined;
  const helpDice = helper ? poolSize(totalLove(helper) - helper.fatigue) : 0;
  const actor = kind === "approach" ? poolSize(state.master.reason - servant.selfHatred) + helpDice : poolSize(state.master.fear + servant.selfHatred) + helpDice;
  const actorRoll = rollPool(actor, bonus);
  const opponentRoll = rollPool(opponent, "none");
  const tied = actorRoll.total === opponentRoll.total;
  const won = actorRoll.total > opponentRoll.total;
  const predictedSelfHatred = servant.selfHatred + (won ? 1 : kind === "approach" ? 1 : 0);
  const horror = !tied && predictedSelfHatred > totalLove(servant) + state.master.reason;
  const next = await updateState((current) => {
    let updated = applyActionOutcome(current, servantId, kind, targetId, won, horror, helperId, tied);
    updated = { ...updated, servants: updated.servants.map((item) => item.id === servantId && item.fatigue > updated.master.reason ? { ...item, captured: true } : item) };
    return updated;
  });
  const nextServant = next.servants.find((item) => item.id === servantId)!;
  const finaleHint = !tied && kind === "approach" && totalLove(servant) <= state.master.fear + servant.fatigue && totalLove(nextServant) > next.master.fear + nextServant.fatigue;
  const captured = Boolean(next.servants.find((item) => item.id === servantId)?.captured);
  const translateRule = (rule: string) => ({
    "Strach + Sebenenávist": t("Strach + Sebenenávist", "Fear + Self-hatred"),
    "Rozum": t("Rozum", "Reason"),
    "Rozum − Sebenenávist": t("Rozum − Sebenenávist", "Reason − Self-hatred"),
    "Strach − Rozum": t("Strach − Rozum", "Fear − Reason"),
    "Rozum + Únava": t("Rozum + Únava", "Reason + Fatigue"),
  }[rule] || rule);
  await publish(() => {
    const actorLine = rollLine(`${servant.name} ${t("hází", "rolls")}`, translateRule(actorRule) + (helpDice ? ` + ${t("pomoc", "help")} ${helpDice}${die(4)}` : ""), actorValues + (helpDice ? ` + ${helpDice}` : ""), actorRoll, bonus);
    const opponentLine = rollLine(`${t(opponentName, opponentName === "Vesničané / cizinci" ? "Villagers / strangers" : opponentName)} ${t("hází", "rolls")}`, translateRule(opponentRule), opponentValues, opponentRoll, "none");
    let consequence = tied ? t("remíza, scéna je přerušena", "tie, the scene is interrupted") : won ? t("uspěl", "succeeded") : t("neuspěl", "failed");
    if (!tied && kind === "approach") consequence += `; ${t("Láska", "Love")} +1` + (won ? "" : `, ${t("Sebenenávist", "Self-hatred")} +1`);
    else if (!tied && won) consequence += `; ${t("Sebenenávist", "Self-hatred")} +1`;
    else if (!tied && kind === "violence") consequence += `; ${t("Únava", "Fatigue")} +1`;
    if (horror) consequence += `; ${t("Projev hrůzy místo zvýšení Sebenenávisti", "Horror manifestation instead of increasing Self-hatred")}`;
    if (captured) consequence += `; ${t("služebník padá do zajetí", "the servant is captured")}`;
    const displayTarget = targetName === "vesničanům / cizincům" ? t("vesničanům / cizincům", "villagers / strangers") : targetName;
    const actionText = kind === "approach" ? `${t("Sbližování s", "Approach with")} ${displayTarget}` : `${kind === "violence" ? t("Násilí", "Violence") : t("Zlotřilost", "Villainy")} ${t("proti", "against")} ${displayTarget}`;
    return `**${servant.name} ${t("provádí", "performs")} ${actionText}**\n${actorLine}\n${opponentLine}\n${actorRoll.total} ${tied ? "=" : won ? ">" : "<"} ${opponentRoll.total} -> **${servant.name} ${(consequence + (!tied && helper ? `. ${t("Pomáhá", "Helped by")} ${helper.name}` : "")).replace(/; /g, ". ")}.**${finaleHint ? `\n**${t("Láska nyní převyšuje Strach + Únavu — úspěšný vzdor Pánovu příkazu spustí Finále.", "Love now exceeds Fear + Fatigue — successfully defying the Master's command starts the Finale.")}**` : ""}`;
  });
}

async function runCommand() {
  if (role !== "GM") return;
  const servantId = document.querySelector<HTMLSelectElement>("#command-target")?.value;
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant) return;
  const masterBonusValue = document.querySelector<HTMLSelectElement>("#command-master-bonus")?.value || "none";
  const servantBonusValue = document.querySelector<HTMLSelectElement>("#command-servant-bonus")?.value || "none";
  if (!["none", "intimacy", "despair"].includes(masterBonusValue) || !["none", "intimacy", "despair", "honesty"].includes(servantBonusValue)) return;
  const masterBonus = masterBonusValue as BonusKind;
  const servantBonus = servantBonusValue as BonusKind;
  const masterRoll = rollPool(poolSize(state.master.fear + servant.selfHatred), masterBonus);
  const servantRoll = rollPool(poolSize(totalLove(servant) - servant.fatigue), servantBonus);
  const tied = masterRoll.total === servantRoll.total;
  const won = masterRoll.total > servantRoll.total;
  const finale = !tied && !won && totalLove(servant) > state.master.fear + servant.fatigue;
  if (finale) {
    await updateState((current) => ({ ...current, finaleServantId: servant.id }));
  }
  await publish(() => {
    const consequence = tied ? t("Remíza, příkaz je přerušen", "Tie, the command is interrupted") : finale ? `${servant.name} ${t("se vzepřel Pánovi – začíná Finále", "defied the Master – Finale begins")}` : won ? `${servant.name} ${t("musí uposlechnout Pánův příkaz", "must obey the Master's command")}` : `${servant.name} ${t("se příkazu vzepřel", "defied the command")}${t(", Finále nezačalo, protože služebník má příliš nízkou Lásku", ", Finale did not start because the servant's Love is too low")}`;
    return `**${t("Pán přikazuje", "The Master commands")} ${servant.name}.**\n${rollLine(t("Pán hází", "Master rolls"), t("Strach + Sebenenávist", "Fear + Self-hatred"), `${state.master.fear} + ${servant.selfHatred}`, masterRoll, masterBonus)}\n${rollLine(`${servant.name} ${t("hází", "rolls")}`, t("Láska − Únava", "Love − Fatigue"), `${totalLove(servant)} - ${servant.fatigue}`, servantRoll, servantBonus)}\n${masterRoll.total} ${tied ? "=" : won ? ">" : "<"} ${servantRoll.total} -> **${consequence}.**`;
  });
}

async function escapeCaptivity(id: string) {
  const servant = state.servants.find((item) => item.id === id);
  if (!servant?.captured || !canEditServant(role, playerId, servant)) return;
  await updateState((current) => ({ ...current, servants: current.servants.map((item) => item.id === id ? { ...item, captured: false } : item) }));
  await publish(() => `${servant.name} ${t("se vymanil ze zajetí.", "escaped captivity.")}`);
}

async function clearHorror(id: string) {
  const servant = state.servants.find((item) => item.id === id);
  if (!servant?.horrorPending || !canEditServant(role, playerId, servant)) return;
  await updateState((current) => ({ ...current, servants: current.servants.map((item) => item.id === id ? { ...item, horrorPending: false } : item) }));
  await publish(() => `${servant.name} ${t("dokončil Projev hrůzy a vrací se do hry.", "completed the Horror manifestation and returns to play.")}`);
}

async function runFinale(id: string) {
  if (state.finaleServantId !== id) return;
  const servant = state.servants.find((item) => item.id === id);
  if (!servant || !canEditServant(role, playerId, servant)) return;
  const masterBonusValue = document.querySelector<HTMLSelectElement>("#finale-master-bonus")?.value || "none";
  const servantBonusValue = document.querySelector<HTMLSelectElement>("#finale-servant-bonus")?.value || "none";
  if (!["none", "intimacy", "despair"].includes(masterBonusValue) || !["none", "intimacy", "despair", "honesty"].includes(servantBonusValue)) return;
  const masterBonus = masterBonusValue as BonusKind;
  const servantBonus = servantBonusValue as BonusKind;
  const helperIds = [...document.querySelectorAll<HTMLInputElement>("[data-finale-helper]:checked")].map((input) => input.dataset.finaleHelper!);
  const helpers = helperIds.map((helperId) => state.servants.find((item) => item.id === helperId)).filter(Boolean) as Servant[];
  const helperDice = helpers.reduce((sum, helper) => sum + poolSize(totalLove(helper) - helper.fatigue), 0);
  const servantBase = poolSize(totalLove(servant) - servant.fatigue);
  const servantRoll = rollPool(servantBase + helperDice, servantBonus);
  const masterRoll = rollPool(poolSize(state.master.fear + servant.selfHatred), masterBonus);
  const tied = servantRoll.total === masterRoll.total;
  const won = servantRoll.total > masterRoll.total;
  await updateState((current) => applyFinaleOutcome(current, id, won, tied, helperIds));
  if (won) { finaleCompleted = true; view = null; }
  await publish(() => {
    const helperText = helpers.length ? ` + ${t("pomoc", "help")} ${helpers.map((helper) => helper.name).join(", ")}` : "";
    return `**${t("Finále", "Finale")}: ${servant.name}**\n${rollLine(`${servant.name} ${t("hází", "rolls")}`, t("Láska − Únava", "Love − Fatigue") + helperText, `${totalLove(servant)} - ${servant.fatigue}${helpers.length ? ` + ${helperDice}` : ""}`, servantRoll, servantBonus)}\n${rollLine(t("Pán hází", "Master rolls"), t("Strach + Sebenenávist", "Fear + Self-hatred"), `${state.master.fear} + ${servant.selfHatred}`, masterRoll, masterBonus)}\n${servantRoll.total} ${tied ? "=" : won ? ">" : "<"} ${masterRoll.total} -> **${tied ? t("Remíza, scéna je přerušena.", "Tie, the scene is interrupted.") : won ? t("Pán je zabit.", "The Master is killed.") : t("Pán přežil, Únava +1.", "The Master survives, Fatigue +1.")}**`;
  });
}

async function saveMaster() {
  if (role !== "GM") return;
  await updateState((current) => ({ ...current, master: {
    name: formValue("#master-name"), description: formValue("#master-description"),
    reason: inputNumber(formValue('[name="master-reason"]')), fear: inputNumber(formValue('[name="master-fear"]')),
  }, environment: formValue("#environment") }));
}

async function saveServant(id: string) {
  if (!document.querySelector(`[data-save-servant="${selectorValue(id)}"]`)) return;
  const servant = state.servants.find((item) => item.id === id);
  if (!servant || !canEditServant(role, playerId, servant)) return;
  const value = (name: string) => document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${selectorValue(name)}"]`)?.value.trim() ?? "";
  const next = {
    name: value("name"), moreHuman: value("moreHuman"), lessHuman: value("lessHuman"),
    selfHatred: inputNumber(value("selfHatred")), fatigue: inputNumber(value("fatigue")),
    acquaintances: servant.acquaintances.map((link) => ({ ...link, love: inputNumber(document.querySelector<HTMLInputElement>(`[data-love="${selectorValue(id)}"][data-acquaintance="${selectorValue(link.acquaintanceId)}"]`)?.value ?? "") })),
  };
  await updateState((current) => ({ ...current,
    servants: current.servants.map((item) => item.id === id ? {
    ...item, ...next,
  } : item) }));
  const changes: FeedEntry[] = [];
  if (servant.selfHatred !== next.selfHatred) changes.push({ cs: `Sebenenávist ${servant.selfHatred} → ${next.selfHatred}`, en: `Self-hatred ${servant.selfHatred} → ${next.selfHatred}` });
  if (servant.fatigue !== next.fatigue) changes.push({ cs: `Únava ${servant.fatigue} → ${next.fatigue}`, en: `Fatigue ${servant.fatigue} → ${next.fatigue}` });
  servant.acquaintances.forEach((link) => {
    const updated = next.acquaintances.find((item) => item.acquaintanceId === link.acquaintanceId);
    const acquaintance = state.acquaintances.find((item) => item.id === link.acquaintanceId);
    if (updated && updated.love !== link.love) changes.push({ cs: `Láska (${acquaintance?.name || "Známost"}) ${link.love} → ${updated.love}`, en: `Love (${acquaintance?.name || "Acquaintance"}) ${link.love} → ${updated.love}` });
  });
  if (servant.moreHuman !== next.moreHuman) changes.push({ cs: "změnil popis Více než lidský", en: "changed the More than human description" });
  if (servant.lessHuman !== next.lessHuman) changes.push({ cs: "změnil popis Méně než lidský", en: "changed the Less than human description" });
  if (changes.length) await publish(() => `${servant.name || t("Služebník", "Servant")}: ${changes.map((change) => change[language]).join(", ")}.`);
}

async function createAcquaintance(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant || !canEditServant(role, playerId, servant)) return;
  const name = formValue(`[data-new-acquaintance-name="${selectorValue(servantId)}"]`);
  if (!name) return;
  const acquaintance = { id: crypto.randomUUID(), name };
  await updateState((current) => addAcquaintance(current, servantId, acquaintance));
  render();
}

async function deleteAcquaintance(id: string) {
  if (role !== "GM") return;
  const acquaintance = state.acquaintances.find((item) => item.id === id);
  if (!acquaintance || !window.confirm(`Opravdu odstranit známost „${acquaintance.name}“ u všech služebníků?`)) return;
  await updateState((current) => removeAcquaintanceState(current, id));
  await publish(() => `${t("Známost", "Acquaintance")} ${acquaintance.name} ${t("byla odstraněna.", "was deleted.")}`);
}

async function createServant() {
  if (state.servants.some((servant) => servant.ownerId === playerId) && role !== "GM") return;
  await updateState((current) => ({ ...current, servants: [...current.servants, {
    id: crypto.randomUUID(), name: "Nový služebník", ownerId: playerId,
    selfHatred: 2, fatigue: 1, moreHuman: "", lessHuman: "",
    acquaintances: state.acquaintances.map((item) => ({ acquaintanceId: item.id, love: 0 })),
  }] }));
}

function bindEvents() {
  document.querySelector("#toggle-language")?.addEventListener("click", () => { language = language === "cs" ? "en" : "cs"; localStorage.setItem("mlwm-language", language); render(); });
  document.querySelector("#back-to-characters")?.addEventListener("click", () => { view = null; render(); });
  document.querySelector("[data-open-master]")?.addEventListener("click", () => { view = { kind: "master" }; render(); });
  document.querySelectorAll<HTMLElement>("[data-open-servant]").forEach((button) => button.addEventListener("click", () => { view = { kind: "servant", id: button.dataset.openServant! }; render(); }));
  document.querySelector("#save-master")?.addEventListener("click", () => void saveMaster());
  document.querySelector("#run-command")?.addEventListener("click", () => void runCommand());
  document.querySelector("#new-servant")?.addEventListener("click", () => {
    const own = state.servants.find((servant) => servant.ownerId === playerId);
    if (own) { view = { kind: "servant", id: own.id }; render(); }
    else void createServant();
  });
  document.querySelectorAll<HTMLElement>("[data-save-servant]").forEach((button) => button.addEventListener("click", () => void saveServant(button.dataset.saveServant!)));
  document.querySelectorAll<HTMLElement>("[data-create-acquaintance]").forEach((button) => button.addEventListener("click", () => void createAcquaintance(button.dataset.createAcquaintance!)));
  document.querySelectorAll<HTMLElement>("[data-remove-acquaintance]").forEach((button) => button.addEventListener("click", () => void deleteAcquaintance(button.dataset.removeAcquaintance!)));
  document.querySelectorAll<HTMLElement>("[data-run-action]").forEach((button) => button.addEventListener("click", () => void runAction(button.dataset.runAction!)));
  document.querySelectorAll<HTMLElement>("[data-open-finale]").forEach((button) => button.addEventListener("click", () => { view = { kind: "finale", servantId: button.dataset.openFinale! }; render(); }));
  document.querySelectorAll<HTMLElement>("[data-escape]").forEach((button) => button.addEventListener("click", () => void escapeCaptivity(button.dataset.escape!)));
  document.querySelectorAll<HTMLElement>("[data-clear-horror]").forEach((button) => button.addEventListener("click", () => void clearHorror(button.dataset.clearHorror!)));
  document.querySelectorAll<HTMLElement>("[data-run-finale]").forEach((button) => button.addEventListener("click", () => void runFinale(button.dataset.runFinale!)));
}

async function start() {
  applyTheme(await OBR.theme.getTheme());
  OBR.theme.onChange(applyTheme);
  playerId = OBR.player.id;
  role = await OBR.player.getRole();
  const metadata = await OBR.room.getMetadata();
  state = normalizeState(metadata[KEY] as Partial<GameState> | undefined);
  if (!metadata[KEY]) await OBR.room.setMetadata({ [KEY]: state });
  render();
  OBR.room.onMetadataChange((metadata) => { state = normalizeState(metadata[KEY] as Partial<GameState> | undefined); render(); });
  OBR.player.onChange(async (player) => { playerId = player.id; role = await OBR.player.getRole(); render(); });
  OBR.broadcast.onMessage(KEY, (event) => {
    if (typeof event.data !== "string") return;
    if (event.data.length > 10_000) return;
    try {
      const entry = JSON.parse(event.data) as FeedEntry;
      if (typeof entry.cs === "string" && typeof entry.en === "string" && entry.cs.length <= 2_000 && entry.en.length <= 2_000) feed = [entry, ...feed].slice(0, 20);
    } catch {
      // Ignore feed messages from older plugin versions.
    }
    render();
  });
}

if (OBR.isAvailable) OBR.onReady(() => void start());
else app.innerHTML = "<section class=card><h1>Vývojový náhled</h1><p>Otevři manifest v Owlbear Rodeo, aby se načetla synchronizace místnosti.</p></section>";
