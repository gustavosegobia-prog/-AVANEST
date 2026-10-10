---
target: Área médica no celular
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/-AVANEST/components/area-medica.tsx"
target_fingerprint: "sha256:d7c414cba3ef4c34957b043cdb404d0bd36ad074e258e98e6d835192a9c6267b"
target_path: /home/user/-AVANEST/components/area-medica.tsx
timestamp: 2026-10-10T02-14-19Z
slug: components-area-medica-tsx
---
# Critique — Área médica no celular (components/area-medica.tsx)

Método: dual-agent (A: subagente de revisão de design · B: detector CLI + detector no navegador, na sessão principal). Prévia local com dados fictícios, 390×844.

## Pontuação (Nielsen)
| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidade do estado | 3 | Ao rolar, some se é "Meus pacientes" ou "Equipe"; erro aparece no topo, fora da tela |
| 2 | Linguagem do mundo real | 2 | "Próximo atendimento" mostra paciente já "Em atendimento"; "Agendados hoje 1" ao lado de "4 consultas" |
| 3 | Controle e liberdade | 2 | Em Equipe, um toque em "Iniciar avaliação" assume o paciente de um colega, sem confirmação |
| 4 | Consistência | 2 | "Continuar" × "Continuar avaliação"; contador âmbar em qualquer aba inativa; seis botões azuis cheios |
| 5 | Prevenção de erros | 2 | Bom: trava de duplo toque, "aberta por X". Falta: guarda ao assumir paciente alheio |
| 6 | Reconhecer em vez de lembrar | 2 | Aba "Documentos" escondida à direita; definições só em tooltip, que não existe no toque |
| 7 | Eficiência | 2 | Cartões que filtram são bons atalhos, mas ~1,7 tela de rolagem até a lista |
| 8 | Estética e minimalismo | 2 | A mesma avaliação aparece 3× com 3 botões; "Responsável: você" em toda linha |
| 9 | Recuperação de erros | 2 | Texto de erro bom, mas longe de onde se tocou; busca vazia sem "Limpar" |
| 10 | Ajuda | 3 | Boas explicações em linha; sempre abertas no celular |
| | **Total** | **22/40** | **Aceitável** |

## Especificidade do design
Visual intercambiável (cartões de número, botão azul, chips, painéis brancos) — o que é do AVANEST está na lógica e no texto: pendências verificadas separadas de lembretes, "Informações indisponíveis" declaradas, CPF mascarado + nascimento, "aberta por X". Detector: side-tab no cartão Próximo (borda esquerda 4px + raio), placeholder 3,2:1, rótulo 11px, "Responsável: você" 4×, Inter 82% (fonte do app inteiro, fora do escopo).

## Problemas prioritários
1. [P1] Cartão "Próximo atendimento" quebrado no celular e com rótulo errado — `.medProximo .medAcao{grid-column:1/-1}` mira o botão, mas o filho da grade é `.medAcaoCaixa`; nome espremido palavra por palavra; mostra quem já está em atendimento como "próximo".
2. [P1] A lista do médico fica enterrada e repetida — primeira linha da agenda em y≈1403 numa tela de 844; a mesma avaliação em Próximo, Retomar e agenda.
3. [P1] Em Equipe, um toque assume o paciente de um colega — `openAssessment` cria a avaliação com o meu id, sem confirmar.
4. [P2] Abas escondem conteúdo no celular — "Documentos" fora da tela, "Pendên…" cortado; contador âmbar sem significado; no escuro, contador ativo 2,85:1.
5. [P2] Alvos de toque pequenos e retorno longe do toque — "Meus pacientes | Equipe" 30px, "Ver na agenda" 20px, botões 36px; erro no topo; todos os botões viram "Abrindo…".

## Personas
- Casey (uma mão, com pressa): 1,7 tela até a lista; seletor de escopo de 30px no canto superior esquerdo; botões cheios em linhas de outro médico.
- Jordan (primeira vez): "Em atendimento" × "Avaliações em andamento" só explicado em tooltip; nunca acha Documentos.
- Sam (leitor de tela): botões "Iniciar avaliação" sem o nome do paciente; abas lidas como "Meu dia3"; troca de seção não anuncia nada.

## Observações menores
Chips de etapa esticados na largura toda; "Iniciada em 09/10/2026, 08:00" poderia ser "hoje, 08:00"; placeholders cortados; Semana sem separador de dia; no escuro, o aviso de pendências perde o âmbar.

## Perguntas
- Por que o elemento mais forte do topo é "+ Nova avaliação", se o médico quase sempre abre a próxima consulta já marcada?
- "Meu dia" deveria ser uma linha do tempo (Agora / Próximo / Depois) em vez de cartões de número com uma lista embaixo?
- Assumir paciente de colega é recurso (cobrir alguém) ou acidente? Se for recurso, merece nome e passo próprios.
