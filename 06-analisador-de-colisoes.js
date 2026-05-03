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
          tr.style.display = "none";
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
      const prioridade = parsePriority(prioridadeTexto);

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

      list.push({
        num,
        prioridade,
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
              upsert(A.num, B.num, 'Regra Clone', 'Alto', 'Prioridade, Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos. ' + sug);
              upsert(B.num, A.num, 'Regra Clone', 'Alto', 'Prioridade, Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos. ' + sug);
            } else {
              const kd = pickKeepDropParcial(A, B);
              const sug = `Sugestão: Excluir a regra ${kd.drop.num}, mantendo a ${kd.keep.num} (executa antes).`;
              upsert(A.num, B.num, 'Regra Clone', 'Médio', 'Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos; prioridades diferentes. ' + sug);
              upsert(B.num, A.num, 'Regra Clone', 'Médio', 'Localizador REMOVER, Tipo de Controle / Critério, Localizador INCLUIR / Ação e Outros Critérios idênticos; prioridades diferentes. ' + sug);
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
              upsert(rest.num, ampla.num, 'Prioridade Indefinida', 'Baixo', motivoSemPrio);
              upsert(ampla.num, rest.num, 'Prioridade Indefinida', 'Baixo', motivoSemPrio);
            } else {
              upsert(rest.num, ampla.num, 'Prioridade Indefinida', 'Baixo',
                `Mesmo Localizador REMOVER e Tipo de Controle / Critério com interseção; prioridades equivalentes. ` +
                `${motivoSimultaneo} ` +
                `A regra ${ampla.num} é mais ampla em "Outros Critérios" e pode capturar processos da mais restrita. ` + `Sugestão: Definir a prioridade da regra ${rest.num} para executar antes da ${ampla.num} (ou ajustar "Outros Critérios" para não sobrepor).`);
            }
          }
          // Mesma prioridade e "Outros" diferentes, porém compatíveis por contexto → possível sobreposição
          if (oa === ob && relAB === 'diferentes' && overlapAB.overlap && temDimensaoComumOutros) {
            const motivo = `Mesmo Localizador REMOVER e Tipo de Controle / Critério com interseção; prioridades equivalentes; ${buildSimultaneousOverlapReason(A, B, overlapAB)}`;
            upsert(A.num, B.num, 'Prioridade Indefinida', 'Baixo', motivo);
            upsert(B.num, A.num, 'Prioridade Indefinida', 'Baixo', motivo);
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
                  const motivo = `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; prioridades diferentes. Prioridade Indefinida: contenção parcial/ambígua (sem contenção total). ${motivoCurto}`;
                  upsert(later.num, earlier.num, 'Prioridade Indefinida', 'Baixo', motivo);
                  upsert(earlier.num, later.num, 'Prioridade Indefinida', 'Baixo', motivo);
                }
              } else {
                if (!temDimensaoComumOutros) {
                  continue;
                }
                const motivo = hasIntersecaoComDecisaoHumana
                  ? `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; prioridades diferentes. Prioridade Indefinida: ${motivoCurto}`
                  : `Mesmo Localizador REMOVER e mesmo Tipo de Controle / Critério; prioridades diferentes. Prioridade Indefinida aplicada entre regras equivalentes em "Outros Critérios". ${motivoCurto}`;
                upsert(later.num, earlier.num, 'Prioridade Indefinida', 'Baixo', motivo);
                upsert(earlier.num, later.num, 'Prioridade Indefinida', 'Baixo', motivoCurto);
              }
            }
          }
        }

        const Arem = getRemSet(A);
        const Ainc = getIncSet(A);
        const Brem = getRemSet(B);
        const Binc = getIncSet(B);

        // Regra de negócio (ajuste 2026-04): sem REMOVER exato não classifica
        // como Prioridade Indefinida/Prioridade Invertida/Prioridade Correta.

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
        upsert(A.num, B.num, 'Looping Potencial', 'Alto', 'A remove algo que B inclui e B remove algo que A inclui.');
        upsert(B.num, A.num, 'Looping Potencial', 'Alto', 'A remove algo que B inclui e B remove algo que A inclui.');
      }
    }
      }
    }

    for (const r of (rules || [])) {
      try {
        const motivos = detectContradictions(r);
        if (motivos && motivos.length) {
          const sugest = 'Sugestão: Em “Outros Critérios”, remova seleções mutuamente exclusivas do mesmo campo (ex.: COM e SEM; APENAS UMA e MAIS DE UMA; estados diferentes do mesmo Dado Complementar). Se a intenção for abranger alternativas, separe em regras distintas ou use conector OU quando disponível.';
          upsert(r.num, -1, 'Contradição', 'Alto', motivos.join(' | ') + '\n' + sugest);
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
              upsert(r.num, -1, 'Ação sem Avanço', 'Baixo',
                `${obs} Ações: ${resumoAcoes}. ${sug}`);
            } else {
              const sug = ehTempo
                ? 'Sugestão: para gatilho temporal, defina um Localizador INCLUIR diferente do REMOVER (próximo passo do fluxo), evitando reexecução recorrente.'
                : 'Sugestão: defina um Localizador INCLUIR diferente do REMOVER; sem ação programada relevante, manter no mesmo localizador não agrega avanço operacional.';
              const detalhe = ehTempo
                ? 'Com gatilho temporal, manter INCLUIR == REMOVER tende a reexecutar no ciclo seguinte (diário/periódico).'
                : 'Sem ação programada relevante, manter INCLUIR == REMOVER tende a permanência sem avanço.';
              upsert(r.num, -1, 'Quebra de Fluxo', 'Alto',
                `${detalhe}\n${sug}`);
            }
          }
        } catch (e) {}
      }
    }
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
    'Regra Clone': 'clone',
    'Prioridade Indefinida': 'prioridade-indefinida',
    'Prioridade Invertida': 'prioridade-invertida',
    'Prioridade Correta': 'prioridade-correta',
    'Contradição': 'contradicao',
    'Quebra de Fluxo': 'quebra-fluxo',
    'Ação sem Avanço': 'acao-sem-avanco',
    'Looping Potencial': 'loop',
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

