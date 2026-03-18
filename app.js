var memorialClient = window.supabase.createClient(
  window.APP_CONFIG.supabaseUrl,
  window.APP_CONFIG.supabasePublishableKey
);

var currentMemorial = null;
var currentCampaign = null;
var currentParticipant = null;
var memorialSlug = null;
var allMemorials = [];

var LS_KEY = "memorial_user_details";
var LS_SUBMITTED_KEY = "memorial_submitted_recitations"; // duplicate prevention

// ── URL helpers ───────────────────────────────────────────────
function getSlugFromUrl() {
  return new URLSearchParams(window.location.search).get("slug");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateLinksForSlug() {
  var totalsLink = document.getElementById("totalsLink");
  if (!totalsLink) return;
  if (memorialSlug) {
    totalsLink.href = "totals.html?slug=" + encodeURIComponent(memorialSlug);
    totalsLink.style.display = "";
  } else {
    totalsLink.href = "totals.html";
    totalsLink.style.display = "none";
  }
}

// ── chooser / app visibility ──────────────────────────────────
function showChooser() {
  var chooser = document.getElementById("chooserWrap");
  var app = document.getElementById("memorialApp");
  if (chooser) chooser.style.display = "block";
  if (app) app.style.display = "none";
}

function showMemorialApp() {
  var chooser = document.getElementById("chooserWrap");
  var app = document.getElementById("memorialApp");
  if (chooser) chooser.style.display = "none";
  if (app) app.style.display = "block";
}

// ── localStorage user details ─────────────────────────────────
function loadSavedDetails() {
  try { var raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}

function saveDetailsLocally(name, ukCity, pakCity, relation) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ name: name, ukCity: ukCity, pakCity: pakCity, relation: relation })); }
  catch (e) {}
}

function populateDetailsForm() {
  var saved = loadSavedDetails();
  if (!saved) return;
  var f = function(id, val) { var el = document.getElementById(id); if (el) el.value = val || ""; };
  f("readerName", saved.name); f("ukCity", saved.ukCity);
  f("pakCity", saved.pakCity); f("relation", saved.relation);
}

function updateDetailsBadge() {
  var saved = loadSavedDetails();
  var badge = document.getElementById("detailsSavedBadge");
  var nameSpan = document.getElementById("savedNameDisplay");
  if (!badge) return;
  if (saved && (saved.name || saved.relation === "Anonymous")) {
    badge.style.display = "block";
    if (nameSpan) nameSpan.textContent = saved.relation === "Anonymous" ? "Anonymous" : saved.name;
  } else {
    badge.style.display = "none";
  }
}

// ── duplicate submission tracking ─────────────────────────────
function getSubmittedKey() {
  return LS_SUBMITTED_KEY + "_" + (memorialSlug || "default");
}

function getSubmittedRecitations() {
  try { var raw = localStorage.getItem(getSubmittedKey()); return raw ? JSON.parse(raw) : {}; }
  catch (e) { return {}; }
}

function markRecitationsSubmitted(names) {
  try {
    var submitted = getSubmittedRecitations();
    names.forEach(function(n) { submitted[n] = true; });
    localStorage.setItem(getSubmittedKey(), JSON.stringify(submitted));
  } catch (e) {}
}

function getAlreadySubmitted(names) {
  var submitted = getSubmittedRecitations();
  return names.filter(function(n) { return submitted[n]; });
}

// ── modal helpers ─────────────────────────────────────────────
function openModal(id) { var el = document.getElementById(id); if (el) el.classList.add("open"); }
function closeModal(id) { var el = document.getElementById(id); if (el) el.classList.remove("open"); }

function bindModalClose(overlayId, closeBtnIds) {
  var overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(overlayId); });
  closeBtnIds.forEach(function (btnId) {
    var btn = document.getElementById(btnId);
    if (btn) btn.addEventListener("click", function () { closeModal(overlayId); });
  });
}

// ── tab binding ───────────────────────────────────────────────
function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".tab-content").forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      var target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });
}

// ── recitation counter ────────────────────────────────────────
function count(id, val) {
  var el = document.getElementById(id);
  if (!el) return;
  var num = parseInt(el.innerText || "0", 10) + val;
  if (num < 0) num = 0;
  el.innerText = String(num);
  updateSummary();
}

var RECITATION_ITEMS = [
  ["Bismillah","bismillah"],["Alhamdulillah","alhamdulillah"],
  ["Subhanallah","subhanallah"],["Astaghfirullah","astaghfirullah"],
  ["Durood Sharif","durood"],["Surah Fatiha","fatiha"],
  ["Surah Ikhlas","ikhlas"],["Surah Yasin","yasin"]
];

