try { console.log('[ATP][LOAD] 06-analisador-de-colisoes.js carregado com sucesso'); } catch (e) {}

  function atpShouldIncludeInactiveRules() {
    try {
      if (typeof window.atpIncludeInactiveRules === 'boolean') return window.atpIncludeInactiveRules;
    } catch (_) {}
    try {
      return !!ATP_CONFIG?.incluirRegrasInativas;
    } catch (_) {}
    return false;
  }

  const ATP_PRIO_REVIEWED_PAIRS_KEY = 'ATP_PRIO_REVIEWED_PAIRS_V1';

  function atpGetStorageScopeKey() {
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
      pick('.infraNomeUnidade')
    ].filter(Boolean);
    const raw = String(candidates.find((s) => String(s || '').trim().length >= 6) || '').trim();
    const host = String(location?.host || '').trim();
    const base = [host, raw].filter(Boolean).join('|');
    const normd = rmAcc(clean(base || ''))
      .toUpperCase()
      .replace(/[^\w|.-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 140);
    return normd;
  }

  function atpScopedStorageKey(baseKey) {
    const b = String(baseKey || '').trim();
    const scope = atpGetStorageScopeKey();
    return scope ? `${b}::${scope}` : b;
  }

  function atpLoadJsonLocal(key, fallback) {
    const baseKey = String(key || '');
    const scopedKey = atpScopedStorageKey(baseKey);
    try {
      const raw = localStorage.getItem(scopedKey);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return (v && typeof v === 'object') ? v : fallback;
    } catch (_) {}
    if (scopedKey !== baseKey) {
      try {
        const raw = localStorage.getItem(baseKey);
        if (!raw) return fallback;
        const v = JSON.parse(raw);
        const out = (v && typeof v === 'object') ? v : fallback;
        if (out && typeof out === 'object') {
          try { localStorage.setItem(scopedKey, raw); } catch (_) {}
        }
        return out;
      } catch (_) {}
    }
    return fallback;
  }

  function atpSaveJsonLocal(key, value) {
    try { localStorage.setItem(atpScopedStorageKey(key), JSON.stringify(value || {})); } catch (_) {}
  }

  function atpRuleSignatureFromParts(num, localRem, tipo, locInc, outros) {
    const n = clean(String(num || ''));
    const a = clean(String(localRem || ''));
    const b = clean(String(tipo || ''));
    const c = clean(String(locInc || ''));
    const d = clean(String(outros || ''));
    return [n, a, b, c, d].join('||');
  }

  function atpReviewedPairKey(aSig, bSig) {
    const a = String(aSig || '');
    const b = String(bSig || '');
    return (a <= b) ? `${a}##${b}` : `${b}##${a}`;
  }

  function atpIsReviewedPriorityPair(aSig, bSig, reviewedMap) {
    const map = reviewedMap || atpLoadJsonLocal(ATP_PRIO_REVIEWED_PAIRS_KEY, {});
    const k = atpReviewedPairKey(aSig, bSig);
    return !!(map && map[k]);
  }

  function atpToggleReviewedPriorityPair(pairKey) {
    const map = atpLoadJsonLocal(ATP_PRIO_REVIEWED_PAIRS_KEY, {});
    const k = String(pairKey || '').trim();
    if (!k) return false;
    const now = !map[k];
    if (now) map[k] = 1;
    else delete map[k];
    atpSaveJsonLocal(ATP_PRIO_REVIEWED_PAIRS_KEY, map);
    return now;
  }

  function atpApplyReviewedPrioritySuppressions(rules, conflictsByRule) {
    const reviewed = atpLoadJsonLocal(ATP_PRIO_REVIEWED_PAIRS_KEY, {});
    const byNum = new Map((rules || []).map(r => [String(r.num), r]));
    for (const [baseNum, bucket] of (conflictsByRule || new Map()).entries()) {
      const baseRule = byNum.get(String(baseNum));
      if (!baseRule?.sig) continue;
      for (const [otherNum, rec] of Array.from((bucket || new Map()).entries())) {
        if (!rec?.tipos?.has?.('Avaliar Prioridade')) continue;
        const otherRule = byNum.get(String(otherNum));
        if (!otherRule?.sig) continue;
        if (!atpIsReviewedPriorityPair(baseRule.sig, otherRule.sig, reviewed)) continue;
        try {
          rec.tipos.delete('Avaliar Prioridade');
          try { rec.motivosByTipo?.delete?.('Avaliar Prioridade'); } catch (_) {}
          if (!rec.tipos.size) bucket.delete(otherNum);
        } catch (_) {}
      }
      if (!(bucket && bucket.size)) conflictsByRule.delete(baseNum);
    }
  }

  function parseRules(table, cols) {
    cols = cols || {};
    const list = [];
    const tbodys = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector("tbody")].filter(Boolean);
    const rows = tbodys.flatMap(tb => Array.from(tb.rows));

    for (const tr of rows) {
      const tds = Array.from(tr.querySelectorAll(':scope > td'));
      if (!tds.length) continue;

      delete tr.dataset.atpInactive;
      const tdAcoes = tds.find((td) => {
        if (!td) return false;
        if (td.dataset && td.dataset.atpCol === 'conflita') return false;
        if (td.querySelector('input.custom-control-input[name*="ativ" i], input[type="checkbox"][name*="ativ" i], input.custom-control-input[id*="ativ" i], input[type="checkbox"][id*="ativ" i]')) return true;
        return !!td.querySelector('.custom-switch input[type="checkbox"], i.material-icons, .material-icons');
      }) || tds[0] || null;
      const chkAtiva = tdAcoes?.querySelector('input.custom-control-input[name*="ativ" i], input[type="checkbox"][name*="ativ" i], input.custom-control-input[id*="ativ" i], input[type="checkbox"][id*="ativ" i], .custom-switch input[type="checkbox"], input.custom-control-input, input[type="checkbox"]') || null;
      const ativa = chkAtiva ? !!chkAtiva.checked : true;
      const includeInactive = atpShouldIncludeInactiveRules();
      if (chkAtiva && !ativa) {
        tr.dataset.atpInactive = "1";
        if (!includeInactive) {
          try {
            const confTd = tr.querySelector('td[data-atp-col="conflita"]');
            if (confTd) {
              confTd.innerHTML = '';
              delete confTd.dataset.atpRenderedHtml;
              delete confTd.dataset.atpConfNums;
            }
          } catch (_) {}
          try {
            delete tr.dataset.atpHasConflict;
            delete tr.dataset.atpHasPossible;
            tr.classList.remove('atp-sev-2', 'atp-sev-3', 'atp-sev-4', 'atp-sev-5');
          } catch (_) {}
          continue;
        }
      }

      const tdNumero   = tds[cols.colNumPrior] || tds[1];
      const tdPrior    = (Number.isFinite(Number(cols.colPrioridade)) && Number(cols.colPrioridade) >= 0)
        ? (tds[cols.colPrioridade] || null)
        : null;
      const tdRemover  = tds[cols.colRemover]  || tds[3];
      const tdTipo     = tds[cols.colTipo]     || tds[4];
      const tdIncluir  = tds[cols.colIncluir]  || tds[5];
      const tdOutros   = tds[cols.colOutros]   || tds[6];

      const num = extrairNumeroRegra(tdNumero);
      if (!num) continue;

      const prioridadeTexto = extrairPrioridade(tdPrior || tdNumero);
      const prioridadeBase = parsePriority(prioridadeTexto);

      const lerTextoCelula = (td) => {
        if (!td) return '';
        const blocoCompleto = td.querySelector && td.querySelector('div[id^="dadosCompletos_"]');
        return clean((blocoCompleto?.innerText || blocoCompleto?.textContent || td.innerText || td.textContent || ''));
      };

      let outrosCriterios = extrairOutrosCriterios(tdOutros);
      if (!clean(outrosCriterios?.canonical || '') && clean(lerTextoCelula(tdOutros))) {
        const raw = lerTextoCelula(tdOutros);
        outrosCriterios = {
          canonical: raw,
          clauses: [new Set([raw])],
          groups: [{ canonical: raw, clauses: [new Set([raw])], tokens: [{ type: 'term', value: raw }] }]
        };
      }

      let tipoControleCriterio = extrairTipoControleCriterio(tdTipo);
      if (!clean(tipoControleCriterio?.canonical || tipoControleCriterio?.canon || tipoControleCriterio?.text || '') && clean(lerTextoCelula(tdTipo))) {
        const raw = lerTextoCelula(tdTipo);
        tipoControleCriterio = {
          canonical: raw,
          clauses: [new Set([raw])],
          controles: [],
          pares: [],
          header: '',
          rawTerms: [raw]
        };
      }

      const tipoCanonico = clean(tipoControleCriterio?.canonical || tipoControleCriterio?.canon || tipoControleCriterio?.text || '');
      const localizadorRemover = extrairOrigemRemoverExpr(tdRemover, tipoCanonico);

      const removerWildcard = !!(tdRemover && tdRemover.dataset && tdRemover.dataset.atpRemoverWildcard === '1');

      const comportamentoRemover = extrairComportamentoRemover(tdRemover);

      const localizadorIncluirAcao = extrairLocalizadorIncluirAcao(tdIncluir);

      const sig = atpRuleSignatureFromParts(
        num,
        clean(localizadorRemover?.canonical || localizadorRemover?.canon || localizadorRemover?.text || localizadorRemover || ''),
        tipoCanonico,
        clean(localizadorIncluirAcao?.canonical || localizadorIncluirAcao?.canon || localizadorIncluirAcao?.text || localizadorIncluirAcao || ''),
        clean(outrosCriterios?.canonical || outrosCriterios?.canon || outrosCriterios?.text || outrosCriterios || '')
      );

      const prioridade = prioridadeBase;

      list.push({
        num,
        prioridade,
        prioridadeOriginal: prioridadeBase,
        sig,
        localizadorRemover,

        removerWildcard,
        comportamentoRemover,

        localizadorIncluirAcao,

        tipoControleCriterio,

        outrosCriterios,
        ativa,
        tr
      });
    }

    return list;
  }

  function analyze(rules) {
    const conflictsByRule = new Map();

    const ensureBucket = (baseNum) => {
      if (!conflictsByRule.has(baseNum)) conflictsByRule.set(baseNum, new Map());
      return conflictsByRule.get(baseNum);
    };

    const upsert = (baseNum, otherNum, tipo, impacto, motivo) => {
      const bucket = ensureBucket(baseNum);
      const rec = bucket.get(otherNum) || { tipos: new Set(), impactoMax: 'Baixo', motivos: new Set(), motivosByTipo: new Map() };
      rec.tipos.add(tipo);
      if ((impactoRank[impacto] || 0) > (impactoRank[rec.impactoMax] || 0)) rec.impactoMax = impacto;
      if (motivo) {
        rec.motivos.add(motivo);
        if (!rec.motivosByTipo) rec.motivosByTipo = new Map();
        const set = rec.motivosByTipo.get(tipo) || new Set();
        set.add(motivo);
        rec.motivosByTipo.set(tipo, set);
      }
      bucket.set(otherNum, rec);
    };

    const prioKey = (r) => {
      const n = r?.prioridade?.num;
      if (Number.isFinite(n)) return `N:${n}`;
      const raw = clean(r?.prioridade?.raw || r?.prioridade?.text || '');
      return `T:${raw}`;
    };

    const prioEq = (a, b) => prioKey(a) === prioKey(b);
    const prioNum = (r) => (Number.isFinite(r?.prioridade?.num) ? r.prioridade.num : null);
    const prioIsTextoPrioridade = (r) => {
      const txt = rmAcc(clean(r?.prioridade?.text || r?.prioridade?.raw || '')).toLowerCase();
      return txt === 'prioridade';
    };
    const prioExecutaAntesPOC = (a, b) => {
      const na = prioNum(a);
      const nb = prioNum(b);
      if (na != null && nb != null) return na < nb;

      // Regra de negócio: qualquer 1..20 executa antes de "Prioridade" (texto).
      const aTxt = prioIsTextoPrioridade(a);
      const bTxt = prioIsTextoPrioridade(b);
      if (na != null && bTxt) return true;
      if (aTxt && nb != null) return false;

      // Mantém a semântica geral: prioridade numérica executa antes de não-numérica.
      if (na != null && nb == null) return true;
      if (na == null && nb != null) return false;

      return false;
    };
    const prioLabel = (r) => {
      const n = prioNum(r);
      if (n != null) return `${n}ª`;
      const txt = clean(r?.prioridade?.text || r?.prioridade?.raw || '');
      return txt || '[*]';
    };
    const _tipoCanon = (r) => rmAcc(clean(
      r?.tipoControleCriterio?.canon
      || r?.tipoControleCriterio?.text
      || r?.tipoControleCriterio
      || ''
    )).toLowerCase();
    const gatilhoEhTempo = (r) => {
      const src = _tipoCanon(r);
      return /(\bdata\b|\btempo\b|\bprazo\b|\bperiodo\b|\bperiodicamente\b)/.test(src);
    };

    const execOrder = (r) => {
      const n = prioNum(r);
      return (n == null) ? Number.POSITIVE_INFINITY : n;
    };

    const ruleNumVal = (r) => {
      const n = Number(r && r.num);
      return Number.isFinite(n) ? n : (parseInt(String(r && r.num || ''), 10) || 0);
    };

    const pickKeepDropTotal = (A, B) => {
      const aN = ruleNumVal(A), bN = ruleNumVal(B);
      const keep = (aN <= bN) ? A : B;
      const drop = (aN <= bN) ? B : A;
      return { keep, drop, reason: 'duplicada (colisão total)' };
    };

    const pickKeepDropParcial = (A, B) => {
      const oa = execOrder(A), ob = execOrder(B);
      let keep = A, drop = B;

      if (oa !== ob) {
        keep = (oa < ob) ? A : B;
        drop = (oa < ob) ? B : A;
      } else {

        const aN = ruleNumVal(A), bN = ruleNumVal(B);
        keep = (aN <= bN) ? A : B;
        drop = (aN <= bN) ? B : A;
      }
      return { keep, drop, reason: 'redundante (colisão parcial)' };
    };

    const normMsg = (s) => rmAcc(clean(s)).toLowerCase();
    const MSG_PERDA_OBJETO = normMsg('Remover o processo do(s) localizador(es) informado(s).');

    const exprTermsUnion = (expr) => {
      const out = new Set();
      const clauses = Array.isArray(expr?.clauses) ? expr.clauses : [];
      for (const set of clauses) {
        if (!(set instanceof Set)) continue;
        for (const t of set) {
          const tt = clean(t);
          if (!tt) continue;
          if (tt === '[*]') continue;
          if (tt === 'E' || tt === 'OU') continue;
          out.add(tt);
        }
      }
      return out;
    };
    // Cache de conjuntos por regra (hot path da análise par-a-par).
    const _cacheRemSet = new WeakMap();
    const _cacheIncSet = new WeakMap();
    const _cacheTipoSet = new WeakMap();
    const _cacheTipoFamilySet = new WeakMap();
    const _cacheRemClauses = new WeakMap();
    const getRemSet = (r) => {
      if (!r) return new Set();
      if (_cacheRemSet.has(r)) return _cacheRemSet.get(r);
      const v = exprTermsUnion(r.localizadorRemover);
      _cacheRemSet.set(r, v);
      return v;
    };
    const getIncSet = (r) => {
      if (!r) return new Set();
      if (_cacheIncSet.has(r)) return _cacheIncSet.get(r);
      const v = exprTermsUnion(r.localizadorIncluirAcao);
      _cacheIncSet.set(r, v);
      return v;
    };
    const getTipoSet = (r) => {
      if (!r) return new Set();
      if (_cacheTipoSet.has(r)) return _cacheTipoSet.get(r);
      const v = exprTermsUnion(r.tipoControleCriterio);
      _cacheTipoSet.set(r, v);
      return v;
    };
    const getTipoFamilySet = (r) => {
      if (!r) return new Set();
      if (_cacheTipoFamilySet.has(r)) return _cacheTipoFamilySet.get(r);
      const terms = Array.from(getTipoSet(r) || []);
      const out = new Set();
      const norm = (s) => clean(String(s || '')).toLowerCase();
      for (const t of terms) {
        const txt = clean(t);
        if (!txt) continue;
        const i = txt.indexOf(':');
        const head = norm(i > 0 ? txt.slice(0, i) : txt);
        if (!head) continue;
        if (head.startsWith('por ')) out.add(head);
      }
      _cacheTipoFamilySet.set(r, out);
      return out;
    };
    const _cacheOrigemSet = new WeakMap();
    const getOrigemSet = (r) => {
      if (!r) return new Set();
      if (_cacheOrigemSet.has(r)) return _cacheOrigemSet.get(r);
      // Origem é tratada como string atômica (sem quebrar por E/OU).
      // Interseção só existe por igualdade estrita entre itens completos.
      const norm = (s) => clean(String(s || '')).replace(/\s+/g, ' ').trim();
      const out = new Set(
        (Array.isArray(r?.localizadorRemover?.origens) ? r.localizadorRemover.origens : [])
          .map(norm)
          .filter((v) => {
            if (!v) return false;
            const vn = ((typeof rmAcc === 'function') ? rmAcc(v) : v).toLowerCase();
            return vn !== 'todos os localizadores';
          })
      );
      _cacheOrigemSet.set(r, out);
      return out;
    };
    const hasAtomicOrigemIntersection = (aOrigSet, bOrigSet) => {
      if (!aOrigSet || !bOrigSet || !aOrigSet.size || !bOrigSet.size) return false;
      // Igualdade exata de item inteiro (sem tokenização).
      for (const origemA of aOrigSet) if (bOrigSet.has(origemA)) return true;
      return false;
    };
    const getRemClauses = (r) => {
      if (!r) return [];
      if (_cacheRemClauses.has(r)) return _cacheRemClauses.get(r);
      const v = Array.isArray(r?.localizadorRemover?.clauses) ? r.localizadorRemover.clauses : [];
      _cacheRemClauses.set(r, v);
      return v;
    };
    const _cacheCanonRem = new WeakMap();
    const _cacheCanonInc = new WeakMap();
    const _cacheCanonTipo = new WeakMap();
    const getCanonRem = (r) => {
      if (!r) return '';
      if (_cacheCanonRem.has(r)) return _cacheCanonRem.get(r);
      const v = exprCanon(r.localizadorRemover, '');
      _cacheCanonRem.set(r, v);
      return v;
    };
    const getCanonInc = (r) => {
      if (!r) return '';
      if (_cacheCanonInc.has(r)) return _cacheCanonInc.get(r);
      const v = exprCanon(r.localizadorIncluirAcao, '');
      _cacheCanonInc.set(r, v);
      return v;
    };
    const getCanonTipo = (r) => {
      if (!r) return '';
      if (_cacheCanonTipo.has(r)) return _cacheCanonTipo.get(r);
      const v = exprCanon(r.tipoControleCriterio, '');
      _cacheCanonTipo.set(r, v);
      return v;
    };
    const _pairKeyOrdered = (a, b) => `${String(a?.num || '')}>${String(b?.num || '')}`;
    const _cacheRelOutros = new Map();
    const _cacheOverlapOutros = new Map();
    const getRelOutros = (a, b) => {
      const k = _pairKeyOrdered(a, b);
      if (_cacheRelOutros.has(k)) return _cacheRelOutros.get(k);
      const v = relationOutros(a, b);
      _cacheRelOutros.set(k, v);
      return v;
    };
    const getOverlapOutros = (a, b) => {
      const k = _pairKeyOrdered(a, b);
      if (_cacheOverlapOutros.has(k)) return _cacheOverlapOutros.get(k);
      const v = outrosOverlapInfo(a, b);
      _cacheOverlapOutros.set(k, v);
      return v;
    };
    const removerTemAndNoMesmoRamo = (rule) => {
      const clauses = getRemClauses(rule);
      for (const clause of clauses) {
        if (!(clause instanceof Set)) continue;
        const terms = Array.from(clause).filter(t => {
          const tt = clean(t);
          return tt && tt !== '[*]' && tt !== 'E' && tt !== 'OU';
        });
        if (terms.length >= 2) return true;
      }
      return false;
    };

    const hasIntersection = (aSet, bSet) => {
      if (!aSet || !bSet || !aSet.size || !bSet.size) return false;
      for (const x of aSet) if (bSet.has(x)) return true;
      return false;
    };
    const isTotalContainment = (specificRule, broadRule, tipoSpecificVsBroad, overlapSpecificVsBroad) => {
      const specOrig = getOrigemSet(specificRule);
      const broadOrig = getOrigemSet(broadRule);
      // Para crítico real por inversão, exigimos contenção explícita na origem.
      if (!specOrig.size || !broadOrig.size) return false;
      if (!_setIsSubset(specOrig, broadOrig)) return false;

      const tipoOK =
        !!tipoSpecificVsBroad &&
        !tipoSpecificVsBroad.intersecaoHumana &&
        Number(tipoSpecificVsBroad.aSpecific || 0) > 0 &&
        Number(tipoSpecificVsBroad.bSpecific || 0) === 0;
      if (!tipoOK) return false;

      const ov = overlapSpecificVsBroad || {};
      const semEspecificidadeDaAmpla =
        ((ov.bOnlyKeys || []).length === 0) &&
        ((ov.bNarrowKeys || []).length === 0);
      const comEspecificidadeDaRestrita =
        ((ov.aOnlyKeys || []).length + (ov.aNarrowKeys || []).length) > 0;
      const outrosOK = !!ov.overlap && semEspecificidadeDaAmpla && comEspecificidadeDaRestrita;
      return outrosOK;
    };
    const usePoloNoConflito = (() => {
      try {
        if (ATP_CONFIG && typeof ATP_CONFIG.usarPoloNoConflito === 'boolean') return ATP_CONFIG.usarPoloNoConflito;
      } catch (_) {}
      return true;
    })();
    const _normPoloTxt = (v) => String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const _isPoloTerm = (t) => {
      const s = _normPoloTxt(t);
      return s.includes('polo ativo') || s.includes('polo passivo');
    };
    const _poloScopeFromSet = (setRaw) => {
      const scope = { hasConstraint: false, ativo: false, passivo: false };
      Array.from(setRaw || []).forEach((t) => {
        const s = _normPoloTxt(t);
        if (s.includes('polo ativo')) { scope.hasConstraint = true; scope.ativo = true; }
        if (s.includes('polo passivo')) { scope.hasConstraint = true; scope.passivo = true; }
      });
      return scope;
    };
    const tipoOverlapInfo = (ruleA, ruleB) => {
      const aSetRaw = getTipoSet(ruleA);
      const bSetRaw = getTipoSet(ruleB);
      const famA = getTipoFamilySet(ruleA);
      const famB = getTipoFamilySet(ruleB);
      // Regra de negócio: gatilho de famílias diferentes não conflita.
      // Ex.: "Por Evento" x "Por Tipo de Petição".
      if (famA.size && famB.size && !hasIntersection(famA, famB)) {
        return { overlap: false, equal: false, aSpecific: 0, bSpecific: 0, intersecaoHumana: false, aRestritaPorContencao: false, bRestritaPorContencao: false, equivalentes: false };
      }
      const aScope = _poloScopeFromSet(aSetRaw);
      const bScope = _poloScopeFromSet(bSetRaw);

      if (usePoloNoConflito && aScope.hasConstraint && bScope.hasConstraint) {
        // PASSIVO x ATIVO (sem interseção) => não conflita
        const disjunto = (!aScope.ativo || !bScope.ativo) && (!aScope.passivo || !bScope.passivo);
        if (disjunto) {
          return { overlap: false, equal: false, aSpecific: 0, bSpecific: 0, intersecaoHumana: false, aRestritaPorContencao: false, bRestritaPorContencao: false, equivalentes: false };
        }
      }

      const aPoloSpecific = (usePoloNoConflito && aScope.hasConstraint && !bScope.hasConstraint) ? 1 : 0;
      const bPoloSpecific = (usePoloNoConflito && bScope.hasConstraint && !aScope.hasConstraint) ? 1 : 0;
      // Remove tokens de pólo do conjunto-base, pois pólo é filtro interno do gatilho.
      const aSet = new Set(Array.from(aSetRaw).filter((t) => !_isPoloTerm(t)));
      const bSet = new Set(Array.from(bSetRaw).filter((t) => !_isPoloTerm(t)));
      if (!aSet.size && !bSet.size) {
        const equalPolo = !usePoloNoConflito || (
          (aScope.hasConstraint === bScope.hasConstraint) &&
          (aScope.ativo === bScope.ativo) &&
          (aScope.passivo === bScope.passivo)
        );
        return {
          overlap: true,
          equal: equalPolo,
          aSpecific: aPoloSpecific,
          bSpecific: bPoloSpecific,
          intersecaoHumana: false,
          aRestritaPorContencao: !!aPoloSpecific,
          bRestritaPorContencao: !!bPoloSpecific,
          equivalentes: equalPolo && !aPoloSpecific && !bPoloSpecific
        };
      }
      if (!aSet.size && bSet.size) {
        return {
          overlap: true, equal: false,
          aSpecific: aPoloSpecific,
          bSpecific: 1 + bPoloSpecific,
          intersecaoHumana: false,
          aRestritaPorContencao: !!aPoloSpecific,
          bRestritaPorContencao: true,
          equivalentes: false
        };
      }
      if (aSet.size && !bSet.size) {
        return {
          overlap: true, equal: false,
          aSpecific: 1 + aPoloSpecific,
          bSpecific: bPoloSpecific,
          intersecaoHumana: false,
          aRestritaPorContencao: true,
          bRestritaPorContencao: !!bPoloSpecific,
          equivalentes: false
        };
      }
      if (!hasIntersection(aSet, bSet)) {
        return { overlap: false, equal: false, aSpecific: 0, bSpecific: 0, intersecaoHumana: false, aRestritaPorContencao: false, bRestritaPorContencao: false, equivalentes: false };
      }
      const aSubsetB = _setIsSubset(aSet, bSet);
      const bSubsetA = _setIsSubset(bSet, aSet);
      if (aSubsetB && !bSubsetA) {
        return {
          overlap: true, equal: false,
          aSpecific: 1 + aPoloSpecific,
          bSpecific: bPoloSpecific,
          intersecaoHumana: false,
          aRestritaPorContencao: true,
          bRestritaPorContencao: !!bPoloSpecific,
          equivalentes: false
        };
      }
      if (bSubsetA && !aSubsetB) {
        return {
          overlap: true, equal: false,
          aSpecific: aPoloSpecific,
          bSpecific: 1 + bPoloSpecific,
          intersecaoHumana: false,
          aRestritaPorContencao: !!aPoloSpecific,
          bRestritaPorContencao: true,
          equivalentes: false
        };
      }
      if (aSubsetB && bSubsetA) {
        const equalPolo = !usePoloNoConflito || (
          (aScope.hasConstraint === bScope.hasConstraint) &&
          (aScope.ativo === bScope.ativo) &&
          (aScope.passivo === bScope.passivo)
        );
        return {
          overlap: true,
          equal: equalPolo,
          aSpecific: aPoloSpecific,
          bSpecific: bPoloSpecific,
          intersecaoHumana: false,
          aRestritaPorContencao: !!aPoloSpecific,
          bRestritaPorContencao: !!bPoloSpecific,
          equivalentes: equalPolo && !aPoloSpecific && !bPoloSpecific
        };
      }
      return {
        overlap: true, equal: false,
        aSpecific: 1 + aPoloSpecific,
        bSpecific: 1 + bPoloSpecific,
        intersecaoHumana: true,
        aRestritaPorContencao: false,
        bRestritaPorContencao: false,
        equivalentes: false
      };
    };

    const _termKV = (term) => {
      const s = clean(term);
      if (!s) return null;
      const idxEq = s.indexOf('=');
      const idxColon = s.indexOf(':');
      const i = (idxEq > 0) ? idxEq : idxColon;
      if (i > 0) {
        const k = clean(s.slice(0, i));
        const v = clean(s.slice(i + 1));
        if (!k) return null;
        return { k, v: v || '[*]' };
      }

      return { k: s, v: '[*]' };
    };

    const _clauseToMap = (clauseSet) => {
      const m = new Map();
      if (!(clauseSet instanceof Set)) return m;
      for (const raw of clauseSet) {
        const kv = _termKV(raw);
        if (!kv) continue;
        if (!m.has(kv.k)) m.set(kv.k, new Set());
        m.get(kv.k).add(kv.v);
      }
      return m;
    };

    const _mapValuesIntersect = (sa, sb) => {
      if (!sa || !sb) return true;
      for (const v of sa) if (sb.has(v)) return true;
      return false;
    };

    const _setIsSubset = (a, b) => {
      if (!a || !b) return false;
      for (const v of a) if (!b.has(v)) return false;
      return true;
    };
    const _normalizeSimpleKey = (s) => rmAcc(clean(s)).toLowerCase().replace(/[^a-z0-9]/g, '');
    const _intersects = (a, b) => {
      if (!(a instanceof Set) || !(b instanceof Set) || !a.size || !b.size) return false;
      for (const x of a) if (b.has(x)) return true;
      return false;
    };
    const _extractContainsModeByKey = (kRaw) => {
      const k = _normalizeSimpleKey(kRaw);
      if (!k.startsWith('localizadorque')) return '';
      if (k.includes('naocontenhanenhum')) return 'nenhum';
      if (k.includes('contenhatodos')) return 'todos';
      if (k.includes('contenhaaomenosum')) return 'aomenosum';
      return '';
    };
    const _extractContainsSetsByMode = (mapObj) => {
      const out = {
        nenhum: new Set(),
        todos: new Set(),
        aomenosum: new Set()
      };
      const mapRef = mapObj instanceof Map ? mapObj : new Map();
      for (const [k, vals] of mapRef.entries()) {
        const mode = _extractContainsModeByKey(k);
        if (!mode || !(vals instanceof Set)) continue;
        for (const raw of vals) {
          const v = clean(raw);
          if (!v || v === '[*]') continue;
          out[mode].add(v);
        }
      }
      return out;
    };
    const _extractComplementTokens = (valsSet) => {
      const out = new Set();
      if (!(valsSet instanceof Set)) return out;
      for (const raw of valsSet) {
        const txt = clean(raw);
        if (!txt) continue;
        const mQuoted = txt.match(/["']([^"']+)["']\s*no\s*evento/i);
        if (mQuoted && clean(mQuoted[1])) {
          out.add(clean(mQuoted[1]).toLowerCase());
          continue;
        }
        const mUnquoted = txt.match(/([0-9]+\s*cartas?)\s*no\s*evento/i);
        if (mUnquoted && clean(mUnquoted[1])) out.add(clean(mUnquoted[1]).toLowerCase());
      }
      return out;
    };
    const _mapsHaveAntagonicContains = (mapA, mapB) => {
      const a = _extractContainsSetsByMode(mapA);
      const b = _extractContainsSetsByMode(mapB);
      if (_intersects(a.nenhum, b.todos)) return true;
      if (_intersects(a.nenhum, b.aomenosum)) return true;
      if (_intersects(b.nenhum, a.todos)) return true;
      if (_intersects(b.nenhum, a.aomenosum)) return true;
      return false;
    };
    const _containsRelationInfo = (mapA, mapB) => {
      const a = _extractContainsSetsByMode(mapA);
      const b = _extractContainsSetsByMode(mapB);
      const aTodosVsBAlgum = _intersects(a.todos, b.aomenosum);
      const bTodosVsAAlgum = _intersects(b.todos, a.aomenosum);
      const algumRelacionamento =
        aTodosVsBAlgum ||
        bTodosVsAAlgum ||
        _intersects(a.todos, b.todos) ||
        _intersects(a.aomenosum, b.aomenosum);
      return {
        related: algumRelacionamento,
        aNarrow: aTodosVsBAlgum && !bTodosVsAAlgum,
        bNarrow: bTodosVsAAlgum && !aTodosVsBAlgum
      };
    };
    const _mapsHaveDifferentComplementConstraint = (mapA, mapB) => {
      const keyA = Array.from((mapA || new Map()).keys()).find(k => _normalizeSimpleKey(k).includes('eventotipodepeticaoquecontenhaocomplemento'));
      const keyB = Array.from((mapB || new Map()).keys()).find(k => _normalizeSimpleKey(k).includes('eventotipodepeticaoquecontenhaocomplemento'));
      if (!keyA || !keyB) return false;
      const setA = mapA.get(keyA);
      const setB = mapB.get(keyB);
      const cA = _extractComplementTokens(setA);
      const cB = _extractComplementTokens(setB);
      if (!cA.size || !cB.size) return false;
      return !_intersects(cA, cB);
    };
    const _isContainsKey = (kRaw) => !!_extractContainsModeByKey(kRaw);
    const _removeContainsOnlyFrom = (arr) => {
      const src = Array.isArray(arr) ? arr : [];
      return src.filter((k) => !_isContainsKey(k));
    };

    const _labelOutrosKey = (key) => {
      const k = clean(key);
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
        dadocomplementar: 'Dado Complementar'
      };
      return dict[k] || String(k || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([a-z])([0-9])/g, '$1 $2')
        .trim()
        .replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase()) || 'Outros Critérios';
    };

    const _formatOutrosKeys = (keys) => {
      const labels = Array.from(new Set((keys || []).map(_labelOutrosKey).filter(Boolean)));
      if (!labels.length) return '';
      if (labels.length === 1) return labels[0];
      if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
      return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
    };

    const _pickPriorityFieldText = (primaryKeys, secondaryKeys, sharedKeys) => {
      const primary = _formatOutrosKeys(primaryKeys || []);
      const secondary = _formatOutrosKeys(secondaryKeys || []);
      const shared = _formatOutrosKeys(sharedKeys || []);
      if (primary && secondary) return `${primary} sobre ${secondary}`;
      if (primary && shared) return `${primary} no contexto de ${shared}`;
      if (primary) return primary;
      if (secondary) return `sobre ${secondary}`;
      if (shared) return `no(s) filtro(s) ${shared}`;
      return 'seus filtros';
    };

    const _formatOutrosValues = (mapObj, keys, preferValues) => {
      const mapRef = mapObj instanceof Map ? mapObj : new Map();
      const vals = [];
      for (const k of (keys || [])) {
        const setVals = mapRef.get(k);
        if (!(setVals instanceof Set) || !setVals.size) continue;
        for (const v of setVals) {
          const txt = clean(v);
          if (txt && txt !== '[*]') vals.push(txt);
        }
      }
      const uniq = Array.from(new Set(vals));
      if (!preferValues || !uniq.length) return '';
      if (uniq.length === 1) return uniq[0];
      if (uniq.length === 2) return `${uniq[0]} e ${uniq[1]}`;
      return `${uniq.slice(0, -1).join(', ')} e ${uniq[uniq.length - 1]}`;
    };

    const _intersectScenarioMaps = (mapA, mapB, keys) => {
      const out = new Map();
      for (const k of (keys || [])) {
        const sa = mapA instanceof Map ? mapA.get(k) : null;
        const sb = mapB instanceof Map ? mapB.get(k) : null;
        if (!(sa instanceof Set) || !(sb instanceof Set)) continue;
        const inter = new Set();
        for (const v of sa) if (sb.has(v)) inter.add(v);
        if (inter.size) out.set(k, inter);
      }
      return out;
    };

    const _cloneMapOfSets = (src) => {
      const out = new Map();
      for (const [k, s] of (src || new Map()).entries()) out.set(k, new Set(Array.from(s || [])));
      return out;
    };

    const _mergeScenarioMaps = (baseMap, addMap) => {
      const out = _cloneMapOfSets(baseMap);
      for (const [k, valsAdd] of (addMap || new Map()).entries()) {
        if (!out.has(k)) {
          out.set(k, new Set(Array.from(valsAdd || [])));
          continue;
        }
        const valsBase = out.get(k) || new Set();
        const inter = new Set();
        for (const v of valsBase) if ((valsAdd || new Set()).has(v)) inter.add(v);
        if (!inter.size) return null;
        out.set(k, inter);
      }
      return out;
    };

    const _buildOutrosScenarioMaps = (rule) => {
      const groupsRaw = Array.isArray(rule?.outrosCriterios?.groups) ? rule.outrosCriterios.groups : [];
      const groups = groupsRaw
        .map(g => Array.isArray(g?.clauses) && g.clauses.length ? g.clauses : [])
        .filter(arr => arr.length);

      if (!groups.length) {
        const flatClauses = Array.isArray(rule?.outrosCriterios?.clauses) ? rule.outrosCriterios.clauses : [];
        if (!flatClauses.length) return [new Map()];
        return flatClauses.map(c => _clauseToMap(c)).filter(Boolean);
      }

      let scenarios = [new Map()];
      const MAX_SCENARIOS = 64;

      for (const groupClauses of groups) {
        const next = [];
        for (const scenario of scenarios) {
          for (const clause of groupClauses) {
            const merged = _mergeScenarioMaps(scenario, _clauseToMap(clause));
            if (merged) next.push(merged);
            if (next.length >= MAX_SCENARIOS) break;
          }
          if (next.length >= MAX_SCENARIOS) break;
        }
        scenarios = next.length ? next : [];
        if (!scenarios.length) break;
      }

      return scenarios.length ? scenarios : [new Map()];
    };

    const outrosOverlapInfo = (ruleA, ruleB) => {
      const scenariosA = _buildOutrosScenarioMaps(ruleA);
      const scenariosB = _buildOutrosScenarioMaps(ruleB);
      let best = null;
      const aggregate = {
        aRestritaPorContencao: false,
        bRestritaPorContencao: false,
        intersecaoHumana: false,
        equivalentes: false
      };

      for (const ma of scenariosA) {
        for (const mb of scenariosB) {
          let compatible = true;
          const sharedKeys = [];
          const aOnlyKeys = [];
          const bOnlyKeys = [];
          const aNarrowKeys = [];
          const bNarrowKeys = [];
          const allKeys = new Set([...ma.keys(), ...mb.keys()]);

          for (const k of allKeys) {
            const sa = ma.get(k) || null;
            const sb = mb.get(k) || null;
            if (sa && sb) {
              if (!_mapValuesIntersect(sa, sb)) {
                compatible = false;
                break;
              }
              sharedKeys.push(k);
              const aSubsetB = _setIsSubset(sa, sb);
              const bSubsetA = _setIsSubset(sb, sa);
              if (aSubsetB && !bSubsetA) aNarrowKeys.push(k);
              else if (bSubsetA && !aSubsetB) bNarrowKeys.push(k);
              continue;
            }
            if (sa) aOnlyKeys.push(k);
            else if (sb) bOnlyKeys.push(k);
          }
          const containsRel = _containsRelationInfo(ma, mb);
          if (containsRel.related) {
            const relKey = 'localizadorquecontenhatodos';
            if (!sharedKeys.includes(relKey)) sharedKeys.push(relKey);
            if (containsRel.aNarrow && !aNarrowKeys.includes(relKey)) aNarrowKeys.push(relKey);
            if (containsRel.bNarrow && !bNarrowKeys.includes(relKey)) bNarrowKeys.push(relKey);
            const aNoContains = _removeContainsOnlyFrom(aOnlyKeys);
            const bNoContains = _removeContainsOnlyFrom(bOnlyKeys);
            aOnlyKeys.length = 0;
            bOnlyKeys.length = 0;
            aOnlyKeys.push(...aNoContains);
            bOnlyKeys.push(...bNoContains);
          }
          if (compatible && _mapsHaveAntagonicContains(ma, mb)) compatible = false;
          if (compatible && _mapsHaveDifferentComplementConstraint(ma, mb)) compatible = false;

          if (!compatible) continue;

          const aSpecific = aOnlyKeys.length + aNarrowKeys.length;
          const bSpecific = bOnlyKeys.length + bNarrowKeys.length;
          if (aSpecific > 0 && bSpecific === 0) aggregate.aRestritaPorContencao = true;
          else if (bSpecific > 0 && aSpecific === 0) aggregate.bRestritaPorContencao = true;
          else if (aSpecific > 0 && bSpecific > 0) aggregate.intersecaoHumana = true;
          else aggregate.equivalentes = true;

          const score =
            (sharedKeys.length * 20) +
            (aOnlyKeys.length * 10) +
            (bOnlyKeys.length * 10) +
            (aNarrowKeys.length * 5) +
            (bNarrowKeys.length * 5);

          const current = {
            overlap: true,
            strong: true,
            sharedKeys,
            aOnlyKeys,
            bOnlyKeys,
            aNarrowKeys,
            bNarrowKeys,
            mapA: ma,
            mapB: mb,
            score
          };

          if (!best || current.score > best.score) best = current;
        }
      }

      if (best) return { ...best, aggregate };

      return {
        overlap: false,
        strong: false,
        sharedKeys: [],
        aOnlyKeys: [],
        bOnlyKeys: [],
        aNarrowKeys: [],
        bNarrowKeys: [],
        mapA: new Map(),
        mapB: new Map(),
        score: 0,
        aggregate
      };
    };
    const buildPriorityOverlapReason = (earlier, later, overlap) => {
      const earlierKeys = [
        ...(overlap?.aOnlyKeys || []),
        ...(overlap?.aNarrowKeys || [])
      ];
      const laterKeys = [
        ...(overlap?.bOnlyKeys || []),
        ...(overlap?.bNarrowKeys || [])
      ];
      return `${earlier.num}: Prioriza ${_pickPriorityFieldText(earlierKeys, laterKeys, overlap?.sharedKeys || [])}.`;
    };

    const buildCorrectPriorityReason = (earlier, later, overlap) => {
      const fields = _formatOutrosKeys([
        ...(overlap?.aOnlyKeys || []),
        ...(overlap?.aNarrowKeys || [])
      ]);
      if (fields) {
        return `Prioridade correta: regra ${earlier.num} mais restrita ocorre primeiramente que a regra ${later.num} mais abrangente em ${fields}.`;
      }
      return `Prioridade correta: regra ${earlier.num} mais restrita ocorre primeiramente que a regra ${later.num} mais abrangente.`;
    };

    const buildSimultaneousOverlapReason = (ruleA, ruleB, overlap) => {
      const sharedKeys = overlap?.sharedKeys || [];
      const sharedLabels = _formatOutrosKeys(sharedKeys);
      const interMap = _intersectScenarioMaps(overlap?.mapA, overlap?.mapB, sharedKeys);
      const sharedValues = _formatOutrosValues(interMap, sharedKeys, true);

      if (sharedValues && sharedLabels) {
        return `Processos com ${sharedLabels} ${sharedValues} serão abrangidos simultaneamente pelas regras ${ruleA.num} e ${ruleB.num}.`;
      }
      if (sharedValues) {
        return `Processos com ${sharedValues} serão abrangidos simultaneamente pelas regras ${ruleA.num} e ${ruleB.num}.`;
      }
      if (sharedLabels) {
        return `Processos no mesmo contexto de ${sharedLabels} serão abrangidos simultaneamente pelas regras ${ruleA.num} e ${ruleB.num}.`;
      }
      return `Há processos que podem ser abrangidos simultaneamente pelas regras ${ruleA.num} e ${ruleB.num}.`;
    };

    for (let i = 0; i < rules.length; i++) {
      const A = rules[i];
      for (let j = i + 1; j < rules.length; j++) {
        const B = rules[j];
        const AorigSet = getOrigemSet(A);
        const BorigSet = getOrigemSet(B);
        const origemAmbasVazias = (!AorigSet.size && !BorigSet.size);
        // Gate de origem disjunta: só descarta quando ambas têm origem e sem interseção.
        if (AorigSet.size && BorigSet.size && !hasAtomicOrigemIntersection(AorigSet, BorigSet)) continue;

        const removerEq = (getCanonRem(A) === getCanonRem(B));
        const remOverlap = hasIntersection(getRemSet(A), getRemSet(B));
        let tipoInfo = null;
        if (removerEq || remOverlap || origemAmbasVazias) {
          tipoInfo = tipoOverlapInfo(A, B);
        }
        const AtipoSet = getTipoSet(A);
        const BtipoSet = getTipoSet(B);
        const tipoAmbosEspecificos = AtipoSet.size > 0 && BtipoSet.size > 0;
        // Regra de negócio: sem gatilho específico nas duas regras, ou com gatilho disjunto,
        // não há conflito a considerar.
        if ((removerEq || remOverlap || origemAmbasVazias) && (!tipoAmbosEspecificos || !tipoInfo || !tipoInfo.overlap)) {
          continue;
        }
        if (removerEq) {
          const gatilhoEq = !!tipoInfo.equal;
          const incluirEq = (getCanonInc(A) === getCanonInc(B));
          const outrosEq = (getRelOutros(A, B) === 'identicos');

          if (gatilhoEq && incluirEq && outrosEq) {
            if (prioEq(A, B)) {
              const kd = pickKeepDropTotal(A, B);
              const sug = `Sugestão: Excluir a regra ${kd.drop.num}, mantendo a ${kd.keep.num}.`;
              upsert(A.num, B.num, 'Regra em Duplicidade', 'Alto', 'Prioridade, Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos. ' + sug);
              upsert(B.num, A.num, 'Regra em Duplicidade', 'Alto', 'Prioridade, Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos. ' + sug);
            } else {
              const kd = pickKeepDropParcial(A, B);
              const sug = `Sugestão: Excluir a regra ${kd.drop.num}, mantendo a ${kd.keep.num} (executa antes).`;
              upsert(A.num, B.num, 'Regra em Duplicidade', 'Médio', 'Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos; prioridades diferentes. ' + sug);
              upsert(B.num, A.num, 'Regra em Duplicidade', 'Médio', 'Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos; prioridades diferentes. ' + sug);
            }
          }
        }

        if ((remOverlap || origemAmbasVazias) && tipoInfo && tipoInfo.overlap) {

          const pa = prioNum(A);
          const pb = prioNum(B);
          const semPrioridadeAmbas = (pa == null) && (pb == null);
          const oa = (pa == null) ? Number.POSITIVE_INFINITY : pa;
          const ob = (pb == null) ? Number.POSITIVE_INFINITY : pb;

          const relAB = getRelOutros(A, B);
          const overlapAB = getOverlapOutros(A, B);
          // Poda cirúrgica: trata sobreposição de "Outros" como conflito quando
          // existe dimensão comum explícita OU interseção possível por composição
          // de filtros em dimensões diferentes (ex.: classe + tipoParteEntidade).
          const temDimensaoComumOutros =
            (Array.isArray(overlapAB?.sharedKeys) && overlapAB.sharedKeys.length > 0) ||
            (relAB === 'identicos') ||
            !!(overlapAB?.aggregate && overlapAB.aggregate.intersecaoHumana);

          if (oa === ob && overlapAB.overlap && (relAB === 'A_mais_ampla' || relAB === 'B_mais_ampla')) {
            const ampla = (relAB === 'A_mais_ampla') ? A : B;
            const rest  = (relAB === 'A_mais_ampla') ? B : A;
            const motivoSimultaneo = buildSimultaneousOverlapReason(rest, ampla, overlapAB);
            if (semPrioridadeAmbas) {
              const motivoSemPrio =
                `Mesmo Localizador REMOVER e Tipo de Controle / Critério com interseção; sem prioridade definida nas duas regras. ` +
                `${motivoSimultaneo} ` +
                `Há conflito real entre as regras ${rest.num} e ${ampla.num}; sem prioridade, não há definição de qual executa primeiro. ` +
                `Sugestão: Definir prioridade explícita entre as regras (ou ajustar "Outros Critérios" para não sobrepor).`;
              upsert(rest.num, ampla.num, 'Avaliar Prioridade', 'Baixo', motivoSemPrio);
              upsert(ampla.num, rest.num, 'Avaliar Prioridade', 'Baixo', motivoSemPrio);
            } else {
              upsert(rest.num, ampla.num, 'Avaliar Prioridade', 'Baixo',
                `Mesmo Localizador REMOVER e Tipo de Controle / Critério com interseção; prioridades equivalentes. ` +
                `${motivoSimultaneo} ` +
                `A regra ${ampla.num} é mais ampla em "Outros Critérios" e pode capturar processos da mais restrita. ` + `Sugestão: Definir a prioridade da regra ${rest.num} para executar antes da ${ampla.num} (ou ajustar "Outros Critérios" para não sobrepor).`);
            }
          }
          // Mesma prioridade e "Outros" diferentes, porém compatíveis por contexto → possível sobreposição
          if (oa === ob && relAB === 'diferentes' && overlapAB.overlap && temDimensaoComumOutros) {
            const motivo = `Mesmo Localizador REMOVER e Tipo de Controle / Critério com interseção; prioridades equivalentes; ${buildSimultaneousOverlapReason(A, B, overlapAB)}`;
            upsert(A.num, B.num, 'Avaliar Prioridade', 'Baixo', motivo);
            upsert(B.num, A.num, 'Avaliar Prioridade', 'Baixo', motivo);
          }

          if (oa !== ob && overlapAB.overlap) {
            const earlier = (oa < ob) ? A : B;
            const later   = (oa < ob) ? B : A;
            const overlapEL = (oa < ob) ? overlapAB : {
              ...overlapAB,
              aOnlyKeys: overlapAB.bOnlyKeys,
              bOnlyKeys: overlapAB.aOnlyKeys,
              aNarrowKeys: overlapAB.bNarrowKeys,
              bNarrowKeys: overlapAB.aNarrowKeys,
              mapA: overlapAB.mapB,
              mapB: overlapAB.mapA
            };
            const aggAB = overlapAB.aggregate || {};
            const aggEL = (oa < ob)
              ? {
                  aRestritaPorContencao: !!aggAB.aRestritaPorContencao,
                  bRestritaPorContencao: !!aggAB.bRestritaPorContencao,
                  intersecaoHumana: !!aggAB.intersecaoHumana,
                  equivalentes: !!aggAB.equivalentes
                }
              : {
                  aRestritaPorContencao: !!aggAB.bRestritaPorContencao,
                  bRestritaPorContencao: !!aggAB.aRestritaPorContencao,
                  intersecaoHumana: !!aggAB.intersecaoHumana,
                  equivalentes: !!aggAB.equivalentes
                };
            const tipoEL = (oa < ob)
              ? tipoInfo
              : {
                  overlap: !!tipoInfo.overlap,
                  equal: !!tipoInfo.equal,
                  aSpecific: Number(tipoInfo.bSpecific || 0),
                  bSpecific: Number(tipoInfo.aSpecific || 0),
                  intersecaoHumana: !!tipoInfo.intersecaoHumana,
                  aRestritaPorContencao: !!tipoInfo.bRestritaPorContencao,
                  bRestritaPorContencao: !!tipoInfo.aRestritaPorContencao,
                  equivalentes: !!tipoInfo.equivalentes
                };
            const scenarioEarlierSpecific = ((overlapEL.aOnlyKeys || []).length + (overlapEL.aNarrowKeys || []).length) > 0;
            const scenarioLaterSpecific = ((overlapEL.bOnlyKeys || []).length + (overlapEL.bNarrowKeys || []).length) > 0;
            const scenarioCamposDiferentes = (overlapEL.aOnlyKeys || []).length > 0 && (overlapEL.bOnlyKeys || []).length > 0;
            const earlierSpecificAny = !!aggEL.aRestritaPorContencao || !!aggEL.intersecaoHumana || (Number(tipoEL.aSpecific || 0) > 0);
            const laterSpecificAny = !!aggEL.bRestritaPorContencao || !!aggEL.intersecaoHumana || (Number(tipoEL.bSpecific || 0) > 0);
            const hasIntersecaoComDecisaoHumana = (!!aggEL.intersecaoHumana || !!tipoEL.intersecaoHumana) || (earlierSpecificAny && laterSpecificAny) || (scenarioEarlierSpecific && scenarioLaterSpecific) || scenarioCamposDiferentes;
            const earlierMaisRestritaPorContencao = !hasIntersecaoComDecisaoHumana && ((!!aggEL.aRestritaPorContencao || !!tipoEL.aRestritaPorContencao) && !(!!aggEL.bRestritaPorContencao || !!tipoEL.bRestritaPorContencao));
            const earlierMaisAmplaPorContencao = !hasIntersecaoComDecisaoHumana && ((!!aggEL.bRestritaPorContencao || !!tipoEL.bRestritaPorContencao) && !(!!aggEL.aRestritaPorContencao || !!tipoEL.aRestritaPorContencao));
            const intersecaoPorCamposDiferentes = relAB === 'diferentes';

            if (earlierMaisRestritaPorContencao) {
              const motivoCorreto = buildCorrectPriorityReason(earlier, later, overlapEL);
              upsert(later.num, earlier.num, 'Prioridade Correta', 'Baixo', motivoCorreto);
              upsert(earlier.num, later.num, 'Prioridade Correta', 'Baixo', motivoCorreto);
            } else {
              const motivoCurto = buildPriorityOverlapReason(earlier, later, overlapEL);
              if (earlierMaisAmplaPorContencao && !intersecaoPorCamposDiferentes) {
                const tipoLE = {
                  overlap: !!tipoEL.overlap,
                  equal: !!tipoEL.equal,
                  aSpecific: Number(tipoEL.bSpecific || 0),
                  bSpecific: Number(tipoEL.aSpecific || 0),
                  intersecaoHumana: !!tipoEL.intersecaoHumana
                };
                const overlapLE = {
                  overlap: !!overlapEL.overlap,
                  aOnlyKeys: overlapEL.bOnlyKeys || [],
                  bOnlyKeys: overlapEL.aOnlyKeys || [],
                  aNarrowKeys: overlapEL.bNarrowKeys || [],
                  bNarrowKeys: overlapEL.aNarrowKeys || []
                };
                const contencaoTotal = isTotalContainment(later, earlier, tipoLE, overlapLE);
                if (contencaoTotal) {
                  const motivo = `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; prioridades diferentes. Prioridade Invertida: a regra mais ampla está executando antes da mais restrita. ${motivoCurto}`;
                  upsert(later.num, earlier.num, 'Prioridade Invertida', 'Médio', motivo);
                  upsert(earlier.num, later.num, 'Prioridade Invertida', 'Médio', motivo);
                } else {
                  const motivo = `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; prioridades diferentes. Avaliar Prioridade: contenção parcial/ambígua (sem contenção total). ${motivoCurto}`;
                  upsert(later.num, earlier.num, 'Avaliar Prioridade', 'Baixo', motivo);
                  upsert(earlier.num, later.num, 'Avaliar Prioridade', 'Baixo', motivo);
                }
              } else {
                if (!temDimensaoComumOutros) {
                  continue;
                }
                const motivo = hasIntersecaoComDecisaoHumana
                  ? `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; prioridades diferentes. Avaliar Prioridade: ${motivoCurto}`
                  : `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; prioridades diferentes. Avaliar Prioridade aplicada entre regras equivalentes em "Outros Critérios". ${motivoCurto}`;
                upsert(later.num, earlier.num, 'Avaliar Prioridade', 'Baixo', motivo);
                upsert(earlier.num, later.num, 'Avaliar Prioridade', 'Baixo', motivoCurto);
              }
            }
          }
        }

        const Arem = getRemSet(A);
        const Ainc = getIncSet(A);
        const Brem = getRemSet(B);
        const Binc = getIncSet(B);

        // Regra de negócio (ajuste 2026-04): sem REMOVER exato não classifica
        // como Avaliar Prioridade/Prioridade Invertida/Prioridade Correta.

if (typeof ATP_CONFIG === 'undefined' || ATP_CONFIG?.analisarPerdaObjetoCondicional !== false) {
        try {

          const evalPerdaObjetoCondicional = (earlier, later) => {
            if (!prioExecutaAntesPOC(earlier, later)) return;

            const tipoEqPOC = (getCanonTipo(earlier) === getCanonTipo(later));
            if (!tipoEqPOC) return;

            const relEL = getRelOutros(earlier, later);
            const earlierCobreLater = (relEL === 'identicos' || relEL === 'A_mais_ampla');
            if (!earlierCobreLater) return;

            const behPOC = normMsg(exprCanon(earlier.comportamentoRemover, ''));
            if (behPOC !== MSG_PERDA_OBJETO) return;
            // Para POC, a regra anterior só pode ser localizador simples ou ramos por OU.
            if (removerTemAndNoMesmoRamo(earlier)) return;

            const earlierRem = getRemSet(earlier);
            const laterRem = getRemSet(later);
            if (!hasIntersection(earlierRem, laterRem)) return;

            const clausesLater = Array.isArray(later.localizadorRemover?.clauses) ? later.localizadorRemover.clauses : [];
            let registeredPOC = false;

            for (const clause of clausesLater) {
              if (registeredPOC) break;
              if (!(clause instanceof Set)) continue;

              const terms = Array.from(clause)
                .map(clean)
                .filter(x => x && x !== '[*]' && x !== 'E' && x !== 'OU');

              // Perda condicional: regra posterior depende de combinação AND (X E Y ...).
              if (terms.length < 2) continue;

              for (const x of terms) {
                if (!earlierRem.has(x)) continue;

                const y = terms.find(t => t !== x) || null;
                if (!y) continue;

                const detalheOutros = (relEL === 'identicos')
                  ? 'Outros idênticos'
                  : 'Regra anterior é mais ampla em "Outros Critérios"';
                const pEarlier = prioLabel(earlier);
                const pLater = prioLabel(later);
                const sugPOC =
                  `Sugestão: Ajustar a regra ${earlier.num} para não remover "${x}" neste cenário, ` +
                  `ou definir a prioridade da regra ${later.num} (${pLater}) para executar antes da regra ${earlier.num} (${pEarlier}).`;

                upsert(later.num, earlier.num, 'Prioridade Invertida', 'Alto',
                  `Mesmo Tipo de Controle / Critério; ${detalheOutros}. ` +
                  `Regra ${earlier.num} (prioridade ${pEarlier}) executa antes da regra ${later.num} (prioridade ${pLater}) ` +
                  `e remove "${x}" do Localizador REMOVER, enquanto a regra ${later.num} exige "${x}" E "${y}" (AND). ` +
                  `Isso pode impedir o disparo da regra ${later.num} em parte dos casos. ` + sugPOC);

                registeredPOC = true;
                break;
              }
            }
          };

          const aAntes = prioExecutaAntesPOC(A, B);
          const bAntes = prioExecutaAntesPOC(B, A);
          if (aAntes) evalPerdaObjetoCondicional(A, B);
          else if (bAntes) evalPerdaObjetoCondicional(B, A);
        } catch (e) {}
        }

    if (ATP_CONFIG.analisarLooping) {

      if (hasIntersection(Arem, Binc) && hasIntersection(Brem, Ainc)) {
        upsert(A.num, B.num, 'Potencial Looping', 'Alto', 'A remove algo que B inclui e B remove algo que A inclui. Testar possibilidades.');
        upsert(B.num, A.num, 'Potencial Looping', 'Alto', 'A remove algo que B inclui e B remove algo que A inclui. Testar possibilidades.');
      }
    }
      }
    }

    for (const r of (rules || [])) {
      try {
        const motivos = detectContradictions(r);
        if (motivos && motivos.length) {
          const sugest = 'Sugestão: Em “Outros Critérios”, remova seleções mutuamente exclusivas do mesmo campo (ex.: COM e SEM; APENAS UMA e MAIS DE UMA; estados diferentes do mesmo Dado Complementar). Se a intenção for abranger alternativas, separe em regras distintas ou use conector OU quando disponível.';
          upsert(r.num, -1, 'Filtros Conflitantes', 'Alto', motivos.join(' | ') + '\n' + sugest + ' Testar possibilidades.');
        }
      } catch (e) {}
    }

    if (typeof ATP_CONFIG === 'undefined' || ATP_CONFIG?.analisarQuebraFluxo !== false) {
      for (const r of (rules || [])) {
        try {
          const acoesAll = (r?.localizadorIncluirAcao && Array.isArray(r.localizadorIncluirAcao.acoes))
            ? r.localizadorIncluirAcao.acoes : [];

          const normKey = (s) => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

          const acoes = acoesAll.filter(a => {
            const nome = normKey(a?.acao || '');
            if (!nome) return false;
            return true;
          });

          const remSet = getRemSet(r);
          const incSet = getIncSet(r);

          const remClauses = getRemClauses(r);
          const remIsOr = remClauses.length > 1;

          const incHas = incSet.size > 0;

          const matchAnyRemBranch = (() => {
            if (!remIsOr || !incHas) return false;

            for (const clause of remClauses) {
              if (!(clause instanceof Set)) continue;
              const branch = new Set();
              for (const t of clause) {
                const tt = clean(t);
                if (!tt) continue;
                if (tt === '[*]' || tt === 'E' || tt === 'OU') continue;
                branch.add(tt);
              }
              if (branch.size && setsEqual(branch, incSet)) return true;
            }
            return false;
          })();

          if (incHas && (setsEqual(remSet, incSet) || matchAnyRemBranch)) {

            const titulos = [...new Set(acoes.map(a => clean(a?.acao || '')).filter(Boolean))];
            const resumoAcoes = titulos.length
              ? (titulos.slice(0, 4).join(' | ') + (titulos.length > 4 ? ' | …' : ''))
              : '(ação programada)';

            const ehTempo = gatilhoEhTempo(r);
            if (acoes.length && !ehTempo) {
              const obs = 'A regra executa ação programada e permanece no mesmo localizador (INCLUIR == REMOVER).';
              const sug = 'Sugestão: para gatilho de evento/petição/documento, manter assim pode ser intencional (apoio operacional) se não houver reexecução indevida.';
              upsert(r.num, -1, 'Avaliar Troca de Localizadores', 'Baixo',
                `${obs} Ações: ${resumoAcoes}. ${sug}`);
            } else {
              const sug = ehTempo
                ? 'Sugestão: para gatilho temporal, defina um Localizador INCLUIR diferente do REMOVER (próximo passo do fluxo), evitando reexecução recorrente.'
                : 'Sugestão: defina um Localizador INCLUIR diferente do REMOVER; sem ação programada relevante, manter no mesmo localizador não agrega avanço operacional.';
              const detalhe = ehTempo
                ? 'Com gatilho temporal, manter INCLUIR == REMOVER tende a reexecutar no ciclo seguinte (diário/periódico).'
                : 'Sem ação programada relevante, manter INCLUIR == REMOVER tende a permanência sem avanço.';
              upsert(r.num, -1, 'Regra sem Finalidade', 'Alto',
                `${detalhe}\n${sug}`);
            }
          }
        } catch (e) {}
      }
    }
    try { atpApplyReviewedPrioritySuppressions(rules, conflictsByRule); } catch (_) {}
    return conflictsByRule;
  }

  function severity(rec) {
    if (!rec?.tipos?.size) return 0;
    const imp = rec.impactoMax || 'Médio';
    const impScore = impactoRank[imp] || 1;
    let max = 0;
    for (const t of rec.tipos) max = Math.max(max, (tipoRank[t] || 0) * impScore);
    if (max <= 3) return 2;
    if (max <= 6) return 3;
    if (max <= 10) return 4;
    return 5;
  }

