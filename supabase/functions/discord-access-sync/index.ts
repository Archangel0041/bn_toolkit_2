import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('Invalid token:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Processing access sync for user:', userId);

    // Get the user to check if they're a Discord user
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      console.error('Failed to get user:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to get user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = userData.user;
    const discordIdentity = user.identities?.find(i => i.provider === 'discord');
    
    if (!discordIdentity) {
      console.log('User is not a Discord user, skipping sync');
      return new Response(
        JSON.stringify({ has_access: false, reason: 'Not a Discord user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const discordUserId = discordIdentity.id;
    const discordUsername = user.user_metadata?.custom_claims?.global_name || 
                           user.user_metadata?.full_name || 
                           user.user_metadata?.name ||
                           discordIdentity.identity_data?.username || 
                           'Unknown';
    
    console.log('Discord user ID:', discordUserId, 'Username:', discordUsername);

    // Check if user is a member of the Discord guild
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const guildId = Deno.env.get('DISCORD_GUILD_ID');

    if (!botToken || !guildId) {
      console.error('Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check guild membership via Discord API
    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`,
      {
        headers: {
          'Authorization': `Bot ${botToken}`,
        },
      }
    );

    let hasAccess = false;
    let reason = 'Not a guild member';

    if (memberResponse.ok) {
      hasAccess = true;
      reason = 'Guild member verified';
      console.log('User is a member of the guild');
    } else if (memberResponse.status === 404) {
      console.log('User is not a member of the guild');
    } else {
      const errorText = await memberResponse.text();
      console.error('Discord API error:', memberResponse.status, errorText);
    }

    // Use service role to update user_roles table (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Upsert the user_roles record
    const { error: upsertError } = await serviceClient
      .from('user_roles')
      .upsert(
        {
          user_id: userId,
          discord_username: discordUsername,
          has_access: hasAccess,
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('Failed to upsert user_roles:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to update access' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Access sync complete. has_access:', hasAccess);

    return new Response(
      JSON.stringify({ has_access: hasAccess, reason }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
