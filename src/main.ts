import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { addAcquaintance, applyActionOutcome, attachAcquaintance as attachAcquaintanceState, canEditServant, emptyState, normalizeState, poolSize, rollDice, updateAcquaintance as updateAcquaintanceState } from "./state";
import type { ActionKind, GameState, Servant } from "./state";

const KEY = "com.mujzivotspanem/state";
const app = document.querySelector<HTMLDivElement>("#app")!;

let state = structuredClone(emptyState);
let role: "GM" | "PLAYER" = "PLAYER";
let playerId = "local";
let feed: string[] = [];
let view: { kind: "master" } | { kind: "servant"; id: string } | { kind: "acquaintances"; servantId: string; acquaintanceId: string | null } | null = null;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}

function numberInput(label: string, name: string, value: number) {
  return `<label>${label}<input name="${name}" type="number" min="0" value="${value}" /></label>`;
}

function render() {
  const own = state.servants.find((servant) => servant.ownerId === playerId);
  const viewingServantId = view?.kind === "servant" ? view.id : view?.kind === "acquaintances" ? view.servantId : undefined;
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
  else app.innerHTML = `${header}${acquaintanceCard(view.servantId)}${feedCard()}`;
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
  return `<section class="card"><h2>Pánův příkaz</h2><label>Cíl<select id="command-target">${state.servants.length ? state.servants.map((servant) => `<option value="${servant.id}">${escapeHtml(servant.name || "Služebník bez jména")}</option>`).join("") : '<option disabled selected>Nejdříve vytvoř služebníka</option>'}</select></label><button id="run-command" ${state.servants.length ? "" : "disabled"}>Hodit</button></section>`;
}

function feedCard() {
  return `<section class="card feed"><h2>Živý feed</h2>${feed.length ? feed.map((item) => `<p>${escapeHtml(item)}</p>`).join("") : '<p class="muted">Zatím zde nejsou žádné akce.</p>'}</section>`;
}

