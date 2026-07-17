---
status: accepted
---

# Risco aceito: RLS aberto e senha única visual

Todas as tabelas têm política RLS "Allow all" e o app acessa o Supabase direto do navegador com a chave anônima; a tela de senha é apenas visual. Qualquer pessoa com a URL consegue ler e escrever no banco via DevTools. Decidimos **aceitar esse risco por ora**: é ferramenta interna, com URL não divulgada e dados de baixa sensibilidade, e a migração para Supabase Auth tem custo que não se justifica hoje.

Condições que reabrem esta decisão (migrar para Supabase Auth + RLS por usuário autenticado):

- Expor o sistema publicamente na internet ou divulgar a URL além da equipe.
- Guardar dados sensíveis de colaboradores além de nome/setor/função.
- Qualquer incidente de alteração não explicada de dados.

Consequência prática já conhecida: a senha em `config.access_password` está em texto puro no schema versionado — não tratar essa senha como segredo.
