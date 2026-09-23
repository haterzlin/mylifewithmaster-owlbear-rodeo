import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { addAcquaintance, applyActionOutcome, applyFinaleOutcome, attachAcquaintance as attachAcquaintanceState, canEditServant, emptyState, normalizeState, poolSize, removeAcquaintance as removeAcquaintanceState, rollDice, updateAcquaintance as updateAcquaintanceState } from "./state";
import type { ActionKind, BonusKind, GameState, Servant } from "./state";

const KEY = "com.mujzivotspanem/state";
const app = document.querySelector<HTMLDivElement>("#app")!;

let state = structuredClone(emptyState);
let role: "GM" | "PLAYER" = "PLAYER";
let playerId = "local";
let feed: string[] = [];
let view: { kind: "master" } | { kind: "servant"; id: string } | { kind: "acquaintances"; servantId: string; acquaintanceId: string | null } | { kind: "finale"; servantId: string } | null = null;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}

function numberInput(label: string, name: string, value: number) {
  return `<label>${label}<input name="${name}" type="number" min="0" value="${value}" /></label>`;
}

function render() {
  const own = state.servants.find((servant) => servant.ownerId === playerId);
  const viewingServantId = view?.kind === "servant" ? view.id : view?.kind === "acquaintances" || view?.kind === "finale" ? view.servantId : undefined;
  if (viewingServantId && !state.servants.some((servant) => servant.id === viewingServantId)) view = null;
  const header = `<header><div><h1>Můj život s Pánem</h1><small>Režim: ${role === "GM" ? "Vypravěč" : "Hráč"}</small></div>${view ? `<button id="back-to-characters">${view.kind === "acquaintances" ? "← Zpět na služebníka" : "← Zpět na seznam postav"}</button>` : ""}</header>`;
  if (!view) {
    app.innerHTML = `${header}
      <section class="card"><div class="section-title"><h2>Postavy</h2>${own ? "" : '<button id="new-servant">Vytvořit postavu</button>'}</div>
        <div class="character-list"><button class="character" data-open-master><strong>Pán</strong><span>${escapeHtml(state.master.name || "Bezejmenný Pán")}</span></button>
        ${state.servants.map((servant) => `<button class="character" data-open-servant="${servant.id}"><strong>Služebník</strong><span>${escapeHtml(servant.name || "Bezejmenný služebník")}</span></button>`).join("") || "<p class=muted>Zatím není vytvořen žádný služebník.</p>"}</div>
      </section>${feedCard()}`;
    bindEvents();
    return;
  }
  if (view.kind === "master") app.innerHTML = `${header}${masterCard()}${feedCard()}`;
  else if (view.kind === "servant") app.innerHTML = `${header}${servantCard(state.servants.find((servant) => servant.id === viewingServantId)!)}${feedCard()}`;
  else if (view.kind === "acquaintances") app.innerHTML = `${header}${acquaintanceCard(view.servantId)}${feedCard()}`;
  else app.innerHTML = `${header}${finaleCard(view.servantId)}${feedCard()}`;
  bindEvents();
}

function masterCard() {
  return `<section class="card ${role === "GM" ? "" : "readonly"}">
      <h2>Pán</h2>
      <label>Jméno<input id="master-name" value="${escapeHtml(state.master.name)}" ${role === "GM" ? "" : "disabled"} /></label>
      <label>Popis<textarea id="master-description" rows="7" ${role === "GM" ? "" : "disabled"}>${escapeHtml(state.master.description)}</textarea></label>
      <h2>Sídlo a prostředí</h2>
      <label><textarea id="environment" rows="6" ${role === "GM" ? "" : "disabled"}>${escapeHtml(state.environment)}</textarea></label>
      <div class="grid">${numberInput("Rozum", "master-reason", state.master.reason)}${numberInput("Strach", "master-fear", state.master.fear)}</div>
      ${role === "GM" ? '<button id="save-master">Uložit Pána</button>' : ""}
    </section>${role === "GM" ? commandCard() : ""}`;
}

