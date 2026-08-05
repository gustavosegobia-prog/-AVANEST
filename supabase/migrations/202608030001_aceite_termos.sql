-- Registro do aceite dos termos e da política de privacidade.
--
-- Uma caixa marcada na tela não prova nada depois: o navegador some, a página
-- muda, e fica a palavra de um contra a do outro. O que vale é o carimbo
-- gravado no servidor no instante em que o pagamento foi aberto — com a versão
-- do documento que estava no ar, porque o texto vai mudar com o tempo e o
-- aceite precisa dizer a que texto se refere.

alter table public.instituicoes
  add column if not exists termos_aceitos_em timestamptz,
  add column if not exists termos_aceitos_por uuid references public.perfis(id) on delete set null,
  add column if not exists termos_versao text;

comment on column public.instituicoes.termos_aceitos_em is
  'Momento em que o responsável aceitou os termos, gravado pelo servidor ao abrir o checkout.';
comment on column public.instituicoes.termos_versao is
  'Data de vigência dos documentos aceitos, para saber a qual texto o aceite se refere.';

-- As colunas entram na proteção: quem usa o sistema não escreve o próprio
-- aceite. Só o servidor, com a chave de serviço, onde auth.uid() é nulo.
create or replace function public.protege_assinatura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.e_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.plano := 'trial';
    new.assinatura_ate := now() + interval '14 days';
    new.valor_por_profissional := 49.99;
    new.mp_assinatura_id := null;
    new.plano_codigo := null;
    new.preco_contratado := null;
    new.contratado_em := null;
    new.preco_fundador := false;
    new.max_profissionais := null;
    new.fundador_perdido := false;
    new.termos_aceitos_em := null;
    new.termos_aceitos_por := null;
    new.termos_versao := null;
    return new;
  end if;

  new.plano := old.plano;
  new.assinatura_ate := old.assinatura_ate;
  new.valor_por_profissional := old.valor_por_profissional;
  new.mp_assinatura_id := old.mp_assinatura_id;
  new.plano_codigo := old.plano_codigo;
  new.preco_contratado := old.preco_contratado;
  new.contratado_em := old.contratado_em;
  new.preco_fundador := old.preco_fundador;
  new.max_profissionais := old.max_profissionais;
  new.fundador_perdido := old.fundador_perdido;
  new.termos_aceitos_em := old.termos_aceitos_em;
  new.termos_aceitos_por := old.termos_aceitos_por;
  new.termos_versao := old.termos_versao;
  return new;
end;
$$;

-- Grava o aceite. Só a chave de serviço chama, a partir da rota de checkout.
create or replace function public.registrar_aceite_termos(
  p_institution_id uuid,
  p_perfil_id uuid,
  p_versao text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.instituicoes
  set termos_aceitos_em = coalesce(termos_aceitos_em, now()),
      termos_aceitos_por = coalesce(termos_aceitos_por, p_perfil_id),
      termos_versao = coalesce(termos_versao, p_versao),
      updated_at = now()
  where id = p_institution_id;
end;
$$;

revoke execute on function public.registrar_aceite_termos(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.registrar_aceite_termos(uuid,uuid,text) to service_role;
