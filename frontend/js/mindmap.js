/*
  Arquivo: /js/mindmap.js
  Descrição: Adicionada notificação de sucesso ao deletar um item (card) do mapa.
*/
import { API_URL, fetchWithAuth } from './api.js';
import { openLinkModal, renderLinkList, showNotification } from './ui.js';

let DOMElements;
let connections = [];
let nodeIdCounter = 0;
let isLinking = false;
let startNodeId = null;
let currentMapId = null;
let wasDragged = false;
let topicDataMap = new WeakMap();
let resizeTicking = false;
let activeContextTopic = null;

let scale = 1, panX = 0, panY = 0;
let isPanning = false, panStart = { x: 0, y: 0 };
let minScale = 0.1, maxScale = 2.0;

function init(elements) {
    DOMElements = elements;
    setupEventListeners();
    setupFormatToolbar();
}

function updateTheme() {
    if (!DOMElements || !DOMElements.body) return;
    const strokeColor = DOMElements.body.classList.contains('dark-mode') ? '#4B5563' : '#D1D5DB';
    connections.forEach(conn => {
        if (conn.element) {
            conn.element.setAttribute('stroke', strokeColor);
        }
    });
}

function setupMindmapView() {
    if (!DOMElements.canvas || !DOMElements.mindmapContainer || !DOMElements.svgCanvas) return;
    
    const canvasSize = Math.max(window.innerWidth, window.innerHeight) * 5;
    DOMElements.canvas.style.width = `${canvasSize}px`;
    DOMElements.canvas.style.height = `${canvasSize}px`;
    DOMElements.svgCanvas.setAttribute('width', canvasSize);
    DOMElements.svgCanvas.setAttribute('height', canvasSize);
    
    const hScale = DOMElements.mindmapContainer.clientWidth / canvasSize;
    const vScale = DOMElements.mindmapContainer.clientHeight / canvasSize;
    minScale = Math.min(hScale, vScale);
    
    resetZoomAndPan();
}

function clearCanvasForNewMap() {
    if (!DOMElements.canvas) return;
    DOMElements.canvas.innerHTML = '<svg id="svg-canvas"></svg>';
    DOMElements.svgCanvas = document.getElementById('svg-canvas');
    connections = [];
    nodeIdCounter = 0;
    currentMapId = null;
    topicDataMap = new WeakMap();
    if (DOMElements.breadcrumbMapTitle) DOMElements.breadcrumbMapTitle.innerText = "Novo Mapa Mental";
    setTimeout(setupMindmapView, 0);
}

function loadMap(mapData) {
    clearCanvasForNewMap();
    currentMapId = mapData._id;
    if(DOMElements.breadcrumbMapTitle) DOMElements.breadcrumbMapTitle.innerText = mapData.title;

    mapData.nodes.forEach(nodeData => {
        const idNum = parseInt(nodeData.id.split('-')[1]);
        if (idNum >= nodeIdCounter) nodeIdCounter = idNum + 1;
        createNodeElement(nodeData);
    });
    
    mapData.connections.forEach(connInfo => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const strokeColor = DOMElements.body.classList.contains('dark-mode') ? '#4B5563' : '#D1D5DB';
        line.setAttribute('stroke', strokeColor);
        line.setAttribute('stroke-width', '2');
        DOMElements.svgCanvas.appendChild(line);
        connections.push({ ...connInfo, element: line });
    });

    setTimeout(updateLines, 0);
}

async function saveMap() {
    if (!DOMElements.breadcrumbMapTitle || !DOMElements.canvas) return;
    const nodes = [];
    DOMElements.canvas.querySelectorAll('.mindmap-node').forEach(nodeEl => {
        const topics = [];
        nodeEl.querySelectorAll('.topic-item').forEach(topicEl => {
            const data = topicDataMap.get(topicEl);
            if(data) {
                data.text = topicEl.querySelector('.topic-text').innerHTML;
                topics.push(data);
            }
        });
        nodes.push({ 
            id: nodeEl.id, 
            left: nodeEl.style.left, 
            top: nodeEl.style.top,
            width: nodeEl.style.width,
            height: nodeEl.style.height,
            topics: topics 
        });
    });

    const connsToSave = connections.map(c => ({ from: c.from, to: c.to }));
    const mapData = { id: currentMapId, title: DOMElements.breadcrumbMapTitle.innerText, nodes: nodes, connections: connsToSave };

    try {
        const res = await fetchWithAuth(`${API_URL}/maps`, { method: 'POST', body: JSON.stringify(mapData) });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.msg || 'Falha ao salvar o mapa');
        }
        const savedMap = await res.json();
        currentMapId = savedMap._id;
        showNotification('Mapa salvo com sucesso!', 'success');
        return savedMap;
    } catch (err) {
        console.error(err);
        showNotification(err.message, 'error');
        return null;
    }
}

