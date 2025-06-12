/*
  Arquivo: /js/dashboard.js
  Descrição: Substituídas as chamadas de alert() pela nova função de notificação.
*/
import { API_URL, fetchWithAuth } from './api.js';
import { showNotification } from './ui.js';

let DOMElements;
let mapsCache = [];
let onMapSelect;

function init(elements, callbacks) {
    DOMElements = elements;
    onMapSelect = callbacks.onMapSelect;
    setupEventListeners();
}

async function renderDashboard() {
    if (!DOMElements.dashboardContainer) return;
    DOMElements.dashboardContainer.innerHTML = '<p class="secondary-text">Carregando mapas...</p>';
    try {
        const res = await fetchWithAuth(`${API_URL}/maps`);
        if (!res.ok) throw new Error('Falha ao buscar mapas');
        mapsCache = await res.json();
        
        DOMElements.dashboardContainer.innerHTML = '';
        if (mapsCache.length === 0) {
            DOMElements.dashboardContainer.innerHTML = '<p class="secondary-text col-span-full text-center">Você ainda não tem mapas salvos. Crie um novo para começar!</p>';
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
            DOMElements.dashboardContainer.appendChild(card);
        });

        const createCard = document.createElement('div');
        createCard.id = 'create-new-map-card';
        createCard.className = 'flex flex-col items-center justify-center bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300 hover:border-accent transition-colors duration-300 cursor-pointer group card-hover';
        createCard.innerHTML = `<span class="material-icons text-5xl text-gray-400 group-hover:text-accent transition-colors duration-300 mb-2">add_circle_outline</span>
            <p class="secondary-text group-hover:text-accent transition-colors duration-300">Criar Novo Mapa</p>`;
        DOMElements.dashboardContainer.appendChild(createCard);

    } catch (err) {
        console.error(err);
        DOMElements.dashboardContainer.innerHTML = '<p class="text-red-500 col-span-full text-center">Erro ao carregar mapas.</p>';
    }
}

async function deleteMap(mapId) {
    if (!confirm('Tem certeza que deseja apagar este mapa permanentemente? Esta ação não pode ser desfeita.')) return;
    try {
        const res = await fetchWithAuth(`${API_URL}/maps/${mapId}`, { method: 'DELETE' });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.msg || 'Falha ao deletar o mapa');
        }
        showNotification('Mapa deletado com sucesso!', 'success');
        renderDashboard();
    } catch (err) {
        console.error(err);
        showNotification(err.message, 'error');
    }
}

function getMapData(mapId) {
    return mapsCache.find(m => m._id === mapId);
}

function setupEventListeners() {
    if (DOMElements.dashboardContainer) {
        DOMElements.dashboardContainer.addEventListener('click', (e) => {
            const createCard = e.target.closest('#create-new-map-card');
            if (createCard) {
                onMapSelect(null);
                return;
            }
            
            const mapCard = e.target.closest('.map-card-instance');
            if (!mapCard) return;

            const mapId = mapCard.dataset.mapId;
            if (e.target.closest('.map-card-delete')) {
                deleteMap(mapId);
            } else {
                onMapSelect(mapId);
            }
        });
    }
}

export { init, renderDashboard, getMapData };