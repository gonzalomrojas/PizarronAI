// ===================== POSICIONES =====================
// Cada posición define sus atributos específicos.
// Para agregar una posición nueva, añadila acá y en el HTML.
const POS_CONFIG = {
  ARQ: {
    label: 'Arquero',
    icon: '🧤',
    attrs: [
      { key: 'reflejos',        label: 'Reflejos' },
      { key: 'posicionamiento', label: 'Posicionamiento' },
      { key: 'manejo',          label: 'Manejo' },
      { key: 'salida',          label: 'Salida' },
    ]
  },
  DEF: {
    label: 'Defensa',
    icon: '🛡️',
    attrs: [
      { key: 'marcacion',   label: 'Marcación' },
      { key: 'anticipo',    label: 'Anticipo' },
      { key: 'juego_aereo', label: 'Juego aéreo' },
      { key: 'velocidad',   label: 'Velocidad' },
    ]
  },
  MED: {
    label: 'Mediocampista',
    icon: '🎯',
    attrs: [
      { key: 'pase',         label: 'Pase' },
      { key: 'vision',       label: 'Visión' },
      { key: 'recuperacion', label: 'Recuperación' },
      { key: 'regate',       label: 'Regate' },
    ]
  },
  ATA: {
    label: 'Ataque',
    icon: '⚡',
    attrs: [
      { key: 'definicion', label: 'Definición' },
      { key: 'velocidad',  label: 'Velocidad' },
      { key: 'regate',     label: 'Regate' },
      { key: 'cabezazo',   label: 'Cabezazo' },
    ]
  }
};

// ===================== CONSTANTES DE RATING =====================
// Últimos N partidos con peso RECENT_WEIGHT para el decaimiento temporal.
// Subí RECENT_N o bajá RECENT_WEIGHT si querés que el historial pese más.
const RECENT_N      = 5;
const RECENT_WEIGHT = 3;

// ===================== CONSTANTES DE ALGORITMO =====================
const SA_ITERATIONS   = 400;   // Iteraciones de Simulated Annealing
const SA_TEMP_INITIAL = 2.0;   // Temperatura inicial (más alto = más exploración)
const SA_COOLING      = 0.97;  // Factor de enfriamiento por iteración

// ===================== STORAGE KEY =====================
// Cambialo si hacés cambios breaking al schema del state.
const STORAGE_KEY = 'pichanga_v5';
