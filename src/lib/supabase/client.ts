"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getSupabase() {
  browserClient ??= createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

export type Supabase = ReturnType<typeof getSupabase>;
