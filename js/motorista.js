document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) { window.location.href = 'index.html'; return; }
    const user = Auth.getUser();
    if (user.perfil !== 'motorista') { window.location.href = 'index.html'; return; }
    Motorista.init();
});

const Motorista = {
    _currentView: 'inicio',

    init() {
        const user = Auth.getUser();
        const primeiroNome = user.nome.split(' ')[0];
        document.getElementById('header-nome').textContent = primeiroNome;
        document.getElementById('avatar-letter').textContent = primeiroNome.charAt(0).toUpperCase();

        // Saudação dinâmica
        const hora = new Date().getHours();
        const saudacao = hora < 12 ? 'Bom dia,' : hora < 18 ? 'Boa tarde,' : 'Boa noite,';
        const pGreeting = document.querySelector('header p.text-blue-200');
        if (pGreeting) pGreeting.textContent = saudacao;

        this.carregarVeiculos();
        this.carregarDashboard();
    },

    switchView(viewName) {
        document.querySelectorAll('.view-section').forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('block');
        });
        const target = document.getElementById(`view-${viewName}`);
        if (target) { target.classList.remove('hidden'); target.classList.add('block'); }

        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.classList.remove('active');
            btn.classList.add('text-gray-400');
        });
        const activeBtn = document.querySelector(`.nav-tab[data-view="${viewName}"]`);
        if (activeBtn) { activeBtn.classList.add('active'); activeBtn.classList.remove('text-gray-400'); }

        this._currentView = viewName;

        if (viewName === 'checklists') this.carregarChecklists();
        if (viewName === 'inicio')     this.carregarDashboard();
    },

    showToast(msg, type = 'success') {
        const c     = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const bg    = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon  = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        toast.className = `pointer-events-auto ${bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 transition-all duration-300 opacity-0 -translate-y-2`;
        toast.innerHTML = `<i class="fas ${icon}"></i><span class="text-sm font-medium">${msg}</span>`;
        c.appendChild(toast);
        requestAnimationFrame(() => toast.classList.remove('opacity-0', '-translate-y-2'));
        setTimeout(() => { toast.classList.add('opacity-0', '-translate-y-2'); setTimeout(() => toast.remove(), 300); }, 3500);
    },

    // ============================================================
    // VEÍCULOS (para os selects)
    // ============================================================
    async carregarVeiculos() {
        try {
            const veiculos = await ApiService.request('/veiculos');
            const sel = document.getElementById('abast-veiculo');
            const selCartao = document.getElementById('abast-cartao-frota');
            const infoCartao = document.getElementById('abast-cartao-info');
            veiculos.forEach(v => {
                const o = document.createElement('option');
                o.value = v.id;
                o.textContent = `${v.placa} — ${v.marca} ${v.modelo}`;
                o.dataset.km = v.km_atual;
                sel.appendChild(o);
            });
            // Auto-preencher KM ao mudar veículo
            sel.addEventListener('change', () => {
                const opt = sel.options[sel.selectedIndex];
                if (opt.dataset.km) {
                    document.getElementById('abast-km').placeholder = `Último: ${Number(opt.dataset.km).toLocaleString('pt-BR')} km`;
                }
                this.carregarCartoesFrota(sel.value);
            });

            if (selCartao) {
                selCartao.innerHTML = '<option value="">Selecione o veículo primeiro...</option>';
                selCartao.disabled = true;
            }
            if (infoCartao) {
                infoCartao.textContent = 'O cartão precisa pertencer ao veículo selecionado.';
            }
        } catch (e) { this.showToast('Erro ao carregar veículos.', 'error'); }
    },

    async carregarCartoesFrota(veiculoId) {
        const selCartao = document.getElementById('abast-cartao-frota');
        const infoCartao = document.getElementById('abast-cartao-info');

        if (!selCartao) return;

        selCartao.disabled = true;
        selCartao.innerHTML = '<option value="">Carregando cartões...</option>';

        if (!veiculoId) {
            selCartao.innerHTML = '<option value="">Selecione o veículo primeiro...</option>';
            if (infoCartao) infoCartao.textContent = 'O cartão precisa pertencer ao veículo selecionado.';
            return;
        }

        try {
            const cartoes = await ApiService.request(`/cartoes-frota?veiculo_id=${veiculoId}`);
            if (!cartoes.length) {
                selCartao.innerHTML = '<option value="">Nenhum cartão cadastrado para este veículo</option>';
                if (infoCartao) infoCartao.textContent = 'Cadastre um cartão de frota no admin para liberar o abastecimento.';
                return;
            }

            selCartao.innerHTML = '<option value="">Selecione o cartão...</option>' + cartoes.map(c => {
                const label = c.apelido ? `${c.apelido} - ${c.numero_cartao}` : c.numero_cartao;
                return `<option value="${c.id}">${label}</option>`;
            }).join('');
            selCartao.disabled = false;
            if (infoCartao) infoCartao.textContent = `${cartoes.length} cartão(ões) disponível(is) para este veículo.`;
        } catch (e) {
            selCartao.innerHTML = '<option value="">Erro ao carregar cartões</option>';
            if (infoCartao) infoCartao.textContent = 'Não foi possível carregar os cartões da frota.';
        }
    },

    // ============================================================
    // DASHBOARD (Início)
    // ============================================================
    async carregarDashboard() {
        try {
            const [checklists, abastecimentos] = await Promise.all([
                ApiService.request('/checklists'),
                ApiService.request('/abastecimentos')
            ]);

            // Contadores
            document.getElementById('stat-checklists').textContent = checklists.length;
            document.getElementById('stat-abast').textContent      = abastecimentos.length;

            // KM e último veículo
            if (checklists.length > 0) {
                const ultimo = checklists[0];
                document.getElementById('stat-km').textContent = Number(ultimo.km_registrado).toLocaleString('pt-BR');
                document.getElementById('ultimo-veiculo').innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-truck text-teal-600 text-xl"></i>
                        </div>
                        <div class="text-left">
                            <div class="font-bold text-gray-800">${ultimo.veiculo_placa}</div>
                            <div class="text-xs text-gray-500">KM: ${Number(ultimo.km_registrado).toLocaleString('pt-BR')}</div>
                            <div class="text-xs text-gray-400">${new Date(ultimo.data_hora).toLocaleDateString('pt-BR')}</div>
                        </div>
                    </div>
                `;
            } else {
                document.getElementById('stat-km').textContent = '—';
            }

            // Gastos mês (abastecimentos)
            const mesAtual = new Date().getMonth();
            const gastosMes = abastecimentos
                .filter(a => new Date(a.data_hora).getMonth() === mesAtual)
                .reduce((acc, a) => acc + parseFloat(a.valor_total), 0);
            // reutilizamos o card de abastecimento para mostrar o total do mês em hover/tooltip — exibimos só a contagem na grade de stats
        } catch (e) {
            document.getElementById('stat-km').textContent = '—';
            document.getElementById('stat-checklists').textContent = '—';
            document.getElementById('stat-abast').textContent = '—';
        }
    },

    // ============================================================
    // CHECKLISTS
    // ============================================================
    async carregarChecklists() {
        const container = document.getElementById('lista-checklists');
        container.innerHTML = `<div class="text-center text-gray-400 py-10"><i class="fas fa-spinner fa-spin text-2xl"></i></div>`;
        try {
            const lista = await ApiService.request('/checklists');
            container.innerHTML = '';

            if (!lista.length) {
                container.innerHTML = `
                    <div class="text-center text-gray-400 py-10 bg-white rounded-xl border border-gray-100">
                        <i class="fas fa-clipboard-list text-4xl text-gray-200 mb-2 block"></i>
                        <p class="text-sm">Nenhum checklist encontrado.</p>
                    </div>`;
                return;
            }

            lista.forEach(c => {
                const dt = new Date(c.data_hora).toLocaleString('pt-BR', {
                    day:'2-digit', month:'2-digit', year:'numeric',
                    hour:'2-digit', minute:'2-digit'
                });
                const isAb = c.tipo === 'abertura';
                const card = document.createElement('div');
                card.className = 'bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:border-primary/50 transition-colors';
                card.onclick = () => verDetalhesChecklist(c.id);
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <span class="font-bold text-gray-800 text-base">${escapeHtml(c.veiculo_placa)}</span>
                            <p class="text-xs text-gray-400 mt-0.5">${dt}</p>
                        </div>
                        <span class="px-2 py-1 rounded-full text-xs font-bold ${isAb ? 'badge-abertura' : 'badge-fechamento'}">
                            ${isAb ? '🌅 Abertura' : '🌙 Fechamento'}
                        </span>
                    </div>
                    <div class="flex items-center justify-between text-sm text-gray-600">
                        <span><i class="fas fa-user-tie text-gray-300 mr-1"></i> Fiscal: ${escapeHtml(c.fiscal_nome)}</span>
                        <span class="font-semibold text-teal-700"><i class="fas fa-tachometer-alt mr-1"></i>${Number(c.km_registrado).toLocaleString('pt-BR')} km</span>
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (e) {
            container.innerHTML = `<div class="text-red-400 text-center text-sm py-6">Erro ao carregar checklists.</div>`;
        }
    },

    // ============================================================
    // ABASTECIMENTO
    // ============================================================
    calcularTotal() {
        const litros      = parseFloat(document.getElementById('abast-litros').value)      || 0;
        const valorLitro  = parseFloat(document.getElementById('abast-valor-litro').value) || 0;
        const total       = (litros * valorLitro).toFixed(2);
        if (litros > 0 && valorLitro > 0) {
            document.getElementById('abast-valor-total').value = total;
        }
    },

    previewFoto(input, previewId) {
        const container = document.getElementById(previewId);
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            container.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover rounded-xl">`;
            // Adicionar botão de troca sobreposto
            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-xl opacity-0 hover:opacity-100 transition-opacity cursor-pointer';
            overlay.innerHTML = `<span class="text-white text-xs font-bold"><i class="fas fa-camera mr-1"></i>Trocar</span>`;
            overlay.onclick = () => input.click();
            container.style.position = 'relative';
            container.appendChild(overlay);
        };
        reader.readAsDataURL(file);
    },

    async salvarAbastecimento() {
        const form = document.getElementById('form-abastecimento');

        if (!form.veiculo_id.value)       { this.showToast('Selecione o veículo.',         'error'); return; }
        if (!form.cartao_frota_id.value)  { this.showToast('Selecione o cartão da frota.',  'error'); return; }
        if (!form.km_abastecimento.value) { this.showToast('Informe o KM.',                'error'); return; }
        if (!form.litros.value)           { this.showToast('Informe os litros.',            'error'); return; }
        if (!form.valor_litro.value)      { this.showToast('Informe o valor por litro.',    'error'); return; }
        if (!form.valor_total.value)      { this.showToast('Informe o valor total.',        'error'); return; }
        if (!form.tipo_combustivel.value) { this.showToast('Selecione o combustível.',      'error'); return; }

        const fotoCupom = document.getElementById('foto-cupom').files[0];
        if (!fotoCupom) { this.showToast('Foto do cupom fiscal é obrigatória.', 'error'); return; }

        const btn = document.getElementById('btn-salvar-abast');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            const fd = new FormData(form);
            await ApiService.request('/abastecimentos', 'POST', fd);
            this.showToast('Abastecimento registrado com sucesso!');

            // Reset form
            form.reset();
            document.getElementById('preview-cupom').innerHTML = `
                <i class="fas fa-receipt text-2xl mb-1"></i>
                <span class="text-xs">Toque para fotografar o cupom</span>`;
            document.getElementById('preview-bomba').innerHTML = `
                <i class="fas fa-gas-pump text-2xl mb-1"></i>
                <span class="text-xs">Toque para fotografar a bomba</span>`;
            document.getElementById('abast-cartao-frota').innerHTML = '<option value="">Selecione o veículo primeiro...</option>';
            document.getElementById('abast-cartao-frota').disabled = true;
            document.getElementById('abast-cartao-info').textContent = 'O cartão precisa pertencer ao veículo selecionado.';

            // Navega para início
            setTimeout(() => this.switchView('inicio'), 500);
        } catch (e) {
            this.showToast(e.message || 'Erro ao registrar abastecimento.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Registrar Abastecimento';
        }
    }
};
