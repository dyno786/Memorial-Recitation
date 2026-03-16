var memorialClient = window.supabase.createClient(
  window.APP_CONFIG.supabaseUrl,
  window.APP_CONFIG.supabasePublishableKey
);

var currentMemorial = null;
var currentCampaign = null;
var currentParticipant = null;

function count(id, val) {
  var el = document.getElementById(id);
  if (!el) return;

  var num = parseInt(el.innerText || "0", 10);
  num += val;
  if (num < 0) num = 0;

  el.innerText = String(num);
  updateSummary();
}

function updateSummary() {
  var items = [
    ["Bismillah", "bismillah"],
    ["Alhamdulillah", "alhamdulillah"],
    ["Subhanallah", "subhanallah"],
    ["Astaghfirullah", "astaghfirullah"],
    ["Durood Sharif", "durood"],
    ["Surah Fatiha", "fatiha"],
    ["Surah Ikhlas", "ikhlas"],
    ["Surah Yasin", "yasin"]
  ];

  var summary = document.getElementById("quickSummary");
  if (!summary) return;

  var active = items
    .map(function (item) {
      var label = item[0];
      var id = item[1];
      var el = document.getElementById(id);
      return [label, parseInt((el && el.innerText) || "0", 10)];
    })
    .filter(function (row) {
      return row[1] > 0;
    });

  if (!active.length) {
    summary.innerHTML =
      '<div class="summary-row"><span>No recitations added yet</span><strong>0</strong></div>';
    return;
  }

  var total = 0;
  summary.innerHTML =
    active.map(function (row) {
      total += row[1];
      return '<div class="summary-row"><span>' + row[0] + '</span><strong>' + row[1] + "</strong></div>";
    }).join("") +
    '<div class="summary-row"><span>Total</span><strong>' + total + "</strong></div>";
}

function bindTabs() {
  var buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      document.querySelectorAll(".tab-content").forEach(function (p) {
        p.classList.remove("active");
      });

      btn.classList.add("active");
      var target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });
}

async function loadMemorial() {
  var result = await memorialClient
    .from("memorials")
    .select("*")
    .eq("slug", window.APP_CONFIG.memorialSlug)
    .single();

  if (result.error) {
    console.error("loadMemorial error:", result.error);
    alert("Could not load memorial.");
    return;
  }

  currentMemorial = result.data;

  var nameEl = document.querySelector(".memorial-name");
  if (nameEl) {
    nameEl.textContent = currentMemorial.full_name || "Memorial";
  }

  var metaEl = document.querySelector(".meta");
  if (metaEl) {
    metaEl.innerHTML =
      "Age: " + (currentMemorial.age ?? "-") + "<br>" +
      "Passed away: " + (currentMemorial.date_of_passing ?? "-") + "<br>" +
      "Mosque: " + (currentMemorial.mosque_name ?? "-");
  }

  var campaignResult = await memorialClient
    .from("khatam_campaigns")
    .select("*")
    .eq("memorial_id", currentMemorial.id)
    .order("created_at", { ascending: true });

  if (campaignResult.error) {
    console.error("campaign load error:", campaignResult.error);
  }

  if (campaignResult.data && campaignResult.data.length) {
    currentCampaign = campaignResult.data[0];
    renderCampaignPills(currentCampaign);
  }

  await loadJuzBoard();
}

function renderCampaignPills(campaign) {
  var pillRow = document.querySelector(".pill-row");
  if (!pillRow || !campaign) return;

  var deadlineText = campaign.deadline
    ? new Date(campaign.deadline).toLocaleString()
    : "No deadline set";

  pillRow.innerHTML =
    '<div class="pill">Campaign: ' + campaign.title + "</div>" +
    '<div class="pill">Deadline: ' + deadlineText + "</div>";
}

