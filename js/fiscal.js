document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    const user = Auth.getUser();
    if (user.perfil !== 'fiscal' && user.perfil !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    Fiscal.init();
});

// ============================================================
// Itens padrão do Checklist
// ============================================================
const ITENS_INSPECAO = [
    { nome: "Faróis Dianteiros e Traseiros", icone: "fa-lightbulb" },
    { nome: "Lanternas e Pisca-Alertas",     icone: "fa-circle-dot" },
    { nome: "Pneus (Calibragem e Desgaste)", icone: "fa-circle" },
    { nome: "Estepe e Macaco",               icone: "fa-toolbox" },
    { nome: "Lataria (Amassados/Riscos)",     icone: "fa-car-side" },
    { nome: "Vidros e Espelhos",             icone: "fa-binoculars" },
    { nome: "Nível de Óleo do Motor",        icone: "fa-oil-can" },
    { nome: "Nível de Água (Arrefecimento)", icone: "fa-temperature-half" },
    { nome: "Extintor de Incêndio",          icone: "fa-fire-extinguisher" },
    { nome: "Documentação do Veículo",       icone: "fa-file-alt" },
    { nome: "Limpeza Interna e Externa",     icone: "fa-broom" },
    { nome: "Cinto de Segurança",            icone: "fa-shield-alt" },
];

// ============================================================
// Canvas Signature Helper
// ============================================================
class SignaturePad {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.drawing = false;
        this.hasSigned = false;
        this._setup();
    }

    _setup() {
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 2.5;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Mouse events
        this.canvas.addEventListener('mousedown',  e => this._start(e));
        this.canvas.addEventListener('mousemove',  e => this._draw(e));
        this.canvas.addEventListener('mouseup',    () => this._stop());
        this.canvas.addEventListener('mouseleave', () => this._stop());

        // Touch events
        this.canvas.addEventListener('touchstart', e => { e.preventDefault(); this._start(e.touches[0]); }, { passive: false });
        this.canvas.addEventListener('touchmove',  e => { e.preventDefault(); this._draw(e.touches[0]);  }, { passive: false });
        this.canvas.addEventListener('touchend',   () => this._stop());
    }

    _getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width  / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top)  * scaleY
        };
    }

    _start(e) {
        this.drawing = true;
        const pos = this._getPos(e);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        if (!this.hasSigned) {
            this.hasSigned = true;
            this.canvas.classList.add('signed');
        }
    }

    _draw(e) {
        if (!this.drawing) return;
        const pos = this._getPos(e);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
    }

    _stop() {
        this.drawing = false;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.hasSigned = false;
        this.canvas.classList.remove('signed');
    }

    isEmpty() {
        return !this.hasSigned;
    }

    toDataURL() {
        return this.canvas.toDataURL('image/png');
    }
}

