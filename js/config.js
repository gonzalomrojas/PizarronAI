// ===================== SUPABASE =====================
const SUPABASE_URL = 'https://llyqmflurzduilnejrjy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_V74ZPUv17PaQAszAsAO5Gw_H2y65Hsq';

// ===================== STORAGE KEYS =====================
const STORAGE_KEY       = 'pizarron_v1';
const GRUPO_STORAGE_KEY = 'pizarron_grupo_id';

// ===================== ATRIBUTOS GENERALES =====================
// Todos los jugadores los tienen, independientemente de su posición.
// Se muestran en el gráfico radar de la carta.
const ATTRS_GENERALES = [
  { key: 'velocidad', label: 'Velocidad', icon: '⚡' },
  { key: 'precision', label: 'Precisión', icon: '🎯' },
  { key: 'pase',      label: 'Pase',      icon: '🔄' },
  { key: 'regate',    label: 'Regate',    icon: '🕹️' },
  { key: 'defensa',   label: 'Defensa',   icon: '🛡️' },
  { key: 'fisico',    label: 'Físico',    icon: '💪' },
];

// ===================== POSICIONES =====================
const POS_CONFIG = {
  ARQ: {
    label: 'Arquero', icon: '🧤',
    attrs: [
      { key: 'reflejos',        label: 'Reflejos' },
      { key: 'posicionamiento', label: 'Posicionamiento' },
      { key: 'manejo',          label: 'Manejo' },
      { key: 'salida',          label: 'Salida' },
    ]
  },
  DEF: {
    label: 'Defensa', icon: '🛡️',
    attrs: [
      { key: 'marcacion',   label: 'Marcación' },
      { key: 'anticipo',    label: 'Anticipo' },
      { key: 'juego_aereo', label: 'Juego aéreo' },
      { key: 'velocidad_def', label: 'Velocidad' },
    ]
  },
  MED: {
    label: 'Mediocampista', icon: '🎯',
    attrs: [
      { key: 'vision',       label: 'Visión' },
      { key: 'recuperacion', label: 'Recuperación' },
      { key: 'llegada',      label: 'Llegada' },
      { key: 'cambio_ritmo', label: 'Cambio ritmo' },
    ]
  },
  ATA: {
    label: 'Ataque', icon: '⚡',
    attrs: [
      { key: 'definicion', label: 'Definición' },
      { key: 'remate',     label: 'Remate' },
      { key: 'cabezazo',   label: 'Cabezazo' },
      { key: 'movimiento', label: 'Movimiento' },
    ]
  }
};

// ===================== CONSTANTES DE RATING =====================
const RECENT_N      = 5;
const RECENT_WEIGHT = 3;

// ===================== CONSTANTES DE ALGORITMO =====================
const SA_ITERATIONS   = 400;
const SA_TEMP_INITIAL = 2.0;
const SA_COOLING      = 0.97;
