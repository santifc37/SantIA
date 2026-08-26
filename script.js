(function initStageScaler() {
  const DESIGN_W = 1920;
  const DESIGN_H = 1020;

  function aplicarEscala() {
    const scaler = document.getElementById('stageScaler');
    if (!scaler) return;

    const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
    scaler.style.transform = `scale(${scale})`;
  }

  aplicarEscala();
  window.addEventListener('resize', aplicarEscala);
  window.addEventListener('orientationchange', aplicarEscala);
})();

const crearUriSvgLimpia = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
const CUSTOM_PERK_ICON = crearUriSvgLimpia('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#a259ff"/><circle cx="50" cy="50" r="30" fill="#ffea00"/></svg>');
let animationFrameId = null; // Para guardar la referencia del giro activo
let idleAnimationId = null;  // Referencia para el giro lento de espera


const tickPool = [
  new Audio('source/sonido3.ogg'),
  new Audio('source/sonido3.ogg'),
  new Audio('source/sonido3.ogg')
];

const MIN_TICK_GAP_MS = 85;
let ultimoTiempoTick = 0; 

const redSound = new Audio('source/sonidoreddead.mp3');
const winSound = new Audio('source/winner.ogg');
// Variables globales para la lista completa y la ruleta
let dbPerks = [];
let options = [];
let donationOptionIds = new Set(); 

// Mezcla un array in-place (Fisher-Yates)
function mezclarArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
const wheelPattern = ['#FFFFFF', '#FFEA00', '#FFFFFF', '#0033CC', '#FFFFFF', '#E60000'];
function obtenerColorSector(i) {
  return wheelPattern[i % wheelPattern.length];
}
// Reordena las opciones de forma aleatoria, pero evitando que dos opciones
// con el mismo nombre queden en posiciones consecutivas de la rueda,
// y repartiendo cada grupo de forma pareja alrededor de todo el círculo.
function mezclarSinAdyacentesIguales(arr) {
  const n = arr.length;
  if (n <= 1) return arr.slice();

  // Agrupamos por nombre
  const grupos = {};
  arr.forEach(item => {
    if (!grupos[item.name]) grupos[item.name] = [];
    grupos[item.name].push(item);
  });

  // Mezclamos el orden interno de cada grupo, y el orden entre grupos
  const claves = Object.keys(grupos);
  claves.forEach(k => mezclarArray(grupos[k]));
  mezclarArray(claves);

  // De mayor a menor cantidad: el grupo más repetido se reparte primero,
  // así queda lo más separado posible por toda la rueda
  const gruposOrdenados = claves
    .map(k => grupos[k])
    .sort((a, b) => b.length - a.length);

  // Distribuye 'c' elementos lo más parejo posible entre 'total' posiciones
  // (mismo principio que un algoritmo de trazado de línea tipo Bresenham)
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

    // Asignamos de atrás hacia adelante para no invalidar los índices
    // ya calculados al ir sacando posiciones de la lista libre
    for (let i = indicesElegidos.length - 1; i >= 0; i--) {
      const idxEnLibres = indicesElegidos[i];
      const posReal = posicionesLibres[idxEnLibres];
      resultado[posReal] = grupo[i];
      posicionesLibres.splice(idxEnLibres, 1);
    }
  }

  return resultado;
}

// ===================================================================
// PRECARGA DE IMÁGENES DEL MENÚ (todas las páginas) + BARRA DE PROGRESO
// ===================================================================
// Descarga en paralelo (Promise.all) todas las imágenes WebP que vienen
// de la API/base de datos, para que cuando se muestre la interfaz ya
// estén en la caché del navegador y no haya parpadeos ni layout shift
// al pasar de página en el panel de opciones predeterminadas.
const loadingBarFill = document.getElementById('loadingBarFill');
const loadingPercent = document.getElementById('loadingPercent');

function actualizarProgresoCarga(porcentaje) {
  if (loadingBarFill) loadingBarFill.style.width = `${porcentaje}%`;
  if (loadingPercent) loadingPercent.textContent = `${porcentaje}%`;
}

function precargarImagenes(urls) {
  return new Promise((resolve) => {
    // Quitamos duplicados y vacíos: varias perks pueden compartir imagen
    const urlsUnicas = [...new Set(urls.filter(Boolean))];
    const total = urlsUnicas.length;

    if (total === 0) {
      actualizarProgresoCarga(100);
      resolve();
      return;
    }

    let procesadas = 0;
    actualizarProgresoCarga(0);

    function marcarComoProcesada() {
      procesadas++;
      const porcentaje = Math.round((procesadas / total) * 100);
      actualizarProgresoCarga(porcentaje);

      // Cuando terminan todas (con éxito o con error) resolvemos la promesa
      if (procesadas === total) resolve();
    }

    const promesas = urlsUnicas.map(url => new Promise((resolveImg) => {
      const img = new Image();

      img.onload = () => {
        marcarComoProcesada();
        resolveImg();
      };

      // Si una imagen falla (404, red, etc.) NO se cuelga la pantalla:
      // se cuenta igual como "procesada" y se sigue adelante.
      img.onerror = () => {
        console.warn('No se pudo precargar la imagen:', url);
        marcarComoProcesada();
        resolveImg();
      };

      img.src = url;
    }));

    Promise.all(promesas).then(() => resolve());
  });
}

