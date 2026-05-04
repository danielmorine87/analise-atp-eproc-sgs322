try { console.log('[ATP][LOAD] 12-monitor-de-acesso.js carregado com sucesso'); } catch (e) { }
(function () {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    supabaseUrl: '',
    supabaseApiKey: '',
    tableName: 'atp_execucoes',
    waitMaxMs: 30000
  };

  const cfg = Object.assign({}, DEFAULTS, (window.ATP_ACCESS_MONITOR_CONFIG || {}));
  if (!cfg.enabled) return;

  const base = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
  const apiKey = String(cfg.supabaseApiKey || '').trim();
  const tableName = String(cfg.tableName || '').trim();
  if (!base || !apiKey || !tableName) return;

  window.ATP_ACCESS_MONITOR_PUBLIC = {
    supabaseUrl: base,
    supabaseApiKey: apiKey,
    tableName
  };

  const endpoint = `${base}/rest/v1/${tableName}`;

  function getSelectedOrgao() {
    try {
      const sel = document.getElementById('selOrgao');
      if (!sel) return '';
      const opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      if (opt && String(opt.textContent || '').trim()) return String(opt.textContent || '').trim();
      return String(sel.value || '').trim();
    } catch (_) {
      return '';
    }
  }

  function getUsuarioHeader() {
    try {
      const el = document.querySelector('.header.bg-gray-grad .text-center.font-weight-bold span');
      if (el && String(el.textContent || '').trim()) return String(el.textContent || '').trim();
      const spans = Array.from(document.querySelectorAll('span'));
      const found = spans.find((s) => /\([A-Z]\d+\)/i.test(String(s.textContent || '')));
      return found ? String(found.textContent || '').trim() : '';
    } catch (_) {
      return '';
    }
  }

  function getScriptVersion() {
    try {
      const gmVersion = String((typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '').trim();
      if (gmVersion) return gmVersion;
    } catch (_) { }
    try {
      const winVersion = String(window.ATP_VERSION || '').trim();
      if (winVersion) return winVersion;
    } catch (_) { }
    try {
      const cfgVersion = String((typeof ATP_VERSION !== 'undefined' ? ATP_VERSION : '') || '').trim();
      if (cfgVersion) return cfgVersion;
    } catch (_) { }
    return 'N/D';
  }

  function saveExecution(acao) {
    const payload = [{
      executed_at: new Date().toISOString(),
      sel_orgao: getSelectedOrgao(),
      usuario: getUsuarioHeader(),
      acao: String(acao || ''),
      versao_script: getScriptVersion()
    }];

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => { });
  }

  function getActionFromClickTarget(target) {
    try {
      if (!target || typeof target.closest !== 'function') return '';
      if (target.closest('#btnFiltrarConflitosSlim')) return 'clique_filtrar_regras_conflitantes';
      if (target.closest('#btnFiltrarPossiveisConflitos')) return 'clique_filtrar_possiveis_conflitos';
      if (target.closest('#btnGerarRelatorioColisoes')) return 'clique_gerar_relatorio_colisoes';
      if (target.closest('#btnRelatorioUnidadeATP')) return 'clique_gerar_relatorio_unidade';
      if (target.closest('#btnDashboardUsoATP')) return 'clique_dashboard_utilizacao';
      if (target.closest('.atp-compare-btn')) return 'clique_comparar';
      return '';
    } catch (_) {
      return '';
    }
  }

  function bindDelegatedClicks() {
    try {
      if (document.documentElement && document.documentElement.dataset.atpAccessDelegatedBound === '1') return;
      if (document.documentElement) document.documentElement.dataset.atpAccessDelegatedBound = '1';
      document.addEventListener('click', (ev) => {
        const acao = getActionFromClickTarget(ev && ev.target ? ev.target : null);
        if (acao) saveExecution(acao);
      }, true);
    } catch (_) {}
  }

  function boot() {
    saveExecution('carregamento');
    bindDelegatedClicks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  try { console.log('[ATP][OK] 12-monitor-de-acesso.js inicializado'); } catch (e) { }
})();
