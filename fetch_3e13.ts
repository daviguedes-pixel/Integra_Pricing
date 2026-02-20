
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = "https://ijygsxwfmribbjymxhaf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqeWdzeHdmbXJpYmJqeW14aGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNDMzOTcsImV4cCI6MjA3MjkxOTM5N30.p_c6M_7eUJcOU2bmuOhx6Na7mQC6cRNEMsHMOlQJuMc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchDetails() {
    const { data: list, error: listError } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (listError) {
        console.error('Error listing:', listError);
        return;
    }

    const found = list.find(item => item.id.startsWith('3e13282f'));

    const results = {
        '3e13282f': found || 'NOT FOUND',
    };

    fs.writeFileSync('details_3e13.json', JSON.stringify(results, null, 2));
    console.log('Written to details_3e13.json');
}

fetchDetails();
