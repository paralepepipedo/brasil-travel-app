// ========================================
// GASTOS.JS - Código ORIGINAL 
// ========================================

// HTML original completo
const htmlGastosOriginal = `<form id="formGasto">
    <label for="descripcion">Descripción del gasto:</label>
    <input type="text" id="descripcion" required />
    <label for="monto">Monto:</label>
    <div class="monto-container">
      <input type="number" id="monto" step="0.01" min="0" required />
      <select id="moneda">
        <option value="BRL" selected>BRL</option>
        <option value="CLP">CLP</option>
      </select>
    </div>
    <label for="fecha">Fecha:</label>
    <input type="date" id="fecha" required />
    <label for="pagadoPor">Pagado por:</label>
    <select id="pagadoPor">
      <option value="Patricia">Patricia</option>
      <option value="Daniela">Daniela</option>
      <option value="Gonzalo">Gonzalo</option>
    </select>
    <select id="personas">
      <option value="3">3 personas</option>
      <option value="4">4 personas (Gonzalo 2 partes)</option>
    </select>
    <label for="mostrarCLP">Mostrar monto en Pesos Chilenos (CLP):
      <input type="checkbox" id="mostrarCLP" checked />
    </label>
    <button type="submit">Agregar gasto</button>
  </form>

  <label for="filtroFecha"
    style="font-weight: 600; color: var(--azul-brasil); margin-bottom: 0.5rem; display: flex; align-items: center;">
    Filtrar gastos por fecha:
    <input type="date" id="filtroFecha" style="margin-left: 0.5rem; padding: 0.3rem;" />
    <button id="btnLimpiarFiltro" type="button">Limpiar filtro</button>
  </label>

  <table id="tablaGastos" aria-label="Lista de gastos">
    <thead></thead>
    <tbody></tbody>
  </table>

  <div class="totales" id="totales"></div>

  <div id="detalleDeudaContainer" style="display: none;"></div>

  <script>
    // --- Variables globales ---
    const STORAGE_KEY = 'gastosViaje';
    const TASA_CAMBIO = 179;
    let gastos = [];
    let idEdicion = null;
    function inicializarApp() {


      // --- Referencias a elementos ---
      const pagadoPorSelect = document.getElementById('pagadoPor');
      const form = document.getElementById('formGasto');
      const tablaCuerpo = document.querySelector('#tablaGastos tbody');
      const filtroFecha = document.getElementById('filtroFecha');
      const btnLimpiarFiltro = document.getElementById('btnLimpiarFiltro');
      const mostrarCLPCheckbox = document.getElementById('mostrarCLP');
      const totalesDiv = document.getElementById('totales');
      const monedaSelect = document.getElementById('moneda');

      // --- Funciones de ayuda ---
      const fmtBRL = v => 'R$ ' + Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmtCLP = v => 'CLP$ ' + Math.round(v).toLocaleString('es-CL');

      function asignarPartes(gasto) {
        if (gasto.personas == 3) {
          const parte = gasto.monto_brl / 3;
          return { Patricia: parte, Daniela: parte, Gonzalo: parte };
        } else {
          const parte = gasto.monto_brl / 4;
          return { Patricia: parte, Daniela: parte, Gonzalo: parte * 2 };
        }
      }

      function crearFicha(gasto, index) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        const montoCLP = gasto.monto_brl * TASA_CAMBIO;
        // Asegura pagos existe
        if (!gasto.pagos) {
          gasto.pagos = { Patricia: false, Daniela: false, Gonzalo: false };
        }
        td.innerHTML = \`
      <div class="card" tabindex="0" data-index="${index}">
        <div class="card-header">
          <span class="descripcion">${gasto.descripcion} (Pagó: ${gasto.pagadoPor})</span>
          <span class="fecha">${gasto.fecha}</span>
        </div>
        <div class="montos">
          <div class="tabla" role="group" aria-label="Montos">
            <div class="celda-titulo">BRL</div>
            <div class="celda-valor">${fmtBRL(gasto.monto_brl)}</div>
            ${mostrarCLPCheckbox.checked ? \`<div class="celda-titulo">CLP</div><div class="celda-valor">${fmtCLP(montoCLP)}</div>\` : ''}
          </div>
        </div>
        <div class="asignacion">
          ${Object.entries(asignarPartes(gasto))
            .map(([persona, monto]) => \`
              <div class="linea">
                ${persona}: <span class="moneda">${fmtBRL(monto)}</span>
                <button class="btn-pago${gasto.pagos[persona] ? ' paid' : ''}" type="button" data-persona="${persona}" data-index="${index}" aria-label="Marcar como pagado">
                  ${gasto.pagos[persona] ? '✅' : '⬜'}
                </button>
              </div>
            \`).join('')}
          <button class="btn-modificar" data-index="${index}" aria-label="Editar gasto">&#9998;</button>
          <button class="btn-eliminar" data-index="${index}" aria-label="Eliminar gasto">&#128465;</button>
        </div>
        <div class="badge-dividir">${gasto.personas}x</div>
      </div>\`;
        tr.appendChild(td);
        return tr;
      }


      function render() {
        try {
          tablaCuerpo.innerHTML = '';

          const listaFiltrada = filtroFecha.value ? gastos.filter(g => g.fecha === filtroFecha.value) : gastos;

          listaFiltrada.forEach((gasto) => {
            const indiceOriginal = gastos.indexOf(gasto);
            tablaCuerpo.appendChild(crearFicha(gasto, indiceOriginal));
          });

          const totalBRL = listaFiltrada.reduce((acc, g) => acc + g.monto_brl, 0);
          const totalCLP = totalBRL * TASA_CAMBIO;

          // Objeto para almacenar las deudas detalladas. Ej: deudas.Daniela.aPatricia = 100 (Daniela le debe 100 a Patricia)
          const personas = ['Patricia', 'Daniela', 'Gonzalo'];
          const deudas = {};
          personas.forEach(p1 => {
            deudas[p1] = {};
            personas.forEach(p2 => {
              if (p1 !== p2) deudas[p1][\`a${p2}\`] = 0;
            });
          });

          listaFiltrada.forEach(g => {
            if (!g.pagadoPor) return; // Si por alguna razón un gasto viejo no tiene pagador, se omite.

            const partes = asignarPartes(g);
            const pagador = g.pagadoPor;

            for (const deudor in partes) {
              // 'deudor' le debe a 'pagador' si no es la misma persona y no ha pagado su parte.
              if (deudor !== pagador && !g.pagos[deudor]) {
                deudas[deudor][\`a${pagador}\`] += partes[deudor] * TASA_CAMBIO;
              }
            }
          });


          let resumenHTML;
          if (gastos.length === 0) {
            resumenHTML = \`
                    <div class="resumen-grid">
                        <div class="res-card" style="grid-column: 1 / -1; text-align: center;">
                            <div class="res-text">
                                <div class="res-label">Agrega tu primer gasto para comenzar.</div>
                            </div>
                        </div>
                    </div>\`;
          } else {
            resumenHTML = \`
                    <div class="resumen-grid">
                        <div class="res-card">
                            <div class="res-card-line">
                                <div class="res-icon brl">R$</div>
                                <div class="res-text">
                                    <div class="res-label">Total (BRL)</div>
                                    <div class="res-value">${fmtBRL(totalBRL)}</div>
                                </div>
                            </div>
                        </div>
                        <div class="res-card">
                            <div class="res-card-line">
                                <div class="res-icon clp">$</div>
                                <div class="res-text">
                                    <div class="res-label">Total (CLP)</div>
                                    <div class="res-value">${fmtCLP(totalCLP)}</div>
                                </div>
                            </div>
                        </div>
                        <div class="res-card">
                            <div class="desglose-titulo">Matriz de Deudas Pendientes</div>
                            <table class="tabla-deudas">
                                <thead>
                                    <tr>
                                        <th class="header-deudor"></th> <!-- Celda vacía para alinear -->
                                        ${personas.map(p => \`<th>A ${p}</th>\`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${personas.map(deudor => \`
                                        <tr>
                                            <td class="celda-deudor"><strong data-deudor="${deudor}">${deudor} debe:</strong></td>
                                            ${personas.map(acreedor => \`<td>${deudor === acreedor ? '-' : fmtCLP(deudas[deudor][\`a${acreedor}\`] || 0)}</td>\`).join('')}
                                        </tr>
                                    \`).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div class="res-export">
                                <button id="btnDescargarCSV" class="btn-export" type="button">Descargar CSV</button>
                            <button id="btnDescargarJSON" class="btn-export" type="button">Descargar JSON</button>
                        </div>
                    </div>\`;
          }
          totalesDiv.innerHTML = resumenHTML;

        } catch (e) {
          console.error('Error fatal al renderizar la página:', e);
          alert('Ha ocurrido un error crítico. La página puede no funcionar correctamente. Revisa la consola.');
        }
      }

      function guardarYRenderizar() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(gastos));
        } catch (e) {
          console.error('No se pudo guardar en localStorage:', e);
        }
        render();
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        let montoIngresado = parseFloat(form.monto.value);
        let montoEnBRL = montoIngresado;

        if (monedaSelect.value === 'CLP') {
          montoEnBRL = montoIngresado / TASA_CAMBIO;
        }

        const nuevoGasto = {
          descripcion: form.descripcion.value.trim(),
          monto_brl: montoEnBRL,
          fecha: form.fecha.value,
          personas: parseInt(form.personas.value),
          pagadoPor: pagadoPorSelect.value
        };

        if (!nuevoGasto.descripcion || !nuevoGasto.fecha || isNaN(nuevoGasto.monto_brl) || nuevoGasto.monto_brl <= 0) {
          alert('Por favor, completa todos los campos correctamente.');
          return;
        }

        if (idEdicion !== null) {
          // Preserva pagos existentes si existe
          const pagosPrevios = gastos[idEdicion].pagos ? { ...gastos[idEdicion].pagos } : { Patricia: false, Daniela: false, Gonzalo: false };
          gastos[idEdicion] = { ...nuevoGasto, pagos: pagosPrevios };
          idEdicion = null;
        } else {
          gastos.push({ ...nuevoGasto, pagos: { Patricia: false, Daniela: false, Gonzalo: false } });
        }


        guardarYRenderizar();
        form.reset();
        monedaSelect.value = 'BRL'; // Resetear moneda a BRL
        form.fecha.valueAsDate = new Date();
      });

      tablaCuerpo.addEventListener('click', function (e) {
        const btnEditar = e.target.closest('.btn-modificar');
        if (btnEditar) {
          e.preventDefault();
          const index = parseInt(btnEditar.dataset.index, 10);
          const gasto = gastos[index];
          if (gasto) {
            form.descripcion.value = gasto.descripcion;
            form.monto.value = gasto.monto_brl;
            form.fecha.value = gasto.fecha;
            form.personas.value = gasto.personas;
            monedaSelect.value = 'BRL'; // Al editar, siempre mostramos en BRL
            pagadoPorSelect.value = gasto.pagadoPor || 'Patricia'; // Default a Patricia si no existe
            idEdicion = index;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            form.descripcion.focus();
          }
          return;
        }

        const btnEliminar = e.target.closest('.btn-eliminar');
        if (btnEliminar) {
          e.preventDefault();
          const index = parseInt(btnEliminar.dataset.index, 10);
          if (confirm(\`¿Estás seguro de que quieres eliminar el gasto "${gastos[index].descripcion}"?\`)) {
            gastos.splice(index, 1);
            // Si estábamos editando este gasto, cancelamos la edición
            if (idEdicion === index) idEdicion = null;
            guardarYRenderizar();
          }
          return;
        }

        const btnPago = e.target.closest('.btn-pago');
        if (btnPago) {
          e.preventDefault();
          const index = parseInt(btnPago.dataset.index, 10);
          const persona = btnPago.dataset.persona;
          if (gastos[index] && gastos[index].pagos && persona in gastos[index].pagos) {
            gastos[index].pagos[persona] = !gastos[index].pagos[persona];
            guardarYRenderizar();
          }
          return;
        }

        const card = e.target.closest('.card');
        if (card) {
          document.querySelectorAll('#tablaGastos .card.selected').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      });

      // --- DELEGACIÓN DE EVENTOS (MÉTODO ROBUSTO) ---
      totalesDiv.addEventListener('click', function (event) {
        if (event.target.id === 'btnDescargarCSV') {
          descargarCSV();
        }
        if (event.target.id === 'btnDescargarJSON') {
          descargarJSON();
        }

        const deudorStrong = event.target.closest('[data-deudor]');
        if (deudorStrong) {
          const deudorNombre = deudorStrong.dataset.deudor;
          mostrarDetalleDeuda(deudorNombre);
        }
      });

      function mostrarDetalleDeuda(deudor) {
        const detalleContainer = document.getElementById('detalleDeudaContainer');
        const listaFiltrada = filtroFecha.value ? gastos.filter(g => g.fecha === filtroFecha.value) : gastos;

        const deudasDetalladas = listaFiltrada.filter(g =>
          g.pagadoPor !== deudor && !g.pagos[deudor]
        );

        if (deudasDetalladas.length === 0) {
          detalleContainer.style.display = 'none';
          return;
        }

        let html = \`<h3>Detalle de Deudas de ${deudor}</h3><ul id="detalleDeudaLista">\`;
        deudasDetalladas.forEach(gasto => {
          const partes = asignarPartes(gasto);
          const montoDebe = partes[deudor] * TASA_CAMBIO;
          html += \`
            <li>
              <strong>${gasto.descripcion}</strong> (pagado por ${gasto.pagadoPor}): 
              <span style="float: right; font-weight: bold;">${fmtCLP(montoDebe)}</span>
            </li>
          \`;
        });
        html += '</ul>';

        detalleContainer.innerHTML = html;
        detalleContainer.style.display = 'block';
        detalleContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      filtroFecha.addEventListener('change', render);
      btnLimpiarFiltro.addEventListener('click', function () {
        filtroFecha.value = '';
        render();
      });
      mostrarCLPCheckbox.addEventListener('change', render);

      function descargarArchivo(contenido, nombreArchivo, tipoContenido) {
        const blob = new Blob([contenido], { type: tipoContenido });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      function descargarCSV() {
        const listaFiltrada = filtroFecha.value ? gastos.filter(g => g.fecha === filtroFecha.value) : gastos;
        if (listaFiltrada.length === 0) {
          alert('No hay datos para descargar.'); return;
        }
        const headers = ['Descripcion', 'Monto (BRL)', 'Fecha', 'Personas'];
        const rows = listaFiltrada.map(g =>
          [\`"${g.descripcion.replace(/"/g, '""')}"\`, g.monto_brl, g.fecha, g.personas].join(',')
        );
        const csvContent = [headers.join(','), ...rows].join('\\r\\n');
        descargarArchivo(csvContent, 'gastos_viaje.csv', 'text/csv;charset=utf-8;');
      }

      function descargarJSON() {
        if (gastos.length === 0) {
          alert('No hay datos para descargar.'); return;
        }
        const jsonContent = JSON.stringify(gastos, null, 2);
        descargarArchivo(jsonContent, 'gastos_viaje.json', 'application/json;charset=utf-8;');
      }

      // --- Carga inicial de datos y primer renderizado ---
      try {
        const datosGuardados = localStorage.getItem(STORAGE_KEY);
        if (datosGuardados) {
          gastos = JSON.parse(datosGuardados);
          // Migración: asegura que cada gasto tiene .pagos
          gastos.forEach(gasto => {
            if (!gasto.pagos) {
              gasto.pagos = { Patricia: false, Daniela: false, Gonzalo: false };
            }
          });
        }
      } catch (e) {
        console.error('Error al cargar datos desde localStorage:', e);
        gastos = [];
      }


      if (form.fecha) form.fecha.valueAsDate = new Date();
      render();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inicializarApp);
    } else {
      inicializarApp();
    }
  </script>`;

