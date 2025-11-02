/* 这是 header.js 的全部内容 */

/* --- 1. 新增：Logo 切换逻辑 --- */
// 你的 Logo 列表，你可以按需添加任意多张图片
const logoList = [
    "/lmodel1.gif",
    "/lmodel2.gif",
    "/lmodel3.gif"
    // "/lmodel4.gif"
];

// 追踪当前 Logo 的索引。
// 因为 header.html 默认是 "lmodel2.gif"，所以索引从 1 开始
let currentLogoIndex = 1;

function switchLogo() {
    // 1. 索引+1
    currentLogoIndex = currentLogoIndex + 1;

    // 2. 如果索引超出了数组范围，就循环回 0
    if (currentLogoIndex >= logoList.length) {
        currentLogoIndex = 0;
    }

    // 3. 找到页面上的 Logo 图片元素
    // (注意：必须在 header.html 加载完成后才能找到它)
    const logoImage = document.getElementById("main-logo");

    // 4. 如果找到了图片，就更新它的 src 属性
    if (logoImage) {
        logoImage.src = logoList[currentLogoIndex];
    } else {
        console.error("错误: 找不到ID为 'main-logo' 的元素。");
    }
}
/* --- Logo 切换逻辑结束 --- */


/* --- 2. 负责加载 header.html 的函数 --- */
document.addEventListener("DOMContentLoaded", function () {
    loadHeader();
});

function loadHeader() {
    var headerPlaceholder = document.getElementById("header-placeholder");
    if (!headerPlaceholder) {
        console.error("错误: 找不到ID为 'header-placeholder' 的元素。");
        return;
    }

    fetch("/header.html")
        .then(response => {
            if (response.ok) {
                return response.text();
            }
            throw new Error('网络响应失败。');
        })
        .then(html => {
            headerPlaceholder.innerHTML = html;
        })
        .catch(error => {
            console.error('抓取 header.html 出错:', error);
            headerPlaceholder.innerHTML = "<p style='color:red;'>菜单加载失败。</p>";
        });
}

/* --- 3. 负责下拉菜单的JS --- */
function toggleDropdown(id) {
    var allDropdowns = document.getElementsByClassName('dropdown-content');
    for (var i = 0; i < allDropdowns.length; i++) {
        if (allDropdowns[i].id !== id) {
            allDropdowns[i].classList.remove('show');
        }
    }

    var targetDropdown = document.getElementById(id);
    if (targetDropdown) {
        targetDropdown.classList.toggle('show');
    }
}

/* --- 4. 负责点击外部关闭菜单的JS --- */
document.addEventListener('click', function (event) {
    // 检查点击的元素是否在 .dropdown-container 内部
    // 同时检查点击的是否是 Logo 本身
    if (!event.target.closest('.dropdown-container') && !event.target.closest('#main-logo')) {
        var allDropdowns = document.getElementsByClassName('dropdown-content');
        for (var i = 0; i < allDropdowns.length; i++) {
            allDropdowns[i].classList.remove('show');
        }
    }
});