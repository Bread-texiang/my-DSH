/* Onboarding tutorial controller for both games. */
(() => {
  "use strict";

  const GameHub = window.GameHub;
  const tutorialLayer = document.getElementById("tutorialLayer");
  const tutorialCard = document.getElementById("tutorialCard");
  const tutorialGameEl = document.getElementById("tutorialGame");
  const tutorialStepEl = document.getElementById("tutorialStep");
  const tutorialVisualEl = document.getElementById("tutorialVisual");
  const tutorialKickerEl = document.getElementById("tutorialKicker");
  const tutorialTitleEl = document.getElementById("tutorialTitle");
  const tutorialTextEl = document.getElementById("tutorialText");
  const tutorialHintEl = document.getElementById("tutorialHint");
  const tutorialDotsEl = document.getElementById("tutorialDots");
  const tutorialPrevEl = document.getElementById("tutorialPrev");
  const tutorialNextEl = document.getElementById("tutorialNext");
  const tutorialCloseEl = document.getElementById("tutorialClose");

  const tutorials = {
    2048: {
      label: "2048 · 数字合并",
      steps: [
        {
          kicker: "移动 · MOVEMENT",
          title: "用 W A S D 移动整盘方块",
          text: "每次移动，所有方块都会朝同一个方向滑到底。按 <strong>W</strong> 向上、<strong>A</strong> 向左、<strong>S</strong> 向下、<strong>D</strong> 向右，方向键也同样可以使用。",
          hint: "<span class=\"tutorial-chip\">W A S D</span><span class=\"tutorial-chip\">方向键同样有效</span>",
          visual: `
            <div class="tut-keyrow"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>
            <div class="tut-arrow-copy">整盘方块<br>一起滑动</div>
          `
        },
        {
          kicker: "合并 · MERGE",
          title: "相同数字相撞，就会合并",
          text: "两个 2 合并成 4，两个 4 合并成 8。每次移动后，棋盘都会出现一个新的 2 或 4。先看清空位，再决定方向。",
          hint: "<span class=\"tutorial-chip\">2 + 2 = 4</span><span class=\"tutorial-chip\">连续合并得分更高</span>",
          visual: `
            <div class="tut-merge-row">
              <span class="tut-tile">2</span>
              <span class="tut-merge-symbol">+</span>
              <span class="tut-tile">2</span>
              <span class="tut-merge-arrow">→</span>
              <span class="tut-tile is-four">4</span>
            </div>
          `
        },
        {
          kicker: "目标 · 2048",
          title: "抵达 2048，还能继续向上",
          text: "合成出 2048 方块即可触发胜利，并可以选择继续挑战更高数字。每局都可以撤销上一步，历史最高分会自动保存在这台设备上。",
          hint: "<span class=\"tutorial-chip\">Ctrl + Z 撤销</span><span class=\"tutorial-chip\">自动保存最高分</span>",
          visual: `
            <div class="tut-column">
              <span class="tut-tile is-target">2048</span>
              <div class="tut-progress">
                <div class="tut-progress-top"><span>黄金目标</span><strong>2048</strong></div>
                <div class="tut-progress-track"><span></span></div>
              </div>
            </div>
          `
        }
      ]
    },
    stack: {
      label: "叠砖块 · STACK 60",
      steps: [
        {
          kicker: "落砖 · DROP",
          title: "在轨道上找准时机",
          text: "砖块会在顶部轨道上不停左右移动。按 <strong>空格键</strong> 或点击下方的「落下」按钮，让它自由下坠。先观察目标线，再决定什么时候松手。",
          hint: "<span class=\"tutorial-chip\">空格键</span><span class=\"tutorial-chip\">落下按钮</span>",
          visual: `
            <div class="tut-rail-demo"><span class="dash"></span><span class="ghost-drop"></span></div>
            <div class="tut-arrow-copy">对准支撑面<br>再让砖落下</div>
          `
        },
        {
          kicker: "稳定 · BALANCE",
          title: "每一块都要落在支撑范围内",
          text: "砖块偏移太多就会掉出塔外。整局最多允许 <strong>10 块砖落空</strong>；重心一旦偏离太远，整座塔还会坍塌。宁可等一个更好的时机。",
          hint: "<span class=\"tutorial-chip\">失误上限 10 块</span><span class=\"tutorial-chip\">重心不稳会坍塌</span>",
          visual: `
            <div class="tut-stack-demo">
              <span class="danger" style="--c:hsl(4 54% 58%); --w:116px; --off:18px"></span>
              <span class="ghost"></span>
              <span style="--c:hsl(18 64% 59%); --w:122px; --off:-4px"></span>
              <span style="--c:hsl(38 67% 57%); --w:112px; --off:4px"></span>
              <span style="--c:hsl(55 58% 55%); --w:128px; --off:-2px"></span>
              <span style="--c:hsl(151 37% 49%); --w:106px; --off:2px"></span>
            </div>
          `
        },
        {
          kicker: "胜利 · 60 FLOORS",
          title: "稳稳叠满 60 层",
          text: "每一块砖都有不同的颜色。只要叠满 60 层且高塔没有坍塌，就完成挑战。保持节奏，越到高处越要耐心。",
          hint: "<span class=\"tutorial-chip\">目标 60 层</span><span class=\"tutorial-chip\">每块颜色都不同</span>",
          visual: `
            <div class="tut-column">
              <div class="tut-progress">
                <div class="tut-progress-top"><span>目标层数</span><strong>60</strong></div>
                <div class="tut-progress-track"><span></span></div>
              </div>
              <div class="tut-warning"><b>失误上限 10 次</b>，塔不能倒。</div>
            </div>
          `
        }
      ]
    },
    minesweeper: {
      label: "扫雷 · MINESWEEPER",
      steps: [
        {
          kicker: "操作 · REVEAL",
          title: "左键翻开，右键插旗",
          text: "左键点开安全格；右键给怀疑有雷的格子插旗。被插旗的格子不会被左键翻开，再次右键可以取消标记。",
          hint: "<span class=\"tutorial-chip\">左键 = 翻开</span><span class=\"tutorial-chip\">右键 = 插旗</span>",
          visual: `
            <div class="tut-mouse-row">
              <div class="tut-mouse"><b>L</b><strong>左键</strong><small>翻开格子</small></div>
              <div class="tut-mouse"><b>R</b><strong>右键</strong><small>插旗标记</small></div>
            </div>
          `
        },
        {
          kicker: "推理 · NUMBERS",
          title: "数字是周围的雷数",
          text: "翻开的数字表示它周围 8 个格子中藏着多少颗雷。数字 0 会自动展开周围的安全区域，借助数字逐步推理。",
          hint: "<span class=\"tutorial-chip\">数字 1–8 = 周围雷数</span>",
          visual: `
            <div class="tut-mine-board">
              <span class="tut-mine is-open n1">1</span>
              <span class="tut-mine is-open n1">1</span>
              <span class="tut-mine is-open n2">2</span>
              <span class="tut-mine is-open n1">1</span>
              <span class="tut-mine is-flag">⚑</span>
              <span class="tut-mine is-open n2">2</span>
              <span class="tut-mine is-open n1">1</span>
              <span class="tut-mine is-open n1">1</span>
              <span class="tut-mine is-open n1">1</span>
            </div>
          `
        },
        {
          kicker: "胜利 · CLEAR",
          title: "清空所有安全格",
          text: "首次左键一定安全。把所有非地雷格子翻开即可获胜。移动设备可以打开「标记模式」，用轻点完成插旗。",
          hint: "<span class=\"tutorial-chip\">首击安全</span><span class=\"tutorial-chip\">标记模式 M</span>",
          visual: `
            <div class="tut-column">
              <div class="tut-progress">
                <div class="tut-progress-top"><span>清理雷区</span><strong>100%</strong></div>
                <div class="tut-progress-track"><span></span></div>
              </div>
              <div class="tut-warning"><b>清空安全格</b>，不要踩中地雷。</div>
            </div>
          `
        }
      ]
    }
  };

  let activeGame = null;
  let stepIndex = 0;
  let isAuto = false;
  let lastFocusedElement = null;

  function hasSeen(game) {
    try {
      return localStorage.getItem(GameHub.keys.tutorials[game]) === "1";
    } catch (error) {
      return false;
    }
  }

  function markSeen(game) {
    try {
      localStorage.setItem(GameHub.keys.tutorials[game], "1");
    } catch (error) {
      // Tutorial persistence is optional.
    }
  }

  function renderStep() {
    if (!activeGame) return;

    const gameTutorial = tutorials[activeGame];
    const step = gameTutorial.steps[stepIndex];
    const isLast = stepIndex === gameTutorial.steps.length - 1;

    tutorialGameEl.textContent = gameTutorial.label;
    tutorialStepEl.textContent = `${String(stepIndex + 1).padStart(2, "0")} / ${String(gameTutorial.steps.length).padStart(2, "0")}`;
    tutorialKickerEl.textContent = step.kicker;
    tutorialTitleEl.textContent = step.title;
    tutorialTextEl.innerHTML = step.text;
    tutorialHintEl.innerHTML = step.hint || "";
    tutorialVisualEl.innerHTML = step.visual || "";

    tutorialDotsEl.innerHTML = "";
    gameTutorial.steps.forEach((entry, index) => {
      const dot = document.createElement("span");
      dot.className = `tutorial-dot${index === stepIndex ? " is-active" : ""}`;
      tutorialDotsEl.appendChild(dot);
    });

    tutorialPrevEl.disabled = stepIndex === 0;
    tutorialNextEl.textContent = isLast ? (isAuto ? "开始游戏" : "继续游戏") : "下一步";
    tutorialCard.scrollTop = 0;
  }

  function open(game, auto = false) {
    if (!tutorials[game] || GameHub.state.tutorialOpen) return;

    activeGame = game;
    stepIndex = 0;
    isAuto = auto;
    lastFocusedElement = document.activeElement;
    GameHub.state.tutorialOpen = true;

    tutorialLayer.classList.add("is-open");
    tutorialLayer.setAttribute("aria-hidden", "false");
    document.body.classList.add("tutorial-open");

    renderStep();

    window.setTimeout(() => {
      tutorialNextEl.focus({ preventScroll: true });
    }, 90);
  }

  function close() {
    if (!GameHub.state.tutorialOpen || !activeGame) return;

    markSeen(activeGame);
    GameHub.state.tutorialOpen = false;
    tutorialLayer.classList.remove("is-open");
    tutorialLayer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tutorial-open");

    const focusTarget = lastFocusedElement;
    activeGame = null;
    lastFocusedElement = null;

    window.setTimeout(() => {
      if (focusTarget && focusTarget.isConnected) {
        focusTarget.focus({ preventScroll: true });
      }
    }, 20);
  }

  function next() {
    if (!GameHub.state.tutorialOpen || !activeGame) return;

    const steps = tutorials[activeGame].steps;
    if (stepIndex >= steps.length - 1) {
      close();
      return;
    }

    stepIndex += 1;
    renderStep();
  }

  function previous() {
    if (!GameHub.state.tutorialOpen || stepIndex === 0) return;
    stepIndex -= 1;
    renderStep();
  }

  function trapFocus(event) {
    if (!GameHub.state.tutorialOpen || event.key !== "Tab") return;

    const focusable = [...tutorialCard.querySelectorAll("button:not([disabled])")];
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.querySelectorAll("[data-open-tutorial]").forEach((button) => {
    button.addEventListener("click", () => open(button.dataset.openTutorial, false));
  });

  tutorialNextEl.addEventListener("click", next);
  tutorialPrevEl.addEventListener("click", previous);
  tutorialCloseEl.addEventListener("click", close);

  tutorialLayer.addEventListener("pointerdown", (event) => {
    if (event.target === tutorialLayer) close();
  });

  document.addEventListener("keydown", (event) => {
    if (!GameHub.state.tutorialOpen) return;

    trapFocus(event);

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    }
  });

  GameHub.tutorials = {
    open,
    close,
    next,
    previous,
    hasSeen,
    isOpen: () => GameHub.state.tutorialOpen
  };
})();
