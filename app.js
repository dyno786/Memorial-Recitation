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

// ── helpers ───────────────────────────────────────────────────
function getSlugFromUrl() { return new URLSearchParams(window.location.search).get("slug"); }

function escapeHtml(v) {
  return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function updateLinksForSlug() {
  var t = document.getElementById("totalsLink"); if (!t) return;
  if (memorialSlug) { t.href="totals.html?slug="+encodeURIComponent(memorialSlug); t.style.display=""; }
  else { t.href="totals.html"; t.style.display="none"; }
}

function showChooser() {
  var c=document.getElementById("chooserWrap"); if(c) c.style.display="block";
  var a=document.getElementById("memorialApp"); if(a) a.style.display="none";
}
function showMemorialApp() {
  var c=document.getElementById("chooserWrap"); if(c) c.style.display="none";
  var a=document.getElementById("memorialApp"); if(a) a.style.display="block";
}

// ── localStorage ──────────────────────────────────────────────
function loadSavedDetails() {
  try { var r=localStorage.getItem(LS_KEY); return r?JSON.parse(r):null; } catch(e){return null;}
}
function saveDetailsLocally(name,ukCity,pakCity,relation) {
  try { localStorage.setItem(LS_KEY,JSON.stringify({name,ukCity,pakCity,relation})); } catch(e){}
}

function populateInlineForm() {
  var s=loadSavedDetails(); if(!s) return;
  var f=function(id,v){var el=document.getElementById(id);if(el)el.value=v||"";};
  f("readerName",s.name); f("ukCity",s.ukCity); f("pakCity",s.pakCity); f("relation",s.relation);
}

function populateModalForm() {
  var s=loadSavedDetails(); if(!s) return;
  var f=function(id,v){var el=document.getElementById(id);if(el)el.value=v||"";};
  f("readerNameModal",s.name); f("ukCityModal",s.ukCity); f("pakCityModal",s.pakCity); f("relationModal",s.relation);
}

function updateDetailsBadge() {
  var s=loadSavedDetails();
  var badge=document.getElementById("detailsSavedBadge");
  var span=document.getElementById("savedNameDisplay");
  var sub=document.getElementById("detailsCardSub");
  if (!badge) return;
  if (s&&(s.name||s.relation==="Anonymous")) {
    badge.style.display="block";
    var displayName=s.relation==="Anonymous"?"Anonymous":s.name;
    if(span) span.textContent=displayName;
    if(sub) sub.textContent="Saved as "+displayName+" — tap to update";
  } else {
    badge.style.display="none";
    if(sub) sub.textContent="Tap to enter your name & details";
  }
}

// ── toast ─────────────────────────────────────────────────────
var toastTimer=null;
function showToast(msg) {
  var t=document.getElementById("recToast"); if(!t) return;
  t.textContent=msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.remove("show");},1800);
}

// ── modal ─────────────────────────────────────────────────────
function openModal(id){var el=document.getElementById(id);if(el)el.classList.add("open");}
function closeModal(id){var el=document.getElementById(id);if(el)el.classList.remove("open");}

// ── tabs ──────────────────────────────────────────────────────
function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach(function(btn){
    btn.addEventListener("click",function(){
      document.querySelectorAll(".tab-btn").forEach(function(b){b.classList.remove("active");});
      document.querySelectorAll(".tab-content").forEach(function(p){p.classList.remove("active");});
      btn.classList.add("active");
      var t=document.getElementById(btn.dataset.tab); if(t) t.classList.add("active");
    });
  });
}

// ── instant submit on + ───────────────────────────────────────
async function count(id, label, val) {
  var el=document.getElementById(id); if(!el) return;
  var num=parseInt(el.innerText||"0",10)+val;
  if(num<0) num=0;
  el.innerText=String(num);

  if (val>0) {
    if (!currentParticipant) {
      el.innerText=String(num-1);
      // open details card and prompt
      var card=document.getElementById("detailsCard");
      if(card&&!card.classList.contains("open")) card.classList.add("open");
      showToast("Please save your details first");
      return;
    }
    if (!currentMemorial) return;
    var r=await memorialClient.from("quick_recitations").insert({
      memorial_id:currentMemorial.id, participant_id:currentParticipant.id,
      recitation_name:label, recitation_count:1
    });
    if (r.error) {
      console.error(r.error); el.innerText=String(num-1);
      showToast("Could not save — try again"); return;
    }
    showToast(label+" recorded ✓");
    await loadSidebarStats();
  }
}

