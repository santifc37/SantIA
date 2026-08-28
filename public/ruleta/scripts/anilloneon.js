import { state } from './config.js';
let updatePaletteModeHandler = null;
export function initNeonRing(containerSelector = '#ruletaNeon') {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.error("¡No se encontró el contenedor #ruletaNeon en el HTML!");
    return;

    }
  const R = 112, CX = 110, CY = 110;
  const C = 2 * Math.PI * R;
  const NS = "http://www.w3.org/2000/svg";

  const BLUE   = "#2f8bff"; 
  const PURPLE = "#b02fff"; 
  const TURQ   = "#00e5c9"; 
  const GREEN  = "#39ff14"; 
  const LIME   = "#adff00"; 
  const YELLOW = "#ffe600"; 
  const ORANGE = "#ff8800"; 
  const RED    = "#ff2f2f"; 

  const BASE_NODES = [
    { color: BLUE,   weight: 4 },   
    { color: TURQ,   weight: 0.6 }, 
    { color: GREEN,  weight: 0.8 }, 
    { color: LIME,   weight: 0.5 }, 
    { color: YELLOW, weight: 0.8 }, 
    { color: ORANGE, weight: 0.5 }, 
    { color: RED,    weight: 3.5 }, 
    { color: ORANGE, weight: 0.5 },
    { color: YELLOW, weight: 0.8 }, 
    { color: LIME,   weight: 0.5 },
    { color: GREEN,  weight: 0.8 }, 
    { color: TURQ,   weight: 0.6 }
  ];

  // PALETA MODO EVENTO (Tonos Sangre DBD / Oscuros)
  const EVENT_NODES = [
    { color: "#8a0000", weight: 4 },
    { color: "#3a0000", weight: 1 },
    { color: "#ff1a1a", weight: 3 },
    { color: "#1a0000", weight: 2 },
    { color: "#c40000", weight: 4 },
    { color: "#8a0000", weight: 2 }
  ];

  function buildPalette(nodes) {
    let list = [];
    nodes.forEach(n => {
      const count = Math.round(n.weight);
      for (let i = 0; i < count; i++) list.push(n.color);
    });
    return list;
  }

  let currentPalette = buildPalette(BASE_NODES);
  let startPalette = currentPalette.slice();
  let targetPalette = currentPalette.slice();

  function hexToRgb(hex) {
    // Si por alguna razón el valor no es un string válido, devolvemos negro por defecto para que no truene
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
      return [0, 0, 0];
    }
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
  }

  function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    return rgbToHex(
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    );
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  let usePurple = false;

  function getNextPaletteState(arr) {
    const shift = Math.floor(Math.random() * (arr.length - 1)) + 1;
    let newPalette = arr.slice(shift).concat(arr.slice(0, shift));

    if (state.eventoActivo) return EVENT_NODES.map(n => n.color);

    usePurple = !usePurple;

    return newPalette.map(color => {
      if (color === RED && usePurple) return PURPLE;
      if (color === PURPLE && !usePurple) return RED;
      return color;
    });
  }

  const STEPS = 160;
  const stepLen = C / STEPS;
  const overlap = 0.6;
  const segments = [];

  container.querySelectorAll(".ring-layer").forEach(layer => {
    const w = layer.getAttribute("data-width");
    const layerSegments = [];

    for (let i = 0; i < STEPS; i++) {
      const circle = document.createElementNS(NS, "circle");
      circle.setAttribute("r", R);
      circle.setAttribute("cx", CX);
      circle.setAttribute("cy", CY);
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke-width", w);
      circle.setAttribute("stroke-dasharray", `${stepLen + overlap} ${C - (stepLen + overlap)}`);
      circle.setAttribute("stroke-dashoffset", -(i * stepLen));
      circle.setAttribute("transform", `rotate(-90 ${CX} ${CY})`);

      layer.appendChild(circle);
      layerSegments.push(circle);
    }
    segments.push(layerSegments);
  });

  function getColorAt(t, palette) {
    const len = palette.length;
    const position = t * len;
    const index = Math.floor(position) % len;
    const nextIndex = (index + 1) % len;
    const localT = position - Math.floor(position);
    return lerpColor(palette[index], palette[nextIndex], localT);
  }

  function render(palette) {
    for (let i = 0; i < STEPS; i++) {
      const tStart = i / STEPS;
      const color = getColorAt(tStart + (1 / (STEPS * 2)), palette);
      segments.forEach(layerSegs => {
        if (layerSegs[i]) layerSegs[i].setAttribute("stroke", color);
      });
    }
  }

  let animStart = performance.now();
  const ANIM_MS = 4000; 
  const HOLD_MS = 3500; 

  function animate(now) {
    const elapsed = now - animStart;
    const progress = Math.min(1, elapsed / ANIM_MS);
    const eased = easeInOut(progress);

    const interpolatedPalette = startPalette.map((col, idx) => lerpColor(col, targetPalette[idx], eased));
    render(interpolatedPalette);

    if (progress >= 1) {
      setTimeout(() => {
        startPalette = targetPalette.slice();
        targetPalette = getNextPaletteState(startPalette);
        animStart = performance.now();
        requestAnimationFrame(animate);
      }, HOLD_MS);
      return;
    }

    requestAnimationFrame(animate);
  }

  render(currentPalette);
  targetPalette = getNextPaletteState(startPalette);
  setTimeout(() => {
    animStart = performance.now();
    requestAnimationFrame(animate);
  }, HOLD_MS);

  updatePaletteModeHandler = () => {
    const currentNodes = state.eventoActivo ? EVENT_NODES : BASE_NODES; // (O NORMAL_NODES según cómo los hayas nombrado)
    startPalette = buildPalette(currentNodes);
    targetPalette = getNextPaletteState(startPalette);
    animStart = performance.now();

    const neonCore = container.querySelector('#neonCore');
    if (neonCore) {
      // Si el evento está activo, ponemos rojo intenso (#ff1a1a); si no, blanco (#ffffff)
      neonCore.style.stroke = state.eventoActivo ? '#000000' : '#ffffff';
    }
  };

}

export function notificarCambioModoEvento() {
  if (updatePaletteModeHandler) {
    updatePaletteModeHandler();
  }
}