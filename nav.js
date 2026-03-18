// ── Floating nav bar — injected into every page ───────────────
(function () {
  var slug = new URLSearchParams(window.location.search).get("slug");
  var q = slug ? "?slug=" + encodeURIComponent(slug) : "";
  var path = window.location.pathname;
  var isIndex  = path.endsWith("index.html") || path.endsWith("/");
  var isTotals = path.endsWith("totals.html");
  var isAdmin  = path.endsWith("admin.html");

  var style = document.createElement("style");
  style.textContent = `
    .float-nav {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 500;
      background: #0d1e18;
      border-top: 1px solid rgba(255,255,255,.1);
      display: flex; justify-content: space-around; align-items: center;
      padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
      backdrop-filter: blur(12px);
    }
    .float-nav a {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      color: #c9c7b9; text-decoration: none; font-size: 11px; font-weight: bold;
      padding: 6px 14px; border-radius: 12px; transition: background .15s, color .15s;
      min-width: 60px;
    }
    .float-nav a .nav-icon { font-size: 20px; line-height: 1; }
    .float-nav a.active { color: #caa85c; background: rgba(202,168,92,.12); }
    .float-nav a:hover { background: rgba(255,255,255,.06); }
    body { padding-bottom: 72px; }
  `;
  document.head.appendChild(style);

  var nav = document.createElement("nav");
  nav.className = "float-nav";
  nav.innerHTML =
    '<a href="index.html' + q + '" class="' + (isIndex  ? "active" : "") + '"><span class="nav-icon">🤲</span>Recite</a>' +
    '<a href="totals.html' + q + '" class="' + (isTotals ? "active" : "") + '"><span class="nav-icon">📊</span>Live Totals</a>' +
    '<a href="admin.html" class="' + (isAdmin  ? "active" : "") + '"><span class="nav-icon">⚙️</span>Admin</a>';

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(nav);
  });
})();
