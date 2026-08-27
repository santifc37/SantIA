import { wheelPattern, VENTANA_DEDUPLICACION_MS } from './config.js';

export function mezclarArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function obtenerColorSector(i) {
  return wheelPattern[i % wheelPattern.length];
}

export function mezclarSinAdyacentesIguales(arr) {
  const n = arr.length;
  if (n <= 1) return arr.slice();
  const grupos = {};
  arr.forEach(item => {
    if (!grupos[item.name]) grupos[item.name] = [];
    grupos[item.name].push(item);
  });

  const claves = Object.keys(grupos);
  claves.forEach(k => mezclarArray(grupos[k]));
  mezclarArray(claves);

  const gruposOrdenados = claves.map(k => grupos[k]).sort((a, b) => b.length - a.length);

  function elegirIndicesEspaciados(total, c) {
    const indices = [];
    let acumulador = 0;
    for (let i = 0; i < total; i++) {
      acumulador += c;
      if (acumulador >= total) {
        indices.push(i);
        acumulador -= total;
      }
    }
    return indices;
  }

  const resultado = new Array(n).fill(null);
  let posicionesLibres = Array.from({ length: n }, (_, i) => i);

  for (const grupo of gruposOrdenados) {
    const c = grupo.length;
    const total = posicionesLibres.length;
    const indicesElegidos = elegirIndicesEspaciados(total, c);
    for (let i = indicesElegidos.length - 1; i >= 0; i--) {
      const idxEnLibres = indicesElegidos[i];
      const posReal = posicionesLibres[idxEnLibres];
      resultado[posReal] = grupo[i];
      posicionesLibres.splice(idxEnLibres, 1);
    }
  }
  return resultado;
}

export function easeOut(t, b, c, d) {
  let ts = (t /= d) * t;
  let tc = ts * t;
  return b + c * (tc + -3 * ts + 3 * t);
}

export function obtenerIndiceBajoPuntero(rotationDeg, n) {
  const anglePer = 360 / n;
  const displayRotation = ((rotationDeg % 360) + 360) % 360;
  const sliceAngle = ((180 - displayRotation) % 360 + 360) % 360;
  return Math.floor(sliceAngle / anglePer) % n;
}



