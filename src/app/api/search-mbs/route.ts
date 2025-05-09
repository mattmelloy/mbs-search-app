import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { SearchResultItem } from '@/types';

// Simple regex to check if a string looks like an MBS item code (digits, possibly one trailing letter)
const mbsItemCodeRegex = /^\d{1,5}[A-Z]?$/i;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    let supabaseQuery;
    const selectColumns = 'item_code, description, schedule_fee, benefit_75_percent, benefit_85_percent, is_assist_eligible, is_anaes_eligible'; 

    if (mbsItemCodeRegex.test(query)) {
      // Search by Item Number
      supabaseQuery = supabase
        .from('mbs_items')
        .select(selectColumns)
        .eq('item_code', query.toUpperCase()) // MBS item codes are often stored in uppercase
        .is('effective_to', null) // Only current items
        .order('item_code');
    } else {
      // Search by Keyword in Description (Full-Text Search)
      // Using websearch_to_tsquery for more flexible keyword matching
      supabaseQuery = supabase
        .from('mbs_items')
        .select(selectColumns)
        .textSearch('description', `'${query.split(' ').join("' & '")}'`, { // Basic AND logic. For more sophisticated search, use websearch_to_tsquery through an RPC or adjust based on Supabase client version capabilities.
        // .textSearch('description', query, { // Simpler but might do OR by default
          type: 'plain', // or 'websearch' if your PG version/setup supports it directly on textSearch easily, or 'phrase'
          config: 'english',
        })
        .is('effective_to', null) // Only current items
        .limit(50); // Limit results for keyword searches

        // ... (inside the else block for keyword search)
     supabaseQuery = supabase
       .rpc('search_mbs_items_by_description', { search_query: query })
       .select(selectColumns) // This select might not work as expected after rpc, rpc usually returns full shape or predefined one
          .limit(50);
        // If using RPC that returns the full mbs_items shape, ensure your select logic is handled within the PG function or map afterwards.
        // For simplicity, I've used the .textSearch method above.
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ error: 'Error fetching data from Supabase', details: error.message }, { status: 500 });
    }

    // Map to SearchResultItem to only return necessary fields
    const results: SearchResultItem[] = data || [];
    return NextResponse.json(results);

  } catch (err) {
    console.error('API route error:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
  }
}
