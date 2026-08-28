import {
  state,
  MIN_TICK_GAP_MS,
  UMBRAL_CAMBIO_MODO_MS,
  audios,
  EVENT_CHANCE,
  EVENT_PERK_PREFIXES,
  EVENT_COPIES_PER_PERK,
  lightColorsNormal,
  lightColorsEvento,
  EVENTO_DECOY_DURATION_MS,
  EVENTO_GLITCH_DURATION_MS,
} from './config.js';
import { obtenerColorSector, obtenerIndiceBajoPuntero, mezclarSinAdyacentesIguales } from './utils.js';

// Misma fórmula exacta de easing que usa wheeldecide.com en su wheel.js real.
function easeOut(t, b, c, d) {
  const ts = (t /= d) * t;
  const tc = ts * t;
  return b + c * (tc + -3 * ts + 3 * t);
}

const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');
const wheelWrap = document.querySelector('.wheel-wrap');

const diamondImg = document.getElementById('diamondImg');
const centerDiamondWrapper = document.querySelector('.center-diamond-wrapper');
const spinHint = document.querySelector('.spin-hint');
const wheelDarkOverlay = document.getElementById('wheelDarkOverlay');
const mysteryDiamondImg = document.getElementById('mysteryDiamondImg');

const winnerOverlay = document.getElementById('winnerOverlay');
const winnerImg = document.getElementById('winnerImg');
const winnerText = document.getElementById('winnerText');

function reproducirTick() {
  const canal = audios.ticks.find((a) => a.paused || a.ended);
  if (!canal) return;

  canal.currentTime = 0;
  canal.play().catch(() => {});
}

export function dibujarRuleta() {
  const dpr = window.devicePixelRatio || 1;
  const baseSize = 1202;
  canvas.width = baseSize * dpr;
  canvas.height = baseSize * dpr;
  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  const outerRadius = baseSize / 2;
  ctx.clearRect(0, 0, baseSize, baseSize);

  const n = state.options.length;
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

  const anglePer = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    const startAngle = i * anglePer;
    ctx.beginPath();
    ctx.moveTo(outerRadius, outerRadius);
    ctx.arc(outerRadius, outerRadius, outerRadius, startAngle, startAngle + anglePer);
    ctx.fillStyle = obtenerColorSector(i);
    ctx.fill();

    ctx.strokeStyle = state.eventoActivo ? '#000000' : '#ffffff'; 
    ctx.lineWidth = 2; // O usa '0' si quieres borrar la línea por completo
    ctx.stroke();

    ctx.save();
    ctx.translate(outerRadius, outerRadius);
    ctx.rotate(startAngle + anglePer / 2 + Math.PI);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = state.eventoActivo ? '#ffffff' : '#000000';
    ctx.font = '900 32px Montserrat, sans-serif';
    let label = state.options[i].name;
    if (label.length > 22) label = label.slice(0, 21) + '…';
    ctx.fillText(label, -(outerRadius - 55), 0);
    ctx.restore();
  }

  ctx.shadowBlur = 0;
  for (let i = 0; i < n; i++) {
    const angle = i * anglePer;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = -1;
    ctx.beginPath();
    ctx.moveTo(outerRadius, outerRadius);
    ctx.lineTo(outerRadius + outerRadius * Math.cos(angle), outerRadius + outerRadius * Math.sin(angle));
    //ctx.stroke();
    ctx.restore();
  }
}

export function dibujarOverlayEstatico() {
  const dpr = window.devicePixelRatio || 1;
  const baseSize = 1202;
  overlayCanvas.width = baseSize * dpr;
  overlayCanvas.height = baseSize * dpr;
  overlayCtx.resetTransform();
  overlayCtx.scale(dpr, dpr);

  const cx = baseSize / 2;
  overlayCtx.clearRect(0, 0, baseSize, baseSize);
  overlayCtx.save();
  overlayCtx.beginPath();
  overlayCtx.arc(cx, cx, cx, 0, 2 * Math.PI);
  overlayCtx.clip();

  const lightColors = state.eventoActivo ? lightColorsEvento : lightColorsNormal;
  const conicGradient = overlayCtx.createConicGradient(0, cx, cx);
  lightColors.forEach((color, i) => conicGradient.addColorStop(i / lightColors.length, color));
  conicGradient.addColorStop(1, lightColors[0]);

  overlayCtx.globalAlpha = 0.8;
  overlayCtx.filter = 'blur(4px)';
  overlayCtx.strokeStyle = conicGradient;
  overlayCtx.lineWidth = 12;
  overlayCtx.beginPath();
  overlayCtx.arc(cx, cx, cx - 10, 0, 2 * Math.PI);
  overlayCtx.stroke();

  overlayCtx.filter = 'blur(20px)';
  overlayCtx.strokeStyle = 'rgba(0, 0, 0, 0.80)';
  overlayCtx.lineWidth = 44;
  overlayCtx.beginPath();
  overlayCtx.arc(cx, cx, cx - 18, 0, 2 * Math.PI);
  overlayCtx.stroke();
  overlayCtx.restore();
}

