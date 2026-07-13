// ============================================
// GASTOS - Gestión completa de gastos del viaje
// ============================================

let viajeData = null;
let linkViaje = null;
let gastosData = [];
let gastosFiltrados = [];
let participantes = [];
let destinos = [];
let presupuestos = [];
let pagosDeudas = [];
let gastoEditandoId = null;
let gastosSeleccionadosPago = [];


// ============================================
// REDONDEO CIENTÍFICO SIN DECIMALES
// 0.5 → 1, 1.4 → 1, 1.5 → 2, 1.6 → 2
// ============================================
function redondear(numero) {
    return Math.round(parseFloat(numero) || 0);
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    linkViaje = obtenerParametroURL('link');

    if (!linkViaje) {
        mostrarNotificacion('No se especificó un viaje', 'error');
        setTimeout(() => { window.location.href = '../index.html'; }, 2000);
        return;
    }

    inicializarEventos();
    verificarEstadoConexion();

    // cargarDatosViaje primero (necesitamos viajeData.id para las siguientes)
    await cargarDatosViaje();

    // Luego gastos + presupuestos + pagosDeudas EN PARALELO
    await Promise.all([
        cargarGastos(),
        cargarPresupuestos(),
        cargarPagosDeudas()
    ]);
    renderizarTablaDeudas();
});

// ============================================
// INICIALIZAR EVENTOS
// ============================================
function inicializarEventos() {
    // Botones nuevo gasto
    const btnNuevoDesktop = document.getElementById('btnNuevoGastoDesktop');
    if (btnNuevoDesktop) {
        btnNuevoDesktop.addEventListener('click', () => {
            abrirModalGasto();
        });
    }

    const btnNuevoMobile = document.getElementById('btnNuevoGastoMobile');
    if (btnNuevoMobile) {
        btnNuevoMobile.addEventListener('click', () => {
            abrirModalGasto();
        });
    }

    // Búsqueda y filtros
    const buscarGasto = document.getElementById('buscarGasto');
    if (buscarGasto) buscarGasto.addEventListener('input', filtrarGastos);

    const filtroCategoria = document.getElementById('filtroCategoria');
    if (filtroCategoria) filtroCategoria.addEventListener('change', filtrarGastos);

    const filtroParticipante = document.getElementById('filtroParticipante');
    if (filtroParticipante) filtroParticipante.addEventListener('change', filtrarGastos);

    const filtroFecha = document.getElementById('filtroFecha');
    if (filtroFecha) filtroFecha.addEventListener('change', filtrarGastos);

    // Botones de acción
    const btnConfigurarPresupuestos = document.getElementById('btnConfigurarPresupuestos');
    if (btnConfigurarPresupuestos) btnConfigurarPresupuestos.addEventListener('click', abrirModalPresupuestos);

    const btnExportarExcel = document.getElementById('btnExportarExcel');
    if (btnExportarExcel) btnExportarExcel.addEventListener('click', exportarExcel);

    const btnRegistrarPago = document.getElementById('btnRegistrarPago');
    if (btnRegistrarPago) btnRegistrarPago.addEventListener('click', abrirModalPago);

    // Modal gasto
    const closeModalGasto = document.getElementById('closeModalGasto');
    if (closeModalGasto) closeModalGasto.addEventListener('click', cerrarModalGasto);

    const btnCancelarGasto = document.getElementById('btnCancelarGasto');
    if (btnCancelarGasto) btnCancelarGasto.addEventListener('click', cerrarModalGasto);

    const formGasto = document.getElementById('formGasto');
    if (formGasto) formGasto.addEventListener('submit', guardarGasto);

    // Tabs de división
    document.querySelectorAll('.division-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            const tipo = this.dataset.tipo;
            cambiarTipoDivision(tipo);
        });
    });

    // Cambios en monto y moneda para conversión
    const gastoMonto = document.getElementById('gastoMonto');
    if (gastoMonto) gastoMonto.addEventListener('input', calcularConversion);

    const gastoMoneda = document.getElementById('gastoMoneda');
    if (gastoMoneda) gastoMoneda.addEventListener('change', calcularConversion);

    // Modal presupuestos
    const closeModalPresupuestos = document.getElementById('closeModalPresupuestos');
    if (closeModalPresupuestos) closeModalPresupuestos.addEventListener('click', cerrarModalPresupuestos);

    const btnCancelarPresupuestos = document.getElementById('btnCancelarPresupuestos');
    if (btnCancelarPresupuestos) btnCancelarPresupuestos.addEventListener('click', cerrarModalPresupuestos);

    const btnGuardarPresupuestos = document.getElementById('btnGuardarPresupuestos');
    if (btnGuardarPresupuestos) btnGuardarPresupuestos.addEventListener('click', guardarPresupuestos);

    // Modal pago
    const closeModalPago = document.getElementById('closeModalPago');
    if (closeModalPago) closeModalPago.addEventListener('click', cerrarModalPago);

    const btnCancelarPago = document.getElementById('btnCancelarPago');
    if (btnCancelarPago) btnCancelarPago.addEventListener('click', cerrarModalPago);

    const formPago = document.getElementById('formPago');
    if (formPago) formPago.addEventListener('submit', guardarPago);

    // Modal eliminar
    const closeModalEliminar = document.getElementById('closeModalEliminar');
    if (closeModalEliminar) closeModalEliminar.addEventListener('click', cerrarModalEliminar);

    const btnCancelarEliminar = document.getElementById('btnCancelarEliminar');
    if (btnCancelarEliminar) btnCancelarEliminar.addEventListener('click', cerrarModalEliminar);

    const btnConfirmarEliminar = document.getElementById('btnConfirmarEliminar');
    if (btnConfirmarEliminar) btnConfirmarEliminar.addEventListener('click', confirmarEliminarGasto);

    // Cerrar modales al hacer click fuera
    const modalGasto = document.getElementById('modalGasto');
    if (modalGasto) {
        modalGasto.addEventListener('click', (e) => {
            if (e.target.id === 'modalGasto') cerrarModalGasto();
        });
    }

    const modalPresupuestos = document.getElementById('modalPresupuestos');
    if (modalPresupuestos) {
        modalPresupuestos.addEventListener('click', (e) => {
            if (e.target.id === 'modalPresupuestos') cerrarModalPresupuestos();
        });
    }

    const modalPago = document.getElementById('modalPago');
    if (modalPago) {
        modalPago.addEventListener('click', (e) => {
            if (e.target.id === 'modalPago') cerrarModalPago();
        });
    }

    const modalEliminar = document.getElementById('modalEliminar');
    if (modalEliminar) {
        modalEliminar.addEventListener('click', (e) => {
            if (e.target.id === 'modalEliminar') cerrarModalEliminar();
        });
    }

    // Botón "¿Qué pagará?"
    const btnQuePagara = document.getElementById('btnQuePagara');
    if (btnQuePagara) {
        btnQuePagara.addEventListener('click', abrirModalQuePagara);
    }

    // Modal "¿Qué pagará?"
    const closeModalQuePagara = document.getElementById('closeModalQuePagara');
    if (closeModalQuePagara) {
        closeModalQuePagara.addEventListener('click', () => cerrarModalQuePagara(true));
    }

    const btnCancelarQuePagara = document.getElementById('btnCancelarQuePagara');
    if (btnCancelarQuePagara) {
        btnCancelarQuePagara.addEventListener('click', () => cerrarModalQuePagara(true));
    }

    const btnConfirmarQuePagara = document.getElementById('btnConfirmarQuePagara');
    if (btnConfirmarQuePagara) {
        btnConfirmarQuePagara.addEventListener('click', confirmarQuePagara);
    }

    const modalQuePagara = document.getElementById('modalQuePagara');
    if (modalQuePagara) {
        modalQuePagara.addEventListener('click', (e) => {
            if (e.target.id === 'modalQuePagara') cerrarModalQuePagara(true);
        });
    }

    // Evento para filtrar receptor cuando cambia pagador
    const pagoPagador = document.getElementById('pagoPagador');
    if (pagoPagador) {
        pagoPagador.addEventListener('change', () => {
            actualizarReceptoresPago();
            gastosSeleccionadosPago = [];
            const resumenEl = document.getElementById('pagoGastosSeleccionadosResumen');
            if (resumenEl) { resumenEl.style.display = 'none'; resumenEl.innerHTML = ''; }
        });
    }
}


// ============================================
// VERIFICAR ESTADO DE CONEXIÓN
// ============================================
function verificarEstadoConexion() {
    const banner = document.getElementById('offlineBanner');

    if (!navigator.onLine) {
        banner.classList.add('show');
    }

    window.addEventListener('offline', () => {
        banner.classList.add('show');
    });

    window.addEventListener('online', () => {
        banner.classList.remove('show');
        cargarGastos();
    });
}

// ============================================
// CARGAR DATOS DEL VIAJE
// ============================================
async function cargarDatosViaje() {
    try {
        // Cargar viaje primero (necesitamos el ID)
        const { data: viaje, error: errorViaje } = await supabaseClient
            .from('v3_viajes').select('*').eq('link_unico', linkViaje).single();

        if (errorViaje) throw errorViaje;
        viajeData = viaje;
        document.getElementById('viajeNombre').textContent = viaje.nombre;

        // Destinos y participantes EN PARALELO
        const [resDestinos, resParticipantes] = await Promise.all([
            supabaseClient.from('v3_destinos').select('*').eq('viaje_id', viaje.id).order('orden'),
            supabaseClient.from('v3_participantes').select('*').eq('viaje_id', viaje.id)
        ]);

        if (resDestinos.error) throw resDestinos.error;
        if (resParticipantes.error) throw resParticipantes.error;

        destinos = resDestinos.data || [];
        participantes = resParticipantes.data || [];

        llenarSelectoresParticipantes();
        llenarSelectoresMonedas();

    } catch (error) {
        console.error('Error cargando datos del viaje:', error);
        mostrarNotificacion('Error cargando datos del viaje', 'error');
    }
}

// ============================================
// LLENAR SELECTORES DE PARTICIPANTES
// ============================================
function llenarSelectoresParticipantes() {
    // Selector "Pagado por"
    const selectPagadoPor = document.getElementById('gastoPagadoPor');
    selectPagadoPor.innerHTML = participantes.map(p =>
        `<option value="${p.id}">${p.nombre}</option>`
    ).join('');

    // Filtro de participantes
    const filtroParticipante = document.getElementById('filtroParticipante');
    filtroParticipante.innerHTML = `
        <option value="todos">Todos los participantes</option>
        ${participantes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
    `;

    // Selectores de pago
    const selectPagador = document.getElementById('pagoPagador');
    const selectReceptor = document.getElementById('pagoReceptor');

    const optionsParticipantes = participantes.map(p =>
        `<option value="${p.id}">${p.nombre}</option>`
    ).join('');

    selectPagador.innerHTML = optionsParticipantes;
    selectReceptor.innerHTML = optionsParticipantes;

    // Crear checkboxes para división equitativa
    actualizarCheckboxesEquitativos();
}