// ── save participant (inline form) ────────────────────────────
async function saveParticipant(nameVal, ukCityVal, pakCityVal, relationVal) {
  if (!currentMemorial) { showToast("Memorial not loaded yet"); return; }
  var name=(nameVal||"").trim();
  var ukCity=(ukCityVal||"").trim();
  var pakCity=(pakCityVal||"").trim();
  var relation=(relationVal||"").trim();
  if (!name&&relation!=="Anonymous") { showToast("Please enter your name or choose Anonymous"); return; }
  var finalName=relation==="Anonymous"?"Anonymous":name;
  saveDetailsLocally(name,ukCity,pakCity,relation);
  updateDetailsBadge();

  // Check existing
  var ex=await memorialClient.from("participants").select("*")
    .eq("memorial_id",currentMemorial.id).eq("name",finalName).limit(1);
  if (!ex.error&&ex.data&&ex.data.length) {
    currentParticipant=ex.data[0];
    showToast("Welcome back, "+finalName+" ✓");
    // collapse the details card
    var card=document.getElementById("detailsCard");
    if(card) card.classList.remove("open");
    return;
  }

  var r=await memorialClient.from("participants").insert({
    memorial_id:currentMemorial.id, name:finalName,
    uk_city:ukCity||null, pak_city:pakCity||null, relation:relation||null
  }).select().single();
  if (r.error) { console.error(r.error); showToast("Could not save — try again"); return; }
  currentParticipant=r.data;
  showToast("Details saved ✓");
  var card=document.getElementById("detailsCard"); if(card) card.classList.remove("open");
  await loadSidebarStats();
}

// ── load memorial ─────────────────────────────────────────────
async function getMemorialWithRetry() {
  for (var i=1;i<=3;i++) {
    var r=await memorialClient.from("memorials").select("*").eq("slug",memorialSlug).maybeSingle();
    if(!r.error&&r.data) return r.data;
    await new Promise(function(res){setTimeout(res,400*i);});
  }
  return null;
}

function renderCampaignPills(campaign) {
  var row=document.querySelector(".stats-toolbar .pill-row"); if(!row||!campaign) return;
  var dt=campaign.deadline?new Date(campaign.deadline).toLocaleString():"No deadline set";
  row.innerHTML='<div class="pill">Campaign: '+escapeHtml(campaign.title||"Untitled")+'</div>'+
    '<div class="pill">Deadline: '+escapeHtml(dt)+'</div>';
}

async function loadMemorial() {
  memorialSlug=getSlugFromUrl(); updateLinksForSlug();
  if (!memorialSlug) { showChooser(); await loadMemorialChooser(); return; }
  showMemorialApp();

  var memorial=await getMemorialWithRetry();
  if (!memorial) { alert("Could not load memorial."); showChooser(); await loadMemorialChooser(); return; }
  currentMemorial=memorial;

  // Deceased card header
  var nameEls=document.querySelectorAll(".memorial-name");
  nameEls.forEach(function(el){el.textContent=currentMemorial.full_name||"Memorial";});

  // Deceased card body
  var meta=document.getElementById("deceasedMeta");
  if(meta) meta.innerHTML=
    "<strong>Age:</strong> "+(currentMemorial.age??"-")+"<br>"+
    "<strong>Passed away:</strong> "+(currentMemorial.date_of_passing??"-")+"<br>"+
    "<strong>Mosque:</strong> "+(currentMemorial.mosque_name??"-")+
    (currentMemorial.uk_city?"<br><strong>UK City:</strong> "+currentMemorial.uk_city:"")+
    (currentMemorial.pak_city?"<br><strong>Pakistani City:</strong> "+currentMemorial.pak_city:"");

  var tribute=document.getElementById("deceasedTribute");
  if(tribute&&currentMemorial.tribute) tribute.textContent=currentMemorial.tribute;

  // WhatsApp
  var wa=document.getElementById("whatsappShareBtn");
  if(wa){
    var shareUrl=window.location.origin+window.location.pathname+"?slug="+encodeURIComponent(memorialSlug);
    var msg="Please recite and make dua for "+(currentMemorial.full_name||"the deceased")+". Join the collective Quran Khatam: "+shareUrl;
    wa.href="https://wa.me/?text="+encodeURIComponent(msg);
  }

  // Pre-fill inline form
  populateInlineForm();
  await restoreParticipant();

  var cr=await memorialClient.from("khatam_campaigns").select("*")
    .eq("memorial_id",currentMemorial.id).order("created_at",{ascending:true});
  if(!cr.error&&cr.data&&cr.data.length){currentCampaign=cr.data[0];renderCampaignPills(currentCampaign);}

  await loadJuzBoard();
  await loadSidebarStats();
}