function actualizarRomboSegunRotacion(rotationDeg, spinTimeActual = null) {
  if (!state.options.length) return;
  const idx = obtenerIndiceBajoPuntero(rotationDeg, state.options.length);
  const opt = state.options[idx];


  const activo = spinTimeActual !== null && state.spinning && !winnerOverlay.classList.contains('active');


  const intentarTick = () => {
    if (spinTimeActual - state.ultimoTickSpinTime < MIN_TICK_GAP_MS) return;
    reproducirTick();
    state.ultimoTickSpinTime = spinTimeActual;
  };

  if (opt.name !== state.lastSoundOptionName) {
    if (activo) {
      const gap = spinTimeActual - state.ultimoCambioSpinTime;
      state.ultimoCambioSpinTime = spinTimeActual;

      if (state.modoConstante) {
        state.intervaloActual = Math.min(UMBRAL_CAMBIO_MODO_MS, Math.max(MIN_TICK_GAP_MS, gap));
        if (gap >= UMBRAL_CAMBIO_MODO_MS) {
          state.modoConstante = false;
        }
      }

      // Modo sincronizado: el tick suena justo en el cambio de opción.
      if (!state.modoConstante) {
        intentarTick();
      }
    }
    state.lastSoundOptionName = opt.name;
  }

  // Modo constante: el tick suena cada state.intervaloActual ms (empieza en
  // MIN_TICK_GAP_MS y va subiendo), sin importar si cambió la opción en
  // este paso o no.
  if (activo && state.modoConstante && spinTimeActual - state.ultimoTickSpinTime >= state.intervaloActual) {
    intentarTick();
  }

  diamondImg.src = opt.img;
  diamondImg.style.display = 'block';
}

export function actualizarEstadoRuleta() {
  dibujarRuleta();
  if (state.options.length > 0) {
    actualizarRomboSegunRotacion(state.currentRotation);
  } else {
    diamondImg.style.display = 'none';
    diamondImg.src = '';
    state.lastSoundOptionName = null;
  }
}

export function iniciarGiroEnEspera() {
  if (state.idleAnimationId) cancelAnimationFrame(state.idleAnimationId);
  function idleStep() {
    if (!state.spinning && !state.dragging && state.options.length >= 2 && spinHint.classList.contains('hidden') === false) {
      state.currentRotation += 0.15;
      canvas.style.transform = `rotate(${state.currentRotation}deg)`;
      actualizarRomboSegunRotacion(state.currentRotation);
    }
    state.idleAnimationId = requestAnimationFrame(idleStep);
  }
  state.idleAnimationId = requestAnimationFrame(idleStep);
}

function detenerGiro() {
  state.spinning = false;
  const winnerIndex = obtenerIndiceBajoPuntero(state.currentRotation, state.options.length);
  const winner = state.options[winnerIndex];
  winnerImg.src = winner.img;
  winnerText.textContent = `¡${winner.name}!`;
  const normalizedName = winner.name.trim().toLowerCase();
  
  if (normalizedName.startsWith('me la pela') || normalizedName.startsWith('slot vacío')|| normalizedName.startsWith('objeto de obsesión')) audios.red.play().catch(()=>{});
  else audios.win.play().catch(()=>{});


  winnerOverlay.classList.add('active');
  centerDiamondWrapper.classList.add('hidden');
  state.lastSoundOptionName = null;
  diamondImg.src = winner.img;
}


let opcionesNormalesBackup = null;

