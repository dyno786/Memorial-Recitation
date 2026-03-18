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

// ── URL helpers ───────────────────────────────────────────────
function getSlugFromUrl() {
  return new URLSearchParams(window.location.search).get("slug");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
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

// ── show / hide ───────────────────────────────────────────────
function showChooser() {
  var c = document.getElementById("chooserWrap"); if (c) c.style.display = "block";
  var a = document.getElementById("memorialApp"); if (a) a.style.display = "none";
}
function showMemorialApp() {
  var c = document.getElementById("chooserWrap"); if (c) c.style.display = "none";
  var a = document.getElementById("memorialApp"); if (a) a.style.display = "block";
}

// ── localStorage ──────────────────────────────────────────────
function loadSavedDetails() {
  try { var r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
function saveDetailsLocally(name, ukCity, pakCity, relation) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({name,ukCity,pakCity,relation})); } catch(e) {}
}
function populateDetailsForm() {
  var s = loadSavedDetails(); if (!s) return;
  var f = function(id,v){ var el=document.getElementById(id); if(el) el.value=v||""; };
  f("readerName",s.name); f("ukCity",s.ukCity); f("pakCity",s.pakCity); f("relation",s.relation);
}
function updateDetailsBadge() {
  var s = loadSavedDetails();
  var badge = document.getElementById("detailsSavedBadge");
  var span = document.getElementById("savedNameDisplay");
  if (!badge) return;
  if (s && (s.name || s.relation === "Anonymous")) {
    badge.style.display = "block";
    if (span) span.textContent = s.relation === "Anonymous" ? "Anonymous" : s.name;
  } else { badge.style.display = "none"; }
}

// ── toast ─────────────────────────────────────────────────────
var toastTimer = null;
function showToast(msg) {
  var t = document.getElementById("recToast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove("show"); }, 1800);
}

// ── modal helpers ─────────────────────────────────────────────
function openModal(id) { var el=document.getElementById(id); if(el) el.classList.add("open"); }
function closeModal(id) { var el=document.getElementById(id); if(el) el.classList.remove("open"); }
function bindModalClose(overlayId, btnIds) {
  var overlay = document.getElementById(overlayId); if (!overlay) return;
  overlay.addEventListener("click", function(e){ if(e.target===overlay) closeModal(overlayId); });
  btnIds.forEach(function(id){ var b=document.getElementById(id); if(b) b.addEventListener("click",function(){ closeModal(overlayId); }); });
}

// ── tabs ──────────────────────────────────────────────────────
function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      document.querySelectorAll(".tab-btn").forEach(function(b){ b.classList.remove("active"); });
      document.querySelectorAll(".tab-content").forEach(function(p){ p.classList.remove("active"); });
      btn.classList.add("active");
      var t = document.getElementById(btn.dataset.tab); if(t) t.classList.add("active");
    });
  });
}

// ── counter — instant submit on + ────────────────────────────
async function count(id, label, val) {
  var el = document.getElementById(id); if (!el) return;
  var num = parseInt(el.innerText||"0",10) + val;
  if (num < 0) num = 0;
  el.innerText = String(num);

  // Only auto-submit when tapping +
  if (val > 0) {
    if (!currentParticipant) {
      openModal("detailsModal");
      el.innerText = String(num - 1); // revert
      return;
    }
    if (!currentMemorial) return;

    var result = await memorialClient.from("quick_recitations").insert({
      memorial_id: currentMemorial.id,
      participant_id: currentParticipant.id,
      recitation_name: label,
      recitation_count: 1
    });

    if (result.error) {
      console.error("instant submit error:", result.error);
      el.innerText = String(num - 1); // revert on error
      showToast("Could not save — try again");
      return;
    }

    showToast(label + " recorded ✓");
    await loadSidebarStats();
  }
}

// ── memorial load ─────────────────────────────────────────────
async function getMemorialWithRetry() {
  for (var i=1; i<=3; i++) {
    var r = await memorialClient.from("memorials").select("*").eq("slug",memorialSlug).maybeSingle();
    if (!r.error && r.data) return r.data;
    await new Promise(function(res){ setTimeout(res,400*i); });
  }
  return null;
}

