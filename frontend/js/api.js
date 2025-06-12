/*
  Arquivo: /js/api.js
  Descrição: Centraliza a URL da API e a lógica de fetch autenticado.
*/
const API_URL = 'https://mindflow-w7l2.onrender.com/api';

const fetchWithAuth = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = { 
        'Content-Type': 'application/json', 
        'x-auth-token': token, 
        ...options.headers 
    };
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        window.location.href = 'Login.html';
        throw new Error('Acesso não autorizado. Redirecionando para login.');
    }
    return response;
};

export { API_URL, fetchWithAuth };