async function restoreParticipant() {
  var s=loadSavedDetails(); updateDetailsBadge();
  if(!s||!currentMemorial) return;
  var name=s.relation==="Anonymous"?"Anonymous":(s.name||"");
  if(!name) return;
  var r=await memorialClient.from("participants").select("*")
    .eq("memorial_id",currentMemorial.id).eq("name",name).limit(1);
  if(!r.error&&r.data&&r.data.length) currentParticipant=r.data[0];
}

async function loadMemorialChooser() {
  var dd=document.getElementById("memorialDropdown");
  var btn=document.getElementById("openMemorialBtn");
  if(!dd||!btn) return;
  dd.innerHTML='<option value="">Loading memorials...</option>'; btn.disabled=true;
  var r=await memorialClient.from("memorials").select("*").order("full_name",{ascending:true});
  if(r.error){dd.innerHTML='<option value="">Could not load memorials</option>';return;}
  allMemorials=r.data||[];
  if(!allMemorials.length){dd.innerHTML='<option value="">No memorials created yet</option>';return;}
  dd.innerHTML='<option value="">Select a memorial</option>'+
    allMemorials.map(function(m){
      var label=m.full_name||m.slug||"Memorial";
      if(m.mosque_name) label+=" — "+m.mosque_name;
      return '<option value="'+escapeHtml(m.slug)+'">'+escapeHtml(label)+'</option>';
    }).join("");
  btn.disabled=false;
  dd.addEventListener("change",function(){btn.disabled=!dd.value;});
  btn.addEventListener("click",function(){
    if(!dd.value){alert("Please choose a memorial first.");return;}
    window.location.href="index.html?slug="+encodeURIComponent(dd.value);
  });
}

// ── Juz board ─────────────────────────────────────────────────
async function loadJuzBoard() {
  var juzList=document.getElementById("juzList"); if(!juzList) return;
  if(!currentCampaign){
    juzList.innerHTML='<div class="muted-text">No khatam campaign found for this memorial yet.</div>'; return;
  }
  var r=await memorialClient.from("khatam_claims")
    .select("*, participants(name)").eq("campaign_id",currentCampaign.id)
    .order("juz_number",{ascending:true});
  if(r.error){juzList.innerHTML='<div class="muted-text">Could not load Juz board.</div>';return;}

  var data=r.data||[]; juzList.innerHTML="";
  for(var i=1;i<=30;i++){
    var claim=data.find(function(x){return x.juz_number===i;});
    var isClaimed=!!claim, isCompleted=claim&&claim.status==="completed";
    var isMyJuz=claim&&currentParticipant&&claim.participant_id===currentParticipant.id;
    var claimerName=claim&&claim.participants?claim.participants.name:null;
    var statusText=isCompleted?"Completed ✓":isClaimed?(claimerName?"Claimed by "+claimerName:"Already reserved"):"Available";
    var btnClass=isCompleted?"completed":isClaimed?"claimed":"available";
    var btnText=isCompleted?"Completed":(isMyJuz&&!isCompleted)?"Mark done":isClaimed?"Claimed":"Claim";

    var card=document.createElement("div");
    card.className="juz-card"+(isMyJuz?" my-juz":"");
    card.innerHTML='<div class="juz-meta"><strong>Juz '+i+'</strong><span>'+statusText+'</span></div>'+
      '<button type="button" class="juz-btn '+btnClass+'">'+btnText+'</button>';

    var btn=card.querySelector("button");
    if(!isClaimed&&btn){
      (function(juzNumber){
        btn.addEventListener("click",async function(){
          if(!currentParticipant){
            var card=document.getElementById("detailsCard");
            if(card&&!card.classList.contains("open")) card.classList.add("open");
            showToast("Save your details first"); return;
          }
          var ins=await memorialClient.from("khatam_claims").insert({
            campaign_id:currentCampaign.id,participant_id:currentParticipant.id,
            juz_number:juzNumber,status:"claimed"
          });
          if(ins.error){console.error(ins.error);alert("Could not claim this Juz.");return;}
          showToast("Juz "+juzNumber+" claimed ✓");
          await loadJuzBoard(); await loadSidebarStats();
        });
      })(i);
    } else if(isMyJuz&&!isCompleted&&btn){
      (function(claimId,juzNumber){
        btn.addEventListener("click",async function(){
          if(!confirm("Mark Juz "+juzNumber+" as completed?")) return;
          var upd=await memorialClient.from("khatam_claims")
            .update({status:"completed",completed_at:new Date().toISOString()}).eq("id",claimId);
          if(upd.error){console.error(upd.error);alert("Could not mark as completed.");return;}
          showToast("Juz "+juzNumber+" completed ✓");
          await loadJuzBoard(); await loadSidebarStats();
        });
      })(claim.id,i);
    }
    juzList.appendChild(card);
  }
}

