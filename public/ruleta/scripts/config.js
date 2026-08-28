export const DESIGN_W = 1920;
export const DESIGN_H = 1020;

export const crearUriSvgLimpia = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
export const CUSTOM_PERK_ICON = crearUriSvgLimpia('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#a259ff"/><circle cx="50" cy="50" r="30" fill="#ffea00"/></svg>');

export const wheelPattern = ['#FFFFFF', '#FFEA00', '#FFFFFF', '#0033CC', '#FFFFFF', '#E60000'];

// ===================================================================
// MODO EVENTO ("sangre y vacío"): ruleta especial que sale con una
// probabilidad baja, muestra siempre los mismos 4 perks fijos
// (repetidos) y usa una paleta roja/negra en vez de la normal.
// ===================================================================

// Probabilidad de que un giro sea "evento" (0.04 = 4%).
export const EVENT_CHANCE = 0.04;

// Perks que sí o sí entran al evento. Los nombres reales en la base de
// datos vienen con texto adicional, así que se buscan por prefijo
// (mismo criterio que ya usa detenerGiro() para "me la pela"/"slot vacío").
export const EVENT_PERK_PREFIXES = ['chayanne', 'slot vacío', 'me la pela', 'objeto de obsesión'];

// Cuántas veces se repite cada uno de esos perks en la ruleta de evento.
// 4 perks x 3 copias = 12 porciones.
export const EVENT_COPIES_PER_PERK = 3;

// Paleta de las porciones en modo evento (equivalente a wheelPattern).
export const wheelPatternEvento = ['#8a0000', '#000000', '#c40000', '#1a0000', '#5c0000', '#000000'];

// Paleta del anillo de luces (overlayCanvas) en modo evento, y su
// equivalente normal (movida acá para tener ambas juntas).
export const lightColorsNormal = ['#00ff66', '#ffea00', '#ff2a2a', '#00a2ff'];
export const lightColorsEvento = ['#8a0000', '#000000', '#c40000', '#1a0000'];

// Duración del giro señuelo (normal, antes de confirmarse el evento) y
// del efecto de flash+glitch que marca la entrada al modo evento.
// EVENTO_GLITCH_DURATION_MS debe coincidir con la duración de la
// animación .evento-flash en style.css (0.3s).
export const EVENTO_DECOY_DURATION_MS = 1500;
export const EVENTO_GLITCH_DURATION_MS = 300;

export const MIN_TICK_GAP_MS = 85;

export const UMBRAL_CAMBIO_MODO_MS = 91;
export const VENTANA_DEDUPLICACION_MS = 4000;

export const audios = {
  ticks: [new Audio('source/sonido3.ogg'), new Audio('source/sonido3.ogg'), new Audio('source/sonido3.ogg')],
  red: new Audio('source/sonidoreddead.ogg'),
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
  segundaTablaOptionIds: new Set(),
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
  ultimoTickSpinTime: 0,
  eventoActivo: false
};