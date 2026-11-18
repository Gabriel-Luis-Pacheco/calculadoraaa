# Homologação técnica inicial — 18/11/2026

## Fontes incorporadas

- Código do Regime Regular: **Receita Federal 1.6.1**, commit `150cccbe414d4a5edea703e4f7a424af5aa222c7`.
- Código do Simples Nacional: **Receita Federal 0.0.6**, commit `c5b0f01c8351c3f0d0795cc617b29d233e9f98df`.
- Ambos copiados integralmente com documentação, licença MIT e testes de origem preservados.
- Interface anterior preservada em `web/`; nova interface do Simples em `web/simples.html`.

## Execução verificada

[Importação integral do GitHub](https://github.com/Gabriel-Luis-Pacheco/calculadoraaa/actions/runs/44334962838): **success**.

[Teste da interface, proxies e builds Java](https://github.com/Gabriel-Luis-Pacheco/calculadoraaa/actions/runs/44339346073): **success**. Foram executados cinco testes automatizados Node (5 aprovados, nenhum erro) e as duas compilações Java 21/Maven.

[Homologação inicial de integração com SQLite](https://github.com/Gabriel-Luis-Pacheco/calculadoraaa/actions/runs/44339856662): **success**.

Resultados extraídos dos logs:

| Checagem | Resultado |
|---|---|
| Flyway SQLite | 59 migrações aplicadas até V0059 |
| Banco gerado | 5.496.832 bytes e 57 tabelas |
| Catálogo Simples Nacional | Presente |
| Aplicação Regime Regular 1.6.1 | Inicia no Java 21 e responde por HTTP |
| Aplicação Simples Nacional 0.0.6 | Inicia no Java 21 e responde por HTTP |
| Regime Regular /observabilidade/regime-geral | HTTP 200, item `CALCULO_SIMULADO` |
| Simples Nacional /observabilidade/simples-nacional | HTTP 200, item `CALCULADO` |
| Mesma base SQLite nos dois serviços | Confirmado para os exemplos testados |

O resultado `CALCULO_SIMULADO` do Regime Regular é esperado para a operação de 2027 que fornece alíquotas nominais. Esse sucesso não valida automaticamente todos os regimes, municípios, documentos e períodos de apuração.

## Pendências importantes

1. **Publicação real**: o repositório no GitHub não publica por si só os novos serviços. É necessário configurar um serviço Java separado para Simples Nacional e a Vercel com as variáveis documentadas.
2. **Cobertura de interface**: o código-fonte oficial está completo, mas ainda há endpoints sem formulários próprios (pedágio, compras governamentais, indicadores de crédito, parte das rotinas NFS-e, bases especiais, XML expandido).
3. **Testes fiscais**: executar todos os testes originais, testes por vigência/atividade e conciliação de resultado por item. A execução atual é apenas uma homologação técnica inicial.
4. **ISS**: base NFS-e de 03/09/2026, não atualizada em tempo real; conferir alterações posteriores no município.
5. **Segurança operacional**: o rate limit atual é em memória e por instância; para muitos usuários, usar limite distribuído, WAF, observabilidade e controle de custo.
6. **Análise tributária**: não afirmar que qualquer resultado simulado substitui cálculo fiscal definitivo ou obrigação acessória.

## Regressão

A importação não altera automaticamente o deploy anterior `rtc-calculadora-theta.vercel.app`. O frontend da nova integração foi colocado no repositório para ser submetido ao processo próprio de implantação. Isso evita substituir um ambiente que já está em uso por outro sem backend do Simples configurado.
