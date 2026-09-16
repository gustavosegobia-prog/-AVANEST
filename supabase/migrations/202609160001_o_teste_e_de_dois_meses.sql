-- ============================================================================
-- O gatilho de segurança estava dando 14 dias, e a campanha promete 2 meses
--
-- O DEFEITO. `protege_assinatura` roda BEFORE INSERT em `instituicoes` e existe
-- para impedir que alguém se dê uma assinatura grátis escrevendo direto na
-- tabela: ele força plano, prazo e todas as colunas de cobrança, ignorando o
-- que veio no INSERT. Regra certa, e ela fica.
--
-- Só que o prazo forçado era `now() + interval '14 days'`, escrito quando o
-- teste do sistema era de duas semanas. Quando a campanha dos dois meses entrou
-- (202609130001), `criar_organizacao` passou a gravar `fim_do_teste_gratis()` —
-- e o gatilho, que roda depois, apagava esse valor e punha 14 dias de volta.
--
-- Ninguém percebeu porque a verificação de então olhou as PEÇAS e não o
-- RESULTADO: conferiu-se que a função calculava a data certa e que
-- `criar_organizacao` a chamava. A linha que sobrava no banco não foi olhada.
-- Três pessoas se cadastraram pela campanha e receberam 14 dias enquanto o site
-- prometia dois meses:
--
--   13/09 → teste até 27/09 (devia ser 30/11)
--   15/09 → teste até 29/09 (devia ser 30/11)  × 2
--
-- A CORREÇÃO É UMA LINHA, e o resto do gatilho não muda: continua forçando
-- 'trial', o valor por profissional e a limpeza das colunas de pagamento, e
-- continua congelando tudo isso no UPDATE. O que muda é de onde vem a data —
-- agora da mesma função que a tela e `criar_organizacao` usam, para não existir
-- um terceiro lugar onde o prazo do teste é decidido.
-- ============================================================================

create or replace function public.protege_assinatura()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or public.e_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Organização nova sempre nasce em teste grátis, e o PRAZO SAI DE
    -- `fim_do_teste_gratis` — a mesma função de criar_organizacao e de
    -- lib/teste-gratis.ts. Um número cravado aqui é um terceiro lugar onde o
    -- teste tem duração, e foi exatamente isso que fez a campanha dos dois
    -- meses entregar duas semanas.
    new.plano := 'trial';
    new.assinatura_ate := public.fim_do_teste_gratis();
    new.valor_por_profissional := 49.99;
    new.mp_assinatura_id := null;
    new.pagamento_provedor := null;
    new.pagamento_assinatura_id := null;
    new.pagamento_cliente_id := null;
    return new;
  end if;

  new.plano := old.plano;
  new.assinatura_ate := old.assinatura_ate;
  new.valor_por_profissional := old.valor_por_profissional;
  new.mp_assinatura_id := old.mp_assinatura_id;
  new.pagamento_provedor := old.pagamento_provedor;
  new.pagamento_assinatura_id := old.pagamento_assinatura_id;
  new.pagamento_cliente_id := old.pagamento_cliente_id;
  return new;
end;
$function$;

comment on function public.protege_assinatura() is
  'Impede que plano, prazo e colunas de cobrança sejam escritos por quem não é super-admin. O prazo do teste vem de fim_do_teste_gratis(), nunca de um número escrito aqui.';

-- ---------------------------------------------------------------------------
-- Quem já entrou pela campanha recebe o que foi prometido
-- ---------------------------------------------------------------------------
-- Só quem está em `trial` e cujo prazo é MENOR que o correto: quem assinou, quem
-- é cortesia e quem já tem prazo maior não é tocado. A conta é feita sobre o
-- `created_at` de cada organização, e não sobre hoje — quem entrou em agosto
-- recebe o fim de outubro, não o de novembro.
--
-- O gatilho congela `assinatura_ate` no UPDATE para todo mundo que não é
-- super-admin; aqui a migração roda sem sessão (`auth.uid()` nulo), e é por
-- isso que ela passa — é o mesmo caminho pelo qual o sistema concede cortesia.
update public.instituicoes i
   set assinatura_ate = public.fim_do_teste_gratis(i.created_at),
       updated_at = now()
 where i.plano = 'trial'
   and i.assinatura_ate is not null
   and i.assinatura_ate < public.fim_do_teste_gratis(i.created_at);