// ============================================================
// FISCAL APP
// ============================================================
const Fiscal = {
    itensSelecionados: [],
    fotoFiles: [],
    sigFiscal: null,
    sigMotorista: null,

    init() {
        const user = Auth.getUser();
        document.getElementById('user-greeting').textContent = `Olá, ${user.nome.split(' ')[0]}`;

        // Inicializar pads de assinatura
        this.sigFiscal    = new SignaturePad('canvas-fiscal');
        this.sigMotorista = new SignaturePad('canvas-motorista');

        // Estilo dos radio buttons de Tipo
        document.querySelectorAll('.tipo-radio-label input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                document.querySelectorAll('.tipo-radio-label span').forEach(s => {
                    s.style.background = '';
                    s.style.color = '';
                    s.style.borderColor = '';
                });
                const span = radio.nextElementSibling;
                span.style.background = '#1e40af';
                span.style.color = '#fff';
                span.style.borderColor = '#1e40af';
            });
        });

        // Navegação Bottom
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', e => {
                const view = e.currentTarget.getAttribute('data-view');
                this.switchView(view);
                document.querySelectorAll('.nav-tab').forEach(t => {
                    t.classList.remove('text-primary', 'bg-blue-50');
                    t.classList.add('text-gray-400');
                });
                e.currentTarget.classList.add('text-primary', 'bg-blue-50');
                e.currentTarget.classList.remove('text-gray-400');
            });
        });

        this.renderizarItens();
        this.carregarSelects();
        this.carregarHistorico();
    },

    switchView(viewName) {
        document.querySelectorAll('.view-section').forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('block');
        });
        const target = document.getElementById(`view-${viewName}`);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('block');
        }
        if (viewName === 'inicio') this.carregarHistorico();
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const bg   = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        toast.className = `${bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 transition-all duration-300 opacity-0 -translate-y-2`;
        toast.innerHTML = `<i class="fas ${icon}"></i><span class="text-sm font-medium">${message}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', '-translate-y-2');
        });
        setTimeout(() => {
            toast.classList.add('opacity-0', '-translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    async carregarSelects() {
        try {
            const [veiculos, usuarios] = await Promise.all([
                ApiService.request('/veiculos'),
                ApiService.request('/usuarios')
            ]);
            const selV = document.getElementById('veiculo_id');
            veiculos.forEach(v => {
                const o = document.createElement('option');
                o.value = v.id;
                o.textContent = `${v.placa} — ${v.marca} ${v.modelo}`;
                selV.appendChild(o);
            });
            const selM = document.getElementById('motorista_id');
            usuarios.filter(u => u.perfil === 'motorista' && u.status == 1).forEach(m => {
                const o = document.createElement('option');
                o.value = m.id;
                o.textContent = m.nome;
                selM.appendChild(o);
            });
        } catch (e) {
            this.showToast('Erro ao carregar dados da API.', 'error');
        }
    },

    renderizarItens() {
        const container = document.getElementById('lista-itens');
        container.innerHTML = '';
        this.itensSelecionados = ITENS_INSPECAO.map(i => ({
            nome_item: i.nome,
            status_item: 'conforme',
            observacao: ''
        }));

        ITENS_INSPECAO.forEach((item, idx) => {
            const div = document.createElement('div');
            div.id = `item-row-${idx}`;
            div.className = 'flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50 transition-all';
            div.innerHTML = `
                <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
                    <i class="fas ${item.icone} text-gray-400 w-5 text-center flex-shrink-0"></i>
                    <div class="min-w-0">
                        <span class="text-sm font-medium text-gray-800 block">${item.nome}</span>
                        <span class="text-xs text-red-500 hidden" id="obs-display-${idx}"></span>
                    </div>
                </div>
                <div class="flex gap-2 flex-shrink-0">
                    <button type="button" id="btn-ok-${idx}" onclick="Fiscal.marcarItem(${idx},'conforme')"
                        class="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                        <i class="fas fa-check text-sm"></i>
                    </button>
                    <button type="button" id="btn-nok-${idx}" onclick="Fiscal.marcarItem(${idx},'nao_conforme')"
                        class="w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                        <i class="fas fa-times text-sm"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    },

    marcarItem(idx, status) {
        this.itensSelecionados[idx].status_item = status;
        const row    = document.getElementById(`item-row-${idx}`);
        const btnOk  = document.getElementById(`btn-ok-${idx}`);
        const btnNok = document.getElementById(`btn-nok-${idx}`);
        const obsEl  = document.getElementById(`obs-display-${idx}`);

        if (status === 'conforme') {
            btnOk.className  = 'w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm active:scale-95 transition-transform';
            btnNok.className = 'w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center shadow-sm active:scale-95 transition-transform';
            row.classList.remove('item-nok');
            this.itensSelecionados[idx].observacao = '';
            obsEl.textContent = '';
            obsEl.classList.add('hidden');
        } else {
            btnNok.className = 'w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm active:scale-95 transition-transform';
            btnOk.className  = 'w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center shadow-sm active:scale-95 transition-transform';
            row.classList.add('item-nok');
            this._pendingNokIndex = idx;
            this.abrirModalObs(idx);
        }
    },

    abrirModalObs(idx) {
        document.getElementById('obs-item-index').value = idx;
        document.getElementById('modal-obs-item-name').textContent = this.itensSelecionados[idx].nome_item;
        document.getElementById('obs-text').value = this.itensSelecionados[idx].observacao;
        document.getElementById('modal-obs').classList.remove('hidden');
        setTimeout(() => document.getElementById('obs-text').focus(), 100);
    },

    fecharModalObs() {
        document.getElementById('modal-obs').classList.add('hidden');
    },

    cancelarNaoConformidade() {
        // Reverte para conforme se cancelou
        const idx = parseInt(document.getElementById('obs-item-index').value);
        if (this.itensSelecionados[idx].observacao === '') {
            this.marcarItem(idx, 'conforme');
        }
        this.fecharModalObs();
    },

    salvarObs() {
        const idx = parseInt(document.getElementById('obs-item-index').value);
        const obs = document.getElementById('obs-text').value.trim();
        if (!obs) {
            alert('Por favor, descreva o problema encontrado.');
            return;
        }
        this.itensSelecionados[idx].observacao = obs;
        const obsEl = document.getElementById(`obs-display-${idx}`);
        obsEl.textContent = `⚠ ${obs}`;
        obsEl.classList.remove('hidden');
        this.fecharModalObs();
    },

    // ---- FOTOS ----
    adicionarFotos(input) {
        const grid = document.getElementById('fotos-grid');
        const btnAdd = document.getElementById('btn-add-foto');

        Array.from(input.files).forEach(file => {
            this.fotoFiles.push(file);

            const reader = new FileReader();
            reader.onload = e => {
                const wrapper = document.createElement('div');
                wrapper.className = 'relative';

                const idx = this.fotoFiles.length - 1;
                wrapper.innerHTML = `
                    <img src="${e.target.result}" class="photo-thumb" alt="Foto ${idx + 1}">
                    <button type="button" onclick="Fiscal.removerFoto(${idx}, this.parentElement)"
                        class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center shadow">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                grid.insertBefore(wrapper, btnAdd);
            };
            reader.readAsDataURL(file);
        });

        // Reset input para permitir reselecionar o mesmo arquivo
        input.value = '';
        this._atualizarContadorFotos();
    },

    removerFoto(idx, el) {
        this.fotoFiles.splice(idx, 1);
        el.remove();
        this._atualizarContadorFotos();
        // Re-indexar botões de remoção
        const grid = document.getElementById('fotos-grid');
        grid.querySelectorAll('[onclick^="Fiscal.removerFoto"]').forEach((btn, i) => {
            btn.setAttribute('onclick', `Fiscal.removerFoto(${i}, this.parentElement)`);
        });
    },

    _atualizarContadorFotos() {
        document.getElementById('fotos-count').textContent = `${this.fotoFiles.length} foto(s) adicionada(s)`;
    },

    // ---- ASSINATURAS ----
    limparAssinatura(canvasId) {
        if (canvasId === 'canvas-fiscal')    this.sigFiscal.clear();
        if (canvasId === 'canvas-motorista') this.sigMotorista.clear();
    },

    // ---- SALVAR ----
    async salvarChecklist() {
        const form = document.getElementById('form-checklist');

        // Validações manuais
        if (!form.tipo.value) {
            this.showToast('Selecione o tipo de vistoria (Abertura ou Fechamento).', 'error');
            return;
        }
        if (!form.veiculo_id.value) {
            this.showToast('Selecione o veículo.', 'error');
            return;
        }
        if (!form.motorista_id.value) {
            this.showToast('Selecione o motorista.', 'error');
            return;
        }
        if (!form.km_registrado.value) {
            this.showToast('Informe o KM atual do painel.', 'error');
            return;
        }
        if (this.sigFiscal.isEmpty()) {
            this.showToast('A assinatura do Fiscal é obrigatória.', 'error');
            return;
        }
        if (this.sigMotorista.isEmpty()) {
            this.showToast('A assinatura do Motorista é obrigatória.', 'error');
            return;
        }

        const btn = document.getElementById('btn-salvar');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            // Monta FormData
            const fd = new FormData();
            fd.append('veiculo_id',           form.veiculo_id.value);
            fd.append('motorista_id',         form.motorista_id.value);
            fd.append('tipo',                 form.tipo.value);
            fd.append('km_registrado',        form.km_registrado.value);
            fd.append('itens',                JSON.stringify(this.itensSelecionados));
            fd.append('assinatura_fiscal',    this.sigFiscal.toDataURL());
            fd.append('assinatura_motorista', this.sigMotorista.toDataURL());

            // Fotos
            this.fotoFiles.forEach(file => {
                fd.append('fotos[]', file);
            });

            await ApiService.request('/checklists', 'POST', fd);

            this.showToast('Checklist registrado com sucesso!');

            // Reset completo
            form.reset();
            document.querySelectorAll('.tipo-radio-label span').forEach(s => {
                s.style.background = '';
                s.style.color = '';
                s.style.borderColor = '';
            });
            this.fotoFiles = [];
            document.getElementById('fotos-grid').querySelectorAll('.relative').forEach(el => el.remove());
            this._atualizarContadorFotos();
            this.sigFiscal.clear();
            this.sigMotorista.clear();
            this.renderizarItens();

            // Volta para histórico
            document.querySelector('.nav-tab[data-view="inicio"]').click();

        } catch (error) {
            this.showToast(error.message || 'Erro ao registrar checklist.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Registrar Checklist';
        }
    },

    async carregarHistorico() {
        const container = document.getElementById('lista-checklists');
        try {
            const checklists = await ApiService.request('/checklists');
            container.innerHTML = '';

            if (!checklists.length) {
                container.innerHTML = `
                    <div class="text-center text-gray-400 py-10 bg-white rounded-xl shadow-sm border border-gray-100">
                        <i class="fas fa-clipboard-list text-4xl mb-3 text-gray-200"></i>
                        <p class="text-sm">Nenhum checklist registrado ainda.</p>
                        <p class="text-xs text-gray-300 mt-1">Clique em "Novo" para começar.</p>
                    </div>`;
                return;
            }

            checklists.forEach(c => {
                const dt = new Date(c.data_hora).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
                const isAbertura = c.tipo === 'abertura';
                const card = document.createElement('div');
                card.className = 'bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:border-primary/50 transition-colors';
                card.onclick = () => verDetalhesChecklist(c.id);
                card.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-gray-800 text-base">${escapeHtml(c.veiculo_placa)}</span>
                        <span class="px-2 py-1 rounded-full text-xs font-bold ${isAbertura ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}">
                            ${isAbertura ? '🌅 Abertura' : '🌙 Fechamento'}
                        </span>
                    </div>
                    <div class="text-sm text-gray-600 flex items-center gap-1 mb-1">
                        <i class="fas fa-user text-gray-300 w-4 text-center"></i> ${escapeHtml(c.motorista_nome)}
                    </div>
                    <div class="text-sm text-gray-600 flex items-center gap-1 mb-2">
                        <i class="fas fa-tachometer-alt text-gray-300 w-4 text-center"></i> ${Number(c.km_registrado).toLocaleString('pt-BR')} km
                    </div>
                    <div class="text-xs text-gray-400 border-t border-gray-50 pt-2">
                        <i class="fas fa-calendar text-gray-200"></i> ${escapeHtml(dt)} &nbsp;|&nbsp; Fiscal: ${escapeHtml(c.fiscal_nome)}
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (e) {
            container.innerHTML = `<div class="text-red-400 text-center text-sm py-6">Erro ao carregar histórico.</div>`;
        }
    }
};
