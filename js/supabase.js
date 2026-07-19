// js/supabase.js
// Configuração e inicialização do cliente Supabase

const SUPABASE_URL      = 'https://zwcvaqxdfurmexyuxtvv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3Y3ZhcXhkZnVybWV4eXV4dHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzI3ODUsImV4cCI6MjA5OTQ0ODc4NX0.lKmjdZznodxT6QPZ8QyZOTpc_DrRROAyjKA1muPtS-Y';

// Cria o cliente global Supabase (disponível para todos os outros scripts)
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