function ocultarPantallaCarga() {
  if (!loadingOverlay) return;

  // Fade out suave vía CSS (opacity + visibility, ver .loading-overlay.hidden)
  loadingOverlay.classList.add('hidden');

  setTimeout(() => {
    loadingOverlay.style.display = 'none';
  }, 400);
}

async function cargarPerksDesdeBaseDatos() {
  try {
    const response = await fetch('/api/perks');

    if (!response.ok) {
      throw new Error(`Error en el servidor: ${response.status}`);
    }

    const data = await response.json();

    // Mapeamos TODO, incluyendo el campo 'active'
    dbPerks = data.map(item => ({
      id: item.id,
      name: item.name,
      alias: item.name2 || '',
      img: item.image || CUSTOM_PERK_ICON,
      active: item.active
    }));

    // SOLO las perks predeterminadas activas
    options = dbPerks.filter(perk => perk.active === true);

    renderizarListaOpciones();
    actualizarEstadoRuleta();

    // Precargamos en paralelo TODAS las imágenes del menú (las de todas
    // las páginas de dbList, no solo la página actual) antes de mostrar
    // la interfaz, para evitar parpadeos/saltos de diseño.
    const urlsImagenesMenu = dbPerks.map(perk => perk.img);
    await precargarImagenes(urlsImagenesMenu);

    ocultarPantallaCarga();

  } catch (error) {
    console.error('Error al cargar perks:', error);
    // Si algo falla, igual ocultamos el loader para que la pantalla
    // nunca se quede colgada mostrando "Cargando..." para siempre.
    ocultarPantallaCarga();
  }
}

const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const loadingOverlay = document.getElementById('loadingOverlay');
const dbList = document.getElementById('dbList');
const searchInput = document.getElementById('searchInput');
const diamondImg = document.getElementById('diamondImg');
const centerDiamondWrapper = document.querySelector('.center-diamond-wrapper');
const spinHint = document.querySelector('.spin-hint');
const wheelDarkOverlay = document.getElementById('wheelDarkOverlay');
const mysteryDiamondImg = document.getElementById('mysteryDiamondImg');
const perkTooltip = document.getElementById('perkTooltip');

const winnerOverlay = document.getElementById('winnerOverlay');
const winnerImg = document.getElementById('winnerImg');
const winnerText = document.getElementById('winnerText');

const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');

let currentPage = 1;
const itemsPerPage = 15;

const removeModalOverlay = document.getElementById('removeModalOverlay');
const removeModalText = document.getElementById('removeModalText');
const removeModalCancelBtn = document.getElementById('removeModalCancelBtn');
const removeModalConfirmBtn = document.getElementById('removeModalConfirmBtn');
let perkPendingRemoval = null;

let currentRotation = 0;
let spinning = false;

// Control unificado de sonido y cambio de opción
let lastSoundOptionName = null;

// Configuras el volumen una sola vez al inicio

function reproducirTick() {
  const ahora = performance.now();

  // THROTTLING (limitador de velocidad): si la ruleta cruza una opción
  // más rápido que este piso, se omite el tick para que no se solapen
  // y saturen las ondas de audio.
  if (ahora - ultimoTiempoTick < MIN_TICK_GAP_MS) {
    return;
  }
  ultimoTiempoTick = ahora;

  // Buscamos un canal que ya haya terminado de sonar. Reutilizar uno que
  // sigue reproduciéndose (currentTime = 0 a la fuerza) corta el final de
  // ese sonido justo cuando empieza el nuevo, y eso se oye como un "clic
  // doble". Si los 3 están ocupados, mejor omitir este tick que solaparlo.
  const canal = tickPool.find((a) => a.paused || a.ended);
  if (!canal) return;

  canal.currentTime = 0;
  canal.play().catch(() => {});
}
function reproducirTRed() {
  const soundClone = redSound.cloneNode();
  soundClone.volume = 0.6;
  // Si el navegador bloquea el autoplay por falta de interacción previa, se ignora
  soundClone.play().catch(() => {});
}
function reproducirwin() {
  const soundClone = winSound.cloneNode();
  soundClone.volume = 0.2;
  // Si el navegador bloquea el autoplay por falta de interacción previa, se ignora
  soundClone.play().catch(() => {});
}

function actualizarRombo(opt) {
  if (!opt) return;

  // Si cambia de opción, hace sonar el tick
  if (opt.name !== lastSoundOptionName) {
    if (!winnerOverlay.classList.contains('active') && spinning) {
      reproducirTick();
    }
    lastSoundOptionName = opt.name;
  }

  diamondImg.src = opt.img;
  diamondImg.style.display = 'block';
}