function updateSummary() {
  var summary = document.getElementById("quickSummary");
  if (!summary) return;
  var submitted = getSubmittedRecitations();
  var active = RECITATION_ITEMS.map(function (item) {
    var el = document.getElementById(item[1]);
    return { label: item[0], id: item[1], count: parseInt((el && el.innerText) || "0", 10) };
  }).filter(function (row) { return row.count > 0; });

  if (!active.length) {
    summary.innerHTML = '<div class="summary-row"><span>No recitations added yet</span><strong>0</strong></div>';
    return;
  }
  var total = 0;
  summary.innerHTML = active.map(function (row) {
    total += row.count;
    var alreadyDone = submitted[row.label];
    return '<div class="summary-row' + (alreadyDone ? ' already-submitted" title="Already submitted"' : '"') + '>' +
      '<span>' + row.label + (alreadyDone ? ' ⚠' : '') + '</span><strong>' + row.count + '</strong></div>';
  }).join("") + '<div class="summary-row"><span>Total</span><strong>' + total + '</strong></div>';
}

// ── load memorial ─────────────────────────────────────────────
async function getMemorialWithRetry() {
  for (var attempt = 1; attempt <= 3; attempt++) {
    var result = await memorialClient.from("memorials").select("*").eq("slug", memorialSlug).maybeSingle();
    if (!result.error && result.data) return result.data;
    await new Promise(function (resolve) { setTimeout(resolve, 400 * attempt); });
  }
  return null;
}

function renderCampaignPills(campaign) {
  var pillRow = document.querySelector(".stats-toolbar .pill-row");
  if (!pillRow || !campaign) return;
  var deadlineText = campaign.deadline ? new Date(campaign.deadline).toLocaleString() : "No deadline set";
  pillRow.innerHTML =
    '<div class="pill">Campaign: ' + escapeHtml(campaign.title || "Untitled") + '</div>' +
    '<div class="pill">Deadline: ' + escapeHtml(deadlineText) + '</div>';
}

async function loadMemorial() {
  memorialSlug = getSlugFromUrl();
  updateLinksForSlug();

  if (!memorialSlug) { showChooser(); await loadMemorialChooser(); return; }

  showMemorialApp();
  var memorial = await getMemorialWithRetry();
  if (!memorial) { alert("Could not load memorial."); showChooser(); await loadMemorialChooser(); return; }

  currentMemorial = memorial;

  var nameEl = document.querySelector(".memorial-name");
  if (nameEl) nameEl.textContent = currentMemorial.full_name || "Memorial";

  var metaEl = document.querySelector(".memorial-info-bar .meta");
  if (metaEl) {
    metaEl.innerHTML =
      "Age: " + (currentMemorial.age ?? "-") + " &nbsp;·&nbsp; " +
      "Passed away: " + (currentMemorial.date_of_passing ?? "-") + " &nbsp;·&nbsp; " +
      "Mosque: " + (currentMemorial.mosque_name ?? "-");
  }

  var modalName = document.getElementById("modalMemorialName");
  if (modalName) modalName.textContent = currentMemorial.full_name || "Memorial";

  var modalMeta = document.getElementById("modalMemorialMeta");
  if (modalMeta) {
    modalMeta.innerHTML =
      "<strong>Age:</strong> " + (currentMemorial.age ?? "-") + "<br>" +
      "<strong>Passed away:</strong> " + (currentMemorial.date_of_passing ?? "-") + "<br>" +
      "<strong>Mosque:</strong> " + (currentMemorial.mosque_name ?? "-") + "<br>" +
      (currentMemorial.uk_city ? "<strong>UK City:</strong> " + currentMemorial.uk_city + "<br>" : "") +
      (currentMemorial.pak_city ? "<strong>Pakistani City:</strong> " + currentMemorial.pak_city : "");
  }

  var modalTribute = document.getElementById("modalTribute");
  if (modalTribute && currentMemorial.tribute) modalTribute.textContent = currentMemorial.tribute;

  // WhatsApp share button
  var waBtn = document.getElementById("whatsappShareBtn");
  if (waBtn) {
    var shareUrl = window.location.origin + window.location.pathname + "?slug=" + encodeURIComponent(memorialSlug);
    var shareMsg = "Please recite and make dua for " + (currentMemorial.full_name || "the deceased") + ". Join the collective Quran Khatam here: " + shareUrl;
    waBtn.href = "https://wa.me/?text=" + encodeURIComponent(shareMsg);
  }

  await restoreParticipant();

  var campaignResult = await memorialClient.from("khatam_campaigns").select("*")
    .eq("memorial_id", currentMemorial.id).order("created_at", { ascending: true });

  if (!campaignResult.error && campaignResult.data && campaignResult.data.length) {
    currentCampaign = campaignResult.data[0];
    renderCampaignPills(currentCampaign);
  }

  await loadJuzBoard();
  await loadSidebarStats();
}

