# MeTool Desktop

O MeTool é um aplicativo desktop para download de mídias de plataformas suportadas, construído com React, TypeScript e Tauri. Ele utiliza isolamento de processos para interagir com utilitários de código aberto como yt-dlp e ffmpeg, garantindo uma experiência de usuário fluida e responsiva.

## Arquitetura e Licenciamento

A aplicação é construída sobre uma separação arquitetônica clara entre a interface gráfica e as ferramentas de linha de comando subjacentes:

- Interface Gráfica: Construída usando tecnologias web padrão (React/Vite) encapsuladas pelo Tauri, criando um executável nativo leve.
- Processamento de Mídia: O download e a multiplexação de mídia reais são controlados pelo `yt-dlp` e `ffmpeg`.

### Conformidade de Licenciamento

Para cumprir com os termos de licenciamento de ferramentas como o FFmpeg (que é distribuído sob a LGPL/GPL), o MeTool não vincula estática ou dinamicamente as bibliotecas do FFmpeg. Ele também não empacota esses binários dentro do instalador da aplicação principal.

Em vez disso, a aplicação opera sob um modelo arquitetônico independente ("arm's length"):
1. Quando o usuário inicia a aplicação pela primeira vez, um processo de configuração inicial o instrui a baixar os binários necessários.
2. Os binários são obtidos diretamente de seus repositórios oficiais para a pasta de dados locais da aplicação do usuário.
3. O MeTool interage com essas ferramentas inteiramente via subprocessos de linha de comando (usando `std::process` no Rust).

Esta abordagem impede que a base de código do MeTool se torne um trabalho derivado sob a GPL, permitindo que a aplicação principal mantenha seu próprio modelo de licenciamento sem restrições de código aberto.

## Configuração de Desenvolvimento

Requisitos:
- Node.js (v18 ou superior)
- Linguagem de programação Rust e gerenciador de pacotes Cargo

### Rodando Localmente

1. Instale as dependências do Node:
   npm install

2. Inicie o servidor de desenvolvimento com o Tauri:
   npm run tauri dev

### Compilando para Produção

Para compilar o executável autônomo final para o seu sistema operacional:
npm run tauri build

Os instaladores gerados estarão localizados em `src-tauri/target/release/bundle/`.
