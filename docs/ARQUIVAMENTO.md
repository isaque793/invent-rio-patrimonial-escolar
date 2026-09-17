# Como funciona o arquivamento do inventário (explicado em linguagem simples)

Este documento explica, sem jargão técnico, o que acontece nos bastidores
quando um inventário de uma escola é **validado**. Se você não é
programador, ainda assim vai conseguir acompanhar — o objetivo é justamente
esse.

---

## 1. O problema que isso resolve

Todo ano, cada escola faz um inventário: lista os itens patrimoniais, registra
pendências, junta a ata de abertura, o termo de responsabilidade e a ata de
encerramento (os "3 documentos assinados"). Depois que a Secretaria confere
tudo e **valida** o inventário daquele ano, esse ciclo vira **histórico**: não
deve mais ser editado, mas também não pode ser perdido nem "sumir" no meio de
dados do ano seguinte.

O arquivamento é o processo automático que cuida disso: pega tudo o que
pertence àquele ciclo já validado e guarda uma cópia organizada, separada,
verificada — pronta para ser consultada daqui a 1, 5 ou 10 anos, mesmo que o
sistema principal mude bastante.

**Importante:** arquivar **não é apagar**. Nada é removido da parte
operacional do sistema. O arquivamento cria uma cópia adicional, organizada
para consulta de longo prazo.

---

## 2. Quando isso acontece

Isso acontece automaticamente em um único momento: **quando um administrador
muda o status do ciclo de inventário para "validado"** na tela de gestão.

Não existe uma tarefa agendada rodando escondida a cada tanto tempo — o
arquivamento é disparado na hora, junto com a validação. Isso é proposital:
o sistema não precisa de um "robozinho" rodando 24 horas por dia esperando
inventários para arquivar. Ele reage no exato momento em que passa a fazer
sentido arquivar.

Se o arquivamento falhar por algum motivo (por exemplo, uma instabilidade
momentânea no serviço de armazenamento), **a validação do inventário não é
desfeita**. A escola e a Secretaria não ficam reféns disso. O ciclo fica
marcado internamente como "arquivamento com erro", e um administrador pode
mandar tentar de novo quando quiser (veja a seção 6).

---

## 3. O que entra no "pacote" arquivado

Para cada ciclo validado, o sistema junta:

| O que é guardado | Onde vem |
|---|---|
| Dados gerais do ciclo (ano, escola, datas, status) | Tabela do ciclo |
| Lista de itens patrimoniais | Tabela de itens |
| Pendências registradas (itens não encontrados, doações, transferências etc.) | Tabela de pendências |
| Observações gerais e divergências | Tabela de observações |
| Comissão responsável pelo inventário daquele ano | Tabela da comissão |
| Histórico de validações (quem submeteu, quem devolveu, quem validou) | Tabela de histórico |
| Os 3 documentos assinados (ata de abertura, termo de responsabilidade, ata de encerramento) | Os arquivos já enviados pela escola |
| Um "manifesto" — um resumo do que foi arquivado e quando | Gerado na hora |

Tudo isso fica guardado dentro de uma pasta com este formato:

```
arquivo-inventario / ANO / escola-ID_DA_ESCOLA / ciclo-ID_DO_CICLO /
    dados/ciclo.json
    dados/itens.json
    dados/ocorrencias.json
    dados/observacoes.json
    dados/comissao.json
    dados/validacoes.json
    documentos/ (cópias dos 3 documentos assinados)
    manifest.json
```

Por exemplo, o inventário de 2026 da escola nº 12 fica em:
`arquivo-inventario/2026/escola-12/ciclo-45/`

---

## 4. Por que os documentos não são "baixados e reenviados"

Os documentos (PDFs, fotos assinadas) já ficam guardados num serviço externo
de armazenamento de arquivos (Cloudflare R2 — parecido com o "Google Drive"
do sistema, só que automatizado). Em vez de o sistema baixar cada documento
para depois reenviar uma cópia — o que consumiria tempo e, dependendo do
provedor, poderia gerar custo de tráfego — pedimos para o próprio serviço de
armazenamento **copiar o arquivo internamente**, de uma pasta para outra.

Pense assim: é a diferença entre "baixar um vídeo do YouTube, salvar no seu
computador e depois subir de novo" versus "pedir para o próprio YouTube
duplicar o vídeo num álbum separado, sem seus dados passarem pela sua
conexão de internet". A segunda opção é praticamente instantânea e não custa
banda.

Isso importa especialmente pelo orçamento: o plano de armazenamento e
arquivamento escolar precisa caber num orçamento pequeno, e evitar tráfego
desnecessário é uma das formas mais simples de manter o custo baixo.

---

## 5. Como o sistema garante que nada fica "pela metade"

Arquivar acontece em quatro passos, sempre nesta ordem:

1. **Exportar** — gera os arquivos de dados (JSON) do ciclo.
2. **Armazenar** — copia os documentos assinados para dentro do pacote.
3. **Verificar** — confere, um por um, se cada arquivo copiado realmente
   existe no destino (não confia apenas que "a cópia não deu erro"; confirma
   de fato).
4. **Registrar** — só depois que tudo foi verificado, o ciclo é marcado como
   "ARQUIVADO" no banco de dados.

Se qualquer passo falhar no meio do caminho, o sistema **não finge que deu
certo**. Ele marca o ciclo como "erro no arquivamento" e guarda o motivo do
erro, para que um administrador possa entender o que aconteceu e tentar
novamente.

Essa ordem existe para evitar o pior cenário possível: um ciclo que o
sistema "acha" que está arquivado, mas na verdade está com documentos
faltando. Preferimos que apareça claramente como pendente, mesmo que isso
signifique um clique extra depois, a esconder um problema.

---

## 6. O que um administrador vê e pode fazer

Cada ciclo de inventário agora carrega, além do status de validação, um
**status de arquivamento**, com um destes quatro valores:

- **ACTIVE** — ainda não foi validado, então ainda não faz sentido arquivar.
- **PENDING** — o arquivamento está em andamento agora mesmo.
- **ARCHIVED** — arquivado com sucesso, tudo verificado.
- **ERROR** — algo falhou; o motivo fica registrado.

Se um ciclo ficar com status **ERROR**, existe uma ação administrativa
("tentar arquivar novamente") que refaz o processo do zero para aquele
ciclo. Não há risco de duplicar nada: rodar de novo apenas regrava o pacote
e confirma tudo de novo — é seguro repetir quantas vezes for preciso.

---

## 7. O que este arquivamento **não** substitui

Vale deixar claro o que isso é e o que não é:

- **Não é um backup do sistema inteiro.** Isso protege contra perda de dados
  do servidor todo (banco de dados corrompido, provedor de hospedagem com
  problema etc.) e deve continuar existindo separadamente, como uma rotina
  própria — não faz parte deste fluxo.
- **Não define por quanto tempo o inventário continua "editável" ou visível**
  na tela operacional antes de, por exemplo, ser oculto da lista principal.
  Isso é uma decisão institucional (de política, não de código) que ainda
  precisa ser tomada por quem administra o programa, não pelo sistema.
- **Não apaga nada.** Arquivar aqui é sinônimo de "criar uma cópia
  organizada e verificada para consulta futura", nunca de excluir o
  original.

---

## 8. Resumo de uma frase

> Quando um inventário é validado, o sistema automaticamente cria — sem
> apagar nada, sem duplicar tráfego desnecessário e conferindo cada arquivo —
> uma cópia organizada e independente daquele ciclo, pronta para consulta
> de longo prazo; e se algo falhar nesse processo, isso fica visível e pode
> ser refeito manualmente, sem nunca travar a validação da escola.
