/*
  Arquivo: /js/app.js
  Descrição: Lógica principal da aplicação, com renderização condicional do menu de admin para as roles 'admin' e 'subadmin'.
*/
document.addEventListener('DOMContentLoaded', () => {

    const token = localStorage.getItem('token');
    if (!token && window.location.pathname.endsWith('app.html')) {
        window.location.href = 'Login.html';
        return;
    }

    const API_URL = 'https://mindflow-w7l2.onrender.com';
    const body = document.body;
    const appViews = document.querySelectorAll('.app-view');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const profileMenuButton = document.getElementById('profile-menu-button');
    const profileDropdown = document.getElementById('profile-dropdown');
    const contextMenu = document.getElementById('topic-context-menu');
    const themeToggle = document.getElementById('theme-toggle');
    const fontSizeOptions = document.getElementById('font-size-options');
    const canvas = document.getElementById('mindmap-canvas');
    let svgCanvas = document.getElementById('svg-canvas');
    const addNodeBtn = document.getElementById('add-node-btn');
    const saveMapBtn = document.getElementById('save-map-btn');
    const breadcrumbDashboardLink = document.getElementById('breadcrumb-dashboard-link');
    const breadcrumbMapTitle = document.getElementById('breadcrumb-map-title');
    const dropdownUserName = document.getElementById('dropdown-user-name');
    const dropdownUserEmail = document.getElementById('dropdown-user-email');
    const changePasswordForm = document.getElementById('change-password-form');
    const logoutButton = document.getElementById('logout-button');
    
    const adminLink = document.getElementById('admin-link');
    const adminUsersTableBody = document.getElementById('admin-users-table-body');
    const adminUserSearchInput = document.getElementById('admin-user-search');
    const adminCreateUserBtn = document.getElementById('admin-create-user-btn');

    const editUserModal = document.getElementById('edit-user-modal');
    const editUserForm = document.getElementById('edit-user-form');
    const editUserCancelBtn = document.getElementById('edit-user-cancel');

    const createUserModal = document.getElementById('create-user-modal');
    const createUserForm = document.getElementById('create-user-form');
    const createUserCancelBtn = document.getElementById('create-user-cancel');


    let connections = [];
    let nodeIdCounter = 0;
    let isLinking = false;
    let startNodeId = null;
    let currentMapId = null;
    let mapsCache = [];
    let allUsersCache = [];

    const fetchWithAuth = async (url, options = {}) => {
        const headers = { 'Content-Type': 'application/json', 'x-auth-token': token, ...options.headers };
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.href = 'Login.html';
            throw new Error('Acesso não autorizado. Redirecionando para login.');
        }
        return response;
    };
    
    // Função atualizada para exibir o menu de admin para 'admin' e 'subadmin'
    const loadUserProfile = async () => {
        if (!dropdownUserName || !dropdownUserEmail) return;
        try {
            const res = await fetchWithAuth(`${API_URL}/auth/user`);
            if (!res.ok) throw new Error('Falha ao buscar dados do usuário');
            const user = await res.json();
            dropdownUserName.textContent = `${user.firstName} ${user.lastName}`;
            dropdownUserEmail.textContent = user.email;

            if (adminLink && (user.role === 'admin' || user.role === 'subadmin')) {
                adminLink.classList.remove('hidden');
            }

        } catch (error) {
            console.error(error);
            dropdownUserName.textContent = 'Erro ao carregar';
            dropdownUserEmail.textContent = 'Tente novamente mais tarde.';
        }
    };
    
    const updateLines = () => {
        if (!svgCanvas) return;
        svgCanvas.innerHTML = '';
        connections.forEach((conn) => {
            const fromNode = document.getElementById(conn.from);
            const toNode = document.getElementById(conn.to);
            if (fromNode && toNode) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', fromNode.offsetLeft + fromNode.offsetWidth / 2);
                line.setAttribute('y1', fromNode.offsetTop + fromNode.offsetHeight / 2);
                line.setAttribute('x2', toNode.offsetLeft + toNode.offsetWidth / 2);
                line.setAttribute('y2', toNode.offsetTop + toNode.offsetHeight / 2);
                const strokeColor = body.classList.contains('dark-mode') ? '#FFFFFF' : '#000000';
                line.setAttribute('stroke', strokeColor);
                line.setAttribute('stroke-width', '2');
                svgCanvas.appendChild(line);
            }
        });
    };

    const applyTheme = (theme) => {
        body.classList.toggle('dark-mode', theme === 'dark');
        localStorage.setItem('theme', theme);
        if (themeToggle) themeToggle.checked = (theme === 'dark');
        updateLines();
    };

    const applyFontSize = (size) => {
        body.classList.remove('font-size-medium', 'font-size-large');
        body.classList.add(`font-size-${size || 'medium'}`);
        localStorage.setItem('fontSize', size || 'medium');
        document.querySelectorAll('.font-size-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === (size || 'medium'));
        });
    };
    
    const renderDashboard = async () => {
        const container = document.getElementById('dashboard-maps-container');
        if (!container) return;
        container.innerHTML = '<p class="text-gray-500">Carregando mapas...</p>';
        try {
            const res = await fetchWithAuth(`${API_URL}/maps`);
            if (!res.ok) throw new Error('Falha ao buscar mapas');
            mapsCache = await res.json();
            container.innerHTML = '';
            if (mapsCache.length === 0) {
                container.innerHTML = '<p class="text-gray-500">Você ainda não tem mapas salvos. Crie um na aba "Mapa Mental"!</p>';
                return;
            }
            mapsCache.forEach(map => {
                const card = document.createElement('div');
                card.className = 'map-card';
                const titleSpan = document.createElement('span');
                titleSpan.className = 'map-card-title';
                titleSpan.innerText = map.title;
                card.appendChild(titleSpan);
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'map-card-delete';
                deleteBtn.title = 'Deletar mapa';
                deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
                deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteMap(map._id); });
                card.appendChild(deleteBtn);
                card.addEventListener('click', (e) => { if (!e.target.closest('.map-card-delete')) loadMap(map._id); });
                container.appendChild(card);
            });
        } catch (err) {
            console.error(err);
            container.innerHTML = '<p class="text-red-500">Erro ao carregar mapas.</p>';
        }
    };
    
    const switchView = (targetId) => {
        appViews.forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add('active');
        sidebarLinks.forEach(l => l.classList.toggle('active', l.getAttribute('data-target') === targetId));
        if (targetId === 'view-dashboard') renderDashboard();
        if (targetId === 'view-admin-users') fetchAndRenderUsers();
    };

    const clearCanvasForNewMap = () => {
        if (!canvas) return;
        canvas.innerHTML = '<svg id="svg-canvas"></svg>';
        svgCanvas = document.getElementById('svg-canvas');
        connections = [];
        nodeIdCounter = 0;
        currentMapId = null;
        if(breadcrumbMapTitle) breadcrumbMapTitle.innerText = "Novo Mapa Mental";
    };

    const loadMap = (mapId) => {
        const mapData = mapsCache.find(m => m._id === mapId);
        if (!mapData) return;
        clearCanvasForNewMap();
        currentMapId = mapData._id;
        if(breadcrumbMapTitle) breadcrumbMapTitle.innerText = mapData.title;
        mapData.nodes.forEach(nodeData => {
            const idNum = parseInt(nodeData.id.split('-')[1]);
            if (idNum >= nodeIdCounter) nodeIdCounter = idNum + 1;
            createNodeElement(nodeData);
        });
        connections = mapData.connections || [];
        
        setTimeout(updateLines, 0);

        switchView('view-mindmap');
    };

    const saveMap = async () => {
        if (!breadcrumbMapTitle) return;
        const nodes = [];
        document.querySelectorAll('.mindmap-node').forEach(nodeEl => {
            const topics = Array.from(nodeEl.querySelectorAll('.topic-text')).map(span => span.innerText);
            nodes.push({ id: nodeEl.id, left: nodeEl.style.left, top: nodeEl.style.top, topics: topics });
        });
        const mapData = { id: currentMapId, title: breadcrumbMapTitle.innerText, nodes: nodes, connections: connections };
        try {
            const res = await fetchWithAuth(`${API_URL}/maps`, { method: 'POST', body: JSON.stringify(mapData) });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.msg || 'Falha ao salvar o mapa');
            }
            const savedMap = await res.json();
            currentMapId = savedMap._id;
            alert('Mapa salvo com sucesso!');
            renderDashboard();
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    };
    
    const deleteMap = async (mapId) => {
        if (!confirm('Tem certeza que deseja apagar este mapa permanentemente? Esta ação não pode ser desfeita.')) return;
        try {
            const res = await fetchWithAuth(`${API_URL}/maps/${mapId}`, { method: 'DELETE' });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.msg || 'Falha ao deletar o mapa');
            }
            alert('Mapa deletado com sucesso!');
            renderDashboard();
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    };

    const deleteNode = (nodeId) => {
        const nodeElement = document.getElementById(nodeId);
        if (nodeElement) nodeElement.remove();
        connections = connections.filter(conn => conn.from !== nodeId && conn.to !== nodeId);
        updateLines();
    };

    const enterEditMode = (topicItem) => {
        const textSpan = topicItem.querySelector('.topic-text');
        if (!textSpan) return;
        const currentText = textSpan.innerText;
        textSpan.innerHTML = `<input type="text" class="topic-input" value="${currentText}" />`;
        const input = textSpan.querySelector('input');
        input.focus();
        input.select();
        const saveChanges = () => {
            const newText = input.value.trim();
            const node = topicItem.closest('.mindmap-node');
            if (!node) return;
            if (newText) {
                textSpan.innerHTML = newText;
                const controls = node.querySelector('.node-controls');
                if (controls) controls.classList.remove('hidden');
            } else {
                topicItem.remove();
                const topicList = node.querySelector('.topic-list');
                if (topicList && !topicList.hasChildNodes()) {
                    deleteNode(node.id);
                }
            }
        };
        input.addEventListener('blur', saveChanges);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveChanges();
            else if (e.key === 'Escape') {
                textSpan.innerHTML = currentText;
                if (!currentText) {
                    const node = topicItem.closest('.mindmap-node');
                    topicItem.remove();
                    if (node && !node.querySelector('.topic-list')?.hasChildNodes()) {
                        deleteNode(node.id);
                    }
                }
            }
        });
    };

    const addNewTopic = (topicList) => {
        const newTopic = document.createElement('li');
        newTopic.className = 'topic-item';
        newTopic.innerHTML = `<span class="topic-text"></span><button class="edit-topic-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>`;
        topicList.appendChild(newTopic);
        enterEditMode(newTopic);
    };

    const makeDraggable = (element) => {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        element.onmousedown = dragMouseDown;
        function dragMouseDown(e) {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.closest('button')) return;
            e.preventDefault();
            pos3 = e.clientX; pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
            pos3 = e.clientX; pos4 = e.clientY;
            element.style.top = `${element.offsetTop - pos2}px`;
            element.style.left = `${element.offsetLeft - pos1}px`;
            updateLines();
        }
        function closeDragElement() {
            document.onmouseup = null; document.onmousemove = null;
            updateLines();
        }
    };
    
    const resetLinkingState = () => {
        if (!isLinking) return;
        isLinking = false;
        const sourceNode = document.getElementById(startNodeId);
        if (sourceNode) sourceNode.classList.remove('link-source');
        body.classList.remove('linking-mode-active');
        startNodeId = null;
        if(canvas) canvas.style.cursor = 'default';
    };

    const createNodeElement = (nodeData) => {
        const node = document.createElement('div');
        node.id = nodeData.id;
        node.className = 'mindmap-node';
        node.style.left = nodeData.left;
        node.style.top = nodeData.top;
        
        node.innerHTML = `
            <button class="delete-node-btn" title="Deletar Card"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            <ul class="topic-list"></ul>
            <div class="node-controls hidden"><button class="add-topic-btn">+</button><button class="link-handle">∞</button></div>`;

        const topicList = node.querySelector('.topic-list');
        if (nodeData.topics && nodeData.topics.length > 0) {
            nodeData.topics.forEach(topicText => {
                const topicItem = document.createElement('li');
                topicItem.className = 'topic-item';
                topicItem.innerHTML = `<span class="topic-text">${topicText}</span><button class="edit-topic-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>`;
                topicList.appendChild(topicItem);
            });
            node.querySelector('.node-controls').classList.remove('hidden');
        }

        canvas.appendChild(node);
        node.querySelector('.delete-node-btn').addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Tem certeza?')) deleteNode(node.id); });
        node.querySelector('.add-topic-btn').addEventListener('click', (e) => { e.stopPropagation(); addNewTopic(topicList); });
        
        topicList.addEventListener('click', (e) => {
            if (isLinking) return;
            const editButton = e.target.closest('.edit-topic-btn');
            const topicTextElement = e.target.closest('.topic-text');
            if (editButton) { e.stopPropagation(); enterEditMode(editButton.parentElement); } 
            else if (topicTextElement) {
                e.stopPropagation();
                contextMenu.style.top = `${e.pageY}px`;
                contextMenu.style.left = `${e.pageX}px`;
                contextMenu.classList.add('show');
                contextMenu.dataset.topic = topicTextElement.textContent;
            }
        });
        
        node.querySelector('.link-handle').addEventListener('click', (e) => {
            e.stopPropagation();
            resetLinkingState();
            isLinking = true;
            startNodeId = node.id;
            node.classList.add('link-source');
            body.classList.add('linking-mode-active');
        });
        
        makeDraggable(node);
    };

    const renderUsersTable = (users) => {
        if (!adminUsersTableBody) return;
        adminUsersTableBody.innerHTML = '';
        if (users.length === 0) {
            adminUsersTableBody.innerHTML = '<tr><td colspan="5" class="p-3 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>';
            return;
        }
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-200';
            tr.innerHTML = `
                <td class="p-3 text-sm text-gray-700">${user.firstName} ${user.lastName}</td>
                <td class="p-3 text-sm text-gray-700">${user.username}</td>
                <td class="p-3 text-sm text-gray-700">${user.email}</td>
                <td class="p-3 text-sm text-gray-700"><span class="role-badge role-${user.role}">${user.role}</span></td>
                <td class="p-3">
                    <button class="action-btn edit-btn" data-user-id="${user._id}">Editar</button>
                    <button class="action-btn delete-btn" data-user-id="${user._id}">Deletar</button>
                </td>
            `;
            adminUsersTableBody.appendChild(tr);
        });
    };
    
    const fetchAndRenderUsers = async () => {
        if (!adminUsersTableBody) return;
        adminUsersTableBody.innerHTML = '<tr><td colspan="5" class="p-3 text-center">Carregando usuários...</td></tr>';
        
        try {
            const res = await fetchWithAuth(`${API_URL}/admin/users`);
            if (!res.ok) throw new Error('Falha ao carregar usuários');
            const users = await res.json();
            allUsersCache = users;
            renderUsersTable(allUsersCache);

        } catch (error) {
            adminUsersTableBody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-red-500">${error.message}</td></tr>`;
        }
    };
    
    const filterUsers = () => {
        if (!adminUserSearchInput) return;
        const searchTerm = adminUserSearchInput.value.toLowerCase();
        const filteredUsers = allUsersCache.filter(user => {
            const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
            return fullName.includes(searchTerm) ||
                   user.username.toLowerCase().includes(searchTerm) ||
                   user.email.toLowerCase().includes(searchTerm);
        });
        renderUsersTable(filteredUsers);
    };

    const openEditUserModal = (user) => {
        if (!editUserModal) return;
        document.getElementById('edit-userId').value = user._id;
        document.getElementById('edit-firstName').value = user.firstName;
        document.getElementById('edit-lastName').value = user.lastName;
        document.getElementById('edit-username').value = user.username;
        document.getElementById('edit-email').value = user.email;
        document.getElementById('edit-role').value = user.role;
        editUserModal.classList.remove('hidden');
    };

    const closeEditUserModal = () => {
        if (editUserModal) editUserModal.classList.add('hidden');
    };
    
    const openCreateUserModal = () => {
        if (!createUserModal) return;
        createUserForm.reset();
        createUserModal.classList.remove('hidden');
    };

    const closeCreateUserModal = () => {
        if (createUserModal) createUserModal.classList.add('hidden');
    };

    const deleteUser = async (userId) => {
        if (!confirm('Tem certeza que deseja deletar este usuário? Esta ação não pode ser desfeita.')) return;
        try {
            const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.msg || 'Falha ao deletar usuário');
            }
            alert('Usuário deletado com sucesso!');
            fetchAndRenderUsers();
        } catch (error) {
            alert(error.message);
        }
    };
    
    loadUserProfile();
    applyTheme(localStorage.getItem('theme') || 'light');
    applyFontSize(localStorage.getItem('fontSize') || 'medium');
    renderDashboard();

    const viewLinks = document.querySelectorAll('.sidebar-link, .dropdown-link[data-target]');
    viewLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            if (!targetId) return;

            if (targetId === 'view-mindmap' && link.classList.contains('sidebar-link')) {
                clearCanvasForNewMap();
            }
            
            switchView(targetId);

            if (link.closest('.profile-dropdown')) {
                profileDropdown.classList.remove('show');
            }
        });
    });

    if (profileMenuButton) {
        profileMenuButton.addEventListener('click', (e) => { e.stopPropagation(); profileDropdown.classList.toggle('show'); });
    }

    if (contextMenu) {
        contextMenu.addEventListener('click', (e) => {
            const button = e.target.closest('.context-menu-btn');
            if(button){
                alert(`A funcionalidade "${button.textContent.trim()}" ainda não foi implementada.`);
                contextMenu.classList.remove('show');
            }
        });
    }

    if (breadcrumbDashboardLink) {
        breadcrumbDashboardLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('view-dashboard');
        });
    }
    
    if (breadcrumbMapTitle) {
        breadcrumbMapTitle.addEventListener('click', () => {
            if (document.getElementById('map-title-input')) return;
            const currentTitle = breadcrumbMapTitle.innerText;
            breadcrumbMapTitle.innerHTML = `<input type="text" id="map-title-input" class="text-xl font-bold" value="${currentTitle}" />`;
            const input = document.getElementById('map-title-input');
            input.focus();
            input.select();
            
            const saveTitle = () => {
                 breadcrumbMapTitle.innerText = input.value.trim() || "Mapa Mental Sem Título";
            };

            input.addEventListener('blur', saveTitle);
            input.addEventListener('keydown', (e) => { 
                if (e.key === 'Enter') input.blur();
                else if (e.key === 'Escape') breadcrumbMapTitle.innerText = currentTitle;
            });
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                return alert('A nova senha e a confirmação não correspondem.');
            }

            try {
                const res = await fetchWithAuth(`${API_URL}/user/change-password`, {
                    method: 'POST',
                    body: JSON.stringify({ currentPassword, newPassword })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.msg || 'Não foi possível alterar a senha.');

                alert(data.msg);
                changePasswordForm.reset();

            } catch (err) {
                alert(err.message);
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            window.location.href = 'Login.html';
        });
    }

    if (adminUsersTableBody) {
        adminUsersTableBody.addEventListener('click', async (e) => {
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
                    alert('Erro: não foi possível encontrar os dados do usuário. Tente atualizar a página.');
                 }
            }
        });
    }

    if (adminUserSearchInput) {
        adminUserSearchInput.addEventListener('input', filterUsers);
    }

    if (adminCreateUserBtn) {
        adminCreateUserBtn.addEventListener('click', openCreateUserModal);
    }
    
    if(editUserForm) {
        editUserForm.addEventListener('submit', async (e) => {
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
                const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}`, {
                    method: 'PUT',
                    body: JSON.stringify(userData)
                });
                if(!res.ok) {
                    const data = await res.json();
                    throw new Error(data.msg || 'Falha ao atualizar usuário.');
                }
                alert('Usuário atualizado com sucesso!');
                closeEditUserModal();
                fetchAndRenderUsers();

            } catch(err) {
                alert(err.message);
            }
        });
    }

    if(createUserForm) {
        createUserForm.addEventListener('submit', async (e) => {
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
                const res = await fetchWithAuth(`${API_URL}/admin/users`, {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });

                const data = await res.json();
                if(!res.ok) {
                    throw new Error(data.msg || 'Falha ao criar usuário.');
                }
                alert('Usuário criado com sucesso!');
                closeCreateUserModal();
                fetchAndRenderUsers();

            } catch(err) {
                alert(err.message);
            }
        });
    }

    if(editUserCancelBtn) editUserCancelBtn.addEventListener('click', closeEditUserModal);
    if(createUserCancelBtn) createUserCancelBtn.addEventListener('click', closeCreateUserModal);
    
    window.addEventListener('click', (e) => {
        if (profileDropdown?.classList.contains('show') && !profileMenuButton.contains(e.target)) {
            profileDropdown.classList.remove('show');
        }
        if (contextMenu?.classList.contains('show') && !contextMenu.contains(e.target)) {
            contextMenu.classList.remove('show');
        }
        if (editUserModal && !editUserModal.classList.contains('hidden') && e.target === editUserModal) {
            closeEditUserModal();
        }
        if (createUserModal && !createUserModal.classList.contains('hidden') && e.target === createUserModal) {
            closeCreateUserModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            resetLinkingState();
            if (contextMenu) contextMenu.classList.remove('show');
            closeEditUserModal();
            closeCreateUserModal();
        }
    });

    if (canvas) {
        canvas.addEventListener('click', (e) => {
            if (!isLinking) return;
            const targetNode = e.target.closest('.mindmap-node');
            if (targetNode && targetNode.id !== startNodeId) {
                const existing = connections.find(c => (c.from === startNodeId && c.to === targetNode.id) || (c.from === targetNode.id && c.to === startNodeId));
                if (!existing) {
                    connections.push({ from: startNodeId, to: targetNode.id });
                    updateLines();
                }
            }
            resetLinkingState();
        });

        addNodeBtn.addEventListener('click', () => {
            const x = Math.random() * (canvas.clientWidth - 250);
            const y = Math.random() * (canvas.clientHeight - 120);
            const newNodeId = `node-${nodeIdCounter++}`;
            createNodeElement({id: newNodeId, left: `${x}px`, top: `${y}px`, topics: []});
            const newNodeElement = document.getElementById(newNodeId);
            if (newNodeElement) {
                const topicList = newNodeElement.querySelector('.topic-list');
                addNewTopic(topicList);
            }
        });

        saveMapBtn.addEventListener('click', saveMap);
    }
});
