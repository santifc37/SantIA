import { io } from 'https://cdn.socket.io/4.8.3/socket.io.esm.min.js';
// Se importa directo del CDN porque el frontend no usa bundler (Vite/webpack).
// Si en algún momento migras a uno, puedes volver a "import { io } from 'socket.io-client'"
// una vez tengas socket.io-client instalado como dependencia npm del frontend.

const URL_RENDER = 'https://server-render-ruleta.onrender.com';

/**
 * Se conecta al servidor de Render y llama a onRecargarLista()
 * cada vez que se guarda un perk nuevo en la base de datos.
 * Reemplaza la necesidad de que el frontend escuche Streamlabs directamente.
 */
export function iniciarEscuchaPerks(onRecargarLista) {
  const socket = io(URL_RENDER, {
    transports: ['websocket']
  });

  socket.on('connect', () => {
    console.log('🟢 Conectado al servidor de Render para recibir perks en tiempo real.');
  });

  socket.on('perk-guardado', (data) => {
    console.log('📥 Perk nuevo guardado en el backend:', data);
    if (typeof onRecargarLista === 'function') onRecargarLista(data);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Desconectado del servidor de Render (tiempo real).');
  });

  return socket;
}