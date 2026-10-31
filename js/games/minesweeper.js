/* 扫雷 — classic left-click / right-click logic with three difficulties. */
(() => {
  "use strict";

  const GameHub = window.GameHub;
  const { readInt, writeInt } = GameHub.utils;
  const BEST_KEY = GameHub.keys.minesBest;

  const LEVELS = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 12, cols: 12, mines: 24 },
    hard: { rows: 16, cols: 16, mines: 40 }
  };

  const board = document.getElementById("mineBoard");
  const boardWrap = document.getElementById("mineBoardWrap");
  const counterEl = document.getElementById("mineCounter");
  const timerEl = document.getElementById("mineTimer");
  const bestEl = document.getElementById("mineBest");
  const levelButtons = [...document.querySelectorAll("[data-mine-level]")];
  const flagButton = document.getElementById("mineFlagBtn");
  const restartButton = document.getElementById("mineRestartBtn");
  const overlay = document.getElementById("mineOverlay");
  const overlayMark = document.getElementById("mineOverlayMark");
  const overlayKicker = document.getElementById("mineOverlayKicker");
  const overlayTitle = document.getElementById("mineOverlayTitle");
  const overlayText = document.getElementById("mineOverlayText");
  const overlayPrimary = document.getElementById("mineOverlayPrimary");
  const overlaySecondary = document.getElementById("mineOverlaySecondary");
  const live = document.getElementById("mineLive");

  let level = "easy";
  let state = "ready";
  let rows = 0;
  let cols = 0;
  let mineCount = 0;
  let cells = [];
  let minesPlaced = false;
  let revealedCount = 0;
  let flags = 0;
  let flagMode = false;
  let timerId = null;
  let elapsed = 0;
  let lastTick = 0;
  let resultTimer = null;

  function announce(message) {
    live.textContent = "";
    window.setTimeout(() => {
      live.textContent = message;
    }, 20);
  }

  function formatTime(value) {
    const seconds = Math.max(0, Math.min(999, Math.floor(value)));
    return String(seconds).padStart(3, "0");
  }

  function formatBest(seconds) {
    return seconds > 0 ? `${seconds} 秒` : "--";
  }

  function currentBest() {
    return readInt(BEST_KEY);
  }

  function updateBestDisplay() {
    if (bestEl) bestEl.textContent = formatBest(currentBest());
  }

  function updateHud() {
    if (counterEl) counterEl.textContent = String(mineCount - flags);
    if (timerEl) timerEl.textContent = formatTime(elapsed);
    updateBestDisplay();
  }

  function isActive() {
    return GameHub.state.route === "minesweeper" &&
      !GameHub.state.tutorialOpen &&
      !GameHub.share?.isOpen();
  }

  function startClock() {
    if (timerId || state !== "playing") return;

    lastTick = performance.now();
    timerId = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.max(0, (now - lastTick) / 1000);
      lastTick = now;

      if (state === "playing" && isActive() && !document.hidden) {
        elapsed += delta;
        if (timerEl) timerEl.textContent = formatTime(elapsed);
      }
    }, 200);
  }

  function stopClock() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function hideOverlay() {
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
  }

  function showOverlay(mode, detail = {}) {
    if (mode === "win") {
      overlay.dataset.mode = "win";
      overlayMark.textContent = "✦";
      overlayKicker.textContent = "Field clear";
      overlayTitle.textContent = "雷区已清空";
      overlayText.textContent = detail.record
        ? `用时 ${detail.seconds} 秒，刷新了你的最快纪录。下一片雷区还在等你。`
        : `用时 ${detail.seconds} 秒，清空了 ${rows}×${cols} 的雷区。`;
      overlayPrimary.textContent = "再来一局";
    } else {
      overlay.dataset.mode = "lose";
      overlayMark.textContent = "✹";
      overlayKicker.textContent = "Mine hit";
      overlayTitle.textContent = "踩到地雷";
      overlayText.textContent = `本局用时 ${formatTime(elapsed).replace(/^0+/, "") || "0"} 秒。再试一次，这次记得先插旗。`;
      overlayPrimary.textContent = "再来一局";
    }

    overlaySecondary.textContent = "返回大厅";
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
  }

  function updateLevelButtons() {
    levelButtons.forEach((button) => {
      const isActive = button.dataset.mineLevel === level;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function setFlagMode(active) {
    flagMode = Boolean(active);
    if (flagButton) {
      flagButton.classList.toggle("is-active", flagMode);
      flagButton.setAttribute("aria-pressed", String(flagMode));
    }
    announce(flagMode ? "标记模式已开启，点击格子插旗" : "标记模式已关闭，点击格子翻开");
  }

  function neighbourIndices(row, col) {
    const result = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) continue;
        result.push(nextRow * cols + nextCol);
      }
    }
    return result;
  }

  function cellLabel(cell) {
    const position = `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列`;
    if (cell.revealed) {
      return `${position}，已翻开${cell.adjacent > 0 ? `，周围 ${cell.adjacent} 颗雷` : "，周围没有雷"}`;
    }
    if (cell.flagged) return `${position}，已插旗`;
    return `${position}，未翻开`;
  }

  function renderCell(cell) {
    const button = cell.button;
    if (!button) return;

    button.className = "mine-cell";
    button.textContent = "";
    button.disabled = false;

    if (cell.revealed) {
      button.classList.add("is-revealed");
      if (cell.adjacent > 0) {
        button.textContent = String(cell.adjacent);
        button.classList.add(`n${cell.adjacent}`);
      }
    } else if (cell.flagged) {
      button.classList.add("is-flagged");
      button.textContent = "⚑";
    }

    button.setAttribute("aria-label", cellLabel(cell));
  }

  function buildBoard() {
    board.innerHTML = "";
    board.style.setProperty("--size", String(cols));
    board.dataset.size = String(cols);
    cells = [];

    const fragment = document.createDocumentFragment();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mine-cell";
        button.dataset.index = String(index);
        button.setAttribute("aria-label", `第 ${row + 1} 行，第 ${col + 1} 列，未翻开`);
        const cell = {
          index,
          row,
          col,
          mine: false,
          adjacent: 0,
          revealed: false,
          flagged: false,
          button
        };
        cells.push(cell);
        fragment.appendChild(button);
      }
    }

    board.appendChild(fragment);
  }

  function placeMines(safeIndex) {
    const safeCell = cells[safeIndex];
    const safe = new Set([safeIndex, ...neighbourIndices(safeCell.row, safeCell.col)]);
    const candidates = cells
      .map((cell) => cell.index)
      .filter((index) => !safe.has(index));

    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }

    for (let index = 0; index < Math.min(mineCount, candidates.length); index += 1) {
      cells[candidates[index]].mine = true;
    }

    cells.forEach((cell) => {
      cell.adjacent = neighbourIndices(cell.row, cell.col)
        .reduce((total, index) => total + (cells[index].mine ? 1 : 0), 0);
    });

    minesPlaced = true;
  }

  function revealSafe(startCell) {
    const queue = [startCell];

    while (queue.length > 0) {
      const cell = queue.pop();
      if (!cell || cell.revealed || cell.flagged) continue;

      cell.revealed = true;
      revealedCount += 1;
      renderCell(cell);

      if (cell.adjacent === 0) {
        for (const index of neighbourIndices(cell.row, cell.col)) {
          const neighbour = cells[index];
          if (!neighbour.revealed && !neighbour.flagged) queue.push(neighbour);
        }
      }
    }
  }

  function revealCell(index) {
    if (state === "won" || state === "lost") return;
    const cell = cells[index];
    if (!cell || cell.revealed || cell.flagged) return;

    if (!minesPlaced) {
      placeMines(index);
      state = "playing";
      startClock();
    }

    if (cell.mine) {
      loseGame(cell);
      return;
    }

    revealSafe(cell);
    updateHud();

    if (revealedCount === rows * cols - mineCount) {
      winGame();
    }
  }

  function toggleFlag(index) {
    if (state === "won" || state === "lost") return;
    const cell = cells[index];
    if (!cell || cell.revealed) return;

    cell.flagged = !cell.flagged;
    flags += cell.flagged ? 1 : -1;
    renderCell(cell);
    updateHud();
    announce(cell.flagged ? "已插旗" : "已取消旗标");
  }

  function loseGame(explodedCell) {
    state = "lost";
    stopClock();
    window.clearTimeout(resultTimer);

    cells.forEach((cell) => {
      if (cell.mine) {
        cell.button.classList.remove("is-flagged");
        cell.button.classList.add("is-mine");
        cell.button.textContent = "✹";
        cell.button.setAttribute("aria-label", "地雷");
      } else if (cell.flagged) {
        cell.button.classList.add("is-wrong");
      }
    });

    explodedCell.button.classList.add("is-exploded");
    explodedCell.button.textContent = "✹";
    explodedCell.button.setAttribute("aria-label", "引爆的地雷");
    announce("踩到地雷，本局结束");
    resultTimer = window.setTimeout(() => showOverlay("lose"), 380);
  }

  function winGame() {
    state = "won";
    stopClock();

    let record = false;
    const seconds = Math.max(1, Math.ceil(elapsed));
    const previousBest = currentBest();

    if (previousBest === 0 || seconds < previousBest) {
      writeInt(BEST_KEY, seconds);
      record = true;
      GameHub.bus.emit("stats:change");
    }

    flags = mineCount;
    cells.forEach((cell) => {
      if (cell.mine && !cell.flagged) {
        cell.flagged = true;
        renderCell(cell);
      }
    });

    updateHud();
    announce(`雷区已清空，用时 ${seconds} 秒`);
    showOverlay("win", { seconds, record });
  }

  function newGame(nextLevel = level) {
    window.clearTimeout(resultTimer);
    stopClock();

    level = LEVELS[nextLevel] ? nextLevel : "easy";
    const config = LEVELS[level];
    rows = config.rows;
    cols = config.cols;
    mineCount = config.mines;

    state = "ready";
    minesPlaced = false;
    revealedCount = 0;
    flags = 0;
    elapsed = 0;
    lastTick = 0;
    flagMode = false;

    if (flagButton) {
      flagButton.classList.remove("is-active");
      flagButton.setAttribute("aria-pressed", "false");
    }

    updateLevelButtons();
    hideOverlay();
    buildBoard();
    updateHud();
    announce("新的一局扫雷开始，左键翻开安全格");
  }

  function cellIndexFromEvent(event) {
    const button = event.target.closest(".mine-cell");
    if (!button || !board.contains(button)) return null;
    const index = Number(button.dataset.index);
    return Number.isInteger(index) ? index : null;
  }

  board.addEventListener("click", (event) => {
    if (state === "won" || state === "lost") return;
    const index = cellIndexFromEvent(event);
    if (index === null) return;
    if (flagMode) {
      toggleFlag(index);
    } else {
      revealCell(index);
    }
  });

  board.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (state === "won" || state === "lost") return;
    const index = cellIndexFromEvent(event);
    if (index !== null) toggleFlag(index);
  });

  boardWrap.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  flagButton.addEventListener("click", () => {
    setFlagMode(!flagMode);
  });

  restartButton.addEventListener("click", () => {
    newGame(level);
  });

  levelButtons.forEach((button) => {
    button.addEventListener("click", () => {
      newGame(button.dataset.mineLevel);
    });
  });

  overlayPrimary.addEventListener("click", () => {
    newGame(level);
  });

  overlaySecondary.addEventListener("click", () => {
    newGame(level);
    window.location.hash = "#home";
  });

  document.addEventListener("keydown", (event) => {
    if (GameHub.state.route !== "minesweeper" || GameHub.state.tutorialOpen) return;
    if (GameHub.share?.isOpen() || event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      setFlagMode(!flagMode);
    }
  });

  updateBestDisplay();
  newGame(level);

  GameHub.games = GameHub.games || {};
  GameHub.games.minesweeper = {
    restart: newGame,
    state: () => ({ level, state, remaining: mineCount - flags, elapsed: Math.floor(elapsed) })
  };
})();
