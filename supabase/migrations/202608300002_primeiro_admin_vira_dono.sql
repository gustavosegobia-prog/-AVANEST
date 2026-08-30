-- ============================================================================
-- Organização sem dono entrega a chave ao primeiro administrador que entra
--
-- `aceitar_convite` gravava o papel escrito no convite e pronto. Serve para
-- quem entra numa casa que já tem dono. Não serve para a casa vazia.
--
-- Foi assim que a INOVANEST ficou com 14 pessoas, 4 administradores e ZERO
-- proprietários: a organização foi criada pelo painel da plataforma, sem
-- ninguém dentro, e todo mundo entrou por convite de administrador. O defeito
-- só apareceu quando o primeiro escalista foi eleito e os 4 administradores
-- perderam o poder de montar a escala — sem proprietário para destravar.
--
-- A FUNDHOSPAR e a AMPEX estão hoje na mesma situação: criadas, vazias, e com
-- convite de administrador à espera. Sem esta correção, elas repetiriam o
-- problema no dia em que a primeira pessoa aceitasse.
--
-- ---------------------------------------------------------------------------
-- POR QUE SÓ O `admin` SOBE, E NÃO QUALQUER UM
--
-- A tentação é promover quem chegar primeiro. Numa organização cujo primeiro
-- convite fosse para a recepção, isso entregaria o Financeiro, o cadastro de
-- todo mundo e a assinatura a uma recepcionista — que não pediu isso e não
-- responde por aquilo. Só sobe quem já foi convidado para administrar: o
-- proprietário é um administrador com a responsabilidade final, e não um papel
-- de outra natureza.
--
-- Organização sem dono cujo primeiro convite não seja de administrador
-- continua sem dono. É melhor do que dar a chave para quem não pediu, e a tela
-- de super-admin mostra a contagem de donos por organização.
-- ============================================================================

create or replace function public.aceitar_convite(
  p_token text,
  p_nome_usuario text,
  p_crm text default null,
  p_rqe text default null
)
returns public.perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite public.convites;
  v_perfil public.perfis;
  v_email text;
  v_papel text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if exists (select 1 from public.perfis where id = auth.uid()) then
    raise exception 'Este usuário já pertence a uma organização'; end if;
  select * into v_convite from public.convites where token = p_token for update;
  if v_convite.id is null then raise exception 'Convite não encontrado'; end if;
  if v_convite.status <> 'pendente' then raise exception 'Este convite já foi utilizado ou foi cancelado'; end if;
  if v_convite.expires_at <= now() then raise exception 'Este convite expirou'; end if;
  select email into v_email from auth.users where id = auth.uid();
  if lower(coalesce(v_email,'')) <> lower(v_convite.email) then
    raise exception 'Este convite foi enviado para outro e-mail'; end if;
  if coalesce(trim(p_nome_usuario),'') = '' then raise exception 'Informe seu nome'; end if;

  v_papel := v_convite.role;

  -- A casa vazia ganha dono. O `for update` no convite acima já serializa dois
  -- aceites simultâneos da mesma organização, então não há corrida para dois
  -- proprietários nascerem juntos.
  if v_papel = 'admin' and not exists (
       select 1 from public.perfis o
        where o.institution_id = v_convite.institution_id
          and o.role = 'owner'
          and o.status = 'ativo') then
    v_papel := 'owner';
  end if;

  insert into public.perfis (id, institution_id, nome, role, crm, rqe, status, must_reset, email)
  values (auth.uid(), v_convite.institution_id, trim(p_nome_usuario), v_papel,
    nullif(trim(coalesce(p_crm,'')),''), nullif(trim(coalesce(p_rqe,'')),''), 'ativo', false, v_email)
  returning * into v_perfil;

  update public.convites set status = 'aceito', accepted_by = auth.uid(), accepted_at = now()
  where id = v_convite.id;

  -- A promoção fica ESCRITA na auditoria. Alguém entrar como proprietário sem
  -- ter sido convidado assim é exatamente o tipo de coisa que, meses depois,
  -- ninguém consegue explicar — e é a diferença entre um registro e um mistério.
  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_convite.institution_id, auth.uid(), 'convite', v_convite.id, 'convite_aceito',
    jsonb_build_object(
      'role', v_papel,
      'convidado_como', v_convite.role,
      'virou_dono_por_ser_o_primeiro', v_papel is distinct from v_convite.role,
      'email', v_convite.email));

  return v_perfil;
end;
$$;

revoke execute on function public.aceitar_convite(text,text,text,text) from public, anon;
grant execute on function public.aceitar_convite(text,text,text,text) to authenticated;
