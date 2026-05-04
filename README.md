# Análise de ATP eProc

Script de apoio para analisar regras de Automatização de Localizadores (ATP) no eProc.

Este projeto é uma adaptação do trabalho original de `adrianocardoso` ([repositório base](https://github.com/oadrianocardoso/analise-atp-eproc)).
Nesta versão, não são utilizadas todas as funcionalidades do projeto original: o foco foi manter e expandir a proposta central de analisador de colisões, evoluindo também para análise da unidade e da estrutura das regras de automação.

## Escopo Atual

Esta versão está focada em:

- análise automática da tabela de regras ATP;
- identificação de conflitos entre regras;
- marcação visual na coluna `Conflitos`;
- ação `Comparar` para revisar pares de regras;
- geração do `Relatório de Colisões` em TXT;
- geração do `Relatório da Unidade` em TXT (com mini-help, maturidade e estrutura de automação).

Recursos antigos de fluxo/BPMN/extrato não fazem parte desta versão.

## Relatório da Unidade

O `Relatório da Unidade` oferece uma visão gerencial da ATP da unidade analisada.

Principais pontos:

- estágio de maturidade da automação;
- recomendações práticas para evolução;
- leitura da estrutura de automação (ações e distribuição operacional);
- resumo de conflitos por severidade.

## Relatório de Colisões

O `Relatório de Colisões` oferece uma visão técnica dos pares de regras identificados na análise.

Principais pontos:

- resumo por severidade (`Crítico`, `Atenção`, `Informativo`);
- resumo por tipo de conflito;
- detalhamento por par (`Regra A x Regra B`);
- tipos e motivos técnicos para priorização de ajustes;
- mini-help de referência no final do arquivo.

## Tipos de Conflito (Resumo)

O relatório usa a definição atual abaixo:

- `Regra Clone`: duplicidade de lógica entre regras (total ou parcial), com indício de redundância.
- `Prioridade Indefinida`: há compatibilidade/interseção entre regras e a ordem de execução exige decisão explícita.
- `Prioridade Invertida`: a regra mais ampla executa antes da mais restrita, ou a ordem remove objeto necessário para a regra seguinte.
- `Prioridade Correta`: a regra mais restrita executa antes da mais abrangente (peneira esperada).
- `Contradição`: a própria regra contém critérios mutuamente exclusivos no mesmo ramo (`E`/`AND`).
- `Quebra de Fluxo`: não há avanço operacional (`INCLUIR == REMOVER` sem ação útil ao fluxo).
- `Ação sem Avanço`: há ação programada, mas o processo permanece no mesmo localizador por desenho da regra.
- `Looping Potencial`: regras se retroalimentam (ciclo), gerando repetição de incluir/remover.

Classificação de severidade usada no relatório:

- `Crítico`: `Prioridade Invertida`, `Contradição`, `Quebra de Fluxo`, `Looping Potencial`.
- `Atenção`: `Regra Clone`, `Prioridade Indefinida`.
- `Informativo`: `Prioridade Correta`, `Ação sem Avanço`.

Regra de prioridade na execução ATP:

- Menor número executa antes.
- Regra sem prioridade definida executa por último, após as prioridades definidas.

## Estrutura de Módulos

Os módulos ativos da versão publicada são:

- `01-config.js`
- `02-utilitarios.js`
- `03-logs.js`
- `04-styles.js`
- `05-extrator-de-dados.js`
- `06-analisador-de-colisoes.js`
- `10-ui-inicializacao.js`

## Instalação

1. Instale o Tampermonkey no navegador.
2. Abra o script principal:
   [analise-atp-eproc.user.js](https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/analise-atp-eproc.user.js)
3. Clique em `Install` no Tampermonkey.
4. Acesse o eProc na tela de automatização de localizadores e aguarde o carregamento dos botões.

## Uso

1. Entre na unidade que deseja analisar.
2. Abra `Automatizar Tramitação Processual` (ATP).
3. Use os botões de análise na própria página:
   - `Relatório de Colisões`;
   - `Relatório da Unidade`;
   - filtros/ações de apoio na coluna de conflitos.
4. No `Relatório da Unidade`, leia primeiro o estágio de maturidade e, em seguida, as recomendações e a seção de estrutura de automação.

Observação: a análise considera a unidade ativa no momento da consulta.

## Segurança

- Não altera regras no eProc.
- Não grava alterações no sistema.
- Funciona no navegador do usuário.

## Importante

Ferramenta de apoio para auditoria e revisão de regras ATP.
Não substitui validação funcional e testes no ambiente.