async function saveParticipant() {
  if (!currentMemorial) {
    alert("Memorial not loaded yet.");
    return;
  }

  var name = (document.getElementById("readerName") || {}).value || "";
  var ukCity = (document.getElementById("ukCity") || {}).value || "";
  var pakCity = (document.getElementById("pakCity") || {}).value || "";
  var relation = (document.getElementById("relation") || {}).value || "";

  if (!name.trim() && relation !== "Anonymous") {
    alert("Please enter your name or choose Anonymous.");
    return;
  }

  var result = await memorialClient
    .from("participants")
    .insert({
      memorial_id: currentMemorial.id,
      name: relation === "Anonymous" ? "Anonymous" : name.trim(),
      uk_city: ukCity.trim(),
      pak_city: pakCity.trim(),
      relation: relation || null
    })
    .select()
    .single();

  if (result.error) {
    console.error("saveParticipant error:", result.error);
    alert("Could not save participant.");
    return;
  }

  currentParticipant = result.data;
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

  var items = [
    ["Bismillah", "bismillah"],
    ["Alhamdulillah", "alhamdulillah"],
    ["Subhanallah", "subhanallah"],
    ["Astaghfirullah", "astaghfirullah"],
    ["Durood Sharif", "durood"],
    ["Surah Fatiha", "fatiha"],
    ["Surah Ikhlas", "ikhlas"],
    ["Surah Yasin", "yasin"]
  ];

  var rows = items
    .map(function (item) {
      var label = item[0];
      var id = item[1];
      var el = document.getElementById(id);
      return {
        memorial_id: currentMemorial.id,
        participant_id: currentParticipant.id,
        recitation_name: label,
        recitation_count: parseInt((el && el.innerText) || "0", 10)
      };
    })
    .filter(function (row) {
      return row.recitation_count > 0;
    });

  if (!rows.length) {
    alert("Add recitations first.");
    return;
  }

  var result = await memorialClient.from("quick_recitations").insert(rows);

  if (result.error) {
    console.error("submitQuickRecitations error:", result.error);
    alert("Could not submit recitations.");
    return;
  }

  alert("Submitted.");

  ["bismillah","alhamdulillah","subhanallah","astaghfirullah","durood","fatiha","ikhlas","yasin"]
    .forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerText = "0";
    });

  updateSummary();
}

async function loadJuzBoard() {
  if (!currentCampaign) return;

  var result = await memorialClient
    .from("khatam_claims")
    .select("*")
    .eq("campaign_id", currentCampaign.id)
    .order("juz_number", { ascending: true });

  if (result.error) {
    console.error("loadJuzBoard error:", result.error);
    return;
  }

  var data = result.data || [];
  var juzList = document.getElementById("juzList");
  if (!juzList) return;

  juzList.innerHTML = "";

  for (var i = 1; i <= 30; i++) {
    var claim = data.find(function (x) {
      return x.juz_number === i;
    });

    var isClaimed = !!claim;
    var isCompleted = claim && claim.status === "completed";

    var card = document.createElement("div");
    card.className = "juz-card";

    card.innerHTML =
      '<div class="juz-meta">' +
        "<strong>Juz " + i + "</strong>" +
        "<span>" +
          (isCompleted
            ? "Completed"
            : isClaimed
            ? "Already reserved by a reader"
            : "Available to claim") +
        "</span>" +
      "</div>" +
      '<button type="button" class="juz-btn ' + (isClaimed ? "claimed" : "available") + '">' +
        (isCompleted ? "Completed" : isClaimed ? "Claimed" : "Claim") +
      "</button>";

    var btn = card.querySelector("button");

    if (!isClaimed && btn) {
      (function (juzNumber) {
        btn.addEventListener("click", async function () {
          if (!currentParticipant) {
            alert("Save details first.");
            return;
          }

          var insertResult = await memorialClient
            .from("khatam_claims")
            .insert({
              campaign_id: currentCampaign.id,
              participant_id: currentParticipant.id,
              juz_number: juzNumber,
              status: "claimed"
            });

          if (insertResult.error) {
            console.error("claim error:", insertResult.error);
            alert("Could not claim this Juz.");
            return;
          }

          await loadJuzBoard();
        });
      })(i);
    }

    juzList.appendChild(card);
  }
}

function bindButtons() {
  var saveBtn = document.getElementById("saveDetailsBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveParticipant);
  }

  var submitBtn = document.getElementById("submitQuickBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", submitQuickRecitations);
  }
}

function bindRealtime() {
  memorialClient
    .channel("live-khatam")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "khatam_claims" },
      async function () {
        await loadJuzBoard();
      }
    )
    .subscribe();
}

document.addEventListener("DOMContentLoaded", async function () {
  bindTabs();
  bindButtons();
  updateSummary();
  await loadMemorial();
  bindRealtime();
});
