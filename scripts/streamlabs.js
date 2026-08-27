// Botón para actualizar la key de forma segura en tu backend de Vercel (si lo usas)
const btnSaveKey = document.getElementById('btn-save-key');
if (btnSaveKey) {
  btnSaveKey.addEventListener('click', async () => {
    const password = document.getElementById('admin-pass').value;
    const newKey = document.getElementById('new-streamlabs-key').value;

    try {
      const respuesta = await fetch('/api/actualizar-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password, newKey })
      });

      const resultado = await respuesta.json();

      if (respuesta.ok) {
        alert(resultado.message);
        document.getElementById('admin-pass').value = '';
        document.getElementById('new-streamlabs-key').value = '';
      } else {
        alert("Error: " + resultado.error);
      }
    } catch (error) {
      console.error("Error de red:", error);
      alert("Hubo un fallo al conectar con el servidor.");
    }
  });
}

// Función para mantener despierto al servidor de Render automáticamente y actualizar la UI
function mantenerServidorDespierto() {
  const urlRender = 'https://server-render-ruleta.onrender.com';

  fetch(urlRender)
    .then(response => response.text())
    .then(data => {
      console.log("RESPUESTA DE RENDER:", data);
      
      // Buscamos los elementos del DOM en el instante exacto que responde Render
      const dot = document.getElementById('statusDot');
      const text = document.getElementById('statusText');

      if (dot) dot.className = 'status-dot online'; // Cambia el punto a verde
      if (text) text.innerText = 'Online';          // Cambia el texto a Online
    })
    .catch(error => {
      console.error("ERROR DE CONEXIÓN:", error);
      
      const dot = document.getElementById('statusDot');
      const text = document.getElementById('statusText');

      if (dot) dot.className = 'status-dot offline';
      if (text) text.innerText = 'Desconectado';
    });
}

// Asegurarnos de que corra al cargar el DOM o de inmediato si ya cargó
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', mantenerServidorDespierto);
} else {
  mantenerServidorDespierto();
}

// Función para mantener despierto a Render y actualizar la UI
export function iniciarKeepAliveRender(intervaloMs = 100000) {
  const urlRender = 'https://server-render-ruleta.onrender.com';

  const verificarYMantenerRender = () => {
    fetch(urlRender)
      .then(response => response.text())
      .then(data => {
        console.warn("🟢 [RENDER KEEP-ALIVE] Servidor activo:", data);
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        if (dot) dot.className = 'status-dot online';
        if (text) text.innerText = 'Online';
      })
      .catch(error => {
        console.error("🔴 [RENDER KEEP-ALIVE] Error conectando:", error);
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        if (dot) dot.className = 'status-dot offline';
        if (text) text.innerText = 'Desconectado';
      });
  };

  verificarYMantenerRender();                      
  setInterval(verificarYMantenerRender, intervaloMs);   
}


