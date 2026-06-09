import axios from 'axios';

export const withRetry = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
  let delay = 1000;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error: any) {
      const isNetworkError = !error.response;
      if (!isNetworkError || attempt === retries) {
        throw error;
      }

      await new Promise((resolve) => window.setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  // Should never reach here
  return fn();
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach JWT token and Workspace Context ID
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      const workspaceId = localStorage.getItem('active_workspace_id');
      if (workspaceId && config.headers) {
        config.headers['X-Workspace-ID'] = workspaceId;
      }
    }

    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401s globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        // Redirect to login if unauthorized
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
