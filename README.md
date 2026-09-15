# Projeto: Aplicação com persistência de dados em backend

> 1. Leia com atenção as instruções abaixo para editar este README em formato Markdown.
> 2. Substitua todos os trechos de texto iniciados com "Substitua" por informações do seu projeto, conforme solicitado em cada trecho.
> 3. Substitua a imagem animada por um GIF/WEBP mostrando o resultado do seu projeto (o arquivo pode ser armazenado no repositório ou em URL externa). 
> 4. Remova todas as instruções de entrega.
> 5. Renomeie esta arquivo para README.md e entregue-o dentro da pasta raiz do seu repositório de entrega. 
> 6. Double-check: Certifique-se de que seu README.md não contenha instruções de entrega e seja visualizado corretamente ao abrir seu repositório!
> Opcional: você pode alterar a formatação deste README, mas mantenha todas as informações solicitadas.

![Substitua a imagem ao lado por um GIF/WEBP animado mostrando seu projeto](./moho_follow_through2.gif "GIF animado do projeto. Imagem temporária de Moho Animation https://moho.lostmarble.com/products/moho-pro-special-halls-head-college")



## Acesso

https://project2-2026b-alexandre-chagas-brites.vercel.app/

## Desenvolvedor(a)

Alexandre Chagas Brites - Ciência da Computação

## Proposta

Modalidade A. Desenvolvimento de um jogo simples demonstrando multiplayer em tempo real.

## Parceria/cliente/usuário

Victor Mateus Severo Ferreira

## Feedback/comentário da parceria/cliente/usuário

Substitua este texto por um feedback produzido pelo(a) colega parceiro(a). Na modalidade A (parceria dev), o foco principal do feedback/comentário estará nas diferenças percebidas no código. Na modalidade B (parceria cliente/usuário), o foco principal do feedback/comentário estará nas funcionalidades/interface.

## Desenvolvimento

### Processo

Substitua este texto por uma descrição do processo de desenvolvimento **em primeira pessoa, sem ajuda de IA**, explicando e justificando suas escolhas, destacando o que já sabia ou não, como lidou com dúvidas ou dificuldades específicas, que adaptações foram necessárias, etc. Evite comentários genéricos como "pedi ajuda para IA e resolvi", dando preferência para expor detalhes específicos de um problema e sua solução.

### Trechos de código

Indique pelo menos 3 trechos de código que você queira destacar para a turma (por exemplo, para explicar algo que aprendeu, para alertar sobre alguma dificuldade de compreensão, para mostrar uma curiosidade, etc).

Tempo estimado do Servidor:

```
let offsetVal = 0.0;
const offsetRef = ref(db, ".info/serverTimeOffset");
onValue(offsetRef, (data: any) => {
    offsetVal = data.val() || 0.0;
});

const localTime = new Date().getTime() + offsetVal;
const remoteTime = ...;
const timeDiff = (localTime - remoteTime) / 1000.0;
```

## Tecnologias

### Linguagens e afins

Substitua este trecho por uma lista detalhada de tecnologias utilizadas:
- Next.js
- TypeScript
- Firebase Realtime Database
- Vercel

### Ambiente de desenvolvimento

Substitua este trecho por uma lista detalhada dos ambientes/ferramentas de desenvolvimento que você usou (por exemplo, VS Code + alguma extensão, agentes de IA, etc.)
- VS Code
- Google AI Overview

## Referências e créditos

- https://developer.mozilla.org/en-US/docs/Web/API
- https://nextjs.org/docs
- https://firebase.google.com/docs/database/web/start
- https://www.youtube.com/watch?v=rQvOAnNvcNQ
- https://www.youtube.com/watch?v=pP7quzFmWBY
- https://vercel.com/docs


---
Projeto entregue para a disciplina de [Desenvolvimento de Software para a Web](http://github.com/andreainfufsm/elc1090-2026b) em 2026b
