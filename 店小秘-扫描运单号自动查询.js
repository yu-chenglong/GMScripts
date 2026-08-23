// ==UserScript==
// @name         店小秘-扫描运单号自动查询
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  在店小秘扫描发货页面，扫描运单号后自动查询
// @author       Yu Chenglong
// @match        https://www.dianxiaomi.com/web/package/scanPackShipped
// @grant        none
// @updateURL    https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/店小秘-扫描运单号自动查询.js
// @downloadURL  https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/店小秘-扫描运单号自动查询.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const DEBOUNCE_DELAY = 300; // 防抖延迟（毫秒），可根据扫描枪速度调整

    let timer = null;

    // 等待输入框渲染（因为页面可能动态加载）
    const waitForInput = () => {
        const input = document.getElementById('scanShippingInput');
        if (!input) {
            // 若输入框尚未出现，100ms 后重试（最多重试10次）
            let retries = 0;
            const maxRetries = 10;
            const interval = setInterval(() => {
                const inp = document.getElementById('scanShippingInput');
                if (inp) {
                    clearInterval(interval);
                    attachListener(inp);
                } else if (++retries >= maxRetries) {
                    clearInterval(interval);
                    console.warn('未找到扫描输入框，脚本停止');
                }
            }, 200);
            return;
        }
        attachListener(input);
    };

    const attachListener = (input) => {
        // 查找“查询”按钮（通过文本内容）
        const getQueryButton = () => {
            const buttons = document.querySelectorAll('button.ant-btn-primary');
            for (let btn of buttons) {
                if (btn.textContent.trim() === '查询') {
                    return btn;
                }
            }
            return null;
        };

        const triggerQuery = () => {
            const btn = getQueryButton();
            if (btn) {
                btn.click();
                // 如果需要自动清空输入框，取消下面注释
                // input.value = '';
            } else {
                console.warn('未找到查询按钮');
            }
        };

        // 防抖处理输入事件
        input.addEventListener('input', function (e) {
            if (timer) clearTimeout(timer);
            // 如果输入框为空，可提前返回（根据需求决定）
            // if (this.value.trim() === '') return;

            timer = setTimeout(() => {
                if (this.value.trim() !== '') {
                    triggerQuery();
                }
                timer = null;
            }, DEBOUNCE_DELAY);
        });

        console.log('自动查询脚本已启动（电小蜜扫描页）');
    };

    // 页面加载完成后开始等待输入框
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        waitForInput();
    } else {
        window.addEventListener('load', waitForInput);
    }
})();