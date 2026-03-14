import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://stpbyaozfvwkplqovnkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0cGJ5YW96ZnZ3a3BscW92bmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NzU0NjYsImV4cCI6MjA4OTA1MTQ2Nn0.GMhbRZW4QdrNvjaw8VGQI_3mVgmNELnpEgtyJsBseUk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
