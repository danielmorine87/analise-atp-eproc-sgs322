try { console.log('[ATP][LOAD] 13-painel-sumario.js carregado com sucesso'); } catch (e) { }

(function () {
  'use strict';

  var STATE_KEY = 'atp:dashboard:v1';
  var CONFLITO_TIPOS_EXIBIR = [
    'Regra em Duplicidade',
    'Prioridade Invertida',
    'Filtros Conflitantes',
    'Potencial Looping',
    'Regra sem Finalidade',
    'Avaliar Prioridade',
    'Avaliar Troca de Localizadores',
    'Prioridade Correta'
  ];

  function safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function toNum(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function loadState() {
    var raw = null;
    try { raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STATE_KEY) : null; } catch (e) { raw = null; }
    if (!raw) return defaultState();
    try {
      var parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed || {});
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) { }
  }

  function defaultState() {
    return {
      collapsed: true,
      selectedPrioridades: {},
      remover: 'todos',
      incluir: 'todos',
      selectedConflitos: {},
      selectedTags: {}
    };
  }

  function toggleSetInState(state, bucket, key) {
    if (!state[bucket]) state[bucket] = {};
    if (state[bucket][key]) delete state[bucket][key]; else state[bucket][key] = true;
    saveState(state);
  }

  function clearBucket(state, bucket) {
    state[bucket] = {};
    saveState(state);
  }

  function findTableOrNull() {
    return safe(function () {
      return document.getElementById('tableAutomatizacaoLocalizadores')
        || document.querySelector('table[id*="AutomatizacaoLocalizador"]')
        || null;
    }, null);
  }

  function getAllRuleRows(table) {
    if (!table) return [];
    var tbodies = Array.from(table.tBodies || []);
    if (!tbodies.length) {
      var fb = table.querySelector('tbody');
      if (fb) tbodies = [fb];
    }
    var rows = [];
    tbodies.forEach(function (tb) {
      var trs = Array.from(tb.querySelectorAll('tr'));
      trs.forEach(function (tr) {
        if (tr.classList && tr.classList.contains('hidden')) return;
        rows.push(tr);
      });
    });
    return rows;
  }

  function getRemoverEstado(tr) {
    var tds = Array.from(tr.querySelectorAll(':scope > td'));
    var td = tds[3] || null;
    if (!td) return null;
    var txt = safe(function () { return (td.textContent || td.innerText || '').trim(); }, '');
    var hasSim = /sim\b/i.test(txt);
    var hasNao = /não\b|nao\b/i.test(txt);
    if (hasSim && !hasNao) return 'sim';
    if (hasNao) return 'nao';
    var sw = td.querySelector('.custom-switch, input[type="checkbox"]');
    if (sw) {
      var checked = sw.checked === true;
      return checked ? 'sim' : 'nao';
    }
    return null;
  }

  function getIncluirEstado(tr) {
    var tds = Array.from(tr.querySelectorAll(':scope > td'));
    var td = tds[5] || null;
    if (!td) return null;
    var txt = safe(function () { return (td.textContent || td.innerText || '').trim(); }, '');
    var hasSim = /sim\b/i.test(txt);
    var hasNao = /não\b|nao\b/i.test(txt);
    if (hasSim && !hasNao) return 'sim';
    if (hasNao) return 'nao';
    var sw = td.querySelector('.custom-switch, input[type="checkbox"]');
    if (sw) {
      var checked = sw.checked === true;
      return checked ? 'sim' : 'nao';
    }
    return null;
  }

  function getNumeroPrioridade(tr) {
    var tds = Array.from(tr.querySelectorAll(':scope > td'));
    var tdNum = tds[1] || null;
    var tdPrio = tds[2] || null;
    if (!tdNum) return { numero: null, prioridade: null };
    var txt = safe(function () { return (tdNum.textContent || tdNum.innerText || '').trim(); }, '');
    var m = /(\d+)\s*\/\s*(\d+)/.exec(txt);
    if (m) return { numero: toNum(m[1]) || null, prioridade: toNum(m[2]) || null };
    m = /^(\d+)$/.exec(txt);
    var numero = m ? (toNum(m[1]) || null) : null;
    if (!numero) {
      var inputs = tdNum.querySelectorAll('input[type="text"], input');
      if (inputs && inputs.length) {
        numero = toNum((inputs[0] || {}).value || '') || null;
      }
    }
    var prioridade = null;
    if (tdPrio) {
      var sel = tdPrio.querySelector('select');
      if (sel) {
        var opt = sel.selectedOptions && sel.selectedOptions[0]
          ? sel.selectedOptions[0]
          : sel.options[sel.selectedIndex];
        if (opt) {
          var prioTxt = String(opt.textContent || opt.value || '').trim();
          var pm = /(\d{1,4})/.exec(prioTxt);
          prioridade = pm ? toNum(pm[1]) : null;
        }
      } else {
        var prioInputs = tdPrio.querySelectorAll('input[type="text"], input');
        if (prioInputs && prioInputs.length) {
          prioridade = toNum((prioInputs[0] || {}).value || '') || null;
        } else {
          var prioTxt2 = safe(function () { return (tdPrio.textContent || tdPrio.innerText || '').trim(); }, '');
          var pm2 = /(\d{1,4})/.exec(prioTxt2);
          prioridade = pm2 ? toNum(pm2[1]) : null;
        }
      }
    }
    return { numero: numero, prioridade: prioridade };
  }

  function getConfTipos(tr) {
    var confTd = tr.querySelector(':scope > td[data-atp-col="conflita"]');
    if (!confTd) return [];
    var out = new Set();
    confTd.querySelectorAll('.atp-conf-tipo').forEach(function (s) {
      var t = s.dataset && s.dataset.atpTipo ? String(s.dataset.atpTipo) : null;
      if (t) out.add(t);
    });
    return Array.from(out);
  }

  function extrairTags(tr, stats) {
    var out = new Set();
    var tds = Array.from(tr.querySelectorAll(':scope > td'));
    var hasCrit = !!(tr.dataset && tr.dataset.atpHasConflict === '1');
    var hasAtenc = !!(tr.dataset && tr.dataset.atpHasPossible === '1');
    if (hasCrit) out.add('Com Problema Crítico');
    if (hasAtenc) out.add('Com Atenção');
    if (!hasCrit && !hasAtenc) out.add('Sem Alerta');
    var tdAcao = tds[7] || null;
    if (tdAcao) {
      var txt = safe(function () { return (tdAcao.innerText || tdAcao.textContent || '').trim(); }, '');
      if (!txt || /^\s*\-?\s*$/.test(txt) || /nenhuma|sem a(ç|c)(ã|a)o|vazio/i.test(txt)) {
        out.add('Sem Ação Programada');
      } else {
        out.add('Com Ação Programada');
      }
    }
    if (stats && stats.tiposConflito && stats.tiposConflito.length) {
      var temInformativo = stats.tiposConflito.indexOf('Prioridade Correta') >= 0;
      var temOutro = stats.tiposConflito.some(function (t) { return t !== 'Prioridade Correta'; });
      if (temInformativo && !temOutro) out.add('Prioridade OK');
    }
    return Array.from(out);
  }

  function buildRowStats(tr) {
    var np = getNumeroPrioridade(tr);
    var stats = {
      tr: tr,
      numero: np.numero,
      prioridade: np.prioridade,
      remover: getRemoverEstado(tr),
      incluir: getIncluirEstado(tr),
      tiposConflito: getConfTipos(tr),
      hasCritico: !!(tr.dataset && tr.dataset.atpHasConflict === '1'),
      hasAtencao: !!(tr.dataset && tr.dataset.atpHasPossible === '1')
    };
    stats.tags = extrairTags(tr, stats);
    return stats;
  }

  function computeAllStats(rows) {
    var data = {
      total: 0,
      porNumero: new Map(),
      totalComProblema: 0,
      totalComAtencao: 0,
      totalOk: 0,
      totalSemConflito: 0,
      removerSim: 0,
      removerNao: 0,
      incluirSim: 0,
      incluirNao: 0,
      prioridades: new Map(),
      conflitos: new Map(),
      tags: new Map(),
      rows: []
    };
    rows.forEach(function (tr) {
      var s = buildRowStats(tr);
      data.rows.push(s);
      data.total += 1;
      if (s.numero) data.porNumero.set(String(s.numero), s);
      if (s.hasCritico) data.totalComProblema += 1;
      else if (s.hasAtencao) data.totalComAtencao += 1;
      else data.totalSemConflito += 1;
      if (!s.hasCritico && !s.hasAtencao) data.totalOk += 1;
      if (s.remover === 'sim') data.removerSim += 1; else if (s.remover === 'nao') data.removerNao += 1;
      if (s.incluir === 'sim') data.incluirSim += 1; else if (s.incluir === 'nao') data.incluirNao += 1;
      if (Number.isFinite(s.prioridade)) {
        var k = String(s.prioridade);
        data.prioridades.set(k, (data.prioridades.get(k) || 0) + 1);
      }
      s.tiposConflito.forEach(function (t) {
        data.conflitos.set(t, (data.conflitos.get(t) || 0) + 1);
      });
      s.tags.forEach(function (tg) {
        data.tags.set(tg, (data.tags.get(tg) || 0) + 1);
      });
    });
    return data;
  }

  function getFilteredRows(data, state) {
    var prioSel = state.selectedPrioridades || {};
    var confSel = state.selectedConflitos || {};
    var tagSel = state.selectedTags || {};
    var prioAtiva = Object.keys(prioSel).length > 0;
    var confAtiva = Object.keys(confSel).length > 0;
    var tagAtiva = Object.keys(tagSel).length > 0;
    var remAtiva = state.remover !== 'todos';
    var incAtiva = state.incluir !== 'todos';
    if (!prioAtiva && !confAtiva && !tagAtiva && !remAtiva && !incAtiva) return data.rows;

    return data.rows.filter(function (s) {
      if (remAtiva) {
        if (state.remover === 'sim' && s.remover !== 'sim') return false;
        if (state.remover === 'nao' && s.remover !== 'nao') return false;
      }
      if (incAtiva) {
        if (state.incluir === 'sim' && s.incluir !== 'sim') return false;
        if (state.incluir === 'nao' && s.incluir !== 'nao') return false;
      }
      if (prioAtiva) {
        var pk = s.prioridade == null ? '__null__' : String(s.prioridade);
        if (!prioSel[pk]) return false;
      }
      if (confAtiva) {
        var match = s.tiposConflito.some(function (t) { return !!confSel[t]; });
        var temOk = confSel['__SemConflito__'] && !s.tiposConflito.length;
        if (!match && !temOk) return false;
      }
      if (tagAtiva) {
        var m2 = s.tags.some(function (t) { return !!tagSel[t]; });
        if (!m2) return false;
      }
      return true;
    });
  }

  function countToPct(n, total) {
    if (!total) return 0;
    return Math.round((n / total) * 1000) / 10;
  }

  function chip(label, count, active, onClick, extraClass) {
    var cls = 'atp-dash-chip' + (active ? ' is-active' : '') + (extraClass ? ' ' + extraClass : '');
    return (
      '<button type="button" class="' + cls + '" title="' + esc(label) + (count != null ? (' (' + String(count) + ')') : '') + '">' +
      '<span class="atp-dash-chip-label">' + esc(label) + '</span>' +
      (count != null ? ('<span class="atp-dash-chip-count">' + String(count) + '</span>') : '') +
      '</button>'
    );
  }

  function barRow(label, value, max, color, onClickable, active) {
    var pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
    var cls = 'atp-dash-bar-track' + (onClickable ? ' is-clickable' : '') + (active ? ' is-active' : '');
    return (
      '<div class="atp-dash-bar-row" data-role="bar-row">' +
        '<div class="atp-dash-bar-label">' + esc(label) + '</div>' +
        '<div class="' + cls + '">' +
          '<div class="atp-dash-bar-fill" style="width:' + pct.toFixed(2) + '%;' + (color ? 'background:' + color + ';' : '') + '"></div>' +
        '</div>' +
        '<div class="atp-dash-bar-val">' + String(value) + '</div>' +
      '</div>'
    );
  }

  function tipoClassParaBar(t) {
    switch (t) {
      case 'Regra em Duplicidade': return '#ef4444';
      case 'Prioridade Invertida': return '#dc2626';
      case 'Filtros Conflitantes': return '#b91c1c';
      case 'Potencial Looping': return '#f97316';
      case 'Regra sem Finalidade': return '#f59e0b';
      case 'Avaliar Prioridade': return '#f59e0b';
      case 'Avaliar Troca de Localizadores': return '#d97706';
      case 'Prioridade Correta': return '#3b82f6';
      default: return '#6b7280';
    }
  }

  function tagColor(t) {
    if (/Sem Alerta|Prioridade OK/.test(t)) return '#22c55e';
    if (/Sem Ação/.test(t)) return '#ef4444';
    if (/Crítico/.test(t)) return '#dc2626';
    if (/Atenção|Avaliar/.test(t)) return '#f59e0b';
    if (/Com Ação/.test(t)) return '#2563eb';
    return '#6b7280';
  }

  function mountDashHtml(state, data, visibleCount) {
    var total = data.total || 0;
    var comProb = data.totalComProblema;
    var pctProb = countToPct(comProb, total);
    var cobertura = countToPct(data.incluirSim, total);

    var chipPrio = '';
    var prioKeys = Array.from(data.prioridades.keys()).sort(function (a, b) {
      var na = toNum(a), nb = toNum(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
    if (prioKeys.length) {
      prioKeys.forEach(function (k) {
        chipPrio += chip('P' + k, data.prioridades.get(k) || 0, !!(state.selectedPrioridades || {})[k], null, null);
      });
    } else {
      chipPrio = '<div class="atp-dash-empty">Sem dados de prioridade (aguarde análise).</div>';
    }

    var chipConflitos = '';
    var maxConflito = 0;
    CONFLITO_TIPOS_EXIBIR.forEach(function (t) {
      var v = data.conflitos.get(t) || 0;
      if (v > maxConflito) maxConflito = v;
    });
    var semConflito = data.totalSemConflito;
    if (semConflito > maxConflito) maxConflito = semConflito;
    CONFLITO_TIPOS_EXIBIR.forEach(function (t) {
      var v = data.conflitos.get(t) || 0;
      if (!v && t === 'Prioridade Correta') {
        chipConflitos += chip(t, 0, !!(state.selectedConflitos || {})[t], null, 'atp-dash-chip-dim');
      } else if (v || t !== 'Prioridade Correta') {
        chipConflitos += chip(t, v, !!(state.selectedConflitos || {})[t], null, null);
      }
    });
    chipConflitos += chip('Sem Conflito', semConflito, !!(state.selectedConflitos || {})['__SemConflito__'], null, 'atp-dash-chip-ok');

    var chipTags = '';
    var tagsOrdem = ['Com Problema Crítico', 'Com Atenção', 'Sem Alerta', 'Sem Ação Programada', 'Com Ação Programada', 'Prioridade OK'];
    tagsOrdem.forEach(function (t) {
      var v = data.tags.get(t) || 0;
      if (!v) return;
      chipTags += chip(t, v, !!(state.selectedTags || {})[t], null, null);
    });

    var barrasConflito = '';
    CONFLITO_TIPOS_EXIBIR.forEach(function (t) {
      var v = data.conflitos.get(t) || 0;
      if (!v && t !== 'Prioridade Correta') return;
      var ativo = !!(state.selectedConflitos || {})[t];
      barrasConflito += barRow(t, v, Math.max(1, maxConflito), tipoClassParaBar(t), true, ativo);
    });
    barrasConflito += barRow('Sem Conflito', semConflito, Math.max(1, maxConflito), '#16a34a', true, !!(state.selectedConflitos || {})['__SemConflito__']);

    var barrasPrio = '';
    if (prioKeys.length) {
      var maxP = 0;
      prioKeys.forEach(function (k) { maxP = Math.max(maxP, data.prioridades.get(k) || 0); });
      prioKeys.forEach(function (k) {
        var v = data.prioridades.get(k) || 0;
        var ativo = !!(state.selectedPrioridades || {})[k];
        barrasPrio += barRow('Prioridade P' + k, v, Math.max(1, maxP), '#6366f1', true, ativo);
      });
    } else {
      barrasPrio = '<div class="atp-dash-empty">Aguardando análise para distribuir prioridades…</div>';
    }

    var remColor = data.removerSim > data.removerNao ? '#ef4444' : '#64748b';
    var incColor = data.incluirSim > data.incluirNao ? '#2563eb' : '#64748b';
    var maxRemInc = Math.max(1, Math.max(data.removerSim, data.removerNao, data.incluirSim, data.incluirNao));

    return (
      '<div class="atp-dashboard ' + (state.collapsed ? ' is-collapsed' : '') + '" id="atpDashboardV1">' +
        '<div class="atp-dash-head">' +
          '<div class="atp-dash-head-left">' +
            '<span class="atp-dash-brand">⚡ ATP Painel</span>' +
            '<span class="atp-dash-pill atp-dash-pill-neutral">Visible: <b>' + String(visibleCount) + '</b> / ' + String(total) + '</span>' +
            (total ? (
              '<span class="atp-dash-pill atp-dash-pill-neutral">Filtros ativos: <b id="atpDashActiveFilterCount">' +
              String(countActiveFilters(state)) + '</b></span>'
            ) : '') +
          '</div>' +
          '<div class="atp-dash-head-actions">' +
            '<button type="button" class="atp-dash-btn" data-action="clear" title="Limpar todos os filtros do painel">🧹 Limpar filtros</button>' +
            '<button type="button" class="atp-dash-btn" data-action="toggleCollapse" title="Minimizar / maximizar painel">' + (state.collapsed ? '⬇ Expandir' : '⬆ Minimizar') + '</button>' +
          '</div>' +
        '</div>' +

        (state.collapsed ? '' : (
          '<div class="atp-dash-body">' +

            '<div class="atp-dash-kpis">' +
              '<div class="atp-dash-kpi atp-dash-kpi-1">' +
                '<div class="atp-dash-kpi-num">' + String(total) + '</div>' +
                '<div class="atp-dash-kpi-lbl">📋 Regras totais</div>' +
              '</div>' +
              '<div class="atp-dash-kpi atp-dash-kpi-2">' +
                '<div class="atp-dash-kpi-num">' + String(comProb) +
                  (total ? (' <span class="atp-dash-kpi-sub">(' + pctProb.toFixed(1) + '%)</span>') : '') +
                '</div>' +
                '<div class="atp-dash-kpi-lbl">⚠️ Com problema crítico</div>' +
              '</div>' +
              '<div class="atp-dash-kpi atp-dash-kpi-3">' +
                '<div class="atp-dash-kpi-num">' +
                  String(cobertura.toFixed(0)) + '<span class="atp-dash-kpi-sub">%</span>' +
                '</div>' +
                '<div class="atp-dash-kpi-lbl">🎯 Regras com INCLUIR</div>' +
              '</div>' +
              '<div class="atp-dash-kpi atp-dash-kpi-4">' +
                '<div class="atp-dash-kpi-num">' + String(data.incluirSim) + '</div>' +
                '<div class="atp-dash-kpi-lbl">🔽 INCLUIR = SIM</div>' +
              '</div>' +
              '<div class="atp-dash-kpi atp-dash-kpi-5">' +
                '<div class="atp-dash-kpi-num">' + String(data.removerSim) + '</div>' +
                '<div class="atp-dash-kpi-lbl">🔼 REMOVER = SIM</div>' +
              '</div>' +
              '<div class="atp-dash-kpi atp-dash-kpi-6">' +
                '<div class="atp-dash-kpi-num">' + String(data.totalOk) + '</div>' +
                '<div class="atp-dash-kpi-lbl">✅ Sem alertas</div>' +
              '</div>' +
            '</div>' +

            '<div class="atp-dash-section">' +
              '<div class="atp-dash-sec-head"><div class="atp-dash-sec-title">⚡ Filtros rápidos</div></div>' +

              '<div class="atp-dash-group">' +
                '<div class="atp-dash-group-label">REMOVER</div>' +
                '<div class="atp-dash-chips" data-group="remover">' +
                  chip('Todos', null, state.remover === 'todos') +
                  chip('SIM', data.removerSim, state.remover === 'sim', null, 'atp-dash-chip-warn') +
                  chip('NÃO', data.removerNao, state.remover === 'nao') +
                '</div>' +
              '</div>' +

              '<div class="atp-dash-group">' +
                '<div class="atp-dash-group-label">INCLUIR</div>' +
                '<div class="atp-dash-chips" data-group="incluir">' +
                  chip('Todos', null, state.incluir === 'todos') +
                  chip('SIM', data.incluirSim, state.incluir === 'sim', null, 'atp-dash-chip-info') +
                  chip('NÃO', data.incluirNao, state.incluir === 'nao') +
                '</div>' +
              '</div>' +

              '<div class="atp-dash-group">' +
                '<div class="atp-dash-group-label">Prioridades <span class="atp-dash-group-sub">(clique para filtrar)</span></div>' +
                '<div class="atp-dash-chips" data-group="prioridade">' +
                  chipPrio +
                '</div>' +
              '</div>' +

              '<div class="atp-dash-group">' +
                '<div class="atp-dash-group-label">Conflitos</div>' +
                '<div class="atp-dash-chips" data-group="conflito">' +
                  chipConflitos +
                '</div>' +
              '</div>' +

              '<div class="atp-dash-group">' +
                '<div class="atp-dash-group-label">Tags</div>' +
                '<div class="atp-dash-chips" data-group="tag">' +
                  chipTags +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="atp-dash-section atp-dash-section-split">' +
              '<div class="atp-dash-col">' +
                '<div class="atp-dash-sec-head"><div class="atp-dash-sec-title">📊 Tipo de conflito</div><div class="atp-dash-sec-sub">clique na barra para filtrar</div></div>' +
                '<div class="atp-dash-bars" data-bar-group="conflito">' + barrasConflito + '</div>' +
              '</div>' +
              '<div class="atp-dash-col">' +
                '<div class="atp-dash-sec-head"><div class="atp-dash-sec-title">📊 Distribuição por prioridade</div></div>' +
                '<div class="atp-dash-bars" data-bar-group="prioridade">' + barrasPrio + '</div>' +
              '</div>' +
            '</div>' +

            '<div class="atp-dash-section">' +
              '<div class="atp-dash-sec-head"><div class="atp-dash-sec-title">📊 REMOVER vs INCLUIR</div></div>' +
              '<div class="atp-dash-bars">' +
                barRow('REMOVER = SIM', data.removerSim, maxRemInc, remColor, false, false) +
                barRow('REMOVER = NÃO', data.removerNao, maxRemInc, '#94a3b8', false, false) +
                barRow('INCLUIR = SIM', data.incluirSim, maxRemInc, incColor, false, false) +
                barRow('INCLUIR = NÃO', data.incluirNao, maxRemInc, '#94a3b8', false, false) +
              '</div>' +
            '</div>' +

            '<div class="atp-dash-foot">' +
              '<span>💡 Clique em qualquer chip/barra para filtrar a tabela abaixo em tempo real. "Limpar filtros" devolve tudo.</span>' +
            '</div>' +

          '</div>'
        )) +
      '</div>'
    );
  }

  function countActiveFilters(state) {
    var n = 0;
    if (state.remover !== 'todos') n += 1;
    if (state.incluir !== 'todos') n += 1;
    n += Object.keys(state.selectedPrioridades || {}).length;
    n += Object.keys(state.selectedConflitos || {}).length;
    n += Object.keys(state.selectedTags || {}).length;
    return n;
  }

  function findBarLabelForClick(el) {
    var row = el.closest ? el.closest('.atp-dash-bar-row') : null;
    if (!row) return null;
    var lbl = row.querySelector('.atp-dash-bar-label');
    return lbl ? (lbl.textContent || '').trim() : null;
  }

  function bindDashboardEvents(wrapper, state, onStateChanged) {
    var handler = function (ev) {
      var t = ev && ev.target instanceof Element ? ev.target : null;
      if (!t) return;

      var btn = t.closest ? t.closest('button[data-action]') : null;
      if (btn) {
        var action = btn.getAttribute('data-action');
        if (action === 'clear') {
          state.remover = 'todos';
          state.incluir = 'todos';
          state.selectedPrioridades = {};
          state.selectedConflitos = {};
          state.selectedTags = {};
          saveState(state);
          onStateChanged();
          return;
        }
        if (action === 'toggleCollapse') {
          state.collapsed = !state.collapsed;
          saveState(state);
          onStateChanged();
          return;
        }
      }

      var chipBtn = t.closest ? t.closest('button.atp-dash-chip') : null;
      if (chipBtn) {
        var groupWrap = chipBtn.closest ? chipBtn.closest('.atp-dash-chips') : null;
        var group = groupWrap ? groupWrap.getAttribute('data-group') : null;
        var labelEl = chipBtn.querySelector('.atp-dash-chip-label');
        var label = labelEl ? (labelEl.textContent || '').trim() : '';
        if (group && label) {
          handleChipClick(state, group, label, onStateChanged);
        }
        return;
      }

      var barContainer = t.closest ? t.closest('.atp-dash-bars[data-bar-group]') : null;
      if (barContainer) {
        var group2 = barContainer.getAttribute('data-bar-group');
        var label2 = findBarLabelForClick(t);
        if (group2 && label2) {
          var mapKey = null;
          if (group2 === 'conflito') {
            mapKey = (label2 === 'Sem Conflito') ? '__SemConflito__' : label2;
            if (CONFLITO_TIPOS_EXIBIR.indexOf(label2) >= 0 || label2 === 'Sem Conflito') {
              toggleSetInState(state, 'selectedConflitos', mapKey);
              onStateChanged();
              return;
            }
          }
          if (group2 === 'prioridade') {
            var mp = /P\s*(\d+)/i.exec(label2);
            if (mp) { toggleSetInState(state, 'selectedPrioridades', mp[1]); onStateChanged(); return; }
          }
        }
      }
    };
    wrapper.addEventListener('click', handler);
    return handler;
  }

  function handleChipClick(state, group, label, onStateChanged) {
    if (group === 'remover') {
      if (label === 'Todos') state.remover = 'todos';
      else if (label === 'SIM') state.remover = 'sim';
      else if (label === 'NÃO') state.remover = 'nao';
      saveState(state);
      onStateChanged();
      return;
    }
    if (group === 'incluir') {
      if (label === 'Todos') state.incluir = 'todos';
      else if (label === 'SIM') state.incluir = 'sim';
      else if (label === 'NÃO') state.incluir = 'nao';
      saveState(state);
      onStateChanged();
      return;
    }
    if (group === 'prioridade') {
      var m = /^P\s*(\d+)$/i.exec(label);
      if (m) toggleSetInState(state, 'selectedPrioridades', m[1]);
      onStateChanged();
      return;
    }
    if (group === 'conflito') {
      var key = (label === 'Sem Conflito') ? '__SemConflito__' : label;
      toggleSetInState(state, 'selectedConflitos', key);
      onStateChanged();
      return;
    }
    if (group === 'tag') {
      toggleSetInState(state, 'selectedTags', label);
      onStateChanged();
      return;
    }
  }

  function applyRowVisibility(filteredStats) {
    var visibleSet = new Set(filteredStats.map(function (s) { return s.tr; }));
    filteredStats.forEach(function () {});
    var table = findTableOrNull();
    var all = getAllRuleRows(table);
    all.forEach(function (tr) {
      var show = visibleSet.has(tr);
      tr.style.display = show ? '' : 'none';
    });
  }

  // Onde inserir o painel. Fica FORA do container da tabela (que e a raiz
  // observada pelo MutationObserver de 10-ui): inserimos como irmao ANTERIOR
  // do box da tabela, para que o painel nao conte como mutacao na subarvore
  // vigiada nem force relayout da tabela inteira a cada render.
  function findDashMount() {
    var t = findTableOrNull();
    if (t && t.parentElement && t.parentElement.parentElement) {
      return { parent: t.parentElement.parentElement, before: t.parentElement };
    }
    var fallback = (t && t.parentElement) || document.body;
    return { parent: fallback, before: null };
  }

  // (Re)vincula o listener delegado do painel SEM acumular listeners: guarda a
  // referencia do handler anterior e remove antes de adicionar o novo.
  function atpBindDash(wrapper, state) {
    if (wrapper.__atpClickHandler) {
      try { wrapper.removeEventListener('click', wrapper.__atpClickHandler); } catch (_) {}
    }
    wrapper.__atpClickHandler = bindDashboardEvents(wrapper, state, function () { render(); });
  }

  function render() {
    var wrapper = document.getElementById('atpDashboardV1');
    if (!wrapper) return;
    var _pt = (typeof atpPerfNow === 'function') ? atpPerfNow() : 0;
    var table = findTableOrNull();
    var rows = getAllRuleRows(table);
    var data = computeAllStats(rows);
    var state = loadState();
    var filtered = getFilteredRows(data, state);
    applyRowVisibility(filtered);

    // Atualizacao IN-PLACE: mantemos o proprio elemento #atpDashboardV1 (e sua
    // identidade/posicao no DOM) e trocamos apenas classe + filhos. Evita o
    // replaceChild + re-parse do HTML e o reflow de reancorar o bloco.
    var newHtml = mountDashHtml(state, data, filtered.length);
    var tmp = document.createElement('div');
    tmp.innerHTML = newHtml;
    var newNode = tmp.firstElementChild;
    if (!newNode) return;
    wrapper.className = newNode.className;
    while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
    while (newNode.firstChild) wrapper.appendChild(newNode.firstChild);
    atpBindDash(wrapper, state);
    if (typeof atpPerfAdd === 'function') atpPerfAdd('dashboard.render', atpPerfNow() - _pt);
  }

  function installDashboard() {
    if (document.getElementById('atpDashboardV1')) return;
    if (typeof isATPAutomationPage === 'function' && !isATPAutomationPage()) return;
    if (!/automatizar_localizadores/i.test(String(location.href || ''))) return;

    var state = loadState();
    var mount = findDashMount();
    var table = findTableOrNull();
    var _pt = (typeof atpPerfNow === 'function') ? atpPerfNow() : 0;
    var data = computeAllStats(getAllRuleRows(table));
    var filtered = getFilteredRows(data, state);
    var html = mountDashHtml(state, data, filtered.length);
    if (!html) return;

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    var node = wrap.firstElementChild;
    if (!node) return;
    if (mount.before && mount.before.parentNode === mount.parent) mount.parent.insertBefore(node, mount.before);
    else mount.parent.insertBefore(node, mount.parent.firstChild);
    if (typeof atpPerfAdd === 'function') atpPerfAdd('dashboard.install', atpPerfNow() - _pt);

    try {
      var theadBar = document.querySelector('#tableAutomatizacaoLocalizadores thead, table[id*="AutomatizacaoLocalizador"] thead');
      if (theadBar && theadBar.style) theadBar.style.setProperty('position', 'sticky');
      if (theadBar && theadBar.style) theadBar.style.setProperty('top', 'calc(var(--atp-dash-h, 260px) + 8px)');
      if (theadBar && theadBar.style) theadBar.style.setProperty('z-index', '20');
      if (theadBar && theadBar.style) theadBar.style.setProperty('background', '#fff');
    } catch (_) {}

    atpBindDash(node, state);
    applyRowVisibility(filtered);
  }

  function atpQueueDashRender(delay) {
    var key = '__atp_dash_render_t__';
    if (window[key]) { try { clearTimeout(window[key]); } catch (_) {} }
    window[key] = setTimeout(function () {
      try { installDashboard(); render(); } catch (e) {
        try { console.warn('[ATP][Painel] erro:', e); } catch (_) {}
      }
    }, Math.max(0, Number(delay) || 0));
  }

  try {
    if (typeof window.atpInstallV1Dashboard !== 'function') window.atpInstallV1Dashboard = installDashboard;
    if (typeof window.atpRenderDashboardV1 !== 'function') window.atpRenderDashboardV1 = render;
    if (typeof window.atpQueueDashRender !== 'function') window.atpQueueDashRender = atpQueueDashRender;
  } catch (e) { }

  if (typeof window.__ATP_DASH_V1_BOOTSTRAPPED__ === 'undefined') {
    window.__ATP_DASH_V1_BOOTSTRAPPED__ = true;
    var boot = function () { atpQueueDashRender(0); atpQueueDashRender(600); atpQueueDashRender(1800); atpQueueDashRender(3600); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
    window.addEventListener('load', function () { atpQueueDashRender(500); atpQueueDashRender(2000); }, { once: true });
  }
})();

try { console.log('[ATP][OK] 13-painel-sumario.js inicializado'); } catch (e) { }
;