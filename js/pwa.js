// js/pwa.js - Gerenciador de Instalação de Atalho no Celular (PWA)
(function () {
    'use strict';

    let deferredPrompt = null;
    let bannerDismissed = sessionStorage.getItem('pwa_banner_dismissed') === 'true';

    // Registra o Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('./sw.js')
                .then((reg) => {
                    console.log('[PWA] Service Worker registrado com sucesso:', reg.scope);
                })
                .catch((err) => {
                    console.warn('[PWA] Falha ao registrar Service Worker:', err);
                });
        });
    }

    // Identificação de dispositivos e modo standalone
    const isStandalone = () => {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true ||
            document.referrer.includes('android-app://')
        );
    };

    const isIos = () => {
        const userAgent = window.navigator.userAgent.toLowerCase();
        return /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    };

    const isMobile = () => {
        return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || window.innerWidth <= 768;
    };

    // Escuta o evento nativo de instalação do Chrome / Android / Edge
    window.addEventListener('beforeinstallprompt', (e) => {
        // Previne o infobar padrão automático do navegador
        e.preventDefault();
        deferredPrompt = e;
        console.log('[PWA] beforeinstallprompt capturado com sucesso');

        // Exibe botões e banners de instalação
        updateInstallUI(true);
    });

    // Escuta quando o app foi instalado com sucesso
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] Aplicativo instalado com sucesso');
        deferredPrompt = null;
        removeInstallBanner();
        updateInstallUI(false);
        if (typeof showToast === 'function') {
            showToast('Aplicativo adicionado à tela inicial com sucesso!', 'success');
        }
    });

    /**
     * Atualiza visibilidade dos botões de instalação no app
     */
    function updateInstallUI(available) {
        if (isStandalone()) {
            removeInstallBanner();
            return;
        }

        // Se estiver em mobile e não foi dispensado na sessão, mostra banner flutuante
        if (isMobile() && !bannerDismissed) {
            showInstallBanner();
        }

        // Ativa links/botões na interface
        document.querySelectorAll('.pwa-install-btn, #btn-install-pwa, .btn-install-pwa').forEach((btn) => {
            btn.classList.add('visible');
        });
    }

    /**
     * Renderiza o banner flutuante no rodapé para celulares
     */
    function showInstallBanner() {
        if (document.getElementById('pwa-bottom-banner') || isStandalone()) return;

        const banner = document.createElement('div');
        banner.id = 'pwa-bottom-banner';
        banner.className = 'pwa-bottom-banner';
        banner.innerHTML = `
            <div class="pwa-banner-content">
                <img src="apple-touch-icon.png" alt="Ícone Ponto" class="pwa-banner-icon" />
                <div class="pwa-banner-text">
                    <strong>Instalar Atalho no Celular</strong>
                    <span>Acesse seu Ponto com 1 toque na tela inicial</span>
                </div>
                <div class="pwa-banner-actions">
                    <button type="button" class="btn-pwa-install" id="btn-banner-install">
                        <i class="fa-solid fa-download"></i> Instalar
                    </button>
                    <button type="button" class="btn-pwa-close" id="btn-banner-close" aria-label="Fechar">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);

        // Animação de entrada
        requestAnimationFrame(() => {
            banner.classList.add('pwa-banner-show');
        });

        // Eventos
        document.getElementById('btn-banner-install').addEventListener('click', () => {
            triggerInstallFlow();
        });

        document.getElementById('btn-banner-close').addEventListener('click', () => {
            bannerDismissed = true;
            sessionStorage.setItem('pwa_banner_dismissed', 'true');
            removeInstallBanner();
        });
    }

    function removeInstallBanner() {
        const banner = document.getElementById('pwa-bottom-banner');
        if (banner) {
            banner.classList.remove('pwa-banner-show');
            setTimeout(() => banner.remove(), 300);
        }
    }

    /**
     * Dispara o fluxo de instalação de acordo com o SO e navegador
     */
    async function triggerInstallFlow() {
        if (isStandalone()) {
            if (typeof showToast === 'function') {
                showToast('O aplicativo já está instalado no seu celular!', 'info');
            } else {
                alert('O aplicativo já está instalado no seu celular!');
            }
            return;
        }

        // Se o navegador disparou o evento nativo (Android / Chrome / Edge)
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log('[PWA] Escolha do usuário:', outcome);
            if (outcome === 'accepted') {
                removeInstallBanner();
            }
            deferredPrompt = null;
            return;
        }

        // Se for iOS ou se o prompt nativo não estiver disponível no momento
        showInstallInstructionModal();
    }

    /**
     * Modal instrutivo para iOS (iPhone/iPad) ou navegadores sem prompt nativo
     */
    function showInstallInstructionModal() {
        let modal = document.getElementById('pwa-instruction-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'pwa-instruction-modal';
            modal.className = 'modal-overlay active pwa-modal-overlay';
            modal.innerHTML = `
                <div class="modal-box pwa-modal-box">
                    <div class="modal-close-row">
                        <button type="button" id="btn-close-pwa-modal" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="pwa-modal-header">
                        <div class="pwa-modal-app-icon">
                            <img src="apple-touch-icon.png" alt="Ponto" />
                        </div>
                        <h3>Instalar Atalho no Celular</h3>
                        <p class="subtitle">Adicione o Ponto à sua tela de início para abrir como um aplicativo nativo e bater ponto rapidamente.</p>
                    </div>
                    
                    <div class="pwa-steps-list">
                        ${
                            isIos()
                                ? `
                            <div class="pwa-step-item">
                                <div class="pwa-step-num">1</div>
                                <div class="pwa-step-info">
                                    <strong>Toque em Compartilhar</strong>
                                    <span>Na barra inferior do Safari, toque no ícone de compartilhamento <i class="fa-solid fa-arrow-up-from-bracket pwa-ic-hl"></i>.</span>
                                </div>
                            </div>
                            <div class="pwa-step-item">
                                <div class="pwa-step-num">2</div>
                                <div class="pwa-step-info">
                                    <strong>Adicionar à Tela de Início</strong>
                                    <span>Role a lista de opções para cima e selecione <i class="fa-regular fa-square-plus pwa-ic-hl"></i> <b>Adicionar à Tela de Início</b>.</span>
                                </div>
                            </div>
                            <div class="pwa-step-item">
                                <div class="pwa-step-num">3</div>
                                <div class="pwa-step-info">
                                    <strong>Confirmar Adição</strong>
                                    <span>Toque no botão <b>Adicionar</b> no canto superior direito da tela.</span>
                                </div>
                            </div>
                        `
                                : `
                            <div class="pwa-step-item">
                                <div class="pwa-step-num">1</div>
                                <div class="pwa-step-info">
                                    <strong>Abra o Menu do Navegador</strong>
                                    <span>Toque nos 3 pontinhos <i class="fa-solid fa-ellipsis-vertical pwa-ic-hl"></i> no canto superior ou inferior do navegador.</span>
                                </div>
                            </div>
                            <div class="pwa-step-item">
                                <div class="pwa-step-num">2</div>
                                <div class="pwa-step-info">
                                    <strong>Instalar Aplicativo</strong>
                                    <span>Selecione <b>"Instalar aplicativo"</b> ou <b>"Adicionar à tela inicial"</b>.</span>
                                </div>
                            </div>
                            <div class="pwa-step-item">
                                <div class="pwa-step-num">3</div>
                                <div class="pwa-step-info">
                                    <strong>Pronto!</strong>
                                    <span>O atalho oficial estará pronto na sua tela inicial com ícone exclusivo.</span>
                                </div>
                            </div>
                        `
                        }
                    </div>

                    <div class="pwa-modal-actions">
                        <button type="button" class="btn btn-primary btn-block" id="btn-pwa-modal-ok">
                            <i class="fa-solid fa-check"></i> Entendi
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('btn-close-pwa-modal').addEventListener('click', () => {
                modal.classList.remove('active');
            });
            document.getElementById('btn-pwa-modal-ok').addEventListener('click', () => {
                modal.classList.remove('active');
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        } else {
            modal.classList.add('active');
        }
    }

    // Inicialização da UI após DOM carregado
    document.addEventListener('DOMContentLoaded', () => {
        // Se já for standalone, não exibe banner flutuante
        if (!isStandalone() && isMobile() && !bannerDismissed) {
            // Aguarda 1.2 segundos para não sobrepor o carregamento inicial da tela
            setTimeout(showInstallBanner, 1200);
        }

        // Delegação de cliques em qualquer botão com a classe ou id de instalação
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#btn-install-pwa, .btn-install-pwa, [data-action="install-pwa"]');
            if (btn) {
                e.preventDefault();
                triggerInstallFlow();
            }
        });
    });

    // Expõe globalmente caso queira chamar diretamente
    window.pwaInstaller = {
        triggerInstallFlow,
        isStandalone,
        isIos,
        isMobile
    };
})();