function obtenerCatalogoParaEvento() {
  const combinado = [...(state.dbPerks || []), ...(state.options || [])];
  const vistos = new Set();
  const resultado = [];
  combinado.forEach((p) => {
    if (!p || !p.name) return;
    const clave = p.name.trim().toLowerCase();
    if (vistos.has(clave)) return;
    vistos.add(clave);
    resultado.push(p);
  });
  return resultado;
}

function buscarPerkEvento(prefijo) {
  const objetivo = prefijo.trim().toLowerCase();
  // Devuelve un array con TODAS las coincidencias (base + donaciones)
  return obtenerCatalogoParaEvento().filter((p) => p && p.name && p.name.trim().toLowerCase().startsWith(objetivo));
}

function construirOpcionesEvento() {
  // flatMap aplanarás los sub-arrays devueltos por .filter()
  const perksEncontrados = EVENT_PERK_PREFIXES.flatMap(buscarPerkEvento).filter(Boolean);
  if (perksEncontrados.length === 0) return null;

  const opciones = [];
  perksEncontrados.forEach((perk) => {
    // Ahora 'perk' es un objeto individual válido
    for (let i = 0; i < EVENT_COPIES_PER_PERK; i++) {
      opciones.push(perk);
    }
  });

  const mezcladas = mezclarSinAdyacentesIguales(opciones);
  return mezcladas || opciones; // Retorna sin mezclar en caso de fallback para evitar undefined
}

function activarModoEvento() {
  const opcionesEvento = construirOpcionesEvento();
  if (!opcionesEvento) return false;

  opcionesNormalesBackup = state.options;
  state.options = opcionesEvento;
  state.eventoActivo = true;
  wheelWrap?.classList.add('evento-activo');
  dibujarRuleta();
  dibujarOverlayEstatico();
  return true;
}

// Revierte el modo evento a la normalidad: restaura state.options,
// apaga el flag y la clase CSS, y redibuja. Es un no-op si el evento
// ya estaba apagado (así se puede llamar "por las dudas" sin chequear).
function desactivarModoEvento() {
  if (!state.eventoActivo) return;
  if (opcionesNormalesBackup) state.options = opcionesNormalesBackup;
  opcionesNormalesBackup = null;
  state.eventoActivo = false;
  wheelWrap?.classList.remove('evento-activo');
  dibujarRuleta();
  dibujarOverlayEstatico();
}

// Cada giro nuevo (real o señuelo) arranca el conteo de ticks desde cero.
function prepararVariablesDeSonido() {
  state.modoConstante = true;
  state.intervaloActual = MIN_TICK_GAP_MS;
  state.ultimoCambioSpinTime = 0;
  state.ultimoTickSpinTime = 0;
  state.lastSoundOptionName = null;
}

// El giro "de verdad": misma física de siempre (15s, easeOut de
// wheeldecide.com), termina en detenerGiro() y revela un ganador. Se usa
// tanto para un giro normal como para el giro real del evento (una vez
// que ya se hizo el swap de opciones/paleta).
function ejecutarGiroReal() {
  prepararVariablesDeSonido();

  const spinAngleStart = Math.random() * 30 + 20;
  const spinTimeTotal = 15000; // igual que wheeldecide.com (minTimeToSpin = 15)
  let spinTime = 0;

  function rotarPaso() {
    if (!state.spinning) return;
    spinTime += 30;
    if (spinTime >= spinTimeTotal) { detenerGiro(); return; }

    // Misma fórmula exacta que usa wheeldecide.com para la velocidad de
    // cada paso: spinAngleStart menos la posición ya recorrida según la
    // curva cúbica de easeOut.
    const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
    state.currentRotation += spinAngle;
    canvas.style.transform = `rotate(${state.currentRotation}deg)`;

    actualizarRomboSegunRotacion(state.currentRotation, spinTime);
    state.animationFrameId = setTimeout(rotarPaso, 30);
  }
  state.animationFrameId = setTimeout(rotarPaso, 30);
}

