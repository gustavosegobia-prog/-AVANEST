-- Valor zero não é valor ausente.
--
-- plantoes.valor é NOT NULL com padrão 0: o banco guardava 0 tanto para
-- "ninguém digitou o valor" quanto para "o valor deste plantão é R$ 0,00".
-- A Escala precisa distinguir os dois para listar "valores não preenchidos"
-- sem acusar quem informou zero de propósito.
--
-- valor_informado = alguém gravou um valor. Os registros antigos com valor
-- positivo foram claramente preenchidos; os antigos com zero ficam como não
-- informados, porque não há como saber — é a leitura conservadora, e basta
-- salvar o valor (mesmo zero) uma vez para marcar.
--
-- A marca é mantida pelo próprio banco: qualquer gravação que mude o valor
-- marca como informado, então telas antigas e importações continuam certas
-- sem precisar mandar a coluna. Regravar o mesmo valor (0 → 0) só marca se a
-- tela disser explicitamente valor_informado = true.

alter table public.plantoes
  add column if not exists valor_informado boolean not null default false;

update public.plantoes set valor_informado = true where valor <> 0 and not valor_informado;

create or replace function public.marca_valor_informado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.valor_informado := coalesce(new.valor_informado, false) or coalesce(new.valor, 0) <> 0;
  elsif new.valor is distinct from old.valor then
    new.valor_informado := true;
  elsif old.valor_informado and not new.valor_informado then
    -- Uma vez informado, não volta a "ausente" por engano de uma tela.
    new.valor_informado := true;
  end if;
  return new;
end;
$$;

revoke execute on function public.marca_valor_informado() from public, anon, authenticated;

drop trigger if exists valor_informado_do_plantao on public.plantoes;
create trigger valor_informado_do_plantao
  before insert or update on public.plantoes
  for each row execute function public.marca_valor_informado();
