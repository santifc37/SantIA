import { state } from './config.js';
import { patchPerkActiva, eliminarPerkDb } from './api.js';
import { actualizarEstadoRuleta } from './wheel.js';

const loadingBarFill = document.getElementById('loadingBarFill');
const loadingPercent = document.getElementById('loadingPercent');
const loadingOverlay = document.getElementById('loadingOverlay');
const dbList = document.getElementById('dbList');
const searchInput = document.getElementById('searchInput');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const perkTooltip = document.getElementById('perkTooltip');

const removeModalOverlay = document.getElementById('removeModalOverlay');
const removeModalText = document.getElementById('removeModalText');
const removeModalCancelBtn = document.getElementById('removeModalCancelBtn');
const removeModalConfirmBtn = document.getElementById('removeModalConfirmBtn');

export function actualizarProgresoCarga(porcentaje) {
  if (loadingBarFill) loadingBarFill.style.width = `${porcentaje}%`;
  if (loadingPercent) loadingPercent.textContent = `${porcentaje}%`;
}

export function precargarImagenes(urls) {
  return new Promise((resolve) => {
    const urlsUnicas = [...new Set(urls.filter(Boolean))];
    const total = urlsUnicas.length;
    if (total === 0) { actualizarProgresoCarga(100); resolve(); return; }

    let procesadas = 0;
    actualizarProgresoCarga(0);

    function marcarComoProcesada() {
      procesadas++;
      actualizarProgresoCarga(Math.round((procesadas / total) * 100));
      if (procesadas === total) resolve();
    }

    urlsUnicas.forEach(url => {
      const img = new Image();
      img.onload = marcarComoProcesada;
      img.onerror = () => {
        console.warn('No se pudo precargar:', url);
        marcarComoProcesada();
      };
      img.src = url;
    });
  });
}

export function ocultarPantallaCarga() {
  if (!loadingOverlay) return;
  loadingOverlay.classList.add('hidden');
  setTimeout(() => { loadingOverlay.style.display = 'none'; }, 400);
}

export function obtenerPerksFiltradas() {
  const filter = searchInput.value.toLowerCase().trim();
  if (!filter) return state.dbPerks;
  return state.dbPerks.filter(perk => perk.name.toLowerCase().includes(filter) || perk.alias.toLowerCase().includes(filter));
}

export function renderizarListaOpciones() {
  const filteredPerks = obtenerPerksFiltradas();
  const totalPages = Math.ceil(filteredPerks.length / state.itemsPerPage) || 1;
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const startIndex = (state.currentPage - 1) * state.itemsPerPage;
  const currentItems = filteredPerks.slice(startIndex, startIndex + state.itemsPerPage);

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

    const isInWheel = state.options.some(opt => opt.name.trim().toLowerCase() === perk.name.trim().toLowerCase());
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

    card.addEventListener('mouseenter', (e) => mostrarTooltip(e, perk));
    card.addEventListener('mousemove', actualizarPosicionTooltip);
    card.addEventListener('mouseleave', () => perkTooltip.style.display = 'none');
    card.addEventListener('click', () => agregarOpcionARuleta(perk));

    dbList.appendChild(wrap);
  });

  pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
  prevPageBtn.disabled = state.currentPage === 1;
  nextPageBtn.disabled = state.currentPage === totalPages || totalPages === 0;
}

function mostrarTooltip(e, perk) {
  perkTooltip.textContent = perk.alias ? `${perk.name} (${perk.alias})` : perk.name;
  perkTooltip.style.display = 'block';
  actualizarPosicionTooltip(e);
}

function actualizarPosicionTooltip(e) {
  const padding = 12;
  let x = e.clientX + padding;
  let y = e.clientY + padding;
  if (x + perkTooltip.offsetWidth > window.innerWidth) x = e.clientX - perkTooltip.offsetWidth - padding;
  if (y + perkTooltip.offsetHeight > window.innerHeight) y = e.clientY - perkTooltip.offsetHeight - padding;
  perkTooltip.style.left = `${x}px`;
  perkTooltip.style.top = `${y}px`;
}

function agregarOpcionARuleta(perkObj) {
  if (state.spinning) return;
  state.options.push(perkObj);

  if (perkObj.id) {
    const foundPerk = state.dbPerks.find(p => p.id === perkObj.id);
    if (foundPerk) foundPerk.active = true;
    patchPerkActiva(perkObj.id, true);
  }
  actualizarEstadoRuleta();
  renderizarListaOpciones();
}

