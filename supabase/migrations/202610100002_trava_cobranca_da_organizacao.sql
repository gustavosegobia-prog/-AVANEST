-- A cobrança da organização só muda por quem cobra.
--
-- protege_assinatura já devolvia plano, validade e os ids de pagamento ao
-- valor antigo quando o update vinha de um usuário. O resto do que é cobrança
-- ficava aberto: num teste com um proprietário comum (transação desfeita), um
-- update direto levou max_profissionais de vazio para 999 — e é esse número
-- que limita quantos anestesiologistas o plano atende (limita_assentos).
-- Também ficavam abertos o plano contratado, o preço, a vaga de fundador, a
-- situação da organização, o cancelamento com o reembolso devido e o aceite
-- dos termos.
--
-- Agora, para usuário que não é super-admin, o update só muda o que a tela de
-- configurações muda: nome, telefone, e-mail, CNPJ e logo. O resto volta ao
-- valor antigo, como já acontecia com o plano. Quem grava cobrança de verdade
-- passa: o servidor (sem auth.uid — reservar_plano, webhooks, aceite de
-- termos), o super-admin, e as duas funções que o próprio proprietário chama
-- (cancelar e reativar), que se identificam com um sinal da transação.

create or replace function public.protege_cobranca_da_organizacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.e_super_admin()
     or coalesce(current_setting('avanest.interno', true), '') = '1' then
    return new;
  end if;
  new.status              := old.status;
  new.tipo                := old.tipo;
  new.plano_codigo        := old.plano_codigo;
  new.preco_contratado    := old.preco_contratado;
  new.contratado_em       := old.contratado_em;
  new.preco_fundador      := old.preco_fundador;
  new.max_profissionais   := old.max_profissionais;
  new.fundador_perdido    := old.fundador_perdido;
  new.mp_payer_email      := old.mp_payer_email;
  new.cancelada_em        := old.cancelada_em;
  new.cancelada_por       := old.cancelada_por;
  new.cancelamento_motivo := old.cancelamento_motivo;
  new.reembolso_devido    := old.reembolso_devido;
  new.termos_aceitos_em   := old.termos_aceitos_em;
  new.termos_aceitos_por  := old.termos_aceitos_por;
  new.termos_versao       := old.termos_versao;
  return new;
end;
$$;
revoke execute on function public.protege_cobranca_da_organizacao() from public, anon, authenticated;

drop trigger if exists protege_cobranca_da_organizacao on public.instituicoes;
create trigger protege_cobranca_da_organizacao
  before update on public.instituicoes
  for each row execute function public.protege_cobranca_da_organizacao();

-- Cancelar e reativar: mesma regra de antes, agora com o sinal da transação
-- para o gatilho acima deixar gravar o cancelamento.
create or replace function public.cancelar_assinatura(p_motivo text default null)
returns table(cancelada_em timestamptz, acesso_ate timestamptz, reembolso_devido boolean, dias_de_uso integer)
language plpgsql
security definer
set search_path = public
as $$
declare v_perfil public.perfis; v_instituicao public.instituicoes;
        v_inicio timestamptz; v_dias integer; v_reembolso boolean;
