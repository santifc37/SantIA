export default function middleware(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const tieneToken = cookieHeader.includes('token_sesion=');

  if (!tieneToken) {
    return Response.redirect(new URL('/', request.url));
  }

  return new Response(null, {
    headers: { 'x-middleware-next': '1' }
  });
}

export const config = {
  // Atrapa /ruleta, /ruleta.html, /ruleta/ruleta.html y cualquier subrecurso
  matcher: ['/ruleta/:path*', '/ruleta.html'],
};