// El giro "señuelo": misma mecánica de easeOut pero mucho más corto
// (EVENTO_DECOY_DURATION_MS) y con la rueda todavía en modo normal —
// no termina en un ganador, sino que llama a alTerminar() cuando la
// rueda queda quieta, para encadenar el efecto de flash+glitch.
function ejecutarGiroSenuelo(alTerminar) {
  prepararVariablesDeSonido();

  const spinAngleStart = Math.random() * 20 + 15;
  const spinTimeTotal = EVENTO_DECOY_DURATION_MS;
  let spinTime = 0;

  function rotarPaso() {
    if (!state.spinning) return;
    spinTime += 30;
    if (spinTime >= spinTimeTotal) { alTerminar(); return; }

    const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
    state.currentRotation += spinAngle;
    canvas.style.transform = `rotate(${state.currentRotation}deg)`;

    actualizarRomboSegunRotacion(state.currentRotation, spinTime);
    state.animationFrameId = setTimeout(rotarPaso, 30);
  }
  state.animationFrameId = setTimeout(rotarPaso, 30);
}

export function iniciarGiro() {
  if (state.spinning || state.options.length < 2) return;
  state.spinning = true;
  winnerOverlay.classList.remove('active');
  centerDiamondWrapper.classList.remove('hidden');
  spinHint.classList.add('hidden');
  wheelDarkOverlay.classList.add('hidden');
  mysteryDiamondImg.classList.add('hidden');

  const esEvento = Math.random() < EVENT_CHANCE;

  if (!esEvento) {
    ejecutarGiroReal();
    return;
  }

  // Secuencia de evento: giro señuelo (normal) -> desacelera fluido hasta
  // frenar del todo -> flash+glitch breve -> recién ahí swap a paleta/
  // opciones de evento -> arranca el giro real de verdad.
  ejecutarGiroSenuelo(() => {
    wheelWrap?.classList.add('evento-flash');
    setTimeout(() => {
      wheelWrap?.classList.remove('evento-flash');

      // Si en el medio el usuario canceló el giro (click durante el
      // señuelo o el flash), no forzamos el arranque del evento.
      if (!state.spinning) return;

      // Si ninguno de los 4 perks fijos existe hoy en la base, seguimos
      // en modo normal para no romper el giro.
      activarModoEvento();
      ejecutarGiroReal();
    }, EVENTO_GLITCH_DURATION_MS);
  });
}

export function setupWheelEventListeners() {
  winnerOverlay.addEventListener('click', () => {
    winnerOverlay.classList.remove('active');
    centerDiamondWrapper.classList.remove('hidden');
    spinHint.classList.add('hidden');
    wheelDarkOverlay.classList.add('hidden');
    mysteryDiamondImg.classList.add('hidden');
    desactivarModoEvento();
    iniciarGiro();
  });

  const obtenerCentro = () => { const r = canvas.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; };
  const obtenerAngulo = (x, y) => { const c = obtenerCentro(); return Math.atan2(y - c.y, x - c.x) * (180/Math.PI); };

  canvas.addEventListener('pointerdown', (e) => {
    if (state.spinning) {
      state.spinning = false;
      if (state.animationFrameId) clearTimeout(state.animationFrameId);
      desactivarModoEvento();
      spinHint.classList.remove('hidden');
      wheelDarkOverlay.classList.remove('hidden');
      mysteryDiamondImg.classList.remove('hidden');
      return;
    }
    if (state.options.length < 2) return;
    state.dragging = true;
    state.hasMoved = false;
    winnerOverlay.classList.remove('active');
    centerDiamondWrapper.classList.remove('hidden');
    spinHint.classList.add('hidden');
    wheelDarkOverlay.classList.add('hidden');
    mysteryDiamondImg.classList.add('hidden');
    canvas.setPointerCapture(e.pointerId);
    state.dragStartAngle = obtenerAngulo(e.clientX, e.clientY);
    state.dragStartRotation = state.currentRotation;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const delta = obtenerAngulo(e.clientX, e.clientY) - state.dragStartAngle;
    if (Math.abs(delta) > 3) state.hasMoved = true;
    if (state.hasMoved) {
      state.currentRotation = state.dragStartRotation + delta;
      canvas.style.transform = `rotate(${state.currentRotation}deg)`;
      actualizarRomboSegunRotacion(state.currentRotation);
    }
  });

  canvas.addEventListener('pointerup', () => {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.hasMoved) {
      state.spinning = false;
      spinHint.classList.remove('hidden');
      wheelDarkOverlay.classList.remove('hidden');
      mysteryDiamondImg.classList.remove('hidden');
    } else {
      iniciarGiro();
    }
  });

  window.addEventListener('resize', () => { dibujarRuleta(); dibujarOverlayEstatico(); });
}