begin
  select * into v_perfil from public.perfis where id = auth.uid() and status = 'ativo';
  if v_perfil.id is null or v_perfil.role not in ('owner','admin') then
    raise exception 'Somente o proprietário ou o administrador pode cancelar a assinatura';
  end if;
  select * into v_instituicao from public.instituicoes where id = v_perfil.institution_id;
  if v_instituicao.id is null then raise exception 'Organização não encontrada'; end if;

  v_inicio := public.inicio_do_ciclo(v_instituicao.id);
  v_dias := case when v_inicio is null then null
                 else floor(extract(epoch from (now() - v_inicio)) / 86400)::integer end;
  v_reembolso := v_dias is not null and v_dias <= public.dias_de_reembolso();

  if v_instituicao.cancelada_em is not null then
    return query select v_instituicao.cancelada_em, v_instituicao.assinatura_ate,
                        coalesce(v_instituicao.reembolso_devido, false), v_dias;
    return;
  end if;

  perform set_config('avanest.interno', '1', true);
  update public.instituicoes
  set cancelada_em = now(), cancelada_por = auth.uid(),
      cancelamento_motivo = nullif(btrim(coalesce(p_motivo,'')), ''),
      reembolso_devido = v_reembolso, updated_at = now()
  where id = v_instituicao.id returning * into v_instituicao;
  perform set_config('avanest.interno', '', true);

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_instituicao.id, auth.uid(), 'assinatura', v_instituicao.id, 'assinatura_cancelada',
    jsonb_build_object('motivo', v_instituicao.cancelamento_motivo,
      'acesso_ate', v_instituicao.assinatura_ate, 'plano', v_instituicao.plano,
      'dias_de_uso', v_dias, 'reembolso_devido', v_reembolso,
      'prazo_de_reembolso_dias', public.dias_de_reembolso()));

  return query select v_instituicao.cancelada_em, v_instituicao.assinatura_ate, v_reembolso, v_dias;
end;
$$;

create or replace function public.reativar_assinatura()
returns public.instituicoes
language plpgsql
security definer
set search_path = public
as $$
declare v_perfil public.perfis; v_instituicao public.instituicoes;
begin
  select * into v_perfil from public.perfis where id = auth.uid() and status = 'ativo';
  if v_perfil.id is null or v_perfil.role not in ('owner','admin') then
    raise exception 'Somente o proprietário ou o administrador pode reativar a assinatura';
  end if;
  select * into v_instituicao from public.instituicoes where id = v_perfil.institution_id;
  if v_instituicao.cancelada_em is null then return v_instituicao; end if;
  if v_instituicao.assinatura_ate is not null and v_instituicao.assinatura_ate <= now() then
    raise exception 'O período pago já venceu. Para voltar, é preciso assinar de novo.';
  end if;
  perform set_config('avanest.interno', '1', true);
  update public.instituicoes
  set cancelada_em = null, cancelada_por = null, cancelamento_motivo = null,
      reembolso_devido = null, updated_at = now()
  where id = v_instituicao.id returning * into v_instituicao;
  perform set_config('avanest.interno', '', true);
  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_instituicao.id, auth.uid(), 'assinatura', v_instituicao.id, 'assinatura_reativada',
          jsonb_build_object('acesso_ate', v_instituicao.assinatura_ate));
  return v_instituicao;
end;
$$;

-- ── Higiene apontada pelo verificador do Supabase ───────────────────────────

-- search_path fixo: a função é pura, mas sem o caminho fixo um esquema
-- criado antes de "public" poderia trocar o que ela enxerga.
alter function public.transicao_de_agendamento_valida(text, text, date, boolean) set search_path = public;

-- Funções de gatilho não são para chamar pela API. O gatilho continua
-- disparando: a permissão de EXECUTE só é conferida ao criar o gatilho.
revoke execute on function public.protege_escalista() from public, anon, authenticated;
revoke execute on function public.protege_modulos() from public, anon, authenticated;
revoke execute on function public.protege_assinatura() from public, anon, authenticated;
revoke execute on function public.protege_papel_e_acesso() from public, anon, authenticated;
revoke execute on function public.protege_super_admin() from public, anon, authenticated;
revoke execute on function public.plantao_do_grupo_protegido() from public, anon, authenticated;
revoke execute on function public.confirmacao_de_plantao_honesta() from public, anon, authenticated;
revoke execute on function public.registra_local_na_auditoria() from public, anon, authenticated;
revoke execute on function public.limita_assentos() from public, anon, authenticated;
revoke execute on function public.congela_local_da_avaliacao() from public, anon, authenticated;
revoke execute on function public.chamado_ao_receber_mensagem() from public, anon, authenticated;
