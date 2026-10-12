-- Praise cards (docs/idepanel-helhetsanalys.md): pure emotion and value acts give a
-- praise card in the album, without a star or a creature (src/domain/types.ts
-- ChallengeReward). The catalog migration after this one fills the column.
alter table public.challenge_templates
  add column reward text not null default 'star' check (reward in ('star', 'praise'));
