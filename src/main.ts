import OBR from "@owlbear-rodeo/sdk";
import "./style.css";

const KEY = "com.mujzivotspanem/state";
const app = document.querySelector<HTMLDivElement>("#app")!;

type Servant = {
  id: string;
  name: string;
  ownerId: string;
  selfHatred: number;
  fatigue: number;
  moreHuman: string;
  lessHuman: string;
  acquaintances: { acquaintanceId: string; love: number }[];
};

type Acquaintance = { id: string; name: string; description: string };

type GameState = {
  master: { name: string; description: string; reason: number; fear: number };
  environment: string;
  servants: Servant[];
  acquaintances: Acquaintance[];
};

const emptyState: GameState = {
  master: { name: "", description: "", reason: 0, fear: 0 },
  environment: "",
  servants: [],
  acquaintances: [],
};

let state = structuredClone(emptyState);
let role: "GM" | "PLAYER" = "PLAYER";
let playerId = "local";
let view: { kind: "master" } | { kind: "servant"; id: string } | { kind: "acquaintances"; servantId: string } | null = null;

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
      </section>`;
    bindEvents();
    return;
  }
  if (view.kind === "master") app.innerHTML = `${header}${masterCard()}`;
  else if (view.kind === "servant") app.innerHTML = `${header}${servantCard(state.servants.find((servant) => servant.id === viewingServantId)!)}`;
  else app.innerHTML = `${header}${acquaintanceCard(view.servantId)}`;
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
    </section>`;
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
      const name = `<span title="${title}">${escapeHtml(acquaintance.name)}</span>`;
      return `<tr><td>${name}</td><td><input class="love" type="number" min="0" value="${link.love}" data-love="${servant.id}" data-acquaintance="${acquaintance.id}" ${editable ? "" : "disabled"} /></td></tr>`;
    }).join("")}</tbody></table>` : "<p class=muted>Zatím nemá žádnou Známost.</p>"}
    ${editable ? `<button data-open-acquaintances="${servant.id}">Spravovat známosti</button>` : ""}
    ${editable ? `<label>Jméno<input name="name" value="${escapeHtml(servant.name)}" /></label><button data-save-servant="${servant.id}">Uložit služebníka</button>` : `<small class="muted">Postava jiného hráče</small>`}
  </article>`;
}

function acquaintanceCard(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId)!;
  const linkedIds = new Set(servant.acquaintances.map((link) => link.acquaintanceId));
  const available = state.acquaintances.filter((item) => !linkedIds.has(item.id));
  return `<section class="card">
    <h2>Známosti služebníka</h2>
    ${available.length ? `<select data-add-acquaintance="${servantId}">${available.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select><button data-attach-acquaintance="${servantId}">Připojit existující známost</button>` : "<p class='muted'>Všechny dostupné známosti jsou připojené.</p>"}
    <h3>Nová známost</h3>
    <input data-new-acquaintance-name="${servantId}" placeholder="Jméno známosti" />
    <textarea data-new-acquaintance-description="${servantId}" rows="4" placeholder="Popis známosti"></textarea>
    <button data-create-acquaintance="${servantId}">Vytvořit známost</button>
    ${role === "GM" ? `<h3>Úprava známostí</h3>${state.acquaintances.map((item) => `<details class="acquaintance-edit"><summary>${escapeHtml(item.name)}</summary><input data-acquaintance-name="${item.id}" value="${escapeHtml(item.name)}" /><textarea data-acquaintance-description="${item.id}" rows="3">${escapeHtml(item.description)}</textarea></details>`).join("")}<button data-save-acquaintances>Uložit známosti</button>` : ""}
  </section>`;
}

function formValue(selector: string) {
  return (document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? "").trim();
}

