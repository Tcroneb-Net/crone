-- Hostify AI Agent Supabase schema
-- Run in Supabase SQL Editor after creating your project.

create extension if not exists pgcrypto;

create table if not exists public.hostify_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled Project',
  files jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hostify_deployments (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  deployment_id text not null unique,
  storage_bucket text not null,
  storage_path text not null,
  preview_url text,
  zip_url text,
  created_at timestamptz not null default now()
);

-- Create the public storage bucket used by /api/publish.
insert into storage.buckets (id, name, public)
values ('hostify-projects', 'hostify-projects', true)
on conflict (id) do update set public = true;

-- Public read access for generated projects.
drop policy if exists "Hostify public read" on storage.objects;
create policy "Hostify public read"
on storage.objects for select
using (bucket_id = 'hostify-projects');

-- Service role bypasses RLS. If you later add authenticated uploads, add insert/update policies for authenticated users.
alter table public.hostify_projects enable row level security;
alter table public.hostify_deployments enable row level security;
