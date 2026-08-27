import { state, CUSTOM_PERK_ICON } from './config.js';
import { fetchPerks, fetchDonacionesEspeciales } from './api.js';
// Cambiado de '../../scripts/' a './' porque están en la misma carpeta scripts/
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

// URL de tu backend en Render
const RENDER_URL = 'https://server-render-ruleta.onrender.com/api/verificar';

function obtenerCookie(nombre) {
  const nameEQ = nombre + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(nameEQ) === 0) {
      let val = c.substring(nameEQ.length, c.length);
      return val.replace(/^"|"$/g, '');
    }
  }
  return null;
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = obtenerCookie('token_sesion');

  if (!token) {
    window.location.replace('/');
    return;
  }

  try {
    // Petición directa a Render para comprobar la cookie contra process.env.Papita_Papital
    const res = await fetch(`${RENDER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: decodeURIComponent(token) })
    });

    const data = await res.json();

    if (!res.ok || !data.valido) {
      window.location.replace('/');
      return;
    }
  } catch (error) {
    console.error('Error al verificar la sesión contra Render:', error);
    window.location.replace('/');
    return;
  }

  // --- Inicialización normal de la ruleta ---
  try {
    iniciarKeepAliveRender(300000);

    setupUIEventListeners();
    setupWheelEventListeners();
    dibujarRuleta();
    dibujarOverlayEstatico();
    iniciarGiroEnEspera();

    await inicializarPerks();
    await inicializarDonaciones();

    iniciarEscuchaPerks(() => {
      inicializarDonaciones();
    });
  } catch (error) {
    console.error('Error al inicializar la app:', error);
  }
});