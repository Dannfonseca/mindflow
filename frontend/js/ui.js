/*
  Arquivo: /js/ui.js
  Descrição: Adicionada uma classe ao body quando o menu lateral mobile está aberto, para permitir um controle de layout mais robusto via CSS.
*/
let UIElements;
let onSaveLinksCallback;

function init(elements) {
    UIElements = elements;
    applyFontSize(localStorage.getItem('fontSize') || 'medium');
    setupEventListeners();
}

function showNotification(message, type = 'success') {
    if (!UIElements.notificationContainer) return;

    const notif = document.createElement('div');
    notif.className = `notification notification--${type}`;

    const iconName = type === 'success' ? 'check_circle' : 'error';
    const icon = `<span class="material-icons notification__icon">${iconName}</span>`;
    
    const content = `<div class="notification__content"><p class="notification__message">${message}</p></div>`;
    
    const closeBtn = `<button class="notification__close"><span class="material-icons">close</span></button>`;

    notif.innerHTML = icon + content + closeBtn;
    
    UIElements.notificationContainer.appendChild(notif);

    const removeNotif = () => {
        notif.classList.add('fade-out');
        notif.addEventListener('animationend', () => notif.remove());
    };

    notif.querySelector('.notification__close').addEventListener('click', removeNotif);

    if (type === 'success') {
        setTimeout(removeNotif, 4000);
    }
}

function applyTheme(theme) {
    if (!UIElements || !UIElements.body) return;
    UIElements.body.classList.toggle('dark-mode', theme === 'dark');
    localStorage.setItem('theme', theme);
    if (UIElements.themeToggle) UIElements.themeToggle.checked = (theme === 'dark');
}

function applyFontSize(size) {
    if (!UIElements || !UIElements.body) return;
    UIElements.body.classList.remove('font-size-medium', 'font-size-large');
    UIElements.body.classList.add(`font-size-${size || 'medium'}`);
    localStorage.setItem('fontSize', size || 'medium');
    UIElements.fontSizeOptions.querySelectorAll('.font-size-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === (size || 'medium'));
    });
}

function switchView(targetId, onSwitchCallback) {
    UIElements.appViews.forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(targetId);
    if (targetView) targetView.classList.add('active');
    
    UIElements.sidebarLinks.forEach(l => l.classList.toggle('active', l.getAttribute('data-target') === targetId));
    
    if (onSwitchCallback) {
        onSwitchCallback(targetId);
    }
}

function toggleSidebar() {
    if(!UIElements.sidebar || !UIElements.sidebarOverlay) return;
    const isOpen = UIElements.sidebar.classList.toggle('sidebar-mobile-open');
    UIElements.sidebarOverlay.classList.toggle('active', isOpen);
    UIElements.body.classList.toggle('sidebar-is-open', isOpen);
}

function setupEventListeners() {
    if (UIElements.fontSizeOptions) {
        UIElements.fontSizeOptions.addEventListener('click', (e) => {
            const button = e.target.closest('.font-size-btn');
            if (button) applyFontSize(button.dataset.size);
        });
    }
    if (UIElements.profileMenuButton) {
        UIElements.profileMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            UIElements.profileDropdown.classList.toggle('show');
        });
    }
    if (UIElements.menuToggleBtn) {
        UIElements.menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebar();
        });
    }
    if (UIElements.sidebarOverlay) {
        UIElements.sidebarOverlay.addEventListener('click', toggleSidebar);
    }
    if (UIElements.logoutButton) {
        UIElements.logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            window.location.href = 'Login.html';
        });
    }
    if (UIElements.linkModalCloseBtn) {
        UIElements.linkModalCloseBtn.addEventListener('click', closeLinkModal);
    }

    window.addEventListener('click', (e) => {
        if (UIElements.profileDropdown?.classList.contains('show') && !UIElements.profileMenuButton.contains(e.target) && !UIElements.profileDropdown.contains(e.target)) {
            UIElements.profileDropdown.classList.remove('show');
        }
        if (UIElements.contextMenu?.classList.contains('show') && !UIElements.contextMenu.contains(e.target)) {
            UIElements.contextMenu.classList.remove('show');
        }
        if (UIElements.editUserModal && !UIElements.editUserModal.classList.contains('hidden') && e.target === UIElements.editUserModal) {
            closeEditUserModal();
        }
        if (UIElements.createUserModal && !UIElements.createUserModal.classList.contains('hidden') && e.target === UIElements.createUserModal) {
            closeCreateUserModal();
        }
        if (UIElements.linkModal && !UIElements.linkModal.classList.contains('hidden') && e.target === UIElements.linkModal) {
            closeLinkModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (UIElements.contextMenu) UIElements.contextMenu.classList.remove('show');
            closeEditUserModal();
            closeCreateUserModal();
            closeLinkModal();
        }
    });
}

function openEditUserModal(user) {
    if (!UIElements.editUserModal) return;
    document.getElementById('edit-userId').value = user._id;
    document.getElementById('edit-firstName').value = user.firstName;
    document.getElementById('edit-lastName').value = user.lastName;
    document.getElementById('edit-username').value = user.username;
    document.getElementById('edit-email').value = user.email;
    document.getElementById('edit-role').value = user.role;
    UIElements.editUserModal.classList.remove('hidden');
}

function closeEditUserModal() {
    if (UIElements.editUserModal) UIElements.editUserModal.classList.add('hidden');
}

function openCreateUserModal() {
    if (!UIElements.createUserModal) return;
    UIElements.createUserForm.reset();
    UIElements.createUserModal.classList.remove('hidden');
}

function closeCreateUserModal() {
    if (UIElements.createUserModal) UIElements.createUserModal.classList.add('hidden');
}

function openLinkModal(topicData, onSave) {
    if (!UIElements.linkModal) return;
    onSaveLinksCallback = onSave;
    UIElements.linkModal.dataset.topicId = topicData.id;
    UIElements.linkModalTopicText.textContent = topicData.text;
    
    renderLinkList(topicData.links);
    UIElements.linkModal.classList.remove('hidden');
}

function closeLinkModal() {
    if (UIElements.linkModal) {
        UIElements.linkModal.classList.add('hidden');
        if (onSaveLinksCallback) {
            onSaveLinksCallback();
            onSaveLinksCallback = null;
        }
    }
}

function renderLinkList(links) {
    UIElements.linkList.innerHTML = '';
    if (links && links.length > 0) {
        links.forEach((link, index) => {
            const item = document.createElement('div');
            item.className = 'link-item';
            item.innerHTML = `
                <a href="${link.url}" target="_blank" title="${link.url}">${link.title}</a>
                <button class="remove-link-btn" data-index="${index}" title="Remover link">
                    <span class="material-icons text-sm">delete</span>
                </button>
            `;
            UIElements.linkList.appendChild(item);
        });
    } else {
        UIElements.linkList.innerHTML = `<p class="text-sm secondary-text text-center">Nenhum link adicionado.</p>`;
    }

    const linkCount = links ? links.length : 0;
    const linksRemaining = 10 - linkCount;
    UIElements.linkCounter.textContent = `Você pode adicionar mais ${linksRemaining} link(s).`;

    const canAddMore = linkCount < 10;
    UIElements.addLinkSection.style.display = canAddMore ? 'block' : 'none';
    UIElements.linkModalAddBtn.style.display = canAddMore ? 'inline-flex' : 'none';
}

export {
    init,
    applyTheme,
    switchView,
    toggleSidebar,
    openEditUserModal,
    closeEditUserModal,
    openCreateUserModal,
    closeCreateUserModal,
    openLinkModal,
    closeLinkModal,
    renderLinkList,
    showNotification
};