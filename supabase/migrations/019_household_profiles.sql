-- A person on a home can see the name and email of the other people on that home.
create policy profiles_household_select on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.unit_members mine
      join public.unit_members theirs on theirs.unit_id = mine.unit_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );
