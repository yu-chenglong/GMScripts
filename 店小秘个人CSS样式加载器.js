// ==UserScript==
// @name         店小秘个人CSS样式加载器
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  使用对象格式集中管理并加载针对店小秘域名的所有个人自定义CSS样式
// @author       You
// @match        https://www.dianxiaomi.com/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// ==/UserScript==

(() => {
  "use strict";

  // 使用对象格式集中定义所有CSS规则
  const CUSTOM_CSS = {
    // 模态框样式
    modal: {
      enabled: true,
      rules: {
        ".modal-dialog": {
          "width": "1100px",
          "max-width": "90%",
          "transition": "width 0.3s ease",
        },
        ".modal-body.tab-content": {
          "max-height": "700px",
          "overflow-y": "auto",
          "padding": "15px",
        },
        ".modal-header": {
          "background-color": "#f8f9fa",
          "border-bottom": "1px solid #dee2e6",
        },
        ".templateOrderRemark": {
          "display": "none"
        },
        "table#batchCommentTable > tbody > tr > th:nth-child(1)": {
          "display": "none"
        },
        "table#batchCommentTable > tbody > tr > th:nth-child(4)": {
          "display": "none"
        },
        "table#batchCommentTable > tbody > tr > th:nth-child(5)": {
          "display": "none"
        },
        "table#batchCommentTable > tbody > tr > td:nth-child(1)": {
          "display": "none"
        },
        "table#batchCommentTable > tbody > tr > td:nth-child(4)": {
          "display": "none"
        },
        "table#batchCommentTable > tbody > tr > td:nth-child(5)": {
          "display": "none"
        },
        "table#batchCommentTable > tbody > tr > td:nth-child(3)": {
          "min-width": "300px"
        },
      },
    },

    // 可扩展更多样式组...
  };

  // CSS管理器
  const CssManager = {
    convertObjectToCssString(cssObject) {
      return Object.entries(cssObject)
        .map(([selector, properties]) => {
          const rules = Object.entries(properties)
            .map(([property, value]) => `  ${property}: ${value} !important;`)
            .join("\n");

          return `${selector} {\n${rules}\n}`;
        })
        .join("\n\n");
    },

    loadAllStyles() {
      Object.entries(CUSTOM_CSS).forEach(([section, config]) => {
        if (config.enabled && config.rules) {
          try {
            const cssString = this.convertObjectToCssString(config.rules);
            GM_addStyle(cssString);
            console.log(`[样式加载] ${section} 已启用`);
          } catch (error) {
            console.error(`[样式错误] ${section} 加载失败:`, error);
          }
        }
      });
    },

    // 其他方法保持不变...
  };

  // DOM工具
  const DOMUtils = {
    // 等待特定元素加载完成
    waitForElement(selector, timeout = 10000) {
      return new Promise((resolve, reject) => {
        if (document.querySelector(selector)) {
          return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver((mutations) => {
          if (document.querySelector(selector)) {
            observer.disconnect();
            resolve(document.querySelector(selector));
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });

        setTimeout(() => {
          observer.disconnect();
          reject(new Error(`元素 ${selector} 加载超时`));
        }, timeout);
      });
    },

    // 创建调试面板
    createDebugPanel() {
      const panel = document.createElement("div");
      panel.id = "custom-css-debug-panel";
      panel.style = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 9999;
                font-size: 12px;
                max-width: 300px;
            `;

      panel.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px;">自定义CSS面板</div>
                <div id="custom-css-status">状态: 已加载</div>
                <div id="custom-css-sections" style="margin-top: 10px;"></div>
            `;

      document.body.appendChild(panel);
      return panel;
    },

    // 创建样式组开关
    createSectionToggle(sectionName, isEnabled, callback) {
      const toggle = document.createElement("div");
      toggle.style = "margin-bottom: 5px; display: flex; align-items: center;";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `section-${sectionName}`;
      checkbox.checked = isEnabled;
      checkbox.style = "margin-right: 5px;";

      const label = document.createElement("label");
      label.htmlFor = `section-${sectionName}`;
      label.textContent = sectionName;

      checkbox.addEventListener("change", () =>
        callback(sectionName, checkbox.checked)
      );

      toggle.appendChild(checkbox);
      toggle.appendChild(label);
      return toggle;
    },
  };

  // 主应用
  class CustomCSSLoader {
    constructor() {
      this.debugPanel = null;
      this.isDebugMode = false;
    }

    init() {
      // 注册油猴菜单命令
      this.registerMenuCommands();

      // 从本地存储加载调试模式状态
      this.loadDebugModeState();

      // 加载所有样式
      CssManager.loadAllStyles();

      // 创建调试面板（如果启用）
      if (this.isDebugMode) {
        this.createDebugInterface();
      }

      console.log(
        "[个人CSS加载器] 已启动，共加载",
        Object.values(CUSTOM_CSS).filter((s) => s.enabled).length,
        "个样式组"
      );
    }

    // 注册油猴菜单命令
    registerMenuCommands() {
      GM_registerMenuCommand("切换调试面板", () => this.toggleDebugMode());

      GM_registerMenuCommand("重新加载样式", () => {
        CssManager.reloadStyles();
        console.log("[样式重载] 所有CSS规则已重新应用");
      });
    }

    // 加载调试模式状态
    loadDebugModeState() {
      try {
        const savedState = localStorage.getItem("dianxiaomi_css_debug_mode");
        this.isDebugMode = savedState === "true";
      } catch (error) {
        console.error("无法从本地存储加载调试模式状态:", error);
        this.isDebugMode = false;
      }
    }

    // 保存调试模式状态
    saveDebugModeState() {
      try {
        localStorage.setItem("dianxiaomi_css_debug_mode", this.isDebugMode);
      } catch (error) {
        console.error("无法保存调试模式状态:", error);
      }
    }

    // 切换调试模式
    toggleDebugMode() {
      this.isDebugMode = !this.isDebugMode;
      this.saveDebugModeState();

      if (this.isDebugMode) {
        this.createDebugInterface();
        console.log("[调试模式] 已启用");
      } else {
        this.removeDebugInterface();
        console.log("[调试模式] 已禁用");
      }
    }

    // 创建调试界面
    createDebugInterface() {
      // 如果已有面板则先移除
      this.removeDebugInterface();

      this.debugPanel = DOMUtils.createDebugPanel();
      const sectionsContainer = document.getElementById("custom-css-sections");

      // 添加样式组开关
      Object.entries(CUSTOM_CSS).forEach(([sectionName, config]) => {
        const toggle = DOMUtils.createSectionToggle(
          sectionName,
          config.enabled,
          (name, isEnabled) => {
            if (isEnabled) {
              CssManager.enableSection(name);
            } else {
              CssManager.disableSection(name);
            }

            // 更新状态显示
            const count = Object.values(CUSTOM_CSS).filter(
              (s) => s.enabled
            ).length;
            document.getElementById(
              "custom-css-status"
            ).textContent = `状态: 已加载 ${count} 个样式组`;
          }
        );

        sectionsContainer.appendChild(toggle);
      });

      // 更新状态显示
      const count = Object.values(CUSTOM_CSS).filter((s) => s.enabled).length;
      document.getElementById(
        "custom-css-status"
      ).textContent = `状态: 已加载 ${count} 个样式组`;
    }

    // 移除调试界面
    removeDebugInterface() {
      const existingPanel = document.getElementById("custom-css-debug-panel");
      if (existingPanel) {
        existingPanel.remove();
      }
      this.debugPanel = null;
    }
  }

  // 安全启动应用
  const startApp = () => {
    try {
      if (!unsafeWindow.__DXM_CUSTOM_CSS__) {
        const app = new CustomCSSLoader();
        app.init();
        unsafeWindow.__DXM_CUSTOM_CSS__ = app;
      }
    } catch (error) {
      console.error("[个人CSS加载器] 启动失败:", error);
    }
  };

  // 根据页面加载状态启动
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
  } else {
    startApp();
  }
})();
