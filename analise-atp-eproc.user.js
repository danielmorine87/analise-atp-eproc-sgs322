// ==UserScript==
// @name         Análise de ATP eProc
// @namespace    https://github.com/danielmorine87/analise-atp-eproc-sgs322
// @description  Script de análise ATP no eProc com auditoria por localizador, matriz Entrada/Saída, mapa de relações e diagnóstico operacional.
// @author       ADRIANO AUGUSTO CARDOSO E SANTOS
// @version      11.3
// @downloadURL  https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/analise-atp-eproc.user.js
// @updateURL    https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/analise-atp-eproc.user.js
// @homepageURL  https://github.com/danielmorine87/analise-atp-eproc-sgs322
// @supportURL   https://github.com/danielmorine87/analise-atp-eproc-sgs322/issues
// @run-at       document-start
 
// @match        *://*/controlador.php?acao=automatizar_localizadores*
// @match        *://*/*/controlador.php?acao=automatizar_localizadores*
// @match        *://*/*/*/controlador.php?acao=automatizar_localizadores*
// @grant        none
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/01-config.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/02-utilitarios.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/03-logs.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/04-styles.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/05-extrator-de-dados.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/06-analisador-de-colisoes.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/10-ui-inicializacao.js
// ==/UserScript==

/*
RESUMO ATUAL (ATP)

1) ESCOPO OPERACIONAL
- Extrai e analisa regras ATP por texto literal de localizador/regra.
- Consolida matriz Entrada/Saída por localizador (INCLUIR, REMOVER, concomitantes, manuais/erro).
- Gera auditoria por localizador como fonte única de verdade (unidade e recortes de debug).
- Classifica cenários de colisão, sobreposição, contenção e priorização entre regras.
- Monta Mapa de Relações com agrupamentos operacionais (A/B/C) e Cirandas (D) em critério estrito.

2) PRINCIPAIS SAÍDAS
- Relatório textual com fechamento matemático e seções de depuração.
- Matriz de localizadores com recortes por classe de fluxo (gabinete, cumprimento, passagem etc.).
- Mapa de Relações ATP:
  A = grupos por esqueleto/entrada, B = agrupamento flexível por gatilho, C = pseudogatilhos incorporados,
  D = cirandas estritas por encadeamento A->B->C (mesmo gatilho, sem apoios no grupo D).
- Diagnóstico visual na UI para entender por que uma regra/grupo foi classificado em cada bloco.

3) MÓDULOS-CHAVE
- 01-config.js: configuração e toggles
- 02-utilitarios.js: parsing, helpers e funções de apoio
- 05-extrator-de-dados.js: coleta da tabela de regras
- 06-analisador-de-colisoes.js: análise de conflitos/sobreposições
- 10-ui-inicializacao.js: composição da análise operacional e renderização principal
*/
