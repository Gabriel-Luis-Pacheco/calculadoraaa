# Calculadora RTC — Ambiente Fiscal

**Dois motores oficiais de código aberto e uma interface fiscal própria, em um repositório só.**

O projeto reúne o código integral da Receita Federal para **Regime Regular** e **Simples Nacional**, sem misturar os sistemas Java. Também preserva nosso simulador de impacto e a interface de cálculo fiscal existente.

## Organização

| Pasta | Conteúdo |
|---|---|
| [motores/regime-regular](motores/regime-regular) | Código integral de CBS, IBS e IS, incluindo bases, XML, NFS-e, pedágio, bancos/migrações, dados abertos e testes |
| [motores/simples-nacional](motores/simples-nacional) | Código integral do Simples Nacional, cálculo por atividade, catálogo, observabilidade e testes |
| [web](web) | Simulador original, Regime Regular, novo formulário de Simples Nacional, consulta ISS e proxies |
| [infra](infra) | Docker e scripts de preparação do SQLite |
| [docs](docs) | Proveniência, implantação e verificação |

### Interface

- **Painel fiscal integrado:** `/` (oito ferramentas na mesma página)
- **Regime Regular:** `/oficial` (abre o módulo dentro do painel)
- **Simples Nacional:** `/simples` (abre o módulo dentro do painel)
- **Simulador de impacto original:** `/simulador`
- **XML, NFS-e, pedágio, bases e consultas:** selecione a ferramenta no painel, sem mudar de página.

Para a Vercel, configure **Root Directory = web**.

## Como executar os dois motores localmente

Pré-requisitos: Java 21, Maven e Docker Compose. Na raiz do repositório:

```bash
bash infra/setup-db.sh
docker compose -f infra/compose.yaml up --build
```

Leia o [guia de integração e homologação](docs/INTEGRACAO.md) antes de iniciar: ambos precisam de uma base SQLite válida; os serviços devem ser testados **separadamente**. A versão inicial do Simples Nacional precisa de implantação própria no Render (ou serviço equivalente) antes de funcionar online. O contêiner protegido e o Blueprint gratuito estão em `infra/Dockerfile.simples.render` e `render.yaml`; consulte [o guia](docs/PUBLICAR_SIMPLES_RENDER.md).

## Código original e licenças

- [Receita Federal — Regime Regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular)
- [Receita Federal — Simples Nacional](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional)

As versões exatas copiadas estão em [docs/VERSOES_ORIGINAIS.txt](docs/VERSOES_ORIGINAIS.txt). Os arquivos `LICENSE` MIT originais são preservados em cada motor, com copyright © 2026 Receita Federal do Brasil.

**Projeto independente e não oficial.** Ter o código completo não significa ter todas as interfaces prontas, todas as versões fiscais atualizadas ou homologação para produção. Verifique normas, período de vigência, bases e resultados.