function tipoClass(t) {
  return ({
    'Regra em Duplicidade': 'clone',
    'Avaliar Prioridade': 'prioridade-indefinida',
    'Prioridade Invertida': 'prioridade-invertida',
    'Prioridade Correta': 'prioridade-correta',
    'Filtros Conflitantes': 'contradicao',
    'Regra sem Finalidade': 'quebra-fluxo',
    'Avaliar Troca de Localizadores': 'acao-sem-avanco',
    'Potencial Looping': 'loop',
    'Looping': 'loop'
  }[t] || '');
}

function setNumeroRegraAndSearch(nums) {
    try {
      const txt = document.getElementById('txtNumeroRegra');
      const btn = document.getElementById('sbmPesquisar');
      if (txt) {
        txt.value = nums.join(';');
        txt.dispatchEvent(new Event('input', { bubbles: true }));
        txt.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setTimeout(() => {
        if (btn) btn.click();
        else if (typeof window.enviarFormularioAutomatizacao === 'function') window.enviarFormularioAutomatizacao();
      }, 100);
    } catch (_) {  }
  }

function makeCompareButton(ruleNum, confTd) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'atp-compare-btn infraButton';
    btn.textContent = 'Comparar';
    btn.addEventListener('click', () => {
      const others = (confTd.dataset.atpConfNums || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const all = Array.from(new Set([...others, String(ruleNum)]))
        .sort((a, b) => Number(a) - Number(b));
      setNumeroRegraAndSearch(all);
    });
    return btn;
  }

function atpEnsurePriorityReviewClickHandler() {
    if (window.__ATP_PRIO_REVIEW_BOUND__) return;
    window.__ATP_PRIO_REVIEW_BOUND__ = true;
    document.addEventListener('click', (ev) => {
      const target = ev && ev.target instanceof Element ? ev.target : null;
      const btn = target ? target.closest('[data-atp-prio-review=\"1\"]') : null;
      if (!btn) return;
      const pairKey = btn.getAttribute('data-atp-pair') || '';
      if (!pairKey) return;
      try { ev.preventDefault(); } catch (_) {}
      try { ev.stopPropagation(); } catch (_) {}
      atpToggleReviewedPriorityPair(pairKey);
      try {
        const tb = (typeof findTable === 'function') ? findTable() : null;
        if (tb && typeof atpQueueRecalc === 'function') atpQueueRecalc(tb, 0);
      } catch (_) {}
    }, true);
  }

function atpGetStorageScopeLabel() {
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
    return (
      orgaoSelecionado ||
      pick('#spnInfraUnidade') ||
      pick('#spnInfraDescricaoUnidade') ||
      pick('.infraNomeUnidade') ||
      ''
    );
  }

function atpSigNum(sig) {
    try {
      const s = String(sig || '');
      const first = s.split('||')[0] || '';
      return clean(first);
    } catch (_) { return ''; }
  }

function atpListReviewedPairs() {
    const map = atpLoadJsonLocal(ATP_PRIO_REVIEWED_PAIRS_KEY, {});
    const keys = Object.keys(map || {});
    const items = [];
    keys.forEach((k) => {
      const sp = String(k || '').split('##');
      if (sp.length !== 2) return;
      const aSig = sp[0], bSig = sp[1];
      const a = atpSigNum(aSig);
      const b = atpSigNum(bSig);
      if (!a || !b) return;
      items.push({ pairKey: k, a, b });
    });
    items.sort((x, y) => (Number(x.a) - Number(y.a)) || (Number(x.b) - Number(y.b)) || String(x.pairKey).localeCompare(String(y.pairKey)));
    return items;
  }

function atpDeleteReviewedPair(pairKey) {
    const map = atpLoadJsonLocal(ATP_PRIO_REVIEWED_PAIRS_KEY, {});
    const k = String(pairKey || '').trim();
    if (!k) return;
    delete map[k];
    atpSaveJsonLocal(ATP_PRIO_REVIEWED_PAIRS_KEY, map);
  }

function atpClearReviewedPairs() {
    atpSaveJsonLocal(ATP_PRIO_REVIEWED_PAIRS_KEY, {});
  }

function atpEnsureReviewManagerModal() {
    let overlay = document.getElementById('atpReviewManagerOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'atpReviewManagerOverlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(15, 23, 42, 0.45)';
    overlay.style.zIndex = '2147483647';
    overlay.style.display = 'none';

    const panel = document.createElement('div');
    panel.id = 'atpReviewManagerPanel';
    panel.style.position = 'absolute';
    panel.style.top = '50%';
    panel.style.left = '50%';
    panel.style.transform = 'translate(-50%, -50%)';
    panel.style.width = 'min(980px, 92vw)';
    panel.style.maxHeight = 'min(78vh, 740px)';
    panel.style.overflow = 'auto';
    panel.style.background = '#fff';
    panel.style.border = '1px solid #cbd5e1';
    panel.style.borderRadius = '10px';
    panel.style.boxShadow = '0 12px 40px rgba(0,0,0,0.25)';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.gap = '10px';
    header.style.padding = '10px 12px';
    header.style.borderBottom = '1px solid #e2e8f0';

    const title = document.createElement('div');
    title.id = 'atpReviewManagerTitle';
    title.style.fontWeight = '700';
    title.style.color = '#0f172a';
    title.textContent = 'Revisões (Prioridade Indefinida)';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'infraButton';
    btnClose.textContent = 'Fechar';
    btnClose.addEventListener('click', () => { overlay.style.display = 'none'; });

    header.appendChild(title);
    header.appendChild(btnClose);

    const body = document.createElement('div');
    body.id = 'atpReviewManagerBody';
    body.style.padding = '12px';

    panel.appendChild(header);
    panel.appendChild(body);
    overlay.appendChild(panel);

    overlay.addEventListener('click', (e) => {
      if (e && e.target === overlay) overlay.style.display = 'none';
    });

    document.body.appendChild(overlay);
    return overlay;
  }

function atpRenderReviewManagerModal() {
    const overlay = document.getElementById('atpReviewManagerOverlay');
    const body = document.getElementById('atpReviewManagerBody');
    const title = document.getElementById('atpReviewManagerTitle');
    if (!overlay || !body) return;

    const scopeLabel = atpGetStorageScopeLabel();
    if (title) title.textContent = scopeLabel ? `Revisões (Prioridade Indefinida) — ${scopeLabel}` : 'Revisões (Prioridade Indefinida)';

    body.textContent = '';

    const reviewed = atpListReviewedPairs();

    const mkSectionTitle = (txt) => {
      const el = document.createElement('div');
      el.style.fontWeight = '700';
      el.style.color = '#0f172a';
      el.style.margin = '0 0 6px 0';
      el.textContent = txt;
      return el;
    };
    const mkMuted = (txt) => {
      const el = document.createElement('div');
      el.style.color = '#64748b';
      el.style.fontSize = '12px';
      el.textContent = txt;
      return el;
    };
    const mkRow = () => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '10px';
      row.style.padding = '6px 0';
      row.style.borderBottom = '1px dashed #e2e8f0';
      return row;
    };

    const topBar = document.createElement('div');
    topBar.style.display = 'flex';
    topBar.style.gap = '8px';
    topBar.style.flexWrap = 'wrap';
    topBar.style.marginBottom = '10px';
    const btnClearReviewed = document.createElement('button');
    btnClearReviewed.type = 'button';
    btnClearReviewed.className = 'infraButton';
    btnClearReviewed.textContent = 'Limpar OK desta unidade';
    btnClearReviewed.addEventListener('click', () => {
      if (!confirm('Limpar todas as revisões (OK) desta unidade?')) return;
      atpClearReviewedPairs();
      atpRenderReviewManagerModal();
      try {
        const tb = (typeof findTable === 'function') ? findTable() : null;
        if (tb && typeof atpQueueRecalc === 'function') atpQueueRecalc(tb, 0);
      } catch (_) {}
    });
    topBar.appendChild(btnClearReviewed);
    body.appendChild(topBar);

    const secReviewed = document.createElement('div');
    secReviewed.style.border = '1px solid #e2e8f0';
    secReviewed.style.borderRadius = '8px';
    secReviewed.style.padding = '10px';
    secReviewed.style.marginBottom = '10px';
    secReviewed.appendChild(mkSectionTitle(`OK (revisados): ${reviewed.length}`));
    secReviewed.appendChild(mkMuted('Clique em "Desfazer" para voltar a exibir "Avaliar Prioridade" para o par.'));
    if (!reviewed.length) {
      secReviewed.appendChild(mkMuted('Nenhum par marcado como OK nesta unidade.'));
    } else {
      reviewed.forEach((it) => {
        const row = mkRow();
        const left = document.createElement('div');
        left.textContent = `Regra ${it.a} x Regra ${it.b}`;
        const btnUndo = document.createElement('button');
        btnUndo.type = 'button';
        btnUndo.className = 'infraButton';
        btnUndo.textContent = 'Desfazer';
        btnUndo.addEventListener('click', () => {
          atpDeleteReviewedPair(it.pairKey);
          atpRenderReviewManagerModal();
          try {
            const tb = (typeof findTable === 'function') ? findTable() : null;
            if (tb && typeof atpQueueRecalc === 'function') atpQueueRecalc(tb, 0);
          } catch (_) {}
        });
        row.appendChild(left);
        row.appendChild(btnUndo);
        secReviewed.appendChild(row);
      });
    }
    body.appendChild(secReviewed);
  }

function atpOpenPriorityReviewManager() {
    const overlay = atpEnsureReviewManagerModal();
    atpRenderReviewManagerModal();
    overlay.style.display = 'block';
  }

try { window.atpOpenPriorityReviewManager = atpOpenPriorityReviewManager; } catch (_) {}

function applyFilter(table) {
    const bodies = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector('tbody')].filter(Boolean);
    const rows = bodies.flatMap(tb => Array.from(tb.rows));
    rows.forEach(tr => {
      const filtroCategorias = (window && window.atpFiltroCategorias) ? window.atpFiltroCategorias : null;
      const apenasAtencao = !!window.onlyPossibleConflicts;
      const apenasCriticos = !!onlyConflicts;
      if (filtroCategorias && typeof filtroCategorias === 'object') {
        const filtrarCritico = !!filtroCategorias.critico;
        const filtrarAtencao = !!filtroCategorias.atencao;
        const temFiltroCategoria = filtrarCritico || filtrarAtencao;
        if (!temFiltroCategoria) {
          tr.style.display = 'none';
          return;
        }
        const mostrarCritico = filtrarCritico && tr.dataset.atpHasConflict === '1';
        const mostrarAtencao = filtrarAtencao && tr.dataset.atpHasPossible === '1';
        tr.style.display = (mostrarCritico || mostrarAtencao) ? '' : 'none';
        return;
      }
      if (!apenasCriticos && !apenasAtencao) { tr.style.display = ''; return; }
      const mostrarCriticos = apenasCriticos && tr.dataset.atpHasConflict === '1';
      const mostrarAtencao = apenasAtencao && tr.dataset.atpHasPossible === '1';
      tr.style.display = (mostrarCriticos || mostrarAtencao) ? '' : 'none';
    });
  }

