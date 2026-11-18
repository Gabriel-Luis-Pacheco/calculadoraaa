// Motor de cálculo — reconstruído a partir dos valores da planilha "RTC - Calculadora3".
// Funções puras, sem DOM. Taxas em fração (0.12 = 12%).

// Crédito de PIS/COFINS do adquirente (Lucro Real, não cumulativo) em 2026.
export const BUYER_PIS_COFINS = 0.0925;

const eff = (rate, red) => rate * (1 - (red || 0));
// A variação percentual é indefinida quando o custo base é zero, salvo quando ambos são zero.
const variation = (before, after) => Math.abs(before) < 1e-10
  ? (Math.abs(after) < 1e-10 ? 0 : null)
  : after / before - 1;

// Convenção de exibição: aumento do custo é positivo.
// A matriz de suprimentos usa o sinal oposto em "Impacto CA":
// Impacto CA = (custo atual - custo futuro) / nota fiscal atual.
// Guardamos o valor sobre a nota sem substituir a variação sobre custo.
const impactOnInvoice = (before, after, invoice) => Math.abs(invoice) < 1e-10
  ? (Math.abs(after - before) < 1e-10 ? 0 : null)
  : (after - before) / invoice;

/**
 * Mercadorias e Transporte (Transporte = Mercadorias sem IPI/ST).
 * in: { gross, cbs, ibs, red, pis, icms, ipi, st }
 */
export function calcGoods(i) {
  const ipi = i.ipi || 0;
  const st = i.st || 0;
  const cbsR = eff(i.cbs, i.red);
  const ibsR = eff(i.ibs, i.red);

  // ---- 2026 ----
  const pv = (i.gross - st) / (1 + ipi); // valor do produto sem IPI/ST
  const ipi26 = pv * ipi;
  const icms26 = pv * i.icms;
  const base26 = pv - icms26; // base de PIS/COFINS (líquida de ICMS)
  const pis26 = base26 * i.pis;
  const net = base26 - pis26; // receita líquida do fornecedor
  const nf26 = i.gross;

  // ---- 2027 ----
  const cbs27 = net * cbsR;
  const ibs27 = net * ibsR;
  const base27 = net + cbs27 + ibs27; // base antes do ICMS "por fora"
  const pv27 = base27 / (1 - i.icms);
  const icms27 = pv27 * i.icms;
  const ipi27 = pv27 * ipi;
  const nf27 = pv27 + ipi27 + st;

  const credBuyer26 = BUYER_PIS_COFINS * base26;
  const cost26Direct = nf26 - icms26 - credBuyer26 - ipi26;
  const cost26Indirect = nf26;
  const cost27Direct = nf27 - icms27 - cbs27 - ibs27 - ipi27;
  const cost27Indirect = nf27 - cbs27 - ibs27;

  return {
    kind: 'goods',
    net,
    y26: { base: base26, baseCbsIbs: 0, cbs: 0, ibs: 0, pis: pis26, icms: icms26, ipi: ipi26, st, nf: nf26 },
    y27: { base: base27, baseCbsIbs: net, cbs: cbs27, ibs: ibs27, pis: 0, icms: icms27, ipi: ipi27, st, nf: nf27 },
    rates: { cbs: cbsR, ibs: ibsR, pis: i.pis, icms: i.icms, ipi },
    cost: {
      direct: { y26: cost26Direct, y27: cost27Direct, delta: variation(cost26Direct, cost27Direct), impact: impactOnInvoice(cost26Direct, cost27Direct, nf26) },
      indirect: { y26: cost26Indirect, y27: cost27Indirect, delta: variation(cost26Indirect, cost27Indirect), impact: impactOnInvoice(cost26Indirect, cost27Indirect, nf26) },
    },
    supplierNet: { y26: net, y27: net },
  };
}

/**
 * Serviços. in: { gross, cbs, ibs, red, pis, iss }
 */
