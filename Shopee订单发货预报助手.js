// ==UserScript==
// @name         Shopee Order Shipment Pre-declaration Helper
// @namespace    https://github.com/yu-chenglong/GMScripts
// @version      2.3.0
// @description  Automate selecting Shopee orders by entering tracking numbers via a Tampermonkey menu in the Seller Center
// @author       Yu Chenglong
// @match        https://seller.shopee.cn/*
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_log
// @updateURL    https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/Shopee订单发货预报助手.js
// @downloadURL    https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/Shopee订单发货预报助手.js
// ==/UserScript==

(function () {
  "use strict";

  const CONSTANTS = {
    TRACKING_NUMBER_COLUMN_INDEX: 3,
    MODAL_Z_INDEX: 10000,
    CHECKBOX_DELAY: 50,
    ROW_PROCESS_DELAY: 200,
    CHECKED_HIGHLIGHT_DURATION: 3000,
    MODAL_ID: "trackingNumberModal",
    STYLES_SCOPE: "shopee-shipment-helper",
  };

  const LANG = {
    zh: {
      menuTitle: "Shopee: 输入物流单号",
      modalTitle: "输入物流单号",
      inputPlaceholder: "请输入一个或多个物流单号，每行一个",
      searchBtn: "搜索",
      cancelBtn: "取消",
      processingBtn: "处理中...",
      tableNotFound: "未找到订单表格，请确保页面完全加载",
      noRowsFound: "未找到订单行",
      noMatchingNumbers: "未找到匹配的物流单号",
      emptyInput: "请至少输入一个物流单号",
      processComplete: "处理完成！",
      success: "成功勾选",
      failed: "勾选失败",
      notFound: "未找到",
      trackingNumbersNotFound: "未找到的物流单号",
      checkSuccess: "✅ 成功勾选：",
      checkFailed: "❌ 勾选失败（状态未变更）：",
      checkboxNotFound: "❌ 未找到复选框元素：",
      alreadyChecked: "✅ 已勾选，跳过：",
      errorDuringSearch: "搜索过程中发生错误：",
      errorTriggerEvent: "触发 {eventType} 事件时出错：",
      errorCheckboxOp: "物流单号 {trackingNumber} 复选框操作出错：",
      foundMatchingOrders: "找到 {count} 个匹配订单",
    },
    en: {
      menuTitle: "Shopee: Input Tracking",
      modalTitle: "Enter Tracking Number(s)",
      inputPlaceholder: "Enter one or more tracking numbers, one per line",
      searchBtn: "Search",
      cancelBtn: "Cancel",
      processingBtn: "Processing...",
      tableNotFound: "Order table not found. Please ensure the page is fully loaded.",
      noRowsFound: "No order rows found.",
      noMatchingNumbers: "No matching tracking numbers found.",
      emptyInput: "Please enter at least one tracking number.",
      processComplete: "Processing Complete!",
      success: "Successfully Checked",
      failed: "Check Failed",
      notFound: "Not Found",
      trackingNumbersNotFound: "Tracking Numbers Not Found",
      checkSuccess: "✅ Successfully checked: ",
      checkFailed: "❌ Check failed (state unchanged): ",
      checkboxNotFound: "❌ Checkbox element not found: ",
      alreadyChecked: "✅ Already checked, skipping: ",
      errorDuringSearch: "Error during search process: ",
      errorTriggerEvent: "Error triggering {eventType} event: ",
      errorCheckboxOp: "Error during checkbox operation for {trackingNumber}: ",
      foundMatchingOrders: "Found {count} matching orders",
    },
  };

  const getBrowserLang = () => navigator.language?.startsWith("zh") ? "zh" : "en";

  const t = (key, params = {}) => {
    const lang = getBrowserLang();
    let text = LANG[lang][key] || LANG.en[key] || key;
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
    return text;
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const createEl = (tag, options = {}) => {
    const el = document.createElement(tag);
    const { cls = "", text = "", attrs = {} } = options;
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  const triggerEvent = (el, type) => {
    if (!el) return false;
    try {
      const event = new (type === "click" ? MouseEvent : Event)(type, {
        bubbles: true,
        cancelable: true,
      });
      return el.dispatchEvent(event);
    } catch (e) {
      GM_log(t("errorTriggerEvent", { eventType: type }) + e.message);
      return false;
    }
  };

  function injectStyles() {
    const prefix = CONSTANTS.STYLES_SCOPE;
    const css = `
      .${prefix}-modal { display: none; position: fixed; z-index: ${CONSTANTS.MODAL_Z_INDEX}; inset: 0; background: rgba(0,0,0,.5); }
      .${prefix}-modal-dialog { margin: 15% auto; width: 80%; max-width: 500px; }
      .${prefix}-modal-content { background: #fff; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,.15); }
      .${prefix}-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #0d6efd; color: #fff; border-radius: 4px 4px 0 0; }
      .${prefix}-modal-title { margin: 0; font-size: 1.25rem; }
      .${prefix}-close { background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; }
      .${prefix}-modal-body { padding: 1rem; }
      .${prefix}-modal-footer { display: flex; justify-content: end; padding: .75rem; border-top: 1px solid #eee; }
      .${prefix}-form-control { width: 100%; padding: .75rem; font-size: 1rem; min-height: 150px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
      .${prefix}-btn { padding: .5rem 1rem; border-radius: 4px; cursor: pointer; margin-left: .5rem; }
      .${prefix}-btn-primary { background: #0d6efd; color: #fff; border: none; }
      .${prefix}-btn-secondary { background: #f8f9fa; border: 1px solid #ccc; }
      .${prefix}-checked-checkbox { outline: 2px solid green !important; transition: .2s; }
    `;
    GM_addStyle(css);
  }

  async function processTrackingNumbers(numbers) {
    const results = { success: 0, failed: 0, skipped: 0 };
    const notFound = new Set(numbers);
    const table = document.querySelector("table.eds-table__body");

    if (!table) { alert(t("tableNotFound")); return { results, notFound }; }
    const rows = table.querySelectorAll("tr.eds-table__row");
    if (!rows.length) { alert(t("noRowsFound")); return { results, notFound }; }

    const matches = [];
    for (const row of rows) {
      const cell = row.querySelectorAll("td")[CONSTANTS.TRACKING_NUMBER_COLUMN_INDEX];
      if (!cell) continue;
      const text = cell.textContent.trim();
      for (const n of numbers) {
        if (text.includes(n)) {
          matches.push({ row, num: n });
          notFound.delete(n);
        }
      }
    }

    GM_log(t("foundMatchingOrders", { count: matches.length }));
    if (!matches.length) { alert(t("noMatchingNumbers")); return { results, notFound }; }

    for (const { row, num } of matches) {
      const checkbox = row.querySelector(".eds-checkbox__input");
      if (!checkbox) { GM_log(t("checkboxNotFound") + num); results.skipped++; continue; }
      if (checkbox.checked) { GM_log(t("alreadyChecked") + num); results.skipped++; continue; }

      const before = checkbox.checked;
      triggerEvent(checkbox, "click");
      await delay(CONSTANTS.CHECKBOX_DELAY);
      triggerEvent(checkbox, "change");
      await delay(CONSTANTS.CHECKBOX_DELAY);

      const ok = checkbox.checked !== before;
      ok ? results.success++ : results.failed++;

      if (ok) {
        checkbox.classList.add(`${CONSTANTS.STYLES_SCOPE}-checked-checkbox`);
        setTimeout(() => checkbox.classList.remove(`${CONSTANTS.STYLES_SCOPE}-checked-checkbox`), CONSTANTS.CHECKED_HIGHLIGHT_DURATION);
        GM_log(t("checkSuccess") + num);
      } else {
        GM_log(t("checkFailed") + num);
      }
      await delay(CONSTANTS.ROW_PROCESS_DELAY);
    }

    return { results, notFound };
  }

  function showResult(results, notFound) {
    const list = Array.from(notFound);
    let msg = [
      t("processComplete"),
      `✅ ${t("success")}: ${results.success}`,
      `❌ ${t("failed")}: ${results.failed}`,
      `⚠️ ${t("notFound")}: ${list.length}`,
    ].join("\n");

    if (list.length) msg += `\n\n${t("trackingNumbersNotFound")}:\n${list.join("\n")}`;
    alert(msg);
  }

  function createModal() {
    const prefix = CONSTANTS.STYLES_SCOPE;
    const modal = createEl("div", { cls: `${prefix}-modal`, attrs: { id: CONSTANTS.MODAL_ID } });
    const dialog = createEl("div", { cls: `${prefix}-modal-dialog` });
    const content = createEl("div", { cls: `${prefix}-modal-content` });

    const header = createEl("div", { cls: `${prefix}-modal-header` });
    const title = createEl("h5", { cls: `${prefix}-modal-title`, text: t("modalTitle") });
    const closeBtn = createEl("button", { cls: `${prefix}-close`, text: "×" });
    header.append(title, closeBtn);

    const body = createEl("div", { cls: `${prefix}-modal-body` });
    const input = createEl("textarea", { cls: `${prefix}-form-control`, attrs: { placeholder: t("inputPlaceholder") } });
    body.append(input);

    const footer = createEl("div", { cls: `${prefix}-modal-footer` });
    const cancelBtn = createEl("button", { cls: `${prefix}-btn ${prefix}-btn-secondary`, text: t("cancelBtn") });
    const searchBtn = createEl("button", { cls: `${prefix}-btn ${prefix}-btn-primary`, text: t("searchBtn") });
    footer.append(cancelBtn, searchBtn);

    content.append(header, body, footer);
    dialog.append(content);
    modal.append(dialog);
    document.body.append(modal);

    const close = () => modal.style.display = "none";
    const open = () => { modal.style.display = "block"; input.value = ""; input.focus(); };
    modal.onclick = e => e.target === modal && close();
    closeBtn.onclick = close;
    cancelBtn.onclick = close;

    searchBtn.onclick = async () => {
      const list = input.value.split("\n").map(s => s.trim()).filter(Boolean);
      if (!list.length) { alert(t("emptyInput")); return; }

      searchBtn.disabled = true;
      searchBtn.textContent = t("processingBtn");
      try {
        const { results, notFound } = await processTrackingNumbers(list);
        showResult(results, notFound);
        close();
      } catch (e) {
        GM_log(t("errorDuringSearch") + e.message);
        alert(t("errorDuringSearch") + e.message);
      } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = t("searchBtn");
      }
    };

    return open;
  }

  function init() {
    try {
      injectStyles();
      const openModal = createModal();
      GM_registerMenuCommand(t("menuTitle"), openModal);
      GM_log("✅ Shopee 发货预报助手已启动");
    } catch (e) {
      GM_log("❌ 启动失败：" + e.message);
    }
  }

  init();
})();