function commandCard() {
  return `<section class="card"><h2>Pánův příkaz</h2><label>Cíl<select id="command-target">${state.servants.length ? state.servants.map((servant) => `<option value="${servant.id}">${escapeHtml(servant.name || "Služebník bez jména")}</option>`).join("") : '<option disabled selected>Nejdříve vytvoř služebníka</option>'}</select></label><label>Bonus Pána<select id="command-master-bonus"><option value="none">Bez bonusové kostky</option><option value="intimacy">Intimita (k4)</option><option value="despair">Zoufalství (k6)</option></select></label><label>Bonus služebníka<select id="command-servant-bonus"><option value="none">Bez bonusové kostky</option><option value="intimacy">Intimita (k4)</option><option value="despair">Zoufalství (k6)</option><option value="honesty">Upřímnost (k8)</option></select></label><button id="run-command" ${state.servants.length ? "" : "disabled"}>Hodit</button>${state.finaleServantId ? `<button data-open-finale="${state.finaleServantId}">Otevřít Finále</button>` : ""}</section>`;
}

function feedCard() {
  return `<section class="card feed"><h2>Živý feed</h2>${feed.length ? feed.map((item) => `<p>${escapeHtml(item).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`).join("") : '<p class="muted">Zatím zde nejsou žádné akce.</p>'}</section>`;
}

function servantCard(servant: Servant) {
  const editable = role === "GM" || servant.ownerId === playerId;
  const acquaintances = state.acquaintances;
  const linked = servant.acquaintances ?? [];
  const linkedIds = new Set(linked.map((link) => link.acquaintanceId));
  return `<article class="servant ${editable ? "" : "readonly"}">
    <h3>${escapeHtml(servant.name || "Bezejmenný služebník")}</h3>
    ${servant.captured ? '<p class="notice">Zajatý</p>' : ""}${servant.horrorPending ? '<p class="notice">Čeká Projev hrůzy</p>' : ""}
    <div class="grid">${numberInput("Sebenenávist", "selfHatred", servant.selfHatred).replace("<input", `<input ${editable ? "" : "disabled"}`)}${numberInput("Únava", "fatigue", servant.fatigue).replace("<input", `<input ${editable ? "" : "disabled"}`)}</div>
    <label>Více než lidský<textarea name="moreHuman" rows="2" ${editable ? "" : "disabled"}>${escapeHtml(servant.moreHuman)}</textarea></label>
    <label>Méně než lidský<textarea name="lessHuman" rows="2" ${editable ? "" : "disabled"}>${escapeHtml(servant.lessHuman)}</textarea></label>
    <h3>Známosti</h3>
    ${linked.length ? `<table class="acquaintances"><thead><tr><th>Známost</th><th>Láska</th></tr></thead><tbody>${linked.map((link) => {
      const acquaintance = acquaintances.find((item) => item.id === link.acquaintanceId);
      if (!acquaintance) return "";
      const title = escapeHtml(acquaintance.description || "Bez popisu");
      const name = `<button class="link-button" title="${title}" data-open-acquaintance="${servant.id}:${acquaintance.id}">${escapeHtml(acquaintance.name)}</button>`;
      return `<tr><td>${name}</td><td><input class="love" type="number" min="0" value="${link.love}" data-love="${servant.id}" data-acquaintance="${acquaintance.id}" ${editable ? "" : "disabled"} /></td></tr>`;
    }).join("")}</tbody></table>` : "<p class=muted>Zatím nemá žádnou Známost.</p>"}
    ${editable ? `<button data-open-acquaintances="${servant.id}">Nová známost</button>` : ""}
    ${editable ? `<label>Jméno<input name="name" value="${escapeHtml(servant.name)}" /></label><button data-save-servant="${servant.id}">Uložit služebníka</button>` : `<small class="muted">Postava jiného hráče</small>`}
  </article>${editable ? actionCard(servant) : ""}`;
}

function actionCard(servant: Servant) {
  const targets = state.servants.filter((item) => item.id !== servant.id).map((item) => `<option value="servant:${item.id}">${escapeHtml(item.name || "Bezejmenný služebník")}</option>`).join("");
  const acquaintances = servant.acquaintances.map((link) => state.acquaintances.find((item) => item.id === link.acquaintanceId)).filter(Boolean).map((item) => `<option value="acquaintance:${item!.id}">${escapeHtml(item!.name)}</option>`).join("");
  const helpers = state.servants.filter((item) => item.id !== servant.id).map((item) => `<option value="${item.id}">${escapeHtml(item.name || "Bezejmenný služebník")}</option>`).join("");
  return `<section class="card action-box"><h2>Herní akce</h2><select data-action-kind="${servant.id}"><option value="violence">Násilí</option><option value="villainy">Zlotřilost</option><option value="approach">Sbližování</option></select><select data-action-target="${servant.id}"><option value="npc">Vesničané / cizinci</option>${targets}${acquaintances}</select><select data-action-bonus="${servant.id}"><option value="none">Bez bonusové kostky</option><option value="intimacy">Intimita (k4)</option><option value="despair">Zoufalství (k6)</option><option value="honesty">Upřímnost (k8)</option></select><select data-action-helper="${servant.id}"><option value="">Bez pomoci</option>${helpers}</select><button data-run-action="${servant.id}">Hodit</button>${servant.captured ? `<button data-escape="${servant.id}">Vymanění ze zajetí</button>` : ""}${servant.horrorPending ? `<button data-clear-horror="${servant.id}">Dokončit Projev hrůzy</button>` : ""}</section>`;
}

function finaleCard(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId)!;
  const helpers = state.servants.filter((item) => item.id !== servantId).map((item) => `<label class="check"><input type="checkbox" data-finale-helper="${item.id}" /> ${escapeHtml(item.name || "Bezejmenný služebník")} — Láska ${totalLove(item)} − Únava ${item.fatigue}</label>`).join("");
  return `<section class="card finale"><h2>Finále</h2><p><strong>${escapeHtml(servant.name || "Bezejmenný služebník")}</strong> se střetává s Pánem.</p><h3>Pomocníci</h3>${helpers || '<p class="muted">Nejsou k dispozici další služebníci.</p>'}<label>Bonus Pána<select id="finale-master-bonus"><option value="none">Bez bonusové kostky</option><option value="intimacy">Intimita (k4)</option><option value="despair">Zoufalství (k6)</option></select></label><label>Bonus služebníka<select id="finale-servant-bonus"><option value="none">Bez bonusové kostky</option><option value="intimacy">Intimita (k4)</option><option value="despair">Zoufalství (k6)</option><option value="honesty">Upřímnost (k8)</option></select></label><button data-run-finale="${servantId}">Hodit Finále</button></section>`;
}