// ── restore participant ───────────────────────────────────────
async function restoreParticipant() {
  var saved = loadSavedDetails();
  updateDetailsBadge();
  if (!saved || !currentMemorial) return;
  var name = saved.relation === "Anonymous" ? "Anonymous" : (saved.name || "");
  if (!name) return;
  var result = await memorialClient.from("participants").select("*")
    .eq("memorial_id", currentMemorial.id).eq("name", name).limit(1);
  if (!result.error && result.data && result.data.length) currentParticipant = result.data[0];
}

// ── chooser ───────────────────────────────────────────────────
async function loadMemorialChooser() {
  var dropdown = document.getElementById("memorialDropdown");
  var openBtn = document.getElementById("openMemorialBtn");
  if (!dropdown || !openBtn) return;
  dropdown.innerHTML = '<option value="">Loading memorials...</option>';
  openBtn.disabled = true;
  var result = await memorialClient.from("memorials").select("*").order("full_name", { ascending: true });
  if (result.error) { dropdown.innerHTML = '<option value="">Could not load memorials</option>'; return; }
  allMemorials = result.data || [];
  if (!allMemorials.length) { dropdown.innerHTML = '<option value="">No memorials created yet</option>'; return; }
  dropdown.innerHTML = '<option value="">Select a memorial</option>' +
    allMemorials.map(function (m) {
      var label = m.full_name || m.slug || "Memorial";
      if (m.mosque_name) label += " — " + m.mosque_name;
      return '<option value="' + escapeHtml(m.slug) + '">' + escapeHtml(label) + '</option>';
    }).join("");
  openBtn.disabled = false;
  dropdown.addEventListener("change", function () { openBtn.disabled = !dropdown.value; });
  openBtn.addEventListener("click", function () {
    if (!dropdown.value) { alert("Please choose a memorial first."); return; }
    window.location.href = "index.html?slug=" + encodeURIComponent(dropdown.value);
  });
}

// ── save participant ──────────────────────────────────────────
async function saveParticipant() {
  if (!currentMemorial) { alert("Memorial not loaded yet."); return; }
  var name = (document.getElementById("readerName") || {}).value || "";
  var ukCity = (document.getElementById("ukCity") || {}).value || "";
  var pakCity = (document.getElementById("pakCity") || {}).value || "";
  var relation = (document.getElementById("relation") || {}).value || "";
  name = name.trim(); ukCity = ukCity.trim(); pakCity = pakCity.trim();
  if (!name && relation !== "Anonymous") { alert("Please enter your name or choose Anonymous."); return; }
  var finalName = relation === "Anonymous" ? "Anonymous" : name;
  saveDetailsLocally(name, ukCity, pakCity, relation);
  updateDetailsBadge();
  var existing = await memorialClient.from("participants").select("*")
    .eq("memorial_id", currentMemorial.id).eq("name", finalName).limit(1);
  if (!existing.error && existing.data && existing.data.length) {
    currentParticipant = existing.data[0];
    closeModal("detailsModal");
    alert("Details saved. Welcome back, " + finalName + ".");
    return;
  }
  var result = await memorialClient.from("participants").insert({
    memorial_id: currentMemorial.id, name: finalName,
    uk_city: ukCity || null, pak_city: pakCity || null, relation: relation || null
  }).select().single();
  if (result.error) { console.error("saveParticipant error:", result.error); alert("Could not save participant."); return; }
  currentParticipant = result.data;
  closeModal("detailsModal");
  alert("Details saved. JazakAllah Khair.");
  await loadSidebarStats();
}

