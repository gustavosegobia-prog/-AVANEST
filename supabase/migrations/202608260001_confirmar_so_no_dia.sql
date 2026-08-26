-- ===========================================================================
-- Confirmar o plantão vale NO DIA — e a janela fecha
-- ===========================================================================
-- A regra anterior aceitava confirmar qualquer plantão passado. Isso torna a
-- confirmação um segundo registro do mesmo plano: no fim do mês a pessoa abre a
-- lista e confirma trinta de uma vez, sem lembrar de nenhum. O que ela assina
-- ali não é o que aconteceu, é o que estava escalado — que é exatamente o
-- documento que já existia antes de haver confirmação.
--
-- Confirmando no dia, a resposta vem de quem acabou de sair do centro
-- cirúrgico: ficou até as 13h ou até as 19h, trocou com alguém, a sala fechou.
-- É essa memória fresca que faz o fechamento do mês valer alguma coisa.
--
-- A JANELA vai do começo do dia do plantão até o FIM do plantão, e não até a
-- meia-noite. Um turno de 19h às 7h termina no dia seguinte: cortar à
-- meia-noite tornaria impossível confirmar o noturno — logo o turno em que a
-- pessoa está mais cansada e mais precisa que seja um toque. Meia hora de
-- folga depois do fim cobre o tempo de tirar a luva e pegar o telefone.
--
-- O QUE ISSO CUSTA, dito às claras: quem esquecer perde a confirmação daquele
-- dia, e o turno passa a aparecer como pendente no fechamento do mês. Ele NÃO
-- some do relatório — continua listado e marcado —, então o grupo resolve
-- olhando o papel. Foi uma decisão do Gustavo, e é a decisão que dá sentido à
-- palavra "confirmado".
-- ===========================================================================

create or replace function public.confirmacao_de_plantao_honesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora    timestamp;   -- hora de Brasília, sem fuso: o dia do plantão é o daqui
  v_comeco   timestamp;
  v_fim      timestamp;
begin
  if new.confirmado_em is not distinct from old.confirmado_em
     and new.confirmado_por is not distinct from old.confirmado_por then
    return new;
  end if;

  -- Desconfirmar é permitido dentro da mesma janela: quem tocou por engano
  -- corrige na hora. Fora dela nem uma coisa nem outra — senão a janela seria
  -- só um obstáculo, e não uma regra.
  v_agora  := now() at time zone 'America/Sao_Paulo';
  v_comeco := new.data::timestamp;
  v_fim    := new.data::timestamp
              + new.hora_fim
              + case when new.hora_fim <= new.hora_inicio then interval '1 day' else interval '0' end
              + interval '30 minutes';

  if new.confirmado_em is null then
    -- Só bloqueia desfazer se a janela JÁ passou. Desfazer uma confirmação
    -- antiga apagaria um registro que o fechamento do mês já pode ter usado.
    if v_agora > v_fim then
      raise exception 'A confirmação deste plantão não pode mais ser alterada';
    end if;
    new.confirmado_por := null;
    return new;
  end if;

  -- Só quem trabalhou confirma. Uma confirmação que o chefe pode dar sozinho é
  -- o plano assinando por si mesmo, e o financeiro volta a não ter documento.
  if new.perfil_id is distinct from auth.uid() then
    raise exception 'Só quem fez o plantão pode confirmá-lo';
  end if;

  if v_agora < v_comeco then
    raise exception 'Este plantão ainda não começou';
  end if;

  if v_agora > v_fim then
    raise exception 'A confirmação deste plantão era no dia % e não está mais disponível',
      to_char(new.data, 'DD/MM');
  end if;

  new.confirmado_por := auth.uid();
  new.confirmado_em := coalesce(new.confirmado_em, now());
  return new;
end;
$$;

drop trigger if exists confirmacao_honesta on public.plantoes;
create trigger confirmacao_honesta
  before update of confirmado_em, confirmado_por on public.plantoes
  for each row execute function public.confirmacao_de_plantao_honesta();
