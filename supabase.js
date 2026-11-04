import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@+2/+esm'

// Aquí es donde pegas la URL de tu proyecto
const SUPABASE_URL = 'https://glwnhpcbcffgebvecfme.supabase.co'; 

// Aquí va tu Publishable key (la llave pública que viste en la sección de API Keys)
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_w1VTPoLlTwNnXNvwQjrytQ_vk-Tc2Dl';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);