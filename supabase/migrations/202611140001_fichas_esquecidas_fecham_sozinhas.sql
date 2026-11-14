-- A ficha esquecida aberta fecha sozinha depois da virada do dia (14/11/2026:
-- "já mudou o dia… não era para ter arquivado quem fez e excluído quem não fez?").
--
-- Quem roda: o agendador da Vercel (rota /api/evolucao/fechar-do-dia), de hora
-- em hora, com a chave de serviço. Mais ninguém: nem visitante, nem usuário.
--
-- A regra:
--   * só ficha ABERTA, aberta antes de hoje (fuso de Brasília) e sem nada
--     escrito nas últimas 3 horas. A cirurgia que atravessa a meia-noite fica
--     em paz até terminar;
--   * sem nenhum registro: é excluída, como no "Excluir" da tela, e a
--     auditoria guarda o cabeçalho;
--   * com registro: é encerrada, como no "Encerrar" da tela. A versão fica
--     guardada e a produção do dia é lançada. Mas ninguém a encerrou:
--     encerrada_por fica vazio, e a lista e a impressão dizem "encerrada
--     automaticamente". encerrada_em é a hora do último registro, e não a da
--     madrugada em que a rotina passou: assim a lista mostra o horário do caso
--     e o consumo de sevoflurano não corre até a madrugada.
--   Quem precisar corrigir reabre com motivo, como sempre.

-- A versão encerrada pela rotina não tem quem encerrou.
alter table public.evolucao_versoes alter column encerrada_por drop not null;

-- p_agora só existe para o teste simular o dia seguinte; a rota não o manda.
create or replace function public.fechar_fichas_esquecidas(p_agora timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- 00:00 de hoje em Brasília.
  v_agora timestamptz := coalesce(p_agora, now());
  v_corte timestamptz := date_trunc('day', v_agora at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  f public.evolucoes_anestesicas%rowtype;
  v_registros integer;
  v_ultimo timestamptz;
  v_fim timestamptz;
  v_encerradas integer := 0;
  v_excluidas integer := 0;
begin
  for f in
    select e.* from public.evolucoes_anestesicas e
     where e.status = 'aberta'
       and e.created_at < v_corte
       and greatest(e.updated_at,
                    coalesce((select max(r.created_at) from public.evolucao_registros r
                               where r.evolucao_id = e.id), e.updated_at))
           < v_agora - interval '3 hours'
     order by e.created_at
     for update of e skip locked
  loop
    select count(*) into v_registros from public.evolucao_registros r where r.evolucao_id = f.id;

    if v_registros = 0 and f.versao = 1
       and not exists (select 1 from public.evolucao_versoes v where v.evolucao_id = f.id) then
      -- Não fez: some, como no "Excluir" da tela.
      insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
      values (f.institution_id, null, 'evolucao_anestesica', f.id, 'excluir',
              jsonb_build_object('motivo', 'Ficha vazia, excluída automaticamente depois da virada do dia',
                                 'automatico', true, 'paciente_id', f.patient_id,
                                 'criada_em', f.created_at, 'criada_por', f.created_by,
                                 'registros', 0, 'cabecalho', f.dados));
      delete from public.evolucoes_anestesicas where id = f.id;
      v_excluidas := v_excluidas + 1;
      continue;
    end if;

    -- Fez: encerra, como no "Encerrar" da tela, na hora do último registro.
    select max(r.momento) into v_ultimo from public.registros_vigentes_evolucao(f.id) r;
    v_fim := least(greatest(coalesce(v_ultimo, f.updated_at), f.inicio_em), v_agora);

    update public.evolucoes_anestesicas
       set status = 'encerrada', encerrada_em = v_fim, encerrada_por = null, updated_at = now()
     where id = f.id;
    insert into public.evolucao_versoes(evolucao_id, institution_id, versao, dados, registros, encerrada_em, encerrada_por)
    values (f.id, f.institution_id, f.versao, f.dados,
            coalesce((select jsonb_agg(to_jsonb(r)) from public.registros_vigentes_evolucao(f.id) r), '[]'::jsonb),
            v_fim, null);
    insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
    values (f.institution_id, null, 'evolucao_anestesica', f.id, 'encerrar',
            jsonb_build_object('versao', f.versao, 'automatico', true, 'encerrada_em', v_fim));
    -- A Produção do responsável. Falhar aqui não desfaz o encerramento.
    begin
      perform public.producao_da_ficha(f.id);
    exception when others then
      raise warning 'producao_da_ficha(%): %', f.id, sqlerrm;
    end;
    v_encerradas := v_encerradas + 1;
  end loop;

  return jsonb_build_object('encerradas', v_encerradas, 'excluidas', v_excluidas);
end;
$$;
revoke all on function public.fechar_fichas_esquecidas(timestamptz) from public, anon, authenticated;
grant execute on function public.fechar_fichas_esquecidas(timestamptz) to service_role;
