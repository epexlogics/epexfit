/**
 * strava-exchange — Supabase Edge Function
 *
 * Exchanges a Strava authorization code for an access token.
 * The client_secret lives ONLY here as a Supabase secret — never in the app bundle.
 *
 * Deploy:
 *   supabase functions deploy strava-exchange
 *
 * Set secret:
 *   supabase secrets set STRAVA_CLIENT_SECRET=your_secret_here
 *
 * The app calls:
 *   POST <SUPABASE_URL>/functions/v1/strava-exchange
 *   Authorization: Bearer <supabase_user_jwt>
 *   Body: { code: string, client_id: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // ── 1. Verify the caller is an authenticated EpexFit user ──────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Parse request body ──────────────────────────────────────────────
    const { code, client_id } = await req.json() as { code: string; client_id: string };

    if (!code || !client_id) {
      return new Response(JSON.stringify({ error: 'code and client_id are required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Exchange code for token (secret never leaves the server) ────────
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
    if (!clientSecret) {
      console.error('STRAVA_CLIENT_SECRET env var not set');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Strava token exchange failed:', tokenRes.status, errText);
      return new Response(JSON.stringify({ error: `Strava error: ${tokenRes.status}` }), {
        status: tokenRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const tokenData = await tokenRes.json();

    // ── 4. Return only the access_token to the app ─────────────────────────
    return new Response(
      JSON.stringify({ access_token: tokenData.access_token }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('strava-exchange error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});