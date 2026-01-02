// ==UserScript==
// @name         Shopee Order Shipment Pre-declaration Helper
// @namespace    https://github.com/yu-chenglong/GMScripts
// @version      2.1.1
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

  // --- 1. Custom Styles (Font Size Adjusted) --------------------------------
  GM_addStyle(`
    .custom-modal {
        display: none; position: fixed; z-index: 10000; left: 0; top: 0;
        width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5);
    }
    .custom-modal-dialog {
        margin: 15% auto; width: 80%; max-width: 500px;
    }
    .custom-modal-content {
        background-color: #fff; border: 1px solid #888; border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .custom-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1rem; border-bottom: 1px solid #eee; background-color: #0d6efd;
        color: #fff; border-radius: 4px 4px 0 0;
    }
    .custom-modal-title {
        margin: 0; font-size: 1.35rem; font-weight: bold; /* Slightly larger title */
    }
    .custom-close {
        background: none; border: none; font-size: 1.5rem; color: #fff; opacity: 0.8;
        cursor: pointer; padding: 0.5rem; line-height: 1; margin: -1rem -1rem -1rem auto;
    }
    .custom-modal-body {
        padding: 1rem;
    }
    .custom-modal-footer {
        display: flex; justify-content: flex-end; padding: 0.75rem; border-top: 1px solid #eee;
    }
    .custom-form-control {
        width: 100%; padding: 0.6rem 0.75rem; font-size: 1.1rem; line-height: 1.6; /* Increased input text size */
        border: 1px solid #ccc; border-radius: 4px; min-height: 150px; resize: vertical;
        box-sizing: border-box;
    }
    .custom-btn {
        padding: 0.5rem 1rem; font-size: 1.1rem; border-radius: 4px; cursor: pointer; /* Increased button text size */
        margin-left: 0.5rem; transition: background-color 0.2s;
    }
    .custom-btn-primary {
        color: #fff; background-color: #0d6efd; border: 1px solid #0d6efd;
    }
    .custom-btn-primary:hover {
        background-color: #0b5ed7;
    }
    .custom-btn-secondary {
        color: #333; background-color: #f8f9fa; border: 1px solid #ccc;
    }
    .custom-btn-secondary:hover {
        background-color: #e2e6ea;
    }
    .checked-checkbox {
        outline: 2px solid green !important;
    }
  `);

  // --- 2. Utility Functions ------------------------------------------

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const getWindow = () =>
    typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

  /**
   * Creates an HTML element with optional class, text, and attributes.
   */
  const createElement = (tag, className, textContent = "", attributes = {}) => {
    const element = document.createElement(tag);
    if (className) element.classList.add(...className.split(" "));
    if (textContent) element.textContent = textContent;
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
    return element;
  };

  /**
   * Simulates a mouse or change event on the target element.
   * @param {HTMLElement} element
   * @param {string} eventType - e.g., 'click', 'change'
   */
  const triggerEvent = (element, eventType) => {
    if (!element) return;
    try {
      const EventClass = eventType === 'click' ? MouseEvent : Event;
      const event = new EventClass(eventType, {
        bubbles: true,
        cancelable: true,
        view: getWindow(),
      });
      element.dispatchEvent(event);
    } catch (error) {
      GM_log(`Error triggering ${eventType} event: ${error.message}`);
    }
  };

  /**
   * Attempts to check a checkbox and verifies the state change.
   * @param {HTMLInputElement} checkbox
   * @param {string} trackingNumber
   * @returns {Promise<boolean>} Success status
   */
  const checkCheckbox = async (checkbox, trackingNumber) => {
    if (!checkbox) return false;

    const initialState = checkbox.checked;

    try {
      // 1. Simulate user click
      triggerEvent(checkbox, "click");
      await delay(50); // Give framework time to process click

      // 2. Force a 'change' event in case the click wasn't fully registered
      triggerEvent(checkbox, "change");
      await delay(50);

      const finalState = checkbox.checked;
      const isSuccess = finalState !== initialState;

      if (isSuccess) {
        GM_log(`✅ Successfully checked: ${trackingNumber}`);
        checkbox.classList.add("checked-checkbox");
        setTimeout(() => checkbox.classList.remove("checked-checkbox"), 3000);
      } else {
        GM_log(`❌ Check failed (state unchanged): ${trackingNumber}`);
      }

      return isSuccess;
    } catch (error) {
      GM_log(`Error during checkbox operation for ${trackingNumber}: ${error.message}`);
      return false;
    }
  };

  // --- 3. Core Logic -------------------------------------------------

  const processRow = async (row, trackingNumber, results) => {
    const checkbox = row.querySelector(".eds-checkbox__input");

    if (!checkbox) {
      GM_log(`❌ Checkbox element not found: ${trackingNumber}`);
      results.skipped++;
      return;
    }

    // Skip if already checked
    if (checkbox.checked) {
      GM_log(`✅ Already checked, skipping: ${trackingNumber}`);
      results.skipped++;
      return;
    }

    // Attempt to check
    const isSuccess = await checkCheckbox(checkbox, trackingNumber);

    if (isSuccess) {
      results.success++;
    } else {
      results.failed++;
    }
  };

  const searchAndCheck = async (trackingNumbers, results, notFoundNumbers) => {
    const table = document.querySelector("table.eds-table__body");
    if (!table) {
      alert("Order table not found. Please ensure the page is fully loaded.");
      return;
    }

    // Tracking Number is the 4th column (index 3)
    const TRACKING_NUMBER_INDEX = 3;

    const rows = table.querySelectorAll("tr.eds-table__row");
    if (rows.length === 0) {
      alert("No order rows found.");
      return;
    }

    // Identify all rows that match any tracking number
    const matchingRows = Array.from(rows).reduce((acc, row) => {
      const cells = row.querySelectorAll("td");
      const trackingNumberCell = cells[TRACKING_NUMBER_INDEX];

      if (trackingNumberCell) {
        const rowTrackingNumber = trackingNumberCell.textContent.trim();

        // Check against all input tracking numbers
        trackingNumbers.forEach((inputNum) => {
          if (rowTrackingNumber.includes(inputNum)) {
            acc.push({ row, trackingNumber: inputNum });

            // Remove from "not found" list if it was there
            const index = notFoundNumbers.indexOf(inputNum);
            if (index > -1) notFoundNumbers.splice(index, 1);
          }
        });
      }
      return acc;
    }, []);

    GM_log(`Found ${matchingRows.length} matching orders`);

    if (matchingRows.length === 0) {
      alert("No matching tracking numbers found.");
      return;
    }

    // Process matching rows sequentially
    for (const { row, trackingNumber } of matchingRows) {
      await processRow(row, trackingNumber, results);
      await delay(200); // Processing delay to avoid overloading the interface
    }
  };

  const showResults = (results, notFoundNumbers) => {
    let message = `Processing Complete!\n✅ Successfully Checked: ${results.success}\n❌ Check Failed: ${results.failed}\n⚠️ Not Found: ${notFoundNumbers.length}`;

    if (notFoundNumbers.length > 0) {
      message += `\n\nTracking Numbers Not Found (${notFoundNumbers.length}):\n${notFoundNumbers.join("\n")}`;
    }

    alert(message);
  };

  // --- 4. Modal Creation and Initialization --------------------------

  const createModal = () => {
    const modal = createElement("div", "custom-modal", "", { id: "trackingNumberModal" });
    const modalDialog = createElement("div", "custom-modal-dialog");
    const modalContent = createElement("div", "custom-modal-content");

    modal.appendChild(modalDialog);
    modalDialog.appendChild(modalContent);

    // Header
    const modalHeader = createElement("div", "custom-modal-header");
    const modalTitle = createElement("h5", "custom-modal-title", "Enter Tracking Number(s)");
    const closeButton = createElement("button", "custom-close", "×", { "aria-label": "Close" });
    closeButton.addEventListener("click", () => modal.style.display = "none");
    modalHeader.append(modalTitle, closeButton);

    // Body
    const modalBody = createElement("div", "custom-modal-body");
    const input = createElement("textarea", "custom-form-control", "", {
      placeholder: "Enter one or more tracking numbers, one per line",
    });
    modalBody.appendChild(input);

    // Footer
    const modalFooter = createElement("div", "custom-modal-footer");
    const searchButton = createElement("button", "custom-btn custom-btn-primary", "Search");
    const cancelButton = createElement("button", "custom-btn custom-btn-secondary", "Cancel");

    cancelButton.addEventListener("click", () => modal.style.display = "none");

    searchButton.addEventListener("click", async () => {
      try {
        const trackingNumbers = input.value
          .split("\n")
          .map((num) => num.trim())
          .filter(Boolean);

        if (trackingNumbers.length === 0) {
          alert("Please enter at least one tracking number.");
          return;
        }

        searchButton.disabled = true;
        searchButton.textContent = "Processing...";

        const notFoundNumbers = [...trackingNumbers];
        const results = { success: 0, failed: 0, skipped: 0 };

        await searchAndCheck(trackingNumbers, results, notFoundNumbers);

        searchButton.disabled = false;
        searchButton.textContent = "Search";
        modal.style.display = "none";

        showResults(results, notFoundNumbers);
      } catch (error) {
        GM_log("Error during search process: " + error.message);
        alert("An error occurred during the search process: " + error.message);
      }
    });

    modalFooter.append(cancelButton, searchButton);

    modalContent.append(modalHeader, modalBody, modalFooter);

    document.body.appendChild(modal);

    return { modal, input };
  };

  const { modal, input } = createModal();

  /**
   * Handler function to open the modal.
   */
  function openTrackingModal() {
    modal.style.display = "block";
    input.value = "";
    input.focus();
  }

  // Register Tampermonkey Menu Command
  GM_registerMenuCommand("Shopee: Input Tracking", openTrackingModal);
})();