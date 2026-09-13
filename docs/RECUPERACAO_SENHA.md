# Recuperação de senha

O login oferece **Esqueci minha senha**, que abre `/recuperar-senha`. O e-mail contém um link para `/redefinir-senha#token=...`, com validade de 30 minutos e uso único. A nova senha segue a política existente de 15 a 128 caracteres. A redefinição revoga as sessões e exige novo login.

A API responde de forma genérica para contas desconhecidas, desabilitadas e falhas de entrega. As rotas aceitam apenas a origem `FRONTEND_URL`, limitam solicitações por IP e permitem um envio por conta a cada minuto. Apenas o hash do token é persistido; novos links substituem os anteriores. Falhas de entrega geram `PASSWORD_RECOVERY_DELIVERY_FAILED` nos logs sem endereço ou token.

## Publicação

1. Aplicar `npm run prisma:migrate:deploy` antes de iniciar o novo backend. A migração `20260913120000_password_recovery` adiciona três colunas opcionais e um índice, preservando usuários e senhas existentes.
2. Publicar backend e frontend. A entrega reutiliza `INVITATION_EMAIL_PROVIDER`, `SMTP_DELIVERY_ENABLED` e as credenciais/remetentes SMTP ou Resend existentes. `FRONTEND_URL` determina o destino do link. Em local/lab, Resend continua restrito a `RESEND_TEST_RECIPIENT`.
3. Validar a entrega com uma conta de teste autorizada no ambiente publicado. Os testes automatizados substituem o transporte e não enviam e-mail real.

Para reverter a aplicação, restaurar a versão anterior e manter as colunas opcionais. Não é necessário apagar dados nem desfazer a migração; a versão anterior ignora esses campos.

## Validação focada

- `npm run test:components --workspace frontend -- src/modules/auth/PasswordRecoveryPage.component.test.jsx`
- `npm run test --workspace backend -- password-recovery-email`
- `npm run test:integration --workspace backend -- password-recovery` (com `DATABASE_URL` apontando para banco de testes migrado)
