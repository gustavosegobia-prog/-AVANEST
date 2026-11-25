-- A Produção puxa o preço do convênio (22/11/2026). Antes todo lançamento
-- entrava em R$ 0,00 — o da ficha anestésica e o digitado — e o valor era
-- escrito à mão, mesmo com o preço na tabela (SUS C: R$ 250,00).
--
-- Só quando o lançamento está em R$ 0,00: o valor digitado nunca é trocado.
-- No INSERT, e no UPDATE que troca o convênio. Só a regra geral do convênio
-- (sem procedimento nem hospital), ativa e com preço. Faturado ou recebido não
-- muda.
--
-- SECURITY DEFINER porque a tabela de preços só é legível para quem tem o
-- Financeiro, e quem lança a produção é o médico. Lê só a regra da própria
-- organização do lançamento.
create or replace function public.producao_puxa_o_preco()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v numeric;
begin
  if coalesce(new.valor, 0) <> 0 or new.recebido_em is not null or new.faturado_em is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and public.nome_simples(new.convenio) is not distinct from public.nome_simples(old.convenio) then
    return new;
  end if;
  select cv.valor into v
    from public.convenio_valores cv
   where cv.institution_id = new.institution_id and cv.ativo
     and cv.procedimento is null and cv.hospital is null and cv.valor > 0
     and public.nome_simples(cv.convenio) = public.nome_simples(new.convenio)
   order by cv.updated_at desc
   limit 1;
  if v is not null then
    new.valor := v;
  end if;
  return new;
end;
$$;

revoke all on function public.producao_puxa_o_preco() from public, anon, authenticated;

drop trigger if exists producao_puxa_o_preco on public.producao_do_dia;
create trigger producao_puxa_o_preco
  before insert or update of convenio on public.producao_do_dia
  for each row execute function public.producao_puxa_o_preco();
