# Cobertura funcional — RTC integrado

**Data da verificação:** 18/11/2026. Repositório independente; motores originais © 2026 Receita Federal do Brasil (MIT).

## Interface e motores

| Função | Interface única | Motor responsável | Estado |
|---|---|---|---|
| Simulador de impacto 2026 → 2027 (mercadorias/serviços/fretes) | Sim | Fórmulas da planilha original (JS) | Preservado em `/simulador` e integrado ao painel |
| PIS/COFINS cumulativo e não cumulativo do cenário | Sim | Simulador legado | Preservado; não confundir com motor RTC |
| Regime Regular: CBS, IBS e Imposto Seletivo por item | Sim | Java Regime Regular | Disponível; 2027 com alíquotas informadas aparece como **simulação** |
| Regime Regular: observabilidade por item | Sim | Java Regime Regular | Disponível, mensagens de erro por item |
| Compras governamentais | Sim, opcional na operação | Java Regime Regular | Dados de ente público e tipo de operação enviados ao motor |
| Tributação regular por item | Sim, opcional no item | Java Regime Regular | CST e cClassTrib específicos enviados ao motor |
| Componentes detalhados da base | Sim, opcional no item | Java Regime Regular | `gComponentesBC` com 15 campos de valor; cálculo/validação são no motor |
| Fuso horário da operação | Sim | Regime Regular | Seleção explícita de offsets; confirmar fuso local ao preencher |
| Base unificada NF-e/NFC-e/NFS-e | Sim | Java Regime Regular | Tela existente integrada, regras por ano e documento |
| Base auxiliar CBS/IBS mercadorias | Sim | Java Regime Regular | Formulário específico |
| Base auxiliar de IS mercadorias | Sim | Java Regime Regular | Formulário específico |
| Pedágio com trechos e rateio | Sim | Java Regime Regular | Formulário guiado com origem, município, extensão e offset |
| Indicador NFS-e (validação) | Sim | Java Regime Regular | CIndOp, cClassTrib, NBS, data, cTribNac opcional |
| NFS-e: local da operação | Sim | Java Regime Regular | Consulta por indicador e data |
| NFS-e: base de cálculo específica | Sim | Java Regime Regular | Formulário próprio |
| Consultas de NCM, NBS, CST, cClassTrib, alíquotas, fundamentos etc. | Sim | Java Regime Regular | Formulário guiado com dezenas de opções |
| XML: geração/validação | Sim | Java Regime Regular | Ferramenta existente integrada na mesma tela |
| Alíquota ISS por município/serviço | Sim, no simulador antigo | Snapshot NFS-e | Base estática de 03/09/2026; conferir mudança de município |
| Simples Nacional: cálculo IBS/CBS por atividade | Sim | Java Simples Nacional | **Conectado em produção**, cálculo real retornando CALCULADO |
| Simples Nacional: catálogo de atividades | Sim | Java Simples Nacional | **Conectado em produção**; catálogo acessível pelo proxy |

## O que está efetivamente verificado

- [Validação de interface, rotas e modelos fiscais](https://github.com/Gabriel-Luis-Pacheco/calculadoraaa/actions): **12 testes JS** na bateria mais recente, todos aprovados, e duas compilações Maven Java 21.
- [Chromium visual](https://github.com/Gabriel-Luis-Pacheco/calculadoraaa/actions/runs/44350227969): **10 resoluções** aprovadas (320 a 1920 px), sem deslocamento da área central; formulários e resultados permanecem visíveis. Formulários longos têm rolagem **interna**; não há promessa de que 50 itens caibam simultaneamente sem rolagem.
- [Banco de dados e cálculos reais locais](https://github.com/Gabriel-Luis-Pacheco/calculadoraaa/actions/runs/44339856662): 59 migrações SQLite, 57 tabelas, resposta válida de ambos os Java; Regime Regular retornou `CALCULO_SIMULADO` e Simples retornou `CALCULADO`.
- [Contêiner protegido de Simples](https://github.com/Gabriel-Luis-Pacheco/calculadoraaa/actions/runs/44347307739): Docker Java iniciou, chamada sem chave retornou HTTP 401 e chamada autenticada produziu um cálculo válido.
- Produção Vercel: `https://rtc-calculadora-theta.vercel.app/`, entrada na página única; `/simulador` preserva o cálculo anterior; URLs respondem HTTP 200. O motor Simples retornou HTTP 200 na produção, com `versaoApp=0.0.6`, e o cálculo por item retornou `CALCULADO` via `api/simples`. [Teste ponta a ponta](https://github.com/Gabriel-Luis-Pacheco/calculadoraaa/actions/runs/44355319524).

## O que não deve ser considerado integralmente homologado

O código oficial está integralmente versionado em `motores/`, mas a cobertura visual não equivale a todos os métodos e regras possíveis. Entre as lacunas: interfaces para certos indicadores de crédito e para todos os formatos XML, exploração integral da memória de cálculo, tratamentos fiscais complexos por vigência e comparação sistemática entre a saída para muitos casos de borda. O Java do Simples está ligado ao painel em produção. A cobertura de casos fiscais especiais ainda precisa de homologação adicional.

O serviço `rtc-simples-nacional-java` foi criado no plano Free no workspace Render `javaaaa`. As variáveis de URL e de autenticação estão no servidor da Vercel, em produção e preview. O `render.yaml` é um modelo de referência, **não** deve ser importado novamente sobre a instalação já ativa. Consulte [o guia de operação](PUBLICAR_SIMPLES_RENDER.md).

## Limites do modo sem rolagem

- **Desktop:** viewport fixa; formulários à esquerda, resultado à direita. Apenas painéis internos com muitos campos rolam.
- **Mobile:** painel único, seletor horizontal de ferramentas e formulários/resultados empilhados com rolagem interna; parte do resultado não pode caber lado a lado por limitação física.
- Trocar de ferramenta preserva os campos da instância já carregada, enquanto a página não for recarregada.

## Segurança e origem

Os dois motores são código aberto sob licença MIT, mas esta instalação não é operada nem homologada pela Receita Federal. O proxy do Regime Regular mantém chave do Render do lado servidor. O Simples requer sua própria chave interna. Os controles de limite de requisições são em memória, e para tráfego público intenso devem ser substituídos por mecanismos distribuídos. Não tratar os resultados como apuração definitiva sem verificar fatos, vigências e normas.

## Navegação legada preservada (18/11/2026)

1. Simulador de impacto
2. Calcular operação (Regime Regular)
3. Base de cálculo (original)
4. Consulta tributária (original)
5. Conferir XML (original)

Abaixo dessas cinco ferramentas estão Simples Nacional, pedágio, NFS-e especializada, bases especiais e consultas avançadas. As cinco ferramentas originais abrem o fluxo correspondente dentro do painel, sem abrir outra aba.
