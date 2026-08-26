export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      mensaje: 'Método no permitido'
    });
  }

  const { nombre, cantidad, perk } = req.body;

  if (!nombre || !cantidad || !perk) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Faltan nombre, cantidad o perk'
    });
  }

  const headersSupabase = {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
  };

  try {
    const respuesta = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/agregar_perk_si_no_es_duplicado`,
      {
        method: 'POST',
        headers: headersSupabase,
        body: JSON.stringify({
          p_nombre: nombre,
          p_cantidad: cantidad,
          p_id_perk: perk
        })
      }
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      return res.status(500).json({
        ok: false,
        mensaje: 'Error ejecutando función de Supabase',
        error: resultado
      });
    }

    return res.status(200).json(resultado);

  } catch (error) {
    return res.status(500).json({
      ok: false,
      mensaje: error.message
    });
  }
}