function actualizarRomboSegunRotacion(rotationDeg) {
  if (!options.length) return;
  const idx = obtenerIndiceBajoPuntero(rotationDeg, options.length);
  actualizarRombo(options[idx]);
}

function obtenerPerksFiltradas() {
  const filter = searchInput.value.toLowerCase().trim();
  if (!filter) return dbPerks;

  return dbPerks.filter(perk => {
    const matchesName = perk.name.toLowerCase().includes(filter);
    const matchesAlias = perk.alias.toLowerCase().includes(filter);
    return matchesName || matchesAlias;
  });
}

function renderizarListaOpciones() {
  const filteredPerks = obtenerPerksFiltradas();

  const totalPages = Math.ceil(filteredPerks.length / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredPerks.slice(startIndex, startIndex + itemsPerPage);

  dbList.innerHTML = '';

  currentItems.forEach(perk => {
    const wrap = document.createElement('div');
    wrap.className = 'db-perk-wrap';

    const card = document.createElement('div');
    card.className = 'db-perk-card';

    const img = document.createElement('img');
    img.src = perk.img;
    card.appendChild(img);
    wrap.appendChild(card);

    const isInWheel = options.some(opt => opt.name.trim().toLowerCase() === perk.name.trim().toLowerCase());
    if (isInWheel) {
      const removeBtn = document.createElement('div');
      removeBtn.className = 'db-perk-remove';
      removeBtn.textContent = '✕';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.zIndex = '10';

      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirModalEliminar(perk);
      });
      wrap.appendChild(removeBtn);
    }

    card.addEventListener('mouseenter', (e) => {
      perkTooltip.textContent = perk.alias ? `${perk.name} (${perk.alias})` : perk.name;
      perkTooltip.style.display = 'block';
      actualizarPosicionTooltip(e);
    });
    card.addEventListener('mousemove', (e) => actualizarPosicionTooltip(e));
    card.addEventListener('mouseleave', () => perkTooltip.style.display = 'none');

    card.addEventListener('click', () => {
      perkTooltip.style.display = 'none';
      agregarOpcionARuleta(perk);
    });

    dbList.appendChild(wrap);
  });

  pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
}

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderizarListaOpciones();
  }
});

nextPageBtn.addEventListener('click', () => {
  const filteredPerks = obtenerPerksFiltradas();
  const totalPages = Math.ceil(filteredPerks.length / itemsPerPage) || 1;

  if (currentPage < totalPages) {
    currentPage++;
    renderizarListaOpciones();
  }
});

function actualizarPosicionTooltip(e) {
  const padding = 12;
  let x = e.clientX + padding;
  let y = e.clientY + padding;

  if (x + perkTooltip.offsetWidth > window.innerWidth) x = e.clientX - perkTooltip.offsetWidth - padding;
  if (y + perkTooltip.offsetHeight > window.innerHeight) y = e.clientY - perkTooltip.offsetHeight - padding;

  perkTooltip.style.left = `${x}px`;
  perkTooltip.style.top = `${y}px`;
}

async function agregarOpcionARuleta(perkObj) {
  if (spinning) return;

  options.push(perkObj);

  if (perkObj.id) {
    const foundPerk = dbPerks.find(p => p.id === perkObj.id);
    if (foundPerk) foundPerk.active = true;
  }

  actualizarEstadoRuleta();
  renderizarListaOpciones();

  if (perkObj.id) {
    fetch(`/api/perks?id=${perkObj.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true })
    })
    .catch(err => {
      console.error('El guardado en segundo plano falló:', err);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const fxVideo = document.getElementById("ruletaFxVideo");

  if (!fxVideo) return;

  // Función para reproducir el efecto
  function dispararEfecto() {
    // Reinicia el video al segundo 0 por si acaso
    fxVideo.currentTime = 0;
    
    // Reproduce el video
    fxVideo.play().catch(error => {
      // Los navegadores a veces bloquean el autoplay si no hay interacción previa,
      // esto evita que la consola arroje errores molestos.
      console.log("Reproducción automática prevenida por el navegador:", error);
    });
  }

  // Ejecuta el efecto por primera vez al cargar
  dispararEfecto();

  // Configura el intervalo para que se repita cada 5000 milisegundos (5 segundos)
  setInterval(dispararEfecto, 5000);
});

function abrirModalEliminar(perk) {
  if (spinning) return;
  perkPendingRemoval = perk;
  removeModalText.textContent = `¿Seguro que quieres quitar "${perk.name}" de la ruleta?`;
  removeModalOverlay.classList.add('active');
}

function cerrarModalEliminar() {
  removeModalOverlay.classList.remove('active');
  perkPendingRemoval = null;
}

removeModalCancelBtn.addEventListener('click', cerrarModalEliminar);
removeModalOverlay.addEventListener('click', (e) => {
  if (e.target === removeModalOverlay) cerrarModalEliminar();
});
removeModalConfirmBtn.addEventListener('click', () => {
  if (perkPendingRemoval) {
    quitarOpcionDeRuleta(perkPendingRemoval);
  }
  cerrarModalEliminar();
});

async function quitarOpcionDeRuleta(perk) {
  const normalizedName = perk.name.trim().toLowerCase();
  options = options.filter(opt => opt.name.trim().toLowerCase() !== normalizedName);

  const foundPerk = dbPerks.find(p => p.id === perk.id);
  if (foundPerk) foundPerk.active = false;

  actualizarEstadoRuleta();
  renderizarListaOpciones();

  if (perk.id) {
    fetch(`/api/perks?id=${perk.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false })
    })
    .catch(err => {
      console.error('No se pudo guardar el cambio en Supabase:', err);
    });
  }
}

