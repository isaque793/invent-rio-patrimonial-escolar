# Modelo Resumo_consolidado.xlsx — análise inicial

O modelo possui as abas **Escolas e Inventario** e **Localizar Escola**. A aba principal vai de `A1:AB1001`, tem 28 colunas e cabeçalhos verdes (`#0B5D4B`) na primeira linha, com altura de 40 pontos. As linhas de dados reservadas mantêm a fórmula de valor total na coluna `L`: `IF(OR(Jn="",Kn=""),"",Jn*Kn)`, com valores unitário e total no formato `R$ #,##0.00`.

Os campos de `A:AB` abrangem escola, INEP, município, bem patrimonial, valores, situação, três posições de subcomissão, documentos, status de validação, pendências e problemas. A nova exportação deve preencher esses campos e preservar as abas e os recursos estruturais do modelo.
