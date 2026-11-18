# Calculadora RTC — Ambiente Fiscal

Plataforma de apoio fiscal que reúne os motores de código aberto da Receita Federal do Brasil para **Regime Regular** e **Simples Nacional** com uma interface destinada a profissionais tributários, fiscais e contábeis.

> **Projeto independente.** Não é um serviço oficial da Receita Federal. A legislação, as tabelas e o alcance dos cálculos dependem da versão instalada de cada motor, de seus bancos de dados e de configurações corretas.

## Estrutura

- `motores/regime-regular/` — código-fonte original da [Calculadora RTC Regime Regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular).
- `motores/simples-nacional/` — código-fonte original da [Calculadora RTC Simples Nacional](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional).
- `web/` — nossa interface fiscal, simulador legado e futuras integrações.
- `infra/` — configuração para execução e deployment integrado.
- `docs/` — diferenças, requisitos, instruções, cobertura e validação.

Os motores são **serviços distintos**: não tente mesclar seus `src/main/java` em uma única aplicação Spring Boot.

## Autoria e licenças

Código oficial: © 2026 Receita Federal do Brasil, licença **MIT**. Os arquivos `LICENSE` originais deverão permanecer em cada pasta de motor. Contribuições e interface própria do projeto devem manter seus avisos de autoria correspondentes.

## Estado da integração

O código-fonte não basta, sozinho, para garantir cálculo válido: é necessário gerar/fornecer os bancos SQLite, configurar o ambiente Java 21+, executar testes, validar o Swagger e homologar resultados com casos fiscais. Não publicar como pronto para produção sem homologação funcional ponta a ponta.