function renderGastos() {
  const container = document.getElementById('gastosContent');
  container.innerHTML = htmlGastosOriginal;

  // Ejecutar el código original después de insertar el HTML
  setTimeout(inicializarGastosOriginal, 0);
}

function inicializarGastosOriginal() {
// --- Variables globales ---
    const STORAGE_KEY = 'gastosViaje';
    const TASA_CAMBIO = 179;
    let gastos = [];
    let idEdicion = null;
    function inicializarApp() {


      // --- Referencias a elementos ---
      const pagadoPorSelect = document.getElementById('pagadoPor');
      const form = document.getElementById('formGasto');
      const tablaCuerpo = document.querySelector('#tablaGastos tbody');
      const filtroFecha = document.getElementById('filtroFecha');
      const btnLimpiarFiltro = document.getElementById('btnLimpiarFiltro');
      const mostrarCLPCheckbox = document.getElementById('mostrarCLP');
      const totalesDiv = document.getElementById('totales');
      const monedaSelect = document.getElementById('moneda');

      // --- Funciones de ayuda ---
      const fmtBRL = v => 'R$ ' + Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const fmtCLP = v => 'CLP$ ' + Math.round(v).toLocaleString('es-CL');

      function asignarPartes(gasto) {
        if (gasto.personas == 3) {
          const parte = gasto.monto_brl / 3;
          return { Patricia: parte, Daniela: parte, Gonzalo: parte };
        } else {
          const parte = gasto.monto_brl / 4;
          return { Patricia: parte, Daniela: parte, Gonzalo: parte * 2 };
        }
      }

      function crearFicha(gasto, index) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        const montoCLP = gasto.monto_brl * TASA_CAMBIO;
        // Asegura pagos existe
        if (!gasto.pagos) {
          gasto.pagos = { Patricia: false, Daniela: false, Gonzalo: false };
        }
        td.innerHTML = `
      <div class="card" tabindex="0" data-index="${index}">
        <div class="card-header">
          <span class="descripcion">${gasto.descripcion} (Pagó: ${gasto.pagadoPor})</span>
          <span class="fecha">${gasto.fecha}</span>
        </div>
        <div class="montos">
          <div class="tabla" role="group" aria-label="Montos">
            <div class="celda-titulo">BRL</div>
            <div class="celda-valor">${fmtBRL(gasto.monto_brl)}</div>
            ${mostrarCLPCheckbox.checked ? `<div class="celda-titulo">CLP</div><div class="celda-valor">${fmtCLP(montoCLP)}</div>` : ''}
          </div>
        </div>
        <div class="asignacion">
          ${Object.entries(asignarPartes(gasto))
            .map(([persona, monto]) => `
              <div class="linea">
                ${persona}: <span class="moneda">${fmtBRL(monto)}</span>
                <button class="btn-pago${gasto.pagos[persona] ? ' paid' : ''}" type="button" data-persona="${persona}" data-index="${index}" aria-label="Marcar como pagado">
                  ${gasto.pagos[persona] ? '✅' : '⬜'}
                </button>
              </div>
            `).join('')}
          <button class="btn-modificar" data-index="${index}" aria-label="Editar gasto">&#9998;</button>
          <button class="btn-eliminar" data-index="${index}" aria-label="Eliminar gasto">&#128465;</button>
        </div>
        <div class="badge-dividir">${gasto.personas}x</div>
      </div>`;
        tr.appendChild(td);
        return tr;
      }


      function render() {
        try {
          tablaCuerpo.innerHTML = '';

          const listaFiltrada = filtroFecha.value ? gastos.filter(g => g.fecha === filtroFecha.value) : gastos;

          listaFiltrada.forEach((gasto) => {
            const indiceOriginal = gastos.indexOf(gasto);
            tablaCuerpo.appendChild(crearFicha(gasto, indiceOriginal));
          });

          const totalBRL = listaFiltrada.reduce((acc, g) => acc + g.monto_brl, 0);
          const totalCLP = totalBRL * TASA_CAMBIO;

          // Objeto para almacenar las deudas detalladas. Ej: deudas.Daniela.aPatricia = 100 (Daniela le debe 100 a Patricia)
          const personas = ['Patricia', 'Daniela', 'Gonzalo'];
          const deudas = {};
          personas.forEach(p1 => {
            deudas[p1] = {};
            personas.forEach(p2 => {
              if (p1 !== p2) deudas[p1][`a${p2}`] = 0;
            });
          });

          listaFiltrada.forEach(g => {
            if (!g.pagadoPor) return; // Si por alguna razón un gasto viejo no tiene pagador, se omite.

            const partes = asignarPartes(g);
            const pagador = g.pagadoPor;

            for (const deudor in partes) {
              // 'deudor' le debe a 'pagador' si no es la misma persona y no ha pagado su parte.
              if (deudor !== pagador && !g.pagos[deudor]) {
                deudas[deudor][`a${pagador}`] += partes[deudor] * TASA_CAMBIO;
              }
            }
          });


          let resumenHTML;
          if (gastos.length === 0) {
            resumenHTML = `
                    <div class="resumen-grid">
                        <div class="res-card" style="grid-column: 1 / -1; text-align: center;">
                            <div class="res-text">
                                <div class="res-label">Agrega tu primer gasto para comenzar.</div>
                            </div>
                        </div>
                    </div>`;
          } else {
            resumenHTML = `
                    <div class="resumen-grid">
                        <div class="res-card">
                            <div class="res-card-line">
                                <div class="res-icon brl">R$</div>
                                <div class="res-text">
                                    <div class="res-label">Total (BRL)</div>
                                    <div class="res-value">${fmtBRL(totalBRL)}</div>
                                </div>
                            </div>
                        </div>
                        <div class="res-card">
                            <div class="res-card-line">
                                <div class="res-icon clp">$</div>
                                <div class="res-text">
                                    <div class="res-label">Total (CLP)</div>
                                    <div class="res-value">${fmtCLP(totalCLP)}</div>
                                </div>
                            </div>
                        </div>
                        <div class="res-card">
                            <div class="desglose-titulo">Matriz de Deudas Pendientes</div>
                            <table class="tabla-deudas">
                                <thead>
                                    <tr>
                                        <th class="header-deudor"></th> <!-- Celda vacía para alinear -->
                                        ${personas.map(p => `<th>A ${p}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${personas.map(deudor => `
                                        <tr>
                                            <td class="celda-deudor"><strong data-deudor="${deudor}">${deudor} debe:</strong></td>
                                            ${personas.map(acreedor => `<td>${deudor === acreedor ? '-' : fmtCLP(deudas[deudor][`a${acreedor}`] || 0)}</td>`).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div class="res-export">
                                <button id="btnDescargarCSV" class="btn-export" type="button">Descargar CSV</button>
                            <button id="btnDescargarJSON" class="btn-export" type="button">Descargar JSON</button>
                        </div>
                    </div>`;
          }
          totalesDiv.innerHTML = resumenHTML;

        } catch (e) {
          console.error('Error fatal al renderizar la página:', e);
          alert('Ha ocurrido un error crítico. La página puede no funcionar correctamente. Revisa la consola.');
        }
      }

      function guardarYRenderizar() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(gastos));
        } catch (e) {
          console.error('No se pudo guardar en localStorage:', e);
        }
        render();
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        let montoIngresado = parseFloat(form.monto.value);
        let montoEnBRL = montoIngresado;

        if (monedaSelect.value === 'CLP') {
          montoEnBRL = montoIngresado / TASA_CAMBIO;
        }

        const nuevoGasto = {
          descripcion: form.descripcion.value.trim(),
          monto_brl: montoEnBRL,
          fecha: form.fecha.value,
          personas: parseInt(form.personas.value),
          pagadoPor: pagadoPorSelect.value
        };

        if (!nuevoGasto.descripcion || !nuevoGasto.fecha || isNaN(nuevoGasto.monto_brl) || nuevoGasto.monto_brl <= 0) {
          alert('Por favor, completa todos los campos correctamente.');
          return;
        }

        if (idEdicion !== null) {
          // Preserva pagos existentes si existe
          const pagosPrevios = gastos[idEdicion].pagos ? { ...gastos[idEdicion].pagos } : { Patricia: false, Daniela: false, Gonzalo: false };
          gastos[idEdicion] = { ...nuevoGasto, pagos: pagosPrevios };
          idEdicion = null;
        } else {
          gastos.push({ ...nuevoGasto, pagos: { Patricia: false, Daniela: false, Gonzalo: false } });
        }


        guardarYRenderizar();
        form.reset();
        monedaSelect.value = 'BRL'; // Resetear moneda a BRL
        form.fecha.valueAsDate = new Date();
      });

      tablaCuerpo.addEventListener('click', function (e) {
        const btnEditar = e.target.closest('.btn-modificar');
        if (btnEditar) {
          e.preventDefault();
          const index = parseInt(btnEditar.dataset.index, 10);
          const gasto = gastos[index];
          if (gasto) {
            form.descripcion.value = gasto.descripcion;
            form.monto.value = gasto.monto_brl;
            form.fecha.value = gasto.fecha;
            form.personas.value = gasto.personas;
            monedaSelect.value = 'BRL'; // Al editar, siempre mostramos en BRL
            pagadoPorSelect.value = gasto.pagadoPor || 'Patricia'; // Default a Patricia si no existe
            idEdicion = index;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            form.descripcion.focus();
          }
          return;
        }

        const btnEliminar = e.target.closest('.btn-eliminar');
        if (btnEliminar) {
          e.preventDefault();
          const index = parseInt(btnEliminar.dataset.index, 10);
          if (confirm(`¿Estás seguro de que quieres eliminar el gasto "${gastos[index].descripcion}"?`)) {
            gastos.splice(index, 1);
            // Si estábamos editando este gasto, cancelamos la edición
            if (idEdicion === index) idEdicion = null;
            guardarYRenderizar();
          }
          return;
        }

        const btnPago = e.target.closest('.btn-pago');
        if (btnPago) {
          e.preventDefault();
          const index = parseInt(btnPago.dataset.index, 10);
          const persona = btnPago.dataset.persona;
          if (gastos[index] && gastos[index].pagos && persona in gastos[index].pagos) {
            gastos[index].pagos[persona] = !gastos[index].pagos[persona];
            guardarYRenderizar();
          }
          return;
        }

        const card = e.target.closest('.card');
        if (card) {
          document.querySelectorAll('#tablaGastos .card.selected').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      });

      // --- DELEGACIÓN DE EVENTOS (MÉTODO ROBUSTO) ---
      totalesDiv.addEventListener('click', function (event) {
        if (event.target.id === 'btnDescargarCSV') {
          descargarCSV();
        }
        if (event.target.id === 'btnDescargarJSON') {
          descargarJSON();
        }

        const deudorStrong = event.target.closest('[data-deudor]');
        if (deudorStrong) {
          const deudorNombre = deudorStrong.dataset.deudor;
          mostrarDetalleDeuda(deudorNombre);
        }
      });

      function mostrarDetalleDeuda(deudor) {
        const detalleContainer = document.getElementById('detalleDeudaContainer');
        const listaFiltrada = filtroFecha.value ? gastos.filter(g => g.fecha === filtroFecha.value) : gastos;

        const deudasDetalladas = listaFiltrada.filter(g =>
          g.pagadoPor !== deudor && !g.pagos[deudor]
        );

        if (deudasDetalladas.length === 0) {
          detalleContainer.style.display = 'none';
          return;
        }

        let html = `<h3>Detalle de Deudas de ${deudor}</h3><ul id="detalleDeudaLista">`;
        deudasDetalladas.forEach(gasto => {
          const partes = asignarPartes(gasto);
          const montoDebe = partes[deudor] * TASA_CAMBIO;
          html += `
            <li>
              <strong>${gasto.descripcion}</strong> (pagado por ${gasto.pagadoPor}): 
              <span style="float: right; font-weight: bold;">${fmtCLP(montoDebe)}</span>
            </li>
          `;
        });
        html += '</ul>';

        detalleContainer.innerHTML = html;
        detalleContainer.style.display = 'block';
        detalleContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      filtroFecha.addEventListener('change', render);
      btnLimpiarFiltro.addEventListener('click', function () {
        filtroFecha.value = '';
        render();
      });
      mostrarCLPCheckbox.addEventListener('change', render);

      function descargarArchivo(contenido, nombreArchivo, tipoContenido) {
        const blob = new Blob([contenido], { type: tipoContenido });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      function descargarCSV() {
        const listaFiltrada = filtroFecha.value ? gastos.filter(g => g.fecha === filtroFecha.value) : gastos;
        if (listaFiltrada.length === 0) {
          alert('No hay datos para descargar.'); return;
        }
        const headers = ['Descripcion', 'Monto (BRL)', 'Fecha', 'Personas'];
        const rows = listaFiltrada.map(g =>
          [`"${g.descripcion.replace(/"/g, '""')}"`, g.monto_brl, g.fecha, g.personas].join(',')
        );
        const csvContent = [headers.join(','), ...rows].join('\r\n');
        descargarArchivo(csvContent, 'gastos_viaje.csv', 'text/csv;charset=utf-8;');
      }

      function descargarJSON() {
        if (gastos.length === 0) {
          alert('No hay datos para descargar.'); return;
        }
        const jsonContent = JSON.stringify(gastos, null, 2);
        descargarArchivo(jsonContent, 'gastos_viaje.json', 'application/json;charset=utf-8;');
      }

      // --- Carga inicial de datos y primer renderizado ---
      try {
        const datosGuardados = localStorage.getItem(STORAGE_KEY);
        if (datosGuardados) {
          gastos = JSON.parse(datosGuardados);
          // Migración: asegura que cada gasto tiene .pagos
          gastos.forEach(gasto => {
            if (!gasto.pagos) {
              gasto.pagos = { Patricia: false, Daniela: false, Gonzalo: false };
            }
          });
        }
      } catch (e) {
        console.error('Error al cargar datos desde localStorage:', e);
        gastos = [];
      }


      if (form.fecha) form.fecha.valueAsDate = new Date();
      render();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inicializarApp);
    } else {
      inicializarApp();
    }
}