export function calcServices(i) {
  const cbsR = eff(i.cbs, i.red);
  const ibsR = eff(i.ibs, i.red);

  const net = i.gross * (1 - i.pis - i.iss);

  const pis26 = i.gross * i.pis;
  const iss26 = i.gross * i.iss;
  const nf26 = i.gross;

  const cbs27 = net * cbsR;
  const ibs27 = net * ibsR;
  const baseIss27 = (net + cbs27 + ibs27) / (1 - i.iss);
  const iss27 = baseIss27 * i.iss;
  const nf27 = baseIss27;
  const service27 = nf27 - cbs27 - ibs27; // valor do serviço sem CBS/IBS

  const cost26Direct = nf26 - BUYER_PIS_COFINS * i.gross;
  const cost26Indirect = nf26;
  const cost27 = nf27 - cbs27 - ibs27; // direto e indireto tomam CBS/IBS

  return {
    kind: 'services',
    net,
    y26: { service: i.gross, basePis: i.gross, baseIss: i.gross, baseCbsIbs: 0, cbs: 0, ibs: 0, pis: pis26, iss: iss26, nf: nf26 },
    y27: { service: service27, basePis: 0, baseIss: baseIss27, baseCbsIbs: net, cbs: cbs27, ibs: ibs27, pis: 0, iss: iss27, nf: nf27 },
    rates: { cbs: cbsR, ibs: ibsR, pis: i.pis, iss: i.iss },
    cost: {
      direct: { y26: cost26Direct, y27: cost27, delta: variation(cost26Direct, cost27), impact: impactOnInvoice(cost26Direct, cost27, nf26) },
      indirect: { y26: cost26Indirect, y27: cost27, delta: variation(cost26Indirect, cost27), impact: impactOnInvoice(cost26Indirect, cost27, nf26) },
    },
    supplierNet: { y26: net, y27: net },
  };
}

/**
 * Simples Nacional — 4 cenários (direta/indireta × fornecedor optante ou não pelo regime regular de CBS/IBS).
 * in: { gross, cbs, ibs, red, simples }
 * Preço de contrato fixo: a Nota Fiscal não muda; o impacto recai na receita líquida do fornecedor.
 */
export function calcSimples(i) {
  const cbsR = eff(i.cbs, i.red);
  const ibsR = eff(i.ibs, i.red);
  const simples = i.simples || 0;
  const net = i.gross * (1 - simples);
  const simplesVal = i.gross * simples;
  const cbsOpt = net * cbsR;
  const ibsOpt = net * ibsR;

  const scenario = (direct, optante) => {
    const credit26 = direct ? BUYER_PIS_COFINS * i.gross : 0;
    const credit27 = optante ? cbsOpt + ibsOpt : 0;
    const cost26 = i.gross - credit26;
    const cost27 = i.gross - credit27;
    return {
      direct,
      optante,
      y26: { simples: simplesVal, cbs: 0, ibs: 0, nf: i.gross, supplierNet: i.gross - simplesVal, credit: credit26, cost: cost26 },
      y27: {
        simples: simplesVal,
        cbs: optante ? cbsOpt : 0,
        ibs: optante ? ibsOpt : 0,
        nf: i.gross,
        supplierNet: i.gross - simplesVal - (optante ? cbsOpt + ibsOpt : 0),
        credit: credit27,
        cost: cost27,
      },
      delta: variation(cost26, cost27),
      impact: impactOnInvoice(cost26, cost27, i.gross),
      supplierChange: optante ? 'redução' : 'sem alteração',
    };
  };

  return {
    kind: 'simples',
    net,
    rates: { cbs: cbsR, ibs: ibsR, simples },
    scenarios: {
      directNon: scenario(true, false),
      indirectOpt: scenario(false, true),
      directOpt: scenario(true, true),
      indirectNon: scenario(false, false),
    },
  };
}

