/* Fullscreen controls for the application shell. */
(() => {
  "use strict";

  const GameHub = window.GameHub;
  const button = document.getElementById("fullscreenToggle");
  const label = document.getElementById("fullscreenLabel");

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function update() {
    const active = Boolean(fullscreenElement());
    if (button) {
      button.dataset.fullscreen = String(active);
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "退出全屏" : "进入全屏");
      button.setAttribute("title", active ? "退出全屏 (F)" : "进入全屏 (F)");
    }
    if (label) {
      label.textContent = active ? "退出" : "全屏";
    }
  }

  async function toggle() {
    try {
      if (fullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else {
        const request = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
        if (request) await request.call(document.documentElement);
      }
    } catch (error) {
      // The browser can reject fullscreen requests; keep the app running.
    }
  }

  if (button) {
    button.addEventListener("click", toggle);
  }

  document.addEventListener("fullscreenchange", update);
  document.addEventListener("webkitfullscreenchange", update);

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (GameHub.state.tutorialOpen || document.body.classList.contains("share-open")) return;
    if (event.key.toLowerCase() !== "f") return;
    event.preventDefault();
    toggle();
  });

  update();

  GameHub.fullscreen = {
    toggle,
    isActive: () => Boolean(fullscreenElement())
  };
})();
