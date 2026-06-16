const API_BASE_URL = `${window.location.origin}/backend/api/index.php`;

class ApiService {
    static async request(endpoint, method = 'GET', data = null) {
        const token = localStorage.getItem('jwt_token');
        const isFormData = data instanceof FormData;

        const headers = {};

        // Se NÃO for FormData, define Content-Type como JSON
        // Para FormData, o browser define automaticamente o boundary correto
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const options = {
            method,
            headers
        };

        if (data) {
            options.body = isFormData ? data : JSON.stringify(data);
        }

        const [route, queryString] = endpoint.split('?');
        const url = new URL(API_BASE_URL);
        url.searchParams.set('endpoint', route.replace(/^\/+/, ''));

        if (queryString) {
            const params = new URLSearchParams(queryString);
            for (const [key, value] of params.entries()) {
                url.searchParams.append(key, value);
            }
        }

        try {
            const response = await fetch(url.toString(), options);
            const result = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    // Token expirado ou inválido
                    Auth.logout();
                }
                throw new Error(result.message || 'Erro na requisição');
            }

            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
}

class Auth {
    static async login(email, senha) {
        const response = await ApiService.request('/login', 'POST', { email, senha });
        if (response.token) {
            localStorage.setItem('jwt_token', response.token);
            localStorage.setItem('user_data', JSON.stringify(response.usuario));
        }
        return response;
    }

    static logout() {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_data');
        // Sempre redireciona para o login — evita loop de reload em páginas protegidas
        window.location.href = '/index.html';
    }

    static isAuthenticated() {
        return !!localStorage.getItem('jwt_token');
    }

    static getUser() {
        const data = localStorage.getItem('user_data');
        return data ? JSON.parse(data) : null;
    }
}

