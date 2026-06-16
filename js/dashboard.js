document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }
    Dashboard.init();
});

const Dashboard = {
    currentView: 'dashboard',
    searchQuery: '',
    filterProfile: '',
    filterDateFrom: '',
    filterDateTo: '',
    tableData: {
        veiculos: [],
        usuarios: [],
        cartoesFrota: [],
        checklists: [],
        abastecimentos: []
    },
    
    init() {
        // Setup User Info
        const user = Auth.getUser();
        document.getElementById('user-name').textContent = user.nome;
        document.querySelector('.h-9.w-9').textContent = user.nome.charAt(0).toUpperCase();

        // Setup Mobile Menu Toggle
        const btnMobile = document.getElementById('btn-mobile-menu');
        const sidebar = document.querySelector('aside');
        const overlay = document.getElementById('sidebar-overlay');
        
        function toggleSidebar() {
            sidebar.classList.toggle('hidden');
            sidebar.classList.toggle('flex');
            sidebar.classList.toggle('fixed');
            sidebar.classList.toggle('inset-y-0');
            sidebar.classList.toggle('left-0');
            sidebar.classList.toggle('shadow-2xl');
            sidebar.classList.toggle('z-40');
            
            if (overlay) {
                overlay.classList.toggle('hidden');
            }
        }

        if (btnMobile && sidebar) {
            btnMobile.addEventListener('click', toggleSidebar);
        }
        if (overlay) {
            overlay.addEventListener('click', toggleSidebar);
        }

        this.setupQuickTools();

        // Setup Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.getAttribute('data-view');
                this.switchView(view);
                
                // Close sidebar on mobile
                if (window.innerWidth < 768 && !sidebar.classList.contains('hidden')) {
                    toggleSidebar();
                }

                // Update active state in sidebar
                document.querySelectorAll('.nav-link').forEach(l => {
                    l.classList.remove('bg-blue-50', 'border-primary', 'text-gray-700');
                    l.classList.add('text-gray-600', 'border-transparent');
                });
                e.currentTarget.classList.add('bg-blue-50', 'border-primary', 'text-gray-700');
                e.currentTarget.classList.remove('text-gray-600', 'border-transparent');

                if (window.innerWidth < 768) {
                    sidebar.classList.add('hidden');
                    sidebar.classList.remove('fixed', 'inset-y-0', 'left-0', 'shadow-2xl', 'z-50');
                }
            });
        });

        // Load initial data
        this.loadDashboardData();
        this.loadVeiculos();
        this.loadUsuarios();
        this.loadCartoesFrota();
    },

    setupQuickTools() {
        const searchInput = document.getElementById('global-table-search');
        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                this.searchQuery = event.target.value.trim().toLowerCase();
                this.applyTableFilter();
            });
        }

        const profileFilter = document.getElementById('filter-profile');
        if (profileFilter) {
            profileFilter.addEventListener('change', (event) => {
                this.filterProfile = event.target.value;
                this.applyTableFilter();
            });
        }

        const dateFromFilter = document.getElementById('filter-date-from');
        if (dateFromFilter) {
            dateFromFilter.addEventListener('change', (event) => {
                this.filterDateFrom = event.target.value;
                this.applyTableFilter();
            });
        }

        const dateToFilter = document.getElementById('filter-date-to');
        if (dateToFilter) {
            dateToFilter.addEventListener('change', (event) => {
                this.filterDateTo = event.target.value;
                this.applyTableFilter();
            });
        }

        const refreshButton = document.getElementById('btn-refresh-data');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.refreshCurrentView());
        }

        const clearButton = document.getElementById('btn-clear-filters');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearFilters());
        }

        const exportCsvButton = document.getElementById('btn-export-csv');
        if (exportCsvButton) {
            exportCsvButton.addEventListener('click', () => this.exportCurrentTable('csv'));
        }

        const exportPdfButton = document.getElementById('btn-export-pdf');
        if (exportPdfButton) {
            exportPdfButton.addEventListener('click', () => this.exportCurrentTable('pdf'));
        }

        const quickButtons = [
            ['quick-view-dashboard', 'dashboard'],
            ['quick-view-veiculos', 'veiculos'],
            ['quick-view-usuarios', 'usuarios'],
            ['quick-view-checklists', 'checklists'],
            ['quick-view-abastecimentos', 'abastecimentos']
        ];

        quickButtons.forEach(([id, view]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => this.switchView(view));
            }
        });

        const quickNewVeiculo = document.getElementById('quick-new-veiculo');
        if (quickNewVeiculo) {
            quickNewVeiculo.addEventListener('click', () => this.openModalVeiculo());
        }

        const quickNewUsuario = document.getElementById('quick-new-usuario');
        if (quickNewUsuario) {
            quickNewUsuario.addEventListener('click', () => this.openModalUsuario());
        }
    },

    refreshCurrentView() {
        if (this.currentView === 'dashboard') {
            this.loadDashboardData();
            this.loadVeiculos();
            this.loadUsuarios();
            this.loadCartoesFrota();
            return;
        }

        if (this.currentView === 'veiculos') {
            this.loadVeiculos();
        } else if (this.currentView === 'usuarios') {
            this.loadUsuarios();
        } else if (this.currentView === 'cartoes-frota') {
            this.loadCartoesFrota();
        } else if (this.currentView === 'checklists') {
            this.loadChecklists();
        } else if (this.currentView === 'abastecimentos') {
            this.loadAllAbastecimentos();
        }
    },

    clearFilters() {
        this.searchQuery = '';
        this.filterProfile = '';
        this.filterDateFrom = '';
        this.filterDateTo = '';

        const searchInput = document.getElementById('global-table-search');
        const profileFilter = document.getElementById('filter-profile');
        const dateFromFilter = document.getElementById('filter-date-from');
        const dateToFilter = document.getElementById('filter-date-to');

        if (searchInput) searchInput.value = '';
        if (profileFilter) profileFilter.value = '';
        if (dateFromFilter) dateFromFilter.value = '';
        if (dateToFilter) dateToFilter.value = '';

        this.applyTableFilter();
        this.showToast('Filtros limpos.');
    },

    applyTableFilter() {
        if (this.currentView === 'veiculos') {
            this.renderVeiculosTable(this.filterVeiculos(this.tableData.veiculos));
        } else if (this.currentView === 'usuarios') {
            this.renderUsuariosTable(this.filterUsuarios(this.tableData.usuarios));
        } else if (this.currentView === 'checklists') {
            this.renderChecklistsTable(this.filterChecklists(this.tableData.checklists));
        } else if (this.currentView === 'abastecimentos') {
            this.renderAbastecimentosTable(this.filterAbastecimentos(this.tableData.abastecimentos));
        }
    },

    isWithinDateRange(dateValue) {
        if (!this.filterDateFrom && !this.filterDateTo) return true;
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return false;

        const fromOk = !this.filterDateFrom || date >= new Date(`${this.filterDateFrom}T00:00:00`);
        const toOk = !this.filterDateTo || date <= new Date(`${this.filterDateTo}T23:59:59`);
        return fromOk && toOk;
    },

    matchesQuery(values) {
        if (!this.searchQuery) return true;
        return values.some(value => String(value ?? '').toLowerCase().includes(this.searchQuery));
    },

    filterVeiculos(veiculos) {
        return veiculos.filter(v => this.matchesQuery([
            v.placa,
            v.marca,
            v.modelo,
            v.ano,
            v.tipo_combustivel,
            v.km_atual
        ]));
    },

    filterUsuarios(usuarios) {
        return usuarios.filter(u => this.matchesQuery([
            u.nome,
            u.cpf,
            u.email,
            u.perfil
        ]) && (!this.filterProfile || u.perfil === this.filterProfile));
    },

    filterChecklists(checklists) {
        return checklists.filter(c => this.matchesQuery([
            c.veiculo_placa,
            c.motorista_nome,
            c.fiscal_nome,
            c.tipo,
            c.data_hora
        ]) && this.isWithinDateRange(c.data_hora));
    },

    filterAbastecimentos(abastecimentos) {
        return abastecimentos.filter(a => this.matchesQuery([
            a.veiculo_placa,
            a.motorista_nome,
            a.tipo_combustivel,
            a.data_hora,
            a.valor_total,
            a.litros
        ]) && this.isWithinDateRange(a.data_hora));
    },

    getActiveTableKey() {
        if (this.currentView === 'dashboard') return 'veiculos';
        return this.currentView;
    },

    getCurrentFilteredRows() {
        const key = this.getActiveTableKey();
        if (key === 'veiculos') return this.filterVeiculos(this.tableData.veiculos);
        if (key === 'usuarios') return this.filterUsuarios(this.tableData.usuarios);
        if (key === 'checklists') return this.filterChecklists(this.tableData.checklists);
        if (key === 'abastecimentos') return this.filterAbastecimentos(this.tableData.abastecimentos);
        return [];
    },

    getExportSchema(key) {
        if (key === 'usuarios') {
            return {
                title: 'Usuários',
                headers: ['Nome', 'CPF', 'E-mail', 'Perfil'],
                rows: rows => rows.map(item => [item.nome, item.cpf, item.email || '', item.perfil])
            };
        }

        if (key === 'checklists') {
            return {
                title: 'Checklists',
                headers: ['Veículo', 'Tipo', 'Motorista', 'Fiscal', 'Data/Hora', 'KM'],
                rows: rows => rows.map(item => [
                    item.veiculo_placa,
                    item.tipo,
                    item.motorista_nome,
                    item.fiscal_nome,
                    item.data_hora,
                    item.km_registrado
                ])
            };
        }

        if (key === 'abastecimentos') {
            return {
                title: 'Abastecimentos',
                headers: ['Veículo', 'Combustível', 'Motorista', 'Litros', 'Valor Total', 'Data/Hora'],
                rows: rows => rows.map(item => [
                    item.veiculo_placa,
                    item.tipo_combustivel,
                    item.motorista_nome,
                    item.litros,
                    item.valor_total,
                    item.data_hora
                ])
            };
        }

        return {
            title: 'Veículos',
            headers: ['Placa', 'Marca', 'Modelo', 'Ano', 'Combustível', 'KM Atual'],
            rows: rows => rows.map(item => [
                item.placa,
                item.marca,
                item.modelo,
                item.ano,
                item.tipo_combustivel,
                item.km_atual
            ])
        };
    },

    exportCurrentTable(format) {
        const key = this.getActiveTableKey();
        const rows = this.getCurrentFilteredRows();
        const schema = this.getExportSchema(key);

        if (!rows.length) {
            this.showToast('Não há dados para exportar.', 'error');
            return;
        }

        if (format === 'csv') {
            this.exportToCsv(schema.title, schema.headers, schema.rows(rows));
            return;
        }

        this.exportToPdf(schema.title, schema.headers, schema.rows(rows));
    },

    exportToCsv(title, headers, rows) {
        const escapeCsv = value => {
            const text = String(value ?? '');
            return `"${text.replace(/"/g, '""')}"`;
        };

        const csvContent = [headers, ...rows].map(row => row.map(escapeCsv).join(';')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        this.showToast(`${title} exportado em CSV.`);
    },

    exportToPdf(title, headers, rows) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            this.showToast('Biblioteca de PDF indisponível.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: rows[0].length > 4 ? 'landscape' : 'portrait' });
        doc.setFontSize(16);
        doc.text(title, 14, 16);
        doc.setFontSize(9);
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 22);

        doc.autoTable({
            head: [headers],
            body: rows,
            startY: 28,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [30, 64, 175] }
        });

        doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
        this.showToast(`${title} exportado em PDF.`);
    },

    renderEmptyRow(tbody, colspan, message) {
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="px-6 py-4 text-center text-sm text-gray-500">${message}</td></tr>`;
    },

    renderVeiculosTable(veiculos) {
        const tbody = document.getElementById('table-veiculos-body');
        tbody.innerHTML = '';

        if (veiculos.length === 0) {
            this.renderEmptyRow(tbody, 5, this.searchQuery ? 'Nenhum veículo encontrado para a busca.' : 'Nenhum veículo encontrado.');
            return;
        }

        veiculos.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(v.placa)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(v.marca)} ${escapeHtml(v.modelo)} (${escapeHtml(v.ano)})</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(v.km_atual)} km</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">${escapeHtml(v.tipo_combustivel)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick='Dashboard.editVeiculo(${JSON.stringify(v)})' class="text-indigo-600 hover:text-indigo-900 mr-3" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick='Dashboard.deleteVeiculo(${v.id})' class="text-red-600 hover:text-red-900" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderUsuariosTable(usuarios) {
        const tbody = document.getElementById('table-usuarios-body');
        tbody.innerHTML = '';

        if (usuarios.length === 0) {
            this.renderEmptyRow(tbody, 4, this.searchQuery ? 'Nenhum usuário encontrado para a busca.' : 'Nenhum usuário encontrado.');
            return;
        }

        usuarios.forEach(u => {
            if (u.status == 0) return;

            const tr = document.createElement('tr');
            let badgeClass = 'bg-gray-100 text-gray-800';
            if (u.perfil === 'admin') badgeClass = 'bg-purple-100 text-purple-800';
            if (u.perfil === 'fiscal') badgeClass = 'bg-green-100 text-green-800';
            if (u.perfil === 'motorista') badgeClass = 'bg-blue-100 text-blue-800';

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(u.nome)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(u.cpf)}<br><span class="text-xs text-gray-400">${escapeHtml(u.email || '')}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass} uppercase">${escapeHtml(u.perfil)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick='Dashboard.editUsuario(${JSON.stringify(u)})' class="text-indigo-600 hover:text-indigo-900 mr-3" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick='Dashboard.deleteUsuario(${u.id})' class="text-red-600 hover:text-red-900" title="Excluir"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderChecklistsTable(checklists) {
        const tbody = document.getElementById('table-checklists-body');
        tbody.innerHTML = '';

        if (checklists.length === 0) {
            this.renderEmptyRow(tbody, 6, this.searchQuery ? 'Nenhum checklist encontrado para a busca.' : 'Nenhum checklist encontrado.');
            return;
        }

        checklists.forEach(c => {
            const tr = document.createElement('tr');
            const isAb = c.tipo === 'abertura';
            const dt = new Date(c.data_hora).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(c.veiculo_placa)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isAb ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'} uppercase">
                        ${isAb ? 'Abertura' : 'Fechamento'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(c.motorista_nome)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(c.fiscal_nome)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(dt)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="verDetalhesChecklist(${c.id})" class="text-primary hover:text-blue-800 inline-flex items-center gap-1 font-semibold" title="Ver Detalhes">
                        <i class="fas fa-eye text-xs"></i> Detalhes
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderAbastecimentosTable(abastecimentos) {
        const tbody = document.getElementById('table-abastecimentos-body');
        tbody.innerHTML = '';

        if (abastecimentos.length === 0) {
            this.renderEmptyRow(tbody, 7, this.searchQuery ? 'Nenhum abastecimento encontrado para a busca.' : 'Nenhum abastecimento encontrado.');
            return;
        }

        abastecimentos.forEach(a => {
            const tr = document.createElement('tr');
            const dt = new Date(a.data_hora).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const cupomUrl = a.foto_cupom.startsWith('http') ? a.foto_cupom : `/${a.foto_cupom}`;
            const bombaUrl = a.foto_bomba ? (a.foto_bomba.startsWith('http') ? a.foto_bomba : `/${a.foto_bomba}`) : null;

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(a.veiculo_placa)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(a.tipo_combustivel)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(a.motorista_nome)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${parseFloat(a.litros).toLocaleString('pt-BR')} L</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">${parseFloat(a.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(dt)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <a href="${cupomUrl}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-xs font-semibold">
                        <i class="fas fa-file-invoice"></i> Cupom
                    </a>
                    ${bombaUrl ? `
                    <a href="${bombaUrl}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-semibold">
                        <i class="fas fa-gas-pump"></i> Bomba
                    </a>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderCartoesFrotaTable(cartoes) {
        const tbody = document.getElementById('table-cartoes-frota-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (!cartoes.length) {
            this.renderEmptyRow(tbody, 6, 'Nenhum cartão cadastrado.');
            return;
        }

        cartoes.forEach(cartao => {
            const tr = document.createElement('tr');
            const ativo = Number(cartao.status) === 1;
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(cartao.veiculo_placa)}<br><span class="text-xs text-gray-400">${escapeHtml(cartao.veiculo_marca)} ${escapeHtml(cartao.veiculo_modelo)}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${escapeHtml(cartao.numero_cartao)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(cartao.apelido || '—')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(cartao.bandeira || '—')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${ativo ? 'Ativo' : 'Inativo'}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick='Dashboard.editCartaoFrota(${JSON.stringify(cartao)})' class="text-indigo-600 hover:text-indigo-900 mr-3" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick='Dashboard.deleteCartaoFrota(${cartao.id})' class="text-red-600 hover:text-red-900" title="Desativar"><i class="fas fa-ban"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
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
        this.currentView = viewName;
        if (viewName === 'checklists') {
            this.loadChecklists();
        } else if (viewName === 'veiculos') {
            this.renderVeiculosTable(this.filterVeiculos(this.tableData.veiculos));
        } else if (viewName === 'usuarios') {
            this.renderUsuariosTable(this.filterUsuarios(this.tableData.usuarios));
        } else if (viewName === 'cartoes-frota') {
            this.loadCartoesFrota();
        } else if (viewName === 'abastecimentos') {
            this.loadAllAbastecimentos();
        } else if (viewName === 'dashboard') {
            this.loadDashboardData();
        }
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        
        toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-full opacity-0`;
        toast.innerHTML = `
            <i class="fas ${icon} text-lg"></i>
            <span class="font-medium">${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        });

        // Remove after 3s
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // ==========================================
    // DATA LOADING & REPORTS
    // ==========================================

    async loadDashboardData() {
        try {
            const [veiculos, usuarios, checklists, abastecimentos] = await Promise.all([
                ApiService.request('/veiculos'),
                ApiService.request('/usuarios'),
                ApiService.request('/checklists'),
                ApiService.request('/abastecimentos')
            ]);

            // 1. Top Cards
            document.getElementById('dash-veiculos-count').textContent = veiculos.length;
            document.getElementById('dash-usuarios-count').textContent = usuarios.filter(u => u.status != 0).length;

            const hojeStr = new Date().toLocaleDateString('pt-BR');
            const checklistsHoje = checklists.filter(c => new Date(c.data_hora).toLocaleDateString('pt-BR') === hojeStr).length;
            document.getElementById('dash-checklists-hoje').textContent = checklistsHoje;

            // Total spent this month on fuel
            const mesAtual = new Date().getMonth();
            const anoAtual = new Date().getFullYear();
            const totalGastoMes = abastecimentos
                .filter(a => {
                    const d = new Date(a.data_hora);
                    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
                })
                .reduce((sum, a) => sum + parseFloat(a.valor_total), 0);
            
            document.getElementById('dash-abast-total').textContent = totalGastoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            // 2. Compute KM driven per driver
            const kmPorMotorista = {};
            const checklistsPorVeiculo = {};
            checklists.forEach(c => {
                if (!checklistsPorVeiculo[c.veiculo_id]) {
                    checklistsPorVeiculo[c.veiculo_id] = [];
                }
                checklistsPorVeiculo[c.veiculo_id].push(c);
            });

            for (const vId in checklistsPorVeiculo) {
                const list = checklistsPorVeiculo[vId].sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
                for (let i = 1; i < list.length; i++) {
                    const prev = list[i-1];
                    const curr = list[i];
                    const diff = parseInt(curr.km_registrado) - parseInt(prev.km_registrado);
                    if (diff > 0) {
                        const mNome = curr.motorista_nome || 'Desconhecido';
                        kmPorMotorista[mNome] = (kmPorMotorista[mNome] || 0) + diff;
                    }
                }
            }

            // 3. Compute fuel consumption per type
            const litrosPorCombustivel = {};
            abastecimentos.forEach(a => {
                const tipo = a.tipo_combustivel;
                litrosPorCombustivel[tipo] = (litrosPorCombustivel[tipo] || 0) + parseFloat(a.litros);
            });

            // 4. Render Chart 1: KM por Motorista
            const motoristasNomes = Object.keys(kmPorMotorista);
            const motoristasKms = Object.values(kmPorMotorista);

            if (this.chartKmMotorista) this.chartKmMotorista.destroy();
            const ctxKm = document.getElementById('chart-km-motorista').getContext('2d');
            this.chartKmMotorista = new Chart(ctxKm, {
                type: 'bar',
                data: {
                    labels: motoristasNomes.length ? motoristasNomes : ['Sem dados'],
                    datasets: [{
                        label: 'KM Rodados',
                        data: motoristasKms.length ? motoristasKms : [0],
                        backgroundColor: '#3b82f6',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });

            // 5. Render Chart 2: Combustivel por Tipo
            const combustiveisNomes = Object.keys(litrosPorCombustivel);
            const combustiveisLitros = Object.values(litrosPorCombustivel);

            if (this.chartCombustivel) this.chartCombustivel.destroy();
            const ctxComb = document.getElementById('chart-combustivel').getContext('2d');
            this.chartCombustivel = new Chart(ctxComb, {
                type: 'doughnut',
                data: {
                    labels: combustiveisNomes.length ? combustiveisNomes : ['Sem dados'],
                    datasets: [{
                        data: combustiveisLitros.length ? combustiveisLitros : [0],
                        backgroundColor: ['#1e40af', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });

            // 6. Populate Table Consumo por Veículo
            const tableConsumoBody = document.getElementById('table-consumo-veiculo-body');
            tableConsumoBody.innerHTML = '';
            
            const consumoPorVeiculo = {};
            veiculos.forEach(v => {
                consumoPorVeiculo[v.id] = {
                    placa: v.placa,
                    modelo: `${v.marca} ${v.modelo}`,
                    totalAbast: 0,
                    litros: 0,
                    valorTotal: 0
                };
            });

            abastecimentos.forEach(a => {
                if (consumoPorVeiculo[a.veiculo_id]) {
                    consumoPorVeiculo[a.veiculo_id].totalAbast += 1;
                    consumoPorVeiculo[a.veiculo_id].litros += parseFloat(a.litros);
                    consumoPorVeiculo[a.veiculo_id].valorTotal += parseFloat(a.valor_total);
                }
            });

            const veiculosSorted = Object.values(consumoPorVeiculo).filter(v => v.totalAbast > 0);
            if (veiculosSorted.length === 0) {
                tableConsumoBody.innerHTML = `<tr><td colspan="4" class="px-4 py-4 text-center text-xs text-gray-400">Nenhum abastecimento registrado.</td></tr>`;
            } else {
                veiculosSorted.forEach(v => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-4 py-3 whitespace-nowrap text-xs font-semibold text-gray-800">${escapeHtml(v.placa)}<br><span class="text-[10px] text-gray-400 font-normal">${escapeHtml(v.modelo)}</span></td>
                        <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-600">${v.totalAbast}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-600">${v.litros.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L</td>
                        <td class="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-900">${v.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    `;
                    tableConsumoBody.appendChild(tr);
                });
            }

            // 7. Populate Table KM por Motorista
            const tableKmBody = document.getElementById('table-km-motorista-body');
            tableKmBody.innerHTML = '';

            const mChecklistsCount = {};
            checklists.forEach(c => {
                const nome = c.motorista_nome || 'Desconhecido';
                mChecklistsCount[nome] = (mChecklistsCount[nome] || 0) + 1;
            });

            const motoristasList = usuarios.filter(u => u.perfil === 'motorista' && u.status != 0);
            if (motoristasList.length === 0) {
                tableKmBody.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-xs text-gray-400">Nenhum motorista cadastrado.</td></tr>`;
            } else {
                motoristasList.forEach(m => {
                    const nome = m.nome;
                    const cCount = mChecklistsCount[nome] || 0;
                    const kmRodado = kmPorMotorista[nome] || 0;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-4 py-3 whitespace-nowrap text-xs font-semibold text-gray-800">${escapeHtml(nome)}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-600">${cCount}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-xs font-bold text-teal-700">${kmRodado.toLocaleString('pt-BR')} km</td>
                    `;
                    tableKmBody.appendChild(tr);
                });
            }

            // 8. Populate Recent Activities List (Checklists + Abastecimentos merged)
            const activitiesList = document.getElementById('recent-activities-list');
            activitiesList.innerHTML = '';

            const mergedActivities = [];
            checklists.forEach(c => {
                mergedActivities.push({
                    tipo: 'checklist',
                    icon: c.tipo === 'abertura' ? 'fa-sun text-green-600 bg-green-50' : 'fa-moon text-purple-600 bg-purple-50',
                    titulo: `Vistoria de ${c.tipo === 'abertura' ? 'Abertura' : 'Fechamento'}`,
                    descricao: `Veículo ${c.veiculo_placa} — Motorista: ${c.motorista_nome} | Fiscal: ${c.fiscal_nome}`,
                    data: new Date(c.data_hora)
                });
            });

            abastecimentos.forEach(a => {
                mergedActivities.push({
                    tipo: 'abastecimento',
                    icon: 'fa-gas-pump text-red-500 bg-red-50',
                    titulo: `Abastecimento de ${a.tipo_combustivel}`,
                    descricao: `Veículo ${a.veiculo_placa} — ${a.litros.toLocaleString('pt-BR')}L (${a.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) por ${a.motorista_nome}`,
                    data: new Date(a.data_hora)
                });
            });

            mergedActivities.sort((a, b) => b.data - a.data);
            const topActivities = mergedActivities.slice(0, 10);

            if (topActivities.length === 0) {
                activitiesList.innerHTML = `
                    <div class="p-6 text-center text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-3 text-gray-300"></i>
                        <p>Nenhuma atividade recente registrada.</p>
                    </div>`;
            } else {
                topActivities.forEach(act => {
                    const item = document.createElement('div');
                    item.className = 'p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors';
                    const timeStr = act.data.toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    });
                    item.innerHTML = `
                        <div class="w-9 h-9 rounded-full flex items-center justify-center ${act.icon}">
                            <i class="fas ${act.icon.split(' ')[0]}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="text-sm font-semibold text-gray-800">${escapeHtml(act.titulo)}</h4>
                            <p class="text-xs text-gray-500 mt-0.5 truncate">${escapeHtml(act.descricao)}</p>
                            <span class="text-[10px] text-gray-400 mt-1 block">${timeStr}</span>
                        </div>
                    `;
                    activitiesList.appendChild(item);
                });
            }

        } catch (error) {
            console.error('Erro ao carregar dashboard', error);
        }
    },

    async loadChecklists() {
        try {
            const checklists = await ApiService.request('/checklists');
            this.tableData.checklists = checklists;
            this.renderChecklistsTable(this.filterChecklists(checklists));
        } catch (error) {
            this.showToast('Erro ao carregar checklists', 'error');
        }
    },

    async loadVeiculos() {
        try {
            const veiculos = await ApiService.request('/veiculos');
            this.tableData.veiculos = veiculos;
            this.renderVeiculosTable(this.filterVeiculos(veiculos));
            document.getElementById('dash-veiculos-count').textContent = veiculos.length;
        } catch (error) {
            this.showToast('Erro ao carregar veículos', 'error');
        }
    },

    async loadUsuarios() {
        try {
            const usuarios = await ApiService.request('/usuarios');
            this.tableData.usuarios = usuarios.filter(u => u.status != 0);
            this.renderUsuariosTable(this.filterUsuarios(this.tableData.usuarios));
            // Update counts loosely
            const activeCount = usuarios.filter(u => u.status != 0).length;
            document.getElementById('dash-usuarios-count').textContent = activeCount;
        } catch (error) {
            this.showToast('Erro ao carregar usuários', 'error');
        }
    },

    async loadCartoesFrota() {
        try {
            const cartoes = await ApiService.request('/cartoes-frota');
            this.tableData.cartoesFrota = cartoes;
            this.renderCartoesFrotaTable(cartoes);
        } catch (error) {
            this.showToast('Erro ao carregar cartões de frota', 'error');
        }
    },

    // ==========================================
    // MODALS LOGIC
    // ==========================================

    openModalUsuario() {
        document.getElementById('form-usuario').reset();
        document.getElementById('usuario_id').value = '';
        document.getElementById('modal-usuario-title').textContent = 'Novo Usuário';
        document.getElementById('usuario_senha').required = true;
        document.getElementById('senha-hint').textContent = '';
        document.getElementById('modal-usuario').classList.remove('hidden');
    },

    editUsuario(u) {
        this.openModalUsuario();
        document.getElementById('modal-usuario-title').textContent = 'Editar Usuário';
        document.getElementById('usuario_id').value = u.id;
        document.getElementById('usuario_nome').value = u.nome;
        document.getElementById('usuario_cpf').value = u.cpf;
        document.getElementById('usuario_telefone').value = u.telefone || '';
        document.getElementById('usuario_email').value = u.email || '';
        document.getElementById('usuario_perfil').value = u.perfil;
        
        document.getElementById('usuario_senha').required = false;
        document.getElementById('senha-hint').textContent = '(Deixe em branco para manter a atual)';
    },

    openModalVeiculo() {
        document.getElementById('form-veiculo').reset();
        document.getElementById('veiculo_id').value = '';
        document.getElementById('modal-veiculo-title').textContent = 'Novo Veículo';
        document.getElementById('modal-veiculo').classList.remove('hidden');
    },

    openModalCartaoFrota() {
        document.getElementById('form-cartao-frota').reset();
        document.getElementById('cartao_frota_id').value = '';
        document.getElementById('modal-cartao-frota-title').textContent = 'Novo Cartão de Frota';
        this.populateCartaoFrotaVeiculos();
        document.getElementById('modal-cartao-frota').classList.remove('hidden');
    },

    populateCartaoFrotaVeiculos(selectedId = '') {
        const select = document.getElementById('cartao_veiculo_id');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione o veículo...</option>' + this.tableData.veiculos.map(v => `<option value="${v.id}">${escapeHtml(v.placa)} — ${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}</option>`).join('');
        if (selectedId) {
            select.value = String(selectedId);
        }
    },

    editCartaoFrota(cartao) {
        this.openModalCartaoFrota();
        document.getElementById('modal-cartao-frota-title').textContent = 'Editar Cartão de Frota';
        document.getElementById('cartao_frota_id').value = cartao.id;
        document.getElementById('cartao_numero').value = cartao.numero_cartao;
        document.getElementById('cartao_apelido').value = cartao.apelido || '';
        document.getElementById('cartao_bandeira').value = cartao.bandeira || '';
        document.getElementById('cartao_status').value = String(Number(cartao.status) === 1 ? 1 : 0);
        this.populateCartaoFrotaVeiculos(cartao.veiculo_id);
    },

    editVeiculo(v) {
        this.openModalVeiculo();
        document.getElementById('modal-veiculo-title').textContent = 'Editar Veículo';
        document.getElementById('veiculo_id').value = v.id;
        document.getElementById('veiculo_placa').value = v.placa;
        document.getElementById('veiculo_ano').value = v.ano;
        document.getElementById('veiculo_marca').value = v.marca;
        document.getElementById('veiculo_modelo').value = v.modelo;
        document.getElementById('veiculo_cor').value = v.cor || '';
        document.getElementById('veiculo_tipo_combustivel').value = v.tipo_combustivel;
        document.getElementById('veiculo_km_atual').value = v.km_atual;
        document.getElementById('veiculo_proxima_troca').value = v.proxima_troca_oleo || '';
    },

    closeModal(id) {
        document.getElementById(id).classList.add('hidden');
    },

    // ==========================================
    // CRUD OPERATIONS
    // ==========================================

    async saveUsuario() {
        const form = document.getElementById('form-usuario');
        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.status = 1;

        if (!data.senha && data.id) {
            delete data.senha;
        }

        try {
            if (data.id) {
                await ApiService.request('/usuarios', 'PUT', data);
                this.showToast('Usuário atualizado com sucesso!');
            } else {
                await ApiService.request('/usuarios', 'POST', data);
                this.showToast('Usuário criado com sucesso!');
            }
            this.closeModal('modal-usuario');
            this.loadUsuarios();
        } catch (error) {
            this.showToast(error.message || 'Erro ao salvar usuário', 'error');
        }
    },

    async deleteUsuario(id) {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
        try {
            await ApiService.request('/usuarios', 'DELETE', { id });
            this.showToast('Usuário excluído com sucesso!');
            this.loadUsuarios();
        } catch (error) {
            this.showToast(error.message || 'Erro ao excluir usuário', 'error');
        }
    },

    async saveVeiculo() {
        const form = document.getElementById('form-veiculo');
        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.status = 1;
        data.placa = data.placa.toUpperCase();

        try {
            if (data.id) {
                await ApiService.request('/veiculos', 'PUT', data);
                this.showToast('Veículo atualizado com sucesso!');
            } else {
                await ApiService.request('/veiculos', 'POST', data);
                this.showToast('Veículo criado com sucesso!');
            }
            this.closeModal('modal-veiculo');
            this.loadVeiculos();
        } catch (error) {
            this.showToast(error.message || 'Erro ao salvar veículo', 'error');
        }
    },

    async deleteVeiculo(id) {
        if (!confirm('Tem certeza que deseja desativar este veículo?')) return;
        try {
            // Note: Api uses GET param inside DELETE or just DELETE with query string. Let's pass it via body as requested by API.
            // VeiculoController delete uses: $_GET['id']. So we need to format the URL or pass it correctly.
            // Wait, VeiculoController delete says: $id = isset($_GET['id']) ? $_GET['id'] : null;
            // But we send method DELETE. Let's append to URL.
            await ApiService.request(`/veiculos?id=${id}`, 'DELETE');
            this.showToast('Veículo excluído com sucesso!');
            this.loadVeiculos();
        } catch (error) {
            this.showToast(error.message || 'Erro ao excluir veículo', 'error');
        }
    },

    async saveCartaoFrota() {
        const form = document.getElementById('form-cartao-frota');
        if (!form.reportValidity()) return;

        const data = Object.fromEntries(new FormData(form).entries());
        data.status = Number(data.status || 1);

        try {
            if (data.id) {
                await ApiService.request('/cartoes-frota', 'PUT', data);
                this.showToast('Cartão atualizado com sucesso!');
            } else {
                await ApiService.request('/cartoes-frota', 'POST', data);
                this.showToast('Cartão cadastrado com sucesso!');
            }
            this.closeModal('modal-cartao-frota');
            this.loadCartoesFrota();
        } catch (error) {
            this.showToast(error.message || 'Erro ao salvar cartão de frota', 'error');
        }
    },

    async deleteCartaoFrota(id) {
        if (!confirm('Tem certeza que deseja desativar este cartão?')) return;
        try {
            await ApiService.request(`/cartoes-frota?id=${id}`, 'DELETE');
            this.showToast('Cartão desativado com sucesso!');
            this.loadCartoesFrota();
        } catch (error) {
            this.showToast(error.message || 'Erro ao desativar cartão', 'error');
        }
    },

    async loadAllAbastecimentos() {
        try {
            const abastecimentos = await ApiService.request('/abastecimentos');
            this.tableData.abastecimentos = abastecimentos;
            this.renderAbastecimentosTable(this.filterAbastecimentos(abastecimentos));
        } catch (error) {
            this.showToast('Erro ao carregar abastecimentos', 'error');
        }
    }
};
