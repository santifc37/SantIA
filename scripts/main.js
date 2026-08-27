import { state, CUSTOM_PERK_ICON } from './config.js';
import { fetchPerks, fetchDonacionesEspeciales } from './api.js';
import { mezclarSinAdyacentesIguales } from './utils.js';
import { dibujarRuleta, dibujarOverlayEstatico, actualizarEstadoRuleta, iniciarGiroEnEspera, setupWheelEventListeners } from './wheel.js';
import { renderizarListaOpciones, precargarImagenes, ocultarPantallaCarga, setupUIEventListeners, actualizarAutoScrollDonaciones, iniciarTimersEnVivo } from './ui.js';
import { iniciarKeepAliveRender } from './streamlabs.js';
import { iniciarEscuchaPerks } from './realtime.js';
// 1. Escalar el escenario para resoluciones dinámicas
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

// 2. Cargar base de datos inicial
async function inicializarPerks() {
  try {
    const data = await fetchPerks();
    state.dbPerks = data.map(item => ({
      id: item.id,
      name: item.name,
      alias: item.name2 || '',
      img: item.image || CUSTOM_PERK_ICON,
      active: item.active
    }));

    state.options = state.dbPerks.filter(perk => perk.active === true);
    
    renderizarListaOpciones();
    actualizarEstadoRuleta();

    const urlsImagenesMenu = state.dbPerks.map(perk => perk.img);
    await precargarImagenes(urlsImagenesMenu);
    ocultarPantallaCarga();
  } catch (error) {
    console.error('Error al cargar perks:', error);
    ocultarPantallaCarga();
  }
}



// 3. Cargar Donaciones (API + UI)
async function inicializarDonaciones() {
  const list = document.getElementById('donationsList');
  if (!list) return;

  try {
    const data = await fetchDonacionesEspeciales();
    if (!Array.isArray(data)) return;

    let seAgregoAlgunaOpcion = false;
    data.forEach(item => {
      if (item.id == null || !item.perksespeciales || state.donationOptionIds.has(item.id)) return;

      state.options.push({
        id: `donacion-${item.id}`,
        dbId: item.id,
        name: `${item.perksespeciales.nombre}(${item.nombre})`,
        alias: '',
        img: item.perksespeciales.image || CUSTOM_PERK_ICON,
        isDonation: true
      });

      state.donationOptionIds.add(item.id);
      seAgregoAlgunaOpcion = true;
    });

    if (seAgregoAlgunaOpcion) {
      if (!state.spinning) state.options = mezclarSinAdyacentesIguales(state.options);
      actualizarEstadoRuleta();
    }

    if (data.length === 0) {
      list.innerHTML = '<li class="empty">SIN PERKS AÑADIDAS...</li>';
    } else {
      list.innerHTML = data.map((item, index) => {
        const nombreEspecial = item.perksespeciales ? item.perksespeciales.nombre : 'Sin perk';
        return `
          <li class="donation-item" data-id="${item.id}" data-expires="${item.expires_at || ''}">
            <span class="donor-info"><strong>${item.nombre}</strong> - ${nombreEspecial}</span>
            <span class="countdown-timer" id="timer-${index}">Calculando...</span>
          </li>`;
      }).join('');
    }

    iniciarTimersEnVivo();
    actualizarAutoScrollDonaciones();
  } catch (err) {
    console.error('Error cargando donaciones:', err);
  }
}

// 4. Arranque Global
document.addEventListener("DOMContentLoaded", async () => {
  // Inicializar listeners y UI visual
  iniciarKeepAliveRender(5000);
  setupUIEventListeners();
  setupWheelEventListeners();
  dibujarRuleta();
  dibujarOverlayEstatico();
  iniciarGiroEnEspera();

  // Efecto Video
  const fxVideo = document.getElementById("ruletaFxVideo");
  if (fxVideo) {
    const dispararEfecto = () => { fxVideo.currentTime = 0; fxVideo.play().catch(()=>{}); };
    dispararEfecto();
    setInterval(dispararEfecto, 5000);
  }

  // Recalculo scroll en Resize
  window.addEventListener('resize', () => {
    clearTimeout(window.donationsResizeTimeout);
    window.donationsResizeTimeout = setTimeout(actualizarAutoScrollDonaciones, 200);
  });

  // Fetch e Inicio Asíncrono
  await inicializarPerks();
  await inicializarDonaciones();

  iniciarEscuchaPerks(() => {
  inicializarDonaciones();
});
});