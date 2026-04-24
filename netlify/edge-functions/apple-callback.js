/**
 * Apple Sign in with Apple uses response_mode=form_post, so the browser POSTs
 * application/x-www-form-urlencoded data to the Return URL. A static Netlify
 * site + SPA rewrite does not serve a handler for that POST, which shows up as
 * Netlify's 404. We convert the POST to a 302 GET with the same parameters as
 * query string so /auth/apple/callback loads the app shell and
 * WebBrowser.maybeCompleteAuthSession() can postMessage the full URL to the parent.
 */
export default async (request) => {
  if (request.method !== "POST") {
    return;
  }
  const text = await request.text();
  const form = new URLSearchParams(text);
  const next = new URL("/auth/apple/callback", request.url);
  for (const [k, v] of form) {
    next.searchParams.append(k, v);
  }
  return Response.redirect(next.toString(), 302);
};

export const config = { path: "/auth/apple/callback" };
