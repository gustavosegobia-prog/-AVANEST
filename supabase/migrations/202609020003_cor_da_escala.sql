-- A cor de cada um na escala deixa de ser só sorteada.
--
-- Até aqui a cor saía de um hash do nome. Funciona — é estável e não repete —,
-- mas ninguém escolheu nada: a pessoa abre a escala e descobre que é roxa. E
-- como a colisão empurra para a próxima cor livre, a entrada de um colega novo
-- podia trocar a cor de quem já estava lá.
--
-- `cor_escala` é o índice na paleta (0..13, hoje catorze cores). NULO é o
-- padrão e quer dizer "sorteia para mim" — que é como todo mundo continua
-- enquanto não escolher. Guardar o índice, e não o `#rrggbb`, é de propósito:
-- a paleta é ajustada de vez em quando por contraste e por distância entre
-- tons, e um hexadecimal guardado aqui viraria uma cor fora da paleta,
-- ilegível no papel, que ninguém mais saberia de onde veio.
--
-- O teto NÃO é 13 na restrição: é 63. A restrição existe para barrar o
-- absurdo (número negativo, milhão), e não para espelhar o tamanho da paleta —
-- a paleta cresce no código, e uma restrição colada nela obrigaria uma
-- migração a cada cor nova. Índice acima do que a paleta tem é ignorado por
-- `coresDaFolha`, que devolve a pessoa ao sorteio em vez de quebrar a folha.
alter table public.perfis
  add column if not exists cor_escala smallint,
  add constraint perfis_cor_escala_valida check (cor_escala is null or (cor_escala >= 0 and cor_escala <= 63));

comment on column public.perfis.cor_escala is
  'Índice da cor desta pessoa na paleta da escala. Nulo = sorteada pelo nome. Guarda o índice, não o hexadecimal: a paleta é ajustada por contraste e um hexadecimal preso aqui sairia fora dela.';

-- Quem pode mudar a cor de quem.
--
-- A própria pessoa, sempre: é a cor dela na parede, e pedir para o
-- administrador trocar seria burocracia para uma decisão que não afeta
-- ninguém. E o administrador, na equipe dele: é quem imprime a folha e quem
-- ouve "não dá para diferenciar esses dois azuis".
--
-- Não impede duas pessoas de pedirem a mesma cor. Isso é decidido na hora de
-- montar a folha, e ali a regra é uma só: não repetir. Uma restrição de
-- unicidade aqui pareceria mais rígida e seria pior — recusaria a escolha de
-- quem chegou depois com um erro de banco, em vez de simplesmente sortear
-- outra para ele.
create or replace function public.definir_cor_escala(p_perfil_id uuid, p_cor smallint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_eu public.perfis;
  v_alvo public.perfis;
begin
  select * into v_eu from public.perfis where id = auth.uid();
  if v_eu.id is null or v_eu.status <> 'ativo' then
    raise exception 'Sem permissão';
  end if;

  select * into v_alvo from public.perfis where id = p_perfil_id;
  if v_alvo.id is null or v_alvo.institution_id <> v_eu.institution_id then
    raise exception 'Perfil não encontrado nesta organização';
  end if;

  if v_eu.id <> v_alvo.id and v_eu.role not in ('admin','owner') then
    raise exception 'Só o próprio, o administrador ou o proprietário pode mudar a cor';
  end if;

  if p_cor is not null and (p_cor < 0 or p_cor > 63) then
    raise exception 'Cor fora da paleta';
  end if;

  update public.perfis
     set cor_escala = p_cor, updated_at = now()
   where id = p_perfil_id;
end;
$$;

comment on function public.definir_cor_escala(uuid, smallint) is
  'Fixa (ou solta, com nulo) a cor de uma pessoa na escala. A própria pessoa sempre pode; administrador e proprietário podem na equipe deles.';

revoke execute on function public.definir_cor_escala(uuid, smallint) from public, anon;
grant  execute on function public.definir_cor_escala(uuid, smallint) to authenticated;