function acquaintanceCard(servantId: string) {
  const acquaintanceId = view?.kind === "acquaintances" ? view.acquaintanceId : null;
  const acquaintance = acquaintanceId ? state.acquaintances.find((item) => item.id === acquaintanceId) : undefined;
  const servant = state.servants.find((item) => item.id === servantId)!;
  const linkedIds = new Set(servant.acquaintances.map((link) => link.acquaintanceId));
  const available = state.acquaintances.filter((item) => !linkedIds.has(item.id));
  return `<section class="card">
    <h2>${acquaintance ? "Upravit známost" : "Nová známost"}</h2>
    ${acquaintance ? `<label>Jméno<input data-edit-acquaintance-name="${acquaintance.id}" value="${escapeHtml(acquaintance.name)}" ${role === "GM" ? "" : "disabled"} /></label><label>Popis<textarea data-edit-acquaintance-description="${acquaintance.id}" rows="6" ${role === "GM" ? "" : "disabled"}>${escapeHtml(acquaintance.description)}</textarea></label>${role === "GM" ? `<div class="acquaintance-edit-actions"><button data-save-acquaintance="${acquaintance.id}">Uložit známost</button><button data-delete-acquaintance="${acquaintance.id}">Odstranit známost</button></div>` : ""}` : `<h3>Připojit existující známost</h3>${available.length ? `<select data-add-acquaintance="${servantId}">${available.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select><button data-attach-acquaintance="${servantId}">Připojit existující známost</button>` : ""}<h3>Nová známost</h3><input data-new-acquaintance-name="${servantId}" placeholder="Jméno známosti" /><textarea data-new-acquaintance-description="${servantId}" rows="4" placeholder="Popis známosti"></textarea><button data-create-acquaintance="${servantId}">Vytvořit známost</button>`}
  </section>`;
}

function formValue(selector: string) {
  return (document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? "").trim();
}

async function updateState(update: (current: GameState) => GameState) {
  const metadata = await OBR.room.getMetadata();
  const current = normalizeState(metadata[KEY] as Partial<GameState> | undefined);
  const next = update(structuredClone(current));
  await OBR.room.setMetadata({ [KEY]: next });
  state = next;
  return next;
}

