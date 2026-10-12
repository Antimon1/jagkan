-- The larger library (docs/idepanel-helhetsanalys.md): two new branches, Tid &
-- planering ('tid') and Omtanke ('omtanke'), and retired challenges that are hidden
-- from the library but keep working for families that already use them. The
-- catalog migration after this one fills the new rows and columns.
do $$
declare
  t text;
begin
  foreach t in array array['challenge_templates', 'creatures', 'child_challenges'] loop
    execute format('alter table public.%I drop constraint %I', t, t || '_branch_check');
    execute format(
      'alter table public.%I add constraint %I check (branch in (%L, %L, %L, %L, %L, %L, %L, %L, %L))',
      t, t || '_branch_check', 'kropp', 'mat', 'hem', 'tid', 'ute', 'pengar', 'kanslor', 'omtanke', 'mod');
  end loop;
end $$;

alter table public.challenge_templates add column retired boolean not null default false;
