// =====================================================
// SUPABASE-SYNC.JS - Con timestamps para evitar sobrescrituras
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
      console.log('✅ Conexión restaurada');
    });

    window.addEventListener('offline', () => {
      syncState.online = false;
      console.log('🔴 Sin conexión - modo offline');
    });

    return true;
  } catch (e) {
    console.error('Error inicializando Supabase:', e);
    return false;
  }
}

// =====================================================
// SINCRONIZACIÓN COMPLETA
// =====================================================
async function syncAll() {
  if (!syncState.online || syncState.syncing || !supabaseClient) return;

  syncState.syncing = true;
  updateSyncUI('Sincronizando...');

  try {
    console.log('🔄 Descargando datos (sin subir)...');

    // ✅ SOLO DESCARGAR, NO SUBIR
    await downloadNewerData();

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

// Nueva función: subir datos específicos
async function uploadSingleItem(tipo, datos) {
  if (!syncState.online || !supabaseClient) {
    console.log('📴 Sin conexión - guardado solo local');
    return;
  }

  console.log(`📤 Subiendo ${tipo}...`);

  if (tipo === 'itinerario') {
    await supabaseClient
      .from('itinerario')
      .upsert({
        user_id: DEFAULT_USER_ID,
        fecha: datos.fecha,
        actividades: datos.actividades
      }, { onConflict: 'user_id,fecha' });

    console.log(`✅ ${datos.fecha} subido`);
  }
  if (tipo === 'documento') {
    await supabaseClient
      .from('documentos')
      .upsert({
        id: String(datos.id),
        user_id: DEFAULT_USER_ID,
        categoria: datos.categoria,
        titulo: datos.titulo,
        descripcion: datos.descripcion || '',
        fecha_evento: datos.fechaEvento || null,
        recordatorio: datos.recordatorio || { activo: false },
        etiquetas: datos.etiquetas || [],
        notas: datos.notas || '',
        archivo_nombre: datos.archivo.nombre,
        archivo_tipo: datos.archivo.tipo,
        archivo_data: datos.archivo.data,
        fecha_creacion: datos.fechaCreacion
      }, { onConflict: 'id' });

    console.log(`✅ Documento "${datos.titulo}" subido`);
  }
  // Agregar más tipos según necesites
  if (tipo === 'compra') {
    await supabaseClient
      .from('compras')
      .upsert({
        id: String(datos.id),
        user_id: DEFAULT_USER_ID,
        articulo: datos.articulo,
        cantidad: datos.cantidad || 1,
        categoria: datos.categoria || 'Otros',
        notas: datos.notas || '',
        comprado: datos.comprado || false,
        precio: datos.precio ? parseFloat(datos.precio) : null
      }, { onConflict: 'id' });

    console.log(`✅ Compra "${datos.articulo}" subida`);
  }

  if (tipo === 'atraccion') {
    await supabaseClient
      .from('atracciones')
      .upsert({
        id: String(datos.id),
        user_id: DEFAULT_USER_ID,
        nombre: datos.nombre,
        categoria: datos.categoria || 'otro',
        direccion: datos.direccion || '',
        coordenadas: datos.maps || '',
        precio_brl: datos.precioBRL ? parseFloat(datos.precioBRL) : null,
        horario: '',
        rating: datos.rating || 0,
        notas: datos.notas || '',
        visitado: datos.visitado || false,
        fecha_visita: datos.fechaVisita || null,
        imagen_url: (datos.imagenes && datos.imagenes[0]) || ''
      }, { onConflict: 'id' });

    console.log(`✅ Atracción "${datos.nombre}" subida`);
  }

  if (tipo === 'vuelo') {
    // datos = { tipo: 'ida' | 'regreso', datos: { ...objetoVuelo } }
    // Asumimos que datos.datos tiene la estructura correcta de vuelo

    const vueloData = {
      user_id: DEFAULT_USER_ID,
      tipo: datos.tipo, // 'ida' o 'regreso'
      aerolinea: datos.datos.aerolinea,
      numero_vuelo: datos.datos.numeroVuelo,
      codigo_reserva: datos.datos.codigoReserva || '',
      origen: datos.datos.origen,
      destino: datos.datos.destino,
      fecha_salida: datos.datos.fechaSalida,
      fecha_llegada: datos.datos.fechaLlegada,
      terminal: datos.datos.terminal || '',
      puerta: datos.datos.puerta || '',
      asientos: datos.datos.asientos || [],
      equipaje: datos.datos.equipaje || '',
      notas: datos.datos.notas || '',
      archivo: datos.datos.archivo || null
    };

    await supabaseClient
      .from('vuelos')
      .upsert(vueloData, { onConflict: 'user_id,tipo' });

    console.log(`✅ Vuelo de ${datos.tipo} subido correctamente a tabla 'vuelos'`);
  }
}

// =====================================================
// SUBIR CAMBIOS LOCALES
// =====================================================
async function uploadLocalChanges() {
  const local = getAllLocalData();

  // Gastos
  if (local.gastos.length > 0) {
    const gastosValidos = local.gastos
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
      await supabaseClient.from('gastos').upsert(gastosValidos, { onConflict: 'id' });
      console.log(`✅ ${gastosValidos.length} gastos sincronizados`);
    }
  }

  // Compras
  if (local.compras.length > 0) {
    const comprasValidas = local.compras
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
      await supabaseClient.from('compras').upsert(comprasValidas, { onConflict: 'id' });
      console.log(`✅ ${comprasValidas.length} compras sincronizadas`);
    }
  }

  // Atracciones
  if (local.atracciones.length > 0) {
    const atraccionesValidas = local.atracciones
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
      await supabaseClient.from('atracciones').upsert(atraccionesValidas, { onConflict: 'id' });
      console.log(`✅ ${atraccionesValidas.length} atracciones sincronizadas`);
    }
  }

  // Documentos
  if (local.documentos && local.documentos.length > 0) {
    const documentosValidos = local.documentos
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
      await supabaseClient.from('documentos').upsert(documentosValidos, { onConflict: 'id' });
      console.log(`✅ ${documentosValidos.length} documentos sincronizados`);
    }
  }

  // Alojamiento
  if (local.alojamiento) {
    const alojamientoData = {
      user_id: DEFAULT_USER_ID,
      nombre: local.alojamiento.nombre,
      direccion: local.alojamiento.direccion || '',
      maps: local.alojamiento.maps || '',
      checkin: local.alojamiento.checkin,
      checkout: local.alojamiento.checkout,
      noches: local.alojamiento.noches || 0,
      precio_total: local.alojamiento.precioTotal || null,
      precio_noche: local.alojamiento.precioNoche || null,
      division: local.alojamiento.division || '3',
      rating: local.alojamiento.rating || 0,
      notas: local.alojamiento.notas || ''
    };

    await supabaseClient.from('alojamiento').upsert(alojamientoData, { onConflict: 'user_id' });
    console.log('✅ Alojamiento sincronizado');
  }

  // Vuelos
  if (local.vuelos.ida) {
    const vueloIda = {
      user_id: DEFAULT_USER_ID,
      tipo: 'ida',
      aerolinea: local.vuelos.ida.aerolinea,
      numero_vuelo: local.vuelos.ida.numeroVuelo,
      codigo_reserva: local.vuelos.ida.codigoReserva || '',
      origen: local.vuelos.ida.origen,
      destino: local.vuelos.ida.destino,
      fecha_salida: local.vuelos.ida.fechaSalida,
      fecha_llegada: local.vuelos.ida.fechaLlegada,
      terminal: local.vuelos.ida.terminal || '',
      puerta: local.vuelos.ida.puerta || '',
      asientos: local.vuelos.ida.asientos || [],
      equipaje: local.vuelos.ida.equipaje || '',
      notas: local.vuelos.ida.notas || '',
      archivo: local.vuelos.ida.archivo || null
    };

    await supabaseClient.from('vuelos').upsert(vueloIda, { onConflict: 'user_id,tipo' });
    console.log('✅ Vuelo ida sincronizado');
  }

  if (local.vuelos.regreso) {
    const vueloRegreso = {
      user_id: DEFAULT_USER_ID,
      tipo: 'regreso',
      aerolinea: local.vuelos.regreso.aerolinea,
      numero_vuelo: local.vuelos.regreso.numeroVuelo,
      codigo_reserva: local.vuelos.regreso.codigoReserva || '',
      origen: local.vuelos.regreso.origen,
      destino: local.vuelos.regreso.destino,
      fecha_salida: local.vuelos.regreso.fechaSalida,
      fecha_llegada: local.vuelos.regreso.fechaLlegada,
      terminal: local.vuelos.regreso.terminal || '',
      puerta: local.vuelos.regreso.puerta || '',
      asientos: local.vuelos.regreso.asientos || [],
      equipaje: local.vuelos.regreso.equipaje || '',
      notas: local.vuelos.regreso.notas || '',
      archivo: local.vuelos.regreso.archivo || null
    };

    await supabaseClient.from('vuelos').upsert(vueloRegreso, { onConflict: 'user_id,tipo' });
    console.log('✅ Vuelo regreso sincronizado');
  }

  // ✅ ITINERARIO - NO hacer merge, solo subir
  if (local.itinerario && local.itinerario.length > 0) {
    console.log(`📤 Subiendo ${local.itinerario.length} días de itinerario...`);

    for (const dia of local.itinerario) {
      const itinerarioData = {
        user_id: DEFAULT_USER_ID,
        fecha: dia.fecha,
        actividades: dia.actividades
      };

      await supabaseClient.from('itinerario').upsert(itinerarioData, { onConflict: 'user_id,fecha' });
      console.log(`✅ ${dia.fecha}: ${dia.actividades.length} actividades`);
    }
  }

  // Tasa de cambio
  const appConfigData = {
    user_id: DEFAULT_USER_ID,
    tasa_cambio: local.tasaCambio || 150
  };

  await supabaseClient.from('app_config').upsert(appConfigData, { onConflict: 'user_id' });
  console.log('✅ Tasa cambio sincronizada');
}

