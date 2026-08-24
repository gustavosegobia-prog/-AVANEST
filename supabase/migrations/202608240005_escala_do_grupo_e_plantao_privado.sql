-- ===========================================================================
-- Duas regras da escala: o que é do grupo, e o que é só meu
-- ===========================================================================
-- REGRA 1 — plantão da escala do grupo não se apaga, se passa.
--
-- Até aqui, quem estava escalado podia sumir do turno sozinho: apagava a
-- linha e pronto. Ninguém era avisado, e o buraco só aparecia no dia, quando
-- o paciente já estava na sala. Agora sair de um plantão do grupo tem um
-- caminho só: oferecer a um colega e esperar ele aceitar. Enquanto ninguém
-- aceita, o plantão continua seu — que é exatamente o que "estar escalado"
-- significa.
--
-- REGRA 2 — plantão privado, que só quem lançou enxerga.
--
-- O anestesista faz sedação em consultório de endoscopia, cobre um hospital
-- que não é do grupo, atende num lugar que ninguém mais do serviço conhece.
-- Isso é agenda dele: precisa aparecer na escala pessoal — para ele não
-- aceitar dois plantões no mesmo horário e para o dinheiro entrar na conta do
-- mês — e não pode aparecer para o grupo.
--
-- Sem exceção para administrador. "Os outros" inclui o chefe do grupo: um
-- plantão que o dono da clínica enxerga não é privado, é privado até segunda
-- ordem. É a mesma decisão da produção do dia, e pelo mesmo motivo.
--
-- POR QUE NO BANCO, E NÃO NA TELA
--
-- Esconder o botão de apagar impede o clique, não o pedido. E uma listagem
-- que filtra plantão privado no JavaScript já trouxe o dado do servidor: ele
-- está no navegador de quem não devia ter recebido. As duas regras são de
-- quem manda no dado, e quem manda no dado é o Postgres.
-- ===========================================================================

alter table public.plantoes
  add column if not exists privado boolean not null default false;

-- O lugar por extenso, para o que não está no cadastro de locais.
--
-- Existe porque cadastrar a clínica de endoscopia em "Locais de atendimento"
-- resolveria o nome e estragaria o resto: o local do cadastro é do grupo, vira
-- uma coluna na escala do grupo e aparece para todo mundo. O plantão de fora
-- precisa de um nome sem virar endereço da organização.
alter table public.plantoes
  add column if not exists local_texto text;

-- Um plantão é de um cadastro OU de um lugar escrito à mão, nunca dos dois:
-- com os dois preenchidos, cada tela escolheria um e a mesma linha teria dois
-- lugares diferentes conforme onde fosse lida.
alter table public.plantoes
  drop constraint if exists plantoes_lugar_unico;
alter table public.plantoes
  add constraint plantoes_lugar_unico
  check (local_id is null or local_texto is null);

-- "Privado é sempre de quem lançou" não vira CHECK: a regra depende de quem
-- está pedindo, e constraint não conhece auth.uid(). Ela mora nas políticas de
-- inserir e alterar, logo abaixo.
create index if not exists plantoes_privados_idx
  on public.plantoes (perfil_id, data)
  where privado;

-- ---------------------------------------------------------------------------
-- Leitura: a escala do grupo é do grupo, menos o que é privado
-- ---------------------------------------------------------------------------
drop policy if exists "equipe_le_plantoes" on public.plantoes;
create policy "equipe_le_plantoes" on public.plantoes
  for select using (
    institution_id = public.current_institution_id()
    and (privado = false or perfil_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Escrita: três políticas no lugar de uma
--
-- Antes era um `for all` só. Ele cobria inserir, alterar e apagar com a mesma
-- frase — e apagar precisa de uma frase diferente das outras duas.
-- ---------------------------------------------------------------------------
drop policy if exists "cada_um_no_seu_plantao" on public.plantoes;

drop policy if exists "lanca_o_seu_plantao" on public.plantoes;
create policy "lanca_o_seu_plantao" on public.plantoes
  for insert to authenticated with check (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or public.current_app_role() in ('owner','admin'))
    -- Privado só para si, nunca para outro.
    and (privado = false or perfil_id = auth.uid())
  );

drop policy if exists "altera_o_seu_plantao" on public.plantoes;
create policy "altera_o_seu_plantao" on public.plantoes
  for update to authenticated using (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or public.current_app_role() in ('owner','admin'))
  ) with check (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or public.current_app_role() in ('owner','admin'))
    and (privado = false or perfil_id = auth.uid())
  );

