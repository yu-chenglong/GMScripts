// ==UserScript==
// @name         Shopee订单发货预报助手
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  在Shopee卖家中心通过油猴菜单输入追踪号并自动勾选对应订单
// @author       Leo
// @match        https://seller.shopee.cn/*
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_log
// ==/UserScript==

(function () {
    "use strict";

    // 添加自定义 CSS 样式
    GM_addStyle(`
        .custom-modal {
            display: none;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0,0,0,0.4);
        }

        .custom-modal-dialog {
            margin: 15% auto;
            width: 80%;
            max-width: 500px;
        }

        .custom-modal-content {
            background-color: #fefefe;
            border: 1px solid #888;
            border-radius: 0.3rem;
            box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);
        }

        .custom-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem;
            border-bottom: 1px solid #dee2e6;
            background-color: #0d6efd;
            color: #fff;
        }

        .custom-modal-title {
            margin-bottom: 0;
            line-height: 1.5;
            font-size: 1.5rem;
            font-weight: 1000;
        }

        .custom-close {
            padding: 1rem;
            margin: -1rem -1rem -1rem auto;
            background-color: transparent;
            border: 0;
            font-size: 1.5rem;
            font-weight: 700;
            line-height: 1;
            color: #fff;
            text-shadow: 0 1px 0 #fff;
            opacity: .5;
        }

        .custom-close:hover {
            color: #000;
            text-decoration: none;
            opacity: .75;
        }

        .custom-modal-body {
            position: relative;
            padding: 1rem;
        }

        .custom-modal-footer {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: flex-end;
            padding: 0.75rem;
            border-top: 1px solid #dee2e6;
        }

        .custom-btn {
            margin: 0.5em;
            display: inline-block;
            font-weight: 400;
            color: #212529;
            text-align: center;
            vertical-align: middle;
            cursor: pointer;
            user-select: none;
            background-color: transparent;
            border: 1px solid transparent;
            padding: 0.375rem 0.75rem;
            font-size: 1.5rem;
            line-height: 1.5;
            border-radius: 0.25rem;
            transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        .custom-btn-primary {
            color: #fff;
            background-color: #0d6efd;
            border-color: #0d6efd;
        }

        .custom-btn-primary:hover {
            color: #fff;
            background-color: #0b5ed7;
            border-color: #0a58ca;
        }

        .custom-btn-secondary {
            color: #fff;
            background-color: #6c757d;
            border-color: #6c757d;
        }

        .custom-btn-secondary:hover {
            color: #fff;
            background-color: #5c636a;
            border-color: #565e64;
        }

        .custom-form-control {
            display: block;
            width: 100%;
            padding: 0.375rem 0.75rem;
            font-size: 1.5rem;
            font-weight: 400;
            line-height: 1.5;
            color: #212529;
            background-color: #fff;
            background-clip: padding-box;
            border: 1px solid #ced4da;
            border-radius: 0.25rem;
            transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
            min-height: 250px; /* 增加输入框高度 */
            resize: vertical; /* 允许垂直调整大小 */
        }

        .custom-form-control:focus {
            color: #212529;
            background-color: #fff;
            border-color: #86b7fe;
            outline: 0;
            box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
        }

        .debug-checkbox {
            outline: 2px solid red !important;
        }

        .checked-checkbox {
            outline: 2px solid green !important;
        }
    `);

    const getWindow = () =>
        typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

    const triggerMouseEvent = (element, eventType) => {
        if (!element) {
            console.log(`无法触发 ${eventType} 事件：元素不存在`);
            return;
        }
        try {
            const rect = element.getBoundingClientRect();
            const event = new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: getWindow(),
                detail: 1,
                screenX: rect.left + 5,
                screenY: rect.top + 5,
                clientX: rect.left + 5,
                clientY: rect.top + 5,
                button: 0,
                relatedTarget: null,
            });
            element.dispatchEvent(event);
            console.log(`触发 ${eventType} 事件`);
        } catch (error) {
            console.error(`触发 ${eventType} 事件时出错:`, error);
        }
    };

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const checkCheckbox = async (checkbox, trackingNumber) => {
        if (!checkbox) {
            console.log(`无法勾选复选框：元素不存在 (${trackingNumber})`);
            return false;
        }
        console.log(`开始勾选复选框: ${trackingNumber}`);
        checkbox.classList.add("debug-checkbox");

        try {
            const initialState = checkbox.checked;

            // 按顺序执行事件序列
            triggerMouseEvent(checkbox, "click");
            await delay(20); // 等待一段时间让框架处理变更

            // 手动触发 change 事件，确保框架能接收到状态变更
            const changeEvent = new Event("change", { bubbles: true });
            checkbox.dispatchEvent(changeEvent);

            // 等待一段时间让框架处理变更
            await delay(20);

            // 验证最终状态
            const finalState = checkbox.checked;
            const isSuccess = finalState !== initialState;

            if (isSuccess) {
                console.log(`✅ 成功勾选复选框: ${trackingNumber}`);
                checkbox.classList.remove("debug-checkbox");
                checkbox.classList.add("checked-checkbox");

                setTimeout(() => {
                    checkbox.classList.remove("checked-checkbox");
                }, 3000);
            } else {
                console.log(`❌ 勾选失败: ${trackingNumber} (状态未改变)`);
            }

            return isSuccess;
        } catch (error) {
            console.error(`勾选复选框时出错 (${trackingNumber}):`, error);
            return false;
        }
    };

    const createModal = () => {
        // 创建模态框
        const modal = document.createElement("div");
        modal.classList.add("custom-modal");
        modal.id = "trackingNumberModal";
        document.body.appendChild(modal);

        const modalDialog = document.createElement("div");
        modalDialog.classList.add("custom-modal-dialog");
        modal.appendChild(modalDialog);

        const modalContent = document.createElement("div");
        modalContent.classList.add("custom-modal-content");
        modalDialog.appendChild(modalContent);

        const modalHeader = document.createElement("div");
        modalHeader.classList.add("custom-modal-header");
        modalContent.appendChild(modalHeader);

        const modalTitle = document.createElement("h5");
        modalTitle.classList.add("custom-modal-title");
        modalTitle.textContent = "输入追踪号";
        modalHeader.appendChild(modalTitle);

        const closeButton = document.createElement("button");
        closeButton.classList.add("custom-close");
        closeButton.setAttribute("aria-label", "Close");
        closeButton.innerHTML = "&times;";
        closeButton.addEventListener("click", () => {
            modal.style.display = "none";
        });
        modalHeader.appendChild(closeButton);

        const modalBody = document.createElement("div");
        modalBody.classList.add("custom-modal-body");
        modalContent.appendChild(modalBody);

        const input = document.createElement("textarea");
        input.classList.add("custom-form-control");
        input.placeholder = "请输入一个或多个包裹追踪号，每行一个";
        modalBody.appendChild(input);

        const modalFooter = document.createElement("div");
        modalFooter.classList.add("custom-modal-footer");
        modalContent.appendChild(modalFooter);

        const searchButton = document.createElement("button");
        searchButton.classList.add("custom-btn", "custom-btn-primary");
        searchButton.textContent = "搜索";
        searchButton.addEventListener("click", async () => {
            try {
                console.log("搜索按钮点击事件触发");
                const trackingNumbers = input.value
                    .split("\n")
                    .map((num) => num.trim())
                    .filter((num) => num);
                console.log("追踪号列表:", trackingNumbers);

                if (trackingNumbers.length === 0) {
                    alert("请输入至少一个追踪号");
                    return;
                }

                searchButton.disabled = true;
                searchButton.textContent = "处理中...";

                const notFoundNumbers = [...trackingNumbers];
                const results = { success: 0, failed: 0, skipped: 0 };

                await searchAndCheck(trackingNumbers, results, notFoundNumbers);

                searchButton.disabled = false;
                searchButton.textContent = "搜索";
                modal.style.display = "none";

                showResults(results, notFoundNumbers);
            } catch (error) {
                console.error("搜索过程中出错:", error);
                alert("搜索过程中出错: " + error.message);
            }
        });
        modalFooter.appendChild(searchButton);

        const cancelButton = document.createElement("button");
        cancelButton.classList.add("custom-btn", "custom-btn-secondary");
        cancelButton.textContent = "取消";
        cancelButton.addEventListener("click", () => {
            modal.style.display = "none";
        });
        modalFooter.appendChild(cancelButton);

        return { modal, input };
    };

    const searchAndCheck = async (trackingNumbers, results, notFoundNumbers) => {
        console.log("开始搜索和勾选操作");

        // 查找表格
        const table = document.querySelector("table.eds-table__body");
        if (!table) {
            console.log("未找到订单表格");
            alert("未找到订单表格，请确保页面已完全加载");
            return;
        }
        console.log("已找到订单表格");

        // 查找包裹追踪号列的索引
        const headerRow = document.querySelector(
            "table.eds-table__header thead tr"
        );
        if (!headerRow) {
            console.log("未找到表格头部");
            alert("未找到表格头部，请确保页面已完全加载");
            return;
        }

        const headers = Array.from(headerRow.querySelectorAll("th"));
        let trackingNumberIndex = -1;
        headers.forEach((header, index) => {
            const label = header.querySelector(".eds-table__cell-label");
            if (label && label.textContent === "包裹追踪号") {
                trackingNumberIndex = index;
            }
        });

        if (trackingNumberIndex === -1) {
            console.log('未找到"包裹追踪号"列');
            alert('未找到"包裹追踪号"列，请检查页面结构是否已更新');
            return;
        }
        console.log(`"包裹追踪号"列索引: ${trackingNumberIndex}`);

        // 遍历每一行，搜索追踪号
        const rows = table.querySelectorAll("tr.eds-table__row");
        console.log(`找到 ${rows.length} 个订单行`);

        if (rows.length === 0) {
            alert("未找到任何订单行");
            return;
        }

        // 创建匹配的行列表
        const matchingRows = [];

        rows.forEach((row) => {
            const cells = row.querySelectorAll("td");
            const trackingNumberCell = cells[trackingNumberIndex];
            if (!trackingNumberCell) return;

            const trackingNumber = trackingNumberCell.textContent.trim();

            trackingNumbers.forEach((num) => {
                if (trackingNumber.includes(num)) {
                    matchingRows.push({ row, trackingNumber: num });

                    // 从"未找到"列表中移除
                    const index = notFoundNumbers.indexOf(num);
                    if (index > -1) {
                        notFoundNumbers.splice(index, 1);
                    }
                }
            });
        });

        console.log(`找到 ${matchingRows.length} 个匹配的订单`);

        if (matchingRows.length === 0) {
            alert(`未找到任何匹配的追踪号`);
            return;
        }

        // 顺序处理匹配的行
        for (const { row, trackingNumber } of matchingRows) {
            console.log(`处理订单: ${trackingNumber}`);
            await processRow(row, trackingNumber, results);
            await delay(500); // 处理间隔，避免过快
        }
    };

    const processRow = async (row, trackingNumber, results) => {
        const checkbox = row.querySelector(".eds-checkbox__input");

        if (!checkbox) {
            console.log(`❌ 未找到复选框元素: ${trackingNumber}`);
            results.skipped++;
            return;
        }

        // 检查复选框当前状态
        const initialState = checkbox.checked;
        console.log(`复选框初始状态: ${initialState ? "已勾选" : "未勾选"}`);

        // 如果已经是目标状态，则跳过
        if (initialState) {
            console.log(`✅ 复选框已勾选，跳过: ${trackingNumber}`);
            results.skipped++;
            return;
        }

        // 尝试勾选
        const isSuccess = await checkCheckbox(checkbox, trackingNumber);

        if (isSuccess) {
            results.success++;
        } else {
            results.failed++;
        }
    };

    const showResults = (results, notFoundNumbers) => {
        // 显示结果统计
        let message = `处理完成!\n成功勾选: ${results.success}\n勾选失败: ${results.failed}\n未找到: ${notFoundNumbers.length}`;

        if (notFoundNumbers.length > 0) {
            message += `\n\n未找到的追踪号 (${notFoundNumbers.length
                }):\n${notFoundNumbers.join("\n")}`;
        }

        alert(message);
        console.log(message);
    };

    const { modal, input } = createModal();

    // 注册油猴菜单命令
    GM_registerMenuCommand("输入追踪号", () => {
        modal.style.display = "block";
        input.focus();
    });
})();
