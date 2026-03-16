const client = window.supabase.createClient(
  window.APP_CONFIG.supabaseUrl,
  window.APP_CONFIG.supabasePublishableKey
);

let currentMemorial = null;
let currentCampaign = null;
let currentParticipant = null;

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
    active
      .map(([label, value]) => {
        total += value;
        return `<div class="summary-row"><span>${label}</span><strong>${value}</strong></div>`;
      })
      .join("") +
    `<div class="summary-row"><span>Total</span><strong>${total}</strong></div>`;
}

async function loadMemorial() {
  const { data, error } = await client
    .from("memorials")
    .select("*")
    .eq("slug", window.APP_CONFIG.memorialSlug)
    .single();

  if (error) {
    console.error("loadMemorial error:", error);
    alert("Could not load memorial.");
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

  const { data: campaigns, error: campaignError } = await client
    .from("khatam_campaigns")
    .select("*")
    .eq("memorial_id", data.id)
    .order("created_at", { ascending: true });

  if (campaignError) {
    console.error("campaign load error:", campaignError);
  }

  if (campaigns && campaigns.length) {
    currentCampaign = campaigns[0];
    renderCampaignPills(campaigns[0]);
  }

  await loadJuzBoard();
}

function renderCampaignPills(campaign) {
  const pillRow = document.querySelector(".pill-row");
  if (!pillRow || !campaign) return;

  const deadlineText = campaign.deadline
    ? new Date(campaign.deadline).toLocaleString()
    : "No deadline set";

  pillRow.innerHTML = `
    <div class="pill">Campaign: ${campaign.title}</div>
    <div class="pill">Deadline: ${deadlineText}</div>
  `;
}

async function saveParticipant() {
  if (!currentMemorial) {
    alert("Memorial not loaded yet.");
    return;
  }

  const name = document.getElementById("readerName")?.value?.trim() || "";
  const ukCity = document.getElementById("ukCity")?.value?.trim() || "";
  const pakCity = document.getElementById("pakCity")?.value?.trim() || "";
  const relation = document.getElementById("relation")?.value || "";

  if (!name && relation !== "Anonymous") {
    alert("Please enter your name or choose Anonymous.");
    return;
  }

  const { data, error } = await client
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
    console.error("saveParticipant error:", error);
    alert("Could not save participant.");
    return;
  }

  currentParticipant = data;
  alert("Saved.");
}

async function submitQuickRecitations() {
  if (!currentMemorial) {
    alert("Memorial not loaded yet.");
    return;
  }

  if (!currentParticipant) {
    alert("Please save your details first.");
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

  const rows = items
    .map(([label, id]) => {
      const el = document.getElementById(id);
      return {
        memorial_id: currentMemorial.id,
        participant_id: currentParticipant.id,
        recitation_name: label,
        recitation_count: parseInt(el?.innerText || "0", 10)
      };
    })
    .filter((row) => row.recitation_count > 0);

  if (!rows.length) {
    alert("Add recitations first.");
    return;
  }

  const { error } = await client.from("quick_recitations").insert(rows);

  if (error) {
    console.error("submitQuickRecitations error:", error);
    alert("Could not submit recitations.");
    return;
  }

  alert("Submitted.");

  const ids = ["bismillah", "alhamdulillah", "subhanallah", "astaghfirullah", "durood", "fatiha", "ikhlas", "yasin"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerText = "0";
  });
  updateSummary();
}

async function loadJuzBoard() {
  if (!currentCampaign) return;

  const { data, error } = await client
    .from("khatam_claims")
    .select("*")
    .eq("campaign_id", currentCampaign.id)
    .order("juz_number", { ascending: true });

  if (error) {
    console.error("loadJuzBoard error:", error);
    return;
  }

  const juzList = document.getElementById("juzList");
  if (!juzList) return;

  juzList.innerHTML = "";

  for (let i = 1; i <= 30; i++) {
    const claim = data.find((x) => x.juz_number === i);
    const isClaimed = !!claim;
    const isCompleted = claim?.status === "completed";

    const card = document.createElement("div");
    card.className = "juz-card";

    card.innerHTML = `
      <div class="juz-meta">
        <strong>Juz ${i}</strong>
        <span>${
          isCompleted
            ? "Completed"
            : isClaimed
            ? "Already reserved by a reader"
            : "Available to claim"
        }</span>
      </div>
      <button type="button" class="juz-btn ${
        isClaimed ? "claimed" : "available"
      }">${
        isCompleted ? "Completed" : isClaimed ? "Claimed" : "Claim"
      }</button>
    `;

    const btn = card.querySelector("button");

    if (!isClaimed) {
      btn.addEventListener("click", async () => {
        if (!currentParticipant) {
          alert("Save details first.");
          return;
        }

        const { error: insertError } = await client
          .from("khatam_claims")
          .insert({
            campaign_id: currentCampaign.id,
            participant_id: currentParticipant.id,
            juz_number: i,
            status: "claimed"
          });

        if (insertError) {
          console.error("claim error:", insertError);
          alert("Could not claim this Juz.");
          return;
        }

        await loadJuzBoard();
      });
    }

    juzList.appendChild(card);
  }
}

function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab)?.classList.add("active");
    });
  });
}

function bindButtons() {
  const saveBtn = document.getElementById("saveDetailsBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveParticipant);
  }

  const submitBtn = document.getElementById("submitQuickBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitQuickRecitations);
  }
}

function bindRealtime() {
  client
    .channel("live-khatam")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "khatam_claims" },
      async () => {
        await loadJuzBoard();
      }
    )
    .subscribe();
}

document.addEventListener("DOMContentLoaded", async () => {
  bindTabs();
  bindButtons();
  updateSummary();
  await loadMemorial();
  bindRealtime();
});
