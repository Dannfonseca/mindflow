/*
  Arquivo: /js/app.js
  Descrição: Substituídas as chamadas de alert() pela nova função de notificação.
*/
import { API_URL, fetchWithAuth } from './api.js';
import * as UI from './ui.js';
import * as Dashboard from './dashboard.js';
import * as Mindmap from './mindmap.js';
import * as Admin from './admin.js';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token && window.location.pathname.endsWith('app.html')) {
        window.location.href = 'Login.html';
        return;
    }

    const UIElements = {
        body: document.body,
        appViews: document.querySelectorAll('.app-view'),
        sidebarLinks: document.querySelectorAll('.sidebar-link'),
        profileMenuButton: document.getElementById('profile-menu-button'),
        profileDropdown: document.getElementById('profile-dropdown'),
        contextMenu: document.getElementById('topic-context-menu'),
        themeToggle: document.getElementById('theme-toggle'),
        fontSizeOptions: document.getElementById('font-size-options'),
        addNodeBtn: document.getElementById('add-node-btn'),
        saveMapBtn: document.getElementById('save-map-btn'),
        breadcrumbDashboardLink: document.getElementById('breadcrumb-dashboard-link'),
        breadcrumbMapTitle: document.getElementById('breadcrumb-map-title'),
        dropdownUserName: document.getElementById('dropdown-user-name'),
        dropdownUserEmail: document.getElementById('dropdown-user-email'),
        changePasswordForm: document.getElementById('change-password-form'),
        logoutButton: document.getElementById('logout-button'),
        adminLink: document.getElementById('admin-link'),
        adminUsersTableBody: document.getElementById('admin-users-table-body'),
        adminUserSearchInput: document.getElementById('admin-user-search'),
        adminCreateUserBtn: document.getElementById('admin-create-user-btn'),
        dashboardContainer: document.getElementById('dashboard-maps-container'),
        editUserModal: document.getElementById('edit-user-modal'),
        editUserForm: document.getElementById('edit-user-form'),
        editUserCancelBtn: document.getElementById('edit-user-cancel'),
        createUserModal: document.getElementById('create-user-modal'),
        createUserForm: document.getElementById('create-user-form'),
        createUserCancelBtn: document.getElementById('create-user-cancel'),
        menuToggleBtn: document.getElementById('menu-toggle-btn'),
        sidebar: document.querySelector('aside'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mindmapContainer: document.getElementById('mindmap-container'),
        canvas: document.getElementById('mindmap-canvas'),
        svgCanvas: document.getElementById('svg-canvas'),
        zoomInBtn: document.getElementById('zoom-in-btn'),
        zoomOutBtn: document.getElementById('zoom-out-btn'),
        zoomResetBtn: document.getElementById('zoom-reset-btn'),
        formatToolbar: document.getElementById('format-toolbar'),
        linkModal: document.getElementById('link-modal'),
        linkModalTopicText: document.getElementById('link-modal-topic-text'),
        linkList: document.getElementById('link-list'),
        linkCounter: document.getElementById('link-counter'),
        addLinkSection: document.getElementById('add-link-section'),
        linkModalAddBtn: document.getElementById('link-modal-add-btn'),
        linkModalCloseBtn: document.getElementById('link-modal-close-btn'),
        notificationContainer: document.getElementById('notification-container'),
    };
    
    const onSwitchCallback = (targetId) => {
        if (targetId === 'view-dashboard') Dashboard.renderDashboard();
        if (targetId === 'view-admin-users') Admin.fetchAndRenderUsers();
        if (targetId === 'view-mindmap') {
            setTimeout(Mindmap.setupMindmapView, 0); 
        }
    };

    const dashboardCallbacks = {
        onMapSelect: (mapId) => {
            if (mapId) {
                const mapData = Dashboard.getMapData(mapId);
                if (mapData) {
                    Mindmap.loadMap(mapData);
                    UI.switchView('view-mindmap', onSwitchCallback);
                }
            } else {
                Mindmap.clearCanvasForNewMap();
                UI.switchView('view-mindmap', onSwitchCallback);
            }
        }
    };
    
    UI.init(UIElements);
    Dashboard.init(UIElements, dashboardCallbacks);
    Mindmap.init(UIElements);
    Admin.init(UIElements);

    const loadUserProfile = async () => {
        if (!UIElements.dropdownUserName || !UIElements.dropdownUserEmail) return;
        try {
            const res = await fetchWithAuth(`${API_URL}/auth/user`);
            if (!res.ok) throw new Error('Falha ao buscar dados do usuário');
            const user = await res.json();
            UIElements.dropdownUserName.textContent = `${user.firstName} ${user.lastName}`;
            UIElements.dropdownUserEmail.textContent = user.email;
            if (UIElements.adminLink && (user.role === 'admin' || user.role === 'subadmin')) {
                UIElements.adminLink.classList.remove('hidden');
            }
        } catch (error) {
            console.error(error);
            UIElements.dropdownUserName.textContent = 'Erro ao carregar';
            UIElements.dropdownUserEmail.textContent = 'Tente novamente mais tarde.';
        }
    };

    const setupNavigation = () => {
        const viewLinks = document.querySelectorAll('.sidebar-link, .dropdown-link[data-target]');
        viewLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                if (!targetId) return;
                
                if (targetId === 'view-mindmap' && link.classList.contains('sidebar-link')) {
                    Mindmap.clearCanvasForNewMap();
                }
                
                UI.switchView(targetId, onSwitchCallback);

                if (link.closest('.profile-dropdown')) {
                    UIElements.profileDropdown.classList.remove('show');
                }
                if (UIElements.sidebar?.classList.contains('sidebar-mobile-open')) {
                    UI.toggleSidebar();
                }
            });
        });
        
        if (UIElements.breadcrumbDashboardLink) {
            UIElements.breadcrumbDashboardLink.addEventListener('click', (e) => {
                e.preventDefault();
                UI.switchView('view-dashboard', onSwitchCallback);
            });
        }
    };
    
    const setupSettingsAndTheme = () => {
        const theme = localStorage.getItem('theme') || 'light';
        UI.applyTheme(theme);

        if (UIElements.themeToggle) {
            UIElements.themeToggle.addEventListener('change', () => {
                const newTheme = UIElements.themeToggle.checked ? 'dark' : 'light';
                UI.applyTheme(newTheme);
                Mindmap.updateTheme();
            });
        }

        if (UIElements.changePasswordForm) {
            UIElements.changePasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const currentPassword = document.getElementById('currentPassword').value;
                const newPassword = document.getElementById('newPassword').value;
                const confirmNewPassword = document.getElementById('confirmNewPassword').value;
                if (newPassword !== confirmNewPassword) {
                    return UI.showNotification('A nova senha e a confirmação não correspondem.', 'error');
                }
                try {
                    const res = await fetchWithAuth(`${API_URL}/user/change-password`, {
                        method: 'POST',
                        body: JSON.stringify({ currentPassword, newPassword })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.msg || 'Não foi possível alterar a senha.');
                    UI.showNotification(data.msg, 'success');
                    UIElements.changePasswordForm.reset();
                } catch (err) {
                    UI.showNotification(err.message, 'error');
                }
            });
        }
    };

    loadUserProfile();
    Dashboard.renderDashboard();
    setupNavigation();
    setupSettingsAndTheme();
});