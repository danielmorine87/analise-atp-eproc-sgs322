// ==UserScript==
// @name         Análise de ATP eProc
// @namespace    https://github.com/danielmorine87/analise-atp-eproc-sgs322
// @description  Script para análise de regras ATP no eProc, com relatório de colisões e relatório da unidade.
// @author       Adriano Cardoso (projeto original) / Daniel Morine (adaptacao e evolucao)
// @version      0.1.8
// @downloadURL  https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/analise-atp-eproc.user.js
// @updateURL    https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/analise-atp-eproc.user.js
// @homepageURL  https://github.com/danielmorine87/analise-atp-eproc-sgs322
// @supportURL   https://github.com/danielmorine87/analise-atp-eproc-sgs322/issues
// @run-at       document-start
 
// @match        *://*/controlador.php*acao=automatizar_localizadores*
// @match        *://*/*/controlador.php*acao=automatizar_localizadores*
// @match        *://*/*/*/controlador.php*acao=automatizar_localizadores*
// @grant        none
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/01-config.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/02-utilitarios.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/03-logs.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/04-styles.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/05-extrator-de-dados.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/06-analisador-de-colisoes.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/10-ui-inicializacao.js
// @require      https://raw.githubusercontent.com/danielmorine87/analise-atp-eproc-sgs322/main/12-monitor-de-acesso.js
// ==/UserScript==

/*
RESUMO ATUAL (ATP)

Projeto adaptado do trabalho original de Adriano Cardoso.
Esta linha mantém o núcleo de análise de colisões e expande a leitura da unidade.

ESCOPO DESTA VERSÃO
- Análise automática da tabela de regras ATP.
- Identificação e classificação de conflitos entre regras.
- Coluna "Conflitos" com apoio visual e ação "Comparar".
- Geração do Relatório de Colisões (TXT).
- Geração do Relatório da Unidade (TXT), com maturidade, recomendações e estrutura de automação.

OBSERVAÇÃO
- Recursos antigos de fluxo/BPMN/extrato não fazem parte desta versão.
*/
