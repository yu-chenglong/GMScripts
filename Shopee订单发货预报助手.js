// ==UserScript==
// @name         Shopee Order Shipment Pre-declaration Helper
// @namespace    https://github.com/yu-chenglong/GMScripts
// @version      2.3.0
// @description  Automate selecting Shopee orders by entering tracking numbers via a Tampermonkey menu
// @author       Yu Chenglong
// @match        https://seller.shopee.cn/*
// @grant        GM_registerMenuCommand
// @grant        GM_log
// @updateURL    https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/Shopee订单发货预报助手.js
// @downloadURL  https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/Shopee订单发货预报助手.js
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const CONFIG = {
    selectors: {
      table: 'table.eds-table__body',
      row: 'tr.eds-table__row',
      checkbox: '.eds-checkbox__input',
    },
    columns: {
      trackingNumber: 3,
    },
    delays: {
      checkbox: 30,
      row: 100,
      highlight: 2000,
      debounce: 500,
    },
    ui: {
      modalMaxWidth: '500px',
      modalWidth: '90%',
      minInputLines: 1,
    },
  };

  // ============================================================================
  // INTERNATIONALIZATION
  // ============================================================================

  const I18N = {
    zh: {
      menu: 'Shopee: 输入物流单号',
      title: '输入物流单号',
      placeholder: '请输入一个或多个物流单号，每行一个',
      tip: '支持批量输入，每行一个单号 • Ctrl+Enter 快捷搜索',
      search: '搜索',
      cancel: '取消',
      processing: '处理中...',
      tableNotFound: '未找到订单表格，请确保页面完全加载',
      noRows: '未找到订单行',
      emptyInput: '请至少输入一个物流单号',
      checkboxNotFound: '未找到复选框 - {num}',
      checkFailed: '勾选失败 - {num}',
      processingError: '单号处理异常 - {num}',
      searchError: '搜索过程异常',
      success: '✅ 新增勾选成功',
      failed: '❌ 勾选失败',
      skipped: '⏭️ 原有已勾选(跳过)',
      notFound: '🔍 无匹配',
      progress: '处理进度',
      logTitle: '异常日志',
      summarySuccess: '新增勾选成功',
      summaryFailed: '勾选失败',
      summarySkipped: '原有已勾选(跳过)',
      summaryNotFound: '无匹配',
    },
    en: {
      menu: 'Shopee: Input Tracking',
      title: 'Enter Tracking Number(s)',
      placeholder: 'Enter one or more tracking numbers, one per line',
      tip: 'Batch input • Ctrl+Enter to search',
      search: 'Search',
      cancel: 'Cancel',
      processing: 'Processing...',
      tableNotFound: 'Order table not found. Please ensure the page is fully loaded.',
      noRows: 'No order rows found.',
      emptyInput: 'Please enter at least one tracking number.',
      checkboxNotFound: 'Checkbox not found - {num}',
      checkFailed: 'Check failed - {num}',
      processingError: 'Processing error - {num}',
      searchError: 'Search error',
      success: '✅ New Checked',
      failed: '❌ Check Failed',
      skipped: '⏭️ Already Checked (Skip)',
      notFound: '🔍 No Match',
      progress: 'Progress',
      logTitle: 'Exception Log',
      summarySuccess: 'New Checked',
      summaryFailed: 'Check Failed',
      summarySkipped: 'Already Checked (Skip)',
      summaryNotFound: 'No Match',
    },
  };

  // ============================================================================
  // UTILITIES
  // ============================================================================

  const Utils = (() => {
    let cachedLang = null;
    const translationCache = new Map();

    const detectLanguage = () => {
      if (cachedLang) return cachedLang;
      try {
        const lang = navigator.language || navigator.userLanguage || 'zh';
        cachedLang = lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
        return cachedLang;
      } catch {
        return 'zh';
      }
    };

    const t = (key, params = {}) => {
      const cacheKey = `${key}_${JSON.stringify(params)}`;
      if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

      const lang = detectLanguage();
      let text = I18N[lang][key] || I18N.en[key] || key;

      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      });

      translationCache.set(cacheKey, text);
      return text;
    };

    const delay = (ms) => new Promise(resolve => {
      ms <= 16 ? requestAnimationFrame(resolve) : setTimeout(resolve, ms);
    });

    const triggerClick = (el) => {
      if (!el) return false;
      try {
        el.click();
        const mouseEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          buttons: 1,
        });
        el.dispatchEvent(mouseEvent);
        const changeEvent = new Event('change', { bubbles: true });
        el.dispatchEvent(changeEvent);
        return true;
      } catch (error) {
        return false;
      }
    };

    const debounce = (fn, delayMs = CONFIG.delays.debounce) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delayMs);
      };
    };

    const parseTrackingNumbers = (input) => {
      const numbers = input
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      return {
        valid: numbers.length >= CONFIG.ui.minInputLines,
        numbers,
      };
    };

    return {
      t,
      delay,
      triggerClick,
      debounce,
      parseTrackingNumbers,
    };
  })();

  // ============================================================================
  // ORDER PROCESSOR
  // ============================================================================

  const OrderProcessor = (() => {
    const highlightCheckbox = (checkbox, onHighlight) => {
      if (onHighlight) onHighlight(checkbox);
      setTimeout(() => {
        if (onHighlight) onHighlight(checkbox, true);
      }, CONFIG.delays.highlight);
    };

    const checkCheckbox = async (checkbox, trackingNumber, onError, onHighlight) => {
      if (!checkbox) {
        onError(Utils.t('checkboxNotFound', { num: trackingNumber }));
        return false;
      }

      if (checkbox.checked) return true;

      try {
        checkbox.click();
        await Utils.delay(CONFIG.delays.checkbox);
        
        const changeEvent = new Event('change', { bubbles: true });
        checkbox.dispatchEvent(changeEvent);
        await Utils.delay(CONFIG.delays.checkbox);
        
        if (checkbox.checked) {
          highlightCheckbox(checkbox, onHighlight);
          return true;
        }
        
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Utils.delay(CONFIG.delays.checkbox);
        
        if (checkbox.checked) {
          highlightCheckbox(checkbox, onHighlight);
          return true;
        }
        
        onError(Utils.t('checkFailed', { num: trackingNumber }));
        return false;
      } catch (error) {
        onError(Utils.t('processingError', { num: trackingNumber }));
        return false;
      }
    };

    const findMatchingRows = (rows, trackingNumbers) => {
      const matches = new Map();
      const notFound = [];

      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length <= CONFIG.columns.trackingNumber) continue;
        const cellText = cells[CONFIG.columns.trackingNumber].textContent.trim();

        for (const num of trackingNumbers) {
          if (!matches.has(num) && cellText.includes(num)) {
            matches.set(num, row);
            break;
          }
        }
      }

      for (const num of trackingNumbers) {
        if (!matches.has(num)) notFound.push(num);
      }

      return { matches, notFound };
    };

    const processOrders = async (trackingNumbers, callbacks) => {
      const { onProgress, onError, onHighlight, onComplete } = callbacks;
      const stats = {
        success: 0,
        failed: 0,
        skipped: 0,
        notFound: [],
      };

      const table = document.querySelector(CONFIG.selectors.table);
      if (!table) {
        onError(Utils.t('tableNotFound'));
        onComplete(stats);
        return stats;
      }

      const rows = Array.from(table.querySelectorAll(CONFIG.selectors.row));
      if (rows.length === 0) {
        onError(Utils.t('noRows'));
        onComplete(stats);
        return stats;
      }

      const { matches, notFound } = findMatchingRows(rows, trackingNumbers);
      stats.notFound = notFound;
      notFound.forEach(num => onError(`${Utils.t('notFound')} - ${num}`));

      const matchList = Array.from(matches.entries());
      const total = matchList.length;

      for (let i = 0; i < total; i++) {
        const [trackingNumber, row] = matchList[i];
        const checkbox = row.querySelector(CONFIG.selectors.checkbox);

        if (!checkbox) {
          stats.failed++;
          onError(Utils.t('checkboxNotFound', { num: trackingNumber }));
        } else if (checkbox.checked) {
          stats.skipped++;
        } else {
          const success = await checkCheckbox(checkbox, trackingNumber, onError, onHighlight);
          success ? stats.success++ : stats.failed++;
        }

        onProgress(i + 1, total);

        if (i < total - 1) {
          await Utils.delay(CONFIG.delays.row);
        }
      }

      onComplete(stats);
      return stats;
    };

    return { processOrders };
  })();

  // ============================================================================
  // SHADOW DOM UI MANAGER
  // ============================================================================

  const UIManager = (() => {
    let shadowRoot = null;
    let elements = {};
    let isProcessing = false;
    let hostElement = null;
    let hasLogEntries = false;  // Track if there are any log entries

    const getStyles = () => `
      :host {
        --primary: #0d6efd;
        --primary-hover: #0b5ed7;
        --danger: #dc3545;
        --success: #198754;
        --warning: #ffc107;
        --info: #0dcaf0;
        --border: #e2e8f0;
        --bg-light: #f8fafc;
        --text: #1e293b;
        --text-muted: #64748b;
        --shadow-lg: 0 20px 35px -8px rgba(0, 0, 0, 0.2);
        --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      .gm-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .gm-modal {
        width: ${CONFIG.ui.modalWidth};
        max-width: ${CONFIG.ui.modalMaxWidth};
        background: white;
        border-radius: 16px;
        box-shadow: var(--shadow-lg);
        animation: gmSlideIn 0.2s ease-out;
        overflow: hidden;
      }

      @keyframes gmSlideIn {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .gm-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: var(--primary);
        color: white;
      }

      .gm-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .gm-close {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0 8px;
        opacity: 0.8;
        transition: opacity 0.2s;
        line-height: 1;
      }

      .gm-close:hover {
        opacity: 1;
      }

      .gm-body {
        padding: 20px;
      }

      .gm-textarea {
        width: 100%;
        min-height: 120px;
        padding: 12px;
        font-size: 14px;
        font-family: 'Monaco', 'Menlo', monospace;
        border: 1px solid var(--border);
        border-radius: 8px;
        resize: vertical;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      .gm-textarea:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
      }

      .gm-tip {
        margin-top: 8px;
        font-size: 12px;
        color: var(--text-muted);
      }

      .gm-progress {
        margin-top: 16px;
        display: none;
      }

      .gm-progress__header {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        margin-bottom: 6px;
        color: var(--text);
      }

      .gm-progress__bar {
        height: 6px;
        background: var(--border);
        border-radius: 3px;
        overflow: hidden;
      }

      .gm-progress__fill {
        height: 100%;
        width: 0%;
        background: var(--primary);
        transition: width 0.2s ease;
        border-radius: 3px;
      }

      /* Log Panel - hidden by default */
      .gm-log {
        margin-top: 16px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg-light);
        overflow: hidden;
        display: none;
      }

      .gm-log__title {
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 600;
        color: var(--danger);
        background: white;
        border-bottom: 1px solid var(--border);
      }

      .gm-log__entries {
        max-height: 200px;
        overflow-y: auto;
        padding: 8px;
        font-size: 12px;
      }

      .gm-log__entry {
        padding: 6px 10px;
        color: var(--text);
        border-radius: 6px;
        word-break: break-all;
        line-height: 1.4;
        margin-bottom: 2px;
      }

      .gm-log__entry--error {
        color: var(--danger);
        background: rgba(220, 53, 69, 0.05);
      }

      .gm-summary {
        margin-top: 12px;
        padding: 12px;
        background: white;
        border-radius: 8px;
        border: 1px solid var(--border);
        display: none;
      }

      .gm-summary__item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border);
        font-size: 13px;
      }

      .gm-summary__item:last-child {
        border-bottom: none;
      }

      .gm-summary__label {
        font-weight: 500;
        color: var(--text);
      }

      .gm-summary__value {
        font-weight: 600;
        font-size: 16px;
      }

      .gm-summary__value--success { color: var(--success); }
      .gm-summary__value--failed { color: var(--danger); }
      .gm-summary__value--skipped { color: var(--warning); }
      .gm-summary__value--notfound { color: var(--text-muted); }

      .gm-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 20px;
        background: var(--bg-light);
        border-top: 1px solid var(--border);
      }

      .gm-btn {
        padding: 8px 20px;
        font-size: 14px;
        font-weight: 500;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .gm-btn--primary {
        background: var(--primary);
        color: white;
      }

      .gm-btn--primary:hover {
        background: var(--primary-hover);
      }

      .gm-btn--primary:disabled {
        background: #94a3b8;
        cursor: not-allowed;
      }

      .gm-btn--secondary {
        background: white;
        color: var(--text);
        border: 1px solid var(--border);
      }

      .gm-btn--secondary:hover {
        background: var(--bg-light);
      }

      .gm-log__entries::-webkit-scrollbar {
        width: 6px;
      }

      .gm-log__entries::-webkit-scrollbar-track {
        background: var(--border);
        border-radius: 3px;
      }

      .gm-log__entries::-webkit-scrollbar-thumb {
        background: var(--text-muted);
        border-radius: 3px;
      }
    `;

    const updateProgress = (current, total) => {
      if (!elements.progressFill || !elements.progressText) return;
      const percent = Math.floor((current / total) * 100);
      elements.progressFill.style.width = `${percent}%`;
      elements.progressText.textContent = `${percent}%`;
    };

    const addLogEntry = (message, isError = false) => {
      if (!elements.logEntries) return;
      
      // Show log panel when first entry is added
      if (!hasLogEntries && elements.logPanel) {
        elements.logPanel.style.display = 'block';
        hasLogEntries = true;
      }
      
      const entry = document.createElement('div');
      entry.className = 'gm-log__entry';
      if (isError) entry.classList.add('gm-log__entry--error');
      entry.textContent = message;
      
      elements.logEntries.appendChild(entry);
      entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const logError = (message) => addLogEntry(message, true);
    
    const displaySummary = (stats) => {
      if (!elements.summaryPanel) return;
      
      const summaryItems = [
        { label: Utils.t('summarySuccess'), value: stats.success, type: 'success' },
        { label: Utils.t('summaryFailed'), value: stats.failed, type: 'failed' },
        { label: Utils.t('summarySkipped'), value: stats.skipped, type: 'skipped' },
        { label: Utils.t('summaryNotFound'), value: stats.notFound.length, type: 'notfound' },
      ];
      
      elements.summaryPanel.innerHTML = '';
      
      summaryItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'gm-summary__item';
        row.innerHTML = `
          <span class="gm-summary__label">${item.label}</span>
          <span class="gm-summary__value gm-summary__value--${item.type}">${item.value}</span>
        `;
        elements.summaryPanel.appendChild(row);
      });
      
      elements.summaryPanel.style.display = 'block';
    };

    const highlightCheckbox = (checkbox, remove = false) => {
      if (remove) {
        checkbox.classList.remove('gm-highlight');
      } else {
        checkbox.classList.add('gm-highlight');
        const style = document.createElement('style');
        style.textContent = `.gm-highlight { outline: 2px solid var(--success, #198754) !important; outline-offset: 2px; transition: outline 0.2s; }`;
        document.head.appendChild(style);
      }
    };

    const resetUI = () => {
      // Reset progress
      if (elements.progressContainer) elements.progressContainer.style.display = 'none';
      if (elements.progressFill) elements.progressFill.style.width = '0%';
      if (elements.progressText) elements.progressText.textContent = '0%';
      
      // Clear and hide log panel
      if (elements.logEntries) elements.logEntries.innerHTML = '';
      if (elements.logPanel) {
        elements.logPanel.style.display = 'none';
      }
      hasLogEntries = false;
      
      // Hide summary panel
      if (elements.summaryPanel) {
        elements.summaryPanel.style.display = 'none';
        elements.summaryPanel.innerHTML = '';
      }
    };

    const handleSearch = Utils.debounce(async () => {
      if (isProcessing) return;

      const { valid, numbers } = Utils.parseTrackingNumbers(elements.input?.value || '');
      if (!valid) {
        logError(Utils.t('emptyInput'));
        return;
      }

      isProcessing = true;
      elements.searchBtn.disabled = true;
      elements.searchBtn.textContent = Utils.t('processing');
      resetUI();
      elements.progressContainer.style.display = 'block';

      await OrderProcessor.processOrders(numbers, {
        onProgress: updateProgress,
        onError: logError,
        onHighlight: highlightCheckbox,
        onComplete: (stats) => {
          displaySummary(stats);
          GM_log(`Complete: +${stats.success} / -${stats.failed} / =${stats.skipped} / ?${stats.notFound.length}`);
        },
      });

      isProcessing = false;
      elements.searchBtn.disabled = false;
      elements.searchBtn.textContent = Utils.t('search');
    }, CONFIG.delays.debounce);

    const closeModal = () => {
      if (elements.overlay) {
        elements.overlay.style.display = 'none';
      }
      isProcessing = false;
    };

    const openModal = () => {
      if (!elements.overlay) return;
      elements.overlay.style.display = 'flex';
      if (elements.input) {
        elements.input.value = '';
        elements.input.focus();
      }
      resetUI();
    };

    const buildShadowDOM = () => {
      hostElement = document.createElement('div');
      document.body.appendChild(hostElement);
      
      shadowRoot = hostElement.attachShadow({ mode: 'closed' });
      
      const styleTag = document.createElement('style');
      styleTag.textContent = getStyles();
      shadowRoot.appendChild(styleTag);
      
      const overlay = document.createElement('div');
      overlay.className = 'gm-overlay';
      overlay.style.display = 'none';
      
      overlay.innerHTML = `
        <div class="gm-modal">
          <div class="gm-header">
            <h3 class="gm-title">${Utils.t('title')}</h3>
            <button class="gm-close" aria-label="Close">&times;</button>
          </div>
          <div class="gm-body">
            <textarea class="gm-textarea" placeholder="${Utils.t('placeholder')}" rows="5"></textarea>
            <div class="gm-tip">${Utils.t('tip')}</div>
            <div class="gm-progress">
              <div class="gm-progress__header">
                <span>${Utils.t('progress')}</span>
                <span class="gm-progress__text">0%</span>
              </div>
              <div class="gm-progress__bar">
                <div class="gm-progress__fill"></div>
              </div>
            </div>
            <div class="gm-summary"></div>
            <div class="gm-log">
              <div class="gm-log__title">${Utils.t('logTitle')}</div>
              <div class="gm-log__entries"></div>
            </div>
          </div>
          <div class="gm-footer">
            <button class="gm-btn gm-btn--secondary">${Utils.t('cancel')}</button>
            <button class="gm-btn gm-btn--primary">${Utils.t('search')}</button>
          </div>
        </div>
      `;
      
      shadowRoot.appendChild(overlay);
      
      elements = {
        overlay,
        input: shadowRoot.querySelector('.gm-textarea'),
        progressContainer: shadowRoot.querySelector('.gm-progress'),
        progressFill: shadowRoot.querySelector('.gm-progress__fill'),
        progressText: shadowRoot.querySelector('.gm-progress__text'),
        logEntries: shadowRoot.querySelector('.gm-log__entries'),
        logPanel: shadowRoot.querySelector('.gm-log'),
        summaryPanel: shadowRoot.querySelector('.gm-summary'),
        closeBtn: shadowRoot.querySelector('.gm-close'),
        cancelBtn: shadowRoot.querySelector('.gm-btn--secondary'),
        searchBtn: shadowRoot.querySelector('.gm-btn--primary'),
      };
      
      // Initially hide log panel
      if (elements.logPanel) elements.logPanel.style.display = 'none';
      if (elements.summaryPanel) elements.summaryPanel.style.display = 'none';
      
      elements.closeBtn.addEventListener('click', closeModal);
      elements.cancelBtn.addEventListener('click', closeModal);
      elements.searchBtn.addEventListener('click', handleSearch);
      
      elements.input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSearch();
        }
      });
      
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    };

    const init = () => {
      buildShadowDOM();
    };

    return { init, openModal };
  })();

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const init = () => {
    try {
      const start = () => {
        UIManager.init();
        GM_registerMenuCommand(Utils.t('menu'), () => UIManager.openModal());
        GM_log('✅ Shopee Order Shipment Helper v2.5.2 (Shadow DOM) initialized');
      };

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        start();
      } else {
        document.addEventListener('DOMContentLoaded', start);
      }
    } catch (error) {
      GM_log(`❌ Initialization failed: ${error.message}`);
    }
  };

  init();
})();