-- Apagar: o privado é seu e some quando você quiser. O da escala do grupo só
-- quem monta a escala apaga — para os outros, o caminho é passar adiante.
drop policy if exists "apaga_o_que_e_so_seu" on public.plantoes;
create policy "apaga_o_que_e_so_seu" on public.plantoes
  for delete to authenticated using (
    institution_id = public.current_institution_id()
    and (public.current_app_role() in ('owner','admin')
         or (perfil_id = auth.uid() and privado))
  );

-- ---------------------------------------------------------------------------
-- O gatilho: a mensagem, e as portas dos fundos
--
-- A política de apagar já barra o DELETE, mas barrar com política devolve
-- "nenhuma linha apagada" — silêncio. A tela mostraria "removido" e o plantão
-- continuaria lá. Aqui a recusa tem frase, e a frase diz o que fazer.
--
-- E há três portas dos fundos que política nenhuma fecha, porque todas são
-- UPDATE em linha própria — permitido, e necessário para editar valor e
-- marcar como pago:
--
--   marcar como "cancelado", que some da escala igualzinho a apagar;
--   mudar a data ou o horário, que é reescrever a escala do chefe;
--   marcar como privado, que apaga o plantão da vista de todo mundo.
--
-- O que continua livre é o que é de quem faz o plantão: o valor combinado, a
-- situação de recebimento, a observação e oferecer para troca.
-- ---------------------------------------------------------------------------
create or replace function public.plantao_do_grupo_protegido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manda boolean := public.current_app_role() in ('owner','admin');
  v_recado constant text :=
    'Este plantão está na escala do grupo. Para sair dele, use "Passar plantão"'
    || ' e escolha um colega — ele sai da sua escala quando o colega aceitar.';
begin
  -- Quem monta a escala mexe na escala. É o trabalho dele.
  if v_manda then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  if TG_OP = 'DELETE' then
    -- O privado não é de ninguém mais: some sem cerimônia.
    if OLD.privado then return OLD; end if;
    raise exception '%', v_recado using errcode = 'check_violation';
  end if;

  if OLD.privado then return NEW; end if;

  -- A troca aceita muda o dono, e ela roda por função com security definer,
  -- que confere o aceite antes. Este caminho não é alcançável por quem escreve
  -- direto na tabela: a política de alterar exige perfil_id = auth.uid() dos
  -- dois lados, então ninguém muda o dono de um plantão sozinho.
  if NEW.perfil_id is distinct from OLD.perfil_id then
    return NEW;
  end if;

  if NEW.data          is distinct from OLD.data
     or NEW.hora_inicio is distinct from OLD.hora_inicio
     or NEW.hora_fim    is distinct from OLD.hora_fim
     or NEW.local_id    is distinct from OLD.local_id
     or NEW.local_texto is distinct from OLD.local_texto then
    raise exception
      'Dia, horário e local deste plantão são da escala do grupo. Quem monta a escala pode mudá-los.'
      using errcode = 'check_violation';
  end if;

  if NEW.privado and not OLD.privado then
    raise exception
      'Um plantão da escala do grupo não pode virar privado: o grupo conta com ele.'
      using errcode = 'check_violation';
  end if;

  if NEW.situacao = 'cancelado' and OLD.situacao <> 'cancelado' then
    raise exception '%', v_recado using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

drop trigger if exists plantao_do_grupo_protegido_tg on public.plantoes;
create trigger plantao_do_grupo_protegido_tg
  before update or delete on public.plantoes
  for each row execute function public.plantao_do_grupo_protegido();

-- ---------------------------------------------------------------------------
-- Troca de plantão privado não existe
--
-- Não é proibição por gosto: o colega não enxerga o plantão, não sabe onde
-- fica nem quanto vale, e aceitaria um convite às cegas. Se o serviço quiser
-- passar aquele turno adiante, o lugar dele é a escala do grupo.
-- ---------------------------------------------------------------------------
drop policy if exists "equipe_pede_troca" on public.trocas_plantao;
create policy "equipe_pede_troca" on public.trocas_plantao
  for insert to authenticated with check (
    institution_id = public.current_institution_id()
    and solicitante_id = auth.uid()
    and exists (
      select 1 from public.plantoes p
       where p.id = plantao_id
         and p.institution_id = public.current_institution_id()
         and p.privado = false
    )
  );
