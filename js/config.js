// ===================== SUPABASE =====================
const SUPABASE_URL  = 'https://llyqmflurzduilnejrjy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_V74ZPUv17PaQAszAsAO5Gw_H2y65Hsq';

// ===================== STORAGE KEYS =====================
const STORAGE_KEY       = 'pizarron_v1';
const GRUPO_STORAGE_KEY = 'pizarron_grupo_id';
const SUPABASE_ANON = SUPABASE_KEY;   
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
      { key: 'velocidad',   label: 'Velocidad' },
    ]
  },
  MED: {
    label: 'Mediocampista', icon: '🎯',
    attrs: [
      { key: 'pase',         label: 'Pase' },
      { key: 'vision',       label: 'Visión' },
      { key: 'recuperacion', label: 'Recuperación' },
      { key: 'regate',       label: 'Regate' },
    ]
  },
  ATA: {
    label: 'Ataque', icon: '⚡',
    attrs: [
      { key: 'definicion', label: 'Definición' },
      { key: 'velocidad',  label: 'Velocidad' },
      { key: 'regate',     label: 'Regate' },
      { key: 'cabezazo',   label: 'Cabezazo' },
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