// ── sidebar stats ─────────────────────────────────────────────
async function loadSidebarStats() {
  if(!currentMemorial) return;
  var rr=await memorialClient.from("participants").select("id",{count:"exact",head:true}).eq("memorial_id",currentMemorial.id);
  var readerCount=rr.count??0;
  var recR=await memorialClient.from("quick_recitations").select("recitation_count").eq("memorial_id",currentMemorial.id);
  var recTotal=0; (recR.data||[]).forEach(function(r){recTotal+=r.recitation_count;});
  var juzClaimed=0,juzDone=0;
  if(currentCampaign){
    var cr=await memorialClient.from("khatam_claims").select("status").eq("campaign_id",currentCampaign.id);
    (cr.data||[]).forEach(function(c){juzClaimed++;if(c.status==="completed")juzDone++;});
  }
  var s=function(id,v){var el=document.getElementById(id);if(el)el.textContent=v;};
  s("statReaders",readerCount); s("statRecitations",recTotal);
  s("statJuz",juzClaimed); s("statJuzDone",juzDone);
  await loadLeaderboard(); await loadRecentActivity();
}

async function loadLeaderboard() {
  if(!currentMemorial) return;
  var list=document.getElementById("leaderboardList"); if(!list) return;
  var pr=await memorialClient.from("participants").select("id,name").eq("memorial_id",currentMemorial.id);
  var rr=await memorialClient.from("quick_recitations").select("participant_id,recitation_count").eq("memorial_id",currentMemorial.id);
  if(pr.error||rr.error) return;
  var totals={};
  (rr.data||[]).forEach(function(r){totals[r.participant_id]=(totals[r.participant_id]||0)+r.recitation_count;});
  var ranked=(pr.data||[]).map(function(p){return{name:p.name||"Anonymous",total:totals[p.id]||0};})
    .sort(function(a,b){return b.total-a.total;}).slice(0,5);
  if(!ranked.length||ranked.every(function(r){return r.total===0;})){
    list.innerHTML='<div class="leaderboard-item"><span>No recitations yet</span><strong>—</strong></div>';return;
  }
  list.innerHTML=ranked.map(function(r,i){
    return '<div class="leaderboard-item"><span>'+(i+1)+'. '+escapeHtml(r.name)+'</span><strong>'+r.total+'</strong></div>';
  }).join("");
}

