# Investigação do ResizeObserver

Em 28/08/2026, o log do navegador registrou repetidamente `ResizeObserver loop completed with undelivered notifications.` às 16:33:18, sem arquivo ou pilha do aplicativo. A busca no código da aplicação não encontrou uso direto de `ResizeObserver`; o guard existente é a única referência criada durante esta investigação.

A página autenticada usa `DashboardLayout` e `SidebarProvider`. A sidebar usa `useIsMobile`, estado de largura/colapso, transições CSS de width/left/right e `Sheet` no mobile. A biblioteca Radix ScrollArea e NavigationMenu contêm ResizeObserver, mas não foram encontradas referências a esses componentes nas telas principais consultadas. O `index.html` carrega apenas o módulo React e analytics; o erro ocorre depois da carga quando o painel autenticado é aberto.

A pré-visualização automatizada disponível nesta sessão não possui sessão autenticada: retorna `Acesso ao inventário` e registra `Missing session cookie`. Portanto, ainda não existe reprodução visual autenticada independente; o teste automatizado simula o painel. O próximo passo técnico é observar se o erro é disparado pelo overlay de desenvolvimento/ResizeObserver do navegador ou pelo layout, removendo primeiro o guard global e instrumentando/isolando os componentes candidatos.

## Evidência adicional

O `DashboardLayout` mantém `SidebarProvider` e `TooltipProvider` ativos em todas as larguras. Cada `SidebarMenuButton` recebe `tooltip` e é envolvido por `Tooltip` mesmo quando a prop `hidden` oculta o conteúdo no estado expandido. A sidebar também calcula largura persistida e aplica transições CSS, mas o erro foi reportado sem ação de arrastar. Isso torna o Tooltip/Radix e a inicialização de layout candidatos mais prováveis do que a rotina de resize manual.

## Verificação após a correção

Após remover o guard global e condicionar o `tooltip` dos itens da sidebar a `!isMobile && isCollapsed`, `pnpm check` e a suíte passaram. A navegação sandbox em `/?from_webdev=1` permaneceu sem sessão (`Acesso ao inventário`), e a consulta do console após recarga retornou sem saída. A verificação visual autenticada será feita pela pré-visualização gerenciada do projeto, que possui sessão administrativa separada da sessão sandbox.

## Validação visual gerenciada

A pré-visualização gerenciada mostrou o painel real com sessão administrativa em 1280×720 e 390×844. Em desktop, a sidebar expandida e o painel de escolas carregaram sem erro visual; em mobile, a navegação horizontal e os cartões permaneceram utilizáveis, sem transbordamento relevante. Após a remoção do guard global e a montagem condicional de Tooltips apenas na sidebar recolhida, as capturas não registraram o erro ResizeObserver durante a carga.

## Reprodução autenticada do fluxo reportado

Após o login informado pelo usuário, a navegação do navegador carregou a sessão administrativa de Mayara Franco e exibiu o painel real de Escolas e inventários com 148 escolas. As capturas gerenciadas em 1280×720 e 390×844 mostraram o painel estável, sem erro visual ou transbordamento. O botão `Adicionar item` não estava no viewport inicial; a busca textual não o localizou porque o conteúdo está abaixo da área visível, portanto a abertura do diálogo ainda depende de rolagem/interação adicional.

## Estado autenticado após login do usuário

A sessão administrativa real de Mayara Franco foi reproduzida no navegador. O painel carregou 148 escolas, o inventário da escola selecionada, subcomissão, pendências e documentos. A rolagem até o bloco de inventário detalhado não reproduziu o erro ResizeObserver. O cadastro de novo bem está acima do viewport atual e será acessado por rolagem controlada.

## Console autenticado após isolamento

Com a sessão administrativa autenticada, o painel real foi carregado, rolado até o inventário e consultado novamente após a alteração da sidebar. O console retornou `No console output`, sem `ResizeObserver loop completed with undelivered notifications`. A correção aplicada é localizada: `SidebarMenuButton` não recebe Tooltip quando a sidebar está expandida ou em mobile; Tooltips continuam ativos quando a sidebar está recolhida para manter a acessibilidade.

## Instrumentação temporária

Foi carregado o painel autenticado com `debugResize=1` usando um wrapper de `window.ResizeObserver` que registra `observe`, `callback`, `disconnect` e erros globais. O console permaneceu sem saída, portanto nenhum ResizeObserver foi criado ou o console do navegador não expõe `console.warn` nesta captura; o erro original não foi reproduzido. A mudança localizada da Sidebar/Tooltip segue isolada e o diagnóstico temporário não deve permanecer ativo na versão final.
