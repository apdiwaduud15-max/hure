
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

export const getSupabaseClient = (url?: string, key?: string) => {
  if (!url || !key) return null;
  if (supabase && currentUrl === url && currentKey === key) return supabase;

  try {
    supabase = createClient(url, key);
    currentUrl = url;
    currentKey = key;
    return supabase;
  } catch (err: any) {
    console.error('Supabase init failed:', err.message);
    throw err;
  }
};

export const testConnection = async (url: string, key: string) => {
  try {
    const client = getSupabaseClient(url, key);
    if (!client) throw new Error("Could not initialize Supabase client");
    
    // Attempt a simple select to see if table exists
    const { error } = await client.from('erp_storage').select('id').limit(1);
    
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        throw new Error("TABLE_MISSING: Table-ka 'erp_storage' lagama helin Supabase. Fadlan ku shub SQL script-ka hoose Supabase SQL Editor si loo abuuro.");
      }
      if (error.code === '42501' || error.code === 'PGRST301') {
        throw new Error("PERMISSION_DENIED: RLS policies ayaa xannibaya. Fadlan ogolow read/write policy SQL Editor-ka.");
      }
      throw new Error(`${error.code}: ${error.message}`);
    }
    return true;
  } catch (err: any) {
    throw err;
  }
};

export const saveToSupabase = async (url: string, key: string, data: any, storeId: string = 'master_db') => {
  try {
    const client = getSupabaseClient(url, key);
    if (!client) throw new Error("Supabase client not initialized");

    const { error } = await client
      .from('erp_storage')
      .upsert({ 
        id: storeId, 
        payload: data, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'id' });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        throw new Error("Database table 'erp_storage' lagama helin Supabase. Fadlan ku shub SQL script-ka.");
      }
      if (error.code === 'PGRST116') throw new Error("Database error. Please check your SQL configuration.");
      throw new Error(error.message);
    }
    return true;
  } catch (err: any) {
    throw err;
  }
};

export const fetchFromSupabase = async (url: string, key: string, storeId: string = 'master_db') => {
  try {
    const client = getSupabaseClient(url, key);
    if (!client) throw new Error("Supabase client not initialized");

    const { data, error } = await client
      .from('erp_storage')
      .select('payload')
      .eq('id', storeId)
      .maybeSingle();

    if (error) {
       if (error.code === '42P01' || error.code === 'PGRST205') throw new Error("Table 'erp_storage' lagama helin Supabase.");
       throw new Error(error.message);
    }
    return data?.payload || null;
  } catch (err: any) {
    throw err;
  }
};