// =====================================================
// DESCARGAR DATOS MÁS NUEVOS
// =====================================================
async function downloadNewerData() {
  console.log('📥 Descargando datos de Supabase...');

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

  console.log(`📥 Itinerario: ${itinerario.data?.length || 0} días`);

  // Guardar en localStorage (NO sobrescribir itinerario)
  const local = getAllLocalData();
  // Guardar gastos descargados
  if (gastos.data && gastos.data.length > 0) {
    const gastosLocal = gastos.data
      .filter(g => !g.fijo)
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

    const gastosUnicos = Array.from(new Map(gastosLocal.map(g => [g.id, g])).values());
    localStorage.setItem('gastosViaje', JSON.stringify(gastosUnicos));
    console.log(`✅ ${gastosUnicos.length} gastos guardados en localStorage`);
  }
  const datosApp = {
    alojamiento: alojamiento.data || local.alojamiento,
    compras: (compras.data || []).map(c => ({
      id: c.id,
      articulo: c.articulo,
      cantidad: c.cantidad,
      categoria: c.categoria,
      notas: c.notas,
      comprado: c.comprado,
      precio: c.precio
    })),
    atracciones: (atracciones.data || []).map(a => ({
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
    documentos: (documentos.data || []).map(d => ({
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
      ida: vuelos.data?.find(v => v.tipo === 'ida') ? {
        aerolinea: vuelos.data.find(v => v.tipo === 'ida').aerolinea,
        numeroVuelo: vuelos.data.find(v => v.tipo === 'ida').numero_vuelo,
        codigoReserva: vuelos.data.find(v => v.tipo === 'ida').codigo_reserva,
        origen: vuelos.data.find(v => v.tipo === 'ida').origen,
        destino: vuelos.data.find(v => v.tipo === 'ida').destino,
        fechaSalida: vuelos.data.find(v => v.tipo === 'ida').fecha_salida,
        fechaLlegada: vuelos.data.find(v => v.tipo === 'ida').fecha_llegada,
        terminal: vuelos.data.find(v => v.tipo === 'ida').terminal,
        puerta: vuelos.data.find(v => v.tipo === 'ida').puerta,
        asientos: vuelos.data.find(v => v.tipo === 'ida').asientos,
        equipaje: vuelos.data.find(v => v.tipo === 'ida').equipaje,
        notas: vuelos.data.find(v => v.tipo === 'ida').notas,
        archivo: vuelos.data.find(v => v.tipo === 'ida').archivo
      } : local.vuelos.ida,
      regreso: vuelos.data?.find(v => v.tipo === 'regreso') ? {
        aerolinea: vuelos.data.find(v => v.tipo === 'regreso').aerolinea,
        numeroVuelo: vuelos.data.find(v => v.tipo === 'regreso').numero_vuelo,
        codigoReserva: vuelos.data.find(v => v.tipo === 'regreso').codigo_reserva,
        origen: vuelos.data.find(v => v.tipo === 'regreso').origen,
        destino: vuelos.data.find(v => v.tipo === 'regreso').destino,
        fechaSalida: vuelos.data.find(v => v.tipo === 'regreso').fecha_salida,
        fechaLlegada: vuelos.data.find(v => v.tipo === 'regreso').fecha_llegada,
        terminal: vuelos.data.find(v => v.tipo === 'regreso').terminal,
        puerta: vuelos.data.find(v => v.tipo === 'regreso').puerta,
        asientos: vuelos.data.find(v => v.tipo === 'regreso').asientos,
        equipaje: vuelos.data.find(v => v.tipo === 'regreso').equipaje,
        notas: vuelos.data.find(v => v.tipo === 'regreso').notas,
        archivo: vuelos.data.find(v => v.tipo === 'regreso').archivo
      } : local.vuelos.regreso
    },
    tasaCambio: appConfig.data?.tasa_cambio || local.tasaCambio || 150,
    // ✅ MANTENER itinerario local (no sobrescribir)
    itinerario: (itinerario.data || []).map(i => ({
      fecha: i.fecha,
      actividades: i.actividades
    })),
    configuracion: { tasaCambio: appConfig.data?.tasa_cambio || local.tasaCambio || 150 }
  };

  localStorage.setItem('brasilTravelApp', JSON.stringify(datosApp));
  console.log('✅ Datos guardados (itinerario local preservado)');

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

  // Primero agregar locales
  localArray.forEach(item => itemsById.set(item.id, item));

  // Luego sobrescribir con remotos (remoto gana)
  remoteArray.forEach(item => {
    const localItem = itemsById.get(item.id);

    // Solo usar remoto si tiene más datos que local
    if (!localItem || JSON.stringify(item).length >= JSON.stringify(localItem).length) {
      itemsById.set(item.id, item);
    }
  });

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

async function deleteSingleItem(tipo, id) {
  if (!navigator.onLine) {
    console.log('⚠️ Offline - eliminación pendiente');
    return true;
  }

  const tablas = {
    'compra': 'compras',
    'atraccion': 'atracciones',
    'documento': 'documentos'
  };

  const tabla = tablas[tipo];
  if (!tabla) {
    console.error('❌ Tipo desconocido:', tipo);
    return false;
  }

  try {
    const { error } = await supabaseClient
      .from(tabla)
      .delete()
      .eq('user_id', DEFAULT_USER_ID)
      .eq('id', id);

    if (error) {
      console.error(`❌ Error al eliminar de Supabase:`, error);
      return false;
    }

    console.log(`✅ ${tipo} ${id} eliminado de Supabase`);
    return true;
  } catch (error) {
    console.error(`❌ Error al eliminar ${tipo}:`, error);
    return false;
  }
}

// Exportar funciones
window.SupabaseSync = {
  init: initSupabase,
  sync: syncAll,
  uploadSingle: uploadSingleItem,
  deleteSingle: deleteSingleItem,  // ✅ AGREGAR ESTA LÍNEA
  markPending: markPendingChanges,
  state: syncState
};

console.log('✅ supabase-sync.js cargado (versión sin merge de itinerario)');