-- O pagamento da consulta na agenda, e o Pix do grupo (11/11/2026: "os dois").
--
-- 1. REGISTRAR PAGAMENTO. A recepção lançava o valor só no cadastro do
--    paciente. Quem cobra na maquininha (cartão ou Pix) precisava de um lugar
--    para dizer "pago" na consulta. Agora a consulta guarda que foi paga, como
--    e quanto, e o valor entra no Financeiro pela MESMA função do cadastro
--    (receber_particular): a linha que a rota de faturar procura e completa
--    quando o médico conclui a avaliação continua a mesma.
--
-- 2. O PIX DO GRUPO. Para cobrar à distância, pelo WhatsApp, antes da
--    consulta: o AVANEST gera o "copia e cola" e o QR Code no padrão do Banco
--    Central (lib/pix.ts) com a chave que o administrador cadastra aqui. A
--    chave Pix não é segredo (vai para quem paga), mas só o administrador a
--    troca, e a troca fica registrada.

alter table public.agendamentos add column if not exists pago_em timestamptz;
alter table public.agendamentos add column if not exists pago_valor numeric(12, 2);
alter table public.agendamentos add column if not exists pago_metodo text;
alter table public.agendamentos add column if not exists pago_referencia text;
alter table public.agendamentos add column if not exists financeiro_atendimento_id uuid
  references public.financeiro_atendimentos(id) on delete set null;

alter table public.instituicoes add column if not exists pix_tipo text;
alter table public.instituicoes add column if not exists pix_chave text;
alter table public.instituicoes add column if not exists pix_nome text;
alter table public.instituicoes add column if not exists pix_cidade text;

-- ── Registrar o pagamento da consulta ─────────────────────────────────────
create or replace function public.receber_consulta(
  p_agendamento_id uuid, p_valor numeric, p_metodo text, p_referencia text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ag public.agendamentos;
  v_id uuid;
begin
  if not (public.current_has_permission('recepcao') or public.current_has_permission('medico')) then
    raise exception 'Sem permissão para registrar recebimento';
  end if;
  select * into v_ag from public.agendamentos a
   where a.id = p_agendamento_id and a.institution_id = public.current_institution_id()
   for update;
  if v_ag.id is null then raise exception 'Consulta não encontrada'; end if;
  if v_ag.pago_em is not null then
    raise exception 'Esta consulta já tem pagamento registrado. Para corrigir, use o Financeiro.';
  end if;

  -- As outras conferências (valor, forma, módulo financeiro, paciente da
  -- organização) e o registro na auditoria são as do cadastro.
  v_id := public.receber_particular(v_ag.patient_id, p_valor, p_metodo, p_referencia);

  update public.financeiro_atendimentos
     set observacoes = 'Recebido na recepção, consulta de ' || to_char(v_ag.data, 'DD/MM/YYYY') || '.'
   where id = v_id;
  update public.agendamentos
     set pago_em = now(), pago_valor = p_valor, pago_metodo = p_metodo,
         pago_referencia = nullif(trim(coalesce(p_referencia, '')), ''), financeiro_atendimento_id = v_id
   where id = v_ag.id;
  return v_id;
end;
$$;

revoke all on function public.receber_consulta(uuid, numeric, text, text) from public, anon;
grant execute on function public.receber_consulta(uuid, numeric, text, text) to authenticated;

-- ── O Pix do grupo ────────────────────────────────────────────────────────
-- A chave chega normalizada pela tela (lib/pix.ts); aqui confere o básico.
-- Chave vazia apaga o Pix da organização.
create or replace function public.definir_pix_da_organizacao(p_tipo text, p_chave text, p_nome text, p_cidade text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid := public.current_institution_id();
  v_chave text := nullif(trim(coalesce(p_chave, '')), '');
begin
  if v_inst is null or not public.current_has_permission('admin') then
    raise exception 'Só o administrador muda o Pix da organização.';
  end if;
  if v_chave is not null then
    if p_tipo is null or p_tipo not in ('cpf', 'cnpj', 'celular', 'email', 'aleatoria') then
      raise exception 'Tipo de chave inválido';
    end if;
    if length(v_chave) > 77 then raise exception 'Chave Pix longa demais'; end if;
    if length(trim(coalesce(p_nome, ''))) not between 1 and 25 then
      raise exception 'O nome de quem recebe tem até 25 letras.';
    end if;
    if length(trim(coalesce(p_cidade, ''))) not between 1 and 15 then
      raise exception 'A cidade tem até 15 letras.';
    end if;
  end if;

  update public.instituicoes
     set pix_tipo = case when v_chave is null then null else p_tipo end,
         pix_chave = v_chave,
         pix_nome = case when v_chave is null then null else trim(p_nome) end,
         pix_cidade = case when v_chave is null then null else trim(p_cidade) end
   where id = v_inst;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_inst, auth.uid(), 'instituicao', v_inst,
          case when v_chave is null then 'pix_removido' else 'pix_definido' end,
          jsonb_build_object('tipo', p_tipo, 'chave', v_chave, 'nome', p_nome, 'cidade', p_cidade));
end;
$$;

revoke all on function public.definir_pix_da_organizacao(text, text, text, text) from public, anon;
grant execute on function public.definir_pix_da_organizacao(text, text, text, text) to authenticated;

create or replace function public.pix_da_organizacao()
returns table (tipo text, chave text, nome text, cidade text, organizacao text)
language sql
stable
security definer
set search_path = public
as $$
  select i.pix_tipo, i.pix_chave, i.pix_nome, i.pix_cidade, i.nome
    from public.instituicoes i
   where i.id = public.current_institution_id()
     and i.pix_chave is not null
     and (public.current_has_permission('recepcao') or public.current_has_permission('medico')
          or public.current_has_permission('financeiro'));
$$;

revoke all on function public.pix_da_organizacao() from public, anon;
grant execute on function public.pix_da_organizacao() to authenticated;
