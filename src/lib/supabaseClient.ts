import { createClient } from '@supabase/supabase-js';
import { MbsItem } from '@/types'; // Ensure this path is correct

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing environment variable NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Note: The MbsItem type is used here for schema definition in `supabase.from<MbsItem>`.
// However, Supabase client generic types are more advanced and can be defined like:
// export type DbMbsItem = Database['public']['Tables']['mbs_items']['Row'];
// For this stage, we'll keep it simple with the manually defined MbsItem interface.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);