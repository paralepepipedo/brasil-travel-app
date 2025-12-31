// ========================================
// DASHBOARD.JS - Pantalla de resumen
// ========================================

function renderDashboard() {
  const container = document.getElementById('dashboardContent');
  const data = Storage.load();
  const config = data.configuracion;

  // Calcular estadísticas
  const stats = calculateDashboardStats(data);

  // HTML del dashboard
  const html = `
    <!-- Cuenta regresiva / Info del viaje -->
    ${renderTripInfo(data.alojamiento, stats)}

    <!-- Resumen de gastos -->
    ${renderExpenseSummary(data.gastos, config)}

    <!-- Resumen rápido -->
    ${renderQuickStats(stats)}

    <!-- Botones de acceso rápido -->
    <div class="quick-access">
      <button class="quick-btn" onclick="App.navigateTo('gastos')">
        <span class="quick-icon">💰</span>
        <span class="quick-label">Ver Gastos</span>
      </button>
      <button class="quick-btn" onclick="App.navigateTo('atracciones')">
        <span class="quick-icon">📍</span>
        <span class="quick-label">Atracciones</span>
      </button>
      <button class="quick-btn" onclick="App.navigateTo('compras')">
        <span class="quick-icon">🛒</span>
        <span class="quick-label">Compras</span>
      </button>
    </div>
  `;

  container.innerHTML = html;
}

function calculateDashboardStats(data) {
  const gastos = data.gastos || [];
  const compras = data.compras || [];
  const atracciones = data.atracciones || [];

  // Total gastado (convertir todo a BRL)
  let totalBRL = 0;
  const tasaCambio = data.configuracion.tasaCambio || 150;

  gastos.forEach(gasto => {
    let monto = parseFloat(gasto.monto) || 0;

    // Convertir a BRL según moneda
    switch(gasto.moneda) {
      case 'BRL':
        totalBRL += monto;
        break;
      case 'CLP':
        totalBRL += monto / tasaCambio;
        break;
      case 'USD':
        totalBRL += monto * 5; // Aproximado
        break;
      case 'EUR':
        totalBRL += monto * 5.5; // Aproximado
        break;
    }
  });

  // Gastos por persona
  const personas = data.configuracion.personas || ['Patricia', 'Daniela', 'Gonzalo'];
  const gastosPorPersona = {};

  personas.forEach(persona => {
    gastosPorPersona[persona] = 0;
  });

  gastos.forEach(gasto => {
    if (!gasto.dividir) {
      // Gasto individual (asumimos que lo pagó la primera persona por defecto)
      // En la realidad esto debería estar en el formulario
      return;
    }

    let monto = parseFloat(gasto.monto) || 0;

    // Convertir a BRL
    switch(gasto.moneda) {
      case 'CLP': monto = monto / tasaCambio; break;
      case 'USD': monto = monto * 5; break;
      case 'EUR': monto = monto * 5.5; break;
    }

    if (gasto.division === '4') {
      // Dividir en 4 (Gonzalo paga doble)
      gastosPorPersona['Patricia'] += monto * 0.25;
      gastosPorPersona['Daniela'] += monto * 0.25;
      gastosPorPersona['Gonzalo'] += monto * 0.50;
    } else {
      // Dividir en 3
      const montoPorPersona = monto / 3;
      personas.forEach(persona => {
        gastosPorPersona[persona] += montoPorPersona;
      });
    }
  });

  return {
    totalGastos: gastos.length,
    totalBRL,
    gastosPorPersona,
    totalCompras: compras.length,
    comprasPendientes: compras.filter(c => !c.comprado).length,
    totalAtracciones: atracciones.length,
    atraccionesVisitadas: atracciones.filter(a => a.estado === 'visitado').length
  };
}

function renderTripInfo(alojamiento, stats) {
  if (!alojamiento || !alojamiento.checkin) {
    return `
      <div class="dashboard-card trip-card">
        <h3>🗓️ Información del Viaje</h3>
        <p class="text-muted">Aún no has configurado tu alojamiento.</p>
        <button class="btn-primary" onclick="App.navigateTo('alojamiento')">
          Configurar Alojamiento
        </button>
      </div>
    `;
  }

  const checkin = new Date(alojamiento.checkin);
  const checkout = new Date(alojamiento.checkout);
  const hoy = new Date();

  const diasFaltantes = Math.ceil((checkin - hoy) / (1000 * 60 * 60 * 24));
  const duracionViaje = Math.ceil((checkout - checkin) / (1000 * 60 * 60 * 24));

  let mensaje = '';
  if (diasFaltantes > 0) {
    mensaje = `<p class="countdown">⏳ Faltan <strong>${diasFaltantes} días</strong> para el viaje</p>`;
  } else if (diasFaltantes === 0) {
    mensaje = `<p class="countdown">🎉 ¡El viaje es HOY!</p>`;
  } else if (hoy < checkout) {
    mensaje = `<p class="countdown">✈️ ¡Estás en Brasil!</p>`;
  } else {
    mensaje = `<p class="countdown">📸 Viaje completado</p>`;
  }

  return `
    <div class="dashboard-card trip-card">
      <h3>🗓️ ${alojamiento.nombre || 'Viaje a Brasil'}</h3>
      ${mensaje}
      <div class="trip-dates">
        <div class="date-item">
          <span class="date-label">Check-in:</span>
          <span class="date-value">${App.formatDateTime(alojamiento.checkin)}</span>
        </div>
        <div class="date-item">
          <span class="date-label">Check-out:</span>
          <span class="date-value">${App.formatDateTime(alojamiento.checkout)}</span>
        </div>
        <div class="date-item">
          <span class="date-label">Duración:</span>
          <span class="date-value">${duracionViaje} noches</span>
        </div>
      </div>
    </div>
  `;
}

function renderExpenseSummary(gastos, config) {
  const data = Storage.load();
  const stats = calculateDashboardStats(data);

  return `
    <div class="dashboard-card expense-card">
      <h3>💰 Resumen de Gastos</h3>
      <div class="total-expense">
        <span class="total-label">Total Gastado:</span>
        <span class="total-amount">${App.formatCurrency(stats.totalBRL, 'BRL')}</span>
      </div>

      <div class="expense-breakdown">
        ${config.personas.map(persona => `
          <div class="person-expense">
            <span class="person-name">${persona}:</span>
            <span class="person-amount">${App.formatCurrency(stats.gastosPorPersona[persona] || 0, 'BRL')}</span>
          </div>
        `).join('')}
      </div>

      <p class="text-small text-muted">
        Total de ${stats.totalGastos} gastos registrados
      </p>
    </div>
  `;
}

function renderQuickStats(stats) {
  return `
    <div class="quick-stats">
      <div class="stat-card">
        <div class="stat-icon">📍</div>
        <div class="stat-content">
          <div class="stat-value">${stats.atraccionesVisitadas} / ${stats.totalAtracciones}</div>
          <div class="stat-label">Atracciones visitadas</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🛒</div>
        <div class="stat-content">
          <div class="stat-value">${stats.comprasPendientes}</div>
          <div class="stat-label">Compras pendientes</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">💳</div>
        <div class="stat-content">
          <div class="stat-value">${stats.totalGastos}</div>
          <div class="stat-label">Gastos registrados</div>
        </div>
      </div>
    </div>
  `;
}