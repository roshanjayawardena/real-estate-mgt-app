/**
 * Production. The API lives on its own host (Azure Container Apps), and the origin here is the one
 * the API's CORS policy allows.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.keyhouse.example',
};
