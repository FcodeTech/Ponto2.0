// js/configuracoes.js
// Script dedicado à página de Configurações do Sistema

(function () {
    'use strict';

    // ── Estado local ───────────────────────────────────────────
    let _selectedColor = '#0066cc';
    let _selectedFile  = null;  // File object do input
    let _currentLogoUrl = '';   // URL atual salva no banco

    // ── Init (chamado após initDashboard restaurar sessão) ────
    window.initConfiguracoes = async function () {
        await _loadCurrentSettings();
        _bindColorButtons();
        _bindFileInput();
        _bindRemoveLogo();
        _bindSaveButton();
        _bindResetButton();
    };

    // ─────────────────────────────────────────────────────────
    // Carregar configurações atuais e popular os campos
    // ─────────────────────────────────────────────────────────
    async function _loadCurrentSettings() {
        try {
            const settings = await db.settings.get('global');
            if (!settings) return;

            // Nome do sistema
            const nameInput = document.getElementById('config-system-name');
            if (nameInput) nameInput.value = settings.systemName || '';

            // Logo atual
            if (settings.logoUrl) {
                _currentLogoUrl = settings.logoUrl;
                _showLogoPreview(settings.logoUrl);
            }

            // Cor principal — marcar botão ativo
            if (settings.primaryColor) {
                _selectedColor = settings.primaryColor;
                document.querySelectorAll('.color-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.color === _selectedColor);
                });
            }

            // Toggles
            const inssSwitch = document.getElementById('checkbox-inss');
            if (inssSwitch) inssSwitch.checked = !!settings.inssCalculation;

            const noturnoSwitch = document.getElementById('checkbox-noturno');
            if (noturnoSwitch) noturnoSwitch.checked = !!settings.noturnoCalculation;

            const fgtsSwitch = document.getElementById('checkbox-fgts');
            if (fgtsSwitch) fgtsSwitch.checked = !!settings.fgtsCalculation;

            const decimoSwitch = document.getElementById('checkbox-13');
            if (decimoSwitch) decimoSwitch.checked = !!settings.decimoTerceiroCalculation;

        } catch (e) {
            console.error('[Configurações] Erro ao carregar settings:', e);
        }
    }

    // ─────────────────────────────────────────────────────────
    // Bind: botões de cor
    // ─────────────────────────────────────────────────────────
    function _bindColorButtons() {
        const colorBtns = document.querySelectorAll('.color-btn');
        colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                colorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                _selectedColor = btn.dataset.color;
                // Preview ao vivo
                document.documentElement.style.setProperty('--primary-color', _selectedColor);
            });
        });
    }

    // ─────────────────────────────────────────────────────────
    // Bind: input de arquivo (logo)
    // ─────────────────────────────────────────────────────────
    function _bindFileInput() {
        const fileInput = document.getElementById('config-logo-file');
        if (!fileInput) return;

        fileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            // Validação de tipo
            if (!file.type.startsWith('image/')) {
                showToast('Selecione um arquivo de imagem válido (PNG, JPG, etc.).', 'error');
                fileInput.value = '';
                return;
            }

            // Validação de tamanho (máx 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showToast('A imagem deve ter no máximo 2MB.', 'error');
                fileInput.value = '';
                return;
            }

            _selectedFile = file;

            // Preview local imediato
            const reader = new FileReader();
            reader.onload = function (evt) {
                _showLogoPreview(evt.target.result);
            };
            reader.readAsDataURL(file);
        });
    }

    // ─────────────────────────────────────────────────────────
    // Exibir preview da logo
    // ─────────────────────────────────────────────────────────
    function _showLogoPreview(src) {
        const previewImg = document.getElementById('config-logo-preview');
        const previewContainer = document.getElementById('config-logo-preview-container');
        if (previewImg && previewContainer) {
            previewImg.src = src;
            previewContainer.style.display = 'flex';
        }
    }

    function _hideLogoPreview() {
        const previewContainer = document.getElementById('config-logo-preview-container');
        const previewImg = document.getElementById('config-logo-preview');
        if (previewContainer) previewContainer.style.display = 'none';
        if (previewImg) previewImg.src = '';
        _currentLogoUrl = '';
        _selectedFile = null;
        const fileInput = document.getElementById('config-logo-file');
        if (fileInput) fileInput.value = '';
    }

    // ─────────────────────────────────────────────────────────
    // Bind: botão Remover Logo
    // ─────────────────────────────────────────────────────────
    function _bindRemoveLogo() {
        const btnRemove = document.getElementById('btn-remove-logo');
        if (!btnRemove) return;
        btnRemove.addEventListener('click', () => {
            if (!confirm('Remover a logo atual? Ela será excluída ao salvar as configurações.')) return;
            _hideLogoPreview();
            showToast('Logo removida. Clique em "Salvar Configurações" para confirmar.', 'info');
        });
    }

    // ─────────────────────────────────────────────────────────
    // Upload da logo para o Supabase Storage
    // ─────────────────────────────────────────────────────────
    async function _uploadLogoToStorage(file) {
        // Obter user_id para isolar no storage
        const { data: { session } } = await _supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('Usuário não autenticado para upload');

        const ext = file.name.split('.').pop() || 'png';
        const filePath = `${userId}/logo.${ext}`;

        // Remover arquivo anterior (ignorar erro se não existir)
        await _supabase.storage.from('system-assets').remove([filePath]).catch(() => {});

        const { data, error } = await _supabase.storage
            .from('system-assets')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type
            });

        if (error) throw error;

        // Obter URL pública
        const { data: urlData } = _supabase.storage
            .from('system-assets')
            .getPublicUrl(filePath);

        // Adicionar cache-buster para forçar reload da imagem
        return urlData.publicUrl + '?t=' + Date.now();
    }

    // ─────────────────────────────────────────────────────────
    // Bind: botão Salvar Configurações
    // ─────────────────────────────────────────────────────────
    function _bindSaveButton() {
        const btnSave = document.getElementById('btn-save-settings');
        if (!btnSave) return;

        btnSave.addEventListener('click', async () => {
            const originalHtml = btnSave.innerHTML;
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

            try {
                const sysName = (document.getElementById('config-system-name')?.value || '').trim() || 'PontoMax';
                const inssCalculation = document.getElementById('checkbox-inss')?.checked ?? false;
                const noturnoCalculation = document.getElementById('checkbox-noturno')?.checked ?? false;
                const fgtsCalculation = document.getElementById('checkbox-fgts')?.checked ?? false;
                const decimoTerceiroCalculation = document.getElementById('checkbox-13')?.checked ?? false;

                let logoUrl = _currentLogoUrl;

                // Se há novo arquivo selecionado, fazer upload
                if (_selectedFile) {
                    showToast('Enviando logo para o servidor...', 'info');
                    logoUrl = await _uploadLogoToStorage(_selectedFile);
                    _selectedFile = null; // reset após upload
                    _currentLogoUrl = logoUrl;
                }

                const newSettings = {
                    primaryColor:               _selectedColor,
                    logoUrl:                    logoUrl,
                    systemName:                 sysName,
                    inssCalculation:            inssCalculation,
                    noturnoCalculation:         noturnoCalculation,
                    fgtsCalculation:            fgtsCalculation,
                    decimoTerceiroCalculation:  decimoTerceiroCalculation
                };

                await db.settings.update('global', newSettings);

                // Aplicar configurações imediatamente na UI
                await applyGlobalSettings();

                showToast('Configurações salvas com sucesso!', 'success');

            } catch (err) {
                console.error('[Configurações] Erro ao salvar:', err);
                showToast('Erro ao salvar configurações: ' + (err.message || err), 'error');
            } finally {
                btnSave.disabled = false;
                btnSave.innerHTML = originalHtml;
            }
        });
    }

    // ─────────────────────────────────────────────────────────
    // Bind: botão Resetar Sistema
    // ─────────────────────────────────────────────────────────
    function _bindResetButton() {
        const btnReset = document.getElementById('btn-reset-system');
        if (!btnReset) return;

        btnReset.addEventListener('click', async () => {
            if (typeof isAdmin === 'function' && !isAdmin()) {
                showToast('Acesso negado. Apenas administradores podem resetar o sistema.', 'error');
                return;
            }

            if (!confirm('ATENÇÃO: Isso irá apagar todos os usuários e registros de ponto!\nAs configurações visuais (nome, logo, cores) serão mantidas.\n\nDeseja continuar?')) return;
            if (!confirm('TEM CERTEZA ABSOLUTA? Esta ação é irreversível e você será deslogado.')) return;

            const btnOriginal = btnReset.innerHTML;
            btnReset.disabled = true;
            btnReset.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetando...';

            try {
                // Salvar backup das configurações visuais na memória
                const currentSettings = await db.settings.get('global');
                const identityBackup = {
                    systemName:   currentSettings?.systemName   || 'PontoMax',
                    primaryColor: currentSettings?.primaryColor || '#0066cc',
                    logoUrl:      currentSettings?.logoUrl      || '',
                    theme:        currentSettings?.theme        || 'light'
                };

                // Apagar todos os usuários exceto o atual
                await db.users.clear();
                // Apagar todos os registros
                await db.timeRecords.clear();

                // Restaurar configurações visuais no banco (reinsere para o admin atual)
                await db.settings.update('global', identityBackup);

                showToast('Sistema resetado! Configurações visuais mantidas. Redirecionando...', 'success');

                setTimeout(async () => {
                    currentUser = null;
                    await _supabase.auth.signOut();
                    window.location.href = 'login.html';
                }, 2000);

            } catch (error) {
                console.error('[Configurações] Erro ao resetar:', error);
                showToast('Erro ao resetar o sistema: ' + (error.message || error), 'error');
                btnReset.disabled = false;
                btnReset.innerHTML = btnOriginal;
            }
        });
    }

})();
