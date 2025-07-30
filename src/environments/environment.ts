const baseUrl = 'http://103.49.124.152:3005';

export const environment = {
  production: true,
  baseUrl: baseUrl,
  apiBaseUrl: baseUrl,
  authEndpoints: {
    login: `${baseUrl}/auth/login`,
    checkAccStatus: `${baseUrl}/api/acc-auth/check-acc-status`
  },
  accAuthEndpoints: {
    login: `${baseUrl}/api/acc-auth/login`,
    status: `${baseUrl}/api/acc-auth/status`,
    sync: `${baseUrl}/api/acc-auth/sync`,
    viewerToken: `${baseUrl}/api/acc-auth/viewer-token`
  },
  uploadEndpoints: {
    upload: `${baseUrl}/acc-docs-upload/upload`
  }
};
