function count(id, val) {
  const el = document.getElementById(id);
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
  const active = items
    .map(([label, id]) => [label, parseInt(document.getElementById(id).innerText || "0", 10)])
    .filter(([, value]) => value > 0);

  if (!active.length) {
    summary.innerHTML = `<div class="summary-row"><span>No recitations added yet</span><strong>0</strong></div>`;
    return;
  }

  let total = 0;
  summary.innerHTML = active.map(([label, value]) => {
    total += value;
    return `<div class="summary-row"><span>${label}</span><strong>${value}</strong></div>`;
  }).join("") + `<div class="summary-row"><span>Total</span><strong>${total}</strong></div>`;
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

const juzList = document.getElementById("juzList");
if (juzList) {
  for (let i = 1; i <= 30; i++) {
    const card = document.createElement("div");
    card.className = "juz-card";

    const claimed = i === 1 || i === 2;
    const buttonClass = claimed ? "claimed" : "available";
    const buttonText = claimed ? "Claimed" : "Claim";

    card.innerHTML = `
      <div class="juz-meta">
        <strong>Juz ${i}</strong>
        <span>${claimed ? "Already reserved by a reader" : "Available to claim"}</span>
      </div>
      <button class="juz-btn ${buttonClass}">${buttonText}</button>
    `;

    const btn = card.querySelector("button");
    btn.addEventListener("click", () => {
      if (btn.classList.contains("claimed")) return;
      btn.classList.remove("available");
      btn.classList.add("claimed");
      btn.textContent = "Claimed";
      card.querySelector(".juz-meta span").textContent = "Reserved on this device";
    });

    juzList.appendChild(card);
  }
}

updateSummary();
