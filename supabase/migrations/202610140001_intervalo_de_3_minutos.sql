-- A ficha anestésica também de 3 em 3 minutos.
--
-- O intervalo da folha (a grade do gráfico e a linha pronta para arrastar)
-- era 5, 10 ou 15 min. Indução, criança pequena e paciente instável pedem
-- PA e FC mais apertadas: entra o de 3 min. O banco confere a mesma lista
-- que a tela oferece (lib/evolucao/sinais.ts, INTERVALOS).

alter table public.evolucoes_anestesicas
  drop constraint if exists evolucoes_anestesicas_intervalo_minutos_check;
alter table public.evolucoes_anestesicas
  add constraint evolucoes_anestesicas_intervalo_minutos_check
  check (intervalo_minutos in (3, 5, 10, 15));

create or replace function public.definir_intervalo_evolucao(p_id uuid, p_minutos integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare f public.evolucoes_anestesicas%rowtype;
begin
  select * into f from public.evolucoes_anestesicas where id = p_id;
  if not found or not public.pode_evolucao(f.institution_id) then raise exception 'FOLHA_INEXISTENTE'; end if;
  if p_minutos not in (3, 5, 10, 15) then raise exception 'INTERVALO_INVALIDO'; end if;
  update public.evolucoes_anestesicas set intervalo_minutos = p_minutos where id = p_id;
end;
$$;
revoke all on function public.definir_intervalo_evolucao(uuid, integer) from public;
grant execute on function public.definir_intervalo_evolucao(uuid, integer) to authenticated;