async function publish(message: string) {
  feed = [message, ...feed].slice(0, 20);
  render();
  await OBR.broadcast.sendMessage(KEY, message, { destination: "REMOTE" });
}

function totalLove(servant: Servant) {
  return servant.acquaintances.reduce((sum, link) => sum + link.love, 0);
}

function bonusSides(bonus: BonusKind) {
  return bonus === "intimacy" ? 4 : bonus === "despair" ? 6 : bonus === "honesty" ? 8 : 0;
}

function bonusLabel(bonus: BonusKind) {
  return bonus === "intimacy" ? "Intimita" : bonus === "despair" ? "Zoufalství" : bonus === "honesty" ? "Upřímnost" : "";
}

function rollPool(pool: number, bonus: BonusKind) {
  const result = rollDice(pool);
  const sides = bonusSides(bonus);
  const extra = sides ? Math.floor(Math.random() * sides) + 1 : 0;
  return { ...result, total: result.total + extra, bonusRoll: extra, bonusSides: sides };
}

function rollLine(prefix: string, expression: string, values: string, roll: ReturnType<typeof rollPool>, bonus: BonusKind) {
  const bonusText = bonusSides(bonus) ? ` + ${bonusLabel(bonus)}` : "";
  const diceText = `${roll.dice}k4${bonusSides(bonus) ? " + k" + bonusSides(bonus) : ""}`;
  const rollsText = `${roll.rolls.map((value) => value === 4 ? "4̶" : value).join(", ")}${roll.bonusRoll ? ` + ${roll.bonusRoll}` : ""}`;
  return `${prefix} (${expression})${bonusText} -> (${values}) = ${diceText} -> padlo ${rollsText} -> ${roll.total}`;
}

async function runAction(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant || !canEditServant(role, playerId, servant)) return;
  const kind = document.querySelector<HTMLSelectElement>(`[data-action-kind="${servantId}"]`)?.value as ActionKind;
  const target = document.querySelector<HTMLSelectElement>(`[data-action-target="${servantId}"]`)?.value;
  const bonus = (document.querySelector<HTMLSelectElement>(`[data-action-bonus="${servantId}"]`)?.value || "none") as BonusKind;
  const helperId = document.querySelector<HTMLSelectElement>(`[data-action-helper="${servantId}"]`)?.value || undefined;
  if (!target) return;
  if (kind === "approach" && !target.startsWith("acquaintance:")) {
    await publish("Sbližovat se lze jenom se Známostí.");
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
  const actorLine = rollLine(`${servant.name} hází`, actorRule + (helpDice ? ` + pomoc ${helpDice}k4` : ""), actorValues + (helpDice ? ` + ${helpDice}` : ""), actorRoll, bonus);
  const opponentLine = rollLine(`${opponentName} hází`, opponentRule, opponentValues, opponentRoll, "none");
  let consequence = tied ? "remíza, scéna je přerušena" : won ? "uspěl" : "neuspěl";
  if (!tied && kind === "approach") consequence += "; Láska +1" + (won ? "" : ", Sebenenávist +1");
  else if (!tied && won) consequence += "; Sebenenávist +1";
  else if (!tied && kind === "violence") consequence += "; Únava +1";
  const predictedSelfHatred = servant.selfHatred + (won ? 1 : kind === "approach" ? 1 : 0);
  const horror = !tied && predictedSelfHatred > totalLove(servant) + state.master.reason;
  if (horror) consequence += "; Projev hrůzy místo zvýšení Sebenenávisti";
  const next = await updateState((current) => {
    let updated = applyActionOutcome(current, servantId, kind, targetId, won, horror, helperId, tied);
    updated = { ...updated, servants: updated.servants.map((item) => item.id === servantId && item.fatigue > updated.master.reason ? { ...item, captured: true } : item) };
    return updated;
  });
  if (next.servants.find((item) => item.id === servantId)?.captured) consequence += "; služebník padá do zajetí";
  const actionText = kind === "approach" ? `Sbližování s ${targetName}` : `${kind === "violence" ? "Násilí" : "Zlotřilost"} proti ${targetName}`;
  await publish(`**${servant.name} provádí ${actionText}**\n${actorLine}\n${opponentLine}\n${actorRoll.total} ${tied ? "=" : won ? ">" : "<"} ${opponentRoll.total} -> **${servant.name} ${(consequence + (!tied && helper ? `. Pomáhá ${helper.name}` : "")).replace(/; /g, ". ")}.**`);
}

