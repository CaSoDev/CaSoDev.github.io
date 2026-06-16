document.addEventListener('DOMContentLoaded', () => {
    // Verificar se já está logado
    if (Auth.isAuthenticated()) {
        const user = Auth.getUser();
        if (user.perfil === 'fiscal') {
            window.location.href = 'fiscal.html';
        } else if (user.perfil === 'motorista') {
            window.location.href = 'motorista.html';
        } else {
            window.location.href = 'dashboard.html';
        }
        return;
    }

    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const senha = document.getElementById('senha').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            // Reset UI
            loginError.classList.add('hidden');
            loginError.textContent = '';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Aguarde...';

            try {
                await Auth.login(email, senha);
                // Reload para aplicar o estado autenticado
                window.location.reload();
            } catch (error) {
                loginError.textContent = error.message;
                loginError.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Entrar no Sistema';
            }
        });
    }
});
