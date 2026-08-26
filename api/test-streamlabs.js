// api/test-streamlabs.js
export default function handler(req, res) {
  const socketToken = process.env.STREAMLABS_SOCKET_TOKEN;
  if (!socketToken) {
    return res.status(400).json({
      ok: false,
      mensaje: "❌ STREAMLABS_SOCKET_TOKEN no está presente en .env.local"
    });
  }

  return res.status(200).json({
    ok: true,
    token: socketToken
  });
}