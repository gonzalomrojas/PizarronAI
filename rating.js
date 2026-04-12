// ===================== RATING CON DECAIMIENTO TEMPORAL =====================
//
// Problema que resuelve:
//   Con una media aritmética simple, un jugador que lleva 20 partidos
//   tiene su rating "congelado" — cambios recientes pesan muy poco.
//
// Solución:
//   Los últimos RECENT_N partidos tienen peso RECENT_WEIGHT.
//   Los anteriores tienen peso 1.
//   Esto hace que mejoras/bajas recientes impacten rápido.
//
// Ejemplo con RECENT_N=5, RECENT_WEIGHT=3:
//   Partido 1 (viejo):  peso 1
//   Partido 10 (viejo): peso 1
//   Partido 11 (reciente): peso 3  ← 3x más influencia
//   Partido 15 (reciente): peso 3

function calcRatingConDecaimiento(jugador) {
  const votos = jugador.historial_votos;
  if (!votos || votos.length === 0) return jugador.rating;

  const n = votos.length;
  let sumPeso = 0;
  let sumVal  = 0;

  votos.forEach((voto, i) => {
    const esReciente = i >= n - RECENT_N;
    const peso = esReciente ? RECENT_WEIGHT : 1;
    sumPeso += peso;
    sumVal  += voto * peso;
  });

  return sumVal / sumPeso;
}

// ===================== TENDENCIA =====================
// Compara el promedio de los últimos 3 votos vs el resto.
// Retorna: 'up' | 'dn' | 'eq' | null (< 3 partidos)

function calcTrend(jugador) {
  const votos = jugador.historial_votos;
  if (!votos || votos.length < 3) return null;

  const n          = votos.length;
  const recientes  = votos.slice(-3);
  const anteriores = votos.slice(0, -3);

  const promReciente  = recientes.reduce((a, b) => a + b, 0) / recientes.length;
  const promAnterior  = anteriores.length
    ? anteriores.reduce((a, b) => a + b, 0) / anteriores.length
    : promReciente;

  const diff = promReciente - promAnterior;
  if (diff >  0.3) return 'up';
  if (diff < -0.3) return 'dn';
  return 'eq';
}

// ===================== PREVIEW EN VOTACIÓN =====================
// Simula cómo quedaría el rating si se agrega un nuevo voto.
// Usado en la pestaña Votar para mostrar el OVR estimado en tiempo real.

function simularNuevoRating(jugador, nuevoVoto) {
  const votosSimulados = [...(jugador.historial_votos || [jugador.rating]), nuevoVoto];
  const n = votosSimulados.length;
  let sumPeso = 0, sumVal = 0;

  votosSimulados.forEach((v, i) => {
    const peso = i >= n - RECENT_N ? RECENT_WEIGHT : 1;
    sumPeso += peso;
    sumVal  += v * peso;
  });

  return sumVal / sumPeso;
}