async function updateState(update: (current: GameState) => GameState) {
  const metadata = await OBR.room.getMetadata();
  const current = normalizeState(metadata[KEY] as Partial<GameState> | undefined);
  await OBR.room.setMetadata({ [KEY]: update(structuredClone(current)) });
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
  if (!servant || (role !== "GM" && servant.ownerId !== playerId)) return;
  const value = (name: string) => card.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value.trim() ?? "";
  await updateState((current) => ({ ...current,
    servants: current.servants.map((item) => item.id === id ? {
    ...item, name: value("name"), moreHuman: value("moreHuman"), lessHuman: value("lessHuman"),
    selfHatred: Number(value("selfHatred")) || 0, fatigue: Number(value("fatigue")) || 0,
    acquaintances: item.acquaintances.map((link) => ({ ...link, love: Number(card.querySelector<HTMLInputElement>(`[data-love="${id}"][data-acquaintance="${link.acquaintanceId}"]`)?.value) || 0 })),
  } : item) }));
}

async function attachAcquaintance(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant || (role !== "GM" && servant.ownerId !== playerId)) return;
  const id = document.querySelector<HTMLSelectElement>(`[data-add-acquaintance="${servantId}"]`)?.value;
  if (!id || servant.acquaintances.some((link) => link.acquaintanceId === id)) return;
  await updateState((current) => ({ ...current, servants: current.servants.map((item) => item.id === servantId ? { ...item, acquaintances: [...item.acquaintances, { acquaintanceId: id, love: 0 }] } : item) }));
}

async function createAcquaintance(servantId: string) {
  const servant = state.servants.find((item) => item.id === servantId);
  if (!servant || (role !== "GM" && servant.ownerId !== playerId)) return;
  const name = formValue(`[data-new-acquaintance-name="${servantId}"]`);
  const description = formValue(`[data-new-acquaintance-description="${servantId}"]`);
  if (!name) return;
  const acquaintance = { id: crypto.randomUUID(), name, description };
  await updateState((current) => ({
    ...current,
    acquaintances: [...current.acquaintances, acquaintance],
    servants: current.servants.map((item) => item.id === servantId ? { ...item, acquaintances: [...item.acquaintances, { acquaintanceId: acquaintance.id, love: 0 }] } : item),
  }));
}

async function saveAcquaintances() {
  if (role !== "GM") return;
  await updateState((current) => ({ ...current, acquaintances: current.acquaintances.map((item) => ({
    ...item,
    name: formValue(`[data-acquaintance-name="${item.id}"]`) || item.name,
    description: formValue(`[data-acquaintance-description="${item.id}"]`),
  })) }));
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
  document.querySelector("#new-servant")?.addEventListener("click", () => {
    const own = state.servants.find((servant) => servant.ownerId === playerId);
    if (own) { view = { kind: "servant", id: own.id }; render(); }
    else void createServant();
  });
  document.querySelectorAll<HTMLElement>("[data-save-servant]").forEach((button) => button.addEventListener("click", () => void saveServant(button.dataset.saveServant!)));
  document.querySelectorAll<HTMLElement>("[data-open-acquaintances]").forEach((button) => button.addEventListener("click", () => { view = { kind: "acquaintances", servantId: button.dataset.openAcquaintances! }; render(); }));
  document.querySelectorAll<HTMLElement>("[data-attach-acquaintance]").forEach((button) => button.addEventListener("click", () => void attachAcquaintance(button.dataset.attachAcquaintance!)));
  document.querySelectorAll<HTMLElement>("[data-create-acquaintance]").forEach((button) => button.addEventListener("click", () => void createAcquaintance(button.dataset.createAcquaintance!)));
  document.querySelector("[data-save-acquaintances]")?.addEventListener("click", () => void saveAcquaintances());
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
}

function normalizeState(value: Partial<GameState> | undefined): GameState {
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

if (OBR.isAvailable) OBR.onReady(() => void start());
else app.innerHTML = "<section class=card><h1>Vývojový náhled</h1><p>Otevři manifest v Owlbear Rodeo, aby se načetla synchronizace místnosti.</p></section>";
