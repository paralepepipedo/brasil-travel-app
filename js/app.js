// ========================================
// APP.JS - Lógica principal y routing
// ========================================

const App = {
  currentSection: 'dashboard',

  // Inicializar la aplicación
  init() {
    console.log('🚀 Inicializando Brasil Travel App...');

    // Setup navegación
    this.setupNavigation();

    // Setup conversor
    this.setupConversor();

    // Setup notificaciones
    this.requestNotificationPermission();

    // Cargar sección inicial
    this.navigateTo('dashboard');

    console.log('✅ App inicializada correctamente');
  },

  // Configurar navegación
  setupNavigation() {
    // Botón hamburguesa
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sideMenu = document.getElementById('sideMenu');
    const overlay = document.getElementById('overlay');
    const closeMenuBtn = document.getElementById('closeMenuBtn');

    // Abrir menú
    hamburgerBtn?.addEventListener('click', () => {
      sideMenu.classList.add('active');
      overlay.classList.add('active');
      hamburgerBtn.classList.add('active');
    });

    // Cerrar menú
    const closeMenu = () => {
      sideMenu.classList.remove('active');
      overlay.classList.remove('active');
      hamburgerBtn.classList.remove('active');
    };

    closeMenuBtn?.addEventListener('click', closeMenu);
    overlay?.addEventListener('click', closeMenu);

    // Navegación por pestañas (desktop)
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const section = tab.dataset.section;
        this.navigateTo(section);
      });
    });

    // Navegación por menú lateral (móvil)
    document.querySelectorAll('.side-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        this.navigateTo(section);
        closeMenu();
      });
    });
  },

  // Navegar a una sección
  navigateTo(section) {
    // Ocultar todas las secciones
    document.querySelectorAll('.app-section').forEach(sec => {
      sec.classList.remove('active');
    });

    // Mostrar sección seleccionada
    const targetSection = document.getElementById(`section-${section}`);
    if (targetSection) {
      targetSection.classList.add('active');
      this.currentSection = section;

      // Actualizar navegación activa
      this.updateActiveNav(section);

      // Renderizar contenido de la sección
      this.renderSection(section);

      // Scroll al top
      window.scrollTo(0, 0);
    }
  },

  // Actualizar navegación activa
  updateActiveNav(section) {
    // Tabs desktop
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.section === section);
    });

    // Menú lateral móvil
    document.querySelectorAll('.side-menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });
  },

  // Renderizar contenido de sección
  renderSection(section) {
    switch(section) {
      case 'dashboard':
        if (typeof renderDashboard === 'function') {
          renderDashboard();
        }
        break;
      case 'gastos':
        if (typeof renderGastos === 'function') {
          renderGastos();
        }
        break;
      case 'alojamiento':
        // Fase 2
        break;
      case 'compras':
        // Fase 2
        break;
      case 'atracciones':
        // Fase 3
        break;
      case 'configuracion':
        // Fase 4
        break;
    }
  },

  // Configurar conversor de moneda
  setupConversor() {
    const conversorBtn = document.getElementById('conversorBtn');
    const conversorModal = document.getElementById('conversorModal');
    const closeConversorBtn = document.getElementById('closeConversorBtn');
    const inputBRL = document.getElementById('inputBRL');
    const inputCLP = document.getElementById('inputCLP');
    const editarTasaBtn = document.getElementById('editarTasaBtn');
    const tasaCambioSpan = document.getElementById('tasaCambio');

    // Cargar tasa de cambio
    const config = Storage.get('configuracion');
    let tasaCambio = config.tasaCambio || 150;
    tasaCambioSpan.textContent = tasaCambio;

    // Abrir modal
    conversorBtn?.addEventListener('click', () => {
      conversorModal.classList.add('active');
      inputBRL.focus();
    });

    // Cerrar modal
    const closeModal = () => {
      conversorModal.classList.remove('active');
      inputBRL.value = '';
      inputCLP.value = '';
    };

    closeConversorBtn?.addEventListener('click', closeModal);
    conversorModal?.addEventListener('click', (e) => {
      if (e.target === conversorModal) closeModal();
    });

    // Conversión BRL -> CLP
    inputBRL?.addEventListener('input', (e) => {
      const brl = parseFloat(e.target.value) || 0;
      const clp = Math.round(brl * tasaCambio);
      inputCLP.value = clp;
    });

    // Conversión CLP -> BRL
    inputCLP?.addEventListener('input', (e) => {
      const clp = parseFloat(e.target.value) || 0;
      const brl = (clp / tasaCambio).toFixed(2);
      inputBRL.value = brl;
    });

    // Editar tasa de cambio
    editarTasaBtn?.addEventListener('click', () => {
      const nuevaTasa = prompt(`Nueva tasa de cambio (1 BRL = X CLP):`, tasaCambio);
      if (nuevaTasa && !isNaN(nuevaTasa) && nuevaTasa > 0) {
        tasaCambio = parseFloat(nuevaTasa);
        tasaCambioSpan.textContent = tasaCambio;

        // Guardar en configuración
        const config = Storage.get('configuracion');
        config.tasaCambio = tasaCambio;
        config.fechaActualizacionTasa = new Date().toLocaleString('es-CL');
        Storage.set('configuracion', config);

        document.getElementById('fechaTasa').textContent = config.fechaActualizacionTasa;

        // Recalcular si hay valores
        if (inputBRL.value) {
          const brl = parseFloat(inputBRL.value);
          inputCLP.value = Math.round(brl * tasaCambio);
        }
      }
    });
  },

  // Solicitar permiso para notificaciones
  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notificaciones:', permission);
      });
    }
  },

  // Mostrar notificación
  showNotification(title, body, data = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: data.tag || 'brasil-app',
        data
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (data.section) {
          this.navigateTo(data.section);
        }
      };
    }
  },

  // Utilidad: formatear moneda
  formatCurrency(amount, currency = 'BRL') {
    const symbols = {
      BRL: 'R$',
      CLP: '$',
      USD: 'US$',
      EUR: '€'
    };

    return `${symbols[currency]} ${amount.toLocaleString('es-CL', {
      minimumFractionDigits: currency === 'CLP' ? 0 : 2,
      maximumFractionDigits: currency === 'CLP' ? 0 : 2
    })}`;
  },

  // Utilidad: formatear fecha
  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  },

  // Utilidad: formatear fecha y hora
  formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

// Inicializar app cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Manejar instalación de PWA
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  console.log('💾 App lista para instalar');
  // Podrías guardar el evento para mostrar un botón de instalación personalizado
});

window.addEventListener('appinstalled', () => {
  console.log('✅ App instalada correctamente');
});