// ============================================
// LLENAR SELECTORES DE MONEDAS
// ============================================
function llenarSelectoresMonedas() {
    const selectMoneda = document.getElementById('gastoMoneda');

    // Obtener monedas únicas de destinos
    const monedasUnicas = new Set();

    // Siempre agregar CLP primero
    monedasUnicas.add('CLP');

    // Agregar monedas de destinos
    destinos.forEach(d => {
        if (d.moneda_codigo) {
            monedasUnicas.add(d.moneda_codigo);
        }
    });

    // Crear opciones
    let options = '';
    monedasUnicas.forEach(moneda => {
        options += `<option value="${moneda}">${moneda}</option>`;
    });

    selectMoneda.innerHTML = options;

    // Seleccionar la moneda del primer destino por defecto
    if (destinos.length > 0 && destinos[0].moneda_codigo) {
        selectMoneda.value = destinos[0].moneda_codigo;
    }
}

// ============================================
// CARGAR GASTOS
// ============================================
async function cargarGastos() {
    const loadingGastos = document.getElementById('loadingGastos');
    const gastosLista = document.getElementById('gastosLista');
    const estadoVacio = document.getElementById('estadoVacio');

    loadingGastos.style.display = 'block';
    gastosLista.innerHTML = '';
    estadoVacio.style.display = 'none';

    try {
        const { data: gastos, error } = await supabaseClient
            .from('v3_gastos')
            .select('*')
            .eq('viaje_id', viajeData.id)
            .order('fecha', { ascending: false });

        if (error) throw error;

        gastosData = gastos || [];

        loadingGastos.style.display = 'none';

        if (gastosData.length === 0) {
            estadoVacio.style.display = 'block';
            document.getElementById('deudasResumenSection').style.display = 'none';
        } else {
            renderizarResumen();
            filtrarGastos();
            document.getElementById('deudasResumenSection').style.display = 'block';
        }

    } catch (error) {
        console.error('Error cargando gastos:', error);
        loadingGastos.style.display = 'none';
        estadoVacio.style.display = 'block';
        mostrarNotificacion('Error cargando gastos', 'error');
    }
}

// ============================================
// CARGAR PRESUPUESTOS
// ============================================
async function cargarPresupuestos() {
    try {
        const { data, error } = await supabaseClient
            .from('v3_presupuestos_categorias')
            .select('*')
            .eq('viaje_id', viajeData.id)
            .eq('activo', true);

        if (error) throw error;

        presupuestos = data || [];

    } catch (error) {
        console.error('Error cargando presupuestos:', error);
    }
}

// ============================================
// CARGAR PAGOS DE DEUDAS
// ============================================
async function cargarPagosDeudas() {
    try {
        const { data, error } = await supabaseClient
            .from('v3_pagos_deudas')
            .select('*')
            .eq('viaje_id', viajeData.id)
            .order('fecha', { ascending: false });

        if (error) throw error;

        pagosDeudas = (data || []).map(p => {
            // Intentar parsear nota como JSON para extraer gastos_ids
            let gastos_ids = [];
            if (p.nota) {
                try {
                    const parsed = JSON.parse(p.nota);
                    if (parsed.gastos_ids) gastos_ids = parsed.gastos_ids;
                } catch (e) {
                    // nota es texto plano, no JSON
                }
            }
            return { ...p, gastos_ids };
        });

    } catch (error) {
        console.error('Error cargando pagos de deudas:', error);
    }
}

// ============================================
// RENDERIZAR RESUMEN
// ============================================
function renderizarResumen() {
    const resumenGrid = document.getElementById('resumenGrid');

    // Aplicar filtros actuales
    const gastosParaResumen = obtenerGastosFiltrados();

    const totalGastos = gastosParaResumen.length;

    // Calcular total en moneda local (primera del viaje)
    const monedaLocal = destinos.length > 0 ? destinos[0].moneda_codigo : 'CLP';
    let totalMonedaLocal = 0;
    let totalCLP = 0;

    gastosParaResumen.forEach(g => {
        totalCLP += parseFloat(g.monto_clp || 0);
        if (g.moneda === monedaLocal) {
            totalMonedaLocal += parseFloat(g.monto || 0);
        } else {
            // Convertir a moneda local
            const destino = destinos.find(d => d.moneda_codigo === g.moneda);
            if (destino) {
                totalMonedaLocal += parseFloat(g.monto || 0) * destino.tipo_cambio_clp / destinos[0].tipo_cambio_clp;
            }
        }
    });

    // Gastos por categoría
    const gastosPorCategoria = {};
    gastosParaResumen.forEach(g => {
        const cat = g.categoria || 'Otros';
        gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + parseFloat(g.monto_clp || 0);
    });

    const categoriaTop = Object.entries(gastosPorCategoria)
        .sort((a, b) => b[1] - a[1])[0];

    // Calcular gastos y deudas por participante
    const resumenParticipantes = calcularResumenParticipantes(gastosParaResumen);

    // Calcular presupuestos
    const resumenPresupuestos = calcularResumenPresupuestos(gastosParaResumen);

    // Construir HTML
    let html = `
        <!-- Ficha Total -->
        <div class="resumen-card">
            <div class="resumen-header">
                <div>
                    <div class="resumen-title">💰 TOTAL GASTADO</div>
                    <div class="resumen-monto">${monedaLocal} ${formatearNumero(totalMonedaLocal)}</div>
                    ${monedaLocal !== 'CLP' ? `<div class="resumen-monto-clp">≈ $${formatearNumero(totalCLP)} CLP</div>` : ''}
                </div>
                <div class="resumen-icon">📊</div>
            </div>
        </div>
    `;

    // Total desembolsado del viaje (suma de todos los participantes) para % participación
    const totalDesembolsadoViaje = resumenParticipantes.reduce((s, r) => s + r.totalDesembolsado, 0);

    // Fichas por participante
    resumenParticipantes.forEach(rp => {
        // Pendiente neto real: lo que le deben - lo que él debe (ambos pendientes)
        // Calcular créditos pendientes (otros le deben a rp)
        let creditosPendientes = 0;
        let deudasPendientes = 0;
        participantes.forEach(otro => {
            if (otro.id === rp.id) return;
            // Créditos: otro le debe a rp
            const detCredito = calcularDetalleDeudaEntre(otro.id, rp.id);
            if (detCredito.length > 0) {
                const bruto = detCredito.reduce((s, d) => s + d.montoDeuda, 0);
                const pagado = pagosDeudas
                    .filter(p => p.pagador_id === otro.id && p.receptor_id === rp.id)
                    .reduce((s, p) => s + parseFloat(p.monto_clp || 0), 0);
                creditosPendientes += Math.max(0, bruto - pagado);
            }
            // Deudas: rp le debe a otro
            const detDeuda = calcularDetalleDeudaEntre(rp.id, otro.id);
            if (detDeuda.length > 0) {
                const bruto = detDeuda.reduce((s, d) => s + d.montoDeuda, 0);
                const pagado = pagosDeudas
                    .filter(p => p.pagador_id === rp.id && p.receptor_id === otro.id)
                    .reduce((s, p) => s + parseFloat(p.monto_clp || 0), 0);
                deudasPendientes += Math.max(0, bruto - pagado);
            }
        });

        const saldoPendienteNeto = creditosPendientes - deudasPendientes;
        const esAcreedor = saldoPendienteNeto >= 0;

        const balanceClase = esAcreedor ? 'balance-positivo' : 'balance-negativo';
        const iconoBalance = esAcreedor ? '⚠️' : '✅';

        // % de participación en desembolsos del viaje
        const pctParticipacion = totalDesembolsadoViaje > 0
            ? ((rp.totalDesembolsado / totalDesembolsadoViaje) * 100).toFixed(1)
            : '0.0';

        // Mostrar "Debe recibir" como créditos brutos pendientes (sin descontar deudas propias)
        // Mostrar "Debe pagar" como deudas brutas pendientes (sin descontar créditos)
        html += `
            <div class="resumen-card">
                <div class="resumen-header">
                    <div>
                        <div class="resumen-title">👤 ${rp.nombre}</div>
                        <div class="resumen-monto">${monedaLocal} ${formatearNumero(rp.totalPagadoLocal)}</div>
                        ${monedaLocal !== 'CLP' ? `<div class="resumen-monto-clp">≈ $${formatearNumero(rp.totalDesembolsado)} CLP</div>` : ''}
                    </div>
                    <div class="resumen-icon">💳</div>
                </div>
                <div class="resumen-balance">
                    ${creditosPendientes > 0 ? `
                    <span class="balance-label">Debe recibir:</span>
                    <span class="balance-monto balance-positivo">$${formatearNumero(creditosPendientes)}</span>
                    ` : ''}
                    ${deudasPendientes > 0 ? `
                    <span class="balance-label" style="margin-left:${creditosPendientes > 0 ? '0.5rem' : '0'}">Debe pagar:</span>
                    <span class="balance-monto balance-negativo">$${formatearNumero(deudasPendientes)}</span>
                    ` : ''}
                    ${creditosPendientes === 0 && deudasPendientes === 0 ? `
                    <span class="balance-label">✅ Al día</span>
                    ` : ''}
                    
                </div>
            </div>
        `;
    });

    // Fichas de presupuestos activos
    resumenPresupuestos.forEach(rp => {
        const porcentaje = (rp.gastado / rp.presupuesto) * 100;
        let claseProgress = 'bajo';
        if (porcentaje >= 80) claseProgress = 'alto';
        else if (porcentaje >= 60) claseProgress = 'medio';

        html += `
            <div class="resumen-card">
                <div class="resumen-header">
                    <div>
                        <div class="resumen-title">${obtenerIconoCategoria(rp.categoria)} ${rp.categoria}</div>
                        <div class="resumen-monto">${rp.moneda} ${formatearNumero(rp.gastado)}</div>
                        <div class="resumen-monto-clp">de ${rp.moneda} ${formatearNumero(rp.presupuesto)}</div>
                    </div>
                    <div class="resumen-icon">📈</div>
                </div>
                <div class="presupuesto-progress">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill ${claseProgress}" style="width: ${Math.min(porcentaje, 100)}%"></div>
                    </div>
                    <div class="progress-porcentaje">${porcentaje.toFixed(1)}% usado</div>
                </div>
            </div>
        `;
    });

    resumenGrid.innerHTML = html;
}