// ── submit recitations (with duplicate prevention) ────────────
async function submitQuickRecitations() {
  if (!currentMemorial) { alert("Memorial not loaded yet."); return; }
  if (!currentParticipant) { alert("Please save your details first."); openModal("detailsModal"); return; }

  var rows = RECITATION_ITEMS.map(function (item) {
    var el = document.getElementById(item[1]);
    return { label: item[0], id: item[1], count: parseInt((el && el.innerText) || "0", 10) };
  }).filter(function (row) { return row.count > 0; });

  if (!rows.length) { alert("Add recitations first."); return; }

  // Check duplicates
  var alreadyDone = getAlreadySubmitted(rows.map(function(r) { return r.label; }));
  if (alreadyDone.length) {
    var names = alreadyDone.join(", ");
    var proceed = confirm(
      "You have already submitted: " + names + ".\n\n" +
      "To avoid counting the same recitations twice, these will be skipped.\n\nContinue with the remaining recitations?"
    );
    if (!proceed) return;
    rows = rows.filter(function(r) { return !alreadyDone.includes(r.label); });
    if (!rows.length) { alert("No new recitations to submit."); return; }
  }

  var insertRows = rows.map(function(r) {
    return {
      memorial_id: currentMemorial.id,
      participant_id: currentParticipant.id,
      recitation_name: r.label,
      recitation_count: r.count
    };
  });

  var result = await memorialClient.from("quick_recitations").insert(insertRows);
  if (result.error) { console.error("submitQuickRecitations error:", result.error); alert("Could not submit recitations."); return; }

  // Mark as submitted in localStorage
  markRecitationsSubmitted(rows.map(function(r) { return r.label; }));

  alert("Recitations submitted. JazakAllah Khair.");

  RECITATION_ITEMS.forEach(function (item) {
    var el = document.getElementById(item[1]);
    if (el) el.innerText = "0";
  });

  updateSummary();
  await loadSidebarStats();
}

// ── Juz board (with Mark as Completed) ───────────────────────
async function loadJuzBoard() {
  var juzList = document.getElementById("juzList");
  if (!juzList) return;

  if (!currentCampaign) {
    juzList.innerHTML = '<div class="muted-text">No khatam campaign found for this memorial yet.</div>';
    return;
  }

  var result = await memorialClient.from("khatam_claims").select("*")
    .eq("campaign_id", currentCampaign.id).order("juz_number", { ascending: true });

  if (result.error) { juzList.innerHTML = '<div class="muted-text">Could not load Juz board.</div>'; return; }

  var data = result.data || [];
  juzList.innerHTML = "";

  for (var i = 1; i <= 30; i++) {
    var claim = data.find(function (x) { return x.juz_number === i; });
    var isClaimed = !!claim;
    var isCompleted = claim && claim.status === "completed";
    var isMyJuz = claim && currentParticipant && claim.participant_id === currentParticipant.id;

    var card = document.createElement("div");
    card.className = "juz-card" + (isMyJuz ? " my-juz" : "");

    var statusText = isCompleted ? "Completed ✓" : isClaimed ? (isMyJuz ? "Claimed by you" : "Already reserved") : "Available";
    var btnClass = isCompleted ? "completed" : isClaimed ? "claimed" : "available";
    var btnText = isCompleted ? "Completed" : (isMyJuz && !isCompleted) ? "Mark done" : isClaimed ? "Claimed" : "Claim";

    card.innerHTML =
      '<div class="juz-meta"><strong>Juz ' + i + '</strong><span>' + statusText + '</span></div>' +
      '<button type="button" class="juz-btn ' + btnClass + '">' + btnText + '</button>';

    var btn = card.querySelector("button");

    if (!isClaimed && btn) {
      // Claim juz
      (function (juzNumber) {
        btn.addEventListener("click", async function () {
          if (!currentParticipant) { alert("Save your details first."); openModal("detailsModal"); return; }
          var insertResult = await memorialClient.from("khatam_claims").insert({
            campaign_id: currentCampaign.id, participant_id: currentParticipant.id,
            juz_number: juzNumber, status: "claimed"
          });
          if (insertResult.error) { console.error("claim error:", insertResult.error); alert("Could not claim this Juz."); return; }
          await loadJuzBoard(); await loadSidebarStats();
        });
      })(i);
    } else if (isMyJuz && !isCompleted && btn) {
      // Mark as completed
      (function (claimId) {
        btn.addEventListener("click", async function () {
          if (!confirm("Mark Juz " + i + " as completed?")) return;
          var updateResult = await memorialClient.from("khatam_claims")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", claimId);
          if (updateResult.error) { console.error("complete error:", updateResult.error); alert("Could not mark as completed."); return; }
          await loadJuzBoard(); await loadSidebarStats();
        });
      })(claim.id);
    }

    juzList.appendChild(card);
  }
}

