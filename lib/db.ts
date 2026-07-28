// Session 5: Database Client (RLS-Aware)
//
// CRITICAL: @neondatabase/serverless in HTTP mode is stateless per call.
// A bare `SET app.current_business_id = ...` in one query does NOT persist
// to the next call — each call is its own HTTP round-trip with no shared
// session. This means Session 3's RLS policies do nothing unless the
// business_id setting and the real query travel together, atomically,
// in the SAME round-trip.
//
// This file uses sql.transaction() to send both statements as a single
// HTTP request, wrapped in one implicit transaction. Inside that,
// set_config('app.current_business_id', <value>, true) is used instead of
// a bare SET LOCAL, because set_config() is a normal parameterizable
// function call, whereas SET LOCAL requires a literal.
// The third argument `true` scopes it to the transaction only
// (equivalent to SET LOCAL), so it can never leak into any other request.

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function queryUnsafe<T = any>(
  sqlText: string,
  params: any[],
  businessId: number
): Promise<T[]> {
  const results = await sql.transaction([
    sql`SELECT set_config('app.current_business_id', ${String(businessId)}, true)`,
    sql.query(sqlText, params),
  ]);

  // results[0] is the set_config() result (discarded).
  // results[1] is the actual query's rows.
  return results[1] as T[];
}