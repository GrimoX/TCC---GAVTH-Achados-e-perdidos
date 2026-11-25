# Achados & Perdidos da Escola

Aplicação React, TypeScript e Tailwind conectada diretamente ao Supabase. O Supabase fornece autenticação, Postgres e armazenamento de imagens; não há API NestJS separada.

## Estrutura

- `frontend/`: interface, autenticação, busca e formulários.
- `supabase/schema.sql`: tabela, políticas RLS e bucket de imagens.

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. No **SQL Editor**, execute todo o conteúdo de `supabase/schema.sql`.
3. Crie `frontend/.env` copiando `frontend/.env.example`.
4. Em **Project Settings → API Keys** (ou **Connect**), copie:
   - Project URL para `VITE_SUPABASE_URL`;
   - Publishable key (`sb_publishable_...`) para `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. No Supabase Auth, habilite cadastro por e-mail. Em desenvolvimento local, adicione `http://localhost:5173/**` às URLs de redirecionamento. Para hospedagem, configure o domínio publicado.
6. Execute `npm install` na raiz e `npm run dev`.

O frontend usa somente a chave publicável. **Nunca coloque uma chave secreta (`sb_secret_...` ou `service_role`) no frontend.**

## Perfis de aluno e Secretaria

- Todo usuário autenticado sem registro em `user_roles` é tratado como **Aluno**. Alunos podem ver itens e registrar/remover o próprio interesse enquanto o item está ativo ou foi encontrado, mas ainda não devolvido.
- A Secretaria vê os nomes exibidos dos alunos interessados (não os e-mails), pode marcar um item perdido como **Encontrado** e depois **Devolvido**, marcar um achado como **Devolvido** e remover anúncios do mural. A remoção é lógica: o registro permanece com `status = 'removed'`, `removed_at` e `removed_by`, mas não aparece na listagem nem na busca.
- Atribua o perfil de Secretaria manualmente no SQL Editor, substituindo o e-mail pelo da conta que já existe no Supabase Auth:

```sql
insert into public.user_roles (user_id, role)
select id, 'secretary'
from auth.users
where lower(email) = lower('secretaria@escola.com')
on conflict (user_id) do update set role = excluded.role;
```

Somente quem tem acesso administrativo ao SQL Editor pode conceder o perfil; usuários não podem promover a si mesmos. Execute novamente o `supabase/schema.sql` atualizado para criar as tabelas/políticas de interesses e perfis e o fluxo de estados.

A remoção de anúncios é lógica: a função `remove_item` marca `status = 'removed'` e preserva o registro. Após aplicar mudanças no schema, o script solicita ao Supabase/PostgREST a atualização da cache de schema.

## Uso local ou hospedado

- Localmente, `npm run dev` abre o frontend em `http://localhost:5173`. `localhost` é o seu computador; o banco continua sendo o Supabase na nuvem.
- O site abre na tela de login/cadastro GAVTH; após autenticar, a pessoa é direcionada ao mural.
- Para hospedar, publique o diretório `frontend` em uma plataforma de sites estáticos e configure as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente de build.
- Execute `npm test` para verificar o contrato entre a rotina de remoção, o frontend e o schema; a validação também roda automaticamente em pull requests.

## Segurança e privacidade

- Senhas são gerenciadas pelo Supabase Auth. A aplicação não as grava nem as registra em logs.
- Não colete CPF, dados bancários ou outros dados altamente sensíveis. Os anúncios armazenam somente tipo, título, descrição, autor e caminho da foto.
- O banco restringe a criação de anúncios a usuários autenticados por RLS; a leitura dos anúncios é pública.
- O bucket de imagens é público para que fotos dos anúncios possam aparecer sem um servidor intermediário. Não envie documentos, rostos ou qualquer imagem com informações pessoais.
- O Supabase oferece criptografia em trânsito e em repouso. As imagens aceitas são JPG, PNG ou WEBP, com limite de 5 MB.
- A busca consulta os 100 anúncios mais recentes e aplica o filtro no navegador, adequado para o mural inicial da escola.