async function runCommand() {
  if (role !== "GM") return;
  const servantId = document.querySelector<HTMLSelectElement>("#command-target")?.value;
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant) return;
  const masterBonus = (document.querySelector<HTMLSelectElement>("#command-master-bonus")?.value || "none") as BonusKind;
  const servantBonus = (document.querySelector<HTMLSelectElement>("#command-servant-bonus")?.value || "none") as BonusKind;
  const masterRoll = rollPool(poolSize(state.master.fear + servant.selfHatred), masterBonus);
  const servantRoll = rollPool(poolSize(totalLove(servant) - servant.fatigue), servantBonus);
  const tied = masterRoll.total === servantRoll.total;
  const won = masterRoll.total > servantRoll.total;
  let consequence = tied ? "Remíza, příkaz je přerušen" : won ? `${servant.name} musí uposlechnout Pánův příkaz` : `${servant.name} se příkazu vzepřel`;
  const finale = !tied && !won && totalLove(servant) > state.master.fear + servant.fatigue;
  if (finale) {
    await updateState((current) => ({ ...current, finaleServantId: servant.id }));
    consequence = `${servant.name} se vzepřel Pánovi – začíná Finále`;
  }
  await publish(`**Pán přikazuje ${servant.name}.**\n${rollLine("Pán hází", "Strach + Sebenenávist", `${state.master.fear} + ${servant.selfHatred}`, masterRoll, masterBonus)}\n${rollLine(`${servant.name} hází`, "Láska − Únava", `${totalLove(servant)} - ${servant.fatigue}`, servantRoll, servantBonus)}\n${masterRoll.total} ${tied ? "=" : won ? ">" : "<"} ${servantRoll.total} -> **${consequence}.**`);
}

async function escapeCaptivity(id: string) {
  const servant = state.servants.find((item) => item.id === id);
  if (!servant?.captured || !canEditServant(role, playerId, servant)) return;
  await updateState((current) => ({ ...current, servants: current.servants.map((item) => item.id === id ? { ...item, captured: false } : item) }));
  await publish(`${servant.name} se vymanil ze zajetí.`);
}

async function clearHorror(id: string) {
  const servant = state.servants.find((item) => item.id === id);
  if (!servant?.horrorPending || !canEditServant(role, playerId, servant)) return;
  await updateState((current) => ({ ...current, servants: current.servants.map((item) => item.id === id ? { ...item, horrorPending: false } : item) }));
  await publish(`${servant.name} dokončil Projev hrůzy a vrací se do hry.`);
}

async function runFinale(id: string) {
  if (state.finaleServantId !== id) return;
  const servant = state.servants.find((item) => item.id === id);
  if (!servant || !canEditServant(role, playerId, servant)) return;
  const masterBonus = (document.querySelector<HTMLSelectElement>("#finale-master-bonus")?.value || "none") as BonusKind;
  const servantBonus = (document.querySelector<HTMLSelectElement>("#finale-servant-bonus")?.value || "none") as BonusKind;
  const helperIds = [...document.querySelectorAll<HTMLInputElement>("[data-finale-helper]:checked")].map((input) => input.dataset.finaleHelper!);
  const helpers = helperIds.map((helperId) => state.servants.find((item) => item.id === helperId)).filter(Boolean) as Servant[];
  const helperDice = helpers.reduce((sum, helper) => sum + poolSize(totalLove(helper) - helper.fatigue), 0);
  const servantBase = poolSize(totalLove(servant) - servant.fatigue);
  const servantRoll = rollPool(servantBase + helperDice, servantBonus);
  const masterRoll = rollPool(poolSize(state.master.fear + servant.selfHatred), masterBonus);
  const tied = servantRoll.total === masterRoll.total;
  const won = servantRoll.total > masterRoll.total;
  await updateState((current) => applyFinaleOutcome(current, id, won, tied, helperIds));
  const helperText = helpers.length ? ` + pomoc ${helpers.map((helper) => helper.name).join(", ")}` : "";
  await publish(`**Finále: ${servant.name}**\n${rollLine(`${servant.name} hází`, "Láska − Únava" + helperText, `${totalLove(servant)} - ${servant.fatigue}${helpers.length ? ` + ${helperDice}` : ""}`, servantRoll, servantBonus)}\n${rollLine("Pán hází", "Strach + Sebenenávist", `${state.master.fear} + ${servant.selfHatred}`, masterRoll, masterBonus)}\n${servantRoll.total} ${tied ? "=" : won ? ">" : "<"} ${masterRoll.total} -> **${tied ? "Remíza, scéna je přerušena." : won ? "Pán je zabit." : "Pán přežil, Únava +1."}**`);
}

