# PulseScan

Leitura de presença por QR Code para eventos acadêmicos (Projeto de Extensão USF, NEXT/PPE 2026.2). Feito para o operador de portaria: abre direto na câmera e funciona com uma mão só.

## Rodando localmente

A câmera do navegador só funciona em https ou localhost:

```
python -m http.server 5173
```

Depois abra http://localhost:5173. Para testar rápido, aceite "Carregar exemplo" na primeira abertura ou use Ajustes > Dados.

## Funcionalidades

- Leitura: a primeira leitura do QR registra a entrada e a segunda registra a saída. Também dá pra digitar o RA ou usar leitor USB.
- Repetição: o mesmo código reapresentado em menos de 10 segundos não gera outro registro e avisa "já registrada".
- Contador: pessoas no local agora / alunos cadastrados.
- Ajustes > Evento: nome, tempo mínimo, troca de evento e encerramento.
- Ajustes > Alunos: cadastro manual ou por planilha (colunas RA, Nome, Curso) e download dos QR Codes em PNG.
- Ajustes > Relatório: situação de cada aluno (Válida, Insuficiente, Sem saída, Ausente) e exportação para Excel.
- Ajustes > Dados: dados de exemplo, backup e limpeza.

Os dados ficam salvos no navegador do aparelho (IndexedDB). Não há servidor. Depois da primeira abertura com internet, o app também abre sem conexão.

## Limitações do navegador

- Som e vibração só funcionam depois do primeiro toque na página; o app avisa enquanto isso não acontece.
- O iPhone não oferece vibração para páginas web. Lá o aviso é por som e na tela.
