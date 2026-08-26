export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido, usa DELETE' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Falta el parámetro id' });
  }

  try {
    const headers = {
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/perksanadidas?id=eq.${id}`,
      { method: 'DELETE', headers }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error('❌ Error eliminando perk expirada:', details);
      return res.status(500).json({ error: 'Error al eliminar en Supabase', details });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Error general al eliminar:', error.message);
    return res.status(500).json({ error: error.message });
  }
}