// ============================================
// CALCULAR RESUMEN POR PARTICIPANTES
// ============================================
function calcularResumenParticipantes(gastos) {
    const resumen = {};
    const monedaLocal = destinos.length > 0 ? destinos[0].moneda_codigo : 'CLP';
    const tipoCambioLocal = destinos.length > 0 ? destinos[0].tipo_cambio_clp : 1;

    // Inicializar participantes
    participantes.forEach(p => {
        resumen[p.id] = {
            id: p.id,
            nombre: p.nombre,
            totalDesembolsado: 0,    // Suma bruta de lo que pagó en gastos (col. "Pagado")
            totalPagadoLocal: 0,
            totalDebeReal: 0,         // Deuda pendiente con otros participantes (col. "Debe Pagar")
            totalRecibidoReembolso: 0,// Pagos de deuda recibidos de otros participantes
            totalGastado: 0,          // Costo real del viaje para este participante (col. "Gastado")
            // compatibilidad interna
            totalPagado: 0,
            balance: 0,
            porcentaje: 0
        };
    });

    // Calcular totales de gastos
    gastos.forEach(gasto => {
        const divisionDetalle = gasto.division_detalle || {};

        // Quien pagó: sumar a desembolsado y totalPagado
        if (resumen[gasto.pagado_por_id]) {
            resumen[gasto.pagado_por_id].totalDesembolsado += parseFloat(gasto.monto_clp);
            resumen[gasto.pagado_por_id].totalPagado += parseFloat(gasto.monto_clp);

            // Convertir a moneda local
            if (gasto.moneda === monedaLocal) {
                resumen[gasto.pagado_por_id].totalPagadoLocal += parseFloat(gasto.monto);
            } else {
                const destino = destinos.find(d => d.moneda_codigo === gasto.moneda);
                if (destino) {
                    resumen[gasto.pagado_por_id].totalPagadoLocal += parseFloat(gasto.monto) * destino.tipo_cambio_clp / tipoCambioLocal;
                }
            }
        }

        // Sumar parte de CADA participante en este gasto a su totalGastado
        // (tanto quien pagó como quienes deben)
        Object.entries(divisionDetalle.participantes || {}).forEach(([participanteId, monto]) => {
            if (resumen[participanteId]) {
                resumen[participanteId].totalGastado += parseFloat(monto);
                // Los que NO pagaron también acumulan deuda
                if (participanteId !== gasto.pagado_por_id) {
                    resumen[participanteId].totalDebeReal += parseFloat(monto);
                }
            }
        });
    });

    // Procesar pagos de deuda
    pagosDeudas.forEach(pago => {
        const montoPago = parseFloat(pago.monto_clp);
        if (resumen[pago.pagador_id]) {
            resumen[pago.pagador_id].totalDebeReal -= montoPago;
            resumen[pago.pagador_id].totalPagado -= montoPago;
        }
        if (resumen[pago.receptor_id]) {
            resumen[pago.receptor_id].totalPagado -= montoPago;
            resumen[pago.receptor_id].totalRecibidoReembolso += montoPago;
        }
    });

    // Calcular balance
    Object.values(resumen).forEach(r => {
        r.balance = r.totalPagado - r.totalDebeReal;
        if (r.totalPagado > 0) {
            r.porcentaje = ((r.balance / r.totalPagado) * 100).toFixed(1);
        }
    });

    return Object.values(resumen);
}

// ============================================
// CALCULAR RESUMEN PRESUPUESTOS
// ============================================
// ============================================
// CALCULAR RESUMEN PRESUPUESTOS
// ============================================
function calcularResumenPresupuestos(gastos) {
    const resumen = [];

    presupuestos.forEach(p => {
        const gastosCategoria = gastos.filter(g => g.categoria === p.categoria);

        // SIEMPRE usar monto_clp para consistencia
        const totalGastado = gastosCategoria.reduce((sum, g) => {
            return sum + parseFloat(g.monto_clp || 0);
        }, 0);

        // Convertir el total gastado (en CLP) a la moneda del presupuesto
        let totalGastadoEnMonedaPresupuesto = totalGastado;

        if (p.moneda !== 'CLP') {
            const destinoPresupuesto = destinos.find(d => d.moneda_codigo === p.moneda);
            if (destinoPresupuesto && destinoPresupuesto.tipo_cambio_clp) {
                totalGastadoEnMonedaPresupuesto = totalGastado / destinoPresupuesto.tipo_cambio_clp;
            }
        }

        resumen.push({
            categoria: p.categoria,
            presupuesto: parseFloat(p.monto),
            gastado: totalGastadoEnMonedaPresupuesto,
            moneda: p.moneda
        });
    });

    return resumen;
}

// ============================================
// OBTENER GASTOS FILTRADOS
// ============================================
function obtenerGastosFiltrados() {
    const busqueda = document.getElementById('buscarGasto').value.toLowerCase();
    const categoria = document.getElementById('filtroCategoria').value;
    const participante = document.getElementById('filtroParticipante').value;
    const fecha = document.getElementById('filtroFecha').value;

    return gastosData.filter(gasto => {
        // Búsqueda por descripción
        const coincideBusqueda = gasto.descripcion.toLowerCase().includes(busqueda);

        // Filtro por categoría
        const coincideCategoria = categoria === 'todas' || gasto.categoria === categoria;

        // Filtro por participante (pagado por)
        const coincideParticipante = participante === 'todos' || gasto.pagado_por_id === participante;

        // Filtro por fecha
        const coincideFecha = !fecha || gasto.fecha === fecha;

        return coincideBusqueda && coincideCategoria && coincideParticipante && coincideFecha;
    });
}

// ============================================
// FILTRAR GASTOS
// ============================================
function filtrarGastos() {
    gastosFiltrados = obtenerGastosFiltrados();
    gastosFiltrados.sort((a, b) => {
        const fechaA = a.fecha ? a.fecha.substring(0, 10) : '';
        const fechaB = b.fecha ? b.fecha.substring(0, 10) : '';
        return fechaB.localeCompare(fechaA);
    });
    renderizarResumen();
    renderizarGastos();
}

// ============================================
// RENDERIZAR GASTOS
// ============================================
function renderizarGastos() {
    const gastosLista = document.getElementById('gastosLista');
    const estadoVacio = document.getElementById('estadoVacio');

    if (gastosFiltrados.length === 0) {
        gastosLista.innerHTML = '';
        if (gastosData.length === 0) {
            estadoVacio.style.display = 'block';
        } else {
            gastosLista.innerHTML = `
                <div class="estado-vacio">
                    <div class="empty-icon">🔍</div>
                    <h2>No se encontraron gastos</h2>
                    <p>Intenta con otros filtros de búsqueda</p>
                </div>
            `;
        }
        return;
    }

    estadoVacio.style.display = 'none';

    gastosLista.innerHTML = gastosFiltrados.map(gasto => {
        const participante = participantes.find(p => p.id === gasto.pagado_por_id);

        return `
            <div class="gasto-card">
                <div class="gasto-header">
                    <div class="gasto-info">
                        <div class="gasto-descripcion">${gasto.descripcion}</div>
                        <div class="gasto-meta">
                            <span>📅 ${formatearFechaLocal(gasto.fecha)}</span>
                            <span>👤 ${participante?.nombre || 'Desconocido'}</span>
                            <span class="gasto-categoria">
                                ${obtenerIconoCategoria(gasto.categoria)} ${gasto.categoria}
                            </span>
                        </div>
                    </div>
                    <div class="gasto-monto">
                        <div class="gasto-monto-principal">
                            ${gasto.moneda} ${formatearNumero(gasto.monto)}
                        </div>
                        ${gasto.moneda !== 'CLP' ? `
                            <div class="gasto-monto-convertido">
                                ≈ $${formatearNumero(gasto.monto_clp)} CLP
                            </div>
                        ` : ''}
                    </div>
                    <div class="gasto-acciones">
                        <button class="btn-icon edit" onclick="editarGasto('${gasto.id}')" title="Editar">
                            ✏️
                        </button>
                        <button class="btn-icon delete" onclick="eliminarGasto('${gasto.id}')" title="Eliminar">
                            🗑️
                        </button>
                    </div>
                </div>
                
                ${renderizarDivision(gasto)}
            </div>
        `;
    }).join('');
}