searchInput.addEventListener('input', () => {
  currentPage = 1;
  renderizarListaOpciones();
});

function actualizarEstadoRuleta() {
  dibujarRuleta();

  if (options.length > 0) {
    actualizarRomboSegunRotacion(currentRotation);
  } else {
    diamondImg.style.display = 'none';
    diamondImg.src = '';
    lastSoundOptionName = null;
  }
}

function obtenerIndiceBajoPuntero(rotationDeg, n) {
  const anglePer = 360 / n;
  const displayRotation = ((rotationDeg % 360) + 360) % 360;
  const sliceAngle = ((180 - displayRotation) % 360 + 360) % 360;
  return Math.floor(sliceAngle / anglePer) % n;
}

// CANVAS 1: Dibuja la ruleta
function dibujarRuleta() {
  const dpr = window.devicePixelRatio || 1;
  const baseSize = 1202; // +2 = +1px de radio en la circunferencia

  canvas.width = baseSize * dpr;
  canvas.height = baseSize * dpr;

  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  const outerRadius = baseSize / 2;
  ctx.clearRect(0, 0, baseSize, baseSize);

  const n = options.length;
  if (n === 0) {
    ctx.beginPath();
    ctx.arc(outerRadius, outerRadius, outerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#14101c';
    ctx.fill();
    ctx.fillStyle = '#888';
    ctx.font = '750 38px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Ruleta Vacía', outerRadius, outerRadius);
    return;
  }

  const radius = outerRadius;
  const cx = outerRadius;
  const cy = outerRadius;
  const anglePer = (2 * Math.PI) / n;

  for (let i = 0; i < n; i++) {
    const startAngle = i * anglePer;
    const endAngle = startAngle + anglePer;
    const color = obtenerColorSector(i);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + anglePer / 2 + Math.PI);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#000000';
    ctx.font = '900 32px Montserrat, sans-serif';

    let label = options[i].name;
    if (label.length > 22) label = label.slice(0, 21) + '…';

    ctx.fillText(label, -(radius - 55), 0);
    ctx.restore();
  }

  ctx.shadowBlur = 0;
  for (let i = 0; i < n; i++) {
    const angle = i * anglePer;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.stroke();
    ctx.restore();
  }
}

// CANVAS 2: Overlay estático
const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');

function dibujarOverlayEstatico() {
  const dpr = window.devicePixelRatio || 1;
  const baseSize = 1202; // debe coincidir con dibujarRuleta()

  overlayCanvas.width = baseSize * dpr;
  overlayCanvas.height = baseSize * dpr;

  overlayCtx.resetTransform();
  overlayCtx.scale(dpr, dpr);

  const outerRadius = baseSize / 2;
  const cx = outerRadius;
  const cy = outerRadius;
  const radius = outerRadius;

  overlayCtx.clearRect(0, 0, baseSize, baseSize);
  overlayCtx.save();

  overlayCtx.beginPath();
  overlayCtx.arc(cx, cy, radius, 0, 2 * Math.PI);
  overlayCtx.clip();

  const lightColors = ['#00ff66', '#ffea00', '#ff2a2a', '#00a2ff'];
  const conicGradient = overlayCtx.createConicGradient(0, cx, cy);
  const total = lightColors.length;
  lightColors.forEach((color, i) => {
    conicGradient.addColorStop(i / total, color);
  });
  conicGradient.addColorStop(1, lightColors[0]);
  overlayCtx.globalAlpha = 0.8;

  overlayCtx.filter = 'blur(4px)';
  overlayCtx.strokeStyle = conicGradient;
  overlayCtx.lineWidth = 12;
  overlayCtx.beginPath();
  overlayCtx.arc(cx, cy, radius - 10, 0, 2 * Math.PI);
  overlayCtx.stroke();

  overlayCtx.filter = 'blur(2px)';
  overlayCtx.strokeStyle = conicGradient;
  overlayCtx.lineWidth = 6;
  overlayCtx.beginPath();
  overlayCtx.arc(cx, cy, radius - 4, 0, 2 * Math.PI);
  overlayCtx.stroke();

  overlayCtx.filter = 'blur(20px)';
  overlayCtx.strokeStyle = 'rgba(0, 0, 0, 0.80)';
  overlayCtx.lineWidth = 44;
  overlayCtx.beginPath();
  overlayCtx.arc(cx, cy, radius - 18, 0, 2 * Math.PI);
  overlayCtx.stroke();

  overlayCtx.restore();
}

