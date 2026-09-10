# Modelo Controle_Escolas_2_Abas_Bens_na_Busca.xlsx

O modelo contém duas abas: **Escolas e Inventario** (`A1:AD1001`) e **Localizar Escola** (`A1:I69`). A aba principal preserva os 28 campos já existentes e acrescenta `Seq. escola` em `AC` e `Chave de busca` em `AD`. As três fórmulas da área de dados são: valor total (`L`), sequência da escola (`AC`) e chave de busca (`AD`).

A aba **Localizar Escola** mantém o painel de identificação em `A1:B16` e acrescenta, a partir da linha 18, a área **BENS PATRIMONIAIS DA ESCOLA LOCALIZADA**. As linhas 20 a 69 usam a chave da coluna `I` para buscar número patrimonial, descrição, código de despesa, conservação, quantidade, valores e situação atual na aba principal. A geração atual preserva as dimensões `1001 × 30` e `69 × 9`, as larguras, cores, fórmulas e formatos monetários observados no modelo de referência.