function renderCampaignPills(campaign) {
  var row = document.querySelector(".stats-toolbar .pill-row");
  if (!row || !campaign) return;
  var dt = campaign.deadline ? new Date(campaign.deadline).toLocaleString() : "No deadline set";
  row.innerHTML =
    '<div class="pill">Campaign: ' + escapeHtml(campaign.title||"Untitled") + '</div>' +
    '<div class="pill">Deadline: ' + escapeHtml(dt) + '</div>';
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
  if (metaEl) metaEl.innerHTML =
    "Age: "+(currentMemorial.age??"-")+" &nbsp;·&nbsp; "+
    "Passed away: "+(currentMemorial.date_of_passing??"-")+" &nbsp;·&nbsp; "+
    "Mosque: "+(currentMemorial.mosque_name??"-");

  var mn = document.getElementById("modalMemorialName"); if(mn) mn.textContent = currentMemorial.full_name||"Memorial";
  var mm = document.getElementById("modalMemorialMeta");
  if(mm) mm.innerHTML =
    "<strong>Age:</strong> "+(currentMemorial.age??"-")+"<br>"+
    "<strong>Passed away:</strong> "+(currentMemorial.date_of_passing??"-")+"<br>"+
    "<strong>Mosque:</strong> "+(currentMemorial.mosque_name??"-")+"<br>"+
    (currentMemorial.uk_city?"<strong>UK City:</strong> "+currentMemorial.uk_city+"<br>":"")+
    (currentMemorial.pak_city?"<strong>Pakistani City:</strong> "+currentMemorial.pak_city:"");

  var mt = document.getElementById("modalTribute");
  if(mt && currentMemorial.tribute) mt.textContent = currentMemorial.tribute;

  // WhatsApp share
  var wa = document.getElementById("whatsappShareBtn");
  if (wa) {
    var shareUrl = window.location.origin + window.location.pathname + "?slug=" + encodeURIComponent(memorialSlug);
    var msg = "Please recite and make dua for " + (currentMemorial.full_name||"the deceased") + ". Join the collective Quran Khatam: " + shareUrl;
    wa.href = "https://wa.me/?text=" + encodeURIComponent(msg);
  }

  await restoreParticipant();

  var cr = await memorialClient.from("khatam_campaigns").select("*").eq("memorial_id",currentMemorial.id).order("created_at",{ascending:true});
  if (!cr.error && cr.data && cr.data.length) { currentCampaign = cr.data[0]; renderCampaignPills(currentCampaign); }

  await loadJuzBoard();
  await loadSidebarStats();
}

// ── restore participant ───────────────────────────────────────
async function restoreParticipant() {
  var s = loadSavedDetails(); updateDetailsBadge();
  if (!s || !currentMemorial) return;
  var name = s.relation==="Anonymous" ? "Anonymous" : (s.name||"");
  if (!name) return;
  var r = await memorialClient.from("participants").select("*").eq("memorial_id",currentMemorial.id).eq("name",name).limit(1);
  if (!r.error && r.data && r.data.length) currentParticipant = r.data[0];
}

// ── chooser ───────────────────────────────────────────────────
async function loadMemorialChooser() {
  var dd = document.getElementById("memorialDropdown");
  var btn = document.getElementById("openMemorialBtn");
  if (!dd||!btn) return;
  dd.innerHTML = '<option value="">Loading memorials...</option>';
  btn.disabled = true;
  var r = await memorialClient.from("memorials").select("*").order("full_name",{ascending:true});
  if (r.error) { dd.innerHTML='<option value="">Could not load memorials</option>'; return; }
  allMemorials = r.data||[];
  if (!allMemorials.length) { dd.innerHTML='<option value="">No memorials created yet</option>'; return; }
  dd.innerHTML = '<option value="">Select a memorial</option>' +
    allMemorials.map(function(m){
      var label = m.full_name||m.slug||"Memorial";
      if(m.mosque_name) label += " — "+m.mosque_name;
      return '<option value="'+escapeHtml(m.slug)+'">'+escapeHtml(label)+'</option>';
    }).join("");
  btn.disabled = false;
  dd.addEventListener("change",function(){ btn.disabled=!dd.value; });
  btn.addEventListener("click",function(){
    if(!dd.value){ alert("Please choose a memorial first."); return; }
    window.location.href = "index.html?slug="+encodeURIComponent(dd.value);
  });
}