// ---- Definições das abas (premissas padrão = valores da planilha) ----
export const SHEETS = {
  merc: {
    title: 'Mercadorias',
    blurb: 'Impacto dos impostos novos e atuais no período de transição, para compra de mercadorias.',
    regimes: {
      real: { label: 'Lucro Real · Não cumulativo (9,25%)', pis: 0.0925 },
      real_cumulativo: { label: 'Lucro Real · Cumulativo (3,65%)', pis: 0.0365 },
      presumido: { label: 'Lucro Presumido · Cumulativo (3,65%)', pis: 0.0365 },
    },
    defaults: { gross: 100, cbs: 0.0911, ibs: 0.001, red: 0, icms: 0.12, ipi: 0, st: 0 },
    fields: ['gross', 'net', 'cbs', 'ibs', 'red', 'pis', 'icms', 'ipi', 'st'],
    calc: calcGoods,
  },
  serv: {
    title: 'Serviços',
    blurb: 'Impacto dos impostos novos e atuais no período de transição, para contratação de serviços.',
    regimes: {
      real: { label: 'Lucro Real · Não cumulativo (9,25%)', pis: 0.0925 },
      real_cumulativo: { label: 'Lucro Real · Cumulativo (3,65%)', pis: 0.0365 },
      presumido: { label: 'Lucro Presumido · Cumulativo (3,65%)', pis: 0.0365 },
    },
    defaults: { gross: 42161.69, cbs: 0.112, ibs: 0.001, red: 0, iss: 0.02 },
    fields: ['gross', 'net', 'cbs', 'ibs', 'red', 'pis', 'iss'],
    calc: calcServices,
  },
  transp: {
    title: 'Transporte',
    blurb: 'Impacto dos impostos novos e atuais no período de transição, para fretes.',
    regimes: {
      real: { label: 'Lucro Real · Não cumulativo (9,25%)', pis: 0.0925 },
      real_cumulativo: { label: 'Lucro Real · Cumulativo (3,65%)', pis: 0.0365 },
      presumido: { label: 'Lucro Presumido · Cumulativo (3,65%)', pis: 0.0365 },
    },
    defaults: { gross: 100, cbs: 0.0911, ibs: 0.001, red: 0, icms: 0.12 },
    fields: ['gross', 'net', 'cbs', 'ibs', 'red', 'pis', 'icms'],
    calc: (i) => calcGoods({ ...i, ipi: 0, st: 0 }),
  },
  simples: {
    title: 'Simples Nacional',
    blurb: 'Impacto no Simples Nacional para serviços, mercadorias e fretes dos impostos novos e atuais.',
    regimes: null,
    defaults: { gross: 42161.69, cbs: 0.112, ibs: 0.001, red: 0, simples: 0 },
    fields: ['gross', 'net', 'cbs', 'ibs', 'red', 'simples'],
    calc: calcSimples,
  },
};

export const FIELD_META = {
  gross: { label: 'Valor da nota fiscal (bruto)', kind: 'money' },
  net: { label: 'Valor net (sem impostos)', kind: 'money', note: 'Preencha se não tiver o valor bruto; o bruto é calculado' },
  cbs: { label: 'Alíquota padrão CBS', kind: 'pct', note: 'Líquida do IBS' },
  ibs: { label: 'Alíquota padrão IBS', kind: 'pct', note: 'Em 2027 será deduzida do IBS' },
  red: { label: 'Redução alíq. IBS/CBS', kind: 'pct', note: 'Exceções previstas na LC' },
  pis: { label: 'PIS/COFINS do fornecedor', kind: 'pct', note: 'Varia conforme o regime do fornecedor' },
  icms: { label: 'ICMS', kind: 'pct', note: 'Varia conforme a operação' },
  ipi: { label: 'IPI', kind: 'pct', note: 'Varia conforme a mercadoria' },
  st: { label: 'Valor ST (R$)', kind: 'money', note: 'Regra específica por operação' },
  iss: { label: 'ISS', kind: 'pct', note: 'Varia conforme município e serviço' },
  simples: { label: 'Alíquota Simples Nacional', kind: 'pct', note: 'Varia conforme faturamento do fornecedor' },
};

export const NOTES = {
  real_cumulativo: [
    'O regime cumulativo no Lucro Real aplica-se apenas às receitas legalmente submetidas a essa sistemática. Confirme o enquadramento da operação (Lei nº 10.833/2003, art. 10, e legislação aplicável).',
    'As alíquotas gerais de 0,65% (PIS) e 3% (COFINS) somam 3,65%; operações específicas podem possuir regras diferenciadas.',
  ],
  presumido: [
    'Antes de qualquer revisão de preços, solicite a demonstração do impacto econômico líquido da reforma tributária.',
    'O aumento da alíquota não significa, necessariamente, aumento proporcional do custo ou do preço.',
    'A análise deve considerar não só o aumento de CBS/IBS, mas também possíveis novos créditos do fornecedor.',
  ],
  simples: [
    'Considere sempre o custo total de aquisição nas negociações com fornecedores do Simples Nacional, e não apenas o preço negociado.',
    'O aumento da alíquota não significa, necessariamente, aumento proporcional do custo ou do preço.',
    'A análise deve considerar não só o aumento de CBS/IBS, mas também possíveis novos créditos do fornecedor.',
  ],
};
