import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { assertLocalTarget, container, query } from './local-db.mjs'

function session(name) {
  const child = spawn(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-Atq',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  )
  const state = { child, stdout: '', stderr: '', closed: false }
  child.stdout.on('data', (chunk) => {
    state.stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    state.stderr += chunk
  })
  state.done = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      state.closed = true
      resolve(code)
    })
  })
  child.stdin.write(
    `set application_name = '${name}';\nset statement_timeout = '15s';\nset idle_in_transaction_session_timeout = '20s';\n`,
  )
  return state
}

async function until(check, description) {
  const deadline = Date.now() + 10_000
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${description}`)
    await delay(100)
  }
}

async function main() {
  if (process.argv.length !== 2)
    throw new Error('No database URL or target arguments are accepted.')
  assertLocalTarget()
  // Generated fixture identifiers only; no user SQL or connection URL is accepted.
  const run = randomUUID()
  const buyerA = randomUUID()
  const buyerB = randomUUID()
  const nameA = `s7-a-${run}`
  const nameB = `s7-b-${run}`
  let a, b
  try {
    query(`begin;
      delete from public.delivery_fees where governorate_id = 31000;
      delete from public.governorates where id = 31000;
      insert into public.governorates(id,name_en,name_ar) values (31000,'S7 ${run}','S7');
      insert into public.delivery_fees(governorate_id,method,fee) values (31000,'representative',35);
      insert into auth.users(id,raw_user_meta_data) values ('${buyerA}','{}'), ('${buyerB}','{}');
      insert into public.categories(name,slug) values ('S7 fixture','s7-${run}');
      insert into public.products(category_id,name,price,stock_quantity)
        select id,'S7 ${run}',100,2 from public.categories where slug='s7-${run}';
      commit;`)
    const product = query(`select id from public.products where name = 'S7 ${run}';`)
    assert.match(product, /^\d+$/)
    const order = (user, qty) => `begin;
      set local role authenticated;
      select set_config('request.jwt.claims','{"sub":"${user}","aal":"aal1"}',true);
      select public.place_order('[{"product_id":${product},"quantity":${qty}}]'::jsonb,
        'representative','cod','{"postal_code":"11511","name":"S7 buyer","phone":"01011110001","governorate_id":31000,"city":"Cairo","address":"S7 test address"}'::jsonb);\n`
    a = session(nameA)
    a.child.stdin.write(order(buyerA, 2) + '\\echo A_READY\n')
    await until(() => a.stdout.includes('A_READY'), 'buyer A holding its transaction')
    b = session(nameB)
    b.child.stdin.end(order(buyerB, 1) + 'commit;\n')
    // Observe the actual blocking relationship, not elapsed time in another session.
    await until(
      () =>
        query(`select exists (
      select 1 from pg_stat_activity a join pg_stat_activity b on a.pid = any(pg_blocking_pids(b.pid))
      where a.application_name = '${nameA}' and b.application_name = '${nameB}' and b.wait_event_type = 'Lock');`) ===
        't',
      'buyer B blocked by buyer A',
    )
    a.child.stdin.end('commit;\n')
    assert.equal(await a.done, 0, 'buyer A must commit')
    assert.notEqual(await b.done, 0, 'buyer B must be rejected')
    assert.match(b.stderr, /HINT:\s+ORD-007/, 'buyer B must fail for exhausted stock')
    assert.equal(
      query(
        `select stock_quantity || ':' || sold_count || ':' || (select count(*) from public.order_items where product_id=${product}) from public.products where id=${product};`,
      ),
      '0:2:1',
    )
    console.log(
      'S7 passed: B waited on A; one order committed, stock 0, sold 2, and B received ORD-007.',
    )
  } finally {
    for (const state of [a, b]) {
      if (state && !state.closed && !state.child.stdin.writableEnded)
        state.child.stdin.end('rollback;\n')
    }
    await Promise.all([a?.done, b?.done])
    query(`begin;
      set session_replication_role = 'replica';
      delete from public.order_items where product_id in (select id from public.products where name='S7 ${run}');
      delete from public.stock_movements where product_id in (select id from public.products where name='S7 ${run}');
      delete from public.orders where user_id in ('${buyerA}','${buyerB}');
      delete from public.products where name='S7 ${run}';
      delete from public.categories where slug='s7-${run}';
      delete from auth.users where id in ('${buyerA}','${buyerB}');
      delete from public.delivery_fees where governorate_id = 31000;
      delete from public.governorates where id=31000 and name_en='S7 ${run}';
      set session_replication_role = 'origin';
      commit;`)
  }
}

try {
  await main()
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