// ── save participant ──────────────────────────────────────────
async function saveParticipant() {
  if (!currentMemorial) { alert("Memorial not loaded yet."); return; }
  var name = (document.getElementById("readerName")||{}).value||"";
  var ukCity = (document.getElementById("ukCity")||{}).value||"";
  var pakCity = (document.getElementById("pakCity")||{}).value||"";
  var relation = (document.getElementById("relation")||{}).value||"";
  name=name.trim(); ukCity=ukCity.trim(); pakCity=pakCity.trim();
  if (!name && relation!=="Anonymous") { alert("Please enter your name or choose Anonymous."); return; }
  var finalName = relation==="Anonymous" ? "Anonymous" : name;
  saveDetailsLocally(name,ukCity,pakCity,relation);
  updateDetailsBadge();

  var ex = await memorialClient.from("participants").select("*").eq("memorial_id",currentMemorial.id).eq("name",finalName).limit(1);
  if (!ex.error && ex.data && ex.data.length) {
    currentParticipant = ex.data[0];
    closeModal("detailsModal");
    showToast("Welcome back, "+finalName+" ✓");
    return;
  }

  var r = await memorialClient.from("participants").insert({
    memorial_id:currentMemorial.id, name:finalName,
    uk_city:ukCity||null, pak_city:pakCity||null, relation:relation||null
  }).select().single();
  if (r.error) { console.error(r.error); alert("Could not save participant."); return; }
  currentParticipant = r.data;
  closeModal("detailsModal");
  showToast("Details saved ✓");
  await loadSidebarStats();
}

// ── Juz board (with claimed-by name) ─────────────────────────
async function loadJuzBoard() {
  var juzList = document.getElementById("juzList"); if (!juzList) return;
  if (!currentCampaign) {
    juzList.innerHTML = '<div class="muted-text">No khatam campaign found for this memorial yet.</div>'; return;
  }

  // Fetch claims AND participant names in one go
  var r = await memorialClient.from("khatam_claims")
    .select("*, participants(name)")
    .eq("campaign_id",currentCampaign.id)
    .order("juz_number",{ascending:true});

  if (r.error) { juzList.innerHTML='<div class="muted-text">Could not load Juz board.</div>'; return; }

  var data = r.data||[];
  juzList.innerHTML = "";

  for (var i=1; i<=30; i++) {
    var claim = data.find(function(x){ return x.juz_number===i; });
    var isClaimed = !!claim;
    var isCompleted = claim && claim.status==="completed";
    var isMyJuz = claim && currentParticipant && claim.participant_id===currentParticipant.id;
    var claimerName = claim && claim.participants ? claim.participants.name : null;

    var statusText = isCompleted
      ? "Completed ✓"
      : isClaimed
        ? (claimerName ? "Claimed by " + claimerName : "Already reserved")
        : "Available";

    var btnClass = isCompleted ? "completed" : isClaimed ? "claimed" : "available";
    var btnText = isCompleted ? "Completed" : (isMyJuz && !isCompleted) ? "Mark done" : isClaimed ? "Claimed" : "Claim";

    var card = document.createElement("div");
    card.className = "juz-card" + (isMyJuz?" my-juz":"");
    card.innerHTML =
      '<div class="juz-meta"><strong>Juz '+i+'</strong><span>'+statusText+'</span></div>'+
      '<button type="button" class="juz-btn '+btnClass+'">'+btnText+'</button>';

    var btn = card.querySelector("button");

    if (!isClaimed && btn) {
      (function(juzNumber){
        btn.addEventListener("click", async function(){
          if (!currentParticipant) { alert("Save your details first."); openModal("detailsModal"); return; }
          var ins = await memorialClient.from("khatam_claims").insert({
            campaign_id:currentCampaign.id, participant_id:currentParticipant.id,
            juz_number:juzNumber, status:"claimed"
          });
          if (ins.error) { console.error(ins.error); alert("Could not claim this Juz."); return; }
          showToast("Juz "+juzNumber+" claimed ✓");
          await loadJuzBoard(); await loadSidebarStats();
        });
      })(i);
    } else if (isMyJuz && !isCompleted && btn) {
      (function(claimId, juzNumber){
        btn.addEventListener("click", async function(){
          if (!confirm("Mark Juz "+juzNumber+" as completed?")) return;
          var upd = await memorialClient.from("khatam_claims")
            .update({status:"completed", completed_at:new Date().toISOString()})
            .eq("id",claimId);
          if (upd.error) { console.error(upd.error); alert("Could not mark as completed."); return; }
          showToast("Juz "+juzNumber+" completed ✓");
          await loadJuzBoard(); await loadSidebarStats();
        });
      })(claim.id, i);
    }

    juzList.appendChild(card);
  }
}

