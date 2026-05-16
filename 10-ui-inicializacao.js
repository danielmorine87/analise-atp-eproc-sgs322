
  try {
    if (typeof window.debounce !== 'function') {
      window.debounce = function (fn, wait) {
        let t = null;
        return function () {
          const ctx = this;
          const args = arguments;
          if (t) clearTimeout(t);
          t = setTimeout(() => {
            t = null;
            try { fn.apply(ctx, args); } catch (e) { try { console.warn('[ATP][UI] debounce fn erro:', e); } catch (_) {} }
          }, Math.max(0, wait || 0));
        };
      };
    }
    if (typeof window.tDebounce !== 'function') {
      window.tDebounce = function (fn, wait) {
        return window.debounce(fn, wait);
      };
    }
  } catch (e) {}

try { console.log('[ATP][LOAD] 10-ui-inicializacao.js carregado com sucesso'); } catch (e) {}

window.ATP_TABLE_ID = window.ATP_TABLE_ID || 'tableAutomatizacaoLocalizadores';
function atpGetRulesState() {
  if (typeof window.atpGetLastRules === 'function') {
    const rules = window.atpGetLastRules();
    return Array.isArray(rules) ? rules : [];
  }
  return Array.isArray(window.__ATP_LAST_RULES__) ? window.__ATP_LAST_RULES__ : [];
}

function atpSetRulesState(rules) {
  if (typeof window.atpSetLastRules === 'function') window.atpSetLastRules(rules);
  else window.__ATP_LAST_RULES__ = Array.isArray(rules) ? rules : [];
}

function atpGetRulesSnapshotForReports(table) {
  let rules = atpGetRulesState();
  if (Array.isArray(rules) && rules.length) return rules;
  try {
    const tb = table || findTable();
    if (tb) recalc(tb);
  } catch (_) {}
  rules = atpGetRulesState();
  return Array.isArray(rules) ? rules : [];
}

const ATP_RECALC_STATE = new WeakMap();

function atpQueueRecalc(table, wait = 200) {
  if (!table) return;
  let state = ATP_RECALC_STATE.get(table);
  if (!state) {
    state = { timer: null, running: false, pending: false };
    ATP_RECALC_STATE.set(table, state);
  }
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.timer = null;
    if (state.running) {
      state.pending = true;
      return;
    }
    state.running = true;
    try {
      try {
        recalc(table);
      } catch (e) {
        try { console.warn('[ATP][UI] recalc falhou:', e); } catch (_) {}
      }
    } finally {
      state.running = false;
      if (state.pending) {
        state.pending = false;
        atpQueueRecalc(table, 180);
      }
    }
  }, Math.max(0, wait || 0));
}

function atpEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function atpGetDashboardConfig() {
  const fromMonitor = window.ATP_ACCESS_MONITOR_PUBLIC || {};
  return {
    supabaseUrl: String(fromMonitor.supabaseUrl || ''),
    supabaseApiKey: String(fromMonitor.supabaseApiKey || ''),
    tableName: String(fromMonitor.tableName || '')
  };
}

function atpFormatDateKeyLocal(dt) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function atpFriendlyActionName(acao) {
  const map = {
    carregamento: 'Carregamento',
    clique_filtrar_regras_conflitantes: 'Filtrar Regras Conflitantes',
    clique_filtrar_possiveis_conflitos: 'Filtrar Possiveis Conflitos',
    clique_gerar_relatorio_colisoes: 'Gerar Relatorio de Colisoes',
    clique_gerar_relatorio_unidade: 'Gerar Relatorio da Unidade',
    clique_dashboard_utilizacao: 'Abrir Dashboard de Utilizacao',
    clique_comparar: 'Comparar Regras'
  };
  const key = String(acao || '').trim();
  return map[key] || (key || '(sem acao)');
}

const ATP_MINI_HELP_UNIDADE_TIP = [
  'ESTÁGIO DE MATURIDADE',
  'Classificação da unidade conforme a cobertura e o equilíbrio dos localizadores, variando de estágio inicial até referência operacional, conforme os indicadores estruturais e de execução.',
  '',
  'MANUAIS / ERRO',
  'Localizadores que não são utilizados em nenhuma regra ativa (nem como origem, nem como destino). Em geral, estão associados a ações manuais ou são usados exclusivamente como localizador de erro.',
  '',
  'LOCALIZADOR APENAS NO REMOVER',
  'Localizador de passagem: o processo sai dele por regra ATP, mas a entrada é manual ou externa. Avalie se a entrada também pode ser automatizada; se não for viável, mantenha a entrada manual documentada e utilize preferências.',
  '',
  'LOCALIZADOR APENAS NO INCLUIR',
  'Destino final da automação: o processo chega ali por regra ATP, mas a saída depende de ação humana (gabinete, expedição de documentos etc.). Avalie se a saída pode ser automatizada sem perda de qualidade.',
  '',
  'TIPO FUNCIONAL',
  'Classificação do localizador conforme seu papel no fluxo de trabalho:',
  '- Sistema: localizadores incluídos automaticamente pelo sistema (ex.: PETIÇÃO, DECURSO DE PRAZO).',
  '- Passagem: etapas de triagem ou encaminhamento.',
  '- Concomitante: localizadores que, em ao menos uma situação, são incluídos e removidos por ATP.',
  '- Gabinete: localizadores que representam envio à conclusão.',
  '- Cumprimento: localizadores associados a minutas não decisórias (expedição de documentos, mandados etc.).',
  '',
  'PREFERÊNCIAS',
  'São configurações utilizadas na criação de minutas, intimações ou movimentações. Sua utilização minimiza erros e é essencial para a correta utilização de um fluxo.',
  '',
  'REGRAS COM AÇÃO / SEM AÇÃO',
  'Regras que executam ao menos uma ação programada (movimentação, evento, lembrete etc.) versus regras que apenas realizam triagem ou filtro, sem ação direta.',
  '',
  'CONTINUIDADE DE TRIAGEM',
  'Regra cuja ação principal encaminha o processo para uma nova etapa de análise ou gabinete, mantendo o fluxo organizado. As ações que caracterizam a continuidade de triagem são: Lançar evento automatizado, Incluir lembrete, Distribuir processos entre localizadores, Alterar situação automaticamente, Alterar situação da justiça gratuita da parte, Inserir dado complementar no processo, Retificar autuação e Verificação de dados processuais.',
  '',
  'ANDAMENTO PROCESSUAL',
  'Regra cuja ação principal avança o processo, realizando tarefa que originalmente seria executada por um servidor. As ações que caracterizam o andamento processual são: Lançar evento e documento baseado em preferência de unidade, Preparar minuta baseada em preferência de unidade, Citação por AR, Expedição de mandado e Expedição de ofício por carta AR.',
  '',
  'AÇÕES PROGRAMADAS',
  'Tarefas automatizadas disparadas pelas regras ATP. Dividem-se em Continuidade de Triagem e Andamento Processual. As quantidades indicam o perfil operacional corrente da unidade.',
  '',
  'PADRÕES DE DESTINO/AÇÃO',
  'Combinações únicas de localizador de destino e ação programada (ou simples transferência, no caso da Troca de Localizador). Medem a diversidade real de comportamentos da unidade.',
  '',
  'AÇÕES ÚNICAS',
  'Tipos de ação programada, desconsiderando o localizador de destino.',
  '',
  'RESUMO DE CONFLITOS',
  'Síntese do Relatório de Colisões. Indica pares de regras que podem competir pelo mesmo processo. Consulte o mini-help do Relatório de Colisões para os tipos de conflito.'
].join('\n');

function atpBuildBarRowsHtml(items, emptyMsg) {
  if (!Array.isArray(items) || !items.length) {
    return `<div class="atp-dash-foot">${atpEscapeHtml(emptyMsg || 'Sem dados')}</div>`;
  }
  const maxVal = items.reduce((m, it) => Math.max(m, Number(it.value) || 0), 0) || 1;
  return items.map((it) => {
    const raw = Number(it.value) || 0;
    const pct = Math.max(3, Math.round((raw / maxVal) * 100));
    return [
      '<div class="atp-dash-bar-row">',
      `<div class="atp-dash-bar-label" title="${atpEscapeHtml(it.label)}">${atpEscapeHtml(it.label)}</div>`,
      '<div class="atp-dash-bar-track">',
      `<div class="atp-dash-bar-fill" style="width:${pct}%"></div>`,
      '</div>',
      `<div class="atp-dash-bar-val">${raw}</div>`,
      '</div>'
    ].join('');
  }).join('');
}

function atpBuildLast7DaysChartHtml(items) {
  const points = Array.isArray(items) ? items : [];
  if (!points.length) {
    return '<div class="atp-dash-foot">Sem dados no periodo</div>';
  }

  const w = 760;
  const h = 260;
  const padL = 44;
  const padR = 14;
  const padT = 12;
  const padB = 44;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const maxVal = Math.max(1, ...points.map((p) => Number(p.value) || 0));
  const yTicks = 4;
  const n = points.length;
  const slot = chartW / Math.max(1, n);
  const barW = Math.max(8, Math.min(36, Math.floor(slot * 0.55)));

  const yGrid = [];
  for (let i = 0; i <= yTicks; i += 1) {
    const v = Math.round((maxVal * i) / yTicks);
    const y = Math.round(padT + chartH - (chartH * i) / yTicks);
    yGrid.push(`<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`);
    yGrid.push(`<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${v}</text>`);
  }

  const bars = [];
  points.forEach((p, idx) => {
    const raw = Number(p.value) || 0;
    const xCenter = Math.round(padL + slot * idx + slot / 2);
    const x = Math.round(xCenter - barW / 2);
    const hh = Math.round((raw / maxVal) * chartH);
    const y = Math.round(padT + chartH - hh);
    const label = String(p.label || '');
    const labelShort = /^\d{4}-\d{2}-\d{2}$/.test(label)
      ? `${label.slice(8, 10)}/${label.slice(5, 7)}`
      : label;
    bars.push(`<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(1, hh)}" rx="4" fill="#2563eb"><title>${atpEscapeHtml(label)}: ${raw}</title></rect>`);
    bars.push(`<text x="${xCenter}" y="${h - padB + 16}" text-anchor="middle" font-size="11" fill="#374151">${atpEscapeHtml(labelShort)}</text>`);
  });

  return [
    '<div style="width:100%;overflow-x:auto;">',
    `<svg viewBox="0 0 ${w} ${h}" style="width:100%;min-width:680px;height:auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;">`,
    ...yGrid,
    `<line x1="${padL}" y1="${padT + chartH}" x2="${w - padR}" y2="${padT + chartH}" stroke="#9ca3af" stroke-width="1.2" />`,
    `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#9ca3af" stroke-width="1.2" />`,
    ...bars,
    `<text x="${Math.round((padL + (w - padR)) / 2)}" y="${h - 8}" text-anchor="middle" font-size="12" fill="#4b5563">Data</text>`,
    `<text x="14" y="${Math.round((padT + chartH) / 2)}" text-anchor="middle" font-size="12" fill="#4b5563" transform="rotate(-90 14 ${Math.round((padT + chartH) / 2)})">Utilização</text>`,
    '</svg>',
    '</div>'
  ].join('');
}

function atpBuildRecentUsageRowsHtml(items) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return '<div class="atp-dash-foot">Sem eventos recentes</div>';
  const body = rows.map((r) => {
    const dt = String(r && r.executed_at ? new Date(r.executed_at).toLocaleString() : '');
    const acao = atpFriendlyActionName(String(r && r.acao ? r.acao : ''));
    const versao = String(r && r.versao_script ? r.versao_script : 'N/D');
    return [
      '<tr>',
      `<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${atpEscapeHtml(dt || '-')}</td>`,
      `<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${atpEscapeHtml(acao || '-')}</td>`,
      `<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${atpEscapeHtml(versao || 'N/D')}</td>`,
      '</tr>'
    ].join('');
  }).join('');
  return [
    '<div style="overflow:auto;border:1px solid #e5e7eb;border-radius:10px;background:#fff;">',
    '<table style="width:100%;border-collapse:collapse;font-size:12px;color:#0f172a;">',
    '<thead><tr style="background:#f8fafc">',
    '<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Data/Hora</th>',
    '<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Ação</th>',
    '<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Versão</th>',
    '</tr></thead>',
    `<tbody>${body}</tbody>`,
    '</table>',
    '</div>'
  ].join('');
}

function atpRenderDashboard(target, rows) {
  const allRows = Array.isArray(rows) ? rows : [];
  const now = new Date();
  const todayKey = atpFormatDateKeyLocal(now);
  const byAction = Object.create(null);
  const byDay = Object.create(null);

  for (const row of allRows) {
    const acao = String(row && row.acao ? row.acao : '').trim() || '(sem acao)';
    byAction[acao] = (byAction[acao] || 0) + 1;
    const dayKey = atpFormatDateKeyLocal(row && row.executed_at ? row.executed_at : '');
    if (dayKey) byDay[dayKey] = (byDay[dayKey] || 0) + 1;
  }

  const actionItems = Object.keys(byAction)
    .sort((a, b) => byAction[b] - byAction[a])
    .map((key) => ({ label: atpFriendlyActionName(key), value: byAction[key] }));

  const last7Days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = atpFormatDateKeyLocal(d);
    last7Days.push({ label: key, value: byDay[key] || 0 });
  }

  const total = allRows.length;
  const today = byDay[todayKey] || 0;
  const uniqueActions = Object.keys(byAction).length;
  const recentRows = allRows.slice(0, 20);
  const version = (typeof ATP_VERSION !== 'undefined') ? String(ATP_VERSION) : 'N/D';
  const cfg = atpGetDashboardConfig();

  target.innerHTML = [
    '<div class="atp-dash-grid">',
    `<div class="atp-dash-kpi"><div class="atp-dash-kpi-num">${total}</div><div class="atp-dash-kpi-lbl">Eventos Consultados</div></div>`,
    `<div class="atp-dash-kpi"><div class="atp-dash-kpi-num">${today}</div><div class="atp-dash-kpi-lbl">Eventos Hoje</div></div>`,
    `<div class="atp-dash-kpi"><div class="atp-dash-kpi-num">${uniqueActions}</div><div class="atp-dash-kpi-lbl">Tipos de Ação</div></div>`,
    '</div>',
    '<div class="atp-dash-sec-title">Resumo</div>',
    `<div class="atp-dash-foot">Script: ${atpEscapeHtml(version)} | Tabela: ${atpEscapeHtml(cfg.tableName || 'N/D')}</div>`,
    '<div class="atp-dash-sec-title">Utilização por Acão</div>',
    `<div class="atp-dash-bars">${atpBuildBarRowsHtml(actionItems, 'Sem acoes registradas')}</div>`,
    '<div class="atp-dash-sec-title">Utilização nos Ultimos 7 Dias</div>',
    atpBuildLast7DaysChartHtml(last7Days),
    '<div class="atp-dash-sec-title">Eventos Recentes (ultimos 20)</div>',
    atpBuildRecentUsageRowsHtml(recentRows),
    `<div class="atp-dash-foot">Atualizado em ${atpEscapeHtml(new Date().toLocaleString())}</div>`
  ].join('');
}

function atpFetchUsageRows(limit) {
  const cfg = atpGetDashboardConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseApiKey || !cfg.tableName) {
    return Promise.reject(new Error('Monitor de acesso nao configurado.'));
  }
  const base = cfg.supabaseUrl.replace(/\/+$/, '');
  const url = `${base}/rest/v1/${cfg.tableName}?select=executed_at,acao,usuario,sel_orgao,versao_script&order=executed_at.desc&limit=${Math.max(1, limit || 1000)}`;
  return fetch(url, {
    method: 'GET',
    headers: {
      apikey: cfg.supabaseApiKey,
      Authorization: `Bearer ${cfg.supabaseApiKey}`
    }
  }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}

function atpCloseDashboardModal() {
  try { document.getElementById('atpDashboardModal')?.remove(); } catch (_) { }
}

function atpOpenDashboardModal() {
  atpCloseDashboardModal();
  const overlay = document.createElement('div');
  overlay.id = 'atpDashboardModal';
  overlay.className = 'atp-dash-overlay';
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) atpCloseDashboardModal(); });

  const box = document.createElement('div');
  box.className = 'atp-dash-box';

  const top = document.createElement('div');
  top.className = 'atp-dash-top';
  top.innerHTML = '<div class="atp-dash-title">Dashboard de Utilização do Script</div>';

  const btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.className = 'atp-map-btn';
  btnClose.textContent = 'Fechar';
  btnClose.addEventListener('click', atpCloseDashboardModal);
  top.appendChild(btnClose);

  const body = document.createElement('div');
  body.className = 'atp-dash-body';
  body.innerHTML = '<div class="atp-dash-foot">Carregando dados de utilizacao...</div>';

  box.appendChild(top);
  box.appendChild(body);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  atpFetchUsageRows(1000).then((rows) => {
    atpRenderDashboard(body, rows);
  }).catch((err) => {
    body.innerHTML = `<div class="atp-dash-foot">Nao foi possivel carregar os dados: ${atpEscapeHtml(err && err.message ? err.message : 'erro desconhecido')}</div>`;
  });
}

function atpEnsureDashboardIcon(host, refEl) {
  try {
    if (!host || host.querySelector('#btnDashboardUsoATP')) return;
    const iconBtn = document.createElement('button');
    iconBtn.type = 'button';
    iconBtn.id = 'btnDashboardUsoATP';
    iconBtn.className = 'infraButton';
    iconBtn.title = 'Dashboard de Utilização do Script';
    iconBtn.textContent = '📊';
    iconBtn.addEventListener('click', atpOpenDashboardModal);

    if (refEl && refEl.parentNode === host) host.insertBefore(iconBtn, refEl.nextSibling);
    else host.appendChild(iconBtn);
  } catch (_) { }
}

let ATP_UI_ELK_PROMISE = null;
function atpEnsureElkLoadedForBpmn() {
  if (window.ELK) return Promise.resolve(window.ELK);
  if (ATP_UI_ELK_PROMISE) return ATP_UI_ELK_PROMISE;

  ATP_UI_ELK_PROMISE = new Promise((resolve, reject) => {
    try {
      const url = 'https://unpkg.com/elkjs@0.9.3/lib/elk.bundled.js';
      const found = document.querySelector('script[data-atp-lib="elk-093"]') || document.querySelector('script[data-atp-lib="elk-ui-093"]');
      if (found) {
        if (window.ELK) { resolve(window.ELK); return; }
        found.addEventListener('load', () => window.ELK ? resolve(window.ELK) : reject(new Error('ELK não carregou.')), { once: true });
        found.addEventListener('error', (e) => reject(e), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.setAttribute('data-atp-lib', 'elk-ui-093');
      s.onload = () => {
        if (!window.ELK) { reject(new Error('ELK indisponível após load.')); return; }
        resolve(window.ELK);
      };
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });

  return ATP_UI_ELK_PROMISE;
}

function atpBpmnGetEls(doc, tag, scope) {
  const NS_BPMN = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
  const root = scope || doc;
  let out = [];
  try { out = Array.from(root.getElementsByTagNameNS(NS_BPMN, tag)); } catch (_) {}
  if (out.length) return out;
  try { out = Array.from(root.getElementsByTagName(tag)); } catch (_) {}
  if (out.length) return out;
  try { out = Array.from(root.querySelectorAll(tag + ', bpmn\\:' + tag)); } catch (_) {}
  return out;
}

function atpBpmnDimsByType(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'startevent' || t === 'endevent') return { width: 36, height: 36 };
  if (t.includes('gateway')) return { width: 60, height: 60 };
  if (t === 'servicetask') return { width: 260, height: 92 };
  return { width: 220, height: 86 };
}

function atpBpmnNodeKind(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'startevent') return 'start';
  if (t === 'endevent') return 'end';
  if (t.indexOf('gateway') >= 0) return 'decision';
  if (t === 'servicetask') return 'action';
  return 'locator';
}

function atpBpmnPhaseAcceptsColumn(kind, col) {
  const c = Number(col);
  if (!Number.isFinite(c) || c < 0) return false;
  if (kind === 'start') return c === 0;
  if (kind === 'end') return c >= 2;
  if (kind === 'locator') return c === 1 || (c > 1 && (c % 3) === 1);
  if (kind === 'decision') return c >= 2 && (c % 3) === 2;
  if (kind === 'action') return c >= 3 && (c % 3) === 0;
  return c >= 1;
}

function atpBpmnNextColumnForKind(targetKind, minCol, hardMaxCol) {
  const start = Math.max(0, Number(minCol) || 0);
  const max = Math.max(start, Number(hardMaxCol) || start);
  for (let c = start; c <= max; c++) {
    if (atpBpmnPhaseAcceptsColumn(targetKind, c)) return c;
  }
  return max;
}

function atpBpmnComputeFlowStageColumns(nodes, edges, inDegree) {
  const listNodes = Array.isArray(nodes) ? nodes : [];
  const listEdges = Array.isArray(edges) ? edges : [];
  const nodeById = new Map(listNodes.map(n => [String(n && n.id || ''), n]).filter(p => p[0]));
  const outById = new Map();
  const predById = new Map();
  const cols = new Map();
  const hardMaxCol = Math.max(12, (listNodes.length || 10) + 12);

  for (const n of listNodes) {
    const id = String(n && n.id || '');
    if (!id) continue;
    outById.set(id, []);
    predById.set(id, []);
  }
  for (const e of listEdges) {
    const sid = String(e && e.source || '');
    const tid = String(e && e.target || '');
    if (!sid || !tid) continue;
    if (!outById.has(sid)) outById.set(sid, []);
    if (!predById.has(tid)) predById.set(tid, []);
    outById.get(sid).push(tid);
    predById.get(tid).push(sid);
  }

  const seeds = [];
  for (const n of listNodes) {
    const id = String(n && n.id || '');
    if (!id) continue;
    const kind = atpBpmnNodeKind(n.type);
    if (kind === 'start') {
      cols.set(id, 0);
      seeds.push(id);
    }
  }
  for (const n of listNodes) {
    const id = String(n && n.id || '');
    if (!id || cols.has(id)) continue;
    const kind = atpBpmnNodeKind(n.type);
    if (kind === 'locator' && Number(inDegree.get(id) || 0) === 0) {
      cols.set(id, 1);
      seeds.push(id);
    }
  }

  const q = seeds.slice();
  const seen = new Set(q);
  while (q.length) {
    const sid = String(q.shift() || '');
    if (!sid) continue;
    const sCol = Number(cols.get(sid));
    if (!Number.isFinite(sCol)) continue;
    const outs = (outById.get(sid) || []).slice().sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    for (const tid of outs) {
      const tNode = nodeById.get(tid);
      const tKind = atpBpmnNodeKind(tNode && tNode.type);
      const proposed = atpBpmnNextColumnForKind(tKind, sCol + 1, hardMaxCol);
      if (!cols.has(tid)) cols.set(tid, proposed);
      if (!seen.has(tid)) {
        seen.add(tid);
        q.push(tid);
      }
    }
  }

  // Relaxamento por aresta para manter progressão à direita sem reutilizar colunas antigas.
  const baseCols = new Map(cols);
  const isForwardByBase = (sid, tid) => {
    const bs = Number(baseCols.get(String(sid)));
    const bt = Number(baseCols.get(String(tid)));
    if (!Number.isFinite(bs) || !Number.isFinite(bt)) return true;
    if (bt > bs) return true;
    if (bt < bs) return false;
    return String(sid).localeCompare(String(tid), 'pt-BR') < 0;
  };

  const RELAX_MAX = Math.max(4, Math.min(64, listNodes.length * 2));
  for (let pass = 0; pass < RELAX_MAX; pass++) {
    let moved = false;
    for (const e of listEdges) {
      const sid = String(e && e.source || '');
      const tid = String(e && e.target || '');
      if (!sid || !tid) continue;
      const sCol = Number(cols.get(sid));
      if (!Number.isFinite(sCol)) continue;

      const sNode = nodeById.get(sid);
      const tNode = nodeById.get(tid);
      const sKind = atpBpmnNodeKind(sNode && sNode.type);
      const tKind = atpBpmnNodeKind(tNode && tNode.type);

      const forceForward = (sKind === 'locator' && tKind === 'decision');
      if (!forceForward && !isForwardByBase(sid, tid)) continue;

      const proposed = atpBpmnNextColumnForKind(tKind, sCol + 1, hardMaxCol);
      const cur = Number(cols.get(tid));
      if (!Number.isFinite(cur) || proposed > cur) {
        cols.set(tid, proposed);
        moved = true;
      }
    }
    if (!moved) break;
  }

  for (const n of listNodes) {
    const id = String(n && n.id || '');
    if (!id) continue;
    if (atpBpmnNodeKind(n.type) !== 'end') continue;
    const preds = predById.get(id) || [];
    let maxPred = 0;
    for (const p of preds) {
      const cp = Number(cols.get(p));
      if (Number.isFinite(cp)) maxPred = Math.max(maxPred, cp);
    }
    cols.set(id, Math.min(hardMaxCol, Math.max(Number(cols.get(id) || 0), maxPred + 1)));
  }

  for (const n of listNodes) {
    const id = String(n && n.id || '');
    if (!id || cols.has(id)) continue;
    const k = atpBpmnNodeKind(n && n.type);
    const preds = predById.get(id) || [];
    let minByPred = null;
    for (const p of preds) {
      const cp = Number(cols.get(String(p)));
      if (!Number.isFinite(cp)) continue;
      const proposed = atpBpmnNextColumnForKind(k, cp + 1, hardMaxCol);
      minByPred = Number.isFinite(minByPred) ? Math.max(minByPred, proposed) : proposed;
    }
    if (Number.isFinite(minByPred)) cols.set(id, Number(minByPred));
    else if (k === 'start') cols.set(id, 0);
    else if (k === 'locator') cols.set(id, 1);
    else if (k === 'decision') cols.set(id, 2);
    else if (k === 'action') cols.set(id, 3);
    else cols.set(id, 5);
  }

  return cols;
}

async function atpApplyElkLayoutToBpmnXml(xml) {
  const ELKClass = await atpEnsureElkLoadedForBpmn();
  const elk = new ELKClass();

  const NS = {
    bpmn: 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    bpmndi: 'http://www.omg.org/spec/BPMN/20100524/DI',
    dc: 'http://www.omg.org/spec/DD/20100524/DC',
    di: 'http://www.omg.org/spec/DD/20100524/DI'
  };

  const doc = new DOMParser().parseFromString(String(xml || ''), 'application/xml');
  if (!doc || doc.getElementsByTagName('parsererror').length) {
    throw new Error('XML BPMN inválido para layout ELK.');
  }

  const proc = atpBpmnGetEls(doc, 'process')[0] || null;
  if (!proc) throw new Error('Process BPMN não encontrado.');
  const processId = String(proc.getAttribute('id') || 'Process_1');

  const nodeTags = ['startEvent', 'endEvent', 'task', 'serviceTask', 'userTask', 'scriptTask', 'exclusiveGateway', 'parallelGateway'];
  const nodeMap = new Map();
  for (const tag of nodeTags) {
    const els = atpBpmnGetEls(doc, tag, proc);
    for (const el of els) {
      const id = String(el.getAttribute('id') || '');
      if (!id || nodeMap.has(id)) continue;
      nodeMap.set(id, { id, type: tag, name: String(el.getAttribute('name') || '') });
    }
  }

  const flows = atpBpmnGetEls(doc, 'sequenceFlow', proc);
  const edges = [];
  const outDegree = new Map();
  const inDegree = new Map();
  for (const sf of flows) {
    const id = String(sf.getAttribute('id') || ('Flow_' + Math.random().toString(36).slice(2)));
    const source = String(sf.getAttribute('sourceRef') || '');
    const target = String(sf.getAttribute('targetRef') || '');
    if (!source || !target) continue;
    if (!nodeMap.has(source)) nodeMap.set(source, { id: source, type: 'task', name: source });
    if (!nodeMap.has(target)) nodeMap.set(target, { id: target, type: 'task', name: target });
    edges.push({ id, source, target });
    outDegree.set(source, (outDegree.get(source) || 0) + 1);
    inDegree.set(target, (inDegree.get(target) || 0) + 1);
  }

  const nodes = Array.from(nodeMap.values());
  if (!nodes.length) throw new Error('Sem nós BPMN para layout.');
  const colById = atpBpmnComputeFlowStageColumns(nodes, edges, inDegree);

  const graph = {
    id: 'atp-bpmn-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.partitioning.activate': 'true',
      'elk.spacing.nodeNode': '88',
      'elk.layered.spacing.nodeNodeBetweenLayers': '220',
      'elk.layered.nodePlacement.favorStraightEdges': 'true'
    },
    children: nodes.map((n) => {
      const d = atpBpmnDimsByType(n.type);
      const col = Number(colById.get(String(n.id)) || 0);
      return {
        id: n.id,
        width: d.width,
        height: d.height,
        layoutOptions: {
          'elk.partitioning.partition': String(col)
        }
      };
    }),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }))
  };

  const laid = await elk.layout(graph);
  const posMap = new Map();
  for (const ch of (laid.children || [])) {
    const base = nodeMap.get(ch.id) || { id: ch.id, type: 'task' };
    const d = atpBpmnDimsByType(base.type);
    posMap.set(ch.id, {
      x: Number(ch.x) || 0,
      y: Number(ch.y) || 0,
      w: Number(ch.width) || d.width,
      h: Number(ch.height) || d.height
    });
  }

  // Trava X por coluna estrutural (fase do fluxo).
  const maxWByCol = new Map();
  for (const [id, b] of posMap.entries()) {
    const c = Number(colById.get(String(id)));
    const prev = Number(maxWByCol.get(c) || 0);
    maxWByCol.set(c, Math.max(prev, Number(b.w) || 220));
  }
  const colX = new Map();
  let xCursor = 40;
  const colsSorted = Array.from(maxWByCol.keys()).map(v => Number(v)).filter(Number.isFinite).sort((a, b) => a - b);
  for (const c of colsSorted) {
    const mw = Number(maxWByCol.get(c) || 220);
    colX.set(c, xCursor);
    xCursor += mw + 200;
  }
  for (const [id, b] of posMap.entries()) {
    const c = Number(colById.get(String(id)));
    const baseX = Number(colX.get(c) || 0);
    const mw = Number(maxWByCol.get(c) || b.w || 220);
    b.x = baseX + Math.max(0, ((mw - (Number(b.w) || 0)) / 2));
  }

  // Reorganização vertical por fase: alinhamento 1:1 e centróides N:1.
  const colItems = new Map();
  for (const [id, b] of posMap.entries()) {
    const c = Number(colById.get(String(id)));
    if (!colItems.has(c)) colItems.set(c, []);
    colItems.get(c).push({ id, b });
  }
  const COL_MIN_GAP_Y = 54;
  const centerY = (b) => (Number(b && b.y) || 0) + ((Number(b && b.h) || 0) / 2);
  const setCenterY = (b, cy) => { b.y = (Number(cy) || 0) - ((Number(b && b.h) || 0) / 2); };
  const avg = (arr) => {
    if (!arr || !arr.length) return null;
    let s = 0;
    let n = 0;
    for (const v of arr) { const x = Number(v); if (Number.isFinite(x)) { s += x; n++; } }
    return n ? (s / n) : null;
  };

  const predForwardByTarget = new Map();
  const succForwardBySource = new Map();
  for (const e of edges) {
    const sid = String(e && e.source || '');
    const tid = String(e && e.target || '');
    if (!sid || !tid) continue;
    const sCol = Number(colById.get(sid));
    const tCol = Number(colById.get(tid));
    if (!Number.isFinite(sCol) || !Number.isFinite(tCol)) continue;
    if (tCol > sCol) {
      if (!predForwardByTarget.has(tid)) predForwardByTarget.set(tid, []);
      if (!succForwardBySource.has(sid)) succForwardBySource.set(sid, []);
      predForwardByTarget.get(tid).push(sid);
      succForwardBySource.get(sid).push(tid);
    }
  }

  const kindById = new Map();
  for (const n of nodes) kindById.set(String(n && n.id || ''), atpBpmnNodeKind(n && n.type));
  const desiredCenterById = new Map();
  for (const [id, b] of posMap.entries()) desiredCenterById.set(String(id), centerY(b));

  const packColumnByDesired = (arr) => {
    const items = (arr || []).slice().filter(it => it && it.b && it.id);
    if (!items.length) return;
    items.sort((a, b) => {
      const da = Number(desiredCenterById.get(String(a.id)) || centerY(a.b));
      const db = Number(desiredCenterById.get(String(b.id)) || centerY(b.b));
      if (da !== db) return da - db;
      return String(a.id).localeCompare(String(b.id), 'pt-BR');
    });
    const centers = items.map(it => Number(desiredCenterById.get(String(it.id)) || centerY(it.b)));
    for (let i = 1; i < items.length; i++) {
      const hp = Math.max(20, Number(items[i - 1].b.h) || 20);
      const hc = Math.max(20, Number(items[i].b.h) || 20);
      const minDist = (hp / 2) + (hc / 2) + COL_MIN_GAP_Y;
      if (centers[i] < centers[i - 1] + minDist) centers[i] = centers[i - 1] + minDist;
    }
    for (let i = items.length - 2; i >= 0; i--) {
      const hc = Math.max(20, Number(items[i].b.h) || 20);
      const hn = Math.max(20, Number(items[i + 1].b.h) || 20);
      const minDist = (hc / 2) + (hn / 2) + COL_MIN_GAP_Y;
      if (centers[i] > centers[i + 1] - minDist) centers[i] = centers[i + 1] - minDist;
    }
    const meanDesired = avg(items.map(it => Number(desiredCenterById.get(String(it.id)) || centerY(it.b))));
    const meanPacked = avg(centers);
    const shift = (Number.isFinite(meanDesired) && Number.isFinite(meanPacked)) ? (meanDesired - meanPacked) : 0;
    for (let i = 0; i < items.length; i++) {
      const cy = centers[i] + shift;
      setCenterY(items[i].b, cy);
      desiredCenterById.set(String(items[i].id), cy);
    }
  };

  const colsAsc = Array.from(colItems.keys()).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const colsDesc = colsAsc.slice().reverse();

  for (let iter = 0; iter < 4; iter++) {
    for (const c of colsAsc) {
      const arr = colItems.get(c) || [];
      for (const it of arr) {
        const id = String(it && it.id || '');
        if (!id) continue;
        const k = String(kindById.get(id) || '');
        const preds = (predForwardByTarget.get(id) || []).slice();
        let d = null;
        if (preds.length) d = avg(preds.map(pid => {
          const pb = posMap.get(String(pid));
          return pb ? centerY(pb) : null;
        }));

        // 1:1 localizador -> gateway na mesma linha.
        if (k === 'decision' && preds.length === 1) {
          const p = String(preds[0] || '');
          if (String(kindById.get(p) || '') === 'locator' && Number(outDegree.get(p) || 0) === 1) {
            const pb = posMap.get(p);
            if (pb) d = centerY(pb);
          }
        }

        // N:1 ações -> localizador de saída alinhado ao centróide das regras.
        if (k === 'locator' && preds.length > 1) {
          const allActions = preds.every(pid => String(kindById.get(String(pid)) || '') === 'action');
          if (allActions) {
            d = avg(preds.map(pid => {
              const pb = posMap.get(String(pid));
              return pb ? centerY(pb) : null;
            }));
          }
        }

        if (Number.isFinite(d)) desiredCenterById.set(id, Number(d));
      }
      packColumnByDesired(arr);
    }

    // Suaviza continuidade para direita (evita quebra abrupta entre blocos).
    for (const c of colsDesc) {
      const arr = colItems.get(c) || [];
      for (const it of arr) {
        const id = String(it && it.id || '');
        if (!id) continue;
        const succ = (succForwardBySource.get(id) || []).slice();
        if (!succ.length) continue;
        const d2 = avg(succ.map(tid => {
          const tb = posMap.get(String(tid));
          return tb ? centerY(tb) : null;
        }));
        if (!Number.isFinite(d2)) continue;
        const cur = Number(desiredCenterById.get(id) || centerY(it.b));
        desiredCenterById.set(id, (cur * 0.7) + (Number(d2) * 0.3));
      }
      packColumnByDesired(arr);
    }
  }

  // Lanes virtuais por caminho: separa visualmente ramos independentes.
  const forwardOutById = new Map();
  const forwardInById = new Map();
  for (const n of nodes) {
    const id = String(n && n.id || '');
    if (!id) continue;
    forwardOutById.set(id, []);
    forwardInById.set(id, []);
  }
  for (const e of edges) {
    const sid = String(e && e.source || '');
    const tid = String(e && e.target || '');
    if (!sid || !tid) continue;
    const sCol = Number(colById.get(sid));
    const tCol = Number(colById.get(tid));
    if (!Number.isFinite(sCol) || !Number.isFinite(tCol)) continue;
    if (tCol > sCol) {
      if (!forwardOutById.has(sid)) forwardOutById.set(sid, []);
      if (!forwardInById.has(tid)) forwardInById.set(tid, []);
      forwardOutById.get(sid).push(tid);
      forwardInById.get(tid).push(sid);
    }
  }

  const laneById = new Map();
  let laneCursor = 0;
  const roots = Array.from(posMap.keys()).sort((a, b) => {
    const ca = Number(colById.get(String(a)) || 0);
    const cb = Number(colById.get(String(b)) || 0);
    if (ca !== cb) return ca - cb;
    const ya = centerY(posMap.get(String(a)));
    const yb = centerY(posMap.get(String(b)));
    if (ya !== yb) return ya - yb;
    return String(a).localeCompare(String(b), 'pt-BR');
  }).filter((id) => {
    const ins = forwardInById.get(String(id)) || [];
    const k = String(kindById.get(String(id)) || '');
    return !ins.length || k === 'start' || (k === 'locator' && Number(inDegree.get(String(id)) || 0) === 0);
  });

  const assignLaneFrom = (rootId, initialLane) => {
    const q = [{ id: String(rootId), lane: Number(initialLane) }];
    const seen = new Set();
    while (q.length) {
      const cur = q.shift();
      const id = String(cur && cur.id || '');
      const lane = Number(cur && cur.lane);
      if (!id || !Number.isFinite(lane)) continue;
      const seenKey = id + '|' + String(lane);
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);

      if (!laneById.has(id)) laneById.set(id, lane);

      const outs = (forwardOutById.get(id) || []).slice().sort((a, b) => {
        const ya = centerY(posMap.get(String(a)));
        const yb = centerY(posMap.get(String(b)));
        if (ya !== yb) return ya - yb;
        return String(a).localeCompare(String(b), 'pt-BR');
      });
      const isSplit = String(kindById.get(id) || '') === 'decision' && outs.length > 1;
      for (let i = 0; i < outs.length; i++) {
        const tid = String(outs[i] || '');
        if (!tid) continue;
        let tLane = lane;
        if (isSplit && i > 0) tLane = (++laneCursor);
        if (!laneById.has(tid)) laneById.set(tid, tLane);
        q.push({ id: tid, lane: tLane });
      }
    }
  };

  for (const rid of roots) {
    const id = String(rid || '');
    if (!id) continue;
    if (!laneById.has(id)) {
      laneById.set(id, laneCursor);
      assignLaneFrom(id, laneCursor);
      laneCursor += 1;
    }
  }

  // Ajusta nós de merge para a lane mediana das entradas.
  for (const [tid, preds] of forwardInById.entries()) {
    const arr = (preds || []).map(pid => Number(laneById.get(String(pid)))).filter(Number.isFinite).sort((a, b) => a - b);
    if (arr.length > 1) {
      const med = arr[Math.floor((arr.length - 1) / 2)];
      laneById.set(String(tid), Number.isFinite(med) ? med : Number(laneById.get(String(tid)) || 0));
    }
  }

  // Fallback de lane para nós sem marcação.
  for (const [id] of posMap.entries()) {
    if (laneById.has(String(id))) continue;
    laneById.set(String(id), laneCursor++);
  }

  // Aplica espaçamento entre lanes virtuais.
  const laneGroups = new Map();
  for (const [id] of posMap.entries()) {
    const lane = Number(laneById.get(String(id)) || 0);
    if (!laneGroups.has(lane)) laneGroups.set(lane, []);
    laneGroups.get(lane).push(String(id));
  }
  const laneOrder = Array.from(laneGroups.keys()).sort((a, b) => {
    const ay = avg((laneGroups.get(a) || []).map(id => centerY(posMap.get(String(id)))));
    const by = avg((laneGroups.get(b) || []).map(id => centerY(posMap.get(String(id)))));
    if (ay !== by) return ay - by;
    return a - b;
  });
  const VIRTUAL_LANE_GAP = 72;
  let prevLaneBottom = null;
  for (const lane of laneOrder) {
    const ids = laneGroups.get(lane) || [];
    if (!ids.length) continue;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const id of ids) {
      const b = posMap.get(String(id));
      if (!b) continue;
      minY = Math.min(minY, Number(b.y) || 0);
      maxY = Math.max(maxY, (Number(b.y) || 0) + (Number(b.h) || 0));
    }
    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) continue;

    // Restaura comportamento mais estável: preserva posição original
    // e só aplica deslocamento quando a lane invade a anterior.
    let shift = 0;
    if (Number.isFinite(prevLaneBottom)) {
      const requiredMinY = Number(prevLaneBottom) + VIRTUAL_LANE_GAP;
      if (minY < requiredMinY) shift = requiredMinY - minY;
    }
    if (shift !== 0) {
      for (const id of ids) {
        const b = posMap.get(String(id));
        if (!b) continue;
        b.y = (Number(b.y) || 0) + shift;
        desiredCenterById.set(String(id), centerY(b));
      }
      maxY += shift;
    }
    prevLaneBottom = maxY;
  }

  const globalMaxX = (() => {
    let v = Number.NEGATIVE_INFINITY;
    for (const b of posMap.values()) v = Math.max(v, (Number(b.x) || 0) + (Number(b.w) || 0));
    return Number.isFinite(v) ? v : 0;
  })();

  const edgeWps = new Map();
  for (const e of (laid.edges || [])) {
    const sec = e && Array.isArray(e.sections) ? e.sections[0] : null;
    if (!sec || !sec.startPoint || !sec.endPoint) continue;
    const wps = [];
    wps.push({ x: Number(sec.startPoint.x) || 0, y: Number(sec.startPoint.y) || 0 });
    for (const bp of (sec.bendPoints || [])) {
      wps.push({ x: Number(bp.x) || 0, y: Number(bp.y) || 0 });
    }
    wps.push({ x: Number(sec.endPoint.x) || 0, y: Number(sec.endPoint.y) || 0 });
    edgeWps.set(String(e.id || ''), wps);
  }
  // Waypoints do ELK não refletem a trava manual de colunas; recalcula fallback.
  edgeWps.clear();
  let diagram = null;
  try { diagram = doc.getElementsByTagNameNS(NS.bpmndi, 'BPMNDiagram')[0] || null; } catch (_) {}
  if (!diagram) {
    diagram = doc.createElementNS(NS.bpmndi, 'bpmndi:BPMNDiagram');
    diagram.setAttribute('id', 'BPMNDiagram_' + processId);
    doc.documentElement.appendChild(diagram);
  }

  let plane = null;
  try { plane = diagram.getElementsByTagNameNS(NS.bpmndi, 'BPMNPlane')[0] || null; } catch (_) {}
  if (!plane) {
    plane = doc.createElementNS(NS.bpmndi, 'bpmndi:BPMNPlane');
    plane.setAttribute('id', 'BPMNPlane_' + processId);
    plane.setAttribute('bpmnElement', processId);
    diagram.appendChild(plane);
  } else if (!plane.getAttribute('bpmnElement')) {
    plane.setAttribute('bpmnElement', processId);
  }

  for (const ch of Array.from(plane.childNodes || [])) {
    const ln = (ch && ch.localName) ? String(ch.localName) : '';
    if (ln === 'BPMNShape' || ln === 'BPMNEdge') {
      try { plane.removeChild(ch); } catch (_) {}
    }
  }

  for (const n of nodes) {
    const b = posMap.get(n.id);
    if (!b) continue;
    const sh = doc.createElementNS(NS.bpmndi, 'bpmndi:BPMNShape');
    sh.setAttribute('id', 'DI_' + n.id);
    sh.setAttribute('bpmnElement', n.id);
    const bo = doc.createElementNS(NS.dc, 'dc:Bounds');
    bo.setAttribute('x', String(Math.round(b.x)));
    bo.setAttribute('y', String(Math.round(b.y)));
    bo.setAttribute('width', String(Math.round(b.w)));
    bo.setAttribute('height', String(Math.round(b.h)));
    sh.appendChild(bo);
    plane.appendChild(sh);
  }

  // Índices por aresta para separar visualmente fan-out/fan-in.
  const outIdxByEdge = new Map();
  const outCountBySource = new Map();
  const inIdxByEdge = new Map();
  const inCountByTarget = new Map();
  const bySource = new Map();
  const byTarget = new Map();
  for (const e of edges) {
    const sid = String(e && e.source || '');
    const tid = String(e && e.target || '');
    if (!sid || !tid) continue;
    if (!bySource.has(sid)) bySource.set(sid, []);
    if (!byTarget.has(tid)) byTarget.set(tid, []);
    bySource.get(sid).push(e);
    byTarget.get(tid).push(e);
  }
  for (const [sid, arr] of bySource.entries()) {
    arr.sort((a, b) => {
      const ta = posMap.get(String(a && a.target || ''));
      const tb = posMap.get(String(b && b.target || ''));
      const ya = Number(ta && ta.y || 0);
      const yb = Number(tb && tb.y || 0);
      if (ya !== yb) return ya - yb;
      return String(a && a.id || '').localeCompare(String(b && b.id || ''), 'pt-BR');
    });
    outCountBySource.set(sid, arr.length || 1);
    arr.forEach((e, i) => outIdxByEdge.set(String(e && e.id || ''), i));
  }
  for (const [tid, arr] of byTarget.entries()) {
    arr.sort((a, b) => {
      const sa = posMap.get(String(a && a.source || ''));
      const sb = posMap.get(String(b && b.source || ''));
      const ya = Number(sa && sa.y || 0);
      const yb = Number(sb && sb.y || 0);
      if (ya !== yb) return ya - yb;
      return String(a && a.id || '').localeCompare(String(b && b.id || ''), 'pt-BR');
    });
    inCountByTarget.set(tid, arr.length || 1);
    arr.forEach((e, i) => inIdxByEdge.set(String(e && e.id || ''), i));
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rectCenter = (r) => ({ x: r.x + (r.w / 2), y: r.y + (r.h / 2) });
  const isGatewayType = (n) => String(n && n.type || '').toLowerCase().indexOf('gateway') >= 0;
  const sideFromPoint = (rect, pt) => {
    const c = rectCenter(rect);
    const dx = (Number(pt && pt.x) || 0) - c.x;
    const dy = (Number(pt && pt.y) || 0) - c.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  };
  const sideForGatewayFan = (srcRect, tgtRect, srcOutCount) => {
    const sc = rectCenter(srcRect);
    const tc = rectCenter(tgtRect);
    const dx = tc.x - sc.x;
    const dy = tc.y - sc.y;
    const hasFan = (Number(srcOutCount) || 0) > 1;
    if (hasFan && Math.abs(dy) > Math.max(10, srcRect.h * 0.22)) {
      return dy >= 0 ? 'bottom' : 'top';
    }
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  };
  const dockGateway = (rect, side, ref) => {
    const l = rect.x;
    const r = rect.x + rect.w;
    const t = rect.y;
    const b = rect.y + rect.h;
    const cx = rect.x + (rect.w / 2);
    const cy = rect.y + (rect.h / 2);
    const hw = Math.max(1, rect.w / 2);
    const hh = Math.max(1, rect.h / 2);
    const rx = Number(ref && ref.x) || cx;
    const ry = Number(ref && ref.y) || cy;

    if (side === 'left' || side === 'right') {
      const y = clamp(ry, t, b);
      const k = Math.max(0, 1 - (Math.abs(y - cy) / hh));
      const x = cx + ((side === 'right' ? 1 : -1) * hw * k);
      return { x, y };
    }

    const x = clamp(rx, l, r);
    const k = Math.max(0, 1 - (Math.abs(x - cx) / hw));
    const y = cy + ((side === 'bottom' ? 1 : -1) * hh * k);
    return { x, y };
  };
  const dockBySide = (rect, side, ref) => {
    const l = rect.x;
    const r = rect.x + rect.w;
    const t = rect.y;
    const b = rect.y + rect.h;
    const rx = Number(ref && ref.x) || (l + r) / 2;
    const ry = Number(ref && ref.y) || (t + b) / 2;
    if (side === 'left') return { x: l, y: clamp(ry, t, b) };
    if (side === 'right') return { x: r, y: clamp(ry, t, b) };
    if (side === 'top') return { x: clamp(rx, l, r), y: t };
    return { x: clamp(rx, l, r), y: b };
  };
  const dockForNode = (rect, meta, side, ref) => {
    if (isGatewayType(meta)) return dockGateway(rect, side, ref);
    return dockBySide(rect, side, ref);
  };
  const compactPts = (pts) => {
    const out = [];
    for (const p0 of (pts || [])) {
      const p = { x: Number(p0 && p0.x) || 0, y: Number(p0 && p0.y) || 0 };
      const prev = out.length ? out[out.length - 1] : null;
      if (prev && Math.abs(prev.x - p.x) < 0.001 && Math.abs(prev.y - p.y) < 0.001) continue;
      out.push(p);
    }
    return out;
  };
  const orthogonalizePts = (pts) => {
    const src = compactPts(pts || []);
    if (src.length < 2) return src;
    const out = [src[0]];
    for (let i = 1; i < src.length; i++) {
      const a = out[out.length - 1];
      const b = src[i];
      const ax = Number(a && a.x) || 0;
      const ay = Number(a && a.y) || 0;
      const bx = Number(b && b.x) || 0;
      const by = Number(b && b.y) || 0;
      if (Math.abs(ax - bx) < 0.001 || Math.abs(ay - by) < 0.001) {
        out.push({ x: bx, y: by });
        continue;
      }
      // Proíbe diagonais: quebra em dois segmentos ortogonais (H depois V).
      out.push({ x: bx, y: ay });
      out.push({ x: bx, y: by });
    }
    return compactPts(out);
  };
  const buildFallbackOrtho = (edge, srcRect, tgtRect, srcMeta, tgtMeta, srcOutCount, tgtInCount) => {
    const sc = rectCenter(srcRect);
    const tc = rectCenter(tgtRect);
    const eid = String(edge && edge.id || '');
    const sid = String(edge && edge.source || '');
    const tid = String(edge && edge.target || '');
    const outIdx = Number(outIdxByEdge.get(eid) || 0);
    const outCnt = Number(outCountBySource.get(sid) || Math.max(1, srcOutCount || 1));
    const inIdx = Number(inIdxByEdge.get(eid) || 0);
    const inCnt = Number(inCountByTarget.get(tid) || Math.max(1, tgtInCount || 1));
    const outOff = (outIdx - ((outCnt - 1) / 2)) * 12;
    const inOff = (inIdx - ((inCnt - 1) / 2)) * 10;
    const forward = tc.x >= sc.x;
    const srcIsGateway = isGatewayType(srcMeta);
    const tgtIsGateway = isGatewayType(tgtMeta);

    // Estilo tradicional: conexões horizontais entre colunas (left/right), sem fan por top/bottom.
    const srcSide = forward ? 'right' : 'left';
    const tgtSide = forward ? 'left' : 'right';
    const p1 = dockForNode(srcRect, srcMeta, srcSide, { x: sc.x, y: sc.y });
    const p2 = dockForNode(tgtRect, tgtMeta, tgtSide, { x: tc.x, y: tc.y });

    // Fallback simples.
    if (Math.abs(p1.x - p2.x) < 0.001 || Math.abs(p1.y - p2.y) < 0.001) return [p1, p2];

    // Gateway com múltiplas saídas: cria "tronco vertical" com ramificações horizontais.
    if (forward && srcIsGateway && outCnt > 1) {
      const trunkX = p1.x + 30;
      return orthogonalizePts([p1, { x: trunkX, y: p1.y }, { x: trunkX, y: p2.y }, p2]);
    }

    // Gateway com múltiplas entradas: convergência tradicional em tronco vertical.
    if (!forward && tgtIsGateway && inCnt > 1) {
      const trunkX = p2.x - 30;
      return orthogonalizePts([p1, { x: trunkX, y: p1.y }, { x: trunkX, y: p2.y }, p2]);
    }

    // Ligações para a esquerda: contorna pela direita do diagrama.
    if (!forward) {
      const laneX = globalMaxX + 160 + Math.abs(outOff * 0.4) + Math.abs(inOff * 0.3);
      return orthogonalizePts([p1, { x: laneX, y: p1.y }, { x: laneX, y: p2.y }, p2]);
    }

    // Padrão L tradicional (um cotovelo principal + chegada ao alvo).
    const elbowX = Math.max(p1.x + 24, p2.x - 24 + inOff);
    return orthogonalizePts([p1, { x: elbowX, y: p1.y }, { x: elbowX, y: p2.y }, p2]);
  };
  const snapElkEdgeToBounds = (wps, srcRect, tgtRect, srcMeta, tgtMeta, srcOutCount, tgtInCount) => {
    const pts = Array.isArray(wps) ? wps.map((p) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 })) : [];
    if (pts.length < 2 || !srcRect || !tgtRect) return pts;
    const p1 = pts[1] || rectCenter(tgtRect);
    const pPrev = pts[pts.length - 2] || rectCenter(srcRect);
    const srcSide = isGatewayType(srcMeta)
      ? sideForGatewayFan(srcRect, tgtRect, srcOutCount)
      : sideFromPoint(srcRect, p1);
    const tgtSide = isGatewayType(tgtMeta) && (Number(tgtInCount) || 0) > 1
      ? sideForGatewayFan(tgtRect, srcRect, tgtInCount)
      : sideFromPoint(tgtRect, pPrev);
    pts[0] = dockForNode(srcRect, srcMeta, srcSide, p1);
    pts[pts.length - 1] = dockForNode(tgtRect, tgtMeta, tgtSide, pPrev);
    return pts;
  };

  for (const e of edges) {
    const ed = doc.createElementNS(NS.bpmndi, 'bpmndi:BPMNEdge');
    ed.setAttribute('id', 'DI_' + e.id);
    ed.setAttribute('bpmnElement', e.id);

    let wps = edgeWps.get(e.id) || null;
    const srcMeta = nodeMap.get(e.source) || null;
    const tgtMeta = nodeMap.get(e.target) || null;
    const srcOutCount = Number(outDegree.get(e.source) || 0);
    const tgtInCount = Number(inDegree.get(e.target) || 0);
    if (!wps || wps.length < 2) {
      const s = posMap.get(e.source);
      const t = posMap.get(e.target);
      if (s && t) {
        wps = buildFallbackOrtho(e, s, t, srcMeta, tgtMeta, srcOutCount, tgtInCount);
      } else {
        wps = [];
      }
    } else {
      const s = posMap.get(e.source);
      const t = posMap.get(e.target);
      wps = snapElkEdgeToBounds(wps, s, t, srcMeta, tgtMeta, srcOutCount, tgtInCount);
    }

    const wpsOrtho = orthogonalizePts(wps || []);
    for (const p of wpsOrtho) {
      const wp = doc.createElementNS(NS.di, 'di:waypoint');
      wp.setAttribute('x', String(Math.round(Number(p.x) || 0)));
      wp.setAttribute('y', String(Math.round(Number(p.y) || 0)));
      ed.appendChild(wp);
    }
    plane.appendChild(ed);
  }

  return new XMLSerializer().serializeToString(doc);
}

function recalc(table) {
    if (!document.body.contains(table)) return;

    if (!atpWaitTablePopulationOrRetry(table)) {
      atpQueueRecalc(table, 200);
      return;
    }

    if (table.classList && table.classList.contains('dataTable') && table.querySelector('.dataTables_processing')) {
      atpQueueRecalc(table, 250);
      return;
    }

    const cols = mapColumns(table);
    if (!cols) { try { markATPRenderTick(); } catch (e) {} return; }
    // Com N. e Prioridade em colunas separadas, o índice efetivo do número
    // precisa ser ajustado antes da leitura das regras.
    cols.colNumPrior = atpNucleoIndiceColunaNumeroNucleo(table, cols);
    const idxPrior = Number(atpNucleoIndiceColunaPrioridadeNucleo(table));
    if (Number.isFinite(idxPrior) && idxPrior >= 0) cols.colPrioridade = idxPrior;
    const rules = parseRules(table, cols);
    atpSetRulesState(rules);
    ensureColumns(table);
    try {
      addOnlyConflictsCheckbox(table, () => schedule(() => applyFilter(table), 0, 'atp-apply-filter'));
    } catch (_) {}
    atpNucleoRestaurarControleExecucaoNoNumero(table, cols);
    updateAllRemoverLupasByTooltipText(table);
    replacePlainRemoverTextInTable(table, cols);

    if (typeof logAllRules === "function") logAllRules(rules);
    if (!rules.length) { try { markATPRenderTick(); } catch (e) {} return; }
    const conflicts = analyze(rules);
    render(table, rules, conflicts);
    atpAgruparConflitosPorRegraPivo(table, cols);
    atpNucleoGarantirColunaPrioridade(table, rules, cols);
    atpNucleoGarantirOrdenacaoNasColunas(table, cols);
    atpNucleoAplicarOrdenacaoLinhas(table);
    try { atpUpdateSimpleBadge(rules, conflicts); } catch (_) {}
    try { markATPRenderTick(); } catch (e) {}
  }

function atpAgruparConflitosPorRegraPivo(table, cols) {
  if (!table) return;
  const corpos = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector('tbody')].filter(Boolean);
  const rows = corpos.flatMap((tb) => Array.from(tb.rows || []));
  const idxNum = Number(atpNucleoIndiceColunaNumeroNucleo(table, cols || {}));

  const cfg = {
    'Avaliar Prioridade': { ordem: 10, rotulo: 'Atenção (Avaliar Prioridade)', icone: '⚠️' },
    'Regra em Duplicidade': { ordem: 20, rotulo: 'Crítico (Regra em Duplicidade)', icone: '⛔' },
    'Avaliar Troca de Localizadores': { ordem: 30, rotulo: 'Atenção (Troca de Localizadores)', icone: '🔁' },
    'Prioridade Invertida': { ordem: 40, rotulo: 'Crítico (Prioridade Invertida)', icone: '⛔' },
    'Filtros Conflitantes': { ordem: 50, rotulo: 'Crítico (Filtros Conflitantes)', icone: '⛔' },
    'Regra sem Finalidade': { ordem: 60, rotulo: 'Crítico (Regra sem Finalidade)', icone: '⛔' },
    'Potencial Looping': { ordem: 70, rotulo: 'Crítico (Potencial Looping)', icone: '⛔' }
  };

  const ordemTipo = (tipo) => (cfg[tipo]?.ordem || 999);
  const tituloTipo = (tipo) => (cfg[tipo]?.rotulo || tipo);
  const iconeTipo = (tipo) => (cfg[tipo]?.icone || '•');
  const visivel = (el) => !!el && String(el.style?.display || '').toLowerCase() !== 'none';
  const toNumSort = (arr) => arr.slice().sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    if (Number.isFinite(na)) return -1;
    if (Number.isFinite(nb)) return 1;
    return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
  });

  rows.forEach((tr) => {
    const tds = Array.from(tr.querySelectorAll(':scope > td'));
    const tdNum = (Number.isFinite(idxNum) && idxNum >= 0) ? tds[idxNum] : null;
    const baseNum = clean(extrairNumeroRegra(tdNum));
    const confTd = tr.querySelector('td[data-atp-col="conflita"]');
    if (!confTd) return;

    const linhas = Array.from(confTd.querySelectorAll(':scope > div[data-atp-conf-linha="1"]')).filter(visivel);
    if (!linhas.length) return;

    const groups = new Map(); // tipo -> { nums:Set, items:[{num, line}] }

    for (const linha of linhas) {
      const numTxt = clean(linha.querySelector('.atp-conf-num')?.textContent || '');
      const m = numTxt.match(/\d{1,6}/);
      const otherNum = m ? m[0] : '';
      const tipos = Array.from(linha.querySelectorAll('.atp-conf-tipo'))
        .map((el) => clean(el.getAttribute('data-atp-tipo') || el.textContent || ''))
        .filter(Boolean);
      if (!tipos.length) continue;
      tipos.forEach((tipo) => {
        const g = groups.get(tipo) || { nums: new Set(), items: [] };
        if (otherNum) g.nums.add(otherNum);
        g.items.push({ num: otherNum, line: linha });
        groups.set(tipo, g);
      });
    }

    if (!groups.size) return;

    const orderedTypes = Array.from(groups.keys()).sort((a, b) => {
      const oa = ordemTipo(a);
      const ob = ordemTipo(b);
      if (oa !== ob) return oa - ob;
      return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });
    });

    const root = document.createElement('div');
    root.className = 'atp-conf-group-root';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.gap = '4px';

    orderedTypes.forEach((tipo) => {
      const g = groups.get(tipo);
      const nums = toNumSort(Array.from(g.nums));
      const total = nums.length;
      const first = nums.slice(0, 10);
      const resto = Math.max(0, total - first.length);
      const numsResumo = first.join(', ') + (resto > 0 ? `... [+${resto}]` : '');

      const line = document.createElement('div');
      line.className = 'atp-conf-group-line';
      line.style.fontSize = '12px';
      line.style.lineHeight = '1.35';
      line.style.padding = '1px 0';

      const badge = document.createElement('span');
      badge.className = 'atp-conf-tipo';
      badge.setAttribute('data-atp-tipo', tipo);
      badge.textContent = `${iconeTipo(tipo)} ${tituloTipo(tipo)} (${total})`;
      badge.style.marginRight = '6px';

      const numsTxt = document.createElement('span');
      numsTxt.style.color = '#0f172a';
      numsTxt.textContent = numsResumo;

      line.appendChild(badge);
      line.appendChild(numsTxt);

      if (tipo === 'Avaliar Prioridade' && baseNum) {
        const btnOk = document.createElement('button');
        btnOk.type = 'button';
        btnOk.className = 'infraButton';
        btnOk.textContent = 'OK';
        btnOk.title = 'Marcar como revisado (não exibir mais "Avaliar Prioridade" para estes pares)';
        btnOk.style.marginLeft = '8px';
        btnOk.style.fontSize = '11px';
        btnOk.style.padding = '0 6px';
        btnOk.style.lineHeight = '18px';
        btnOk.style.height = '18px';
        btnOk.addEventListener('click', (ev) => {
          try { ev.preventDefault(); } catch (_) {}
          try { ev.stopPropagation(); } catch (_) {}
          try {
            const rules = (typeof atpGetRulesState === 'function') ? atpGetRulesState() : [];
            const byNum = new Map((rules || []).map(r => [String(r.num), r]));
            const A = byNum.get(String(baseNum));
            if (!A?.sig || typeof atpReviewedPairKey !== 'function' || typeof atpToggleReviewedPriorityPair !== 'function') {
              const open = window && window.atpOpenPriorityReviewManager;
              if (typeof open === 'function') open();
              return;
            }
            nums.forEach((n) => {
              const B = byNum.get(String(n));
              if (!B?.sig) return;
              const pk = atpReviewedPairKey(A.sig, B.sig);
              atpToggleReviewedPriorityPair(pk);
            });
            if (typeof atpQueueRecalc === 'function') atpQueueRecalc(table, 0);
          } catch (_) {
            try {
              const open = window && window.atpOpenPriorityReviewManager;
              if (typeof open === 'function') open();
            } catch (_) {}
          }
        });
        line.appendChild(btnOk);
      }
      root.appendChild(line);
    });

    confTd.innerHTML = '';
    confTd.appendChild(root);
    confTd.querySelectorAll(':scope > .atp-compare-btn').forEach((el) => el.remove());
    if (baseNum && confTd.dataset.atpConfNums) {
      if (typeof makeCompareButton === 'function') {
        confTd.appendChild(makeCompareButton(baseNum, confTd));
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'atp-compare-btn infraButton';
        btn.textContent = 'Comparar';
        btn.style.marginTop = '6px';
        btn.addEventListener('click', () => {
          try {
            const others = String(confTd.dataset.atpConfNums || '').split(',').map(s => s.trim()).filter(Boolean);
            const all = Array.from(new Set([...others, String(baseNum)])).sort((a, b) => Number(a) - Number(b));
            if (typeof setNumeroRegraAndSearch === 'function') setNumeroRegraAndSearch(all);
          } catch (_) {}
        });
        confTd.appendChild(btn);
      }
    }
    try { bindTipoConflitoTooltips(confTd); } catch (_) {}
  });
}

function atpNucleoIndiceColunaConflitos(tabela) {
  try {
    const th = tabela?.querySelector?.('thead tr th[data-atp-col="conflita"]');
    if (!th || !th.parentElement) return -1;
    return Array.from(th.parentElement.children).indexOf(th);
  } catch (_) {
    return -1;
  }
}

function atpNucleoIndiceColunaNumeroNucleo(tabela, colunas) {
  try {
    const headRow = tabela?.querySelector?.('thead tr');
    if (!headRow) return Number(colunas?.colNumPrior);
    const ths = Array.from(headRow.querySelectorAll(':scope > th'));
    const marcado = ths.find((th) => String(th.dataset?.atpCol || '') === 'numero-nucleo');
    if (marcado) return ths.indexOf(marcado);
    const porRotulo = ths.find((th) => {
      const tipoCol = String(th.dataset?.atpCol || '');
      if (tipoCol === 'prioridade-nucleo') return false;
      const txt = clean(th.textContent || '').toLowerCase();
      return txt === 'n.' || txt === 'n' || txt.startsWith('nº') || txt.startsWith('n°') || txt.startsWith('no') || txt.includes('nº / prioridade');
    });
    if (porRotulo) return ths.indexOf(porRotulo);
    const idxMapeado = Number(colunas?.colNumPrior);
    if (Number.isFinite(idxMapeado) && idxMapeado >= 0) {
      const th = ths[idxMapeado];
      if (th && String(th.dataset?.atpCol || '') !== 'prioridade-nucleo') return idxMapeado;
    }
    return 1;
  } catch (_) {
    return Number(colunas?.colNumPrior);
  }
}

function atpNucleoIndiceColunaPrioridadeNucleo(tabela) {
  try {
    const th = tabela?.querySelector?.('thead tr th[data-atp-col="prioridade-nucleo"]');
    if (!th || !th.parentElement) return -1;
    return Array.from(th.parentElement.children).indexOf(th);
  } catch (_) {
    return -1;
  }
}

function atpNucleoRestaurarControleExecucaoNoNumero(tabela, colunas) {
  if (!tabela || !colunas) return;
  const indiceNumero = Number(atpNucleoIndiceColunaNumeroNucleo(tabela, colunas));
  const indicePrioridade = Number(atpNucleoIndiceColunaPrioridadeNucleo(tabela));
  if (!Number.isFinite(indiceNumero) || indiceNumero < 0 || !Number.isFinite(indicePrioridade) || indicePrioridade < 0) return;
  const corpos = tabela.tBodies?.length ? Array.from(tabela.tBodies) : [tabela.querySelector('tbody')].filter(Boolean);
  corpos.forEach((tbody) => {
    Array.from(tbody.rows || []).forEach((tr) => {
      const tds = Array.from(tr.querySelectorAll(':scope > td'));
      const tdNumero = tds[indiceNumero];
      const tdPrioridade = tds[indicePrioridade];
      if (!tdNumero || !tdPrioridade) return;
      const controlesMovidos = Array.from(tdPrioridade.querySelectorAll('select[data-atp-movido-prioridade="1"]'));
      controlesMovidos.forEach((ctrl) => {
        try { tdNumero.appendChild(ctrl); } catch (_) {}
      });
    });
  });
}

function atpNucleoLerEstadoOrdenacao() {
  const src = window.atpOrdenacaoColunaNucleo || {};
  const indice = Number(src.indiceColuna);
  const direcao = String(src.direcao || 'nenhuma');
  return {
    indiceColuna: Number.isFinite(indice) ? indice : -1,
    direcao: (direcao === 'crescente' || direcao === 'decrescente') ? direcao : 'nenhuma'
  };
}

function atpNucleoAplicarEstadoOrdenacao(indiceColuna, direcao) {
  window.atpOrdenacaoColunaNucleo = {
    indiceColuna: Number.isFinite(Number(indiceColuna)) ? Number(indiceColuna) : -1,
    direcao: (direcao === 'crescente' || direcao === 'decrescente') ? direcao : 'nenhuma'
  };
}

function atpNucleoValorOrdenacaoCelula(td) {
  if (!td) return { numero: null, texto: '' };
  if (td.dataset && td.dataset.atpCol === 'prioridade-nucleo') {
    const nula = td.dataset.atpPrioridadeNula === '1';
    const n = Number(td.dataset.atpPrioridadeNum);
    const numero = (!nula && Number.isFinite(n)) ? n : null;
    const texto = String(td.dataset.atpPrioridadeTexto || td.textContent || '').trim();
    return { numero, texto };
  }
  if (td.dataset && td.dataset.atpCol === 'conflita') {
    const linhasVisiveis = Array.from(td.querySelectorAll('[data-atp-conf-linha="1"]')).filter((div) => {
      if (String(div.style.display || '').toLowerCase() === 'none') return false;
      if (div.closest('.atp-conf-group-details') && String(div.closest('.atp-conf-group-details')?.style?.display || '').toLowerCase() === 'none') return false;
      return !!div.querySelector('.atp-conf-tipo[data-atp-tipo]');
    }).length;
    const txtConf = String(td.textContent || '').trim();
    return { numero: linhasVisiveis, texto: txtConf };
  }
  const txt = String(td.textContent || '').replace(/\s+/g, ' ').trim();
  const m = txt.match(/-?\d+(?:[.,]\d+)?/);
  if (m) {
    const n = Number(String(m[0]).replace(',', '.'));
    if (Number.isFinite(n)) return { numero: n, texto: txt };
  }
  return { numero: null, texto: txt };
}

function atpNucleoCompararPrioridadeCelula(tdA, tdB, direcao) {
  const aNula = String(tdA?.dataset?.atpPrioridadeNula || '1') === '1';
  const bNula = String(tdB?.dataset?.atpPrioridadeNula || '1') === '1';
  if (aNula !== bNula) return aNula ? 1 : -1;
  if (aNula && bNula) return 0;
  const fator = direcao === 'decrescente' ? -1 : 1;
  const aNum = Number(tdA?.dataset?.atpPrioridadeNum);
  const bNum = Number(tdB?.dataset?.atpPrioridadeNum);
  const aNumOk = Number.isFinite(aNum);
  const bNumOk = Number.isFinite(bNum);
  if (aNumOk && bNumOk && aNum !== bNum) return (aNum - bNum) * fator;
  const aTxt = String(tdA?.dataset?.atpPrioridadeTexto || tdA?.textContent || '');
  const bTxt = String(tdB?.dataset?.atpPrioridadeTexto || tdB?.textContent || '');
  const cmp = aTxt.localeCompare(bTxt, 'pt-BR', { sensitivity: 'base', numeric: true });
  return cmp * fator;
}

function atpNucleoGarantirOrdemOriginal(tabela) {
  const corpos = tabela?.tBodies?.length ? Array.from(tabela.tBodies) : [tabela?.querySelector?.('tbody')].filter(Boolean);
  let ordem = 1;
  corpos.forEach((tbody) => {
    Array.from(tbody.rows || []).forEach((tr) => {
      if (!tr.dataset.atpOrdemOriginal) tr.dataset.atpOrdemOriginal = String(ordem++);
    });
  });
}

function atpNucleoAplicarOrdenacaoLinhas(tabela) {
  if (!tabela) return;
  const estado = atpNucleoLerEstadoOrdenacao();
  atpNucleoGarantirOrdemOriginal(tabela);
  const corpos = tabela.tBodies?.length ? Array.from(tabela.tBodies) : [tabela.querySelector('tbody')].filter(Boolean);
  const indice = Number(estado.indiceColuna);
  const direcao = String(estado.direcao || 'nenhuma');
  const fator = direcao === 'decrescente' ? -1 : 1;

  try { window.ATP_SUPPRESS_OBSERVER = true; } catch (_) {}
  try {
    corpos.forEach((tbody) => {
      const linhas = Array.from(tbody.rows || []);
      if (!linhas.length) return;
      linhas.sort((a, b) => {
        if (direcao === 'nenhuma' || !Number.isFinite(indice) || indice < 0) {
          return Number(a.dataset.atpOrdemOriginal || 0) - Number(b.dataset.atpOrdemOriginal || 0);
        }
        const tdsA = a.querySelectorAll(':scope > td');
        const tdsB = b.querySelectorAll(':scope > td');
        if ((tdsA[indice]?.dataset?.atpCol === 'prioridade-nucleo') && (tdsB[indice]?.dataset?.atpCol === 'prioridade-nucleo')) {
          const cmpPrio = atpNucleoCompararPrioridadeCelula(tdsA[indice], tdsB[indice], direcao);
          if (cmpPrio !== 0) return cmpPrio;
        }
        const va = atpNucleoValorOrdenacaoCelula(tdsA[indice]);
        const vb = atpNucleoValorOrdenacaoCelula(tdsB[indice]);
        if (va.numero !== null && vb.numero !== null && va.numero !== vb.numero) return (va.numero - vb.numero) * fator;
        const ta = String(va.texto || '');
        const tb = String(vb.texto || '');
        const cmp = ta.localeCompare(tb, 'pt-BR', { sensitivity: 'base', numeric: true });
        if (cmp !== 0) return cmp * fator;
        return Number(a.dataset.atpOrdemOriginal || 0) - Number(b.dataset.atpOrdemOriginal || 0);
      });
      linhas.forEach((tr) => tbody.appendChild(tr));
    });
  } finally {
    setTimeout(() => { try { window.ATP_SUPPRESS_OBSERVER = false; } catch (_) {} }, 0);
  }
}

function atpNucleoAtualizarIndicadorOrdenacao(tabela) {
  if (!tabela) return;
  const estado = atpNucleoLerEstadoOrdenacao();
  const botoes = Array.from(tabela.querySelectorAll('button.atp-ordenar-coluna[data-atp-indice-coluna]'));
  botoes.forEach((btn) => {
    const idx = Number(btn.getAttribute('data-atp-indice-coluna'));
    const ativo = idx === Number(estado.indiceColuna);
    let simbolo = '↕';
    if (ativo && estado.direcao === 'crescente') simbolo = '↑';
    if (ativo && estado.direcao === 'decrescente') simbolo = '↓';
    btn.textContent = simbolo;
    btn.style.background = ativo ? '#e0f2fe' : '#f8fafc';
    btn.style.borderColor = ativo ? '#7dd3fc' : '#d1d5db';
  });
}

function atpNucleoAlternarOrdenacaoColuna(tabela, indiceColuna) {
  const estado = atpNucleoLerEstadoOrdenacao();
  const idx = Number(indiceColuna);
  if (!Number.isFinite(idx) || idx < 0) return;
  let proxima = 'crescente';
  if (Number(estado.indiceColuna) === idx && estado.direcao === 'crescente') proxima = 'decrescente';
  else if (Number(estado.indiceColuna) === idx && estado.direcao === 'decrescente') proxima = 'nenhuma';
  atpNucleoAplicarEstadoOrdenacao(proxima === 'nenhuma' ? -1 : idx, proxima);
  atpNucleoAtualizarIndicadorOrdenacao(tabela);
  atpNucleoAplicarOrdenacaoLinhas(tabela);
}

function atpNucleoGarantirOrdenacaoNasColunas(tabela, colunas) {
  if (!tabela || !colunas) return;
  const headRow = tabela.querySelector('thead tr');
  if (!headRow) return;
  const indiceNumero = atpNucleoIndiceColunaNumeroNucleo(tabela, colunas);
  const indices = [
    indiceNumero,
    atpNucleoIndiceColunaPrioridadeNucleo(tabela),
    colunas.colRemover,
    colunas.colTipo,
    colunas.colIncluir,
    colunas.colOutros,
    atpNucleoIndiceColunaConflitos(tabela)
  ].filter((idx, pos, arr) => Number.isFinite(idx) && idx >= 0 && arr.indexOf(idx) === pos);

  const ths = Array.from(headRow.children || []);
  indices.forEach((idx) => {
    const th = ths[idx];
    if (!th) return;
    let btn = th.querySelector(`button.atp-ordenar-coluna[data-atp-indice-coluna="${idx}"]`);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'atp-ordenar-coluna infraButton';
      btn.setAttribute('data-atp-indice-coluna', String(idx));
      btn.title = 'Ordenar coluna';
      btn.style.marginLeft = '6px';
      btn.style.padding = '1px 6px';
      btn.style.fontSize = '11px';
      btn.style.lineHeight = '1.2';
      btn.addEventListener('click', (ev) => {
        try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
        atpNucleoAlternarOrdenacaoColuna(tabela, idx);
      });
      th.appendChild(btn);
    }
  });
  atpNucleoAtualizarIndicadorOrdenacao(tabela);
}

function atpNucleoGarantirColunaPrioridade(tabela, regras, colunas) {
  if (!tabela || !colunas) return;
  const indiceNumero = Number(atpNucleoIndiceColunaNumeroNucleo(tabela, colunas));
  if (!Number.isFinite(indiceNumero) || indiceNumero < 0) return;
  const headRow = tabela.querySelector('thead tr');
  if (!headRow) return;
  const thNumero = Array.from(headRow.querySelectorAll(':scope > th'))[indiceNumero] || null;
  if (thNumero) {
    thNumero.dataset.atpCol = 'numero-nucleo';
    let rotuloNumero = thNumero.querySelector('span[data-atp-col-label="numero"]');
    if (!rotuloNumero) {
      rotuloNumero = document.createElement('span');
      rotuloNumero.setAttribute('data-atp-col-label', 'numero');
      const botaoOrdenacaoNumero = thNumero.querySelector(`button.atp-ordenar-coluna[data-atp-indice-coluna="${indiceNumero}"]`);
      if (botaoOrdenacaoNumero) thNumero.insertBefore(rotuloNumero, botaoOrdenacaoNumero);
      else thNumero.insertBefore(rotuloNumero, thNumero.firstChild || null);
    }
    rotuloNumero.textContent = 'N.';
    Array.from(thNumero.childNodes).forEach((no) => {
      if (no === rotuloNumero) return;
      if (no.nodeType === Node.TEXT_NODE) {
        try { no.remove(); } catch (_) {}
      }
    });
    try { thNumero.querySelector('#areaOrdenacaoNumeroNucleo')?.remove(); } catch (_) {}
  }

  let thPrioridade = headRow.querySelector('th[data-atp-col="prioridade-nucleo"]');
  if (!thPrioridade) {
    thPrioridade = document.createElement('th');
    thPrioridade.dataset.atpCol = 'prioridade-nucleo';
    thPrioridade.className = 'infraTh sorting_disabled';
    thPrioridade.style.whiteSpace = 'nowrap';
    thPrioridade.style.minWidth = '90px';
  }
  let rotuloPrioridade = thPrioridade.querySelector('span[data-atp-col-label="prioridade"]');
  if (!rotuloPrioridade) {
    rotuloPrioridade = document.createElement('span');
    rotuloPrioridade.setAttribute('data-atp-col-label', 'prioridade');
    thPrioridade.insertBefore(rotuloPrioridade, thPrioridade.firstChild || null);
  }
  rotuloPrioridade.textContent = 'Prioridade';
  thPrioridade.title = 'PRIORIDADE: regras sem prioridade serão executadas após as que tiverem prioridade definida. Quando regras conflitantes tiverem prioridades iguais, a mais antiga será executada primeiro.';
  try { thPrioridade.querySelector('#areaOrdenacaoPrioridadeNucleo')?.remove(); } catch (_) {}

  Array.from(thPrioridade.childNodes).forEach((no) => {
    if (no === rotuloPrioridade) return;
    if (no.nodeType === Node.TEXT_NODE) {
      try { no.remove(); } catch (_) {}
    }
  });

  const thsSemPrioridade = Array.from(headRow.querySelectorAll(':scope > th')).filter((th) => th !== thPrioridade);
  const ancoraTh = thsSemPrioridade[indiceNumero + 1] || null;
  if (thPrioridade.parentNode !== headRow || thPrioridade.nextSibling !== ancoraTh) {
    try { headRow.insertBefore(thPrioridade, ancoraTh); } catch (_) {}
  }

  const regrasPorNumero = new Map((Array.isArray(regras) ? regras : []).map((r) => [String(r.num), r]));
  const corpos = tabela.tBodies?.length ? Array.from(tabela.tBodies) : [tabela.querySelector('tbody')].filter(Boolean);
  corpos.forEach((tbody) => {
    Array.from(tbody.rows || []).forEach((tr) => {
      const tdsAtuais = Array.from(tr.querySelectorAll(':scope > td'));
      const tdNumero = tdsAtuais[indiceNumero] || tdsAtuais[1];
      const numRegra = extrairNumeroRegra(tdNumero);
      const regra = regrasPorNumero.get(String(numRegra || ''));
      const prioridadeNum = Number(regra?.prioridade?.num);
      const prioridadeBruta = clean(regra?.prioridade?.raw || regra?.prioridade?.text || '');
      const prioridadeNula = !Number.isFinite(prioridadeNum);
      const prioridadeTexto = prioridadeNula
        ? (prioridadeBruta && prioridadeBruta !== '[*]' ? prioridadeBruta : 'Sem prioridade')
        : String(prioridadeNum);

      let tdPrioridade = tr.querySelector('td[data-atp-col="prioridade-nucleo"]');
      if (!tdPrioridade) {
        tdPrioridade = document.createElement('td');
        tdPrioridade.dataset.atpCol = 'prioridade-nucleo';
        tdPrioridade.style.whiteSpace = 'nowrap';
      }
      const controlesExecucao = Array.from(tdNumero?.querySelectorAll?.('select') || []);
      const controleExecucao = controlesExecucao[0] || null;
      tdPrioridade.textContent = '';
      if (controleExecucao) {
        controleExecucao.dataset.atpMovidoPrioridade = '1';
        try { tdPrioridade.appendChild(controleExecucao); } catch (_) {}
      } else {
        tdPrioridade.textContent = prioridadeTexto;
      }
      tdPrioridade.dataset.atpPrioridadeNula = prioridadeNula ? '1' : '0';
      tdPrioridade.dataset.atpPrioridadeTexto = prioridadeBruta || '';
      tdPrioridade.title = thPrioridade.title;
      if (prioridadeNula) delete tdPrioridade.dataset.atpPrioridadeNum;
      else tdPrioridade.dataset.atpPrioridadeNum = String(prioridadeNum);

      const tdsSemPrioridade = Array.from(tr.querySelectorAll(':scope > td')).filter((td) => td !== tdPrioridade);
      const ancoraTd = tdsSemPrioridade[indiceNumero + 1] || null;
      if (tdPrioridade.parentNode !== tr || tdPrioridade.nextSibling !== ancoraTd) {
        try { tr.insertBefore(tdPrioridade, ancoraTd); } catch (_) {}
      }
    });
  });
}

  function findTable() {
    const direct = document.getElementById(window.ATP_TABLE_ID || 'tableAutomatizacaoLocalizadores');
    if (direct) return direct;
    const candidates = Array.from(document.querySelectorAll('table'));
    const wanted = [
      /n[ºo]\s*\/?\s*prioridade/i,
      /localizador.*remover/i,
      /tipo.*(controle|crit[ée]rio)/i,
      /localizador.*(incluir|a[cç][aã]o)/i,
      /outros\s*crit[ée]rios/i
    ];
    let best = null;
    let bestScore = 0;
    for (const c of candidates) {
      const ths = Array.from((c.tHead || c).querySelectorAll('th'));
      if (!ths.length) continue;
      const text = ths.map(th => clean(th.textContent)).join(' | ');
      const score = wanted.reduce((acc, re) => acc + (re.test(text) ? 1 : 0), 0);
      if (score > bestScore) { best = c; bestScore = score; }
    }
    return (bestScore >= 3) ? best : null;
  }

function atpCollectUnitMetrics(rules, conflictsByRule) {
  const safeRules = Array.isArray(rules) ? rules : [];
  const safeConflicts = (conflictsByRule instanceof Map) ? conflictsByRule : new Map();
  const totalRules = Math.max(1, safeRules.length);
  const cfgExec = (typeof ATP_CONFIG === 'object' && ATP_CONFIG && ATP_CONFIG.notaExecucao) ? ATP_CONFIG.notaExecucao : { pesosConflito: { 'Colisão Total': 3, 'Colisão Parcial': 2, 'Sobreposição': 1 }, pseudoAcertos: 1, pseudoErros: 1 };
  const weightMap = cfgExec.pesosConflito || { 'Colisão Total': 3, 'Colisão Parcial': 2, 'Sobreposição': 1 };
  let totalRisk = 0;
  for (const [, mapB] of safeConflicts.entries()) {
    let maxW = 0;
    for (const rec of Array.from(mapB.values())) {
      for (const t of Array.from(rec?.tipos || [])) {
        const w = weightMap[t] || 0;
        if (w > maxW) maxW = w;
      }
    }
    totalRisk += maxW;
  }
  const cap = 3 * totalRules;
  const execRaw = Math.max(0, Math.min(1, 1 - (totalRisk / cap)));
  // Ajuste amostral objetivo (sem parâmetros): suavização de Laplace.
  // Com poucas regras, evita extremos artificiais; com muitas, converge para execRaw.
  const observedAcertos = execRaw * totalRules;
  const execAdj = (observedAcertos + 1) / (totalRules + 2);
  const execRawScore = Math.round(execRaw * 10 * 10) / 10;
  let execScore = Math.round(execAdj * 10 * 10) / 10;
  // Consistência de exibição: se bruto mostra 10,0, não exibir ajustada abaixo de 10,0.
  if (execRawScore >= 10) execScore = 10;
  const isManualTriggerRule = (r) => {
    try {
      const tipoTxt = String(exprCanon(r?.tipoControleCriterio, '') || '').toLowerCase();
      return /acao\s+manual|a[cç][aã]o\s+manual/.test(tipoTxt);
    } catch (_) {
      return false;
    }
  };
  const normalizeLocTerm = (raw) => String(raw || '').trim();
  const canonicalSystemMatcher = (() => {
    const cfg = (typeof ATP_CONFIG === 'object' && ATP_CONFIG && ATP_CONFIG.localizadoresSistema) ? ATP_CONFIG.localizadoresSistema : {};
    // Regra estrita: comparação textual direta (sem normalização semântica).
    const normKey = (s) => String(s || '').trim();
    const idsSet = new Set((Array.isArray(cfg.ids) ? cfg.ids : []).map((v) => String(v || '').trim()).filter(Boolean));
    const sigSet = new Set((Array.isArray(cfg.nomes) ? cfg.nomes : []).map((v) => normKey(v)).filter(Boolean));
    const descSet = new Set((Array.isArray(cfg.descricoes) ? cfg.descricoes : []).map((v) => normKey(v)).filter(Boolean));
    const parSet = new Set((Array.isArray(cfg.nomes) ? cfg.nomes : []).map((sigla, i) => {
      const desc = (Array.isArray(cfg.descricoes) ? cfg.descricoes : [])[i];
      if (!sigla || !desc) return '';
      return normKey(`${sigla} - ${desc}`);
    }).filter(Boolean));
    const optionMeta = (() => {
      const m = new Map();
      try {
        const sel = document.getElementById('selLocalizadorInclui');
        if (!sel) return m;
        Array.from(sel.querySelectorAll('option')).forEach((opt) => {
          const id = String(opt?.value || '').trim();
          const txt = String(opt?.textContent || '').trim();
          if (!id || id === 'null' || !txt) return;
          const nk = normKey(txt);
          m.set(nk, { id });
        });
      } catch (_) {}
      return m;
    })();
    const isSystemLabel = (label) => {
      const nk = normKey(label);
      if (!nk) return false;
      const meta = optionMeta.get(nk);
      if (meta && meta.id && idsSet.has(String(meta.id))) return true;
      if (parSet.has(nk) || sigSet.has(nk) || descSet.has(nk)) return true;
      return false;
    };
    const isSystemId = (id) => idsSet.has(String(id || '').trim());
    return { normKey, isSystemLabel, isSystemId };
  })();
  const splitOuFallback = (txt) => String(txt || '')
    .split(/\s*\|\|\s*|\s+\bOU\b\s+/i)
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  const isTodosLocalizadoresToken = (txt) => {
    const s = String(txt || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    return s === 'todos os localizadores' || s === 'todos localizadores';
  };
  const collectExprTokenSet = (expr, normalizer) => {
    const out = new Set();
    try {
      const clauses = Array.isArray(expr?.clauses) ? expr.clauses : [];
      for (const clause of clauses) {
        if (!(clause instanceof Set)) continue;
        for (const raw of clause) {
          const t = normalizer(raw);
          if (!t || t === '[*]' || t === 'E' || t === 'OU') continue;
          const vals = splitOuFallback(t);
          (vals.length ? vals : [t]).forEach((v) => {
            if (!v || v === '[*]' || v === 'E' || v === 'OU') return;
            out.add(v);
          });
        }
      }
    } catch (_) {}
    return out;
  };
  const rawLocToken = (raw) => String(raw || '').trim();
  const overlapIgnoreForRule = (r, normalizer) => {
    const inc = collectExprTokenSet(r?.localizadorIncluirAcao, normalizer);
    if (!inc.size) return new Set();
    const rem = collectExprTokenSet(r?.localizadorRemover, normalizer);
    if (!rem.size) return new Set();
    const out = new Set();
    inc.forEach((k) => { if (rem.has(k)) out.add(k); });
    return out;
  };
  const isAppendOnlyRemoveRule = (r) => {
    try {
      const normalizeTxt = (v) => String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const isAppendMark = (txtRaw) => {
        const txt = normalizeTxt(txtRaw);
        return /nao\s*remover/.test(txt) && /apenas\s*acrescentar/.test(txt);
      };
      const canon = String(exprCanon(r?.comportamentoRemover, '') || '');
      if (isAppendMark(canon)) return true;
      const rawComp = String(r?.comportamentoRemover?.raw || r?.comportamentoRemover || '');
      if (isAppendMark(rawComp)) return true;
      const trTxt = String(r?.tr?.innerText || r?.tr?.textContent || '');
      if (isAppendMark(trTxt)) return true;
      return false;
    } catch (_) {
      return false;
    }
  };
  const removerUsageCountAll = (() => {
    const map = new Map();
    for (const r of safeRules) {
      if (isManualTriggerRule(r)) continue;
      const toks = collectExprTokenSet(r?.localizadorRemover, rawLocToken);
      toks.forEach((k) => map.set(k, (map.get(k) || 0) + 1));
    }
    return map;
  })();
  const removerUsageCountNonAppend = (() => {
    const map = new Map();
    for (const r of safeRules) {
      if (isManualTriggerRule(r)) continue;
      if (isAppendOnlyRemoveRule(r)) continue;
      const toks = collectExprTokenSet(r?.localizadorRemover, rawLocToken);
      const ignoreOverlap = overlapIgnoreForRule(r, rawLocToken);
      toks.forEach((k) => {
        // Conta apenas uso efetivo em REMOVER (já descontando sobreposição INCLUIR=REMOVER na mesma regra).
        if (ignoreOverlap.has(k)) return;
        map.set(k, (map.get(k) || 0) + 1);
      });
    }
    return map;
  })();
  const appendOnlyExclusiveIgnoreForRule = (r) => {
    if (!isAppendOnlyRemoveRule(r)) return new Set();
    const toks = collectExprTokenSet(r?.localizadorRemover, rawLocToken);
    const out = new Set();
    toks.forEach((k) => {
      const nonAppend = removerUsageCountNonAppend.get(k) || 0;
      // Ignora no REMOVER tudo que só existe em regras "Não remover; Apenas acrescentar",
      // mesmo que apareça em mais de uma regra append-only.
      if (nonAppend === 0) out.add(k);
    });
    return out;
  };
  const incluirDistinct = (() => {
    const set = new Set();
    const normalizeTerm = (raw) => rawLocToken(raw);
    const addFromExpr = (expr) => {
      try {
        const clauses = Array.isArray(expr?.clauses) ? expr.clauses : [];
        for (const clause of clauses) {
          if (!(clause instanceof Set)) continue;
          for (const raw of clause) {
            const t = normalizeTerm(raw);
            if (!t) continue;
            const parts = splitOuFallback(t);
            const vals = parts.length ? parts : [t];
            vals.forEach((v) => {
              if (!v || v === '[*]' || v === 'E' || v === 'OU') return;
              set.add(v);
            });
          }
        }
      } catch (_) {}
    };
    for (const r of safeRules) {
      const ignore = overlapIgnoreForRule(r, normalizeTerm);
      const before = new Set(set);
      addFromExpr(r?.localizadorIncluirAcao);
      if (ignore.size) ignore.forEach((k) => set.delete(k));
      // re-add previous values in case delete removed keys from earlier non-overlap rules
      if (ignore.size) before.forEach((k) => set.add(k));
      // now add this rule again excluding ignored keys
      try {
        const tmp = collectExprTokenSet(r?.localizadorIncluirAcao, normalizeTerm);
        tmp.forEach((k) => { if (!ignore.has(k)) set.add(k); });
      } catch (_) {}
    }
    return set.size;
  })();
  const removerDistinct = (() => {
    // Distinto por ramo lógico (AND). OR só agrega ramos já existentes.
    // Ex.: "A OU B" não cria novo se já existem "A" e "B";
    //      "A E B" cria novo ramo distinto.
    const clauseKeys = new Set();
    const normalizeTerm = (raw) => rawLocToken(raw);
    const addFromExpr = (expr) => {
      try {
        const clauses = Array.isArray(expr?.clauses) ? expr.clauses : [];
        for (const clause of clauses) {
          if (!(clause instanceof Set)) continue;
          const expanded = [];
          Array.from(clause).forEach((raw) => {
            const t = normalizeTerm(raw);
            if (!t) return;
            // Fallback para casos em que OU/E veio "colado" no termo por markup imperfeito.
            const parts = splitOuFallback(t);
            if (parts.length > 1) expanded.push(...parts);
            else expanded.push(t);
          });
          const terms = expanded
            .filter((t) => t && t !== '[*]' && t !== 'E' && t !== 'OU' && !isTodosLocalizadoresToken(t))
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
          if (!terms.length) continue;
          clauseKeys.add(terms.join(' && '));
        }
      } catch (_) {}
    };
    for (const r of safeRules) {
      if (isManualTriggerRule(r)) continue;
      const ignore = overlapIgnoreForRule(r, normalizeTerm);
      const ignoreAppend = appendOnlyExclusiveIgnoreForRule(r);
      const ignoreAll = new Set([...ignore, ...ignoreAppend]);
      try {
        const clauses = Array.isArray(r?.localizadorRemover?.clauses) ? r.localizadorRemover.clauses : [];
        for (const clause of clauses) {
          if (!(clause instanceof Set)) continue;
          const expanded = [];
          Array.from(clause).forEach((raw) => {
            const t = normalizeTerm(raw);
            if (!t) return;
            const parts = splitOuFallback(t);
            if (parts.length > 1) expanded.push(...parts);
            else expanded.push(t);
          });
          const terms = expanded
            .filter((t) => t && t !== '[*]' && t !== 'E' && t !== 'OU' && !ignoreAll.has(t) && !isTodosLocalizadoresToken(t))
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
          if (!terms.length) continue;
          clauseKeys.add(terms.join(' && '));
        }
      } catch (_) {
        addFromExpr(r?.localizadorRemover);
      }
    }
    return clauseKeys.size;
  })();
  const incluirSemRemover = (() => {
    const normKey = (raw) => rawLocToken(raw);
    const auditKey = (s) => String(s || '').trim();
    const incluirMap = new Map(); // key -> label original
    const removerMap = new Map(); // key -> label original
    const removerSet = new Set();
    const overlapUsedSet = new Set(); // chaves em sobreposição INCLUIR=REMOVER na mesma regra (uso real, mas fora dos distintos)
    const appendOnlyIgnoredSet = new Set(); // chaves usadas só como referência em REMOVER append-only
    const incluirRulesByKey = new Map(); // key -> Set<numRegra>
    const removerRulesByKey = new Map(); // key -> Set<numRegra>
    const provavelFixoMap = new Map(); // key -> {label, rules:Set}
    const appendOnlyRuleNums = new Set();
    const errorLocSet = new Set(); // localizadores usados apenas como "Localizador de Erro"
    const errorLocEvidence = new Map(); // matchKey -> { raws:Set, rules:Set, sources:Set }
    const addTerms = (expr, sinkMap, sinkSet, sinkRulesByKey, ruleNum, ignoreSet) => {
      try {
        const clauses = Array.isArray(expr?.clauses) ? expr.clauses : [];
        for (const clause of clauses) {
          if (!(clause instanceof Set)) continue;
          for (const raw of clause) {
            const txt = String(raw || '').trim();
            if (!txt || txt === '[*]' || txt === 'E' || txt === 'OU') continue;
            const parts = splitOuFallback(txt);
            const vals = parts.length ? parts : [txt];
            vals.forEach((v) => {
              const k = normKey(v);
              if (!k) return;
              if (ignoreSet && ignoreSet.has(k)) return;
              if (sinkMap) { if (!sinkMap.has(k)) sinkMap.set(k, v); }
              if (sinkSet) sinkSet.add(k);
              if (sinkRulesByKey) {
                if (!sinkRulesByKey.has(k)) sinkRulesByKey.set(k, new Set());
                if (ruleNum) sinkRulesByKey.get(k).add(String(ruleNum));
              }
            });
          }
        }
      } catch (_) {}
    };
    for (const r of safeRules) {
      const ignore = overlapIgnoreForRule(r, normKey);
      ignore.forEach((k) => overlapUsedSet.add(k));
      addTerms(r?.localizadorIncluirAcao, incluirMap, null, incluirRulesByKey, r?.num, ignore);
      try {
        const acoes = (r?.localizadorIncluirAcao && Array.isArray(r.localizadorIncluirAcao.acoes)) ? r.localizadorIncluirAcao.acoes : [];
        const extractErrorLocsFromText = (txtRaw) => {
          const out = [];
          const txt = String(txtRaw || '');
          if (!txt) return out;
          const re = /localizador\s+de\s+erro\s*(?:[:=]\s*|-\s*|\s+)([^|;\n]+)/ig;
          let m;
          while ((m = re.exec(txt))) {
            const chunk = String(m[1] || '').trim();
            if (!chunk) continue;
            chunk.split(/\s+\bOU\b\s+|[,;]/i).map((p) => String(p || '').trim()).filter(Boolean).forEach((p) => out.push(p));
          }
          return out;
        };
        const addErrorToken = (p, source) => {
          const k = normKey(p);
          const mk = auditKey(p);
          if (k) errorLocSet.add(k);
          if (!mk) return;
          if (!errorLocEvidence.has(mk)) errorLocEvidence.set(mk, { raws: new Set(), rules: new Set(), sources: new Set() });
          const ev = errorLocEvidence.get(mk);
          ev.raws.add(String(p || '').trim());
          if (r?.num != null) ev.rules.add(String(r.num));
          if (source) ev.sources.add(String(source));
        };
        for (const a of acoes) {
          // Caso 1: o próprio nome da ação já traz "Localizador de Erro: X".
          extractErrorLocsFromText(a?.acao || '').forEach((p) => addErrorToken(p, 'acao.texto'));
          const vars = Array.isArray(a?.vars) ? a.vars : [];
          for (const v of vars) {
            const nRaw = String(v?.nome || '');
            const n = nRaw
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toUpperCase();
            const vRaw = String(v?.valor || '');
            // Caso 2: nome da variável explícito como localizador de erro.
            if (/LOCALIZADOR/.test(n) && /ERRO/.test(n)) {
              const vv = vRaw.trim();
              if (vv) {
                const parts = vv.split(/\s+\bOU\b\s+/i).map((p) => String(p || '').trim()).filter(Boolean);
                (parts.length ? parts : [vv]).forEach((p) => {
                  addErrorToken(p, 'var.nome+valor');
                });
              }
            }
            // Caso 3: texto de valor já carrega "Localizador de Erro: X".
            extractErrorLocsFromText(vRaw).forEach((p) => addErrorToken(p, 'var.valor.texto'));
            // Caso 4: nome da variável contém a dica e valor simples.
            if (/LOCALIZADOR/.test(n) && /ERRO/.test(n) && vRaw) {
              addErrorToken(vRaw, 'var.nomeErro.valorDireto');
            }
          }
        }
        // Fallback: usa o texto bruto já extraído da coluna INCLUIR da regra.
        try {
          const rawTxt = String(r?.tdIncluirRawTexto || '');
          extractErrorLocsFromText(rawTxt).forEach((p) => addErrorToken(p, 'tdIncluir.textoBruto'));
        } catch (_) {}
      } catch (_) {}
      if (isAppendOnlyRemoveRule(r)) {
        if (r?.num != null) appendOnlyRuleNums.add(String(r.num));
        const toks = collectExprTokenSet(r?.localizadorIncluirAcao, normKey);
        toks.forEach((k) => {
          if (!provavelFixoMap.has(k)) {
            const lbl = incluirMap.get(k) || k;
            provavelFixoMap.set(k, { label: lbl, rules: new Set() });
          }
          if (r?.num != null) provavelFixoMap.get(k).rules.add(String(r.num));
        });
      }
    }
    for (const r of safeRules) {
      if (isManualTriggerRule(r)) continue;
      const ignore = overlapIgnoreForRule(r, normKey);
      ignore.forEach((k) => overlapUsedSet.add(k));
      const ignoreAppend = appendOnlyExclusiveIgnoreForRule(r);
      ignoreAppend.forEach((k) => appendOnlyIgnoredSet.add(k));
      const ignoreAll = new Set([...ignore, ...ignoreAppend]);
      addTerms(r?.localizadorRemover, removerMap, removerSet, removerRulesByKey, r?.num, ignoreAll);
    }
    // "Todos os localizadores" é curinga semântico e não deve entrar como localizador nominal.
    Array.from(removerSet.values()).forEach((k) => {
      if (!isTodosLocalizadoresToken(k)) return;
      removerSet.delete(k);
      removerMap.delete(k);
      removerRulesByKey.delete(k);
    });
    const normClassKey = canonicalSystemMatcher.normKey;
    const isSystemByCatalog = canonicalSystemMatcher.isSystemLabel;
    const classifyLocType = (label) => {
      const s = String(label || '').trim();
      if (!s) return 'unidade';
      return isSystemByCatalog(s) ? 'sistema' : 'unidade';
    };
    const ruleHasConclusosAlteracao = (r) => {
      try {
        const acoes = (r?.localizadorIncluirAcao && Array.isArray(r.localizadorIncluirAcao.acoes)) ? r.localizadorIncluirAcao.acoes : [];
        for (const a of acoes) {
          const nome = String(a?.acao || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
          const isAlterarSituacao = /ALTERAR/.test(nome) && /SITUACAO/.test(nome);
          const isEventoConcluso = /EVENTO/.test(nome);
          const hasConclusosNoNome = /CONCLUSAO|CONCLUSOS|CONCLUSO/.test(nome);
          if (!isAlterarSituacao && !isEventoConcluso) continue;
          // Caso comum: texto já traz o destino no próprio nome da ação/evento.
          if (hasConclusosNoNome) return true;
          const vars = Array.isArray(a?.vars) ? a.vars : [];
          const hasConclusos = vars.some((v) => {
            const vv = String(v?.valor || v?.nome || '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toUpperCase();
            return /CONCLUSAO|CONCLUSOS|CONCLUSO/.test(vv);
          });
          if (hasConclusos) return true;
        }
      } catch (_) {}
      return false;
    };
    const only = Array.from(incluirMap.entries())
      .filter(([k]) => !removerSet.has(k))
      .map(([, v]) => v)
      .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    const incluirOnlyRows = Array.from(incluirMap.entries())
      .filter(([k]) => !removerSet.has(k))
      .map(([k, v]) => ({
        key: k,
        label: v,
        tipo: classifyLocType(v),
        incluirRules: Array.from(incluirRulesByKey.get(k) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'))
      }))
      .map((row) => {
        const fixo = (row.incluirRules || []).some((num) => appendOnlyRuleNums.has(String(num)));
        const gab = (row.incluirRules || []).some((num) => ruleHasConclusosAlteracao(safeRules.find((r) => String(r?.num || '') === String(num))));
        // Quando há "conclusos", classifica como gabinete mesmo em regra append-only.
        const classeFluxo = gab
          ? 'Provável Gabinete'
          : (fixo ? 'Provável Fixo' : 'Provável Cumprimento');
        return { ...row, classeFluxo };
      })
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    const removerOnlyRows = Array.from(removerMap.entries())
      .filter(([k]) => !incluirMap.has(k))
      .map(([k, v]) => ({
        key: k,
        label: v,
        tipo: classifyLocType(v),
        removerRules: Array.from(removerRulesByKey.get(k) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')),
        classeFluxo: (classifyLocType(v) === 'sistema') ? 'Sistema' : 'Provável Passagem'
      }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    const splitCount = (rows) => ({
      sistema: rows.filter((r) => r.tipo === 'sistema').length,
      unidade: rows.filter((r) => r.tipo !== 'sistema').length
    });
    const incluirOnlyCountByType = splitCount(incluirOnlyRows);
    const removerOnlyCountByType = splitCount(removerOnlyRows);
    const provavelFixoRows = Array.from(provavelFixoMap.entries())
      .map(([k, v]) => ({
        key: k,
        label: v.label,
        tipo: classifyLocType(v.label),
        rules: Array.from(v.rules || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'))
      }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    const provavelFixoCountByType = splitCount(provavelFixoRows);
    const incluirOnlyGabineteCount = incluirOnlyRows.filter((r) => r.classeFluxo === 'Provável Gabinete').length;
    const incluirOnlyFixoCount = incluirOnlyRows.filter((r) => r.classeFluxo === 'Provável Fixo').length;
    const incluirOnlyCumprimentoCount = incluirOnlyRows.filter((r) => r.classeFluxo === 'Provável Cumprimento').length;
    let provavelPassagemCount = 0;
    const errorMatchSet = new Set(Array.from(errorLocSet.values()).map((k) => auditKey(k)));
    const isErrorLike = (k) => {
      if (!k) return false;
      if (/\bERRO\b/.test(k)) return true;
      if (errorMatchSet.has(k)) return true;
      for (const ek of errorMatchSet) {
        if (!ek) continue;
        if (k.includes(ek) || ek.includes(k)) return true;
      }
      return false;
    };
    const unidadeDisponiveisSemUsoRows = (() => {
      const out = [];
      try {
        const sel = document.getElementById('selLocalizadorInclui');
        if (!sel) return { out };
        const used = new Set([...Array.from(incluirMap.keys()), ...Array.from(removerSet.values())].map((k) => auditKey(k)));
        const opts = Array.from(sel.querySelectorAll('option'));
        const seen = new Set();
        for (const opt of opts) {
          const txt = String(opt?.textContent || '').trim();
          const val = String(opt?.value || '').trim();
          if (!txt || !val || val === 'null') continue;
          // Regra rígida: se option for sistema no matcher canônico, nunca entra em minuta manual.
          if (canonicalSystemMatcher.isSystemId(val) || isSystemByCatalog(txt)) continue;
          // Regra de catálogo: se classificar como sistema, nunca entra em minuta manual.
          if (classifyLocType(txt) !== 'unidade') continue;
          const kRaw = normKey(txt);
          const k = auditKey(txt);
          if (!k || used.has(k) || seen.has(val)) continue;
          seen.add(val);
          if (isErrorLike(k)) continue; // localizador de erro não entra em minuta manual
          out.push({ key: kRaw, label: txt, id: val, classeFluxo: 'Localizadores Manuais' });
        }
      } catch (_) {}
      return {
        out: out.sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'))
      };
    })();
    const unitClosure = (() => {
      const res = {
        base: 0,
        incluirSemRemover: 0,
        removerSemIncluir: 0,
        concomitantes: 0,
        manuais: 0,
        debug: {
          baseUnitCount: 0,
          usedUnionCount: 0,
          manuaisComplementCount: 0,
          incluirRawCount: 0,
          removerRawCount: 0,
          concomitantesRawCount: 0,
          baseUnitSample: [],
          usedUnionSample: [],
          manuaisComplementSample: []
        }
      };
      try {
        const sel = document.getElementById('selLocalizadorInclui');
        if (!sel) return res;
        const incluirRawCount = incluirMap.size;
        const removerRawCount = removerSet.size;
        const concomitanteSet = new Set(Array.from(incluirMap.keys()).filter((k) => removerSet.has(k)));
        const overlapRawCount = concomitanteSet.size;
        const usedUnionSet = new Set([...Array.from(incluirMap.keys()), ...Array.from(removerSet.values())]);
        const seen = new Set();
        const baseUnitList = [];
        const manuaisComplementList = [];
        const opts = Array.from(sel.querySelectorAll('option'));
        for (const opt of opts) {
          const txt = String(opt?.textContent || '').trim();
          const val = String(opt?.value || '').trim();
          if (!txt || !val || val === 'null') continue;
          if (canonicalSystemMatcher.isSystemId(val) || isSystemByCatalog(txt)) continue;
          if (classifyLocType(txt) !== 'unidade') continue;
          if (seen.has(val)) continue;
          seen.add(val);
          res.base += 1;
          baseUnitList.push(txt);
          if (!usedUnionSet.has(txt)) manuaisComplementList.push(txt);
        }
        // Fechamento bruto: sem normalização semântica, por interseção textual exata.
        res.concomitantes = overlapRawCount;
        res.incluirSemRemover = Math.max(0, incluirRawCount - overlapRawCount);
        res.removerSemIncluir = Math.max(0, removerRawCount - overlapRawCount);
        res.manuais = Math.max(0, res.base - (res.incluirSemRemover + res.removerSemIncluir + res.concomitantes));
        res.debug.baseUnitCount = baseUnitList.length;
        res.debug.usedUnionCount = usedUnionSet.size;
        res.debug.manuaisComplementCount = manuaisComplementList.length;
        res.debug.incluirRawCount = incluirRawCount;
        res.debug.removerRawCount = removerRawCount;
        res.debug.concomitantesRawCount = overlapRawCount;
        res.debug.baseUnitSample = baseUnitList.slice(0, 20);
        res.debug.usedUnionSample = Array.from(usedUnionSet).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')).slice(0, 20);
        res.debug.manuaisComplementSample = manuaisComplementList.slice(0, 20);
      } catch (_) {}
      return res;
    })();
    const unitAuditRows = (() => {
      const out = [];
      try {
        const sel = document.getElementById('selLocalizadorInclui');
        if (!sel) return out;
        const seen = new Set();
        const opts = Array.from(sel.querySelectorAll('option'));
        for (const opt of opts) {
          const label = String(opt?.textContent || '').trim();
          const id = String(opt?.value || '').trim();
          if (!label || !id || id === 'null') continue;
          if (seen.has(id)) continue;
          seen.add(id);
          if (canonicalSystemMatcher.isSystemId(id) || isSystemByCatalog(label)) continue;
          if (classifyLocType(label) !== 'unidade') continue;
          const key = auditKey(label);
          const incluirRules = Array.from(incluirRulesByKey.get(key) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'));
          const removerRules = Array.from(removerRulesByKey.get(key) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'));
          const inInc = incluirMap.has(key);
          const inRem = removerSet.has(key);
          let classe = 'Manual';
          if (inInc && inRem) classe = 'Concomitante';
          else if (inInc) classe = 'Somente INCLUIR';
          else if (inRem) classe = 'Somente REMOVER';
          else if (isErrorLike(key)) classe = 'Erro somente';
          out.push({ id, label, key, classe, incluirRules, removerRules });
        }
      } catch (_) {}
      return out.sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    })();
    // Fonte única para fechamento da matriz: classificação por localizador auditado (catálogo da unidade).
    try {
      const cConcomitante = unitAuditRows.filter((r) => r.classe === 'Concomitante').length;
      const cSomenteIncluir = unitAuditRows.filter((r) => r.classe === 'Somente INCLUIR').length;
      const cSomenteRemover = unitAuditRows.filter((r) => r.classe === 'Somente REMOVER').length;
      const cManualOuErro = unitAuditRows.filter((r) => r.classe === 'Manual' || r.classe === 'Erro somente').length;
      // Usa a mesma base auditada de "Somente REMOVER" para a leitura de "Provável Passagem".
      provavelPassagemCount = cSomenteRemover;
      unitClosure.concomitantes = cConcomitante;
      unitClosure.incluirSemRemover = cSomenteIncluir;
      unitClosure.removerSemIncluir = cSomenteRemover;
      unitClosure.manuais = cManualOuErro;
      if (unitClosure && unitClosure.debug) {
        unitClosure.debug.concomitantesByAudit = cConcomitante;
        unitClosure.debug.incluirSemRemoverByAudit = cSomenteIncluir;
        unitClosure.debug.removerSemIncluirByAudit = cSomenteRemover;
        unitClosure.debug.manuaisByAudit = cManualOuErro;
      }
    } catch (_) {}
    const concomitantesRowsAll = Array.from(incluirMap.entries())
      .filter(([k]) => removerSet.has(k))
      .map(([k, v]) => {
        const label = String(v || removerMap.get(k) || k);
        return {
          key: k,
          label,
          tipo: classifyLocType(label),
          incluirRules: Array.from(incluirRulesByKey.get(k) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')),
          removerRules: Array.from(removerRulesByKey.get(k) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'))
        };
      })
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    const concomitantesRows = concomitantesRowsAll.filter((r) => r.tipo !== 'sistema');
    const overlapCount = concomitantesRows.length;
    const errorLocDetectedRows = Array.from(errorLocEvidence.entries())
      .map(([matchKey, ev]) => ({
        matchKey,
        label: Array.from(ev.raws || [matchKey])[0] || matchKey,
        rules: Array.from(ev.rules || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')),
        sources: Array.from(ev.sources || []).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
      }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    const incluirByMatch = (() => {
      const m = new Map();
      incluirMap.forEach((_v, k) => {
        const mk = auditKey(k);
        if (!mk) return;
        if (!m.has(mk)) m.set(mk, new Set());
        const ids = incluirRulesByKey.get(k) || new Set();
        ids.forEach((id) => m.get(mk).add(String(id)));
      });
      return m;
    })();
    const removerByMatch = (() => {
      const m = new Map();
      removerMap.forEach((_v, k) => {
        const mk = auditKey(k);
        if (!mk) return;
        if (!m.has(mk)) m.set(mk, new Set());
        const ids = removerRulesByKey.get(k) || new Set();
        ids.forEach((id) => m.get(mk).add(String(id)));
      });
      return m;
    })();
    const errorLocFlowRows = errorLocDetectedRows
      .map((r) => ({
        ...r,
        tipo: classifyLocType(r.label),
        incluirRules: Array.from(incluirByMatch.get(r.matchKey) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')),
        removerRules: Array.from(removerByMatch.get(r.matchKey) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'))
      }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    const unidadeErroRows = errorLocFlowRows
      .filter((r) => r.tipo === 'unidade')
      .map((r) => ({
        ...r,
        classeFluxo: (!r.incluirRules.length && !r.removerRules.length) ? 'Somente Localizador de Erro' : 'Erro + uso em fluxo'
      }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    // Regra única: "Erro somente" só existe quando não há nenhuma ocorrência em INCLUIR/REMOVER
    // na auditoria por localizador (fonte de verdade da matriz/fechamento).
    const unidadeErroOnlyRows = unitAuditRows
      .filter((r) => r.classe === 'Erro somente' && !r.incluirRules.length && !r.removerRules.length)
      .map((r) => ({ label: r.label, id: r.id, incluirRules: [], removerRules: [] }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    // Fonte de verdade operacional: "Manuais/Erro" do fechamento deve refletir exatamente
    // a lista detalhada de localizadores sem uso efetivo (manuais + erro somente).
    try {
      unitClosure.manuais = Number(unidadeDisponiveisSemUsoRows.out.length || 0) + Number(unidadeErroOnlyRows.length || 0);
      if (unitClosure && unitClosure.debug) {
        unitClosure.debug.manuaisByDetailedList = unitClosure.manuais;
      }
    } catch (_) {}
    const removerSystemRows = Array.from(removerMap.entries())
      .filter(([, v]) => isSystemByCatalog(v))
      .map(([k, v]) => ({
        key: k,
        label: v,
        tipo: 'sistema',
        removerRules: Array.from(removerRulesByKey.get(k) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'))
      }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));
    const sample = (arr, n) => arr.slice(0, n);
    let alvo = null;
    try {
      const alvoFromLocal =
        (typeof ATP_CONFIG === 'object' && ATP_CONFIG && ATP_CONFIG.debugLocalizadorAlvo != null)
          ? ATP_CONFIG.debugLocalizadorAlvo
          : '';
      const alvoFromWindow =
        (typeof window !== 'undefined' && window && window.ATP_CONFIG && window.ATP_CONFIG.debugLocalizadorAlvo != null)
          ? window.ATP_CONFIG.debugLocalizadorAlvo
          : '';
      const alvoRawCfg = String(alvoFromLocal || alvoFromWindow || '').trim();
      if (alvoRawCfg) {
        const alvoKey = normKey(alvoRawCfg);
        const incRules = Array.from(incluirRulesByKey.get(alvoKey) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'));
        const remRules = Array.from(removerRulesByKey.get(alvoKey) || []).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'));
        const similaresIncluir = Array.from(incluirMap.keys()).filter((k) => k.includes(alvoKey) || alvoKey.includes(k)).slice(0, 15);
        const similaresRemover = Array.from(removerSet.values()).filter((k) => k.includes(alvoKey) || alvoKey.includes(k)).slice(0, 15);
        alvo = {
          raw: alvoRawCfg,
          key: alvoKey,
          inIncluir: incluirMap.has(alvoKey),
          inRemover: removerSet.has(alvoKey),
          incluirRules: incRules,
          removerRules: remRules,
          similaresIncluir,
          similaresRemover
        };
      }
    } catch (_) {}
    return {
      count: only.length,
      items: only,
      incluirOnlyRows,
      removerOnlyRows,
      provavelFixoRows,
      unidadeDisponiveisSemUsoRows: unidadeDisponiveisSemUsoRows.out,
      unidadeErroRows,
      unidadeErroOnlyRows,
      removerSystemRows,
      incluirOnlyCountByType,
      removerOnlyCountByType,
      provavelFixoCountByType,
      incluirOnlyGabineteCount,
      incluirOnlyFixoCount,
      incluirOnlyCumprimentoCount,
      provavelPassagemCount,
      concomitantesRows,
      errorLocDetectedCount: errorLocDetectedRows.length,
      errorLocDetectedRows,
      errorLocFlowRows,
      appendOnlyRuleCount: appendOnlyRuleNums.size,
      appendOnlyRuleNums: Array.from(appendOnlyRuleNums).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')),
      incluirRawCount: incluirMap.size,
      removerRawCount: removerSet.size,
      overlapCount,
      unitClosure,
      unitAuditRows,
      debug: {
        incluirRawCount: incluirMap.size,
        removerRawCount: removerSet.size,
        overlapCount,
        incluirRawSample: sample(Array.from(incluirMap.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR')), 15),
        removerRawSample: sample(Array.from(removerSet.values()).sort((a, b) => a.localeCompare(b, 'pt-BR')), 15),
        alvo
      }
    };
  })();
  const removerRuleCounts = (() => {
    let sysCount = 0;
    let unitCount = 0;
    const normPlain = (s) => String(s || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const classifyToken = (token) => {
      const s = String(token || '').trim();
      if (!s || s === '[*]' || s === 'E' || s === 'OU') return null;
      return { system: canonicalSystemMatcher.isSystemLabel(s) };
    };
    const availableLocalizerCounts = (() => {
      let total = 0;
      let unit = 0;
      let sys = 0;
      try {
        const sel = document.getElementById('selLocalizadorInclui');
        if (!sel) return { total, unit, sys };
        const opts = Array.from(sel.querySelectorAll('option'));
        for (const opt of opts) {
          const val = String(opt?.value || '').trim();
          const txt = String(opt?.textContent || '').trim();
          if (!val || val === 'null' || !txt) continue;
          total += 1;
          const cls = canonicalSystemMatcher.isSystemId(val)
            ? { system: true }
            : classifyToken(txt);
          if (cls?.system) sys += 1;
          else unit += 1;
        }
      } catch (_) {}
      return { total, unit, sys };
    })();
    const isAllOrNoneToken = (token) => {
      const u = normPlain(token).toUpperCase();
      return /\b(TODOS?|NENHUM)\b/.test(u);
    };
    const outrosHasUnitInContains = (expr) => {
      try {
        const clauses = Array.isArray(expr?.clauses) ? expr.clauses : [];
        for (const clause of clauses) {
          if (!(clause instanceof Set)) continue;
          for (const raw of clause) {
            const txt = String(raw || '');
            const up = normPlain(txt).toUpperCase();
            const isContains = /\b(CONT(E|É)M)\b/.test(up) && /\b(UM|TODOS|NENHUM)\b/.test(up);
            if (!isContains) continue;
            const c = classifyToken(raw);
            if (c && !c.system) return true;
          }
        }
      } catch (_) {}
      return false;
    };
    for (const r of safeRules) {
      const remover = r?.localizadorRemover;
      const clauses = Array.isArray(remover?.clauses) ? remover.clauses : [];
      const isOr = clauses.length > 1;
      const isAnd = clauses.length === 1;
      let ruleIsUnit = false;
      if (!clauses.length) {
        ruleIsUnit = outrosHasUnitInContains(r?.outrosCriterios);
      } else if (isAnd) {
        let anyUnit = false;
        let anyAllNone = false;
        const clause = clauses[0];
        if (clause instanceof Set) {
          for (const raw of clause) {
            const c = classifyToken(raw);
            if (c && !c.system) anyUnit = true;
            if (isAllOrNoneToken(raw)) anyAllNone = true;
          }
        }
        if (anyUnit) ruleIsUnit = true;
        else if (anyAllNone) ruleIsUnit = outrosHasUnitInContains(r?.outrosCriterios);
      } else if (isOr) {
        let allUnit = true;
        let anyAllNone = false;
        for (const clause of clauses) {
          if (!(clause instanceof Set)) continue;
          for (const raw of clause) {
            const c = classifyToken(raw);
            if (!(c && !c.system)) allUnit = false;
            if (isAllOrNoneToken(raw)) anyAllNone = true;
          }
        }
        if (allUnit) ruleIsUnit = true;
        else ruleIsUnit = anyAllNone ? outrosHasUnitInContains(r?.outrosCriterios) : false;
      }
      if (ruleIsUnit) unitCount += 1;
      else sysCount += 1;
    }
    return { sys: sysCount, unit: unitCount, available: availableLocalizerCounts };
  })();
  const actionCounts = (() => {
    let total = 0;
    const distinct = new Set();
    const byName = new Map();
    const byTracked = new Map();
    const normalizeActionName = (txt) => String(txt || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ');
    const trackedActions = [
      'LANÇAR EVENTO AUTOMATIZADO',
      'INCLUIR LEMBRETE',
      'DISTRIBUIR PROCESSOS ENTRE LOCALIZADORES',
      'ALTERAR SITUAÇÃO AUTOMATICAMENTE',
      'ALTERAR SITUAÇÃO DA JUSTIÇA GRATUITA DA PARTE',
      'INSERIR DADO COMPLEMENTAR NO PROCESSO',
      'RETIFICAR AUTUAÇÃO',
      'VERIFICAÇÃO DE DADOS PROCESSUAIS',
      'LANÇAR EVENTO E DOCUMENTO BASEADO EM PREFERÊNCIA DE UNIDADE',
      'PREPARAR MINUTA BASEADA EM PREFERÊNCIA DE UNIDADE',
      'CITAÇÃO POR AR',
      'EXPEDIÇÃO DE MANDADO',
      'EXPEDIÇÃO DE OFÍCIO POR CARTA AR'
    ];
    const trackedMap = new Map(trackedActions.map((name) => [normalizeActionName(name), name]));
    const categoriaContinuidade = new Set([
      normalizeActionName('LANÇAR EVENTO AUTOMATIZADO'),
      normalizeActionName('INCLUIR LEMBRETE'),
      normalizeActionName('DISTRIBUIR PROCESSOS ENTRE LOCALIZADORES'),
      normalizeActionName('ALTERAR SITUAÇÃO AUTOMATICAMENTE'),
      normalizeActionName('ALTERAR SITUAÇÃO DA JUSTIÇA GRATUITA DA PARTE'),
      normalizeActionName('INSERIR DADO COMPLEMENTAR NO PROCESSO'),
      normalizeActionName('RETIFICAR AUTUAÇÃO'),
      normalizeActionName('VERIFICAÇÃO DE DADOS PROCESSUAIS')
    ]);
    const categoriaAndamento = new Set([
      normalizeActionName('LANÇAR EVENTO E DOCUMENTO BASEADO EM PREFERÊNCIA DE UNIDADE'),
      normalizeActionName('PREPARAR MINUTA BASEADA EM PREFERÊNCIA DE UNIDADE'),
      normalizeActionName('CITAÇÃO POR AR'),
      normalizeActionName('EXPEDIÇÃO DE MANDADO'),
      normalizeActionName('EXPEDIÇÃO DE OFÍCIO POR CARTA AR')
    ]);
    const byCategory = new Map([
      ['Continuidade de Triagem', 0],
      ['Andamento Processual', 0],
      ['Outras Ações', 0]
    ]);
    const byRuleCategory = new Map([
      ['Andamento Processual', 0],
      ['Continuidade de Triagem', 0],
      ['Outras Ações', 0],
      ['Sem Ação Programada', 0]
    ]);
    const perRuleCategory = new Map();
    for (const r of safeRules) {
      const acoesAll = (r?.localizadorIncluirAcao && Array.isArray(r.localizadorIncluirAcao.acoes)) ? r.localizadorIncluirAcao.acoes : [];
      let hasAndamento = false;
      let hasContinuidade = false;
      let hasOutra = false;
      for (const a of acoesAll) {
        total += 1;
        const nome = String(a?.acao || '').trim();
        if (nome) {
          const nomeKey = nome.toUpperCase();
          distinct.add(nomeKey);
          byName.set(nome, (byName.get(nome) || 0) + 1);
          const normKey = normalizeActionName(nome);
          if (categoriaContinuidade.has(normKey)) {
            byCategory.set('Continuidade de Triagem', (byCategory.get('Continuidade de Triagem') || 0) + 1);
            hasContinuidade = true;
          } else if (categoriaAndamento.has(normKey)) {
            byCategory.set('Andamento Processual', (byCategory.get('Andamento Processual') || 0) + 1);
            hasAndamento = true;
          } else {
            byCategory.set('Outras Ações', (byCategory.get('Outras Ações') || 0) + 1);
            hasOutra = true;
          }
          const trackedLabel = trackedMap.get(normKey);
          if (trackedLabel) byTracked.set(trackedLabel, (byTracked.get(trackedLabel) || 0) + 1);
        }
      }
      const ruleNum = String(r?.num || '').trim();
      const ruleClass = hasAndamento
        ? 'Andamento Processual'
        : (hasContinuidade
          ? 'Continuidade de Triagem'
          : (acoesAll.length
            ? (hasOutra ? 'Outras Ações' : 'Outras Ações')
            : 'Sem Ação Programada'));
      if (ruleNum) perRuleCategory.set(ruleNum, ruleClass);
      byRuleCategory.set(ruleClass, (byRuleCategory.get(ruleClass) || 0) + 1);
    }
    for (const label of trackedActions) {
      if (!byTracked.has(label)) byTracked.set(label, 0);
    }
    return { total, distinct: distinct.size, byName, byCategory, byTracked, byRuleCategory, perRuleCategory };
  })();
  const outrosCounts = (() => {
    const byField = new Map();
    let rulesWithOutros = 0;
    const labelOutrosKey = (key) => {
      const k = String(key || '').trim().toLowerCase();
      const dict = {
        prazo: 'Prazo',
        classe: 'Classe',
        assunto: 'Assunto',
        entidade: 'Entidade',
        tipoparteentidade: 'Parte Entidade',
        situacaodoprocesso: 'Situação',
        representacaoprocessualdaspartes: 'Representação',
        localizadorquecontenhaaomenosum: 'Localizador (Contenha ao Menos Um)',
        localizadorquecontenhatodos: 'Localizador (Contenha Todos)',
        localizadorquenaocontenhanenhum: 'Localizador Não Contém',
        eventotipodepeticaoquecontenhaocomplemento: 'Evento/Petição (Complemento)',
        dadocomplementar: 'Dado Complementar'
      };
      if (dict[k]) return dict[k];
      return String(key || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([a-z])([0-9])/g, '$1 $2')
        .trim()
        .replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase()) || 'Outros Critérios';
    };
    const extractKey = (term) => {
      const s = String(term || '').trim();
      if (!s || s === '[*]' || s === 'E' || s === 'OU') return '';
      const idxEq = s.indexOf('=');
      const idxColon = s.indexOf(':');
      const idx = (idxEq > 0) ? idxEq : idxColon;
      return String((idx > 0 ? s.slice(0, idx) : s) || '').trim();
    };
    for (const r of safeRules) {
      const uniqueFieldsInRule = new Set();
      const clauses = Array.isArray(r?.outrosCriterios?.clauses) ? r.outrosCriterios.clauses : [];
      for (const clause of clauses) {
        if (!(clause instanceof Set)) continue;
        for (const raw of clause) {
          const key = extractKey(raw);
          if (key) uniqueFieldsInRule.add(labelOutrosKey(key));
        }
      }
      if (uniqueFieldsInRule.size) rulesWithOutros += 1;
      for (const label of uniqueFieldsInRule) {
        byField.set(label, (byField.get(label) || 0) + 1);
      }
    }
    return { rulesWithOutros, byField };
  })();
  const triageCount = (() => {
    let n = 0;
    for (const r of safeRules) {
      const acoesAll = (r?.localizadorIncluirAcao && Array.isArray(r.localizadorIncluirAcao.acoes)) ? r.localizadorIncluirAcao.acoes : [];
      if (!acoesAll.length) n += 1;
    }
    return n;
  })();
  const ioRuleCounts = (() => {
    let incluir = 0;
    let remover = 0;
    let ambos = 0;
    for (const r of safeRules) {
      const incSet = collectExprTokenSet(r?.localizadorIncluirAcao, normalizeLocTerm);
      const remSet = collectExprTokenSet(r?.localizadorRemover, normalizeLocTerm);
      const hasInc = incSet.size > 0;
      const hasRem = remSet.size > 0;
      if (hasInc) incluir += 1;
      if (hasRem) remover += 1;
      if (hasInc && hasRem) ambos += 1;
    }
    return { incluir, remover, ambos };
  })();
  const rulesWithAction = Math.max(0, safeRules.length - triageCount);
  const cfgEstr = (typeof ATP_CONFIG === 'object' && ATP_CONFIG && ATP_CONFIG.notaEstrutural) ? ATP_CONFIG.notaEstrutural : { pesosPositivos: { remover_unidade: 0.55, acoes_total: 0.30, incluir_distintos: 0.15 }, pesosNegativos: { remover_sistema: 0.55, triagem: 0.45 }, escalasPositivas: { remover_unidade: 250, acoes_total: 180, incluir_distintos: 70 }, escalasNegativas: { remover_sistema: 120, triagem: 160 }, penalidadeNegativa: 0.35 };
  const satScale = (value, scale) => 1 - Math.exp(-Math.max(0, Number(value) || 0) / Math.max(1, Number(scale) || 1));
  const positivoEstrutural =
    (Number(cfgEstr.pesosPositivos?.remover_unidade) || 0) * satScale(removerRuleCounts.unit, cfgEstr.escalasPositivas?.remover_unidade) +
    (Number(cfgEstr.pesosPositivos?.acoes_total) || 0) * satScale(actionCounts.total, cfgEstr.escalasPositivas?.acoes_total) +
    (Number(cfgEstr.pesosPositivos?.incluir_distintos) || 0) * satScale(incluirDistinct, cfgEstr.escalasPositivas?.incluir_distintos);
  const negativoEstrutural =
    (Number(cfgEstr.pesosNegativos?.remover_sistema) || 0) * satScale(removerRuleCounts.sys, cfgEstr.escalasNegativas?.remover_sistema) +
    (Number(cfgEstr.pesosNegativos?.triagem) || 0) * satScale(triageCount, cfgEstr.escalasNegativas?.triagem);
  const estrutRatio = Math.max(0, Math.min(1, positivoEstrutural - (Number(cfgEstr.penalidadeNegativa) || 0) * negativoEstrutural));
  const estrutScore = Math.round(estrutRatio * 10 * 10) / 10;
  // Modelo alternativo (v2) mantido em paralelo ao modelo atual.
  const estrutV2 = (() => {
    const byCat = actionCounts?.byCategory instanceof Map ? actionCounts.byCategory : new Map();
    const qtdAcoesPassivas = Number(byCat.get('Continuidade de Triagem') || 0);
    const qtdAcoesAtivas = Number(byCat.get('Andamento Processual') || 0);
    const localizadoresEntrada = Number(removerDistinct || 0);
    const sBase = 2.5 * (1 - Math.exp(-0.08 * localizadoresEntrada));
    const sGestao = 3.5 * (1 - Math.exp(-0.04 * qtdAcoesPassivas));
    const sAutomacao = 4.0 * (1 - Math.exp(-0.02 * qtdAcoesAtivas));
    const nota = Math.max(0, Math.min(10, sBase + sGestao + sAutomacao));
    return {
      score: Math.round(nota * 10) / 10,
      localizadoresEntrada,
      qtdAcoesPassivas,
      qtdAcoesAtivas
    };
  })();
  const cfgVol = (typeof ATP_CONFIG === 'object' && ATP_CONFIG && ATP_CONFIG.notaVolume) ? ATP_CONFIG.notaVolume : { escala: 600 };
  const volumeRaw = Number(safeRules.length || 0);
  const volumeEscala = Math.max(50, Number(cfgVol.escala) || 600);
  const volumeRatio = Math.max(0, Math.min(1, 1 - Math.exp(-volumeRaw / volumeEscala)));
  const volumeScore = Math.round(volumeRatio * 10 * 10) / 10;
  return {
    totalRules: safeRules.length,
    totalRisk,
    execRaw,
    execAdj,
    execScore,
    execRawScore,
    incluirDistinct,
    removerDistinct,
    incluirSemRemover,
    removerRuleCounts,
    actionCounts,
    outrosCounts,
    triageCount,
    rulesWithAction,
    ioRuleCounts,
    estrutRatio,
    estrutScore,
    estrutV2,
    volumeRaw,
    volumeRatio,
    volumeScore
  };
}

function atpUpdateSimpleBadge(rules, conflictsByRule) {
  try {
    const host = document.getElementById('dvFiltrosOpcionais') || (document.getElementById('btnFiltrarConflitosSlim')?.parentElement) || document.body;
    host.querySelector('#atpNotaBadge')?.remove();
    host.querySelector('#atpConflictCompact')?.remove();
  } catch (_) {}
}

function waitTable(timeoutMs = 120000) {
    const direct = findTable();
    if (direct) return Promise.resolve(direct);
    return new Promise(resolve => {
      const mo = new MutationObserver(() => {
        const tb = findTable();
        if (tb) { mo.disconnect(); resolve(tb); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { mo.disconnect(); resolve(null); }, timeoutMs);
    });
  }

function waitATPHost(timeoutMs = 30000) {
    const direct = document.getElementById('dvFiltrosOpcionais');
    if (direct) return Promise.resolve(direct);
    return new Promise(resolve => {
      const mo = new MutationObserver(() => {
        const host = document.getElementById('dvFiltrosOpcionais');
        if (host) { mo.disconnect(); resolve(host); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { mo.disconnect(); resolve(null); }, timeoutMs);
    });
  }

function isATPAutomationPage() {
  try {
    const href = String((window && window.location && window.location.href) || '');
    if (!/controlador\.php/i.test(href)) return false;
    const acao = String(new URL(href).searchParams.get('acao') || '').toLowerCase();
    return acao === 'automatizar_localizadores';
  } catch (_) {
    return /automatizar_localizadores/i.test(String(location.href || ''));
  }
}

function atpEnsureReportButton(host, afterLabelEl, tableRef) {
  try {
    if (!host) return;
    if (host.querySelector('#btnGerarRelatorioColisoes') && host.querySelector('#btnRelatorioUnidadeATP') && host.querySelector('#btnDashboardUsoATP') && host.querySelector('#chkExpandirColunasATP') && host.querySelector('#btnGerenciarRevisoesATP')) {
      try {
        host.querySelector('#btnAuditoriaPriorizacaoATP')?.remove();
        host.querySelector('#btnGrafoConflitosATP')?.remove();
        host.querySelector('#btnMapaRelacoesATP')?.remove();
        host.querySelector('#btnExtratoFluxosATP')?.remove();
      } catch (_) {}
      return;
    }
    try {
      host.querySelector('#btnGerarRelatorioColisoes')?.remove();
      host.querySelector('#btnRelatorioUnidadeATP')?.remove();
      host.querySelector('#btnExpandirColunasATP')?.remove();
      host.querySelector('#lblExpandirColunasATP')?.remove();
      host.querySelector('#chkExpandirColunasATP')?.remove();
      host.querySelector('#btnGerenciarRevisoesATP')?.remove();
      host.querySelector('#btnAuditoriaPriorizacaoATP')?.remove();
      host.querySelector('#btnGrafoConflitosATP')?.remove();
      host.querySelector('#btnMapaRelacoesATP')?.remove();
      host.querySelector('#btnExtratoFluxosATP')?.remove();
    } catch (_) {}

    const topEntries = (mapObj, limit) => Array.from((mapObj || new Map()).entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
    const buildCurrentUnitReport = (table, rules, conflictsByRule) => {
      const metrics = atpCollectUnitMetrics(rules, conflictsByRule);
      const rows = Array.from(table?.tBodies?.length ? Array.from(table.tBodies).flatMap(tb => Array.from(tb.rows)) : table?.querySelectorAll('tbody tr') || []);
      let activeCount = 0;
      let inactiveCount = 0;
      rows.forEach((tr) => {
        const chk = tr.querySelector('input.custom-control-input');
        if (chk) { if (chk.checked) activeCount += 1; else inactiveCount += 1; }
        else if (tr.querySelectorAll(':scope > td').length) activeCount += 1;
      });
      const countsByTipo = new Map();
      const seenConflictKeys = new Set();
      for (const [a, mapB] of (conflictsByRule || new Map()).entries()) {
        for (const [b, rec] of mapB.entries()) {
          const left = String(a), right = String(b);
          const pairKey = (left < right) ? `${left}|${right}` : `${right}|${left}`;
          for (const tipo of Array.from(rec?.tipos || [])) {
            const key = `${pairKey}|${tipo}`;
            if (seenConflictKeys.has(key)) continue;
            seenConflictKeys.add(key);
            countsByTipo.set(tipo, (countsByTipo.get(tipo) || 0) + 1);
          }
        }
      }
      const topRuleConflicts = new Map();
      (rules || []).forEach((r) => topRuleConflicts.set(String(r.num), conflictsByRule?.get(r.num)?.size || 0));
      const rulesWithConflicts = Array.from(topRuleConflicts.values()).filter((n) => n > 0).length;
      const topRemover = new Map();
      const topTipo = new Map();
      const topIncluir = new Map();
      const collectExprDisplayTerms = (expr) => {
        const out = [];
        try {
          const clauses = Array.isArray(expr?.clauses) ? expr.clauses : [];
          for (const clause of clauses) {
            if (!(clause instanceof Set)) continue;
            for (const raw of clause) {
              const txt = String(raw || '').trim();
              if (!txt || txt === '[*]' || txt === 'E' || txt === 'OU') continue;
              const chunks = txt
                .split(/\s*\|\|\s*|\s+\bOU\b\s+/i)
                .map((p) => String(p || '').trim())
                .filter(Boolean);
              const vals = chunks.length ? chunks : [txt];
              vals.forEach((v) => {
                if (!v || v === '[*]' || v === 'E' || v === 'OU') return;
                out.push(v);
              });
            }
          }
        } catch (_) {}
        return out;
      };
      const isManualTipoTxt = (txt) => {
        const s = String(txt || '').toLowerCase();
        return /acao\s+manual|a[cç][aã]o\s+manual/.test(s);
      };
      const isTodosLocalizadoresToken = (txt) => {
        const s = String(txt || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
        return s === 'todos os localizadores' || s === 'todos localizadores';
      };
      const getContextoUnidade = () => {
        const pick = (sel) => {
          try {
            const el = document.querySelector(sel);
            const txt = String(el?.textContent || el?.innerText || '').trim();
            return txt || '';
          } catch (_) { return ''; }
        };
        const pickSelected = (sel) => {
          try {
            const el = document.querySelector(sel);
            if (!el) return '';
            const opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
            const txt = String(opt?.textContent || '').trim();
            if (txt) return txt;
            return String(el.value || '').trim();
          } catch (_) { return ''; }
        };
        const orgaoSelecionado =
          pickSelected('#selOrgao') ||
          pickSelected('select[name="selOrgao"]') ||
          pickSelected('select[id*="Orgao"]') ||
          pickSelected('select[name*="Orgao"]');
        const candidates = [
          orgaoSelecionado,
          pick('#spnInfraUnidade'),
          pick('#spnInfraDescricaoUnidade'),
          pick('.infraNomeUnidade'),
          pick('.infraBarraSistema'),
          pick('#divInfraAreaSuperior'),
          String(document?.title || '').trim()
        ].filter(Boolean);
        const raw = candidates.find((s) => String(s || '').trim().length >= 6) || '';
        const norm = String(raw || '').replace(/\s+/g, ' ').trim();
        const mComarca = norm.match(/COMARCA\s+DE\s+([^|;\-]+)/i);
        const mVaraFaixa = norm.match(/(\d+\s*[ªa]?\s*(?:A|À|AT[ÉE])\s*\d+\s*[ªa]?\s*VARAS?[^|;\-]*)/i);
        const mVara = mVaraFaixa || norm.match(/((?:\d+\s*[ªa]?\s*)?VARA[^|;\-]*)/i) || norm.match(/(JUIZADO[^|;\-]*)/i);
        return {
          raw: norm,
          orgao: orgaoSelecionado,
          comarca: mComarca ? String(mComarca[1] || '').trim() : '',
          vara: mVara ? String(mVara[1] || '').trim() : ''
        };
      };
      (rules || []).forEach((r) => {
        const tip = String(exprCanon(r.tipoControleCriterio, '') || '').trim();
        const remTerms = collectExprDisplayTerms(r?.localizadorRemover);
        const incTerms = collectExprDisplayTerms(r?.localizadorIncluirAcao);
        if (!isManualTipoTxt(tip)) {
          remTerms
            .filter((rem) => !isTodosLocalizadoresToken(rem))
            .forEach((rem) => topRemover.set(rem, (topRemover.get(rem) || 0) + 1));
        }
        if (tip) topTipo.set(tip, (topTipo.get(tip) || 0) + 1);
        incTerms.forEach((inc) => topIncluir.set(inc, (topIncluir.get(inc) || 0) + 1));
      });
      const pct = (part, whole) => {
        const base = Number(whole) || 0;
        if (base <= 0) return '0,0%';
        return (100 * (Number(part) || 0) / base).toFixed(1).replace('.', ',') + '%';
      };
      const isDetailed = (() => {
        try {
          if (typeof ATP_CONFIG === 'object' && ATP_CONFIG && ATP_CONFIG.relatorioDetalhado === true) return true;
        } catch (_) {}
        try {
          if (typeof window !== 'undefined' && window?.ATP_CONFIG?.relatorioDetalhado === true) return true;
        } catch (_) {}
        return false;
      })();
      const incOnlyRowsRaw = Array.isArray(metrics.incluirSemRemover?.incluirOnlyRows) ? metrics.incluirSemRemover.incluirOnlyRows : [];
      const remOnlyRowsRaw = Array.isArray(metrics.incluirSemRemover?.removerOnlyRows) ? metrics.incluirSemRemover.removerOnlyRows : [];
      const remOnlyUnidadeRowsRaw = remOnlyRowsRaw.filter((r) => r.tipo !== 'sistema');
      const concomitantesRowsRaw = Array.isArray(metrics.incluirSemRemover?.concomitantesRows) ? metrics.incluirSemRemover.concomitantesRows : [];
      const unidadeSemUsoRowsRaw = Array.isArray(metrics.incluirSemRemover?.unidadeDisponiveisSemUsoRows) ? metrics.incluirSemRemover.unidadeDisponiveisSemUsoRows : [];
      const unidadeErroOnlyRowsRaw = Array.isArray(metrics.incluirSemRemover?.unidadeErroOnlyRows) ? metrics.incluirSemRemover.unidadeErroOnlyRows : [];
      const unitClosureRaw = metrics.incluirSemRemover?.unitClosure || {};

      const lines = [];
      const contextoUnidade = getContextoUnidade();
      const totalBase = Math.max(1, Number(metrics.totalRules) || 1);
      const byRuleCat = metrics.actionCounts?.byRuleCategory instanceof Map ? metrics.actionCounts.byRuleCategory : new Map();
      const ruleAnd = Number(byRuleCat.get('Andamento Processual') || 0);
      const ruleTri = Number(byRuleCat.get('Continuidade de Triagem') || 0);
      const ruleOut = Number(byRuleCat.get('Outras Ações') || 0);
      const ruleSem = Number(byRuleCat.get('Sem Ação Programada') || 0);
      const ruleComAcao = ruleAnd + ruleTri + ruleOut;
      const removerDistinct = Number(metrics.incluirSemRemover?.removerRawCount || 0);
      const incluirDistinct = Number(metrics.incluirDistinct || 0);
      const andamentoCount = Number(metrics.actionCounts?.byCategory?.get('Andamento Processual') || 0);
      const unitClosure = metrics.incluirSemRemover?.unitClosure || {};
      const concomitantes = Number(unitClosure.concomitantes || 0);
      const manuaisErroCount = Number(unitClosure.manuais || 0);
      const remOnlyRows = Array.isArray(metrics.incluirSemRemover?.removerOnlyRows) ? metrics.incluirSemRemover.removerOnlyRows : [];
      const remOnlyUnidadeRows = remOnlyRows.filter((r) => r.tipo !== 'sistema');
      const remOnlySistemaRows = remOnlyRows.filter((r) => r.tipo === 'sistema');
      const incOnlyRows = Array.isArray(metrics.incluirSemRemover?.incluirOnlyRows) ? metrics.incluirSemRemover.incluirOnlyRows : [];
      const incOnlyUnidadeRows = incOnlyRows.filter((r) => r.tipo !== 'sistema');
      const incOnlySistemaRows = incOnlyRows.filter((r) => r.tipo === 'sistema');
      const topAcoes = topEntries(metrics.actionCounts.byName, 10);
      const topCatAcoes = topEntries(metrics.actionCounts.byCategory, 8);
      const topIncluirEntries = topEntries(topIncluir, 5);
      const topRemoverEntries = topEntries(topRemover, 5);
      const modelosAcao = (() => {
        const normalizeActionName = (txt) => String(txt || '')
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
          .replace(/\s+/g, ' ');
        const categoriaContinuidade = new Set([
          normalizeActionName('LANÇAR EVENTO AUTOMATIZADO'),
          normalizeActionName('INCLUIR LEMBRETE'),
          normalizeActionName('DISTRIBUIR PROCESSOS ENTRE LOCALIZADORES'),
          normalizeActionName('ALTERAR SITUAÇÃO AUTOMATICAMENTE'),
          normalizeActionName('ALTERAR SITUAÇÃO DA JUSTIÇA GRATUITA DA PARTE'),
          normalizeActionName('INSERIR DADO COMPLEMENTAR NO PROCESSO'),
          normalizeActionName('RETIFICAR AUTUAÇÃO'),
          normalizeActionName('VERIFICAÇÃO DE DADOS PROCESSUAIS')
        ]);
        const categoriaAndamento = new Set([
          normalizeActionName('LANÇAR EVENTO E DOCUMENTO BASEADO EM PREFERÊNCIA DE UNIDADE'),
          normalizeActionName('PREPARAR MINUTA BASEADA EM PREFERÊNCIA DE UNIDADE'),
          normalizeActionName('CITAÇÃO POR AR'),
          normalizeActionName('EXPEDIÇÃO DE MANDADO'),
          normalizeActionName('EXPEDIÇÃO DE OFÍCIO POR CARTA AR')
        ]);
        const byModel = new Map();
        const byActionOnlyModel = new Map();
        const classRank = {
          'Andamento Processual': 4,
          'Continuidade de Triagem': 3,
          'Troca de Localizador': 2,
          'Outras Ações': 1
        };
        const classifyModel = (acoes) => {
          const arr = Array.isArray(acoes) ? acoes : [];
          let hasAnd = false;
          let hasTri = false;
          for (const a of arr) {
            const norm = normalizeActionName(String(a?.acao || ''));
            if (!norm) continue;
            if (categoriaAndamento.has(norm)) hasAnd = true;
            else if (categoriaContinuidade.has(norm)) hasTri = true;
          }
          if (hasAnd) return 'Andamento Processual';
          if (hasTri) return 'Continuidade de Triagem';
          if (!arr.length) return 'Troca de Localizador';
          return 'Outras Ações';
        };
        const normalizeTxt = (s) => clean(String(s || ''))
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
        const buildModelKey = (expr) => {
          const canonical = clean(exprCanon(expr, '') || expr?.canonical || '') || '(destino vazio)';
          const acoes = Array.isArray(expr?.acoes) ? expr.acoes : [];
          const acoesSig = acoes.map((a) => {
            const etapa = normalizeTxt(a?.etapa || '');
            const acao = normalizeTxt(a?.acao || '');
            const vars = Array.isArray(a?.vars)
              ? a.vars.map((v) => `${normalizeTxt(v?.nome || '')}=${normalizeTxt(v?.valor || '')}`).filter(Boolean).sort()
              : [];
            return `${etapa}||${acao}||${vars.join('&&')}`;
          }).sort();
          return `${normalizeTxt(canonical)}##${acoesSig.join('##')}`;
        };
        const buildActionOnlyKey = (acoes) => {
          const arr = Array.isArray(acoes) ? acoes : [];
          const sig = arr.map((a) => {
            const etapa = normalizeTxt(a?.etapa || '');
            const acao = normalizeTxt(a?.acao || '');
            const vars = Array.isArray(a?.vars)
              ? a.vars.map((v) => `${normalizeTxt(v?.nome || '')}=${normalizeTxt(v?.valor || '')}`).filter(Boolean).sort()
              : [];
            return `${etapa}||${acao}||${vars.join('&&')}`;
          }).sort();
          return sig.join('##') || '(acao vazia)';
        };
        (rules || []).forEach((r) => {
          const expr = r?.localizadorIncluirAcao || {};
          const key = buildModelKey(expr);
          const classe = classifyModel(expr?.acoes);
          const rec = byModel.get(key) || { count: 0, classe };
          rec.count += 1;
          if ((classRank[classe] || 0) > (classRank[rec.classe] || 0)) rec.classe = classe;
          byModel.set(key, rec);

          if (classe === 'Andamento Processual' || classe === 'Continuidade de Triagem') {
            const keyActionOnly = buildActionOnlyKey(expr?.acoes);
            const recAction = byActionOnlyModel.get(keyActionOnly) || { count: 0, classe };
            recAction.count += 1;
            if ((classRank[classe] || 0) > (classRank[recAction.classe] || 0)) recAction.classe = classe;
            byActionOnlyModel.set(keyActionOnly, recAction);
          }
        });
        const entries = Array.from(byModel.values());
        const totalDistintos = entries.length;
        const repetidos = entries.filter((e) => Number(e.count || 0) > 1);
        const totalRepetidos = repetidos.length;
        const totalOcorrenciasEmRepetidos = repetidos.reduce((acc, e) => acc + (Number(e.count) || 0), 0);
        const distinctByClass = new Map([
          ['Andamento Processual', 0],
          ['Continuidade de Triagem', 0],
          ['Troca de Localizador', 0],
          ['Outras Ações', 0]
        ]);
        entries.forEach((e) => {
          const k = String(e?.classe || 'Outras Ações');
          distinctByClass.set(k, (distinctByClass.get(k) || 0) + 1);
        });
        const actionEntries = Array.from(byActionOnlyModel.values());
        const actionDistinct = actionEntries.length;
        const actionRepeated = actionEntries.filter((e) => Number(e.count || 0) > 1);
        const actionRepeatedCount = actionRepeated.length;
        const actionRepeatedOccurrences = actionRepeated.reduce((acc, e) => acc + (Number(e.count) || 0), 0);
        const actionDistinctByClass = new Map([
          ['Andamento Processual', 0],
          ['Continuidade de Triagem', 0]
        ]);
        actionEntries.forEach((e) => {
          const k = String(e?.classe || '');
          if (actionDistinctByClass.has(k)) actionDistinctByClass.set(k, (actionDistinctByClass.get(k) || 0) + 1);
        });
        return {
          totalDistintos,
          totalRepetidos,
          totalOcorrenciasEmRepetidos,
          distinctByClass,
          actionDistinct,
          actionRepeatedCount,
          actionRepeatedOccurrences,
          actionDistinctByClass
        };
      })();

      const totalLoc = Math.max(0, incluirDistinct + removerDistinct - concomitantes);
      const acoesUnicasTotais = Number(modelosAcao.actionDistinct || 0);
      const maturidadeMagnitude = (
        Math.log10(Math.max(0, removerDistinct) + 1)
        + Math.log10(Math.max(0, incluirDistinct) + 1)
        + Math.log10(Math.max(0, acoesUnicasTotais) + 1)
        + Math.log10(Math.max(0, andamentoCount) + 1)
      );
      const stageScore = (() => {
        const m = Number(maturidadeMagnitude || 0);
        if (m >= 9) return 4;
        if (m >= 7) return 3;
        if (m >= 5) return 2;
        if (m >= 3.5) return 1;
        return 0;
      })();
      const stageName = ['Inicial', 'Em Estruturação', 'Intermediário', 'Maturidade', 'Referência Operacional'][stageScore] || 'Inicial';
      const maturidadeTexto = (() => {
        if (stageScore >= 4) return 'A unidade atingiu referência operacional, com automação consolidada, repertório consistente de localizadores e desenho estável para o volume de regras em produção.';
        if (stageScore === 3) return 'A unidade apresenta maturidade, com boa estrutura na seleção de localizadores e predominância de regras focadas em localizadores da própria unidade.';
        if (stageScore === 2) return 'A unidade apresenta maturidade intermediária, com base funcional ativa e espaço para reduzir pontos manuais e ampliar cobertura de localizadores da unidade.';
        if (stageScore === 1) return 'A unidade está em fase de estruturação, com avanço parcial de cobertura e necessidade de consolidar padrão de entrada e saída dos localizadores.';
        return 'A unidade ainda está em estágio inicial de maturidade, com base de regras reduzida para consolidar leitura estrutural estável.';
      })();

      const triagemAndamentoRazao = Number(ruleTri || 0) / Math.max(1, Number(ruleAnd || 0));
      const triagemMaiorQueAndamento = ruleTri > ruleAnd;
      const execTexto = (() => {
        const shareComAcao = ruleComAcao / totalBase;
        if (triagemAndamentoRazao > 2.0) {
          return 'A unidade apresenta um desequilíbrio significativo entre triagem (' + String(ruleTri) + ') e andamento processual (' + String(ruleAnd) + '). Priorize a conversão de triagens objetivas em ações de andamento.';
        }
        if (stageScore >= 3) {
          return 'A unidade mantém um bom equilíbrio entre triagem (' + String(ruleTri) + ') e andamento processual (' + String(ruleAnd) + '), característico de unidades maduras. Oportunidades de automação adicional podem ser avaliadas nos fluxos mais acionados.';
        }
        if (shareComAcao >= 0.60 && !triagemMaiorQueAndamento) {
          return 'A participação de regras com ação já está em patamar positivo, mantendo triagem como suporte à análise humana.';
        }
        if (triagemMaiorQueAndamento) {
          return 'Há predominância de triagem sobre andamento processual, indicando espaço para converter regras de apoio em ações mais efetivas de avanço.';
        }
        return 'A execução apresenta perfil misto entre andamento, triagem e regras sem ação, com potencial de calibragem para elevar produtividade.';
      })();

      const normLabel = (s) => String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      const classeByLabel = new Map();
      const classeWeightByLabel = new Map();
      const setClasse = (label, classe, weight) => {
        const k = normLabel(label);
        if (!k || !classe) return;
        const wPrev = Number(classeWeightByLabel.get(k) || 0);
        const wCur = Number(weight || 0);
        if (!classeByLabel.has(k) || wCur >= wPrev) {
          classeByLabel.set(k, classe);
          classeWeightByLabel.set(k, wCur);
        }
      };
      remOnlyRowsRaw.forEach((r) => {
        if (r && r.tipo === 'sistema') setClasse(r.label, 'Sistema', 100);
        else setClasse(r && r.label, 'Passagem', 70);
      });
      concomitantesRowsRaw.forEach((r) => {
        if (r && r.tipo === 'sistema') setClasse(r.label, 'Sistema', 100);
        else setClasse(r && r.label, 'Concomitante', 60);
      });
      incOnlyRowsRaw.forEach((r) => {
        const raw = String(r?.classeFluxo || '');
        const classe =
          /gabinete/i.test(raw) ? 'Gabinete'
            : /fixo/i.test(raw) ? 'Fixo'
              : /cumprimento/i.test(raw) ? 'Cumprimento'
                : '';
        if (classe) setClasse(r && r.label, classe, 80);
      });
      const classificarTipoFuncional = (label) => {
        const txt = String(label || '').trim();
        const k = normLabel(txt);
        const mapped = classeByLabel.get(k);
        if (mapped) return mapped;
        if (/\bprazo\b|decurso/.test(k)) return 'Prazo';
        if (/gabinete|conclus/.test(k)) return 'Gabinete';
        if (/\bfixo\b/.test(k)) return 'Fixo';
        if (/cumpr|mandado|diligenc/.test(k)) return 'Cumprimento';
        if (/passagem|encaminh/.test(k)) return 'Passagem';
        return 'Cumprimento';
      };

      const critSet = new Set(['Regra em Duplicidade', 'Prioridade Invertida', 'Filtros Conflitantes', 'Regra sem Finalidade', 'Potencial Looping']);
      const atencaoSet = new Set(['Avaliar Prioridade', 'Avaliar Troca de Localizadores']);
      let conflitosCriticos = 0;
      let conflitosAtencao = 0;
      for (const [tipo, total] of countsByTipo.entries()) {
        const n = Number(total) || 0;
        if (critSet.has(tipo)) conflitosCriticos += n;
        else if (atencaoSet.has(tipo)) conflitosAtencao += n;
      }

      const totalRepertorioUnidade = Math.max(1, Number(unitClosure.base || 0));
      const nApenasRemoverUnidade = Number(remOnlyUnidadeRows.length || 0);
      const pctApenasRemoverTxt = ((100 * nApenasRemoverUnidade) / totalRepertorioUnidade).toFixed(1).replace('.', ',') + '%';
      const nApenasIncluirUnidade = Number(unitClosure.incluirSemRemover || incOnlyUnidadeRows.length || 0);
      const pctApenasIncluirTxt = ((100 * nApenasIncluirUnidade) / totalRepertorioUnidade).toFixed(1).replace('.', ',') + '%';
      const nAtencaoPrioridade = Number(countsByTipo.get('Avaliar Prioridade') || 0);
      const nAtencaoTrocaLocalizador = Number(countsByTipo.get('Avaliar Troca de Localizadores') || 0);
      const nAtencaoTotal = Number(conflitosAtencao || 0);
      const detalhesAtencao = (() => {
        const parts = [];
        if (nAtencaoPrioridade > 0) parts.push('Avaliar Prioridade: ' + String(nAtencaoPrioridade));
        if (nAtencaoTrocaLocalizador > 0) parts.push('Avaliar Troca de Localizadores: ' + String(nAtencaoTrocaLocalizador));
        if (parts.length > 1) return ' (' + parts.join(', ') + ')';
        if (parts.length === 1) {
          if (nAtencaoPrioridade > 0) return ' (Avaliar Prioridade)';
          if (nAtencaoTrocaLocalizador > 0) return ' (Avaliar Troca de Localizadores)';
        }
        return '';
      })();
      const recs = [];
      const percentualRegrasSemAcao = (100 * Number(ruleSem || 0)) / Math.max(1, Number(totalBase || 0));
      const recEquilibrioTriagemAndamento = (triagemAndamentoRazao > 2.0)
        ? ('Ajustar o equilíbrio entre triagem e andamento processual: atualmente ' + String(ruleTri) + ' regras de triagem e ' + String(ruleAnd) + ' de andamento. Priorize converter regras de triagem em ações de avanço quando houver critério objetivo.')
        : ('Manter o equilíbrio entre triagem e andamento processual: atualmente ' + String(ruleTri) + ' regras de triagem e ' + String(ruleAnd) + ' de andamento. Havendo fluxos com critérios objetivos, avaliar a criação de novas regras com ações de andamento.');
      const textoApenasRemoverPorFaixa = (() => {
        if (totalLoc < 50) {
          return 'Os números absolutos ainda são reduzidos, indicando que a unidade está nos estágios iniciais de automação. O foco agora deve ser aumentar a abrangência das regras ATP, expandindo o número de localizadores alcançados, tanto na entrada quanto na saída.';
        }
        return 'Os ' + String(nApenasRemoverUnidade) + ' localizadores que aparecem apenas no REMOVER (' + pctApenasRemoverTxt + ' do total) são tipicamente localizadores de passagem: o processo sai deles por regra ATP, mas a entrada é feita manualmente ou por evento externo (ex.: protocolo de petição). A automação atua apenas na saída. Avalie se a entrada também poderia ser automatizada — por exemplo, transformando esse localizador em destino de outra regra ATP ou de um documento automatizado, ao menos para alguma situação —, se isso fizer sentido para o fluxo. Quando não for viável, mantenha a entrada manual documentada; a utilização de preferências é essencial para a correta movimentação dos processos dentro do fluxo.';
      })();
      const textoApenasIncluirPorFaixa = (() => {
        if (totalLoc < 50) {
          return 'Os números absolutos ainda são reduzidos, indicando que a unidade está nos estágios iniciais de automação. O foco agora deve ser aumentar a abrangência das regras ATP, expandindo o número de localizadores alcançados, tanto na entrada quanto na saída.';
        }
        return 'Os ' + String(nApenasIncluirUnidade) + ' localizadores que aparecem apenas no INCLUIR (' + pctApenasIncluirTxt + ' do total) são tipicamente destinos finais da automação: o processo chega ali por regra ATP, mas a saída depende de ação humana. Em geral, são gabinetes (ex.: conclusos para decisão), pontos de expedição de documentos (ex.: expedir carta, mandado) ou etapas em que a intervenção humana é indispensável. Avalie se alguma dessas saídas poderia ser automatizada sem perda de qualidade — por exemplo, com expedição automática de documento.';
      })();
      const recApenasUnificadaExtremos = (() => {
        if (totalLoc < 50) {
          return 'Os números absolutos ainda são reduzidos, indicando que a unidade está nos estágios iniciais de automação. O foco agora deve ser aumentar a abrangência das regras ATP, expandindo o número de localizadores alcançados, tanto na entrada quanto na saída.';
        }
        return '';
      })();
      const recomendacoesAvancadas = stageScore >= 3;
      if (recomendacoesAvancadas) {
        recs.push('A unidade está em estágio avançado de automação. As ações abaixo visam refinar ainda mais o desempenho:');
        recs.push(recEquilibrioTriagemAndamento);
        if (recApenasUnificadaExtremos) recs.push(recApenasUnificadaExtremos);
        else {
          recs.push(textoApenasRemoverPorFaixa);
          recs.push(textoApenasIncluirPorFaixa);
        }
        recs.push('Consultar o Relatório de Colisões: há ' + String(nAtencaoTotal) + ' pares de Atenção' + detalhesAtencao + ' que podem ser verificados para garantir que a ordem de prioridade está intencional.');
      } else {
        recs.push('A unidade está em fase de consolidação. As ações abaixo priorizam correção de gargalos e aumento de automação:');
        recs.push(recEquilibrioTriagemAndamento);
        if (recApenasUnificadaExtremos) recs.push(recApenasUnificadaExtremos);
        else {
          recs.push(textoApenasRemoverPorFaixa);
          recs.push(textoApenasIncluirPorFaixa);
        }
        if (percentualRegrasSemAcao > 25) {
          recs.push('Das ' + String(totalBase) + ' regras consideradas, ' + String(ruleSem) + ' não possuem ação programada (' + pct(ruleSem, totalBase) + '). Priorize adicionar ações às regras de maior impacto.');
        }
        recs.push('Consultar o Relatório de Colisões: há ' + String(nAtencaoTotal) + ' pares de Atenção' + detalhesAtencao + ' para validação de intencionalidade da ordem de prioridade.');
      }

      lines.push('Relatório da Unidade ATP (V3)');
      lines.push('Data/Hora: ' + (new Date()).toLocaleString());
      lines.push('Referência: regras ATP atualmente carregadas na tabela');
      if (contextoUnidade.orgao) lines.push('Órgão selecionado: ' + contextoUnidade.orgao);
      if (contextoUnidade.raw && String(contextoUnidade.raw).trim() !== String(contextoUnidade.orgao || '').trim()) {
        lines.push('Unidade/Contexto: ' + contextoUnidade.raw);
      }
      lines.push('');

      lines.push('Diagnóstico de Maturidade:');
      lines.push('- Estágio: ' + String(stageScore) + ' - ' + stageName);
      lines.push('- INCLUIR distintos: ' + String(metrics.incluirDistinct || 0));
      lines.push('- REMOVER distintos (token/base da matriz): ' + String(metrics.incluirSemRemover?.removerRawCount || 0));
      lines.push('- Concomitantes: ' + String(concomitantes));
      lines.push('- Manuais/Erro: ' + String(manuaisErroCount));
      lines.push(maturidadeTexto);
      lines.push('');

      lines.push('Indicadores de Execução:');
      lines.push('- Regras ativas: ' + String(activeCount));
      lines.push('- Regras inativas: ' + String(inactiveCount));
      lines.push('- Regras com ação: ' + String(ruleComAcao));
      lines.push('- Regras sem ação: ' + String(ruleSem));
      lines.push('- Andamento Processual: ' + String(ruleAnd));
      lines.push('- Continuidade de Triagem: ' + String(ruleTri));
      lines.push(execTexto);
      if (triagemAndamentoRazao > 2.0 && stageScore < 3) {
        lines.push('Sugestão: priorize revisão das regras de triagem para converter parte delas em andamento processual quando houver critério objetivo de avanço.');
      }
      lines.push('');

      lines.push('Localizadores Apenas no REMOVER:');
      lines.push('- Total (unidade): ' + String(remOnlyUnidadeRows.length));
      lines.push('- Total (sistema): ' + String(remOnlySistemaRows.length));
      lines.push('- Total geral: ' + String(remOnlyRows.length));
      lines.push(textoApenasRemoverPorFaixa);
      lines.push('');

      lines.push('Localizadores Apenas no INCLUIR:');
      lines.push('- Total (unidade): ' + String(incOnlyUnidadeRows.length));
      lines.push('- Total (sistema): ' + String(incOnlySistemaRows.length));
      lines.push('- Total geral: ' + String(incOnlyRows.length));
      lines.push(textoApenasIncluirPorFaixa);
      lines.push('');

      lines.push('Ações Programadas:');
      if (topAcoes.length) topAcoes.forEach(([txt, total]) => lines.push('- ' + txt + ': ' + String(total)));
      else lines.push('- Nenhuma ação programada mapeada.');
      lines.push('- Distribuição por categorias:');
      if (topCatAcoes.length) topCatAcoes.forEach(([txt, total]) => lines.push('  - ' + txt + ': ' + String(total)));
      else lines.push('  - Sem categorias disponíveis.');
      lines.push('O conjunto de ações programadas indica o perfil operacional corrente da unidade; mantenha foco nas ações que efetivamente geram andamento processual.');
      lines.push('');
      const estruturaPadroesTotal = Number(modelosAcao.totalDistintos || 0);
      const estruturaPadroesAnd = Number(modelosAcao.distinctByClass?.get('Andamento Processual') || 0);
      const estruturaPadroesTri = Number(modelosAcao.distinctByClass?.get('Continuidade de Triagem') || 0);
      const estruturaPadroesTroca = Number(modelosAcao.distinctByClass?.get('Troca de Localizador') || 0);
      const estruturaAcoesAnd = Number(modelosAcao.actionDistinctByClass?.get('Andamento Processual') || 0);
      const estruturaAcoesTri = Number(modelosAcao.actionDistinctByClass?.get('Continuidade de Triagem') || 0);
      const estruturaAcoesTotal = estruturaAcoesAnd + estruturaAcoesTri;
      const estruturaDiferenca = (estruturaPadroesTotal - estruturaAcoesTotal) / Math.max(1, estruturaAcoesTotal);

      lines.push('Estrutura de Automação:');
      lines.push('');
      lines.push('Padrões de destino/ação únicos: ' + String(estruturaPadroesTotal));
      lines.push('- Andamento Processual: ' + String(estruturaPadroesAnd));
      lines.push('- Continuidade de Triagem: ' + String(estruturaPadroesTri));
      lines.push('- Troca de Localizador: ' + String(estruturaPadroesTroca));
      lines.push('');
      lines.push('Ações únicas (tipos de ação, sem considerar o destino): ' + String(estruturaAcoesTotal));
      lines.push('- Andamento Processual: ' + String(estruturaAcoesAnd));
      lines.push('- Continuidade de Triagem: ' + String(estruturaAcoesTri));
      lines.push('');
      lines.push(
        estruturaDiferenca > 0.8
          ? 'Nesta unidade, os números indicam que as mesmas ações são aplicadas a localizadores de destino diferentes.'
          : (estruturaDiferenca >= 0.3
            ? 'Nesta unidade, algumas ações são aplicadas a diferentes localizadores de destino.'
            : 'Nesta unidade, cada ação tende a estar associada a um destino específico.')
      );
      lines.push('');
      if (estruturaPadroesTri > (3 * Math.max(1, estruturaPadroesAnd))) {
        recs.push('A unidade apresenta muitos padrões de triagem distintos em relação ao andamento. Avalie consolidar triagens equivalentes e converter as mais objetivas em ações de andamento.');
      }

      lines.push('Resumo de Conflitos:');
      lines.push('- Críticos: ' + String(conflitosCriticos));
      lines.push('- Atenção: ' + String(conflitosAtencao));
      lines.push('Para detalhamento por regra e motivo, consulte o Relatório de Colisões.');
      lines.push('');

      lines.push('Top 5 Destinos (INCLUIR):');
      if (topIncluirEntries.length) {
        topIncluirEntries.forEach(([txt, total]) => {
          lines.push('- ' + String(txt) + ' | Tipo funcional: ' + classificarTipoFuncional(txt) + ' | Quantidade: ' + String(total));
        });
      } else {
        lines.push('- Nenhum destino identificado.');
      }
      lines.push('');
      lines.push('Top 5 Origens (REMOVER):');
      if (topRemoverEntries.length) {
        topRemoverEntries.forEach(([txt, total]) => {
          lines.push('- ' + String(txt) + ' | Tipo funcional: ' + classificarTipoFuncional(txt) + ' | Quantidade: ' + String(total));
        });
      } else {
        lines.push('- Nenhuma origem identificada.');
      }
      lines.push('');

      lines.push('Ações Recomendadas:');
      if (recomendacoesAvancadas && recs.length) lines.push(recs[0]);
      recs.slice(recomendacoesAvancadas ? 1 : 1, 8).forEach((r) => lines.push('- [ ] ' + String(r)));
      lines.push('');
      lines.push('Mini-help (Relatório da Unidade):');
      lines.push(String(ATP_MINI_HELP_UNIDADE_TIP || ''));
      return lines.join('\n');
    };

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'infraButton';
    btn.id = 'btnGerarRelatorioColisoes';
    btn.textContent = '📋 Relatório de Colisões';
    btn.style.marginLeft = '8px';

    btn.addEventListener('mouseenter', () => { btn.style.background = '#e5e7eb'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#f3f4f6'; });

    btn.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;
        var rules = atpGetRulesSnapshotForReports(table);
        if (!rules.length) return;
        var conflictsByRule = (typeof analyze === 'function') ? (analyze(rules) || new Map()) : new Map();

        var tiposCriticos = new Set(['Regra em Duplicidade', 'Prioridade Invertida', 'Filtros Conflitantes', 'Regra sem Finalidade', 'Potencial Looping']);
        var tiposAtencao = new Set(['Avaliar Prioridade', 'Avaliar Troca de Localizadores']);
        var tiposInformativos = new Set(['Prioridade Correta']);
        var categoriaLabel = { critico: 'Crítico', atencao: 'Atenção' };
        var impactoPorCategoria = { critico: 'Alto', atencao: 'Médio' };

        var categoriaDoTipo = function (tipo) {
          var t = String(tipo || '');
          if (tiposCriticos.has(t)) return 'critico';
          if (tiposAtencao.has(t)) return 'atencao';
          if (tiposInformativos.has(t)) return '';
          return '';
        };
        var categoriaDoPar = function (rec) {
          var tipos = Array.from(rec && rec.tipos || []);
          if (tipos.some(function (t) { return tiposCriticos.has(t); })) return 'critico';
          if (tipos.some(function (t) { return tiposAtencao.has(t); })) return 'atencao';
          return '';
        };
        var sanitizarTextoMotivoRelatorio = function (txt) {
          var out = String(txt || '');
          out = out.replace(/Eventotipodepeticao/gi, 'Tipo de Petição');
          out = out.replace(/Dadocomplementardoprocesso/gi, 'Dado Complementar do Processo');
          out = out.replace(/Dadocomplementardaparte/gi, 'Dado Complementar da Parte');
          out = out.replace(/Classificador\s+Por\s+ConteÚDo/gi, 'Classificador por Conteúdo');
          out = out.replace(/Motivodadevolucaodoecarta/gi, 'Motivo de Devolução da Carta');
          out = out.replace(/\bCompetencia\b/g, 'Competência');
          out = out.replace(/\bLitisconsorcio\b/g, 'Litisconsórcio');
          out = out.replace(/Juizodoprocesso/gi, 'Juízo do Processo');
          return out;
        };

        var pares = [];
        var resumoTipos = new Map();
        for (var _ref of (conflictsByRule || new Map()).entries()) {
          var numRegra = _ref[0];
          var mapaAdj = _ref[1];
          for (var _ref2 of (mapaAdj || new Map()).entries()) {
            var outraRegra = _ref2[0];
            var rec = _ref2[1];
            var nA = Number(numRegra);
            var nB = Number(outraRegra);
            if (!Number.isFinite(nA) || !Number.isFinite(nB) || nB < 0 || nA >= nB) continue;
            var tipos = Array.from(rec && rec.tipos || []).map(String);
            tipos = tipos.filter(function (t) { return !tiposInformativos.has(t); });
            if (!tipos.length) continue;
            tipos.forEach(function (t) { resumoTipos.set(t, (resumoTipos.get(t) || 0) + 1); });
            pares.push({
              a: String(numRegra),
              b: String(outraRegra),
              categoria: categoriaDoPar(rec),
              tipos: tipos,
              impacto: impactoPorCategoria[categoriaDoPar(rec)] || 'Médio',
              motivos: Array.from(rec && rec.motivos || [])
                .map(function (m) { return sanitizarTextoMotivoRelatorio(String(m || '').trim()); })
                .filter(Boolean)
            });
          }
        }

        var ordemCategoria = { critico: 0, atencao: 1 };
        pares.sort(function (x, y) {
          var cx = ordemCategoria[x.categoria] || 9;
          var cy = ordemCategoria[y.categoria] || 9;
          if (cx !== cy) return cx - cy;
          var ax = Number(x.a), ay = Number(y.a);
          if (Number.isFinite(ax) && Number.isFinite(ay) && ax !== ay) return ax - ay;
          if (x.a !== y.a) return String(x.a).localeCompare(String(y.a));
          var bx = Number(x.b), by = Number(y.b);
          if (Number.isFinite(bx) && Number.isFinite(by) && bx !== by) return bx - by;
          return String(x.b).localeCompare(String(y.b));
        });

        var lines = [];
        lines.push('Relatório de Colisões (ATP / eProc)');
        lines.push('Data/Hora: ' + (new Date()).toLocaleString());
        lines.push('');
        lines.push('Resumo por severidade:');
        lines.push('- Crítico: ' + String(pares.filter(function (p) { return p.categoria === 'critico'; }).length));
        lines.push('- Atenção: ' + String(pares.filter(function (p) { return p.categoria === 'atencao'; }).length));
        lines.push('- Total de pares: ' + String(pares.length));
        lines.push('');
        lines.push('Resumo por tipo:');
        Array.from(resumoTipos.entries())
          .sort(function (a, b) { return (Number(b[1]) || 0) - (Number(a[1]) || 0) || String(a[0]).localeCompare(String(b[0])); })
          .forEach(function (it) { lines.push('- ' + it[0] + ': ' + String(it[1])); });
        lines.push('');
        lines.push('Detalhamento:');
        if (!pares.length) {
          lines.push('- Nenhuma colisão foi encontrada.');
        } else {
          pares.forEach(function (p) {
            lines.push('');
            lines.push('Regra 1: ' + p.a);
            lines.push('-----');
            lines.push('Regra 2: ' + p.b);
            lines.push('- Categoria: ' + (categoriaLabel[p.categoria] || 'Atenção'));
            lines.push('- Tipos: ' + (p.tipos && p.tipos.length ? p.tipos.join(' | ') : '(sem tipo)'));
            lines.push('- Impacto: ' + p.impacto);
            if (p.motivos && p.motivos.length) lines.push('- Motivos: ' + p.motivos.join(' || '));
          });
        }
        lines.push('');
        lines.push('----------------------------------------------------------------');
        lines.push('');
        lines.push('Mini-help:');
        lines.push(String(ATP_MINI_HELP_TIP || ''));

        var content = lines.join('\n');
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'relatorio_colisoes_ATP.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          try { URL.revokeObjectURL(url); } catch (_) {}
          try { a.remove(); } catch (_) {}
        }, 0);
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar relatório:', e);
      }
    });

    const btnFluxos = document.createElement('button');
    btnFluxos.type = 'button';
    btnFluxos.className = 'infraButton';
    btnFluxos.id = 'btnExtratoFluxosATP';
    btnFluxos.textContent = '🧾 Extrato de Fluxos';
    btnFluxos.style.marginLeft = '8px';

    btnFluxos.addEventListener('mouseenter', () => { btnFluxos.style.background = '#e5e7eb'; });
    btnFluxos.addEventListener('mouseleave', () => { btnFluxos.style.background = '#f3f4f6'; });

    btnFluxos.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;
        const rules = atpGetRulesSnapshotForReports(table);
        if (!rules.length) return;
        const txt = atpBuildFluxosText(rules);

        var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'extrato_fluxos_ATP.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); try { a.remove(); } catch (e) { } }, 0);
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar Extrato de Fluxos', e);
      }
    });

    const btnUnitReport = document.createElement('button');
    btnUnitReport.type = 'button';
    btnUnitReport.className = 'infraButton';
    btnUnitReport.id = 'btnRelatorioUnidadeATP';
    btnUnitReport.textContent = '🗂 Relatório da Unidade';
    btnUnitReport.style.marginLeft = '8px';
    btnUnitReport.addEventListener('mouseenter', () => { btnUnitReport.style.background = '#e5e7eb'; });
    btnUnitReport.addEventListener('mouseleave', () => { btnUnitReport.style.background = '#f3f4f6'; });
    btnUnitReport.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;
        const rules = atpGetRulesSnapshotForReports(table);
        if (!rules.length) return;
        const conflictsByRule = (typeof analyze === 'function') ? analyze(rules) : new Map();
        const txt = buildCurrentUnitReport(table, rules, conflictsByRule);
        var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'relatorio_unidade_ATP.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { } try { a.remove(); } catch (e) { } }, 0);
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar relatório da unidade atual', e);
      }
    });

    const btnDashboard = document.createElement('button');
    btnDashboard.type = 'button';
    btnDashboard.id = 'btnDashboardUsoATP';
    btnDashboard.className = 'infraButton';
    btnDashboard.title = 'Dashboard de Utilização do Script';
    btnDashboard.textContent = '📊';
    btnDashboard.addEventListener('click', atpOpenDashboardModal);

    const lblExpandCols = document.createElement('label');
    lblExpandCols.id = 'lblExpandirColunasATP';
    lblExpandCols.style.display = 'inline-flex';
    lblExpandCols.style.alignItems = 'center';
    lblExpandCols.style.gap = '4px';
    lblExpandCols.style.marginLeft = '8px';
    lblExpandCols.style.cursor = 'pointer';
    lblExpandCols.style.userSelect = 'none';
    lblExpandCols.style.fontSize = '12px';
    const chkExpandCols = document.createElement('input');
    chkExpandCols.type = 'checkbox';
    chkExpandCols.id = 'chkExpandirColunasATP';
    chkExpandCols.checked = atpLoadExpandColsState();
    chkExpandCols.addEventListener('change', function () {
      try {
        const tb = tableRef || findTable();
        const val = !!chkExpandCols.checked;
        atpSaveExpandColsState(val);
        if (tb) atpApplyExpandColsState(tb, val);
      } catch (_) {}
    });
    const txtExpandCols = document.createElement('span');
    txtExpandCols.textContent = 'Expandir colunas';
    lblExpandCols.appendChild(chkExpandCols);
    lblExpandCols.appendChild(txtExpandCols);

    const btnReviewMgr = document.createElement('button');
    btnReviewMgr.type = 'button';
    btnReviewMgr.className = 'infraButton';
    btnReviewMgr.id = 'btnGerenciarRevisoesATP';
    btnReviewMgr.textContent = '✅ Revisões';
    btnReviewMgr.style.marginLeft = '8px';
    btnReviewMgr.addEventListener('mouseenter', () => { btnReviewMgr.style.background = '#e5e7eb'; });
    btnReviewMgr.addEventListener('mouseleave', () => { btnReviewMgr.style.background = '#f3f4f6'; });
    btnReviewMgr.addEventListener('click', function () {
      try {
        const fn = window && window.atpOpenPriorityReviewManager;
        if (typeof fn === 'function') fn();
      } catch (_) {}
    });

    const btnAudit = document.createElement('button');
    btnAudit.type = 'button';
    btnAudit.className = 'infraButton';
    btnAudit.id = 'btnAuditoriaPriorizacaoATP';
    btnAudit.textContent = '🧪 Auditoria Priorização';
    btnAudit.style.marginLeft = '8px';
    btnAudit.addEventListener('mouseenter', () => { btnAudit.style.background = '#e5e7eb'; });
    btnAudit.addEventListener('mouseleave', () => { btnAudit.style.background = '#f3f4f6'; });
    btnAudit.addEventListener('click', function () {
      try {
        var table = tableRef || findTable();
        if (!table) return;
        try { ensureColumns(table); } catch (e) { }
        var cols = null;
        try { cols = mapColumns(table); } catch (e) { cols = null; }
        if (!cols) cols = {};
        const rules = parseRules(table, cols);
        const conflictsByRule = (typeof analyze === 'function') ? analyze(rules) : new Map();
        const prioTypes = new Set(['Sobreposição', 'Priorização', 'Priorização Correta']);
        const rank = { 'Sobreposição': 1, 'Priorização': 2, 'Priorização Correta': 3 };
        const records = [];
        const seen = new Set();
        const inferRel = (tipo, motivo) => {
          const m = String(motivo || '').toLowerCase();
          if (tipo === 'Priorização Correta') return 'Contenção (restrita antes)';
          if (m.includes('mais ampla está executando antes')) return 'Contenção (ampla antes)';
          if (m.includes('priorização necessária')) return 'Interseção (decisão humana)';
          if (m.includes('equivalentes')) return 'Equivalência';
          return tipo === 'Sobreposição' ? 'Interseção/Contenção' : 'Interseção';
        };
        const inferCampo = (motivo) => {
          const txt = String(motivo || '');
          const m1 = txt.match(/em\s+([^.;]+)(?:[.;]|$)/i);
          if (m1 && m1[1]) return clean(m1[1]);
          const m2 = txt.match(/Prioriza\s+([^.;]+)(?:[.;]|$)/i);
          if (m2 && m2[1]) return clean(m2[1]);
          return '';
        };
        const motivoDoTipo = (rec, tipo) => {
          try {
            const set = rec?.motivosByTipo?.get?.(tipo);
            if (set && set.size) return Array.from(set)[0];
          } catch (_) {}
          try {
            if (rec?.motivos instanceof Set && rec.motivos.size) return Array.from(rec.motivos)[0];
          } catch (_) {}
          return '';
        };
        for (const [a, mapB] of (conflictsByRule || new Map()).entries()) {
          for (const [b, rec] of mapB.entries()) {
            const left = String(a), right = String(b);
            const pA = left < right ? left : right;
            const pB = left < right ? right : left;
            for (const tipo of Array.from(rec?.tipos || [])) {
              if (!prioTypes.has(tipo)) continue;
              const key = `${pA}|${pB}|${tipo}`;
              if (seen.has(key)) continue;
              seen.add(key);
              const motivo = motivoDoTipo(rec, tipo);
              records.push({
                regraA: pA,
                regraB: pB,
                tipo,
                relacao: inferRel(tipo, motivo),
                campo: inferCampo(motivo),
                ordem: `${pA} -> ${pB}`,
                motivo: clean(motivo)
              });
            }
          }
        }
        records.sort((x, y) => {
          const rx = rank[x.tipo] || 9;
          const ry = rank[y.tipo] || 9;
          if (rx !== ry) return rx - ry;
          const ax = Number(x.regraA), ay = Number(y.regraA);
          if (Number.isFinite(ax) && Number.isFinite(ay) && ax !== ay) return ax - ay;
          if (x.regraA !== y.regraA) return String(x.regraA).localeCompare(String(y.regraA));
          const bx = Number(x.regraB), by = Number(y.regraB);
          if (Number.isFinite(bx) && Number.isFinite(by) && bx !== by) return bx - by;
          return String(x.regraB).localeCompare(String(y.regraB));
        });
        const counts = { 'Sobreposição': 0, 'Priorização': 0, 'Priorização Correta': 0 };
        records.forEach((r) => { counts[r.tipo] = (counts[r.tipo] || 0) + 1; });
        const lines = [];
        lines.push('Auditoria de Priorização (ATP / eProc)');
        lines.push('Data/Hora\t' + (new Date()).toLocaleString());
        lines.push('Página\t' + String(location.href || ''));
        lines.push('Totais\tSobreposição=' + counts['Sobreposição'] + ' | Priorização=' + counts['Priorização'] + ' | Priorização Correta=' + counts['Priorização Correta']);
        lines.push('');
        lines.push('Regra A\tRegra B\tTipo\tRelação\tCampo-chave\tOrdem atual\tMotivo');
        records.forEach((r) => {
          lines.push([r.regraA, r.regraB, r.tipo, r.relacao, r.campo, r.ordem, r.motivo].map((v) => String(v || '').replace(/\t/g, ' ')).join('\t'));
        });
        if (!records.length) lines.push('Sem registros de Sobreposição/Priorização/Priorização Correta.');
        const txt = lines.join('\n');
        var blob = new Blob([txt], { type: 'text/tab-separated-values;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'auditoria_priorizacao_ATP.tsv';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} try { a.remove(); } catch (_) {} }, 0);
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar auditoria de priorização', e);
      }
    });

    const btnGraph = document.createElement('button');
    btnGraph.type = 'button';
    btnGraph.className = 'infraButton';
    btnGraph.id = 'btnGrafoConflitosATP';
    btnGraph.textContent = '🕸 Grafo';
    btnGraph.style.marginLeft = '8px';
    btnGraph.addEventListener('mouseenter', () => { btnGraph.style.background = '#e5e7eb'; });
    btnGraph.addEventListener('mouseleave', () => { btnGraph.style.background = '#f3f4f6'; });
    btnGraph.addEventListener('click', function () {
      const win = window.open('', '_blank');
      try {
        if (win) {
          win.document.open();
          win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Grafo ATP</title></head><body style="margin:0;background:#fff;font-family:Segoe UI,Arial,sans-serif"><div style="padding:14px;color:#0f172a">Gerando grafo...</div></body></html>');
          win.document.close();
        }
        var table = tableRef || findTable();
        if (!table) {
          if (win) {
            win.document.open();
            win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Grafo ATP</title></head><body style="margin:0;background:#fff;font-family:Segoe UI,Arial,sans-serif"><div style="padding:14px;color:#991b1b">Não foi possível localizar a tabela de ATP.</div></body></html>');
            win.document.close();
          }
          return;
        }
        try { ensureColumns(table); } catch (_) {}
        var cols = null;
        try { cols = mapColumns(table); } catch (_) { cols = null; }
        if (!cols) cols = {};
        const rules = parseRules(table, cols);
        const conflictsByRule = (typeof analyze === 'function') ? analyze(rules) : new Map();
        const keepTypes = new Set(['Sobreposição', 'Priorização', 'Priorização Correta']);
        const severity = { 'Sobreposição': 1, 'Priorização': 2, 'Priorização Correta': 3 };
        const colorByType = { 'Sobreposição': '#dc2626', 'Priorização': '#d97706', 'Priorização Correta': '#16a34a' };
        const edgeMap = new Map();
        const nodeSet = new Set();
        for (const [a, mapB] of (conflictsByRule || new Map()).entries()) {
          for (const [b, rec] of mapB.entries()) {
            const pA = String(a) < String(b) ? String(a) : String(b);
            const pB = String(a) < String(b) ? String(b) : String(a);
            for (const tipo of Array.from(rec?.tipos || [])) {
              if (!keepTypes.has(tipo)) continue;
              const key = `${pA}|${pB}`;
              const prev = edgeMap.get(key);
              if (!prev || (severity[tipo] || 99) < (severity[prev.tipo] || 99)) {
                edgeMap.set(key, { a: pA, b: pB, tipo });
              }
              nodeSet.add(pA);
              nodeSet.add(pB);
            }
          }
        }
        const nodes = Array.from(nodeSet).sort((x, y) => (Number(x) || 0) - (Number(y) || 0) || String(x).localeCompare(String(y)));
        const edges = Array.from(edgeMap.values()).sort((x, y) => (severity[x.tipo] || 99) - (severity[y.tipo] || 99));
        if (!nodes.length) {
          if (win) {
            win.document.open();
            win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Grafo ATP</title></head><body style="margin:0;background:#fff;font-family:Segoe UI,Arial,sans-serif"><div style="padding:14px;color:#0f172a">Sem arestas de Sobreposição/Priorização/Priorização Correta para montar o grafo.</div></body></html>');
            win.document.close();
          }
          return;
        }
        const nodeDegree = new Map(nodes.map((n) => [n, 0]));
        edges.forEach((e) => {
          nodeDegree.set(e.a, (nodeDegree.get(e.a) || 0) + 1);
          nodeDegree.set(e.b, (nodeDegree.get(e.b) || 0) + 1);
        });
        const defaultFocus = Array.from(nodeDegree.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || nodes[0];
        const counts = { sobre: 0, pri: 0, priC: 0 };
        edges.forEach((e) => { if (e.tipo === 'Sobreposição') counts.sobre += 1; else if (e.tipo === 'Priorização') counts.pri += 1; else if (e.tipo === 'Priorização Correta') counts.priC += 1; });
        const payload = {
          nodes,
          edges,
          counts,
          defaultFocus
        };
        const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');
        win.document.open();
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Grafo ATP</title></head><body style="margin:0;background:#fff;font-family:Segoe UI,Arial,sans-serif"><div style="padding:10px 12px;border-bottom:1px solid #e2e8f0;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong>Grafo ATP (foco)</strong><label>Regra foco <select id="focusRule"></select></label><label>Máx vizinhos <input id="maxNeighbors" type="number" min="8" max="120" value="36" style="width:70px"/></label><label><input id="showSobre" type="checkbox" checked/> Sobreposição</label><label><input id="showPri" type="checkbox" checked/> Priorização</label><label><input id="showPriC" type="checkbox"/> Priorização Correta</label><button id="btnRedraw">Atualizar</button><button id="dlSvg">Baixar SVG</button><span id="meta" style="margin-left:8px;color:#334155"></span></div><div id="graphWrap" style="padding:8px"></div><script>const DATA=${payloadJson};const colorByType={'Sobreposição':'#dc2626','Priorização':'#d97706','Priorização Correta':'#16a34a'};const sev={'Sobreposição':1,'Priorização':2,'Priorização Correta':3};const esc=(s)=>String(s||'').replace(/[&<>"]/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]||ch));const focusSel=document.getElementById('focusRule');DATA.nodes.forEach((n)=>{const o=document.createElement('option');o.value=n;o.textContent=n;focusSel.appendChild(o);});focusSel.value=String(DATA.defaultFocus||DATA.nodes[0]||'');function draw(){const focus=String(focusSel.value||'');const maxN=Math.max(8,Math.min(120,Number(document.getElementById('maxNeighbors').value||36)));const showTypes=new Set();if(document.getElementById('showSobre').checked)showTypes.add('Sobreposição');if(document.getElementById('showPri').checked)showTypes.add('Priorização');if(document.getElementById('showPriC').checked)showTypes.add('Priorização Correta');const edges=DATA.edges.filter((e)=>showTypes.has(e.tipo));const neighScore=new Map();edges.forEach((e)=>{if(e.a===focus&&e.b!==focus)neighScore.set(e.b,(neighScore.get(e.b)||0)+(4-sev[e.tipo]));if(e.b===focus&&e.a!==focus)neighScore.set(e.a,(neighScore.get(e.a)||0)+(4-sev[e.tipo]));});const neighbors=Array.from(neighScore.entries()).sort((a,b)=>b[1]-a[1]).slice(0,maxN).map(([k])=>k);const visible=new Set([focus,...neighbors]);const visEdges=edges.filter((e)=>visible.has(e.a)&&visible.has(e.b));const width=1320,height=860,cx=width/2,cy=height/2;const r=Math.max(220,Math.min(360,130+neighbors.length*4));const pos=new Map();pos.set(focus,{x:cx,y:cy});neighbors.forEach((id,i)=>{const ang=(Math.PI*2*i/Math.max(1,neighbors.length))-(Math.PI/2);pos.set(id,{x:cx+r*Math.cos(ang),y:cy+r*Math.sin(ang)});});let svg='<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"'+width+'\" height=\"'+height+'\" viewBox=\"0 0 '+width+' '+height+'\" style=\"background:#fff\">';svg+='<rect x=\"0\" y=\"0\" width=\"'+width+'\" height=\"'+height+'\" fill=\"#fff\"/>';visEdges.sort((a,b)=>(sev[a.tipo]||99)-(sev[b.tipo]||99)).forEach((e)=>{const p1=pos.get(e.a),p2=pos.get(e.b);if(!p1||!p2)return;const c=colorByType[e.tipo]||'#6b7280';svg+='<line x1=\"'+p1.x.toFixed(2)+'\" y1=\"'+p1.y.toFixed(2)+'\" x2=\"'+p2.x.toFixed(2)+'\" y2=\"'+p2.y.toFixed(2)+'\" stroke=\"'+c+'\" stroke-width=\"2.6\" opacity=\"0.85\"/>';});for(const [id,p] of pos.entries()){const isFocus=(id===focus);svg+='<circle cx=\"'+p.x.toFixed(2)+'\" cy=\"'+p.y.toFixed(2)+'\" r=\"'+(isFocus?24:16)+'\" fill=\"'+(isFocus?'#dbeafe':'#f8fafc')+'\" stroke=\"#0f172a\" stroke-width=\"'+(isFocus?1.8:1.2)+'\"/>';svg+='<text x=\"'+p.x.toFixed(2)+'\" y=\"'+(p.y+5).toFixed(2)+'\" text-anchor=\"middle\" font-size=\"'+(isFocus?13:12)+'\" font-weight=\"700\" fill=\"#0f172a\">'+esc(id)+'</text>';}svg+='<rect x=\"16\" y=\"14\" width=\"700\" height=\"86\" rx=\"10\" fill=\"#f8fafc\" stroke=\"#e2e8f0\"/>';svg+='<text x=\"30\" y=\"38\" font-size=\"16\" font-weight=\"700\" fill=\"#0f172a\">Grafo ATP por foco de regra</text>';svg+='<text x=\"30\" y=\"62\" font-size=\"13\" fill=\"#0f172a\">Foco: '+esc(focus)+' | Nós visíveis: '+(1+neighbors.length)+' | Arestas visíveis: '+visEdges.length+' | Total arestas: '+DATA.edges.length+'</text>';svg+='<circle cx=\"32\" cy=\"84\" r=\"5\" fill=\"#dc2626\"/><text x=\"44\" y=\"88\" font-size=\"12\" fill=\"#0f172a\">Sobreposição</text>';svg+='<circle cx=\"150\" cy=\"84\" r=\"5\" fill=\"#d97706\"/><text x=\"162\" y=\"88\" font-size=\"12\" fill=\"#0f172a\">Priorização</text>';svg+='<circle cx=\"252\" cy=\"84\" r=\"5\" fill=\"#16a34a\"/><text x=\"264\" y=\"88\" font-size=\"12\" fill=\"#0f172a\">Priorização Correta</text>';svg+='</svg>';document.getElementById('graphWrap').innerHTML=svg;document.getElementById('meta').textContent='Totais: Sobreposição='+DATA.counts.sobre+' | Priorização='+DATA.counts.pri+' | Priorização Correta='+DATA.counts.priC;}document.getElementById('btnRedraw').addEventListener('click',draw);document.getElementById('dlSvg').addEventListener('click',function(){var s=document.querySelector('#graphWrap svg');if(!s)return;var blob=new Blob([s.outerHTML],{type:'image/svg+xml;charset=utf-8'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='grafo_atp_foco.svg';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},0);});draw();</script></body></html>`);
        win.document.close();
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao gerar grafo ATP', e);
        if (win) {
          win.document.open();
          win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Grafo ATP</title></head><body style="margin:0;background:#fff;font-family:Segoe UI,Arial,sans-serif"><div style="padding:14px;color:#991b1b">Falha ao gerar grafo ATP.</div></body></html>');
          win.document.close();
        }
      }
    });

    const btnMap = document.createElement('button');
    btnMap.type = 'button';
    btnMap.className = 'infraButton';
    btnMap.id = 'btnMapaRelacoesATP';
    btnMap.textContent = '🧩 Mapa de Relações';
    btnMap.style.marginLeft = '8px';
    btnMap.title = 'Árvore de contenção + tabela de interseções';
    btnMap.addEventListener('click', function () {
      const esc = (s) => String(s || '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] || ch));
      try {
        var table = tableRef || findTable();
        if (!table) return;
        try { ensureColumns(table); } catch (_) {}
        var cols = null;
        try { cols = mapColumns(table); } catch (_) { cols = null; }
        if (!cols) cols = {};
        const rules = parseRules(table, cols);
        const conflictsByRule = (typeof analyze === 'function') ? analyze(rules) : new Map();
        const getMotivo = (rec, tipo) => {
          try {
            const s = rec?.motivosByTipo?.get?.(tipo);
            if (s && s.size) return String(Array.from(s)[0] || '');
          } catch (_) {}
          try {
            if (rec?.motivos instanceof Set && rec.motivos.size) return String(Array.from(rec.motivos)[0] || '');
          } catch (_) {}
          return '';
        };
        const pairRecords = [];
        const seen = new Set();
        for (const [a, mapB] of (conflictsByRule || new Map()).entries()) {
          for (const [b, rec] of mapB.entries()) {
            const pA = String(a) < String(b) ? String(a) : String(b);
            const pB = String(a) < String(b) ? String(b) : String(a);
            for (const tipo of Array.from(rec?.tipos || [])) {
              if (!['Sobreposição', 'Priorização', 'Priorização Correta'].includes(tipo)) continue;
              const key = `${pA}|${pB}|${tipo}`;
              if (seen.has(key)) continue;
              seen.add(key);
              pairRecords.push({ a: pA, b: pB, tipo, motivo: getMotivo(rec, tipo) });
            }
          }
        }
        const byNum = new Map((rules || []).map((r) => [String(r?.num || ''), r]).filter(([k]) => !!k));
        const extractOutrosFields = (rule) => {
          const out = new Set();
          const addField = (rawKey) => {
            const k = clean(String(rawKey || ''));
            if (!k) return;
            out.add(k);
          };
          try {
            const clauses = Array.isArray(rule?.outrosCriterios?.clauses) ? rule.outrosCriterios.clauses : [];
            for (const clause of clauses) {
              if (!(clause instanceof Set)) continue;
              for (const raw of clause) {
                const part = clean(String(raw || ''));
                if (!part) continue;
                const i1 = part.indexOf(':');
                const i2 = part.indexOf('=');
                const idx = (i1 > 0 && i2 > 0) ? Math.min(i1, i2) : Math.max(i1, i2);
                if (idx > 0) addField(part.slice(0, idx));
              }
            }
          } catch (_) {}
          if (!out.size) {
            const txt = String(exprCanon(rule?.outrosCriterios, '') || '');
            txt.split('|').forEach((chunk) => {
              const part = clean(chunk || '');
              const i1 = part.indexOf(':');
              const i2 = part.indexOf('=');
              const idx = (i1 > 0 && i2 > 0) ? Math.min(i1, i2) : Math.max(i1, i2);
              if (idx > 0) addField(part.slice(0, idx));
            });
          }
          return out;
        };
        const ruleMeta = new Map();
        (rules || []).forEach((r) => {
          const num = String(r?.num || '').trim();
          if (!num) return;
          ruleMeta.set(num, {
            num,
            prio: clean(r?.prioridade || ''),
            remover: clean(exprCanon(r?.localizadorRemover, '') || ''),
            tipo: clean(exprCanon(r?.tipoControleCriterio, '') || ''),
            incluir: clean(exprCanon(r?.localizadorIncluirAcao, '') || ''),
            outrosCanon: clean(exprCanon(r?.outrosCriterios, '') || ''),
            outrosFields: extractOutrosFields(r)
          });
        });
        const normalizeTipo = (tipo, motivo) => {
          const t = String(tipo || '');
          const m = String(motivo || '').toLowerCase();
          if (t === 'Sobreposição' && m.includes('mais ampla está executando antes')) return 'Priorização Incorreta';
          return t;
        };
        const adj = new Map();
        const groupEdgeRecords = [];
        pairRecords.forEach((p) => {
          const a = String(p.a), b = String(p.b);
          if (!adj.has(a)) adj.set(a, new Set());
          if (!adj.has(b)) adj.set(b, new Set());
          adj.get(a).add(b);
          adj.get(b).add(a);
          groupEdgeRecords.push({ ...p, tipoAgrupado: normalizeTipo(p.tipo, p.motivo) });
        });
        const visited = new Set();
        const relationGroups = [];
        const allNodes = Array.from(adj.keys()).sort((x, y) => (Number(x) || 0) - (Number(y) || 0) || String(x).localeCompare(String(y)));
        allNodes.forEach((start) => {
          if (visited.has(start)) return;
          const q = [start];
          visited.add(start);
          const comp = [];
          while (q.length) {
            const cur = q.shift();
            comp.push(cur);
            for (const nx of Array.from(adj.get(cur) || [])) {
              if (visited.has(nx)) continue;
              visited.add(nx);
              q.push(nx);
            }
          }
          if (comp.length >= 2) relationGroups.push(comp.sort((x, y) => (Number(x) || 0) - (Number(y) || 0) || String(x).localeCompare(String(y))));
        });
        const countMapToText = (m) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' | ');
        const exprTokens = (txt) => {
          const raw = String(txt || '');
          if (!raw) return [];
          return raw
            .replace(/[()]/g, ' ')
            .split(/\s*(?:\|\||\||&&|;|,|\bOU\b|\bE\b)\s*/i)
            .map((p) => clean(p || ''))
            .filter((p) => !!p && p !== '[*]' && p !== 'E' && p !== 'OU');
        };
        const summarizeMany = (label, values, threshold) => {
          const uniq = Array.from(new Set((values || []).map((v) => clean(v || '')).filter(Boolean)));
          uniq.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
          if (!uniq.length) return `${label}: n/d`;
          const total = uniq.length;
          const maxShown = Math.max(3, Math.min(6, threshold - 1));
          const shown = total <= threshold ? uniq : uniq.slice(0, maxShown);
          const asText = shown.join(', ');
          if (total <= threshold) return `${label}: ${asText}`;
          return `${label}: ${asText} (+${total - shown.length} adicionais)`;
        };
        const cleanGatilhoAlvo = (txt) => {
          const normalizeKey = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          const stop = new Set([
            'por', 'tipo', 'criterio', 'tipo de controle', 'controle', 'misto',
            'evento', 'eventos', 'documento', 'documentos', 'peticao', 'peticoes',
            'tipo de peticao', 'tipos de peticao', 'tipo de documento', 'tipos de documento',
            'data', 'tempo', 'prazo', 'periodo', 'periodicamente', 'e', 'ou', 'and', 'or'
          ]);
          const t = clean(String(txt || '').replace(/^por\s+/i, '').replace(/^(evento|eventos|documento|documentos|peti[cç][aã]o|peti[cç][aã]oes|tipo\s*de\s*peti[cç][aã]o|tipo\s*de\s*documento|data|tempo|prazo|per[ií]odo|periodicamente)\s*[:=-]\s*/i, ''));
          const k = normalizeKey(t);
          if (!k || stop.has(k) || k.length < 2) return '';
          if (/^(art|inciso|paragrafo|§)\b/.test(k)) return '';
          if (/^(cf|cpc|cpp|lef)\b/.test(k)) return '';
          if (/^[0-9º°.,/\- ]+$/.test(k)) return '';
          return t;
        };
        const gatilhoNormKey = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ' ').replace(/\s+/g, ' ').trim();
        const isTempoNoLocalizadorToken = (txt) => {
          const k = gatilhoNormKey(txt);
          if (!k) return false;
          const hasLocator = /localizador/.test(k);
          const hasTempo = /(tempo|prazo|periodo|per[ií]odo|dias?|horas?|minutos?|semanas?|mes(?:es)?|anos?)/.test(k);
          const hasDiasCriterion = /(numero|n(?:u|ú)mero|qtd|quantidade)\s+de\s+dias?/.test(k) || /\b\d+\s*dias?\b/.test(k);
          return (hasLocator && hasTempo) || hasDiasCriterion;
        };
        const normalizeDataTempoAlvo = (raw, originalToken) => {
          const src = String(originalToken || raw || '');
          const k = gatilhoNormKey(src);
          if (/sem\s+moviment/.test(k)) return 'Verificação Processos Sem Movimentação';
          if (/tempo\s+na\s+situac/.test(k)) return 'Tempo na Situação';
          if (isTempoNoLocalizadorToken(src) || isTempoNoLocalizadorToken(raw)) return 'Tempo no Localizador';
          if (/por\s*data|periodicamente|data\s+ou\s+periodicamente|todos\s+os\s+dias|diari[ao]|a\s*cada|1\s*vez\s*a\s*cada|de\s*x\s*em\s*x/.test(k)) return 'Data ou Periodicamente';
          return cleanGatilhoAlvo(raw);
        };
        const splitGatilhoKinds = (tipoTxt) => {
          const out = { evento: [], peticao: [], documento: [], dataTempo: [], manual: [], outros: [] };
          exprTokens(tipoTxt).forEach((tok) => {
            const t = String(tok || '');
            const k = gatilhoNormKey(t);
            let kind = 'outros';
            let raw = t;
            if (/evento\s+ou\s+tipo\s+de\s+peti[cç][aã]o\s+ou\s+documento/.test(k)) {
              out.evento.push('Qualquer Evento');
              out.peticao.push('Qualquer Tipo de Petição');
              out.documento.push('Qualquer Documento');
              return;
            }
            else if (/a[cç][aã]o\s+manual/.test(k)) { kind = 'manual'; raw = 'Ação Manual'; }
            else if (/^\s*por\s*evento\s*:?/i.test(t)) { kind = 'evento'; raw = t.replace(/^\s*por\s*evento\s*:?/i, ''); }
            else if (/^\s*por\s*tipo\s*de\s*peti[cç][aã]o\s*:?/i.test(t)) { kind = 'peticao'; raw = t.replace(/^\s*por\s*tipo\s*de\s*peti[cç][aã]o\s*:?/i, ''); }
            else if (/^\s*por\s*tipo\s*de\s*documento\s*:?/i.test(t)) { kind = 'documento'; raw = t.replace(/^\s*por\s*tipo\s*de\s*documento\s*:?/i, ''); }
            else if (/^\s*(por\s*data|por\s*tempo|por\s*prazo|por\s*per[ií]odo|periodicamente|prazo|tempo|per[ií]odo)\b/i.test(t)) { kind = 'dataTempo'; raw = t.replace(/^\s*(por\s*data|por\s*tempo|por\s*prazo|por\s*per[ií]odo|periodicamente|prazo|tempo|per[ií]odo)\s*[:=-]?\s*/i, ''); }
            else if (isTempoNoLocalizadorToken(t)) { kind = 'dataTempo'; raw = t; }
            const c0 = kind === 'dataTempo' ? normalizeDataTempoAlvo(raw, t) : cleanGatilhoAlvo(raw);
            const c = (kind === 'evento' && !c0) ? 'Qualquer Evento'
              : (kind === 'peticao' && !c0) ? 'Qualquer Tipo de Petição'
                : (kind === 'documento' && !c0) ? 'Qualquer Documento'
                  : c0;
            if (c) out[kind].push(c);
          });
          return out;
        };
        const tipoDimensoes = (tipoTxt) => {
          const p = splitGatilhoKinds(tipoTxt);
          const dims = [];
          if (p.evento.length) dims.push('Evento');
          if (p.peticao.length) dims.push('Tipo de Petição');
          if (p.documento.length) dims.push('Documento');
          if (p.dataTempo.length) dims.push('Data/Tempo');
          if (p.manual.length) dims.push('Ação Manual');
          return dims;
        };
        const inferGatilhoTipo = (tipoTxt) => {
          const p = splitGatilhoKinds(tipoTxt);
          const labels = tipoDimensoes(tipoTxt);
          const hasTriplo = p.evento.includes('Qualquer Evento') && p.peticao.includes('Qualquer Tipo de Petição') && p.documento.includes('Qualquer Documento');
          if (hasTriplo && labels.length === 3 && !p.dataTempo.length && !p.manual.length) return 'Por Evento OU Tipo de Petição OU Documento';
          if (!labels.length) return 'Não identificado';
          if (labels.length === 1) return `Por ${labels[0]}`;
          return `Misto (${labels.join(' + ')})`;
        };
        const normalizeRemTokenKey = (tokenTxt) => {
          const base = String(tokenTxt || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const noPrefix = base.replace(/^(remover|localizador)\s+/i, '').trim();
          if (
            /^todos?$/.test(noPrefix) ||
            /^remover\s+todos?$/.test(base) ||
            /^todos?\s+os?\s+localizadores?$/.test(base) ||
            /^todos?\s+localizadores?$/.test(base) ||
            /^localizadores?\s+todos?$/.test(base)
          ) return '__TODOS__';
          return noPrefix || base;
        };
        const normalizeGatilhoTokenKey = (tokenTxt) => String(tokenTxt || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const extractRawGatilhoTokens = (tipoTxt) => {
          const raw = exprTokens(tipoTxt || '');
          return Array.from(new Set(raw
            .map((t) => String(t || '')
              .replace(/^\s*por\s*evento\s*[:/=-]?\s*/i, '')
              .replace(/^\s*por\s*tipo\s*de\s*peti[cç][aã]o\s*[:/=-]?\s*/i, '')
              .replace(/^\s*por\s*tipo\s*de\s*documento\s*[:/=-]?\s*/i, '')
              .replace(/^\s*(por\s*data|por\s*tempo|por\s*prazo|por\s*per[ií]odo|periodicamente)\s*[:/=-]?\s*/i, '')
              .trim())
            .map((t) => normalizeGatilhoTokenKey(t))
            .filter((k) => !!k && k.length >= 3)));
        };
        const extractPoloFromTipo = (tipoTxt) => {
          try {
            const src = String(tipoTxt || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
            const hasAtivo = /polo\s+ativo/.test(src);
            const hasPassivo = /polo\s+passivo/.test(src);
            if (hasAtivo && !hasPassivo) return { key: 'POLO_ATIVO', label: 'PÓLO ATIVO' };
            if (hasPassivo && !hasAtivo) return { key: 'POLO_PASSIVO', label: 'PÓLO PASSIVO' };
            if (hasAtivo && hasPassivo) return { key: 'POLO_AMBOS', label: 'PÓLO ATIVO/PASSIVO' };
            return { key: '__SEM_POLO__', label: 'sem pólo' };
          } catch (_) {
            return { key: '__SEM_POLO__', label: 'sem pólo' };
          }
        };
        const gatilhoBaseKey = (tipoTxt) => {
          const txt = String(tipoTxt || '');
          const p = splitGatilhoKinds(txt);
          const uniqSort = (arr) => Array.from(new Set((arr || []).map((x) => clean(x || '')).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
          let evento = uniqSort(p.evento);
          let peticao = uniqSort(p.peticao);
          let documento = uniqSort(p.documento);
          let dataTempo = uniqSort(p.dataTempo);
          let manual = uniqSort(p.manual);
          if (!dataTempo.length && /todos\s+os\s+dias|diari[ao]|periodicamente/i.test(txt)) dataTempo = ['Data ou Periodicamente'];
          const parts = [];
          if (evento.length) parts.push(`Evento:[${evento.join(' || ')}]`);
          if (peticao.length) parts.push(`Petição:[${peticao.join(' || ')}]`);
          if (documento.length) parts.push(`Documento:[${documento.join(' || ')}]`);
          if (dataTempo.length) parts.push(`Data/Tempo:[${dataTempo.join(' || ')}]`);
          if (manual.length) parts.push(`Ação Manual:[${manual.join(' || ')}]`);
          if (!parts.length) {
            const outros = uniqSort(p.outros);
            if (outros.length) return `Outros:[${outros.join(' || ')}]`;
            return 'Outros:[sem gatilho identificado]';
          }
          return parts.join(' + ');
        };
        const removerLogicKey = (remTxt) => {
          const raw = clean(remTxt || '') || '(REMOVER vazio)';
          const toks = Array.from(new Set(exprTokens(raw).map((t) => clean(t || '')).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
          if (!toks.length) return raw;
          return `L:[${toks.join(' && ')}]`;
        };
        const removerFamilyKey = (remTxt) => {
          const raw = clean(remTxt || '') || '(REMOVER vazio)';
          const toks = exprTokens(raw).map((t) => clean(t || '')).filter(Boolean);
          return toks.length ? toks[0] : raw;
        };
        const classifyRemTokenAsSystem = (tokenTxt) => {
          try {
            const token = String(tokenTxt || '').trim();
            if (!token || token === '[*]' || token === 'E' || token === 'OU') return false;
            const cfg = (typeof ATP_CONFIG === 'object' && ATP_CONFIG && ATP_CONFIG.localizadoresSistema) ? ATP_CONFIG.localizadoresSistema : {};
            const normPlain = (s) => String(s || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const normKey = (s) => normPlain(
              String(s || '')
                .replace(/&#x?[0-9a-f]+;/gi, ' ')
                .replace(/[^\p{L}\p{N}\-+\/.& ]+/gu, ' ')
            ).toUpperCase().replace(/\s+/g, ' ').trim();
            const names = Array.isArray(cfg.nomes) ? cfg.nomes : [];
            const descs = Array.isArray(cfg.descricoes) ? cfg.descricoes : [];
            const sysNameSet = new Set([...names, ...descs].map((v) => normKey(v)).filter(Boolean));
            const parts = token.split(' - ');
            if (parts.length >= 2) {
              const sig = normKey(parts[0]);
              const nam = normKey(parts.slice(1).join(' - '));
              if (sysNameSet.has(sig) || sysNameSet.has(nam)) return true;
              const sigRaw = String(parts[0] || '').trim();
              if (sigRaw && sigRaw === sigRaw.toUpperCase() && /[A-ZÀ-Ý]/.test(sigRaw)) return true;
            }
            const nk = normKey(token);
            if (sysNameSet.has(nk)) return true;
            const p = normPlain(token);
            return !!(p && p === p.toUpperCase() && !/\s/.test(p) && /[A-ZÀ-Ý]/.test(p));
          } catch (_) {
            return false;
          }
        };
        const isWeakRemToken = (tokenTxt) => {
          const k = gatilhoNormKey(String(tokenTxt || '')).replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim();
          if (!k) return true;
          if (k.length < 6) return true;
          if (/^(peticao|peticao urgente|evento|documento|acao manual|localizador)$/.test(k)) return true;
          if (/^(p|e|d)$/.test(k)) return true;
          return false;
        };
        const summarizeSpecificGatilho = (tipoTxt) => {
          const txt = String(tipoTxt || '');
          const p = splitGatilhoKinds(txt);
          const uniqSort = (arr) => Array.from(new Set((arr || []).map((x) => clean(x || '')).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
          const evento = uniqSort(p.evento);
          const peticao = uniqSort(p.peticao);
          const documento = uniqSort(p.documento);
          let dataTempo = uniqSort(p.dataTempo);
          const manual = uniqSort(p.manual);
          const hasTriplo = evento.includes('Qualquer Evento') && peticao.includes('Qualquer Tipo de Petição') && documento.includes('Qualquer Documento');
          if (!dataTempo.length && /todos\s+os\s+dias|diari[ao]|periodicamente/i.test(txt)) dataTempo = ['Data ou Periodicamente'];
          const out = [];
          if (hasTriplo) out.push('Composto:[Evento OU Tipo de Petição OU Documento]');
          if (evento.length) out.push(evento.length <= 4 ? `Evento:[${evento.join(' | ')}]` : `Evento:[${evento.length} tipos]`);
          if (peticao.length) {
            const byTema = new Map();
            peticao.forEach((v) => {
              const tema = inferSubgrupoPeticao(v);
              byTema.set(tema, (byTema.get(tema) || 0) + 1);
            });
            const temas = Array.from(byTema.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k}(${n})`);
            out.push(`Petição:[${peticao.length} tipos${temas.length ? `; ${temas.join(', ')}` : ''}]`);
          }
          if (documento.length) out.push(documento.length <= 4 ? `Documento:[${documento.join(' | ')}]` : `Documento:[${documento.length} tipos]`);
          if (dataTempo.length) out.push(dataTempo.length <= 3 ? `Data/Tempo:[${dataTempo.join(' | ')}]` : `Data/Tempo:[${dataTempo.length} critérios]`);
          if (manual.length) out.push('Ação Manual:[Ação Manual]');
          if (!out.length) {
            const outros = uniqSort(p.outros);
            if (outros.length) return `Outros:[${outros.length} critérios]`;
            return 'Outros:[sem gatilho identificado]';
          }
          return out.join(' + ');
        };
        const extractGatilhoAlvos = (tipoTxt) => {
          const p = splitGatilhoKinds(tipoTxt);
          return [...p.evento, ...p.peticao, ...p.documento, ...p.dataTempo, ...p.manual, ...p.outros];
        };
        const summarizeTipoComum = (tipoTxt) => {
          const txt = clean(tipoTxt || '');
          if (!txt) return 'TIPO: variação interna';
          const parts = splitGatilhoKinds(txt);
          const dims = tipoDimensoes(txt);
          if (!dims.length) return `TIPO comum: ${txt}`;
          if (dims.length > 1) return `TIPO comum: Misto (${dims.join(' + ')})`;
          const dim = dims[0];
          const map = { 'Evento': parts.evento, 'Tipo de Petição': parts.peticao, 'Documento': parts.documento, 'Data/Tempo': parts.dataTempo, 'Ação Manual': parts.manual };
          const alvos = Array.from(new Set(map[dim] || []));
          if (dim === 'Tipo de Petição') {
            const temas = Array.from(new Set(alvos.map((v) => inferSubgrupoPeticao(v))));
            if (alvos.length >= 25 || temas.length >= 4) return `TIPO comum: Por Tipo de Petição (não específica; catálogo amplo com ${alvos.length} tipos)`;
          }
          if (alvos.length > 6) return `TIPO comum: Por ${dim} (${alvos.length} itens)`;
          if (alvos.length) return `TIPO comum: Por ${dim}: ${alvos.join(', ')}`;
          return `TIPO comum: Por ${dim}`;
        };
        const inferSubgrupoPeticao = (alvoTxt) => {
          const s = String(alvoTxt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ' ');
          if (/contest|defesa|impugn|excec|reconven|replica/.test(s)) return 'Defesa e Contestação';
          if (/recurso|agravo|contrarrazo|razoes|apela|uniformizacao/.test(s)) return 'Recursos';
          if (/acordo|concili|autocompos|transacao|nao[- ]?persecucao|anpp/.test(s)) return 'Acordos e Autocomposição';
          if (/perici|laudo|quesito|imesc|perito|exame criminologico/.test(s)) return 'Perícia e Prova Técnica';
          if (/sisbajud|renajud|infojud|serasajud|spc|penhor|arrest|leilao|bloqueio|desbloqueio|execucao fiscal|cda/.test(s)) return 'Pesquisa Patrimonial e Execução';
          if (/dilacao|prazo|suspens|tempo|periodo/.test(s)) return 'Prazos e Suspensão';
          if (/indulto|comutacao|progressao|regressao|remissao|saida temporaria|livramento|prisao domiciliar|trabalho externo|transferencia de preso|soma de penas/.test(s)) return 'Execução Penal';
          if (/habilit|herdeir|cessao de credito|alteracao de dados/.test(s)) return 'Habilitação e Cadastro';
          if (/juntada|oficio|manifestacao|peticao|pedido|informacoes|despacho|comunicacao|ciencia|termo/.test(s)) return 'Andamento e Comunicação';
          return 'Outros';
        };
        const summarizeSubgruposPeticao = (values, threshold) => {
          const temas = (values || []).map((v) => inferSubgrupoPeticao(v)).filter(Boolean);
          return summarizeMany('Subgrupos de petição', temas, threshold);
        };
        const summarizeFiltroCampos = (tokens) => {
          const fields = Array.from(new Set((tokens || []).map((t) => {
            const s = clean(t || '');
            const m = s.match(/^([^:=]+)\s*[:=]/);
            return clean(m ? m[1] : '');
          }).filter(Boolean)));
          if (!fields.length) return 'Campos de filtro: n/d';
          fields.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
          if (fields.length <= 5) return `Campos de filtro: ${fields.join(', ')}`;
          return `Campos de filtro: ${fields.slice(0, 5).join(', ')} (+${fields.length - 5} adicionais)`;
        };
        const groupCardsHtml = relationGroups.length ? relationGroups.map((members, idx) => {
          const memberSet = new Set(members);
          const rels = groupEdgeRecords.filter((e) => memberSet.has(String(e.a)) && memberSet.has(String(e.b)));
          const tipoCounts = new Map();
          rels.forEach((e) => tipoCounts.set(e.tipoAgrupado, (tipoCounts.get(e.tipoAgrupado) || 0) + 1));
          const metas = members.map((n) => ruleMeta.get(n)).filter(Boolean);
          const pickCommon = (arr) => {
            if (!arr.length) return '';
            const v = arr[0];
            for (const x of arr) if (x !== v) return '';
            return v;
          };
          const commonRem = pickCommon(metas.map((m) => m.remover));
          const commonTipo = pickCommon(metas.map((m) => m.tipo));
          const commonInc = pickCommon(metas.map((m) => m.incluir));
          const interFields = (() => {
            if (!metas.length) return [];
            let base = new Set(metas[0].outrosFields || new Set());
            metas.slice(1).forEach((m) => {
              base = new Set(Array.from(base).filter((f) => m.outrosFields.has(f)));
            });
            return Array.from(base);
          })();
          const unionFields = (() => {
            const u = new Set();
            metas.forEach((m) => (m.outrosFields || new Set()).forEach((f) => u.add(f)));
            return Array.from(u);
          })();
          const varFields = unionFields.filter((f) => !interFields.includes(f));
          const prios = metas.map((m) => m.prio).filter(Boolean);
          const gatilhoTipos = metas.map((m) => inferGatilhoTipo(m.tipo));
          const gatilhoPartes = metas.map((m) => splitGatilhoKinds(m.tipo));
          const eventoAlvos = gatilhoPartes.flatMap((p) => p.evento);
          const peticaoAlvos = gatilhoPartes.flatMap((p) => p.peticao);
          const documentoAlvos = gatilhoPartes.flatMap((p) => p.documento);
          const dataAlvos = gatilhoPartes.flatMap((p) => p.dataTempo);
          const remTokens = metas.flatMap((m) => exprTokens(m.remover));
          const filtrosTokens = metas.flatMap((m) => exprTokens(m.outrosCanon));
          const eventoSummary = summarizeMany('Gatilho de Evento', eventoAlvos, 8);
          const peticaoSummary = summarizeMany('Gatilho de Petição', peticaoAlvos, 8);
          const documentoSummary = summarizeMany('Gatilho de Documento', documentoAlvos, 8);
          const dataSummary = summarizeMany('Gatilho de Data/Tempo', dataAlvos, 8);
          const subgruposSummary = summarizeSubgruposPeticao(peticaoAlvos, 7);
          const filtrosCamposSummary = summarizeFiltroCampos(filtrosTokens);
          const dimsSet = Array.from(new Set(gatilhoTipos));
          const resumoParts = [];
          if (!commonTipo && dimsSet.length) resumoParts.push(dimsSet.length === 1 ? `Gatilho principal: ${dimsSet[0]}` : `Gatilho principal: Misto (${dimsSet.join(' + ')})`);
          if (!commonTipo && eventoAlvos.length) resumoParts.push(eventoSummary);
          if (!commonTipo && peticaoAlvos.length) resumoParts.push(peticaoSummary);
          if (peticaoAlvos.length) resumoParts.push(subgruposSummary);
          if (!commonTipo && documentoAlvos.length) resumoParts.push(documentoSummary);
          if (!commonTipo && dataAlvos.length) resumoParts.push(dataSummary);
          resumoParts.push(filtrosCamposSummary);
          const resumoFinal = resumoParts.join(' • ');
          const skel = [
            commonRem ? `REMOVER comum: ${commonRem}` : 'REMOVER: variação interna',
            summarizeTipoComum(commonTipo),
            commonInc ? `AÇÃO comum: ${commonInc}` : 'AÇÃO: variação interna',
            interFields.length ? `Outros (núcleo): ${interFields.join(', ')}` : 'Outros (núcleo): sem campo comum único'
          ].join(' • ');
          const vars = [
            varFields.length ? `Campos variáveis em Outros: ${varFields.join(', ')}` : 'Campos variáveis em Outros: sem variação',
            prios.length ? `Prioridades no grupo: ${Array.from(new Set(prios)).join(', ')}` : 'Prioridades no grupo: n/d'
          ].join(' • ');
          return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff"><div style="display:flex;justify-content:space-between;gap:8px"><strong>Grupo ${idx + 1}</strong><span style="color:#334155">Regras: ${members.length} | Relações: ${rels.length}</span></div><div style="margin-top:6px;color:#0f172a"><strong>Regras:</strong> ${members.join(', ')}</div><div style="margin-top:6px;color:#0f172a"><strong>Tipos no grupo:</strong> ${countMapToText(tipoCounts) || 'n/d'}</div><div style="margin-top:6px;color:#0f172a"><strong>Esqueleto:</strong> ${esc(skel)}</div><div style="margin-top:6px;color:#0f172a"><strong>Variações:</strong> ${esc(vars)}</div><div style="margin-top:6px;color:#0f172a"><strong>Resumo inteligente:</strong> ${esc(resumoFinal)}</div></div>`;
        }).join('') : '<div>Sem grupos com 2+ regras no recorte atual.</div>';
        const allRuleNums = Array.from(ruleMeta.keys()).sort((x, y) => (Number(x) || 0) - (Number(y) || 0) || String(x).localeCompare(String(y)));
        const conflictRuleSet = new Set(pairRecords.flatMap((p) => [String(p.a), String(p.b)]));
        const semConflito = allRuleNums.filter((n) => !conflictRuleSet.has(n));
        const coverageByTipo = new Map();
        allRuleNums.forEach((n) => {
          const meta = ruleMeta.get(n);
          const tipo = inferGatilhoTipo(meta?.tipo || '');
          if (!coverageByTipo.has(tipo)) coverageByTipo.set(tipo, []);
          coverageByTipo.get(tipo).push(n);
        });
        const coverageGroups = Array.from(coverageByTipo.entries())
          .map(([tipo, members]) => ({ tipo, members: members.slice().sort((x, y) => (Number(x) || 0) - (Number(y) || 0) || String(x).localeCompare(String(y))) }))
          .sort((a, b) => b.members.length - a.members.length || String(a.tipo).localeCompare(String(b.tipo), 'pt-BR'));
        const coverageHtml = coverageGroups.length
          ? `<div style="margin-bottom:8px;color:#334155">Cobertura geral: ${allRuleNums.length} regras | Em conflito/pseudoconflito: ${conflictRuleSet.size} | Sem conflito/pseudoconflito: ${semConflito.length}</div><div style="display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:10px">${coverageGroups.map((g) => `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px"><div><strong>${esc(g.tipo)}</strong></div><div style="color:#64748b;font-size:12px;margin-top:2px">Regras no tipo: ${g.members.length}</div><div style="margin-top:6px;font-size:12px;line-height:1.6">${(g.members.length <= 36 ? g.members : g.members.slice(0, 36)).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}${g.members.length > 36 ? `<span style="display:inline-block;color:#64748b;margin-left:6px">+${g.members.length - 36} regras</span>` : ''}</div></div>`).join('')}</div>`
          : '<div>Sem regras para agrupar.</div>';
        const containsEdges = [];
        const interRows = [];
        pairRecords.forEach((r) => {
          const m = String(r.motivo || '');
          if (r.tipo === 'Priorização Correta') {
            const mr = m.match(/regra\s+(\d+)\s+mais\s+restrita[\s\S]*?regra\s+(\d+)\s+mais\s+abrangente/i);
            if (mr) {
              containsEdges.push({ broad: String(mr[2]), narrow: String(mr[1]), tipo: r.tipo, base: `${r.a} x ${r.b}`, motivo: m });
            }
            return;
          }
          const isInter = r.tipo === 'Priorização' || /interse[cç][aã]o|prioriza[cç][aã]o necess[aá]ria|contexto de/i.test(m);
          if (isInter) {
            const eixo = (m.match(/Prioriza\s+([^.;]+?)\s+sobre\s+([^.;]+?)(?:[.;]|$)/i)?.slice(1, 3) || []);
            const comum = eixo.length ? `${eixo[0]} sobre ${eixo[1]}` : (m.match(/em\s+([^.;]+)(?:[.;]|$)/i)?.[1] || '').trim();
            const detalheCurto = String(m || '').replace(/\s+/g, ' ').trim().slice(0, 180);
            interRows.push({
              par: `${r.a} x ${r.b}`,
              tipo: r.tipo,
              comum: comum || 'Interseção em múltiplos critérios',
              detalhe: detalheCurto,
              motivo: m
            });
          }
        });
        const containsUnique = (() => {
          const m = new Map();
          containsEdges.forEach((e) => {
            const k = `${e.broad}|${e.narrow}`;
            if (!m.has(k)) m.set(k, e);
          });
          return Array.from(m.values());
        })();
        const nodes = Array.from(new Set([...containsUnique.map((e) => e.broad), ...containsUnique.map((e) => e.narrow)])).sort((x, y) => (Number(x) || 0) - (Number(y) || 0) || String(x).localeCompare(String(y)));
        const children = new Map(nodes.map((n) => [n, []]));
        const parent = new Map();
        for (const e of containsUnique) {
          if (!parent.has(e.narrow)) parent.set(e.narrow, e.broad);
        }
        for (const [ch, pa] of parent.entries()) {
          if (!children.has(pa)) children.set(pa, []);
          children.get(pa).push(ch);
        }
        const roots = nodes.filter((n) => !parent.has(n));
        const countDesc = (n) => {
          const kids = children.get(n) || [];
          let total = kids.length;
          for (const k of kids) total += countDesc(k);
          return total;
        };
        const collectGroupMembers = (n, out) => {
          out.push(n);
          const kids = children.get(n) || [];
          for (const k of kids) collectGroupMembers(k, out);
        };
        const renderTree = (n) => {
          const kids = (children.get(n) || []).sort((a, b) => String(a).localeCompare(String(b)));
          let h = `<li><strong>${esc(n)}</strong>`;
          if (kids.length) {
            h += '<ul>';
            kids.forEach((k) => { h += renderTree(k); });
            h += '</ul>';
          }
          h += '</li>';
          return h;
        };
        const rootsSorted = roots.slice().sort((a, b) => countDesc(b) - countDesc(a) || String(a).localeCompare(String(b)));
        const treeHtml = containsUnique.length
          ? `<div style="margin-bottom:6px;color:#334155">Grupos detectados: ${rootsSorted.length} | Regras em contenção: ${nodes.length}</div><ul>${rootsSorted.map((r) => renderTree(r)).join('')}</ul>`
          : '<div>Sem contenções objetivas detectadas. Isso é esperado quando predominam interseções humanas (Priorização).</div>';
        const containmentGroups = rootsSorted.map((root) => {
          const members = [];
          collectGroupMembers(root, members);
          const memberSet = new Set(members);
          let conflicts = 0;
          interRows.forEach((row) => {
            const sp = String(row.par || '').split(' x ');
            if (sp.length !== 2) return;
            if (memberSet.has(sp[0]) || memberSet.has(sp[1])) conflicts += 1;
          });
          return { root, members, conflicts };
        });
        const groupsHtml = containmentGroups.length
          ? `<div style="margin-bottom:8px;color:#334155">Cada grupo começa na regra raiz e lista todas as regras contidas.</div><div style="display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:10px">${containmentGroups.map((g) => `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px"><div><strong>Grupo raiz ${esc(g.root)}</strong></div><div style="color:#64748b;font-size:12px;margin-top:2px">Regras no grupo: ${g.members.length} | Interseções envolvendo o grupo: ${g.conflicts}</div><div style="margin-top:6px;font-size:12px;line-height:1.6">${g.members.map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}</div></div>`).join('')}</div>`
          : '<div>Sem grupos por contenção para mostrar.</div>';
        const rulesForGrouping = allRuleNums.map((n) => {
          const m = ruleMeta.get(String(n));
          if (!m) return null;
          const rem = clean(m.remover || '') || '(REMOVER vazio)';
          const remKey = removerLogicKey(rem);
          const remTokens = Array.from(new Set(exprTokens(rem).map((t) => clean(t || '')).filter(Boolean)));
          const remTokenKeys = Array.from(new Set(remTokens.map((t) => normalizeRemTokenKey(t)).filter(Boolean)));
          const p = splitGatilhoKinds(m.tipo || '');
          const gatTokensRaw = [...p.evento, ...p.peticao, ...p.documento, ...p.dataTempo, ...p.manual];
          const gatTokenKeysFromKinds = Array.from(new Set(gatTokensRaw.map((t) => normalizeGatilhoTokenKey(t)).filter(Boolean)));
          const gatTokenKeysFromRaw = extractRawGatilhoTokens(m.tipo || '');
          const gatTokenKeys = Array.from(new Set([...gatTokenKeysFromKinds, ...gatTokenKeysFromRaw]));
          const gatTypeKey = inferGatilhoTipo(m.tipo || '');
          const gatKey = gatilhoBaseKey(m.tipo || '') || '(gatilho vazio)';
          const gatLabel = summarizeSpecificGatilho(m.tipo || '');
          const polo = extractPoloFromTipo(m.tipo || '');
          return { n: String(n), rem, remKey, remTokens, remTokenKeys, gatKey, gatTypeKey, gatTokenKeys, gatTokensNamed: gatTokensRaw, gatLabel, tipoRaw: String(m.tipo || ''), poloKey: polo.key, poloLabel: polo.label };
        }).filter(Boolean);
        const gatilhoCompativel = (a, b) => {
          if (!a || !b) return false;
          if (String(a.gatTypeKey || '') !== String(b.gatTypeKey || '')) return false;
          if (String(a.gatKey || '') === String(b.gatKey || '')) return true;
          const A = (a.gatTokenKeys || []).filter(Boolean);
          const B = (b.gatTokenKeys || []).filter(Boolean);
          // Se não conseguimos extrair tokens de gatilho de um dos lados,
          // mantemos compatibilidade por tipo para não quebrar agrupamento válido.
          if (!A.length || !B.length) return true;
          return A.some((x) => B.includes(x));
        };
        const byGat = new Map();
        rulesForGrouping.forEach((r) => {
          if (!byGat.has(r.gatTypeKey)) byGat.set(r.gatTypeKey, []);
          byGat.get(r.gatTypeKey).push(r);
        });
        const skeletonGroupsAll = [];
        byGat.forEach((arr, gatKey) => {
          const byId = new Map(arr.map((r) => [r.n, r]));
          const tokMap = new Map();
          const tokLabelMap = new Map();
          arr.forEach((r) => {
            const keys = (r.remTokenKeys && r.remTokenKeys.length) ? r.remTokenKeys : ['__REMOVER_VAZIO__'];
            keys.forEach((k) => {
              const isSpecial = String(k).startsWith('__');
              if (!isSpecial && k !== '__TODOS__' && isWeakRemToken(k)) return;
              if (!tokMap.has(k)) tokMap.set(k, []);
              if (!tokLabelMap.has(k)) {
                const raw = k === '__REMOVER_VAZIO__'
                  ? 'REMOVER vazio'
                  : ((r.remTokens || []).find((rt) => normalizeRemTokenKey(rt) === k) || (k === '__TODOS__' ? 'TODOS' : k));
                tokLabelMap.set(k, raw);
              }
              tokMap.get(k).push(r.n);
            });
          });
          const minAUnitSize = (() => {
            try {
              if (ATP_CONFIG && Number.isFinite(Number(ATP_CONFIG.tamanhoMinGrupoAUnidade))) return Math.max(2, Number(ATP_CONFIG.tamanhoMinGrupoAUnidade));
            } catch (_) {}
            return 3;
          })();
          const candidatesRaw = Array.from(tokMap.entries())
            .map(([tok, ids]) => ({ tok, ids: Array.from(new Set(ids)).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')) }))
            .filter((c) => c.ids.length >= 2)
            .sort((a, b) => b.ids.length - a.ids.length || String(a.tok).localeCompare(String(b.tok), 'pt-BR'));
          const candidates = candidatesRaw.map((c) => ({ ...c, remClass: 'mixed' }));
          const used = new Set();
          candidates.forEach((c) => {
            const pool = c.ids.filter((id) => !used.has(String(id)));
            if (pool.length < 2) return;
            const isSpecialRem = String(c.tok) === '__TODOS__' || String(c.tok) === '__REMOVER_VAZIO__';
            if (isSpecialRem) {
              const byShownGat = new Map();
              pool.forEach((id) => {
                const lbl = String(byId.get(String(id))?.gatLabel || 'n/d');
                if (!byShownGat.has(lbl)) byShownGat.set(lbl, []);
                byShownGat.get(lbl).push(String(id));
              });
              byShownGat.forEach((idsShown) => {
                const members = Array.from(new Set(idsShown))
                  .sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'));
                if (members.length < 2) return;
                members.forEach((id) => used.add(String(id)));
                const remVariantsSet = new Set(members.map((id) => byId.get(id).rem));
                const remLabel = tokLabelMap.get(c.tok) || c.tok;
                skeletonGroupsAll.push({
                  rem: Array.from(remVariantsSet)[0] || '(REMOVER vazio)',
                  remKey: `L:[${remLabel}]`,
                  remCommonTokens: [remLabel],
                  remSharedTokens: [remLabel],
                  remUnionTokens: [remLabel],
                  remJoinEvidence: [`${remLabel} => ${members.slice(0, 6).join(', ')}${members.length > 6 ? ` (+${members.length - 6})` : ''}`],
                  remJoinEvidenceFull: [{ tok: remLabel, ids: members.slice() }],
                  remJoinMode: 'Grupo por REMOVER especial (TODOS/vazio) + gatilho exibido.',
                  remClass: 'special',
                  remVariants: Array.from(remVariantsSet),
                  gatKey,
                  gatLabel: byId.get(members[0])?.gatLabel || 'n/d',
                  members
                });
              });
            }
            // 1) Regra prioritária: mesmo localizador + gatilho EXATO => mesmo grupo.
            const byExactGat = new Map();
            pool.forEach((id) => {
              if (used.has(String(id))) return;
              const gk = String(byId.get(String(id))?.gatKey || '(gatilho vazio)');
              if (!byExactGat.has(gk)) byExactGat.set(gk, []);
              byExactGat.get(gk).push(String(id));
            });
            byExactGat.forEach((idsExact) => {
              const members = Array.from(new Set(idsExact)).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'));
              if (members.length < 2) return;
              if (!isSpecialRem && c.remClass === 'unit' && members.length < minAUnitSize) return;
              members.forEach((id) => used.add(String(id)));
              const remVariantsSet = new Set(members.map((id) => byId.get(id).rem));
              const tokenCount = new Map();
              members.forEach((id) => (byId.get(id).remTokens || []).forEach((t) => {
                const k = normalizeRemTokenKey(t);
                if (k !== '__TODOS__' && isWeakRemToken(k)) return;
                tokenCount.set(k, (tokenCount.get(k) || 0) + 1);
              }));
              const sharedTokens = Array.from(tokenCount.entries())
                .filter(([, n]) => n >= 2)
                .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'))
                .map(([k]) => tokLabelMap.get(k) || k);
              const unionTokens = Array.from(new Set(members.flatMap((id) => (byId.get(id).remTokens || []).filter((t) => {
                const k = normalizeRemTokenKey(t);
                return k === '__TODOS__' || !isWeakRemToken(k);
              })))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
              const joinEvidenceFull = [{ tok: tokLabelMap.get(c.tok) || c.tok, ids: members.slice() }];
              skeletonGroupsAll.push({
                rem: Array.from(remVariantsSet)[0] || '(REMOVER vazio)',
                remKey: `L:[${tokLabelMap.get(c.tok) || c.tok}]`,
                remCommonTokens: [tokLabelMap.get(c.tok) || c.tok],
                remSharedTokens: sharedTokens,
                remUnionTokens: unionTokens,
                remJoinEvidence: [`${tokLabelMap.get(c.tok) || c.tok} => ${members.slice(0, 6).join(', ')}${members.length > 6 ? ` (+${members.length - 6})` : ''}`],
                remJoinEvidenceFull: joinEvidenceFull,
                remJoinMode: 'Grupo por localizador comum + gatilho exato.',
                remClass: c.remClass || 'unit',
                remVariants: Array.from(remVariantsSet),
                gatKey,
                gatLabel: byId.get(members[0])?.gatLabel || 'n/d',
                members
              });
            });
            const poolAfterExact = pool.filter((id) => !used.has(String(id)));
            if (poolAfterExact.length < 2) return;
            const adj = new Map(poolAfterExact.map((id) => [String(id), new Set()]));
            for (let i = 0; i < poolAfterExact.length; i += 1) {
              for (let j = i + 1; j < poolAfterExact.length; j += 1) {
                const aId = String(poolAfterExact[i]);
                const bId = String(poolAfterExact[j]);
                const a = byId.get(aId);
                const b = byId.get(bId);
                if (!gatilhoCompativel(a, b)) continue;
                adj.get(aId).add(bId);
                adj.get(bId).add(aId);
              }
            }
            const seenLocal = new Set();
            poolAfterExact.forEach((seed) => {
              const sid = String(seed);
              if (seenLocal.has(sid)) return;
              const q = [sid];
              seenLocal.add(sid);
              const group = [];
              while (q.length) {
                const cur = q.shift();
                group.push(cur);
                (adj.get(cur) || new Set()).forEach((nx) => {
                  if (seenLocal.has(nx)) return;
                  seenLocal.add(nx);
                  q.push(nx);
                });
              }
              if (group.length < 2) return;
              if (!isSpecialRem && c.remClass === 'unit' && group.length < minAUnitSize) return;
              group.forEach((id) => used.add(String(id)));
              const members = group.sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'));
              const remVariantsSet = new Set(members.map((id) => byId.get(id).rem));
              const tokenCount = new Map();
              members.forEach((id) => (byId.get(id).remTokens || []).forEach((t) => {
                const k = normalizeRemTokenKey(t);
                if (k !== '__TODOS__' && isWeakRemToken(k)) return;
                tokenCount.set(k, (tokenCount.get(k) || 0) + 1);
              }));
              const sharedTokens = Array.from(tokenCount.entries())
                .filter(([, n]) => n >= 2)
                .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'))
                .map(([k]) => tokLabelMap.get(k) || k);
              const unionTokens = Array.from(new Set(members.flatMap((id) => (byId.get(id).remTokens || []).filter((t) => {
                const k = normalizeRemTokenKey(t);
                return k === '__TODOS__' || !isWeakRemToken(k);
              })))).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
              const joinEvidenceFull = [{
                tok: tokLabelMap.get(c.tok) || c.tok,
                ids: members.slice()
              }];
              skeletonGroupsAll.push({
                rem: Array.from(remVariantsSet)[0] || '(REMOVER vazio)',
                remKey: `L:[${tokLabelMap.get(c.tok) || c.tok}]`,
                remCommonTokens: [tokLabelMap.get(c.tok) || c.tok],
                remSharedTokens: sharedTokens,
                remUnionTokens: unionTokens,
                remJoinEvidence: [`${tokLabelMap.get(c.tok) || c.tok} => ${members.slice(0, 6).join(', ')}${members.length > 6 ? ` (+${members.length - 6})` : ''}`],
                remJoinEvidenceFull: joinEvidenceFull,
                remJoinMode: 'Grupo por localizador comum a 100% das regras do grupo.',
                remClass: c.remClass || 'unit',
                remVariants: Array.from(remVariantsSet),
                gatKey,
                gatLabel: byId.get(members[0])?.gatLabel || 'n/d',
                members
              });
            });
          });
          arr.forEach((r) => {
            if (used.has(String(r.n))) return;
            skeletonGroupsAll.push({
              rem: r.rem,
              remKey: r.remKey || 'L:[variação de localizador]',
              remCommonTokens: [],
              remSharedTokens: [],
              remUnionTokens: (r.remTokens || []).slice(),
              remJoinEvidence: [],
              remJoinEvidenceFull: [],
              remJoinMode: 'Sem localizador comum com outra regra do mesmo gatilho.',
              remClass: classifyRemTokenAsSystem((r.remTokens && r.remTokens[0]) || r.remKey || r.rem) ? 'system' : 'unit',
              remVariants: [r.rem],
              gatKey,
              gatLabel: r.gatLabel || 'n/d',
              members: [String(r.n)]
            });
          });
        });
        skeletonGroupsAll.sort((a, b) => b.members.length - a.members.length || String(a.gatLabel).localeCompare(String(b.gatLabel), 'pt-BR'));
        const rulesByNum = new Map(rulesForGrouping.map((r) => [String(r.n), r]));
        let skeletonGroups = skeletonGroupsAll.filter((g) => g.members.length >= 2);
        let orphanRules = skeletonGroupsAll.filter((g) => g.members.length === 1).map((g) => String(g.members[0]));
        // Segunda passada: promove órfãos para grupos quando há padrão inequívoco
        // em REMOVER especial (TODOS/vazio), usando compatibilidade de gatilho.
        const specialClass = (r) => {
          const ks = (r?.remTokenKeys && r.remTokenKeys.length) ? r.remTokenKeys : ['__REMOVER_VAZIO__'];
          if (ks.includes('__TODOS__')) return '__TODOS__';
          if (ks.includes('vazio')) return '__REMOVER_VAZIO__';
          if (ks.includes('__REMOVER_VAZIO__')) return '__REMOVER_VAZIO__';
          const remRaw = `${String(r?.rem || '')} ${String(r?.remKey || '')}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ' ');
          if (/todos?\s+os?\s+localizadores?/.test(remRaw) || /remover\s+todos?/.test(remRaw)) return '__TODOS__';
          if (/remover\s+vazio|\(remover\s+vazio\)|\bvazio\b/.test(remRaw)) return '__REMOVER_VAZIO__';
          if (!ks.length) return '__REMOVER_VAZIO__';
          return '';
        };
        const primaryGatilhoClass = (r) => {
          const p = splitGatilhoKinds(String(r?.tipoRaw || ''));
          if ((p.evento || []).length) return 'EVENTO';
          if ((p.peticao || []).length) return 'PETICAO';
          if ((p.documento || []).length) return 'DOCUMENTO';
          if ((p.dataTempo || []).length) return 'DATA_TEMPO';
          if ((p.manual || []).length) return 'MANUAL';
          return 'OUTROS';
        };
        const orphanBuckets = new Map();
        orphanRules.forEach((n) => {
          const r = rulesByNum.get(String(n));
          if (!r) return;
          const cls = specialClass(r);
          if (!cls) return;
          const gatCls = primaryGatilhoClass(r);
          const key = `${gatCls}|||${String(r.poloKey || '__SEM_POLO__')}|||${cls}`;
          if (!orphanBuckets.has(key)) orphanBuckets.set(key, []);
          orphanBuckets.get(key).push(String(n));
        });
        const orphanSpecialBucketDiag = Array.from(orphanBuckets.entries())
          .map(([k, v]) => `${k} (${Array.from(new Set(v)).length})`)
          .sort((a, b) => {
            const na = Number((a.match(/\((\d+)\)$/) || [0, 0])[1]) || 0;
            const nb = Number((b.match(/\((\d+)\)$/) || [0, 0])[1]) || 0;
            return nb - na || String(a).localeCompare(String(b), 'pt-BR');
          });
        const promoted = [];
        orphanBuckets.forEach((ids, key) => {
          const uniq = Array.from(new Set(ids)).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'));
          if (uniq.length < 2) return;
          const cls = key.split('|||')[2];
          const lbl = cls === '__TODOS__' ? 'TODOS' : 'REMOVER vazio';
          const members = uniq.slice();
          const first = rulesByNum.get(members[0]);
          promoted.push({
            rem: first?.rem || '(REMOVER vazio)',
            remKey: `L:[${lbl}]`,
            remCommonTokens: [lbl],
            remSharedTokens: [lbl],
            remUnionTokens: [lbl],
            remJoinEvidence: [`${lbl} => ${members.slice(0, 6).join(', ')}${members.length > 6 ? ` (+${members.length - 6})` : ''}`],
            remJoinEvidenceFull: [{ tok: lbl, ids: members.slice() }],
            remJoinMode: 'Grupo promovido a partir de órfãos: mesmo tipo de gatilho + REMOVER especial (forçado).',
            remClass: 'special',
            remVariants: Array.from(new Set(members.map((id) => rulesByNum.get(String(id))?.rem || '(REMOVER vazio)'))),
            gatKey: first?.gatKey || '(gatilho vazio)',
            gatLabel: first?.gatLabel || 'n/d',
            members
          });
        });
        if (promoted.length) {
          skeletonGroups = [...skeletonGroups, ...promoted];
          const promotedSet = new Set(promoted.flatMap((g) => g.members.map(String)));
          orphanRules = orphanRules.filter((n) => !promotedSet.has(String(n)));
        }
        const orphanSet = new Set(orphanRules);
        const primaryGroupByRule = new Map();
        skeletonGroups.forEach((g, idx) => g.members.forEach((r) => primaryGroupByRule.set(String(r), idx + 1)));
        const orphanItems = orphanRules.map((n) => rulesByNum.get(String(n))).filter(Boolean);
        const topCountsText = (items, label, limit) => {
          const m = new Map();
          (items || []).forEach((v) => m.set(v, (m.get(v) || 0) + 1));
          const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
          if (!sorted.length) return `${label}: n/d`;
          const shown = sorted.slice(0, limit).map(([k, n]) => `${k} (${n})`).join(', ');
          const rest = sorted.length > limit ? ` (+${sorted.length - limit})` : '';
          return `${label}: ${shown}${rest}`;
        };
        const orphanTopGatilho = topCountsText(orphanItems.map((r) => r.gatLabel), 'Órfãos por gatilho', 5);
        const orphanTopRemTokens = topCountsText(orphanItems.flatMap((r) => r.remTokens || []), 'Localizadores mais frequentes nos órfãos', 8);
        const orphanTopSaida = topCountsText(orphanRules.map((n) => clean(ruleMeta.get(String(n))?.incluir || '') || '(AÇÃO/INCLUIR vazio)'), 'Saídas mais frequentes nos órfãos', 5);
        const orphanByGatilhoRules = new Map();
        orphanItems.forEach((it) => {
          const k = String(it.gatLabel || 'n/d');
          if (!orphanByGatilhoRules.has(k)) orphanByGatilhoRules.set(k, []);
          orphanByGatilhoRules.get(k).push(String(it.n));
        });
        const gatilhoOutrosDetails = Array.from(orphanByGatilhoRules.entries())
          .filter(([k]) => String(k).startsWith('Outros:['))
          .map(([k, nums]) => ({ k, nums: nums.sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b))) }))
          .sort((a, b) => b.nums.length - a.nums.length || String(a.k).localeCompare(String(b.k), 'pt-BR'));
        const gatilhoOutrosHtml = gatilhoOutrosDetails.length
          ? `<div style="margin-top:6px;border:1px dashed #cbd5e1;border-radius:6px;padding:6px"><div style="font-size:12px;color:#0f172a"><strong>Detalhe de gatilhos \"Outros\"</strong></div>${gatilhoOutrosDetails.map((d) => `<div style="font-size:12px;color:#334155;margin-top:4px"><div>${esc(d.k)} (${d.nums.length})</div><div style="margin-top:2px;line-height:1.5">${(d.nums.length <= 80 ? d.nums : d.nums.slice(0, 80)).map((n) => `<span style=\"display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px\">${esc(n)}</span>`).join('')}${d.nums.length > 80 ? `<span style=\"display:inline-block;color:#64748b;margin-left:6px\">+${d.nums.length - 80} regras</span>` : ''}</div></div>`).join('')}</div>`
          : '';
        const orphanRemClassDiag = (() => {
          const m = new Map();
          orphanItems.forEach((it) => {
            const sp = specialClass(it);
            const cls = sp || (() => {
              const k = ((it?.remTokenKeys && it.remTokenKeys[0]) ? String(it.remTokenKeys[0]) : '') || '__SEM_TOKEN__';
              return `normal:${k}`;
            })();
            m.set(cls, (m.get(cls) || 0) + 1);
          });
          return Array.from(m.entries())
            .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'))
            .slice(0, 8)
            .map(([k, n]) => `${k} (${n})`);
        })();
        const specialDiagHtml = orphanSpecialBucketDiag.length
          ? `<div style="color:#64748b;font-size:12px;margin-top:2px">Buckets REMOVER especial (diag): ${esc(orphanSpecialBucketDiag.slice(0, 8).join(', '))}${orphanSpecialBucketDiag.length > 8 ? esc(` (+${orphanSpecialBucketDiag.length - 8})`) : ''}</div><div style="color:#64748b;font-size:12px;margin-top:2px">Localizadores (REMOVER) nos órfãos: ${esc(orphanRemClassDiag.join(', ') || 'n/d')}</div>`
          : `<div style="color:#64748b;font-size:12px;margin-top:2px">Buckets REMOVER especial (diag): sem buckets encontrados</div><div style="color:#64748b;font-size:12px;margin-top:2px">Localizadores (REMOVER) nos órfãos: ${esc(orphanRemClassDiag.join(', ') || 'n/d')}</div>`;
        const tokenGroupByGat = new Map();
        skeletonGroups.forEach((g, idx) => {
          const gid = idx + 1;
          g.members.forEach((n) => {
            const it = rulesByNum.get(String(n));
            if (!it) return;
            const toks = (it.remTokens && it.remTokens.length) ? it.remTokens : [it.remKey];
            toks.forEach((t) => {
              const key = `${it.gatKey}|||${t}`;
              if (!tokenGroupByGat.has(key)) tokenGroupByGat.set(key, new Set());
              tokenGroupByGat.get(key).add(gid);
            });
          });
        });
        const orphanCandidateGroups = (() => {
          const score = new Map();
          orphanItems.forEach((it) => {
            const toks = (it.remTokens && it.remTokens.length) ? it.remTokens : [it.remKey];
            toks.forEach((t) => {
              const key = `${it.gatKey}|||${t}`;
              const s = tokenGroupByGat.get(key);
              if (!s) return;
              s.forEach((gid) => score.set(gid, (score.get(gid) || 0) + 1));
            });
          });
          const sorted = Array.from(score.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 8);
          return sorted.length ? sorted.map(([gid, n]) => `#${gid} (${n})`).join(', ') : 'n/d';
        })();
        const orphanHierarchy = (() => {
          const byGat = new Map();
          orphanItems.forEach((it) => {
            const gat = String(it?.gatLabel || 'n/d');
            if (!byGat.has(gat)) byGat.set(gat, []);
            byGat.get(gat).push(it);
          });
          const tempoQtdFromRule = (it) => {
            const src = String(it?.tipoRaw || '') + ' ' + (it?.gatLabel || '');
            const mm = src.match(/\b(\d+\s*(?:dias?|horas?|minutos?|semanas?|mes(?:es)?|anos?))\b/i);
            return mm ? mm[1] : 'sem quantidade';
          };
          const rows = Array.from(byGat.entries()).map(([gat, items]) => {
            const byLoc = new Map();
            items.forEach((it) => {
              const keys = (it?.remTokenKeys && it.remTokenKeys.length) ? it.remTokenKeys : ['__SEM_LOC__'];
              const key = keys.find((k) => k === '__TODOS__' || !isWeakRemToken(k)) || '__SEM_LOC__';
              const isTempoLoc = /data\/tempo:\[tempo no localizador\]/i.test(gat) || /tempo no localizador/i.test(String(it?.gatLabel || ''));
              const qtd = isTempoLoc ? tempoQtdFromRule(it) : '';
              const compKey = isTempoLoc ? `${key}|||${qtd}` : key;
              if (!byLoc.has(compKey)) {
                const baseRaw = (it?.remTokens || [])[0] || (key === '__TODOS__' ? 'TODOS' : '(sem localizador)');
                const raw = isTempoLoc ? `${baseRaw} | tempo: ${qtd}` : baseRaw;
                byLoc.set(compKey, { key: compKey, raw, rules: [] });
              }
              byLoc.get(compKey).rules.push(String(it.n));
            });
            const locs = Array.from(byLoc.values())
              .map((x) => ({ ...x, rules: x.rules.sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')) }))
              .sort((a, b) => b.rules.length - a.rules.length || String(a.raw).localeCompare(String(b.raw), 'pt-BR'));
            return { gat, total: items.length, locs };
          }).sort((a, b) => b.total - a.total || String(a.gat).localeCompare(String(b.gat), 'pt-BR'));
          return rows;
        })();
        const orphanHierarchyHtml = orphanHierarchy.length
          ? `<div style="margin-top:8px;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;background:#fff"><div style="font-weight:700;color:#0f172a">Órfãos por Gatilho → Localizador</div><div style="color:#64748b;font-size:12px;margin-top:2px">Visualização hierárquica para identificar padrões faltantes.</div>${orphanHierarchy.slice(0, 20).map((g) => `<details style="margin-top:6px"><summary style="cursor:pointer;color:#0f172a;font-size:12px"><strong>${esc(g.gat)}</strong> (${g.total})</summary><div style="margin-top:4px;display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:6px">${g.locs.slice(0, 20).map((l) => `<div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px"><div style="font-size:12px;color:#334155"><strong>Localizador:</strong> ${esc(l.raw)}</div><div style="font-size:12px;color:#334155;margin-top:2px"><strong>Regras:</strong> ${l.rules.length}</div><div style="margin-top:4px;line-height:1.5">${l.rules.map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}</div></div>`).join('')}</div>${g.locs.length > 20 ? `<div style="color:#64748b;font-size:12px;margin-top:4px">+${g.locs.length - 20} localizadores adicionais</div>` : ''}</details>`).join('')}${orphanHierarchy.length > 20 ? `<div style="color:#64748b;font-size:12px;margin-top:6px">+${orphanHierarchy.length - 20} gatilhos adicionais</div>` : ''}</div>`
          : `<div style="margin-top:8px;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;background:#fff;color:#64748b;font-size:12px">Órfãos por Gatilho → Localizador: sem dados para exibir.</div>`;
        let orphanInsightsHtml = `<div style="margin-top:8px;border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#fff"><div style="font-weight:700;color:#0f172a">Indicadores para reduzir órfãos</div><div style="color:#64748b;font-size:12px;margin-top:2px">${esc(orphanTopGatilho)}</div><div style="color:#64748b;font-size:12px;margin-top:2px">${esc(orphanTopRemTokens)}</div><div style="color:#64748b;font-size:12px;margin-top:2px">${esc(orphanTopSaida)}</div>${specialDiagHtml}<div style="color:#64748b;font-size:12px;margin-top:2px">Grupos-base candidatos por sobreposição de localizador+gatilho: ${esc(orphanCandidateGroups)}</div>${gatilhoOutrosHtml}${orphanHierarchyHtml}</div>`;
        const outputMap = new Map();
        allRuleNums.forEach((n) => {
          const m = ruleMeta.get(String(n));
          if (!m) return;
          const gat = gatilhoBaseKey(m.tipo || '');
          const gatLabel = summarizeSpecificGatilho(m.tipo || '');
          const out = clean(m.incluir || '') || '(AÇÃO/INCLUIR vazio)';
          const key = `${gat}|||${out}`;
          if (!outputMap.has(key)) outputMap.set(key, { gat, gatLabel, out, members: [] });
          outputMap.get(key).members.push(String(n));
        });
        const outputGroups = Array.from(outputMap.values())
          .map((g) => ({ ...g, members: g.members.sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b)) ) }))
          .filter((g) => g.members.length >= 2)
          .sort((a, b) => b.members.length - a.members.length || String(a.gatLabel).localeCompare(String(b.gatLabel), 'pt-BR'));
        const outputBridgeGroups = outputGroups.filter((g) => {
          const hasOrphan = g.members.some((r) => orphanSet.has(String(r)));
          const prim = new Set(g.members.map((r) => primaryGroupByRule.get(String(r)) || `O-${String(r)}`));
          return hasOrphan || prim.size >= 2;
        });
        const bridgeRuleSet = new Set(outputBridgeGroups.flatMap((g) => g.members.map(String)));
        const orphanRulesInBridges = orphanRules.filter((r) => bridgeRuleSet.has(String(r)));
        const orphanRulesOutOfBridges = orphanRules.filter((r) => !bridgeRuleSet.has(String(r)));
        const bridgeAudit = outputBridgeGroups.map((g, idx) => {
          const bridgeSet = new Set(g.members.map(String));
          const best = skeletonGroups.map((sg, sidx) => {
            const inter = sg.members.filter((r) => bridgeSet.has(String(r))).length;
            if (!inter) return null;
            const union = new Set([...sg.members.map(String), ...g.members.map(String)]).size;
            const jacc = union ? Math.round((inter / union) * 100) : 0;
            const covBridge = g.members.length ? Math.round((inter / g.members.length) * 100) : 0;
            const covGroup = sg.members.length ? Math.round((inter / sg.members.length) * 100) : 0;
            let rel = 'Relacionada';
            if (inter === g.members.length && inter === sg.members.length) rel = 'Idêntica';
            else if (inter === g.members.length) rel = 'Ponte contida no grupo';
            else if (inter === sg.members.length) rel = 'Grupo contido na ponte';
            return { group: sidx + 1, jacc, covBridge, covGroup, rel };
          }).filter(Boolean).sort((a, b) => b.jacc - a.jacc || b.covBridge - a.covBridge)[0];
          return { idx: idx + 1, size: g.members.length, best };
        });
        const bridgeAuditHtml = bridgeAudit.length
          ? `<div style="margin-top:8px;border:1px solid #e2e8f0;border-radius:8px;padding:8px"><div style="font-weight:700;color:#0f172a">Auditoria de similaridade (Pontes x Grupos-base)</div><div style="color:#64748b;font-size:12px;margin-top:2px">Mostra o grupo-base mais parecido com cada ponte.</div><div style="margin-top:6px;display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:6px">${bridgeAudit.map((a) => `<div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px"><div><strong>Ponte ${a.idx}</strong></div><div style="font-size:12px;color:#334155">Regras: ${a.size}</div><div style="font-size:12px;color:#334155">Mais parecido: ${a.best ? `#${a.best.group}` : 'nenhum'}</div><div style="font-size:12px;color:#334155">Similaridade: ${a.best ? `${a.best.jacc}%` : '0%'}</div><div style="font-size:12px;color:#334155">${a.best ? a.best.rel : ''}</div></div>`).join('')}</div></div>`
          : '';
        const groupProfiles = skeletonGroups.map((g) => {
          const tokenSet = new Set();
          const tokenName = new Map();
          g.members.forEach((id) => {
            const rr = rulesByNum.get(String(id));
            const named = (rr?.gatTokensNamed || []);
            named.forEach((nm) => {
              const nk = normalizeGatilhoTokenKey(nm);
              if (!nk) return;
              tokenSet.add(nk);
              if (!tokenName.has(nk)) tokenName.set(nk, String(nm));
            });
          });
          return {
            remKey: String((g.remCommonTokens && g.remCommonTokens[0]) || g.remKey || ''),
            gatType: String((rulesByNum.get(String(g.members[0]))?.gatTypeKey) || ''),
            poloKey: String((rulesByNum.get(String(g.members[0]))?.poloKey) || '__SEM_POLO__'),
            tokenSet,
            tokenName
          };
        });
        const mergeSuggestionsByGroup = new Map();
        const addMergeSuggestion = (fromIdx, payload) => {
          if (!mergeSuggestionsByGroup.has(fromIdx)) mergeSuggestionsByGroup.set(fromIdx, []);
          mergeSuggestionsByGroup.get(fromIdx).push(payload);
        };
        for (let i = 0; i < skeletonGroups.length; i += 1) {
          for (let j = i + 1; j < skeletonGroups.length; j += 1) {
            const a = groupProfiles[i], b = groupProfiles[j];
            if (!a || !b) continue;
            if (a.remKey !== b.remKey) continue;
            if (a.gatType !== b.gatType) continue;
            const onlyA = Array.from(a.tokenSet).filter((x) => !b.tokenSet.has(x));
            const onlyB = Array.from(b.tokenSet).filter((x) => !a.tokenSet.has(x));
            const inter = Array.from(a.tokenSet).filter((x) => b.tokenSet.has(x)).length;
            const diff = onlyA.length + onlyB.length;
            if (diff > 6) continue; // corta candidatos pouco similares
            const diffNames = [...onlyA, ...onlyB].map((k) => a.tokenName.get(k) || b.tokenName.get(k) || k);
            addMergeSuggestion(i, { other: j + 1, diff, diffNames, inter });
            addMergeSuggestion(j, { other: i + 1, diff, diffNames, inter });
          }
        }
        mergeSuggestionsByGroup.forEach((arr, idx) => {
          arr.sort((x, y) => x.diff - y.diff || y.inter - x.inter || x.other - y.other);
          mergeSuggestionsByGroup.set(idx, arr);
        });
        const maxASizeForB = (() => {
          try {
            if (ATP_CONFIG && Number.isFinite(Number(ATP_CONFIG.tamanhoMaxGrupoAParaVirarB))) return Number(ATP_CONFIG.tamanhoMaxGrupoAParaVirarB);
          } catch (_) {}
          return 3;
        })();
        const bCandidateRules = new Map();
        orphanItems.forEach((r) => bCandidateRules.set(String(r.n), r));
        const smallAOrigIdxSet = new Set();
        skeletonGroups.forEach((g, idx) => {
          if ((g.members || []).length > maxASizeForB) return;
          smallAOrigIdxSet.add(idx);
          (g.members || []).forEach((id) => {
            const rr = rulesByNum.get(String(id));
            if (rr) bCandidateRules.set(String(id), rr);
          });
        });
        const buildBGroupFrom = (gat, ids) => {
            const members = Array.from(new Set(ids))
              .sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'));
            if (members.length < 2) return null;
            const byLoc = new Map();
            members.forEach((id) => {
              const rr = rulesByNum.get(String(id));
              const toks = (rr?.remTokens && rr.remTokens.length) ? rr.remTokens : [rr?.remKey || '(sem localizador)'];
              const raw = String(toks[0] || '(sem localizador)');
              if (!byLoc.has(raw)) byLoc.set(raw, []);
              byLoc.get(raw).push(String(id));
            });
            const locs = Array.from(byLoc.entries())
              .map(([raw, rules]) => ({ raw, rules: rules.sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')) }))
              .sort((a, b) => b.rules.length - a.rules.length || String(a.raw).localeCompare(String(b.raw), 'pt-BR'));
            const locNames = Array.from(new Set(locs.map((x) => x.raw)));
            const joinEvidence = locs
              .slice(0, 6)
              .map((x) => `${x.raw} => ${x.rules.slice(0, 6).join(', ')}${x.rules.length > 6 ? ` (+${x.rules.length - 6})` : ''}`);
            const joinEvidenceFull = locs.map((x) => ({ tok: x.raw, ids: x.rules.slice() }));
            return {
              rem: '(variação de localizadores)',
              remKey: 'L:[variação de localizadores]',
              remCommonTokens: [],
              remSharedTokens: [],
              remUnionTokens: locNames,
              remJoinEvidence: joinEvidence,
              remJoinEvidenceFull: joinEvidenceFull,
              remJoinMode: `Grupo B (flexível): mesmo gatilho; inclui órfãos e grupos A pequenos (<=${maxASizeForB}).`,
              remVariants: locNames,
              gatKey: gat,
              gatLabel: gat,
              members
            };
          };
        const bByGat = new Map();
        Array.from(bCandidateRules.values()).forEach((r) => {
          const k = String(r.gatLabel || 'n/d');
          if (!bByGat.has(k)) bByGat.set(k, []);
          bByGat.get(k).push(String(r.n));
        });
        const bGroups = Array.from(bByGat.entries())
          .map(([gat, ids]) => buildBGroupFrom(gat, ids))
          .filter(Boolean);
        bGroups.sort((a, b) => b.members.length - a.members.length || String(a.gatLabel).localeCompare(String(b.gatLabel), 'pt-BR'));
        const splitLocalizadores = (txt) => String(txt || '')
          .split(/\s*\|\|\s*|\s+\bOU\b\s+|[;\n\r]+|,\s*/i)
          .map((x) => clean(String(x || '')))
          .filter(Boolean);
        const splitLocalizadoresLiteral = (txt) => String(txt || '')
          .split(/\s*\|\|\s*|\s+\bOU\b\s+|\s*&&\s*|[;\n\r]+|,\s*/i)
          .map((x) => String(x || '').trim())
          .filter(Boolean);
        const normCirandaLoc = (txt) => String(txt || '')
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/\s*-\s*/g, ' - ')
          .replace(/\s*&&\s*/g, ' && ');
        const detectarCirandas = (regras) => {
          const byGatilho = new Map();
          (Array.isArray(regras) ? regras : []).forEach((r) => {
            const g = String(r?.gatilho || '').trim();
            const rem = normCirandaLoc(r?.remover || '');
            const inc = normCirandaLoc(r?.incluir || '');
            if (!g || !rem || !inc) return;
            if (!byGatilho.has(g)) byGatilho.set(g, []);
            byGatilho.get(g).push({ gatilho: g, remover: rem, incluir: inc, regra: String(r?.regra || '') });
          });
          const out = [];
          byGatilho.forEach((arr, gatilho) => {
            if (!Array.isArray(arr) || arr.length < 2) return;
            const nextByNode = new Map();
            const prevByNode = new Map();
            const neighUndirected = new Map();
            const labelByNode = new Map();
            const edgeRules = new Map();
            const ensure = (n, raw) => {
              if (!nextByNode.has(n)) nextByNode.set(n, new Set());
              if (!prevByNode.has(n)) prevByNode.set(n, new Set());
              if (!neighUndirected.has(n)) neighUndirected.set(n, new Set());
              if (!labelByNode.has(n)) labelByNode.set(n, raw);
            };
            arr.forEach((e) => {
              const remN = normCirandaLoc(e.remover || '');
              const incN = normCirandaLoc(e.incluir || '');
              if (!remN || !incN) return;
              ensure(remN, e.remover);
              ensure(incN, e.incluir);
              nextByNode.get(remN).add(incN);
              prevByNode.get(incN).add(remN);
              neighUndirected.get(remN).add(incN);
              neighUndirected.get(incN).add(remN);
              const eKey = `${remN}=>${incN}`;
              if (!edgeRules.has(eKey)) edgeRules.set(eKey, new Set());
              if (e?.regra != null) edgeRules.get(eKey).add(String(e.regra));
            });
            const qualEdgeKeys = new Set();
            const ponteNodes = new Set();
            Array.from(neighUndirected.keys()).forEach((b) => {
              const ins = Array.from(prevByNode.get(b) || []);
              const outs = Array.from(nextByNode.get(b) || []);
              if (!ins.length || !outs.length) return;
              ins.forEach((a) => {
                outs.forEach((c) => {
                  if (!a || !c || a === c) return;
                  qualEdgeKeys.add(`${a}=>${b}`);
                  qualEdgeKeys.add(`${b}=>${c}`);
                  ponteNodes.add(b);
                });
              });
            });
            if (!qualEdgeKeys.size) return;
            const qualEdges = Array.from(qualEdgeKeys).map((k) => {
              const parts = String(k).split('=>');
              return { a: parts[0], b: parts[1], ids: edgeRules.get(k) || new Set() };
            });
            const neighQual = new Map();
            const ensureQ = (n) => { if (!neighQual.has(n)) neighQual.set(n, new Set()); };
            qualEdges.forEach((e) => {
              ensureQ(e.a); ensureQ(e.b);
              neighQual.get(e.a).add(e.b);
              neighQual.get(e.b).add(e.a);
            });
            const seenComp = new Set();
            Array.from(neighQual.keys()).forEach((seed) => {
              if (seenComp.has(seed)) return;
              const q = [seed];
              seenComp.add(seed);
              const compNodes = [];
              while (q.length) {
                const cur = q.shift();
                compNodes.push(cur);
                (neighQual.get(cur) || new Set()).forEach((nx) => {
                  if (seenComp.has(nx)) return;
                  seenComp.add(nx);
                  q.push(nx);
                });
              }
              if (compNodes.length < 3) return;
              const compSet = new Set(compNodes);
              const compEdges = qualEdges.filter((e) => compSet.has(e.a) && compSet.has(e.b));
              if (compEdges.length < 2) return;
              const indeg = new Map(compNodes.map((n) => [n, 0]));
              const outdeg = new Map(compNodes.map((n) => [n, 0]));
              compEdges.forEach((e) => {
                outdeg.set(e.a, (outdeg.get(e.a) || 0) + 1);
                indeg.set(e.b, (indeg.get(e.b) || 0) + 1);
              });
              const bridgeNodes = compNodes.filter((n) => (indeg.get(n) || 0) > 0 && (outdeg.get(n) || 0) > 0);
              if (!bridgeNodes.length) return;
              const start = compNodes.find((n) => (indeg.get(n) || 0) === 0 && (outdeg.get(n) || 0) > 0)
                || bridgeNodes[0]
                || compNodes[0];
              const chain = [start];
              const usedLocal = new Set([start]);
              let cur = start;
              while (true) {
                const nexts = compEdges.filter((e) => e.a === cur).map((e) => e.b);
                if (!nexts.length) break;
                const nx = nexts.find((n) => !usedLocal.has(n)) || nexts[0];
                chain.push(nx);
                if (usedLocal.has(nx)) break;
                usedLocal.add(nx);
                cur = nx;
              }
              const uniqueChain = Array.from(new Set(chain));
              if (uniqueChain.length < 3) return;
              const hasCycle = uniqueChain.length < chain.length;
              const ruleIds = new Set();
              compEdges.forEach((e) => (e.ids || new Set()).forEach((rid) => ruleIds.add(String(rid))));
              if (ruleIds.size < 2) return;
              const last = chain[chain.length - 1] || start;
              const escape = labelByNode.get(last) || last;
              const edgeByKey = new Map(compEdges.map((e) => [`${e.a}=>${e.b}`, e]));
              const troncoKeys = [];
              for (let i = 0; i < chain.length - 1; i += 1) {
                const a = chain[i];
                const b = chain[i + 1];
                const k = `${a}=>${b}`;
                if (a && b && a !== b && edgeByKey.has(k) && !troncoKeys.includes(k)) troncoKeys.push(k);
              }
              if (troncoKeys.length < 2) return;
              const troncoSet = new Set(troncoKeys);
              const troncoEdges = troncoKeys.map((k) => edgeByKey.get(k)).filter(Boolean);
              const regrasTronco = new Set();
              troncoEdges.forEach((e) => (e.ids || new Set()).forEach((rid) => regrasTronco.add(String(rid))));
              const transicoes = troncoEdges.map((e) => ({
                de: labelByNode.get(e.a) || e.a,
                para: labelByNode.get(e.b) || e.b,
                regras: Array.from(e.ids || new Set()).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'))
              }));
              out.push({
                gatilho,
                cadeia: uniqueChain.map((n) => labelByNode.get(n) || n),
                escape,
                tipo: hasCycle ? 'ciclo' : 'linear',
                localizadores: uniqueChain.map((n) => labelByNode.get(n) || n),
                regras: Array.from(regrasTronco).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')),
                transicoes,
                diagnostico: {
                  nos: compNodes.length,
                  transicoesCasadas: troncoEdges.length,
                  nosPonte: bridgeNodes.length
                }
              });
            });
          });
          return out;
        };
        const cirandaRuleSet = new Set();
        const bGroupKey = (g) => `${String(g?.gatLabel || 'n/d')}|||${(Array.isArray(g?.members) ? g.members.map(String).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')) : []).join('|')}`;
        const bCirandaDebugMap = new Map();
        let cirandasHtml = `<div style="grid-column:1/-1;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;background:#fff"><strong>Grupo D: Cirandas (Cadeias de Iteração)</strong><div style="color:#64748b;font-size:12px;margin-top:2px">Sem cadeias de 3+ estágios no recorte atual.</div></div>`;
        try {
          const regrasParaCirandas = allRuleNums.flatMap((n) => {
            const id = String(n);
            const r = rulesByNum.get(id);
            const gatilho = String(r?.gatLabel || summarizeSpecificGatilho(ruleMeta.get(id)?.tipo || '') || 'n/d');
            const rems = splitLocalizadoresLiteral(ruleMeta.get(id)?.remover || r?.rem || r?.remKey || '');
            const incs = splitLocalizadoresLiteral(ruleMeta.get(id)?.incluir || '');
            if (!incs.length) return [];
            return rems.flatMap((rem) => {
              const remTxt = normCirandaLoc(rem || '');
              if (!remTxt) return [];
              return incs.map((inc) => ({ gatilho, remover: remTxt, incluir: normCirandaLoc(inc || ''), regra: id }));
            });
          });
          let cirandas = detectarCirandas(regrasParaCirandas);
          // Segunda passada: força promoção de casos clássicos já consolidados em B
          // quando houver encadeamento literal dentro do próprio grupo.
          const cirandaAssinatura = new Set(cirandas.map((c) => `${String(c.gatilho || '')}|||${(Array.isArray(c.regras) ? c.regras.slice().sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')) : []).join('|')}`));
          const diagnosticarCirandaDoGrupoB = (groupObj) => {
            const ids = Array.isArray(groupObj?.members) ? groupObj.members.map(String) : [];
            if (ids.length < 2) return { ok: false, motivo: 'menos de 2 regras', nos: 0, arestas: 0, nosPonte: 0, transicoes: [] };
            const edgeMap = new Map();
            const nodeLabel = new Map();
            const ensureNode = (n, raw) => {
              if (!nodeLabel.has(n)) nodeLabel.set(n, raw);
            };
            ids.forEach((id) => {
              const rr = rulesByNum.get(String(id));
              const rems = splitLocalizadoresLiteral(ruleMeta.get(String(id))?.remover || rr?.rem || rr?.remKey || '');
              const incs = splitLocalizadoresLiteral(ruleMeta.get(String(id))?.incluir || '');
              rems.forEach((rem) => {
                const remTxt = normCirandaLoc(rem || '');
                if (!remTxt) return;
                incs.forEach((inc) => {
                  const incTxt = normCirandaLoc(inc || '');
                  if (!incTxt) return;
                  ensureNode(remTxt, remTxt);
                  ensureNode(incTxt, incTxt);
                  const k = `${remTxt}=>${incTxt}`;
                  if (!edgeMap.has(k)) edgeMap.set(k, { a: remTxt, b: incTxt, ids: new Set() });
                  edgeMap.get(k).ids.add(String(id));
                });
              });
            });
            const edges = Array.from(edgeMap.values());
            if (edges.length < 2) return { ok: false, motivo: 'sem 2 transições casadas', nos: 0, arestas: edges.length, nosPonte: 0, transicoes: [] };
            const prevByNode = new Map();
            const nextByNode = new Map();
            const ensurePN = (n) => {
              if (!prevByNode.has(n)) prevByNode.set(n, new Set());
              if (!nextByNode.has(n)) nextByNode.set(n, new Set());
            };
            edges.forEach((e) => {
              ensurePN(e.a);
              ensurePN(e.b);
              nextByNode.get(e.a).add(e.b);
              prevByNode.get(e.b).add(e.a);
            });
            const qualEdgeKeys = new Set();
            const ponteNodes = new Set();
            Array.from(new Set([...nextByNode.keys(), ...prevByNode.keys()])).forEach((b) => {
              const ins = Array.from(prevByNode.get(b) || []);
              const outs = Array.from(nextByNode.get(b) || []);
              if (!ins.length || !outs.length) return;
              ins.forEach((a) => {
                outs.forEach((c) => {
                  if (!a || !c || a === c) return;
                  qualEdgeKeys.add(`${a}=>${b}`);
                  qualEdgeKeys.add(`${b}=>${c}`);
                  ponteNodes.add(b);
                });
              });
            });
            if (!qualEdgeKeys.size) return { ok: false, motivo: 'sem encadeamento A→B→C', nos: Array.from(new Set(edges.flatMap((e) => [e.a, e.b]))).length, arestas: edges.length, nosPonte: 0, transicoes: edges.slice(0, 8).map((e) => `${e.a} -> ${e.b}`) };
            const qualEdges = Array.from(qualEdgeKeys).map((k) => {
              const [a, b] = String(k).split('=>');
              return edges.find((e) => e.a === a && e.b === b) || { a, b, ids: new Set() };
            });
            const nodes = Array.from(new Set(qualEdges.flatMap((e) => [e.a, e.b])));
            if (nodes.length < 3) return { ok: false, motivo: 'sem 3 localizadores na cadeia', nos: nodes.length, arestas: qualEdges.length, nosPonte: ponteNodes.size, transicoes: qualEdges.slice(0, 8).map((e) => `${e.a} -> ${e.b}`) };
            const indeg = new Map(nodes.map((n) => [n, 0]));
            const outdeg = new Map(nodes.map((n) => [n, 0]));
            qualEdges.forEach((e) => {
              indeg.set(e.b, (indeg.get(e.b) || 0) + 1);
              outdeg.set(e.a, (outdeg.get(e.a) || 0) + 1);
            });
            const bridgeNodes = nodes.filter((n) => (indeg.get(n) || 0) > 0 && (outdeg.get(n) || 0) > 0);
            if (!bridgeNodes.length) return { ok: false, motivo: 'sem nó ponte (A→B→C)', nos: nodes.length, arestas: qualEdges.length, nosPonte: 0, transicoes: qualEdges.slice(0, 8).map((e) => `${e.a} -> ${e.b}`) };
            const allRuleIds = new Set();
            qualEdges.forEach((e) => (e.ids || new Set()).forEach((rid) => allRuleIds.add(String(rid))));
            if (allRuleIds.size < 2) return { ok: false, motivo: 'menos de 2 regras distintas', nos: nodes.length, arestas: edges.length, nosPonte: bridgeNodes.length, transicoes: edges.slice(0, 8).map((e) => `${e.a} -> ${e.b}`) };
            const start = nodes.find((n) => (indeg.get(n) || 0) === 0 && (outdeg.get(n) || 0) > 0)
              || nodes.find((n) => (outdeg.get(n) || 0) > 0)
              || nodes[0];
            const chain = [start];
            const seen = new Set([start]);
            let cur = start;
            while (true) {
              const nexts = qualEdges.filter((e) => e.a === cur).map((e) => e.b);
              if (!nexts.length) break;
              const nx = nexts.find((n) => !seen.has(n)) || nexts[0];
              chain.push(nx);
              if (seen.has(nx)) break;
              seen.add(nx);
              cur = nx;
            }
            const uniqueChain = Array.from(new Set(chain));
            const edgeByKey = new Map(qualEdges.map((e) => [`${e.a}=>${e.b}`, e]));
            const troncoKeys = [];
            for (let i = 0; i < chain.length - 1; i += 1) {
              const a = chain[i];
              const b = chain[i + 1];
              const k = `${a}=>${b}`;
              if (a && b && a !== b && edgeByKey.has(k) && !troncoKeys.includes(k)) troncoKeys.push(k);
            }
            if (troncoKeys.length < 2) return { ok: false, motivo: 'sem tronco principal A→B→C', nos: nodes.length, arestas: qualEdges.length, nosPonte: bridgeNodes.length, transicoes: qualEdges.slice(0, 8).map((e) => `${e.a} -> ${e.b}`) };
            const troncoSet = new Set(troncoKeys);
            const troncoEdges = troncoKeys.map((k) => edgeByKey.get(k)).filter(Boolean);
            const regrasTronco = new Set();
            troncoEdges.forEach((e) => (e.ids || new Set()).forEach((rid) => regrasTronco.add(String(rid))));
            const transicoes = troncoEdges.map((e) => ({
              de: e.a,
              para: e.b,
              regras: Array.from(e.ids || new Set()).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'))
            }));
            const ciranda = {
              gatilho: String(groupObj?.gatLabel || 'n/d'),
              cadeia: uniqueChain,
              escape: uniqueChain[uniqueChain.length - 1] || uniqueChain[0] || 'n/d',
              tipo: 'linear',
              localizadores: uniqueChain,
              regras: Array.from(regrasTronco).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')),
              transicoes,
              diagnostico: { nos: nodes.length, transicoesCasadas: troncoEdges.length, nosPonte: bridgeNodes.length }
            };
            return { ok: true, motivo: 'encadeamento válido A→B→C', nos: nodes.length, arestas: troncoEdges.length, nosPonte: bridgeNodes.length, transicoes: transicoes.slice(0, 8).map((t) => `${t.de} -> ${t.para}`), ciranda };
          };
          bGroups.forEach((bg) => {
            const dbg = diagnosticarCirandaDoGrupoB(bg);
            bCirandaDebugMap.set(bGroupKey(bg), dbg);
            if (!dbg?.ok || !dbg.ciranda) return;
            const c = dbg.ciranda;
            const sig = `${String(c.gatilho || '')}|||${c.regras.join('|')}`;
            if (cirandaAssinatura.has(sig)) return;
            cirandaAssinatura.add(sig);
            cirandas.push(c);
          });
          cirandas.forEach((c) => (c?.regras || []).forEach((rid) => cirandaRuleSet.add(String(rid))));
          if (cirandas.length) {
            const cirandaCards = cirandas.slice(0, 40).map((c, i) => {
              const transHtml = (Array.isArray(c.transicoes) ? c.transicoes : []).slice(0, 20).map((t) => `<div style="font-size:12px;color:#334155;margin-top:4px"><div><strong>${esc(t.de)}</strong> → <strong>${esc(t.para)}</strong> (${Array.isArray(t.regras) ? t.regras.length : 0})</div><div style="line-height:1.5;margin-top:2px">${(Array.isArray(t.regras) ? t.regras : []).map((id) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(id)}</span>`).join('')}</div></div>`).join('');
              return `<div style="border:1px solid #c4b5fd;border-radius:8px;padding:8px;background:#fff"><div style="display:flex;justify-content:space-between;gap:8px"><strong>Ciranda D${String(i + 1).padStart(2, '0')}</strong><span style="color:#334155">Estágios: ${c.cadeia.length}</span></div><div style="margin-top:4px;color:#0f172a"><strong>Gatilho:</strong> ${esc(c.gatilho)}</div><div style="color:#64748b;font-size:12px;margin-top:2px"><strong>Tipo:</strong> ${esc(c.tipo || 'linear')} | <strong>Escape:</strong> ${esc(c.escape || 'n/d')}</div><div style="color:#64748b;font-size:12px;margin-top:2px"><strong>Diagnóstico:</strong> nós=${Number(c?.diagnostico?.nos || 0)} | tronco=${Number(c?.diagnostico?.transicoesCasadas || 0)} | nós ponte=${Number(c?.diagnostico?.nosPonte || 0)}</div><div style="color:#64748b;font-size:12px;margin-top:2px"><strong>Regras (estritas do tronco):</strong> ${Array.isArray(c.regras) ? c.regras.length : 0}</div><div style="margin-top:6px;font-size:12px;line-height:1.6">${(Array.isArray(c.regras) ? c.regras : []).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}</div><details style="margin-top:6px"><summary style="cursor:pointer;color:#0f172a;font-size:12px"><strong>Transições do tronco (INCLUIR → REMOVER)</strong></summary><div style="margin-top:4px">${transHtml}${Array.isArray(c.transicoes) && c.transicoes.length > 20 ? `<div style="color:#64748b;font-size:12px;margin-top:4px">+${c.transicoes.length - 20} transições adicionais</div>` : ''}</div></details><div style="color:#64748b;font-size:12px;margin-top:4px"><strong>Localizadores do tronco:</strong></div><div style="margin-top:4px;font-size:12px;line-height:1.6">${(Array.isArray(c.localizadores) ? c.localizadores : c.cadeia).map((m) => `<span style="display:inline-block;border:1px solid #c4b5fd;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}</div></div>`;
            }).join('');
            cirandasHtml = `<div style="grid-column:1/-1;border:1px dashed #7c3aed;border-radius:8px;padding:8px;background:#faf5ff"><div style="display:flex;justify-content:space-between;gap:8px"><strong>Grupo D: Cirandas (Cadeias de Iteração)</strong><span style="color:#334155">Cirandas: ${cirandas.length}</span></div><div style="color:#64748b;font-size:12px;margin-top:2px">Critério D (estrito): no mesmo gatilho, só entra o tronco A→B→C (e continuações do tronco). Apoios não integram o grupo D.</div><div style="display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:10px;margin-top:6px">${cirandaCards}${cirandas.length > 40 ? `<div style="color:#64748b;font-size:12px;grid-column:1/-1">+${cirandas.length - 40} cirandas adicionais</div>` : ''}</div></div>`;
          }
        } catch (e) {
          console.warn(LOG_PREFIX, 'Falha ao montar cirandas no Mapa de Relações ATP', e);
          cirandasHtml = `<div style="grid-column:1/-1;border:1px dashed #f59e0b;border-radius:8px;padding:8px;background:#fff7ed"><strong>Grupo D: Cirandas (Cadeias de Iteração)</strong><div style="color:#92400e;font-size:12px;margin-top:2px">Seção indisponível nesta execução (falha de processamento), sem impactar os demais blocos do mapa.</div></div>`;
        }
        const extractPseudoTriggers = (ruleObj, outrosCanonTxt) => {
          const out = new Set();
          const addOut = (lbl) => {
            const v = clean(String(lbl || ''));
            if (v) out.add(v);
          };
          const addPrazoIfMatch = (txtRaw) => {
            const t = String(txtRaw || '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase();
            if (/prazo/.test(t) && /sem\s*prazo\s*aberto/.test(t)) {
              addOut('Pseudoprazo: Processos sem prazo aberto/ag. abertura');
            }
          };
          try {
            const clauses = Array.isArray(ruleObj?.outrosCriterios?.clauses) ? ruleObj.outrosCriterios.clauses : [];
            for (const clause of clauses) {
              if (!(clause instanceof Set)) continue;
              for (const raw of clause) {
                const s = clean(String(raw || ''));
                if (!s) continue;
                addPrazoIfMatch(s);
                const idx = s.indexOf(':') > 0 ? s.indexOf(':') : s.indexOf('=');
                const k = idx > 0 ? s.slice(0, idx) : s;
                const v = idx > 0 ? s.slice(idx + 1) : '';
                const kNorm = String(k || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                if (!/evento/.test(kNorm)) continue;
                if (!/contenha|contendo|conter/.test(kNorm)) continue;
                String(v || '').split(/\s+\bOU\b\s+|[,;|]/i).map((x) => clean(x)).filter(Boolean).forEach((x) => addOut(`Pseudoevento: ${x}`));
              }
            }
          } catch (_) {}
          if (!out.size) {
            const txt = clean(String(outrosCanonTxt || ''));
            addPrazoIfMatch(txt);
            const re = /evento[^:=|]*[:=]\s*([^|]+)/ig;
            let m;
            while ((m = re.exec(txt))) {
              String(m[1] || '').split(/\s+\bOU\b\s+|[,;]/i).map((x) => clean(x)).filter(Boolean).forEach((x) => addOut(`Pseudoevento: ${x}`));
            }
          }
          return Array.from(out).filter(Boolean);
        };
        const pseudoByEventoLoc = new Map();
        const pseudoRuleSet = new Set();
        allRuleNums.forEach((n) => {
          const id = String(n);
          const rObj = byNum.get(id);
          const m = rulesByNum.get(id) || ruleMeta.get(id);
          const tipoTxt = clean(exprCanon(rObj?.tipoControleCriterio, '') || m?.tipo || '');
          const hasTodosOsDias = /todos\s+os\s+dias/i.test(tipoTxt);
          const pseudos = extractPseudoTriggers(rObj, ruleMeta.get(id)?.outrosCanon || '');
          if (!pseudos.length) return;
          if (!hasTodosOsDias) return;
          const remLocs = (m?.remTokens && m.remTokens.length) ? m.remTokens : [m?.remKey || m?.rem || '(sem localizador)'];
          pseudoRuleSet.add(id);
          pseudos.forEach((ev) => {
            remLocs.forEach((loc) => {
              const lk = clean(String(loc || '(sem localizador)')) || '(sem localizador)';
              const key = `${ev}|||${lk}`;
              if (!pseudoByEventoLoc.has(key)) pseudoByEventoLoc.set(key, { ev, loc: lk, ids: [] });
              pseudoByEventoLoc.get(key).ids.push(id);
            });
          });
        });
        const cGroups = Array.from(pseudoByEventoLoc.values())
          .map(({ ev, loc, ids }) => ({
            gatLabel: `${ev}`,
            remLabel: loc,
            members: Array.from(new Set(ids))
              .map(String)
              .filter((id) => !cirandaRuleSet.has(String(id)))
              .sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'))
          }))
          .filter((g) => g.members.length >= 1)
          .sort((a, b) => b.members.length - a.members.length || String(a.gatLabel).localeCompare(String(b.gatLabel), 'pt-BR') || String(a.remLabel).localeCompare(String(b.remLabel), 'pt-BR'));
        const bRuleSet = new Set(bGroups.flatMap((g) => (g.members || []).map(String)).filter((id) => !cirandaRuleSet.has(String(id))));
        const orphanRulesResidual = orphanRules.filter((r) => !bRuleSet.has(String(r)) && !pseudoRuleSet.has(String(r)) && !cirandaRuleSet.has(String(r)));
        const normalizeTxt = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const hasExecucaoIncluir = (ids) => {
          const arr = Array.isArray(ids) ? ids : [];
          return arr.some((id) => {
            const incluir = normalizeTxt(ruleMeta.get(String(id))?.incluir || '');
            if (!incluir) return false;
            return /(minuta|conclusa?o|conclusos?|expedic[aã]o|expedir)/.test(incluir);
          });
        };
        // Classificação executiva por pilar para grupos do Mapa de Relações.
        const classificarPilar = (regra) => {
          const gat = normalizeTxt(`${String(regra?.gatLabel || '')} ${String(regra?.tipoGatilho || '')} ${String(regra?.subtipoPseudogatilho || '')}`);
          let pilar = 'Cumprimento';
          const isPrazo = /(decurso\s+de\s+prazo|juntada\s+de\s+peticao|registro\s+de\s+pagamento|pseudoprazo)/.test(gat);
          const isPassagem = /(ar\s+entregue|mandado\s+cumprido|confirmada\s+a\s+citacao|confirmacao\s+de\s+citacao|evento\s+de\s+retorno|retorno)/.test(gat)
            || (/pseudoevento/.test(gat) && /(ar\s+entregue|mandado\s+cumprido|confirmada\s+a\s+citacao|retorno)/.test(gat));
          if (isPrazo) pilar = 'Prazo';
          else if (isPassagem) pilar = 'Passagem';
          return {
            pilar,
            temExecucao: hasExecucaoIncluir((regra?.members || []).map(String))
          };
        };
        const classifyOrphanFamilyRadical = (id) => {
          const rr = rulesByNum.get(String(id));
          const raw = String((rr?.rem || (rr?.remTokens && rr.remTokens.length ? rr.remTokens[0] : (rr?.remKey || '(sem localizador)'))) || '');
          const base = raw.split(/\s+-\s+/);
          if (base.length <= 1) return raw || 'sem radical';
          return base.slice(0, -1).join(' - ').trim() || raw || 'sem radical';
        };
        const orphanFamilies = (() => {
          const byFamily = new Map();
          orphanRulesResidual.forEach((id) => {
            const fam = classifyOrphanFamilyRadical(id);
            if (!byFamily.has(fam)) byFamily.set(fam, []);
            byFamily.get(fam).push(String(id));
          });
          return Array.from(byFamily.entries())
            .map(([radical, ids]) => ({
              radical,
              ids: Array.from(new Set(ids)).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'))
            }))
            .filter((x) => x.ids.length > 1)
            .sort((a, b) => b.ids.length - a.ids.length || String(a.radical).localeCompare(String(b.radical), 'pt-BR'));
        })();
        const orphanFamiliesHtml = orphanFamilies.length
          ? `<div style="margin-top:8px;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;background:#fff"><div style="font-weight:700;color:#0f172a">Radar de órfãs por radical de REMOVER</div><div style="color:#64748b;font-size:12px;margin-top:2px">Radical obtido removendo o último segmento após " - ". Mostra apenas famílias com 2+ regras.</div>${orphanFamilies.slice(0, 24).map((f) => `<div style="margin-top:6px;font-size:12px;color:#334155"><strong>${esc(f.radical)}</strong> (${f.ids.length})<div style="margin-top:2px;line-height:1.5">${f.ids.map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}</div></div>`).join('')}${orphanFamilies.length > 24 ? `<div style="color:#64748b;font-size:12px;margin-top:6px">+${orphanFamilies.length - 24} famílias adicionais</div>` : ''}</div>`
          : '';
        // Recalcula o bloco de órfãs usando a fonte final (residual), após alocação em B/C.
        const orphanItemsFinal = orphanRulesResidual.map((n) => rulesByNum.get(String(n))).filter(Boolean);
        const orphanTopGatilhoFinal = topCountsText(orphanItemsFinal.map((r) => r.gatLabel), 'Órfãos por gatilho', 5);
        const orphanTopRemTokensFinal = topCountsText(orphanItemsFinal.flatMap((r) => r.remTokens || []), 'Localizadores mais frequentes nos órfãos', 8);
        const orphanTopSaidaFinal = topCountsText(orphanRulesResidual.map((n) => clean(ruleMeta.get(String(n))?.incluir || '') || '(AÇÃO/INCLUIR vazio)'), 'Saídas mais frequentes nos órfãos', 5);
        const orphanByGatilhoFinal = new Map();
        orphanItemsFinal.forEach((it) => {
          const k = String(it?.gatLabel || 'n/d');
          if (!orphanByGatilhoFinal.has(k)) orphanByGatilhoFinal.set(k, []);
          orphanByGatilhoFinal.get(k).push(String(it.n));
        });
        const orphanHierarchyFinal = (() => {
          const byGat = new Map();
          orphanItemsFinal.forEach((it) => {
            const gat = String(it?.gatLabel || 'n/d');
            if (!byGat.has(gat)) byGat.set(gat, []);
            byGat.get(gat).push(it);
          });
          const tempoQtdFromRule = (it) => {
            const src = String(it?.tipoRaw || '') + ' ' + (it?.gatLabel || '');
            const mm = src.match(/\b(\d+\s*(?:dias?|horas?|minutos?|semanas?|mes(?:es)?|anos?))\b/i);
            return mm ? mm[1] : 'sem quantidade';
          };
          return Array.from(byGat.entries()).map(([gat, items]) => {
            const byLoc = new Map();
            items.forEach((it) => {
              const keys = (it?.remTokenKeys && it.remTokenKeys.length) ? it.remTokenKeys : ['__SEM_LOC__'];
              const key = keys.find((k) => k === '__TODOS__' || !isWeakRemToken(k)) || '__SEM_LOC__';
              const isTempoLoc = /data\/tempo:\[tempo no localizador\]/i.test(gat) || /tempo no localizador/i.test(String(it?.gatLabel || ''));
              const qtd = isTempoLoc ? tempoQtdFromRule(it) : '';
              const compKey = isTempoLoc ? `${key}|||${qtd}` : key;
              if (!byLoc.has(compKey)) {
                const baseRaw = (it?.remTokens || [])[0] || (key === '__TODOS__' ? 'TODOS' : '(sem localizador)');
                const raw = isTempoLoc ? `${baseRaw} | tempo: ${qtd}` : baseRaw;
                byLoc.set(compKey, { key: compKey, raw, rules: [] });
              }
              byLoc.get(compKey).rules.push(String(it.n));
            });
            const locs = Array.from(byLoc.values())
              .map((x) => ({ ...x, rules: x.rules.sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')) }))
              .sort((a, b) => b.rules.length - a.rules.length || String(a.raw).localeCompare(String(b.raw), 'pt-BR'));
            return { gat, total: items.length, locs };
          }).sort((a, b) => b.total - a.total || String(a.gat).localeCompare(String(b.gat), 'pt-BR'));
        })();
        const orphanHierarchyHtmlFinal = orphanHierarchyFinal.length
          ? `<div style="margin-top:8px;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;background:#fff"><div style="font-weight:700;color:#0f172a">Órfãos por Gatilho → Localizador</div><div style="color:#64748b;font-size:12px;margin-top:2px">Visualização hierárquica para identificar padrões faltantes.</div>${orphanHierarchyFinal.slice(0, 20).map((g) => `<details style="margin-top:6px"><summary style="cursor:pointer;color:#0f172a;font-size:12px"><strong>${esc(g.gat)}</strong> (${g.total})</summary><div style="margin-top:4px;display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:6px">${g.locs.slice(0, 20).map((l) => `<div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px"><div style="font-size:12px;color:#334155"><strong>Localizador:</strong> ${esc(l.raw)}</div><div style="font-size:12px;color:#334155;margin-top:2px"><strong>Regras:</strong> ${l.rules.length}</div><div style="margin-top:4px;line-height:1.5">${l.rules.map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}</div></div>`).join('')}</div>${g.locs.length > 20 ? `<div style="color:#64748b;font-size:12px;margin-top:4px">+${g.locs.length - 20} localizadores adicionais</div>` : ''}</details>`).join('')}${orphanHierarchyFinal.length > 20 ? `<div style="color:#64748b;font-size:12px;margin-top:6px">+${orphanHierarchyFinal.length - 20} gatilhos adicionais</div>` : ''}</div>`
          : `<div style="margin-top:8px;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;background:#fff;color:#64748b;font-size:12px">Órfãos por Gatilho → Localizador: sem dados para exibir.</div>`;
        orphanInsightsHtml = `<div style="margin-top:8px;border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#fff"><div style="font-weight:700;color:#0f172a">Indicadores para reduzir órfãos</div><div style="color:#64748b;font-size:12px;margin-top:2px">${esc(orphanTopGatilhoFinal)}</div><div style="color:#64748b;font-size:12px;margin-top:2px">${esc(orphanTopRemTokensFinal)}</div><div style="color:#64748b;font-size:12px;margin-top:2px">${esc(orphanTopSaidaFinal)}</div>${specialDiagHtml}<div style="color:#64748b;font-size:12px;margin-top:2px">Grupos-base candidatos por sobreposição de localizador+gatilho: ${esc(orphanCandidateGroups)}</div><div style="color:#92400e;font-size:12px;margin-top:4px"><strong>Aviso:</strong> Uma mesma regra pode aparecer em mais de um critério de agrupamento; as listas abaixo são recortes não excludentes. O total de órfãs distintas permanece ${orphanRulesResidual.length}.</div>${gatilhoOutrosHtml}${orphanHierarchyHtmlFinal}</div>`;
        const smallAPromotedSet = new Set();
        skeletonGroups.forEach((g, idx) => {
          if (!smallAOrigIdxSet.has(idx)) return;
          if ((g.members || []).every((id) => bRuleSet.has(String(id)))) smallAPromotedSet.add(idx);
        });
        const aGroupsDisplayBase = skeletonGroups.filter((g, idx) => !smallAPromotedSet.has(idx));
        const refreshDisplayGroup = (g) => {
          const members = (g.members || []).map(String);
          const remVariants = Array.from(new Set(members.map((id) => rulesByNum.get(String(id))?.rem).filter(Boolean)));
          const remUnion = Array.from(new Set(members.flatMap((id) => {
            const rr = rulesByNum.get(String(id));
            return (rr?.remTokens && rr.remTokens.length) ? rr.remTokens : [rr?.remKey || '(sem localizador)'];
          }).map((x) => clean(String(x || ''))).filter(Boolean)));
          const baseTok = (g?.remCommonTokens && g.remCommonTokens.length) ? g.remCommonTokens[0] : (g?.remKey || '(sem localizador)');
          const ev = [`${baseTok} => ${members.slice(0, 6).join(', ')}${members.length > 6 ? ` (+${members.length - 6})` : ''}`];
          return {
            ...g,
            members,
            remVariants,
            remUnionTokens: remUnion,
            remJoinEvidence: ev,
            remJoinEvidenceFull: [{ tok: String(baseTok), ids: members.slice() }]
          };
        };
        const aGroupsDisplayReal = aGroupsDisplayBase
          .map((g) => ({ ...g, members: (g.members || []).filter((id) => !pseudoRuleSet.has(String(id)) && !cirandaRuleSet.has(String(id))) }))
          .filter((g) => (g.members || []).length >= 2)
          .map((g) => ({ ...refreshDisplayGroup(g), tipoGatilho: 'Real' }));
        const aGroupsDisplayPseudo = cGroups
          .map((g) => ({
            rem: g.remLabel || '(sem localizador)',
            remKey: `L:[${String(g.remLabel || '(sem localizador)')}]`,
            remCommonTokens: [String(g.remLabel || '(sem localizador)')],
            remSharedTokens: [String(g.remLabel || '(sem localizador)')],
            remUnionTokens: [String(g.remLabel || '(sem localizador)')],
            remJoinEvidence: [],
            remJoinEvidenceFull: [],
            remJoinMode: 'Grupo C incorporado ao conjunto de grupos A (pseudogatilho).',
            remVariants: [String(g.remLabel || '(sem localizador)')],
            gatKey: `PSEUDO:[${String(g.gatLabel || 'n/d')}]`,
            gatLabel: g.gatLabel || 'n/d',
            members: (g.members || []).map(String).filter((id) => !cirandaRuleSet.has(String(id))),
            tipoGatilho: 'Pseudogatilho',
            subtipoPseudogatilho: String(g.gatLabel || '').split(':')[0] || 'Pseudogatilho'
          }))
          .filter((g) => (g.members || []).length >= 1)
          .map((g) => refreshDisplayGroup(g));
        const aGroupsForUnify = [...aGroupsDisplayReal, ...aGroupsDisplayPseudo]
          .map((g) => ({ ...g, ...classificarPilar(g) }));
        // Fusão A/C por equivalência: mesmo REMOVER + mesmo pilar.
        const aGroupsUnifiedMap = new Map();
        aGroupsForUnify.forEach((g) => {
          const remRef = String((g?.remCommonTokens && g.remCommonTokens[0]) || g?.remKey || g?.rem || '(sem localizador)');
          const key = `${normalizeTxt(remRef)}|||${String(g?.pilar || 'Cumprimento')}`;
          if (!aGroupsUnifiedMap.has(key)) {
            aGroupsUnifiedMap.set(key, {
              remRef,
              pilar: String(g?.pilar || 'Cumprimento'),
              members: new Set(),
              tiposOrigem: new Set(),
              pseudoSubtipos: new Set()
            });
          }
          const acc = aGroupsUnifiedMap.get(key);
          (g.members || []).forEach((id) => acc.members.add(String(id)));
          acc.tiposOrigem.add(String(g.tipoGatilho || 'Real'));
          if (String(g.tipoGatilho || '') === 'Pseudogatilho') {
            acc.pseudoSubtipos.add(String(g.subtipoPseudogatilho || 'Pseudogatilho'));
          }
        });
        const aGroupsDisplay = Array.from(aGroupsUnifiedMap.values())
          .map((x) => {
            const members = Array.from(x.members).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR'));
            const base = refreshDisplayGroup({
              rem: x.remRef || '(sem localizador)',
              remKey: `L:[${String(x.remRef || '(sem localizador)')}]`,
              remCommonTokens: [String(x.remRef || '(sem localizador)')],
              remSharedTokens: [String(x.remRef || '(sem localizador)')],
              remUnionTokens: [String(x.remRef || '(sem localizador)')],
              remJoinEvidence: [],
              remJoinEvidenceFull: [],
              remJoinMode: 'Grupo A unificado por equivalência REMOVER + pilar.',
              remVariants: [String(x.remRef || '(sem localizador)')],
              gatKey: `UNIFIED:[${String(x.pilar)}]`,
              gatLabel: `Unificado por pilar: ${x.pilar}`,
              members
            });
            const tiposOrigem = Array.from(x.tiposOrigem);
            const tipoGatilho = (tiposOrigem.length > 1) ? 'Misto' : (tiposOrigem[0] || 'Real');
            return {
              ...base,
              pilar: x.pilar,
              tipoGatilho,
              gatilhos: tiposOrigem,
              subtipoPseudogatilho: Array.from(x.pseudoSubtipos).join(', ')
            };
          })
          .map((g) => ({ ...g, ...classificarPilar(g) }))
          .sort((a, b) => b.members.length - a.members.length || String(a.remKey).localeCompare(String(b.remKey), 'pt-BR'));
        const bGroupsDisplay = bGroups
          .map((g) => ({ ...g, members: (g.members || []).filter((id) => !pseudoRuleSet.has(String(id)) && !cirandaRuleSet.has(String(id))) }))
          .filter((g) => (g.members || []).length >= 2)
          .map((g) => ({ ...refreshDisplayGroup(g), ...classificarPilar(g) }));
        const promotedASmallCount = smallAPromotedSet.size;
        const groupsForDisplay = [
          ...aGroupsDisplay.map((g, i) => ({ ...g, __kind: 'A', __idx: i + 1 })),
          ...bGroupsDisplay.map((g, i) => ({ ...g, __kind: 'B', __idx: i + 1 }))
        ];
        const pilarCounter = new Map([['Prazo', 0], ['Passagem', 0], ['Cumprimento', 0]]);
        aGroupsDisplay.forEach((g) => {
          const p = String(g?.pilar || 'Cumprimento');
          pilarCounter.set(p, (pilarCounter.get(p) || 0) + 1);
        });
        const aPseudoCount = aGroupsDisplay.filter((g) => String(g.tipoGatilho) === 'Pseudogatilho').length;
        const aMistoCount = aGroupsDisplay.filter((g) => String(g.tipoGatilho) === 'Misto').length;
        const aRealCount = aGroupsDisplay.filter((g) => String(g.tipoGatilho) === 'Real').length;
        const pseudoEventoCount = cGroups.filter((g) => /pseudoevento/i.test(String(g.gatLabel || ''))).length;
        const pseudoPrazoCount = cGroups.filter((g) => /pseudoprazo/i.test(String(g.gatLabel || ''))).length;
        const bAltaDispersao = bGroupsDisplay.filter((g) => Number((g.remUnionTokens || []).length || 0) >= 4).length;
        const gruposComExecucaoA = aGroupsDisplay.filter((g) => g.temExecucao).length;
        const resumoExecutivoHtml = `<div style="margin-bottom:10px;border:1px solid #cbd5e1;border-radius:8px;padding:10px;background:#f8fafc"><div style="font-weight:700;color:#0f172a">Sumário executivo</div><div style="margin-top:6px;display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:8px"><div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px;background:#fff"><strong>Regras</strong><div style="color:#334155;font-size:12px;margin-top:2px">Total: ${allRuleNums.length}</div><div style="color:#334155;font-size:12px">Órfãs: ${orphanRulesResidual.length}</div><div style="color:#334155;font-size:12px">Reservadas em cirandas: ${cirandaRuleSet.size}</div></div><div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px;background:#fff"><strong>Grupos A unificados</strong><div style="color:#334155;font-size:12px;margin-top:2px">Total: ${aGroupsDisplay.length}</div><div style="color:#334155;font-size:12px">Real: ${aRealCount} | Pseudogatilho: ${aPseudoCount} | Misto: ${aMistoCount}</div><div style="color:#334155;font-size:12px">Pseudo origem: evento ${pseudoEventoCount} | prazo ${pseudoPrazoCount}</div></div><div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px;background:#fff"><strong>Pilares (A)</strong><div style="color:#334155;font-size:12px;margin-top:2px">Prazo: ${pilarCounter.get('Prazo') || 0}</div><div style="color:#334155;font-size:12px">Passagem: ${pilarCounter.get('Passagem') || 0}</div><div style="color:#334155;font-size:12px">Cumprimento: ${pilarCounter.get('Cumprimento') || 0}</div><div style="color:#334155;font-size:12px">Com execução: ${gruposComExecucaoA}</div></div><div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px;background:#fff"><strong>Grupos B</strong><div style="color:#334155;font-size:12px;margin-top:2px">Total: ${bGroupsDisplay.length}</div><div style="color:#334155;font-size:12px">Alta dispersão: ${bAltaDispersao}</div></div><div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px;background:#fff"><strong>Órfãs e famílias</strong><div style="color:#334155;font-size:12px;margin-top:2px">Órfãs: ${orphanRulesResidual.length}</div><div style="color:#334155;font-size:12px">Famílias (2+): ${orphanFamilies.length}</div></div><div style="border:1px solid #e2e8f0;border-radius:6px;padding:6px;background:#fff"><strong>Recorte atual</strong><div style="color:#334155;font-size:12px;margin-top:2px">Pares: ${pairRecords.length}</div><div style="color:#334155;font-size:12px">Interseções: ${interRows.length}</div></div></div></div>`;
        const displayCodeByIdx = new Map(groupsForDisplay.map((g, i) => [i, `${g.__kind || 'A'}${String(g.__idx || (i + 1)).padStart(2, '0')}`]));
        const displayProfiles = groupsForDisplay.map((g) => {
          const tokenSet = new Set();
          const tokenName = new Map();
          (g.members || []).forEach((id) => {
            const rr = rulesByNum.get(String(id));
            (rr?.gatTokensNamed || []).forEach((nm) => {
              const nk = normalizeGatilhoTokenKey(nm);
              if (!nk) return;
              tokenSet.add(nk);
              if (!tokenName.has(nk)) tokenName.set(nk, String(nm));
            });
          });
          return {
            kind: String(g?.__kind || ''),
            remKey: String((g?.remCommonTokens && g.remCommonTokens[0]) || g?.remKey || ''),
            gatType: String((rulesByNum.get(String(g.members?.[0]))?.gatTypeKey) || ''),
            tokenSet,
            tokenName
          };
        });
        const mergeSuggestionsByDisplay = new Map();
        const addDispSug = (fromIdx, payload) => {
          if (!mergeSuggestionsByDisplay.has(fromIdx)) mergeSuggestionsByDisplay.set(fromIdx, []);
          mergeSuggestionsByDisplay.get(fromIdx).push(payload);
        };
        for (let i = 0; i < groupsForDisplay.length; i += 1) {
          for (let j = i + 1; j < groupsForDisplay.length; j += 1) {
            const a = displayProfiles[i], b = displayProfiles[j];
            if (!a || !b) continue;
            if (a.kind !== 'A' || b.kind !== 'A') continue;
            if (a.gatType !== b.gatType) continue;
            if (a.remKey !== b.remKey) continue;
            const onlyA = Array.from(a.tokenSet).filter((x) => !b.tokenSet.has(x));
            const onlyB = Array.from(b.tokenSet).filter((x) => !a.tokenSet.has(x));
            const inter = Array.from(a.tokenSet).filter((x) => b.tokenSet.has(x)).length;
            const diff = onlyA.length + onlyB.length;
            if (diff > 6) continue;
            const diffNames = [...onlyA, ...onlyB].map((k) => a.tokenName.get(k) || b.tokenName.get(k) || k);
            addDispSug(i, { otherCode: displayCodeByIdx.get(j), diff, diffNames, inter });
            addDispSug(j, { otherCode: displayCodeByIdx.get(i), diff, diffNames, inter });
          }
        }
        mergeSuggestionsByDisplay.forEach((arr, idx) => {
          arr.sort((x, y) => x.diff - y.diff || y.inter - x.inter || String(x.otherCode).localeCompare(String(y.otherCode), 'pt-BR'));
          mergeSuggestionsByDisplay.set(idx, arr);
        });
        const unifiedSkeletonHtml = (groupsForDisplay.length || orphanRulesResidual.length)
          ? `${resumoExecutivoHtml}<div style="margin-bottom:8px;color:#334155">Grupo = mesmo REMOVER + mesmos gatilhos específicos (evento/petição/documento/data-tempo). Inclui regras com e sem conflito.</div><div style="margin-bottom:8px;color:#334155">Grupos A unificados: ${aGroupsDisplay.length}${promotedASmallCount ? ` (A pequenos promovidos para B: ${promotedASmallCount})` : ''} [real: ${aRealCount} | pseudogatilho: ${aPseudoCount} | misto: ${aMistoCount}] | Grupos flexíveis (B): ${bGroupsDisplay.length} | Grupo C (pseudogatilhos) incorporado em A | Regras sem grupo de 2+ (órfãs): ${orphanRulesResidual.length}</div><div style="display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:10px">${groupsForDisplay.map((g, idx) => {
            const set = new Set(g.members.map(String));
            const rels = groupEdgeRecords.filter((e) => set.has(String(e.a)) && set.has(String(e.b)));
            const relTypeCounts = new Map();
            rels.forEach((e) => relTypeCounts.set(e.tipoAgrupado, (relTypeCounts.get(e.tipoAgrupado) || 0) + 1));
            const conts = containsUnique.filter((e) => set.has(String(e.broad)) && set.has(String(e.narrow)));
            const conflMembers = g.members.filter((n) => conflictRuleSet.has(String(n))).length;
            const pr = Array.from(new Set(g.members.map((n) => clean(ruleMeta.get(String(n))?.prio || '')).filter(Boolean)));
            const remLabel = g.remVariants.length === 1 ? g.remVariants[0] : `${g.remKey} (${g.remVariants.length} variações E/OU)`;
            const fmt = (arr, lim) => (arr.length <= lim ? arr.join(', ') : `${arr.slice(0, lim).join(', ')} (+${arr.length - lim})`);
            const commonTxt = g.remCommonTokens && g.remCommonTokens.length ? fmt(g.remCommonTokens, 6) : 'sem localizador comum em 100% das regras';
            const sharedTxt = g.remSharedTokens && g.remSharedTokens.length ? fmt(g.remSharedTokens, 8) : 'n/d';
            const unionTxt = g.remUnionTokens && g.remUnionTokens.length ? fmt(g.remUnionTokens, 10) : 'n/d';
            const joinEvTxt = g.remJoinEvidence && g.remJoinEvidence.length ? fmt(g.remJoinEvidence, 4) : 'n/d';
            const joinFullTitle = (g.__kind === 'B')
              ? 'Regras por localizador (grupo B)'
              : 'Todas as regras por localizador usado na união';
            const joinFullHtml = (g.remJoinEvidenceFull && g.remJoinEvidenceFull.length)
              ? `<details style="margin-top:6px"><summary style="cursor:pointer;color:#0f172a;font-size:12px"><strong>${esc(joinFullTitle)}</strong></summary><div style="margin-top:4px">${g.remJoinEvidenceFull.map((e) => `<div style="font-size:12px;color:#334155;margin-top:4px"><div><strong>${esc(e.tok)}</strong> (${e.ids.length})</div><div style="line-height:1.5;margin-top:2px">${e.ids.map((id) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(id)}</span>`).join('')}</div></div>`).join('')}</div></details>`
              : '';
            const nonUnionLocHtml = (() => {
              const base = String((g.remCommonTokens && g.remCommonTokens[0]) || '');
              if (!base) return '';
              const byTok = new Map();
              (g.members || []).forEach((id) => {
                const rr = rulesByNum.get(String(id));
                const toks = (rr?.remTokens && rr.remTokens.length) ? rr.remTokens : [rr?.remKey || '(sem localizador)'];
                toks.forEach((tk) => {
                  const raw = clean(String(tk || ''));
                  if (!raw || raw === base) return;
                  if (!byTok.has(raw)) byTok.set(raw, []);
                  byTok.get(raw).push(String(id));
                });
              });
              const rows = Array.from(byTok.entries())
                .map(([tok, ids]) => ({ tok, ids: Array.from(new Set(ids)).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')) }))
                .sort((a, b) => b.ids.length - a.ids.length || String(a.tok).localeCompare(String(b.tok), 'pt-BR'));
              if (!rows.length) return '';
              return `<details style="margin-top:6px"><summary style="cursor:pointer;color:#0f172a;font-size:12px"><strong>Regras por localizador não usado na união principal</strong></summary><div style="margin-top:4px">${rows.map((r) => `<div style="font-size:12px;color:#334155;margin-top:4px"><div><strong>${esc(r.tok)}</strong> (${r.ids.length})</div><div style="line-height:1.5;margin-top:2px">${r.ids.map((id) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(id)}</span>`).join('')}</div></div>`).join('')}</div></details>`;
            })();
            const sugs = mergeSuggestionsByDisplay.get(idx) || [];
            const sug = sugs[0];
            const diffNamesTxt = (s) => {
              const arr = Array.isArray(s?.diffNames) ? s.diffNames.filter(Boolean) : [];
              if (!arr.length) return 'n/d';
              return arr.length <= 3 ? arr.join(', ') : `${arr.slice(0, 3).join(', ')} (+${arr.length - 3})`;
            };
            const sugMain = sug
              ? (sug.diff === 0
                ? `unir com Grupo ${sug.otherCode} (gatilhos idênticos)`
                : (sug.diff === 1
                  ? `unir com Grupo ${sug.otherCode} (diferença de 1 gatilho: ${diffNamesTxt(sug)})`
                  : `avaliar Grupo ${sug.otherCode} (diferença de ${sug.diff} gatilhos: ${diffNamesTxt(sug)})`))
              : '';
            const sugAll = sugs.length > 1
              ? sugs.slice(0, 5).map((s) => `${s.otherCode}: Δ${s.diff}${s.diff ? ` (${diffNamesTxt(s)})` : ' (idêntico)'}`).join(' | ')
              : '';
            const sugHtml = sug
              ? `<div style="color:#92400e;font-size:12px;margin-top:2px"><strong>Sugestão:</strong> ${esc(sugMain)}${sugAll ? `<br/><strong>Outras possibilidades:</strong> ${esc(sugAll)}` : ''}</div>`
              : '';
            const poloMap = new Map();
            const scopeMap = new Map();
            g.members.forEach((id) => {
              const rr = rulesByNum.get(String(id));
              const polo = rr?.poloLabel || 'sem pólo';
              poloMap.set(polo, (poloMap.get(polo) || 0) + 1);
              const m = ruleMeta.get(String(id));
              const fields = Array.from(m?.outrosFields || new Set())
                .map((x) => clean(String(x || '')))
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, 'pt-BR'));
              const ass = fields.length ? fields.join(' + ') : '(sem filtros de Outros)';
              const sk = `${polo}|||${ass}`;
              if (!scopeMap.has(sk)) scopeMap.set(sk, { polo, assinatura: ass, ids: [] });
              scopeMap.get(sk).ids.push(String(id));
            });
            const poloTxt = Array.from(poloMap.entries())
              .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'))
              .map(([k, n]) => `${k} (${n})`)
              .join(', ');
            const bDbg = (g.__kind === 'B') ? bCirandaDebugMap.get(bGroupKey(g)) : null;
            const bDiagHtml = (g.__kind === 'B' && bDbg)
              ? `<div style="color:${bDbg.ok ? '#166534' : '#92400e'};font-size:12px;margin-top:2px"><strong>Diagnóstico D:</strong> ${bDbg.ok ? 'candidata/promovida' : 'não promovida'} (${esc(String(bDbg.motivo || 'n/d'))}) | nós=${Number(bDbg.nos || 0)} | transições=${Number(bDbg.arestas || 0)} | nós ponte=${Number(bDbg.nosPonte || 0)}${Array.isArray(bDbg.transicoes) && bDbg.transicoes.length ? `<br/><strong>Amostra:</strong> ${esc(bDbg.transicoes.slice(0, 4).join(' | '))}` : ''}</div>`
              : '';
            const hasSemPolo = (poloMap.get('sem pólo') || 0) > 0;
            const hasAtivo = Array.from(poloMap.keys()).some((k) => /ATIVO/i.test(String(k)));
            const hasPassivo = Array.from(poloMap.keys()).some((k) => /PASSIVO/i.test(String(k)));
            const riscoPolo = hasSemPolo && (hasAtivo || hasPassivo)
              ? `<div style="color:#92400e;font-size:12px;margin-top:2px"><strong>Atenção:</strong> há regras sem pólo no grupo (podem sobrepor ATIVO/PASSIVO).</div>`
              : '';
            const scopeRows = Array.from(scopeMap.values())
              .map((x) => ({ ...x, ids: x.ids.sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b), 'pt-BR')) }))
              .sort((a, b) => b.ids.length - a.ids.length || String(a.polo).localeCompare(String(b.polo), 'pt-BR') || String(a.assinatura).localeCompare(String(b.assinatura), 'pt-BR'));
            const scopeHtml = scopeRows.length
              ? `<details style="margin-top:6px"><summary style="cursor:pointer;color:#0f172a;font-size:12px"><strong>Subgrupos por escopo útil (Pólo + assinatura de filtros)</strong></summary><div style="color:#64748b;font-size:12px;margin-top:2px">Dispersão de escopo: ${scopeRows.length} subgrupos.</div><div style="margin-top:4px">${scopeRows.slice(0, 12).map((s) => `<div style="font-size:12px;color:#334155;margin-top:4px"><div><strong>${esc(s.polo)}</strong> • Filtros: ${esc(s.assinatura.length > 90 ? `${s.assinatura.slice(0, 90)}...` : s.assinatura)} (${s.ids.length})</div><div style="line-height:1.5;margin-top:2px">${s.ids.map((id) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(id)}</span>`).join('')}</div></div>`).join('')}${scopeRows.length > 12 ? `<div style="color:#64748b;font-size:12px;margin-top:4px">+${scopeRows.length - 12} subgrupos adicionais</div>` : ''}</div></details>`
              : '';
            const gCode = `${g.__kind || 'A'}${String(g.__idx || (idx + 1)).padStart(2, '0')}`;
            return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px"><div style="display:flex;justify-content:space-between;gap:8px"><strong>Grupo ${gCode}</strong><span style="color:#334155">Regras: ${g.members.length}</span></div><div style="margin-top:4px;color:#0f172a"><strong>Esqueleto:</strong> REMOVER = ${esc(remLabel)} • Gatilho = ${esc(g.gatLabel)}</div><div style="color:#64748b;font-size:12px;margin-top:2px"><strong>Escopo (Pólo):</strong> ${esc(poloTxt || 'n/d')}</div><div style="color:#64748b;font-size:12px;margin-top:2px"><strong>Pilar:</strong> ${esc(g.pilar || 'Cumprimento')} | <strong>Execução:</strong> ${g.temExecucao ? 'sim' : 'não'}${g.tipoGatilho ? ` | <strong>Tipo de gatilho:</strong> ${esc(g.tipoGatilho)}` : ''}${Array.isArray(g.gatilhos) && g.gatilhos.length ? ` [${esc(g.gatilhos.join(', '))}]` : ''}${g.subtipoPseudogatilho ? ` (${esc(g.subtipoPseudogatilho)})` : ''}</div>${bDiagHtml}${riscoPolo}${sugHtml}<div style="color:#64748b;font-size:12px;margin-top:2px"><strong>Lógica que uniu:</strong> ${esc(g.remJoinMode || 'n/d')}</div><div style="color:#64748b;font-size:12px;margin-top:2px"><strong>Evidência de união (token => regras):</strong> ${esc(joinEvTxt)}</div>${joinFullHtml}${nonUnionLocHtml}${scopeHtml}<div style="color:#64748b;font-size:12px;margin-top:2px">Critério de união (REMOVER): comuns = ${esc(commonTxt)} | compartilhados (2+ regras) = ${esc(sharedTxt)}</div><div style="color:#64748b;font-size:12px;margin-top:2px">Localizadores observados no grupo: ${esc(unionTxt)}</div><div style="color:#64748b;font-size:12px;margin-top:2px">Cobertura: em conflito/pseudoconflito ${conflMembers} | sem conflito ${g.members.length - conflMembers}</div><div style="color:#64748b;font-size:12px;margin-top:2px">Relações internas: ${rels.length}${rels.length ? ` (${esc(countMapToText(relTypeCounts))})` : ''} | Contenções internas: ${conts.length}</div><div style="color:#64748b;font-size:12px;margin-top:2px">Prioridades no grupo: ${pr.length ? esc(pr.join(', ')) : 'n/d'}</div><div style="margin-top:6px;font-size:12px;line-height:1.6">${(g.members.length <= 40 ? g.members : g.members.slice(0, 40)).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}${g.members.length > 40 ? `<span style="display:inline-block;color:#64748b;margin-left:6px">+${g.members.length - 40} regras</span>` : ''}</div></div>`;
          }).join('')}${cirandasHtml}${orphanRulesResidual.length ? `<div style="border:1px dashed #cbd5e1;border-radius:8px;padding:8px;background:#f8fafc"><div style="display:flex;justify-content:space-between;gap:8px"><strong>Grupo Órfão (a revisar)</strong><span style="color:#334155">Regras: ${orphanRulesResidual.length}</span></div><div style="color:#64748b;font-size:12px;margin-top:2px">Regras sem par de esqueleto no critério atual (REMOVER + gatilho).</div>${orphanInsightsHtml}${orphanFamiliesHtml}<div style="margin-top:6px;font-size:12px;line-height:1.6">${(orphanRulesResidual.length <= 120 ? orphanRulesResidual : orphanRulesResidual.slice(0, 120)).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}${orphanRulesResidual.length > 120 ? `<span style="display:inline-block;color:#64748b;margin-left:6px">+${orphanRulesResidual.length - 120} regras</span>` : ''}</div></div>` : ''}</div>`
          : '<div>Sem grupos por esqueleto para mostrar.</div>';
        const bridgeHtml = outputBridgeGroups.length
          ? `<div style="margin-bottom:8px;color:#334155">Agrupamento complementar (não substitui o esqueleto): mesmo gatilho + mesmo localizador de saída (INCLUIR/AÇÃO), útil para reunir órfãs e pontes entre grupos.</div><div style="margin-bottom:8px;color:#334155">Pontes: ${outputBridgeGroups.length} | Órfãs cobertas por pontes: ${orphanRulesInBridges.length} | Órfãs fora de pontes: ${orphanRulesOutOfBridges.length}</div><div style="display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:10px">${outputBridgeGroups.map((g, idx) => {
            const hasOrphan = g.members.filter((r) => orphanSet.has(String(r)));
            const local = new Map();
            g.members.forEach((r) => {
              const k = primaryGroupByRule.get(String(r)) ? `#${primaryGroupByRule.get(String(r))}` : `Órfã`;
              local.set(k, (local.get(k) || 0) + 1);
            });
            const localEntries = Array.from(local.entries()).sort((a, b) => b[1] - a[1]);
            const bridgeSet = new Set(g.members.map(String));
            const bestMatch = skeletonGroups.map((sg, sidx) => {
              const inter = sg.members.filter((r) => bridgeSet.has(String(r))).length;
              if (!inter) return null;
              const union = new Set([...sg.members.map(String), ...g.members.map(String)]).size;
              const jacc = union ? Math.round((inter / union) * 100) : 0;
              const covBridge = g.members.length ? Math.round((inter / g.members.length) * 100) : 0;
              const covGroup = sg.members.length ? Math.round((inter / sg.members.length) * 100) : 0;
              let rel = 'Relacionada';
              if (inter === g.members.length && inter === sg.members.length) rel = 'Idêntica';
              else if (inter === g.members.length) rel = 'Ponte contida no grupo';
              else if (inter === sg.members.length) rel = 'Grupo contido na ponte';
              return { id: sidx + 1, jacc, covBridge, covGroup, rel };
            }).filter(Boolean).sort((a, b) => b.jacc - a.jacc || b.covBridge - a.covBridge)[0];
            return `<div style="border:1px dashed #94a3b8;border-radius:8px;padding:8px;background:#f8fafc"><div style="display:flex;justify-content:space-between;gap:8px"><strong>Ponte ${idx + 1}</strong><span style="color:#334155">Regras: ${g.members.length}</span></div><div style="margin-top:4px;color:#0f172a"><strong>Critério complementar:</strong> Gatilho = ${esc(g.gatLabel)} • Saída = ${esc(g.out)}</div><div style="color:#64748b;font-size:12px;margin-top:2px">Órfãs envolvidas: ${hasOrphan.length} | Grupos-base conectados: ${localEntries.filter(([k]) => k !== 'Órfã').map(([k]) => k).join(', ') || 'nenhum'}</div><div style="color:#64748b;font-size:12px;margin-top:2px">Mais parecido: ${bestMatch ? `Grupo #${bestMatch.id}` : 'nenhum'} | Similaridade: ${bestMatch ? `${bestMatch.jacc}%` : '0%'}${bestMatch ? ` | Cob. ponte: ${bestMatch.covBridge}% | Cob. grupo: ${bestMatch.covGroup}% | ${bestMatch.rel}` : ''}</div><div style="margin-top:6px;font-size:12px;line-height:1.6">${(g.members.length <= 40 ? g.members : g.members.slice(0, 40)).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}${g.members.length > 40 ? `<span style="display:inline-block;color:#64748b;margin-left:6px">+${g.members.length - 40} regras</span>` : ''}</div></div>`;
          }).join('')}</div>${orphanRulesOutOfBridges.length ? `<div style="margin-top:8px;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;background:#fff"><div><strong>Órfãs de pontes (sem ponte complementar)</strong></div><div style="color:#64748b;font-size:12px;margin-top:2px">Essas regras não entraram em nenhuma ponte (gatilho + saída).</div><div style="margin-top:6px;font-size:12px;line-height:1.6">${(orphanRulesOutOfBridges.length <= 120 ? orphanRulesOutOfBridges : orphanRulesOutOfBridges.slice(0, 120)).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}${orphanRulesOutOfBridges.length > 120 ? `<span style="display:inline-block;color:#64748b;margin-left:6px">+${orphanRulesOutOfBridges.length - 120} regras</span>` : ''}</div></div>` : ''}${bridgeAuditHtml}`
          : '<div>Sem agrupamentos complementares relevantes no recorte atual.</div>';
        let superGruposHtml = '<div>Supergrupos indisponíveis no momento.</div>';
        let superPontesHtml = '<div>Superpontes indisponíveis no momento.</div>';
        try {
          const orphanByRem = new Map();
          const orphanByOut = new Map();
          orphanRules.forEach((r) => {
            const m = ruleMeta.get(String(r));
            const rem = removerLogicKey(clean(m?.remover || '') || '(REMOVER vazio)');
            const out = clean(m?.incluir || '') || '(AÇÃO/INCLUIR vazio)';
            if (!orphanByRem.has(rem)) orphanByRem.set(rem, []);
            if (!orphanByOut.has(out)) orphanByOut.set(out, []);
            orphanByRem.get(rem).push(String(r));
            orphanByOut.get(out).push(String(r));
          });
          const superByRem = new Map();
          skeletonGroups.forEach((g, idx) => {
            const key = String(removerFamilyKey(g.rem || g.remKey || '(REMOVER vazio)'));
            if (!superByRem.has(key)) superByRem.set(key, { rem: key, groups: [], rules: new Set(), orphans: [] });
            const s = superByRem.get(key);
            s.groups.push(idx + 1);
            g.members.forEach((r) => s.rules.add(String(r)));
          });
          orphanByRem.forEach((arr, rem) => {
            const remFamily = String(removerFamilyKey(rem));
            if (!superByRem.has(remFamily)) superByRem.set(remFamily, { rem: remFamily, groups: [], rules: new Set(), orphans: [] });
            const s = superByRem.get(remFamily);
            s.orphans.push(...arr);
            arr.forEach((r) => s.rules.add(String(r)));
          });
          const superGroups = Array.from(superByRem.values())
            .map((s) => ({ ...s, rules: Array.from(s.rules).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b)) ) }))
            .filter((s) => s.rules.length >= 2)
            .sort((a, b) => b.rules.length - a.rules.length || String(a.rem).localeCompare(String(b.rem), 'pt-BR'));
          const includedInSuperGroups = new Set(superGroups.flatMap((s) => s.rules.map(String)));
          const notInSuperGroups = allRuleNums.filter((r) => !includedInSuperGroups.has(String(r)));
          superGruposHtml = superGroups.length
            ? `<div style="margin-bottom:8px;color:#334155">Supergrupo = mesmo localizador de entrada (REMOVER), contendo grupos-base e órfãs.</div><div style="margin-bottom:8px;color:#334155">Regras fora de supergrupo: ${notInSuperGroups.length}</div><div style="display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:10px">${superGroups.map((s, idx) => `<div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px"><div style="display:flex;justify-content:space-between;gap:8px"><strong>Supergrupo ${idx + 1}</strong><span style="color:#334155">Regras: ${s.rules.length}</span></div><div style="margin-top:4px;color:#0f172a"><strong>Entrada:</strong> ${esc(s.rem)}</div><div style="color:#64748b;font-size:12px;margin-top:2px">Grupos dentro: ${s.groups.length ? s.groups.map((g) => `#${g}`).join(', ') : 'nenhum'} | Órfãs dentro: ${s.orphans.length}</div><div style="margin-top:6px;font-size:12px;line-height:1.6">${(s.rules.length <= 40 ? s.rules : s.rules.slice(0, 40)).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}${s.rules.length > 40 ? `<span style="display:inline-block;color:#64748b;margin-left:6px">+${s.rules.length - 40} regras</span>` : ''}</div></div>`).join('')}${notInSuperGroups.length ? `<div style="border:1px dashed #cbd5e1;border-radius:8px;padding:8px;background:#fff"><div><strong>Sem supergrupo (entrada)</strong></div><div style="margin-top:6px;font-size:12px;line-height:1.6">${(notInSuperGroups.length <= 120 ? notInSuperGroups : notInSuperGroups.slice(0, 120)).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}${notInSuperGroups.length > 120 ? `<span style="display:inline-block;color:#64748b;margin-left:6px">+${notInSuperGroups.length - 120} regras</span>` : ''}</div></div>` : ''}</div>`
            : '<div>Sem supergrupos de entrada (2+ regras) no recorte atual.</div>';
          const superByOut = new Map();
          outputBridgeGroups.forEach((b, idx) => {
            const key = String(b.out || '(AÇÃO/INCLUIR vazio)');
            if (!superByOut.has(key)) superByOut.set(key, { out: key, bridges: [], rules: new Set(), orphans: [] });
            const s = superByOut.get(key);
            s.bridges.push(idx + 1);
            b.members.forEach((r) => s.rules.add(String(r)));
          });
          orphanByOut.forEach((arr, out) => {
            if (!superByOut.has(out)) superByOut.set(out, { out, bridges: [], rules: new Set(), orphans: [] });
            const s = superByOut.get(out);
            s.orphans.push(...arr);
            arr.forEach((r) => s.rules.add(String(r)));
          });
          const superBridges = Array.from(superByOut.values())
            .map((s) => ({ ...s, rules: Array.from(s.rules).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b)) ) }))
            .filter((s) => s.rules.length >= 2)
            .sort((a, b) => b.rules.length - a.rules.length || String(a.out).localeCompare(String(b.out), 'pt-BR'));
          const includedInSuperBridges = new Set(superBridges.flatMap((s) => s.rules.map(String)));
          const notInSuperBridges = allRuleNums.filter((r) => !includedInSuperBridges.has(String(r)));
          const notInSuperBridgesSet = new Set(notInSuperBridges.map(String));
          const notInBoth = notInSuperGroups.filter((r) => notInSuperBridgesSet.has(String(r)));
          superPontesHtml = superBridges.length
            ? `<div style="margin-bottom:8px;color:#334155">Superponte = mesmo localizador de saída (INCLUIR/AÇÃO), contendo pontes e órfãs.</div><div style="margin-bottom:8px;color:#334155">Regras fora de superponte: ${notInSuperBridges.length}</div><div style="display:grid;grid-template-columns:repeat(2,minmax(320px,1fr));gap:10px">${superBridges.map((s, idx) => `<div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px"><div style="display:flex;justify-content:space-between;gap:8px"><strong>Superponte ${idx + 1}</strong><span style="color:#334155">Regras: ${s.rules.length}</span></div><div style="margin-top:4px;color:#0f172a"><strong>Saída:</strong> ${esc(s.out)}</div><div style="color:#64748b;font-size:12px;margin-top:2px">Pontes dentro: ${s.bridges.length ? s.bridges.map((p) => `P${p}`).join(', ') : 'nenhuma'} | Órfãs dentro: ${s.orphans.length}</div><div style="margin-top:6px;font-size:12px;line-height:1.6">${(s.rules.length <= 40 ? s.rules : s.rules.slice(0, 40)).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}${s.rules.length > 40 ? `<span style="display:inline-block;color:#64748b;margin-left:6px">+${s.rules.length - 40} regras</span>` : ''}</div></div>`).join('')}${notInSuperBridges.length ? `<div style="border:1px dashed #cbd5e1;border-radius:8px;padding:8px;background:#fff"><div><strong>Sem superponte (saída)</strong></div><div style="margin-top:6px;font-size:12px;line-height:1.6">${(notInSuperBridges.length <= 120 ? notInSuperBridges : notInSuperBridges.slice(0, 120)).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}${notInSuperBridges.length > 120 ? `<span style="display:inline-block;color:#64748b;margin-left:6px">+${notInSuperBridges.length - 120} regras</span>` : ''}</div></div>` : ''}</div>`
            : '<div>Sem superpontes de saída (2+ regras) no recorte atual.</div>';
          superPontesHtml += `<div style="margin-top:8px;border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#f8fafc"><div><strong>Intersecção ausente (sem supergrupo e sem superponte)</strong></div><div style="color:#64748b;font-size:12px;margin-top:2px">Total: ${notInBoth.length}</div>${notInBoth.length ? `<div style="margin-top:6px;font-size:12px;line-height:1.6">${(notInBoth.length <= 120 ? notInBoth : notInBoth.slice(0, 120)).map((m) => `<span style="display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;margin:2px">${esc(m)}</span>`).join('')}${notInBoth.length > 120 ? `<span style="display:inline-block;color:#64748b;margin-left:6px">+${notInBoth.length - 120} regras</span>` : ''}</div>` : ''}</div>`;
        } catch (e) {
          superGruposHtml = '<div>Supergrupos indisponíveis no momento.</div>';
          superPontesHtml = '<div>Superpontes indisponíveis no momento.</div>';
        }
        interRows.sort((a, b) => String(a.par).localeCompare(String(b.par)));
        const involved = new Map();
        interRows.forEach((r) => {
          const sp = String(r.par || '').split(' x ');
          if (sp.length === 2) {
            involved.set(sp[0], (involved.get(sp[0]) || 0) + 1);
            involved.set(sp[1], (involved.get(sp[1]) || 0) + 1);
          }
        });
        const topInvolved = Array.from(involved.entries()).sort((a, b) => b[1] - a[1]).slice(0, 16);
        const maxInv = Math.max(1, ...(topInvolved.map(([, n]) => n)));
        const barsHtml = topInvolved.length
          ? `<div style="display:grid;grid-template-columns:repeat(2,minmax(280px,1fr));gap:8px">${topInvolved.map(([id, n]) => `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px"><div style="display:flex;justify-content:space-between"><strong>${esc(id)}</strong><span>${n}</span></div><div style="margin-top:4px;height:8px;background:#f1f5f9;border-radius:6px"><div style="height:8px;border-radius:6px;background:#d97706;width:${Math.max(6, Math.round((n / maxInv) * 100))}%"></div></div></div>`).join('')}</div>`
          : '<div>Sem dados de interseção para painel visual.</div>';
        const interLimited = interRows;
        const interHtml = interRows.length
          ? `<div style="margin-bottom:8px;color:#334155">Mostrando ${interLimited.length} de ${interRows.length} interseções.</div><table id="tblInter" style="border-collapse:collapse;width:100%;font-size:12px"><thead><tr><th style="border:1px solid #e2e8f0;padding:6px">Par</th><th style="border:1px solid #e2e8f0;padding:6px">Tipo</th><th style="border:1px solid #e2e8f0;padding:6px">Eixo em disputa</th><th style="border:1px solid #e2e8f0;padding:6px">Motivo curto</th></tr></thead><tbody>${interLimited.map((r) => `<tr><td style="border:1px solid #e2e8f0;padding:6px">${esc(r.par)}</td><td style="border:1px solid #e2e8f0;padding:6px">${esc(r.tipo)}</td><td style="border:1px solid #e2e8f0;padding:6px">${esc(r.comum)}</td><td style="border:1px solid #e2e8f0;padding:6px">${esc(r.detalhe)}</td></tr>`).join('')}</tbody></table>`
          : '<div>Sem interseções para exibir no recorte atual.</div>';
        const rulesInPairsCount = (() => {
          const s = new Set();
          pairRecords.forEach((p) => { s.add(String(p.a)); s.add(String(p.b)); });
          return s.size;
        })();
        const interPriCount = interRows.filter((r) => String(r.tipo || '') === 'Priorização').length;
        const interSobCount = interRows.filter((r) => String(r.tipo || '') === 'Sobreposição').length;
        const vizPayload = JSON.stringify({ contains: containsUnique, inter: interRows }).replace(/</g, '\\u003c');
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.open();
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Mapa de Relações ATP</title></head><body style="margin:0;background:#fff;font-family:Segoe UI,Arial,sans-serif"><div style="padding:10px 12px;border-bottom:1px solid #e2e8f0"><strong>Mapa de Relações ATP</strong><span style="margin-left:10px;color:#334155">Pares: ${pairRecords.length} | Regras envolvidas: ${rulesInPairsCount} | Contenções: ${containsUnique.length} | Interseções: ${interRows.length} (Pri: ${interPriCount}, Sob: ${interSobCount})</span></div><div style="padding:10px 12px"><h3 style="margin:0 0 8px 0;color:#0f172a">Painel visual (regras mais envolvidas)</h3>${barsHtml}<h3 style="margin:14px 0 8px 0;color:#0f172a">Grupos unificados por esqueleto (REMOVER + Gatilhos específicos)</h3>${unifiedSkeletonHtml}<h3 style="margin:14px 0 8px 0;color:#0f172a">Agrupamentos complementares (Gatilho + Saída)</h3>${bridgeHtml}<h3 style="margin:14px 0 8px 0;color:#0f172a">Supergrupos (apenas Entrada/REMOVER)</h3>${superGruposHtml}<h3 style="margin:14px 0 8px 0;color:#0f172a">Superpontes (apenas Saída/INCLUIR)</h3>${superPontesHtml}<h3 style="margin:14px 0 8px 0;color:#0f172a">Explorador de contenção</h3><div style="margin:0 0 8px 0"><label>Regra base <select id="selBase" style="padding:4px 6px"></select></label></div><div id="boxContain" style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:8px;padding:8px"></div><h3 style="margin:14px 0 8px 0;color:#0f172a">Explorador de interseção (Venn simplificado)</h3><div style="margin:0 0 8px 0"><label>Par <select id="selPar" style="padding:4px 6px;min-width:260px"></select></label></div><div id="boxVenn" style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:8px;padding:8px"></div><details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;color:#0f172a">Árvore de contenção (completa)</summary><div style="margin-top:8px">${treeHtml}</div></details><details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;color:#0f172a">Tabela de interseções (completa)</summary><div style="margin:8px 0"><input id="filtroPar" placeholder="Filtrar por regra (ex: 401, 430, 264)" style="padding:6px 8px;width:320px;border:1px solid #cbd5e1;border-radius:6px"/></div><div style="overflow:auto">${interHtml}</div></details></div><script>(function(){var DATA=${vizPayload};var esc=function(s){return String(s||'').replace(/[&<>"]/g,function(ch){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]||ch);});};var selBase=document.getElementById('selBase');var boxContain=document.getElementById('boxContain');var byBase={};(DATA.contains||[]).forEach(function(e){if(!byBase[e.broad])byBase[e.broad]=[];byBase[e.broad].push(e);});Object.keys(byBase).sort(function(a,b){return (Number(a)||0)-(Number(b)||0)||String(a).localeCompare(String(b));}).forEach(function(id){var o=document.createElement('option');o.value=id;o.textContent=id+' ('+byBase[id].length+')';selBase.appendChild(o);});function drawContain(){if(!selBase||!boxContain)return;var base=selBase.value;var arr=byBase[base]||[];if(!arr.length){boxContain.innerHTML='Sem contenções para a regra selecionada.';return;}var html='<div><strong>Regra base '+esc(base)+'</strong></div><ul>';arr.forEach(function(e){html+='<li>Contém <strong>'+esc(e.narrow)+'</strong><br/><span style="color:#334155">'+esc((e.motivo||'').slice(0,220))+'</span></li>';});html+='</ul>';boxContain.innerHTML=html;}if(selBase){selBase.addEventListener('change',drawContain);if(selBase.options.length)selBase.value=selBase.options[0].value;drawContain();}var selPar=document.getElementById('selPar');var boxVenn=document.getElementById('boxVenn');(DATA.inter||[]).slice(0,800).forEach(function(r){var o=document.createElement('option');o.value=r.par;o.textContent=r.par+' · '+r.tipo;selPar.appendChild(o);});function drawVenn(){if(!selPar||!boxVenn)return;var rec=(DATA.inter||[]).find(function(r){return r.par===selPar.value;});if(!rec){boxVenn.innerHTML='Sem par selecionado.';return;}var sp=String(rec.par||'').split(' x ');var a=sp[0]||'A',b=sp[1]||'B';var eixo=String(rec.comum||'Interseção');var p=eixo.split(' sobre ');var aOnly=(p[0]||'Critérios A').trim();var bOnly=(p[1]||'Critérios B').trim();var ov='Interseção: '+eixo;var svg='<svg width="780" height="250" viewBox="0 0 780 250" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="780" height="250" fill="#fff"/><circle cx="300" cy="125" r="90" fill="#dbeafe" fill-opacity="0.65" stroke="#2563eb" stroke-width="2"/><circle cx="470" cy="125" r="90" fill="#fde68a" fill-opacity="0.65" stroke="#d97706" stroke-width="2"/><text x="240" y="45" font-size="14" font-weight="700" fill="#1e3a8a">Regra '+esc(a)+'</text><text x="500" y="45" font-size="14" font-weight="700" fill="#92400e">Regra '+esc(b)+'</text><foreignObject x="190" y="105" width="120" height="80"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:12px;color:#1e3a8a">'+esc(aOnly)+'</div></foreignObject><foreignObject x="470" y="105" width="120" height="80"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:12px;color:#92400e">'+esc(bOnly)+'</div></foreignObject><foreignObject x="330" y="108" width="120" height="80"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:12px;color:#111827"><strong>'+esc(ov)+'</strong></div></foreignObject></svg>';boxVenn.innerHTML=svg+'<div style="margin-top:6px;color:#334155">'+esc(rec.detalhe||'')+'</div>';}if(selPar){selPar.addEventListener('change',drawVenn);if(selPar.options.length)selPar.value=selPar.options[0].value;drawVenn();}var i=document.getElementById('filtroPar');if(i){i.addEventListener('input',function(){var v=String(i.value||'').toLowerCase();var rows=document.querySelectorAll('#tblInter tbody tr');rows.forEach(function(tr){var t=String(tr.textContent||'').toLowerCase();tr.style.display=(v&&t.indexOf(v)===-1)?'none':'';});});}})();</script></body></html>`);
        win.document.close();
      } catch (e) {
        console.warn(LOG_PREFIX, 'Falha ao abrir Mapa de Relações ATP', e);
      }
    });

    if (afterLabelEl && afterLabelEl.parentNode === host) {
      const anchor = afterLabelEl.nextSibling;
      host.insertBefore(btnUnitReport, anchor);
      host.insertBefore(btn, btnUnitReport);
      host.insertBefore(btnReviewMgr, btn);
      host.insertBefore(lblExpandCols, btnReviewMgr);
      host.insertBefore(btnDashboard, anchor);
    } else {
      host.appendChild(lblExpandCols);
      host.appendChild(btnReviewMgr);
      host.appendChild(btn);
      host.appendChild(btnUnitReport);
      host.appendChild(btnDashboard);
    }
    try {
      host.querySelector('#btnAuditoriaPriorizacaoATP')?.remove();
      host.querySelector('#btnGrafoConflitosATP')?.remove();
      host.querySelector('#btnMapaRelacoesATP')?.remove();
      host.querySelector('#btnExtratoFluxosATP')?.remove();
    } catch (_) {}
  } catch (e) { }
}

function addOnlyConflictsCheckbox(table, onToggle) {
  const host = document.getElementById('dvFiltrosOpcionais');
  if (!host) return;
  host.querySelector('#chkApenasConflitoSlim')?.remove();
  host.querySelector('label[for="chkApenasConflitoSlim"]')?.remove();
  host.querySelector('#atpEmergencyConflictBar')?.remove();
  host.querySelector('#btnFiltrarConflitosSlim')?.remove();
  host.querySelector('#btnFiltrarPossiveisConflitos')?.remove();
  host.querySelector('#btnIncluirRegrasInativasATP')?.remove();

  let panel = host.querySelector('#grupoControleVisualNucleoLike');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'grupoControleVisualNucleoLike';
    panel.style.display = 'inline-flex';
    panel.style.flexDirection = 'column';
    panel.style.alignItems = 'flex-start';
    panel.style.gap = '4px';
    panel.style.marginTop = '0';
    panel.style.minWidth = '320px';
    panel.style.maxWidth = '560px';
    panel.style.padding = '4px 6px';
    panel.style.border = '1px solid #e2e8f0';
    panel.style.borderRadius = '8px';
    panel.style.background = '#ffffff';
    panel.style.pointerEvents = 'auto';

    const linhaAcoes = document.createElement('div');
    linhaAcoes.style.display = 'flex';
    linhaAcoes.style.alignItems = 'center';
    linhaAcoes.style.gap = '8px';
    linhaAcoes.style.flexWrap = 'wrap';

    const linhaCategorias = document.createElement('div');
    linhaCategorias.style.display = 'flex';
    linhaCategorias.style.alignItems = 'center';
    linhaCategorias.style.gap = '6px';
    linhaCategorias.style.flexWrap = 'wrap';

    const titulo = document.createElement('strong');
    titulo.textContent = 'Conflitos:';
    titulo.style.fontSize = '12px';
    linhaAcoes.appendChild(titulo);

    const btnHelp = document.createElement('button');
    btnHelp.type = 'button';
    btnHelp.id = 'btnAjudaConflitosNucleoLike';
    btnHelp.className = 'infraButton';
    btnHelp.textContent = '?';
    btnHelp.style.padding = '0 6px';
    btnHelp.style.minWidth = '20px';
    btnHelp.style.lineHeight = '1.3';
    btnHelp.style.cursor = 'help';
    btnHelp.addEventListener('mouseenter', () => {
      try {
        const msg = String(ATP_MINI_HELP_TIP || '').replace(/\r?\n/g, '<br>');
        if (typeof window.infraTooltipMostrar === 'function') window.infraTooltipMostrar(msg, 'Ajuda Rápida (ATP)', 720);
      } catch (_) {}
    });
    btnHelp.addEventListener('mouseleave', () => {
      try { if (typeof window.infraTooltipOcultar === 'function') window.infraTooltipOcultar(); } catch (_) {}
    });
    linhaAcoes.appendChild(btnHelp);

    const makeCheck = (id, labelText, onChange) => {
      const label = document.createElement('label');
      label.style.display = 'inline-flex';
      label.style.alignItems = 'center';
      label.style.gap = '4px';
      label.style.cursor = 'pointer';
      label.style.userSelect = 'none';
      label.style.fontSize = '12px';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.addEventListener('change', onChange);
      const txt = document.createElement('span');
      txt.textContent = labelText;
      label.appendChild(input);
      label.appendChild(txt);
      linhaAcoes.appendChild(label);
      return input;
    };

    const applyExibirNaColuna = (enabled) => {
      try {
        const tb = table || findTable();
        if (!tb) return;
        tb.querySelectorAll('td[data-atp-col="conflita"]').forEach((td) => {
          const kids = Array.from(td.children || []);
          kids.forEach((el) => {
            if (el && el.classList && el.classList.contains('atp-compare-btn')) return;
            try { el.style.display = enabled ? '' : 'none'; } catch (_) {}
          });
        });
      } catch (_) {}
    };

    const categoriaState = window.__ATP_UI_CATEGORIAS__ || { critico: true, atencao: true };
    window.__ATP_UI_CATEGORIAS__ = categoriaState;
    const applyFiltroCategorias = () => {
      try {
        if (!chkFiltrar.checked) {
          try { delete window.atpFiltroCategorias; } catch (_) { window.atpFiltroCategorias = null; }
        } else {
          window.atpFiltroCategorias = {
            critico: !!window.__ATP_UI_CATEGORIAS__.critico,
            atencao: !!window.__ATP_UI_CATEGORIAS__.atencao
          };
        }
      } catch (_) {}
      try { onToggle && onToggle(); } catch (_) {}
    };

    const chkFiltrar = makeCheck('chkMostrarLinhasNucleoLike', 'Filtrar', () => {
      applyFiltroCategorias();
    });
    const chkExibir = makeCheck('chkExibirTiposNucleoLike', 'Exibir na coluna', () => {
      applyExibirNaColuna(!!chkExibir.checked);
    });
    const chkInativas = makeCheck('chkIncluirInativasNucleoLike', 'Incluir inativas', () => {
      window.atpIncludeInactiveRules = !!chkInativas.checked;
      const tb = table || findTable();
      if (!tb) {
        try { onToggle && onToggle(); } catch (_) {}
        return;
      }
      try { ensureColumns(tb); } catch (_) {}
      try { recalc(tb); } catch (_) {}
    });

    const txtCategorias = document.createElement('span');
    txtCategorias.textContent = 'Categorias:';
    linhaCategorias.appendChild(txtCategorias);

    const makeChip = (id, labelText, key) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.id = id;
      chip.className = 'infraButton';
      chip.textContent = labelText;
      chip.style.padding = '2px 8px';
      chip.style.fontSize = '11px';
      chip.style.borderRadius = '999px';
      const repaint = () => {
        const on = !!window.__ATP_UI_CATEGORIAS__[key];
        chip.style.opacity = on ? '1' : '.45';
      };
      chip.addEventListener('click', () => {
        window.__ATP_UI_CATEGORIAS__[key] = !window.__ATP_UI_CATEGORIAS__[key];
        repaint();
        applyFiltroCategorias();
      });
      repaint();
      linhaCategorias.appendChild(chip);
    };
    makeChip('btnChipCategoriaCriticoNucleoLike', 'Crítico', 'critico');
    makeChip('btnChipCategoriaAtencaoNucleoLike', 'Atenção', 'atencao');

    panel.appendChild(linhaAcoes);
    panel.appendChild(linhaCategorias);
    host.insertBefore(panel, host.firstChild || null);

    const syncChecks = () => {
      chkFiltrar.checked = !!(window && window.atpFiltroCategorias);
      chkExibir.checked = true;
      chkInativas.checked = !!window.atpIncludeInactiveRules;
      applyExibirNaColuna(chkExibir.checked);
    };
    syncChecks();
    applyFiltroCategorias();
  }

  atpEnsureReportButton(host, panel, table);
}

function atpEnsureEmergencyConflictToolbar() {
  try {
    const tb = findTable();
    addOnlyConflictsCheckbox(tb, () => {
      const table = tb || findTable();
      if (!table) return;
      try { ensureColumns(table); } catch (_) {}
      try { applyFilter(table); } catch (_) {}
    });
  } catch (_) {}
}

function removeSortOrderControls() {
  return;
}

function ensureSortOrderControlsVisible() {
  try {
    const ids = ['chkOrdenacaoRegra', 'chkOrdenacaoRegra2', 'lblOrdenacaoRegra', 'lblOrdenacaoRegra2'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      try { el.hidden = false; } catch (_) {}
      try { el.style.display = ''; } catch (_) {}
      try { el.style.visibility = 'visible'; } catch (_) {}
      try { el.style.opacity = ''; } catch (_) {}
    });

    const labels = Array.from(document.querySelectorAll('label, span, div'));
    labels.forEach((el) => {
      const txt = String(el.textContent || '').trim().toLowerCase();
      if (!txt.includes('ordenar regras por')) return;
      try { el.hidden = false; } catch (_) {}
      try { el.style.display = ''; } catch (_) {}
      try { el.style.visibility = 'visible'; } catch (_) {}
      try { el.style.opacity = ''; } catch (_) {}
    });
  } catch (_) {}
}

function placeSortOrderControlsOnNewLine() {
  try {
    const host = document.getElementById('dvFiltrosOpcionais');
    if (!host) return;
    let row = host.querySelector('#atpSortOrderRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'atpSortOrderRow';
      host.appendChild(row);
    }

    const lblGrupo = document.getElementById('lblOrdenacaoRegra');
    const chkGrupo = document.getElementById('chkOrdenacaoRegra');
    const lblRegra = document.getElementById('lblOrdenacaoRegra2');
    const chkRegra = document.getElementById('chkOrdenacaoRegra2');
    if (!lblGrupo || !chkGrupo || !lblRegra || !chkRegra) return;

    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.style.flexWrap = 'nowrap';
    row.style.whiteSpace = 'nowrap';
    row.style.marginTop = '6px';
    row.style.width = '100%';

    // Reagrupa no formato esperado: "Ordenar regras por: ( ) Ordem do Grupo  ( ) Número da Regra"
    row.textContent = '';
    const title = document.createElement('span');
    title.id = 'atpSortOrderTitle';
    title.textContent = 'Ordenar regras por:';
    row.appendChild(title);
    try { row.appendChild(chkGrupo); } catch (_) {}
    try { row.appendChild(lblGrupo); } catch (_) {}
    try { row.appendChild(chkRegra); } catch (_) {}
    try { row.appendChild(lblRegra); } catch (_) {}

    try { title.style.marginRight = '8px'; } catch (_) {}
    try { lblGrupo.style.marginRight = '10px'; } catch (_) {}
    try { lblRegra.style.marginRight = '0'; } catch (_) {}
    try { chkGrupo.style.margin = '0 4px 0 0'; } catch (_) {}
    try { chkRegra.style.margin = '0 4px 0 0'; } catch (_) {}

    // Remove qualquer rótulo "Ordenar regras por" que tenha sobrado fora da linha de ordenação.
    Array.from(document.querySelectorAll('label.mr-3, label, span, div')).forEach((el) => {
      if (el === title || row.contains(el)) return;
      const txt = String(el.textContent || '').trim().toLowerCase();
      if (txt === 'ordenar regras por:' || txt === 'ordenar regras por') {
        try { el.remove(); } catch (_) {}
      }
    });
  } catch (_) {}
}

function removeVisualizarFluxoButton() {
  try {
    const candidates = Array.from(document.querySelectorAll('a, button, span, label'));
    candidates.forEach((el) => {
      const txt = String(el.textContent || '').trim().toLowerCase();
      // Remove apenas o nosso controle de "Visualizar Fluxo".
      // Não tocar em links nativos "alternarVisualizacao*" do eProc
      // (eles controlam o expandir/retrair de conteúdo da tabela).
      if (txt.includes('visualizar fluxo')) {
        try { el.remove(); } catch (_) {}
      }
    });
  } catch (_) {}
}

function atpLoadExpandColsState() {
  try {
    const v = localStorage.getItem('ATP_EXPAND_COLS');
    if (v === '1') return true;
    if (v === '0') return false;
  } catch (_) {}
  return false;
}

function atpSaveExpandColsState(expanded) {
  try { localStorage.setItem('ATP_EXPAND_COLS', expanded ? '1' : '0'); } catch (_) {}
}

function atpApplyExpandColsState(table, expanded) {
  try {
    const tb = table || findTable();
    if (!tb) return;

    const asDisplay = (el, wantVisible) => {
      if (!el) return;
      const tag = String(el.tagName || '').toUpperCase();
      const visibleDisplay = (tag === 'SPAN' || tag === 'A') ? 'inline' : 'block';
      el.style.display = wantVisible ? visibleDisplay : 'none';
    };

    const resumidos = Array.from(tb.querySelectorAll('[id^="dadosResumidos_"]'));
    const completos = Array.from(tb.querySelectorAll('[id^="dadosCompletos_"]'));
    resumidos.forEach((el) => asDisplay(el, !expanded));
    completos.forEach((el) => asDisplay(el, !!expanded));

    tb.dataset.atpExpandCols = expanded ? '1' : '0';
    try { document.documentElement.dataset.atpExpandCols = expanded ? '1' : '0'; } catch (_) {}
  } catch (_) {}
}

function forceTableLengthTo1000() {
  try {
    const sel = document.querySelector('select[name="tableAutomatizacaoLocalizadores_length"]');
    if (!sel) return;
    if (String(sel.value) === '1000') return;
    const has1000 = Array.from(sel.options || []).some(o => String(o.value) === '1000');
    if (!has1000) return;
    sel.value = '1000';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (_) { }
}

function disableAlterarPreferenciaNumRegistros() {
  return;
}

  async function init() {
    if (!isATPAutomationPage()) return;
    try {
      if (typeof showATPLoading === 'function') showATPLoading();
      if (typeof setATPLoadingMsg === 'function') setATPLoadingMsg('Aguardando carregamento completo do eProc…');
    } catch (_) {}
    injectStyle();
    const host = await waitATPHost(30000);
    if (host) {
      try {
        atpEnsureEmergencyConflictToolbar();
        addOnlyConflictsCheckbox(null, () => schedule(() => {
          const tb = findTable();
          if (!tb) return;
          try { ensureColumns(tb); } catch (_) {}
          try { applyFilter(tb); } catch (_) {}
        }, 0, 'atp-apply-filter'));
      } catch (_) {}
    }
    const table = await waitTable();
    if (!table) {
      try { if (typeof hideATPLoading === 'function') hideATPLoading(); } catch (_) {}
      return;
    }
    try { if (typeof setATPLoadingMsg === 'function') setATPLoadingMsg('Carregamento completo. Analisando colisões…'); } catch (_) {}
    disableAlterarPreferenciaNumRegistros();
    removeSortOrderControls();
    ensureSortOrderControlsVisible();
    placeSortOrderControlsOnNewLine();
    removeVisualizarFluxoButton();
    forceTableLengthTo1000();
    ensureColumns(table);
    try { atpApplyExpandColsState(table, atpLoadExpandColsState()); } catch (_) {}
    updateAllRemoverLupasByTooltipText(table);
    addOnlyConflictsCheckbox(table, () => schedule(() => applyFilter(table), 0, 'atp-apply-filter'));
    atpQueueRecalc(table, 0);
    table.addEventListener('change', () => atpQueueRecalc(table, 180), true);
    const root = table.parentElement || document.body;
    const mo = new MutationObserver((mutations) => {
      if (ATP_SUPPRESS_OBSERVER) return;
      const relevant = (mutations || []).some((m) => {
        const target = m && m.target instanceof Element ? m.target : null;
        if ((m?.addedNodes?.length || 0) > 0) return true;
        if ((m?.removedNodes?.length || 0) > 0) return true;
        if (!target) return false;
        if (target.closest && target.closest('#atpRuleMapModal, #atpFluxoBpmnIoModal, #divInfraTooltip')) return false;
        return true;
      });
      if (!relevant) return;
      disableAlterarPreferenciaNumRegistros();
      removeSortOrderControls();
      ensureSortOrderControlsVisible();
      placeSortOrderControlsOnNewLine();
      removeVisualizarFluxoButton();
      forceTableLengthTo1000();
      try { atpApplyExpandColsState(table, atpLoadExpandColsState()); } catch (_) {}
      try { addOnlyConflictsCheckbox(table, () => schedule(() => applyFilter(table), 0, 'atp-apply-filter')); } catch (_) {}
      atpQueueRecalc(table, 280);
    });
    mo.observe(root, { childList: true, subtree: true });
    try {
      const repair = () => {
        try {
          const tb = findTable();
          atpEnsureEmergencyConflictToolbar();
          placeSortOrderControlsOnNewLine();
          removeVisualizarFluxoButton();
          if (!tb) return;
          addOnlyConflictsCheckbox(tb, () => schedule(() => applyFilter(tb), 0, 'atp-apply-filter'));
        } catch (_) {}
      };
      schedule(repair, 300, 'atp-repair-fast');
      schedule(repair, 1200, 'atp-repair-mid');
      schedule(repair, 3000, 'atp-repair-slow');
    } catch (_) {}
  }

  function atpPrepareFlowBpmnForModal(fileObj, idx) {
    const filename = String(fileObj && fileObj.filename || ('fluxo_' + String((idx | 0) + 1).padStart(2, '0') + '.bpmn'));
    const baseXml = String((fileObj && (fileObj.rawXml || fileObj.xml)) || '');
    if (!baseXml) return Promise.resolve({ ...(fileObj || {}), filename, xml: '' });

    let xml = String(fileObj && fileObj.xml || baseXml);
    try {
      const applier = window.__ATP_UNIQUE_LAYOUT__ && window.__ATP_UNIQUE_LAYOUT__.apply;
      if (typeof applier === 'function') {
        const laid = applier(baseXml);
        if (laid) xml = String(laid);
      }
    } catch (err) {
      try { console.warn(LOG_PREFIX, '[Fluxos/UI] Layout swimlanes falhou; abrindo BPMN base:', err); } catch (_) {}
      xml = baseXml;
    }
    return Promise.resolve({ ...(fileObj || {}), filename, xml, viewMode: 'swimlanes' });
  }

  function atpBootstrapInitLoading() {
    try {
      const urlLooksLikeTarget = /automatizar_localizadores/i.test(String(location.href || ''));
      if (!urlLooksLikeTarget) return;
      if (typeof showATPLoading === 'function') showATPLoading();
      window.__ATP_PAGE_LOADED__ = (document.readyState === 'complete');
      if (window.__ATP_PAGE_LOADED__) {
        if (typeof setATPLoadingMsg === 'function') setATPLoadingMsg('Carregamento completo. Analisando colisões…');
        try { if (typeof scheduleHideATPLoading === 'function') scheduleHideATPLoading(1800); } catch (_) {}
      } else {
        if (typeof setATPLoadingMsg === 'function') setATPLoadingMsg('Aguardando carregamento completo do eProc…');
        window.addEventListener('load', () => {
          try {
            window.__ATP_PAGE_LOADED__ = true;
            if (typeof setATPLoadingMsg === 'function') setATPLoadingMsg('Carregamento completo. Analisando colisões…');
            if (typeof scheduleHideATPLoading === 'function') scheduleHideATPLoading(1800);
          } catch (_) {}
        }, { once: true });
      }
    } catch (_) {}
  }

  function atpOpenSelectedFlowFromPicker(table, sel) {
    try {
      atpRefreshFluxosPickerOptions(table);
      const idx = parseInt(String(sel && sel.value || '-1'), 10);
      if (!Number.isFinite(idx) || idx < 0) {
        alert('Selecione um fluxo.');
        return;
      }
      const rules = atpGetRulesState();
      if (!rules.length) {
        alert('Não foi possível obter as regras (tabela vazia ou não carregada).');
        return;
      }
      const files = (window.ATP && window.ATP.extract && typeof window.ATP.extract.getBpmnFilesForRules === 'function')
        ? window.ATP.extract.getBpmnFilesForRules(rules)
        : atpGetBpmnSplitFilesForRules(rules);
      const f = files && files[idx];
      if (!f || (!f.xml && !f.rawXml)) {
        alert('Fluxo selecionado não possui BPMN gerado.');
        return;
      }

      atpPrepareFlowBpmnForModal(f, idx)
        .then((prepared) => atpOpenFlowBpmnModal(prepared, idx, { viewMode: 'swimlanes' }))
        .catch((e) => {
          try { console.warn(LOG_PREFIX, '[Fluxos/UI] Falha ao preparar visualização do fluxo:', e); } catch (_) {}
          atpOpenFlowBpmnModal({
            ...f,
            xml: String((f && (f.rawXml || f.xml)) || ''),
            filename: String(f && f.filename || ('fluxo_' + String(idx + 1).padStart(2, '0') + '.bpmn'))
          }, idx, { viewMode: 'swimlanes' });
        });
    } catch (e) {
      try { console.warn(LOG_PREFIX, '[Fluxos/UI] Falha ao visualizar fluxo:', e); } catch (_) {}
    }
  }

  function atpEnsureFluxosPickerUI(table) {
    try {
      const host = document.getElementById('dvFiltrosOpcionais');
      if (!host || !host.parentNode) return;

      let wrap = document.getElementById('fluxos');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'fluxos';
        wrap.style.marginTop = '8px';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';
        wrap.style.flexWrap = 'wrap';

        const title = document.createElement('span');
        title.textContent = 'Fluxos:';
        title.style.fontWeight = '600';
        title.style.marginRight = '4px';

        const sel = document.createElement('select');
        sel.id = 'atpSelFluxo';
        sel.className = 'infraSelect';
        sel.style.minWidth = '520px';
        sel.style.maxWidth = 'min(900px, 90vw)';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'infraButton';
        btn.id = 'btnVisualizarFluxoATP';
        btn.textContent = 'Visualizar Fluxo BPMN';

        sel.addEventListener('mousedown', () => {
          try { atpRefreshFluxosPickerOptions(table); } catch (e) {}
        }, true);

        btn.addEventListener('click', () => atpOpenSelectedFlowFromPicker(table, sel));

        wrap.appendChild(title);
        wrap.appendChild(sel);
        wrap.appendChild(btn);

        host.insertAdjacentElement('afterend', wrap);
      }

      atpRefreshFluxosPickerOptions(table);

    } catch (e) {}
  }

  function atpRefreshFluxosPickerOptions(table) {
    try {
      const sel = document.getElementById('atpSelFluxo');
      if (!sel) return;

      let rules = atpGetRulesState();
      if (!rules.length) {
        try { if (table) recalc(table); } catch (e) {}
        rules = atpGetRulesState();
      }
      if (!rules || !rules.length) {
        sel.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '-1';
        opt.textContent = '(nenhum fluxo detectado)';
        sel.appendChild(opt);
        return;
      }

      const data = (window.ATP && window.ATP.extract && typeof window.ATP.extract.getFluxosData === 'function')
        ? window.ATP.extract.getFluxosData(rules)
        : atpComputeFluxosData(rules);
      const fluxos = (data && data.fluxos) ? data.fluxos : [];

      const prev = sel.value;
      sel.innerHTML = '';

      if (!fluxos.length) {
        const opt = document.createElement('option');
        opt.value = '-1';
        opt.textContent = '(nenhum fluxo detectado)';
        sel.appendChild(opt);
        return;
      }

      fluxos.forEach((fl, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = (window.ATP && window.ATP.extract && typeof window.ATP.extract.buildFluxoOptionLabel === 'function')
          ? window.ATP.extract.buildFluxoOptionLabel(fl, idx)
          : (() => {
              const starts = (fl && fl.starts && fl.starts.length) ? fl.starts.join(' | ') : '(sem início)';
              const nodesN = (fl && fl.nodes && fl.nodes.length) ? fl.nodes.length : 0;
              return `Fluxo ${String(idx+1).padStart(2,'0')} — Início(s): [${starts}] — Nós: ${nodesN}`;
            })();
        sel.appendChild(opt);
      });

      if (prev && Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
      else sel.value = '0';

    } catch (e) {}
  }

  function atpOpenFlowBpmnModal(fileObj, flowIdx, opts) {
    try {
      const viewMode = String((opts && opts.viewMode) || (fileObj && fileObj.viewMode) || 'swimlanes').trim().toLowerCase();
      const modeLabel = (viewMode === 'swimlanes') ? 'BPMN Swimlanes' : 'BPMN';

      atpCloseRuleMapModal();

      const overlay = document.createElement('div');
      overlay.id = 'atpRuleMapModal';
      overlay.className = 'atp-map-overlay';
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) atpCloseRuleMapModal(); });

      const box = document.createElement('div');
      box.className = 'atp-map-box';

      const top = document.createElement('div');
      top.className = 'atp-map-top';

      const titleTxt = `🧭 Visualizar Fluxo ${String((flowIdx|0)+1).padStart(2,'0')} (${modeLabel})`;
      top.innerHTML = `<div><div class="atp-map-title">${titleTxt}</div><div class="atp-map-sub">Arquivo: ${String(fileObj && fileObj.filename || '')}</div></div>`;

      const actions = document.createElement('div');
      actions.className = 'atp-map-actions';

      let zoomValue = 1;
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

      const btnZoomOut = document.createElement('button');
      btnZoomOut.type = 'button';
      btnZoomOut.className = 'atp-map-btn';
      btnZoomOut.title = 'Zoom out';
      btnZoomOut.textContent = '-';

      const zoomLabel = document.createElement('span');
      zoomLabel.className = 'atp-map-zoom';
      zoomLabel.textContent = '100%';

      const btnZoomIn = document.createElement('button');
      btnZoomIn.type = 'button';
      btnZoomIn.className = 'atp-map-btn';
      btnZoomIn.title = 'Zoom in';
      btnZoomIn.textContent = '+';

      const btnFit = document.createElement('button');
      btnFit.type = 'button';
      btnFit.className = 'atp-map-btn';
      btnFit.title = 'Ajustar ao viewport';
      btnFit.textContent = 'Fit';

      const btnDownload = document.createElement('button');
      btnDownload.type = 'button';
      btnDownload.className = 'atp-map-btn';
      btnDownload.textContent = 'Baixar BPMN desse fluxo';
      btnDownload.addEventListener('click', () => {
        try {
          const viewer = overlay._atpBpmnViewer;
          if (!viewer || typeof viewer.saveXML !== 'function') {
            const blob = new Blob([String(fileObj.xml || '')], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = String(fileObj.filename || ('fluxo_' + String(flowIdx+1).padStart(2,'0') + '.bpmn'));
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try{URL.revokeObjectURL(url);}catch(e){} try{a.remove();}catch(e){} }, 0);
            return;
          }

          try { if (overlay._atpRestoreNames) overlay._atpRestoreNames(); } catch (e) {}

          viewer.saveXML({ format: true }).then(({ xml }) => {
            const blob = new Blob([String(xml || '')], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = String(fileObj.filename || ('fluxo_' + String(flowIdx+1).padStart(2,'0') + '.bpmn'));
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { try{URL.revokeObjectURL(url);}catch(e){} try{a.remove();}catch(e){} }, 0);
          }).finally(() => {
            try { if (overlay._atpApplyTruncation) overlay._atpApplyTruncation(); } catch (e) {}
          });
        } catch (e) {}
      });

      const btnJpeg = document.createElement('button');
      btnJpeg.type = 'button';
      btnJpeg.className = 'atp-map-btn';
      btnJpeg.title = 'Exportar o diagrama para JPEG (imagem)';
      btnJpeg.textContent = 'Exportar JPEG';
      btnJpeg.addEventListener('click', () => {
        try {
          const viewer = overlay._atpBpmnViewer;
          if (!viewer || typeof viewer.saveSVG !== 'function') {
            alert('Exportacao JPEG indisponivel: bpmn-js nao esta pronto.');
            return;
          }

          viewer.saveSVG({ format: true }).then(({ svg }) => {
            const raw = String(svg || '');
            if (!raw) throw new Error('SVG vazio');

            let normalized = raw;
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(raw, 'image/svg+xml');
              const svgEl = doc.documentElement;
              if (svgEl && String(svgEl.tagName).toLowerCase() === 'svg') {
                const hasW = svgEl.getAttribute('width');
                const hasH = svgEl.getAttribute('height');
                const vb = svgEl.getAttribute('viewBox');
                if ((!hasW || !hasH) && vb) {
                  const parts = vb.split(/\s+|,/).map(x => parseFloat(x)).filter(x => Number.isFinite(x));
                  if (parts.length === 4) {
                    const w = Math.max(1, parts[2]);
                    const h = Math.max(1, parts[3]);
                    if (!hasW) svgEl.setAttribute('width', String(w));
                    if (!hasH) svgEl.setAttribute('height', String(h));
                  }
                }
                normalized = new XMLSerializer().serializeToString(svgEl);
              }
            } catch (e) { normalized = raw; }

            const blob = new Blob([normalized], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
              try {
                const scale = 2;
                const w = img.naturalWidth || img.width || 2000;
                const h = img.naturalHeight || img.height || 1000;

                const canvasEl = document.createElement('canvas');
                canvasEl.width = Math.round(w * scale);
                canvasEl.height = Math.round(h * scale);

                const ctx = canvasEl.getContext('2d');
                if (!ctx) throw new Error('canvas 2d indisponivel');

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

                ctx.setTransform(scale, 0, 0, scale, 0, 0);
                ctx.drawImage(img, 0, 0);

                canvasEl.toBlob((jpegBlob) => {
                  try {
                    if (!jpegBlob) throw new Error('Falha ao gerar JPEG');
                    const jurl = URL.createObjectURL(jpegBlob);
                    const a = document.createElement('a');
                    a.href = jurl;
                    const base = String(fileObj.filename || ('fluxo_' + String(flowIdx+1).padStart(2,'0') + '.bpmn')).replace(/\.bpmn$/i, '');
                    a.download = base + '.jpeg';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      try { URL.revokeObjectURL(jurl); } catch (e) {}
                      try { a.remove(); } catch (e) {}
                    }, 0);
                  } catch (e) {
                    alert('Falha ao exportar JPEG.');
                  }
                }, 'image/jpeg', 0.92);

              } catch (e) {
                alert('Falha ao exportar JPEG.');
              } finally {
                try { URL.revokeObjectURL(url); } catch (e) {}
              }
            };
            img.onerror = () => {
              try { URL.revokeObjectURL(url); } catch (e) {}
              alert('Falha ao exportar JPEG.');
            };
            img.src = url;

          }).catch(() => alert('Falha ao exportar JPEG.'));

        } catch (e) {
          try { alert('Falha ao exportar JPEG.'); } catch (_) {}
        }
      });
      const btnClose = document.createElement('button');
      btnClose.type = 'button';
      btnClose.className = 'atp-map-btn';
      btnClose.textContent = 'Fechar';
      btnClose.addEventListener('click', atpCloseRuleMapModal);

      actions.appendChild(btnZoomOut);
      actions.appendChild(zoomLabel);
      actions.appendChild(btnZoomIn);
      actions.appendChild(btnFit);
      actions.appendChild(btnDownload);
      actions.appendChild(btnJpeg);
      actions.appendChild(btnClose);
      top.appendChild(actions);

      const body = document.createElement('div');
      body.className = 'atp-map-body';
      const canvas = document.createElement('div');
      canvas.className = 'atp-map-canvas';
      canvas.id = 'atpRuleMapCanvas';
      body.appendChild(canvas);

      box.appendChild(top);
      box.appendChild(body);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      atpEnsureBpmnJsLoaded().then((BpmnJS) => {
        const viewer = new BpmnJS({ container: canvas });
        overlay._atpBpmnViewer = viewer;

        const originalNames = new Map();
        const MAX_LABEL = 90;
        const truncate = (s) => {
          const str = String(s || '');
          return (str.length > MAX_LABEL) ? (str.slice(0, MAX_LABEL - 1) + '…') : str;
        };

        const SVG_NS = 'http://www.w3.org/2000/svg';
        const setSvgTitle = (gfx, text) => {
          try {
            if (!gfx || !text) return;
            const t = String(text);
            let titleEl = gfx.querySelector('title');
            if (!titleEl) {
              titleEl = document.createElementNS(SVG_NS, 'title');
              gfx.insertBefore(titleEl, gfx.firstChild);
            }
            titleEl.textContent = t;
          } catch (e) {}
        };

        const getDocumentationText = (bo) => {
          try {
            const docs = bo && bo.documentation;
            if (!docs) return '';
            const arr = Array.isArray(docs) ? docs : [docs];
            const first = arr.find(d => d && typeof d.text === 'string' && d.text.trim());
            return first ? String(first.text).trim() : '';
          } catch (e) {
            return '';
          }
        };

        overlay._atpApplyHoverTitles = () => {
          try {
            const elementRegistry = viewer.get('elementRegistry');
            elementRegistry.forEach((el) => {
              try {
                if (!el || !el.businessObject) return;
                const bo = el.businessObject;

                const docText = getDocumentationText(bo);
                const full = docText || originalNames.get(el.id) || bo.name;
                if (!full) return;

                const gfx = elementRegistry.getGraphics(el);
                setSvgTitle(gfx, full);

                try {
                  const lbl = elementRegistry.get(el.id + '_label');
                  if (lbl) setSvgTitle(elementRegistry.getGraphics(lbl), full);
                } catch (e2) {}
              } catch (e) {}
            });
          } catch (e) {}
        };
        overlay._atpRestoreNames = () => {
          try {
            const modeling = viewer.get('modeling');
            originalNames.forEach((name, id) => {
              try { modeling.updateProperties(viewer.get('elementRegistry').get(id), { name }); } catch (e) {}
            });
            try { overlay._atpApplyHoverTitles && overlay._atpApplyHoverTitles(); } catch (e) {}
          } catch (e) {}
        };
        overlay._atpApplyTruncation = () => {
          try {
            const elementRegistry = viewer.get('elementRegistry');
            const modeling = viewer.get('modeling');
            elementRegistry.forEach((el) => {
              try {
                const bo = el && el.businessObject;
                if (!bo || typeof bo.name !== 'string' || !bo.name) return;
                if (!originalNames.has(el.id)) originalNames.set(el.id, bo.name);
                const t = truncate(originalNames.get(el.id));
                if (t !== bo.name) modeling.updateProperties(el, { name: t });
              } catch (e) {}
            });
            try { overlay._atpApplyHoverTitles && overlay._atpApplyHoverTitles(); } catch (e) {}
          } catch (e) {}
        };

        const ATP_CHAIN_MARKER = 'atp-chain-selected';
        overlay._atpChainSelectedIds = new Set();
        overlay._atpChainMarkerBackup = new Map();
        overlay._atpClearChainSelection = () => {
          try {
            const elementRegistry = viewer.get('elementRegistry');
            const canvasApi = viewer.get('canvas');
            if (!canvasApi) return;
            for (const [id, prev] of Array.from(overlay._atpChainMarkerBackup || [])) {
              try {
                const el = elementRegistry && elementRegistry.get(id);
                if (!el) continue;
                const gfx = elementRegistry.getGraphics(el);
                const path = gfx && gfx.querySelector && gfx.querySelector('.djs-visual > path');
                if (!path) continue;
                const prevEnd = String(prev && prev.end || '');
                const prevStart = String(prev && prev.start || '');
                if (prevEnd) path.setAttribute('marker-end', prevEnd); else path.removeAttribute('marker-end');
                if (prevStart) path.setAttribute('marker-start', prevStart); else path.removeAttribute('marker-start');
              } catch (_) {}
            }
            overlay._atpChainMarkerBackup = new Map();
            for (const id of Array.from(overlay._atpChainSelectedIds || [])) {
              try { canvasApi.removeMarker(id, ATP_CHAIN_MARKER); } catch (_) {}
            }
            overlay._atpChainSelectedIds = new Set();
          } catch (_) {}
        };
        const atpExtractMarkerId = (markerUrl) => {
          const m = String(markerUrl || '').match(/url\(#([^)]+)\)/);
          return m && m[1] ? String(m[1]) : '';
        };
        const atpEnsureOrangeMarker = (baseMarkerId) => {
          try {
            const svg = canvas && canvas.querySelector ? canvas.querySelector('svg') : null;
            if (!svg || !baseMarkerId) return '';
            let defs = svg.querySelector('defs');
            if (!defs) {
              defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
              svg.insertBefore(defs, svg.firstChild || null);
            }
            let base = null;
            const allMarkers = Array.from(defs.querySelectorAll('marker'));
            for (const m of allMarkers) {
              if (String(m.id || '') === String(baseMarkerId)) { base = m; break; }
            }
            if (!base) return '';
            const newId = String(baseMarkerId) + '__atp_orange';
            for (const m of allMarkers) {
              if (String(m.id || '') === newId) return newId;
            }
            const clone = base.cloneNode(true);
            clone.setAttribute('id', newId);
            const paints = Array.from(clone.querySelectorAll('*'));
            for (const p of paints) {
              try {
                if (p.hasAttribute('stroke')) p.setAttribute('stroke', '#f97316');
                if (p.hasAttribute('fill') && String(p.getAttribute('fill') || '').toLowerCase() !== 'none') {
                  p.setAttribute('fill', '#f97316');
                }
                p.setAttribute('style', String(p.getAttribute('style') || '')
                  .replace(/stroke\s*:[^;]+;?/gi, '')
                  .replace(/fill\s*:[^;]+;?/gi, '')
                  + ';stroke:#f97316;fill:#f97316;');
              } catch (_) {}
            }
            defs.appendChild(clone);
            return newId;
          } catch (_) {
            return '';
          }
        };
        const atpColorConnectionArrow = (connId) => {
          try {
            const id = String(connId || '');
            if (!id) return;
            const elementRegistry = viewer.get('elementRegistry');
            const el = elementRegistry && elementRegistry.get(id);
            const bo = el && el.businessObject;
            if (!el || !bo || String(bo.$type || '') !== 'bpmn:SequenceFlow') return;
            const gfx = elementRegistry.getGraphics(el);
            const path = gfx && gfx.querySelector && gfx.querySelector('.djs-visual > path');
            if (!path) return;
            if (!overlay._atpChainMarkerBackup) overlay._atpChainMarkerBackup = new Map();
            if (!overlay._atpChainMarkerBackup.has(id)) {
              overlay._atpChainMarkerBackup.set(id, {
                end: String(path.getAttribute('marker-end') || ''),
                start: String(path.getAttribute('marker-start') || '')
              });
            }
            const mEndId = atpExtractMarkerId(path.getAttribute('marker-end'));
            const mStartId = atpExtractMarkerId(path.getAttribute('marker-start'));
            const endOrange = atpEnsureOrangeMarker(mEndId);
            const startOrange = atpEnsureOrangeMarker(mStartId);
            if (endOrange) path.setAttribute('marker-end', 'url(#' + endOrange + ')');
            if (startOrange) path.setAttribute('marker-start', 'url(#' + startOrange + ')');
          } catch (_) {}
        };
        const atpAddChainMarker = (id) => {
          try {
            const sid = String(id || '');
            if (!sid) return;
            if (!overlay._atpChainSelectedIds) overlay._atpChainSelectedIds = new Set();
            if (overlay._atpChainSelectedIds.has(sid)) return;
            const canvasApi = viewer.get('canvas');
            if (!canvasApi) return;
            canvasApi.addMarker(sid, ATP_CHAIN_MARKER);
            overlay._atpChainSelectedIds.add(sid);
            try { atpColorConnectionArrow(sid); } catch (_) {}
          } catch (_) {}
        };
        const atpNormalizeClickedElement = (el) => {
          try {
            if (!el) return null;
            const bo = el.businessObject;
            if (!bo) return el;
            if (String(bo.$type || '') === 'bpmn:Label' && bo.labelTarget && bo.labelTarget.id) {
              return viewer.get('elementRegistry').get(String(bo.labelTarget.id)) || el;
            }
            if (el.type === 'label' && el.labelTarget && el.labelTarget.id) {
              return viewer.get('elementRegistry').get(String(el.labelTarget.id)) || el;
            }
            return el;
          } catch (_) {
            return el || null;
          }
        };
        const atpHighlightFromElement = (rawEl) => {
          try {
            overlay._atpClearChainSelection && overlay._atpClearChainSelection();
            const elementRegistry = viewer.get('elementRegistry');
            const el = atpNormalizeClickedElement(rawEl);
            if (!el || !el.businessObject) return;
            const bo = el.businessObject;
            const t = String(bo.$type || '');

            if (t === 'bpmn:SequenceFlow') {
              atpAddChainMarker(el.id);
              if (bo.sourceRef && bo.sourceRef.id) atpAddChainMarker(String(bo.sourceRef.id));
              if (bo.targetRef && bo.targetRef.id) atpAddChainMarker(String(bo.targetRef.id));
              return;
            }

            const isFlowNode = !!(bo && typeof bo.$instanceOf === 'function' && bo.$instanceOf('bpmn:FlowNode'));
            const inArr = Array.from((bo && bo.incoming) || []);
            const outArr = Array.from((bo && bo.outgoing) || []);
            const isNode = isFlowNode || !!(inArr.length || outArr.length);
            if (!isNode) return;

            // Nó clicado.
            atpAddChainMarker(el.id);

            // Entradas: linha + nó origem.
            for (const f of inArr) {
              const fid = String(f && f.id || '');
              if (fid) atpAddChainMarker(fid);
              const sid = String(f && f.sourceRef && f.sourceRef.id || '');
              if (sid) atpAddChainMarker(sid);
            }

            // Saídas: linha + nó destino.
            // Gateway com múltiplas saídas: todas as saídas são destacadas.
            for (const f of outArr) {
              const fid = String(f && f.id || '');
              if (fid) atpAddChainMarker(fid);
              const tid = String(f && f.targetRef && f.targetRef.id || '');
              if (tid) atpAddChainMarker(tid);
            }

            // Reforço por varredura: garante highlight dos ligados diretos em todos os cenários.
            try {
              elementRegistry.forEach((e2) => {
                try {
                  const bo2 = e2 && e2.businessObject;
                  if (!bo2 || String(bo2.$type || '') !== 'bpmn:SequenceFlow') return;
                  const sid = String(bo2.sourceRef && bo2.sourceRef.id || '');
                  const tid = String(bo2.targetRef && bo2.targetRef.id || '');
                  if (sid === String(el.id) || tid === String(el.id)) {
                    atpAddChainMarker(String(e2.id || ''));
                    if (sid) atpAddChainMarker(sid);
                    if (tid) atpAddChainMarker(tid);
                  }
                } catch (_) {}
              });
            } catch (_) {}
          } catch (_) {}
        };

        viewer.importXML(String(fileObj.xml || '')).then(() => {
          try {
            const canvasApi = viewer.get('canvas');
            canvasApi.zoom('fit-viewport');
            zoomValue = canvasApi.zoom();
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
            overlay._atpApplyTruncation();
            try { overlay._atpApplyHoverTitles && overlay._atpApplyHoverTitles(); } catch (e) {}
          } catch (e) {}
        }).catch((e) => {
          try { console.warn(LOG_PREFIX, '[Fluxos/UI] importXML falhou:', e); } catch(_) {}
          alert('Falha ao carregar BPMN no modal.');
        });

        const setZoom = (z) => {
          try {
            const canvasApi = viewer.get('canvas');
            zoomValue = clamp(z, 0.2, 3.0);
            canvasApi.zoom(zoomValue);
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
          } catch (e) {}
        };
        btnZoomIn.addEventListener('click', () => setZoom(zoomValue + 0.1));
        btnZoomOut.addEventListener('click', () => setZoom(zoomValue - 0.1));
        btnFit.addEventListener('click', () => {
          try {
            const canvasApi = viewer.get('canvas');
            canvasApi.zoom('fit-viewport');
            zoomValue = canvasApi.zoom();
            zoomLabel.textContent = Math.round(zoomValue * 100) + '%';
          } catch (e) {}
        });

        try {
          const eventBus = viewer.get('eventBus');
          overlay._atpLastElementClickTs = 0;
          eventBus.on('element.click', (ev) => {
            try {
              overlay._atpLastElementClickTs = Date.now();
              atpHighlightFromElement(ev && ev.element);
            } catch (_) {}
          });
          eventBus.on('canvas.click', () => {
            try {
              const last = Number(overlay._atpLastElementClickTs || 0);
              if ((Date.now() - last) < 120) return;
              overlay._atpClearChainSelection && overlay._atpClearChainSelection();
            } catch (_) {}
          });
        } catch (_) {}

      }).catch((e) => {
        try { console.warn(LOG_PREFIX, '[Fluxos/UI] Falha ao carregar bpmn-js modeler:', e); } catch(_) {}
        alert('Não foi possível carregar o bpmn-js (modeler).');
      });

    } catch (e) {}
  }

  function bootATPInit() {
    if (!isATPAutomationPage()) return;
    if (bootATPInit._started) return;
    bootATPInit._started = true;
    atpBootstrapInitLoading();
    schedule(() => {
      try {
        Promise.resolve()
          .then(() => init())
          .catch((e) => { try { console.warn('[ATP][UI] init falhou:', e); } catch (_) {} });
      } catch (e) {
        try { console.warn('[ATP][UI] init falhou:', e); } catch (_) {}
      }
    }, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootATPInit, { once: true });
  } else {
    bootATPInit();
  }
  window.addEventListener('load', () => {
    try {
      if (!isATPAutomationPage()) return;
      schedule(() => {
        try {
          const tb = findTable();
          atpEnsureEmergencyConflictToolbar();
          if (tb) addOnlyConflictsCheckbox(tb, () => schedule(() => applyFilter(tb), 0, 'atp-apply-filter'));
        } catch (_) {}
      }, 1600, 'atp-post-load-repair');
    } catch (_) {}
  }, { once: true });

try { console.log('[ATP][OK] 10-ui-inicializacao.js inicializado'); } catch (e) {}

  try { if (typeof window.addOnlyConflictsCheckbox !== 'function') window.addOnlyConflictsCheckbox = addOnlyConflictsCheckbox; } catch(e) {}
;
