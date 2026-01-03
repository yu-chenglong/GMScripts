// ==UserScript==
// @name         DianXiaoMi Helper
// @namespace    https://github.com/yu-chenglong/GMScripts
// @version      1.0.0
// @description  DianXiaoMi Helper
// @author       Yu Chenglong
// @match        https://www.dianxiaomi.com/*
// @grant        GM_addStyle
// @grant        GM_log
// @updateURL    https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/店小秘助手.js
// @downloadURL  https://raw.githubusercontent.com/yu-chenglong/GMScripts/master/店小秘助手.js
// ==/UserScript==

(function () {
    'use strict';

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

    const createTipBox = () => {
        let tipBox = document.getElementById('img-copy-tip');
        if (!tipBox) {
            tipBox = document.createElement('div');
            tipBox.id = 'img-copy-tip';
            tipBox.textContent = '✅ 复制成功！';
            document.body.appendChild(tipBox);
        }
        return tipBox;
    };
    const tipBox = createTipBox();

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('复制失败:', err);
            return false;
        }
    };

    const showTip = (x, y) => {
        tipBox.style.left = `${x + 10}px`;
        tipBox.style.top = `${y + 10}px`;
        tipBox.classList.add('show');
        setTimeout(() => tipBox.classList.remove('show'), 1500);
    };

    // ✅ 核心新增：移除图片URL末尾的_tn后缀方法
    const removeTnSuffix = (imgUrl) => {
        if (typeof imgUrl !== 'string' || !imgUrl) return imgUrl;
        // 精准匹配URL末尾的 _tn 并移除，不影响其他内容
        return imgUrl.endsWith('_tn') ? imgUrl.slice(0, -3) : imgUrl;
    };

    const handleImageClick = async (e, img) => {
        e.preventDefault();
        e.stopPropagation();

        let imgUrl = img.src || img.dataset.src || img.getAttribute('data-original') || '';
        if (!imgUrl) return;

        // ✅ 关键调用：处理URL，自动移除末尾_tn
        imgUrl = removeTnSuffix(imgUrl);
        const formatText = `![|150](${imgUrl})`;

        const isSuccess = await copyToClipboard(formatText);
        if (isSuccess) {
            showTip(e.clientX, e.clientY);
        }
    };

    const bindImageClick = (imgElement) => {
        if (imgElement.dataset.hasBindClick) return;
        imgElement.addEventListener('click', (e) => handleImageClick(e, imgElement));
        imgElement.dataset.hasBindClick = 'true';
    };

    document.querySelectorAll('img').forEach(img => bindImageClick(img));

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.tagName === 'IMG') {
                        bindImageClick(node);
                    } else {
                        node.querySelectorAll('img').forEach(img => bindImageClick(img));
                    }
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();