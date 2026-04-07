import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres.nkmktefsbvhjexodkbtw:t0hs4Apye8Kg2MUq@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function restoreAuth() {
  try {
    await client.connect();
    console.log("Conectado ao banco de dados com sucesso.");
    await client.query("SET session_replication_role = replica;");

    const res = await client.query('SELECT id, email FROM public.profiles WHERE email IS NOT NULL');
    const profiles = res.rows;
    console.log(`Encontrados ${profiles.length} perfis para restaurar acessos.`);

    let restoredCount = 0;

    for (const profile of profiles) {
      if (!profile.email) continue;
      
      const checkRes = await client.query('SELECT id FROM auth.users WHERE id = $1', [profile.id]);
      if (checkRes.rows.length > 0) {
        console.log(`O usuário ${profile.email} já existe no login, ignorando...`);
        continue;
      }

      // Injeta na auth.users
      const insertUserSql = `
        INSERT INTO auth.users (
          id, instance_id, aud, role, email,
          encrypted_password, email_confirmed_at,
          created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data, is_sso_user
        ) VALUES (
          $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2,
          crypt('VendaProfit123', gen_salt('bf')), now(),
          now(), now(), '', '{"provider":"email","providers":["email"]}', '{}', false
        )
      `;
      await client.query(insertUserSql, [profile.id, profile.email]);

      // Injeta na auth.identities
      const insertIdentitySql = `
        INSERT INTO auth.identities (
          id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 'email', now(), now(), now()
        )
      `;
      const identityData = JSON.stringify({ sub: profile.id, email: profile.email });
      await client.query(insertIdentitySql, [profile.id, profile.id, identityData]);

      console.log(`[+] Acesso restaurado para: ${profile.email}`);
      restoredCount++;
    }

    console.log(`\\nFinalizado! Foram restauradas as senhas de ${restoredCount} perfis.`);
  } catch (err) {
    console.error("Erro durante a restauração:", err);
  } finally {
    await client.end();
  }
}

restoreAuth();
