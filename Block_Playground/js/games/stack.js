/* 叠砖块 — self-contained canvas game module. */
(() => {
  "use strict";

  const GameHub = window.GameHub;
  const { clamp, readInt, writeInt } = GameHub.utils;

  const STACK_TARGET = 60;
  const STACK_MAX_MISSES = 10;
  const NORMAL_BRICK_WIDTH = 0.30;
  const GOD_BRICK_WIDTH = 0.60;
  const STACK_BEST_KEY = GameHub.keys.stackBest;
  const STACK_WINS_KEY = GameHub.keys.stackWins;

  const readStoredInt = (key) => readInt(key);
  const writeStoredInt = (key, value) => writeInt(key, value);

  const stackCanvas = document.getElementById("stackCanvas");
  const stackBoardWrap = document.getElementById("stackBoardWrap");
  const stackCountEl = document.getElementById("stackCount");
  const stackMissesEl = document.getElementById("stackMisses");
  const stackBestEl = document.getElementById("stackBest");
  const stackMeterFillEl = document.getElementById("stackMeterFill");
  const stackMeterTextEl = document.getElementById("stackMeterText");
  const stackMissStatEl = document.getElementById("stackMissStat");
  const godBadgeEl = document.getElementById("godBadge");
  const stackDropBtn = document.getElementById("dropBtn");
  const stackResetBtn = document.getElementById("stackResetBtn");
  const stackOverlay = document.getElementById("stackOverlay");
  const stackOverlayMark = document.getElementById("stackOverlayMark");
  const stackOverlayKicker = document.getElementById("stackOverlayKicker");
  const stackOverlayTitle = document.getElementById("stackOverlayTitle");
  const stackOverlayText = document.getElementById("stackOverlayText");
  const stackOverlayPrimary = document.getElementById("stackOverlayPrimary");
  const stackOverlaySecondary = document.getElementById("stackOverlaySecondary");
  const stackLiveEl = document.getElementById("stackLive");

  let stackInitialized = false;
  let stackGameStarted = false;
  let stackLoopStarted = false;
  const heldKeys = new Set();

  const stackCanvasCtx = stackCanvas.getContext("2d");

  const stackState = {
    phase: "idle",
    bricks: [],
    moving: null,
    falling: null,
    particles: [],
    collapsePieces: [],
    floatTexts: [], // 新增：用于显示 Perfect 和 Stage 飘字
    attempt: 0,
    misses: 0,
    direction: 1,
    cameraY: 0,
    shake: 0,
    settleTimer: 0,
    collapseElapsed: 0,
    resultTimer: null,
    time: 0,
    godMode: false,
    best: readStoredInt(GameHub.keys.stackBest),
    wins: readStoredInt(GameHub.keys.stackWins)
  };

  const stackMetrics = {
    width: 0,
    height: 0,
    dpr: 1,
    layerH: 12,
    brickW: NORMAL_BRICK_WIDTH,
    platformW: 0.46,
    laneMin: 0.22,
    laneMax: 0.78,
    groundY: 0,
    focusY: 0,
    railY: 0,
    movingY: 0,
    ready: false
  };

  function getLaneBounds(brickWidth) {
    const margin = 0.07;
    return {
      min: margin + brickWidth / 2,
      max: 1 - margin - brickWidth / 2
    };
  }

  function refreshDropButton() {
    const canDrop = stackState.phase === "moving" && GameHub.state.route === "stack";
    stackDropBtn.disabled = !canDrop;
    stackDropBtn.setAttribute("aria-disabled", String(!canDrop));
    stackBoardWrap.dataset.phase = stackState.phase;
  }

  function announceStack(message) {
    stackLiveEl.textContent = "";
    window.setTimeout(() => {
      stackLiveEl.textContent = message;
    }, 20);
  }

  function updateStackHud() {
    const count = Math.min(stackState.bricks.length, STACK_TARGET);
    const misses = stackState.misses;
    const progress = (count / STACK_TARGET) * 100;

    stackCountEl.textContent = String(count);
    stackMissesEl.textContent = String(misses);
    stackMeterTextEl.textContent = `${count} / ${STACK_TARGET}`;
    stackMeterFillEl.style.width = `${progress.toFixed(2)}%`;
    stackBestEl.textContent = `${Math.max(stackState.best, count)} 层`;
    stackMissStatEl.classList.toggle("is-danger", misses >= STACK_MAX_MISSES - 3);
    updateGodBadge();
    refreshDropButton();
  }

  function setupCanvasMetrics() {
    const width = stackCanvas.clientWidth;
    const height = stackCanvas.clientHeight;

    if (width < 10 || height < 10) {
      stackMetrics.ready = false;
      return false;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    stackMetrics.width = width;
    stackMetrics.height = height;
    stackMetrics.dpr = dpr;
    stackMetrics.layerH = clamp(height * 0.027, 8.6, 15);
    stackMetrics.brickW = NORMAL_BRICK_WIDTH;
    stackMetrics.platformW = 0.46;
    const normalBounds = getLaneBounds(NORMAL_BRICK_WIDTH);
    stackMetrics.laneMin = normalBounds.min;
    stackMetrics.laneMax = normalBounds.max;
    stackMetrics.groundY = height * 0.925;
    stackMetrics.focusY = height * 0.53;
    stackMetrics.railY = height * 0.085;
    stackMetrics.movingY = height * 0.115;

    stackCanvas.width = Math.max(1, Math.round(width * dpr));
    stackCanvas.height = Math.max(1, Math.round(height * dpr));
    stackCanvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stackMetrics.ready = true;

    stackState.cameraY = computeCameraTarget();
    return true;
  }

  function resizeStackCanvas() {
    if (!setupCanvasMetrics()) return;
    drawStack();
  }

  function ensureStackGame() {
    if (GameHub.state.route !== "stack") return;

    stackInitialized = true;
    resizeStackCanvas();

    if (!stackMetrics.ready) {
      window.requestAnimationFrame(() => {
        if (GameHub.state.route === "stack") ensureStackGame();
      });
      return;
    }

    if (!stackGameStarted) {
      stackGameStarted = true;
      resetStackGame();
    } else {
      refreshDropButton();
    }

    if (!stackLoopStarted) {
      stackLoopStarted = true;
      window.requestAnimationFrame(stackFrame);
    }
  }

  function computeCameraTarget() {
    if (!stackMetrics.ready) return 0;
    const towerTop = stackMetrics.groundY - stackState.bricks.length * stackMetrics.layerH;
    return Math.max(0, stackMetrics.focusY - towerTop);
  }

  function getStackTopY() {
    return stackMetrics.groundY + stackState.cameraY - stackState.bricks.length * stackMetrics.layerH;
  }

  function getLayerTopY(index) {
    return stackMetrics.groundY + stackState.cameraY - (index + 1) * stackMetrics.layerH;
  }

  function makeBrickColor(index) {
    const hue = (18 + index * 137.508) % 360;
    const saturation = 40 + (index % 4) * 5;
    const lightness = 49 + (index % 3) * 4;

    return {
      base: `hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`,
      light: `hsl(${hue.toFixed(1)} ${Math.min(70, saturation + 8)}% ${Math.min(72, lightness + 11)}%)`,
      dark: `hsl(${hue.toFixed(1)} ${Math.max(32, saturation - 4)}% ${Math.max(27, lightness - 16)}%)`
    };
  }

  function updateGodBadge() {
    godBadgeEl.hidden = !stackState.godMode;
  }

  function setGodMode(active) {
    stackState.godMode = Boolean(active);
    updateGodBadge();

    if (stackState.moving) {
      const width = stackState.godMode ? GOD_BRICK_WIDTH : NORMAL_BRICK_WIDTH;
      const bounds = getLaneBounds(width);
      stackState.moving.width = width;
      stackState.moving.laneMin = bounds.min;
      stackState.moving.laneMax = bounds.max;
      stackState.moving.x = clamp(stackState.moving.x, bounds.min, bounds.max);
    }

    announceStack(stackState.godMode ? "上帝模式开启" : "上帝模式关闭");
  }

  function toggleGodMode() {
    setGodMode(!stackState.godMode);
  }

  function addFloatText(text, x, y, color, scale = 1) {
    stackState.floatTexts.push({
      text, x, y, color, scale,
      life: 1.5, maxLife: 1.5
    });
  }

  function spawnMovingBrick() {
    if (!stackMetrics.ready || stackState.phase === "won" || stackState.phase === "lost") return;

    stackState.attempt += 1;
    const startFromLeft = stackState.attempt % 2 === 1;
    
    // 核心改动：掉下来的砖块宽度，等于最上面那块砖的宽度
    const topBrick = stackState.bricks[stackState.bricks.length - 1];
    let baseWidth = topBrick ? topBrick.width : NORMAL_BRICK_WIDTH;
    if (stackState.godMode) baseWidth = GOD_BRICK_WIDTH;
    
    // 宽度最低保底 0.08，不然太细了没法玩
    const brickWidth = Math.max(0.08, baseWidth);
    const bounds = getLaneBounds(brickWidth);

    stackState.moving = {
      x: startFromLeft ? bounds.min : bounds.max,
      width: brickWidth,
      laneMin: bounds.min,
      laneMax: bounds.max,
      colorIndex: stackState.attempt - 1,
      color: makeBrickColor(stackState.attempt - 1)
    };
    stackState.direction = startFromLeft ? 1 : -1;
    stackState.phase = "moving";
    updateStackHud();
    refreshDropButton();
  }

  function dropBrick() {
    if (GameHub.state.route !== "stack" || GameHub.state.tutorialOpen) return;
    if (stackState.phase !== "moving" || !stackState.moving || !stackMetrics.ready) return;

    const moving = stackState.moving;
    stackState.falling = {
      x: moving.x,
      width: moving.width,
      y: stackMetrics.movingY,
      vy: Math.max(55, stackMetrics.height * 0.08),
      vx: 0,
      angle: 0,
      spin: (Math.random() - 0.5) * 0.8,
      color: moving.color,
      colorIndex: moving.colorIndex,
      contactResolved: false,
      missed: false
    };
    stackState.moving = null;
    stackState.phase = "falling";
    updateStackHud();
    refreshDropButton();
    announceStack("砖块开始下落");
  }

  function getStackSupport() {
    const topBrick = stackState.bricks[stackState.bricks.length - 1];

    if (!topBrick) {
      return { center: 0.5, half: stackMetrics.platformW / 2 };
    }

    return { center: topBrick.x, half: topBrick.width / 2 };
  }

  function updateFalling(dt) {
    const falling = stackState.falling;
    if (!falling) return;

    const gravity = Math.max(1750, stackMetrics.height * 3.9);
    falling.vy += gravity * dt;
    falling.y += falling.vy * dt;
    falling.angle += falling.spin * dt;

    if (!falling.contactResolved) {
      const topY = getStackTopY();

      if (falling.y + stackMetrics.layerH >= topY) {
        const support = getStackSupport();
        
        // 计算重叠区域
        const overlapLeft = Math.max(support.center - support.half, falling.x - falling.width / 2);
        const overlapRight = Math.min(support.center + support.half, falling.x + falling.width / 2);
        const overlapWidth = overlapRight - overlapLeft;

        // 只要有 0.04 以上的重叠，就算落地成功
        if (overlapWidth >= 0.04) {
          falling.y = topY - stackMetrics.layerH;
          landBrick(falling, overlapLeft, overlapRight, support);
          return;
        }

        // 完全掉出去，算失误
        falling.contactResolved = true;
        falling.missed = true;
        stackState.misses += 1;
        updateStackHud();

        const side = falling.x < support.center ? -1 : 1;
        falling.vx = side * (0.24 + Math.random() * 0.12);
        falling.spin = side * (2.5 + Math.random() * 2);
        stackState.shake = Math.min(7, 2 + falling.vy * 0.002);
        spawnDust(falling.x * stackMetrics.width, topY, 8, "rgba(228, 205, 167, 0.55)");
        announceStack(`砖块落空，已经失误 ${stackState.misses} 次`);

        if (stackState.misses >= STACK_MAX_MISSES) {
          announceStack("失误达到上限，挑战即将结束");
        }
      }
    }

    if (falling.missed) {
      falling.x += falling.vx * dt;
      falling.vy += gravity * 0.18 * dt;
      falling.y += falling.vy * dt;
      falling.angle += falling.spin * dt;

      if (falling.y > stackMetrics.height + stackMetrics.layerH * 3) {
        stackState.falling = null;

        if (stackState.misses >= STACK_MAX_MISSES) {
          loseStack("misses");
        } else {
          stackState.phase = "settling";
          stackState.settleTimer = 0.18;
        }
      }
    }
  }

  function landBrick(falling, overlapLeft, overlapRight, support) {
    let finalWidth = overlapRight - overlapLeft;
    let finalX = (overlapLeft + overlapRight) / 2;
    let isPerfect = false;

    // 判定 Perfect (误差极小)
    const offset = Math.abs(falling.x - support.center);
    if (offset <= support.half * 0.15) {
      isPerfect = true;
      finalWidth = Math.min(0.6, falling.width + 0.04); // 完美奖励：加宽
      finalX = support.center;
      stackState.shake = Math.max(stackState.shake, 3);
      addFloatText("PERFECT!", finalX, getStackTopY() - 10, "#ffd700", 1.2);
    }

    // 判定过关 (每 10 层)
    const newCount = stackState.bricks.length + 1;
    if (newCount % 10 === 0) {
      finalWidth = Math.max(finalWidth, 0.22); // 阶段奖励：强制恢复到 22% 宽度
      addFloatText(`STAGE ${newCount / 10} CLEAR!`, 0.5, getStackTopY() - 30, "#00ffff", 1.5);
      stackState.shake = Math.max(stackState.shake, 6);
    }

    const brick = {
      x: clamp(finalX, 0.05, 0.95),
      width: finalWidth,
      colorIndex: falling.colorIndex,
      color: falling.color,
      landedAt: stackState.time
    };

    stackState.bricks.push(brick);
    stackState.falling = null;
    stackState.phase = "settling";
    stackState.settleTimer = 0.25;
    stackState.shake = Math.max(stackState.shake, Math.min(8.5, 1.8 + falling.vy * 0.0022));

    const contactY = getLayerTopY(stackState.bricks.length - 1);
    spawnDust(brick.x * stackMetrics.width, contactY + stackMetrics.layerH, 12, "rgba(238, 218, 177, 0.58)");

    if (GameHub.audio) {
      GameHub.audio.land(isPerfect ? 1 : clamp(falling.vy / 760, 0.35, 1));
    }

    if (newCount > stackState.best) {
      stackState.best = newCount;
      writeStoredInt(STACK_BEST_KEY, stackState.best);
      GameHub.bus.emit("stats:change");
    }

    updateStackHud();

    if (!isTowerStable()) {
      collapseTower();
      return;
    }

    if (newCount >= STACK_TARGET) {
      winStack();
      return;
    }

    announceStack(`第 ${newCount} 层落稳`);
  }

  function isTowerStable() {
    if (stackState.bricks.length < 2) return true;

    const totalWeight = stackState.bricks.reduce((sum, brick) => sum + brick.width, 0);
    const centerOfMass = stackState.bricks.reduce((sum, brick) => sum + brick.x * brick.width, 0) / totalWeight;
    const supportCenter = stackState.bricks[0].x;
    // 放宽倒塌判定，因为你切边已经是一种惩罚了
    const safeHalf = stackState.bricks[0].width * 0.85; 

    return Math.abs(centerOfMass - supportCenter) <= safeHalf;
  }

  function spawnDust(x, y, count, color) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * (1 + Math.random());
      const speed = 24 + Math.random() * 70;
      stackState.particles.push({
        kind: "dust",
        x,
        y,
        vx: Math.cos(angle) * speed * 0.7,
        vy: Math.sin(angle) * speed - 15,
        life: 0.34 + Math.random() * 0.28,
        maxLife: 0.62,
        size: 1.5 + Math.random() * 2.4,
        color
      });
    }
  }

  function spawnConfetti() {
    const colors = ["#e7c37c", "#e08d61", "#73b396", "#d4a83d", "#f1e1b4", "#d05f5c", "#7da6c2"];

    for (let index = 0; index < 90; index += 1) {
      stackState.particles.push({
        kind: "confetti",
        x: Math.random() * stackMetrics.width,
        y: -18 - Math.random() * stackMetrics.height * 0.38,
        vx: (Math.random() - 0.5) * 70,
        vy: 60 + Math.random() * 130,
        life: 1.6 + Math.random() * 1.7,
        maxLife: 3.3,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 8
      });
    }
  }

  function updateParticles(dt) {
    for (const particle of stackState.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;

      if (particle.kind === "confetti") {
        particle.vy += 92 * dt;
        particle.vx *= 0.992;
        particle.angle += particle.spin * dt;
      } else {
        particle.vy += 120 * dt;
        particle.vx *= 0.96;
      }
    }

    stackState.particles = stackState.particles.filter((particle) => particle.life > 0);
    
    // 更新飘字
    stackState.floatTexts = stackState.floatTexts.filter((ft) => {
      ft.life -= dt;
      ft.y -= dt * 30;
      return ft.life > 0;
    });
  }

  function updateCollapse(dt) {
    const gravity = Math.max(1250, stackMetrics.height * 3.1);
    stackState.collapseElapsed += dt;

    for (const piece of stackState.collapsePieces) {
      piece.vy += gravity * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.angle += piece.spin * dt;
    }

    if (Math.random() < dt * 13) {
      const piece = stackState.collapsePieces[Math.floor(Math.random() * stackState.collapsePieces.length)];
      if (piece) {
        spawnDust(piece.x, piece.y + piece.h * 0.5, 2, "rgba(224, 202, 165, 0.35)");
      }
    }
  }

  function collapseTower() {
    stackState.phase = "collapsing";
    stackState.collapseElapsed = 0;
    stackState.moving = null;
    stackState.falling = null;
    stackState.shake = 16;

    const centerOfMass = stackState.bricks.reduce((sum, brick) => sum + brick.x, 0) / stackState.bricks.length;
    const side = centerOfMass >= 0.5 ? 1 : -1;

    stackState.collapsePieces = stackState.bricks.map((brick, index) => ({
      x: brick.x * stackMetrics.width,
      y: getLayerTopY(index),
      w: brick.width * stackMetrics.width,
      h: stackMetrics.layerH,
      vx: side * (32 + Math.random() * 105) + (Math.random() - 0.5) * 42,
      vy: -48 - Math.random() * 150,
      angle: 0,
      spin: side * (0.7 + Math.random() * 2.2),
      color: brick.color
    }));

    for (let index = 0; index < 18; index += 1) {
      spawnDust(
        (0.5 + (Math.random() - 0.5) * 0.4) * stackMetrics.width,
        getStackTopY() + stackMetrics.layerH * (Math.random() * 8),
        1,
        "rgba(225, 199, 158, 0.42)"
      );
    }

    writeStoredInt(STACK_BEST_KEY, stackState.best);
    refreshDropButton();
    announceStack("高塔失去平衡，坍塌了");

    window.clearTimeout(stackState.resultTimer);
    stackState.resultTimer = window.setTimeout(() => {
      loseStack("collapse");
    }, 1180);
  }

  function winStack() {
    stackState.phase = "won";
    stackState.moving = null;
    stackState.falling = null;
    stackState.wins += 1;
    stackState.best = Math.max(stackState.best, STACK_TARGET);

    writeStoredInt(STACK_BEST_KEY, stackState.best);
    writeStoredInt(STACK_WINS_KEY, stackState.wins);
    GameHub.bus.emit("stats:change");
    spawnConfetti();
    updateStackHud();
    refreshDropButton();
    announceStack("恭喜，你叠满了 60 层");

    window.clearTimeout(stackState.resultTimer);
    stackState.resultTimer = window.setTimeout(() => {
      showStackResult("win");
    }, 780);
  }

  function loseStack(reason) {
    stackState.phase = "lost";
    stackState.moving = null;
    stackState.falling = null;
    refreshDropButton();
    showStackResult("lose", reason);
  }

  function showStackResult(mode, reason = "") {
    if (mode === "win") {
      stackOverlay.dataset.mode = "win";
      stackOverlayMark.textContent = "✦";
      stackOverlayKicker.textContent = "60 floors · stable";
      stackOverlayTitle.textContent = "高塔完成";
      stackOverlayText.textContent = `你稳稳叠满了 60 层，失误 ${stackState.misses} 次。每块砖都留在了自己的位置。`;
      stackOverlayPrimary.textContent = "再叠一次";
    } else {
      stackOverlay.dataset.mode = "lose";
      stackOverlayMark.textContent = "◇";
      stackOverlayKicker.textContent = reason === "collapse" ? "Tower down" : "Out of chances";
      stackOverlayTitle.textContent = reason === "collapse" ? "塔倒了" : "失误达到上限";
      stackOverlayText.textContent = reason === "collapse"
        ? `这座塔停在了 ${stackState.bricks.length} 层。下次记得让重心留在底座上方。`
        : `已经落空 ${stackState.misses} 块砖，本轮挑战结束。慢一点，稳一点。`;
      stackOverlayPrimary.textContent = "再试一次";
    }

    stackOverlaySecondary.textContent = "返回大厅";
    stackOverlay.classList.add("is-visible");
    stackOverlay.setAttribute("aria-hidden", "false");
  }

  function hideStackOverlay() {
    stackOverlay.classList.remove("is-visible");
    stackOverlay.setAttribute("aria-hidden", "true");
  }

  function resetStackGame() {
    window.clearTimeout(stackState.resultTimer);
    stackState.resultTimer = null;
    stackState.phase = "idle";
    stackState.bricks = [];
    stackState.moving = null;
    stackState.falling = null;
    stackState.particles = [];
    stackState.floatTexts = [];
    stackState.collapsePieces = [];
    stackState.attempt = 0;
    stackState.misses = 0;
    stackState.direction = 1;
    stackState.cameraY = 0;
    stackState.shake = 0;
    stackState.settleTimer = 0;
    stackState.collapseElapsed = 0;
    stackState.time = 0;

    hideStackOverlay();
    updateStackHud();
    announceStack("新的一局开始，按空格或点击落下按钮");
    spawnMovingBrick();
    refreshDropButton();

    if (stackMetrics.ready) {
      drawStack();
    }
  }

  function stackFrame(timestamp) {
    if (!stackMetrics.lastFrame) stackMetrics.lastFrame = timestamp;
    const dt = Math.min(0.034, Math.max(0, (timestamp - stackMetrics.lastFrame) / 1000));
    stackMetrics.lastFrame = timestamp;

    if (GameHub.state.route === "stack" && stackInitialized && stackMetrics.ready) {
      if (!GameHub.state.tutorialOpen && !document.hidden) {
        updateStack(dt);
      }
      drawStack();
    }

    window.requestAnimationFrame(stackFrame);
  }

  function updateStack(dt) {
    stackState.time += dt;
    stackState.shake = Math.max(0, stackState.shake - dt * 34);
    updateParticles(dt);

    if (stackState.phase === "collapsing") {
      updateCollapse(dt);
      return;
    }

    if (stackState.phase === "won" || stackState.phase === "lost") {
      return;
    }

    if (stackState.phase === "moving" || stackState.phase === "settling") {
      const target = computeCameraTarget();
      stackState.cameraY += (target - stackState.cameraY) * Math.min(1, dt * 10);
      if (Math.abs(target - stackState.cameraY) < 0.04) stackState.cameraY = target;
    }

    if (stackState.phase === "moving") {
      const moving = stackState.moving;
      if (!moving) {
        spawnMovingBrick();
        return;
      }

      // 核心改动：每 10 层一个阶段，每过一关，速度乘以 1.35 倍！
      const currentStage = Math.floor(stackState.bricks.length / 10);
      const speedMultiplier = 1 + currentStage * 0.35;
      const baseSpeed = 0.235 + Math.min(0.1, stackState.bricks.length * 0.002);
      const speed = baseSpeed * speedMultiplier;

      moving.x += stackState.direction * speed * dt;

      if (moving.x >= moving.laneMax) {
        moving.x = moving.laneMax;
        stackState.direction = -1;
      } else if (moving.x <= moving.laneMin) {
        moving.x = moving.laneMin;
        stackState.direction = 1;
      }
      return;
    }

    if (stackState.phase === "falling") {
      updateFalling(dt);
      return;
    }

    if (stackState.phase === "settling") {
      stackState.settleTimer -= dt;
      if (stackState.settleTimer <= 0) {
        spawnMovingBrick();
      }
    }
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawBrickRect(x, y, width, height, color, options = {}) {
    if (height < 0.8 || width < 1) return;

    const context = stackCanvasCtx;
    const alpha = options.alpha === undefined ? 1 : options.alpha;
    const radius = Math.min(3, height * 0.32, width * 0.08);
    const gradient = context.createLinearGradient(0, y, 0, y + height);
    gradient.addColorStop(0, color.light);
    gradient.addColorStop(0.52, color.base);
    gradient.addColorStop(1, color.dark);

    context.save();
    context.globalAlpha = alpha;
    if (options.glow) {
      context.shadowColor = color.base;
      context.shadowBlur = options.glow;
    }

    roundedRectPath(context, x, y, width, height, radius);
    context.fillStyle = gradient;
    context.fill();
    context.shadowBlur = 0;

    context.strokeStyle = "rgba(255, 255, 255, 0.13)";
    context.lineWidth = 0.7;
    context.stroke();

    context.fillStyle = "rgba(255, 255, 255, 0.17)";
    context.fillRect(x + radius, y + 0.65, Math.max(0, width - radius * 2), 0.75);
    context.restore();
  }

  function drawStackGuide() {
    if (!stackState.moving && !stackState.falling) return;

    const context = stackCanvasCtx;
    const activeBrick = stackState.falling || stackState.moving;
    const x = activeBrick.x * stackMetrics.width;
    const top = getStackTopY();
    const startY = stackMetrics.movingY + stackMetrics.layerH + 10;

    if (top <= startY) return;

    context.save();
    context.setLineDash([3, 7]);
    context.lineWidth = 1;
    context.strokeStyle = "rgba(231, 195, 124, 0.16)";
    context.beginPath();
    context.moveTo(x, startY);
    context.lineTo(x, top);
    context.stroke();

    const brickWidth = activeBrick.width * stackMetrics.width;
    context.setLineDash([3, 5]);
    context.strokeStyle = "rgba(242, 217, 169, 0.22)";
    roundedRectPath(
      context,
      x - brickWidth / 2,
      top - stackMetrics.layerH,
      brickWidth,
      stackMetrics.layerH,
      2.5
    );
    context.stroke();

    context.setLineDash([]);
    context.fillStyle = "rgba(245, 221, 172, 0.55)";
    context.beginPath();
    context.moveTo(x - 3, top - 5);
    context.lineTo(x + 3, top - 5);
    context.lineTo(x, top - 1);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawBackdrop() {
    const context = stackCanvasCtx;
    const { width, height, railY, groundY, layerH, platformW } = stackMetrics;
    const cameraY = stackState.cameraY;
    const isBlackTheme = document.documentElement.dataset.theme === "black";

    const glow = context.createRadialGradient(width * 0.5, height * 0.15, 0, width * 0.5, height * 0.15, width * 0.68);
    glow.addColorStop(0, isBlackTheme ? "rgba(255, 255, 255, 0.035)" : "rgba(64, 116, 96, 0.12)");
    glow.addColorStop(0.55, isBlackTheme ? "rgba(255, 255, 255, 0.012)" : "rgba(33, 67, 55, 0.035)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.save();
    context.strokeStyle = "rgba(237, 213, 170, 0.055)";
    context.lineWidth = 1;
    for (let row = 1; row <= 4; row += 1) {
      const y = (height / 5) * row;
      context.beginPath();
      context.moveTo(width * 0.07, y);
      context.lineTo(width * 0.93, y);
      context.stroke();
    }
    context.restore();

    context.strokeStyle = "rgba(238, 211, 162, 0.17)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(width * 0.055, railY);
    context.lineTo(width * 0.945, railY);
    context.stroke();

    context.fillStyle = "rgba(238, 211, 162, 0.35)";
    [0.055, 0.945].forEach((position) => {
      context.beginPath();
      context.arc(width * position, railY, 2, 0, Math.PI * 2);
      context.fill();
    });

    context.fillStyle = "rgba(236, 216, 178, 0.25)";
    context.font = `600 ${Math.max(7, Math.min(9, width * 0.016))}px "Segoe UI", sans-serif`;
    context.textAlign = "left";
    context.fillText("DROP", width * 0.055, railY - 9);

    const baseTop = groundY + cameraY;
    if (baseTop < height + 30) {
      const baseWidth = platformW * width;
      const baseLeft = width * 0.5 - baseWidth / 2;
      const baseGradient = context.createLinearGradient(0, baseTop, 0, baseTop + 10);
      baseGradient.addColorStop(0, "rgba(244, 222, 177, 0.72)");
      baseGradient.addColorStop(0.35, "rgba(192, 151, 82, 0.62)");
      baseGradient.addColorStop(1, "rgba(98, 74, 38, 0.32)");

      context.save();
      context.shadowColor = "rgba(229, 189, 112, 0.28)";
      context.shadowBlur = 18;
      roundedRectPath(context, baseLeft, baseTop, baseWidth, 8, 3);
      context.fillStyle = baseGradient;
      context.fill();
      context.restore();

      context.fillStyle = "rgba(255, 243, 209, 0.16)";
      context.fillRect(baseLeft + 10, baseTop + 1, baseWidth - 20, 0.8);

      context.fillStyle = "rgba(238, 218, 180, 0.22)";
      context.font = `600 ${Math.max(7, Math.min(9, width * 0.015))}px "Segoe UI", sans-serif`;
      context.textAlign = "center";
      context.fillText("BASE", width * 0.5, baseTop + 24);
    }

    context.save();
    context.textAlign = "right";
    context.font = `600 ${Math.max(7, Math.min(9, width * 0.015))}px "Segoe UI", sans-serif`;
    for (let level = 10; level <= STACK_TARGET; level += 10) {
      const markerY = groundY + cameraY - level * layerH;
      if (markerY < railY + 14 || markerY > height - 7) continue;
      context.strokeStyle = "rgba(230, 203, 150, 0.13)";
      context.beginPath();
      context.moveTo(width * 0.93, markerY);
      context.lineTo(width * 0.955, markerY);
      context.stroke();
      context.fillStyle = "rgba(230, 203, 150, 0.28)";
      context.fillText(String(level), width * 0.918, markerY + 3);
    }
    context.restore();
  }

  function drawStack() {
    if (!stackMetrics.ready) return;

    const context = stackCanvasCtx;
    const { width, height, dpr, layerH, movingY } = stackMetrics;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    context.save();
    if (stackState.shake > 0.2) {
      const shakeX = (Math.random() - 0.5) * stackState.shake;
      const shakeY = (Math.random() - 0.5) * stackState.shake * 0.55;
      context.translate(shakeX, shakeY);
    }

    drawBackdrop();
    drawStackGuide();

    if (stackState.phase !== "collapsing") {
      for (let index = 0; index < stackState.bricks.length; index += 1) {
        const brick = stackState.bricks[index];
        const stackedWidth = brick.width * width;
        const layerTop = getLayerTopY(index);
        if (layerTop > height + layerH || layerTop + layerH < 0) continue;

        const age = stackState.time - brick.landedAt;
        const bounce = age >= 0 && age < 0.22
          ? Math.sin((age / 0.22) * Math.PI) * 1.8
          : 0;
        const gap = Math.min(1.2, layerH * 0.09);
        drawBrickRect(
          brick.x * width - stackedWidth / 2,
          layerTop + gap - bounce,
          stackedWidth,
          Math.max(1, layerH - gap * 2),
          brick.color
        );

        if ((index + 1) % 10 === 0) {
          context.fillStyle = "rgba(255, 235, 186, 0.62)";
          context.fillRect(brick.x * width - stackedWidth / 2 + 3, layerTop + gap, 10, 1);
        }
      }
    } else {
      for (const piece of stackState.collapsePieces) {
        context.save();
        context.translate(piece.x, piece.y + piece.h / 2);
        context.rotate(piece.angle);
        drawBrickRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h, piece.color);
        context.restore();
      }
    }

    if (stackState.moving) {
      const moving = stackState.moving;
      const x = moving.x * width;
      const movingWidth = moving.width * width;
      const bob = Math.sin(stackState.time * 6.2) * 0.8;
      const color = moving.color;

      context.save();
      context.strokeStyle = "rgba(242, 215, 162, 0.2)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, stackMetrics.railY);
      context.lineTo(x, movingY + bob - 2);
      context.stroke();
      context.restore();

      drawBrickRect(x - movingWidth / 2, movingY + bob, movingWidth, layerH, color, { glow: 9 });

      context.save();
      context.fillStyle = "rgba(255, 242, 207, 0.58)";
      context.beginPath();
      context.arc(x, movingY + bob + layerH + 7, 1.8, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    if (stackState.falling) {
      const falling = stackState.falling;
      const centerX = falling.x * width;
      const centerY = falling.y + layerH / 2;
      const fallingWidth = falling.width * width;

      context.save();
      context.translate(centerX, centerY);
      context.rotate(falling.angle);
      drawBrickRect(-fallingWidth / 2, -layerH / 2, fallingWidth, layerH, falling.color, { glow: 10 });
      context.restore();
    }

    for (const particle of stackState.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = particle.color;

      if (particle.kind === "confetti") {
        context.translate(particle.x, particle.y);
        context.rotate(particle.angle);
        context.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
      } else {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    // 新增：绘制飘字特效
    for (const ft of stackState.floatTexts) {
      const alpha = clamp(ft.life / ft.maxLife, 0, 1);
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = ft.color;
      context.font = `bold ${Math.max(14, Math.min(24, stackMetrics.width * 0.06)) * ft.scale}px "Segoe UI", sans-serif`;
      context.textAlign = "center";
      context.shadowColor = ft.color;
      context.shadowBlur = 10;
      context.fillText(ft.text, ft.x * stackMetrics.width, ft.y);
      context.restore();
    }

    context.restore();
  }

  stackDropBtn.addEventListener("click", dropBrick);
  stackResetBtn.addEventListener("click", resetStackGame);

  stackOverlayPrimary.addEventListener("click", () => {
    resetStackGame();
  });

  stackOverlaySecondary.addEventListener("click", () => {
    resetStackGame();
    window.location.hash = "#home";
  });

  window.addEventListener("keydown", (event) => {
    if (GameHub.state.route !== "stack" || GameHub.state.tutorialOpen) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key.toLowerCase();

    if (key === "c" || key === "h") {
      heldKeys.add(key);
      if (heldKeys.has("c") && heldKeys.has("h") && !event.repeat) {
        event.preventDefault();
        toggleGodMode();
      }
      return;
    }

    if (event.code === "Space" || event.key === " ") {
      const targetButton = event.target && event.target.closest ? event.target.closest("button") : null;
      if (targetButton && targetButton !== stackDropBtn) {
        return;
      }
      event.preventDefault();
      if (!event.repeat) dropBrick();
    }
  });

  window.addEventListener("keyup", (event) => {
    heldKeys.delete(event.key.toLowerCase());
  });

  window.addEventListener("blur", () => {
    heldKeys.clear();
  });

  window.addEventListener("resize", () => {
    if (GameHub.state.route === "stack") resizeStackCanvas();
  });

  if ("ResizeObserver" in window) {
    const stackResizeObserver = new ResizeObserver(() => {
      if (GameHub.state.route !== "stack" || !stackInitialized) return;
      if (!stackGameStarted) {
        ensureStackGame();
      } else {
        resizeStackCanvas();
      }
    });
    stackResizeObserver.observe(stackBoardWrap);
  }

  document.addEventListener("gamehub:route", (event) => {
    if (event.detail.route === "stack") {
      ensureStackGame();
    } else {
      heldKeys.clear();
    }
  });

  document.addEventListener("visibilitychange", () => {
    stackMetrics.lastFrame = 0;
  });

  window.GameHub.games = window.GameHub.games || {};
  window.GameHub.games.stack = {
    init: ensureStackGame,
    reset: resetStackGame,
    state: () => ({
      phase: stackState.phase,
      count: stackState.bricks.length,
      misses: stackState.misses,
      godMode: stackState.godMode
    })
  };
})();