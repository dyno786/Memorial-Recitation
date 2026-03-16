const supabase = window.supabase.createClient(
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
  const { data, error } = await supabase
    .from("memorials")
    .select("*")
    .eq("slug", window.APP_CONFIG.memorialSlug)
    .single();

  if (error) {
    console.error("loadMemorial error:", error);
    alert("Could not load memorial data.");
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

  const { data: campaigns, error: campaignError } = await supabase
    .from("khatam_campaigns")
    .select("*")
    .eq("memorial_id", data.id)
    .order("created_at", { ascending: true });

  if (campaignError) {
    console.error("campaign load error:", campaignError);
  }

  if (campaigns && campaigns.length) {
    currentCampaign = campaigns[0];
    renderCampaignInfo(campaigns);
  }

  await loadJuzBoard();
}

function renderCampaignInfo(campaigns) {
  const campaignGrid = document.querySelector(".campaign-grid");
  if (campaignGrid) {
    campaignGrid.innerHTML = campaigns
      .map((campaign, index) => {
        return `
          <div class="campaign-card ${index === 0 ? "active" : ""}">
            <div class="campaign-title">${campaign.title}</div>
            <div class="campaign-deadline">Deadline: ${formatDateTime(campaign.deadline)}</div>
            <div class="progress-header">
              <span>${campaign.campaign_type || "campaign"}</span>
              <span>Active</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar__fill" style="width:0%"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  const pillRow = document.querySelector(".pill-row");
  if (pillRow && currentCampaign) {
    pillRow.innerHTML = `
      <div class="pill">Campaign: ${currentCampaign.title}</div>
      <div class="pill">Deadline: ${formatDateTime(currentCampaign.deadline)}</div>
    `;
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString();
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
    console.error("saveParticipant error:", error);
    alert("Could not save participant details.");
    return;
  }

  currentParticipant = data;
  alert("Your details have been saved.");
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
    alert("Please add some recitations first.");
    return;
  }

  const { error } = await supabase.from("quick_recitations").insert(rows);

  if (error) {
    console.error("submitQuickRecitations error:", error);
    alert("Could not submit quick recitations.");
    return;
  }

  alert("Quick recitations submitted.");
}

async function loadJuzBoard() {
  if (!currentCampaign) return;

  const { data, error } = await supabase
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
      <button class="juz-btn ${
        isClaimed ? "claimed" : "available"
      }">${
        isCompleted ? "Completed" : isClaimed ? "Claimed" : "Claim"
      }</button>
    `;

    const btn = card.querySelector("button");

    if (!isClaimed) {
      btn.addEventListener("click", async () => {
        if (!currentParticipant) {
          alert("Please save your details first.");
          return;
        }

        const { error: insertError } = await supabase
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
  const saveButtons = Array.from(document.querySelectorAll(".btn.btn-secondary"));
  const saveDetailsBtn = saveButtons.find((btn) =>
    btn.textContent.toLowerCase().includes("save")
  );
  if (saveDetailsBtn) {
    saveDetailsBtn.addEventListener("click", saveParticipant);
  }

  const submitBtn = document.querySelector(".btn.btn-primary.btn-block");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitQuickRecitations);
  }
}

function bindRealtime() {
  supabase
    .channel("memorial-live")
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
