/**
 * Development. The API is reached through the dev-server proxy (proxy.conf.json), so requests are
 * same-origin: no CORS pre-flight and no certificate warning while developing.
 */
export const environment = {
  production: false,
  apiBaseUrl: '',
};
