// ==UserScript==
// @name         Chat Helper - Quick Reply Templates
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Quick reply manager for Shopee/Lazada etc.
// @include      /^https:\/\/seller\.shopee\.[a-z]{2,}(?:\.[a-z]{2})?\/.*/
// @match        https://*.lazada-seller.cn/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      *
// @updateURL  https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/chat-helper.js
// @downloadURL https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/chat-helper.js
// ==/UserScript==

(function () {
  "use strict";

  // ==================== CONFIG ====================
  const STORAGE_URL_KEY = "ch_template_url";
  const STORAGE_CACHE_KEY = "ch_templates_cache";
  const STORAGE_CACHE_TIME_KEY = "ch_templates_cache_time";
  const AUTO_FILL = true;

  const SITES = [
    {
      name: "Shopee",
      match: /seller\.shopee\./,
      inputBox: "#inputField textarea",
      waitFor: "#inputField",
    },
    {
      name: "Lazada",
      match: /lazada-seller\.cn/,
      inputBox: 'textarea, [contenteditable="true"]',
      waitFor: "body",
    },
  ];

  let templates = [],
    currentCategory = "",
    modalVisible = false,
    currentModal = null,
    currentSite = null,
    templateUrl = "";

  // ==================== ICONS (SVG) ====================
  const ICONS = {
    refresh:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    fab: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM9 10h6M12 7v6"/></svg>',
    empty:
      '<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#8E8E9A" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    chevron:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>',
    settings:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  // ==================== URL MANAGEMENT ====================
  function getStoredUrl() {
    return GM_getValue(STORAGE_URL_KEY, null);
  }
  function saveUrl(url) {
    GM_setValue(STORAGE_URL_KEY, url);
  }

  function promptForUrl() {
    const url = prompt(
      "Chat Helper - Setup\n\nEnter your template JSON URL:\n(JSON array with category, title, content fields)",
    );
    if (url?.trim()) {
      templateUrl = url.trim();
      saveUrl(templateUrl);
      return true;
    }
    return false;
  }

  function initTemplateUrl() {
    const stored = getStoredUrl();
    if (stored) {
      templateUrl = stored;
      return true;
    }
    return promptForUrl();
  }

  // Open modal for URL editing
  let urlModalVisible = false;
  let currentUrlModal = null;

  function showUrlEditModal() {
    // Close existing modal if open
    if (currentUrlModal) currentUrlModal.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "ch-url-backdrop";

    const modal = document.createElement("div");
    modal.className = "ch-url-modal";

    modal.innerHTML = `
            <div class="ch-url-header">
                <span>Edit Template URL</span>
                <button class="ch-url-close">${ICONS.close}</button>
            </div>
            <div class="ch-url-body">
                <label>Template JSON URL:</label>
                <input type="text" class="ch-url-input" value="${escapeHtml(templateUrl || "")}" placeholder="https://.../templates.json">
                <div class="ch-url-hint">Supports Gist Raw, GitHub Raw, or any accessible JSON endpoint</div>
            </div>
            <div class="ch-url-footer">
                <button class="ch-url-cancel">Cancel</button>
                <button class="ch-url-save">Save & Reload</button>
            </div>
        `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    urlModalVisible = true;
    currentUrlModal = backdrop;

    // Focus input
    const input = modal.querySelector(".ch-url-input");
    input.focus();
    input.select();

    // Event handlers
    modal.querySelector(".ch-url-close").onclick = () => closeUrlModal();
    modal.querySelector(".ch-url-cancel").onclick = () => closeUrlModal();
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeUrlModal();
    };

    modal.querySelector(".ch-url-save").onclick = () => {
      const newUrl = input.value.trim();
      if (newUrl && newUrl !== templateUrl) {
        templateUrl = newUrl;
        saveUrl(templateUrl);
        GM_setValue(STORAGE_CACHE_KEY, null);
        closeUrlModal();
        showToast("URL updated, reloading...");
        setTimeout(() => location.reload(), 1500);
      } else if (!newUrl) {
        showToast("URL cannot be empty");
      } else {
        closeUrlModal();
      }
    };

    // Enter key support
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        modal.querySelector(".ch-url-save").click();
      }
    });
  }

  function closeUrlModal() {
    if (currentUrlModal) currentUrlModal.remove();
    currentUrlModal = null;
    urlModalVisible = false;
  }

  // ==================== PLATFORM & INPUT ====================
  function getCurrentSite() {
    for (let site of SITES) if (site.match.test(location.href)) return site;
    return { name: "Generic", inputBox: "textarea", waitFor: "body" };
  }

  function getInputBox() {
    if (!currentSite) currentSite = getCurrentSite();
    for (let sel of currentSite.inputBox.split(",")) {
      let el = document.querySelector(sel.trim());
      if (
        el &&
        (el.tagName === "TEXTAREA" ||
          el.tagName === "INPUT" ||
          el.isContentEditable)
      )
        return el;
    }
    return null;
  }

  function fillInputBox(text) {
    let input = getInputBox();
    if (!input) {
      copyToClipboard(text);
      showToast("Input box not found");
      return;
    }
    try {
      if (input.tagName === "TEXTAREA") {
        let setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        setter ? setter.call(input, text) : (input.value = text);
      } else if (input.tagName === "INPUT") input.value = text;
      else if (input.isContentEditable) input.innerText = text;
      else input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.focus();
      showToast(`✓ Filled into ${currentSite.name}`);
    } catch (e) {
      copyToClipboard(text);
    }
  }

  function copyToClipboard(text) {
    GM_setClipboard(text, "text");
    showToast("Copied ✓");
  }

  function showToast(msg) {
    let t = document.querySelector(".ch-toast");
    if (t) t.remove();
    let toast = document.createElement("div");
    toast.className = "ch-toast";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  // ==================== TEMPLATE LOADING ====================
  function saveToCache(data) {
    GM_setValue(STORAGE_CACHE_KEY, JSON.stringify(data));
    GM_setValue(STORAGE_CACHE_TIME_KEY, Date.now());
  }
  function loadFromCache() {
    let cached = GM_getValue(STORAGE_CACHE_KEY);
    if (cached)
      try {
        templates = JSON.parse(cached);
        return true;
      } catch (e) {}
    return false;
  }

  function loadFromRemote(callback, silent = false) {
    if (!templateUrl) {
      if (!silent) showToast("Set template URL first");
      callback?.();
      return;
    }
    GM_xmlhttpRequest({
      method: "GET",
      url: `${templateUrl}?_t=${Date.now()}`,
      headers: { "Cache-Control": "no-cache" },
      onload: (resp) => {
        if (resp.status === 200) {
          try {
            let data = JSON.parse(resp.responseText);
            if (Array.isArray(data)) {
              templates = data;
              saveToCache(templates);
              if (!silent) showToast("Templates updated ✓");
              callback?.();
              return;
            }
            throw new Error("Not an array");
          } catch (e) {
            if (!silent) showToast("Invalid JSON");
          }
        } else if (!silent) showToast(`HTTP ${resp.status}`);
        callback?.();
      },
      onerror: () => {
        if (!silent) showToast("Network error");
        callback?.();
      },
    });
  }

  function initTemplates(callback) {
    if (loadFromCache()) {
      callback?.();
      loadFromRemote(() => {}, true);
    } else loadFromRemote(callback);
  }

  function refreshTemplates(callback) {
    loadFromRemote(() => {
      refreshModalUI();
      callback?.();
    }, false);
  }

  // ==================== UI HELPERS ====================
  function escapeHtml(s) {
    return (
      s?.replace(
        /[&<>]/g,
        (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[m],
      ) || ""
    );
  }
  function getCategories() {
    return [...new Set(templates.map((t) => t.category))].sort();
  }
  function getTemplatesByCategory(cat) {
    return templates.filter((t) => t.category === cat);
  }
  function onTemplateClick(content) {
    if (AUTO_FILL) fillInputBox(content);
    else copyToClipboard(content);
    closeModal();
  }

  // ==================== MATERIAL UI ====================
  GM_addStyle(`
        .ch-fab{position:fixed!important;bottom:24px!important;right:24px!important;width:56px!important;height:56px!important;border-radius:28px!important;background:#6750A4!important;color:#fff!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;z-index:999999!important;box-shadow:0 4px 8px rgba(0,0,0,.15)!important;transition:.2s!important}.ch-fab:hover{background:#7F67BE!important;transform:scale(1.02)!important}
        .ch-dialog-backdrop{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.4);backdrop-filter:blur(2px);z-index:100000;display:flex;align-items:center;justify-content:center}
        .ch-dialog{background:#fff;width:880px;max-width:90vw;height:600px;max-height:80vh;border-radius:20px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 48px rgba(0,0,0,.2);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto}
        .ch-dialog-header{padding:20px 24px;border-bottom:1px solid #E5E5E8;display:flex;justify-content:space-between;align-items:center;background:#fff}
        .ch-dialog-title{font-size:20px;font-weight:500;color:#1E1E2F}
        .ch-dialog-close{width:36px;height:36px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#8E8E9A;background:none;border:none}.ch-dialog-close:hover{background:#F3F3F7;color:#1E1E2F}
        .ch-dialog-body{flex:1;display:flex;overflow:hidden}
        .ch-dialog-footer{padding:12px 24px;border-top:1px solid #E5E5E8;background:#FAFAFC;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .ch-footer-left{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .ch-footer-right{display:flex;align-items:center;gap:12px}
        .ch-refresh-btn,.ch-settings-btn{background:#fff;border:1px solid #D1D1D6;color:#44445A;padding:6px 14px;border-radius:24px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:.2s}.ch-refresh-btn:hover,.ch-settings-btn:hover{background:#E5E5E8;border-color:#6750A4;color:#1E1E2F}
        .ch-url-display{font-size:12px;color:#666;background:#fff;padding:4px 12px;border-radius:16px;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;border:1px solid #E5E5E8}
        .ch-cache-info{font-size:11px;color:#8E8E9A;background:#fff;padding:4px 10px;border-radius:16px;border:1px solid #E5E5E8}
        .ch-categories{width:160px;background:#FAFAFC;border-right:1px solid #E5E5E8;overflow-y:auto;padding:8px 0}
        .ch-category-item{padding:10px 20px;cursor:pointer;font-size:14px;font-weight:500;color:#5A5A70;margin:4px 8px;border-radius:18px;display:flex;justify-content:space-between;align-items:center}.ch-category-item:hover{background:#E5E5E8;color:#1E1E2F}.ch-category-item.active{background:#6750A4;color:#fff}
        .ch-templates{flex:1;padding:20px 24px;overflow-y:auto}
        .ch-template-item{background:#fff;border-radius:16px;padding:16px 20px;margin-bottom:12px;cursor:pointer;border:1px solid #E5E5E8;transition:.2s}.ch-template-item:hover{background:#FAFAFC;transform:translateX(4px);border-color:#6750A4}
        .ch-template-title{font-weight:600;font-size:15px;color:#1E1E2F;margin-bottom:8px}
        .ch-template-content{font-size:13px;color:#5A5A70;word-break:break-word}
        .ch-empty{text-align:center;padding:48px;color:#8E8E9A;display:flex;flex-direction:column;align-items:center;gap:12px}
        .ch-toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#1E1E2F;color:#fff;padding:10px 20px;border-radius:24px;z-index:100001;font-size:14px}
        .ch-categories::-webkit-scrollbar{width:6px}.ch-categories::-webkit-scrollbar-track{background:#FAFAFC}.ch-categories::-webkit-scrollbar-thumb{background:#C4C4D0;border-radius:3px}
        .ch-templates::-webkit-scrollbar{width:6px}.ch-templates::-webkit-scrollbar-track{background:#fff}.ch-templates::-webkit-scrollbar-thumb{background:#C4C4D0;border-radius:3px}
        
        /* URL Edit Modal Styles */
        .ch-url-backdrop{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.4);backdrop-filter:blur(2px);z-index:100001;display:flex;align-items:center;justify-content:center}
        .ch-url-modal{background:#fff;width:500px;max-width:90vw;border-radius:20px;overflow:hidden;box-shadow:0 24px 48px rgba(0,0,0,.2);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto}
        .ch-url-header{padding:16px 20px;border-bottom:1px solid #E5E5E8;display:flex;justify-content:space-between;align-items:center;background:#fff}
        .ch-url-header span{font-size:18px;font-weight:500;color:#1E1E2F}
        .ch-url-close{width:32px;height:32px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#8E8E9A;background:none;border:none}.ch-url-close:hover{background:#F3F3F7;color:#1E1E2F}
        .ch-url-body{padding:20px;background:#fff}
        .ch-url-body label{display:block;font-size:14px;font-weight:500;color:#1E1E2F;margin-bottom:8px}
        .ch-url-input{width:100%;padding:12px 16px;border:1px solid #D1D1D6;border-radius:16px;font-size:14px;font-family:monospace;box-sizing:border-box;transition:.2s}.ch-url-input:focus{outline:none;border-color:#6750A4;box-shadow:0 0 0 2px rgba(103,80,164,.2)}
        .ch-url-hint{font-size:12px;color:#8E8E9A;margin-top:8px}
        .ch-url-footer{padding:16px 20px;border-top:1px solid #E5E5E8;display:flex;justify-content:flex-end;gap:12px;background:#FAFAFC}
        .ch-url-cancel,.ch-url-save{padding:8px 20px;border-radius:24px;font-size:13px;font-weight:500;cursor:pointer;border:none;transition:.2s}
        .ch-url-cancel{background:#fff;border:1px solid #D1D1D6;color:#44445A}.ch-url-cancel:hover{background:#F3F3F7}
        .ch-url-save{background:#6750A4;color:#fff}.ch-url-save:hover{background:#7F67BE}
    `);

  function renderCategories() {
    let cats = getCategories();
    categoriesContainer.innerHTML = cats.length
      ? ""
      : '<div class="ch-empty">No categories</div>';
    cats.forEach((cat) => {
      let div = document.createElement("div");
      div.className = `ch-category-item${cat === currentCategory ? " active" : ""}`;
      div.innerHTML = `<span>${escapeHtml(cat)}</span><span class="ch-cat-chevron">${ICONS.chevron}</span>`;
      div.onclick = () => {
        currentCategory = cat;
        renderCategories();
        renderTemplates();
      };
      categoriesContainer.appendChild(div);
    });
  }

  function renderTemplates() {
    let items = getTemplatesByCategory(currentCategory);
    templatesContainer.innerHTML = items.length
      ? ""
      : `<div class="ch-empty">${ICONS.empty}<div>No templates, click refresh</div></div>`;
    items.forEach((tpl) => {
      let div = document.createElement("div");
      div.className = "ch-template-item";
      div.innerHTML = `<div class="ch-template-title">${escapeHtml(tpl.title)}</div><div class="ch-template-content">${escapeHtml(tpl.content)}</div>`;
      div.onclick = () => onTemplateClick(tpl.content);
      templatesContainer.appendChild(div);
    });
  }

  function refreshModalUI() {
    let cats = getCategories();
    if (cats.length && (!currentCategory || !cats.includes(currentCategory)))
      currentCategory = cats[0];
    renderCategories();
    renderTemplates();

    let urlDisplay = document.querySelector(".ch-url-display");
    if (urlDisplay) {
      let displayUrl = templateUrl || "No URL set";
      urlDisplay.title = displayUrl;
      urlDisplay.textContent =
        displayUrl.length > 55
          ? displayUrl.substring(0, 52) + "..."
          : displayUrl;
    }
    let cacheInfo = document.querySelector(".ch-cache-info");
    if (cacheInfo) {
      let cacheTime = GM_getValue(STORAGE_CACHE_TIME_KEY, 0);
      cacheInfo.textContent = cacheTime
        ? new Date(cacheTime).toLocaleString()
        : "No cache";
    }
  }

  let categoriesContainer, templatesContainer;
  function buildModal() {
    let backdrop = document.createElement("div");
    backdrop.className = "ch-dialog-backdrop";
    let dialog = document.createElement("div");
    dialog.className = "ch-dialog";

    let header = document.createElement("div");
    header.className = "ch-dialog-header";
    let title = document.createElement("span");
    title.className = "ch-dialog-title";
    title.textContent = "Chat Helper";
    let closeBtn = document.createElement("button");
    closeBtn.className = "ch-dialog-close";
    closeBtn.innerHTML = ICONS.close;
    closeBtn.onclick = closeModal;
    header.appendChild(title);
    header.appendChild(closeBtn);

    let body = document.createElement("div");
    body.className = "ch-dialog-body";
    categoriesContainer = document.createElement("div");
    categoriesContainer.className = "ch-categories";
    templatesContainer = document.createElement("div");
    templatesContainer.className = "ch-templates";
    body.append(categoriesContainer, templatesContainer);

    let footer = document.createElement("div");
    footer.className = "ch-dialog-footer";
    let footerLeft = document.createElement("div");
    footerLeft.className = "ch-footer-left";
    let footerRight = document.createElement("div");
    footerRight.className = "ch-footer-right";

    let changeUrlBtn = document.createElement("button");
    changeUrlBtn.className = "ch-settings-btn";
    changeUrlBtn.innerHTML = `${ICONS.settings} Change URL`;
    changeUrlBtn.onclick = (e) => {
      e.stopPropagation();
      showUrlEditModal();
    };

    let refreshBtn = document.createElement("button");
    refreshBtn.className = "ch-refresh-btn";
    refreshBtn.innerHTML = `${ICONS.refresh} Refresh`;
    refreshBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm("Refresh from remote?"))
        refreshTemplates(() => refreshModalUI());
    };

    let urlDisplay = document.createElement("span");
    urlDisplay.className = "ch-url-display";
    let displayUrl = templateUrl || "No URL set";
    urlDisplay.title = displayUrl;
    urlDisplay.textContent =
      displayUrl.length > 55 ? displayUrl.substring(0, 52) + "..." : displayUrl;

    let cacheTime = GM_getValue(STORAGE_CACHE_TIME_KEY, 0);
    let cacheSpan = document.createElement("span");
    cacheSpan.className = "ch-cache-info";
    cacheSpan.textContent = cacheTime
      ? new Date(cacheTime).toLocaleString()
      : "No cache";

    footerLeft.appendChild(changeUrlBtn);
    footerLeft.appendChild(refreshBtn);
    footerLeft.appendChild(urlDisplay);
    footerRight.appendChild(cacheSpan);
    footer.appendChild(footerLeft);
    footer.appendChild(footerRight);

    dialog.append(header, body, footer);
    backdrop.appendChild(dialog);

    let cats = getCategories();
    if (cats.length) currentCategory = cats[0];
    renderCategories();
    renderTemplates();

    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal();
    };
    return backdrop;
  }

  function openModal() {
    if (currentModal) closeModal();
    currentModal = buildModal();
    document.body.appendChild(currentModal);
    modalVisible = true;
  }
  function closeModal() {
    if (currentModal) currentModal.remove();
    currentModal = null;
    modalVisible = false;
  }

  // ==================== INIT ====================
  function initUI() {
    if (document.querySelector(".ch-fab")) return;
    let fab = document.createElement("div");
    fab.className = "ch-fab";
    fab.innerHTML = ICONS.fab;
    fab.title = "Chat Helper";
    fab.onclick = () => openModal();
    document.body.appendChild(fab);
    console.log("Chat Helper started");
  }

  function waitForPage() {
    currentSite = getCurrentSite();
    let check = () => {
      if (
        document.querySelector(currentSite.waitFor || "body") &&
        document.body
      ) {
        if (initTemplateUrl()) initTemplates(() => initUI());
        else {
          console.warn("No template URL");
          initUI();
        }
      } else setTimeout(check, 300);
    };
    check();
  }
  waitForPage();
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (urlModalVisible) closeUrlModal();
      else if (modalVisible) closeModal();
    }
  });
})();
