-- Allow clients to update their own projects
drop policy if exists "Clients can update their own projects" on projects;
create policy "Clients can update their own projects"
  on projects for update
  using ( client_id = auth.uid() );