dibujarRuleta();
dibujarOverlayEstatico();
window.addEventListener('resize', () => {
  dibujarRuleta();
  dibujarOverlayEstatico();
});

// FUNCIÓN DE GIRO LENTO EN ESPERA (IDLE)
function iniciarGiroEnEspera() {
  if (idleAnimationId) cancelAnimationFrame(idleAnimationId);

  function idleStep() {
    if (!spinning && !dragging && options.length >= 2 && spinHint.classList.contains('hidden') === false) {
      currentRotation += 0.15;
      canvas.style.transform = `rotate(${currentRotation}deg)`;
      actualizarRomboSegunRotacion(currentRotation);
    }
    idleAnimationId = requestAnimationFrame(idleStep);
  }

  idleAnimationId = requestAnimationFrame(idleStep);
}

iniciarGiroEnEspera();

// Curva de frenado clásica (misma fórmula que usa el script original):
// cúbica, ease-out completo desde el primer instante hasta el final.
// t = tiempo transcurrido, b = valor inicial, c = cambio total, d = duración total.
function easeOut(t, b, c, d) {
  var ts = (t /= d) * t;
  var tc = ts * t;
  return b + c * (tc + -3 * ts + 3 * t);
}

function iniciarGiro() {
  if (spinning) return;
  if (options.length < 2) return;

  spinning = true;
  winnerOverlay.classList.remove('active');
  centerDiamondWrapper.classList.remove('hidden');
  spinHint.classList.add('hidden');
  wheelDarkOverlay.classList.add('hidden');
  mysteryDiamondImg.classList.add('hidden');

  const n = options.length;

  // ---------------------------------------------------------------
  // GIRO, VELOCIDAD Y DETENCIÓN — algoritmo físico real del original
  // (spin / rotateWheelImage / easeOut), SIN ganador prefijado:
  //
  // - spinAngleStart NO es el total de grados a girar: es la velocidad
  //   inicial, en grados que avanza cada paso de 30ms (entre 20 y 50,
  //   aleatorio en cada giro — así cada giro dura lo mismo, 15s, pero
  //   recorre una distancia total distinta).
  // - En cada paso se resta esa velocidad contra una curva easeOut, así
  //   que la velocidad empieza alta y decae de forma continua hasta 0
  //   exactamente cuando spinTime llega a spinTimeTotal.
  // - El ángulo se va ACUMULANDO paso a paso (no se calcula una
  //   posición final de antemano).
  // - Al detenerse, se lee qué opción quedó bajo el puntero según el
  //   ángulo acumulado — el resultado es 100% producto de la física,
  //   no de una opción elegida de antemano.
  // ---------------------------------------------------------------
  const minAngleToStartRotating = 20;
  const angleRange = 30;
  const spinAngleStart = Math.random() * angleRange + minAngleToStartRotating; // 20–50°/paso
  const spinTimeTotal = 15000; // duración total del giro, en ms
  let spinTime = 0;

  function detenerGiro() {
    spinning = false;

    const winnerIndex = obtenerIndiceBajoPuntero(currentRotation, n);
    const winner = options[winnerIndex];

    winnerImg.src = winner.img;
    winnerText.textContent = `¡${winner.name}!`;
    const winnerNameNormalizado = winner.name.trim().toLowerCase();
    console.log('[DEBUG] nombre ganador normalizado:', JSON.stringify(winnerNameNormalizado));
    if (winnerNameNormalizado.startsWith('me la pela') || winnerNameNormalizado.startsWith('slot vacío')) {
      reproducirTRed();
    } else {
      reproducirwin();
    }
    winnerOverlay.classList.add('active');
    centerDiamondWrapper.classList.add('hidden');

    lastSoundOptionName = null;
    actualizarRombo(winner);
  }

  function rotarPaso() {
    if (!spinning) return;

    spinTime += 30;

    if (spinTime >= spinTimeTotal) {
      detenerGiro();
      return;
    }

    const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
    currentRotation += spinAngle;

    canvas.style.transform = `rotate(${currentRotation}deg)`;
    actualizarRomboSegunRotacion(currentRotation);

    animationFrameId = setTimeout(rotarPaso, 30);
  }

  animationFrameId = setTimeout(rotarPaso, 30);
}

winnerOverlay.addEventListener('click', () => {
  winnerOverlay.classList.remove('active');
  centerDiamondWrapper.classList.remove('hidden');
  spinHint.classList.add('hidden');
  wheelDarkOverlay.classList.add('hidden');
  mysteryDiamondImg.classList.add('hidden');
  iniciarGiro();
});

let dragging = false;
let hasMoved = false;
let dragStartAngle = 0;
let dragStartRotation = 0;

