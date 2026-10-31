/* Application bootstrap: hash router, home screen, and cross-module wiring. */
(() => {
  "use strict";

  const GameHub = window.GameHub;
  const screens = {
    home: document.getElementById("screen-home"),
    2048: document.getElementById("screen-2048"),
    stack: document.getElementById("screen-stack"),
    minesweeper: document.getElementById("screen-minesweeper")
  };
  const pageTitles = {
    home: "方块游乐场 · 叠砖块 · 2048 · 扫雷",
    2048: "2048 · 数字合并",
    stack: "叠砖块 · 60 层挑战",
    minesweeper: "扫雷 · 数字雷区"
  };
  const home2048Best = document.getElementById("home2048Best");
  const homeStackBest = document.getElementById("homeStackBest");
  const homeMineBest = document.getElementById("homeMineBest");

  let currentRoute = null;
  let autoTutorialTimer = null;

  function routeFromHash() {
    const raw = window.location.hash.replace(/^#\/?/, "").toLowerCase();
    return raw === "2048" || raw === "stack" || raw === "minesweeper" ? raw : "home";
  }

  function syncHomeStats() {
    const best2048 = GameHub.utils.readInt(GameHub.keys.best2048);
    const bestStack = GameHub.utils.readInt(GameHub.keys.stackBest);
    const wins = GameHub.utils.readInt(GameHub.keys.stackWins);
    const bestMine = GameHub.utils.readInt(GameHub.keys.minesBest);

    home2048Best.textContent = best2048 > 0
      ? `${GameHub.utils.formatNumber(best2048)} 分`
      : "暂无记录";

    if (bestStack > 0) {
      homeStackBest.textContent = wins > 0
        ? `${bestStack} 层 · 已通关`
        : `${bestStack} 层`;
    } else {
      homeStackBest.textContent = "暂无记录";
    }

    homeMineBest.textContent = bestMine > 0 ? `${bestMine} 秒` : "暂无记录";
  }

  function activateRoute(route) {
    if (!screens[route]) route = "home";

    if (GameHub.state.tutorialOpen) {
      GameHub.tutorials.close();
    }

    window.clearTimeout(autoTutorialTimer);

    Object.entries(screens).forEach(([key, screen]) => {
      screen.hidden = key !== route;
    });

    const changed = currentRoute !== route;
    currentRoute = route;
    GameHub.state.route = route;
    document.body.dataset.screen = route;
    document.title = pageTitles[route];

    GameHub.bus.emit("route", { route });
    syncHomeStats();

    if (changed && route !== "home" && !GameHub.tutorials.hasSeen(route)) {
      autoTutorialTimer = window.setTimeout(() => {
        if (GameHub.state.route === route && !GameHub.state.tutorialOpen) {
          GameHub.tutorials.open(route, true);
        }
      }, 180);
    }
  }

  function navigate(route) {
    const target = screens[route] ? route : "home";
    if (window.location.hash !== `#${target}`) {
      window.location.hash = `#${target}`;
    } else {
      activateRoute(target);
    }
  }

  window.addEventListener("hashchange", () => {
    activateRoute(routeFromHash());
  });

  GameHub.bus.on("stats:change", () => {
    if (GameHub.state.route === "home") syncHomeStats();
  });

  if (!window.location.hash) {
    window.history.replaceState(null, "", "#home");
  }

  syncHomeStats();
  activateRoute(routeFromHash());

  GameHub.app = {
    navigate,
    currentRoute: () => currentRoute,
    refreshHomeStats: syncHomeStats
  };
})();
