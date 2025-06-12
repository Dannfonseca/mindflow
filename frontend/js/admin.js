/*
  Arquivo: /js/admin.js
  Descrição: Substituídas as chamadas de alert() pela nova função de notificação.
*/
import { API_URL, fetchWithAuth } from './api.js';
import { openEditUserModal, closeEditUserModal, openCreateUserModal, closeCreateUserModal, showNotification } from './ui.js';

let DOMElements;
let allUsersCache = [];

function init(elements) {
    DOMElements = elements;
    setupEventListeners();
}

async function fetchAndRenderUsers() {
    if (!DOMElements.adminUsersTableBody) return;
    DOMElements.adminUsersTableBody.innerHTML = '<tr><td colspan="5" class="p-3 text-center secondary-text">Carregando usuários...</td></tr>';
    try {
        const res = await fetchWithAuth(`${API_URL}/admin/users`);
        if (!res.ok) throw new Error('Falha ao carregar usuários');
        const users = await res.json();
        allUsersCache = users;
        renderUsersTable(allUsersCache);
    } catch (error) {
        DOMElements.adminUsersTableBody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-red-500">${error.message}</td></tr>`;
    }
}

function renderUsersTable(users) {
    if (!DOMElements.adminUsersTableBody) return;
    DOMElements.adminUsersTableBody.innerHTML = '';
    if (users.length === 0) {
        DOMElements.adminUsersTableBody.innerHTML = '<tr><td colspan="5" class="p-3 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>';
        return;
    }
    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';
        tr.innerHTML = `
            <td class="p-3 text-sm text-gray-700" data-label="Nome">${user.firstName} ${user.lastName}</td>
            <td class="p-3 text-sm text-gray-700" data-label="Usuário">${user.username}</td>
            <td class="p-3 text-sm text-gray-700" data-label="Email">${user.email}</td>
            <td class="p-3 text-sm text-gray-700" data-label="Role"><span class="role-badge role-${user.role}">${user.role}</span></td>
            <td class="p-3" data-label="Ações">
                <div class="flex justify-end gap-2">
                    <button class="action-btn edit-btn" data-user-id="${user._id}">Editar</button>
                    <button class="action-btn delete-btn" data-user-id="${user._id}">Deletar</button>
                </div>
            </td>`;
        DOMElements.adminUsersTableBody.appendChild(tr);
    });
}

function filterUsers() {
    if (!DOMElements.adminUserSearchInput) return;
    const searchTerm = DOMElements.adminUserSearchInput.value.toLowerCase();
    const filteredUsers = allUsersCache.filter(user => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        return fullName.includes(searchTerm) || user.username.toLowerCase().includes(searchTerm) || user.email.toLowerCase().includes(searchTerm);
    });
    renderUsersTable(filteredUsers);
}

async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja deletar este usuário? Esta ação não pode ser desfeita.')) return;
    try {
        const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.msg || 'Falha ao deletar usuário');
        }
        showNotification('Usuário deletado com sucesso!', 'success');
        fetchAndRenderUsers();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function setupEventListeners() {
    if (DOMElements.adminUserSearchInput) {
        DOMElements.adminUserSearchInput.addEventListener('input', filterUsers);
    }
    if (DOMElements.adminCreateUserBtn) {
        DOMElements.adminCreateUserBtn.addEventListener('click', openCreateUserModal);
    }
    if(DOMElements.editUserCancelBtn) DOMElements.editUserCancelBtn.addEventListener('click', closeEditUserModal);
    if(DOMElements.createUserCancelBtn) DOMElements.createUserCancelBtn.addEventListener('click', closeCreateUserModal);

    if (DOMElements.adminUsersTableBody) {
        DOMElements.adminUsersTableBody.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            if (target.classList.contains('delete-btn')) {
                const userId = target.dataset.userId;
                deleteUser(userId);
            }
            if (target.classList.contains('edit-btn')) {
                 const userId = target.dataset.userId;
                 const userToEdit = allUsersCache.find(u => u._id === userId);
                 if (userToEdit) {
                    openEditUserModal(userToEdit);
                 } else {
                    showNotification('Erro: não foi possível encontrar os dados do usuário. Tente atualizar a página.', 'error');
                 }
            }
        });
    }
    
    if(DOMElements.editUserForm) {
        DOMElements.editUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('edit-userId').value;
            const userData = {
                firstName: document.getElementById('edit-firstName').value,
                lastName: document.getElementById('edit-lastName').value,
                username: document.getElementById('edit-username').value,
                email: document.getElementById('edit-email').value,
                role: document.getElementById('edit-role').value,
            };
            try {
                const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(userData) });
                if(!res.ok) {
                    const data = await res.json();
                    throw new Error(data.msg || 'Falha ao atualizar usuário.');
                }
                showNotification('Usuário atualizado com sucesso!', 'success');
                closeEditUserModal();
                fetchAndRenderUsers();
            } catch(err) {
                showNotification(err.message, 'error');
            }
        });
    }

    if(DOMElements.createUserForm) {
        DOMElements.createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userData = {
                firstName: document.getElementById('create-firstName').value,
                lastName: document.getElementById('create-lastName').value,
                username: document.getElementById('create-username').value,
                birthDate: document.getElementById('create-birthDate').value,
                email: document.getElementById('create-email').value,
                password: document.getElementById('create-password').value,
                role: document.getElementById('create-role').value,
            };
            try {
                const res = await fetchWithAuth(`${API_URL}/admin/users`, { method: 'POST', body: JSON.stringify(userData) });
                const data = await res.json();
                if(!res.ok) { throw new Error(data.msg || 'Falha ao criar usuário.'); }
                showNotification('Usuário criado com sucesso!', 'success');
                closeCreateUserModal();
                fetchAndRenderUsers();
            } catch(err) {
                showNotification(err.message, 'error');
            }
        });
    }
}


export { init, fetchAndRenderUsers };