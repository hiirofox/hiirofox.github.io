/* 这是 header.js 的全部内容 */

/* --- 1. 负责加载 header.html 的函数 --- */

// 监听DOM加载完成事件，一旦完成就执行 loadHeader
document.addEventListener("DOMContentLoaded", function () {
    loadHeader();
});

function loadHeader() {
    // 1. 找到页面上 ID 为 'header-placeholder' 的占位符
    var headerPlaceholder = document.getElementById("header-placeholder");
    if (!headerPlaceholder) {
        console.error("错误: 找不到ID为 'header-placeholder' 的元素。");
        return;
    }

    // 2. 异步抓取 "header.html" 文件的内容
    fetch("header.html")
        .then(response => {
            // 检查是否成功抓取
            if (response.ok) {
                return response.text();
            }
            throw new Error('网络响应失败。');
        })
        .then(html => {
            // 3. 将抓取到的HTML文本内容，注入到占位符中
            headerPlaceholder.innerHTML = html;
        })
        .catch(error => {
            console.error('抓取 header.html 出错:', error);
            headerPlaceholder.innerHTML = "<p style='color:red;'>菜单加载失败。</p>";
        });
}

/* --- 2. 负责下拉菜单的JS (来自你的<script>块) --- */

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

/* --- 3. 负责点击外部关闭菜单的JS (附加到document) --- */

document.addEventListener('click', function (event) {
    // 检查点击的元素是否在 .dropdown-container 内部
    if (!event.target.closest('.dropdown-container')) {
        // 如果不在，就关闭所有菜单
        var allDropdowns = document.getElementsByClassName('dropdown-content');
        for (var i = 0; i < allDropdowns.length; i++) {
            allDropdowns[i].classList.remove('show');
        }
    }
});