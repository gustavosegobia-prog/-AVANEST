# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Anestesiologistas brasileiros e os grupos de anestesia em que trabalham (Campo Mourão – PR é o serviço de origem). No dia a dia: o médico que faz a consulta pré-anestésica no consultório ou à beira do leito, o que registra a anestesia dentro da sala cirúrgica, a recepção que conduz a fila, o financeiro que fecha o mês e quem administra o grupo e monta a escala. Residentes e preceptores aparecem na folha de anestesia (opcionais).

## Product Purpose
AVANEST é a plataforma de gestão em anestesiologia: avaliação pré-anestésica com ficha, termo e orientações impressos; escala do serviço por hospital; produção do plantão, fechamento e recebimento. O módulo novo, **Evolução Anestésica Digital Inteligente**, transforma a folha de anestesia de papel numa ferramenta digital rápida e segura, mantendo a impressão parecida com a folha que o anestesiologista já usa. Sucesso: preencher a folha durante o caso tão rápido quanto no papel, com o registro fiel e auditável.

## Positioning
Feito por anestesiologista, dentro de um serviço em atividade. A folha digital nasce da avaliação pré-anestésica que já está no sistema e devolve a impressão no padrão da folha tradicional.

## Operating Context
- A folha de anestesia é preenchida dentro da sala cirúrgica, **principalmente em tablet deitado (paisagem)** preso ao aparelho de anestesia; computador da sala é secundário; celular deve funcionar.
- O registro é feito com luvas, em pé, com atenção dividida; a rede do hospital cai.
- Referência obrigatória de impressão: a folha de anestesia do Dr. Lucas Souza Quijo (Santa Casa), **A4 retrato** — confirmado pelo usuário. Os dados pessoais do médico do exemplo não entram no sistema.
- Base normativa citada no site: Resolução CFM nº 2.174/2017 (Anexos II, III e IV).

## Capabilities and Constraints
- Next.js 16 (App Router) + Supabase (RLS por instituição, verificação em duas etapas cobrada pelo banco). CSS global em `app/globals.css`.
- Módulos novos amadurecem restritos ao super-admin (`perfis.super_admin`) e só depois são liberados (padrão de /calculos; trava `recursos_liberados`).
- Cálculos clínicos são apoio à decisão: nunca registram dose sugerida como administrada; nenhuma dose de referência é escrita no código — só regras aprovadas, com fonte e revisor. Sem regra: "Referência de dose indisponível para esta situação".
- Sevoflurano: consumo estimado em mL; nunca valores financeiros.
- Registros clínicos são imutáveis; correção e exclusão ficam no histórico.
- Assinatura digital juridicamente válida: futura; hoje, espaço para assinatura manual no PDF.

## Brand Commitments
Nome AVANEST (marca com Λ). Voz: português do Brasil, direta, de colega para colega — fala do dia real do anestesiologista, sem jargão de software. Identidade visual já existente no sistema (azul-marinho, verde-água, tipografia Outfit) é preservada.

## Evidence on Hand
- Folha de referência: `FICHA DE ANESTESIA - lucas quijo.pdf` (anexada na sessão). A planilha complementar `FOLHA DE ANESTESIA - MATHEUS.xlsx` não foi anexada.
- Não há depoimentos, números de uso ou casos publicados; não inventar.

## Product Principles
1. Rápido como o papel: pouca digitação, toque direto no gráfico, botões de evento.
2. Fiel ao registro: o que foi medido, dado e feito, com horário e autor; nada completado por suposição.
3. Seguro para o paciente: alertas apoiam, não substituem o anestesiologista; erro técnico não grava.
4. O papel continua valendo: a impressão é a folha que o colega reconhece.

## Accessibility & Inclusion
Uso com luvas e em pé: alvos de toque amplos (44 px no toque), contraste alto sob luz de sala cirúrgica, leitura de relance.