function obtenerCentroRuleta() {
  const rect = canvas.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function cancelarGiro() {
  if (!spinning) return;

  spinning = false;
  if (animationFrameId) {
    clearTimeout(animationFrameId);
  }

  spinHint.classList.remove('hidden');
  wheelDarkOverlay.classList.remove('hidden');
  mysteryDiamondImg.classList.remove('hidden');

  detenerRuletaEn(currentRotation);
}

function obtenerAnguloEnPuntero(clientX, clientY) {
  const c = obtenerCentroRuleta();
  return Math.atan2(clientY - c.y, clientX - c.x) * (180 / Math.PI);
}

canvas.addEventListener('pointerdown', (e) => {
  if (spinning) {
    cancelarGiro();
    return;
  }
  if (options.length < 2) return;
  dragging = true;
  hasMoved = false;
  winnerOverlay.classList.remove('active');
  centerDiamondWrapper.classList.remove('hidden');
  spinHint.classList.add('hidden');
  wheelDarkOverlay.classList.add('hidden');
  mysteryDiamondImg.classList.add('hidden');
  canvas.setPointerCapture(e.pointerId);
  dragStartAngle = obtenerAnguloEnPuntero(e.clientX, e.clientY);
  dragStartRotation = currentRotation;
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const nowAngle = obtenerAnguloEnPuntero(e.clientX, e.clientY);
  const delta = nowAngle - dragStartAngle;

  if (Math.abs(delta) > 3) {
    hasMoved = true;
  }

  if (hasMoved) {
    const newRotation = dragStartRotation + delta;
    currentRotation = newRotation;
    canvas.style.transform = `rotate(${newRotation}deg)`;
    actualizarRomboSegunRotacion(newRotation);
  }
});

function detenerRuletaEn(rotation) {
  currentRotation = rotation;
  spinning = false;
  spinHint.classList.remove('hidden');
  wheelDarkOverlay.classList.remove('hidden');
  mysteryDiamondImg.classList.remove('hidden');
}

canvas.addEventListener('pointerup', () => {
  if (!dragging) return;
  dragging = false;

  if (hasMoved) {
    detenerRuletaEn(currentRotation);
  } else {
    iniciarGiro();
  }
});

// ============================
// Streamlabs Socket - Conexión y manejo de eventos
// ============================

async function guardarPerk(nombre, cantidad, perk) {
  try {
    await fetch('/api/guardar-perk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, cantidad: String(cantidad), perk })
    });

    // Recarga la lista automáticamente al guardar con éxito
    if (typeof cargarDonacionesEspeciales === 'function') {
      cargarDonacionesEspeciales();
    }
  } catch (err) {
    console.error('Error guardando perk:', err);
  }
}

// ============================================================
// DEDUPLICACIÓN DE EVENTOS (Fingerprinting + Time-window Debounce)
// ============================================================
// El botón "Test" del dashboard de Streamlabs reenvía el mismo evento
// varias veces en milisegundos de diferencia, y cada copia trae un
// _id/id aleatorio distinto. Como el id no sirve para detectar
// duplicados, generamos una "huella digital" a partir del contenido
// real del evento (nombre + monto + mensaje). Si esa misma huella
// vuelve a aparecer dentro de una ventana corta de tiempo, se descarta
// por ser un duplicado. Funciona igual para eventos de prueba y
// donaciones reales, sin distinguir entorno ni requerir configuración.
// ============================================================

const VENTANA_DEDUPLICACION_MS = 4000; // Cubre ráfagas de "Test" (recomendado: 3000–5000ms)
const huellasRecientes = new Map();    // huella -> id de setTimeout, para poder limpiarla sola

/**
 * Genera una huella digital (fingerprint) determinística a partir de
 * los campos que identifican una donación en la práctica: nombre del
 * donador, monto y mensaje. No depende de _id/id, que Streamlabs
 * randomiza en cada reenvío de prueba.
 *
 * @param {string} nombre - Nombre del donador (o "Anónimo")
 * @param {number|string} monto - Monto donado (crudo o formateado)
 * @param {string} [mensaje] - Mensaje opcional adjunto a la donación
 * @returns {string} Huella normalizada, apta como clave de Map/Set
 */
function generarHuellaEvento(nombre, monto, mensaje = '') {
  const normalizar = (valor) => String(valor ?? '').trim().toLowerCase();
  return `${normalizar(nombre)}|${normalizar(monto)}|${normalizar(mensaje)}`;
}

/**
 * Indica si una huella ya fue procesada dentro de la ventana de
 * deduplicación vigente (VENTANA_DEDUPLICACION_MS). Si es la primera
 * vez que se ve, la registra en memoria y programa su propio borrado
 * automático vía setTimeout, evitando fugas de memoria: la huella
 * nunca vive más de lo que dura la ventana.
 *
 * @param {string} huella - Huella generada por generarHuellaEvento()
 * @returns {boolean} true si es un duplicado y debe ignorarse
 */
function esEventoDuplicado(huella) {
  console.log('[DEBUG] huella generada:', huella, '| ¿ya existe?', huellasRecientes.has(huella));

  if (huellasRecientes.has(huella)) {
    return true;
  }

  const timeoutId = setTimeout(() => {
    huellasRecientes.delete(huella);
  }, VENTANA_DEDUPLICACION_MS);

  huellasRecientes.set(huella, timeoutId);
  return false;
}

