import { SHEETS, FIELD_META, NOTES } from './calc.js';
import { issLookupMarkup, mountISSLookup, restoreISSHash, writeISSHash, markISSManual, resetISS } from './iss.js';

const $ = (s) => document.querySelector(s);
const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const money = (v) => 'R$ ' + nf2.format(Math.abs(v) < 5e-7 ? 0 : v);
const mnum = (v) => nf2.format(Math.abs(v) < 5e-7 ? 0 : v);
const pct = (v) => nfPct.format(+(v * 100).toFixed(4)) + '%';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- estado ----------
const state = { tab: 'merc', regime: 'real', values: {} };

function defaultsFor(tab, regime) {
  const s = SHEETS[tab];
  const v = { ...s.defaults };
  if (s.regimes) v.pis = s.regimes[regime].pis;
  return v;
}

function readHash() {
  const h = location.hash.replace(/^#/, '');
  if (!h) return null;
  const [path, query = ''] = h.split('?');
  const [tab, regime] = path.split('/');
  if (!SHEETS[tab]) return null;
  const rg = SHEETS[tab].regimes && SHEETS[tab].regimes[regime] ? regime : 'real';
  const values = defaultsFor(tab, rg);
  const q = new URLSearchParams(query);
  if (tab === 'serv') restoreISSHash(q);
  for (const f of SHEETS[tab].fields) {
    if (f !== 'net' && q.has(f)) {
      const n = Number(q.get(f));
      if (Number.isFinite(n) && n >= 0 &&
          (FIELD_META[f].kind !== 'pct' || n <= 1) &&
          (!['icms', 'iss'].includes(f) || n < 1) &&
          (FIELD_META[f].kind !== 'money' || n <= 1e14)) values[f] = n;
    }
  }
  return { tab, regime: rg, values };
}

function writeHash() {
  const def = defaultsFor(state.tab, state.regime);
  const q = new URLSearchParams();
  for (const f of SHEETS[state.tab].fields) if (f !== 'net' && state.values[f] !== def[f]) q.set(f, String(state.values[f]));
  if (state.tab === 'serv') writeISSHash(q);
  const path = state.tab + (SHEETS[state.tab].regimes ? '/' + state.regime : '');
  history.replaceState(null, '', '#' + path + (q.toString() ? '?' + q : ''));
}

function parseNum(txt) {
  let t = String(txt).trim().replace(/[^\d.,-]/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
}

// net é derivado do bruto (função afim em todas as abas); o inverso resolve o bruto a partir do net
const netAt = (g) => SHEETS[state.tab].calc({ ...state.values, gross: g }).net;
function grossFromNet(n) {
  const n0 = netAt(0), n1 = netAt(1);
  return n1 === n0 ? state.values.gross : (n - n0) / (n1 - n0);
}
function syncDerived() {
  const set = (f, v) => { const el = document.getElementById('f-' + f); if (el && el !== document.activeElement) el.value = mnum(v); };
  set('gross', state.values.gross);
  set('net', netAt(state.values.gross));
}

// ---------- render: controles ----------
function renderTabs() {
  $('#tabs').innerHTML = Object.entries(SHEETS)
    .map(([k, s]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${k === state.tab}">${esc(s.title)}</button>`)
    .join('');
}

function renderRegime() {
  const s = SHEETS[state.tab];
  $('#regime').innerHTML = s.regimes
    ? Object.entries(s.regimes)
        .map(([k, r]) => `<button type="button" role="radio" data-regime="${k}" aria-checked="${k === state.regime}">${esc(r.label)}</button>`)
        .join('')
    : '';
}

function renderFields() {
  const s = SHEETS[state.tab];
  $('#fields').innerHTML = s.fields
    .map((f) => {
      const m = FIELD_META[f];
      const isMoney = m.kind === 'money';
      const val = f === 'net' ? mnum(netAt(state.values.gross)) : isMoney ? mnum(state.values[f]) : nfPct.format(+(state.values[f] * 100).toFixed(4));
      return `${f === 'iss' ? issLookupMarkup() : ''}<div class="field">
        <label for="f-${f}" ${m.note ? `title="${esc(m.note)}"` : ''}>${esc(m.label)}</label>
        <div class="inp ${isMoney ? 'money' : ''}">
          <input id="f-${f}" data-f="${f}" inputmode="decimal" value="${val}" aria-describedby="n-${f}">
          <span class="u">${isMoney ? 'R$' : '%'}</span>
        </div>
        ${m.note ? `<small id="n-${f}">${esc(m.note)}</small>` : ''}
      </div>`;
    })
    .join('');
  if (state.tab === 'serv') mountISSLookup((rate) => {
    state.values.iss = rate / 100;
    const field = document.getElementById('f-iss');
    if (field) field.value = nfPct.format(rate);
    syncDerived(); render(); writeHash();
  }, () => writeHash());
}

// ---------- render: resultados ----------
const deltaClass = (d) => (d == null || !Number.isFinite(d) || Math.abs(d) < 5e-5 ? 'flat' : d > 0 ? 'up' : 'down');
const deltaTxt = (d) => {
  if (d == null || !Number.isFinite(d)) return '—';
  const c = deltaClass(d);
  const sign = c === 'flat' ? '' : d > 0 ? '▲ +' : '▼ ';
  return `${sign}${nfPct.format(+(d * 100).toFixed(2))}%`;
};

function bars(y26, y27, max) {
  const w = (v) => Math.max(1, Math.round((v / max) * 100));
  return `<div class="bars">
    <div class="bar"><span>2026</span><i style="width:${w(y26)}%"></i><span>${money(y26)}</span></div>
    <div class="bar b27"><span>2027</span><i style="width:${w(y27)}%"></i><span>${money(y27)}</span></div>
  </div>`;
}

function kpiCard(label, sub, c, max) {
  return `<article class="kpi">
    <div class="kpi-label">${esc(label)}</div>
    <p class="kpi-sub">${esc(sub)}</p>
    <div class="kpi-row"><span class="kpi-val">${money(c.y27)}</span><span class="pill ${deltaClass(c.impact)}" title="Impacto sobre a nota de 2026: (custo 2027 − custo 2026) ÷ valor da nota atual">${deltaTxt(c.impact)}</span></div>
    <p class="impact-explainer">Impacto sobre a nota de 2026 · Variação sobre o custo anterior: <strong>${deltaTxt(c.delta)}</strong></p>
    ${bars(c.y26, c.y27, max)}
  </article>`;
}

function row(label, r26, v26, r27, v27, opts = {}) {
  const rt = (r) => (r == null ? '' : pct(r));
  const dim = (v) => (Math.abs(v) < 5e-7 ? ' dim' : '');
  return `<tr class="${opts.cls || ''}">
    <td class="k">${esc(label)}</td>
    <td class="n dim">${rt(r26)}</td><td class="n${dim(v26)}">${mnum(v26)}</td>
    <td class="n dim">${rt(r27)}</td><td class="n${dim(v27)}">${mnum(v27)}</td>
  </tr>`;
}

function renderGoodsServices(res) {
  const sheet = SHEETS[state.tab];
  const isServ = res.kind === 'services';
  const a = res.y26, b = res.y27, r = res.rates;
  let body = '';
  if (isServ) {
    body += row('Valor do serviço', null, a.service, null, b.service);
    body += row('Base de cálculo — PIS/COFINS', null, a.basePis, null, b.basePis);
    body += row('Base de cálculo — ISS', null, a.baseIss, null, b.baseIss);
  } else {
    body += row('Valor net (receita líquida)', null, res.net, null, res.net);
    body += row('Base de cálculo líquida de ICMS', null, a.base, null, b.base);
  }
  body += row('Base de cálculo — CBS/IBS', null, a.baseCbsIbs, null, b.baseCbsIbs);
  body += row('CBS', 0, a.cbs, r.cbs, b.cbs);
  body += row('IBS', 0, a.ibs, r.ibs, b.ibs);
  body += row('PIS/COFINS', r.pis, a.pis, 0, b.pis);
  if (isServ) body += row('ISS', r.iss, a.iss, r.iss, b.iss);
  else {
    body += row('ICMS', r.icms, a.icms, r.icms, b.icms);
    if (sheet.fields.includes('ipi')) body += row('IPI', r.ipi, a.ipi, r.ipi, b.ipi);
    if (sheet.fields.includes('st')) body += row('ST', null, a.st, null, b.st);
  }
  body += row(isServ ? 'Valor da nota fiscal' : state.tab === 'transp' ? 'Valor do conhecimento de transporte' : 'Valor da nota fiscal', null, a.nf, null, b.nf, { cls: 'strong sep' });
  body += row('Receita líquida do fornecedor', null, res.supplierNet.y26, null, res.supplierNet.y27);

  const costRow = (label, c) => `<tr class="cost sep">
      <td class="k">${esc(label)}</td><td></td><td class="n">${mnum(c.y26)}</td><td class="n"><span class="pill ${deltaClass(c.impact)}" title="Impacto sobre a nota de 2026">${deltaTxt(c.impact)}</span><small class="impact-explainer">vs. custo: ${deltaTxt(c.delta)}</small></td><td class="n">${mnum(c.y27)}</td>
    </tr>`;

  return `<div class="card">
    <h4 class="ttl">Composição dos impostos e custo</h4>
    <p class="impact-explainer impact-context">Impacto principal = (custo 2027 − custo 2026) ÷ nota atual. Na planilha, o campo “Impacto CA” tem sinal invertido: negativo significa aumento de custo.</p>
    <div class="scroll"><table>
      <thead>
        <tr><th></th><th colspan="2">2026 · regime atual</th><th colspan="2">2027 · CBS/IBS</th></tr>
        <tr><th>Item</th><th class="n">Alíq.</th><th class="n">R$</th><th class="n">Alíq.</th><th class="n">R$</th></tr>
      </thead>
      <tbody>
        ${body}
        ${costRow('Custo do adquirente — aquisição direta', res.cost.direct)}
        ${costRow('Custo do adquirente — aquisição indireta', res.cost.indirect)}
      </tbody>
    </table></div>
  </div>`;
}

function renderSimples(res) {
  const defs = [
    ['directNon', 'Aquisição direta', 'forn. não optante CBS/IBS'],
    ['indirectOpt', 'Aquisição indireta', 'forn. optante CBS/IBS'],
    ['directOpt', 'Aquisição direta', 'forn. optante CBS/IBS'],
    ['indirectNon', 'Aquisição indireta', 'forn. não optante CBS/IBS'],
  ];
  const cards = defs
    .map(([k, t, tag]) => {
      const s = res.scenarios[k];
      const r = (label, v26, v27, cls = '') => `<tr class="${cls}"><td class="k">${label}</td><td class="n">${mnum(v26)}</td><td class="n">${mnum(v27)}</td></tr>`;
      return `<div class="card">
        <h4 style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <span>${t} <small class="sub">· ${tag}</small></span><span class="pill ${deltaClass(s.impact)}" title="Impacto sobre a nota de 2026">${deltaTxt(s.impact)}</span>
        </h4>
        <p class="impact-explainer">Impacto sobre a nota de 2026 · Variação sobre custo: <strong>${deltaTxt(s.delta)}</strong></p>
        <div class="scroll"><table>
          <thead><tr><th>Item</th><th class="n">2026</th><th class="n">2027</th></tr></thead>
          <tbody>
            ${r('Simples Nacional', s.y26.simples, s.y27.simples)}
            ${r('CBS', s.y26.cbs, s.y27.cbs)}
            ${r('IBS', s.y26.ibs, s.y27.ibs)}
            ${r('Nota fiscal (preço de contrato)', s.y26.nf, s.y27.nf, 'strong sep')}
            ${r(`Receita líq. do fornecedor`, s.y26.supplierNet, s.y27.supplierNet)}
            ${r('Crédito de impostos', s.y26.credit, s.y27.credit)}
            ${r('Custo do adquirente', s.y26.cost, s.y27.cost, 'cost sep')}
          </tbody>
        </table></div>
      </div>`;
    })
    .join('');
  return `<div class="grid2">${cards}</div>`;
}

function render() {
  const sheet = SHEETS[state.tab];
  $('#title').textContent = sheet.title + (sheet.regimes ? ' · ' + sheet.regimes[state.regime].label : '');
  $('#blurb').textContent = sheet.blurb;
  const res = sheet.calc(state.values);

  if (res.kind === 'simples') {
    $('#kpis').innerHTML = '';
    $('#detail').innerHTML = renderSimples(res);
    $('#notes').innerHTML = notes('Mitigação de impactos — fornecedores do Simples Nacional', NOTES.simples);
  } else {
    const max = Math.max(res.cost.direct.y26, res.cost.direct.y27, res.cost.indirect.y26, res.cost.indirect.y27) || 1;
    $('#kpis').innerHTML =
      kpiCard('Custo do adquirente · aquisição direta', 'Com crédito de PIS/COFINS e ICMS em 2026', res.cost.direct, max) +
      kpiCard('Custo do adquirente · aquisição indireta', 'Sem créditos em 2026; com CBS/IBS em 2027', res.cost.indirect, max);
    $('#detail').innerHTML = renderGoodsServices(res);
    $('#notes').innerHTML =
      state.regime === 'presumido'
        ? notes('Mitigação de impactos — fornecedores do Lucro Presumido', NOTES.presumido)
        : state.regime === 'real_cumulativo'
          ? notes('Atenção tributária — Lucro Real no regime cumulativo', NOTES.real_cumulativo)
          : '';
  }
}

const notes = (title, items) => `<details class="notes"><summary>${esc(title)}</summary><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></details>`;

// ---------- eventos ----------
function switchTab(tab, regime) {
  state.tab = tab;
  state.regime = SHEETS[tab].regimes ? regime || state.regime : 'real';
  state.values = defaultsFor(tab, state.regime);
  renderTabs(); renderRegime(); renderFields(); render(); writeHash();
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) switchTab(b.dataset.tab);
});

$('#regime').addEventListener('click', (e) => {
  const b = e.target.closest('[data-regime]');
  if (!b || b.dataset.regime === state.regime) return;
  // mantém as premissas editadas, trocando só o PIS/COFINS padrão do regime
  state.regime = b.dataset.regime;
  state.values.pis = SHEETS[state.tab].regimes[state.regime].pis;
  renderRegime(); renderFields(); render(); writeHash();
});

$('#fields').addEventListener('input', (e) => {
  const f = e.target.dataset.f;
  if (!f) return;
  const n = parseNum(e.target.value);
  const bad = !Number.isFinite(n) || n < 0 ||
    (FIELD_META[f].kind === 'pct' && n > 100) ||
    (['icms', 'iss'].includes(f) && n >= 100) ||
    (FIELD_META[f].kind === 'money' && n > 1e14);
  e.target.setAttribute('aria-invalid', bad ? 'true' : 'false');
  if (bad) return;
  if (f === 'net') state.values.gross = Math.round(grossFromNet(n) * 1e6) / 1e6;
  else state.values[f] = FIELD_META[f].kind === 'pct' ? n / 100 : n;
  if (f === 'iss') markISSManual();
  syncDerived(); render(); writeHash();
});

$('#fields').addEventListener('focusout', (e) => {
  const f = e.target.dataset.f;
  if (!f) return;
  e.target.value = f === 'net' ? mnum(netAt(state.values.gross)) : FIELD_META[f].kind === 'pct' ? nfPct.format(+(state.values[f] * 100).toFixed(4)) : mnum(state.values[f]);
  e.target.setAttribute('aria-invalid', 'false');
});

$('#reset').addEventListener('click', () => { resetISS(); switchTab(state.tab, state.regime); });

$('#share').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); toast('Link copiado'); }
  catch { toast('Copie o link na barra de endereço'); }
});

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 1800);
}

window.addEventListener('hashchange', () => {
  const h = readHash();
  if (h) { Object.assign(state, h); renderTabs(); renderRegime(); renderFields(); render(); }
});

// ---------- init ----------
const initial = readHash();
if (initial) Object.assign(state, initial); else state.values = defaultsFor(state.tab, state.regime);
renderTabs(); renderRegime(); renderFields(); render();
