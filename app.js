// Veille Pro : affiche la veille (data/offres.json), suit les candidatures et aide à postuler.
// Tout ce qui est personnel (profil, CV, lettres, candidatures) reste sur le téléphone.

const STAGES = ["Prête", "Envoyée", "Relancée", "Entretien", "Signé", "Refus"];
// Part de l'œil du Daruma peinte selon l'étape la plus avancée.
const FILL = { "Prête": 10, "Envoyée": 25, "Relancée": 40, "Entretien": 70, "Signé": 100, "Refus": 0 };
const STORE_KEY = "veille-pro:candidatures";
const PROFILE_KEY = "veille-pro:profil";
const REPO = "saaandesign/veille-pro";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let data = { offres: [], tendances: [] };
let cand = readJSON(STORE_KEY, {});
let profile = readJSON(PROFILE_KEY, { nom: "", localisation: "", linkedin: "", motsCles: [] });
// Tri : "priorite" met en tête les offres fraîches et compatibles, pour postuler parmi les premiers.
let sortMode = "priorite";
let showOld = false;
const OLD_DAYS = 14; // au-delà, l'offre est masquée par défaut : trop tard pour être parmi les premiers
try { sortMode = localStorage.getItem("veille-pro:tri") || "priorite"; } catch (e) {}

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ }
}
const save = () => writeJSON(STORE_KEY, cand);
const saveProfile = () => writeJSON(PROFILE_KEY, profile);

// Âge d'une offre en jours, à partir de sa date de publication (AAAA-MM-JJ).
function ageDays(iso) {
  if (!iso) return 99;
  const d = new Date(iso + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today - d) / 86400000));
}
const ageCls = (d) => (d <= 7 ? "new" : d <= 21 ? "" : "late");
const ageTxt = (d) => (d === 0 ? "Aujourd'hui" : d === 1 ? "Hier" : `Il y a ${d} j`);
// Score de priorité : le match compte, mais chaque jour d'ancienneté coûte 3 points.
const priority = (o) => (Number(o.match) || 0) - 3 * ageDays(o.publiee);

/* ---------- Daruma ---------- */

let darumaCount = 0;
// Le corps vient du symbole #daruma ; les yeux sont dessinés ici pour pouvoir bouger et cligner.
function darumaSVG(cls = "", label = "Daruma") {
  const id = "eyeClip" + darumaCount++;
  return `<svg viewBox="0 0 200 200" class="daruma ${cls}" role="img" aria-label="${esc(label)}">
    <defs><clipPath id="${id}"><circle cx="126" cy="80" r="10"/></clipPath></defs>
    <use href="#daruma"/>
    <g class="blink">
      <circle cx="74" cy="80" r="16" fill="#fafaf9" stroke="#e13232" stroke-width="3"/>
      <circle cx="126" cy="80" r="16" fill="#fafaf9" stroke="#e13232" stroke-width="3"/>
      <g class="look">
        <circle cx="74" cy="80" r="10" fill="#262222"/>
        <circle cx="126" cy="80" r="9.5" fill="none" stroke="#262222" stroke-opacity=".2" stroke-dasharray="2 3"/>
        <rect class="eye-ink" x="114" y="90" width="24" height="0" fill="#262222" clip-path="url(#${id})"/>
      </g>
    </g>
  </svg>`;
}

function paintEye() {
  const best = Math.max(0, ...Object.values(cand).map((c) => FILL[c.etape] || 0));
  const h = (20 * best) / 100;
  const r = $("#wishArt .eye-ink");
  if (r) { r.setAttribute("y", 90 - h); r.setAttribute("height", h); }
  $("#prog").textContent = best === 100 ? "Vœu exaucé : œil complété" : `Second œil peint à ${best} %`;
}

