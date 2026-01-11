import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateRequest {
  action: 'validate';
  code: string;
}

interface ConsumeRequest {
  action: 'consume';
  code: string;
}

type RequestBody = ValidateRequest | ConsumeRequest;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    console.log('Invite code request:', { action: body.action, code: body.code?.substring(0, 3) + '***' });

    if (!body.code || typeof body.code !== 'string') {
      console.error('Missing or invalid code');
      return new Response(
        JSON.stringify({ error: 'Invalid request: code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const code = body.code.trim().toUpperCase();

    if (body.action === 'validate') {
      // Check if code exists and is valid
      const { data, error } = await supabaseAdmin
        .from('invite_codes')
        .select('id, is_active, expires_at, current_uses, max_uses')
        .eq('code', code)
        .single();

      if (error || !data) {
        console.log('Code not found:', code);
        return new Response(
          JSON.stringify({ valid: false, reason: 'Code not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isValid = 
        data.is_active && 
        (data.expires_at === null || new Date(data.expires_at) > new Date()) &&
        data.current_uses < data.max_uses;

      console.log('Code validation result:', { code, isValid, isActive: data.is_active, currentUses: data.current_uses, maxUses: data.max_uses });

      return new Response(
        JSON.stringify({ valid: isValid, reason: isValid ? null : 'Code is expired or already used' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'consume') {
      // Get user from auth header for consume action
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        console.error('No auth header for consume action');
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create user client to get the authenticated user
      const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        console.error('Failed to get user:', userError);
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Consuming code for user:', user.id);

      // Find and update the code atomically
      const { data: codeData, error: findError } = await supabaseAdmin
        .from('invite_codes')
        .select('id, is_active, expires_at, current_uses, max_uses')
        .eq('code', code)
        .single();

      if (findError || !codeData) {
        console.log('Code not found for consumption:', code);
        return new Response(
          JSON.stringify({ success: false, reason: 'Code not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isValid = 
        codeData.is_active && 
        (codeData.expires_at === null || new Date(codeData.expires_at) > new Date()) &&
        codeData.current_uses < codeData.max_uses;

      if (!isValid) {
        console.log('Code not valid for consumption:', { code, isActive: codeData.is_active });
        return new Response(
          JSON.stringify({ success: false, reason: 'Code is expired or already used' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mark code as used
      const { error: updateError } = await supabaseAdmin
        .from('invite_codes')
        .update({
          current_uses: codeData.current_uses + 1,
          is_active: false,
          used_by: user.id
        })
        .eq('id', codeData.id);

      if (updateError) {
        console.error('Failed to update code:', updateError);
        return new Response(
          JSON.stringify({ success: false, reason: 'Failed to consume code' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Code consumed successfully:', { code, userId: user.id });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in invite-code function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
