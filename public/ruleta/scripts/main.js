import { state, CUSTOM_PERK_ICON } from './config.js';
import { fetchPerks, fetchDonacionesEspeciales, fetchSegundaTabla } from './api.js';

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
    
    // (Se remueve la precarga parcial de aquí para hacerla global abajo)
  } catch (error) {
    console.error('Error al cargar perks:', error);
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
async function inicializarSegundaTabla() {
  try {
    const data = await fetchSegundaTabla();
    if (!Array.isArray(data)) return;

    let seAgregoAlgunaOpcion = false;

    data.forEach((item, index) => {
      // Ignorar si el registro no es válido
      if (item.id == null) return;

      // Generamos un ID único en el frontend mezclando la tabla, el id de DB y un timestamp/índice.
      // Esto evita que colisione con el ID de la primera tabla.
      const idUnicoEnFrontend = `tabla2-${item.id}-${Date.now()}-${index}`;

      // Insertamos CADA ítem, incluso si el nombre o el dbId se repiten
      state.options.push({
        id: idUnicoEnFrontend,
        dbId: item.id,
        name: item.nombre || item.name,
        alias: '',
        img: item.image || CUSTOM_PERK_ICON,
        isSegundaTabla: true
      });

      seAgregoAlgunaOpcion = true;
    });

    if (seAgregoAlgunaOpcion) {
      // Si la ruleta no está girando, mezclar para distribuir las repetidas por la ruleta
      if (!state.spinning) state.options = mezclarSinAdyacentesIguales(state.options);
      
      // Forzar a la UI y al Canvas a redibujar la ruleta con las nuevas porciones
      actualizarEstadoRuleta();
      renderizarListaOpciones();
    }
  } catch (err) {
    console.error('Error cargando segunda tabla:', err);
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

// Agrega la función de precarga de audios al inicio de main.js o en ui.js
function precargarAudios() {
  if (typeof audios === 'undefined' || !audios) {
    console.warn('Objeto de audios no encontrado, saltando precarga.');
    return Promise.resolve();
  }

  const listaAudios = [audios.red, audios.win, ...(audios.ticks || [])].filter(Boolean);
  
  return Promise.all(
    listaAudios.map(audio => {
      return new Promise((resolve) => {
        audio.preload = 'auto';
        if (audio.readyState >= 2) {
          resolve();
        } else {
          audio.addEventListener('canplaythrough', resolve, { once: true });
          audio.addEventListener('error', resolve, { once: true });
          audio.load();
        }
      });
    })
  );
}
document.addEventListener("DOMContentLoaded", async () => {
  const token = obtenerCookie('token_sesion');

  if (!token) {
    window.location.replace('/');
    return;
  }

  try {
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

  // --- Inicialización con precarga global de Recursos ---
  try {
    iniciarKeepAliveRender(300000);

    setupUIEventListeners();
    setupWheelEventListeners();
    dibujarRuleta();
    dibujarOverlayEstatico();
    iniciarGiroEnEspera();

    // 1. Cargar los datos de todas las tablas en state.options
    await inicializarPerks();
    await inicializarDonaciones();
    await inicializarSegundaTabla();

    // 2. Extraer TODAS las URLs de imágenes cargadas en state.options y state.dbPerks
    const urlsImagenesTotales = Array.from(
      new Set([
        ...state.dbPerks.map(p => p.img),
        ...state.options.map(o => o.img)
      ])
    ).filter(url => url && url.length > 0);

    // 3. Precargar de forma simultánea TODAS las imágenes y sonidos
    await Promise.all([
      precargarImagenes(urlsImagenesTotales),
      precargarAudios()
    ]);

    // 4. Una vez descargado absolutamente todo, habilitamos la pantalla
    ocultarPantallaCarga();

    iniciarEscuchaPerks(() => {
      inicializarDonaciones();
    });
  } catch (error) {
    console.error('Error al inicializar la app:', error);
    ocultarPantallaCarga(); // Fallback de seguridad si falla la red
  }
});