// ============================================
// RENDERIZAR DIVISIÓN DE GASTO
// ============================================
function renderizarDivision(gasto) {
    const divisionDetalle = gasto.division_detalle || {};

    if (gasto.tipo_division === 'individual') {
        const participante = participantes.find(p => p.id === divisionDetalle.participante_id);
        return `
            <div class="gasto-division">
                <div class="division-titulo">🙋 Gasto Individual</div>
                <div class="division-lista">
                    <div class="division-item">
                        <span class="division-participante">${participante?.nombre || 'Desconocido'}</span>
                        <span class="division-monto">$${formatearNumero(gasto.monto_clp)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    if (!divisionDetalle.participantes || Object.keys(divisionDetalle.participantes).length === 0) {
        return '';
    }

    const tipoDivisionTexto = {
        'equitativa': '👥 División Equitativa',
        'personalizada': '✋ Montos Personalizados'
    };

    return `
        <div class="gasto-division">
            <div class="division-titulo">${tipoDivisionTexto[gasto.tipo_division] || '👥 División'}</div>
            <div class="division-lista">
                ${Object.entries(divisionDetalle.participantes).map(([participanteId, monto]) => {
        const participante = participantes.find(p => p.id === participanteId);
        return `
                        <div class="division-item">
                            <span class="division-participante">${participante?.nombre || 'Desconocido'}</span>
                            <span class="division-monto">$${formatearNumero(monto)}</span>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

// ============================================
// ABRIR MODAL GASTO (NUEVO O EDITAR)
// ============================================
function abrirModalGasto(gastoId = null) {
    const modal = document.getElementById('modalGasto');
    const titulo = document.getElementById('modalGastoTitulo');
    const form = document.getElementById('formGasto');

    form.reset();
    gastoEditandoId = gastoId;

    if (gastoId) {
        titulo.textContent = 'Editar Gasto';
        cargarDatosGasto(gastoId);
    } else {
        titulo.textContent = 'Agregar Gasto';
        // Fecha actual por defecto
        document.getElementById('gastoFecha').valueAsDate = new Date();

        // Moneda del primer destino por defecto
        if (destinos.length > 0 && destinos[0].moneda_codigo) {
            document.getElementById('gastoMoneda').value = destinos[0].moneda_codigo;
        }
    }

    // Inicializar división equitativa por defecto
    cambiarTipoDivision('equitativa');
    actualizarCheckboxesEquitativos();

    modal.classList.add('active');
}

// ============================================
// CARGAR DATOS DE GASTO PARA EDITAR
// ============================================
function cargarDatosGasto(gastoId) {
    const gasto = gastosData.find(g => g.id === gastoId);
    if (!gasto) return;

    document.getElementById('gastoDescripcion').value = gasto.descripcion;
    document.getElementById('gastoMonto').value = gasto.monto;
    document.getElementById('gastoMoneda').value = gasto.moneda;
    document.getElementById('gastoFecha').value = gasto.fecha;
    document.getElementById('gastoCategoria').value = gasto.categoria;
    document.getElementById('gastoPagadoPor').value = gasto.pagado_por_id;

    cambiarTipoDivision(gasto.tipo_division);

    // Cargar detalle de división
    const divisionDetalle = gasto.division_detalle || {};

    if (gasto.tipo_division === 'equitativa') {
        const participantesSeleccionados = Object.keys(divisionDetalle.participantes || {});
        participantesSeleccionados.forEach(id => {
            const checkbox = document.querySelector(`input[name="participanteEquitativo"][value="${id}"]`);
            if (checkbox) checkbox.checked = true;
        });
    } else if (gasto.tipo_division === 'personalizada') {
        actualizarInputsPersonalizados();
        Object.entries(divisionDetalle.participantes || {}).forEach(([participanteId, monto]) => {
            const inputMonto = document.getElementById(`montoPersonalizado_${participanteId}`);
            const inputPorcentaje = document.getElementById(`porcentajePersonalizado_${participanteId}`);

            if (inputMonto) {
                inputMonto.value = monto;
                // Calcular porcentaje
                const porcentaje = (parseFloat(monto) / parseFloat(gasto.monto_clp)) * 100;
                if (inputPorcentaje) {
                    inputPorcentaje.value = porcentaje.toFixed(2);
                }
            }
        });
    }


    calcularConversion();
}

// ============================================
// CERRAR MODAL GASTO
// ============================================
function cerrarModalGasto() {
    document.getElementById('modalGasto').classList.remove('active');
    gastoEditandoId = null;
}

// ============================================
// CAMBIAR TIPO DE DIVISIÓN
// ============================================
function cambiarTipoDivision(tipo) {
    // Actualizar tabs
    document.querySelectorAll('.division-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tipo === tipo) {
            tab.classList.add('active');
        }
    });

    // Mostrar/ocultar contenedores
    document.querySelectorAll('.division-container').forEach(container => {
        container.classList.remove('active');
    });

    switch (tipo) {
        case 'equitativa':
            document.getElementById('divisionEquitativaContainer').classList.add('active');
            actualizarCheckboxesEquitativos();
            break;
        case 'personalizada':
            document.getElementById('divisionPersonalizadaContainer').classList.add('active');
            actualizarInputsPersonalizados();
            break;
        case 'individual':
            document.getElementById('divisionIndividualContainer').classList.add('active');
            break;
    }
}

// ============================================
// ACTUALIZAR CHECKBOXES EQUITATIVOS
// ============================================
function actualizarCheckboxesEquitativos() {
    const container = document.getElementById('divisionEquitativaLista');

    container.innerHTML = participantes.map(p => `
        <div class="checkbox-item">
            <input type="checkbox" id="participante_${p.id}" name="participanteEquitativo" value="${p.id}" checked>
            <label for="participante_${p.id}">${p.nombre}</label>
        </div>
    `).join('');
}

// ============================================
// ACTUALIZAR INPUTS PERSONALIZADOS
// ============================================
function actualizarInputsPersonalizados() {
    const container = document.getElementById('divisionPersonalizadaLista');

    container.innerHTML = participantes.map(p => `
        <div class="input-dual">
            <label>${p.nombre}</label>
            <div class="input-dual-fields">
                <div class="input-dual-field">
                    <label>Monto</label>
                    <input 
                        type="number" 
                        id="montoPersonalizado_${p.id}" 
                        data-participante="${p.id}"
                        step="0.01" 
                        placeholder="0.00" 
                        min="0"
                        autocomplete="off"
                        oninput="calcularPorcentajeDesdeMontoPersonalizado('${p.id}')"
                    >
                </div>
                <div class="input-dual-field">
                    <label>%</label>
                    <input 
                        type="number" 
                        id="porcentajePersonalizado_${p.id}" 
                        data-participante="${p.id}"
                        step="0.01" 
                        placeholder="0.00" 
                        min="0" 
                        max="100"
                        autocomplete="off"
                        oninput="calcularMontoDesdeporcentajePersonalizado('${p.id}')"
                    >
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================
// CALCULAR PORCENTAJE DESDE MONTO
// ============================================
function calcularPorcentajeDesdeMontoPersonalizado(participanteId) {
    const montoTotal = parseFloat(document.getElementById('gastoMonto').value) || 0;

    if (montoTotal === 0) return;

    const moneda = document.getElementById('gastoMoneda').value;
    let montoTotalCLP = montoTotal;

    // Convertir a CLP si es necesario
    if (moneda !== 'CLP') {
        const destino = destinos.find(d => d.moneda_codigo === moneda);
        if (destino) {
            montoTotalCLP = montoTotal * destino.tipo_cambio_clp;
        }
    }

    const inputMonto = document.getElementById(`montoPersonalizado_${participanteId}`);
    const inputPorcentaje = document.getElementById(`porcentajePersonalizado_${participanteId}`);

    const monto = parseFloat(inputMonto.value) || 0;
    const porcentaje = (monto / montoTotalCLP) * 100;

    inputPorcentaje.value = porcentaje.toFixed(2);
}

// ============================================
// CALCULAR MONTO DESDE PORCENTAJE
// ============================================
function calcularMontoDesdeporcentajePersonalizado(participanteId) {
    const montoTotal = parseFloat(document.getElementById('gastoMonto').value) || 0;

    if (montoTotal === 0) return;

    const moneda = document.getElementById('gastoMoneda').value;
    let montoTotalCLP = montoTotal;

    // Convertir a CLP si es necesario
    if (moneda !== 'CLP') {
        const destino = destinos.find(d => d.moneda_codigo === moneda);
        if (destino) {
            montoTotalCLP = montoTotal * destino.tipo_cambio_clp;
        }
    }

    const inputMonto = document.getElementById(`montoPersonalizado_${participanteId}`);
    const inputPorcentaje = document.getElementById(`porcentajePersonalizado_${participanteId}`);

    const porcentaje = parseFloat(inputPorcentaje.value) || 0;
    const monto = (montoTotalCLP * porcentaje) / 100;

    inputMonto.value = monto.toFixed(2);
}

// ============================================
// CALCULAR CONVERSIÓN A CLP
// ============================================
function calcularConversion() {
    const monto = parseFloat(document.getElementById('gastoMonto').value) || 0;
    const moneda = document.getElementById('gastoMoneda').value;
    const conversionHint = document.getElementById('conversionHint');
    const conversionMonto = document.getElementById('conversionMonto');

    if (monto === 0 || moneda === 'CLP') {
        conversionHint.style.display = 'none';
        return;
    }

    // Buscar tipo de cambio del destino
    const destino = destinos.find(d => d.moneda_codigo === moneda);
    if (!destino) {
        conversionHint.style.display = 'none';
        return;
    }

    const montoCLP = monto * destino.tipo_cambio_clp;
    conversionMonto.textContent = `$${formatearNumero(montoCLP)}`;
    conversionHint.style.display = 'block';
}

// ============================================
// GUARDAR GASTO
// ============================================
async function guardarGasto(e) {
    e.preventDefault();

    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('active');

    try {
        // Obtener datos básicos
        const descripcion = document.getElementById('gastoDescripcion').value.trim();
        const monto = parseFloat(document.getElementById('gastoMonto').value);
        const moneda = document.getElementById('gastoMoneda').value;
        const fecha = document.getElementById('gastoFecha').value;
        const categoria = document.getElementById('gastoCategoria').value;
        const pagadoPorId = document.getElementById('gastoPagadoPor').value;

        // Determinar tipo de división activo
        const tabActivo = document.querySelector('.division-tab.active');
        const tipoDivision = tabActivo ? tabActivo.dataset.tipo : 'equitativa';

        // Calcular monto en CLP
        let montoCLP = monto;
        if (moneda !== 'CLP') {
            const destino = destinos.find(d => d.moneda_codigo === moneda);
            if (destino) {
                montoCLP = monto * destino.tipo_cambio_clp;
            }
        }

        // Obtener detalle de división
        const divisionDetalle = obtenerDivisionDetalle(tipoDivision, montoCLP);

        if (!divisionDetalle) {
            loadingOverlay.classList.remove('active');
            return;
        }

        const gastoData = {
            viaje_id: viajeData.id,
            descripcion,
            monto,
            moneda,
            monto_clp: montoCLP,
            fecha,
            pagado_por_id: pagadoPorId,
            categoria,
            tipo_division: tipoDivision,
            division_detalle: divisionDetalle
        };

        // ── MODO OFFLINE: guardar en cola local ──────────────────────────
        if (!navigator.onLine) {
            guardarEnColaOffline('gasto', gastoEditandoId ? 'editar' : 'crear', gastoData, gastoEditandoId);
            // Agregar al array local para que se vea en pantalla sin recargar
            if (!gastoEditandoId) {
                gastosData.unshift({ ...gastoData, id: 'offline_' + Date.now(), _offline: true });
            } else {
                const idx = gastosData.findIndex(g => g.id === gastoEditandoId);
                if (idx >= 0) gastosData[idx] = { ...gastoData, id: gastoEditandoId, _offline: true };
            }
            loadingOverlay.classList.remove('active');
            cerrarModalGasto();
            renderizarResumen();
            filtrarGastos();
            mostrarNotificacion('📡 Sin conexión — gasto guardado localmente, se sincronizará al conectar', 'warning');
            return;
        }

        // ── MODO ONLINE ───────────────────────────────────────────────────
        if (gastoEditandoId) {
            const { error } = await supabaseClient
                .from('v3_gastos')
                .update(gastoData)
                .eq('id', gastoEditandoId);
            if (error) throw error;
            mostrarNotificacion('Gasto actualizado correctamente', 'success');
        } else {
            const { error } = await supabaseClient
                .from('v3_gastos')
                .insert(gastoData);
            if (error) throw error;
            mostrarNotificacion('Gasto creado correctamente', 'success');
        }

        loadingOverlay.classList.remove('active');
        cerrarModalGasto();
        await cargarGastos();

    } catch (error) {
        console.error('Error guardando gasto:', error);
        loadingOverlay.classList.remove('active');
        mostrarNotificacion('Error al guardar el gasto', 'error');
    }
}

// ============================================
// OBTENER DETALLE DE DIVISIÓN
// ============================================
function obtenerDivisionDetalle(tipoDivision, montoCLP) {
    const detalle = { participantes: {} };

    switch (tipoDivision) {
        case 'equitativa':
            const checkboxes = document.querySelectorAll('input[name="participanteEquitativo"]:checked');
            if (checkboxes.length === 0) {
                mostrarNotificacion('Debes seleccionar al menos un participante', 'error');
                return null;
            }

            const montoPorPersona = redondear(montoCLP / checkboxes.length);
            checkboxes.forEach(cb => {
                detalle.participantes[cb.value] = montoPorPersona;
            });
            break;

        case 'personalizada':
            let totalPersonalizado = 0;
            let totalPorcentaje = 0;

            participantes.forEach(p => {
                const inputMonto = document.getElementById(`montoPersonalizado_${p.id}`);
                const inputPorcentaje = document.getElementById(`porcentajePersonalizado_${p.id}`);

                const monto = parseFloat(inputMonto.value) || 0;
                const porcentaje = parseFloat(inputPorcentaje.value) || 0;

                if (monto > 0) {
                    detalle.participantes[p.id] = monto;
                    totalPersonalizado += monto;
                    totalPorcentaje += porcentaje;
                }
            });

            if (Object.keys(detalle.participantes).length === 0) {
                mostrarNotificacion('Debes asignar al menos un monto o porcentaje', 'error');
                return null;
            }

            // Validar que sume 100% (con tolerancia de 0.1%)
            if (Math.abs(totalPersonalizado - montoCLP) > 1) {
                mostrarNotificacion(`La suma de montos ($${formatearNumero(totalPersonalizado)}) debe ser igual al total ($${formatearNumero(montoCLP)})`, 'error');
                return null;
            }

            if (Math.abs(totalPorcentaje - 100) > 0.1) {
                mostrarNotificacion(`La suma de porcentajes (${totalPorcentaje.toFixed(2)}%) debe ser igual a 100%`, 'error');
                return null;
            }
            break;


        case 'individual':
            const pagadoPorId = document.getElementById('gastoPagadoPor').value;
            detalle.participante_id = pagadoPorId;
            detalle.participantes[pagadoPorId] = montoCLP;
            break;
    }

    return detalle;
}

// ============================================
// EDITAR GASTO
// ============================================
function editarGasto(gastoId) {
    abrirModalGasto(gastoId);
}

// ============================================
// ELIMINAR GASTO
// ============================================
let gastoEliminarId = null;

function eliminarGasto(gastoId) {
    gastoEliminarId = gastoId;
    document.getElementById('modalEliminar').classList.add('active');
}

function cerrarModalEliminar() {
    document.getElementById('modalEliminar').classList.remove('active');
    gastoEliminarId = null;
}

async function confirmarEliminarGasto() {
    if (!gastoEliminarId) return;

    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('active');

    try {
        const { error } = await supabaseClient
            .from('v3_gastos')
            .delete()
            .eq('id', gastoEliminarId);

        if (error) throw error;

        loadingOverlay.classList.remove('active');
        cerrarModalEliminar();
        mostrarNotificacion('Gasto eliminado correctamente', 'success');
        await cargarGastos();

    } catch (error) {
        console.error('Error eliminando gasto:', error);
        loadingOverlay.classList.remove('active');
        mostrarNotificacion('Error al eliminar el gasto', 'error');
    }
}

// ============================================
// CALCULAR DEUDAS ENTRE DOS PARTICIPANTES
// Retorna array de { gasto, montoDeuda }
// ============================================
function calcularDetalleDeudaEntre(deudorId, acreedorId) {
    const detalle = [];
    gastosData.forEach(gasto => {
        // Solo gastos pagados por el acreedor
        if (gasto.pagado_por_id !== acreedorId) return;
        const division = gasto.division_detalle;
        if (!division || !division.participantes) return;
        // Ver si el deudor participa en este gasto
        const montoDeuda = parseFloat(division.participantes[deudorId] || 0);
        if (montoDeuda > 0) {
            detalle.push({ gasto, montoDeuda });
        }
    });
    return detalle;
}

// ============================================
// RENDERIZAR TABLA DE DEUDAS (con expansión)
// ============================================
function renderizarTablaDeudas() {
    const tabla = document.getElementById('deudasTabla');
    const resumenParticipantes = calcularResumenParticipantes(gastosData);

    let html = `
        <thead>
            <tr>
                <th style="width:32px"></th>
                <th>Participante</th>
                <th>Pagado</th>
                <th>Debe Pagar</th>
                <th>Gastado</th>
            </tr>
        </thead>
        <tbody>
    `;

    resumenParticipantes.forEach(rp => {
        const saldoClase = rp.balance >= 0 ? 'saldo-positivo' : 'saldo-negativo';
        const signo = rp.balance >= 0 ? '+' : '';

        // Calcular SIEMPRE ambas direcciones:
        // deudas_a: lo que este participante le debe a otros
        // creditos_de: lo que otros le deben a este participante
        const deudas_a = [];    // rp debe a otros
        const creditos_de = []; // otros deben a rp

        participantes.forEach(otro => {
            if (otro.id === rp.id) return;

            // ¿rp le debe a otro?
            const detalleDeuda = calcularDetalleDeudaEntre(rp.id, otro.id);
            if (detalleDeuda.length > 0) {
                const total = detalleDeuda.reduce((s, d) => s + d.montoDeuda, 0);
                const pagosRealizados = pagosDeudas
                    .filter(p => p.pagador_id === rp.id && p.receptor_id === otro.id)
                    .reduce((s, p) => s + parseFloat(p.monto_clp || 0), 0);
                const totalNeto = total - pagosRealizados;
                if (totalNeto > 0.5) {
                    deudas_a.push({ contraparte: otro, total: totalNeto, detalle: detalleDeuda, tipo: 'debe_a' });
                }
            }

            // ¿otro le debe a rp?
            const detalleCredito = calcularDetalleDeudaEntre(otro.id, rp.id);
            if (detalleCredito.length > 0) {
                const total = detalleCredito.reduce((s, d) => s + d.montoDeuda, 0);
                const pagosRealizados = pagosDeudas
                    .filter(p => p.pagador_id === otro.id && p.receptor_id === rp.id)
                    .reduce((s, p) => s + parseFloat(p.monto_clp || 0), 0);
                const totalNeto = total - pagosRealizados;
                if (totalNeto > 0.5) {
                    creditos_de.push({ contraparte: otro, total: totalNeto, detalle: detalleCredito, tipo: 'le_debe' });
                }
            }
        });

        const relaciones = { deudas_a, creditos_de };
        const tieneDetalle = deudas_a.length > 0 || creditos_de.length > 0;
        const rowId = `deuda-row-${rp.id}`;

        html += `
            <tr class="deuda-fila-principal ${tieneDetalle ? 'deuda-fila-expandible' : ''}"
                ${tieneDetalle ? `onclick="toggleDeudaDetalle('${rp.id}')"` : ''}>
                <td class="deuda-toggle-cell">
                    ${tieneDetalle ? `<span class="deuda-toggle-icon" id="toggle-icon-${rp.id}">▶</span>` : ''}
                </td>
                <td><strong>${rp.nombre}</strong></td>
                <td>${formatearNumero(rp.totalDesembolsado)}</td>
                <td>${formatearNumero(Math.max(0, rp.totalDebeReal))}</td>
                <td>${formatearNumero(rp.totalGastado)}</td>
            </tr>
            <tr class="deuda-detalle-row" id="${rowId}" style="display:none;">
                <td colspan="5" class="deuda-detalle-cell">
                    ${renderizarPanelDeudaDetalle(rp, relaciones.deudas_a, relaciones.creditos_de)}
                </td>
            </tr>
        `;
    });

    html += `</tbody>`;
    tabla.innerHTML = html;
}

// ============================================
// RENDERIZAR PANEL DE DETALLE DE DEUDA
// ============================================
function renderizarPanelDeudaDetalle(rp, deudas_a, creditos_de) {
    let html = `<div class="deuda-panel">`;

    // ---- Sección: lo que rp debe a otros ----
    if (deudas_a.length > 0) {
        html += `<div class="deuda-panel-titulo">💸 ${rp.nombre} le debe a:</div>`;
        html += `<table class="deuda-subtabla">
            <thead><tr><th>Acreedor</th><th>Total</th><th></th></tr></thead>
            <tbody>`;
        deudas_a.forEach(rel => {
            const subId = `deuda-sub-${rp.id}-${rel.contraparte.id}`;
            html += `
                <tr class="deuda-subtabla-fila" onclick="toggleDeudaSubDetalle('${rp.id}', '${rel.contraparte.id}')">
                    <td><strong>👤 ${rel.contraparte.nombre}</strong></td>
                    <td class="saldo-negativo">$${formatearNumero(rel.total)}</td>
                    <td class="deuda-sub-toggle"><span id="subtoggle-${rp.id}-${rel.contraparte.id}">▶</span></td>
                </tr>
                <tr id="${subId}" style="display:none;">
                    <td colspan="3" style="padding:0;">
                        ${renderizarDetalleGastos(rel.detalle, rp.id, rel.contraparte.id, rel.total)}
                    </td>
                </tr>`;
        });
        const totalDebe = deudas_a.reduce((s, r) => s + r.total, 0);
        html += `
                <tr class="deuda-subtabla-total">
                    <td><strong>TOTAL</strong></td>
                    <td><strong>$${formatearNumero(totalDebe)}</strong></td>
                    <td></td>
                </tr>
            </tbody></table>`;
    }

    // ---- Sección: lo que otros le deben a rp ----
    if (creditos_de.length > 0) {
        html += `<div class="deuda-panel-titulo" style="margin-top:${deudas_a.length > 0 ? '1rem' : '0'}">💰 Le deben a ${rp.nombre}:</div>`;
        html += `<table class="deuda-subtabla">
            <thead><tr><th>Deudor</th><th>Total</th><th></th></tr></thead>
            <tbody>`;
        creditos_de.forEach(rel => {
            const subId = `deuda-sub-credito-${rp.id}-${rel.contraparte.id}`;
            html += `
                <tr class="deuda-subtabla-fila" onclick="toggleDeudaSubDetalle('credito-${rp.id}', '${rel.contraparte.id}')">
                    <td><strong>👤 ${rel.contraparte.nombre}</strong></td>
                    <td class="saldo-positivo">$${formatearNumero(rel.total)}</td>
                    <td class="deuda-sub-toggle"><span id="subtoggle-credito-${rp.id}-${rel.contraparte.id}">▶</span></td>
                </tr>
                <tr id="${subId}" style="display:none;">
                    <td colspan="3" style="padding:0;">
                        ${renderizarDetalleGastos(rel.detalle, rel.contraparte.id, rp.id, rel.total)}
                    </td>
                </tr>`;
        });
        const totalCredito = creditos_de.reduce((s, r) => s + r.total, 0);
        html += `
                <tr class="deuda-subtabla-total">
                    <td><strong>TOTAL</strong></td>
                    <td><strong>$${formatearNumero(totalCredito)}</strong></td>
                    <td></td>
                </tr>
            </tbody></table>`;
    }

    html += `</div>`;
    return html;
}

// ============================================
// RENDERIZAR DETALLE DE GASTOS ENTRE DOS
// ============================================
function renderizarDetalleGastos(detalle, deudorId, acreedorId, totalNeto) {
    const totalBruto = detalle.reduce((s, d) => s + d.montoDeuda, 0);
    const pagosRealizados = pagosDeudas
        .filter(p => p.pagador_id === deudorId && p.receptor_id === acreedorId)
        .reduce((s, p) => s + parseFloat(p.monto_clp || 0), 0);

    // Recopilar gastos ya saldados según los pagos con gastos_ids vinculados
    const gastosPagadosIds = new Set();
    pagosDeudas
        .filter(p => p.pagador_id === deudorId && p.receptor_id === acreedorId)
        .forEach(p => {
            (p.gastos_ids || []).forEach(id => gastosPagadosIds.add(id));
        });

    let html = `<div class="deuda-gastos-detalle">
        <table class="deuda-gastos-tabla">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Monto parte</th>
                </tr>
            </thead>
            <tbody>`;

    detalle.forEach(({ gasto, montoDeuda }) => {
        const estaPagado = gastosPagadosIds.has(gasto.id);
        const estiloFila = estaPagado ? ' class="gasto-saldado"' : '';
        const estiloTexto = estaPagado ? ' style="text-decoration:line-through; color:#9ca3af;"' : '';
        const badgePagado = estaPagado ? ' <span class="badge-pagado">✓ Pagado</span>' : '';
        html += `
            <tr${estiloFila}>
                <td${estiloTexto}>${formatearFechaLocal(gasto.fecha)}</td>
                <td${estiloTexto}>${gasto.descripcion}${badgePagado}</td>
                <td${estiloTexto}>${obtenerIconoCategoria(gasto.categoria)} ${gasto.categoria}</td>
                <td${estiloTexto}>$${formatearNumero(montoDeuda)}</td>
            </tr>`;
    });

    html += `
            </tbody>
            <tfoot>
                <tr class="deuda-gastos-subtotal">
                    <td colspan="3">Subtotal gastos</td>
                    <td>$${formatearNumero(totalBruto)}</td>
                </tr>`;

    if (pagosRealizados > 0) {
        html += `
                <tr class="deuda-gastos-pagos">
                    <td colspan="3">Pagos ya realizados</td>
                    <td class="saldo-positivo">- $${formatearNumero(pagosRealizados)}</td>
                </tr>`;
    }

    html += `
                <tr class="deuda-gastos-total">
                    <td colspan="3"><strong>Total adeudado</strong></td>
                    <td><strong>$${formatearNumero(totalNeto)}</strong></td>
                </tr>
            </tfoot>
        </table>
    </div>`;

    return html;
}

// ============================================
// TOGGLE EXPANSIÓN FILA PRINCIPAL
// ============================================
function toggleDeudaDetalle(participanteId) {
    const row = document.getElementById(`deuda-row-${participanteId}`);
    const icon = document.getElementById(`toggle-icon-${participanteId}`);
    const visible = row.style.display !== 'none';
    row.style.display = visible ? 'none' : 'table-row';
    icon.textContent = visible ? '▶' : '▼';
}

// ============================================
// TOGGLE EXPANSIÓN SUBTABLA (detalle por gasto)
// ============================================
function toggleDeudaSubDetalle(participanteId, contraparteId) {
    const row = document.getElementById(`deuda-sub-${participanteId}-${contraparteId}`);
    const icon = document.getElementById(`subtoggle-${participanteId}-${contraparteId}`);
    const visible = row.style.display !== 'none';
    row.style.display = visible ? 'none' : 'table-row';
    icon.textContent = visible ? '▶' : '▼';
}


// ============================================
// MODAL CONFIGURAR PRESUPUESTOS
// ============================================
function abrirModalPresupuestos() {
    const modal = document.getElementById('modalPresupuestos');
    const lista = document.getElementById('presupuestosLista');

    const categorias = [
        { nombre: 'Alojamiento', icono: '🏨' },
        { nombre: 'Transporte', icono: '🚗' },
        { nombre: 'Comida', icono: '🍽️' },
        { nombre: 'Actividades', icono: '🎭' },
        { nombre: 'Compras', icono: '🛍️' },
        { nombre: 'Otros', icono: '📦' }
    ];

    // Obtener monedas únicas
    const monedasUnicas = new Set(['CLP']);
    destinos.forEach(d => {
        if (d.moneda_codigo) monedasUnicas.add(d.moneda_codigo);
    });

    const opcionesMonedas = Array.from(monedasUnicas).map(m =>
        `<option value="${m}">${m}</option>`
    ).join('');

    lista.innerHTML = categorias.map(cat => {
        const presupuestoExistente = presupuestos.find(p => p.categoria === cat.nombre);
        const monto = presupuestoExistente ? presupuestoExistente.monto : '';
        const moneda = presupuestoExistente ? presupuestoExistente.moneda : (destinos[0]?.moneda_codigo || 'CLP');
        const activo = presupuestoExistente ? presupuestoExistente.activo : false;

        return `
            <div class="presupuesto-item">
                <div class="presupuesto-icon">${cat.icono}</div>
                <div class="presupuesto-nombre">${cat.nombre}</div>
                <div class="presupuesto-input">
                    <input 
                        type="number" 
                        id="presupuesto_${cat.nombre}" 
                        placeholder="0.00" 
                        step="0.01"
                        value="${monto}"
                        data-categoria="${cat.nombre}"
                    >
                    <select id="moneda_${cat.nombre}" data-categoria="${cat.nombre}">
                        ${opcionesMonedas}
                    </select>
                </div>
                <div class="presupuesto-toggle">
                    <input 
                        type="checkbox" 
                        id="activo_${cat.nombre}" 
                        ${activo ? 'checked' : ''}
                        data-categoria="${cat.nombre}"
                    >
                    <label for="activo_${cat.nombre}">Activar</label>
                </div>
            </div>
        `;
    }).join('');

    // Establecer monedas guardadas
    categorias.forEach(cat => {
        const presupuestoExistente = presupuestos.find(p => p.categoria === cat.nombre);
        if (presupuestoExistente) {
            const selectMoneda = document.getElementById(`moneda_${cat.nombre}`);
            if (selectMoneda) {
                selectMoneda.value = presupuestoExistente.moneda;
            }
        }
    });

    modal.classList.add('active');
}

function cerrarModalPresupuestos() {
    document.getElementById('modalPresupuestos').classList.remove('active');
}

// ============================================
// GUARDAR PRESUPUESTOS
// ============================================
async function guardarPresupuestos() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('active');

    try {
        const categorias = ['Alojamiento', 'Transporte', 'Comida', 'Actividades', 'Compras', 'Otros'];

        // Primero, desactivar todos los presupuestos existentes
        await supabaseClient
            .from('v3_presupuestos_categorias')
            .update({ activo: false })
            .eq('viaje_id', viajeData.id);

        // Procesar cada categoría
        for (const categoria of categorias) {
            const monto = parseFloat(document.getElementById(`presupuesto_${categoria}`).value) || 0;
            const moneda = document.getElementById(`moneda_${categoria}`).value;
            const activo = document.getElementById(`activo_${categoria}`).checked;

            if (monto > 0 && activo) {
                // Calcular monto en CLP
                let montoCLP = monto;
                if (moneda !== 'CLP') {
                    const destino = destinos.find(d => d.moneda_codigo === moneda);
                    if (destino) {
                        montoCLP = monto * destino.tipo_cambio_clp;
                    }
                }

                // Verificar si ya existe un presupuesto para esta categoría
                const presupuestoExistente = presupuestos.find(p => p.categoria === categoria);

                if (presupuestoExistente) {
                    // Actualizar
                    await supabaseClient
                        .from('v3_presupuestos_categorias')
                        .update({
                            monto,
                            moneda,
                            monto_clp: montoCLP,
                            activo: true
                        })
                        .eq('id', presupuestoExistente.id);
                } else {
                    // Crear nuevo
                    await supabaseClient
                        .from('v3_presupuestos_categorias')
                        .insert({
                            viaje_id: viajeData.id,
                            categoria,
                            monto,
                            moneda,
                            monto_clp: montoCLP,
                            activo: true
                        });
                }
            }
        }

        loadingOverlay.classList.remove('active');
        cerrarModalPresupuestos();
        mostrarNotificacion('Presupuestos guardados correctamente', 'success');

        await cargarPresupuestos();
        await cargarGastos();

    } catch (error) {
        console.error('Error guardando presupuestos:', error);
        loadingOverlay.classList.remove('active');
        mostrarNotificacion('Error al guardar presupuestos', 'error');
    }
}

// ============================================
// MODAL REGISTRAR PAGO
// ============================================
function abrirModalPago() {
    const modal = document.getElementById('modalPago');
    const form = document.getElementById('formPago');

    form.reset();
    document.getElementById('pagoFecha').valueAsDate = new Date();

    // Actualizar receptores basado en el primer participante
    if (participantes.length > 0) {
        document.getElementById('pagoPagador').value = participantes[0].id;
        actualizarReceptoresPago();
    }

    gastosSeleccionadosPago = [];

    modal.classList.add('active');
}


function cerrarModalPago() {
    document.getElementById('modalPago').classList.remove('active');
    gastosSeleccionadosPago = [];
    const resumenEl = document.getElementById('pagoGastosSeleccionadosResumen');
    if (resumenEl) { resumenEl.style.display = 'none'; resumenEl.innerHTML = ''; }
}

// ============================================
// GUARDAR PAGO
// ============================================
async function guardarPago(e) {
    e.preventDefault();
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('active');

    try {
        const pagadorId = document.getElementById('pagoPagador').value;
        const receptorId = document.getElementById('pagoReceptor').value;
        const monto = parseFloat(document.getElementById('pagoMonto').value);
        const fechaInput = document.getElementById('pagoFecha').value; // ya viene como YYYY-MM-DD

        if (pagadorId === receptorId) {
            mostrarNotificacion('El pagador y el receptor no pueden ser la misma persona', 'error');
            loadingOverlay.classList.remove('active');
            return;
        }

        if (!monto || monto <= 0) {
            mostrarNotificacion('Ingresa un monto válido', 'error');
            loadingOverlay.classList.remove('active');
            return;
        }

        if (!fechaInput) {
            mostrarNotificacion('Ingresa una fecha válida', 'error');
            loadingOverlay.classList.remove('active');
            return;
        }

        const pagoData = {
            viaje_id: viajeData.id,
            pagador_id: pagadorId,
            receptor_id: receptorId,
            monto_clp: monto,
            fecha: fechaInput,  // string YYYY-MM-DD directo, sin convertir a Date
            nota: gastosSeleccionadosPago.length > 0
                ? JSON.stringify({ gastos_ids: gastosSeleccionadosPago.map(g => g.gastoId) })
                : null
        };

        console.log('Guardando pago:', pagoData); // para verificar en consola

        const { data, error } = await supabaseClient
            .from('v3_pagos_deudas')
            .insert(pagoData)
            .select(); // forzar que retorne el registro insertado

        if (error) {
            console.error('Error Supabase al guardar pago:', error);
            throw error;
        }

        console.log('Pago guardado:', data);

        loadingOverlay.classList.remove('active');
        cerrarModalPago();
        mostrarNotificacion('Pago registrado correctamente', 'success');

        await cargarPagosDeudas();
        await cargarGastos();

    } catch (error) {
        console.error('Error guardando pago:', error);
        loadingOverlay.classList.remove('active');
        mostrarNotificacion('Error al registrar el pago: ' + error.message, 'error');
    }
}


// ============================================
// EXPORTAR A EXCEL
// ============================================
function exportarExcel() {
    if (gastosData.length === 0) {
        mostrarNotificacion('No hay gastos para exportar', 'info');
        return;
    }

    const wb = XLSX.utils.book_new();

    // ============================================
    // HOJA 1: GASTOS TOTALES
    // ============================================
    const datosGastosTotales = gastosData.map(gasto => {
        const participante = participantes.find(p => p.id === gasto.pagado_por_id);
        const divisionDetalle = gasto.division_detalle || {};
        const numParticipantes = Object.keys(divisionDetalle.participantes || {}).length;

        return {
            'Fecha': formatearFechaLocal(gasto.fecha),
            'Descripción': gasto.descripcion,
            'Categoría': gasto.categoria,
            'Monto': gasto.monto,
            'Moneda': gasto.moneda,
            'Monto CLP': gasto.monto_clp,
            'Pagado por': participante?.nombre || 'Desconocido',
            'Tipo División': obtenerTextoTipoDivision(gasto.tipo_division),
            'Participantes': numParticipantes
        };
    });

    const wsGastosTotales = XLSX.utils.json_to_sheet(datosGastosTotales);

    // Ajustar anchos de columna
    wsGastosTotales['!cols'] = [
        { wch: 12 }, // Fecha
        { wch: 30 }, // Descripción
        { wch: 15 }, // Categoría
        { wch: 12 }, // Monto
        { wch: 8 },  // Moneda
        { wch: 15 }, // Monto CLP
        { wch: 20 }, // Pagado por
        { wch: 18 }, // Tipo División
        { wch: 15 }  // Participantes
    ];

    XLSX.utils.book_append_sheet(wb, wsGastosTotales, 'Gastos Totales');

    // ============================================
    // HOJA 2: GASTOS POR PARTICIPANTE
    // ============================================
    const datosGastosParticipantes = [];

    participantes.forEach(participante => {
        const gastosParticipante = gastosData.filter(g => g.pagado_por_id === participante.id);
        const totalPagado = gastosParticipante.reduce((sum, g) => sum + parseFloat(g.monto_clp), 0);

        gastosParticipante.forEach(gasto => {
            datosGastosParticipantes.push({
                'Participante': participante.nombre,
                'Fecha': formatearFechaLocal(gasto.fecha),
                'Descripción': gasto.descripcion,
                'Categoría': gasto.categoria,
                'Monto': gasto.monto,
                'Moneda': gasto.moneda,
                'Monto CLP': gasto.monto_clp
            });
        });

        // Agregar línea de total
        datosGastosParticipantes.push({
            'Participante': `TOTAL ${participante.nombre}`,
            'Fecha': '',
            'Descripción': '',
            'Categoría': '',
            'Monto': '',
            'Moneda': '',
            'Monto CLP': totalPagado
        });

        // Línea en blanco
        datosGastosParticipantes.push({});
    });

    const wsGastosParticipantes = XLSX.utils.json_to_sheet(datosGastosParticipantes);
    wsGastosParticipantes['!cols'] = [
        { wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 15 },
        { wch: 12 }, { wch: 8 }, { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, wsGastosParticipantes, 'Gastos por Participante');

    // ============================================
    // HOJA 3: RESUMEN DE DEUDAS Y BALANCES
    const resumenParticipantes = calcularResumenParticipantes(gastosData);
    const datosDeudas = resumenParticipantes.map(rp => ({
        'Participante': rp.nombre,
        'Total Pagado CLP': redondear(rp.totalPagado),
        'Total Adeudado CLP': redondear(rp.totalDebeReal),
        'Balance CLP': redondear(rp.balance),
        'Estado': rp.balance >= 0 ? 'Debe recibir' : 'Debe pagar'
    }));
    const wsDeudas = XLSX.utils.json_to_sheet(datosDeudas);
    wsDeudas['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsDeudas, 'Resumen de Deudas');

    // HOJA 4: DETALLE DE DEUDAS ENTRE PARTICIPANTES (todos, no solo deudores)
    const datosDetalleDeudas = [];

    resumenParticipantes.forEach(rp => {
        // Incluir TODOS los participantes, no solo los que tienen balance negativo
        participantes.forEach(acreedor => {
            if (acreedor.id === rp.id) return;
            const detalle = calcularDetalleDeudaEntre(rp.id, acreedor.id);
            if (detalle.length === 0) return;

            const totalBruto = detalle.reduce((s, d) => s + d.montoDeuda, 0);
            const pagosRealizados = pagosDeudas
                .filter(p => p.pagador_id === rp.id && p.receptor_id === acreedor.id)
                .reduce((s, p) => s + parseFloat(p.monto_clp || 0), 0);
            const totalNeto = totalBruto - pagosRealizados;
            if (totalNeto <= 0.5) return;

            // Encabezado del grupo
            datosDetalleDeudas.push({
                'Deudor': rp.nombre,
                'Acreedor': acreedor.nombre,
                'Fecha': '',
                'Descripción': `--- ${rp.nombre} le debe a ${acreedor.nombre} ---`,
                'Categoría': '',
                'Monto Parte CLP': ''
            });

            // Gastos del grupo
            detalle.forEach(({ gasto, montoDeuda }) => {
                datosDetalleDeudas.push({
                    'Deudor': rp.nombre,
                    'Acreedor': acreedor.nombre,
                    'Fecha': formatearFechaLocal(gasto.fecha),
                    'Descripción': gasto.descripcion,
                    'Categoría': gasto.categoria,
                    'Monto Parte CLP': redondear(montoDeuda)
                });
            });

            // Pagos realizados
            if (pagosRealizados > 0) {
                datosDetalleDeudas.push({
                    'Deudor': rp.nombre,
                    'Acreedor': acreedor.nombre,
                    'Fecha': '',
                    'Descripción': 'Pagos ya realizados',
                    'Categoría': '',
                    'Monto Parte CLP': -redondear(pagosRealizados)
                });
            }

            // Total del grupo
            datosDetalleDeudas.push({
                'Deudor': rp.nombre,
                'Acreedor': acreedor.nombre,
                'Fecha': '',
                'Descripción': 'TOTAL ADEUDADO',
                'Categoría': '',
                'Monto Parte CLP': redondear(totalNeto)
            });

            // Línea en blanco separadora
            datosDetalleDeudas.push({
                'Deudor': '', 'Acreedor': '', 'Fecha': '',
                'Descripción': '', 'Categoría': '', 'Monto Parte CLP': ''
            });
        });
    });

    const wsDetalleDeudas = XLSX.utils.json_to_sheet(datosDetalleDeudas);
    wsDetalleDeudas['!cols'] = [
        { wch: 18 }, { wch: 18 }, { wch: 12 },
        { wch: 35 }, { wch: 15 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDetalleDeudas, 'Detalle Deudas');

    // ============================================
    // HOJA 5: DESGLOSE POR PARTICIPANTE
    // Una línea por cada gasto con el monto que le corresponde a cada uno
    // ============================================
    const datosDesglose = [];

    participantes.forEach(participante => {
        // Encabezado de participante
        datosDesglose.push({
            'Participante': `=== ${participante.nombre.toUpperCase()} ===`,
            'Rol': '',
            'Fecha': '',
            'Descripción': '',
            'Categoría': '',
            'Pagado Por': '',
            'Monto Total Gasto CLP': '',
            'Mi Parte CLP': ''
        });

        let totalMiParte = 0;
        let totalPague = 0;

        gastosData.forEach(gasto => {
            const divisionDetalle = gasto.division_detalle || {};
            const participantesGasto = divisionDetalle.participantes || {};
            const miParte = parseFloat(participantesGasto[participante.id] || 0);
            const yoPague = gasto.pagado_por_id === participante.id;

            // Solo incluir si participa en el gasto
            if (miParte === 0 && !yoPague) return;

            const pagadoPor = participantes.find(p => p.id === gasto.pagado_por_id);
            const rol = yoPague ? 'Pagué yo' : 'Participé';

            datosDesglose.push({
                'Participante': participante.nombre,
                'Rol': rol,
                'Fecha': formatearFechaLocal(gasto.fecha),
                'Descripción': gasto.descripcion,
                'Categoría': gasto.categoria,
                'Pagado Por': pagadoPor?.nombre || 'Desconocido',
                'Monto Total Gasto CLP': redondear(gasto.monto_clp),
                'Mi Parte CLP': redondear(miParte)
            });

            totalMiParte += miParte;
            if (yoPague) totalPague += parseFloat(gasto.monto_clp || 0);
        });

        // Totales del participante
        datosDesglose.push({
            'Participante': participante.nombre,
            'Rol': 'TOTAL PARTICIPÉ',
            'Fecha': '',
            'Descripción': '',
            'Categoría': '',
            'Pagado Por': '',
            'Monto Total Gasto CLP': '',
            'Mi Parte CLP': redondear(totalMiParte)
        });
        datosDesglose.push({
            'Participante': participante.nombre,
            'Rol': 'TOTAL PAGUÉ',
            'Fecha': '',
            'Descripción': '',
            'Categoría': '',
            'Pagado Por': '',
            'Monto Total Gasto CLP': redondear(totalPague),
            'Mi Parte CLP': ''
        });
        datosDesglose.push({
            'Participante': '', 'Rol': '', 'Fecha': '', 'Descripción': '',
            'Categoría': '', 'Pagado Por': '', 'Monto Total Gasto CLP': '', 'Mi Parte CLP': ''
        });
    });

    const wsDesglose = XLSX.utils.json_to_sheet(datosDesglose);
    wsDesglose['!cols'] = [
        { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 30 },
        { wch: 15 }, { wch: 18 }, { wch: 22 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDesglose, 'Desglose por Participante');


    // ============================================
    // HOJA 4: PAGOS REALIZADOS
    // ============================================
    if (pagosDeudas.length > 0) {
        const datosPagos = pagosDeudas.map(pago => {
            const pagador = participantes.find(p => p.id === pago.pagador_id);
            const receptor = participantes.find(p => p.id === pago.receptor_id);

            return {
                'Fecha': formatearFechaLocal(pago.fecha),
                'Pagador': pagador?.nombre || 'Desconocido',
                'Receptor': receptor?.nombre || 'Desconocido',
                'Monto (CLP)': redondear(pago.monto_clp),
                'Nota': (() => {
                    if (!pago.nota) return '';
                    try { const p = JSON.parse(pago.nota); return p.gastos_ids ? `Gastos saldados: ${p.gastos_ids.length}` : pago.nota; }
                    catch (e) { return pago.nota; }
                })()
            };
        });

        const wsPagos = XLSX.utils.json_to_sheet(datosPagos);
        wsPagos['!cols'] = [
            { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 40 }
        ];

        XLSX.utils.book_append_sheet(wb, wsPagos, 'Pagos Realizados');
    }

    // ============================================
    // HOJA 5: ESTADÍSTICAS Y RESUMEN
    // ============================================
    const totalGeneral = gastosData.reduce((sum, g) => sum + parseFloat(g.monto_clp), 0);
    const promedioGasto = gastosData.length > 0 ? totalGeneral / gastosData.length : 0;

    // Gastos por categoría
    const gastosPorCategoria = {};
    gastosData.forEach(g => {
        const cat = g.categoria || 'Otros';
        gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + parseFloat(g.monto_clp);
    });

    const datosEstadisticas = [
        { 'Concepto': 'RESUMEN GENERAL', 'Valor': '' },
        { 'Concepto': 'Total de Gastos', 'Valor': gastosData.length },
        { 'Concepto': 'Total Gastado (CLP)', 'Valor': totalGeneral },
        { 'Concepto': 'Promedio por Gasto (CLP)', 'Valor': promedioGasto },
        { 'Concepto': '', 'Valor': '' },
        { 'Concepto': 'GASTOS POR CATEGORÍA', 'Valor': '' }
    ];

    Object.entries(gastosPorCategoria)
        .sort((a, b) => b[1] - a[1])
        .forEach(([categoria, monto]) => {
            const porcentaje = (monto / totalGeneral) * 100;
            datosEstadisticas.push({
                'Concepto': categoria,
                'Valor': monto,
                'Porcentaje': `${porcentaje.toFixed(1)}%`
            });
        });

    // Agregar presupuestos si existen
    if (presupuestos.length > 0) {
        datosEstadisticas.push({ 'Concepto': '', 'Valor': '' });
        datosEstadisticas.push({ 'Concepto': 'PRESUPUESTOS', 'Valor': '' });

        presupuestos.forEach(p => {
            const gastosCategoria = gastosData.filter(g => g.categoria === p.categoria);
            const totalGastado = gastosCategoria.reduce((sum, g) => sum + parseFloat(g.monto_clp), 0);
            const porcentajeUsado = (totalGastado / p.monto_clp) * 100;

            datosEstadisticas.push({
                'Concepto': `${p.categoria} (${p.moneda})`,
                'Valor': `${totalGastado.toFixed(2)} / ${p.monto.toFixed(2)}`,
                'Porcentaje': `${porcentajeUsado.toFixed(1)}% usado`
            });
        });
    }

    const wsEstadisticas = XLSX.utils.json_to_sheet(datosEstadisticas);
    wsEstadisticas['!cols'] = [
        { wch: 30 }, { wch: 20 }, { wch: 15 }
    ];

    XLSX.utils.book_append_sheet(wb, wsEstadisticas, 'Estadísticas');

    // ============================================
    // DESCARGAR ARCHIVO
    // ============================================
    const nombreArchivo = `Gastos_${viajeData.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);

    mostrarNotificacion('Excel exportado correctamente', 'success');
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function obtenerIconoCategoria(categoria) {
    const iconos = {
        'Alojamiento': '🏨',
        'Transporte': '🚗',
        'Comida': '🍽️',
        'Actividades': '🎭',
        'Compras': '🛍️',
        'Otros': '📦'
    };
    return iconos[categoria] || '📦';
}

function obtenerTextoTipoDivision(tipo) {
    const textos = {
        'equitativa': 'Equitativa',
        'personalizada': 'Personalizada',
        'individual': 'Individual'
    };
    return textos[tipo] || tipo;
}

function formatearFechaLocal(fechaStr) {
    if (!fechaStr) return '';
    const fecha = new Date(fechaStr + 'T00:00:00');
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}-${mes}-${anio}`;
}

function formatearNumero(numero) {
    return redondear(numero).toLocaleString('es-CL', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function obtenerParametroURL(parametro) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(parametro);
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    const colores = {
        success: '#22c55e',
        error: '#ef4444',
        info: '#667eea',
        warning: '#f59e0b'
    };
    Toastify({
        text: mensaje,
        duration: 3000,
        gravity: 'top',
        position: 'right',
        style: { background: colores[tipo] || colores.info },
        stopOnFocus: true
    }).showToast();
}

// ============================================
// ACTUALIZAR RECEPTORES DE PAGO
// ============================================
function actualizarReceptoresPago() {
    const pagadorId = document.getElementById('pagoPagador').value;
    const selectReceptor = document.getElementById('pagoReceptor');

    // Filtrar participantes para excluir al pagador
    const receptoresDisponibles = participantes.filter(p => p.id !== pagadorId);

    selectReceptor.innerHTML = receptoresDisponibles.map(p =>
        `<option value="${p.id}">${p.nombre}</option>`
    ).join('');
}

// ============================================
// ABRIR MODAL "¿QUÉ PAGARÁ?"
// ============================================
function abrirModalQuePagara() {
    const pagadorId = document.getElementById('pagoPagador').value;
    const receptorId = document.getElementById('pagoReceptor').value;

    if (!pagadorId || !receptorId) {
        mostrarNotificacion('Primero selecciona quién pagará y a quién', 'error');
        return;
    }

    if (pagadorId === receptorId) {
        mostrarNotificacion('El pagador y el receptor no pueden ser la misma persona', 'error');
        return;
    }

    const pagador = participantes.find(p => p.id === pagadorId);
    const receptor = participantes.find(p => p.id === receptorId);

    // Calcular qué gastos debe el pagador al receptor
    const deudasPendientes = calcularDeudasEspecificas(pagadorId, receptorId);

    const modal = document.getElementById('modalQuePagara');
    const infoContainer = document.getElementById('quePagaraInfo');
    const listaContainer = document.getElementById('quePagaraLista');

    if (deudasPendientes.length === 0) {
        infoContainer.textContent = `${pagador.nombre} no tiene deudas pendientes con ${receptor.nombre}`;
        listaContainer.innerHTML = `
            <div class="deudas-popup-vacio">
                <div class="empty-icon">✅</div>
                <p>No hay deudas pendientes</p>
            </div>
        `;
        gastosSeleccionadosPago = [];
    } else {
        infoContainer.textContent = `${pagador.nombre} le debe a ${receptor.nombre}:`;

        listaContainer.innerHTML = deudasPendientes.map(deuda => `
            <div class="deuda-item-seleccionable" onclick="toggleSeleccionDeuda('${deuda.gastoId}', ${deuda.monto})">
                <input 
                    type="checkbox" 
                    id="deuda_${deuda.gastoId}" 
                    data-monto="${deuda.monto}"
                    onclick="event.stopPropagation(); toggleSeleccionDeuda('${deuda.gastoId}', ${deuda.monto})"
                >
                <div class="deuda-item-info">
                    <div class="deuda-item-descripcion">${deuda.descripcion}</div>
                    <div class="deuda-item-meta">
                        ${formatearFechaLocal(deuda.fecha)} • ${deuda.categoria}
                    </div>
                </div>
                <div class="deuda-item-monto">$${formatearNumero(deuda.monto)}</div>
            </div>
        `).join('');

        gastosSeleccionadosPago = [];
    }

    actualizarTotalSeleccionado();
    modal.classList.add('active');
}

// ============================================
// CALCULAR DEUDAS ESPECÍFICAS
// ============================================
function calcularDeudasEspecificas(pagadorId, receptorId) {
    const deudas = [];

    // Total ya pagado entre estos dos participantes
    const montoYaPagadoTotal = pagosDeudas
        .filter(p => p.pagador_id === pagadorId && p.receptor_id === receptorId)
        .reduce((s, p) => s + parseFloat(p.monto_clp || 0), 0);

    // Gastos donde el receptor pagó y el pagador participa
    // Los gastos vinculados a pagos ya registrados se marcan
    const gastosPagadosIds = new Set();
    pagosDeudas
        .filter(p => p.pagador_id === pagadorId && p.receptor_id === receptorId && p.gastos_ids)
        .forEach(p => {
            (p.gastos_ids || []).forEach(id => gastosPagadosIds.add(id));
        });

    // Calcular deuda bruta total para saber qué porcentaje está cubierto
    let deudaBrutaTotal = 0;
    const gastosConDeuda = [];

    gastosData.forEach(gasto => {
        if (gasto.pagado_por_id !== receptorId) return;
        const divisionDetalle = gasto.division_detalle || {};
        const participantesGasto = divisionDetalle.participantes || {};
        const montoDebe = parseFloat(participantesGasto[pagadorId] || 0);
        if (montoDebe > 0) {
            deudaBrutaTotal += montoDebe;
            gastosConDeuda.push({ gasto, montoDebe });
        }
    });

    // Si ya pagó todo, no hay deudas pendientes
    const deudaPendienteTotal = deudaBrutaTotal - montoYaPagadoTotal;
    if (deudaPendienteTotal <= 0.5) return deudas;

    // Mostrar cada gasto con su monto real, marcando los que están cubiertos
    // Si hay gastos_ids registrados en pagos, excluir esos gastos
    // Si no hay gastos_ids (pago anterior sin detalle), mostrar todo con nota del abono
    const usaGastosVinculados = pagosDeudas
        .filter(p => p.pagador_id === pagadorId && p.receptor_id === receptorId)
        .some(p => p.gastos_ids && p.gastos_ids.length > 0);

    if (usaGastosVinculados) {
        // Solo mostrar gastos no cubiertos
        gastosConDeuda.forEach(({ gasto, montoDebe }) => {
            if (!gastosPagadosIds.has(gasto.id)) {
                deudas.push({
                    gastoId: gasto.id,
                    descripcion: gasto.descripcion,
                    fecha: gasto.fecha,
                    categoria: gasto.categoria,
                    monto: montoDebe
                });
            }
        });
    } else {
        // Sistema antiguo: mostrar todos los gastos con sus montos reales
        // La deducción se ve reflejada en el total neto de la tabla
        gastosConDeuda.forEach(({ gasto, montoDebe }) => {
            deudas.push({
                gastoId: gasto.id,
                descripcion: gasto.descripcion,
                fecha: gasto.fecha,
                categoria: gasto.categoria,
                monto: montoDebe
            });
        });
    }

    return deudas;
}

// ============================================
// TOGGLE SELECCIÓN DE DEUDA
// ============================================
function toggleSeleccionDeuda(gastoId, monto) {
    const checkbox = document.getElementById(`deuda_${gastoId}`);
    const item = checkbox.closest('.deuda-item-seleccionable');

    checkbox.checked = !checkbox.checked;

    if (checkbox.checked) {
        item.classList.add('selected');
        gastosSeleccionadosPago.push({ gastoId, monto });
    } else {
        item.classList.remove('selected');
        gastosSeleccionadosPago = gastosSeleccionadosPago.filter(g => g.gastoId !== gastoId);
    }

    actualizarTotalSeleccionado();
}

// ============================================
// ACTUALIZAR TOTAL SELECCIONADO
// ============================================
function actualizarTotalSeleccionado() {
    const total = gastosSeleccionadosPago.reduce((sum, g) => sum + g.monto, 0);
    document.getElementById('totalSeleccionado').textContent = `$${formatearNumero(total)}`;
}

// ============================================
// CONFIRMAR QUÉ PAGARÁ
// ============================================
function confirmarQuePagara() {
    if (gastosSeleccionadosPago.length === 0) {
        mostrarNotificacion('Debes seleccionar al menos un gasto', 'error');
        return;
    }

    const total = gastosSeleccionadosPago.reduce((sum, g) => sum + g.monto, 0);

    // Pasar el monto al formulario principal
    document.getElementById('pagoMonto').value = total.toFixed(2);

    // Mostrar resumen de gastos seleccionados en el formulario de pago
    const resumenEl = document.getElementById('pagoGastosSeleccionadosResumen');
    if (resumenEl) {
        const descripciones = gastosSeleccionadosPago.map(g => {
            const gasto = gastosData.find(d => d.id === g.gastoId);
            return gasto ? gasto.descripcion : g.gastoId;
        });
        resumenEl.innerHTML = `
            <div class="gastos-seleccionados-lista">
                <div class="gastos-seleccionados-titulo">✅ Gastos que se saldarán (${gastosSeleccionadosPago.length}):</div>
                ${descripciones.map(d => `<div class="gastos-seleccionado-item">• ${d}</div>`).join('')}
            </div>
        `;
        resumenEl.style.display = 'block';
    }

    cerrarModalQuePagara();
    mostrarNotificacion('Selección confirmada. Presiona Registrar Pago para confirmar.', 'success');
}

// ============================================
// CERRAR MODAL "¿QUÉ PAGARÁ?"
// ============================================
function cerrarModalQuePagara(limpiarSeleccion = false) {
    document.getElementById('modalQuePagara').classList.remove('active');
    // Solo limpiar si se cancela, NO si se confirmó (para que guardarPago pueda usar la selección)
    if (limpiarSeleccion) {
        gastosSeleccionadosPago = [];
    }
}

// ============================================
// COLA OFFLINE — guardar y sincronizar
// ============================================
const GASTOS_OFFLINE_KEY = 'gastos_offline_queue';

function guardarEnColaOffline(tipo, accion, datos, idExistente = null) {
    try {
        const cola = JSON.parse(localStorage.getItem(GASTOS_OFFLINE_KEY) || '[]');
        cola.push({
            id: 'q_' + Date.now(),
            tipo,        // 'gasto' | 'actividad'
            accion,      // 'crear' | 'editar'
            datos,
            idExistente,
            timestamp: Date.now()
        });
        localStorage.setItem(GASTOS_OFFLINE_KEY, JSON.stringify(cola));
        console.log(`[Offline] ${accion} ${tipo} encolado. Total pendientes: ${cola.length}`);
    } catch (e) { console.warn('Error guardando en cola offline:', e); }
}

async function sincronizarColaOffline() {
    if (!navigator.onLine) return;
    const cola = JSON.parse(localStorage.getItem(GASTOS_OFFLINE_KEY) || '[]');
    if (cola.length === 0) return;

    console.log(`[Offline] Sincronizando ${cola.length} elemento(s) pendiente(s)...`);
    const errores = [];

    for (const item of cola) {
        try {
            if (item.tipo === 'gasto') {
                if (item.accion === 'crear') {
                    const { error } = await supabaseClient.from('v3_gastos').insert(item.datos);
                    if (error) throw error;
                } else if (item.accion === 'editar' && item.idExistente) {
                    const { error } = await supabaseClient.from('v3_gastos').update(item.datos).eq('id', item.idExistente);
                    if (error) throw error;
                }
            }
        } catch (e) {
            console.warn('[Offline] Error sincronizando item:', e);
            errores.push(item);
        }
    }

    if (errores.length === 0) {
        localStorage.removeItem(GASTOS_OFFLINE_KEY);
        mostrarNotificacion('✅ Gastos sincronizados correctamente', 'success');
    } else {
        localStorage.setItem(GASTOS_OFFLINE_KEY, JSON.stringify(errores));
        mostrarNotificacion(`⚠️ ${errores.length} gasto(s) no pudieron sincronizarse`, 'warning');
    }

    // Recargar datos frescos desde Supabase
    await cargarGastos();
}

// Escuchar reconexión y sincronizar automáticamente
window.addEventListener('online', () => {
    mostrarNotificacion('🔄 Conexión restaurada — sincronizando gastos...', 'info');
    sincronizarColaOffline();
});
