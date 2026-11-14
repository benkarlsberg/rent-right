alter table public.units
  add column if not exists law_choice text not null default 'unsure';

alter table public.units
  drop constraint if exists units_law_choice_check;

alter table public.units
  add constraint units_law_choice_check check (law_choice in ('yes', 'no', 'unsure'));
