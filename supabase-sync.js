// =====================================================
// SUPABASE-SYNC.JS - Sincronización offline-first CORREGIDA
// FLUJO: Descarga → Merge → Sube
// =====================================================

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
// SINCRONIZACIÓN COMPLETA (FLUJO CORREGIDO)
// =====================================================
async function syncAll() {
  if (!syncState.online || syncState.syncing || !supabaseClient) return;

  syncState.syncing = true;
  updateSyncUI('Sincronizando...');

  try {
    // ✅ CAMBIO CRÍTICO: Primero descargar, luego merge, luego subir
    console.log('🔄 PASO 1: Descargando datos de Supabase...');
    const datosRemoto = await downloadFromSupabase();

    console.log('🔄 PASO 2: Haciendo merge con datos locales...');
    const datosMergeados = mergeLocalAndRemote(datosRemoto);

    console.log('🔄 PASO 3: Subiendo datos completos...');
    await uploadMergedData(datosMergeados);

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
// DESCARGAR DATOS DE SUPABASE
// =====================================================
async function downloadFromSupabase() {
  console.log('📥 Descargando desde Supabase...');

  const [gastos, compras, atracciones, documentos, alojamiento, vuelos, itinerario, appConfig] = await Promise.all([
    supabaseClient.from('gastos').select('*').eq('user_id', DEFAULT_USER_ID),
    supabaseClient.from('compras').select('*').eq('user_id', DEFAULT_USER_ID),
    supabaseClient.from('atracciones').select('*').eq('user_id', DEFAULT_USER_ID),
    supabaseClient.from('documentos').select('*').eq('user_id', DEFAULT_USER_ID),
    supabaseClient.from('alojamiento').select('*').eq('user_id', DEFAULT_USER_ID).single(),
    supabaseClient.from('vuelos').select('*').eq('user_id', DEFAULT_USER_ID),
    supabaseClient.from('itinerario').select('*').eq('user_id', DEFAULT_USER_ID).order('fecha'),
    supabaseClient.from('app_config').select('tasa_cambio').eq('user_id', DEFAULT_USER_ID).single()
  ]);

  console.log(`📥 Gastos: ${gastos.data?.length || 0}`);
  console.log(`📥 Itinerario: ${itinerario.data?.length || 0} días`);

  return {
    gastos: gastos.data || [],
    compras: compras.data || [],
    atracciones: atracciones.data || [],
    documentos: documentos.data || [],
    alojamiento: alojamiento.data || null,
    vuelos: {
      ida: vuelos.data?.find(v => v.tipo === 'ida') || null,
      regreso: vuelos.data?.find(v => v.tipo === 'regreso') || null
    },
    itinerario: itinerario.data || [],
    tasaCambio: appConfig.data?.tasa_cambio || 150
  };
}

// =====================================================
// MERGE INTELIGENTE: LOCAL + REMOTO
// =====================================================
function mergeLocalAndRemote(remoto) {
  const local = getAllLocalData();

  console.log('🔄 Merging datos...');
  console.log('  📱 Local - Itinerario:', local.itinerario.length, 'días');
  console.log('  ☁️ Remoto - Itinerario:', remoto.itinerario.length, 'días');

  // Merge de itinerario por fecha (más actividades gana)
  const itinerarioMergeado = mergeItinerario(local.itinerario, remoto.itinerario);

  console.log('  ✅ Mergeado - Itinerario:', itinerarioMergeado.length, 'días');

  return {
    gastos: mergeArrayById(local.gastos, remoto.gastos),
    compras: mergeArrayById(local.compras, remoto.compras),
    atracciones: mergeArrayById(local.atracciones, remoto.atracciones),
    documentos: mergeArrayById(local.documentos, remoto.documentos),
    alojamiento: remoto.alojamiento || local.alojamiento,
    vuelos: {
      ida: remoto.vuelos.ida || local.vuelos.ida,
      regreso: remoto.vuelos.regreso || local.vuelos.regreso
    },
    itinerario: itinerarioMergeado,
    tasaCambio: remoto.tasaCambio || local.tasaCambio || 150
  };
}

// =====================================================
// MERGE DE ITINERARIO (CLAVE PARA RESOLVER TU PROBLEMA)
// =====================================================
function mergeItinerario(localDias, remotoDias) {
  const diasPorFecha = new Map();

  // Agregar días remotos primero
  remotoDias.forEach(diaRemoto => {
    diasPorFecha.set(diaRemoto.fecha, {
      fecha: diaRemoto.fecha,
      actividades: diaRemoto.actividades || []
    });
  });

  // Merge con días locales
  localDias.forEach(diaLocal => {
    const diaExistente = diasPorFecha.get(diaLocal.fecha);

    if (!diaExistente) {
      // Día solo existe local, agregarlo
      diasPorFecha.set(diaLocal.fecha, {
        fecha: diaLocal.fecha,
        actividades: diaLocal.actividades || []
      });
    } else {
      // Día existe en ambos: el que tenga MÁS actividades gana
      const actividadesLocal = diaLocal.actividades || [];
      const actividadesRemoto = diaExistente.actividades || [];

      if (actividadesLocal.length > actividadesRemoto.length) {
        console.log(`  🔄 ${diaLocal.fecha}: usando versión local (${actividadesLocal.length} > ${actividadesRemoto.length})`);
        diasPorFecha.set(diaLocal.fecha, {
          fecha: diaLocal.fecha,
          actividades: actividadesLocal
        });
      } else if (actividadesLocal.length < actividadesRemoto.length) {
        console.log(`  🔄 ${diaLocal.fecha}: usando versión remota (${actividadesRemoto.length} > ${actividadesLocal.length})`);
        // Ya está en el Map
      } else {
        // Mismo número: merge por ID de actividad
        const actividadesMergeadas = mergeActividadesPorId(actividadesLocal, actividadesRemoto);
        diasPorFecha.set(diaLocal.fecha, {
          fecha: diaLocal.fecha,
          actividades: actividadesMergeadas
        });
      }
    }
  });

  return Array.from(diasPorFecha.values()).sort((a, b) =>
    new Date(a.fecha) - new Date(b.fecha)
  );
}

function mergeActividadesPorId(actividadesLocal, actividadesRemoto) {
  const actividadesPorId = new Map();

  actividadesRemoto.forEach(act => actividadesPorId.set(act.id, act));
  actividadesLocal.forEach(act => actividadesPorId.set(act.id, act));

  return Array.from(actividadesPorId.values());
}

// =====================================================
// SUBIR DATOS MERGEADOS
// =====================================================
async function uploadMergedData(datos) {
  // Gastos
  if (datos.gastos.length > 0) {
    const gastosValidos = datos.gastos
      .filter(g => !g.fijo && g.id && g.descripcion && g.monto_brl != null)
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

  // Compras
  if (datos.compras.length > 0) {
    const comprasValidas = datos.compras
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

  // Atracciones
  if (datos.atracciones.length > 0) {
    const atraccionesValidas = datos.atracciones
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

  // Documentos
  if (datos.documentos && datos.documentos.length > 0) {
    const documentosValidos = datos.documentos
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

  // Alojamiento
  if (datos.alojamiento) {
    const alojamientoData = {
      user_id: DEFAULT_USER_ID,
      nombre: datos.alojamiento.nombre,
      direccion: datos.alojamiento.direccion || '',
      maps: datos.alojamiento.maps || '',
      checkin: datos.alojamiento.checkin,
      checkout: datos.alojamiento.checkout,
      noches: datos.alojamiento.noches || 0,
      precio_total: datos.alojamiento.precioTotal || null,
      precio_noche: datos.alojamiento.precioNoche || null,
      division: datos.alojamiento.division || '3',
      rating: datos.alojamiento.rating || 0,
      notas: datos.alojamiento.notas || ''
    };

    const { error } = await supabaseClient.from('alojamiento').upsert(alojamientoData, { onConflict: 'user_id' });
    if (error) console.error('Error subiendo alojamiento:', error);
    else console.log('✅ Alojamiento sincronizado');
  }

  // Vuelos
  if (datos.vuelos.ida) {
    const vueloIda = {
      user_id: DEFAULT_USER_ID,
      tipo: 'ida',
      aerolinea: datos.vuelos.ida.aerolinea,
      numero_vuelo: datos.vuelos.ida.numeroVuelo,
      codigo_reserva: datos.vuelos.ida.codigoReserva || '',
      origen: datos.vuelos.ida.origen,
      destino: datos.vuelos.ida.destino,
      fecha_salida: datos.vuelos.ida.fechaSalida,
      fecha_llegada: datos.vuelos.ida.fechaLlegada,
      terminal: datos.vuelos.ida.terminal || '',
      puerta: datos.vuelos.ida.puerta || '',
      asientos: datos.vuelos.ida.asientos || [],
      equipaje: datos.vuelos.ida.equipaje || '',
      notas: datos.vuelos.ida.notas || '',
      archivo: datos.vuelos.ida.archivo || null
    };

    const { error } = await supabaseClient.from('vuelos').upsert(vueloIda, { onConflict: 'user_id,tipo' });
    if (error) console.error('Error subiendo vuelo ida:', error);
    else console.log('✅ Vuelo ida sincronizado');
  }

  if (datos.vuelos.regreso) {
    const vueloRegreso = {
      user_id: DEFAULT_USER_ID,
      tipo: 'regreso',
      aerolinea: datos.vuelos.regreso.aerolinea,
      numero_vuelo: datos.vuelos.regreso.numeroVuelo,
      codigo_reserva: datos.vuelos.regreso.codigoReserva || '',
      origen: datos.vuelos.regreso.origen,
      destino: datos.vuelos.regreso.destino,
      fecha_salida: datos.vuelos.regreso.fechaSalida,
      fecha_llegada: datos.vuelos.regreso.fechaLlegada,
      terminal: datos.vuelos.regreso.terminal || '',
      puerta: datos.vuelos.regreso.puerta || '',
      asientos: datos.vuelos.regreso.asientos || [],
      equipaje: datos.vuelos.regreso.equipaje || '',
      notas: datos.vuelos.regreso.notas || '',
      archivo: datos.vuelos.regreso.archivo || null
    };

    const { error } = await supabaseClient.from('vuelos').upsert(vueloRegreso, { onConflict: 'user_id,tipo' });
    if (error) console.error('Error subiendo vuelo regreso:', error);
    else console.log('✅ Vuelo regreso sincronizado');
  }

  // Itinerario
  if (datos.itinerario && datos.itinerario.length > 0) {
    console.log(`📤 Subiendo ${datos.itinerario.length} días de itinerario...`);

    for (const dia of datos.itinerario) {
      const itinerarioData = {
        user_id: DEFAULT_USER_ID,
        fecha: dia.fecha,
        actividades: dia.actividades
      };

      const { error } = await supabaseClient.from('itinerario').upsert(itinerarioData, { onConflict: 'user_id,fecha' });
      if (error) console.error(`Error subiendo ${dia.fecha}:`, error);
      else console.log(`✅ ${dia.fecha}: ${dia.actividades.length} actividades`);
    }
  }

  // Tasa de cambio
  const appConfigData = {
    user_id: DEFAULT_USER_ID,
    tasa_cambio: datos.tasaCambio || 150
  };

  const { error: configError } = await supabaseClient.from('app_config').upsert(appConfigData, { onConflict: 'user_id' });
  if (configError) console.error('Error subiendo tasa cambio:', configError);
  else console.log('✅ Tasa cambio sincronizada');

  // Guardar datos mergeados en localStorage
  saveToLocalStorage(datos);
}

// =====================================================
// GUARDAR EN LOCALSTORAGE
// =====================================================
function saveToLocalStorage(datos) {
  // Gastos por separado
  if (datos.gastos.length > 0) {
    const gastosLocal = datos.gastos
      .filter(g => !g.fijo)
      .map(g => ({
        id: g.id,
        descripcion: g.descripcion,
        monto_brl: parseFloat(g.monto_brl),
        moneda: g.moneda,
        monto_original: g.monto_original ? parseFloat(g.monto_original) : null,
        fecha: g.fecha,
        personas: g.personas,
        pagadoPor: g.pagadoPor,
        pagos: g.pagos || {},
        fijo: false
      }));

    const gastosUnicos = Array.from(new Map(gastosLocal.map(g => [g.id, g])).values());
    localStorage.setItem('gastosViaje', JSON.stringify(gastosUnicos));
  }

  // App completa
  const datosApp = {
    alojamiento: datos.alojamiento,
    compras: datos.compras,
    atracciones: datos.atracciones,
    documentos: datos.documentos,
    vuelos: datos.vuelos,
    tasaCambio: datos.tasaCambio,
    itinerario: datos.itinerario,
    configuracion: { tasaCambio: datos.tasaCambio }
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
}

// =====================================================
// HELPERS
// =====================================================
function getAllLocalData() {
  const gastosRaw = localStorage.getItem('gastosViaje') || '[]';
  const appRaw = localStorage.getItem('brasilTravelApp') || '{}';

  let gastos = [];
  let app = {};

  try { gastos = JSON.parse(gastosRaw); } catch (e) { gastos = []; }
  try { app = JSON.parse(appRaw); } catch (e) { app = {}; }

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

function mergeArrayById(localArray, remoteArray) {
  const itemsById = new Map();

  remoteArray.forEach(item => itemsById.set(item.id, item));
  localArray.forEach(item => itemsById.set(item.id, item));

  return Array.from(itemsById.values());
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

console.log('✅ supabase-sync.js cargado (versión MEJORADA con merge inteligente)');