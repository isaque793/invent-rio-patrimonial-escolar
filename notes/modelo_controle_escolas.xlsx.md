# Estrutura — Controle de Escolas e Inventário

A planilha de referência possui a aba principal **Escolas e Inventário**, com 27 colunas, além da aba auxiliar **Localizar Escola**. O modelo combina a identificação da escola, cada item patrimonial, a subcomissão, pendências, documentos e o estado da validação. A coluna **Valor total (R$)** usa a fórmula `Quantidade × Valor unitário` no arquivo original.

| Grupo | Colunas do modelo | Fonte na plataforma |
|---|---|---|
| Identificação | Escola, Código INEP, Município | Cadastro da escola |
| Bem patrimonial | N.º de patrimônio, descrição, detalhes, código de despesa, conservação, quantidade, valores e situação | Itens do inventário anual |
| Subcomissão | Presidente e membros 2 e 3, com cargo e MASP | Subcomissão do ciclo |
| Acompanhamento | Pendências, problemas/divergências, três documentos e status | Pendências, notas, documentos e validação do ciclo |

A aba **Localizar Escola** contém os campos Escola, Código INEP, Município, N.º patrimônio, Descrição do bem, Quantidade, Valor total (R$) e Situação atual. O anexo fornece uma célula de pesquisa em `A4` e uma fórmula `FILTER` em `A7`, que localiza registros pelo nome da escola, código INEP ou município. A exportação replica essa busca dinâmica e referencia todas as linhas efetivamente geradas. A planilha principal produz uma linha por bem; escolas que ainda não tenham bens no ciclo anual são mantidas com seus dados institucionais e campos patrimoniais não informados.
