-- ===========================================================================
-- Bucket das marcas: logo do hospital e logo do grupo de anestesia
-- ===========================================================================
-- Bucket separado do "anexos", e público. As duas coisas têm motivo.
--
-- Separado porque "anexos" guarda exame de paciente — dado de saúde, sigiloso.
-- Misturar marca com prontuário numa política só significaria que qualquer
-- afrouxamento feito para o logo aparecer numa impressão valeria também para o
-- laudo de tomografia.
--
-- Público porque o logo é impresso no papel que o paciente leva para casa. A
-- alternativa seria URL assinada, que expira — e o snapshot da avaliação guarda
-- esse endereço para sempre. Um documento reimpresso em 2030 mostraria uma
-- imagem quebrada. Logo de hospital não é segredo: está na fachada.
--
-- O que continua fechado é a ESCRITA: só quem está logado, e só dentro da pasta
-- da própria organização.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marcas', 'marcas', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Escrita: cada organização na sua pasta
--
-- O caminho é marcas/<institution_id>/<arquivo>, e a primeira pasta é conferida
-- contra a organização de quem está enviando. Sem esta checagem, qualquer
-- usuário logado poderia sobrescrever o logo de outra clínica — e o cabeçalho
-- dos documentos dela passaria a exibir a imagem que ele mandou.
-- ---------------------------------------------------------------------------
drop policy if exists "organizacao_envia_marca" on storage.objects;
create policy "organizacao_envia_marca" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marcas'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "organizacao_troca_marca" on storage.objects;
create policy "organizacao_troca_marca" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'marcas'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "organizacao_remove_marca" on storage.objects;
create policy "organizacao_remove_marca" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marcas'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

-- Leitura é aberta pelo bucket público; nenhuma policy de select é necessária,
-- e criar uma daria a impressão de que o arquivo está protegido quando não está.

-- ---------------------------------------------------------------------------
-- Arquivar em vez de apagar
--
-- Apagar um local que já tem avaliação não perde o documento — o snapshot
-- guarda os dados —, mas perde o filtro por local e a possibilidade de voltar
-- atrás. Esta função existe para que a tela não precise decidir isso sozinha:
-- ela recusa a exclusão quando há histórico e sugere arquivar.
-- ---------------------------------------------------------------------------
create or replace function public.excluir_local(p_local_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_usos integer; v_local public.locais_atendimento%rowtype;
begin
  select * into v_local from public.locais_atendimento
   where id = p_local_id and institution_id = public.current_institution_id();
  if not found then
    raise exception 'Local não encontrado';
  end if;

  -- Só administrador apaga local do grupo; local particular é do dono.
  if v_local.owner_id is null then
    if public.current_app_role() not in ('owner','admin') then
      raise exception 'Só o administrador da organização pode excluir um local compartilhado';
    end if;
  elsif v_local.owner_id <> auth.uid() then
    raise exception 'Este local pertence a outro profissional';
  end if;

  select count(*) into v_usos from public.avaliacoes
   where local_atendimento_id = p_local_id;

  if v_usos > 0 then
    -- Não apaga: arquiva. O histórico clínico continua apontando para um local
    -- que existe, e a tela explica o que aconteceu em vez de dar erro seco.
    update public.locais_atendimento set ativo = false, updated_at = now()
     where id = p_local_id;
    return format('arquivado:%s', v_usos);
  end if;

  delete from public.locais_atendimento where id = p_local_id;
  return 'excluido';
end;
$$;

revoke execute on function public.excluir_local(uuid) from public, anon;
grant  execute on function public.excluir_local(uuid) to authenticated;
