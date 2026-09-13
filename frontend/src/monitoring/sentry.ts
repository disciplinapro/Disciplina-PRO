import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

Sentry.init({
  dsn,

  // Invitation and password reset URLs carry a private bearer token in their fragment.
  enabled: !import.meta.env.DEV && Boolean(dsn) && !['/convites/aceitar', '/redefinir-senha'].some((path) => window.location.pathname.startsWith(path)),

  environment:
    import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});
