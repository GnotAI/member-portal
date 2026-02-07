-- Allow clients to insert their own projects
drop policy if exists "Clients can insert their own projects" on projects;
create policy "Clients can insert their own projects"
  on projects for insert
  with check ( client_id = auth.uid() );