function updateLines() {
    if (!DOMElements.svgCanvas) return;
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
}

function createNodeElement(nodeData) {
    const node = document.createElement('div');
    node.id = nodeData.id;
    node.className = 'mindmap-node';
    node.style.left = nodeData.left;
    node.style.top = nodeData.top;
    if (nodeData.width) node.style.width = nodeData.width;
    if (nodeData.height) node.style.height = nodeData.height;

    node.innerHTML = `
        <div class="resize-handle top-left"></div>
        <button class="delete-node-btn" title="Deletar Card"><span class="material-icons text-base">close</span></button>
        <ul class="topic-list"></ul>
        <div class="node-controls hidden"><button class="add-topic-btn node-control-btn">+</button><button class="link-handle node-control-btn">∞</button></div>`;

    const topicList = node.querySelector('.topic-list');
    if (nodeData.topics && nodeData.topics.length > 0) {
        nodeData.topics.forEach(topicObject => {
            const topicItem = createTopicElement(topicObject);
            topicList.appendChild(topicItem);
        });
        node.querySelector('.node-controls').classList.remove('hidden');
    }
    
    DOMElements.canvas.appendChild(node);
    
    node.querySelector('.delete-node-btn').addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Tem certeza?')) deleteNode(node.id); });
    node.querySelector('.add-topic-btn').addEventListener('click', (e) => { e.stopPropagation(); addNewTopic(topicList); });
    node.querySelector('.link-handle').addEventListener('click', handleLinkClick);
    
    makeDraggable(node);
    makeResizable(node);
}

function makeDraggable(element) {
    const dragMouseDown = (e) => {
        if (e.target.isContentEditable || e.target.closest('button') || e.target.classList.contains('resize-handle')) {
            return;
        }

        let pos3 = e.clientX;
        let pos4 = e.clientY;
        wasDragged = false;

        const elementDrag = (moveEvent) => {
            if (!wasDragged) {
                wasDragged = true;
                element.classList.add('dragging');
            }

            moveEvent.preventDefault();

            let pos1 = pos3 - moveEvent.clientX;
            let pos2 = pos4 - moveEvent.clientY;
            pos3 = moveEvent.clientX;
            pos4 = moveEvent.clientY;

            element.style.top = `${element.offsetTop - pos2}px`;
            element.style.left = `${element.offsetLeft - pos1}px`;
            updateLines();
        };

        const closeDragElement = () => {
            document.removeEventListener('mousemove', elementDrag);
            document.removeEventListener('mouseup', closeDragElement);

            if (wasDragged) {
                element.classList.remove('dragging');
            }
        };

        document.addEventListener('mousemove', elementDrag);
        document.addEventListener('mouseup', closeDragElement);
    };

    element.addEventListener('mousedown', dragMouseDown);
}

function makeResizable(element) {
    const handle = element.querySelector('.resize-handle.top-left');
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let lastEvent;

    function elementResize(e) {
        e.preventDefault();
        lastEvent = e;
        if (!resizeTicking) {
            requestAnimationFrame(() => {
                const dx = lastEvent.clientX - startX;
                const dy = lastEvent.clientY - startY;

                const newWidth = startWidth - dx;
                const newHeight = startHeight - dy;

                if (newWidth > 150) {
                    element.style.width = newWidth + 'px';
                    element.style.left = startLeft + dx + 'px';
                }
                if (newHeight > 80) {
                    element.style.height = newHeight + 'px';
                    element.style.top = startTop + dy + 'px';
                }
                updateLines();
                resizeTicking = false;
            });
            resizeTicking = true;
        }
    }

    function closeResizeElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
    
    handle.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = element.offsetWidth;
        startHeight = element.offsetHeight;
        startLeft = element.offsetLeft;
        startTop = element.offsetTop;
        document.onmouseup = closeResizeElement;
        document.onmousemove = elementResize;
    };
}


