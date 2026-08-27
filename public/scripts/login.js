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
  // 1. Si ya existe la cookie, verificarla contra Render para autologin
  const token = obtenerCookie('token_sesion');

  if (token) {
    try {
      const res = await fetch("https://server-render-ruleta.onrender.com/api/verificar", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: decodeURIComponent(token) })
      });

      const data = await res.json();

      if (res.ok && data.valido) {
        window.location.replace('/ruleta/ruleta.html');
        return;
      }
    } catch (error) {
      console.error('Error al verificar sesión guardada:', error);
    }
  }

  // 2. Manejo único de inicio de sesión (Funciona al presionar Enter o dar Clic)
  const caja = document.getElementById("pass-input");

  if (caja) {
    // Escucha la tecla Enter en el input
    caja.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await procesarLogin(caja.value, caja);
      }
    });
  }
});

// Función centralizada de autenticación
async function procesarLogin(inputPass, elementoCaja) {
  try {
    const respuesta = await fetch("https://server-render-ruleta.onrender.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: inputPass })
    });

    const resultado = await respuesta.json();

    if (respuesta.ok && resultado.valido === true) {
      const fecha = new Date();
      fecha.setTime(fecha.getTime() + (365 * 24 * 60 * 60 * 1000));
      
      // Guardar cookie
      document.cookie = `token_sesion=${resultado.token};expires=${fecha.toUTCString()};path=/;SameSite=Lax`;
      
      window.location.replace("/ruleta/ruleta.html");
    } else {
      // Feedback visual de error
      if (elementoCaja) {
        elementoCaja.style.backgroundColor = "#551111";
        setTimeout(() => { 
          elementoCaja.style.backgroundColor = "#222"; 
          elementoCaja.value = ""; 
        }, 500);
      }
    }
  } catch (error) {
    console.error("Error al conectar con el servidor:", error);
  }
}