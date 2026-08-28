import {
  state,
  MIN_TICK_GAP_MS,
  UMBRAL_CAMBIO_MODO_MS,
  audios,
  EVENT_CHANCE,
  EVENT_PERK_PREFIXES,
  EVENT_COPIES_PER_PERK,
  EVENTO_DECOY_DURATION_MS,
  EVENTO_GLITCH_DURATION_MS,
} from './config.js';
import { obtenerColorSector, obtenerIndiceBajoPuntero, mezclarSinAdyacentesIguales } from './utils.js';
import { notificarCambioModoEvento } from './anilloneon.js'; 

function getWheelElements() {
  const canvas = document.getElementById('wheel');
  if (!canvas) return null;
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    wheelWrap: document.querySelector('.wheel-wrap'),
    diamondImg: document.getElementById('diamondImg'),
    centerDiamondWrapper: document.querySelector('.center-diamond-wrapper'),
    spinHint: document.querySelector('.spin-hint'),
    wheelDarkOverlay: document.getElementById('wheelDarkOverlay'),
    mysteryDiamondImg: document.getElementById('mysteryDiamondImg'),
    winnerOverlay: document.getElementById('winnerOverlay'),
    winnerImg: document.getElementById('winnerImg'),
    winnerText: document.getElementById('winnerText')
  };
}

function easeOut(t, b, c, d) {
  const ts = (t /= d) * t;
  const tc = ts * t;
  return b + c * (tc + -3 * ts + 3 * t);
}

function reproducirTick() {
  const canal = audios.ticks.find((a) => a.paused || a.ended);
  if (!canal) return;

  canal.currentTime = 0;
  canal.play().catch(() => {});
}

export function dibujarRuleta() {
  const el = getWheelElements();
  if (!el || !el.canvas || !el.ctx) return;

  const { canvas, ctx } = el;
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
    ctx.lineWidth = 2;
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
    ctx.restore();
  }
}

export function dibujarOverlayEstatico() {
  // Función limpia: sin llamadas al overlay Canvas antiguo
}

function actualizarRomboSegunRotacion(rotationDeg, spinTimeActual = null) {
  const el = getWheelElements();
  if (!el || !state.options.length) return;

  const idx = obtenerIndiceBajoPuntero(rotationDeg, state.options.length);
  const opt = state.options[idx];

  const activo = spinTimeActual !== null && state.spinning && !el.winnerOverlay.classList.contains('active');

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

      if (!state.modoConstante) {
        intentarTick();
      }
    }
    state.lastSoundOptionName = opt.name;
  }

  if (activo && state.modoConstante && spinTimeActual - state.ultimoTickSpinTime >= state.intervaloActual) {
    intentarTick();
  }

  if (el.diamondImg) {
    el.diamondImg.src = opt.img;
    el.diamondImg.style.display = 'block';
  }
}

export function actualizarEstadoRuleta() {
  const el = getWheelElements();
  dibujarRuleta();
  if (state.options.length > 0) {
    actualizarRomboSegunRotacion(state.currentRotation);
  } else if (el && el.diamondImg) {
    el.diamondImg.style.display = 'none';
    el.diamondImg.src = '';
    state.lastSoundOptionName = null;
  }
}

export function iniciarGiroEnEspera() {
  const el = getWheelElements();
  if (!el) return;

  if (state.idleAnimationId) cancelAnimationFrame(state.idleAnimationId);
  function idleStep() {
    const currentEl = getWheelElements();
    if (!currentEl) return;

    if (!state.spinning && !state.dragging && state.options.length >= 2 && currentEl.spinHint.classList.contains('hidden') === false) {
      state.currentRotation += 0.15;
      currentEl.canvas.style.transform = `rotate(${state.currentRotation}deg)`;
      actualizarRomboSegunRotacion(state.currentRotation);
    }
    state.idleAnimationId = requestAnimationFrame(idleStep);
  }
  state.idleAnimationId = requestAnimationFrame(idleStep);
}