/**
 * Escapa conteúdo para evitar XSS ao inserir dados via innerHTML.
 * Use sempre que inserir dados vindos da API diretamente no DOM.
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.verDetalhesChecklist = async function(id) {
    try {
        const c = await ApiService.request(`/checklists?id=${id}`);
        
        // Remove existing modal if any
        const existing = document.getElementById('global-checklist-details-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'global-checklist-details-modal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-60 backdrop-blur-sm';
        
        const isAbertura = c.tipo === 'abertura';
        const dt = new Date(c.data_hora).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // Generate items html
        let itemsHtml = '';
        if (c.itens && c.itens.length > 0) {
            c.itens.forEach(item => {
                const conforme = item.status_item === 'conforme';
                itemsHtml += `
                    <div class="flex items-start justify-between p-3 rounded-xl border border-gray-100 ${conforme ? 'bg-green-50/50' : 'bg-red-50/50'}">
                        <div class="flex-1 pr-2">
                            <span class="text-sm font-semibold text-gray-800">${escapeHtml(item.nome_item)}</span>
                            ${item.observacao ? `<p class="text-xs text-red-600 mt-1"><i class="fas fa-exclamation-triangle mr-1"></i>${escapeHtml(item.observacao)}</p>` : ''}
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${conforme ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                            ${conforme ? 'Conforme' : 'Não Conforme'}
                        </span>
                    </div>
                `;
            });
        } else {
            itemsHtml = '<p class="text-sm text-gray-500 italic">Nenhum item registrado.</p>';
        }

        // Generate photos html
        let photosHtml = '';
        if (c.fotos && c.fotos.length > 0) {
            c.fotos.forEach(foto => {
                const src = foto.caminho_arquivo.startsWith('http') ? foto.caminho_arquivo : `/${foto.caminho_arquivo}`;
                photosHtml += `
                    <div class="relative group cursor-pointer" onclick="window.open('${src}', '_blank')">
                        <img src="${src}" class="w-full h-24 object-cover rounded-xl border border-gray-200 shadow-sm" alt="Foto do veículo">
                        <div class="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                            <span class="text-white text-xs font-bold"><i class="fas fa-search-plus mr-1"></i>Ver</span>
                        </div>
                    </div>
                `;
            });
        } else {
            photosHtml = '<p class="text-sm text-gray-400 italic">Nenhuma foto anexada.</p>';
        }

        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col transform transition-all scale-100">
                <!-- Header -->
                <div class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>Checklist: ${escapeHtml(c.veiculo_placa)}</span>
                            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${isAbertura ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}">
                                ${isAbertura ? 'Abertura' : 'Fechamento'}
                            </span>
                        </h3>
                        <p class="text-xs text-gray-500 mt-1">${escapeHtml(dt)}</p>
                    </div>
                    <button onclick="document.getElementById('global-checklist-details-modal').remove()" class="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100">
                        <i class="fas fa-times text-lg"></i>
                    </button>
                </div>

                <!-- Content -->
                <div class="p-6 space-y-6">
                    <!-- General Details -->
                    <div class="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
                        <div>
                            <span class="text-xs text-gray-400 block uppercase font-medium">Veículo</span>
                            <span class="font-bold text-gray-800">${escapeHtml(c.veiculo_marca)} ${escapeHtml(c.veiculo_modelo)} (${escapeHtml(c.veiculo_ano)})</span>
                        </div>
                        <div>
                            <span class="text-xs text-gray-400 block uppercase font-medium">KM Registrado</span>
                            <span class="font-bold text-gray-800">${Number(c.km_registrado).toLocaleString('pt-BR')} km</span>
                        </div>
                        <div>
                            <span class="text-xs text-gray-400 block uppercase font-medium">Motorista</span>
                            <span class="font-semibold text-gray-700">${escapeHtml(c.motorista_nome)}</span>
                        </div>
                        <div>
                            <span class="text-xs text-gray-400 block uppercase font-medium">Fiscal</span>
                            <span class="font-semibold text-gray-700">${escapeHtml(c.fiscal_nome)}</span>
                        </div>
                    </div>

                    <!-- Items List -->
                    <div>
                        <h4 class="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">Itens Inspecionados</h4>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            ${itemsHtml}
                        </div>
                    </div>

                    <!-- Photos -->
                    <div>
                        <h4 class="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">Fotos da Vistoria</h4>
                        <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            ${photosHtml}
                        </div>
                    </div>

                    <!-- Signatures -->
                    <div>
                        <h4 class="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">Assinaturas</h4>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div class="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center flex flex-col justify-between min-h-[120px]">
                                <span class="text-xs text-gray-400 block mb-2 uppercase font-medium">Fiscal</span>
                                ${c.assinatura_fiscal ? `<img src="${c.assinatura_fiscal}" class="mx-auto max-h-20 object-contain bg-white rounded-lg border border-gray-200" alt="Assinatura Fiscal">` : '<span class="text-xs text-gray-400 italic my-auto">Sem assinatura</span>'}
                            </div>
                            <div class="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center flex flex-col justify-between min-h-[120px]">
                                <span class="text-xs text-gray-400 block mb-2 uppercase font-medium">Motorista</span>
                                ${c.assinatura_motorista ? `<img src="${c.assinatura_motorista}" class="mx-auto max-h-20 object-contain bg-white rounded-lg border border-gray-200" alt="Assinatura Motorista">` : '<span class="text-xs text-gray-400 italic my-auto">Sem assinatura</span>'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button onclick="document.getElementById('global-checklist-details-modal').remove()" class="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors shadow-sm">
                        Fechar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    } catch (error) {
        console.error(error);
        alert('Erro ao carregar detalhes do checklist: ' + error.message);
    }
};

const AppUX = {
    installPrompt: null,
    statusBadge: null,
    installButton: null,

    init() {
        this.mountWidget();
        this.bindNetworkEvents();
        this.bindInstallPrompt();
        this.updateConnectionStatus(navigator.onLine);
    },

    mountWidget() {
        if (document.getElementById('app-ux-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'app-ux-widget';
        widget.className = 'fixed bottom-4 left-4 z-[60] flex items-center gap-2';
        widget.innerHTML = `
            <button id="app-install-btn" type="button" class="hidden rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-colors hover:bg-black">
                <i class="fas fa-download mr-2"></i> Instalar app
            </button>
            <div id="app-connection-status" class="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-lg border border-gray-100">
                <span class="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                <span>Online</span>
            </div>
        `;
        document.body.appendChild(widget);

        this.statusBadge = document.getElementById('app-connection-status');
        this.installButton = document.getElementById('app-install-btn');

        if (this.installButton) {
            this.installButton.addEventListener('click', async () => {
                if (!this.installPrompt) return;
                this.installPrompt.prompt();
                await this.installPrompt.userChoice;
                this.installPrompt = null;
                this.hideInstallButton();
            });
        }
    },

    bindNetworkEvents() {
        window.addEventListener('online', () => this.updateConnectionStatus(true));
        window.addEventListener('offline', () => this.updateConnectionStatus(false));
    },

    bindInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            this.installPrompt = event;
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            this.installPrompt = null;
            this.hideInstallButton();
        });
    },

    updateConnectionStatus(isOnline) {
        if (!this.statusBadge) return;

        this.statusBadge.innerHTML = isOnline
            ? '<span class="h-2.5 w-2.5 rounded-full bg-green-500"></span><span>Online</span>'
            : '<span class="h-2.5 w-2.5 rounded-full bg-red-500"></span><span>Offline</span>';

        this.statusBadge.classList.toggle('text-gray-600', isOnline);
        this.statusBadge.classList.toggle('text-red-700', !isOnline);
        this.statusBadge.classList.toggle('bg-white', isOnline);
        this.statusBadge.classList.toggle('bg-red-50', !isOnline);
        this.statusBadge.classList.toggle('border-gray-100', isOnline);
        this.statusBadge.classList.toggle('border-red-200', !isOnline);
    },

    showInstallButton() {
        if (this.installButton) {
            this.installButton.classList.remove('hidden');
        }
    },

    hideInstallButton() {
        if (this.installButton) {
            this.installButton.classList.add('hidden');
        }
    }
};

window.AppUX = AppUX;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AppUX.init());
} else {
    AppUX.init();
}
