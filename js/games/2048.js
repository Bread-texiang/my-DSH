(() => {
      "use strict";

      const SIZE = 4;
      const BEST_KEY = window.GameHub.keys.best2048;
      const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const MOVE_DURATION = REDUCED_MOTION ? 30 : 150;
      const MAX_HISTORY = 30;

      const boardEl = document.getElementById("board");
      const gridEl = document.getElementById("grid");
      const tilesEl = document.getElementById("tiles");
      const scoreEl = document.getElementById("score");
      const bestEl = document.getElementById("best");
      const maxTileEl = document.getElementById("maxTile");
      const progressFillEl = document.getElementById("progressFill");
      const progressTextEl = document.getElementById("progressText");
      const undoBtn = document.getElementById("undoBtn");
      const newGameBtn = document.getElementById("newGameBtn");
      const overlayEl = document.getElementById("overlay");
      const overlayMarkEl = document.getElementById("overlayMark");
      const overlayKickerEl = document.getElementById("overlayKicker");
      const overlayTitleEl = document.getElementById("overlayTitle");
      const overlayTextEl = document.getElementById("overlayText");
      const overlayPrimaryEl = document.getElementById("overlayPrimary");
      const overlaySecondaryEl = document.getElementById("overlaySecondary");
      const liveEl = document.getElementById("live");

      let grid = createEmptyGrid();
      let tiles = [];
      let score = 0;
      let best = loadBest();
      let history = [];
      let busy = false;
      let won = false;
      let gameOver = false;
      let overlayMode = null;
      let commitTimer = null;
      let nudgeTimer = null;
      let tileId = 0;
      let pointerStart = null;

      const DIRECTIONS = {
        w: "up",
        a: "left",
        s: "down",
        d: "right",
        arrowup: "up",
        arrowleft: "left",
        arrowdown: "down",
        arrowright: "right"
      };

      function createEmptyGrid() {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
      }

      function loadBest() {
        try {
          const stored = Number.parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
          return Number.isFinite(stored) && stored > 0 ? stored : 0;
        } catch (error) {
          return 0;
        }
      }

      function saveBest() {
        try {
          localStorage.setItem(BEST_KEY, String(best));
        } catch (error) {
          // The game still works when local storage is unavailable.
        }
      }

      function buildGrid() {
        for (let index = 0; index < SIZE * SIZE; index += 1) {
          const cell = document.createElement("div");
          cell.className = "cell";
          gridEl.appendChild(cell);
        }
      }

      function tileAt(row, col) {
        return grid[row] && grid[row][col];
      }

      function createTile(value, row, col, isNew) {
        const el = document.createElement("div");
        el.className = "tile";
        el.setAttribute("aria-hidden", "true");

        const inner = document.createElement("div");
        inner.className = "tile-inner";
        const label = document.createElement("span");
        label.textContent = String(value);
        inner.appendChild(label);
        el.appendChild(inner);

        const tile = {
          id: (tileId += 1),
          value,
          row,
          col,
          el
        };

        paintTile(tile);
        el.style.setProperty("--row", String(row));
        el.style.setProperty("--col", String(col));

        if (isNew) {
          el.classList.add("is-new");
          window.setTimeout(() => el.classList.remove("is-new"), 320);
        }

        tilesEl.appendChild(el);
        return tile;
      }

      function paintTile(tile) {
        const value = tile.value;
        tile.el.dataset.value = String(value);
        tile.el.dataset.digits = String(value).length;
        if (value > 2048) {
          tile.el.dataset.tier = "super";
        } else {
          delete tile.el.dataset.tier;
        }
        tile.el.style.setProperty("--row", String(tile.row));
        tile.el.style.setProperty("--col", String(tile.col));
        const label = tile.el.querySelector("span");
        if (label) label.textContent = String(value);
      }

      function placeTile(tile) {
        tile.el.style.setProperty("--row", String(tile.row));
        tile.el.style.setProperty("--col", String(tile.col));
      }

      function randomEmptyCell() {
        const empty = [];
        for (let row = 0; row < SIZE; row += 1) {
          for (let col = 0; col < SIZE; col += 1) {
            if (!grid[row][col]) empty.push({ row, col });
          }
        }
        if (empty.length === 0) return null;
        return empty[Math.floor(Math.random() * empty.length)];
      }

      function spawnTile(forcedValue) {
        const cell = randomEmptyCell();
        if (!cell) return null;

        const value = forcedValue || (Math.random() < 0.9 ? 2 : 4);
        const tile = createTile(value, cell.row, cell.col, true);
        grid[cell.row][cell.col] = tile;
        tiles.push(tile);
        return tile;
      }

      function snapshot() {
        return {
          cells: grid.map((row) => row.map((tile) => (tile ? tile.value : 0))),
          score,
          won
        };
      }

      function addTileToGrid(tile) {
        grid[tile.row][tile.col] = tile;
      }

      function buildLines(direction) {
        const lines = [];
        for (let lineIndex = 0; lineIndex < SIZE; lineIndex += 1) {
          const coords = [];
          for (let step = 0; step < SIZE; step += 1) {
            if (direction === "left") coords.push({ row: lineIndex, col: step });
            else if (direction === "right") coords.push({ row: lineIndex, col: SIZE - 1 - step });
            else if (direction === "up") coords.push({ row: step, col: lineIndex });
            else coords.push({ row: SIZE - 1 - step, col: lineIndex });
          }
          lines.push(coords);
        }
        return lines;
      }

      function applyMove(direction) {
        for (const tile of tiles) {
          tile.mergedThisTurn = false;
          tile.removed = false;
        }

        let moved = false;
        let gained = 0;
        const merges = [];
        const absorbed = [];
        const lines = buildLines(direction);

        for (const coords of lines) {
          const placed = [];

          for (const { row, col } of coords) {
            const tile = tileAt(row, col);
            if (!tile) continue;

            const last = placed[placed.length - 1];

            if (last && !last.mergedThisTurn && last.value === tile.value) {
              tile.row = last.row;
              tile.col = last.col;
              tile.removed = true;
              last.mergedThisTurn = true;
              last.mergeValue = last.value * 2;
              merges.push(last);
              absorbed.push(tile);
              gained += last.mergeValue;
              moved = true;
              continue;
            }

            const target = coords[placed.length];
            if (tile.row !== target.row || tile.col !== target.col) {
              moved = true;
            }
            tile.row = target.row;
            tile.col = target.col;
            placed.push(tile);
          }
        }

        grid = createEmptyGrid();

        if (moved) {
          for (const tile of tiles) {
            if (!tile.removed) addTileToGrid(tile);
          }
        } else {
          // Positions are already correct, but rebuild defensively.
          for (const tile of tiles) {
            if (!tile.removed) addTileToGrid(tile);
          }
        }

        return { moved, gained, merges, absorbed };
      }

      function hasMoves() {
        for (let row = 0; row < SIZE; row += 1) {
          for (let col = 0; col < SIZE; col += 1) {
            const tile = grid[row][col];
            if (!tile) return true;
            if (col < SIZE - 1 && grid[row][col + 1] && tile.value === grid[row][col + 1].value) {
              return true;
            }
            if (row < SIZE - 1 && grid[row + 1][col] && tile.value === grid[row + 1][col].value) {
              return true;
            }
          }
        }
        return false;
      }

      function updateScoreUI(animate) {
        scoreEl.textContent = String(score);
        bestEl.textContent = String(best);

        if (animate) {
          bump(scoreEl);
        }
      }

      function bump(el) {
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
        window.setTimeout(() => el.classList.remove("bump"), 340);
      }

      function updateBest() {
        if (score > best) {
          best = score;
          saveBest();
          bestEl.textContent = String(best);
          bump(bestEl);
          window.GameHub.bus.emit("stats:change");
        }
      }

      function updateProgress() {
        const maxValue = tiles.reduce((max, tile) => Math.max(max, tile.value), 0);
        maxTileEl.textContent = String(maxValue || 2);
        const ratio = Math.max(0, Math.min(1, (Math.log2(Math.max(maxValue, 2)) - 1) / 10));
        progressFillEl.style.width = `${(ratio * 100).toFixed(2)}%`;
        progressTextEl.textContent = `${Math.round(ratio * 100)}%`;
      }

      function updateUndoState() {
        const available = history.length > 0 && !busy;
        undoBtn.disabled = !available;
        undoBtn.setAttribute("aria-disabled", String(!available));
      }

      function announce(message) {
        liveEl.textContent = "";
        window.setTimeout(() => {
          liveEl.textContent = message;
        }, 30);
      }

      function nudgeBoard() {
        window.clearTimeout(nudgeTimer);
        boardEl.classList.remove("nudge");
        void boardEl.offsetWidth;
        boardEl.classList.add("nudge");
        nudgeTimer = window.setTimeout(() => boardEl.classList.remove("nudge"), 240);
      }

      function move(direction) {
        if (busy || overlayMode || gameOver) return;

        const before = snapshot();
        const result = applyMove(direction);

        if (!result.moved) {
          nudgeBoard();
          return;
        }

        history.push(before);
        if (history.length > MAX_HISTORY) history.shift();
        updateUndoState();

        busy = true;
        undoBtn.disabled = true;

        for (const tile of tiles) {
          placeTile(tile);
        }

        window.clearTimeout(commitTimer);
        commitTimer = window.setTimeout(() => {
          commitTimer = null;

          const removed = new Set(result.absorbed);
          for (const tile of result.absorbed) {
            tile.el.remove();
          }
          tiles = tiles.filter((tile) => !removed.has(tile));

          if (result.gained > 0) {
            score += result.gained;
            updateScoreUI(true);
            updateBest();
          }

          for (const tile of result.merges) {
            tile.value = tile.mergeValue;
            paintTile(tile);
            flashMerge(tile);
          }

          if (result.merges.length > 0 && window.GameHub.audio) {
            const highestMerged = Math.max(...result.merges.map((tile) => tile.value));
            window.GameHub.audio.merge(highestMerged);
          }

          spawnTile();
          updateProgress();
          busy = false;

          const reachedGoal = !won && tiles.some((tile) => tile.value >= 2048);

          if (reachedGoal) {
            won = true;
            showOverlay("win");
          } else if (!hasMoves()) {
            gameOver = true;
            showOverlay("lose");
          } else {
            announce(`当前得分 ${score}，最高方块 ${maxTileEl.textContent}`);
          }

          updateUndoState();
        }, MOVE_DURATION);
      }

      function flashMerge(tile) {
        tile.el.classList.remove("is-merged");
        void tile.el.offsetWidth;
        tile.el.classList.add("is-merged");
        window.setTimeout(() => tile.el.classList.remove("is-merged"), 340);
      }

      function showOverlay(mode) {
        overlayMode = mode;
        overlayEl.dataset.mode = mode;

        if (mode === "win") {
          overlayMarkEl.textContent = "✦";
          overlayKickerEl.textContent = "2048 Achieved";
          overlayTitleEl.textContent = "抵达 2048";
          overlayTextEl.textContent = "黄金方块已经出现。继续挑战，看看这盘棋能走到多远。";
          overlayPrimaryEl.textContent = "继续挑战";
          overlaySecondaryEl.textContent = "重新开始";
          overlaySecondaryEl.hidden = false;
        } else {
          overlayMarkEl.textContent = "◇";
          overlayKickerEl.textContent = "No moves left";
          overlayTitleEl.textContent = "棋局结束";
          overlayTextEl.textContent = `这盘棋合出了 ${maxTileEl.textContent}，最终得分 ${score}。再来一局，冲击 2048。`;
          overlayPrimaryEl.textContent = "再来一局";
          overlaySecondaryEl.textContent = "撤销一步";
          overlaySecondaryEl.hidden = history.length === 0;
        }

        overlayEl.classList.add("is-visible");
        overlayEl.setAttribute("aria-hidden", "false");
        announce(mode === "win" ? "恭喜，你合成了 2048 方块" : `游戏结束，最终得分 ${score}`);
      }

      function hideOverlay() {
        overlayEl.classList.remove("is-visible");
        overlayEl.setAttribute("aria-hidden", "true");
        overlayMode = null;
      }

      function continueAfterWin() {
        hideOverlay();
        if (!hasMoves()) {
          gameOver = true;
          showOverlay("lose");
        } else {
          announce("继续挑战");
        }
      }

      function newGame() {
        window.clearTimeout(commitTimer);
        window.clearTimeout(nudgeTimer);
        commitTimer = null;
        busy = false;
        pointerStart = null;

        for (const tile of tiles) {
          tile.el.remove();
        }
        tiles = [];
        grid = createEmptyGrid();
        score = 0;
        won = false;
        gameOver = false;
        history = [];
        overlayMode = null;
        hideOverlay();
        boardEl.classList.remove("nudge");

        spawnTile();
        spawnTile();

        updateScoreUI(false);
        updateProgress();
        updateUndoState();
        announce("新游戏开始，使用 W、A、S、D 移动方块");
      }

      function undo() {
        if (busy || history.length === 0) return;

        const previous = history.pop();

        for (const tile of tiles) {
          tile.el.remove();
        }

        tiles = [];
        grid = createEmptyGrid();

        for (let row = 0; row < SIZE; row += 1) {
          for (let col = 0; col < SIZE; col += 1) {
            const value = previous.cells[row][col];
            if (!value) continue;
            const tile = createTile(value, row, col, false);
            addTileToGrid(tile);
            tiles.push(tile);
          }
        }

        score = previous.score;
        won = previous.won;
        gameOver = false;
        busy = false;
        hideOverlay();

        updateScoreUI(false);
        updateProgress();
        updateUndoState();
        announce("已撤销上一步");
      }

      buildGrid();
      bestEl.textContent = String(best);
      updateScoreUI(false);
      newGame();

      newGameBtn.addEventListener("click", newGame);
      undoBtn.addEventListener("click", undo);

      overlayPrimaryEl.addEventListener("click", () => {
        if (overlayMode === "win") {
          continueAfterWin();
        } else {
          newGame();
        }
      });

      overlaySecondaryEl.addEventListener("click", () => {
        if (overlayMode === "win") {
          newGame();
        } else if (overlayMode === "lose") {
          undo();
        }
      });

      window.addEventListener("keydown", (event) => {
        if (window.GameHub.state.route !== "2048" || window.GameHub.state.tutorialOpen) {
          return;
        }

        const key = event.key.toLowerCase();

        if ((event.ctrlKey || event.metaKey) && key === "z") {
          event.preventDefault();
          undo();
          return;
        }

        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const direction = DIRECTIONS[key];
        if (direction) {
          event.preventDefault();
          if (event.repeat) return;
          move(direction);
        }
      });

      boardEl.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button") || overlayMode) return;
        pointerStart = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY
        };
      });

      boardEl.addEventListener("pointerup", (event) => {
        if (!pointerStart || pointerStart.id !== event.pointerId) return;

        const dx = event.clientX - pointerStart.x;
        const dy = event.clientY - pointerStart.y;
        pointerStart = null;

        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;

        if (Math.abs(dx) > Math.abs(dy)) {
          move(dx > 0 ? "right" : "left");
        } else {
          move(dy > 0 ? "down" : "up");
        }
      });

      boardEl.addEventListener("pointercancel", () => {
        pointerStart = null;
      });

      window.GameHub.games = window.GameHub.games || {};
      window.GameHub.games.merge2048 = {
        reset: newGame,
        undo,
        state: () => ({ score, best, busy, won, gameOver })
      };
    })();
