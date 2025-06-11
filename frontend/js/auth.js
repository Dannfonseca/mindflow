// Arquivo: /js/auth.js
// Descrição: Atualizado para enviar os novos campos do formulário de registro.
const API_URL = 'https://mindflow-w7l2.onrender.com/api';

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.msg || 'Erro ao fazer login');
            }

            localStorage.setItem('token', data.token);
            window.location.href = 'app.html';

        } catch (err) {
            alert(err.message);
        }
    });
}

if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const username = document.getElementById('username').value;
        const birthDate = document.getElementById('birthDate').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName, username, birthDate, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.msg || 'Erro ao registrar');
            }
            
            // Após registrar, salva o token e vai para o app
            localStorage.setItem('token', data.token);
            window.location.href = 'app.html';

        } catch (err) {
            alert(err.message);
        }
    });
}
