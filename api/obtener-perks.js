export default async function handler(req, res) {
  try {
    const headers = {
      'apikey': process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    const resPerks = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/perksanadidas?select=id,nombre,expires_at,perksespeciales(nombre,image)`,
      { headers }
    );

    const dataUnida = await resPerks.json();

    if (!Array.isArray(dataUnida)) {
      console.error("❌ Error de Supabase:", dataUnida);
      return res.status(500).json({ error: "Error al obtener datos de Supabase", details: dataUnida });
    }

    return res.status(200).json(dataUnida);
  } catch (error) {
    console.error("❌ Error general:", error.message);
    return res.status(500).json({ error: error.message });
  }
}