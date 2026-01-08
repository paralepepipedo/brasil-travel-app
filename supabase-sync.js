// =====================================================
// SUPABASE-SYNC.JS - Sincronización offline-first CORREGIDA
// =====================================================

// 🔧 CONFIGURACIÓN
const SUPABASE_URL = 'https://lpspcmwxallshngaggmw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_d96GjwG17EM1jBNXupW0rQ_EVzmEES0';

let supabaseClient = null;
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

let syncState = {
  online: navigator.onLine,
  syncing: false,
  lastSync: null,
  pendingChanges: 0
};

// =====================================================
// INICIALIZACIÓN
// =====================================================
async function initSupabase() {
  try {
    if (!window.supabase || !window.supabase.createClient) {
      console.error('❌ Supabase SDK no está disponible');
      return false;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase cliente inicializado');

    window.addEventListener('online', () => {
      syncState.online = true;
      console.log('✅ Conexión restaurada - iniciando sync');
      syncAll();
    });

    window.addEventListener('offline', () => {
      syncState.online = false;
      console.log('🔴 Sin conexión - modo offline');
    });

    setInterval(() => {
      if (syncState.online && syncState.pendingChanges > 0) {
        syncAll();
      }
    }, 5 * 60 * 1000);

    return true;
  } catch (e) {
    console.error('Error inicializando Supabase:', e);
    return false;
  }
}

// =====================================================
// SINCRONIZACIÓN COMPLETA (BIDIRECCIONAL)
// =====================================================
async function syncAll() {
  if (!syncState.online || syncState.syncing || !supabaseClient) return;

  syncState.syncing = true;
  updateSyncUI('Sincronizando...');

  try {
    await uploadPendingChanges();
    await downloadUpdates();

    syncState.lastSync = new Date();
    syncState.pendingChanges = 0;
    localStorage.setItem('lastSync', syncState.lastSync.toISOString());

    updateSyncUI('✅ Sincronizado');
    setTimeout(() => updateSyncUI(''), 3000);

  } catch (e) {
    console.error('Error en sync:', e);
    updateSyncUI('⚠️ Error al sincronizar');
  } finally {
    syncState.syncing = false;
  }
}

// =====================================================
// SUBIR CAMBIOS LOCALES → SUPABASE
// =====================================================
async function uploadPendingChanges() {
  if (!supabaseClient) return;

  const localData = getAllLocalData();

  // ✅ GASTOS - Verificar duplicados antes de subir
  if (localData.gastos.length > 0) {
    // Primero, obtener IDs existentes en Supabase
    const { data: gastosExistentes } = await supabaseClient
      .from('gastos')
      .select('id')
      .eq('user_id', DEFAULT_USER_ID);

    const idsExistentes = new Set((gastosExistentes || []).map(g => String(g.id)));

    const gastosValidos = localData.gastos
      .filter(g => {
        if (!g.id || !g.descripcion || g.monto_brl == null || isNaN(parseFloat(g.monto_brl)) || !g.fecha) {
          return false;
        }
        // Filtrar gastos fijos (datos de ejemplo) para que no se suban
        if (g.fijo) return false;

        return true;
      })
      .map(g => ({
        id: String(g.id),
        user_id: DEFAULT_USER_ID,
        descripcion: g.descripcion,
        monto_brl: parseFloat(g.monto_brl),
        moneda: g.moneda || 'BRL',
        monto_original: g.monto_original ? parseFloat(g.monto_original) : null,
        fecha: g.fecha,
        personas: g.personas || 3,
        pagado_por: g.pagadoPor || 'Patricia',
        pagos: g.pagos || {},
        fijo: false
      }));

    if (gastosValidos.length > 0) {
      const { error } = await supabaseClient.from('gastos').upsert(gastosValidos, { onConflict: 'id' });
      if (error) console.error('Error subiendo gastos:', error);
      else console.log(`✅ ${gastosValidos.length} gastos sincronizados`);
    }
  }

  // ✅ COMPRAS
  if (localData.compras.length > 0) {
    const comprasValidas = localData.compras
      .filter(c => c.id && c.articulo)
      .map(c => ({
        id: String(c.id),
        user_id: DEFAULT_USER_ID,
        articulo: c.articulo,
        cantidad: c.cantidad || 1,
        categoria: c.categoria || 'Otros',
        notas: c.notas || '',
        comprado: c.comprado || false,
        precio: c.precio ? parseFloat(c.precio) : null
      }));

    if (comprasValidas.length > 0) {
      const { error } = await supabaseClient.from('compras').upsert(comprasValidas, { onConflict: 'id' });
      if (error) console.error('Error subiendo compras:', error);
      else console.log(`✅ ${comprasValidas.length} compras sincronizadas`);
    }
  }

  // ✅ ATRACCIONES
  if (localData.atracciones.length > 0) {
    const atraccionesValidas = localData.atracciones
      .filter(a => a.id && a.nombre)
      .map(a => ({
        id: String(a.id),
        user_id: DEFAULT_USER_ID,
        nombre: a.nombre,
        categoria: a.categoria || 'otro',
        direccion: a.direccion || '',
        coordenadas: a.maps || '',
        precio_brl: a.precioBRL ? parseFloat(a.precioBRL) : null,
        horario: '',
        rating: a.rating || 0,
        notas: a.notas || '',
        visitado: a.visitado || false,
        fecha_visita: a.fechaVisita || null,
        imagen_url: (a.imagenes && a.imagenes[0]) || ''
      }));

    if (atraccionesValidas.length > 0) {
      const { error } = await supabaseClient.from('atracciones').upsert(atraccionesValidas, { onConflict: 'id' });
      if (error) console.error('Error subiendo atracciones:', error);
      else console.log(`✅ ${atraccionesValidas.length} atracciones sincronizadas`);
    }
  }

  // ✅ DOCUMENTOS
  if (localData.documentos && localData.documentos.length > 0) {
    const documentosValidos = localData.documentos
      .filter(d => d.id && d.titulo && d.archivo)
      .map(d => ({
        id: String(d.id),
        user_id: DEFAULT_USER_ID,
        categoria: d.categoria,
        titulo: d.titulo,
        descripcion: d.descripcion || '',
        fecha_evento: d.fechaEvento || null,
        recordatorio: d.recordatorio || { activo: false },
        etiquetas: d.etiquetas || [],
        notas: d.notas || '',
        archivo_nombre: d.archivo.nombre,
        archivo_tipo: d.archivo.tipo,
        archivo_data: d.archivo.data,
        fecha_creacion: d.fechaCreacion
      }));

    if (documentosValidos.length > 0) {
      const { error } = await supabaseClient.from('documentos').upsert(documentosValidos, { onConflict: 'id' });
      if (error) console.error('Error subiendo documentos:', error);
      else console.log(`✅ ${documentosValidos.length} documentos sincronizados`);
    }
  }

  // ✅ ALOJAMIENTO - Tabla dedicada
  if (localData.alojamiento) {
    const alojamientoData = {
      user_id: DEFAULT_USER_ID,
      nombre: localData.alojamiento.nombre,
      direccion: localData.alojamiento.direccion || '',
      maps: localData.alojamiento.maps || '',
      checkin: localData.alojamiento.checkin,
      checkout: localData.alojamiento.checkout,
      noches: localData.alojamiento.noches || 0,
      precio_total: localData.alojamiento.precioTotal || null,
      precio_noche: localData.alojamiento.precioNoche || null,
      division: localData.alojamiento.division || '3',
      rating: localData.alojamiento.rating || 0,
      notas: localData.alojamiento.notas || ''
    };

    const { error } = await supabaseClient
      .from('alojamiento')
      .upsert(alojamientoData, { onConflict: 'user_id' });

    if (error) console.error('❌ Error subiendo alojamiento:', error);
    else console.log('✅ Alojamiento sincronizado');
  }

  // ✅ VUELOS - Tabla dedicada
  if (localData.vuelos) {
    // Vuelo de Ida
    if (localData.vuelos.ida) {
      const vueloIda = {
        user_id: DEFAULT_USER_ID,
        tipo: 'ida',
        aerolinea: localData.vuelos.ida.aerolinea,
        numero_vuelo: localData.vuelos.ida.numeroVuelo,
        codigo_reserva: localData.vuelos.ida.codigoReserva || '',
        origen: localData.vuelos.ida.origen,
        destino: localData.vuelos.ida.destino,
        fecha_salida: localData.vuelos.ida.fechaSalida,
        fecha_llegada: localData.vuelos.ida.fechaLlegada,
        terminal: localData.vuelos.ida.terminal || '',
        puerta: localData.vuelos.ida.puerta || '',
        asientos: localData.vuelos.ida.asientos || [],
        equipaje: localData.vuelos.ida.equipaje || '',
        notas: localData.vuelos.ida.notas || '',
        archivo: localData.vuelos.ida.archivo || null
      };

      const { error } = await supabaseClient
        .from('vuelos')
        .upsert(vueloIda, { onConflict: 'user_id,tipo' });

      if (error) console.error('❌ Error subiendo vuelo ida:', error);
      else console.log('✅ Vuelo ida sincronizado');
    }

    // Vuelo de Regreso
    if (localData.vuelos.regreso) {
      const vueloRegreso = {
        user_id: DEFAULT_USER_ID,
        tipo: 'regreso',
        aerolinea: localData.vuelos.regreso.aerolinea,
        numero_vuelo: localData.vuelos.regreso.numeroVuelo,
        codigo_reserva: localData.vuelos.regreso.codigoReserva || '',
        origen: localData.vuelos.regreso.origen,
        destino: localData.vuelos.regreso.destino,
        fecha_salida: localData.vuelos.regreso.fechaSalida,
        fecha_llegada: localData.vuelos.regreso.fechaLlegada,
        terminal: localData.vuelos.regreso.terminal || '',
        puerta: localData.vuelos.regreso.puerta || '',
        asientos: localData.vuelos.regreso.asientos || [],
        equipaje: localData.vuelos.regreso.equipaje || '',
        notas: localData.vuelos.regreso.notas || '',
        archivo: localData.vuelos.regreso.archivo || null
      };

      const { error } = await supabaseClient
        .from('vuelos')
        .upsert(vueloRegreso, { onConflict: 'user_id,tipo' });

      if (error) console.error('❌ Error subiendo vuelo regreso:', error);
      else console.log('✅ Vuelo regreso sincronizado');
    }
  }

  // ✅ ITINERARIO - Tabla dedicada
  if (localData.itinerario && localData.itinerario.length > 0) {
    for (const dia of localData.itinerario) {
      const itinerarioData = {
        user_id: DEFAULT_USER_ID,
        fecha: dia.fecha,
        actividades: dia.actividades
      };

      const { error } = await supabaseClient
        .from('itinerario')
        .upsert(itinerarioData, { onConflict: 'user_id,fecha' });

      if (error) console.error(`❌ Error subiendo itinerario ${dia.fecha}:`, error);
    }
    console.log(`✅ ${localData.itinerario.length} días de itinerario sincronizados`);
  }

  // ✅ TASA DE CAMBIO en app_config (solo esto va aquí ahora)
  const appConfigData = {
    user_id: DEFAULT_USER_ID,
    tasa_cambio: localData.tasaCambio || 150
  };

  const { error: configError } = await supabaseClient
    .from('app_config')
    .upsert(appConfigData, { onConflict: 'user_id' });

  if (configError) console.error('❌ Error subiendo tasa cambio:', configError);
  else console.log('✅ Tasa cambio sincronizada');
}

// =====================================================
// DESCARGAR ACTUALIZACIONES SUPABASE → LOCAL
// =====================================================
async function downloadUpdates() {
  if (!supabaseClient) return;

  console.log('📥 Descargando actualizaciones desde Supabase...');

  // Gastos
  const { data: gastos } = await supabaseClient.from('gastos').select('*').eq('user_id', DEFAULT_USER_ID);
  console.log(`📥 Gastos descargados: ${gastos?.length || 0}`);

  // Compras
  const { data: compras } = await supabaseClient.from('compras').select('*').eq('user_id', DEFAULT_USER_ID);
  console.log(`📥 Compras descargadas: ${compras?.length || 0}`);

  // Atracciones
  const { data: atracciones } = await supabaseClient.from('atracciones').select('*').eq('user_id', DEFAULT_USER_ID);
  console.log(`📥 Atracciones descargadas: ${atracciones?.length || 0}`);

  // Documentos
  const { data: documentos } = await supabaseClient.from('documentos').select('*').eq('user_id', DEFAULT_USER_ID);
  console.log(`📥 Documentos descargados: ${documentos?.length || 0}`);

  // Alojamiento
  const { data: alojamiento } = await supabaseClient.from('alojamiento').select('*').eq('user_id', DEFAULT_USER_ID).single();
  console.log(`📥 Alojamiento descargado:`, alojamiento?.nombre || 'sin datos');

  // Vuelos
  const { data: vuelos } = await supabaseClient.from('vuelos').select('*').eq('user_id', DEFAULT_USER_ID);
  const vueloIda = vuelos?.find(v => v.tipo === 'ida') || null;
  const vueloRegreso = vuelos?.find(v => v.tipo === 'regreso') || null;
  console.log(`📥 Vuelos descargados: Ida=${vueloIda?.numero_vuelo || 'sin datos'}, Regreso=${vueloRegreso?.numero_vuelo || 'sin datos'}`);

  // Itinerario
  const { data: itinerario } = await supabaseClient.from('itinerario').select('*').eq('user_id', DEFAULT_USER_ID).order('fecha');
  console.log(`📥 Itinerario descargado: ${itinerario?.length || 0} días`);

  // Tasa de cambio
  const { data: appConfig } = await supabaseClient.from('app_config').select('tasa_cambio').eq('user_id', DEFAULT_USER_ID).single();
  console.log(`📥 Tasa cambio: ${appConfig?.tasa_cambio || 150}`);

  // Guardar gastos en localStorage (filtrar duplicados)
  if (gastos && gastos.length > 0) {
    const gastosLocal = gastos
      .filter(g => !g.fijo) // No guardar datos de ejemplo
      .map(g => ({
        id: g.id,
        descripcion: g.descripcion,
        monto_brl: parseFloat(g.monto_brl),
        moneda: g.moneda,
        monto_original: g.monto_original ? parseFloat(g.monto_original) : null,
        fecha: g.fecha,
        personas: g.personas,
        pagadoPor: g.pagado_por,
        pagos: g.pagos || {},
        fijo: false
      }));

    // Eliminar duplicados por ID
    const gastosUnicos = Array.from(
      new Map(gastosLocal.map(g => [g.id, g])).values()
    );

    localStorage.setItem('gastosViaje', JSON.stringify(gastosUnicos));
  }

  // Guardar todo en brasilTravelApp
  const datosApp = {
    alojamiento: alojamiento ? {
      nombre: alojamiento.nombre,
      direccion: alojamiento.direccion,
      maps: alojamiento.maps,
      checkin: alojamiento.checkin,
      checkout: alojamiento.checkout,
      noches: alojamiento.noches,
      precioTotal: alojamiento.precio_total,
      precioNoche: alojamiento.precio_noche,
      division: alojamiento.division,
      rating: alojamiento.rating,
      notas: alojamiento.notas
    } : null,
    compras: (compras || []).map(c => ({
      id: c.id,
      articulo: c.articulo,
      cantidad: c.cantidad,
      categoria: c.categoria,
      notas: c.notas,
      comprado: c.comprado,
      precio: c.precio
    })),
    atracciones: (atracciones || []).map(a => ({
      id: a.id,
      nombre: a.nombre,
      categoria: a.categoria,
      direccion: a.direccion,
      maps: a.coordenadas,
      precioBRL: a.precio_brl,
      rating: a.rating,
      notas: a.notas,
      visitado: a.visitado,
      fechaVisita: a.fecha_visita,
      imagenes: a.imagen_url ? [a.imagen_url] : []
    })),
    documentos: (documentos || []).map(d => ({
      id: d.id,
      categoria: d.categoria,
      titulo: d.titulo,
      descripcion: d.descripcion,
      fechaEvento: d.fecha_evento,
      recordatorio: d.recordatorio,
      etiquetas: d.etiquetas,
      notas: d.notas,
      archivo: {
        nombre: d.archivo_nombre,
        tipo: d.archivo_tipo,
        data: d.archivo_data
      },
      fechaCreacion: d.fecha_creacion
    })),
    vuelos: {
      ida: vueloIda ? {
        aerolinea: vueloIda.aerolinea,
        numeroVuelo: vueloIda.numero_vuelo,
        codigoReserva: vueloIda.codigo_reserva,
        origen: vueloIda.origen,
        destino: vueloIda.destino,
        fechaSalida: vueloIda.fecha_salida,
        fechaLlegada: vueloIda.fecha_llegada,
        terminal: vueloIda.terminal,
        puerta: vueloIda.puerta,
        asientos: vueloIda.asientos,
        equipaje: vueloIda.equipaje,
        notas: vueloIda.notas,
        archivo: vueloIda.archivo
      } : null,
      regreso: vueloRegreso ? {
        aerolinea: vueloRegreso.aerolinea,
        numeroVuelo: vueloRegreso.numero_vuelo,
        codigoReserva: vueloRegreso.codigo_reserva,
        origen: vueloRegreso.origen,
        destino: vueloRegreso.destino,
        fechaSalida: vueloRegreso.fecha_salida,
        fechaLlegada: vueloRegreso.fecha_llegada,
        terminal: vueloRegreso.terminal,
        puerta: vueloRegreso.puerta,
        asientos: vueloRegreso.asientos,
        equipaje: vueloRegreso.equipaje,
        notas: vueloRegreso.notas,
        archivo: vueloRegreso.archivo
      } : null
    },
    tasaCambio: appConfig?.tasa_cambio || 150,
    itinerario: (itinerario || []).map(i => ({
      fecha: i.fecha,
      actividades: i.actividades
    })),
    configuracion: { tasaCambio: appConfig?.tasa_cambio || 150 }
  };

  localStorage.setItem('brasilTravelApp', JSON.stringify(datosApp));
  console.log('✅ Datos guardados en localStorage');

  // Recargar UI
  if (typeof actualizarDashboard === 'function') actualizarDashboard();
  if (typeof renderizarAtracciones === 'function') renderizarAtracciones();
  if (typeof renderizarCompras === 'function') renderizarCompras();
  if (typeof cargarAlojamiento === 'function') cargarAlojamiento();
  if (typeof inicializarVuelos === 'function') inicializarVuelos();
  if (typeof cargarActividades === 'function') cargarActividades();

  // ✅ NUEVO: Recargar gastos desde localStorage
  if (typeof cargarDatosIniciales === 'function') {
    console.log('🔄 Recargando gastos después de sincronizar...');
    cargarDatosIniciales();
  }
}

// =====================================================
// HELPERS
// =====================================================
function getAllLocalData() {
  const gastosRaw = localStorage.getItem('gastosViaje') || '[]';
  const appRaw = localStorage.getItem('brasilTravelApp') || '{}';

  let gastos = [];
  let app = {};

  try {
    gastos = JSON.parse(gastosRaw);
  } catch (e) {
    console.error('Error parseando gastos:', e);
    gastos = [];
  }

  try {
    app = JSON.parse(appRaw);
  } catch (e) {
    console.error('Error parseando app:', e);
    app = {};
  }

  return {
    gastos: gastos || [],
    compras: app.compras || [],
    atracciones: app.atracciones || [],
    vuelos: app.vuelos || { ida: null, regreso: null },
    documentos: app.documentos || [],
    itinerario: app.itinerario || [],
    alojamiento: app.alojamiento || null,
    tasaCambio: app.tasaCambio || app.configuracion?.tasaCambio || 150
  };
}

function updateSyncUI(message) {
  const indicator = document.getElementById('syncIndicator');
  if (indicator) {
    indicator.textContent = message;
    indicator.style.display = message ? 'inline' : 'none';
  }
}

function markPendingChanges() {
  syncState.pendingChanges++;

  if (syncState.online && !syncState.syncing) {
    setTimeout(syncAll, 1000);
  }
}

// Exportar funciones
window.SupabaseSync = {
  init: initSupabase,
  sync: syncAll,
  markPending: markPendingChanges,
  state: syncState
};

console.log('✅ supabase-sync.js cargado (versión corregida con tablas dedicadas)');