function deleteNode(nodeId) {
    const nodeElement = document.getElementById(nodeId);
    if (nodeElement) {
        nodeElement.querySelectorAll('.topic-item').forEach(topicEl => {
            if (topicDataMap.has(topicEl)) {
                topicDataMap.delete(topicEl);
            }
        });
        nodeElement.remove();
    }
    
    const connectionsToRemove = connections.filter(conn => conn.from === nodeId || conn.to === nodeId);
    connectionsToRemove.forEach(conn => {
        if (conn.element && conn.element.parentNode) {
            conn.element.parentNode.removeChild(conn.element);
        }
    });
    connections = connections.filter(conn => conn.from !== nodeId && conn.to !== nodeId);
    updateLines();
    showNotification('Item deletado com sucesso', 'success');
}

function enterEditMode(topicItem) {
    const textSpan = topicItem.querySelector('.topic-text');
    if (!textSpan || textSpan.isContentEditable) return;

    const node = topicItem.closest('.mindmap-node');
    const nodeRect = node.getBoundingClientRect();
    const toolbar = DOMElements.formatToolbar;

    toolbar.classList.remove('hidden');
    toolbar.style.top = `${nodeRect.top - 45}px`;
    toolbar.style.left = `${nodeRect.left}px`;


    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            textSpan.blur();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            document.execCommand('bold');
        }
    };

    const saveChanges = () => {
        toolbar.classList.add('hidden');
        textSpan.contentEditable = false;
        textSpan.removeEventListener('blur', saveChanges);
        textSpan.removeEventListener('keydown', handleKeyDown);
        
        if (node) {
            const controls = node.querySelector('.node-controls');
            if (controls) controls.classList.remove('hidden');
        }

        const data = topicDataMap.get(topicItem);
        if (data) {
            data.text = textSpan.innerHTML;
        }
        if (textSpan.innerText.trim() === '') {
            topicDataMap.delete(topicItem);
            topicItem.remove();
            if (node && !node.querySelector('.topic-list')?.hasChildNodes()) {
                deleteNode(node.id);
            }
        }
    };
    
    textSpan.contentEditable = true;
    textSpan.focus();
    document.execCommand('selectAll', false, null);
    textSpan.addEventListener('blur', saveChanges);
    textSpan.addEventListener('keydown', handleKeyDown);
}


function createTopicElement(topicObject) {
    const topicItem = document.createElement('li');
    topicItem.className = 'topic-item';
    topicItem.innerHTML = `
        <div class="topic-text-container">
            <span class="topic-text">${topicObject.text || ''}</span>
            <span class="material-icons topic-link-icon ${topicObject.links && topicObject.links.length > 0 ? '' : 'hidden'}">attachment</span>
        </div>
        <button class="edit-topic-btn"><span class="material-icons text-base">edit</span></button>`;
    
    topicDataMap.set(topicItem, topicObject);
    
    const textContainer = topicItem.querySelector('.topic-text-container');
    
    textContainer.addEventListener('dblclick', (e) => showContextMenu(e, topicItem));

    topicItem.querySelector('.topic-link-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        openLinkModalForTopic(topicItem);
    });

    topicItem.querySelector('.edit-topic-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        enterEditMode(topicItem);
    });
    return topicItem;
}

