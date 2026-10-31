/* Share panel and one-file edition helper. */
(() => {
  "use strict";

  const GameHub = window.GameHub;
  const layer = document.getElementById("shareLayer");
  const card = document.getElementById("shareCard");
  const closeButton = document.getElementById("shareClose");
  const downloadLink = document.getElementById("shareDownload");
  const copyButton = document.getElementById("shareCopy");
  const status = document.getElementById("shareStatus");
  const desc = document.getElementById("shareDesc");
  const pathLine = document.querySelector(".share-path");
  const standalone = Boolean(window.__BLOCK_PLAYGROUND_STANDALONE__);
  let lastFocusedElement = null;
  let statusTimer = null;

  const shareText = [
    "我在玩「方块游乐场」：叠砖块、2048、扫雷三款小游戏。",
    "带音效、纯黑主题、新手教程和隐藏玩法，双击单文件 HTML 就能直接玩。",
    "分享文件：方块游乐场-分享版.html"
  ].join("\n");

  function setStatus(message, tone = "normal") {
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.textContent = standalone
        ? "你正在使用单文件分享版，把这个 HTML 文件直接发给朋友即可。"
        : "分享版包含全部游戏，不需要安装，也不会联网加载资源。";
      status.dataset.tone = "normal";
    }, 2600);
  }

  function open() {
    if (!layer || GameHub.state.tutorialOpen) return;

    lastFocusedElement = document.activeElement;
    layer.classList.add("is-open");
    layer.setAttribute("aria-hidden", "false");
    document.body.classList.add("share-open");

    window.setTimeout(() => {
      if (closeButton) closeButton.focus({ preventScroll: true });
    }, 80);
  }

  function close() {
    if (!layer || !layer.classList.contains("is-open")) return;

    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("share-open");

    const focusTarget = lastFocusedElement;
    lastFocusedElement = null;
    window.setTimeout(() => {
      if (focusTarget && focusTarget.isConnected) {
        focusTarget.focus({ preventScroll: true });
      }
    }, 20);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall back to a temporary textarea below.
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }
    textarea.remove();

    if (!copied) {
      window.prompt("复制下面的分享文案：", text);
    }
    return copied;
  }

  document.querySelectorAll("[data-open-share]").forEach((trigger) => {
    trigger.addEventListener("click", open);
  });

  if (closeButton) closeButton.addEventListener("click", close);

  if (layer) {
    layer.addEventListener("pointerdown", (event) => {
      if (event.target === layer) close();
    });
  }

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const copied = await copyText(shareText);
      setStatus(copied ? "分享文案已复制，可以粘贴到聊天窗口了。" : "分享文案已准备好，请手动复制。", copied ? "success" : "normal");
    });
  }

  if (standalone) {
    if (downloadLink) downloadLink.hidden = true;
    if (pathLine) pathLine.hidden = true;
    if (desc) {
      desc.textContent = "你正在打开单文件分享版。把这一个 HTML 文件发给朋友，对方双击就能直接玩。";
    }
    if (status) {
      status.textContent = "你正在使用单文件分享版，把这个 HTML 文件直接发给朋友即可。";
    }
  }

  document.addEventListener("keydown", (event) => {
    if (!layer || !layer.classList.contains("is-open")) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = [...card.querySelectorAll("button:not([disabled]), a[href]:not([hidden])")];
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
  });

  GameHub.share = {
    open,
    close,
    isOpen: () => Boolean(layer && layer.classList.contains("is-open"))
  };
})();
