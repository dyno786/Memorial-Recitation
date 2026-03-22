// ── Universal Navigation System ───────────────────────────────
(function () {
  var APP_NAME = "Khatam"; // Change this when name is decided

  var slug = new URLSearchParams(window.location.search).get("slug");
  var q = slug ? "?slug=" + encodeURIComponent(slug) : "";
  var path = window.location.pathname;

  var isHome     = path.endsWith("index.html") || path.endsWith("/");
  var isTotals   = path.endsWith("totals.html");
  var isAdmin    = path.endsWith("admin.html");
  var isApproval = path.endsWith("approvals.html");
  var isRegister = path.endsWith("register.html");
  var isLogin    = path.endsWith("login.html");
  var isLanding  = path.endsWith("landing.html") || path === "/" || path.endsWith("/");

  // Get current user from Supabase if available
  var currentUser = null;
  var userProfile = null;

  async function getUserState() {
    if (!window.supabase || !window.APP_CONFIG) return null;
    try {
      var client = window.supabase.createClient(
        window.APP_CONFIG.supabaseUrl,
        window.APP_CONFIG.supabasePublishableKey
      );
      var s = await client.auth.getSession();
      if (!s.data || !s.data.session) return null;
      currentUser = s.data.session.user;
      var p = await client.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
      if (p.data) userProfile = p.data;
      return currentUser;
    } catch(e) { return null; }
  }

  var style = document.createElement("style");
  style.textContent = `
    /* ── Top nav (desktop) ── */
    .app-nav {
      position: sticky; top: 0; z-index: 400;
      background: rgba(3,17,15,.95);
      border-bottom: 1px solid rgba(255,255,255,.08);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .app-nav-inner {
      width: min(1400px, calc(100% - 32px));
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 60px;
      gap: 16px;
    }
    .app-nav-logo {
      font-size: 20px;
      font-weight: bold;
      color: #caa85c;
      text-decoration: none;
      letter-spacing: .5px;
      flex-shrink: 0;
    }
    .app-nav-logo span { color: #f5f5f0; }
    .app-nav-links {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .app-nav-links a, .app-nav-links button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 14px;
      color: #c9c7b9;
      text-decoration: none;
      background: none;
      border: none;
      cursor: pointer;
      font-family: inherit;
      transition: background .15s, color .15s;
      white-space: nowrap;
    }
    .app-nav-links a:hover, .app-nav-links button:hover { background: rgba(255,255,255,.06); color: #f5f5f0; }
    .app-nav-links a.active { color: #caa85c; background: rgba(202,168,92,.1); }
    .app-nav-links .nav-cta {
      background: #caa85c; color: #111;
      font-weight: bold; margin-left: 6px;
    }
    .app-nav-links .nav-cta:hover { background: #d4b46a; color: #111; }
    .app-nav-links .nav-sign-in {
      border: 1px solid rgba(255,255,255,.12);
    }
    .app-nav-user {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px 6px 6px;
      border-radius: 12px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
    }
    .app-nav-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: #caa85c; color: #111;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: bold; flex-shrink: 0;
    }
    .app-nav-username { font-size: 13px; color: #f5f5f0; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .app-nav-signout { font-size: 12px; color: #c9c7b9; cursor: pointer; background: none; border: none; font-family: inherit; padding: 0; }
    .app-nav-signout:hover { color: #e87070; }

    /* ── Bottom nav (mobile) ── */
    .bottom-nav {
      display: none;
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 400;
      background: rgba(3,17,15,.97);
      border-top: 1px solid rgba(255,255,255,.1);
      backdrop-filter: blur(12px);
      padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
      justify-content: space-around;
      align-items: center;
    }
    .bottom-nav a {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      color: #c9c7b9; text-decoration: none; font-size: 10px; font-weight: bold;
      padding: 6px 10px; border-radius: 12px; transition: background .15s, color .15s;
      min-width: 52px; text-align: center;
    }
    .bottom-nav a .bn-icon { font-size: 19px; line-height: 1; }
    .bottom-nav a.active { color: #caa85c; background: rgba(202,168,92,.12); }
    .bottom-nav a:hover { background: rgba(255,255,255,.06); }

    @media (max-width: 768px) {
      .app-nav-links { display: none; }
      .bottom-nav { display: flex; }
      body { padding-bottom: 72px; }
    }
    @media (min-width: 769px) {
      .bottom-nav { display: none; }
    }
  `;
  document.head.appendChild(style);

  // ── Build top nav ─────────────────────────────────────────
  function buildNav(user, profile) {
    var nav = document.createElement("nav");
    nav.className = "app-nav";

    var isApprovedMosque = profile && (profile.account_type === "mosque_approved");
    var isSuperAdmin = user && user.email === (window.APP_CONFIG && window.APP_CONFIG.superAdminEmail);

    var leftLinks = "";
    var rightLinks = "";

    if (user) {
      // Logged in links
      leftLinks =
        '<a href="index.html' + q + '" class="' + (isHome ? "active" : "") + '">🤲 Recite</a>' +
        '<a href="totals.html' + q + '" class="' + (isTotals ? "active" : "") + '">📊 Live Totals</a>';

      if (isApprovedMosque || isSuperAdmin) {
        leftLinks += '<a href="admin.html" class="' + (isAdmin ? "active" : "") + '">🕌 Admin</a>';
      }
      if (isSuperAdmin) {
        leftLinks += '<a href="approvals.html" class="' + (isApproval ? "active" : "") + '">✅ Approvals</a>';
      }

      var initials = profile && profile.full_name
        ? profile.full_name.split(" ").map(function(n){return n[0];}).join("").slice(0,2).toUpperCase()
        : (user.email || "?")[0].toUpperCase();

      rightLinks =
        '<div class="app-nav-user">' +
        '<div class="app-nav-avatar">' + initials + '</div>' +
        '<span class="app-nav-username">' + (profile ? profile.full_name.split(" ")[0] : user.email) + '</span>' +
        '<button class="app-nav-signout" id="navSignOut">Sign out</button>' +
        '</div>';
    } else {
      // Logged out links
      leftLinks =
        '<a href="landing.html" class="' + (isLanding ? "active" : "") + '">Home</a>' +
        '<a href="landing.html#how-it-works">How it works</a>' +
        '<a href="landing.html#pricing">Pricing</a>';

      rightLinks =
        '<a href="login.html" class="nav-sign-in ' + (isLogin ? "active" : "") + '">Sign in</a>' +
        '<a href="register.html" class="nav-cta ' + (isRegister ? "active" : "") + '">Create account</a>';
    }

    nav.innerHTML =
      '<div class="app-nav-inner">' +
      '<a href="' + (user ? "index.html" : "landing.html") + '" class="app-nav-logo">[APP_NAME]</a>' +
      '<div class="app-nav-links">' + leftLinks + rightLinks + '</div>' +
      '</div>';

    nav.innerHTML = nav.innerHTML.replace(/\[APP_NAME\]/g,
      '<span style="color:#caa85c">Kh</span><span>atam</span>');

    return nav;
  }

  // ── Build bottom nav ──────────────────────────────────────
  function buildBottomNav(user, profile) {
    var nav = document.createElement("nav");
    nav.className = "bottom-nav";

    var isApprovedMosque = profile && (profile.account_type === "mosque_approved");
    var isSuperAdmin = user && user.email === (window.APP_CONFIG && window.APP_CONFIG.superAdminEmail);

    if (user) {
      nav.innerHTML =
        '<a href="index.html' + q + '" class="' + (isHome ? "active" : "") + '"><span class="bn-icon">🤲</span>Recite</a>' +
        '<a href="totals.html' + q + '" class="' + (isTotals ? "active" : "") + '"><span class="bn-icon">📊</span>Totals</a>' +
        (isApprovedMosque || isSuperAdmin ? '<a href="admin.html" class="' + (isAdmin ? "active" : "") + '"><span class="bn-icon">🕌</span>Admin</a>' : '') +
        '<a href="login.html?signout=1" class=""><span class="bn-icon">👤</span>Account</a>';
    } else {
      nav.innerHTML =
        '<a href="landing.html" class="' + (isLanding ? "active" : "") + '"><span class="bn-icon">🏠</span>Home</a>' +
        '<a href="login.html" class="' + (isLogin ? "active" : "") + '"><span class="bn-icon">🔑</span>Sign in</a>' +
        '<a href="register.html" class="' + (isRegister ? "active" : "") + '"><span class="bn-icon">✨</span>Register</a>';
    }

    return nav;
  }

  // ── Inject nav ────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async function () {
    var user = await getUserState();

    var topNav = buildNav(user, userProfile);
    var bottomNav = buildBottomNav(user, userProfile);

    document.body.insertBefore(topNav, document.body.firstChild);
    document.body.appendChild(bottomNav);

    // Sign out handler
    var signOutBtn = document.getElementById("navSignOut");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", async function() {
        var client = window.supabase.createClient(
          window.APP_CONFIG.supabaseUrl,
          window.APP_CONFIG.supabasePublishableKey
        );
        await client.auth.signOut();
        window.location.href = "landing.html";
      });
    }

    // Handle signout param on login page
    if (window.location.search.includes("signout=1")) {
      var client = window.supabase.createClient(
        window.APP_CONFIG.supabaseUrl,
        window.APP_CONFIG.supabasePublishableKey
      );
      await client.auth.signOut();
      window.location.href = "landing.html";
    }
  });
})();
