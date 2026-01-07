// =====================================================
// SUPABASE-SYNC.JS - Capa de sincronización offline-first
// =====================================================

// 🔧 CONFIGURACIÓN (reemplaza con tus credenciales)
const SUPABASE_URL = 'https://lpspcmwxallshngaggmw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_d96GjwG17EM1jBNXupW0rQ_EVzmEES0';

// Cliente Supabase
let supabaseClient = null;

// Usuario por defecto (modo offline)
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// Estado de sincronización
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
    // Verificar que Supabase está disponible
    if (!window.supabase || !window.supabase.createClient) {
      console.error('❌ Supabase SDK no está disponible');
      return false;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase cliente inicializado');

    // Detectar cambios de conexión
    window.addEventListener('online', () => {
      syncState.online = true;
      console.log('✅ Conexión restaurada - iniciando sync');
      syncAll();
    });

    window.addEventListener('offline', () => {
      syncState.online = false;
      console.log('📴 Sin conexión - modo offline');
    });

    // Sincronización automática cada 5 minutos (si hay cambios)
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
    // 1) Subir cambios locales pendientes
    await uploadPendingChanges();

    // 2) Descargar actualizaciones remotas
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

  // Gastos (filtrar inválidos)
  if (localData.gastos.length > 0) {
    const gastosValidos = localData.gastos
      .filter(g => {
        // Validar campos obligatorios
        const valido =
          g.id &&
          g.descripcion &&
          g.montobrl != null &&
          !isNaN(parseFloat(g.montobrl)) &&
          g.fecha;

        if (!valido) {
          console.warn('⚠️ Gasto inválido ignorado:', g);
        }
        return valido;
      })
      .map(g => ({
        id: g.id,
        user_id: DEFAULT_USER_ID,
        descripcion: g.descripcion,
        monto_brl: parseFloat(g.montobrl),
        moneda: g.moneda || 'BRL',
        monto_original: g.montooriginal ? parseFloat(g.montooriginal) : null,
        fecha: g.fecha,
        personas: g.personas || 3,
        pagado_por: g.pagadoPor || 'Patricia',
        pagos: g.pagos || {},
        fijo: g.fijo || false
      }));

    if (gastosValidos.length > 0) {
      const { error } = await supabaseClient.from('gastos').upsert(
        gastosValidos,
        { onConflict: 'id' }
      );
      if (error) {
        console.error('Error subiendo gastos:', error);
      } else {
        console.log(`✅ ${gastosValidos.length} gastos sincronizados`);
      }
    }
  }


  // Compras (filtrar inválidos)
  if (localData.compras.length > 0) {
    const comprasValidas = localData.compras
      .filter(c => c.id && c.articulo)
      .map(c => ({
        id: c.id,
        user_id: DEFAULT_USER_ID,
        articulo: c.articulo,
        cantidad: c.cantidad || 1,
        categoria: c.categoria || 'Otros',
        notas: c.notas || '',
        comprado: c.comprado || false
      }));

    if (comprasValidas.length > 0) {
      const { error } = await supabaseClient.from('compras').upsert(
        comprasValidas,
        { onConflict: 'id' }
      );
      if (error) console.error('Error subiendo compras:', error);
    }
  }


  // Atracciones (filtrar inválidos)
  if (localData.atracciones.length > 0) {
    const atraccionesValidas = localData.atracciones
      .filter(a => a.id && a.nombre)
      .map(a => ({
        id: a.id,
        user_id: DEFAULT_USER_ID,
        nombre: a.nombre,
        categoria: a.categoria || 'Otros',
        direccion: a.direccion || '',
        coordenadas: a.coordenadas || '',
        precio_brl: a.precioBRL ? parseFloat(a.precioBRL) : null,
        horario: a.horario || '',
        rating: a.rating || 0,
        notas: a.notas || '',
        visitado: a.visitado || false,
        fecha_visita: a.fechaVisita || null,
        imagen_url: a.imagenUrl || ''
      }));

    if (atraccionesValidas.length > 0) {
      const { error } = await supabaseClient.from('atracciones').upsert(
        atraccionesValidas,
        { onConflict: 'id' }
      );
      if (error) console.error('Error subiendo atracciones:', error);
    }
  }


  // App config (alojamiento + tasa)
  await supabaseClient.from('app_config').upsert({
    user_id: DEFAULT_USER_ID,
    alojamiento: localData.alojamiento,
    tasa_cambio: localData.tasaCambio || 150
  }, { onConflict: 'user_id' });
}

// =====================================================
// DESCARGAR ACTUALIZACIONES SUPABASE → LOCAL
// =====================================================
async function downloadUpdates() {
  if (!supabaseClient) return;

  // Gastos
  const { data: gastos } = await supabaseClient
    .from('gastos')
    .select('*')
    .eq('user_id', DEFAULT_USER_ID);

  if (gastos && gastos.length > 0) {
    const gastosLocal = gastos.map(g => ({
      id: g.id,
      descripcion: g.descripcion,
      montobrl: parseFloat(g.monto_brl),
      moneda: g.moneda,
      montooriginal: g.monto_original ? parseFloat(g.monto_original) : null,
      fecha: g.fecha,
      personas: g.personas,
      pagadoPor: g.pagado_por,
      pagos: g.pagos,
      fijo: g.fijo
    }));
    localStorage.setItem('gastosViaje', JSON.stringify(gastosLocal));
  }

  // Compras
  const { data: compras } = await supabaseClient
    .from('compras')
    .select('*')
    .eq('user_id', DEFAULT_USER_ID);

  // Atracciones
  const { data: atracciones } = await supabaseClient
    .from('atracciones')
    .select('*')
    .eq('user_id', DEFAULT_USER_ID);

  // App config
  const { data: appConfig } = await supabaseClient
    .from('app_config')
    .select('*')
    .eq('user_id', DEFAULT_USER_ID)
    .single();

  // Guardar en localStorage
  const datosApp = {
    alojamiento: appConfig?.alojamiento || null,
    compras: compras || [],
    atracciones: atracciones || [],
    vuelos: { ida: null, regreso: null },
    documentos: [],
    tasaCambio: appConfig?.tasa_cambio || 150
  };

  localStorage.setItem('brasilTravelApp', JSON.stringify(datosApp));
}

// =====================================================
// HELPERS
// =====================================================
function getAllLocalData() {
  const gastosRaw = localStorage.getItem('gastosViaje') || '[]';
  const appRaw = localStorage.getItem('brasilTravelApp') || '{}';

  const gastos = JSON.parse(gastosRaw);
  const app = JSON.parse(appRaw);

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

// Marcar cambios pendientes
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

console.log('✅ supabase-sync.js cargado');
