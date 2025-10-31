/* ���� header.js ��ȫ������ */

/* --- 1. ������� header.html �ĺ��� --- */

// ����DOM��������¼���һ����ɾ�ִ�� loadHeader
document.addEventListener("DOMContentLoaded", function () {
    loadHeader();
});

function loadHeader() {
    // 1. �ҵ�ҳ���� ID Ϊ 'header-placeholder' ��ռλ��
    var headerPlaceholder = document.getElementById("header-placeholder");
    if (!headerPlaceholder) {
        console.error("����: �Ҳ���IDΪ 'header-placeholder' ��Ԫ�ء�");
        return;
    }

    // 2. �첽ץȡ "header.html" �ļ�������
    fetch("header.html")
        .then(response => {
            // ����Ƿ�ɹ�ץȡ
            if (response.ok) {
                return response.text();
            }
            throw new Error('������Ӧʧ�ܡ�');
        })
        .then(html => {
            // 3. ��ץȡ����HTML�ı����ݣ�ע�뵽ռλ����
            headerPlaceholder.innerHTML = html;
        })
        .catch(error => {
            console.error('ץȡ header.html ����:', error);
            headerPlaceholder.innerHTML = "<p style='color:red;'>�˵�����ʧ�ܡ�</p>";
        });
}

/* --- 2. ���������˵���JS (�������<script>��) --- */

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

/* --- 3. �������ⲿ�رղ˵���JS (���ӵ�document) --- */

document.addEventListener('click', function (event) {
    // �������Ԫ���Ƿ��� .dropdown-container �ڲ�
    if (!event.target.closest('.dropdown-container')) {
        // ������ڣ��͹ر����в˵�
        var allDropdowns = document.getElementsByClassName('dropdown-content');
        for (var i = 0; i < allDropdowns.length; i++) {
            allDropdowns[i].classList.remove('show');
        }
    }
});