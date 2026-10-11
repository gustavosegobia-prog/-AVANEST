-- Excluir ficha anestésica criada por engano.
--
-- Ficha clínica não se apaga: corrige-se. Mas ficha aberta por engano (o
-- paciente errado, um teste, a cirurgia que não aconteceu) não é documento —
-- é um rascunho que nunca devia ter existido. Esta é a única porta para
-- tirá-la, e ela é estreita:
--
--   • só ficha ABERTA e que NUNCA foi encerrada (versão 1, sem versão
--     guardada). Ficha encerrada é documento; para ela existe reabrir e
--     corrigir, não apagar;
--   • só quem abriu a ficha, o administrador ou o proprietário;
--   • com motivo, e a auditoria guarda quem excluiu, quando, o motivo, o
--     paciente, quantos lançamentos tinha e o cabeçalho inteiro.
--
-- Os lançamentos continuam imutáveis para todo o resto: a trava só deixa
-- passar o DELETE feito aqui dentro, na ficha marcada nesta transação. Não
-- existe política de DELETE nas tabelas — ninguém apaga nada por fora.

create or replace function public.evolucao_registro_imutavel()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('avanest.excluindo_evolucao', true) = old.evolucao_id::text then
    return old;
  end if;
  raise exception 'REGISTRO_IMUTAVEL: corrija inserindo um registro que substitua este';
end;
$$;

create or replace function public.excluir_evolucao(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.evolucoes_anestesicas%rowtype;
  v_registros integer;
begin
  select * into f from public.evolucoes_anestesicas where id = p_id for update;
  if not found or not public.pode_evolucao(f.institution_id) then raise exception 'FOLHA_INEXISTENTE'; end if;
  if f.status <> 'aberta' or f.versao > 1
     or exists (select 1 from public.evolucao_versoes v where v.evolucao_id = p_id) then
    raise exception 'FOLHA_JA_ENCERRADA';
  end if;
  if not (f.created_by = auth.uid() or exists (
    select 1 from public.perfis p
     where p.id = auth.uid() and p.status = 'ativo' and p.role in ('owner', 'admin'))) then
    raise exception 'SEM_PERMISSAO_EXCLUIR';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 5 or char_length(p_motivo) > 300 then
    raise exception 'EXCLUSAO_SEM_MOTIVO';
  end if;

  select count(*) into v_registros from public.evolucao_registros where evolucao_id = p_id;
  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (f.institution_id, auth.uid(), 'evolucao_anestesica', p_id, 'excluir',
          jsonb_build_object('motivo', btrim(p_motivo), 'paciente_id', f.patient_id,
                             'criada_em', f.created_at, 'criada_por', f.created_by,
                             'registros', v_registros, 'cabecalho', f.dados));

  perform set_config('avanest.excluindo_evolucao', p_id::text, true);
  delete from public.evolucao_registros where evolucao_id = p_id;
  perform set_config('avanest.excluindo_evolucao', '', true);
  delete from public.evolucoes_anestesicas where id = p_id;
end;
$$;
revoke all on function public.excluir_evolucao(uuid, text) from public;
grant execute on function public.excluir_evolucao(uuid, text) to authenticated;