function detenerGiro() {
  const el = getWheelElements();
  if (!el) return;

  state.spinning = false;
  const winnerIndex = obtenerIndiceBajoPuntero(state.currentRotation, state.options.length);
  const winner = state.options[winnerIndex];
  el.winnerImg.src = winner.img;
  el.winnerText.textContent = `¡${winner.name}!`;
  const normalizedName = winner.name.trim().toLowerCase();
  
  if (normalizedName.startsWith('me la pela') || normalizedName.startsWith('slot vacío')|| normalizedName.startsWith('objeto de obsesión')) audios.red.play().catch(()=>{});
  else audios.win.play().catch(()=>{});

  el.winnerOverlay.classList.add('active');
  el.centerDiamondWrapper.classList.add('hidden');
  state.lastSoundOptionName = null;
  el.diamondImg.src = winner.img;
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
  return obtenerCatalogoParaEvento().filter((p) => p && p.name && p.name.trim().toLowerCase().startsWith(objetivo));
}

function construirOpcionesEvento() {
  const perksEncontrados = EVENT_PERK_PREFIXES.flatMap(buscarPerkEvento).filter(Boolean);
  if (perksEncontrados.length === 0) return null;

  const opciones = [];
  perksEncontrados.forEach((perk) => {
    for (let i = 0; i < EVENT_COPIES_PER_PERK; i++) {
      opciones.push(perk);
    }
  });

  const mezcladas = mezclarSinAdyacentesIguales(opciones);
  return mezcladas || opciones;
}

function activarModoEvento() {
 
  const el = getWheelElements();
  const opcionesEvento = construirOpcionesEvento();
  if (!opcionesEvento) return false;

  opcionesNormalesBackup = state.options;
  state.options = opcionesEvento;
  state.eventoActivo = true;
  el?.wheelWrap?.classList.add('evento-activo');

  notificarCambioModoEvento();
  dibujarRuleta();
  return true;
}

function desactivarModoEvento() {
  const el = getWheelElements();
  if (!state.eventoActivo) return;
  if (opcionesNormalesBackup) state.options = opcionesNormalesBackup;
  opcionesNormalesBackup = null;
  state.eventoActivo = false;
  el?.wheelWrap?.classList.remove('evento-activo');
  notificarCambioModoEvento();
  dibujarRuleta();
}

function prepararVariablesDeSonido() {
  state.modoConstante = true;
  state.intervaloActual = MIN_TICK_GAP_MS;
  state.ultimoCambioSpinTime = 0;
  state.ultimoTickSpinTime = 0;
  state.lastSoundOptionName = null;
}

function ejecutarGiroReal() {
  prepararVariablesDeSonido();

  const spinAngleStart = Math.random() * 30 + 20;
  const spinTimeTotal = 15000;
  let spinTime = 0;

  function rotarPaso() {
    const el = getWheelElements();
    if (!state.spinning || !el) return;
    spinTime += 30;
    if (spinTime >= spinTimeTotal) { detenerGiro(); return; }

    const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
    state.currentRotation += spinAngle;
    el.canvas.style.transform = `rotate(${state.currentRotation}deg)`;

    actualizarRomboSegunRotacion(state.currentRotation, spinTime);
    state.animationFrameId = setTimeout(rotarPaso, 30);
  }
  state.animationFrameId = setTimeout(rotarPaso, 30);
}

function ejecutarGiroSenuelo(alTerminar) {
  prepararVariablesDeSonido();

  const spinAngleStart = Math.random() * 20 + 15;
  const spinTimeTotal = EVENTO_DECOY_DURATION_MS;
  let spinTime = 0;

  function rotarPaso() {
    const el = getWheelElements();
    if (!state.spinning || !el) return;
    spinTime += 30;
    if (spinTime >= spinTimeTotal) { alTerminar(); return; }

    const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
    state.currentRotation += spinAngle;
    el.canvas.style.transform = `rotate(${state.currentRotation}deg)`;

    actualizarRomboSegunRotacion(state.currentRotation, spinTime);
    state.animationFrameId = setTimeout(rotarPaso, 30);
  }
  state.animationFrameId = setTimeout(rotarPaso, 30);
}

