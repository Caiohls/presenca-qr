# Presença QR

Protótipo de controle de presença por QR Code para eventos acadêmicos (Projeto de Extensão USF, NEXT/PPE 2026.2).

## Rodando localmente

A câmera do navegador só funciona em https ou localhost:

```
python -m http.server 5173
```

Depois abra http://localhost:5173. Para testar rápido, use "Carregar dados de exemplo" em Configurações.

## Funcionalidades

- Leitura: a primeira leitura do QR registra a entrada e a segunda registra a saída. Também dá pra digitar o RA.
- Alunos: cadastro manual ou por planilha (colunas RA, Nome, Curso) e download dos QR Codes em PNG.
- Relatório: situação de cada aluno (Válida, Insuficiente, Sem saída, Ausente) e exportação para Excel.
- Configurações: nome do evento, tempo mínimo e backup.

Os dados ficam salvos no navegador do aparelho (IndexedDB).
