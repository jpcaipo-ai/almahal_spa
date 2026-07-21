const rawRecords = window.SALES_DATA.records;
const qualityRecords = window.QUALITY_DATA?.records || [];

const state = {
  sede: 'all',
  mes: 'all',
  semana: 'all',
  asesora: 'all',
  categoria: 'all',
  startDate: '',
  endDate: '',
  cliente: '',
  qualityWeek: 'all',
  qualityAdvisor: 'all',
  focusAdvisor: '',
  dailyCompare: 'both',
  monthTrendSegment: 'total',
  view: 'review',
  ask: ''
};

const els = {
  sede: document.querySelector('#sedeFilter'),
  mes: document.querySelector('#monthFilter'),
  semana: document.querySelector('#weekFilter'),
  asesora: document.querySelector('#advisorFilter'),
  categoria: document.querySelector('#categoryFilter'),
  startDate: document.querySelector('#startDateFilter'),
  endDate: document.querySelector('#endDateFilter'),
  cliente: document.querySelector('#clientSearch'),
  dailyCompare: document.querySelector('#dailyCompareFilter'),
  monthTrendSegment: document.querySelector('#monthTrendSegmentFilter'),
  kpis: document.querySelector('#kpis'),
  askInput: document.querySelector('#askInput'),
  queryAnswer: document.querySelector('#queryAnswer'),
  queryExport: document.querySelector('#queryExport')
};

let queryResultRows = [];