function render(table, rules, conflictsByRule) {
    const cols = mapColumns(table);
    const ruleByNum = new Map((rules || []).map(r => [String(r.num), r]));
    const reviewedPairs = atpLoadJsonLocal(ATP_PRIO_REVIEWED_PAIRS_KEY, {});
    const bodies = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector('tbody')].filter(Boolean);
    const rows = bodies.flatMap(tb => Array.from(tb.rows));
    const rowByNum = new Map();

    rows.forEach(tr => {
      const tds = tr.querySelectorAll(':scope > td');
      const num = extrairNumeroRegra(tds[cols.colNumPrior]);
      if (num) rowByNum.set(num, tr);
    });

    for (const r of rules) {
      const tr = rowByNum.get(r.num);
      if (!tr) continue;
      let confTd = tr.querySelector('td[data-atp-col="conflita"]');
      if (!confTd) {
        confTd = document.createElement('td');
        confTd.dataset.atpCol = 'conflita';
        confTd.textContent = '';
        const tds = Array.from(tr.querySelectorAll(':scope > td'));
        const tdAcoes = tds.find(td => td.querySelector('i.material-icons, .material-icons, .custom-switch, input.custom-control-input')) || null;
        if (tdAcoes && tdAcoes.parentNode === tr) tr.insertBefore(confTd, tdAcoes);
        else tr.appendChild(confTd);
      }
      if (!confTd) continue;
      const adj = conflictsByRule.get(r.num);

      if (adj && adj.size) {
        for (const [otherNum, rec0] of adj.entries()) {
          const otherRule = ruleByNum.get(String(otherNum));
          const rec = Object.assign({ iNum: String(r.num), jNum: String(otherNum) }, rec0);
          if (typeof logConflictRead === "function") logConflictRead(r, otherRule, rec);
        }
      }
      let html = '';
      let maxSev = 0;

      if (adj && adj.size) {
        const conjuntoCritico = new Set(['Regra em Duplicidade', 'Prioridade Invertida', 'Filtros Conflitantes', 'Regra sem Finalidade', 'Potencial Looping']);
        const conjuntoAtencao = new Set(['Avaliar Prioridade', 'Avaliar Troca de Localizadores']);
        const conjuntoInformativo = new Set(['Prioridade Correta']);
        const prioridadeLinha = (num) => {
          const rec = adj.get(num);
          const tipos = Array.from(rec?.tipos || []);
          if (tipos.some(t => conjuntoCritico.has(t))) return 300;
          if (tipos.includes('Regra em Duplicidade')) return 280;
          if (tipos.includes('Avaliar Prioridade')) return 220;
          if (tipos.some(t => conjuntoAtencao.has(t))) return 200;
          if (tipos.some(t => conjuntoInformativo.has(t))) return 100;
          return 90;
        };
        const others = [...adj.keys()].sort((a, b) => {
          const pa = prioridadeLinha(a);
          const pb = prioridadeLinha(b);
          if (pa !== pb) return pb - pa;
          const na = Number(a), nb = Number(b);
          const fa = Number.isFinite(na), fb = Number.isFinite(nb);
          if (fa && fb) return na - nb;
          if (fa && !fb) return -1;
          if (!fa && fb) return 1;
          return String(a).localeCompare(String(b));
        });

        const compNums = others
          .map(x => Number(x))
          .filter(n => Number.isFinite(n) && n > 0)
          .sort((a, b) => a - b);

        if (compNums.length) confTd.dataset.atpConfNums = compNums.join(',');
        else delete confTd.dataset.atpConfNums;

        let temLinhaCritica = false;
        let temLinhaAtencao = false;
        const maxVisiblePossibleRows = 8;
        let possibleVisible = 0;
        let possibleHidden = 0;
for (const n of others) {
          const rec = adj.get(n);
          const tiposAll = Array.from(rec.tipos || []).filter((t) => !conjuntoInformativo.has(t));
          if (!tiposAll.length) continue;
          const regraTemCritico = tiposAll.some(t => conjuntoCritico.has(t));
          const regraTemAtencao = tiposAll.some(t => conjuntoAtencao.has(t));
          if (regraTemCritico) temLinhaCritica = true;
          else if (regraTemAtencao) temLinhaAtencao = true;
          const prioridadeVisualTipo = (t) => {
            if (t === 'Regra em Duplicidade') return 3;
            if (t === 'Avaliar Prioridade') return 2;
            return 0;
          };
          const tipos = tiposAll.sort((a, b) => {
            const pa = prioridadeVisualTipo(a);
            const pb = prioridadeVisualTipo(b);
            if (pa !== pb) return pb - pa;
            return (tipoRank[b] || 0) - (tipoRank[a] || 0);
          });
          const impacto = rec.impactoMax || 'Médio';
          const spans = tipos.map(tipo => {
            const set = rec.motivosByTipo?.get?.(tipo);
            const motivo = (set && set.size) ? Array.from(set).join(' | ') : '';
            const tip = motivo ? `${tipo} (${impacto}) — ${motivo}` : `${tipo} (${impacto})`;
            const ehAtencao = conjuntoAtencao.has(tipo);
            const infoAttr = ehAtencao ? ' data-atp-info="1"' : '';
            return `<span class="atp-conf-tipo ${esc(tipoClass(tipo))}" data-atp-tipo="${esc(tipo)}" data-atp-impacto="${esc(impacto)}" data-atp-porque="${esc(motivo)}"${infoAttr}>${esc(tipo)}</span>`;
          }).join(' ');
          let reviewBtn = '';
          if (tiposAll.includes('Avaliar Prioridade') && Number(n) > 0) {
            const otherRule = ruleByNum.get(String(n));
            if (r?.sig && otherRule?.sig && !atpIsReviewedPriorityPair(r.sig, otherRule.sig, reviewedPairs)) {
              const pk = atpReviewedPairKey(r.sig, otherRule.sig);
              reviewBtn = ` <button type="button" class="infraButton" data-atp-prio-review="1" data-atp-pair="${esc(pk)}" style="margin-left:6px;font-size:11px;padding:0 6px;line-height:18px;height:18px" title="Marcar como revisado (não exibir 'Avaliar Prioridade')">OK</button>`;
            }
          }
          const nLabel = (Number(n) < 0) ? '(Própria Regra)' : esc(n);
          const apenasAtencao = tiposAll.length > 0
            && !tiposAll.some(t => conjuntoCritico.has(t))
            && tiposAll.some(t => conjuntoAtencao.has(t))
            && tiposAll.every(t => conjuntoAtencao.has(t));
          const detalhesTooltip = tipos.map((tipo) => {
            const set = rec.motivosByTipo?.get?.(tipo);
            const motivo = (set && set.size) ? Array.from(set).join(' | ') : '';
            return motivo ? `${tipo}: ${motivo}` : `${tipo}`;
          });
          const tooltipLinhaConflito = `Conflito com Regra ${nLabel} | Impacto: ${impacto} | ${detalhesTooltip.join(' | ')}`;
          let rowStyle = '';
          if (apenasAtencao) {
            if (possibleVisible >= maxVisiblePossibleRows) {
              rowStyle = ' style="display:none" data-atp-collapsed="1"';
              possibleHidden += 1;
            } else {
              possibleVisible += 1;
            }
          }
          html += `<div${rowStyle} title="${esc(tooltipLinhaConflito)}" data-atp-conf-linha="1"><span class="atp-conf-num">${nLabel}:</span> ${spans}${reviewBtn}</div>`;
          maxSev = Math.max(maxSev, severity(rec));
        }
        if (possibleHidden > 0) {
          html += `<div style="color:#64748b;font-size:11px">+${possibleHidden} relações de revisão ocultas (use "Comparar" para detalhar)</div>`;
        }

        if (temLinhaCritica) tr.dataset.atpHasConflict = '1'; else delete tr.dataset.atpHasConflict;
        if (temLinhaAtencao) tr.dataset.atpHasPossible = '1'; else delete tr.dataset.atpHasPossible;
      } else {
        delete tr.dataset.atpHasConflict;
        delete tr.dataset.atpHasPossible;
        delete confTd.dataset.atpConfNums;
      }

      ATP_SUPPRESS_OBSERVER = true;
      try {
        const prev = confTd.dataset.atpRenderedHtml || '';
        if (prev !== html) {
          confTd.innerHTML = html;
          confTd.dataset.atpRenderedHtml = html;
        }
      } finally {

        setTimeout(() => { ATP_SUPPRESS_OBSERVER = false; }, 0);
      }
      bindTipoConflitoTooltips(confTd);
      confTd.querySelectorAll(':scope > .atp-compare-btn').forEach((el) => el.remove());
      if (confTd.dataset.atpConfNums) confTd.appendChild(makeCompareButton(r.num, confTd));

      tr.classList.remove('atp-sev-2', 'atp-sev-3', 'atp-sev-4', 'atp-sev-5');
      if (maxSev >= 2) tr.classList.add(`atp-sev-${maxSev}`);
    }

    applyFilter(table);
    try { atpEnsurePriorityReviewClickHandler(); } catch (_) {}
    try {
      const overlay = document.getElementById('atpReviewManagerOverlay');
      if (overlay && overlay.style && overlay.style.display !== 'none') atpRenderReviewManagerModal();
    } catch (_) {}

    try { markATPRenderTick(); } catch (e) {}
}