// ── live sidebar stats ────────────────────────────────────────
async function loadSidebarStats() {
  if (!currentMemorial) return;
  var readersResult = await memorialClient.from("participants")
    .select("id", { count: "exact", head: true }).eq("memorial_id", currentMemorial.id);
  var readerCount = readersResult.count ?? 0;

  var recResult = await memorialClient.from("quick_recitations")
    .select("recitation_count").eq("memorial_id", currentMemorial.id);
  var recTotal = 0;
  (recResult.data || []).forEach(function (r) { recTotal += r.recitation_count; });

  var juzClaimed = 0, juzDone = 0;
  if (currentCampaign) {
    var claimsResult = await memorialClient.from("khatam_claims").select("status").eq("campaign_id", currentCampaign.id);
    (claimsResult.data || []).forEach(function (c) { juzClaimed++; if (c.status === "completed") juzDone++; });
  }

  var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  set("statReaders", readerCount); set("statRecitations", recTotal);
  set("statJuz", juzClaimed); set("statJuzDone", juzDone);

  await loadLeaderboard();
  await loadRecentActivity();
}

async function loadLeaderboard() {
  if (!currentMemorial) return;
  var list = document.getElementById("leaderboardList");
  if (!list) return;
  var participantsResult = await memorialClient.from("participants").select("id, name").eq("memorial_id", currentMemorial.id);
  var recResult = await memorialClient.from("quick_recitations").select("participant_id, recitation_count").eq("memorial_id", currentMemorial.id);
  if (participantsResult.error || recResult.error) return;
  var totals = {};
  (recResult.data || []).forEach(function (r) { totals[r.participant_id] = (totals[r.participant_id] || 0) + r.recitation_count; });
  var ranked = (participantsResult.data || []).map(function (p) {
    return { name: p.name || "Anonymous", total: totals[p.id] || 0 };
  }).sort(function (a, b) { return b.total - a.total; }).slice(0, 5);
  if (!ranked.length || ranked.every(function (r) { return r.total === 0; })) {
    list.innerHTML = '<div class="leaderboard-item"><span>No recitations yet</span><strong>—</strong></div>'; return;
  }
  list.innerHTML = ranked.map(function (r, i) {
    return '<div class="leaderboard-item"><span>' + (i + 1) + '. ' + escapeHtml(r.name) + '</span><strong>' + r.total + '</strong></div>';
  }).join("");
}

async function loadRecentActivity() {
  if (!currentMemorial) return;
  var list = document.getElementById("activityList");
  if (!list) return;
  var recResult = await memorialClient.from("quick_recitations")
    .select("recitation_name, recitation_count, created_at").eq("memorial_id", currentMemorial.id)
    .order("created_at", { ascending: false }).limit(6);
  if (recResult.error || !recResult.data || !recResult.data.length) {
    list.innerHTML = '<div class="activity-item"><span>No activity yet</span><strong>—</strong></div>'; return;
  }
  list.innerHTML = recResult.data.map(function (r) {
    var time = new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return '<div class="activity-item"><span>' + escapeHtml(r.recitation_name) + ' (' + r.recitation_count + ')</span><strong>' + time + '</strong></div>';
  }).join("");
}

// ── bind buttons ──────────────────────────────────────────────
function bindButtons() {
  var saveBtn = document.getElementById("saveDetailsBtn");
  if (saveBtn) saveBtn.addEventListener("click", saveParticipant);

  var submitBtn = document.getElementById("submitQuickBtn");
  if (submitBtn) submitBtn.addEventListener("click", submitQuickRecitations);

  var openDetailsBtn = document.getElementById("openDetailsModalBtn");
  if (openDetailsBtn) openDetailsBtn.addEventListener("click", function () { populateDetailsForm(); openModal("detailsModal"); });

  var showInfoBtn = document.getElementById("showMemorialInfoBtn");
  if (showInfoBtn) showInfoBtn.addEventListener("click", function () { openModal("memorialInfoModal"); });

  bindModalClose("memorialInfoModal", ["closeInfoModal"]);
  bindModalClose("detailsModal", ["closeDetailsModal", "cancelDetailsBtn"]);
}

// ── realtime ──────────────────────────────────────────────────
function bindRealtime() {
  memorialClient.channel("live-khatam")
    .on("postgres_changes", { event: "*", schema: "public", table: "khatam_claims" }, async function () { await loadJuzBoard(); await loadSidebarStats(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "quick_recitations" }, async function () { await loadSidebarStats(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, async function () { await loadSidebarStats(); })
    .subscribe();
}

// ── init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async function () {
  bindTabs(); bindButtons(); updateSummary(); updateDetailsBadge();
  await loadMemorial(); bindRealtime();
});
