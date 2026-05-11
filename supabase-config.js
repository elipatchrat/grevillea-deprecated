// SQL Schema (lowercase columns - PostgreSQL folds camelCase):
// -- Profiles table
// create table profiles (
//   id uuid default gen_random_uuid() primary key,
//   user_id uuid references auth.users(id) on delete cascade unique,
//   full_name text,
//   nickname text,
//   role text,
//   study_style text,
//   discovery_source text,
//   onboarding_completed boolean default false,
//   created_at timestamptz default now(),
//   updated_at timestamptz default now()
// );
// alter table profiles enable row level security;
// create policy "Users can select their own profile" on profiles for select using (auth.uid() = user_id);
// create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = user_id);
// create policy "Users can update their own profile" on profiles for update using (auth.uid() = user_id);
//
// -- Tasks table
// create table tasks (
//   id uuid default gen_random_uuid() primary key,
//   user_id uuid references auth.users(id) on delete cascade,
//   text text not null,
//   completed boolean default false,
//   tag text default 'General',
//   date text,
//   createdat timestamptz default now(),
//   updatedat timestamptz default now()
// );
// alter table tasks enable row level security;
// create policy "Users can select their own tasks" on tasks for select using (auth.uid() = user_id);
// create policy "Users can insert their own tasks" on tasks for insert with check (auth.uid() = user_id);
// create policy "Users can update their own tasks" on tasks for update using (auth.uid() = user_id);
// create policy "Users can delete their own tasks" on tasks for delete using (auth.uid() = user_id);
//
// -- Notes table
// create table notes (
//   id uuid default gen_random_uuid() primary key,
//   user_id uuid references auth.users(id) on delete cascade,
//   title text,
//   category text default 'General',
//   content text,
//   createdat timestamptz default now(),
//   updatedat timestamptz default now()
// );
// alter table notes enable row level security;
// create policy "Users can select their own notes" on notes for select using (auth.uid() = user_id);
// create policy "Users can insert their own notes" on notes for insert with check (auth.uid() = user_id);
// create policy "Users can update their own notes" on notes for update using (auth.uid() = user_id);
// create policy "Users can delete their own notes" on notes for delete using (auth.uid() = user_id);
//
// -- User stats table (study time & streak)
// create table user_stats (
//   id uuid default gen_random_uuid() primary key,
//   user_id uuid references auth.users(id) on delete cascade unique,
//   study_time_today integer default 0,
//   current_streak integer default 0,
//   last_study_date date,
//   updated_at timestamptz default now()
// );
// alter table user_stats enable row level security;
// create policy "Users can select their own stats" on user_stats for select using (auth.uid() = user_id);
// create policy "Users can insert their own stats" on user_stats for insert with check (auth.uid() = user_id);
// create policy "Users can update their own stats" on user_stats for update using (auth.uid() = user_id);

const SUPABASE_URL = 'https://asylgnxgjyubixorsfmg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzeWxnbnhnanl1Yml4b3JzZm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDA0MjUsImV4cCI6MjA5MTgxNjQyNX0.gRFw2KL8yUtJ74OUUcUKREKAj1DoXep_gmwr5ZfOYOI';

// Initialize Supabase client
let supabaseClient = null;

function initSupabase() {
    try {
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase initialized successfully');
            return supabaseClient;
        } else {
            console.error('Supabase library not loaded - falling back to demo mode');
            return null;
        }
    } catch (error) {
        console.error('Supabase initialization error:', error);
        return null;
    }
}

function getSupabase() {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
}

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', function() {
    initSupabase();
});