function openLinkModalForTopic(topicItem) {
    const topicData = topicDataMap.get(topicItem);
    if (!topicData) return;

    let currentLinks = topicData.links || [];
    
    const onSave = () => {
        topicData.links = currentLinks;
        const linkIcon = topicItem.querySelector('.topic-link-icon');
        if (linkIcon) {
            linkIcon.classList.toggle('hidden', topicData.links.length === 0);
        }
    };
    
    openLinkModal({ ...topicData, id: topicItem }, onSave);

    const addBtn = DOMElements.linkModal.querySelector('#link-modal-add-btn');
    const linkList = DOMElements.linkModal.querySelector('#link-list');

    const addLinkHandler = () => {
        const titleInput = DOMElements.linkModal.querySelector('#link-title');
        const urlInput = DOMElements.linkModal.querySelector('#link-url');
        const title = titleInput.value.trim();
        const url = urlInput.value.trim();

        if (title && url && currentLinks.length < 10) {
            currentLinks.push({ title, url });
            renderLinkList(currentLinks);
            titleInput.value = '';
            urlInput.value = '';
            titleInput.focus();
        } else if (currentLinks.length >= 10) {
            showNotification('Você atingiu o limite de 10 links por tópico.', 'error');
        }
    };

    const removeLinkHandler = (e) => {
        if (e.target.closest('.remove-link-btn')) {
            const index = e.target.closest('.remove-link-btn').dataset.index;
            currentLinks.splice(index, 1);
            renderLinkList(currentLinks);
        }
    };
    
    addBtn.onclick = addLinkHandler;
    linkList.onclick = removeLinkHandler;
}


function showContextMenu(e, topicItem) {
    e.preventDefault();
    e.stopPropagation();
    
    activeContextTopic = topicItem;

    const contextMenu = DOMElements.contextMenu;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.classList.add('show');
}

function handleContextMenuClick(event) {
    if (!activeContextTopic) return;

    const button = event.target.closest('.context-menu-btn');
    if (button) {
        const action = button.dataset.action;
        if (action === 'links') {
            openLinkModalForTopic(activeContextTopic);
        } else {
            showNotification(`A funcionalidade "${button.innerText.trim()}" ainda não foi implementada.`, 'error');
        }
    }

    DOMElements.contextMenu.classList.remove('show');
    activeContextTopic = null;
}


function addNewTopic(topicList) {
    const newTopicObject = { text: '', links: [] };
    const newTopicElement = createTopicElement(newTopicObject);
    topicList.appendChild(newTopicElement);
    enterEditMode(newTopicElement);
}

function findSmartPosition() {
    const NODE_WIDTH = 250;
    const NODE_MIN_HEIGHT = 120;

    const viewCenterX = (DOMElements.mindmapContainer.clientWidth / 2 - panX) / scale;
    const viewCenterY = (DOMElements.mindmapContainer.clientHeight / 2 - panY) / scale;

    const x = viewCenterX - (NODE_WIDTH / 2);
    const y = viewCenterY - (NODE_MIN_HEIGHT / 2);

    return { x, y };
}

function applyTransform() {
    if (!DOMElements.canvas) return;
    DOMElements.canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    DOMElements.zoomResetBtn.textContent = `${Math.round(scale * 100)}%`;
}
    
function resetZoomAndPan() {
    if (!DOMElements.mindmapContainer || !DOMElements.canvas) return;
    scale = 1.0;
    panX = (DOMElements.mindmapContainer.clientWidth - parseInt(DOMElements.canvas.style.width)) / 2;
    panY = (DOMElements.mindmapContainer.clientHeight - parseInt(DOMElements.canvas.style.height)) / 2;
    applyTransform();
}

function resetLinkingState() {
    if (!isLinking) return;
    isLinking = false;
    const sourceNode = document.getElementById(startNodeId);
    if (sourceNode) sourceNode.classList.remove('link-source');
    DOMElements.body.classList.remove('linking-mode-active');
    startNodeId = null;
}

function handleLinkClick(e) {
    e.stopPropagation();
    const node = e.target.closest('.mindmap-node');
    if (!node) return;
    resetLinkingState();
    isLinking = true;
    startNodeId = node.id;
    node.classList.add('link-source');
    DOMElements.body.classList.add('linking-mode-active');
}

function setupFormatToolbar() {
    if (DOMElements.formatToolbar) {
        DOMElements.formatToolbar.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });

        DOMElements.formatToolbar.addEventListener('click', (e) => {
            const button = e.target.closest('.format-btn');
            if (button) {
                const command = button.dataset.command;
                document.execCommand(command, false, null);
            }
        });
    }
}