function servantCard(servant: Servant) {
  const editable = role === "GM" || servant.ownerId === playerId;
  const acquaintances = state.acquaintances;
  const linked = servant.acquaintances ?? [];
  const linkedIds = new Set(linked.map((link) => link.acquaintanceId));
  return `<article class="servant ${editable ? "" : "readonly"}">
    <h3>${escapeHtml(servant.name || "Bezejmenný služebník")}</h3>
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
  return `<section class="card action-box"><h2>Herní akce</h2><select data-action-kind="${servant.id}"><option value="violence">Násilí</option><option value="villainy">Zlotřilost</option><option value="approach">Sbližování</option></select><select data-action-target="${servant.id}"><option value="npc">Vesničané / cizinci</option>${targets}${acquaintances}</select><button data-run-action="${servant.id}">Hodit</button></section>`;
}

function acquaintanceCard(servantId: string) {
  const acquaintanceId = view?.kind === "acquaintances" ? view.acquaintanceId : null;
  const acquaintance = acquaintanceId ? state.acquaintances.find((item) => item.id === acquaintanceId) : undefined;
  const servant = state.servants.find((item) => item.id === servantId)!;
  const linkedIds = new Set(servant.acquaintances.map((link) => link.acquaintanceId));
  const available = state.acquaintances.filter((item) => !linkedIds.has(item.id));
  return `<section class="card">
    <h2>${acquaintance ? "Upravit známost" : "Nová známost"}</h2>
    ${acquaintance ? `<label>Jméno<input data-edit-acquaintance-name="${acquaintance.id}" value="${escapeHtml(acquaintance.name)}" ${role === "GM" ? "" : "disabled"} /></label><label>Popis<textarea data-edit-acquaintance-description="${acquaintance.id}" rows="6" ${role === "GM" ? "" : "disabled"}>${escapeHtml(acquaintance.description)}</textarea></label>${role === "GM" ? `<button data-save-acquaintance="${acquaintance.id}">Uložit známost</button>` : ""}` : `<h3>Připojit existující známost</h3>${available.length ? `<select data-add-acquaintance="${servantId}">${available.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select><button data-attach-acquaintance="${servantId}">Připojit existující známost</button>` : ""}<h3>Nová známost</h3><input data-new-acquaintance-name="${servantId}" placeholder="Jméno známosti" /><textarea data-new-acquaintance-description="${servantId}" rows="4" placeholder="Popis známosti"></textarea><button data-create-acquaintance="${servantId}">Vytvořit známost</button>`}
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

async function runAction(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant || !canEditServant(role, playerId, servant)) return;
  const kind = document.querySelector<HTMLSelectElement>(`[data-action-kind="${servantId}"]`)?.value as ActionKind;
  const target = document.querySelector<HTMLSelectElement>(`[data-action-target="${servantId}"]`)?.value;
  if (!target) return;
  if (kind === "approach" && !target.startsWith("acquaintance:")) {
    await publish("Sbližovat se lze jenom se Známostí.");
    return;
  }
  const targetId = target.split(":")[1];
  let opponent = 1;
  let actorRule = "Strach + Sebenenávist";
  let opponentRule = "Rozum";
  let targetName = "vesničanů / cizinců";
  if (kind === "approach") {
    const acquaintance = state.acquaintances.find((item) => item.id === targetId);
    if (!acquaintance || !servant.acquaintances.some((link) => link.acquaintanceId === targetId)) return;
    opponent = poolSize(state.master.fear - state.master.reason);
    actorRule = "Rozum − Sebenenávist";
    opponentRule = "Strach − Rozum";
    targetName = acquaintance.name;
  } else if (target.startsWith("servant:")) {
    const other = state.servants.find((item) => item.id === targetId);
    if (!other) return;
    opponent = poolSize(state.master.fear + other.selfHatred);
    opponentRule = "Strach + Sebenenávist";
    targetName = other.name;
  } else {
    const acquaintance = state.acquaintances.find((item) => item.id === targetId);
    if (target.startsWith("acquaintance:") && !acquaintance) return;
    opponent = poolSize(state.master.reason + (kind === "violence" ? servant.fatigue : 0));
    opponentRule = kind === "violence" ? "Rozum + Únava" : "Rozum";
    targetName = acquaintance?.name || "vesničanům / cizincům";
  }
  const actor = kind === "approach" ? poolSize(state.master.reason - servant.selfHatred) : poolSize(state.master.fear + servant.selfHatred);
  const actorRoll = rollDice(actor);
  const opponentRoll = rollDice(opponent);
  const won = actorRoll.total > opponentRoll.total;
  const formula = `${actorRule} ${actor}k4 (${actorRoll.total}) proti ${opponentRule} ${opponent}k4 (${opponentRoll.total})`;
  let consequence = won ? "uspěl" : "neuspěl";
  if (kind === "approach") consequence += "; Láska +1" + (won ? "" : ", Sebenenávist +1");
  else if (won) consequence += "; Sebenenávist +1";
  else if (kind === "violence") consequence += "; Únava +1";
  await updateState((current) => applyActionOutcome(current, servantId, kind, targetId, won));
  if (state.servants.find((item) => item.id === servantId)!.fatigue > state.master.reason) consequence += "; služebník padá do zajetí";
  const actionText = kind === "approach" ? `Sbližování s ${targetName}` : `${kind === "violence" ? "Násilí" : "Zlotřilost"} proti ${targetName}`;
  await publish(`${servant.name} provádí ${actionText}. Hází se ${formula}. ${consequence}.`);
}

async function runCommand() {
  if (role !== "GM") return;
  const servantId = document.querySelector<HTMLSelectElement>("#command-target")?.value;
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant) return;
  const masterRoll = rollDice(poolSize(state.master.fear + servant.selfHatred));
  const servantRoll = rollDice(poolSize(totalLove(servant) - servant.fatigue));
  const won = masterRoll.total > servantRoll.total;
  await publish(`Pán přikazuje ${servant.name}. Pán hází Strach + Sebenenávist: ${(state.master.fear + servant.selfHatred)}k4 (${masterRoll.total}) proti Lásce − Únavě: ${poolSize(totalLove(servant) - servant.fatigue)}k4 (${servantRoll.total}). ${won ? "Příkaz uspěl" : "Služebník odolal"}.`);
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
  document.querySelectorAll<HTMLElement>("[data-run-action]").forEach((button) => button.addEventListener("click", () => void runAction(button.dataset.runAction!)));
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
