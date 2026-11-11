// Veille Pro : affiche la veille du jour (data/offres.json) et suit les candidatures.
// Les candidatures restent sur le téléphone (stockage local du navigateur), rien n'est envoyé en ligne.

const STAGES = ["Envoyée", "Relancée", "Entretien", "Signé", "Refus"];
// Part de l'œil du Daruma peinte selon l'étape la plus avancée.
const FILL = { "Envoyée": 25, "Relancée": 40, "Entretien": 70, "Signé": 100, "Refus": 0 };
const STORE_KEY = "veille-pro:candidatures";

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let data = { offres: [], tendances: [] };
let cand = load();
// Tri : "priorite" met en tête les offres fraîches et compatibles, pour postuler parmi les premiers.
let sortMode = "priorite";
let showOld = false;
const OLD_DAYS = 14; // au-delà, l'offre est masquée par défaut : trop tard pour être parmi les premiers
try { sortMode = localStorage.getItem("veille-pro:tri") || "priorite"; } catch (e) {}

// Score de priorité : le match compte, mais chaque jour d'ancienneté coûte 3 points.
const priority = (o) => (Number(o.match) || 0) - 3 * ageDays(o.publiee);

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch (e) { return {}; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(cand)); } catch (e) { /* stockage indisponible */ }
}

// Âge d'une offre en jours, à partir de sa date de publication (AAAA-MM-JJ).
function ageDays(iso) {
  const d = new Date(iso + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - d) / 86400000));
}
const ageCls = (d) => (d <= 7 ? "new" : d <= 21 ? "" : "late");
const ageTxt = (d) => (d === 0 ? "Aujourd'hui" : d === 1 ? "Hier" : `Il y a ${d} j`);

