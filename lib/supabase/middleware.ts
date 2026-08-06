import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function isAssetOrLogin(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.png'
  );
}

/** Redirect que preserva cookies gravados pelo refresh do JWT em getUser(). */
function redirectWithSessionCookies(
  request: NextRequest,
  pathname: string,
  supabaseResponse: NextResponse
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;
  const redirectResponse = NextResponse.redirect(redirectUrl);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value);
  });
  return redirectResponse;
}

/**
 * Atualiza/valida a sessão Auth nos cookies e aplica o guarda de rotas.
 * Sempre chama getUser() (não getSession) para forçar refresh do JWT quando preciso.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  // Fail-closed: sem env, não deixa rotas protegidas passar no edge.
  if (!url || !anonKey) {
    if (isAssetOrLogin(pathname)) {
      return supabaseResponse;
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = pathname === '/login';

  if (!user && !isAssetOrLogin(pathname)) {
    return redirectWithSessionCookies(request, '/login', supabaseResponse);
  }

  if (user && (isLogin || pathname === '/')) {
    return redirectWithSessionCookies(request, '/dashboard', supabaseResponse);
  }

  return supabaseResponse;
}
