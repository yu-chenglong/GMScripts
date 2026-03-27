// ==UserScript==
// @name         Shopee Order Shipment Pre-declaration Helper
// @namespace    https://github.com/yu-chenglong/GMScripts
// @version      2.2.0
// @description  Automate selecting Shopee orders by entering tracking numbers via a Tampermonkey menu in the Seller Center
// @author       Yu Chenglong
// @match        https://seller.shopee.cn/*
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_log
// @updateURL    https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/Shopee订单发货预报助手.js
// @downloadURL  https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/Shopee订单发货预报助手.js
// ==/UserScript==

(function () {
  "use strict";

  // 1. Configurations - Constants & Language Config
  const CONSTANTS = {
    TRACKING_NUMBER_COLUMN_INDEX: 3,
    MODAL_Z_INDEX: 10000,
    CHECKBOX_DELAY: 50,
    ROW_PROCESS_DELAY: 200,
    CHECKED_HIGHLIGHT_DURATION: 3000
  };

  const LANG_CONFIG = {
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
      foundMatchingOrders: "找到 {count} 个匹配订单"
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
      foundMatchingOrders: "Found {count} matching orders"
    }
  };

  // 2. Utility - Common Helper Functions
  const Utils = {
    getBrowserLang() {
      const lang = navigator.language || navigator.userLanguage;
      return lang.startsWith("zh") ? "zh" : "en";
    },

    t(key, params = {}) {
      const currentLang = this.getBrowserLang();
      let text = LANG_CONFIG[currentLang][key];

      // Fallback to alternative language or key itself if missing
      if (!text) {
        const fallbackLang = currentLang === "zh" ? "en" : "zh";
        text = LANG_CONFIG[fallbackLang][key] || key;
        GM_log(`[Missing Text] Key '${key}' not found in ${currentLang}, fallback to ${fallbackLang} or key`);
      }

      // Replace parameters (keep placeholder if param missing)
      Object.keys(params).forEach(param => {
        const placeholder = `{${param}}`;
        text = text.replace(placeholder, params[param] || placeholder);
      });

      return text;
    },

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    getWindow() {
      return typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    },

    createElement(tag, className, textContent = "", attributes = {}) {
      const element = document.createElement(tag);
      if (className) element.classList.add(...className.split(" "));
      if (textContent) element.textContent = textContent;
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
      return element;
    },

    triggerEvent(element, eventType) {
      if (!element) return;
      try {
        const EventClass = eventType === "click" ? MouseEvent : Event;
        const event = new EventClass(eventType, {
          bubbles: true,
          cancelable: true,
          view: this.getWindow()
        });
        element.dispatchEvent(event);
      } catch (error) {
        GM_log(this.t("errorTriggerEvent", { eventType }) + error.message);
      }
    }
  };

  // 3. Style Manager - Simplified & Elegant CSS Management
  const StyleManager = (() => {
    // CSS styles as template string (organized by component)
    const styles = `
      /* Modal Container */
      .custom-modal {
        display: none;
        position: fixed;
        z-index: ${CONSTANTS.MODAL_Z_INDEX};
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0,0,0,0.5);
      }

      /* Modal Dialog */
      .custom-modal-dialog {
        margin: 15% auto;
        width: 80%;
        max-width: 500px;
      }

      /* Modal Content */
      .custom-modal-content {
        background: #fff;
        border: 1px solid #888;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }

      /* Modal Header */
      .custom-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        border-bottom: 1px solid #eee;
        background: #0d6efd;
        color: #fff;
        border-radius: 4px 4px 0 0;
      }

      .custom-modal-title {
        margin: 0;
        font-size: 1.35rem;
        font-weight: bold;
      }

      .custom-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        color: #fff;
        opacity: 0.8;
        cursor: pointer;
        padding: 0.5rem;
        line-height: 1;
        margin: -1rem -1rem -1rem auto;
      }

      /* Modal Body & Footer */
      .custom-modal-body { padding: 1rem; }
      .custom-modal-footer {
        display: flex;
        justify-content: flex-end;
        padding: 0.75rem;
        border-top: 1px solid #eee;
      }

      /* Form Input */
      .custom-form-control {
        width: 100%;
        padding: 0.6rem 0.75rem;
        font-size: 1.1rem;
        line-height: 1.6;
        border: 1px solid #ccc;
        border-radius: 4px;
        min-height: 150px;
        resize: vertical;
        box-sizing: border-box;
      }

      /* Buttons */
      .custom-btn {
        padding: 0.5rem 1rem;
        font-size: 1.1rem;
        border-radius: 4px;
        cursor: pointer;
        margin-left: 0.5rem;
        transition: background-color 0.2s;
      }

      .custom-btn-primary {
        color: #fff;
        background: #0d6efd;
        border: 1px solid #0d6efd;
      }

      .custom-btn-primary:hover { background: #0b5ed7; }

      .custom-btn-secondary {
        color: #333;
        background: #f8f9fa;
        border: 1px solid #ccc;
      }

      .custom-btn-secondary:hover { background: #e2e6ea; }

      /* Checkbox Highlight */
      .checked-checkbox { outline: 2px solid green !important; }
    `;

    // Single method to inject styles
    return {
      inject: () => GM_addStyle(styles)
    };
  })();

  // 4. Actions - Main Logic
  const Actions = {
    async checkCheckbox(checkbox, trackingNumber) {
      if (!checkbox) return false;

      const initialState = checkbox.checked;
      try {
        Utils.triggerEvent(checkbox, "click");
        await Utils.delay(CONSTANTS.CHECKBOX_DELAY);

        Utils.triggerEvent(checkbox, "change");
        await Utils.delay(CONSTANTS.CHECKBOX_DELAY);

        const finalState = checkbox.checked;
        const isSuccess = finalState !== initialState;

        if (isSuccess) {
          GM_log(Utils.t("checkSuccess") + trackingNumber);
          checkbox.classList.add("checked-checkbox");
          setTimeout(() => checkbox.classList.remove("checked-checkbox"), CONSTANTS.CHECKED_HIGHLIGHT_DURATION);
        } else {
          GM_log(Utils.t("checkFailed") + trackingNumber);
        }

        return isSuccess;
      } catch (error) {
        GM_log(Utils.t("errorCheckboxOp", { trackingNumber }) + error.message);
        return false;
      }
    },

    async processRow(row, trackingNumber, results) {
      const checkbox = row.querySelector(".eds-checkbox__input");

      if (!checkbox) {
        GM_log(Utils.t("checkboxNotFound") + trackingNumber);
        results.skipped++;
        return;
      }

      if (checkbox.checked) {
        GM_log(Utils.t("alreadyChecked") + trackingNumber);
        results.skipped++;
        return;
      }

      const isSuccess = await this.checkCheckbox(checkbox, trackingNumber);
      isSuccess ? results.success++ : results.failed++;
    },

    async searchAndCheck(trackingNumbers, results, notFoundNumbers) {
      const table = document.querySelector("table.eds-table__body");
      if (!table) {
        alert(Utils.t("tableNotFound"));
        return;
      }

      const rows = table.querySelectorAll("tr.eds-table__row");
      if (rows.length === 0) {
        alert(Utils.t("noRowsFound"));
        return;
      }

      // `notFoundNumbers` is expected to be a Set for efficient deletion.
      const matchingRows = [];
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        const trackingNumberCell = cells[CONSTANTS.TRACKING_NUMBER_COLUMN_INDEX];
        if (!trackingNumberCell) continue;

        const rowTrackingNumber = trackingNumberCell.textContent.trim();
        for (const inputNum of trackingNumbers) {
          if (rowTrackingNumber.includes(inputNum)) {
            matchingRows.push({ row, trackingNumber: inputNum });
            notFoundNumbers.delete(inputNum);
          }
        }
      }

      GM_log(Utils.t("foundMatchingOrders", { count: matchingRows.length }));

      if (matchingRows.length === 0) {
        alert(Utils.t("noMatchingNumbers"));
        return;
      }

      for (const { row, trackingNumber } of matchingRows) {
        await this.processRow(row, trackingNumber, results);
        await Utils.delay(CONSTANTS.ROW_PROCESS_DELAY);
      }
    },

    showResults(results, notFoundNumbers) {
      const list = notFoundNumbers instanceof Set
        ? Array.from(notFoundNumbers)
        : notFoundNumbers;

      let message = `${Utils.t("processComplete")}\n✅ ${Utils.t("success")}: ${results.success}\n❌ ${Utils.t("failed")}: ${results.failed}\n⚠️ ${Utils.t("notFound")}: ${list.length}`;

      if (list.length > 0) {
        message += `\n\n${Utils.t("trackingNumbersNotFound")} (${list.length}):\n${list.join("\n")}`;
      }

      alert(message);
    }
  };

  // 5. UI Layer - Modal & Interaction
  const UIManager = {
    modal: null,
    input: null,

    createModal() {
      const modal = Utils.createElement("div", "custom-modal", "", { id: "trackingNumberModal" });
      const modalDialog = Utils.createElement("div", "custom-modal-dialog");
      const modalContent = Utils.createElement("div", "custom-modal-content");
      modal.appendChild(modalDialog);
      modalDialog.appendChild(modalContent);

      const modalHeader = Utils.createElement("div", "custom-modal-header");
      const modalTitle = Utils.createElement("h5", "custom-modal-title", Utils.t("modalTitle"));
      const closeButton = Utils.createElement("button", "custom-close", "×", { "aria-label": "Close" });
      closeButton.addEventListener("click", () => (modal.style.display = "none"));
      modalHeader.append(modalTitle, closeButton);

      const modalBody = Utils.createElement("div", "custom-modal-body");
      const input = Utils.createElement("textarea", "custom-form-control", "", {
        placeholder: Utils.t("inputPlaceholder")
      });
      modalBody.appendChild(input);

      const modalFooter = Utils.createElement("div", "custom-modal-footer");
      const searchButton = Utils.createElement("button", "custom-btn custom-btn-primary", Utils.t("searchBtn"));
      const cancelButton = Utils.createElement("button", "custom-btn custom-btn-secondary", Utils.t("cancelBtn"));

      cancelButton.addEventListener("click", () => (modal.style.display = "none"));

      searchButton.addEventListener("click", async () => {
        try {
          const trackingNumbers = input.value
            .split("\n")
            .map(num => num.trim())
            .filter(Boolean);

          if (trackingNumbers.length === 0) {
            alert(Utils.t("emptyInput"));
            return;
          }

          searchButton.disabled = true;
          searchButton.textContent = Utils.t("processingBtn");

          const notFoundNumbers = new Set(trackingNumbers);
          const results = { success: 0, failed: 0, skipped: 0 };

          await Actions.searchAndCheck(trackingNumbers, results, notFoundNumbers);

          searchButton.disabled = false;
          searchButton.textContent = Utils.t("searchBtn");
          modal.style.display = "none";
          Actions.showResults(results, notFoundNumbers);
        } catch (error) {
          GM_log(Utils.t("errorDuringSearch") + error.message);
          alert(Utils.t("errorDuringSearch") + error.message);
        }
      });

      modalFooter.append(cancelButton, searchButton);
      modalContent.append(modalHeader, modalBody, modalFooter);
      document.body.appendChild(modal);

      this.modal = modal;
      this.input = input;
    },

    openModal() {
      if (!this.modal) this.createModal();
      this.modal.style.display = "block";
      this.input.value = "";
      this.input.focus();
    }
  };

  // 6. Initialization Layer - Script Entry
  const Initializer = {
    init() {
      StyleManager.inject(); // Simplified style injection
      UIManager.createModal();
      GM_registerMenuCommand(Utils.t("menuTitle"), () => UIManager.openModal());
      GM_log("✅ Shopee Order Shipment Helper initialized successfully");
    }
  };

  // Script Entry Point
  Initializer.init();

})();