function header() {
  const now = new Date();
  $("#day").textContent = now.toLocaleDateString("fr-FR", { weekday: "long" });
  $("#date").textContent = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function paintEye() {
  const best = Math.max(0, ...Object.values(cand).map((c) => FILL[c.etape] || 0));
  const h = (20 * best) / 100;
  const r = $("#eyeInk");
  r.setAttribute("y", 90 - h);
  r.setAttribute("height", h);
  $("#prog").textContent = best === 100 ? "Vœu exaucé : œil complété" : `Second œil peint à ${best} %`;
}

function renderList() {
  const L = $("#list");
  const sorters = {
    priorite: (a, b) => priority(b) - priority(a),
    recent: (a, b) => ageDays(a.publiee) - ageDays(b.publiee) || b.match - a.match,
    match: (a, b) => b.match - a.match,
  };
  const all = [...data.offres].sort(sorters[sortMode] || sorters.priorite);
  const oldCount = all.filter((o) => ageDays(o.publiee) > OLD_DAYS).length;
  const offres = showOld ? all : all.filter((o) => ageDays(o.publiee) <= OLD_DAYS);
  const recent = all.filter((o) => ageDays(o.publiee) <= 7).length;
  const tg = $("#toggleOld");
  tg.hidden = oldCount === 0;
  tg.textContent = showOld ? "Masquer les offres de plus de 2 semaines" : `Voir aussi ${oldCount} offre${oldCount > 1 ? "s" : ""} de plus de 2 semaines`;
  const maj = data.miseAJour ? ` · mise à jour le ${new Date(data.miseAJour + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : "";
  $("#lead").textContent = (data.exemple ? "Offres d'exemple" : `${recent} nouvelle${recent > 1 ? "s" : ""} cette semaine`) + maj;
  L.innerHTML = "";
  offres.forEach((o) => {
    const d = ageDays(o.publiee);
    const b = document.createElement("button");
    b.className = "offer" + (d > 21 ? " old" : "");
    b.innerHTML = `<span class="o-txt"><p class="o-title">${esc(o.titre)}</p>
      <span class="o-sub">${esc(o.entreprise)} · ${esc(o.contrat)} · ${esc(o.lieu)}</span>
      <span class="meta">${d <= 2 ? '<span class="fresh">Tout frais</span>' : ""}<span class="age ${ageCls(d)}">${ageTxt(d)}</span>${cand[o.id] ? `<span class="applied">${esc(cand[o.id].etape)}</span>` : ""}</span></span>
      <span class="pc">${Number(o.match) || 0}<small>%</small></span>`;
    b.onclick = () => openSheet(o);
    L.appendChild(b);
  });
  if (!offres.length) L.innerHTML = oldCount
    ? '<p class="empty">Aucune offre de moins de 2 semaines pour l\'instant. La prochaine veille en apportera de nouvelles.</p>'
    : '<p class="empty">Pas encore d\'offre aujourd\'hui. Reviens après la veille du matin.</p>';
}

function renderStages() {
  $("#stages").innerHTML = STAGES.map((st) => {
    const items = Object.entries(cand).filter(([, c]) => c.etape === st);
    return `<div class="stage${items.length ? " on" : ""}"><div class="stage-h"><b>${st}</b><span class="count">${items.length}</span></div>` +
      (items.length
        ? items.map(([id, c]) => `<button class="app-row" data-id="${esc(id)}"><span>${esc(c.titre)}</span><span>${esc(c.entreprise)}</span></button>`).join("")
        : '<p class="empty">Rien pour l\'instant.</p>') + "</div>";
  }).join("");
  document.querySelectorAll(".app-row").forEach((r) => {
    r.onclick = () => {
      const id = r.dataset.id;
      const o = data.offres.find((x) => String(x.id) === id) || { id, ...cand[id] };
      openSheet(o);
    };
  });
}

function renderTrends() {
  const T = data.tendances || [];
  $("#trends").innerHTML = T.length
    ? T.map((t) => `<div class="trend"><span>${esc(t.nom)}</span><span class="pct">${Number(t.pct) || 0} %</span><span class="bar"><i style="width:${Number(t.pct) || 0}%"></i></span></div>`).join("")
    : '<p class="empty">Les tendances apparaîtront après quelques jours de veille.</p>';
  renderSources();
  const tip = $("#tip");
  if (data.conseil) { tip.innerHTML = `<b>Conseil du jour</b>${esc(data.conseil)}`; tip.hidden = false; } else tip.hidden = true;
}

// Coulisses : quels sites la veille a lus, avec quels mots-clés, et ceux qui bloquent.
function renderSources() {
  const S = data.sources || [];
  $("#coulisses").hidden = !S.length && !data.derniereVeille;
  if (data.derniereVeille) {
    const t = new Date(data.derniereVeille);
    $("#lastRun").textContent = `Dernier passage : ${t.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  $("#sources").innerHTML = S.map((x) => {
    const ok = x.statut === "ok";
    return `<div class="src"><div class="src-h"><b>${esc(x.nom)}</b><span class="src-st ${ok ? "" : "ko"}">${ok ? `${Number(x.offres) || 0} offre${x.offres > 1 ? "s" : ""}` : "Bloqué"}</span></div>
      ${x.motsCles && x.motsCles.length ? `<p>${x.motsCles.map(esc).join(" · ")}</p>` : ""}
      ${!ok && x.raison ? `<p>${esc(x.raison)}</p>` : ""}</div>`;
  }).join("");
}

function openSheet(o) {
  const c = cand[o.id];
  const i = c ? STAGES.indexOf(c.etape) : -1;
  const canAdvance = !c || (c.etape !== "Signé" && c.etape !== "Refus");
  const nextLabel = !c ? "J'ai postulé" : STAGES[i + 1];
  const d = o.publiee ? ageDays(o.publiee) : null;
  const list = (arr) => (arr && arr.length ? arr : null);

  $("#sheet").innerHTML = `<div class="grip"></div>
    ${d !== null ? `<span class="age ${ageCls(d)}">Publiée ${ageTxt(d).toLowerCase()}</span>` : ""}
    <h3>${esc(o.titre)}</h3><span class="o-sub">${esc(o.entreprise)}${o.contrat ? " · " + esc(o.contrat) : ""}${o.lieu ? " · " + esc(o.lieu) : ""}</span>
    ${o.pourquoi ? `<div class="why"><span class="pc">${Number(o.match) || 0}<small>%</small></span><p>${esc(o.pourquoi)}</p></div>` : ""}
    ${list(o.missions) ? `<div class="sec"><h4>Missions</h4><ul>${o.missions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${list(o.attendus) ? `<div class="sec"><h4>Ce qu'ils attendent</h4><div class="tags">${o.attendus.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div></div>` : ""}
    ${o.angle ? `<div class="sec"><h4>Ton angle</h4><p>${esc(o.angle)}</p></div>` : ""}
    ${o.lien ? `<a class="link" href="${esc(o.lien)}" target="_blank" rel="noopener">Voir l'annonce</a>` : ""}
    <div class="actions">
      <button class="btn" id="close">Fermer</button>
      ${canAdvance ? `<button class="btn primary" id="advance">${nextLabel}</button>` : ""}
    </div>
    ${c && c.etape !== "Refus" && c.etape !== "Signé" ? '<button class="undo" id="refus">Marquer comme refusée</button>' : ""}
    ${c ? '<button class="undo" id="remove">Retirer de mes candidatures</button>' : ""}`;

  $("#sheetBg").hidden = false;
  $("#close").onclick = closeSheet;
  const set = (etape) => {
    cand[o.id] = { etape, titre: o.titre, entreprise: o.entreprise, contrat: o.contrat, lieu: o.lieu, date: new Date().toISOString().slice(0, 10) };
    save(); closeSheet(); renderAll();
  };
  if ($("#advance")) $("#advance").onclick = () => set(!c ? "Envoyée" : STAGES[i + 1]);
  if ($("#refus")) $("#refus").onclick = () => set("Refus");
  if ($("#remove")) $("#remove").onclick = () => { delete cand[o.id]; save(); closeSheet(); renderAll(); };
}
function closeSheet() { $("#sheetBg").hidden = true; }

function renderAll() { renderList(); renderStages(); paintEye(); }

document.querySelectorAll(".sort .chip").forEach((c) => {
  c.setAttribute("aria-pressed", c.dataset.sort === sortMode);
  c.onclick = () => {
    sortMode = c.dataset.sort;
    try { localStorage.setItem("veille-pro:tri", sortMode); } catch (e) {}
    document.querySelectorAll(".sort .chip").forEach((x) => x.setAttribute("aria-pressed", x === c));
    renderList();
  };
});
$("#toggleOld").onclick = () => { showOld = !showOld; renderList(); };
$("#sheetBg").addEventListener("click", (e) => { if (e.target.id === "sheetBg") closeSheet(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x === t));
    document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== t.dataset.v));
    window.scrollTo(0, 0);
  };
});

async function start() {
  header();
  paintEye();
  try {
    const res = await fetch("data/offres.json", { cache: "no-cache" });
    data = await res.json();
  } catch (e) {
    $("#lead").textContent = "Impossible de charger la veille. Vérifie ta connexion.";
  }
  renderAll();
  renderTrends();
}
start();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
