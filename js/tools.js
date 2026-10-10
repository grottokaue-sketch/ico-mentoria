/* Frameworks da mentoria. Cada ferramenta tem seções (tabelas, campos ou resumos).
   Colunas: t = text | area | num | sel | date | calc | st (rótulo fixo da linha)
   Linhas: dyn:true = o aluno pode adicionar linhas (min = mínimo); rows:[{label,hint,group,init}] = linhas fixas. */
(function () {
  const U = {};
  U.num = function (v) {
    if (v === undefined || v === null || v === "") return NaN;
    let s = String(v).replace(/R\$|%|\s/g, "");
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  };
  U.brl = n => (isNaN(n) ? "" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
  U.pct = n => (isNaN(n) ? "" : Math.round(n * 100) + "%");
  U.d1 = n => (isNaN(n) ? "" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
  U.esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  U.avg = a => { a = a.filter(x => !isNaN(x)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; };
  window.U = U;

  const CANVAS = [
    ["Quem são", "Setor, porte, receita, região."],
    ["Onde estão", "Canais, comunidades, eventos, ecossistema."],
    ["Dor principal", "Qual problema custa mais para eles?"],
    ["Gatilho", "O que faz agir agora?"],
    ["Alternativa atual", "O que usam hoje no lugar de nós?"],
    ["Champion", "Quem defende a compra dentro da conta?"],
    ["Decisor", "Quem assina e o que ele mede?"],
    ["Critério de compra", "O que pesa na decisão?"],
    ["Sinais de fit", "Como reconhecer um cliente ideal em uma reunião?"]
  ];

  const diag = {
    "Mercado": ["Qual o tamanho do mercado que podemos atender de verdade (nº de empresas ou pessoas e valor)?", "Quão rápido o mercado cresce e o que está mudando?", "Quem são os concorrentes e quais alternativas o cliente usa hoje, inclusive não fazer nada?"],
    "Clientes atuais": ["Quantos clientes ativos temos e quantos entraram nos últimos 12 meses?", "Quem fica, quem sai e por quê (retenção e churn)?", "Quem indica a startup e por quê?"],
    "Funil e conversão": ["De onde vêm os leads e quais origens convertem mais?", "Qual a conversão em cada etapa do funil?", "Qual o ticket médio e o ciclo de venda por segmento?"],
    "Proposta de valor": ["Que problema resolvemos e para quem?", "Por que somos melhores que as alternativas?", "Que provas temos (casos, resultados, depoimentos)?"],
    "Operação comercial": ["Existe processo de vendas escrito e usado pelo time?", "Onde os dados de clientes e leads ficam registrados (CRM ou planilha)?", "Marketing, pré-vendas e vendas têm um SLA combinado?"],
    "Unit economics": ["Qual o CAC (custo de aquisição de cliente) por segmento?", "Qual o LTV (receita ao longo da vida do cliente) e a margem?", "Em quanto tempo o cliente paga o custo de ser conquistado (payback)?"]
  };
  const diagRows = [];
  Object.keys(diag).forEach(b => diag[b].forEach(q => diagRows.push({ group: b, label: q })));

  const dftp = [];
  [["Descritivo", ["Nome do ICP (apelido interno)", "Resumo do cliente ideal em um parágrafo"]],
   ["Firmográfico (B2B)", ["Indústria", "Segmento", "Funcionários", "Receita", "Margem", "Crescimento", "Palavras-chave", "Funding", "Região"]],
   ["Técnico cultural (B2B)", ["Áreas de interesse", "Tamanho da área", "Hábitos de compra", "Tecnologias utilizadas", "Rotinas e comportamentos"]],
   ["Poderes de compra", ["Cargo do champion", "Cargo do decisor", "Cargo do influenciador"]],
   ["Perfil (B2C)", ["Idade", "Renda", "Localização", "Composição familiar"]],
   ["Comportamento (B2C)", ["Frequência de compra", "Canais", "Ocasião de uso", "Valores e estilo de vida"]]
  ].forEach(([g, items]) => items.forEach(i => dftp.push({ group: g, label: i })));

  const stages = ["Aprendizado e descoberta", "Reconhecimento do problema", "Consideração da solução", "Decisão de compra"];

  function bars(items) {
    return '<div class="bars">' + items.map(it => '<div class="bar"><span>' + U.esc(it.l) + '</span><div><i style="width:' + Math.max(0, Math.min(100, it.v)) + '%"></i></div><b>' + U.esc(it.t) + '</b></div>').join("") + "</div>";
  }
  const box = items => '<div class="sumbox">' + items.map(([k, v]) => "<div><b>" + U.esc(v) + "</b>" + U.esc(k) + "</div>").join("") + "</div>";

  const T = {};

  T.raiox = {
    num: "1.1", enc: 1, title: "Raio-X da carteira",
    intro: "Liste os clientes (ou os 20 mais recentes) e classifique: A paga bem, fica, indica e dá pouco trabalho; B funciona sem destaque; C dá pouco retorno, muito suporte ou churn.",
    sections: [{
      id: "main", kind: "table", dyn: true, min: 10, target: 10,
      columns: [
        { k: "cliente", l: "Cliente", t: "text", w: 180 }, { k: "classe", l: "Classe", t: "sel", o: ["A", "B", "C"], w: 80 },
        { k: "setor", l: "Setor", t: "text", w: 150 }, { k: "porte", l: "Porte", t: "text", w: 120 }, { k: "regiao", l: "Região", t: "text", w: 120 },
        { k: "ticket", l: "Ticket anual (R$)", t: "num", fmt: "brl", w: 130 }, { k: "ciclo", l: "Ciclo (dias)", t: "num", w: 90 },
        { k: "origem", l: "Como chegou", t: "text", w: 140 }, { k: "porque", l: "Por que essa classe?", t: "area", w: 260 }
      ],
      sum: c => {
        const r = c.rows; const A = r.filter(x => x.classe === "A"), B = r.filter(x => x.classe === "B"), C = r.filter(x => x.classe === "C");
        return box([["Classe A", A.length], ["Classe B", B.length], ["Classe C", C.length],
          ["Ticket médio dos A", U.brl(U.avg(A.map(x => U.num(x.ticket)))) || "-"], ["Ciclo médio dos A", U.d1(U.avg(A.map(x => U.num(x.ciclo)))) || "-"]]);
      }
    }]
  };

  T.percepcao = {
    num: "1.2", enc: 1, title: "Mapa de percepção",
    intro: "Cada pessoa responde sozinha, por escrito, sem conversar. Troque 'Pessoa 1 a 4' pelos nomes. Depois registrem onde o time concorda e onde diverge.",
    sections: [{
      id: "main", kind: "table", target: 5,
      rows: [{ label: "Quais 3 clientes foram os mais fáceis de vender? Por quê?" }, { label: "Quais deram mais resultado, para eles e para nós?" }, { label: "Quais nos indicaram?" }, { label: "Quais deram muito trabalho e valeram pouco?" }, { label: "Se pudéssemos clonar um cliente, qual seria?" }],
      columns: [{ k: "_l", l: "Pergunta", t: "st", w: 260 }, { k: "p1", l: "Pessoa 1", t: "area" }, { k: "p2", l: "Pessoa 2", t: "area" }, { k: "p3", l: "Pessoa 3", t: "area" }, { k: "p4", l: "Pessoa 4", t: "area" }, { k: "cons", l: "Consenso e divergências", t: "area" }]
    }]
  };

  T.materiais = {
    num: "1.3", enc: 1, title: "Materiais disponíveis",
    intro: "Antes de criar, procure o que já existe. Marque se o documento existe, onde está e o que ele revela sobre o cliente ideal.",
    sections: [{
      id: "main", kind: "table", target: 5,
      rows: [{ label: "Material de ICP", hint: "PDFs com perfis de compra, hábitos e traços subjetivos. Entregas antigas de agências servem." },
        { label: "Apresentação de resultados", hint: "Reuniões anuais, trimestrais ou mensais: o material de apoio dá pistas do ICP." },
        { label: "Playbooks de vendas", hint: "Lista de clientes e indicadores de sucesso deles com a sua solução." },
        { label: "Planejamento e estratégia", hint: "Planejamento de longo prazo, pitch deck para investidores, documentos internos." },
        { label: "Base de clientes", hint: "Lista atualizada de clientes (CRM, planilhas, notas fiscais) com indicadores de sucesso." }],
      columns: [{ k: "_l", l: "Documento", t: "st", w: 300 }, { k: "tem", l: "Tem?", t: "sel", o: ["Sim", "Não", "Parcial"], w: 100 }, { k: "onde", l: "Onde está (link ou pasta)", t: "text", w: 260 }, { k: "achado", l: "O que descobrimos sobre o ICP", t: "area" }]
    }]
  };

  T.diagnostico = {
    num: "1.4", enc: 1, title: "Diagnóstico em 6 blocos",
    intro: "Responda, cite a evidência e dê uma nota de maturidade: 0 = não existe, 1 = informal, 2 = existe mas incompleto, 3 = sólido e documentado. A leitura por bloco mostra as lacunas.",
    sections: [{
      id: "main", kind: "table", target: 18, rows: diagRows,
      columns: [{ k: "_l", l: "Bloco · pergunta", t: "st", w: 320 }, { k: "resp", l: "Resposta", t: "area", w: 260 }, { k: "evid", l: "Evidência ou fonte", t: "area", w: 200 },
        { k: "nota", l: "Nota (0 a 3)", t: "sel", o: ["0", "1", "2", "3"], w: 90 }, { k: "acao", l: "Lacuna ou ação", t: "area", w: 200 }],
      sum: c => {
        const blocks = Object.keys(diag); const items = []; let all = [];
        blocks.forEach(b => {
          const ns = c.defs.map((d, i) => d.group === b ? U.num(c.rows[i].nota) : NaN).filter(x => !isNaN(x)); all = all.concat(ns);
          const a = U.avg(ns); items.push({ l: b, v: isNaN(a) ? 0 : a / 3 * 100, t: isNaN(a) ? "-" : U.d1(a) });
        });
        const g = U.avg(all);
        return bars(items) + '<p class="foot">Média geral: ' + (isNaN(g) ? "-" : U.d1(g)) + ' de 3. Blocos com média abaixo de 1,5 são as lacunas prioritárias.</p>';
      }
    }]
  };

  T.velocity = {
    num: "1.5", enc: 1, title: "Sales Velocity por segmento",
    intro: "Velocity = (nº de leads × conversão × ticket anual) ÷ dias de ciclo. Mostra quanto cada dia de esforço rende em cada segmento. Estimativa vale hoje; o dado real vem no dever de casa.",
    sections: [{
      id: "main", kind: "table", dyn: true, min: 3, target: 2,
      columns: [{ k: "seg", l: "Segmento", t: "text", w: 220 }, { k: "leads", l: "Leads no período", t: "num", w: 110 }, { k: "conv", l: "Conversão (%)", t: "num", w: 110 }, { k: "ticket", l: "Ticket anual (R$)", t: "num", fmt: "brl", w: 140 }, { k: "ciclo", l: "Ciclo (dias)", t: "num", w: 100 },
        { k: "vel", l: "Velocity (R$ por dia)", t: "calc", w: 150, f: c => { const v = U.num(c.row.leads) * (U.num(c.row.conv) / 100) * U.num(c.row.ticket) / U.num(c.row.ciclo); return isFinite(v) ? U.brl(v) : ""; } },
        { k: "rank", l: "Posição", t: "calc", w: 80, f: c => { const vs = c.rows.map(r => U.num(r.leads) * (U.num(r.conv) / 100) * U.num(r.ticket) / U.num(r.ciclo)); const me = vs[c.i]; if (!isFinite(me)) return ""; return 1 + vs.filter(v => isFinite(v) && v > me).length + "º"; } }],
      sum: c => {
        const vs = c.rows.map((r, i) => ({ s: r.seg, v: U.num(r.leads) * (U.num(r.conv) / 100) * U.num(r.ticket) / U.num(r.ciclo) })).filter(x => isFinite(x.v) && x.s);
        if (vs.length < 2) return '<p class="foot">Preencha ao menos 2 segmentos para comparar.</p>';
        vs.sort((a, b) => b.v - a.v); const r = vs[0].v / vs[vs.length - 1].v;
        return box([["Segmento que mais rende", vs[0].s], ["Rende por dia", U.brl(vs[0].v)], ["Vezes o pior segmento", U.d1(r) + "×"]]);
      }
    }]
  };

  T.entrevistas = {
    num: "1.6", enc: 1, title: "Entrevistas com clientes",
    intro: "Meta: 5 entrevistas com os melhores clientes e 3 com clientes fora do ICP, para contraste. 20 minutos cada. Pergunte, escute e anote; não venda.",
    sections: [{
      id: "main", kind: "table", dyn: true, min: 8, target: 8,
      columns: [{ k: "cliente", l: "Cliente", t: "text", w: 160 }, { k: "tipo", l: "Tipo", t: "sel", o: ["ICP", "Fora do ICP"], w: 110 }, { k: "data", l: "Data", t: "date", w: 130 },
        { k: "q1", l: "1. Como chegou até nós?", t: "area", w: 190 }, { k: "q2", l: "2. Que problema queria resolver?", t: "area", w: 190 }, { k: "q3", l: "3. O que o fez agir naquele momento?", t: "area", w: 190 },
        { k: "q4", l: "4. O que usava antes e quem mais considerou?", t: "area", w: 190 }, { k: "q5", l: "5. O que pesou na decisão?", t: "area", w: 190 }, { k: "q6", l: "6. Que resultado teve até agora?", t: "area", w: 190 },
        { k: "q7", l: "7. Para quem nos indicaria?", t: "area", w: 190 }, { k: "desap", l: "Ficaria muito desapontado sem o produto?", t: "sel", o: ["Sim", "Não", "Não sei"], w: 130 }, { k: "insight", l: "Principal insight", t: "area", w: 220 }],
      sum: c => {
        const icp = c.rows.filter(r => r.tipo === "ICP"), fora = c.rows.filter(r => r.tipo === "Fora do ICP");
        const resp = icp.filter(r => r.desap); const sim = resp.filter(r => r.desap === "Sim").length;
        return box([["Entrevistas ICP", icp.length], ["Fora do ICP", fora.length], ["'Muito desapontado' (ICP)", resp.length ? U.pct(sim / resp.length) : "-"]]) +
          '<p class="foot">Referência de mercado: cerca de 40% de "muito desapontado" costuma indicar bom ajuste produto-mercado. Use como indicativo, não como regra.</p>';
      }
    }]
  };

  T.padroes = {
    num: "2.1", enc: 2, title: "Do dado ao padrão",
    intro: "Cruze o Raio-X, o funil e as entrevistas. Para cada característica, registre o que se repete nos melhores clientes e em quantos deles. Referência: padrão forte = presente em 70% ou mais dos melhores clientes.",
    sections: [
      { id: "cfg", kind: "fields", fields: [{ k: "total", l: "Nº de melhores clientes (classe A)", t: "num", auto: c => { const n = c.get("raiox", "main").filter(r => r.classe === "A").length; return n || ""; } }] },
      {
        id: "main", kind: "table", target: 12,
        rows: [["Setor e segmento", "Em que setor e segmento estão?"], ["Porte", "Quantos funcionários ou que faixa de receita?"], ["Região", "Onde estão?"], ["Ticket médio", "Quanto pagam?"], ["Ciclo de venda", "Quanto tempo levam para decidir?"], ["Problema que resolvemos", "Qual dor os trouxe até nós?"], ["Gatilho de compra", "O que os fez agir naquele momento?"], ["Alternativa que usavam", "O que usavam antes?"], ["Critério de decisão", "O que pesou na escolha?"], ["Quem comprou", "Cargo do champion e do decisor"], ["Canal de origem", "Como chegaram até nós?"], ["Resultado obtido", "Que resultado tiveram?"]].map(a => ({ label: a[0], hint: a[1] })),
        columns: [{ k: "_l", l: "Característica", t: "st", w: 250 }, { k: "repete", l: "O que se repete nos melhores clientes", t: "area", w: 300 }, { k: "fonte", l: "Fonte", t: "text", w: 140 }, { k: "n", l: "Nº que confirmam", t: "num", w: 100 },
          { k: "pct", l: "% (auto)", t: "calc", w: 80, f: c => { const tot = c.total(); const n = U.num(c.row.n); return isNaN(n) || !tot ? "" : U.pct(n / tot); } },
          { k: "forca", l: "Força (auto)", t: "calc", w: 100, f: c => { const tot = c.total(); const n = U.num(c.row.n); if (isNaN(n) || !tot) return ""; const p = n / tot; return p >= 0.7 ? "Forte" : p >= 0.4 ? "Média" : "Fraca"; } },
          { k: "entra", l: "Entra no ICP?", t: "sel", o: ["Sim", "Não", "Talvez"], w: 110 }]
      }]
  };

  T.canvas = {
    num: "2.2", enc: 2, title: "Canvas do ICP",
    intro: "Uma frase por quadro. Se a resposta precisar de mais de uma frase, o ICP ainda está largo demais. Registre de onde veio a evidência e o nível de confiança.",
    sections: [{
      id: "main", kind: "table", target: 9, rows: CANVAS.map(a => ({ label: a[0], hint: a[1] })),
      columns: [{ k: "_l", l: "Quadro", t: "st", w: 230 }, { k: "resp", l: "Resposta v1", t: "area", w: 340 }, { k: "evid", l: "Evidência (de onde veio)", t: "area", w: 260 }, { k: "conf", l: "Confiança", t: "sel", o: ["Alta", "Média", "Baixa"], w: 100 }, { k: "status", l: "Status (encontro 3)", t: "sel", o: ["Confirmar", "Ajustar", "Descartar"], w: 130 }]
    }]
  };

  T.dftp = {
    num: "2.3", enc: 2, title: "Critérios D.F.T.P.",
    intro: "Defina o valor ideal de cada critério (ex.: Funcionários = 50 a 500). Preencha o bloco que serve ao seu negócio (B2B ou B2C) e deixe o outro vazio. Marque quais critérios entram no Fit Score.",
    sections: [{
      id: "main", kind: "table", target: 8, rows: dftp,
      columns: [{ k: "_l", l: "Lente · critério", t: "st", w: 280 }, { k: "def", l: "Definição do ICP (valor ideal)", t: "area", w: 360 }, { k: "fonte", l: "Fonte do dado", t: "text", w: 200 }, { k: "entra", l: "Entra no Fit Score?", t: "sel", o: ["Sim", "Não"], w: 110 }]
    }]
  };

  T.personas = {
    num: "2.4", enc: 2, title: "Personas e comitê de compra",
    intro: "Descreva as pessoas para quem vendemos dentro da conta. Persona A, B e C são usadas na matriz de tiers. Use as linhas extras para outros papéis (usuário, bloqueador).",
    sections: [{
      id: "main", kind: "table", target: 3, rows: ["Persona A", "Persona B", "Persona C", "Persona D", "Persona E"].map(l => ({ label: l })),
      columns: [{ k: "_l", l: "Persona", t: "st", w: 120 }, { k: "papel", l: "Papel na compra", t: "sel", o: ["Champion", "Decisor", "Influenciador", "Usuário", "Bloqueador"], w: 130 }, { k: "cargo", l: "Cargo", t: "text", w: 160 }, { k: "mede", l: "O que mede (metas)", t: "area", w: 220 },
        { k: "teme", l: "O que teme", t: "area", w: 220 }, { k: "abord", l: "Como prefere ser abordado", t: "area", w: 220 }, { k: "canal", l: "Canal", t: "text", w: 120 }, { k: "obj", l: "Objeções comuns", t: "area", w: 220 }]
    }]
  };

  T.fit = {
    num: "2.5", enc: 2, title: "Fit Score",
    intro: "1) Ajuste critérios e pesos (a soma deve ser 100) e os cortes de tier. 2) Dê nota 0, 1 ou 2 a cada cliente e lead: 0 = não atende, 1 = atende em parte, 2 = atende plenamente. Teste: os clientes classe A do Raio-X devem cair no Tier 1.",
    sections: [
      {
        id: "crit", kind: "table", title: "1. Critérios e pesos", target: 6, noTrack: true,
        rows: [["Porte e faturamento", 20, "0 = fora da faixa; 1 = perto; 2 = dentro da faixa do ICP"], ["Segmento e setor", 20, "0 = outro setor; 1 = setor adjacente; 2 = setor do ICP"], ["Dor e urgência", 20, "0 = sem dor; 1 = dor sem urgência; 2 = dor com gatilho ativo"], ["Maturidade (processos, tecnologia)", 15, "0 = nenhuma; 1 = parcial; 2 = pronta para usar a solução"], ["Capacidade de pagar", 15, "0 = sem orçamento; 1 = orçamento incerto; 2 = orçamento confirmado"], ["Acesso ao decisor", 10, "0 = sem acesso; 1 = via intermediário; 2 = acesso direto"]].map(a => ({ init: { crit: a[0], peso: a[1], como: a[2] } })),
        columns: [{ k: "crit", l: "Critério", t: "text", w: 280 }, { k: "peso", l: "Peso", t: "num", w: 90 }, { k: "como", l: "Como pontuar (0 / 1 / 2)", t: "area", w: 420 }],
        sum: c => { const s = c.rows.reduce((a, r) => a + (U.num(r.peso) || 0), 0); return '<p class="' + (s === 100 ? "pill-ok" : "pill-bad") + '"><b>Soma dos pesos: ' + s + "</b> " + (s === 100 ? "(OK)" : "(deve ser 100)") + "</p>"; }
      },
      { id: "cut", kind: "fields", title: "Cortes de tier (nota mínima, de 0 a 100)", fields: [{ k: "t1", l: "Tier 1 a partir de", t: "num", def: 80 }, { k: "t2", l: "Tier 2 a partir de", t: "num", def: 60 }, { k: "t3", l: "Tier 3 a partir de", t: "num", def: 40 }] },
      {
        id: "score", kind: "table", dyn: true, min: 10, target: 10, title: "2. Pontuação de clientes e leads",
        columns: [{ k: "nome", l: "Nome (cliente ou lead)", t: "text", w: 200 }, { k: "tipo", l: "Tipo", t: "sel", o: ["Cliente ativo", "Lead ganho", "Lead perdido"], w: 130 }]
          .concat([0, 1, 2, 3, 4, 5].map(i => ({ k: "n" + i, l: c => (c.val("fit", "crit", i, "crit") || "Critério " + (i + 1)) + " (peso " + (c.val("fit", "crit", i, "peso") || "-") + ")", t: "sel", o: ["0", "1", "2"], w: 110 })))
          .concat([{ k: "score", l: "Fit Score", t: "calc", w: 90, f: c => { const s = fitScore(c.row, c); return isNaN(s) ? "" : U.d1(s); } }, { k: "tier", l: "Tier", t: "calc", w: 100, f: c => fitTier(fitScore(c.row, c), c) }]),
        sum: c => {
          const rows = c.rows.filter(r => fitTier(fitScore(r, c), c)); const tiers = ["Tier 1", "Tier 2", "Tier 3", "Fora do ICP"];
          let h = '<div class="twrap"><table class="grid"><tr><th>Tier</th><th>Nº</th><th>Ganhos</th><th>Perdidos</th><th>Taxa de ganho</th></tr>';
          tiers.forEach(t => { const rs = rows.filter(r => fitTier(fitScore(r, c), c) === t); const g = rs.filter(r => r.tipo === "Cliente ativo" || r.tipo === "Lead ganho").length, p = rs.filter(r => r.tipo === "Lead perdido").length; h += '<tr><td class="st">' + t + '</td><td class="calc">' + rs.length + '</td><td class="calc">' + g + '</td><td class="calc">' + p + '</td><td class="calc">' + (g + p ? U.pct(g / (g + p)) : "") + "</td></tr>"; });
          return h + '</table></div><p class="foot">Se o Tier 1 não tiver a maior taxa de ganho, revise pesos e critérios.</p>';
        }
      }]
  };
  function fitScore(row, c) {
    let tot = 0;
    for (let i = 0; i < 6; i++) { const n = U.num(row["n" + i]); const w = U.num(c.val("fit", "crit", i, "peso")); if (isNaN(n)) return NaN; tot += (isNaN(w) ? 0 : w) * n; }
    return tot / 2;
  }
  function fitTier(s, c) {
    if (isNaN(s)) return "";
    const f = c.fields("fit", "cut"); const a = U.num(f.t1), b = U.num(f.t2), d = U.num(f.t3);
    return s >= a ? "Tier 1" : s >= b ? "Tier 2" : s >= d ? "Tier 3" : "Fora do ICP";
  }

  const ACAO = { 1: "Contato imediato com executivo", 2: "Contato prioritário", 3: "Cadência padrão", 4: "Nutrição automatizada", 5: "Autoatendimento" };
  T.tiers = {
    num: "2.6", enc: 2, title: "Matriz de tiers: empresa × persona",
    intro: "Defina o que significa cada tier de empresa e cada persona. A prioridade é calculada (1 = máxima): tier da empresa + tier da persona − 1. Use o Fit Score (2.5) para classificar as empresas e a aba 2.4 para as personas.",
    sections: [
      { id: "defE", kind: "table", title: "Tiers de empresa", target: 3, rows: [{ label: "Tier 1" }, { label: "Tier 2" }, { label: "Tier 3" }], columns: [{ k: "_l", l: "Tier", t: "st", w: 120 }, { k: "def", l: "Definição (porte, faixa de Fit Score, outros)", t: "area" }] },
      { id: "defP", kind: "table", title: "Personas", target: 3, noTrack: true, rows: [{ label: "Persona A" }, { label: "Persona B" }, { label: "Persona C" }], columns: [{ k: "_l", l: "Persona", t: "st", w: 120 }, { k: "def", l: "Definição (cargo, papel na compra)", t: "area" }] },
      {
        id: "mx", kind: "html", render: () => {
          let h = '<div class="matrix"><div></div><div>Persona A</div><div>Persona B</div><div>Persona C</div>';
          [1, 2, 3].forEach(t => { h += "<div>Tier " + t + "</div>"; ["A", "B", "C"].forEach((p, j) => { const pr = t + j; h += '<div class="gm s' + (pr - 1) + '" style="min-height:70px;font-size:18px">Prioridade ' + pr + "</div>"; }); });
          return h + "</div>";
        }
      },
      {
        id: "contas", kind: "table", title: "Contas classificadas", dyn: true, min: 6, target: 6,
        columns: [{ k: "conta", l: "Conta", t: "text", w: 220 }, { k: "te", l: "Tier da empresa", t: "sel", o: ["1", "2", "3"], w: 120 }, { k: "pp", l: "Persona", t: "sel", o: ["A", "B", "C"], w: 90 },
          { k: "prio", l: "Prioridade", t: "calc", w: 100, f: c => { const t = U.num(c.row.te); if (isNaN(t) || !c.row.pp) return ""; return String(t + (c.row.pp.charCodeAt(0) - 64) - 1); } },
          { k: "acao", l: "Ação recomendada", t: "calc", w: 240, f: c => { const t = U.num(c.row.te); if (isNaN(t) || !c.row.pp) return ""; return ACAO[t + (c.row.pp.charCodeAt(0) - 64) - 1]; } }, { k: "resp", l: "Responsável", t: "text", w: 150 }]
      }]
  };

  T.anti = {
    num: "3.1", enc: 3, title: "Anti-ICP e lista de bloqueio",
    intro: "Quem a startup não deve atender. Marque quais sinais de alerta se aplicam, traga exemplos reais da carteira (piores clientes do Raio-X) e defina a ação. Registre as contas bloqueadas na tabela de baixo.",
    sections: [
      {
        id: "main", kind: "table", target: 6, rows: ["Exige customização que a startup não consegue escalar", "Compra só por preço e troca na primeira oferta", "Ciclo longo e sem decisor acessível", "Expectativa maior do que a promessa", "Churn rápido ou muito suporte para pouco retorno", "Outro sinal (descreva nos exemplos)"].map(l => ({ label: l })),
        columns: [{ k: "_l", l: "Sinal de alerta", t: "st", w: 300 }, { k: "aplica", l: "Se aplica?", t: "sel", o: ["Sim", "Não"], w: 90 }, { k: "ex", l: "Exemplos reais (clientes)", t: "area", w: 260 }, { k: "id", l: "Como identificar cedo", t: "area", w: 260 }, { k: "acao", l: "Ação", t: "sel", o: ["Descartar", "Encaminhar", "Cobrar à parte", "Monitorar"], w: 130 }]
      },
      { id: "bl", kind: "table", title: "Lista de bloqueio (blacklist)", dyn: true, min: 5, target: 1, noTrack: true, columns: [{ k: "conta", l: "Conta", t: "text", w: 220 }, { k: "data", l: "Data", t: "date", w: 140 }, { k: "motivo", l: "Motivo", t: "area", w: 320 }, { k: "resp", l: "Responsável", t: "text", w: 160 }] }]
  };

  T.validacao = {
    num: "3.2", enc: 3, title: "Validação do ICP",
    intro: "Para cada quadro do Canvas (2.2), traga a evidência das entrevistas (1.6) e dos dados (1.5 e 2.5) e decida: confirmar, ajustar ou descartar. Só critérios confirmados entram no ICP final.",
    sections: [{
      id: "main", kind: "table", target: 9, rows: CANVAS.map(a => ({ label: a[0] })),
      columns: [{ k: "_l", l: "Quadro", t: "st", w: 170 }, { k: "hip", l: "Hipótese v1 (do Canvas)", t: "calc", w: 280, wrap: 1, f: c => c.val("canvas", "main", c.i, "resp") || "" },
        { k: "ent", l: "Evidência das entrevistas", t: "area", w: 260 }, { k: "dados", l: "Evidência dos dados", t: "area", w: 260 }, { k: "dec", l: "Decisão", t: "sel", o: ["Confirmar", "Ajustar", "Descartar"], w: 120 }, { k: "aj", l: "Versão ajustada", t: "area", w: 280 }],
      sum: c => { const n = k => c.rows.filter(r => r.dec === k).length; return box([["Confirmados", n("Confirmar")], ["Ajustados", n("Ajustar")], ["Descartados", n("Descartar")], ["Pendentes", 9 - n("Confirmar") - n("Ajustar") - n("Descartar")]]); }
    }]
  };

  T.jornada = {
    num: "3.3", enc: 3, title: "Jornada de compra do cliente ideal",
    intro: "Para cada etapa, descreva onde o cliente ideal está, o que marketing e vendas fazem e o critério para avançar. A postura de vendas é a referência do workshop.",
    sections: [{
      id: "main", kind: "table", target: 4,
      rows: [["Aprendizado e descoberta", "Perca pouco tempo e direcione material e conteúdo. Ajude com o conteúdo de que o lead precisa."], ["Reconhecimento do problema", "Ajude, seja consultivo, faça perguntas e se importe genuinamente. Leve para a próxima etapa."], ["Consideração da solução", "Demonstre a solução focando no que o lead realmente precisa. Menos é mais; o básico é o essencial."], ["Decisão de compra", "Priorize! Seja rápido e prestativo."]].map(a => ({ label: a[0], hint: a[1] })),
      columns: [{ k: "_l", l: "Etapa · postura de vendas", t: "st", w: 320 }, { k: "canais", l: "Onde o ICP está (canais)", t: "area", w: 220 }, { k: "mkt", l: "Conteúdo ou ação de marketing", t: "area", w: 240 }, { k: "vend", l: "Ação do vendedor", t: "area", w: 240 }, { k: "crit", l: "Critério para avançar", t: "area", w: 220 }]
    }]
  };

  const MQ = { "Alinhado ao ICP|Interessado": "Contatar imediatamente", "Alinhado ao ICP|Desinteressado": "Nutrir o lead", "Fora do ICP|Interessado": "Evitar ou atender a demanda", "Fora do ICP|Desinteressado": "Remover o lead" };
  T.matriz = {
    num: "3.4", enc: 3, title: "Matriz de qualificação",
    intro: "Combine o ICP com a jornada de compra. Parte 1: o que fazer por segmento e etapa. Parte 2: a regra padrão por perfil × interesse. Parte 3: pratique com leads reais. Parte 4: critérios mínimos de 'alinhado' e 'interessado'.",
    sections: [
      { id: "acoes", kind: "table", title: "1. Ação por segmento e etapa da jornada (do maior ao menor potencial)", dyn: true, min: 4, target: 3, columns: [{ k: "seg", l: "Segmento", t: "text", w: 180 }].concat(stages.map((s, i) => ({ k: "e" + i, l: s, t: "area", w: 200 }))) },
      {
        id: "regra", kind: "table", title: "2. Regra de decisão: perfil × interesse (referência HubSpot)", target: 4, noTrack: true,
        rows: [["Alinhado e interessado", "Contatar imediatamente"], ["Alinhado e desinteressado", "Nutrir o lead"], ["Desalinhado e interessado", "Evitar ou atender a demanda pontual"], ["Desalinhado e desinteressado", "Remover o lead"]].map(a => ({ label: a[0], hint: a[1] })),
        columns: [{ k: "_l", l: "Situação · ação padrão", t: "st", w: 320 }, { k: "prazo", l: "Prazo de resposta", t: "text", w: 160 }, { k: "resp", l: "Responsável", t: "text", w: 180 }]
      },
      {
        id: "leads", kind: "table", title: "3. Pratique com leads recentes", dyn: true, min: 6, target: 6, noTrack: true,
        columns: [{ k: "lead", l: "Lead", t: "text", w: 200 }, { k: "perf", l: "Perfil", t: "sel", o: ["Alinhado ao ICP", "Fora do ICP"], w: 150 }, { k: "int", l: "Interesse", t: "sel", o: ["Interessado", "Desinteressado"], w: 150 },
          { k: "acao", l: "Ação pela matriz", t: "calc", w: 220, f: c => MQ[c.row.perf + "|" + c.row.int] || "" }, { k: "real", l: "O que o time fez de fato", t: "area", w: 280 }]
      },
      {
        id: "crit", kind: "table", title: "4. Critérios mínimos", target: 8, noTrack: true,
        rows: [["Perfil", "Tamanho da empresa"], ["Perfil", "Segmento da empresa"], ["Perfil", "Cargo do buyer persona"], ["Perfil", "Características do buyer persona"], ["Interesse", "Objetivo e dores"], ["Interesse", "Senso de urgência"], ["Interesse", "Ações de engajamento"], ["Interesse", "Estágio na jornada de compra"]].map(a => ({ group: a[0], label: a[1] })),
        columns: [{ k: "_l", l: "Eixo · critério", t: "st", w: 300 }, { k: "regra", l: "Regra mínima", t: "area" }]
      }]
  };

  T.sla = {
    num: "3.5", enc: 3, title: "SLA entre marketing, pré-vendas e vendas",
    intro: "Defina quando um lead muda de estágio, quem aceita, em quanto tempo responde e quais campos são obrigatórios no CRM ou na planilha de leads. Revise o SLA a cada 6 a 12 meses.",
    sections: [
      {
        id: "main", kind: "table", target: 5, rows: [["Lead", "Potencial cliente"], ["MQL", "Lead qualificado por marketing"], ["SQL", "Lead qualificado por vendas"], ["OPP", "Oportunidade"], ["Cliente", "Venda fechada"]].map(a => ({ label: a[0], hint: a[1] })),
        columns: [{ k: "_l", l: "Sigla", t: "st", w: 220 }, { k: "crit", l: "Critério de entrada (baseado no ICP)", t: "area", w: 320 }, { k: "aceita", l: "Quem aceita", t: "text", w: 160 }, { k: "tempo", l: "Tempo de resposta", t: "text", w: 150 }, { k: "campos", l: "Campos obrigatórios", t: "area", w: 260 }]
      },
      { id: "rot", kind: "table", title: "Rotina de acompanhamento", target: 4, noTrack: true, rows: ["Frequência da reunião de SLA", "Responsável por conduzir", "Indicadores revisados", "Data da próxima revisão do SLA"].map(l => ({ label: l })), columns: [{ k: "_l", l: "Item", t: "st", w: 280 }, { k: "def", l: "Definição", t: "area" }] }]
  };

  T.metricas = {
    num: "3.6", enc: 3, title: "Métricas do ICP",
    intro: "Registre a situação inicial (baseline), a meta para 90 dias e o valor de cada mês. 'Atingiu?' compara o último valor preenchido com a meta, considerando se é melhor quando maior ou menor.",
    sections: [{
      id: "main", kind: "table", target: 8,
      rows: [["% do pipeline dentro do ICP", "Oportunidades Tier 1 e 2 ÷ total de oportunidades", "up"], ["Conversão Tier 1", "Ganhos ÷ oportunidades do Tier 1", "up"], ["Conversão Tier 2", "Ganhos ÷ oportunidades do Tier 2", "up"], ["Conversão Tier 3", "Ganhos ÷ oportunidades do Tier 3", "up"], ["Ciclo de vendas Tier 1 (dias)", "Média de dias entre lead e fechamento", "down"], ["CAC do segmento prioritário (R$)", "Custo de vendas e marketing ÷ clientes novos", "down"], ["Retenção ou indicação do Tier 1", "Clientes que ficam ou indicam ÷ clientes do tier", "up"], ["Ticket médio do Tier 1 (R$)", "Receita ÷ nº de clientes do tier", "up"]].map(a => ({ label: a[0], hint: a[1], better: a[2] })),
      columns: [{ k: "_l", l: "Indicador · como calcular", t: "st", w: 320 }, { k: "mel", l: "Melhor quando", t: "calc", w: 100, f: c => (c.def.better === "up" ? "Maior" : "Menor") }, { k: "base", l: "Baseline", t: "num", w: 100 }, { k: "meta", l: "Meta 90 dias", t: "num", w: 100 }, { k: "m1", l: "Mês 1", t: "num", w: 80 }, { k: "m2", l: "Mês 2", t: "num", w: 80 }, { k: "m3", l: "Mês 3", t: "num", w: 80 },
        { k: "ult", l: "Último valor", t: "calc", w: 100, f: c => { const v = ["m3", "m2", "m1"].map(k => c.row[k]).find(x => x !== undefined && x !== ""); return v === undefined ? "" : v; } },
        { k: "ok", l: "Atingiu?", t: "calc", w: 90, f: c => { const v = U.num(["m3", "m2", "m1"].map(k => c.row[k]).find(x => x !== undefined && x !== "")); const m = U.num(c.row.meta); if (isNaN(v) || isNaN(m)) return ""; return (c.def.better === "up" ? v >= m : v <= m) ? "Sim" : "Não"; } }]
    }]
  };

  const plano = [["Até 30 dias", "Apresentar o ICP a todo o time"], ["Até 30 dias", "Criar campos de tier e persona no CRM ou na planilha de leads"], ["Até 30 dias", "Treinar o pitch para o ICP"], ["Até 60 dias", "Direcionar prospecção e marketing para os tiers 1 e 2"], ["Até 60 dias", "Aplicar a matriz de qualificação nos leads novos"], ["Até 60 dias", "Realizar a primeira reunião de SLA"], ["Até 90 dias", "Medir conversão, ciclo e CAC por tier"], ["Até 90 dias", "Revisar os pesos do Fit Score"], ["Até 90 dias", "Decidir o que ajustar no ICP e agendar a próxima revisão"]];
  T.plano = {
    num: "3.7", enc: 3, title: "Plano de 90 dias",
    intro: "Ações para colocar o ICP para trabalhar. Defina responsável, prazo e status. Use as linhas em branco para novas ações.",
    sections: [{
      id: "main", kind: "table", dyn: true, min: 9, target: 9, trackCols: ["resp", "prazo"],
      init: plano.map(a => ({ marco: a[0], acao: a[1] })),
      columns: [{ k: "marco", l: "Marco", t: "sel", o: ["Até 30 dias", "Até 60 dias", "Até 90 dias"], w: 120 }, { k: "acao", l: "Ação", t: "area", w: 380 }, { k: "resp", l: "Responsável", t: "text", w: 160 }, { k: "prazo", l: "Prazo", t: "date", w: 140 }, { k: "status", l: "Status", t: "sel", o: ["Não iniciado", "Em andamento", "Concluído"], w: 130 }, { k: "obs", l: "Observação", t: "area", w: 240 }],
      sum: c => { const n = c.rows.filter(r => r.acao); const d = n.filter(r => r.status === "Concluído").length; return box([["Ações", n.length], ["Concluídas", d], ["Avanço", n.length ? U.pct(d / n.length) : "-"]]); }
    }]
  };

  window.TOOLS = T;
  window.TOOL_ORDER = ["raiox", "percepcao", "materiais", "diagnostico", "velocity", "entrevistas", "padroes", "canvas", "dftp", "personas", "fit", "tiers", "anti", "validacao", "jornada", "matriz", "sla", "metricas", "plano"];
})();