function procesarEventoStreamlabs(eventData) {
  // Verificamos si el evento es de tipo donación o de tipo bits
  const esDonacion = !eventData.for || (eventData.for === 'streamlabs' && eventData.type === 'donation');
  const esBits = eventData.type === 'bits';

  if (!esDonacion && !esBits) return;
  if (!Array.isArray(eventData.message)) return;

  eventData.message.forEach((d) => {
    const cantidad = d.formatted_amount || d.amount || 0;

    // Lista única de cantidades válidas (tanto para dólares/donaciones como para bits)
    const cantidadesValidas = [6666, 5555, 4444, 66.66, 55.55, 44.44];

    // Si la cantidad no está en la lista permitida, se ignora por completo
    if (!cantidadesValidas.includes(cantidad)) return;

    const nombre = d.name || d.from || "Anónimo";
    const mensaje = d.message || '';

    // Descarta reenvíos duplicados (p. ej. ráfagas del botón "Test")
    const huella = generarHuellaEvento(nombre, cantidad, mensaje);
    if (esEventoDuplicado(huella)) return;

    let perk = "";

    // Asignamos el perk correspondiente según la cantidad
    switch (cantidad) {
      case 6666:
      case 66.66:
        perk = "1";
        break;
      case 5555:
      case 55.55:
        perk = "2";
        break;
      case 4444:
      case 44.44:
        perk = "3";
        break;
    }

    // Se guarda una sola vez si cumple con los filtros
    guardarPerk(nombre, cantidad, perk);
  });
}

async function cargarDonacionesEspeciales() {
  const list = document.getElementById('donationsList');
  if (!list) return;

  try {
    const res = await fetch('/api/obtener-perks');

    if (!res.ok) {
      throw new Error(`Error en el servidor: ${res.status}`);
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      console.error('Error: la respuesta no es un array', data);
      return;
    }

    // Agregar nuevas donaciones a la ruleta
    let seAgregoAlgunaOpcion = false;

    data.forEach(item => {
      // Si ya fue agregada, no hacemos nada
      if (item.id == null || !item.perksespeciales || donationOptionIds.has(item.id)) {
        return;
      }

      options.push({
        id: `donacion-${item.id}`,
        dbId: item.id,
        name: `${item.perksespeciales.nombre}(${item.nombre})`,
        alias: '',
        img: item.perksespeciales.image || CUSTOM_PERK_ICON,
        isDonation: true
      });

      donationOptionIds.add(item.id);
      seAgregoAlgunaOpcion = true;
    });

    // Actualizar la ruleta si se agregó alguna donación nueva
    if (seAgregoAlgunaOpcion) {
      if (!spinning) {
        options = mezclarSinAdyacentesIguales(options);
      }
      actualizarEstadoRuleta();
    }

    // Actualizar lista de donadores en pantalla
    if (data.length === 0) {
      list.innerHTML = '<li class="empty">SIN PERKS AÑADIDAS...</li>';
    } else {
      list.innerHTML = data.map((item, index) => {
        const nombreEspecial = item.perksespeciales ? item.perksespeciales.nombre : 'Sin perk';

        return `
          <li
            class="donation-item"
            data-id="${item.id}"
            data-expires="${item.expires_at || ''}"
          >
            <span class="donor-info">
              <strong>${item.nombre}</strong> - ${nombreEspecial}
            </span>

            <span
              class="countdown-timer"
              id="timer-${index}"
            >
              Calculando...
            </span>
          </li>
        `;
      }).join('');
    }

    iniciarTimersEnVivo();
    actualizarAutoScrollDonaciones();

  } catch (err) {
    console.error('Error cargando donaciones:', err);
  }
}

// ============================================================
// AUTO-SCROLL DE LA LISTA DE DONACIONES
// El panel (.donations-container) es estático: no cambia de tamaño
// ni de posición. Si los nombres no entran todos en la ventana
// visible (.donations-scroll), la lista se desplaza sola hacia
// abajo y hacia arriba de forma continua, en vez de recortarse.
// ============================================================
let donationsScrollTimeoutId = null;

