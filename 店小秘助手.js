// ==UserScript==
// @name         DianXiaoMi Helper
// @namespace    https://github.com/yu-chenglong/GMScripts
// @version      1.0.2
// @description  DianXiaoMi Helper
// @author       Yu Chenglong
// @match        https://www.dianxiaomi.com/*
// @grant        GM_addStyle
// @grant        GM_log
// @updateURL    https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/店小秘助手.js
// @downloadURL  https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/店小秘助手.js
// ==/UserScript==

(function () {
  "use strict";

  // ==================== Config ====================
  // Only bind to lazy-loaded images.
  // Vue lazy-load components mark completed images with lazy="loaded".
  const IMG_SELECTOR = 'img[lazy="loaded"]';

  // ==================== Style ====================
  GM_addStyle(`
        #img-copy-tip {
            position: fixed;
            z-index: 99999999;
            padding: 8px 16px;
            background: #28a745;
            color: #fff;
            border-radius: 4px;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        #img-copy-tip.show {
            opacity: 1;
        }
    `);

  // ==================== Tip Box ====================
  // Create (or reuse) the toast element once and reuse it for every copy
  let tipBox = document.getElementById("img-copy-tip");
  if (!tipBox) {
    tipBox = document.createElement("div");
    tipBox.id = "img-copy-tip";
    tipBox.textContent = "✅ 复制成功！";
    document.body.appendChild(tipBox);
  }

  let tipTimer = null;
  const showTip = (x, y) => {
    tipBox.style.left = `${x + 10}px`;
    tipBox.style.top = `${y + 10}px`;
    tipBox.classList.add("show");
    // Reset the previous timer to avoid stacking on rapid clicks
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tipBox.classList.remove("show"), 1500);
  };

  // ==================== Helpers ====================
  // Strip trailing "_tn" (thumbnail suffix) so the original image URL is copied
  const removeTnSuffix = (url) => {
    if (typeof url !== "string" || !url) return url;
    return url.endsWith("_tn") ? url.slice(0, -3) : url;
  };

  // Copy text to clipboard; returns true on success
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      GM_log("[店小秘助手] 复制失败: " + err.message);
      return false;
    }
  };

  // ==================== Click Delegation ====================
  // Why event delegation instead of MutationObserver + per-node binding?
  //   1. Works for dynamically inserted images without observing DOM changes
  //   2. Single listener, no per-element memory overhead
  //   3. Simpler logic, fewer edge cases
  document.addEventListener(
    "click",
    async (e) => {
      // Only handle left-click
      if (e.button !== 0) return;

      // img cannot have children, so matches() is enough (no need for closest())
      if (!e.target.matches(IMG_SELECTOR)) return;

      // Suppress the page's default action (e.g. opening an image preview)
      e.preventDefault();
      e.stopPropagation();

      const img = e.target;
      let imgUrl =
        img.src || img.dataset.src || img.getAttribute("data-original") || "";
      if (!imgUrl) return;

      imgUrl = removeTnSuffix(imgUrl);
      const formatText = `![|150](${imgUrl})`;

      if (await copyToClipboard(formatText)) {
        showTip(e.clientX, e.clientY);
      }
    },
    true,
  ); // Capture phase so we run before page handlers
})();