async function saveMaster() {
  if (role !== "GM") return;
  await updateState((current) => ({ ...current, master: {
    name: formValue("#master-name"), description: formValue("#master-description"),
    reason: Number(formValue('[name="master-reason"]')) || 0, fear: Number(formValue('[name="master-fear"]')) || 0,
  }, environment: formValue("#environment") }));
}

async function saveServant(id: string) {
  const card = document.querySelector<HTMLElement>(`[data-save-servant="${id}"]`)?.closest(".servant");
  if (!card) return;
  const servant = state.servants.find((item) => item.id === id);
  if (!servant || !canEditServant(role, playerId, servant)) return;
  const value = (name: string) => card.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value.trim() ?? "";
  const next = {
    name: value("name"), moreHuman: value("moreHuman"), lessHuman: value("lessHuman"),
    selfHatred: Number(value("selfHatred")) || 0, fatigue: Number(value("fatigue")) || 0,
    acquaintances: servant.acquaintances.map((link) => ({ ...link, love: Number(card.querySelector<HTMLInputElement>(`[data-love="${id}"][data-acquaintance="${link.acquaintanceId}"]`)?.value) || 0 })),
  };
  await updateState((current) => ({ ...current,
    servants: current.servants.map((item) => item.id === id ? {
    ...item, ...next,
  } : item) }));
  const changes: string[] = [];
  if (servant.selfHatred !== next.selfHatred) changes.push(`Sebenenávist ${servant.selfHatred} → ${next.selfHatred}`);
  if (servant.fatigue !== next.fatigue) changes.push(`Únava ${servant.fatigue} → ${next.fatigue}`);
  servant.acquaintances.forEach((link) => {
    const updated = next.acquaintances.find((item) => item.acquaintanceId === link.acquaintanceId);
    const acquaintance = state.acquaintances.find((item) => item.id === link.acquaintanceId);
    if (updated && updated.love !== link.love) changes.push(`Láska (${acquaintance?.name || "Známost"}) ${link.love} → ${updated.love}`);
  });
  if (servant.moreHuman !== next.moreHuman) changes.push("změnil popis Více než lidský");
  if (servant.lessHuman !== next.lessHuman) changes.push("změnil popis Méně než lidský");
  if (changes.length) await publish(`${servant.name || "Služebník"}: ${changes.join(", ")}.`);
}

async function attachAcquaintance(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant || !canEditServant(role, playerId, servant)) return;
  const id = document.querySelector<HTMLSelectElement>(`[data-add-acquaintance="${servantId}"]`)?.value;
  if (!id || servant.acquaintances.some((link) => link.acquaintanceId === id)) return;
  await updateState((current) => attachAcquaintanceState(current, servantId, id));
}

async function createAcquaintance(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant || !canEditServant(role, playerId, servant)) return;
  const name = formValue(`[data-new-acquaintance-name="${servantId}"]`);
  const description = formValue(`[data-new-acquaintance-description="${servantId}"]`);
  if (!name) return;
  const acquaintance = { id: crypto.randomUUID(), name, description };
  await updateState((current) => addAcquaintance(current, servantId, acquaintance));
  view = { kind: "servant", id: servantId };
  render();
}

async function saveAcquaintance(id: string) {
  if (role !== "GM") return;
  const current = state.acquaintances.find((item) => item.id === id);
  if (!current) return;
  await updateState((state) => updateAcquaintanceState(state, {
    ...current,
    name: formValue(`[data-edit-acquaintance-name="${id}"]`) || current.name,
    description: formValue(`[data-edit-acquaintance-description="${id}"]`),
  }));
  if (view?.kind === "acquaintances") {
    view = { kind: "servant", id: view.servantId };
    render();
  }
}