function setupEventListeners() {
    if (DOMElements.contextMenu) {
        DOMElements.contextMenu.addEventListener('click', handleContextMenuClick);
    }
    if(DOMElements.zoomInBtn) DOMElements.zoomInBtn.addEventListener('click', () => { scale = Math.min(maxScale, scale * 1.25); applyTransform(); });
    if(DOMElements.zoomOutBtn) DOMElements.zoomOutBtn.addEventListener('click', () => { scale = Math.max(minScale, scale / 1.25); applyTransform(); });
    if(DOMElements.zoomResetBtn) DOMElements.zoomResetBtn.addEventListener('click', resetZoomAndPan);
    
    if(DOMElements.mindmapContainer) {
        DOMElements.mindmapContainer.addEventListener('mousedown', (e) => {
            if (e.target === DOMElements.mindmapContainer) {
                isPanning = true;
                panStart.x = e.clientX - panX;
                panStart.y = e.clientY - panY;
                DOMElements.mindmapContainer.style.cursor = 'grabbing';
            }
        });

        DOMElements.mindmapContainer.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            e.preventDefault();
            panX = e.clientX - panStart.x;
            panY = e.clientY - panStart.y;
            applyTransform();
        });

        DOMElements.mindmapContainer.addEventListener('mouseup', () => {
            if(isPanning) {
                isPanning = false;
                DOMElements.mindmapContainer.style.cursor = 'grab';
            }
        });

        DOMElements.mindmapContainer.addEventListener('mouseleave', () => {
            if(isPanning) {
                isPanning = false;
                DOMElements.mindmapContainer.style.cursor = 'grab';
            }
        });

        DOMElements.mindmapContainer.addEventListener('click', (e) => {
            if (isLinking) {
                const targetNode = e.target.closest('.mindmap-node');
                if (targetNode && targetNode.id !== startNodeId) {
                    const existing = connections.find(c => (c.from === startNodeId && c.to === targetNode.id) || (c.from === targetNode.id && c.to === startNodeId));
                    if (!existing) {
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        const strokeColor = DOMElements.body.classList.contains('dark-mode') ? '#4B5563' : '#D1D5DB';
                        line.setAttribute('stroke', strokeColor);
                        line.setAttribute('stroke-width', '2');
                        DOMElements.svgCanvas.appendChild(line);
                        connections.push({ from: startNodeId, to: targetNode.id, element: line });
                        updateLines();
                    }
                }
                resetLinkingState();
            }
        });
    }

    if (DOMElements.addNodeBtn) {
        DOMElements.addNodeBtn.addEventListener('click', () => {
            const { x, y } = findSmartPosition();
            const newNodeId = `node-${nodeIdCounter++}`;
            createNodeElement({id: newNodeId, left: `${x}px`, top: `${y}px`, topics: []});
            const newNodeElement = document.getElementById(newNodeId);
            if (newNodeElement) {
                const topicList = newNodeElement.querySelector('.topic-list');
                addNewTopic(topicList);
            }
        });
    }
    
    if (DOMElements.saveMapBtn) {
        DOMElements.saveMapBtn.addEventListener('click', async () => {
            await saveMap();
        });
    }

    if (DOMElements.breadcrumbMapTitle) {
        DOMElements.breadcrumbMapTitle.addEventListener('click', () => {
            if (document.getElementById('map-title-input')) return;
            const currentTitle = DOMElements.breadcrumbMapTitle.innerText;
            DOMElements.breadcrumbMapTitle.innerHTML = `<input type="text" id="map-title-input" class="text-xl font-bold" value="${currentTitle}" />`;
            const input = document.getElementById('map-title-input');
            input.focus();
            input.select();
            const saveTitle = () => {
                 DOMElements.breadcrumbMapTitle.innerText = input.value.trim() || "Mapa Mental Sem Título";
            };
            input.addEventListener('blur', saveTitle);
            input.addEventListener('keydown', (e) => { 
                if (e.key === 'Enter') input.blur();
                else if (e.key === 'Escape') DOMElements.breadcrumbMapTitle.innerText = currentTitle;
            });
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            resetLinkingState();
        }
    });
}

export { init, setupMindmapView, clearCanvasForNewMap, loadMap, updateTheme };