function abrirModalEliminar(perk) {
  if (state.spinning) return;
  state.perkPendingRemoval = perk;
  removeModalText.textContent = `¿Seguro que quieres quitar "${perk.name}" de la ruleta?`;
  removeModalOverlay.classList.add('active');
}

function cerrarModalEliminar() {
  removeModalOverlay.classList.remove('active');
  state.perkPendingRemoval = null;
}

function quitarOpcionDeRuleta(perk) {
  const normalizedName = perk.name.trim().toLowerCase();
  state.options = state.options.filter(opt => opt.name.trim().toLowerCase() !== normalizedName);
  
  if (perk.id) {
    const foundPerk = state.dbPerks.find(p => p.id === perk.id);
    if (foundPerk) foundPerk.active = false;
    patchPerkActiva(perk.id, false);
  }
  actualizarEstadoRuleta();
  renderizarListaOpciones();
}

// Configurar listeners básicos de UI
export function setupUIEventListeners() {
  prevPageBtn.addEventListener('click', () => {
    if (state.currentPage > 1) { state.currentPage--; renderizarListaOpciones(); }
  });
  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(obtenerPerksFiltradas().length / state.itemsPerPage) || 1;
    if (state.currentPage < totalPages) { state.currentPage++; renderizarListaOpciones(); }
  });
  searchInput.addEventListener('input', () => { state.currentPage = 1; renderizarListaOpciones(); });

  removeModalCancelBtn.addEventListener('click', cerrarModalEliminar);
  removeModalOverlay.addEventListener('click', (e) => { if (e.target === removeModalOverlay) cerrarModalEliminar(); });
  removeModalConfirmBtn.addEventListener('click', () => {
    if (state.perkPendingRemoval) quitarOpcionDeRuleta(state.perkPendingRemoval);
    cerrarModalEliminar();
  });
}

// Autoscroll de Donaciones
let donationsScrollTimeoutId = null;
export function actualizarAutoScrollDonaciones() {
  const wrapper = document.getElementById('donationsScroll');
  const list = document.getElementById('donationsList');
  if (!wrapper || !list) return;

  if (donationsScrollTimeoutId) clearTimeout(donationsScrollTimeoutId);

  list.style.transition = 'none';
  list.style.transform = 'translateY(0)';
  list.offsetHeight; // Reflow

  const maxScroll = list.scrollHeight - wrapper.clientHeight;
  if (maxScroll <= 4) return;

  let posicionActual = 0;
  let direccion = 1;

  function animarPaso() {
    const destino = direccion === 1 ? maxScroll : 0;
    const distancia = Math.abs(destino - posicionActual);
    const duracionMs = Math.max(600, (distancia / 28) * 1000); // 28 = velocidad px/seg

    list.style.transition = `transform ${duracionMs}ms linear`;
    list.style.transform = `translateY(-${destino}px)`;
    posicionActual = destino;

    donationsScrollTimeoutId = setTimeout(() => {
      direccion *= -1;
      animarPaso();
    }, duracionMs + 2200);
  }
  donationsScrollTimeoutId = setTimeout(animarPaso, 2200);
}

// Timers Donaciones
export function iniciarTimersEnVivo() {
  if (window.timerInterval) clearInterval(window.timerInterval);

  window.timerInterval = setInterval(() => {
    document.querySelectorAll('.donation-item').forEach((item) => {
      const expiresAt = item.getAttribute('data-expires');
      const donationId = item.getAttribute('data-id');
      const timerSpan = item.querySelector('.countdown-timer');

      if (!expiresAt || !timerSpan) return;

      const diferencia = new Date(expiresAt).getTime() - Date.now();
      if (diferencia <= 0) {
        timerSpan.textContent = 'Expirado';
        if (donationId) eliminarPerkExpiradaUI(donationId, item);
        return;
      }

      const h = String(Math.floor(diferencia / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diferencia % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diferencia % 60000) / 1000)).padStart(2, '0');
      timerSpan.textContent = `${h}:${m}:${s}`;
    });
  }, 1000);
}

export async function eliminarPerkExpiradaUI(id, liElement) {
  const numericId = Number(id);
  if (!state.donationOptionIds.has(numericId)) return;

  state.options = state.options.filter(opt => opt.dbId !== numericId);
  state.donationOptionIds.delete(numericId);
  actualizarEstadoRuleta();

  if (liElement) liElement.remove();
  actualizarAutoScrollDonaciones();
  await eliminarPerkDb(numericId);
}