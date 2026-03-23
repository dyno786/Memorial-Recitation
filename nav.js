(function () {
  var APP_NAME = "Khatam";
  var slug = new URLSearchParams(window.location.search).get("slug");
  var q = slug ? "?slug=" + encodeURIComponent(slug) : "";
  var path = window.location.pathname;

  var isLanding  = path.endsWith("landing.html") || path.endsWith("/") || path === "";
  var isDashboard= path.endsWith("dashboard.html") || path.endsWith("index.html");
  var isRecite   = path.endsWith("recite.html");
  var isTotals   = path.endsWith("totals.html");
  var isAccount  = path.endsWith("account.html");
  var isAdmin    = path.endsWith("admin.html");
  var isApproval = path.endsWith("approvals.html");
  var isRegister = path.endsWith("register.html");
  var isLogin    = path.endsWith("login.html");
  var isRewards  = path.endsWith("rewards.html");

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
    .app-nav {
      position: sticky; top: 0; z-index: 400;
      background: rgba(3,17,15,.96);
      border-bottom: 1px solid rgba(255,255,255,.08);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .app-nav-inner {
      width: min(1400px,calc(100% - 32px));
      margin: 0 auto;
      display: flex; align-items: center; justify-content: space-between;
      height: 60px; gap: 16px;
    }
    .app-nav-logo {
      font-size: 20px; font-weight: bold; color: #caa85c;
      text-decoration: none; letter-spacing: .5px; flex-shrink: 0;
    }
    .app-nav-links { display: flex; align-items: center; gap: 4px; }
    .app-nav-links a, .app-nav-links button {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 12px; border-radius: 10px; font-size: 14px;
      color: #c9c7b9; text-decoration: none; background: none;
      border: none; cursor: pointer; font-family: inherit;
      transition: background .15s, color .15s; white-space: nowrap;
    }
    .app-nav-links a:hover, .app-nav-links button:hover { background: rgba(255,255,255,.06); color: #f5f5f0; }
    .app-nav-links a.active { color: #caa85c; background: rgba(202,168,92,.1); }
    .app-nav-links .nav-cta { background: #caa85c; color: #111; font-weight: bold; margin-left: 6px; }
    .app-nav-links .nav-cta:hover { background: #d4b46a; color: #111; }
    .app-nav-links .nav-outline { border: 1px solid rgba(255,255,255,.12); }
    .app-nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: #caa85c; color: #111; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; cursor: pointer; flex-shrink: 0; text-decoration: none; }

    .bottom-nav {
      display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 400;
      background: rgba(3,17,15,.97);
      border-top: 1px solid rgba(255,255,255,.1);
      padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
      justify-content: space-around; align-items: center;
    }
    .bottom-nav a {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      color: #c9c7b9; text-decoration: none; font-size: 10px; font-weight: bold;
      padding: 5px 12px; border-radius: 12px;
      transition: background .15s, color .15s; min-width: 56px; text-align: center;
    }
    .bottom-nav a .bn-icon { font-size: 20px; line-height: 1; }
    .bottom-nav a.active { color: #caa85c; background: rgba(202,168,92,.12); }
    .bottom-nav a:hover { background: rgba(255,255,255,.06); }

    @media (max-width: 768px) {
      .app-nav-links { display: none; }
      .bottom-nav { display: flex; }
      body { padding-bottom: 74px; }
    }
    @media (min-width: 769px) { .bottom-nav { display: none; } }
  `;
  document.head.appendChild(style);

  function buildTopNav(user, profile) {
    var nav = document.createElement("nav");
    nav.className = "app-nav";
    var isApprovedMosque = profile && profile.account_type === "mosque_approved";
    var isSuperAdmin = user && window.APP_CONFIG && user.email === window.APP_CONFIG.superAdminEmail;
    var initials = profile && profile.full_name
      ? profile.full_name.split(" ").map(function(n){return n[0];}).join("").slice(0,2).toUpperCase()
      : "?";

    var leftLinks = "";
    var rightLinks = "";

    if (user) {
      leftLinks =
        '<a href="dashboard.html" class="' + (isDashboard?"active":"") + '">Home</a>' +
        '<a href="recite.html' + q + '" class="' + (isRecite?"active":"") + '">🤲 Recite</a>' +
        '<a href="totals.html' + q + '" class="' + (isTotals?"active":"") + '">📊 Totals</a>' +
        '<a href="rewards.html" class="' + (isRewards?"active":"") + '">🌟 Rewards</a>' +
        (isApprovedMosque||isSuperAdmin ? '<a href="admin.html" class="'+(isAdmin?"active":"")+' ">🕌 Admin</a>' : '') +
        (isSuperAdmin ? '<a href="approvals.html" class="'+(isApproval?"active":"")+'">✅ Approvals</a>' : '');
      rightLinks = '<a href="account.html" class="app-nav-avatar" title="My account">' + initials + '</a>';
    } else {
      leftLinks =
        '<a href="landing.html" class="' + (isLanding?"active":"") + '">Home</a>' +
        '<a href="landing.html#how-it-works">How it works</a>' +
        '<a href="business-register.html">For businesses</a>';
      rightLinks =
        '<a href="login.html" class="nav-outline ' + (isLogin?"active":"") + '">Sign in</a>' +
        '<a href="register.html" class="nav-cta ' + (isRegister?"active":"") + '">Create account</a>';
    }

    nav.innerHTML =
      '<div class="app-nav-inner">' +
      '<a href="' + (user?"dashboard.html":"landing.html") + '" class="app-nav-logo"><span style="color:#caa85c;">Kh</span><span style="color:#f5f5f0;">atam</span></a>' +
      '<div class="app-nav-links">' + leftLinks + rightLinks + '</div>' +
      '</div>';
    return nav;
  }

  function buildBottomNav(user) {
    var nav = document.createElement("nav");
    nav.className = "bottom-nav";
    if (user) {
      nav.innerHTML =
        '<a href="dashboard.html" class="'+(isDashboard?"active":"")+'"><span class="bn-icon">🏠</span>Home</a>' +
        '<a href="recite.html'+q+'" class="'+(isRecite?"active":"")+'"><span class="bn-icon">🤲</span>Recite</a>' +
        '<a href="totals.html'+q+'" class="'+(isTotals?"active":"")+'"><span class="bn-icon">📊</span>Totals</a>' +
        '<a href="account.html" class="'+(isAccount?"active":"")+'"><span class="bn-icon">👤</span>Account</a>';
    } else {
      nav.innerHTML =
        '<a href="landing.html" class="'+(isLanding?"active":"")+'"><span class="bn-icon">🏠</span>Home</a>' +
        '<a href="login.html" class="'+(isLogin?"active":"")+'"><span class="bn-icon">🔑</span>Sign in</a>' +
        '<a href="register.html" class="'+(isRegister?"active":"")+'"><span class="bn-icon">✨</span>Register</a>';
    }
    return nav;
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var user = await getUserState();
    var topNav = buildTopNav(user, userProfile);
    var bottomNav = buildBottomNav(user);
    document.body.insertBefore(topNav, document.body.firstChild);
    document.body.appendChild(bottomNav);

    // Sign out on account page
    if (window.location.search.includes("signout=1")) {
      var client = window.supabase.createClient(window.APP_CONFIG.supabaseUrl, window.APP_CONFIG.supabasePublishableKey);
      await client.auth.signOut();
      window.location.href = "landing.html";
    }
  });
})();
