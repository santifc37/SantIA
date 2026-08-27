export const DESIGN_W = 1920;
export const DESIGN_H = 1020;

export const crearUriSvgLimpia = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
export const CUSTOM_PERK_ICON = crearUriSvgLimpia('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#a259ff"/><circle cx="50" cy="50" r="30" fill="#ffea00"/></svg>');

export const wheelPattern = ['#FFFFFF', '#FFEA00', '#FFFFFF', '#0033CC', '#FFFFFF', '#E60000'];

export const MIN_TICK_GAP_MS = 85;

export const UMBRAL_CAMBIO_MODO_MS = 91;
export const VENTANA_DEDUPLICACION_MS = 4000;

export const audios = {
  ticks: [new Audio('source/sonido3.ogg'), new Audio('source/sonido3.ogg'), new Audio('source/sonido3.ogg')],
  red: new Audio('source/sonidoreddead.mp3'),
  win: new Audio('source/winner.ogg')
};

// Configuración inicial del volumen
audios.red.volume = 0.6;
audios.win.volume = 0.2;

// Objeto mutable para compartir entre módulos
export const state = {
  dbPerks: [],
  options: [],
  donationOptionIds: new Set(),
  currentRotation: 0,
  spinning: false,
  dragging: false,
  hasMoved: false,
  dragStartAngle: 0,
  dragStartRotation: 0,
  currentPage: 1,
  itemsPerPage: 15,
  animationFrameId: null,
  idleAnimationId: null,
  lastSoundOptionName: null,
  perkPendingRemoval: null,
  modoConstante: true,
  intervaloActual: MIN_TICK_GAP_MS,
  ultimoCambioSpinTime: 0,
  ultimoTickSpinTime: 0
};