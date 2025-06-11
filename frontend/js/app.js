/*
  Arquivo: /js/app.js
  Descrição: Lógica principal da aplicação. Refatorado para usar um canvas gigante com navegação por zoom e pan. Corrigida a renderização das linhas e a lógica de criação de conexões.
*/
document.addEventListener('DOMContentLoaded', () => {

    const token = localStorage.getItem('token');
    if (!token && window.location.pathname.endsWith('app.html')) {
        window.location.href = 'Login.html';
        return;
    }

    const API_URL = 'https://mindflow-w7l2.onrender.com/api';
    const body = document.body;
    const appViews = document.querySelectorAll('.app-view');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const profileMenuButton = document.getElementById('profile-menu-button');
    const profileDropdown = document.getElementById('profile-dropdown');
    const contextMenu = document.getElementById('topic-context-menu');
    const themeToggle = document.getElementById('theme-toggle');
    const fontSizeOptions = document.getElementById('font-size-options');
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
    const dashboardContainer = document.getElementById('dashboard-maps-container');
    const editUserModal = document.getElementById('edit-user-modal');
    const editUserForm = document.getElementById('edit-user-form');
    const editUserCancelBtn = document.getElementById('edit-user-cancel');
    const createUserModal = document.getElementById('create-user-modal');
    const createUserForm = document.getElementById('create-user-form');
    const createUserCancelBtn = document.getElementById('create-user-cancel');
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.querySelector('aside');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    const mindmapContainer = document.getElementById('mindmap-container');
    const canvas = document.getElementById('mindmap-canvas');
    let svgCanvas = document.getElementById('svg-canvas');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    let connections = [];
    let nodeIdCounter = 0;
    let isLinking = false;
    let startNodeId = null;
    let currentMapId = null;
    let mapsCache = [];
    let allUsersCache = [];
    let wasDragged = false;
    
    let scale = 1, panX = 0, panY = 0;
    let isPanning = false, panStart = { x: 0, y: 0 };
    let minScale = 0.1, maxScale = 2.0;

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
        connections.forEach((conn) => {
            const fromNode = document.getElementById(conn.from);
            const toNode = document.getElementById(conn.to);
            if (fromNode && toNode && conn.element) {
                conn.element.setAttribute('x1', fromNode.offsetLeft + fromNode.offsetWidth / 2);
                conn.element.setAttribute('y1', fromNode.offsetTop + fromNode.offsetHeight / 2);
                conn.element.setAttribute('x2', toNode.offsetLeft + toNode.offsetWidth / 2);
                conn.element.setAttribute('y2', toNode.offsetTop + toNode.offsetHeight / 2);
            }
        });
    };

    const applyTheme = (theme) => {
        body.classList.toggle('dark-mode', theme === 'dark');
        localStorage.setItem('theme', theme);
        if (themeToggle) themeToggle.checked = (theme === 'dark');
        
        const strokeColor = body.classList.contains('dark-mode') ? '#4B5563' : '#D1D5DB';
        connections.forEach(conn => {
            if(conn.element) conn.element.setAttribute('stroke', strokeColor);
        });
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
        if (!dashboardContainer) return;
        dashboardContainer.innerHTML = '<p class="secondary-text">Carregando mapas...</p>';
        try {
            const res = await fetchWithAuth(`${API_URL}/maps`);
            if (!res.ok) throw new Error('Falha ao buscar mapas');
            mapsCache = await res.json();
            dashboardContainer.innerHTML = '';
            if (mapsCache.length === 0) {
                 dashboardContainer.innerHTML = '<p class="secondary-text col-span-full text-center">Você ainda não tem mapas salvos. Crie um novo para começar!</p>';
            }
            mapsCache.forEach(map => {
                const card = document.createElement('div');
                card.className = 'bg-white p-6 rounded-lg shadow-md card-hover transition-all duration-300 border border-gray-200 map-card-instance';
                card.dataset.mapId = map._id;
                const date = new Date(map.createdAt).toLocaleDateString('pt-BR');
                card.innerHTML = `
                    <div class="flex items-start justify-between mb-3">
                        <h3 class="text-xl font-medium main-content-text">${map.title}</h3>
                        <button class="map-card-delete" title="Deletar mapa"><span class="material-icons text-lg">close</span></button>
                    </div>
                    <p class="secondary-text text-sm mb-4">Criado em: ${date}</p>
                    <div class="flex justify-end">
                        <button class="view-map-btn button-primary font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center text-sm">
                            <span class="material-icons text-sm mr-2">visibility</span>
                            Visualizar
                        </button>
                    </div>`;
                dashboardContainer.appendChild(card);
            });
            const createCard = document.createElement('div');
            createCard.id = 'create-new-map-card';
            createCard.className = 'flex flex-col items-center justify-center bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300 hover:border-accent transition-colors duration-300 cursor-pointer group card-hover';
            createCard.innerHTML = `<span class="material-icons text-5xl text-gray-400 group-hover:text-accent transition-colors duration-300 mb-2">add_circle_outline</span>
                <p class="secondary-text group-hover:text-accent transition-colors duration-300">Criar Novo Mapa</p>`;
            dashboardContainer.appendChild(createCard);
        } catch (err) {
            console.error(err);
            dashboardContainer.innerHTML = '<p class="text-red-500 col-span-full text-center">Erro ao carregar mapas.</p>';
        }
    };
    
    const switchView = (targetId) => {
        appViews.forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add('active');
        sidebarLinks.forEach(l => l.classList.toggle('active', l.getAttribute('data-target') === targetId));
        if (targetId === 'view-dashboard') renderDashboard();
        if (targetId === 'view-admin-users') fetchAndRenderUsers();
        if (targetId === 'view-mindmap') {
            setTimeout(setupMindmapView, 0); 
        }
    };

    const clearCanvasForNewMap = () => {
        if (!canvas) return;
        canvas.innerHTML = '<svg id="svg-canvas"></svg>';
        svgCanvas = document.getElementById('svg-canvas');
        connections = [];
        nodeIdCounter = 0;
        currentMapId = null;
        if(breadcrumbMapTitle) breadcrumbMapTitle.innerText = "Novo Mapa Mental";
        setTimeout(setupMindmapView, 0);
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
        
        mapData.connections.forEach(connInfo => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const strokeColor = body.classList.contains('dark-mode') ? '#4B5563' : '#D1D5DB';
            line.setAttribute('stroke', strokeColor);
            line.setAttribute('stroke-width', '2');
            svgCanvas.appendChild(line);
            connections.push({ ...connInfo, element: line });
        });

        setTimeout(updateLines, 0);
        switchView('view-mindmap');
    };

    const saveMap = async () => {
        if (!breadcrumbMapTitle) return;
        const nodes = [];
        canvas.querySelectorAll('.mindmap-node').forEach(nodeEl => {
            const topics = Array.from(nodeEl.querySelectorAll('.topic-text')).map(span => span.innerText);
            nodes.push({ id: nodeEl.id, left: nodeEl.style.left, top: nodeEl.style.top, topics: topics });
        });
        const connsToSave = connections.map(c => ({ from: c.from, to: c.to }));
        const mapData = { id: currentMapId, title: breadcrumbMapTitle.innerText, nodes: nodes, connections: connsToSave };
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
        
        const connectionsToRemove = connections.filter(conn => conn.from === nodeId || conn.to === nodeId);
        connectionsToRemove.forEach(conn => {
            if (conn.element && conn.element.parentNode) {
                conn.element.parentNode.removeChild(conn.element);
            }
        });
        connections = connections.filter(conn => conn.from !== nodeId && conn.to !== nodeId);
        updateLines();
    };

    const enterEditMode = (topicItem) => {
        const textSpan = topicItem.querySelector('.topic-text');
        if (!textSpan) return;
        const currentText = textSpan.innerText;
        textSpan.innerHTML = `<input type="text" class="topic-input" name="topic-edit" value="${currentText}" />`;
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
        newTopic.innerHTML = `<span class="topic-text"></span><button class="edit-topic-btn"><span class="material-icons text-base">edit</span></button>`;
        topicList.appendChild(newTopic);
        enterEditMode(newTopic);
    };

    const makeDraggable = (element) => {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        element.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.closest('button')) return;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            wasDragged = false;
            
            element.classList.add('dragging');

            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            wasDragged = true;

            element.style.top = `${element.offsetTop - pos2}px`;
            element.style.left = `${element.offsetLeft - pos1}px`;
            updateLines();
        }

        function closeDragElement() {
            element.classList.remove('dragging'); 

            document.onmouseup = null;
            document.onmousemove = null;
        }
    };
    
    const resetLinkingState = () => {
        if (!isLinking) return;
        isLinking = false;
        const sourceNode = document.getElementById(startNodeId);
        if (sourceNode) sourceNode.classList.remove('link-source');
        body.classList.remove('linking-mode-active');
        startNodeId = null;
    };

    const createNodeElement = (nodeData) => {
        const node = document.createElement('div');
        node.id = nodeData.id;
        node.className = 'mindmap-node';
        node.style.left = nodeData.left;
        node.style.top = nodeData.top;
        node.innerHTML = `
            <button class="delete-node-btn" title="Deletar Card"><span class="material-icons text-base">close</span></button>
            <ul class="topic-list"></ul>
            <div class="node-controls hidden"><button class="add-topic-btn">+</button><button class="link-handle">∞</button></div>`;

        const topicList = node.querySelector('.topic-list');
        if (nodeData.topics && nodeData.topics.length > 0) {
            nodeData.topics.forEach(topicText => {
                const topicItem = document.createElement('li');
                topicItem.className = 'topic-item';
                topicItem.innerHTML = `<span class="topic-text">${topicText}</span><button class="edit-topic-btn"><span class="material-icons text-base">edit</span></button>`;
                topicList.appendChild(topicItem);
            });
            node.querySelector('.node-controls').classList.remove('hidden');
        }
        canvas.appendChild(node);
        node.querySelector('.delete-node-btn').addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Tem certeza?')) deleteNode(node.id); });
        node.querySelector('.add-topic-btn').addEventListener('click', (e) => { e.stopPropagation(); addNewTopic(topicList); });
        topicList.addEventListener('click', (e) => {
            if (wasDragged) return;
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

    const findSmartPosition = () => {
        const NODE_WIDTH = 250;
        const NODE_MIN_HEIGHT = 120;

        const viewCenterX = (mindmapContainer.clientWidth / 2 - panX) / scale;
        const viewCenterY = (mindmapContainer.clientHeight / 2 - panY) / scale;

        const x = viewCenterX - (NODE_WIDTH / 2);
        const y = viewCenterY - (NODE_MIN_HEIGHT / 2);

        return { x, y };
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
            adminUsersTableBody.appendChild(tr);
        });
    };
    
    const fetchAndRenderUsers = async () => {
        if (!adminUsersTableBody) return;
        adminUsersTableBody.innerHTML = '<tr><td colspan="5" class="p-3 text-center secondary-text">Carregando usuários...</td></tr>';
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
            return fullName.includes(searchTerm) || user.username.toLowerCase().includes(searchTerm) || user.email.toLowerCase().includes(searchTerm);
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
    
    const toggleSidebar = () => {
        if(!sidebar || !sidebarOverlay) return;
        sidebar.classList.toggle('sidebar-mobile-open');
        sidebarOverlay.classList.toggle('active');
    };

    function setupMindmapView() {
        if (!canvas || !mindmapContainer || !svgCanvas) return;
    
        const canvasSize = Math.max(window.innerWidth, window.innerHeight) * 5;
        canvas.style.width = `${canvasSize}px`;
        canvas.style.height = `${canvasSize}px`;
        svgCanvas.setAttribute('width', canvasSize);
        svgCanvas.setAttribute('height', canvasSize);
    
        const hScale = mindmapContainer.clientWidth / canvasSize;
        const vScale = mindmapContainer.clientHeight / canvasSize;
        minScale = Math.min(hScale, vScale);
    
        resetZoomAndPan();
    }
    
    function applyTransform() {
        if (!canvas) return;
        canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        zoomResetBtn.textContent = `${Math.round(scale * 100)}%`;
    }
    
    function resetZoomAndPan() {
        if (!mindmapContainer || !canvas) return;
        scale = 1.0;
        panX = (mindmapContainer.clientWidth - parseInt(canvas.style.width)) / 2;
        panY = (mindmapContainer.clientHeight - parseInt(canvas.style.height)) / 2;
        applyTransform();
    }
    
    // -- INICIALIZAÇÃO E EVENT LISTENERS --
    loadUserProfile();
    applyTheme(localStorage.getItem('theme') || 'light');
    applyFontSize(localStorage.getItem('fontSize') || 'medium');
    renderDashboard();

    if(zoomInBtn) zoomInBtn.addEventListener('click', () => { scale = Math.min(maxScale, scale * 1.25); applyTransform(); });
    if(zoomOutBtn) zoomOutBtn.addEventListener('click', () => { scale = Math.max(minScale, scale / 1.25); applyTransform(); });
    if(zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoomAndPan);
    
    if(mindmapContainer) {
        mindmapContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomIntensity = 0.1;
            const delta = e.deltaY < 0 ? 1 : -1;
            const zoom = Math.exp(delta * zoomIntensity);
        
            const rect = mindmapContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
        
            const mousePointX = (mouseX - panX) / scale;
            const mousePointY = (mouseY - panY) / scale;
            
            const newScale = scale * zoom;
            if (newScale > maxScale || newScale < minScale) return;
            scale = newScale;
            
            panX = mouseX - mousePointX * scale;
            panY = mouseY - mousePointY * scale;
        
            applyTransform();
        });

        mindmapContainer.addEventListener('mousedown', (e) => {
            if (e.target === canvas || e.target === mindmapContainer) {
                isPanning = true;
                panStart.x = e.clientX - panX;
                panStart.y = e.clientY - panY;
                mindmapContainer.style.cursor = 'grabbing';
            }
        });

        mindmapContainer.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            e.preventDefault();
            panX = e.clientX - panStart.x;
            panY = e.clientY - panStart.y;
            applyTransform();
        });

        mindmapContainer.addEventListener('mouseup', () => {
            isPanning = false;
            mindmapContainer.style.cursor = 'grab';
        });

        mindmapContainer.addEventListener('mouseleave', () => {
            isPanning = false;
            mindmapContainer.style.cursor = 'grab';
        });

        mindmapContainer.addEventListener('click', (e) => {
            if (isLinking) {
                const targetNode = e.target.closest('.mindmap-node');
                if (targetNode && targetNode.id !== startNodeId) {
                    const existing = connections.find(c => (c.from === startNodeId && c.to === targetNode.id) || (c.from === targetNode.id && c.to === startNodeId));
                    if (!existing) {
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        const strokeColor = body.classList.contains('dark-mode') ? '#4B5563' : '#D1D5DB';
                        line.setAttribute('stroke', strokeColor);
                        line.setAttribute('stroke-width', '2');
                        svgCanvas.appendChild(line);
                        connections.push({ from: startNodeId, to: targetNode.id, element: line });
                        updateLines();
                    }
                }
                resetLinkingState();
            }
        });
    }

    if (dashboardContainer) {
        dashboardContainer.addEventListener('click', (e) => {
            const createCard = e.target.closest('#create-new-map-card');
            if (createCard) {
                clearCanvasForNewMap();
                switchView('view-mindmap');
                return;
            }
            const mapCard = e.target.closest('.map-card-instance');
            if (!mapCard) return;
            const mapId = mapCard.dataset.mapId;
            if (e.target.closest('.map-card-delete')) {
                deleteMap(mapId);
            } else {
                loadMap(mapId);
            }
        });
    }
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            applyTheme(themeToggle.checked ? 'dark' : 'light');
        });
    }
    if (fontSizeOptions) {
        fontSizeOptions.addEventListener('click', (e) => {
            const button = e.target.closest('.font-size-btn');
            if (button) {
                applyFontSize(button.dataset.size);
            }
        });
    }
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
            if (sidebar?.classList.contains('sidebar-mobile-open')) {
                toggleSidebar();
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
                alert(`A funcionalidade "${button.innerText.trim()}" ainda não foi implementada.`);
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
                const res = await fetchWithAuth(`${API_URL}/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(userData) });
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
                const res = await fetchWithAuth(`${API_URL}/admin/users`, { method: 'POST', body: JSON.stringify(userData) });
                const data = await res.json();
                if(!res.ok) { throw new Error(data.msg || 'Falha ao criar usuário.'); }
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
    
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebar();
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    window.addEventListener('click', (e) => {
        if (profileDropdown?.classList.contains('show') && !profileMenuButton.contains(e.target) && !profileDropdown.contains(e.target)) {
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
        addNodeBtn.addEventListener('click', () => {
            const { x, y } = findSmartPosition();
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
