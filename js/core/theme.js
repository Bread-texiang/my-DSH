/* Global green / pure-black theme controller. */
(() => {
  "use strict";

  const GameHub = window.GameHub;
  const key = GameHub.keys.theme;
  const button = document.getElementById("themeToggle");
  const label = document.getElementById("themeLabel");

  function apply(theme, persist = false) {
    const isBlack = theme === "black";
    document.documentElement.dataset.theme = isBlack ? "black" : "green";

    if (button) {
      button.setAttribute("aria-pressed", String(isBlack));
      button.setAttribute("aria-label", isBlack ? "切换到深绿色主题" : "切换到纯黑主题");
      button.setAttribute("title", isBlack ? "切换到深绿色主题" : "切换到纯黑主题");
    }

    if (label) {
      label.textContent = isBlack ? "深绿" : "纯黑";
    }

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute("content", isBlack ? "#000000" : "#06100e");
    }

    if (persist) {
      try {
        localStorage.setItem(key, isBlack ? "black" : "green");
      } catch (error) {
        // Persistence is optional.
      }
    }

    GameHub.bus.emit("theme:change", { theme: isBlack ? "black" : "green" });
  }

  function initialTheme() {
    try {
      return localStorage.getItem(key) === "black" ? "black" : "green";
    } catch (error) {
      return document.documentElement.dataset.theme === "black" ? "black" : "green";
    }
  }

  if (button) {
    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "black" ? "green" : "black";
      apply(next, true);
    });
  }

  apply(initialTheme());

  GameHub.theme = {
    apply,
    current: () => (document.documentElement.dataset.theme === "black" ? "black" : "green")
  };
})();
