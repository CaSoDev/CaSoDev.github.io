document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    ExportPage.init();
});

const ExportPage = {
    data: {
        veiculos: [],
        usuarios: [],
        checklists: [],
        abastecimentos: []
    },
    filters: {
        table: 'veiculos',
        search: '',
        profile: '',
        dateFrom: '',
        dateTo: ''
    },

    init() {
        this.setupEvents();
        this.loadAllData();
        this.renderPreview();
    },

    setupEvents() {
        document.getElementById('export-table').addEventListener('change', (event) => {
            this.filters.table = event.target.value;
            this.renderPreview();
        });

        document.getElementById('export-search').addEventListener('input', (event) => {
            this.filters.search = event.target.value.trim().toLowerCase();
            this.renderPreview();
        });

        document.getElementById('export-profile').addEventListener('change', (event) => {
            this.filters.profile = event.target.value;
            this.renderPreview();
        });

        document.getElementById('export-date-from').addEventListener('change', (event) => {
            this.filters.dateFrom = event.target.value;
            this.renderPreview();
        });

        document.getElementById('export-date-to').addEventListener('change', (event) => {
            this.filters.dateTo = event.target.value;
            this.renderPreview();
        });

        document.getElementById('btn-clear-export-filters').addEventListener('click', () => this.clearFilters());
        document.getElementById('btn-refresh-export').addEventListener('click', () => this.loadAllData(true));
        document.getElementById('btn-export-csv').addEventListener('click', () => this.exportCurrent('csv'));
        document.getElementById('btn-export-pdf').addEventListener('click', () => this.exportCurrent('pdf'));
    },

    async loadAllData(force = false) {
        try {
            const [veiculos, usuarios, checklists, abastecimentos] = await Promise.all([
                ApiService.request('/veiculos'),
                ApiService.request('/usuarios'),
                ApiService.request('/checklists'),
                ApiService.request('/abastecimentos')
            ]);

            this.data.veiculos = veiculos;
            this.data.usuarios = usuarios.filter(u => u.status != 0);
            this.data.checklists = checklists;
            this.data.abastecimentos = abastecimentos;
            this.renderPreview();

            if (force) {
                this.showToast('Dados atualizados.');
            }
        } catch (error) {
            this.showToast(error.message || 'Erro ao carregar dados.', 'error');
        }
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';

        toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-full opacity-0`;
        toast.innerHTML = `<i class="fas ${icon} text-lg"></i><span class="font-medium">${message}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
        setTimeout(() => {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    clearFilters() {
        this.filters.search = '';
        this.filters.profile = '';
        this.filters.dateFrom = '';
        this.filters.dateTo = '';
        document.getElementById('export-search').value = '';
        document.getElementById('export-profile').value = '';
        document.getElementById('export-date-from').value = '';
        document.getElementById('export-date-to').value = '';
        this.renderPreview();
    },

    matchesQuery(values) {
        if (!this.filters.search) return true;
        return values.some(value => String(value ?? '').toLowerCase().includes(this.filters.search));
    },

    isWithinDateRange(dateValue) {
        if (!this.filters.dateFrom && !this.filters.dateTo) return true;
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return false;
        const fromOk = !this.filters.dateFrom || date >= new Date(`${this.filters.dateFrom}T00:00:00`);
        const toOk = !this.filters.dateTo || date <= new Date(`${this.filters.dateTo}T23:59:59`);
        return fromOk && toOk;
    },

    getRows() {
        const table = this.filters.table;
        const source = this.data[table] || [];

        if (table === 'veiculos') {
            return source.filter(item => this.matchesQuery([item.placa, item.marca, item.modelo, item.ano, item.tipo_combustivel, item.km_atual]));
        }

        if (table === 'usuarios') {
            return source.filter(item => this.matchesQuery([item.nome, item.cpf, item.email, item.perfil]) && (!this.filters.profile || item.perfil === this.filters.profile));
        }

        if (table === 'checklists') {
            return source.filter(item => this.matchesQuery([item.veiculo_placa, item.motorista_nome, item.fiscal_nome, item.tipo]) && this.isWithinDateRange(item.data_hora));
        }

        return source.filter(item => this.matchesQuery([item.veiculo_placa, item.motorista_nome, item.tipo_combustivel, item.litros, item.valor_total]) && this.isWithinDateRange(item.data_hora));
    },

    getSchema() {
        if (this.filters.table === 'usuarios') {
            return {
                title: 'Usuários',
                headers: ['Nome', 'CPF', 'E-mail', 'Perfil'],
                map: rows => rows.map(item => [item.nome, item.cpf, item.email || '', item.perfil])
            };
        }

        if (this.filters.table === 'checklists') {
            return {
                title: 'Checklists',
                headers: ['Veículo', 'Tipo', 'Motorista', 'Fiscal', 'KM', 'Data/Hora'],
                map: rows => rows.map(item => [item.veiculo_placa, item.tipo, item.motorista_nome, item.fiscal_nome, item.km_registrado, item.data_hora])
            };
        }

        if (this.filters.table === 'abastecimentos') {
            return {
                title: 'Abastecimentos',
                headers: ['Veículo', 'Combustível', 'Motorista', 'Litros', 'Valor Total', 'Data/Hora'],
                map: rows => rows.map(item => [item.veiculo_placa, item.tipo_combustivel, item.motorista_nome, item.litros, item.valor_total, item.data_hora])
            };
        }

        return {
            title: 'Veículos',
            headers: ['Placa', 'Marca', 'Modelo', 'Ano', 'Combustível', 'KM Atual'],
            map: rows => rows.map(item => [item.placa, item.marca, item.modelo, item.ano, item.tipo_combustivel, item.km_atual])
        };
    },

    renderPreview() {
        const rows = this.getRows();
        const schema = this.getSchema();
        const thead = document.getElementById('export-table-head');
        const tbody = document.getElementById('export-table-body');
        const count = document.getElementById('export-count');

        count.textContent = `${rows.length} registros`;
        thead.innerHTML = `<tr>${schema.headers.map(header => `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">${header}</th>`).join('')}</tr>`;

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="${schema.headers.length}" class="px-4 py-8 text-center text-sm text-gray-500">Nenhum registro encontrado para os filtros atuais.</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(item => {
            const cells = schema.map([item])[0].map(value => `<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${this.escapeHtml(value)}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
    },

    escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    exportCurrent(format) {
        const rows = this.getRows();
        const schema = this.getSchema();

        if (!rows.length) {
            this.showToast('Não há dados para exportar.', 'error');
            return;
        }

        const mappedRows = schema.map(rows);
        if (format === 'csv') {
            this.exportCsv(schema.title, schema.headers, mappedRows);
            return;
        }
        this.exportPdf(schema.title, schema.headers, mappedRows);
    },

    exportCsv(title, headers, rows) {
        const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(';')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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

    exportPdf(title, headers, rows) {
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
    }
};
