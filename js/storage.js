// ========================================
// STORAGE.JS - Gestión de datos
// ========================================

const Storage = {
  // Clave principal de localStorage
  STORAGE_KEY: 'brasilTravelApp',

  // Estructura de datos por defecto
  defaultData: {
    gastos: [],
    alojamiento: null,
    compras: [],
    atracciones: [],
    configuracion: {
      personas: ['Patricia', 'Daniela', 'Gonzalo'],
      tasaCambio: 150, // 1 BRL = 150 CLP (default)
      fechaActualizacionTasa: 'Manual',
      tema: 'claro',
      notificacionesActivas: true,
      categoriasGastos: ['Transporte', 'Comida', 'Hospedaje', 'Atracciones', 'Compras', 'Otros'],
      categoriasAtracciones: [
        'Restaurantes',
        'Playas',
        'Museos/Cultura',
        'Compras/Shopping',
        'Naturaleza/Parques',
        'Vida Nocturna',
        'Entretenimiento',
        'Monumentos/Histórico',
        'Otros'
      ],
      categoriasCompras: [
        'Bebidas',
        'Comida/Snacks',
        'Playa',
        'Higiene',
        'Medicamentos',
        'Otros'
      ]
    },
    metadata: {
      version: '1.0.0',
      ultimaActualizacion: new Date().toISOString(),
      primeraInstalacion: new Date().toISOString()
    }
  },

  // Cargar todos los datos
  load() {
    try {
      const dataStr = localStorage.getItem(this.STORAGE_KEY);
      if (!dataStr) {
        // Primera vez, inicializar con datos por defecto
        this.save(this.defaultData);
        return this.defaultData;
      }

      const data = JSON.parse(dataStr);

      // Migración: asegurar estructura completa
      return this.migrate(data);

    } catch (error) {
      console.error('Error al cargar datos:', error);
      return this.defaultData;
    }
  },

  // Guardar todos los datos
  save(data) {
    try {
      // Actualizar timestamp
      data.metadata.ultimaActualizacion = new Date().toISOString();

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error al guardar datos:', error);
      return false;
    }
  },

  // Migrar datos antiguos a nueva estructura
  migrate(data) {
    const migrated = { ...this.defaultData, ...data };

    // Asegurar que existen todas las secciones
    migrated.gastos = migrated.gastos || [];
    migrated.compras = migrated.compras || [];
    migrated.atracciones = migrated.atracciones || [];
    migrated.configuracion = { ...this.defaultData.configuracion, ...migrated.configuracion };
    migrated.metadata = { ...this.defaultData.metadata, ...migrated.metadata };

    // Migrar gastos antiguos (tu código original)
    migrated.gastos.forEach(gasto => {
      if (!gasto.pagos) {
        gasto.pagos = { Patricia: false, Daniela: false, Gonzalo: false };
      }
    });

    return migrated;
  },

  // Obtener sección específica
  get(section) {
    const data = this.load();
    return data[section];
  },

  // Actualizar sección específica
  set(section, value) {
    const data = this.load();
    data[section] = value;
    return this.save(data);
  },

  // Agregar elemento a un array
  push(section, item) {
    const data = this.load();
    if (!Array.isArray(data[section])) {
      console.error(`La sección ${section} no es un array`);
      return false;
    }

    // Asignar ID único si no existe
    if (!item.id) {
      item.id = Date.now() + Math.random().toString(36).substr(2, 9);
    }

    data[section].push(item);
    return this.save(data);
  },

  // Actualizar elemento en un array por ID
  update(section, id, updates) {
    const data = this.load();
    const index = data[section].findIndex(item => item.id === id);

    if (index === -1) {
      console.error(`No se encontró el elemento con id ${id}`);
      return false;
    }

    data[section][index] = { ...data[section][index], ...updates };
    return this.save(data);
  },

  // Eliminar elemento de un array por ID
  delete(section, id) {
    const data = this.load();
    data[section] = data[section].filter(item => item.id !== id);
    return this.save(data);
  },

  // Exportar datos como JSON
  export() {
    const data = this.load();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brasil-travel-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Importar datos desde JSON
  import(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const migrated = this.migrate(data);
          this.save(migrated);
          resolve(migrated);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  },

  // Borrar todos los datos
  clear() {
    if (confirm('¿Estás seguro de que deseas borrar TODOS los datos? Esta acción no se puede deshacer.')) {
      localStorage.removeItem(this.STORAGE_KEY);
      window.location.reload();
    }
  },

  // Obtener estadísticas generales
  getStats() {
    const data = this.load();

    return {
      totalGastos: data.gastos.length,
      totalCompras: data.compras.length,
      totalAtracciones: data.atracciones.length,
      comprasPendientes: data.compras.filter(c => !c.comprado).length,
      atraccionesVisitadas: data.atracciones.filter(a => a.estado === 'visitado').length,
      ultimaActualizacion: data.metadata.ultimaActualizacion
    };
  }
};

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  // Cargar datos iniciales
  const data = Storage.load();
  console.log('✅ Storage inicializado:', data.metadata);
});