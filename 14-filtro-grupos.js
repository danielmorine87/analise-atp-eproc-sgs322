try { console.log('[ATP][LOAD] 14-filtro-grupos.js carregado com sucesso'); } catch (_) {}

(function atpInstallGroupFilter() {
  'use strict';

  const SELECTOR_ID = 'selGrupoRegra';
  const TABLE_ID = 'tableAutomatizacaoLocalizadores';
  const WRAPPER_ID = 'atpGroupFilter';
  const STORAGE_PREFIX = 'ATP_GROUP_FILTER_V1::';
  let groupSelect = null;
  let currentScope = '';
  let selectedGroups = new Set();
  let groups = [];
  let root = null;
  let list = null;
  let searchInput = null;
  let status = null;
  let menu = null;
  let tableObserver = null;
  let observedTable = null;
  let pendingTimer = null;
  let dtInstanceTable = null;
  let dtSearchFn = null;
  let dtDrawHooked = false;
  let lastFilterSignature = null;

  function parseGroupId(value) {
    const match = String(value || '').trim().match(/^(\d+)\|/);
    return match ? match[1] : '';
  }

  function normalizeLabel(value) {
    return String(value || '')
      .replace(/\s*\(\s*\d+\s*\)\s*$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('pt-BR');
  }

  function getGroups(select) {
    const seen = new Set();
    return Array.from(select?.options || [])
      .map((option) => ({
        id: parseGroupId(option.value),
        label: String(option.textContent || '').trim()
      }))
      .filter((group) => {
        if (!group.id || seen.has(group.id)) return false;
        seen.add(group.id);
        return true;
      });
  }

  function getScope() {
    const orgSelect = document.querySelector('#selOrgao, select[name="selOrgao"]');
    const orgId = String(orgSelect?.value || '').trim();
    return `${location.host}::${orgId || 'orgao-indefinido'}`;
  }

  function storageKey(scope) {
    return STORAGE_PREFIX + encodeURIComponent(scope);
  }

  function readSelection(scope, nativeSelect, availableGroups) {
    try {
      const saved = sessionStorage.getItem(storageKey(scope));
      if (saved !== null) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) {
          const available = new Set(availableGroups.map((group) => group.id));
          return new Set(ids.map(String).filter((id) => available.has(id)));
        }
      }
    } catch (_) {}

    const selectedId = parseGroupId(nativeSelect?.value);
    return selectedId && availableGroups.some((group) => group.id === selectedId)
      ? new Set([selectedId])
      : new Set();
  }

  function saveSelection() {
    try {
      sessionStorage.setItem(storageKey(currentScope), JSON.stringify(Array.from(selectedGroups)));
    } catch (_) {}
  }

  function getRuleGroupId(row) {
    const groupLabel = row?.querySelector?.('[id^="spnGrupoRegra_"]');
    if (!groupLabel) return '';

    const action = groupLabel.querySelector('a[onclick*="alteraGrupoRegra"]');
    const onclick = String(action?.getAttribute('onclick') || '');
    const args = onclick.match(
      /alteraGrupoRegra\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*,\s*(['"])(.*?)\5/i
    );
    if (args && /^\d+$/.test(args[6])) return args[6];

    const label = normalizeLabel(groupLabel.textContent);
    const fallback = groups.find((group) => normalizeLabel(group.label) === label);
    return fallback?.id || '';
  }

  function getRuleRows(table) {
    const bodies = table?.tBodies?.length
      ? Array.from(table.tBodies)
      : [table?.querySelector('tbody')].filter(Boolean);
    return bodies.flatMap((body) => Array.from(body.rows || []))
      .filter((row) => row.id.startsWith('trLocalizadorAut_') || row.querySelector('[id^="spnGrupoRegra_"]'));
  }

  function applyGroupFilter() {
    const table = document.getElementById(TABLE_ID);
    if (!table) return;

    const rows = getRuleRows(table);
    const usingDataTables = applyDataTablesGroupFilter(table);

    let matchedCount = 0;
    let unknownCount = 0;

    rows.forEach((row) => {
      const groupId = getRuleGroupId(row);
      const hiddenByGroup = !selectedGroups.has(groupId);
      if (usingDataTables) {
        row.classList.remove('atp-group-filter-hidden');
      } else {
        row.classList.toggle('atp-group-filter-hidden', hiddenByGroup);
      }
      if (!groupId) unknownCount++;
      if (!hiddenByGroup) matchedCount++;
    });

    if (status) {
      status.textContent = selectedGroups.size
        ? `Exibindo ${matchedCount} de ${rows.length} regras${unknownCount ? ` · ${unknownCount} sem grupo identificado` : ''}`
        : `${rows.length} regras disponíveis · selecione grupos para exibir`;
    }
    updateButton();
  }

  // Quando a tabela e um DataTables, a visibilidade precisa ser resolvida pela
  // propria API: so esconder por CSS nao recalcula a paginacao (um grupo pequeno
  // continuaria espalhado por varias paginas vazias).
  function applyDataTablesGroupFilter(table) {
    const jq = window.jQuery;
    if (!jq || !jq.fn || !jq.fn.dataTable || !jq.fn.dataTable.ext || !Array.isArray(jq.fn.dataTable.ext.search)) {
      return false;
    }

    let api;
    try { api = jq(table).DataTable(); } catch (_) { return false; }
    if (!api || typeof api.draw !== 'function') return false;

    if (dtInstanceTable !== table) {
      try {
        if (dtSearchFn) {
          jq.fn.dataTable.ext.search = jq.fn.dataTable.ext.search.filter((fn) => fn !== dtSearchFn);
        }
      } catch (_) {}
      dtInstanceTable = table;
      dtDrawHooked = false;
      dtSearchFn = function (settings, data, dataIndex) {
        if (!selectedGroups.size) return false;
        const rowData = settings && settings.aoData ? settings.aoData[dataIndex] : null;
        const tr = rowData ? rowData.nTr : null;
        if (!tr) return false;
        return selectedGroups.has(getRuleGroupId(tr));
      };
      jq.fn.dataTable.ext.search.push(dtSearchFn);
    }

    if (!dtDrawHooked && typeof api.on === 'function') {
      api.on('draw', () => {
        try { if (typeof applyFilter === 'function') applyFilter(table); } catch (_) {}
      });
      dtDrawHooked = true;
    }

    const signature = table.id + '::' + Array.from(selectedGroups).sort().join(',');
    if (signature !== lastFilterSignature) {
      lastFilterSignature = signature;
      try { api.draw(false); } catch (_) { return false; }
    }

    return true;
  }

  function updateButton() {
    const button = root?.querySelector('#atpGroupFilterButton');
    if (!button) return;
    button.textContent = selectedGroups.size
      ? `${selectedGroups.size} grupo(s) selecionado(s) ▾`
      : 'Nenhum grupo selecionado ▾';
    button.title = selectedGroups.size
      ? 'Exibindo apenas as regras dos grupos marcados'
      : 'Nenhuma regra é exibida sem seleção. Marque um ou mais grupos.';
    button.setAttribute('aria-expanded', menu?.hidden ? 'false' : 'true');
  }

  function renderGroupList() {
    if (!list) return;
    list.replaceChildren();

    const query = normalizeLabel(searchInput?.value || '');
    const visibleGroups = groups.filter((group) => !query || normalizeLabel(group.label).includes(query));

    visibleGroups.forEach((group) => {
      const label = document.createElement('label');
      label.className = 'atp-group-filter-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = group.id;
      checkbox.checked = selectedGroups.has(group.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedGroups.add(group.id);
        else selectedGroups.delete(group.id);
        saveSelection();
        applyGroupFilter();
      });

      const text = document.createElement('span');
      text.textContent = group.label;
      label.append(checkbox, text);
      list.appendChild(label);
    });

    if (!visibleGroups.length) {
      const empty = document.createElement('div');
      empty.className = 'atp-group-filter-empty';
      empty.textContent = 'Nenhum grupo corresponde à busca.';
      list.appendChild(empty);
    }
  }

  function installStyles() {
    if (document.getElementById('atpGroupFilterStyles')) return;
    const style = document.createElement('style');
    style.id = 'atpGroupFilterStyles';
    style.textContent = `
      #${SELECTOR_ID}.atp-native-group-filter-hidden { display: none !important; }
      tr.atp-group-filter-hidden { display: none !important; }
      #${WRAPPER_ID} { position: relative; display: inline-block; min-width: 210px; max-width: 100%; vertical-align: middle; }
      #${WRAPPER_ID} #atpGroupFilterButton { width: 100%; min-height: 30px; text-align: left; white-space: normal; }
      #${WRAPPER_ID} .atp-group-filter-menu {
        position: absolute; top: calc(100% + 4px); left: 0; z-index: 10050;
        width: min(430px, calc(100vw - 32px)); padding: 8px;
        border: 1px solid #94a3b8; border-radius: 6px; background: #fff;
        box-shadow: 0 8px 24px rgba(15, 23, 42, .2); color: #0f172a;
      }
      #${WRAPPER_ID} .atp-group-filter-menu[hidden] { display: none; }
      #${WRAPPER_ID} .atp-group-filter-tools { display: flex; gap: 6px; align-items: center; margin: 6px 0; }
      #${WRAPPER_ID} .atp-group-filter-tools button { padding: 2px 8px; }
      #${WRAPPER_ID} .atp-group-filter-list {
        max-height: min(360px, 55vh); overflow: auto; border: 1px solid #e2e8f0;
        border-radius: 4px; padding: 4px;
      }
      #${WRAPPER_ID} .atp-group-filter-option {
        display: flex; gap: 7px; align-items: flex-start; padding: 4px;
        border-radius: 3px; cursor: pointer; font-size: 12px; line-height: 1.35;
      }
      #${WRAPPER_ID} .atp-group-filter-option:hover { background: #f1f5f9; }
      #${WRAPPER_ID} .atp-group-filter-option input { margin: 2px 0 0; flex: 0 0 auto; }
      #${WRAPPER_ID} .atp-group-filter-help, #${WRAPPER_ID} .atp-group-filter-status,
      #${WRAPPER_ID} .atp-group-filter-empty { color: #475569; font-size: 11px; }
      #${WRAPPER_ID} .atp-group-filter-status { margin-top: 6px; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function setAllGroupsVisible() {
    selectedGroups = new Set(groups.map((group) => group.id));
    saveSelection();
    renderGroupList();
    applyGroupFilter();
  }

  function clearGroupSelection() {
    selectedGroups.clear();
    saveSelection();
    renderGroupList();
    applyGroupFilter();
  }

  function buildPicker(select) {
    const availableGroups = getGroups(select);
    if (!availableGroups.length) return false;

    const scope = getScope();
    const scopeChanged = scope !== currentScope;
    const selectChanged = select !== groupSelect;

    if (scopeChanged || selectChanged) {
      selectedGroups = readSelection(scope, select, availableGroups);
      currentScope = scope;
      groupSelect = select;
    }

    groups = availableGroups;
    const availableIds = new Set(groups.map((group) => group.id));
    selectedGroups = new Set(Array.from(selectedGroups).filter((id) => availableIds.has(id)));

    if (!root || !root.isConnected || root.dataset.atpSelectId !== select.id) {
      root?.remove();
      root = document.createElement('div');
      root.id = WRAPPER_ID;
      root.dataset.atpSelectId = select.id;

      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'atpGroupFilterButton';
      button.className = 'infraButton';
      button.setAttribute('aria-haspopup', 'true');
      button.setAttribute('aria-controls', 'atpGroupFilterMenu');
      button.addEventListener('click', () => {
        menu.hidden = !menu.hidden;
        updateButton();
        if (!menu.hidden) searchInput.focus();
      });
      root.appendChild(button);

      menu = document.createElement('div');
      menu.id = 'atpGroupFilterMenu';
      menu.className = 'atp-group-filter-menu';
      menu.hidden = true;

      const help = document.createElement('div');
      help.className = 'atp-group-filter-help';
      help.textContent = 'Marque os grupos que deseja exibir. Sem marcação, nenhuma regra é exibida.';
      menu.appendChild(help);

      const tools = document.createElement('div');
      tools.className = 'atp-group-filter-tools';
      searchInput = document.createElement('input');
      searchInput.type = 'search';
      searchInput.placeholder = 'Filtrar lista de grupos';
      searchInput.setAttribute('aria-label', 'Filtrar lista de grupos');
      searchInput.style.flex = '1';
      searchInput.addEventListener('input', renderGroupList);
      tools.appendChild(searchInput);

      const allButton = document.createElement('button');
      allButton.type = 'button';
      allButton.className = 'infraButton';
      allButton.textContent = 'Exibir todos';
      allButton.addEventListener('click', setAllGroupsVisible);
      tools.appendChild(allButton);

      const noneButton = document.createElement('button');
      noneButton.type = 'button';
      noneButton.className = 'infraButton';
      noneButton.textContent = 'Limpar';
      noneButton.addEventListener('click', clearGroupSelection);
      tools.appendChild(noneButton);
      menu.appendChild(tools);

      list = document.createElement('div');
      list.className = 'atp-group-filter-list';
      menu.appendChild(list);

      status = document.createElement('div');
      status.className = 'atp-group-filter-status';
      menu.appendChild(status);
      root.appendChild(menu);

      select.insertAdjacentElement('afterend', root);
      select.classList.add('atp-native-group-filter-hidden');
      select.setAttribute('aria-hidden', 'true');

      document.addEventListener('click', (event) => {
        if (root && !root.contains(event.target)) {
          menu.hidden = true;
          updateButton();
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && menu && !menu.hidden) {
          menu.hidden = true;
          updateButton();
        }
      });
    }

    // O filtro nativo do eProc aceita um grupo. O seletor visual assume essa funcao
    // e deixa o campo nativo sem restricao para carregar as regras da unidade.
    const allOption = Array.from(select.options || []).find((option) => !parseGroupId(option.value));
    if (allOption && select.value !== allOption.value) select.value = allOption.value;
    select.classList.add('atp-native-group-filter-hidden');
    select.setAttribute('aria-hidden', 'true');

    saveSelection();
    renderGroupList();
    updateButton();
    applyGroupFilter();
    return true;
  }

  function refresh() {
    const select = document.getElementById(SELECTOR_ID);
    if (!select) return;
    buildPicker(select);
    observeTable();
  }

  function observeTable() {
    const table = document.getElementById(TABLE_ID);
    if (!table || table === observedTable) return;
    try { tableObserver?.disconnect(); } catch (_) {}
    tableObserver = new MutationObserver(() => applyGroupFilter());
    tableObserver.observe(table, { childList: true, subtree: true });
    observedTable = table;
  }

  function scheduleRefresh() {
    if (pendingTimer !== null) return;
    pendingTimer = window.setTimeout(() => {
      pendingTimer = null;
      refresh();
    }, 100);
  }

  function start() {
    installStyles();
    refresh();

    // Ignora mutacoes geradas pela propria interface do filtro para nao
    // disparar refresh() em loop (a lista e o status sao reescritos a cada refresh).
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (root && root.contains(mutation.target)) continue;
        scheduleRefresh();
        return;
      }
    });
    const rootNode = document.documentElement;
    if (rootNode) observer.observe(rootNode, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