async function deleteAcquaintance(id: string) {
  if (role !== "GM") return;
  const acquaintance = state.acquaintances.find((item) => item.id === id);
  if (!acquaintance || !window.confirm(`Opravdu odstranit známost „${acquaintance.name}“ u všech služebníků?`)) return;
  await updateState((current) => removeAcquaintanceState(current, id));
  await publish(`Známost ${acquaintance.name} byla odstraněna.`);
  if (view?.kind === "acquaintances") {
    view = { kind: "servant", id: view.servantId };
    render();
  }
}

async function createServant() {
  if (state.servants.some((servant) => servant.ownerId === playerId) && role !== "GM") return;
  await updateState((current) => ({ ...current, servants: [...current.servants, {
    id: crypto.randomUUID(), name: "Nový služebník", ownerId: playerId,
    selfHatred: 2, fatigue: 1, moreHuman: "", lessHuman: "",
    acquaintances: [],
  }] }));
}

function bindEvents() {
  document.querySelector("#back-to-characters")?.addEventListener("click", () => { view = view?.kind === "acquaintances" ? { kind: "servant", id: view.servantId } : null; render(); });
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
  document.querySelectorAll<HTMLElement>("[data-open-acquaintances]").forEach((button) => button.addEventListener("click", () => { view = { kind: "acquaintances", servantId: button.dataset.openAcquaintances!, acquaintanceId: null }; render(); }));
  document.querySelectorAll<HTMLElement>("[data-open-acquaintance]").forEach((button) => button.addEventListener("click", () => { const [servantId, acquaintanceId] = button.dataset.openAcquaintance!.split(":"); view = { kind: "acquaintances", servantId, acquaintanceId }; render(); }));
  document.querySelectorAll<HTMLElement>("[data-attach-acquaintance]").forEach((button) => button.addEventListener("click", () => void attachAcquaintance(button.dataset.attachAcquaintance!)));
  document.querySelectorAll<HTMLElement>("[data-create-acquaintance]").forEach((button) => button.addEventListener("click", () => void createAcquaintance(button.dataset.createAcquaintance!)));
  document.querySelectorAll<HTMLElement>("[data-save-acquaintance]").forEach((button) => button.addEventListener("click", () => void saveAcquaintance(button.dataset.saveAcquaintance!)));
  document.querySelectorAll<HTMLElement>("[data-delete-acquaintance]").forEach((button) => button.addEventListener("click", () => void deleteAcquaintance(button.dataset.deleteAcquaintance!)));
  document.querySelectorAll<HTMLElement>("[data-run-action]").forEach((button) => button.addEventListener("click", () => void runAction(button.dataset.runAction!)));
  document.querySelectorAll<HTMLElement>("[data-open-finale]").forEach((button) => button.addEventListener("click", () => { view = { kind: "finale", servantId: button.dataset.openFinale! }; render(); }));
  document.querySelectorAll<HTMLElement>("[data-escape]").forEach((button) => button.addEventListener("click", () => void escapeCaptivity(button.dataset.escape!)));
  document.querySelectorAll<HTMLElement>("[data-clear-horror]").forEach((button) => button.addEventListener("click", () => void clearHorror(button.dataset.clearHorror!)));
  document.querySelectorAll<HTMLElement>("[data-run-finale]").forEach((button) => button.addEventListener("click", () => void runFinale(button.dataset.runFinale!)));
}

async function start() {
  playerId = OBR.player.id;
  role = await OBR.player.getRole();
  const metadata = await OBR.room.getMetadata();
  state = normalizeState(metadata[KEY] as Partial<GameState> | undefined);
  if (!metadata[KEY]) await OBR.room.setMetadata({ [KEY]: state });
  render();
  OBR.room.onMetadataChange((metadata) => { state = normalizeState(metadata[KEY] as Partial<GameState> | undefined); render(); });
  OBR.player.onChange(async (player) => { playerId = player.id; role = await OBR.player.getRole(); render(); });
  OBR.broadcast.onMessage(KEY, (event) => { if (typeof event.data === "string") { feed = [event.data, ...feed].slice(0, 20); render(); } });
}

if (OBR.isAvailable) OBR.onReady(() => void start());
else app.innerHTML = "<section class=card><h1>Vývojový náhled</h1><p>Otevři manifest v Owlbear Rodeo, aby se načetla synchronizace místnosti.</p></section>";
