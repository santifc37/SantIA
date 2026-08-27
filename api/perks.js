export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Faltan las variables de entorno en Vercel.' });
  }

  // 1. SI ES UNA PETICIÓN GET (Obtener todos los perks)
  if (req.method === 'GET') {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/Perks?select=*`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(500).json({ error: 'Supabase rechazó la petición: ' + errorText });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Error al conectar con la base de datos: ' + error.message });
    }
  }

  // 2. SI ES UNA PETICIÓN PATCH (Actualizar el estado active de un perk específico)
  if (req.method === 'PATCH') {
    try {
      // Obtenemos el ID de los query parameters (ej: /api/perks?id=123) o del cuerpo
      const { id } = req.query;
      const { active } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Falta el ID del perk a actualizar.' });
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/Perks?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ active })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(500).json({ error: 'Error al actualizar en Supabase: ' + errorText });
      }

      const updatedData = await response.json();
      return res.status(200).json(updatedData);
    } catch (error) {
      return res.status(500).json({ error: 'Error al conectar con la base de datos: ' + error.message });
    }
  }

  // Si envían cualquier otro método no soportado
  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