async function loadRecentActivity() {
  if(!currentMemorial) return;
  var list=document.getElementById("activityList"); if(!list) return;
  var r=await memorialClient.from("quick_recitations")
    .select("recitation_name,recitation_count,created_at").eq("memorial_id",currentMemorial.id)
    .order("created_at",{ascending:false}).limit(6);
  if(r.error||!r.data||!r.data.length){
    list.innerHTML='<div class="activity-item"><span>No activity yet</span><strong>—</strong></div>';return;
  }
  list.innerHTML=r.data.map(function(row){
    var t=new Date(row.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
    return '<div class="activity-item"><span>'+escapeHtml(row.recitation_name)+' ('+row.recitation_count+')</span><strong>'+t+'</strong></div>';
  }).join("");
}

// ── bind ──────────────────────────────────────────────────────
function bindButtons() {
  // Inline save button (inside collapsed details card)
  var sb=document.getElementById("saveDetailsBtn");
  if(sb) sb.addEventListener("click",function(){
    saveParticipant(
      (document.getElementById("readerName")||{}).value,
      (document.getElementById("ukCity")||{}).value,
      (document.getElementById("pakCity")||{}).value,
      (document.getElementById("relation")||{}).value
    );
  });

  // Modal save (fallback when opened by prompt)
  var smb=document.getElementById("saveDetailsModalBtn");
  if(smb) smb.addEventListener("click",function(){
    // sync modal values back to inline fields then save
    var f=function(from,to){
      var src=document.getElementById(from); var dst=document.getElementById(to);
      if(src&&dst){dst.value=src.value;}
    };
    f("readerNameModal","readerName"); f("ukCityModal","ukCity");
    f("pakCityModal","pakCity"); f("relationModal","relation");
    saveParticipant(
      (document.getElementById("readerNameModal")||{}).value,
      (document.getElementById("ukCityModal")||{}).value,
      (document.getElementById("pakCityModal")||{}).value,
      (document.getElementById("relationModal")||{}).value
    );
    closeModal("detailsModal");
  });

  var cm=document.getElementById("cancelDetailsModal");
  if(cm) cm.addEventListener("click",function(){closeModal("detailsModal");});
  var cm2=document.getElementById("closeDetailsModal");
  if(cm2) cm2.addEventListener("click",function(){closeModal("detailsModal");});
  var overlay=document.getElementById("detailsModal");
  if(overlay) overlay.addEventListener("click",function(e){if(e.target===overlay)closeModal("detailsModal");});
}

function bindRealtime() {
  memorialClient.channel("live-khatam")
    .on("postgres_changes",{event:"*",schema:"public",table:"khatam_claims"},async function(){await loadJuzBoard();await loadSidebarStats();})
    .on("postgres_changes",{event:"*",schema:"public",table:"quick_recitations"},async function(){await loadSidebarStats();})
    .on("postgres_changes",{event:"*",schema:"public",table:"participants"},async function(){await loadSidebarStats();})
    .subscribe();
}

document.addEventListener("DOMContentLoaded",async function(){
  bindTabs(); bindButtons(); updateDetailsBadge();
  await loadMemorial(); bindRealtime();
});

// ── Collective Fatiha ─────────────────────────────────────────
function bindFatiha() {
  var btn = document.getElementById("collectiveFatihaBtn");
  var submitBtn = document.getElementById("submitFatihaBtn");
  var closeBtn = document.getElementById("closeFatihaModal");
  var overlay = document.getElementById("fatihaModal");

  if (btn) btn.addEventListener("click", function() {
    // Pre-fill name from saved details
    var saved = loadSavedDetails();
    var nameInput = document.getElementById("fatihaName");
    if (nameInput && saved && saved.name) nameInput.value = saved.name;
    openModal("fatihaModal");
  });

  if (submitBtn) submitBtn.addEventListener("click", async function() {
    var nameInput = document.getElementById("fatihaName");
    var name = (nameInput ? nameInput.value : "").trim();
    if (!name) { showToast("Please enter your name"); return; }
    if (!currentMemorial) { showToast("Memorial not loaded"); return; }

    var r = await memorialClient.from("fatiha_requests").insert({
      memorial_id: currentMemorial.id,
      participant_name: name
    });

    if (r.error) { console.error(r.error); showToast("Could not send — try again"); return; }

    closeModal("fatihaModal");
    showToast("Fatiha request sent to live screen 🤲");
  });

  if (closeBtn) closeBtn.addEventListener("click", function() { closeModal("fatihaModal"); });
  if (overlay) overlay.addEventListener("click", function(e) { if (e.target===overlay) closeModal("fatihaModal"); });
}

// Re-run DOMContentLoaded additions
document.addEventListener("DOMContentLoaded", function() {
  bindFatiha();
});

// Auto-refresh fallback every 30 seconds
setInterval(async function() {
  if (currentMemorial) {
    await loadSidebarStats();
    await loadJuzBoard();
  }
}, 30000);
