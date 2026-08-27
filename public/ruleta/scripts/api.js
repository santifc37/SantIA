export async function fetchPerks() {
  const response = await fetch('/api/perks');
  if (!response.ok) throw new Error(`Error en el servidor: ${response.status}`);
  return response.json();
}

export async function patchPerkActiva(id, active) {
  return fetch(`/api/perks?id=${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active })
  }).catch(err => console.error('El guardado en segundo plano falló:', err));
}

export async function guardarPerkDb(nombre, cantidad, perk) {
  try {
    await fetch('/api/guardar-perk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, cantidad: String(cantidad), perk })
    });
  } catch (err) {
    console.error('Error guardando perk:', err);
  }
}

export async function fetchDonacionesEspeciales() {
  const response = await fetch('/api/obtener-perks');
  if (!response.ok) throw new Error(`Error en el servidor: ${response.status}`);
  return response.json();
}

export async function eliminarPerkDb(id) {
  return fetch(`/api/eliminar-perk?id=${id}`, { method: 'DELETE' })
    .catch(err => console.error('Error eliminando perk expirada:', err));
}

// Ejemplo correcto en tu api.js
async function actualizarToken(password, newKey) {
  const respuesta = await fetch('/api/actualizar-token', {
    method: 'POST', // <-- Obligatoriamente POST
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password, newKey })
  });

  const resultado = await respuesta.json();
  return resultado;
}