export function iniciarGiro() {
  const el = getWheelElements();
  if (!el || state.spinning || state.options.length < 2) return;

  state.spinning = true;
  el.winnerOverlay.classList.remove('active');
  el.centerDiamondWrapper.classList.remove('hidden');
  el.spinHint.classList.add('hidden');
  el.wheelDarkOverlay.classList.add('hidden');
  el.mysteryDiamondImg.classList.add('hidden');

  const esEvento = Math.random() < EVENT_CHANCE;

  if (!esEvento) {
    ejecutarGiroReal();
    return;
  }
setTimeout(() => {
  audios.shit.play().catch(() => {});
}, 400);
  ejecutarGiroSenuelo(() => {
    el.wheelWrap?.classList.add('evento-flash');
    setTimeout(() => {
      el.wheelWrap?.classList.remove('evento-flash');

      if (!state.spinning) return;

      activarModoEvento();
      ejecutarGiroReal();
    }, EVENTO_GLITCH_DURATION_MS);
  });
}

export function setupWheelEventListeners() {
  const el = getWheelElements();
  if (!el) return;

  el.winnerOverlay.addEventListener('click', () => {
    el.winnerOverlay.classList.remove('active');
    el.centerDiamondWrapper.classList.remove('hidden');
    el.spinHint.classList.add('hidden');
    el.wheelDarkOverlay.classList.add('hidden');
    el.mysteryDiamondImg.classList.add('hidden');
    desactivarModoEvento();
    iniciarGiro();
  });

  const obtenerCentro = () => { const r = el.canvas.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; };
  const obtenerAngulo = (x, y) => { const c = obtenerCentro(); return Math.atan2(y - c.y, x - c.x) * (180/Math.PI); };

  el.canvas.addEventListener('pointerdown', (e) => {
    if (state.spinning) {
      state.spinning = false;
      if (state.animationFrameId) clearTimeout(state.animationFrameId);
      desactivarModoEvento();
      el.spinHint.classList.remove('hidden');
      el.wheelDarkOverlay.classList.remove('hidden');
      el.mysteryDiamondImg.classList.remove('hidden');
      return;
    }
    if (state.options.length < 2) return;
    state.dragging = true;
    state.hasMoved = false;
    el.winnerOverlay.classList.remove('active');
    el.centerDiamondWrapper.classList.remove('hidden');
    el.spinHint.classList.add('hidden');
    el.wheelDarkOverlay.classList.add('hidden');
    el.mysteryDiamondImg.classList.add('hidden');
    el.canvas.setPointerCapture(e.pointerId);
    state.dragStartAngle = obtenerAngulo(e.clientX, e.clientY);
    state.dragStartRotation = state.currentRotation;
  });

  el.canvas.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const delta = obtenerAngulo(e.clientX, e.clientY) - state.dragStartAngle;
    if (Math.abs(delta) > 3) state.hasMoved = true;
    if (state.hasMoved) {
      state.currentRotation = state.dragStartRotation + delta;
      el.canvas.style.transform = `rotate(${state.currentRotation}deg)`;
      actualizarRomboSegunRotacion(state.currentRotation);
    }
  });

  el.canvas.addEventListener('pointerup', () => {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.hasMoved) {
      state.spinning = false;
      el.spinHint.classList.remove('hidden');
      el.wheelDarkOverlay.classList.remove('hidden');
      el.mysteryDiamondImg.classList.remove('hidden');
    } else {
      iniciarGiro();
    }
  });

  window.addEventListener('resize', () => { dibujarRuleta(); });
}