-- Nenhum evento do Mercado Pago pode ficar órfão.
--
-- O vínculo com a assinatura morava numa única coluna, instituicoes
-- .mp_assinatura_id, sobrescrita a cada checkout. Bastava um cliente pagante
-- clicar em "Assinar" outra vez — por curiosidade, ou para ver outro plano —
-- para o vínculo passar a apontar para a cobrança nova, ainda pendente.
--
-- A partir daí, o webhook da renovação da assinatura que realmente cobra não
-- encontrava mais a organização: instituicao_por_preapproval devolvia nulo, o
-- pagamento era descartado e o cliente perdia o acesso tendo pago. Silencioso,
-- e só apareceria no vencimento seguinte.
--
-- Agora cada preapproval criado fica registrado aqui. A coluna em instituicoes
-- continua existindo e apontando para o vínculo corrente — é dela que as telas
-- leem —, mas a busca do webhook passa por esta tabela, que nunca esquece.

create table if not exists public.assinaturas_mp (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  preapproval_id text not null unique,
  payer_email text,
  created_at timestamptz not null default now()
);

create index if not exists assinaturas_mp_instituicao on public.assinaturas_mp(institution_id);

alter table public.assinaturas_mp enable row level security;

-- Ninguém lê pelo cliente: é registro de infraestrutura de cobrança, e a tela
-- da organização já mostra o que ela precisa saber pela minha_assinatura.
drop policy if exists assinaturas_mp_sem_leitura on public.assinaturas_mp;

-- Traz para a tabela os vínculos que já existem, para os eventos das
-- assinaturas atuais continuarem resolvendo.
insert into public.assinaturas_mp (institution_id, preapproval_id, payer_email, created_at)
select i.id, i.mp_assinatura_id, i.mp_payer_email, coalesce(i.contratado_em, i.created_at)
from public.instituicoes i
where i.mp_assinatura_id is not null
on conflict (preapproval_id) do nothing;

-- E os que aparecem no histórico de eventos, que é onde estão as assinaturas
-- cujo vínculo já foi sobrescrito.
insert into public.assinaturas_mp (institution_id, preapproval_id, created_at)
select distinct on (e.payload->>'id') e.institution_id, e.payload->>'id', min(e.created_at) over (partition by e.payload->>'id')
from public.assinatura_eventos e
where e.tipo = 'assinatura' and coalesce(e.payload->>'id','') <> ''
on conflict (preapproval_id) do nothing;

create or replace function public.vincular_assinatura_mp(
  p_institution_id uuid, p_preapproval_id text, p_payer_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.assinaturas_mp (institution_id, preapproval_id, payer_email)
  values (p_institution_id, p_preapproval_id, p_payer_email)
  on conflict (preapproval_id) do nothing;

  update public.instituicoes
  set mp_assinatura_id = p_preapproval_id,
      mp_payer_email = p_payer_email,
      updated_at = now()
  where id = p_institution_id;
  if not found then raise exception 'Organização não encontrada'; end if;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (p_institution_id, null, 'instituicao', p_institution_id, 'assinatura_vinculada',
    jsonb_build_object('preapproval', p_preapproval_id, 'pagador', p_payer_email));
end;
$$;

-- A coluna vem primeiro por ser o vínculo corrente; a tabela cobre o resto.
create or replace function public.instituicao_por_preapproval(p_preapproval_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select id from public.instituicoes where mp_assinatura_id = p_preapproval_id limit 1),
    (select institution_id from public.assinaturas_mp where preapproval_id = p_preapproval_id limit 1)
  );
$$;

revoke execute on function public.vincular_assinatura_mp(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.instituicao_por_preapproval(text) from public, anon, authenticated;
grant execute on function public.vincular_assinatura_mp(uuid,text,text) to service_role;
grant execute on function public.instituicao_por_preapproval(text) to service_role;