function atpClauseKey(setOrArr) {
  const arr = Array.isArray(setOrArr) ? setOrArr : Array.from(setOrArr || []);
  return arr.map(x => clean(String(x))).filter(Boolean).sort((a,b)=>a.localeCompare(b)).join(' && ');
}
function atpClausesToKeys(expr) {
  const clauses = expr && Array.isArray(expr.clauses) ? expr.clauses : [];
  const keys = [];
  for (const c of clauses) {
    const k = atpClauseKey(c);
    if (k) keys.push(k);
  }
  return Array.from(new Set(keys));
}

function atpTarjanSCC(nodes, edgesMap) {

  let index = 0;
  const stack = [];
  const onStack = new Set();
  const idx = new Map();
  const low = new Map();
  const comps = [];

  function strongconnect(v) {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v); onStack.add(v);

    const outs = edgesMap.get(v) || [];
    for (const w of outs) {
      if (!idx.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), idx.get(w)));
      }
    }

    if (low.get(v) === idx.get(v)) {
      const comp = [];
      while (true) {
        const w = stack.pop();
        onStack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      comps.push(comp);
    }
  }

  for (const v of nodes) {
    if (!idx.has(v)) strongconnect(v);
  }
  return comps;
}

try { console.log('[ATP][OK] 06-analisador-de-colisoes.js inicializado'); } catch (e) {}
;