function applyFilter(table) {
    const bodies = table.tBodies?.length ? Array.from(table.tBodies) : [table.querySelector('tbody')].filter(Boolean);
    const rows = bodies.flatMap(tb => Array.from(tb.rows));
    rows.forEach(tr => {
      const includeInactive = atpShouldIncludeInactiveRules();
      const filtroCategorias = (window && window.atpFiltroCategorias) ? window.atpFiltroCategorias : null;
      const apenasAtencao = !!window.onlyPossibleConflicts;
      const apenasCriticos = !!onlyConflicts;
      if (tr.dataset.atpInactive === '1' && !includeInactive) {
        tr.style.display = 'none';
        return;
      }
      if (filtroCategorias && typeof filtroCategorias === 'object') {
        const filtrarCritico = !!filtroCategorias.critico;
        const filtrarAtencao = !!filtroCategorias.atencao;
        const filtrarInformativo = !!filtroCategorias.informativo;
        const temFiltroCategoria = filtrarCritico || filtrarAtencao || filtrarInformativo;
        if (!temFiltroCategoria) {
          tr.style.display = '';
          return;
        }
        const mostrarCritico = filtrarCritico && tr.dataset.atpHasConflict === '1';
        const mostrarAtencao = filtrarAtencao && tr.dataset.atpHasPossible === '1';
        const mostrarInformativo = filtrarInformativo && tr.dataset.atpHasInformativo === '1';
        tr.style.display = (mostrarCritico || mostrarAtencao || mostrarInformativo) ? '' : 'none';
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
        const conjuntoCritico = new Set(['Prioridade Invertida', 'Contradição', 'Quebra de Fluxo', 'Looping Potencial']);
        const conjuntoAtencao = new Set(['Regra Clone', 'Prioridade Indefinida']);
        const conjuntoInformativo = new Set(['Prioridade Correta', 'Ação sem Avanço']);
        const prioridadeLinha = (num) => {
          const rec = adj.get(num);
          const tipos = Array.from(rec?.tipos || []);
          if (tipos.some(t => conjuntoCritico.has(t))) return 300;
          if (tipos.includes('Prioridade Indefinida')) return 220;
          if (tipos.includes('Regra Clone')) return 210;
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
        let temLinhaInformativa = false;
        const maxVisiblePossibleRows = 8;
        let possibleVisible = 0;
        let possibleHidden = 0;
for (const n of others) {
          const rec = adj.get(n);
          const tiposAll = Array.from(rec.tipos || []);
          const regraTemCritico = tiposAll.some(t => conjuntoCritico.has(t));
          const regraTemAtencao = tiposAll.some(t => conjuntoAtencao.has(t));
          const regraTemInformativo = tiposAll.some(t => conjuntoInformativo.has(t));
          if (regraTemCritico) temLinhaCritica = true;
          else if (regraTemAtencao) temLinhaAtencao = true;
          if (regraTemInformativo) temLinhaInformativa = true;
          const prioridadeVisualTipo = (t) => {
            if (t === 'Prioridade Indefinida') return 2;
            if (t === 'Regra Clone') return 1;
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
          const nLabel = (Number(n) < 0) ? '(Própria Regra)' : esc(n);
          const apenasAtencao = tiposAll.length > 0
            && !tiposAll.some(t => conjuntoCritico.has(t))
            && tiposAll.some(t => conjuntoAtencao.has(t))
            && tiposAll.every(t => conjuntoAtencao.has(t) || conjuntoInformativo.has(t));
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
          html += `<div${rowStyle} title="${esc(tooltipLinhaConflito)}" data-atp-conf-linha="1"><span class="atp-conf-num">${nLabel}:</span> ${spans}</div>`;
          maxSev = Math.max(maxSev, severity(rec));
        }
        if (possibleHidden > 0) {
          html += `<div style="color:#64748b;font-size:11px">+${possibleHidden} relações de revisão ocultas (use "Comparar" para detalhar)</div>`;
        }

        if (temLinhaCritica) tr.dataset.atpHasConflict = '1'; else delete tr.dataset.atpHasConflict;
        if (temLinhaAtencao) tr.dataset.atpHasPossible = '1'; else delete tr.dataset.atpHasPossible;
        if (temLinhaInformativa) tr.dataset.atpHasInformativo = '1'; else delete tr.dataset.atpHasInformativo;
      } else {
        delete tr.dataset.atpHasConflict;
        delete tr.dataset.atpHasPossible;
        delete tr.dataset.atpHasInformativo;
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
