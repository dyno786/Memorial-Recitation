/* ===============================
   SUPABASE SETUP
================================= */

const supabase = window.supabase.createClient(
  window.APP_CONFIG.supabaseUrl,
  window.APP_CONFIG.supabasePublishableKey
);

let currentMemorial = null;
let currentCampaign = null;
let currentParticipant = null;


/* ===============================
   COUNTER SYSTEM
================================= */

function count(id, val) {
  const el = document.getElementById(id);
  if (!el) return;

  let num = parseInt(el.innerText || "0", 10);
  num += val;
  if (num < 0) num = 0;

  el.innerText = num;
  updateSummary();
}

function updateSummary() {
  const items = [
    ["Bismillah", "bismillah"],
    ["Alhamdulillah", "alhamdulillah"],
    ["Subhanallah", "subhanallah"],
    ["Astaghfirullah", "astaghfirullah"],
    ["Durood Sharif", "durood"],
    ["Surah Fatiha", "fatiha"],
    ["Surah Ikhlas", "ikhlas"],
    ["Surah Yasin", "yasin"]
  ];

  const summary = document.getElementById("quickSummary");
  if (!summary) return;

  const active = items
    .map(([label, id]) => {
      const el = document.getElementById(id);
      return [label, parseInt(el?.innerText || "0", 10)];
    })
    .filter(([, value]) => value > 0);

  if (!active.length) {
    summary.innerHTML =
      `<div class="summary-row"><span>No recitations added yet</span><strong>0</strong></div>`;
    return;
  }

  let total = 0;
  summary.innerHTML =
    active.map(([label, value]) => {
      total += value;
      return `<div class="summary-row"><span>${label}</span><strong>${value}</strong></div>`;
    }).join("") +
    `<div class="summary-row"><span>Total</span><strong>${total}</strong></div>`;
}


/* ===============================
   LOAD MEMORIAL DATA
================================= */

async function loadMemorial() {

  const { data, error } = await supabase
    .from("memorials")
    .select("*")
    .eq("slug", window.APP_CONFIG.memorialSlug)
    .single();

  if (error) {
    alert("Memorial not found.");
    console.error(error);
    return;
  }

  currentMemorial = data;

  const nameEl = document.querySelector(".memorial-name");
  if (nameEl) nameEl.textContent = data.full_name || "Memorial";

  const metaEl = document.querySelector(".meta");
  if (metaEl) {
    metaEl.innerHTML = `
      Age: ${data.age ?? "-"}<br>
      Passed away: ${data.date_of_passing ?? "-"}<br>
      Mosque: ${data.mosque_name ?? "-"}
    `;
  }

  const { data: campaigns } = await supabase
    .from("khatam_campaigns")
    .select("*")
    .eq("memorial_id", data.id)
    .order("created_at", { ascending: true });

  if (campaigns && campaigns.length) {
    currentCampaign = campaigns[0];
  }

  await loadJuzBoard();
}


/* ===============================
   PARTICIPANT SAVE
================================= */

async function saveParticipant() {

  const name = document.getElementById("readerName")?.value || "";
  const ukCity = document.getElementById("ukCity")?.value || "";
  const pakCity = document.getElementById("pakCity")?.value || "";
  const relation = document.getElementById("relation")?.value || "";

  if (!name && relation !== "Anonymous") {
    alert("Enter name or choose anonymous.");
    return;
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      memorial_id: currentMemorial.id,
      name: relation === "Anonymous" ? "Anonymous" : name,
      uk_city: ukCity,
      pak_city: pakCity,
      relation: relation || null
    })
    .select()
    .single();

  if (error) {
    alert("Could not save.");
    console.error(error);
    return;
  }

  currentParticipant = data;
  alert("Saved.");
}


/* ===============================
   SUBMIT RECITATIONS
================================= */

async function submitQuickRecitations() {

  if (!currentParticipant) {
    alert("Save your details first.");
    return;
  }

  const items = [
    ["Bismillah", "bismillah"],
    ["Alhamdulillah", "alhamdulillah"],
    ["Subhanallah", "subhanallah"],
    ["Astaghfirullah", "astaghfirullah"],
    ["Durood Sharif", "durood"],
    ["Surah Fatiha", "fatiha"],
    ["Surah Ikhlas", "ikhlas"],
    ["Surah Yasin", "yasin"]
  ];

  const rows = items.map(([label, id]) => {
    const el = document.getElementById(id);
    return {
      memorial_id: currentMemorial.id,
      participant_id: currentParticipant.id,
      recitation_name: label,
      recitation_count: parseInt(el?.innerText || "0", 10)
    };
  }).filter(x => x.recitation_count > 0);

  if (!rows.length) {
    alert("Add recitations first.");
    return;
  }

  const { error } = await supabase.from("quick_recitations").insert(rows);

  if (error) {
    alert("Error saving recitations.");
    console.error(error);
    return;
  }

  alert("Submitted.");
}


/* ===============================
   JUZ BOARD (LIVE)
================================= */

async function loadJuzBoard() {

  if (!currentCampaign) return;

  const { data } = await supabase
    .from("khatam_claims")
    .select("*")
    .eq("campaign_id", currentCampaign.id);

  const juzList = document.getElementById("juzList");
  if (!juzList) return;

  juzList.innerHTML = "";

  for (let i = 1; i <= 30; i++) {

    const claim = data.find(x => x.juz_number === i);
    const claimed = !!claim;

    const card = document.createElement("div");
    card.className = "juz-card";

    card.innerHTML = `
      <div class="juz-meta">
        <strong>Juz ${i}</strong>
        <span>${claimed ? "Reserved" : "Available"}</span>
      </div>
      <button class="juz-btn ${claimed ? "claimed" : "available"}">
        ${claimed ? "Claimed" : "Claim"}
      </button>
    `;

    if (!claimed) {
      card.querySelector("button").addEventListener("click", async () => {

        if (!currentParticipant) {
          alert("Save details first.");
          return;
        }

        await supabase.from("khatam_claims").insert({
          campaign_id: currentCampaign.id,
          participant_id: currentParticipant.id,
          juz_number: i,
          status: "claimed"
        });

        await loadJuzBoard();
      });
    }

    juzList.appendChild(card);
  }
}


/* ===============================
   UI BINDINGS
================================= */

function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(btn.dataset.tab)?.classList.add("active");
    });
  });
}

function bindButtons() {

  const saveBtn = document.querySelector(".btn.btn-secondary");
  if (saveBtn) saveBtn.onclick = saveParticipant;

  const submitBtn = document.querySelector(".btn.btn-primary.btn-block");
  if (submitBtn) submitBtn.onclick = submitQuickRecitations;
}


/* ===============================
   LIVE REALTIME
================================= */

function bindRealtime() {
  supabase
    .channel("live")
    .on("postgres_changes",
      { event: "*", schema: "public", table: "khatam_claims" },
      loadJuzBoard
    )
    .subscribe();
}


/* ===============================
   INIT
================================= */

document.addEventListener("DOMContentLoaded", async () => {

  bindTabs();
  bindButtons();
  updateSummary();

  await loadMemorial();
  bindRealtime();

});