// ── sidebar stats ─────────────────────────────────────────────
async function loadSidebarStats() {
  if (!currentMemorial) return;

  var rr = await memorialClient.from("participants").select("id",{count:"exact",head:true}).eq("memorial_id",currentMemorial.id);
  var readerCount = rr.count??0;

  var recR = await memorialClient.from("quick_recitations").select("recitation_count").eq("memorial_id",currentMemorial.id);
  var recTotal = 0; (recR.data||[]).forEach(function(r){ recTotal+=r.recitation_count; });

  var juzClaimed=0, juzDone=0;
  if (currentCampaign) {
    var cr = await memorialClient.from("khatam_claims").select("status").eq("campaign_id",currentCampaign.id);
    (cr.data||[]).forEach(function(c){ juzClaimed++; if(c.status==="completed") juzDone++; });
  }

  var s = function(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; };
  s("statReaders",readerCount); s("statRecitations",recTotal);
  s("statJuz",juzClaimed); s("statJuzDone",juzDone);

  await loadLeaderboard();
  await loadRecentActivity();
}

async function loadLeaderboard() {
  if (!currentMemorial) return;
  var list = document.getElementById("leaderboardList"); if (!list) return;
  var pr = await memorialClient.from("participants").select("id,name").eq("memorial_id",currentMemorial.id);
  var rr = await memorialClient.from("quick_recitations").select("participant_id,recitation_count").eq("memorial_id",currentMemorial.id);
  if (pr.error||rr.error) return;
  var totals={};
  (rr.data||[]).forEach(function(r){ totals[r.participant_id]=(totals[r.participant_id]||0)+r.recitation_count; });
  var ranked = (pr.data||[]).map(function(p){ return {name:p.name||"Anonymous",total:totals[p.id]||0}; })
    .sort(function(a,b){ return b.total-a.total; }).slice(0,5);
  if (!ranked.length||ranked.every(function(r){ return r.total===0; })) {
    list.innerHTML='<div class="leaderboard-item"><span>No recitations yet</span><strong>—</strong></div>'; return;
  }
  list.innerHTML = ranked.map(function(r,i){
    return '<div class="leaderboard-item"><span>'+(i+1)+'. '+escapeHtml(r.name)+'</span><strong>'+r.total+'</strong></div>';
  }).join("");
}

async function loadRecentActivity() {
  if (!currentMemorial) return;
  var list = document.getElementById("activityList"); if (!list) return;
  var r = await memorialClient.from("quick_recitations")
    .select("recitation_name,recitation_count,created_at").eq("memorial_id",currentMemorial.id)
    .order("created_at",{ascending:false}).limit(6);
  if (r.error||!r.data||!r.data.length) {
    list.innerHTML='<div class="activity-item"><span>No activity yet</span><strong>—</strong></div>'; return;
  }
  list.innerHTML = r.data.map(function(row){
    var t = new Date(row.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    return '<div class="activity-item"><span>'+escapeHtml(row.recitation_name)+' ('+row.recitation_count+')</span><strong>'+t+'</strong></div>';
  }).join("");
}

// ── bind ──────────────────────────────────────────────────────
function bindButtons() {
  var sb = document.getElementById("saveDetailsBtn"); if(sb) sb.addEventListener("click",saveParticipant);
  var ob = document.getElementById("openDetailsModalBtn");
  if(ob) ob.addEventListener("click",function(){ populateDetailsForm(); openModal("detailsModal"); });
  var ib = document.getElementById("showMemorialInfoBtn");
  if(ib) ib.addEventListener("click",function(){ openModal("memorialInfoModal"); });
  bindModalClose("memorialInfoModal",["closeInfoModal"]);
  bindModalClose("detailsModal",["closeDetailsModal","cancelDetailsBtn"]);
}

// ── realtime ──────────────────────────────────────────────────
function bindRealtime() {
  memorialClient.channel("live-khatam")
    .on("postgres_changes",{event:"*",schema:"public",table:"khatam_claims"},async function(){ await loadJuzBoard(); await loadSidebarStats(); })
    .on("postgres_changes",{event:"*",schema:"public",table:"quick_recitations"},async function(){ await loadSidebarStats(); })
    .on("postgres_changes",{event:"*",schema:"public",table:"participants"},async function(){ await loadSidebarStats(); })
    .subscribe();
}

// ── init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async function(){
  bindTabs(); bindButtons(); updateDetailsBadge();
  await loadMemorial(); bindRealtime();
});
