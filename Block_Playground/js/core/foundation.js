/* Shared foundation: state, storage, events, utility helpers. */
(() => {
  "use strict";

  const GameHub = window.GameHub = window.GameHub || {};

  GameHub.state = {
    route: "home",
    tutorialOpen: false
  };

  GameHub.keys = {
    best2048: "golden2048.best.v1",
    stackBest: "goldenstack.best.v1",
    stackWins: "goldenstack.wins.v1",
    minesBest: "goldenmine.best.v1",
    theme: "gameroom.theme.v1",
    soundMuted: "gameroom.sound.muted.v1",
    tutorials: {
      2048: "gameroom.tutorial.2048.v1",
      stack: "gameroom.tutorial.stack.v1",
      minesweeper: "gameroom.tutorial.minesweeper.v1"
    }
  };

  GameHub.utils = {
    clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    },

    readInt(key, fallback = 0) {
      try {
        const value = Number.parseInt(localStorage.getItem(key) || "", 10);
        return Number.isFinite(value) && value >= 0 ? value : fallback;
      } catch (error) {
        return fallback;
      }
    },

    writeInt(key, value) {
      try {
        localStorage.setItem(key, String(value));
      } catch (error) {
        // Persistence is optional.
      }
    },

    readFlag(key) {
      try {
        return localStorage.getItem(key) === "1";
      } catch (error) {
        return false;
      }
    },

    writeFlag(key, value) {
      try {
        if (value) localStorage.setItem(key, "1");
        else localStorage.removeItem(key);
      } catch (error) {
        // Persistence is optional.
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        // Persistence is optional.
      }
    },

    formatNumber(value) {
      return Number(value).toLocaleString("zh-CN");
    }
  };

  GameHub.bus = {
    on(name, handler) {
      document.addEventListener(`gamehub:${name}`, handler);
    },

    emit(name, detail = {}) {
      document.dispatchEvent(new CustomEvent(`gamehub:${name}`, { detail }));
    }
  };
})();