// Écran d'ouverture : l'œil se remplit, puis on plonge dans le second œil.
function splash() {
  const boot = $("#boot");
  if (reduceMotion) { if (boot) boot.remove(); return Promise.resolve(); }
  return new Promise((done) => {
    const el = boot || document.body.appendChild(document.createElement("div"));
    el.className = "splash";
    el.innerHTML = darumaSVG("splash-d still", "Veille Pro");
    document.body.appendChild(el);
    const ink = $(".eye-ink", el);
    ink.innerHTML = '<animate attributeName="height" from="0" to="20" begin="0.45s" dur="0.9s" fill="freeze"/>' +
      '<animate attributeName="y" from="90" to="70" begin="0.45s" dur="0.9s" fill="freeze"/>';
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      el.classList.add("out");
      setTimeout(() => { el.remove(); done(); }, 380);
    };
    el.addEventListener("click", finish);
    setTimeout(() => el.classList.add("zoom"), 1450);
    setTimeout(finish, 2350);
  });
}

/* ---------- En-tête et listes ---------- */

function header() {
  const now = new Date();
  $("#day").textContent = now.toLocaleDateString("fr-FR", { weekday: "long" });
  $("#date").textContent = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
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
  let maj = "";
  if (data.derniereVeille) {
    const t = new Date(data.derniereVeille);
    maj = ` · veille du ${t.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  } else if (data.miseAJour) {
    maj = ` · mise à jour le ${new Date(data.miseAJour + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
  }
  $("#lead").textContent = (data.exemple ? "Offres d'exemple" : `${recent} nouvelle${recent > 1 ? "s" : ""} cette semaine`) + maj;
  L.innerHTML = "";
  offres.forEach((o) => {
    const d = ageDays(o.publiee);
    const b = document.createElement("button");
    b.className = "offer" + (d > 21 ? " old" : "");
    b.innerHTML = `<span class="o-txt"><p class="o-title">${esc(o.titre)}</p>
      <span class="o-sub">${esc(o.entreprise)} · ${esc(o.contrat)} · ${esc(o.lieu)}</span>
      <span class="meta">${d <= 2 ? '<span class="fresh">Tout frais</span>' : ""}<span class="age ${ageCls(d)}">${ageTxt(d)}</span>${cand[o.id] ? `<span class="applied${cand[o.id].etape === "Prête" ? " ready" : ""}">${esc(cand[o.id].etape)}</span>` : ""}</span></span>
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
  $$(".app-row").forEach((r) => {
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

/* ---------- Ce qui matche ---------- */

// Compétences de base de Robin, utilisées si la veille n'a pas fourni la liste "communs".
const BASE_SKILLS = ["adobe", "photoshop", "illustrator", "indesign", "premiere", "after effects", "montage", "vidéo", "video",
  "motion", "graphi", "identité", "branding", "brand", "social", "réseaux", "reels", "tiktok", "formats courts", "tournage",
  "prise de vue", "ia ", "ia générative", "création", "contenu", "community", "calendrier", "direction artistique", "print", "affiche", "web"];
function commonSkills(o) {
  if (Array.isArray(o.communs) && o.communs.length) return o.communs;
  const keys = [...BASE_SKILLS, ...(profile.motsCles || []).map((k) => k.toLowerCase())];
  return (o.attendus || []).filter((a) => { const s = " " + a.toLowerCase() + " "; return keys.some((k) => s.includes(k)); });
}

/* ---------- Fiche d'une offre ---------- */

const isEmail = (t) => t && t.includes("@") && !t.includes("://");

function openSheet(o) {
  const c = cand[o.id];
  const i = c ? STAGES.indexOf(c.etape) : -1;
  const d = o.publiee ? ageDays(o.publiee) : null;
  const list = (arr) => (arr && arr.length ? arr : null);
  const communs = commonSkills(o);
  const notYetSent = !c || c.etape === "Prête";
  const canAdvance = c && !notYetSent && c.etape !== "Signé" && c.etape !== "Refus";

  $("#sheet").innerHTML = `<div class="grip"></div>
    ${d !== null && o.publiee ? `<span class="age ${ageCls(d)}">Publiée ${ageTxt(d).toLowerCase()}</span>` : ""}
    <h3>${esc(o.titre)}</h3><span class="o-sub">${esc(o.entreprise)}${o.contrat ? " · " + esc(o.contrat) : ""}${o.lieu ? " · " + esc(o.lieu) : ""}</span>
    ${o.pourquoi ? `<div class="why"><span class="pc">${Number(o.match) || 0}<small>%</small></span><p>${esc(o.pourquoi)}</p></div>` : ""}
    ${communs.length ? `<div class="sec"><h4>Ce qui matche avec ton profil</h4><div class="tags">${communs.map((x) => `<span class="tag match">${esc(x)}</span>`).join("")}</div></div>` : ""}
    ${list(o.missions) ? `<div class="sec"><h4>Missions</h4><ul>${o.missions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${list(o.attendus) ? `<div class="sec"><h4>Ce qu'ils attendent</h4><div class="tags">${o.attendus.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div></div>` : ""}
    ${o.angle ? `<div class="sec"><h4>Ton angle</h4><p>${esc(o.angle)}</p></div>` : ""}
    ${o.lien ? `<a class="link" href="${esc(o.lien)}" target="_blank" rel="noopener">Voir l'annonce</a>` : ""}
    <div id="applyFlow"></div>
    <div class="actions">
      <button class="btn" id="close">Fermer</button>
      ${notYetSent ? `<button class="btn primary" id="startApply">Postuler</button>` : ""}
      ${canAdvance ? `<button class="btn primary" id="advance">${STAGES[i + 1]}</button>` : ""}
    </div>
    ${!c ? '<button class="undo" id="already">J\'ai déjà postulé ailleurs</button>' : ""}
    ${c && c.etape !== "Refus" && c.etape !== "Signé" ? '<button class="undo" id="refus">Marquer comme refusée</button>' : ""}
    ${c ? '<button class="undo" id="remove">Retirer de mes candidatures</button>' : ""}`;

  const sheet = $("#sheet");
  sheet.scrollTop = 0;
  sheet.style.transform = "";
  $("#sheetBg").hidden = false;
  $("#close").onclick = closeSheet;
  const set = (etape) => {
    cand[o.id] = { ...(c || {}), etape, titre: o.titre, entreprise: o.entreprise, contrat: o.contrat, lieu: o.lieu, date: new Date().toISOString().slice(0, 10) };
    save(); closeSheet(); renderAll();
  };
  if ($("#startApply")) $("#startApply").onclick = () => applyFlow(o, c, set);
  if ($("#advance")) $("#advance").onclick = () => set(STAGES[i + 1]);
  if ($("#already")) $("#already").onclick = () => set("Envoyée");
  if ($("#refus")) $("#refus").onclick = () => set("Refus");
  if ($("#remove")) $("#remove").onclick = () => { delete cand[o.id]; save(); closeSheet(); renderAll(); };
}
function closeSheet() { $("#sheetBg").hidden = true; }

// Postuler en 3 étapes : le CV, la lettre, puis l'envoi (mail avec pièces jointes, ou site de candidature).
async function applyFlow(o, c, set) {
  const files = await listFiles();
  const cvs = files.filter((f) => f.type === "cv");
  const lettres = files.filter((f) => f.type === "lettre");
  const target = (c && c.postuler) || o.postuler || "";
  const email = isEmail(target) ? target : "";
  const site = !email ? (target || o.lien || "") : "";
  const pick = (arr, name) => arr.length
    ? arr.map((f, k) => `<label class="pick"><input type="radio" name="${name}" value="${f.id}" ${k === 0 ? "checked" : ""}><span>${esc(f.nom)}</span></label>`).join("")
    : "";

  $("#startApply").hidden = true;
  $("#applyFlow").innerHTML = `<div class="flow">
    <div class="step"><span class="num">1</span><div><h4>Ton CV</h4>
      ${cvs.length ? pick(cvs, "cv") : '<p class="hint">Aucun CV pour l\'instant. Ajoute-le dans ton <button class="inline" data-open-profile>profil</button>.</p>'}</div></div>
    <div class="step"><span class="num">2</span><div><h4>Ta lettre</h4>
      ${pick(lettres, "lettre")}<label class="pick"><input type="radio" name="lettre" value="" ${lettres.length ? "" : "checked"}><span>Sans lettre</span></label>
      ${c && c.etape === "Prête" ? '<p class="hint">Ta lettre pour cette offre est prête : télécharge le PDF depuis le fil des lettres et ajoute-le à ton profil.</p>' : ""}</div></div>
    <div class="step"><span class="num">3</span><div><h4>Envoyer</h4>
      ${email ? `<p class="hint">Par e-mail à <b class="sel">${esc(email)}</b></p>
        <button class="btn apply" id="sendMail">Envoyer avec mes fichiers</button>
        <button class="undo left" id="copyMail">Copier l'adresse</button>`
      : site ? `<p class="hint">Sur le site de l'annonce : tes fichiers sont sur ton téléphone, prêts à être joints.</p>
        <a class="btn apply" href="${esc(site)}" target="_blank" rel="noopener" id="openSite">Ouvrir le site de candidature</a>`
      : '<p class="hint">Pas de lien de candidature pour cette offre.</p>'}
      <button class="btn primary sent" id="sent">C'est envoyé</button></div></div>
  </div>`;
  $$("[data-open-profile]").forEach((b) => (b.onclick = () => { closeSheet(); openProfile(); }));
  $("#sent").onclick = () => set("Envoyée");
  const chosen = () => {
    const ids = ["cv", "lettre"].map((n) => ($(`input[name="${n}"]:checked`) || {}).value).filter(Boolean);
    return files.filter((f) => ids.includes(f.id));
  };
  if ($("#copyMail")) $("#copyMail").onclick = async () => {
    try { await navigator.clipboard.writeText(email); $("#copyMail").textContent = "Adresse copiée"; } catch (e) { $("#copyMail").textContent = email; }
  };
  if ($("#sendMail")) $("#sendMail").onclick = async () => {
    const fs = chosen().map((f) => new File([f.blob], f.nom, { type: f.blob.type || "application/pdf" }));
    const subject = `Candidature : ${o.titre}`;
    const body = `Bonjour,\n\nJe vous adresse ma candidature pour le poste de ${o.titre}. Vous trouverez mon CV${fs.length > 1 ? " et ma lettre de motivation" : ""} en pièce jointe.\n\nBien à vous,\n${profile.nom || ""}`;
    if (fs.length && navigator.canShare && navigator.canShare({ files: fs })) {
      try { await navigator.share({ files: fs, title: subject, text: body }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  $("#applyFlow").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

/* ---------- Fichiers (CV, lettres) : stockés sur le téléphone ---------- */

function db() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open("veille-pro", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("fichiers", { keyPath: "id" });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function listFiles() {
  try {
    const d = await db();
    return await new Promise((ok) => {
      const q = d.transaction("fichiers").objectStore("fichiers").getAll();
      q.onsuccess = () => ok(q.result || []);
      q.onerror = () => ok([]);
    });
  } catch (e) { return []; }
}
async function putFile(f) {
  const d = await db();
  return new Promise((ok, ko) => { const t = d.transaction("fichiers", "readwrite"); t.objectStore("fichiers").put(f); t.oncomplete = ok; t.onerror = () => ko(t.error); });
}
async function deleteFile(id) {
  const d = await db();
  return new Promise((ok) => { const t = d.transaction("fichiers", "readwrite"); t.objectStore("fichiers").delete(id); t.oncomplete = ok; t.onerror = ok; });
}

/* ---------- Profil ---------- */

async function renderProfile() {
  $("#pNom").value = profile.nom || "";
  $("#pLieu").value = profile.localisation || "";
  $("#pLinkedin").value = profile.linkedin || "";
  $("#pKeys").innerHTML = (profile.motsCles || []).map((k, n) => `<span class="tag key">${esc(k)}<button aria-label="Retirer ${esc(k)}" data-k="${n}">×</button></span>`).join("")
    || '<span class="hint">Aucun mot-clé pour l\'instant.</span>';
  $$("#pKeys [data-k]").forEach((b) => (b.onclick = () => { profile.motsCles.splice(Number(b.dataset.k), 1); saveProfile(); renderProfile(); }));
  const files = await listFiles();
  for (const type of ["cv", "lettre"]) {
    const box = $(type === "cv" ? "#pCvs" : "#pLettres");
    const own = files.filter((f) => f.type === type);
    box.innerHTML = own.length
      ? own.map((f) => `<div class="file"><span>${esc(f.nom)}</span><button class="undo" data-del="${f.id}">Supprimer</button></div>`).join("")
      : `<p class="hint">${type === "cv" ? "Aucun CV" : "Aucune lettre"} pour l'instant.</p>`;
  }
  $$("#profile [data-del]").forEach((b) => (b.onclick = async () => { await deleteFile(b.dataset.del); renderProfile(); }));
}
function openProfile() {
  $("#profile").hidden = false;
  document.body.classList.add("locked");
  renderProfile();
}
function closeProfile() {
  $("#profile").hidden = true;
  document.body.classList.remove("locked");
  renderList();
}
function addKeyword() {
  const v = $("#pKeyInput").value.trim();
  if (!v) return;
  profile.motsCles = [...new Set([...(profile.motsCles || []), ...v.split(",").map((s) => s.trim()).filter(Boolean)])];
  $("#pKeyInput").value = "";
  saveProfile(); renderProfile();
}
// Les mots-clés partent à la veille via une « issue » GitHub publique : seulement les mots-clés et la zone, jamais le nom ni les fichiers.
function sendToVeille() {
  const body = [
    "Mots-clés à ajouter à la veille :",
    ...(profile.motsCles || []).map((k) => "- " + k),
    "",
    "Zone : " + (profile.localisation || "inchangée"),
  ].join("\n");
  const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent("Profil veille")}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener") || (location.href = url);
}

/* ---------- Gestes : glisser pour fermer, tirer pour actualiser ---------- */

function swipeToClose(panel, close, canStart) {
  let y0 = null, dy = 0;
  panel.addEventListener("touchstart", (e) => { y0 = canStart() ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  panel.addEventListener("touchmove", (e) => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0) panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  panel.addEventListener("touchend", () => {
    if (y0 === null) return;
    panel.style.transition = "transform .2s ease";
    if (dy > 110) { panel.style.transform = "translateY(100%)"; setTimeout(() => { close(); panel.style.transform = ""; panel.style.transition = ""; }, 200); }
    else { panel.style.transform = ""; setTimeout(() => (panel.style.transition = ""), 200); }
    y0 = null;
  });
}

function pullToRefresh() {
  const ind = $("#ptr");
  let y0 = null, dy = 0, busy = false;
  const blocked = () => !$("#sheetBg").hidden || !$("#profile").hidden || window.scrollY > 0 || busy;
  window.addEventListener("touchstart", (e) => { y0 = blocked() ? null : e.touches[0].clientY; dy = 0; }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    const p = Math.min(dy / 90, 1);
    ind.style.opacity = p;
    ind.style.transform = `translate(-50%, ${Math.min(dy, 90) * 0.6}px) rotate(${p * 270}deg)`;
    ind.classList.toggle("ready", p >= 1);
  }, { passive: true });
  window.addEventListener("touchend", async () => {
    if (y0 === null) return;
    y0 = null;
    if (dy < 90) { ind.style.opacity = 0; ind.style.transform = ""; return; }
    busy = true;
    ind.classList.add("spin");
    await refresh();
    ind.classList.remove("spin", "ready");
    ind.style.opacity = 0; ind.style.transform = "";
    busy = false;
  });
}

/* ---------- Données ---------- */

// Candidatures préparées par le fil « Rédiger mes lettres de motivation » (data/candidatures.json).
// On les ajoute au téléphone, sans jamais faire reculer une étape déjà franchie ici.
async function mergeRemote() {
  try {
    const res = await fetch("data/candidatures.json", { cache: "no-cache" });
    if (!res.ok) return;
    const remote = (await res.json()).candidatures || {};
    let changed = false;
    for (const [id, r] of Object.entries(remote)) {
      if (!r || !STAGES.includes(r.etape)) continue;
      const l = cand[id];
      const ahead = !l || (l.etape !== "Refus" && STAGES.indexOf(r.etape) > STAGES.indexOf(l.etape));
      if (ahead) { cand[id] = { ...(l || {}), ...r }; changed = true; }
      else if (l && r.postuler && !l.postuler) { l.postuler = r.postuler; changed = true; }
    }
    if (changed) save();
  } catch (e) { /* pas de fichier ou hors ligne : on garde le stockage local */ }
}

async function refresh() {
  try {
    const res = await fetch("data/offres.json", { cache: "no-cache" });
    data = await res.json();
  } catch (e) {
    $("#lead").textContent = "Impossible de charger la veille. Vérifie ta connexion.";
  }
  await mergeRemote();
  renderAll();
  renderTrends();
}

function renderAll() { renderList(); renderStages(); paintEye(); }

/* ---------- Démarrage ---------- */

function wire() {
  $("#wishArt").innerHTML = darumaSVG("", "Ton Daruma : un œil peint, le second se peint à chaque étape");
  $$(".sort .chip").forEach((c) => {
    c.setAttribute("aria-pressed", c.dataset.sort === sortMode);
    c.onclick = () => {
      sortMode = c.dataset.sort;
      writeJSON("veille-pro:tri", sortMode);
      $$(".sort .chip").forEach((x) => x.setAttribute("aria-pressed", x === c));
      renderList();
    };
  });
  $("#toggleOld").onclick = () => { showOld = !showOld; renderList(); };
  $("#sheetBg").addEventListener("click", (e) => { if (e.target.id === "sheetBg") closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSheet(); if (!$("#profile").hidden) closeProfile(); } });
  $$(".tab").forEach((t) => {
    t.onclick = () => {
      $$(".tab").forEach((x) => x.setAttribute("aria-selected", x === t));
      $$(".view").forEach((v) => (v.hidden = v.id !== t.dataset.v));
      window.scrollTo(0, 0);
    };
  });
  // Profil
  $("#openProfile").onclick = openProfile;
  $("#closeProfile").onclick = closeProfile;
  $("#pNom").oninput = (e) => { profile.nom = e.target.value; saveProfile(); };
  $("#pLieu").oninput = (e) => { profile.localisation = e.target.value; saveProfile(); };
  $("#pLinkedin").oninput = (e) => { profile.linkedin = e.target.value; saveProfile(); };
  $("#pKeyAdd").onclick = addKeyword;
  $("#pKeyInput").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } };
  $("#pSend").onclick = sendToVeille;
  for (const [input, type] of [["#pCvFile", "cv"], ["#pLettreFile", "lettre"]]) {
    $(input).onchange = async (e) => {
      for (const f of e.target.files) {
        await putFile({ id: type + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7), type, nom: f.name, blob: f, date: new Date().toISOString() });
      }
      e.target.value = "";
      renderProfile();
    };
  }
  // Gestes
  swipeToClose($("#sheet"), closeSheet, () => $("#sheet").scrollTop <= 0);
  swipeToClose($("#profile .page"), closeProfile, () => $("#profile .page").scrollTop <= 0);
  pullToRefresh();
}

async function start() {
  header();
  wire();
  paintEye();
  await Promise.all([splash(), refresh()]);
}
start();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
