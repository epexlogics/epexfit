/**
 * strava-exchange — Supabase Edge Function
 *
 * Exchanges a Strava authorization code for access + refresh tokens.
 * The client_secret is stored as a Supabase secret (never in the app bundle).
 *
 * Deploy:
 *   supabase secrets set STRAVA_CLIENT_SECRET=your_secret_here
 *   supabase functions deploy strava-exchange
 *
 * Request body: { code: string, client_id: string }
 * Response:     { access_token: string, refresh_token: string, athlete_id: number }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, client_id } = await req.json();

    if (!code || !client_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: code, client_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
    if (!clientSecret) {
      return new Response(
        JSON.stringify({ error: 'STRAVA_CLIENT_SECRET not configured. Run: supabase secrets set STRAVA_CLIENT_SECRET=...' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: `Strava token exchange failed: ${tokenRes.status}`, detail: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenJson = await tokenRes.json();

    return new Response(
      JSON.stringify({
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token,
        athlete_id: tokenJson.athlete?.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
