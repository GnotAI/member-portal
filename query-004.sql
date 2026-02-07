-- Allow clients to delete their own projects
drop policy if exists "Clients can delete their own projects" on projects;
create policy "Clients can delete their own projects"
  on projects for delete
  using ( client_id = auth.uid() );
