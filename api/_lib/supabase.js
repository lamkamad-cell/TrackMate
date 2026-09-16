const { createClient } = require('@supabase/supabase-js');

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function sendJson(res, statusCode, payload) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(statusCode).json(payload);
}

function methodNotAllowed(res) {
  sendJson(res, 405, { error: 'Method not allowed' });
}

function cleanId(value) {
  return String(value || '').trim().toUpperCase();
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

module.exports = {
  cleanId,
  finiteNumberOrNull,
  getSupabaseAdmin,
  methodNotAllowed,
  sendJson
};
