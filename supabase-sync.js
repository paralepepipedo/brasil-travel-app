// =====================================================
// SUPABASE-SYNC.JS - Capa de sincronización offline-first
// =====================================================

// 🔧 CONFIGURACIÓN (reemplaza con tus credenciales)
const SUPABASE_URL = 'https://lpspcmwxallshngaggmw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_d96GjwG17EM1jBNXupW0rQ_EVzmEES0';

// Cliente Supabase (carga desde CDN)
let supabase = null;

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
    // Cargar cliente desde CDN si no está
    if (typeof createClient === 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// =====================================================
// SINCRONIZACIÓN COMPLETA (BIDIRECCIONAL)
// =====================================================
async function syncAll() {
  if (!syncState.online || syncState.syncing) return;

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
  const localData = getAllLocalData();

  // Gastos
  if (localData.gastos.length > 0) {
    const { error } = await supabase.from('gastos').upsert(
      localData.gastos.map(g => ({
        id: g.id,
        user_id: DEFAULT_USER_ID,
        descripcion: g.descripcion,
        monto_brl: g.montobrl,
        moneda: g.moneda || 'BRL',
        monto_original: g.montooriginal,
        fecha: g.fecha,
        personas: g.personas,
        pagado_por: g.pagadoPor,
        pagos: g.pagos,
        fijo: g.fijo || false
      })),
      { onConflict: 'id' }
    );
    if (error) console.error('Error subiendo gastos:', error);
  }

  // Compras
  if (localData.compras.length > 0) {
    await supabase.from('compras').upsert(
      localData.compras.map(c => ({
        id: c.id,
        user_id: DEFAULT_USER_ID,
        articulo: c.articulo,
        cantidad: c.cantidad,
        categoria: c.categoria,
        notas: c.notas,
        comprado: c.comprado || false
      })),
      { onConflict: 'id' }
    );
  }

  // Atracciones
  if (localData.atracciones.length > 0) {
    await supabase.from('atracciones').upsert(
      localData.atracciones.map(a => ({
        id: a.id,
        user_id: DEFAULT_USER_ID,
        nombre: a.nombre,
        categoria: a.categoria,
        direccion: a.direccion,
        coordenadas: a.coordenadas,
        precio_brl: a.precioBRL,
        horario: a.horario,
        rating: a.rating || 0,
        notas: a.notas,
        visitado: a.visitado || false,
        fecha_visita: a.fechaVisita,
        imagen_url: a.imagenUrl
      })),
      { onConflict: 'id' }
    );
  }

  // Vuelos
  if (localData.vuelos.ida) {
    await supabase.from('vuelos').upsert({
      id: 'ida-' + DEFAULT_USER_ID,
      user_id: DEFAULT_USER_ID,
      tipo: 'ida',
      ...normalizeVuelo(localData.vuelos.ida)
    }, { onConflict: 'id' });
  }

  if (localData.vuelos.regreso) {
    await supabase.from('vuelos').upsert({
      id: 'regreso-' + DEFAULT_USER_ID,
      user_id: DEFAULT_USER_ID,
      tipo: 'regreso',
      ...normalizeVuelo(localData.vuelos.regreso)
    }, { onConflict: 'id' });
  }

  // Documentos (con subida de archivos a Storage)
  if (localData.documentos.length > 0) {
    const docsParaUpsert = [];

    for (const d of localData.documentos) {
      const docData = {
        id: d.id,
        user_id: DEFAULT_USER_ID,
        categoria: d.categoria,
        titulo: d.titulo,
        descripcion: d.descripcion,
        fecha_evento: d.fechaEvento,
        recordatorio: d.recordatorio || 0,
        etiquetas: d.etiquetas,
        notas: d.notas,
        archivo_nombre: d.archivoNombre,
        archivo_tipo: d.archivoTipo
      };

      // ✨ SUBIR ARCHIVO SI EXISTE EN BASE64
      if (d.archivoBase64 && d.archivoBase64.startsWith('data:')) {
        try {
          const fileName = `${d.id}-${d.archivoNombre}`;
          const base64Data = d.archivoBase64.split(',')[1]; // quitar "data:image/png;base64,"

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documentos')
            .upload(fileName, atob(base64Data), {
              contentType: d.archivoTipo || 'application/octet-stream',
              upsert: true
            });

          if (!uploadError && uploadData) {
            const publicUrl = supabase.storage
              .from('documentos')
              .getPublicUrl(fileName).data.publicUrl;
            docData.archivo_url = publicUrl;
            console.log(`✅ Archivo subido: ${fileName}`);
          } else {
            console.warn('Error subiendo archivo:', uploadError);
          }
        } catch (e) {
          console.error('Error procesando archivo:', e);
        }
      }

      docsParaUpsert.push(docData);
    }

    if (docsParaUpsert.length > 0) {
      const { error } = await supabase
        .from('documentos')
        .upsert(docsParaUpsert, { onConflict: 'id' });

      if (error) console.error('Error subiendo documentos:', error);
    }
  }


  // Itinerario
  if (localData.itinerario.length > 0) {
    const actividadesFlat = [];
    localData.itinerario.forEach(dia => {
      dia.actividades.forEach(act => {
        actividadesFlat.push({
          id: act.id,
          user_id: DEFAULT_USER_ID,
          fecha: dia.fecha,
          titulo: act.titulo,
          hora_inicio: act.horaInicio,
          hora_fin: act.horaFin,
          notas: act.notas,
          costo_brl: act.costoBRL,
          costo_clp: act.costoCLP,
          atraccion_id: act.atraccionId,
          notificacion: act.notificacion
        });
      });
    });

    if (actividadesFlat.length > 0) {
      await supabase.from('itinerario').upsert(actividadesFlat, { onConflict: 'id' });
    }
  }

  // App config (alojamiento + tasa)
  await supabase.from('app_config').upsert({
    user_id: DEFAULT_USER_ID,
    alojamiento: localData.alojamiento,
    tasa_cambio: localData.tasaCambio || 150
  }, { onConflict: 'user_id' });
}

// =====================================================
// DESCARGAR ACTUALIZACIONES SUPABASE → LOCAL
// =====================================================
async function downloadUpdates() {
  const lastSync = localStorage.getItem('lastSync');

  // Gastos
  const { data: gastos } = await supabase
    .from('gastos')
    .select('*')
    .eq('user_id', DEFAULT_USER_ID)
    .order('updated_at', { ascending: false });

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
  const { data: compras } = await supabase
    .from('compras')
    .select('*')
    .eq('user_id', DEFAULT_USER_ID);

  // Atracciones
  const { data: atracciones } = await supabase
    .from('atracciones')
    .select('*')
    .eq('user_id', DEFAULT_USER_ID);

  // Vuelos
  const { data: vuelos } = await supabase
    .from('vuelos')
    .select('*')
    .eq('user_id', DEFAULT_USER_ID);

  const vuelosObj = {
    ida: vuelos?.find(v => v.tipo === 'ida') || null,
    regreso: vuelos?.find(v => v.tipo === 'regreso') || null
  };

  // Documentos (con URLs de Storage)
  const { data: documentos } = await supabase
    .from('documentos')
    .select('*, archivo_url')
    .eq('user_id', DEFAULT_USER_ID);


  // Itinerario
  const { data: itinerario } = await supabase
    .from('itinerario')
    .select('*')
    .eq('user_id', DEFAULT_USER_ID)
    .order('fecha', { ascending: true });

  // Reconstruir estructura itinerario
  const itinerarioAgrupado = [];
  if (itinerario) {
    const porFecha = {};
    itinerario.forEach(act => {
      if (!porFecha[act.fecha]) {
        porFecha[act.fecha] = { fecha: act.fecha, actividades: [] };
      }
      porFecha[act.fecha].actividades.push({
        id: act.id,
        titulo: act.titulo,
        horaInicio: act.hora_inicio,
        horaFin: act.hora_fin,
        notas: act.notas,
        costoBRL: act.costo_brl,
        costoCLP: act.costo_clp,
        atraccionId: act.atraccion_id,
        notificacion: act.notificacion
      });
    });
    Object.values(porFecha).forEach(dia => itinerarioAgrupado.push(dia));
  }

  // App config
  const { data: appConfig } = await supabase
    .from('app_config')
    .select('*')
    .eq('user_id', DEFAULT_USER_ID)
    .single();

  // Guardar todo en localStorage (estructura normalizada)
  const datosApp = {
    alojamiento: appConfig?.alojamiento || null,
    compras: compras || [],
    atracciones: atracciones || [],
    vuelos: vuelosObj,
    documentos: documentos || [],
    tasaCambio: appConfig?.tasa_cambio || 150
  };

  localStorage.setItem('brasilTravelApp', JSON.stringify({
    ...datosApp,
    itinerario: itinerarioAgrupado,
    configuracion: { tasaCambio: datosApp.tasaCambio }
  }));
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

function normalizeVuelo(v) {
  return {
    aerolinea: v.aerolinea,
    numero_vuelo: v.numeroVuelo,
    codigo_reserva: v.codigoReserva,
    origen_codigo: v.origenCodigo,
    origen_nombre: v.origenNombre,
    destino_codigo: v.destinoCodigo,
    destino_nombre: v.destinoNombre,
    fecha_salida: v.fechaSalida,
    fecha_llegada: v.fechaLlegada,
    terminal: v.terminal,
    puerta: v.puerta,
    asientos: v.asientos,
    equipaje: v.equipaje,
    notas: v.notas,
    boarding_pass_url: v.boardingPassUrl
  };
}

function updateSyncUI(message) {
  const indicator = document.getElementById('syncIndicator');
  if (indicator) {
    indicator.textContent = message;
    indicator.style.display = message ? 'block' : 'none';
  }
}

// Marcar cambios pendientes cuando se guarda algo
function markPendingChanges() {
  syncState.pendingChanges++;

  // Intentar sync inmediato si hay red
  if (syncState.online && !syncState.syncing) {
    setTimeout(syncAll, 1000); // delay de 1 segundo
  }
}

// Exportar funciones
window.SupabaseSync = {
  init: initSupabase,
  sync: syncAll,
  markPending: markPendingChanges,
  state: syncState
};