function actualizarAutoScrollDonaciones() {
  const wrapper = document.getElementById('donationsScroll');
  const list = document.getElementById('donationsList');
  if (!wrapper || !list) return;

  // Cancela cualquier animación anterior en curso
  if (donationsScrollTimeoutId) {
    clearTimeout(donationsScrollTimeoutId);
    donationsScrollTimeoutId = null;
  }

  // Reinicia la posición antes de recalcular
  list.style.transition = 'none';
  list.style.transform = 'translateY(0)';

  // Forzamos reflow para que el navegador aplique el reset antes de medir
  // eslint-disable-next-line no-unused-expressions
  list.offsetHeight;

  const maxScroll = list.scrollHeight - wrapper.clientHeight;

  // Si todos los nombres entran en la ventana visible, no hace falta animar
  if (maxScroll <= 4) return;

  const velocidadPxPorSeg = 28; // qué tan rápido baja/sube
  const pausaMs = 2200;         // pausa arriba y abajo antes de invertir

  let posicionActual = 0;
  let direccion = 1; // 1 = bajando, -1 = subiendo

  function animarPaso() {
    const destino = direccion === 1 ? maxScroll : 0;
    const distancia = Math.abs(destino - posicionActual);
    const duracionMs = Math.max(600, (distancia / velocidadPxPorSeg) * 1000);

    list.style.transition = `transform ${duracionMs}ms linear`;
    list.style.transform = `translateY(-${destino}px)`;
    posicionActual = destino;

    donationsScrollTimeoutId = setTimeout(() => {
      direccion *= -1;
      animarPaso();
    }, duracionMs + pausaMs);
  }

  // Pequeña pausa inicial antes de empezar a moverse
  donationsScrollTimeoutId = setTimeout(animarPaso, pausaMs);
}

// Recalcula el auto-scroll si cambia el tamaño de la ventana
// (el panel usa vh/vw, así que su alto visible puede variar)
window.addEventListener('resize', () => {
  clearTimeout(window.donationsResizeTimeout);
  window.donationsResizeTimeout = setTimeout(actualizarAutoScrollDonaciones, 200);
});

// Función que mantiene los temporizadores activos
function iniciarTimersEnVivo() {
  if (window.timerInterval) clearInterval(window.timerInterval);

  window.timerInterval = setInterval(() => {
    const items = document.querySelectorAll('.donation-item');

    items.forEach((item) => {
      const expiresAt = item.getAttribute('data-expires');
      const donationId = item.getAttribute('data-id');
      const timerSpan = item.querySelector('.countdown-timer');

      if (!expiresAt || !timerSpan) return;

      const ahora = Date.now();
      const tiempoExpiracion = new Date(expiresAt).getTime();
      const diferencia = tiempoExpiracion - ahora;

      if (diferencia <= 0) {
        timerSpan.textContent = 'Expirado';
        if (donationId) eliminarPerkExpirada(donationId, item);
        return;
      }

      const h = String(Math.floor(diferencia / (1000 * 60 * 60))).padStart(2, '0');
      const m = String(Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
      const s = String(Math.floor((diferencia % (1000 * 60)) / 1000)).padStart(2, '0');

      timerSpan.textContent = `${h}:${m}:${s}`;
    });
  }, 1000);
}

// Se ejecuta cuando una donación expira: la saca de la ruleta, de la lista
// en pantalla, y borra la fila correspondiente en Supabase.
async function eliminarPerkExpirada(id, liElement) {
  const numericId = Number(id);

  // Ya se procesó (por ejemplo si el intervalo alcanzó a correr dos veces
  // antes de que se quitara el elemento del DOM)
  if (!donationOptionIds.has(numericId)) return;

  // Quitar de la ruleta
  options = options.filter(opt => opt.dbId !== numericId);
  donationOptionIds.delete(numericId);
  actualizarEstadoRuleta();

  // Quitar de la lista visible
  if (liElement) liElement.remove();
  actualizarAutoScrollDonaciones();

  // Borrar de la base de datos
  try {
    await fetch(`/api/eliminar-perk?id=${numericId}`, { method: 'DELETE' });
  } catch (err) {
    console.error('Error eliminando perk expirada de Supabase:', err);
  }
}

async function iniciarConexionStreamlabs() {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  try {
    const response = await fetch('/api/test-streamlabs');
    const data = await response.json();

    if (!data.ok || !data.token) {
      if (dot) dot.className = 'status-dot offline';
      if (text) text.innerText = 'Sin Token';
      console.error('Error al obtener el token de Streamlabs:', data.mensaje);
      return;
    }

    const streamlabs = io(`https://sockets.streamlabs.com?token=${data.token}`, {
      transports: ['websocket']
    });

    streamlabs.on('connect', () => {
      if (dot) dot.className = 'status-dot online';
      if (text) text.innerText = 'Online';
    });

    streamlabs.on('connect_error', (error) => {
      if (dot) dot.className = 'status-dot offline';
      if (text) text.innerText = 'Offline';
      console.error('Error de conexión con Streamlabs:', error.message || error);
    });

    streamlabs.on('disconnect', () => {
      if (dot) dot.className = 'status-dot offline';
      if (text) text.innerText = 'Offline';
      console.warn('Desconectado de Streamlabs');
    });

    streamlabs.on('event', (eventData) => {
      console.log('[DEBUG] evento crudo recibido de Streamlabs:', eventData);
      procesarEventoStreamlabs(eventData);
    });

  } catch (error) {
    if (dot) dot.className = 'status-dot offline';
    if (text) text.innerText = 'Error API';
    console.error('Error al consultar la API local:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarConexionStreamlabs();
});

await cargarPerksDesdeBaseDatos(); // Carga inicial de perks desde la base de datos
cargarDonacionesEspeciales(); // Carga inicial de donaciones desde la base de datos