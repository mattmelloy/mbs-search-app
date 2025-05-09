export interface MbsItem {
    mbs_item_id: string;
    item_code: string;
    description: string;
    category?: string | null;
    sub_category?: string | null;
    item_type?: string | null;
    schedule_fee: number;
    benefit_75_percent: number;
    benefit_85_percent: number;
    is_assist_eligible: boolean;
    is_anaes_eligible: boolean;
    explanatory_note_refs?: string | null; // Stored as TEXT, could be 'TN.8.2' or '["TN.8.2", "TN.8.15"]'
    raw_xml_fragment?: any | null; // JSONB
    effective_from: string; // Date string
    effective_to?: string | null; // Date string
    version_tag?: string | null;
    created_at: string; // Timestamp string
    updated_at: string; // Timestamp string
  }
  
  export interface SearchResultItem {
    item_code: string;
    description: string;
    schedule_fee: number;
    benefit_75_percent: number;
    benefit_85_percent: number;
    is_assist_eligible: boolean; // New
    is_anaes_eligible: boolean; // New
  }