const money = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat('es-PE', { style: 'percent', maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit' });

const dayOrder = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const palette = ['#6f6a3d', '#b7995c', '#7a5f52', '#9c8d63', '#8e3f31', '#b8a780'];
const customerSuccessAdvisors = new Set(['Antonelly Alvarado', 'Melanie Lopez Anaya']);

function uniqueSorted(records, key) {
  return [...new Set(records.map(r => r[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'es'));
}

function latestMonth() {
  return uniqueSorted(rawRecords, 'mes').at(-1) || 'all';
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoWeekStart(year, week) {
  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
  return monday;
}

function weekRangeLabel(value) {
  const match = String(value).match(/^(\d{4})-W(\d{2})$/);
  if (!match) return value;
  const start = isoWeekStart(Number(match[1]), Number(match[2]));
  const end = addDays(start, 6);
  return `${shortDate.format(start)}-${shortDate.format(end)}`;
}

function weekFullLabel(value) {
  return `${value} (${weekRangeLabel(value)})`;
}

function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isoParts(value) {
  const date = typeof value === 'string' ? parseDate(value) : new Date(value);
  const tmp = new Date(date);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const weekYear = tmp.getFullYear();
  const week1 = new Date(weekYear, 0, 4);
  const week = 1 + Math.round((((tmp - week1) / 86400000) - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { year: weekYear, week, weekday: date.getDay() || 7 };
}

function dateFromIso(year, week, weekday) {
  return addDays(isoWeekStart(year, week), weekday - 1);
}

function comparableLastYearDate(dateValue) {
  const parts = isoParts(dateValue);
  return formatDate(dateFromIso(parts.year - 1, parts.week, parts.weekday));
}

function sameCommercialWeek(dateValue) {
  const parts = isoParts(dateValue);
  const start = isoWeekStart(parts.year, parts.week);
  const end = addDays(start, 6);
  return { parts, start: formatDate(start), end: formatDate(end), label: `${formatDate(start)} a ${formatDate(end)}` };
}

function txKey(row) {
  const docNumber = row.numeroDocumento || '';
  const docType = row.documento || '';
  if (docNumber) return `${row.sede}|${row.fecha}|${docType}|${docNumber}`;
  return `${row.sede}|${row.fecha}|${row.cliente}|${row.producto}|${row.venta}`;
}

function sum(records, key = 'venta') {
  return records.reduce((acc, row) => acc + Number(row[key] || 0), 0);
}

function txCount(records) {
  return new Set(records.map(txKey)).size;
}

function clientCount(records) {
  return new Set(records.map(r => `${r.sede}|${r.cliente}`).filter(Boolean)).size;
}

function clientLifecycleSummary(records) {
  const rows = lifecycleSalesBreakdown(records);
  const nuevo = rows.find(row => row.key === 'nuevo') || { venta: 0, tx: 0 };
  const existentes = rows.filter(row => row.key !== 'nuevo');
  return {
    nuevos: nuevo.tx,
    existentes: existentes.reduce((acc, row) => acc + row.tx, 0),
    sinMatch: 0,
    ventaNuevos: nuevo.venta,
    ventaExistentes: existentes.reduce((acc, row) => acc + row.venta, 0),
    ventaSinMatch: 0,
    total: rows.reduce((acc, row) => acc + row.tx, 0),
    start: uniqueSorted(records, 'fecha')[0] || '',
    end: uniqueSorted(records, 'fecha').at(-1) || ''
  };
}

function incrementalSinceEngagement() {
  const scoped = comparableScopeRecords();
  const months = uniqueSorted(scoped, 'mes').filter(month => month >= '2025-08');
  const latestDate = uniqueSorted(scoped, 'fecha').at(-1) || '';
  const latestMonth = latestDate ? latestDate.slice(0, 7) : '';
  let total = 0;
  const rows = [];
  for (const month of months) {
    const [year, monthNum] = month.split('-').map(Number);
    const previousMonth = `${year - 1}-${String(monthNum).padStart(2, '0')}`;
    const currentRows = scoped.filter(row => row.mes === month);
    let previousRows = scoped.filter(row => row.mes === previousMonth);
    if (month === latestMonth && latestDate) {
      const cutoffDay = Number(latestDate.slice(8, 10));
      previousRows = previousRows.filter(row => Number(row.fecha.slice(8, 10)) <= cutoffDay);
    }
    const current = sum(currentRows);
    const previous = sum(previousRows);
    const incremental = current - previous;
    total += incremental;
    rows.push({ month, previousMonth, current, previous, incremental });
  }
  return { total, rows, start: '2025-08', end: months.at(-1) || '' };
}

function transactionRows(records) {
  return groupBy(records, txKey).map(([id, rows]) => {
    const first = rows[0];
    return {
      id,
      sede: first.sede,
      fecha: first.fecha,
      semana: first.semana,
      mes: first.mes,
      asesora: first.asesora,
      cliente: first.cliente,
      clienteRuc: first.clienteRuc || first.clienteRUC || '',
      clienteCreacion: first.clienteCreacion || '',
      venta: sum(rows),
      lineas: rows.length
    };
  });
}

function filteredRecords() {
  const search = state.cliente.trim().toLocaleLowerCase('es');
  return rawRecords.filter(row => {
    if (state.sede !== 'all' && row.sede !== state.sede) return false;
    if (state.mes !== 'all' && row.mes !== state.mes) return false;
    if (state.semana !== 'all' && row.semana !== state.semana) return false;
    if (state.asesora !== 'all' && row.asesora !== state.asesora) return false;
    if (state.categoria !== 'all' && row.categoria !== state.categoria) return false;
    if (state.startDate && row.fecha < state.startDate) return false;
    if (state.endDate && row.fecha > state.endDate) return false;
    if (search && !row.cliente.toLocaleLowerCase('es').includes(search)) return false;
    return true;
  });
}

function advisorOptionRecords() {
  const search = state.cliente.trim().toLocaleLowerCase('es');
  return rawRecords.filter(row => {
    if (state.sede !== 'all' && row.sede !== state.sede) return false;
    if (state.mes !== 'all' && row.mes !== state.mes) return false;
    if (state.semana !== 'all' && row.semana !== state.semana) return false;
    if (state.categoria !== 'all' && row.categoria !== state.categoria) return false;
    if (state.startDate && row.fecha < state.startDate) return false;
    if (state.endDate && row.fecha > state.endDate) return false;
    if (search && !row.cliente.toLocaleLowerCase('es').includes(search)) return false;
    return true;
  });
}

function categoryOptionRecords() {
  const search = state.cliente.trim().toLocaleLowerCase('es');
  return rawRecords.filter(row => {
    if (state.sede !== 'all' && row.sede !== state.sede) return false;
    if (state.mes !== 'all' && row.mes !== state.mes) return false;
    if (state.semana !== 'all' && row.semana !== state.semana) return false;
    if (state.asesora !== 'all' && row.asesora !== state.asesora) return false;
    if (state.startDate && row.fecha < state.startDate) return false;
    if (state.endDate && row.fecha > state.endDate) return false;
    if (search && !row.cliente.toLocaleLowerCase('es').includes(search)) return false;
    return true;
  });
}

function refreshAdvisorOptions() {
  const advisors = uniqueSorted(advisorOptionRecords(), 'asesora');
  if (state.asesora !== 'all' && !advisors.includes(state.asesora)) state.asesora = 'all';
  setOptions(els.asesora, advisors, state.asesora, 'Todas', 'asesora');
}

function refreshCategoryOptions() {
  const categories = uniqueSorted(categoryOptionRecords(), 'categoria');
  if (state.categoria !== 'all' && !categories.includes(state.categoria)) state.categoria = 'all';
  setOptions(els.categoria, categories, state.categoria, 'Todas', 'categoria');
}

function comparableScopeRecords() {
  const search = state.cliente.trim().toLocaleLowerCase('es');
  return rawRecords.filter(row => {
    if (state.sede !== 'all' && row.sede !== state.sede) return false;
    if (state.asesora !== 'all' && row.asesora !== state.asesora) return false;
    if (state.categoria !== 'all' && row.categoria !== state.categoria) return false;
    if (search && !row.cliente.toLocaleLowerCase('es').includes(search)) return false;
    return true;
  });
}

function comparableRecordsForCurrent(records) {
  const scoped = comparableScopeRecords();
  const comparableDates = new Set();
  const currentDates = uniqueSorted(records, 'fecha');
  const hasExplicitDateRange = Boolean(state.startDate || state.endDate);
  const isPartialMonth = (() => {
    if (state.mes === 'all' || !currentDates.length) return false;
    const [year, month] = state.mes.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    return currentDates.length < daysInMonth;
  })();
  if (hasExplicitDateRange || isPartialMonth) {
    for (const row of records) comparableDates.add(comparableLastYearDate(row.fecha));
    return scoped.filter(row => comparableDates.has(row.fecha));
  }
  if (state.mes !== 'all' && state.semana === 'all') {
    const [year, month] = state.mes.split('-').map(Number);
    const previousMonth = `${year - 1}-${String(month).padStart(2, '0')}`;
    return scoped.filter(row => row.mes === previousMonth);
  }
  if (state.semana !== 'all') {
    const match = state.semana.match(/^(\d{4})-W(\d{2})$/);
    if (match) {
      const previousWeek = `${Number(match[1]) - 1}-W${match[2]}`;
      return scoped.filter(row => row.semana === previousWeek);
    }
  }
  for (const row of records) comparableDates.add(comparableLastYearDate(row.fecha));
  return scoped.filter(row => comparableDates.has(row.fecha));
}

function sameMonthLastYearRecords(records) {
  const scoped = comparableScopeRecords();
  const dates = uniqueSorted(records, 'fecha');
  if (!dates.length) return [];
  const first = dates[0];
  const last = dates.at(-1);
  const startYear = Number(first.slice(0, 4)) - 1;
  const endYear = Number(last.slice(0, 4)) - 1;
  const start = `${startYear}-${first.slice(5)}`;
  const end = `${endYear}-${last.slice(5)}`;
  return scoped.filter(row => row.fecha >= start && row.fecha <= end);
}

function deltaText(current, previous, formatter = number.format) {
  if (!previous) return 'sin base comparable';
  const diff = current - previous;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${percent.format(diff / previous)} vs ${formatter(previous)}`;
}

function optionLabel(type, value) {
  if (type === 'mes') {
    const hit = rawRecords.find(row => row.mes === value);
    return hit ? hit.mesNombre : value;
  }
  if (type === 'semana') return weekFullLabel(value);
  return value;
}

function setOptions(select, values, current, label, type) {
  const ordered = type === 'mes' || type === 'semana' ? [...values].sort((a, b) => String(b).localeCompare(String(a))) : values;
  const html = [`<option value="all">${label}</option>`]
    .concat(ordered.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(optionLabel(type, v))}</option>`));
  select.innerHTML = html.join('');
  select.value = values.includes(current) ? current : 'all';
}

function setQualityOptions(select, values, current, label, labelFn) {
  const ordered = [...values].sort((a, b) => String(b).localeCompare(String(a)));
  select.innerHTML = [`<option value="all">${label}</option>`]
    .concat(ordered.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(labelFn ? labelFn(v) : v)}</option>`))
    .join('');
  select.value = values.includes(current) ? current : 'all';
}

function hydrateFilters() {
  setOptions(els.sede, uniqueSorted(rawRecords, 'sede'), state.sede, 'Todas', 'sede');
  setOptions(els.mes, uniqueSorted(rawRecords, 'mes'), state.mes, 'Todos', 'mes');
  setOptions(els.semana, uniqueSorted(rawRecords, 'semana'), state.semana, 'Todas', 'semana');
  refreshCategoryOptions();
  const dates = uniqueSorted(rawRecords, 'fecha');
  els.startDate.min = dates[0] || '';
  els.startDate.max = dates.at(-1) || '';
  els.endDate.min = dates[0] || '';
  els.endDate.max = dates.at(-1) || '';
  els.startDate.value = state.startDate;
  els.endDate.value = state.endDate;
  refreshAdvisorOptions();
  refreshCategoryOptions();
}

function groupBy(records, keyFn) {
  const map = new Map();
  for (const row of records) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()];
}

function aggregate(records, keyFn) {
  return groupBy(records, keyFn).map(([name, rows]) => {
    const revenue = sum(rows);
    const tx = txCount(rows);
    const units = sum(rows, 'cantidad');
    const tickets = groupBy(rows, txKey);
    const multiline = tickets.filter(([, lines]) => lines.length > 1).length;
    const rituals = rows.filter(row => row.categoria.toLocaleLowerCase('es').includes('ritual'));
    return {
      name,
      rows,
      revenue,
      tx,
      units,
      clients: clientCount(rows),
      avgTicket: tx ? revenue / tx : 0,
      lines: rows.length,
      multilineRate: tickets.length ? multiline / tickets.length : 0,
      ritualShare: revenue ? sum(rituals) / revenue : 0
    };
  });
}

function renderKpis(records) {
  const revenue = sum(records);
  const transactions = txCount(records);
  const units = sum(records, 'cantidad');
  const clients = clientCount(records);
  const days = new Set(records.map(r => r.fecha)).size;
  const tickets = groupBy(records, txKey);
  const multiline = tickets.filter(([, rows]) => rows.length > 1).length;
  const repeatClients = aggregate(records, row => `${row.sede}|${row.cliente}`).filter(item => item.tx > 1);
  const repeatRevenue = repeatClients.reduce((acc, item) => acc + item.revenue, 0);
  const lifecycle = clientLifecycleSummary(records);
  const compareRecords = comparableRecordsForCurrent(records);
  const compareRevenue = sum(compareRecords);
  const compareTransactions = txCount(compareRecords);
  const compareUnits = sum(compareRecords, 'cantidad');
  const compareClients = clientCount(compareRecords);
  const compareDays = new Set(compareRecords.map(r => r.fecha)).size;
  const compareTickets = groupBy(compareRecords, txKey);
  const compareMultiline = compareTickets.filter(([, rows]) => rows.length > 1).length;
  const compareLifecycle = clientLifecycleSummary(compareRecords);
  const compareTicketAvg = compareTransactions ? compareRevenue / compareTransactions : 0;
  const currentTicketAvg = transactions ? revenue / transactions : 0;
  const operativeRecords = records.filter(row => !normalizeText(row.cliente).includes('bigbox'));
  const compareOperativeRecords = compareRecords.filter(row => !normalizeText(row.cliente).includes('bigbox'));
  const operativeRevenue = sum(operativeRecords);
  const compareOperativeRevenue = sum(compareOperativeRecords);
  const currentCross = tickets.length ? multiline / tickets.length : 0;
  const compareCross = compareTickets.length ? compareMultiline / compareTickets.length : 0;
  const currentDailyAvg = days ? revenue / days : 0;
  const compareDailyAvg = compareDays ? compareRevenue / compareDays : 0;
  const visibleMonths = uniqueSorted(records, 'mes');
  const activeMonth = state.mes !== 'all' ? state.mes : (visibleMonths.length === 1 ? visibleMonths[0] : '');
  const comparisonLabel = activeMonth
    ? `Vs ${optionLabel('mes', `${Number(activeMonth.slice(0, 4)) - 1}-${activeMonth.slice(5, 7)}`)}`
    : 'Vs periodo LY';

  const cards = [
    ['Venta total', money.format(revenue), deltaText(revenue, compareRevenue, money.format)],
    ['Venta operativa', money.format(operativeRevenue), `${deltaText(operativeRevenue, compareOperativeRevenue, money.format)} · sin BIGBOX`],
    [comparisonLabel, compareRevenue ? `${revenue >= compareRevenue ? '+' : ''}${percent.format((revenue - compareRevenue) / compareRevenue)}` : 'sin base', 'Crecimiento interanual'],
    ['Ticket promedio', money2.format(currentTicketAvg), deltaText(currentTicketAvg, compareTicketAvg, money2.format)],
    ['Transacciones', number.format(transactions), `${deltaText(transactions, compareTransactions, number.format)} · ${number.format(units)} unidades`],
    ['Clientes', number.format(clients), `${deltaText(clients, compareClients, number.format)} · ${percent.format(clients ? repeatClients.length / clients : 0)} con recompra`],
    ['Nuevos vs existentes', `${number.format(lifecycle.nuevos)} / ${number.format(lifecycle.existentes)}`, `LY: ${number.format(compareLifecycle.nuevos)} / ${number.format(compareLifecycle.existentes)}`],
    ['Monto nuevos/existentes', `${money.format(lifecycle.ventaNuevos)} / ${money.format(lifecycle.ventaExistentes)}`, `LY: ${money.format(compareLifecycle.ventaNuevos)} / ${money.format(compareLifecycle.ventaExistentes)}`],
    ['Cross-sell', percent.format(currentCross), `${deltaText(currentCross, compareCross, percent.format)} · ${multiline} tickets 2+ líneas`],
    ['Venta diaria', money2.format(currentDailyAvg), `${deltaText(currentDailyAvg, compareDailyAvg, money2.format)} · ${days} días`]
  ];

  els.kpis.innerHTML = cards.map(([label, value, note]) => (
    `<article class="kpi"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`
  )).join('');

  return { revenue, transactions, units, clients, days, multiline, repeatRevenue, lifecycle };
}

function renderIncrementalImpact() {
  const el = document.querySelector('#incrementalImpact');
  if (!el) return;
  const data = incrementalSinceEngagement();
  const rows = data.rows.filter(row => row.previous > 0 || row.current > 0);
  const avgIncremental = rows.length ? data.total / rows.length : 0;
  const currentTotal = rows.reduce((acc, row) => acc + row.current, 0);
  const previousTotal = rows.reduce((acc, row) => acc + row.previous, 0);
  const weightedGrowth = previousTotal ? (currentTotal - previousTotal) / previousTotal : 0;
  const simpleGrowth = rows.length
    ? rows.reduce((acc, row) => acc + (row.previous ? (row.current - row.previous) / row.previous : 0), 0) / rows.length
    : 0;
  const maxBar = Math.max(...rows.map(row => Math.abs(row.incremental)), 1);
  const bars = rows.map(row => {
    const height = Math.max(8, Math.abs(row.incremental) / maxBar * 100);
    const positive = row.incremental >= 0;
    return `<span class="${positive ? 'positive' : 'negative'}" style="height:${height}%;" title="${optionLabel('mes', row.month)}: ${money.format(row.incremental)}"></span>`;
  }).join('');
  el.innerHTML = `
    <div class="impact-copy">
      <p class="eyebrow">Impacto LlamaLeads desde agosto 2025</p>
      <strong>${money.format(data.total)}</strong>
      <small>Incremental acumulado vs el mismo mes del año anterior.</small>
    </div>
    <div class="incremental-stat">
      <span>Promedio mensual</span>
      <strong>${money2.format(avgIncremental)}</strong>
      <small>${percent.format(weightedGrowth)} crecimiento ponderado · ${percent.format(simpleGrowth)} promedio simple</small>
    </div>
    <div class="incremental-spark" aria-hidden="true">${bars}</div>
  `;
}

function renderTargetPacing(records) {
  const el = document.querySelector('#targetPacing');
  if (!el) return;
  const monthlyTarget = 300000;
  const dailyFloor = 8000;
  const dates = uniqueSorted(records, 'fecha');
  if (!dates.length) {
    el.innerHTML = '<div class="empty">Sin datos para medir meta mensual</div>';
    return;
  }
  const activeMonth = state.mes !== 'all' ? state.mes : dates.at(-1).slice(0, 7);
  const monthRows = comparableScopeRecords().filter(row => row.mes === activeMonth);
  const monthDates = uniqueSorted(monthRows, 'fecha');
  const monthRevenue = sum(monthRows);
  const lastDate = monthDates.at(-1) || `${activeMonth}-01`;
  const [year, month] = activeMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const elapsedDays = Math.max(1, Number(lastDate.slice(8, 10)));
  const remainingDays = Math.max(0, daysInMonth - elapsedDays);
  const minExpected = elapsedDays * dailyFloor;
  const targetExpected = monthlyTarget * elapsedDays / daysInMonth;
  const dailyAvg = monthRevenue / elapsedDays;
  const projected = dailyAvg * daysInMonth;
  const gapVsFloor = monthRevenue - minExpected;
  const gapVsTarget = monthRevenue - targetExpected;
  const remainingToTarget = Math.max(0, monthlyTarget - monthRevenue);
  const requiredDaily = remainingDays ? remainingToTarget / remainingDays : remainingToTarget;
  const floorStatus = gapVsFloor >= 0 ? 'ahead' : 'behind';
  const targetStatus = projected >= monthlyTarget ? 'ahead' : 'behind';
  const progress = Math.min(100, monthRevenue / monthlyTarget * 100);
  const leakLabel = gapVsFloor >= 0 ? 'colchón vs mínimo' : 'fuga vs mínimo';
  const leakValue = Math.abs(gapVsFloor);
  const periodLabel = `${optionLabel('mes', activeMonth)} · corte ${lastDate}`;

  el.innerHTML = `
    <article class="target-main-card ${targetStatus}">
      <div>
        <span class="target-kicker">Meta mensual</span>
        <strong>${money.format(monthRevenue)}</strong>
        <small>${periodLabel}</small>
      </div>
      <div class="target-progress">
        <i style="width:${progress.toFixed(1)}%"></i>
      </div>
      <p>${percent.format(monthRevenue / monthlyTarget)} de ${money.format(monthlyTarget)} · proyección ${money.format(projected)}</p>
    </article>
    <article class="target-mini-card ${floorStatus}">
      <span>${leakLabel}</span>
      <strong>${gapVsFloor >= 0 ? '+' : '-'}${money.format(leakValue)}</strong>
      <small>Mínimo esperado: ${money.format(minExpected)} (${number.format(elapsedDays)} días x ${money.format(dailyFloor)})</small>
    </article>
    <article class="target-mini-card ${gapVsTarget >= 0 ? 'ahead' : 'behind'}">
      <span>Brecha proporcional</span>
      <strong>${gapVsTarget >= 0 ? '+' : '-'}${money.format(Math.abs(gapVsTarget))}</strong>
      <small>Contra avance ideal de la meta mensual.</small>
    </article>
    <article class="target-mini-card ${requiredDaily <= dailyFloor ? 'ahead' : 'behind'}">
      <span>Necesario diario</span>
      <strong>${money.format(requiredDaily)}</strong>
      <small>Promedio requerido en ${number.format(remainingDays)} días restantes.</small>
    </article>
  `;
}

function segmentSummaryFromRows(rows) {
  const lifecycleRows = lifecycleSalesBreakdown(rows);
  const total = lifecycleRows.reduce((acc, row) => acc + row.venta, 0);
  const current = Object.fromEntries(lifecycleRows.map(row => [row.key, row]));
  const nuevo = current.nuevo || { venta: 0, tx: 0, clientes: new Set(), label: 'Nuevos' };
  const repeatRows = lifecycleRows.filter(row => row.key !== 'nuevo');
  return {
    total,
    lifecycleRows,
    newRepeat: [
      { key: 'nuevo', label: 'Nuevos', venta: nuevo.venta, tx: nuevo.tx, clientes: nuevo.clientes },
      {
        key: 'recompra',
        label: 'Recompras',
        venta: repeatRows.reduce((acc, row) => acc + row.venta, 0),
        tx: repeatRows.reduce((acc, row) => acc + row.tx, 0),
        clientes: new Set(repeatRows.flatMap(row => [...row.clientes]))
      }
    ]
  };
}

function renderMayBenchmark(records) {
  const el = document.querySelector('#mayBenchmark');
  if (!el) return;
  const scoped = comparableScopeRecords();
  const dates = uniqueSorted(records, 'fecha');
  if (!dates.length) {
    el.innerHTML = '<div class="empty">Sin datos para comparar contra mayo</div>';
    return;
  }
  const activeMonth = state.mes !== 'all' ? state.mes : dates.at(-1).slice(0, 7);
  const activeRowsAll = scoped.filter(row => row.mes === activeMonth);
  const activeDates = uniqueSorted(activeRowsAll, 'fecha');
  if (!activeDates.length) {
    el.innerHTML = '<div class="empty">Sin datos del mes activo</div>';
    return;
  }
  const cutoffDay = Math.max(1, Number(activeDates.at(-1).slice(8, 10)));
  const currentRows = activeRowsAll.filter(row => Number(row.fecha.slice(8, 10)) <= cutoffDay);
  const mayRowsSameCut = scoped.filter(row => row.mes === '2026-05' && Number(row.fecha.slice(8, 10)) <= cutoffDay);
  const mayRowsFull = scoped.filter(row => row.mes === '2026-05');
  if (!mayRowsSameCut.length) {
    el.innerHTML = '<div class="empty">No hay mayo 2026 comparable para este filtro</div>';
    return;
  }
  const current = segmentSummaryFromRows(currentRows);
  const may = segmentSummaryFromRows(mayRowsSameCut);
  const mayFull = segmentSummaryFromRows(mayRowsFull);
  const totalGap = current.total - may.total;
  const currentTx = txCount(currentRows);
  const mayTx = txCount(mayRowsSameCut);
  const currentClients = clientCount(currentRows);
  const mayClients = clientCount(mayRowsSameCut);
  const currentDaily = current.total / cutoffDay;
  const mayDaily = may.total / cutoffDay;
  const lifecycleByKey = new Map(may.lifecycleRows.map(row => [row.key, row]));
  const lifecycleOrder = ['nuevo', 'continuidad', 'reactivacion', 'resurreccion'];
  const bottlenecks = current.lifecycleRows
    .map(row => ({ ...row, may: lifecycleByKey.get(row.key) || { venta: 0, tx: 0, clientes: new Set() }, gap: row.venta - (lifecycleByKey.get(row.key)?.venta || 0) }))
    .sort((a, b) => a.gap - b.gap);
  const biggestGap = bottlenecks[0];

  const rowCard = (row, mayRow) => {
    const gap = row.venta - mayRow.venta;
    const cls = gap >= 0 ? 'up' : 'down';
    return `<article class="may-segment-card ${cls}">
      <span>${escapeHtml(row.label)}</span>
      <strong>${money2.format(row.venta)}</strong>
      <em>${gap >= 0 ? '+' : '-'}${money2.format(Math.abs(gap))} vs mayo</em>
      <small>${number.format(row.tx)} tx · ${number.format(row.clientes.size)} clientes · mayo ${money2.format(mayRow.venta)}</small>
    </article>`;
  };

  el.innerHTML = `
    <div class="may-benchmark-head">
      <article>
        <span>${escapeHtml(optionLabel('mes', activeMonth))} al día ${number.format(cutoffDay)}</span>
        <strong>${money2.format(current.total)}</strong>
        <small>${number.format(currentTx)} tx · ${number.format(currentClients)} clientes · ${money2.format(currentDaily)}/día</small>
      </article>
      <article>
        <span>Mayo 2026 al día ${number.format(cutoffDay)}</span>
        <strong>${money2.format(may.total)}</strong>
        <small>${number.format(mayTx)} tx · ${number.format(mayClients)} clientes · ${money2.format(mayDaily)}/día</small>
      </article>
      <article class="${totalGap >= 0 ? 'up' : 'down'}">
        <span>Diferencia vs mayo</span>
        <strong>${totalGap >= 0 ? '+' : '-'}${money2.format(Math.abs(totalGap))}</strong>
        <small>${number.format(currentTx - mayTx)} tx · ${number.format(currentClients - mayClients)} clientes · ${money2.format(currentDaily - mayDaily)}/día</small>
      </article>
      <article>
        <span>Mayo completo</span>
        <strong>${money2.format(mayFull.total)}</strong>
        <small>Referencia del mes que casi llegó a S/ 300k.</small>
      </article>
    </div>
    <div class="may-benchmark-note">
      <strong>Cuello principal:</strong> ${biggestGap ? `${escapeHtml(biggestGap.label)} está ${money2.format(Math.abs(biggestGap.gap))} por debajo de mayo al mismo corte.` : 'sin brecha clara.'}
    </div>
    <div class="may-benchmark-grid">
      ${current.newRepeat.map(row => {
        const mayRow = may.newRepeat.find(item => item.key === row.key) || { venta: 0, tx: 0, clientes: new Set() };
        return rowCard(row, mayRow);
      }).join('')}
    </div>
    <div class="may-benchmark-grid lifecycle">
      ${lifecycleOrder.map(key => {
        const row = current.lifecycleRows.find(item => item.key === key) || { key, label: key, venta: 0, tx: 0, clientes: new Set() };
        const mayRow = lifecycleByKey.get(key) || { venta: 0, tx: 0, clientes: new Set() };
        return rowCard(row, mayRow);
      }).join('')}
    </div>
  `;
}

function monthOffset(monthValue, offset) {
  const [year, month] = monthValue.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthTrendValue(rows, segment) {
  if (segment === 'total') return { value: sum(rows), tx: txCount(rows), clients: clientCount(rows) };
  const lifecycle = lifecycleSalesBreakdown(rows).find(row => row.key === segment);
  return {
    value: lifecycle?.venta || 0,
    tx: lifecycle?.tx || 0,
    clients: lifecycle?.clientes?.size || 0
  };
}

function renderMonthTrendWidget(records) {
  const el = document.querySelector('#monthTrendWidget');
  if (!el) return;
  const scoped = comparableScopeRecords();
  const dates = uniqueSorted(scoped, 'fecha');
  if (!dates.length) {
    el.innerHTML = '<div class="empty">Sin datos para tendencia mensual</div>';
    return;
  }
  const endMonth = state.mes !== 'all' ? state.mes : dates.at(-1).slice(0, 7);
  const months = [-2, -1, 0].map(offset => monthOffset(endMonth, offset));
  const segment = state.monthTrendSegment || 'total';
  const segmentLabels = {
    total: 'Venta total',
    nuevo: 'Nuevos',
    continuidad: 'Continuidad',
    reactivacion: 'Reactivación',
    resurreccion: 'Resurrección'
  };
  const rows = months.map(month => {
    const monthRows = scoped.filter(row => row.mes === month);
    const metric = monthTrendValue(monthRows, segment);
    return {
      month,
      label: optionLabel('mes', month),
      ...metric
    };
  });
  const max = Math.max(...rows.map(row => row.value), 1);
  const last = rows.at(-1);
  const previous = rows.at(-2);
  const delta = last.value - previous.value;
  const deltaPct = previous.value ? delta / previous.value : 0;
  const w = 560;
  const h = 190;
  const pad = 28;
  const slot = (w - pad * 2) / rows.length;
  const barW = Math.min(92, slot * 0.44);
  const points = rows.map((row, idx) => ({
    row,
    x: pad + idx * slot + slot / 2,
    y: h - pad - (row.value / max) * (h - pad * 2)
  }));
  const line = points.map((point, idx) => `${idx ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  el.innerHTML = `
    <div class="month-trend-copy ${delta >= 0 ? 'up' : 'down'}">
      <span>${escapeHtml(segmentLabels[segment] || 'Venta total')}</span>
      <strong>${money2.format(last.value)}</strong>
      <small>${last.label} · ${delta >= 0 ? '+' : '-'}${money2.format(Math.abs(delta))} vs mes anterior ${previous.value ? `(${delta >= 0 ? '+' : ''}${percent.format(deltaPct)})` : ''}</small>
    </div>
    <div class="month-trend-cards">
      ${rows.map((row, idx) => {
        const prev = rows[idx - 1];
        const diff = prev ? row.value - prev.value : 0;
        return `<article class="${idx && diff < 0 ? 'down' : 'up'}">
          <span>${escapeHtml(row.label)}</span>
          <strong>${money2.format(row.value)}</strong>
          <small>${number.format(row.tx)} tx · ${number.format(row.clients)} clientes${idx ? ` · ${diff >= 0 ? '+' : '-'}${money.format(Math.abs(diff))}` : ''}</small>
          <i><b style="width:${Math.max(4, row.value / max * 100).toFixed(1)}%"></b></i>
        </article>`;
      }).join('')}
    </div>
    <svg class="month-trend-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tendencia últimos tres meses">
      ${rows.map((row, idx) => {
        const x = pad + idx * slot + (slot - barW) / 2;
        const barH = (row.value / max) * (h - pad * 2);
        const y = h - pad - barH;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="8" fill="#d9c293" opacity="0.42"></rect>
          <text x="${(x + barW / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle" class="axis">${escapeHtml(row.label.slice(0, 3))}</text>`;
      }).join('')}
      <path d="${line}" fill="none" stroke="#6f6a3d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      ${points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="6" fill="#6f6a3d"><title>${point.row.label}: ${money2.format(point.row.value)}</title></circle>`).join('')}
    </svg>
  `;
}

function renderBars(target, items, opts = {}) {
  const el = document.querySelector(target);
  if (!el) return;
  const limit = opts.limit || 12;
  const sorted = [...items].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  const max = Math.max(...sorted.map(item => Math.abs(item.revenue)), 1);
  if (!sorted.length) {
    el.innerHTML = '<div class="empty">Sin datos para este filtro</div>';
    return;
  }
  el.innerHTML = sorted.map((item, index) => {
    const width = Math.max(2, Math.abs(item.revenue) / max * 100);
    const color = palette[index % palette.length];
    const value = opts.value === 'tx' ? `${number.format(item.tx)} tx` : money.format(item.revenue);
    const sub = opts.sub ? opts.sub(item) : `${number.format(item.tx)} tx · ${money2.format(item.avgTicket)} ticket`;
    return `<div class="bar-row">
      <div class="bar-label" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${color}"></div></div>
      <div class="bar-value">${value}<br>${escapeHtml(sub)}</div>
    </div>`;
  }).join('');
}

function renderLine(target, items, comparisons = {}) {
  const el = document.querySelector(target);
  if (!el) return;
  const sorted = [...items].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (!sorted.length) {
    el.innerHTML = '<div class="empty">Sin datos para este filtro</div>';
    return;
  }
  const legacyCompare = comparisons instanceof Map ? comparisons : null;
  const compareSets = legacyCompare
    ? [{ key: 'ly', label: 'Año pasado comparable', color: '#b7995c', dash: '7 7', map: legacyCompare }]
    : (comparisons.sets || []).filter(set => set?.map?.size);
  const w = 760;
  const h = 280;
  const pad = 34;
  const compareValues = compareSets.flatMap(set => sorted.map(item => set.map.get(item.name)?.revenue || 0));
  const max = Math.max(...sorted.map(item => item.revenue), ...compareValues, 1);
  const min = Math.min(...sorted.map(item => item.revenue), ...compareValues, 0);
  const span = Math.max(max - min, 1);
  const toPoint = (item, idx, value) => {
    const x = sorted.length === 1 ? w / 2 : pad + idx * ((w - pad * 2) / (sorted.length - 1));
    const y = h - pad - ((value - min) / span) * (h - pad * 2);
    return { x, y, item, value };
  };
  const points = sorted.map((item, idx) => toPoint(item, idx, item.revenue));
  const comparisonPoints = compareSets.map(set => ({
    ...set,
    points: sorted.map((item, idx) => {
      const comparable = set.map.get(item.name);
      return comparable ? toPoint({ ...comparable, currentDate: item.name }, idx, comparable.revenue) : null;
    }).filter(Boolean)
  }));
  const d = points.map((p, idx) => `${idx ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const comparePaths = comparisonPoints.map(set => ({
    ...set,
    d: set.points.map((p, idx) => `${idx ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }));
  const area = `${d} L ${points.at(-1).x.toFixed(1)} ${h - pad} L ${points[0].x.toFixed(1)} ${h - pad} Z`;
  const labels = points.filter((_, idx) => idx === 0 || idx === points.length - 1 || idx % Math.ceil(points.length / 6) === 0);
  const summary = compareSets.map(set => {
    const current = sorted.reduce((acc, item) => acc + item.revenue, 0);
    const previous = sorted.reduce((acc, item) => acc + (set.map.get(item.name)?.revenue || 0), 0);
    const diff = current - previous;
    return { ...set, current, previous, diff };
  });
  el.innerHTML = `<div class="legend daily-compare-legend"><span><i style="background:#6f6a3d"></i>Actual</span>${compareSets.map(set => `<span><i style="background:${set.color}"></i>${escapeHtml(set.label)}</span>`).join('')}</div>
  ${summary.length ? `<div class="daily-compare-summary">
    ${summary.map(item => `<article class="${item.diff >= 0 ? 'up' : 'down'}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${item.previous ? `${item.diff >= 0 ? '+' : ''}${money2.format(item.diff)}` : 'sin base'}</strong>
      <small>${item.previous ? `${item.diff >= 0 ? '+' : ''}${percent.format(item.diff / item.previous)} vs ${money2.format(item.previous)}` : 'No hay data comparable'}</small>
    </article>`).join('')}
  </div>` : `<div class="daily-compare-note">Mostrando únicamente la venta diaria del periodo filtrado.</div>`}
  <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Tendencia diaria">
    <path d="${area}" fill="rgba(20,108,99,.12)"></path>
    ${comparePaths.map(set => set.d ? `<path d="${set.d}" fill="none" stroke="${set.color}" stroke-width="3" stroke-dasharray="${set.dash || 'none'}" stroke-linecap="round"></path>` : '').join('')}
    <path d="${d}" fill="none" stroke="#6f6a3d" stroke-width="3" stroke-linecap="round"></path>
    ${comparisonPoints.map(set => set.points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${set.color}"><title>${set.label} ${p.item.name}: ${money2.format(p.value)}</title></circle>`).join('')).join('')}
    ${points.map(p => {
      const details = compareSets.map(set => {
        const comparable = set.map.get(p.item.name);
        return `${set.label}|${comparable?.name || ''}|${comparable ? money2.format(comparable.revenue) : 'sin data'}|${comparable?.tx || 0}`;
      }).join('~~');
      return `<circle class="line-point" cx="${p.x}" cy="${p.y}" r="5" fill="#6f6a3d" data-date="${escapeHtml(p.item.name)}" data-sales="${escapeHtml(money2.format(p.item.revenue))}" data-tx="${p.item.tx}" data-compare="${escapeHtml(details)}"><title>${p.item.name}: ${money2.format(p.item.revenue)}</title></circle>`;
    }).join('')}
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#ddd8d0"></line>
    ${labels.map(p => `<text x="${p.x}" y="${h - 8}" text-anchor="middle" class="axis">${p.item.name.slice(5)}</text>`).join('')}
    <text x="${pad}" y="18" class="axis">${money.format(max)}</text>
  </svg>`;
  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  el.appendChild(tooltip);
  el.querySelectorAll('.line-point').forEach(point => {
    point.addEventListener('mouseenter', () => {
      tooltip.hidden = false;
      const compareHtml = (point.dataset.compare || '').split('~~').filter(Boolean).map(raw => {
        const [label, date, sales, tx] = raw.split('|');
        return `<br><strong>${escapeHtml(label)} ${escapeHtml(date || '')}</strong>${escapeHtml(sales)}<br>${number.format(Number(tx || 0))} transacciones`;
      }).join('');
      tooltip.innerHTML = `<strong>${point.dataset.date}</strong>Actual: ${point.dataset.sales}<br>${number.format(Number(point.dataset.tx))} transacciones${compareHtml}`;
    });
    point.addEventListener('mousemove', event => {
      const rect = el.getBoundingClientRect();
      tooltip.style.left = `${event.clientX - rect.left}px`;
      tooltip.style.top = `${event.clientY - rect.top}px`;
    });
    point.addEventListener('mouseleave', () => {
      tooltip.hidden = true;
    });
  });
}

function renderAnnualTrend(target, records) {
  const el = document.querySelector(target);
  if (!el) return;
  const items = aggregate(records, row => row.fecha.slice(0, 4))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  if (!items.length) {
    el.innerHTML = '<div class="empty">Sin datos para este filtro</div>';
    return;
  }
  const w = 920;
  const h = 320;
  const pad = 42;
  const max = Math.max(...items.map(item => item.revenue), 1);
  const barGap = 18;
  const slot = (w - pad * 2) / items.length;
  const barW = Math.max(28, slot - barGap);
  const points = items.map((item, idx) => {
    const x = pad + idx * slot + slot / 2;
    const y = h - pad - (item.revenue / max) * (h - pad * 2);
    return { item, x, y };
  });
  const line = points.map((p, idx) => `${idx ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Tendencia anual de ventas">
    ${[0, 0.25, 0.5, 0.75, 1].map(tick => {
      const y = h - pad - tick * (h - pad * 2);
      return `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="#ebe7df"></line>
        <text x="4" y="${y + 4}" class="axis">${money.format(max * tick)}</text>`;
    }).join('')}
    ${items.map((item, idx) => {
      const x = pad + idx * slot + (slot - barW) / 2;
      const barH = (item.revenue / max) * (h - pad * 2);
      const y = h - pad - barH;
      const color = palette[idx % palette.length];
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="7" fill="${color}" opacity="0.22"></rect>
        <text x="${(x + barW / 2).toFixed(1)}" y="${h - 10}" text-anchor="middle" class="axis">${escapeHtml(item.name)}</text>`;
    }).join('')}
    <path d="${line}" fill="none" stroke="#6f6a3d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
    ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="6" fill="#6f6a3d">
      <title>${p.item.name}: ${money2.format(p.item.revenue)} · ${number.format(p.item.tx)} tx</title>
    </circle>
    <text x="${p.x}" y="${Math.max(16, p.y - 12)}" text-anchor="middle" class="annual-label">${money.format(p.item.revenue)}</text>`).join('')}
  </svg>`;
}

function renderExecutiveMonthlyComparison(target) {
  const el = document.querySelector(target);
  if (!el) return;
  const scoped = comparableScopeRecords().filter(row => !normalizeText(row.cliente).includes('bigbox'));
  const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthKeys = monthLabels.map((_, idx) => String(idx + 1).padStart(2, '0'));
  const valueFor = (year, month) => sum(scoped.filter(row => row.mes === `${year}-${month}`));
  const items = monthKeys.map((month, idx) => ({
    label: monthLabels[idx],
    current: valueFor('2026', month),
    previous: valueFor('2025', month)
  }));
  const max = Math.max(...items.flatMap(item => [item.current, item.previous]), 1);
  const w = 860;
  const h = 360;
  const pad = 48;
  const slot = (w - pad * 2) / items.length;
  const barW = Math.max(18, slot * 0.36);
  const y = value => h - pad - (value / max) * (h - pad * 2);
  const currentPoints = items.map((item, idx) => ({ x: pad + idx * slot + slot / 2, y: y(item.current), value: item.current, item }));
  const previousPoints = items.map((item, idx) => ({ x: pad + idx * slot + slot / 2, y: y(item.previous), value: item.previous, item }));
  const line = points => points.map((p, idx) => `${idx ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const june = items[5];
  const juneDelta = june.previous ? (june.current - june.previous) / june.previous : 0;
  el.innerHTML = `<div class="exec-chart-summary">
      <span>Venta operativa junio</span>
      <strong>${money2.format(june.current)}</strong>
      <small>${june.previous ? `${juneDelta >= 0 ? '+' : ''}${percent.format(juneDelta)} vs junio 2025` : 'sin base junio 2025'}</small>
    </div>
    <div class="legend"><span><i style="background:#6f6a3d"></i>2026</span><span><i style="background:#d9c293"></i>2025</span></div>
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolucion mensual 2025 vs 2026">
      ${[0, 0.25, 0.5, 0.75, 1].map(tick => {
        const yy = h - pad - tick * (h - pad * 2);
        return `<line x1="${pad}" y1="${yy}" x2="${w - pad}" y2="${yy}" stroke="#ece4d8"></line>
          <text x="4" y="${yy + 4}" class="axis">${money.format(max * tick)}</text>`;
      }).join('')}
      ${items.map((item, idx) => {
        const cx = pad + idx * slot + slot / 2;
        const prevH = (item.previous / max) * (h - pad * 2);
        const currH = (item.current / max) * (h - pad * 2);
        return `<rect x="${(cx - barW - 2).toFixed(1)}" y="${(h - pad - prevH).toFixed(1)}" width="${barW.toFixed(1)}" height="${prevH.toFixed(1)}" rx="5" fill="#d9c293" opacity="0.72"></rect>
          <rect x="${(cx + 2).toFixed(1)}" y="${(h - pad - currH).toFixed(1)}" width="${barW.toFixed(1)}" height="${currH.toFixed(1)}" rx="5" fill="#6f6a3d" opacity="0.94"></rect>
          <text x="${cx.toFixed(1)}" y="${h - 12}" text-anchor="middle" class="axis">${item.label}</text>`;
      }).join('')}
      <path d="${line(previousPoints)}" fill="none" stroke="#b7995c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"></path>
      <path d="${line(currentPoints)}" fill="none" stroke="#6f6a3d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      ${currentPoints.map((p, idx) => `<circle cx="${p.x}" cy="${p.y}" r="${idx === 5 ? 7 : 4}" fill="#6f6a3d"><title>${p.item.label} 2026: ${money2.format(p.value)}</title></circle>`).join('')}
      ${previousPoints.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#b7995c"><title>${p.item.label} 2025: ${money2.format(p.value)}</title></circle>`).join('')}
    </svg>`;
}

function lifecycleColor(key) {
  return {
    nuevo: '#0f7a50',
    continuidad: '#b7995c',
    reactivacion: '#7a5f52',
    resurreccion: '#8e3f31'
  }[key] || '#e1d4bf';
}

function renderExecutiveSummaryCards(records) {
  const el = document.querySelector('#executiveSummaryCards');
  if (!el) return;
  const compare = comparableRecordsForCurrent(records);
  const lifecycleCompareRows = lifecycleSalesBreakdown(sameMonthLastYearRecords(records));
  const lifecycleCompareByKey = new Map(lifecycleCompareRows.map(row => [row.key, row]));
  const lifecycle = lifecycleSalesBreakdown(records);
  const totalRevenue = sum(records);
  const storeCards = aggregate(records, row => row.sede)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
    .map(item => {
      const lyRows = compare.filter(row => row.sede === item.name);
      const topService = aggregate(item.rows, row => row.categoria).sort((a, b) => b.revenue - a.revenue)[0];
      return {
        type: 'store',
        title: item.name,
        revenue: item.revenue,
        delta: deltaText(item.revenue, sum(lyRows), money.format),
        ticket: item.avgTicket,
        clients: item.clients,
        top: topService?.name || '-'
      };
    });
  const lifecycleTotal = lifecycle.reduce((acc, row) => acc + row.venta, 0);
  const lifecycleRows = lifecycle.map(row => ({
    key: row.key,
    label: row.label,
    value: row.venta,
    tx: row.tx,
    clients: row.clientes.size,
    previous: lifecycleCompareByKey.get(row.key)?.venta || 0,
    share: lifecycleTotal ? row.venta / lifecycleTotal : 0
  }));
  const lifecycleBottleneck = lifecycleRows
    .map(row => ({ ...row, diff: row.value - row.previous }))
    .sort((a, b) => a.diff - b.diff)[0];
  let offset = 0;
  const donutSegments = lifecycleRows.map(row => {
    const start = offset;
    const end = offset + row.share;
    offset = end;
    return `${lifecycleColor(row.key)} ${Math.max(0, start * 100).toFixed(2)}% ${Math.min(100, end * 100).toFixed(2)}%`;
  }).join(', ');
  el.innerHTML = `${storeCards.map(card => `<article class="exec-summary-card">
      <span class="exec-summary-kicker">${escapeHtml(card.title)}</span>
      <strong>${money2.format(card.revenue)}</strong>
      <small>${escapeHtml(card.delta)}</small>
      <div class="exec-summary-meta">
        <p><span>Ticket prom.</span><b>${money2.format(card.ticket)}</b></p>
        <p><span>Clientes únicos</span><b>${number.format(card.clients)}</b></p>
        <p><span>Top servicio</span><b>${escapeHtml(card.top)}</b></p>
      </div>
    </article>`).join('')}
    <article class="exec-summary-card lifecycle-exec-card">
      <div class="lifecycle-exec-head">
        <div>
          <span class="exec-summary-kicker">Lifecycle del mes</span>
          <strong>${money2.format(lifecycleTotal)}</strong>
          <small>${lifecycleBottleneck && lifecycleBottleneck.diff < 0 ? `Cuello de botella: ${lifecycleBottleneck.label} cae ${money2.format(Math.abs(lifecycleBottleneck.diff))} vs mismo periodo LY.` : 'Sin caída de lifecycle vs mismo periodo LY.'}</small>
        </div>
        <div class="lifecycle-donut" style="background:conic-gradient(${donutSegments || '#e6dac5 0 100%'})">
          <span>${number.format(lifecycleRows.reduce((acc, row) => acc + row.clients, 0))}<small>clientes</small></span>
        </div>
      </div>
      <div class="lifecycle-stage-grid">
        ${lifecycleRows.map(row => `<div class="lifecycle-stage lifecycle-${row.key}">
          <span>${escapeHtml(row.label)}</span>
          <strong>${money2.format(row.value)}</strong>
          <em class="lifecycle-stage-delta ${row.previous ? (row.value >= row.previous ? 'up' : 'down') : 'flat'}">${row.previous ? `${row.value >= row.previous ? '+' : ''}${percent.format((row.value - row.previous) / row.previous)} vs LY` : 'sin base LY'}</em>
          <small>${percent.format(row.share)} · ${number.format(row.tx)} tx · ${number.format(row.clients)} clientes<br>LY: ${money2.format(row.previous)}</small>
          <i><b style="width:${Math.max(4, row.share * 100).toFixed(1)}%"></b></i>
        </div>`).join('')}
      </div>
    </article>`;
}

function monthDisplay(value) {
  const hit = rawRecords.find(row => row.mes === value);
  if (!hit) return value;
  return hit.mesNombre || value;
}

function renderTopMonths(target) {
  const el = document.querySelector(target);
  if (!el) return;
  const scoped = comparableScopeRecords();
  const items = aggregate(scoped, row => row.mes)
    .filter(item => item.name)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .map((item, idx) => {
      const stores = aggregate(item.rows, row => row.sede).sort((a, b) => b.revenue - a.revenue);
      const advisors = aggregate(item.rows, row => row.asesora).sort((a, b) => b.revenue - a.revenue);
      const dates = uniqueSorted(item.rows, 'fecha');
      const dailyAvg = dates.length ? item.revenue / dates.length : 0;
      return {
        ...item,
        rank: idx + 1,
        label: monthDisplay(item.name),
        store: stores[0]?.name || '-',
        advisor: advisors[0]?.name || '-',
        dailyAvg
      };
    });

  if (!items.length) {
    el.innerHTML = '<div class="empty">Sin meses para este filtro</div>';
    return;
  }

  const max = Math.max(...items.map(item => item.revenue), 1);
  el.innerHTML = items.map((item, idx) => {
    const width = Math.max(8, (item.revenue / max) * 100);
    const tone = ['emerald', 'amber', 'violet', 'blue'][idx % 4];
    return `<article class="top-month-card ${tone}">
      <div class="top-month-rank">#${item.rank}</div>
      <div class="top-month-body">
        <span>${escapeHtml(item.label)}</span>
        <strong>${money2.format(item.revenue)}</strong>
        <div class="top-month-bar"><i style="width:${width.toFixed(1)}%"></i></div>
        <small>${number.format(item.tx)} tx · ${number.format(item.clients)} clientes · prom. diario ${money.format(item.dailyAvg)}</small>
        <em>${escapeHtml(item.store)} lidera · ${escapeHtml(item.advisor)} top asesora</em>
      </div>
    </article>`;
  }).join('');
}

function renderNewClientsByYear(target, records) {
  const el = document.querySelector(target);
  if (!el) return;
  const firstByClient = new Map();
  for (const tx of transactionRows(comparableScopeRecords())) {
    if (!tx.cliente || tx.cliente === 'Sin cliente') continue;
    if (state.sede !== 'all' && tx.sede !== state.sede) continue;
    const key = uniqueCustomerKey(tx);
    if (!firstByClient.has(key) || tx.fecha < firstByClient.get(key)) firstByClient.set(key, tx.fecha);
  }
  const byYear = new Map();
  for (const firstDate of firstByClient.values()) {
    const year = firstDate.slice(0, 4);
    byYear.set(year, (byYear.get(year) || 0) + 1);
  }
  const items = [...byYear.entries()]
    .map(([name, clientes]) => ({ name, clientes, revenue: clientes, tx: clientes }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!items.length) {
    el.innerHTML = '<div class="empty">Sin clientes para este filtro</div>';
    return;
  }
  const w = 920;
  const h = 320;
  const pad = 42;
  const max = Math.max(...items.map(item => item.clientes), 1);
  const barGap = 18;
  const slot = (w - pad * 2) / items.length;
  const barW = Math.max(28, slot - barGap);
  const points = items.map((item, idx) => {
    const x = pad + idx * slot + slot / 2;
    const y = h - pad - (item.clientes / max) * (h - pad * 2);
    return { item, x, y };
  });
  const line = points.map((p, idx) => `${idx ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Clientes nuevos por año">
    ${[0, 0.25, 0.5, 0.75, 1].map(tick => {
      const y = h - pad - tick * (h - pad * 2);
      return `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="#ebe7df"></line>
        <text x="4" y="${y + 4}" class="axis">${number.format(max * tick)}</text>`;
    }).join('')}
    ${items.map((item, idx) => {
      const x = pad + idx * slot + (slot - barW) / 2;
      const barH = (item.clientes / max) * (h - pad * 2);
      const y = h - pad - barH;
      const color = palette[(idx + 2) % palette.length];
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="7" fill="${color}" opacity="0.22"></rect>
        <text x="${(x + barW / 2).toFixed(1)}" y="${h - 10}" text-anchor="middle" class="axis">${escapeHtml(item.name)}</text>`;
    }).join('')}
    <path d="${line}" fill="none" stroke="#0e4f99" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
    ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="6" fill="#0e4f99">
      <title>${p.item.name}: ${number.format(p.item.clientes)} clientes nuevos</title>
    </circle>
    <text x="${p.x}" y="${Math.max(16, p.y - 12)}" text-anchor="middle" class="annual-label">${number.format(p.item.clientes)}</text>`).join('')}
  </svg>`;
}

function renderJuneYoy() {
  const el = document.querySelector('#juneYoy');
  if (!el) return;
  const scoped = comparableScopeRecords();
  const current = scoped.filter(row => row.mes === '2026-06');
  const previous = scoped.filter(row => row.mes === '2025-06');
  if (!current.length && !previous.length) {
    el.innerHTML = '<div class="empty">Sin datos para junio 2025/2026 bajo estos filtros</div>';
    return;
  }
  const currentRevenue = sum(current);
  const previousRevenue = sum(previous);
  const currentTx = txCount(current);
  const previousTx = txCount(previous);
  const currentClients = clientCount(current);
  const previousClients = clientCount(previous);
  const currentDays = new Set(current.map(row => row.fecha)).size;
  const previousDays = new Set(previous.map(row => row.fecha)).size;
  const currentTicket = currentTx ? currentRevenue / currentTx : 0;
  const previousTicket = previousTx ? previousRevenue / previousTx : 0;
  const currentDaily = currentDays ? currentRevenue / currentDays : 0;
  const previousDaily = previousDays ? previousRevenue / previousDays : 0;
  const delta = currentRevenue - previousRevenue;
  const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const metricCards = [
    ['Venta junio', money2.format(currentRevenue), deltaText(currentRevenue, previousRevenue, money2.format)],
    ['Transacciones', number.format(currentTx), deltaText(currentTx, previousTx, number.format)],
    ['Clientes únicos', number.format(currentClients), deltaText(currentClients, previousClients, number.format)],
    ['Ticket promedio', money2.format(currentTicket), deltaText(currentTicket, previousTicket, money2.format)],
    ['Venta diaria', money2.format(currentDaily), `${deltaText(currentDaily, previousDaily, money2.format)} · ${currentDays} días`]
  ];

  const driverRows = [
    ['Sede', aggregate(current, row => row.sede), aggregate(previous, row => row.sede)],
    ['Categoría', aggregate(current, row => row.categoria), aggregate(previous, row => row.categoria)],
    ['Asesora', aggregate(current, row => row.asesora), aggregate(previous, row => row.asesora)]
  ].map(([label, nowItems, lyItems]) => {
    const lyMap = new Map(lyItems.map(item => [item.name, item]));
    const rows = nowItems.map(item => ({
      name: item.name,
      current: item.revenue,
      previous: lyMap.get(item.name)?.revenue || 0,
      delta: item.revenue - (lyMap.get(item.name)?.revenue || 0)
    })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return { label, rows: rows.slice(0, 3) };
  });

  const insight = previousRevenue
    ? `Junio 2026 está ${money2.format(Math.abs(delta))} ${delta >= 0 ? 'por encima' : 'por debajo'} de junio 2025 (${deltaText(currentRevenue, previousRevenue, money2.format)}).`
    : 'Junio 2025 no tiene base suficiente para este filtro.';

  el.innerHTML = `
    <div class="june-yoy-summary ${deltaClass}">
      <span>Lectura rápida</span>
      <strong>${insight}</strong>
      <small>Se respeta sede, asesora, categoría y cliente si están filtrados; el comparativo siempre usa el mes completo de junio.</small>
    </div>
    <div class="june-yoy-cards">
      ${metricCards.map(([label, value, note]) => `<article>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(note)}</small>
      </article>`).join('')}
    </div>
    <div class="june-yoy-drivers">
      ${driverRows.map(group => `<article>
        <span>${escapeHtml(group.label)}</span>
        ${group.rows.length ? group.rows.map(row => `<p>
          <strong>${escapeHtml(row.name)}</strong>
          <em>${money2.format(row.current)} vs ${money2.format(row.previous)} · ${row.delta >= 0 ? '+' : ''}${money2.format(row.delta)}</em>
        </p>`).join('') : '<p><strong>Sin data</strong><em>No hay registros comparables</em></p>'}
      </article>`).join('')}
    </div>`;
}

function renderTable(target, columns, rows) {
  const el = document.querySelector(target);
  if (!rows.length) {
    el.innerHTML = '<tbody><tr><td>Sin datos para este filtro</td></tr></tbody>';
    return;
  }
  const head = `<thead><tr>${columns.map(col => `<th class="${col.num ? 'num' : ''} col-${col.key}">${col.label}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${rows.map((row, rowIndex) => `<tr class="row-rank-${rowIndex + 1}">${columns.map(col => {
    const value = col.format ? col.format(row[col.key], row) : row[col.key];
    return `<td class="${col.num ? 'num' : ''} col-${col.key}">${escapeHtml(value)}</td>`;
  }).join('')}</tr>`).join('')}</tbody>`;
  el.innerHTML = head + body;
}

function renderAdvisorHighlights(rows) {
  const el = document.querySelector('#advisorHighlights');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '';
    return;
  }
  const topTotal = [...rows].sort((a, b) => b.venta - a.venta)[0];
  const topNew = [...rows].sort((a, b) => b.nuevos - a.nuevos)[0];
  const topRepeat = [...rows].sort((a, b) => b.recompra - a.recompra)[0];
  const topContacts = [...rows].sort((a, b) => b.chatContactos - a.chatContactos)[0];
  const totalRevenue = rows.reduce((acc, row) => acc + Number(row.venta || 0), 0);
  const cards = [
    ['Líder total', topTotal.asesora, money2.format(topTotal.venta), `${percent.format(totalRevenue ? topTotal.venta / totalRevenue : 0)} del filtro`],
    ['Cierra nuevos', topNew.asesora, money2.format(topNew.nuevos), 'Mejor aporte en clientes nuevos'],
    ['Continuidad', topRepeat.asesora, money2.format(topRepeat.recompra), 'Mejor recompra <90 días'],
    ['Más conversaciones', topContacts.asesora, number.format(topContacts.chatContactos || 0), 'Contactos reportados en PDFs']
  ];
  el.innerHTML = cards.map(([label, name, value, note], index) => `
    <article class="advisor-highlight-card h-${index + 1}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(name)}</strong>
      <em>${escapeHtml(value)}</em>
      <small>${escapeHtml(note)}</small>
    </article>
  `).join('');
}

function renderAdvisorDrivers(rows) {
  const el = document.querySelector('#advisorDrivers');
  if (!el) return;
  const salesRows = rows.filter(row => !customerSuccessAdvisors.has(row.asesora));
  if (salesRows.length < 2) {
    el.innerHTML = '';
    return;
  }
  const topBy = (key, filter = () => true) => [...salesRows].filter(filter).sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))[0];
  const leaders = [
    ['Mayor venta', topBy('venta'), row => money2.format(row.venta), 'Venta total del filtro'],
    ['Mejor conversión', topBy('chatConversion', row => row.chatContactos > 0), row => percent.format(row.chatConversion || 0), 'Tx / contactos chat'],
    ['Mayor volumen', topBy('tx'), row => `${number.format(row.tx)} tx`, 'Cantidad de ventas cerradas'],
    ['Mayor ticket', topBy('ticket'), row => money2.format(row.ticket), 'Ticket promedio'],
    ['Más nuevos', topBy('nuevos'), row => money2.format(row.nuevos), 'Venta a clientes nuevos'],
    ['Más contactos chat', topBy('chatContactos'), row => number.format(row.chatContactos || 0), 'Contactos reportados en PDFs']
  ].filter(([, row]) => row);
  const csNames = rows.filter(row => customerSuccessAdvisors.has(row.asesora)).map(row => row.asesora);
  el.innerHTML = `<div class="advisor-driver-head">
    <div>
      <span>Lectura comercial por driver</span>
      <strong>Quién lidera cada palanca de venta</strong>
    </div>
    <small>${csNames.length ? `CS fuera de este bloque: ${escapeHtml(csNames.join(', '))}` : 'Solo asesoras comerciales.'}</small>
  </div>
  <div class="advisor-driver-grid">
    ${leaders.map(([label, row, valueFn, note], index) => {
      return `<article class="advisor-driver-card h-${index + 1}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(row.asesora)}</strong>
        <em>${escapeHtml(valueFn(row))}</em>
        <small>${escapeHtml(note)}</small>
      </article>`;
    }).join('')}
  </div>`;
}

function advisorQualitySummaryMap() {
  const rows = qualityFilterBaseRecords();
  const map = new Map();
  for (const [asesora, qRows] of groupBy(rows, row => row.asesora)) {
    const contactos = qRows.reduce((acc, row) => acc + Number(row.contactos || 0), 0);
    const recontactos = qRows.reduce((acc, row) => acc + Number(row.recontactos || 0), 0);
    map.set(asesora, {
      chatContactos: contactos,
      chatRecontactos: recontactos,
      chatScore: avg(qRows.map(row => row.score)) * 10,
      chatRespMin: avg(qRows.map(row => row.respAvgMin)),
      chatRecontactRate: contactos ? recontactos / contactos : 0,
      chatCta: avg(qRows.map(row => row.ctaClear)),
      chatDiscovery: avg(qRows.map(row => row.discoveryHigh)),
      chatInfoOnly: avg(qRows.map(row => row.infoOnly)),
      chatDead: avg(qRows.map(row => row.deadChat))
    });
  }
  return map;
}

function renderExecutiveInsights(records, summary) {
  const el = document.querySelector('#insights');
  if (!records.length) {
    el.innerHTML = '<div class="empty">Sin datos para este filtro</div>';
    return;
  }
  const stores = aggregate(records, row => row.sede).sort((a, b) => b.revenue - a.revenue);
  const advisors = aggregate(records, row => row.asesora).sort((a, b) => b.revenue - a.revenue);
  const cats = aggregate(records, row => row.categoria).sort((a, b) => b.revenue - a.revenue);
  const weekdays = aggregate(records, row => row.diaSemana).sort((a, b) => b.revenue - a.revenue);
  const topStore = stores[0];
  const secondStore = stores[1];
  const topAdvisor = advisors[0];
  const topCat = cats[0];
  const topWeekday = weekdays[0];
  const gap = topStore && secondStore ? topStore.revenue - secondStore.revenue : 0;
  const previous = previousPeriodRecords(records);
  const previousRevenue = sum(previous);
  const previousTx = txCount(previous);
  const previousClients = clientCount(previous);
  const ly = comparableRecordsForCurrent(records);
  const lyRevenue = sum(ly);
  const currentTicket = summary.transactions ? summary.revenue / summary.transactions : 0;
  const previousTicket = previousTx ? previousRevenue / previousTx : 0;
  const lifecycle = lifecycleSalesBreakdown(records);
  const lifecycleMap = Object.fromEntries(lifecycle.map(item => [item.key, item]));
  const quality = qualitySummaryForSalesPeriod(records);
  const topDays = aggregate(records, row => row.fecha).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const lowTicketStore = [...stores].sort((a, b) => a.avgTicket - b.avgTicket)[0];
  const periodLabel = insightPeriodLabel(records);
  const volumeTone = summary.revenue > previousRevenue && currentTicket < previousTicket
    ? 'crece por volumen y clientes, no por ticket'
    : summary.revenue > previousRevenue
      ? 'crece y mantiene una base comercial sana'
      : 'necesita recuperar ritmo comercial';
  const dormantRevenue = (lifecycleMap.reactivacion?.venta || 0) + (lifecycleMap.resurreccion?.venta || 0);
  const kpis = [
    ['Venta', money2.format(summary.revenue), `vs periodo anterior: ${deltaText(summary.revenue, previousRevenue, money2.format)}`],
    ['Transacciones', number.format(summary.transactions), `vs periodo anterior: ${deltaText(summary.transactions, previousTx, number.format)}`],
    ['Clientes', number.format(summary.clients), `vs periodo anterior: ${deltaText(summary.clients, previousClients, number.format)}`],
    ['Ticket', money2.format(currentTicket), `vs periodo anterior: ${deltaText(currentTicket, previousTicket, money2.format)}`]
  ];
  const opportunities = [
    `Subir ticket en ${lowTicketStore?.name || 'la sede con menor ticket'} con upgrades a rituales, paquetes y add-ons antes del cierre.`,
    `${topAdvisor?.name || 'La asesora lider'} concentra ${percent.format(summary.revenue ? topAdvisor.revenue / summary.revenue : 0)} de la venta: documentar su guion de discovery, propuesta y CTA.`,
    `${money2.format(dormantRevenue)} viene de reactivacion/resurreccion: hay una bolsa clara para campanas de base dormida.`
  ];

  el.innerHTML = `<details class="exec-readout">
    <summary>
      <div>
        <span>Lectura general · ${escapeHtml(periodLabel)}</span>
        <strong>${escapeHtml(periodLabel)} ${escapeHtml(volumeTone)}</strong>
        <small>${lyRevenue ? `${deltaText(summary.revenue, lyRevenue, money2.format)} vs ano pasado` : 'Sin base suficiente de ano pasado'}</small>
      </div>
      <b>Ver analisis</b>
    </summary>
    <div class="exec-body">
      <div class="exec-kpis">
        ${kpis.map(([label, value, note]) => `<article><span>${label}</span><strong>${value}</strong><small>${escapeHtml(note)}</small></article>`).join('')}
      </div>
      <div class="exec-grid">
        <article class="exec-card"><span>Que mejoro</span><p>La venta del periodo llega a ${money2.format(summary.revenue)}. Frente al periodo anterior, el impulso viene de ${number.format(summary.transactions)} transacciones y ${number.format(summary.clients)} clientes; frente al ano pasado, la venta esta ${lyRevenue ? deltaText(summary.revenue, lyRevenue, money2.format) : 'sin base comparable'}.</p></article>
        <article class="exec-card"><span>Lectura por sede</span><p>${secondStore ? `${topStore.name} lidera con ${money2.format(topStore.revenue)} y supera a ${secondStore.name} por ${money2.format(gap)}. ${stores.map(item => `${item.name}: ticket ${money2.format(item.avgTicket)}`).join(' · ')}.` : `${topStore.name} concentra ${money2.format(topStore.revenue)}.`}</p></article>
        <article class="exec-card"><span>Asesoras</span><p>${topAdvisor.name} lidera con ${money2.format(topAdvisor.revenue)} y ${number.format(topAdvisor.tx)} tx. Top 3: ${advisors.slice(0, 3).map(item => `${item.name} (${money.format(item.revenue)})`).join(', ')}.</p></article>
        <article class="exec-card"><span>Lifecycle</span><p>Nuevos: ${money2.format(lifecycleMap.nuevo?.venta || 0)}. Continuidad: ${money2.format(lifecycleMap.continuidad?.venta || 0)}. Reactivacion: ${money2.format(lifecycleMap.reactivacion?.venta || 0)}. Resurreccion: ${money2.format(lifecycleMap.resurreccion?.venta || 0)}.</p></article>
        <article class="exec-card"><span>Calidad de conversaciones</span><p>${quality.rows ? `Score ${number.format(quality.score)}, CTA claro ${number.format(quality.cta)}%, discovery ${number.format(quality.discovery)}%, dead chat ${number.format(quality.dead)}% e info-only ${number.format(quality.info)}%. Contactos auditados: ${number.format(quality.contactos)}.` : 'Sin auditoria de conversaciones para este periodo.'}</p></article>
        <article class="exec-card"><span>Timing comercial</span><p>El dia de semana mas fuerte es ${topWeekday.name}. Los dias pico fueron ${topDays.map(item => `${item.name}: ${money.format(item.revenue)}`).join(', ')}. Mix ganador: ${topCat.name} explica ${percent.format(summary.revenue ? topCat.revenue / summary.revenue : 0)}.</p></article>
      </div>
      <div class="exec-opportunities">
        <strong>Oportunidades de mejora</strong>
        ${opportunities.map(item => `<p>${escapeHtml(item)}</p>`).join('')}
      </div>
    </div>
  </details>`;
}

function renderInsights(records, summary) {
  const el = document.querySelector('#insights');
  if (!records.length) {
    el.innerHTML = '<div class="empty">Sin datos para este filtro</div>';
    return;
  }
  const stores = aggregate(records, row => row.sede).sort((a, b) => b.revenue - a.revenue);
  const advisors = aggregate(records, row => `${row.sede} · ${row.asesora}`).sort((a, b) => b.revenue - a.revenue);
  const cats = aggregate(records, row => row.categoria).sort((a, b) => b.revenue - a.revenue);
  const weekdays = aggregate(records, row => row.diaSemana).sort((a, b) => b.revenue - a.revenue);
  const hours = aggregate(records.filter(row => row.hora !== null), row => `${String(row.hora).padStart(2, '0')}:00`).sort((a, b) => b.revenue - a.revenue);
  const topStore = stores[0];
  const secondStore = stores[1];
  const topAdvisor = advisors[0];
  const topCat = cats[0];
  const topWeekday = weekdays[0];
  const topHour = hours[0];
  const gap = topStore && secondStore ? topStore.revenue - secondStore.revenue : 0;
  const repeatShare = summary.revenue ? summary.repeatRevenue / summary.revenue : 0;
  const lifecycleText = summary.lifecycle.total
    ? `${number.format(summary.lifecycle.nuevos)} transacciones de clientes creados en el periodo filtrado y ${number.format(summary.lifecycle.existentes)} de clientes existentes.`
    : 'No hay cliente suficiente para clasificar nuevos y existentes.';

  const cards = [
    ['Sede líder', secondStore ? `${topStore.name} supera a ${secondStore.name} por ${money2.format(gap)} en el filtro actual.` : `${topStore.name} concentra ${money2.format(topStore.revenue)}.`],
    ['Asesora líder', `${topAdvisor.name} aporta ${money2.format(topAdvisor.revenue)} con ticket promedio de ${money2.format(topAdvisor.avgTicket)}.`],
    ['Mix ganador', `${topCat.name} explica ${percent.format(summary.revenue ? topCat.revenue / summary.revenue : 0)} de la venta filtrada.`],
    ['Timing comercial', `El día más fuerte es ${topWeekday.name}; la hora más potente es ${topHour ? topHour.name : 'sin hora'} con ${topHour ? money2.format(topHour.revenue) : money2.format(0)}.`],
    ['Clientes nuevos', `${lifecycleText} Cruce basado en la Fecha de creacion de la BBDD de clientes.`]
  ];
  el.innerHTML = cards.map(([title, body]) => `<div class="insight"><strong>${title}</strong>${escapeHtml(body)}</div>`).join('');
}

function renderAdvisorRoom(records) {
  const el = document.querySelector('#advisorRoom');
  if (!records.length) {
    el.innerHTML = '<div class="empty">Sin datos para asesoras</div>';
    return;
  }
  const advisors = aggregate(records.filter(row => row.asesora !== 'Sin asesora'), row => row.asesora)
    .sort((a, b) => b.revenue - a.revenue);
  if (!advisors.length) {
    el.innerHTML = '<div class="empty">Sin asesoras para este filtro</div>';
    return;
  }
  if (!state.focusAdvisor || !advisors.some(item => item.name === state.focusAdvisor)) {
    state.focusAdvisor = advisors[0].name;
  }
  const selected = advisors.find(item => item.name === state.focusAdvisor) || advisors[0];
  const avgTicketAll = advisors.reduce((acc, item) => acc + item.avgTicket, 0) / advisors.length;
  const avgCrossAll = advisors.reduce((acc, item) => acc + item.multilineRate, 0) / advisors.length;
  const categories = aggregate(selected.rows, row => row.categoria).sort((a, b) => b.revenue - a.revenue);
  const products = aggregate(selected.rows, row => row.producto).sort((a, b) => b.revenue - a.revenue);
  const stores = aggregate(selected.rows, row => row.sede).sort((a, b) => b.revenue - a.revenue);
  const bestCategory = categories[0];
  const bestProduct = products[0];
  const bestStore = stores[0];
  const ticketGap = selected.avgTicket - avgTicketAll;
  const crossGap = selected.multilineRate - avgCrossAll;
  const nextAdvisor = advisors[advisors.findIndex(item => item.name === selected.name) - 1];
  const gapToNext = nextAdvisor ? Math.max(0, nextAdvisor.revenue - selected.revenue) : 0;
  const targetTicket = Math.max(selected.avgTicket, avgTicketAll) * 1.08;
  const targetCross = Math.max(selected.multilineRate, avgCrossAll) + 0.03;

  const list = advisors.map((item, idx) => `
    <button class="advisor-button ${item.name === selected.name ? 'active' : ''}" type="button" data-advisor="${escapeHtml(item.name)}">
      <strong>${idx + 1}. ${escapeHtml(item.name)}</strong>
      <strong>${money.format(item.revenue)}</strong>
      <small>${number.format(item.tx)} tx · ${money2.format(item.avgTicket)} ticket</small>
      <small>${percent.format(item.multilineRate)} cross</small>
    </button>
  `).join('');

  const coaching = [
    ['Para celebrar', `${selected.name} vendió ${money2.format(selected.revenue)} con ${number.format(selected.tx)} transacciones. Su categoría más fuerte es ${bestCategory?.name || 'sin categoría'} (${money2.format(bestCategory?.revenue || 0)}).`],
    ['Producto ancla', `El producto que más mueve es ${bestProduct?.name || 'sin producto'} (${money2.format(bestProduct?.revenue || 0)}). Úsalo como puerta de entrada para upgrades o paquetes.`],
    ['Oportunidad de ticket', ticketGap >= 0 ? `Está ${money2.format(ticketGap)} sobre el ticket promedio del equipo. Conviene documentar su guion de venta.` : `Está ${money2.format(Math.abs(ticketGap))} debajo del ticket promedio del equipo. Foco: upgrade a ritual o paquete antes de cerrar.`],
    ['Oportunidad de cross-sell', crossGap >= 0 ? `Su cross-sell está ${percent.format(crossGap)} sobre el promedio. Replicar combos que usa.` : `Su cross-sell está ${percent.format(Math.abs(crossGap))} debajo del promedio. Foco: agregar gift card, facial, circuito o bebida en tickets elegibles.`]
  ];

  el.innerHTML = `
    <div>
      <div class="legend"><span><i style="background:#6f6a3d"></i>Ranking por venta</span></div>
      <div class="advisor-list">${list}</div>
    </div>
    <div class="advisor-focus">
      <div class="advisor-hero">
        <h3>${escapeHtml(selected.name)}</h3>
        <div class="mini-kpis">
          <div class="mini-kpi"><span>Venta</span><strong>${money2.format(selected.revenue)}</strong></div>
          <div class="mini-kpi"><span>Ticket</span><strong>${money2.format(selected.avgTicket)}</strong></div>
          <div class="mini-kpi"><span>Cross-sell</span><strong>${percent.format(selected.multilineRate)}</strong></div>
          <div class="mini-kpi"><span>Transacciones</span><strong>${number.format(selected.tx)}</strong></div>
          <div class="mini-kpi"><span>Sede fuerte</span><strong>${escapeHtml(bestStore?.name || '-')}</strong></div>
          <div class="mini-kpi"><span>Rituales</span><strong>${percent.format(selected.ritualShare)}</strong></div>
        </div>
      </div>
      <div class="coaching-list">
        ${coaching.map(([title, body]) => `<div class="coaching-card"><strong>${title}</strong>${escapeHtml(body)}</div>`).join('')}
      </div>
    </div>
    <div class="goal-card">
      <strong>Meta sugerida</strong>
      <p>Próximo foco: ticket de ${money2.format(targetTicket)} y cross-sell de ${percent.format(Math.min(targetCross, 1))}.</p>
      <p>${gapToNext ? `Para alcanzar a la asesora superior en este filtro faltan ${money2.format(gapToNext)}.` : 'Está liderando este filtro. La tarea es sostener mix premium y compartir buenas prácticas.'}</p>
      <p>Preguntas para reunión: ¿qué objeción se repite?, ¿qué ritual logra vender mejor?, ¿qué complemento ofrece antes de cerrar?</p>
    </div>
  `;

  el.querySelectorAll('.advisor-button').forEach(button => {
    button.addEventListener('click', () => {
      state.focusAdvisor = button.dataset.advisor;
      renderDashboard();
    });
  });
}

function customerKey(row) {
  const doc = row.clienteRuc || row.clienteRUC || '';
  if (doc) return `${row.sede}|doc:${doc}`;
  return `${row.sede}|name:${row.cliente.toLocaleLowerCase('es')}`;
}

function hasCustomerIdentity(row) {
  return Boolean(row.cliente && row.cliente !== 'Sin cliente' && (row.clienteRuc || normalizeCustomerName(row.cliente)));
}

function lifecycleCustomerKey(row) {
  if (!hasCustomerIdentity(row)) return `tx:${row.id || txKey(row)}`;
  return uniqueCustomerKey(row);
}

function lifecycleHistoryTransactions() {
  return transactionRows(rawRecords)
    .filter(hasCustomerIdentity)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function uniqueCustomerKey(row) {
  const doc = row.clienteRuc || row.clienteRUC || '';
  if (doc) return `doc:${doc}`;
  return `name:${normalizeCustomerName(row.cliente)}`;
}

function normalizeCustomerName(value) {
  return String(value || '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function median(values) {
  const clean = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function avg(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0;
}

function corr(xs, ys) {
  const pairs = xs.map((x, i) => [Number(x), Number(ys[i])]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 3) return null;
  const mx = avg(pairs.map(p => p[0]));
  const my = avg(pairs.map(p => p[1]));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

function corrLabel(value) {
  if (value === null) return 'sin data';
  const abs = Math.abs(value);
  if (abs >= 0.65) return value > 0 ? 'alta +' : 'alta -';
  if (abs >= 0.35) return value > 0 ? 'media +' : 'media -';
  if (abs >= 0.15) return value > 0 ? 'baja +' : 'baja -';
  return 'débil';
}

function pctValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n / 100 : 0;
}

function qualityCardClass(label, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 'blue';
  if (label.includes('Info') || label.includes('Dead')) {
    if (v <= 20) return 'good';
    if (v <= 35) return 'warn';
    return 'bad';
  }
  if (label.includes('SLA') || label.includes('CTA') || label.includes('Score')) {
    if (v >= 75) return 'good';
    if (v >= 60) return 'warn';
    return 'bad';
  }
  if (label.includes('Discovery')) {
    if (v >= 25) return 'good';
    if (v >= 15) return 'warn';
    return 'bad';
  }
  return 'blue';
}

function shortRangeLabel(start, end) {
  if (!start || !end) return '';
  return `${shortDate.format(parseDate(start))}-${shortDate.format(parseDate(end))}`;
}

function aggregateQualityByAdvisor(records) {
  return groupBy(records, row => row.asesora).map(([asesora, rows]) => ({
    asesora,
    rows,
    scorePct: avg(rows.map(row => row.score)) * 10,
    infoOnly: avg(rows.map(row => row.infoOnly)),
    deadChat: avg(rows.map(row => row.deadChat)),
    ctaClear: avg(rows.map(row => row.ctaClear)),
    discoveryHigh: avg(rows.map(row => row.discoveryHigh)),
    sla15: avg(rows.map(row => row.sla15)),
    contactos: rows.reduce((acc, row) => acc + Number(row.contactos || 0), 0),
    recontactos: rows.reduce((acc, row) => acc + Number(row.recontactos || 0), 0),
    revenue: rows.reduce((acc, row) => acc + Number(row.revenue || 0), 0),
    tx: rows.reduce((acc, row) => acc + Number(row.tx || 0), 0)
  })).sort((a, b) => b.revenue - a.revenue || b.scorePct - a.scorePct);
}

function aggregateQualityByWeek(records) {
  return groupBy(records, row => `${row.weekStart}|${row.weekEnd}`).map(([key, rows]) => {
    const [weekStart, weekEnd] = key.split('|');
    return {
      weekStart,
      weekEnd,
      label: shortRangeLabel(weekStart, weekEnd),
      scorePct: avg(rows.map(row => row.score)) * 10,
      infoOnly: avg(rows.map(row => row.infoOnly)),
      deadChat: avg(rows.map(row => row.deadChat)),
      ctaClear: avg(rows.map(row => row.ctaClear)),
      discoveryHigh: avg(rows.map(row => row.discoveryHigh)),
      sla15: avg(rows.map(row => row.sla15)),
      revenue: rows.reduce((acc, row) => acc + Number(row.revenue || 0), 0),
      contactos: rows.reduce((acc, row) => acc + Number(row.contactos || 0), 0),
      recontactos: rows.reduce((acc, row) => acc + Number(row.recontactos || 0), 0)
    };
  }).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

function renderQualityRanking(items) {
  if (!items.length) return '<div class="empty">Sin asesoras para este filtro</div>';
  const maxRevenue = Math.max(...items.map(item => item.revenue), 1);
  return `<div class="quality-ranking">
    ${items.map((item, index) => {
      const color = palette[index % palette.length];
      const width = Math.max(3, item.revenue / maxRevenue * 100);
      return `<div class="quality-rank-row">
        <div class="rank-number">${index + 1}</div>
        <div class="rank-name" title="${escapeHtml(item.asesora)}">${escapeHtml(item.asesora)}</div>
        <div>
          <div class="rank-track"><div class="rank-fill" style="width:${width}%;background:${color}"></div></div>
          <div class="rank-meta">Score ${percent.format(pctValue(item.scorePct))} · CTA ${percent.format(pctValue(item.ctaClear))} · Info ${percent.format(pctValue(item.infoOnly))}</div>
        </div>
        <div class="rank-value">${money.format(item.revenue)}<br>${number.format(item.tx)} tx</div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderQualityDonuts(kpis) {
  const colors = {
    'CTA claro': '#1f8a62',
    'Discovery alto': '#0e4f99',
    'Info-only': '#d98400',
    'Dead chat': '#d23b35'
  };
  const selected = kpis.filter(([label]) => Object.prototype.hasOwnProperty.call(colors, label));
  return `<div class="quality-donuts">
    ${selected.map(([label, value, note]) => {
      const pct = Math.max(0, Math.min(100, Number(value) || 0));
      const color = colors[label];
      return `<div class="donut-card">
        <div class="donut" data-value="${escapeHtml(percent.format(pct / 100))}" style="background:conic-gradient(${color} 0 ${pct}%, #ebe7df ${pct}% 100%)"></div>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(note)}</small>
      </div>`;
    }).join('')}
  </div>`;
}

function renderQualityTrend(items) {
  if (!items.length) return '<div class="empty">Sin tendencia para este filtro</div>';
  const w = 760;
  const h = 300;
  const pad = 38;
  const series = [
    { key: 'scorePct', label: 'Score', color: '#1f67b5' },
    { key: 'ctaClear', label: 'CTA', color: '#1f8a62' },
    { key: 'infoOnly', label: 'Info-only', color: '#d98400' },
    { key: 'deadChat', label: 'Dead chat', color: '#d23b35' }
  ];
  const x = idx => items.length === 1 ? w / 2 : pad + idx * ((w - pad * 2) / (items.length - 1));
  const y = value => h - pad - (Math.max(0, Math.min(100, Number(value) || 0)) / 100) * (h - pad * 2);
  const path = key => items.map((item, idx) => `${idx ? 'L' : 'M'} ${x(idx).toFixed(1)} ${y(item[key]).toFixed(1)}`).join(' ');
  const labels = items.filter((_, idx) => idx === 0 || idx === items.length - 1 || idx % Math.ceil(items.length / 5) === 0);
  return `<div class="quality-trend">
    <div class="trend-legend">
      ${series.map(item => `<span style="color:${item.color}"><i></i>${item.label}</span>`).join('')}
    </div>
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Tendencia semanal de calidad">
      ${[0, 25, 50, 75, 100].map(tick => `
        <line x1="${pad}" y1="${y(tick)}" x2="${w - pad}" y2="${y(tick)}" stroke="#ebe7df"></line>
        <text x="4" y="${y(tick) + 4}" class="axis">${tick}%</text>
      `).join('')}
      ${series.map(item => `<path d="${path(item.key)}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>`).join('')}
      ${series.map(item => items.map((week, idx) => `
        <circle cx="${x(idx)}" cy="${y(week[item.key])}" r="4" fill="#fff" stroke="${item.color}" stroke-width="3">
          <title>${week.label} · ${item.label}: ${percent.format(pctValue(week[item.key]))} · Venta ${money2.format(week.revenue)}</title>
        </circle>
      `).join('')).join('')}
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#ddd8d0"></line>
      ${labels.map((item, idx) => `<text x="${x(items.indexOf(item))}" y="${h - 10}" text-anchor="${idx === 0 ? 'start' : idx === labels.length - 1 ? 'end' : 'middle'}" class="axis">${escapeHtml(item.label)}</text>`).join('')}
    </svg>
  </div>`;
}

function renderQualityMetricCards(rows) {
  const contacts = rows.reduce((acc, row) => acc + Number(row.contactos || 0), 0);
  const recontacts = rows.reduce((acc, row) => acc + Number(row.recontactos || 0), 0);
  const revenue = rows.reduce((acc, row) => acc + Number(row.revenue || 0), 0);
  const tx = rows.reduce((acc, row) => acc + Number(row.tx || 0), 0);
  const metrics = [
    ['Resp. promedio', `${number.format(avg(rows.map(row => row.respAvgMin)))} min`, 'Velocidad media de respuesta en chats auditados.'],
    ['Fuera de horario', percent.format(pctValue(avg(rows.map(row => row.outOoh)))), 'Peso de conversaciones fuera del horario ideal.'],
    ['Tasa recontacto', percent.format(contacts ? recontacts / contacts : 0), `${number.format(recontacts)} recontactos sobre ${number.format(contacts)} contactos.`],
    ['Venta/contacto', money2.format(contacts ? revenue / contacts : 0), 'Ingreso asociado por conversación auditada.'],
    ['Tx/contacto', percent.format(contacts ? tx / contacts : 0), `${number.format(tx)} ventas relacionadas al periodo de calidad.`],
    ['Ticket chat', money2.format(tx ? revenue / tx : 0), 'Ticket promedio de ventas cruzadas con la semana/asesora filtrada.']
  ];
  return `<div class="quality-extra-kpis">
    ${metrics.map(([label, value, note]) => `
      <article class="quality-mini-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(note)}</small>
      </article>
    `).join('')}
  </div>`;
}

function bindQualityFilters() {
  const weekSelect = document.querySelector('#qualityWeekFilter');
  const advisorSelect = document.querySelector('#qualityAdvisorFilter');
  if (!weekSelect || !advisorSelect) return;
  weekSelect.addEventListener('change', event => {
    state.qualityWeek = event.target.value;
    renderDashboard();
  });
  advisorSelect.addEventListener('change', event => {
    state.qualityAdvisor = event.target.value;
    renderDashboard();
  });
}

function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

function renderCustomerGrowth(records) {
  const el = document.querySelector('#customerGrowth');
  const scoped = comparableScopeRecords();
  const currentDates = uniqueSorted(records, 'fecha');
  if (!currentDates.length) {
    el.innerHTML = '<div class="empty">Sin datos de clientes para este filtro</div>';
    return;
  }
  const periodStart = currentDates[0];
  const periodEnd = currentDates.at(-1);
  const scopeTx = transactionRows(scoped).filter(tx => tx.cliente && tx.cliente !== 'Sin cliente');
  const currentTx = transactionRows(records).filter(tx => tx.cliente && tx.cliente !== 'Sin cliente');
  const currentClientKeys = new Set(currentTx.map(tx => customerKey(tx)));

  const lifetimeByClient = new Map();
  for (const tx of scopeTx) {
    const key = customerKey(tx);
    if (!lifetimeByClient.has(key)) lifetimeByClient.set(key, []);
    lifetimeByClient.get(key).push(tx);
  }

  const currentLifetime = [...currentClientKeys].map(key => lifetimeByClient.get(key) || []).filter(rows => rows.length);
  const ltvValues = currentLifetime.map(rows => sum(rows));
  const currentRevenue = sum(currentTx);
  const activeClients = currentClientKeys.size;
  const repeatClients = currentLifetime.filter(rows => rows.length > 1);
  const repeatRate = activeClients ? repeatClients.length / activeClients : 0;
  const avgObservedLtv = activeClients ? ltvValues.reduce((a, b) => a + b, 0) / activeClients : 0;

  const intervals = [];
  const firstRepeatIntervals = [];
  for (const rows of currentLifetime) {
    const dates = [...new Set(rows.map(tx => tx.fecha))].sort();
    for (let i = 1; i < dates.length; i++) intervals.push(daysBetween(dates[i - 1], dates[i]));
    if (dates.length > 1) firstRepeatIntervals.push(daysBetween(dates[0], dates[1]));
  }

  const historicalClientsBeforeEnd = [...lifetimeByClient.values()].filter(rows => rows.some(tx => tx.fecha <= periodEnd));
  const churnCutoff = formatDate(addDays(parseDate(periodEnd), -90));
  const churned = historicalClientsBeforeEnd.filter(rows => {
    const last = rows.filter(tx => tx.fecha <= periodEnd).map(tx => tx.fecha).sort().at(-1);
    return last && last < churnCutoff;
  });
  const churnRate = historicalClientsBeforeEnd.length ? churned.length / historicalClientsBeforeEnd.length : 0;

  const cards = [
    ['LTV observado', money2.format(avgObservedLtv), `Promedio histórico vendido por cliente activo en el filtro. Mediana: ${money2.format(median(ltvValues))}.`],
    ['Clientes recurrentes', percent.format(repeatRate), `${number.format(repeatClients.length)} de ${number.format(activeClients)} clientes compraron más de una vez en el histórico.`],
    ['Frecuencia de recompra', `${number.format(median(intervals))} días`, `Mediana entre compras. Promedio: ${number.format(intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0)} días.`],
    ['Lead time 1ra recompra', `${number.format(median(firstRepeatIntervals))} días`, `Tiempo mediano desde primera compra hasta segunda compra.`],
    ['Churn 90 días', percent.format(churnRate), `${number.format(churned.length)} de ${number.format(historicalClientsBeforeEnd.length)} clientes históricos no compraron en los últimos 90 días al corte ${periodEnd}.`],
    ['Venta recurrente', money2.format(repeatClients.reduce((acc, rows) => acc + sum(rows.filter(tx => tx.fecha >= periodStart && tx.fecha <= periodEnd)), 0)), `Monto del periodo explicado por clientes que tienen más de una compra histórica.`]
  ];

  el.innerHTML = cards.map(([label, value, note], idx) => (
    `<article class="growth-card ${idx === 4 || idx === 5 ? 'wide' : ''}"><span>${label}</span><strong>${value}</strong><small>${escapeHtml(note)}</small></article>`
  )).join('');
}

function filteredQualityRecords() {
  const dates = uniqueSorted(filteredRecords(), 'fecha');
  const start = state.startDate || dates[0] || '';
  const end = state.endDate || dates.at(-1) || '';
  return qualityRecords.filter(row => {
    if (state.sede !== 'all' && row.sede !== state.sede) return false;
    if (state.asesora !== 'all' && row.asesora !== state.asesora) return false;
    if (state.qualityAdvisor !== 'all' && row.asesora !== state.qualityAdvisor) return false;
    if (state.qualityWeek !== 'all' && `${row.weekStart}|${row.weekEnd}` !== state.qualityWeek) return false;
    if (start && row.weekEnd < start) return false;
    if (end && row.weekStart > end) return false;
    return true;
  });
}

function qualityFilterBaseRecords() {
  const dates = uniqueSorted(filteredRecords(), 'fecha');
  const start = state.startDate || dates[0] || '';
  const end = state.endDate || dates.at(-1) || '';
  return qualityRecords.filter(row => {
    if (state.sede !== 'all' && row.sede !== state.sede) return false;
    if (state.asesora !== 'all' && row.asesora !== state.asesora) return false;
    if (start && row.weekEnd < start) return false;
    if (end && row.weekStart > end) return false;
    return true;
  });
}

function salesForQualityRow(q) {
  return rawRecords.filter(row => {
    if (q.sede !== 'Spa' && row.sede !== q.sede) return false;
    if (row.asesora !== q.asesora) return false;
    if (row.fecha < q.weekStart || row.fecha > q.weekEnd) return false;
    if (state.sede !== 'all' && row.sede !== state.sede) return false;
    if (state.mes !== 'all' && row.mes !== state.mes) return false;
    if (state.semana !== 'all' && row.semana !== state.semana) return false;
    if (state.startDate && row.fecha < state.startDate) return false;
    if (state.endDate && row.fecha > state.endDate) return false;
    return true;
  });
}

function renderQualityDashboard(records) {
  const el = document.querySelector('#qualityDashboard');
  if (!el) return;
  const baseRows = qualityFilterBaseRecords();
  const qualityWeeks = [...new Set(baseRows.map(row => `${row.weekStart}|${row.weekEnd}`))];
  if (state.qualityWeek !== 'all' && !qualityWeeks.includes(state.qualityWeek)) state.qualityWeek = 'all';
  const qualityAdvisors = [...new Set(baseRows
    .filter(row => state.qualityWeek === 'all' || `${row.weekStart}|${row.weekEnd}` === state.qualityWeek)
    .map(row => row.asesora)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
  if (state.qualityAdvisor !== 'all' && !qualityAdvisors.includes(state.qualityAdvisor)) state.qualityAdvisor = 'all';
  const qRows = filteredQualityRecords();
  if (!qRows.length) {
    el.innerHTML = `<div class="quality-filterbar">
      <label>Semana calidad<select id="qualityWeekFilter"></select></label>
      <label>Asesora calidad<select id="qualityAdvisorFilter"></select></label>
    </div><div class="empty">Sin reportes de calidad para este filtro</div>`;
    setQualityOptions(document.querySelector('#qualityWeekFilter'), qualityWeeks, state.qualityWeek, 'Todas', value => shortRangeLabel(...value.split('|')));
    setQualityOptions(document.querySelector('#qualityAdvisorFilter'), qualityAdvisors, state.qualityAdvisor, 'Todas');
    bindQualityFilters();
    return;
  }
  const enriched = qRows.map(q => {
    const salesRows = salesForQualityRow(q);
    const revenue = sum(salesRows);
    const tx = txCount(salesRows);
    return { ...q, revenue, tx, ticket: tx ? revenue / tx : 0 };
  });
  const totalContacts = enriched.reduce((acc, row) => acc + Number(row.contactos || 0), 0);
  const totalRecontacts = enriched.reduce((acc, row) => acc + Number(row.recontactos || 0), 0);
  const kpis = [
    ['Score calidad', avg(enriched.map(r => r.score)) * 10, 'obj >70%'],
    ['Info-only', avg(enriched.map(r => r.infoOnly)), 'obj <20%'],
    ['Dead chat', avg(enriched.map(r => r.deadChat)), 'obj <12%'],
    ['CTA claro', avg(enriched.map(r => r.ctaClear)), 'obj >65%'],
    ['Discovery alto', avg(enriched.map(r => r.discoveryHigh)), 'obj >25%'],
    ['SLA 15m', avg(enriched.map(r => r.sla15)), 'obj >93%'],
    ['Contactos', totalContacts, 'conversaciones auditadas'],
    ['Recontactos', totalRecontacts, `${percent.format(totalContacts ? totalRecontacts / totalContacts : 0)} sobre contactos`]
  ];

  const corrItems = [
    ['Discovery vs venta', corr(enriched.map(r => r.discoveryHigh), enriched.map(r => r.revenue))],
    ['CTA vs venta', corr(enriched.map(r => r.ctaClear), enriched.map(r => r.revenue))],
    ['Recontactos vs venta', corr(enriched.map(r => r.recontactos), enriched.map(r => r.revenue))],
    ['Info-only vs venta', corr(enriched.map(r => r.infoOnly), enriched.map(r => r.revenue))],
    ['Dead chat vs venta', corr(enriched.map(r => r.deadChat), enriched.map(r => r.revenue))],
    ['SLA 15m vs venta', corr(enriched.map(r => r.sla15), enriched.map(r => r.revenue))],
    ['Resp. min vs venta', corr(enriched.map(r => r.respAvgMin), enriched.map(r => r.revenue))],
    ['Fuera horario vs venta', corr(enriched.map(r => r.outOoh), enriched.map(r => r.revenue))],
    ['Contactos vs venta', corr(enriched.map(r => r.contactos), enriched.map(r => r.revenue))]
  ];

  const advisorQuality = aggregateQualityByAdvisor(enriched);
  const trend = aggregateQualityByWeek(enriched);
  const tableRows = enriched
    .sort((a, b) => b.revenue - a.revenue)
    .map(row => ({
      periodo: `${weekRangeLabel(row.weekStart.replace(/-(\d{2})$/, '-W00'))}`,
      semana: `${row.weekStart} a ${row.weekEnd}`,
      sede: row.sede,
      asesora: row.asesora,
      score: row.score,
      contactos: row.contactos,
      recontactos: row.recontactos,
      discovery: row.discoveryHigh / 100,
      cta: row.ctaClear / 100,
      infoOnly: row.infoOnly / 100,
      deadChat: row.deadChat / 100,
      respuesta: row.respAvgMin,
      fueraHorario: row.outOoh / 100,
      tasaRecontacto: row.recontactRate / 100,
      venta: row.revenue,
      tx: row.tx
    }));

  el.innerHTML = `
    <div class="quality-filterbar">
      <label>Semana calidad<select id="qualityWeekFilter"></select></label>
      <label>Asesora calidad<select id="qualityAdvisorFilter"></select></label>
    </div>
    <div class="quality-kpis">
      ${kpis.map(([label, value, note]) => {
        const isCount = label === 'Contactos' || label === 'Recontactos';
        const display = isCount ? number.format(value) : percent.format(value / 100);
        return `<article class="quality-card ${qualityCardClass(label, value)}"><span>${label}</span><strong>${display}</strong><small>${escapeHtml(note)}</small></article>`;
      }).join('')}
    </div>
    ${renderQualityMetricCards(enriched)}
    <div class="quality-layout">
      <div class="quality-subpanel">
        <h3>Ranking asesoras · score y ventas</h3>
        ${renderQualityRanking(advisorQuality)}
      </div>
      <div class="quality-subpanel">
        <h3>Distribución rápida</h3>
        ${renderQualityDonuts(kpis)}
      </div>
    </div>
    <div class="quality-subpanel">
      <h3>Tendencia semanal de calidad</h3>
      ${renderQualityTrend(trend)}
    </div>
    <div class="correlation-grid">
      ${corrItems.map(([label, value]) => `<article class="corr-card"><strong>${label}</strong><span>${value === null ? 'n/a' : value.toFixed(2)}</span><small>${corrLabel(value)} · Pearson asesora/semana</small></article>`).join('')}
    </div>
    <div class="table-wrap">
      <table id="qualityTable"></table>
    </div>
  `;
  setQualityOptions(document.querySelector('#qualityWeekFilter'), qualityWeeks, state.qualityWeek, 'Todas', value => shortRangeLabel(...value.split('|')));
  setQualityOptions(document.querySelector('#qualityAdvisorFilter'), qualityAdvisors, state.qualityAdvisor, 'Todas');
  bindQualityFilters();
  renderTable('#qualityTable', [
    { key: 'semana', label: 'Semana' },
    { key: 'sede', label: 'Sede' },
    { key: 'asesora', label: 'Asesora' },
    { key: 'score', label: 'Score', num: true, format: value => number.format(value) },
    { key: 'contactos', label: 'Contactos', num: true, format: number.format },
    { key: 'recontactos', label: 'Recontactos', num: true, format: number.format },
    { key: 'discovery', label: 'Discovery', num: true, format: percent.format },
    { key: 'cta', label: 'CTA claro', num: true, format: percent.format },
    { key: 'infoOnly', label: 'Info-only', num: true, format: percent.format },
    { key: 'deadChat', label: 'Dead chat', num: true, format: percent.format },
    { key: 'respuesta', label: 'Resp. min', num: true, format: value => Number.isFinite(Number(value)) ? `${number.format(value)}m` : '-' },
    { key: 'fueraHorario', label: 'F. horario', num: true, format: percent.format },
    { key: 'tasaRecontacto', label: 'Recontacto', num: true, format: percent.format },
    { key: 'venta', label: 'Venta', num: true, format: money2.format },
    { key: 'tx', label: 'Tx', num: true, format: number.format }
  ], tableRows);
}

function lifecycleSalesBreakdown(records) {
  const currentTx = transactionRows(records);
  const lifecycleByTx = classifyTransactionsByLifecycle(records);
  const segments = {
    nuevo: { key: 'nuevo', label: 'Nuevos', venta: 0, tx: 0, clientes: new Set(), note: 'Sin compra previa en el histórico' },
    continuidad: { key: 'continuidad', label: 'Recompra / continuidad', venta: 0, tx: 0, clientes: new Set(), note: 'Compra previa hace 0-90 días' },
    reactivacion: { key: 'reactivacion', label: 'Reactivación', venta: 0, tx: 0, clientes: new Set(), note: 'Compra previa hace 91-365 días' },
    resurreccion: { key: 'resurreccion', label: 'Resurrección', venta: 0, tx: 0, clientes: new Set(), note: 'Compra previa hace más de 1 año' }
  };

  for (const tx of currentTx) {
    const segment = lifecycleByTx.get(tx.id) || 'nuevo';
    const key = lifecycleCustomerKey(tx);
    segments[segment].venta += tx.venta;
    segments[segment].tx += 1;
    segments[segment].clientes.add(key);
  }

  return Object.values(segments);
}

function classifyTransactionsByLifecycle(records) {
  const allTx = lifecycleHistoryTransactions();
  const currentTx = transactionRows(records);
  const currentKeys = new Set(currentTx.map(tx => tx.id));
  const historyByClient = new Map();
  const out = new Map();
  for (const tx of allTx) {
    const key = lifecycleCustomerKey(tx);
    const previousDates = historyByClient.get(key) || [];
    if (currentKeys.has(tx.id)) {
      const previous = previousDates.filter(date => date < tx.fecha).at(-1);
      let segment = 'nuevo';
      if (previous) {
        const gap = daysBetween(previous, tx.fecha);
        if (gap <= 90) segment = 'continuidad';
        else if (gap <= 365) segment = 'reactivacion';
        else segment = 'resurreccion';
      }
      out.set(tx.id, segment);
    }
    if (!previousDates.includes(tx.fecha)) previousDates.push(tx.fecha);
    historyByClient.set(key, previousDates);
  }
  for (const tx of currentTx) {
    if (!out.has(tx.id)) out.set(tx.id, 'nuevo');
  }
  return out;
}

function renderLifecycleBreakdown(records) {
  const rows = lifecycleSalesBreakdown(records);
  const compareRows = lifecycleSalesBreakdown(sameMonthLastYearRecords(records));
  const compareByKey = new Map(compareRows.map(row => [row.key, row]));
  const total = rows.reduce((acc, row) => acc + row.venta, 0);
  const baseRows = customerBaseLifecycle(records);
  const totalBaseClients = baseRows.reduce((acc, row) => acc + row.clientes, 0);
  const resurrectionRows = resurrectionSalesBreakdown(records);
  const totalResurrection = resurrectionRows.reduce((acc, row) => acc + row.venta, 0);
  return `<article class="growth-card wide lifecycle-breakdown">
    <span>Desglose de ventas por lifecycle</span>
    <div class="lifecycle-table">
      ${rows.map(row => {
        const compare = compareByKey.get(row.key);
        const previous = compare?.venta || 0;
        const diff = row.venta - previous;
        const deltaClass = !previous ? 'flat' : diff >= 0 ? 'up' : 'down';
        const delta = previous ? `${diff >= 0 ? '+' : ''}${percent.format(diff / previous)}` : 'sin base';
        return `
          <div class="lifecycle-row">
            <strong>${escapeHtml(row.label)}</strong>
            <span>${money2.format(row.venta)}</span>
            <em class="lifecycle-delta ${deltaClass}">${delta} vs LY · ${money2.format(previous)}</em>
            <small>${percent.format(total ? row.venta / total : 0)} · ${number.format(row.tx)} tx · ${number.format(row.clientes.size)} clientes<br>${escapeHtml(row.note)}</small>
          </div>
        `;
      }).join('')}
    </div>
    <div class="lifecycle-clients">
      <strong>BBDD por recencia de última compra</strong>
      <div class="lifecycle-client-grid">
        ${baseRows.map(row => `
          <div class="lifecycle-client-card lifecycle-${row.key}">
            <span>${escapeHtml(row.label)}</span>
            <strong>${number.format(row.clientes)}</strong>
            <small>${percent.format(totalBaseClients ? row.clientes / totalBaseClients : 0)} de la BBDD con compra histórica<br>${escapeHtml(row.note)}</small>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="lifecycle-clients resurrection-sales">
      <strong>Venta de clientes resucitados por años sin comprar</strong>
      <div class="lifecycle-client-grid resurrection-grid">
        ${resurrectionRows.map(row => `
          <div class="lifecycle-client-card lifecycle-${row.key}">
            <span>${escapeHtml(row.label)}</span>
            <strong>${money2.format(row.venta)}</strong>
            <small>${percent.format(totalResurrection ? row.venta / totalResurrection : 0)} de venta resucitada · ${number.format(row.tx)} tx · ${number.format(row.clientes.size)} clientes</small>
          </div>
        `).join('')}
      </div>
    </div>
  </article>`;
}

function renderLifecycleTop(records) {
  const el = document.querySelector('#lifecycleTop');
  if (!el) return;
  el.innerHTML = renderLifecycleBreakdown(records);
}

function customerBaseLifecycle(records) {
  const dates = uniqueSorted(records, 'fecha');
  const end = state.endDate || dates.at(-1) || '';
  const start = (() => {
    if (state.startDate) return state.startDate;
    if (state.mes !== 'all') return `${state.mes}-01`;
    if (end) return `${end.slice(0, 7)}-01`;
    return dates[0] || '';
  })();
  const scopedTx = transactionRows(comparableScopeRecords())
    .filter(tx => tx.cliente && tx.cliente !== 'Sin cliente' && (!end || tx.fecha <= end))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const byClient = new Map();
  for (const tx of scopedTx) {
    const key = uniqueCustomerKey(tx);
    if (!byClient.has(key)) byClient.set(key, []);
    byClient.get(key).push(tx.fecha);
  }
  const segments = {
    nuevo: { key: 'nuevo', label: 'Nuevos del mes', clientes: 0, note: 'Primera compra dentro del mes/rango filtrado' },
    continuidad: { key: 'continuidad', label: 'Compraron <90 días', clientes: 0, note: 'No nuevos; última compra hace menos de 90 días' },
    reactivacion: { key: 'reactivacion', label: '90 días-1 año', clientes: 0, note: 'No nuevos; última compra hace 91-365 días' },
    unAno: { key: 'unAno', label: '1-2 años sin compra', clientes: 0, note: 'Última compra hace más de 1 año y hasta 2 años' },
    dosAnos: { key: 'dosAnos', label: '2-3 años sin compra', clientes: 0, note: 'Última compra hace más de 2 años y hasta 3 años' },
    tresMas: { key: 'tresMas', label: '3+ años sin compra', clientes: 0, note: 'Última compra hace más de 3 años' }
  };
  for (const datesRaw of byClient.values()) {
    const clientDates = [...new Set(datesRaw)].sort();
    const first = clientDates[0];
    const last = clientDates.at(-1);
    if (start && first >= start && first <= end) {
      segments.nuevo.clientes += 1;
      continue;
    }
    const gap = daysBetween(last, end);
    if (gap <= 90) segments.continuidad.clientes += 1;
    else if (gap <= 365) segments.reactivacion.clientes += 1;
    else if (gap <= 730) segments.unAno.clientes += 1;
    else if (gap <= 1095) segments.dosAnos.clientes += 1;
    else segments.tresMas.clientes += 1;
  }
  return Object.values(segments);
}

function resurrectionSalesBreakdown(records) {
  const scoped = comparableScopeRecords();
  const allTx = transactionRows(scoped)
    .filter(tx => tx.cliente && tx.cliente !== 'Sin cliente')
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const currentKeys = new Set(transactionRows(records).map(tx => tx.id));
  const historyByClient = new Map();
  const segments = {
    unAno: { key: 'unAno', label: '1-2 años', venta: 0, tx: 0, clientes: new Set() },
    dosAnos: { key: 'dosAnos', label: '2-3 años', venta: 0, tx: 0, clientes: new Set() },
    tresAnos: { key: 'tresMas', label: '3-4 años', venta: 0, tx: 0, clientes: new Set() },
    cuatroAnos: { key: 'cuatroMas', label: '4+ años', venta: 0, tx: 0, clientes: new Set() }
  };
  for (const tx of allTx) {
    const key = uniqueCustomerKey(tx);
    const previousDates = historyByClient.get(key) || [];
    if (currentKeys.has(tx.id)) {
      const previous = previousDates.filter(date => date < tx.fecha).at(-1);
      if (previous) {
        const gap = daysBetween(previous, tx.fecha);
        let segment = '';
        if (gap > 365 && gap <= 730) segment = 'unAno';
        else if (gap > 730 && gap <= 1095) segment = 'dosAnos';
        else if (gap > 1095 && gap <= 1460) segment = 'tresAnos';
        else if (gap > 1460) segment = 'cuatroAnos';
        if (segment) {
          segments[segment].venta += tx.venta;
          segments[segment].tx += 1;
          segments[segment].clientes.add(key);
        }
      }
    }
    if (!previousDates.includes(tx.fecha)) previousDates.push(tx.fecha);
    historyByClient.set(key, previousDates);
  }
  return Object.values(segments);
}

function clientFrequencyMap(records) {
  const currentDates = uniqueSorted(records, 'fecha');
  const periodEnd = currentDates.at(-1) || '9999-12-31';
  const scopedTx = transactionRows(comparableScopeRecords())
    .filter(tx => tx.cliente && tx.cliente !== 'Sin cliente' && tx.fecha <= periodEnd);
  const byClient = new Map();
  for (const tx of scopedTx) {
    const key = customerKey(tx);
    if (!byClient.has(key)) byClient.set(key, []);
    byClient.get(key).push(tx.fecha);
  }
  const out = new Map();
  for (const [key, datesRaw] of byClient) {
    const dates = [...new Set(datesRaw)].sort();
    const intervals = [];
    for (let i = 1; i < dates.length; i++) intervals.push(daysBetween(dates[i - 1], dates[i]));
    out.set(key, {
      compras: dates.length,
      frecuencia: intervals.length ? median(intervals) : 0,
      ultima: dates.at(-1) || ''
    });
  }
  return out;
}

function dailyCompareMap(currentDailyItems) {
  const scoped = comparableScopeRecords();
  const byDate = new Map(aggregate(scoped, row => row.fecha).map(item => [item.name, item]));
  const map = new Map();
  for (const item of currentDailyItems) {
    const compDate = comparableLastYearDate(item.name);
    const comp = byDate.get(compDate);
    if (comp) map.set(item.name, { ...comp, name: compDate });
  }
  return map;
}

function previousMonthCompareMap(currentDailyItems) {
  const scoped = comparableScopeRecords();
  const byDate = new Map(aggregate(scoped, row => row.fecha).map(item => [item.name, item]));
  const map = new Map();
  for (const item of currentDailyItems) {
    const [year, month, day] = item.name.split('-').map(Number);
    const expectedMonth = new Date(year, month - 2, 1).getMonth();
    const previous = new Date(year, month - 2, day);
    if (previous.getMonth() !== expectedMonth) continue;
    const previousDate = formatDate(previous);
    const comp = byDate.get(previousDate);
    if (comp) map.set(item.name, { ...comp, name: previousDate });
  }
  return map;
}

function rowsForDateRange(records, start, end) {
  return records.filter(row => row.fecha >= start && row.fecha <= end);
}

function previousPeriodRecords(records) {
  const scoped = comparableScopeRecords();
  if (state.mes !== 'all' && state.semana === 'all' && !state.startDate && !state.endDate) {
    const [year, month] = state.mes.split('-').map(Number);
    const previous = new Date(year, month - 2, 1);
    const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
    return scoped.filter(row => row.mes === previousMonth);
  }
  const dates = uniqueSorted(records, 'fecha');
  if (!dates.length) return [];
  const start = parseDate(dates[0]);
  const end = parseDate(dates.at(-1));
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return rowsForDateRange(scoped, formatDate(prevStart), formatDate(prevEnd));
}

function insightPeriodLabel(records) {
  if (state.mes !== 'all' && state.semana === 'all' && !state.startDate && !state.endDate) return optionLabel('mes', state.mes);
  const dates = uniqueSorted(records, 'fecha');
  if (!dates.length) return 'Periodo filtrado';
  if (dates[0] === dates.at(-1)) return dates[0];
  return `${dates[0]} a ${dates.at(-1)}`;
}

function qualitySummaryForSalesPeriod(records) {
  const dates = uniqueSorted(records, 'fecha');
  if (!dates.length) return { rows: 0, contactos: 0, score: 0, cta: 0, discovery: 0, dead: 0, info: 0 };
  const start = dates[0];
  const end = dates.at(-1);
  const allowedStores = new Set(uniqueSorted(records, 'sede'));
  const rows = qualityRecords.filter(row => {
    if (row.weekEnd < start || row.weekStart > end) return false;
    if (allowedStores.size && !allowedStores.has(row.sede) && row.sede !== 'Spa') return false;
    return true;
  });
  return {
    rows: rows.length,
    contactos: rows.reduce((acc, row) => acc + Number(row.contactos || 0), 0),
    score: avg(rows.map(row => row.score)),
    cta: avg(rows.map(row => row.ctaClear)),
    discovery: avg(rows.map(row => row.discoveryHigh)),
    dead: avg(rows.map(row => row.deadChat)),
    info: avg(rows.map(row => row.infoOnly))
  };
}

function renderProjection(records) {
  const el = document.querySelector('#projectionPanel');
  const dates = uniqueSorted(records, 'fecha');
  if (!dates.length) {
    el.innerHTML = '<div class="empty">Sin datos para proyectar</div>';
    return;
  }
  const maxDate = dates.at(-1);
  const commercialWeek = sameCommercialWeek(maxDate);
  const scoped = comparableScopeRecords();
  const currentWeekRows = rowsForDateRange(scoped, commercialWeek.start, commercialWeek.end);
  const currentToDateRows = rowsForDateRange(scoped, commercialWeek.start, maxDate);
  const prevStart = formatDate(dateFromIso(commercialWeek.parts.year - 1, commercialWeek.parts.week, 1));
  const prevEnd = formatDate(dateFromIso(commercialWeek.parts.year - 1, commercialWeek.parts.week, 7));
  const prevComparableDay = comparableLastYearDate(maxDate);
  const prevToDateRows = rowsForDateRange(scoped, prevStart, prevComparableDay);
  const prevFullRows = rowsForDateRange(scoped, prevStart, prevEnd);
  const currentToDate = sum(currentToDateRows);
  const currentFull = sum(currentWeekRows);
  const prevToDate = sum(prevToDateRows);
  const prevFull = sum(prevFullRows);
  const pacing = prevToDate > 0 ? currentToDate / prevToDate : 1;
  const projectedWeek = prevFull > 0 ? prevFull * pacing : currentFull;
  const remaining = Math.max(0, projectedWeek - currentFull);
  const compText = `${weekRangeLabel(`${commercialWeek.parts.year - 1}-W${String(commercialWeek.parts.week).padStart(2, '0')}`)}`;
  const cards = [
    ['Semana actual', money2.format(currentFull), `${commercialWeek.label} · corte ${maxDate}`],
    ['LY comparable', money2.format(prevFull), `${compText} · misma semana/día comercial`],
    ['Pacing actual', percent.format(pacing), `${money2.format(currentToDate)} vs ${money2.format(prevToDate)} al mismo día comparable`],
    ['Proyección semana', money2.format(projectedWeek), `Meta restante estimada: ${money2.format(remaining)}`]
  ];
  el.innerHTML = cards.map(([label, value, note]) => (
    `<article class="projection-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`
  )).join('');
}

function renderDashboard() {
  refreshAdvisorOptions();
  refreshCategoryOptions();
  const records = filteredRecords();
  const summary = renderKpis(records);
  renderIncrementalImpact();
  renderTargetPacing(records);
  renderMonthTrendWidget(records);
  renderMayBenchmark(records);
  renderJuneYoy();
  renderLifecycleTop(records);
  renderExecutiveSummaryCards(records);
  document.querySelector('#recordCount').textContent = `${number.format(records.length)} líneas`;
  const dates = uniqueSorted(records, 'fecha');
  document.querySelector('#dateRange').textContent = dates.length ? `${dates[0]} a ${dates.at(-1)}` : 'sin fechas';

  renderBars('#storeChart', aggregate(records, row => row.sede), { limit: 6 });
  const dailyItems = aggregate(records, row => row.fecha);
  const dailyCompareSets = [
    { key: 'previousMonth', label: 'Mes anterior', color: '#8e3f31', dash: '4 6', map: previousMonthCompareMap(dailyItems) },
    { key: 'lastYear', label: 'Año pasado comparable', color: '#b7995c', dash: '7 7', map: dailyCompareMap(dailyItems) }
  ].filter(set => state.dailyCompare === 'both' || state.dailyCompare === set.key);
  renderLine('#dailyChart', dailyItems, {
    sets: state.dailyCompare === 'none' ? [] : dailyCompareSets
  });
  renderExecutiveMonthlyComparison('#executiveMonthlyChart');
  renderBars('#monthChart', aggregate(records, row => row.mesNombre), { limit: 12 });
  renderBars('#weekChart', aggregate(records, row => weekFullLabel(row.semana)), { limit: 16 });
  renderAnnualTrend('#yearTrendChart', records);
  renderTopMonths('#topMonths');
  renderNewClientsByYear('#newClientsYearChart', records);
  renderBars('#categoryChart', aggregate(records, row => row.categoria), { limit: 12, sub: item => `${percent.format(summary.revenue ? item.revenue / summary.revenue : 0)} del filtro` });
  renderBars('#productChart', aggregate(records, row => row.producto), { limit: 14, sub: item => `${number.format(item.units)} unidades · ${number.format(item.tx)} tx` });

  const weekdayItems = aggregate(records, row => row.diaSemana)
    .sort((a, b) => dayOrder.indexOf(a.name) - dayOrder.indexOf(b.name));
  renderBars('#weekdayChart', weekdayItems, { limit: 7 });
  renderBars('#hourChart', aggregate(records.filter(row => row.hora !== null), row => `${String(row.hora).padStart(2, '0')}:00`), { limit: 18 });

  const lifecycleByTx = classifyTransactionsByLifecycle(records);
  const qualityByAdvisor = advisorQualitySummaryMap();
  const lifecycleRevenueForRows = rows => {
    const totals = { nuevo: 0, continuidad: 0, reactivacion: 0, resurreccion: 0 };
    for (const tx of transactionRows(rows)) {
      const segment = lifecycleByTx.get(tx.id) || 'nuevo';
      totals[segment] += tx.venta;
    }
    return totals;
  };

  if (state.sede === 'all') {
    const advisorRows = aggregate(records, row => row.asesora)
      .sort((a, b) => b.revenue - a.revenue)
      .map(item => {
        const surco = item.rows.filter(row => row.sede === 'Surco');
        const sanIsidro = item.rows.filter(row => row.sede === 'San Isidro');
        const lifecycle = lifecycleRevenueForRows(item.rows);
        const quality = qualityByAdvisor.get(item.name) || {};
        return {
          asesora: item.name,
          surco: sum(surco),
          sanIsidro: sum(sanIsidro),
          venta: item.revenue,
          nuevos: lifecycle.nuevo,
          recompra: lifecycle.continuidad,
          reactivacion: lifecycle.reactivacion,
          resurreccion: lifecycle.resurreccion,
          tx: item.tx,
          ticket: item.avgTicket,
          cross: item.multilineRate,
          chatContactos: quality.chatContactos || 0,
          chatRecontactos: quality.chatRecontactos || 0,
          chatConversion: quality.chatContactos ? item.tx / quality.chatContactos : 0,
          chatScore: quality.chatScore || 0,
          chatRespMin: quality.chatRespMin || 0,
          chatRecontactRate: quality.chatRecontactRate || 0,
          chatCta: quality.chatCta || 0,
          chatDiscovery: quality.chatDiscovery || 0,
          chatInfoOnly: quality.chatInfoOnly || 0,
          chatDead: quality.chatDead || 0
        };
      });
    renderAdvisorHighlights(advisorRows);
    renderAdvisorDrivers(advisorRows);
    renderTable('#advisorTable', [
      { key: 'asesora', label: 'Asesora' },
      { key: 'surco', label: 'Surco', num: true, format: money2.format },
      { key: 'sanIsidro', label: 'San Isidro', num: true, format: money2.format },
      { key: 'venta', label: 'Total', num: true, format: money2.format },
      { key: 'nuevos', label: 'Nuevos', num: true, format: money2.format },
      { key: 'recompra', label: 'Continuidad', num: true, format: money2.format },
      { key: 'reactivacion', label: 'Reactivación', num: true, format: money2.format },
      { key: 'resurreccion', label: 'Resurrección', num: true, format: money2.format },
      { key: 'tx', label: 'Tx', num: true, format: number.format },
      { key: 'chatContactos', label: 'Contactos chat', num: true, format: number.format },
      { key: 'chatConversion', label: 'Conv. chat', num: true, format: percent.format },
      { key: 'chatRecontactos', label: 'Recontactos', num: true, format: number.format },
      { key: 'chatScore', label: 'Score chat', num: true, format: value => value ? percent.format(value / 100) : '-' },
      { key: 'chatRespMin', label: 'Resp.', num: true, format: value => value ? `${number.format(value)}m` : '-' },
      { key: 'ticket', label: 'Ticket', num: true, format: money2.format },
      { key: 'cross', label: 'Cross-sell', num: true, format: percent.format }
    ], advisorRows);
  } else {
    const advisorRows = aggregate(records, row => row.asesora)
      .sort((a, b) => b.revenue - a.revenue)
      .map(item => {
        const lifecycle = lifecycleRevenueForRows(item.rows);
        const quality = qualityByAdvisor.get(item.name) || {};
        return {
          asesora: item.name,
          venta: item.revenue,
          nuevos: lifecycle.nuevo,
          recompra: lifecycle.continuidad,
          reactivacion: lifecycle.reactivacion,
          resurreccion: lifecycle.resurreccion,
          tx: item.tx,
          ticket: item.avgTicket,
          ritual: item.ritualShare,
          cross: item.multilineRate,
          chatContactos: quality.chatContactos || 0,
          chatRecontactos: quality.chatRecontactos || 0,
          chatConversion: quality.chatContactos ? item.tx / quality.chatContactos : 0,
          chatScore: quality.chatScore || 0,
          chatRespMin: quality.chatRespMin || 0,
          chatRecontactRate: quality.chatRecontactRate || 0,
          chatCta: quality.chatCta || 0,
          chatDiscovery: quality.chatDiscovery || 0,
          chatInfoOnly: quality.chatInfoOnly || 0,
          chatDead: quality.chatDead || 0
        };
      });
    renderAdvisorHighlights(advisorRows);
    renderAdvisorDrivers(advisorRows);
    renderTable('#advisorTable', [
      { key: 'asesora', label: 'Asesora' },
      { key: 'venta', label: 'Venta', num: true, format: money2.format },
      { key: 'nuevos', label: 'Nuevos', num: true, format: money2.format },
      { key: 'recompra', label: 'Continuidad', num: true, format: money2.format },
      { key: 'reactivacion', label: 'Reactivación', num: true, format: money2.format },
      { key: 'resurreccion', label: 'Resurrección', num: true, format: money2.format },
      { key: 'tx', label: 'Tx', num: true, format: number.format },
      { key: 'chatContactos', label: 'Contactos chat', num: true, format: number.format },
      { key: 'chatConversion', label: 'Conv. chat', num: true, format: percent.format },
      { key: 'chatRecontactos', label: 'Recontactos', num: true, format: number.format },
      { key: 'chatScore', label: 'Score chat', num: true, format: value => value ? percent.format(value / 100) : '-' },
      { key: 'chatRespMin', label: 'Resp.', num: true, format: value => value ? `${number.format(value)}m` : '-' },
      { key: 'ticket', label: 'Ticket', num: true, format: money2.format },
      { key: 'ritual', label: 'Rituales', num: true, format: percent.format },
      { key: 'cross', label: 'Cross-sell', num: true, format: percent.format }
    ], advisorRows);
  }

  renderAdvisorRoom(records);
  renderQualityDashboard(records);
  renderCustomerGrowth(records);
  renderQueryAssistant();

  const frequencyByClient = clientFrequencyMap(records);
  const clientRows = aggregate(records, row => `${row.sede} · ${row.cliente}`)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 60)
    .map(item => {
      const first = item.rows[0];
      const freq = frequencyByClient.get(customerKey(first)) || { compras: item.tx, frecuencia: 0, ultima: '' };
      return {
        cliente: item.name,
        venta: item.revenue,
        tx: item.tx,
        comprasHist: freq.compras,
        frecuencia: freq.frecuencia,
        ultima: freq.ultima,
        lineas: item.lines
      };
    });
  renderTable('#clientTable', [
    { key: 'cliente', label: 'Cliente' },
    { key: 'venta', label: 'Venta', num: true, format: money2.format },
    { key: 'tx', label: 'Tx', num: true, format: number.format },
    { key: 'comprasHist', label: 'Compras hist.', num: true, format: number.format },
    { key: 'frecuencia', label: 'Frec. recompra', num: true, format: value => value ? `${number.format(value)} días` : '-' },
    { key: 'ultima', label: 'Última compra' },
    { key: 'lineas', label: 'Líneas', num: true, format: number.format }
  ], clientRows);

  renderExecutiveInsights(records, summary);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function queryScopeFromText(text) {
  const query = normalizeText(text);
  let rows = filteredRecords();
  const notes = [];
  const monthMatch = query.match(/(20\d{2})[-\s/]?(0?[1-9]|1[0-2])/) || query.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de)?\s+(20\d{2})?/);
  const monthNames = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
  };
  if (monthMatch) {
    let monthKey = '';
    if (/^20\d{2}/.test(monthMatch[1])) monthKey = `${monthMatch[1]}-${String(Number(monthMatch[2])).padStart(2, '0')}`;
    else monthKey = `${monthMatch[2] || '2026'}-${monthNames[monthMatch[1]]}`;
    rows = rawRecords.filter(row => row.mes === monthKey);
    notes.push(optionLabel('mes', monthKey));
  }
  const service = uniqueSorted(rawRecords, 'categoria').find(cat => query.includes(normalizeText(cat)) || normalizeText(cat).split(' ').some(part => part.length > 4 && query.includes(part)));
  const product = uniqueSorted(rawRecords, 'producto').find(productName => normalizeText(productName).length > 4 && query.includes(normalizeText(productName)));
  const advisor = uniqueSorted(rawRecords, 'asesora').find(name => normalizeText(name).split(' ').some(part => part.length > 3 && query.includes(part)));
  const store = uniqueSorted(rawRecords, 'sede').find(name => query.includes(normalizeText(name)));
  if (service) {
    rows = rows.filter(row => row.categoria === service);
    notes.push(service);
  }
  if (product) {
    rows = rows.filter(row => row.producto === product);
    notes.push(product);
  }
  if (advisor) {
    rows = rows.filter(row => row.asesora === advisor);
    notes.push(advisor);
  }
  if (store) {
    rows = rows.filter(row => row.sede === store);
    notes.push(store);
  }
  if (query.includes('sin bigbox') || query.includes('operativa') || query.includes('sin corporativo')) {
    rows = rows.filter(row => !normalizeText(row.cliente).includes('bigbox'));
    notes.push('sin BIGBOX');
  } else if (query.includes('bigbox')) {
    rows = rows.filter(row => normalizeText(row.cliente).includes('bigbox'));
    notes.push('BIGBOX');
  }
  const lifecycleAlias = [
    ['resurreccion', 'resurreccion'],
    ['resurreccion', 'resurrección'],
    ['reactivacion', 'reactivacion'],
    ['reactivacion', 'reactivación'],
    ['continuidad', 'continuidad'],
    ['nuevo', 'nuevos']
  ].find(([, word]) => query.includes(normalizeText(word)));
  if (lifecycleAlias) {
    const lifecycleByTx = classifyTransactionsByLifecycle(rows);
    rows = rows.filter(row => (lifecycleByTx.get(txKey(row)) || 'nuevo') === lifecycleAlias[0]);
    notes.push(lifecycleAlias[1]);
  }
  return { rows, notes };
}

function renderQueryAssistant() {
  if (!els.queryAnswer) return;
  const text = (els.askInput?.value || state.ask || '').trim();
  const fallbackText = 'Prueba: "faciales junio", "Surco junio sin BIGBOX", "Dayana rituales", "resurrección junio".';
  if (!text) {
    queryResultRows = filteredRecords();
    els.queryAnswer.innerHTML = `<strong>Consulta rápida lista.</strong><br>${fallbackText}`;
    return;
  }
  const { rows, notes } = queryScopeFromText(text);
  queryResultRows = rows;
  const revenue = sum(rows);
  const tx = txCount(rows);
  const clients = clientCount(rows);
  const ticket = tx ? revenue / tx : 0;
  const topStores = aggregate(rows, row => row.sede).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const topAdvisors = aggregate(rows, row => row.asesora).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const topProducts = aggregate(rows, row => row.producto).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  const tableRows = [
    ...topStores.map(item => [`Sede · ${item.name}`, money2.format(item.revenue)]),
    ...topAdvisors.map(item => [`Asesora · ${item.name}`, money2.format(item.revenue)]),
    ...topProducts.map(item => [`Producto · ${item.name}`, money2.format(item.revenue)])
  ].slice(0, 7);
  els.queryAnswer.innerHTML = `
    <strong>${rows.length ? 'Resultado encontrado' : 'No encontré registros con esa consulta'}</strong>
    <br>${notes.length ? `Filtro interpretado: ${notes.map(escapeHtml).join(' · ')}` : 'Usando los filtros activos del tablero.'}
    <div class="query-answer-grid">
      <article><span>Venta</span><b>${money2.format(revenue)}</b></article>
      <article><span>Transacciones</span><b>${number.format(tx)}</b></article>
      <article><span>Clientes</span><b>${number.format(clients)}</b></article>
      <article><span>Ticket</span><b>${money2.format(ticket)}</b></article>
    </div>
    ${tableRows.length ? `<table class="query-mini-table">${tableRows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table>` : `<p>${fallbackText}</p>`}
  `;
}

function downloadRowsCsv(rows, filename) {
  const columns = ['fecha', 'semana', 'mes', 'sede', 'asesora', 'cliente', 'producto', 'categoria', 'venta', 'cantidad', 'numeroDocumento'];
  const lines = [columns.join(',')].concat(rows.map(row => columns.map(col => `"${String(row[col] ?? '').replaceAll('"', '""')}"`).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportFilteredCsv() {
  const records = filteredRecords();
  downloadRowsCsv(records, 'almahal_dashboard_filtrado.csv');
}

function bindEvents() {
  document.querySelectorAll('.view-button').forEach(button => {
    button.addEventListener('click', () => {
      state.view = button.dataset.view || 'review';
      document.querySelectorAll('.view-button').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('.dashboard-view').forEach(panel => panel.classList.toggle('active', panel.dataset.viewPanel === state.view));
    });
  });
  const mapping = [
    ['sede', 'sede'],
    ['mes', 'mes'],
    ['semana', 'semana'],
    ['asesora', 'asesora'],
    ['categoria', 'categoria']
  ];
  for (const [key, stateKey] of mapping) {
    els[key].addEventListener('change', event => {
      state[stateKey] = event.target.value;
      renderDashboard();
    });
  }
  els.startDate.addEventListener('change', event => {
    state.startDate = event.target.value;
    if (state.endDate && state.startDate > state.endDate) {
      state.endDate = state.startDate;
      els.endDate.value = state.endDate;
    }
    renderDashboard();
  });
  els.endDate.addEventListener('change', event => {
    state.endDate = event.target.value;
    if (state.startDate && state.endDate < state.startDate) {
      state.startDate = state.endDate;
      els.startDate.value = state.startDate;
    }
    renderDashboard();
  });
  els.cliente.addEventListener('input', event => {
    state.cliente = event.target.value;
    renderDashboard();
  });
  els.dailyCompare?.addEventListener('change', event => {
    state.dailyCompare = event.target.value;
    renderDashboard();
  });
  els.monthTrendSegment?.addEventListener('change', event => {
    state.monthTrendSegment = event.target.value;
    renderDashboard();
  });
  document.querySelector('#runAsk')?.addEventListener('click', () => {
    state.ask = els.askInput.value;
    renderQueryAssistant();
  });
  els.askInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      state.ask = event.target.value;
      renderQueryAssistant();
    }
  });
  els.queryExport?.addEventListener('click', () => {
    downloadRowsCsv(queryResultRows.length ? queryResultRows : filteredRecords(), 'almahal_consulta.csv');
  });
  document.querySelector('#resetFilters').addEventListener('click', () => {
    Object.assign(state, { sede: 'all', mes: latestMonth(), semana: 'all', asesora: 'all', categoria: 'all', startDate: '', endDate: '', cliente: '', qualityWeek: 'all', qualityAdvisor: 'all', focusAdvisor: '', ask: '' });
    els.cliente.value = '';
    if (els.askInput) els.askInput.value = '';
    hydrateFilters();
    renderDashboard();
  });
  document.querySelector('#exportCsv').addEventListener('click', exportFilteredCsv);
}

state.mes = latestMonth();
hydrateFilters();
bindEvents();
renderDashboard();


