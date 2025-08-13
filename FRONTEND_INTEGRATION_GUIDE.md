# Frontend Integration Guide for EduAI Authentication API

This guide explains how to connect your frontend application with the EduAI Authentication API backend.

## API Base URL

Your API is running on:
- **Development**: `http://localhost:3001/api/v1`
- **Production**: `https://your-domain.com/api/v1` (update with your actual domain)

## Available Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | User login | No |
| POST | `/auth/verify-email` | Verify email address | No |
| POST | `/auth/resend-verification` | Resend verification email | No |
| POST | `/auth/forgot-password` | Request password reset | No |
| POST | `/auth/reset-password` | Reset password | No |
| POST | `/auth/refresh` | Refresh access token | No |
| GET | `/auth/profile` | Get user profile | Yes |
| GET | `/auth/sessions` | Get user sessions | Yes |
| POST | `/auth/logout` | Logout user | Yes |

## Frontend Integration Examples

### 1. JavaScript/TypeScript API Client

Create a reusable API client:

```javascript
// api-client.js
class ApiClient {
  constructor(baseURL = 'http://localhost:3001/api/v1') {
    this.baseURL = baseURL;
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  // Set tokens
  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  // Clear tokens
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // Get headers
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Add device info headers
    headers['X-Device-Id'] = this.getDeviceId();
    headers['X-Platform'] = 'web';
    headers['X-OS-Version'] = navigator.platform;
    
    return headers;
  }

  // Get device ID
  getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'web_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  // Make API request
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      // Handle token refresh if 401
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry original request
          config.headers = this.getHeaders();
          const retryResponse = await fetch(url, config);
          return await retryResponse.json();
        }
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshAccessToken() {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.refreshToken}`,
          'X-Device-Id': this.getDeviceId(),
        },
        body: JSON.stringify({
          device_id: this.getDeviceId(),
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        this.setTokens(data.data.tokens.access_token, data.data.tokens.refresh_token);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      return false;
    }
  }

  // Authentication methods
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...userData,
        device_info: {
          device_id: this.getDeviceId(),
          device_type: 'web',
          os_version: navigator.platform,
          app_version: '1.0.0',
        },
        location_info: {
          country: 'Unknown',
          state: 'Unknown',
          city: 'Unknown',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
    });
  }

  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        device_info: {
          device_id: this.getDeviceId(),
          device_type: 'web',
          os_version: navigator.platform,
          app_version: '1.0.0',
        },
        location_info: {
          country: 'Unknown',
          state: 'Unknown',
          city: 'Unknown',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
    });

    if (response.success) {
      this.setTokens(
        response.data.tokens.access_token,
        response.data.tokens.refresh_token
      );
    }

    return response;
  }

  async logout(logoutAllSessions = false) {
    const response = await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({
        device_id: this.getDeviceId(),
        logout_all_sessions: logoutAllSessions,
      }),
    });

    if (response.success) {
      this.clearTokens();
    }

    return response;
  }

  async getProfile() {
    return this.request('/auth/profile');
  }

  async getSessions() {
    return this.request('/auth/sessions');
  }

  async verifyEmail(verificationToken) {
    return this.request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ verification_token: verificationToken }),
    });
  }

  async resendVerification(email) {
    return this.request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(resetToken, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        reset_token: resetToken,
        new_password: newPassword,
      }),
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
```

### 2. React Integration Example

```jsx
// hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';
import { apiClient } from '../api-client';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      if (apiClient.accessToken) {
        const response = await apiClient.getProfile();
        if (response.success) {
          setUser(response.data.user);
        } else {
          apiClient.clearTokens();
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      apiClient.clearTokens();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await apiClient.login(email, password);
      if (response.success) {
        setUser(response.data.user);
        return { success: true };
      } else {
        setError(response.message);
        return { success: false, message: response.message };
      }
    } catch (error) {
      setError('Login failed. Please try again.');
      return { success: false, message: 'Login failed. Please try again.' };
    }
  };

  const register = async (userData) => {
    setError(null);
    try {
      const response = await apiClient.register(userData);
      if (response.success) {
        setUser(response.data.user);
        return { success: true };
      } else {
        setError(response.message);
        return { success: false, message: response.message };
      }
    } catch (error) {
      setError('Registration failed. Please try again.');
      return { success: false, message: 'Registration failed. Please try again.' };
    }
  };

  const logout = async (logoutAllSessions = false) => {
    try {
      await apiClient.logout(logoutAllSessions);
      setUser(null);
      setError(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

```jsx
// components/LoginForm.jsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await login(email, password);
    
    if (result.success) {
      // Redirect to dashboard or home page
      window.location.href = '/dashboard';
    }
    
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Login</h2>
      
      {error && <div className="error">{error}</div>}
      
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};
```

### 3. Vue.js Integration Example

```javascript
// services/api.js
import { apiClient } from './api-client';

export const authService = {
  async login(email, password) {
    return apiClient.login(email, password);
  },

  async register(userData) {
    return apiClient.register(userData);
  },

  async logout(logoutAllSessions = false) {
    return apiClient.logout(logoutAllSessions);
  },

  async getProfile() {
    return apiClient.getProfile();
  },

  async getSessions() {
    return apiClient.getSessions();
  },

  async verifyEmail(token) {
    return apiClient.verifyEmail(token);
  },

  async resendVerification(email) {
    return apiClient.resendVerification(email);
  },

  async forgotPassword(email) {
    return apiClient.forgotPassword(email);
  },

  async resetPassword(token, newPassword) {
    return apiClient.resetPassword(token, newPassword);
  },
};
```

```vue
<!-- components/LoginForm.vue -->
<template>
  <form @submit.prevent="handleSubmit" class="login-form">
    <h2>Login</h2>
    
    <div v-if="error" class="error">{{ error }}</div>
    
    <div class="form-group">
      <label for="email">Email</label>
      <input
        type="email"
        id="email"
        v-model="email"
        required
      />
    </div>
    
    <div class="form-group">
      <label for="password">Password</label>
      <input
        type="password"
        id="password"
        v-model="password"
        required
      />
    </div>
    
    <button type="submit" :disabled="loading">
      {{ loading ? 'Logging in...' : 'Login' }}
    </button>
  </form>
</template>

<script>
import { ref } from 'vue';
import { authService } from '../services/api';

export default {
  name: 'LoginForm',
  emits: ['login-success'],
  setup(props, { emit }) {
    const email = ref('');
    const password = ref('');
    const loading = ref(false);
    const error = ref('');

    const handleSubmit = async () => {
      loading.value = true;
      error.value = '';
      
      try {
        const response = await authService.login(email.value, password.value);
        
        if (response.success) {
          emit('login-success', response.data.user);
        } else {
          error.value = response.message;
        }
      } catch (err) {
        error.value = 'Login failed. Please try again.';
      } finally {
        loading.value = false;
      }
    };

    return {
      email,
      password,
      loading,
      error,
      handleSubmit,
    };
  },
};
</script>
```

### 4. Angular Integration Example

```typescript
// services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseURL = 'http://localhost:3001/api/v1';
  private currentUserSubject: BehaviorSubject<any>;
  public currentUser: Observable<any>;

  constructor(private http: HttpClient) {
    this.currentUserSubject = new BehaviorSubject<any>(
      JSON.parse(localStorage.getItem('currentUser') || 'null')
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue() {
    return this.currentUserSubject.value;
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-Device-Id': this.getDeviceId(),
      'X-Platform': 'web',
      'X-OS-Version': navigator.platform,
    });
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'web_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  login(email: string, password: string): Observable<any> {
    const body = {
      email,
      password,
      device_info: {
        device_id: this.getDeviceId(),
        device_type: 'web',
        os_version: navigator.platform,
        app_version: '1.0.0',
      },
      location_info: {
        country: 'Unknown',
        state: 'Unknown',
        city: 'Unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    return this.http.post(`${this.baseURL}/auth/login`, body)
      .pipe(map(response => {
        if (response['success']) {
          localStorage.setItem('accessToken', response['data']['tokens']['access_token']);
          localStorage.setItem('refreshToken', response['data']['tokens']['refresh_token']);
          localStorage.setItem('currentUser', JSON.stringify(response['data']['user']));
          this.currentUserSubject.next(response['data']['user']);
        }
        return response;
      }));
  }

  register(userData: any): Observable<any> {
    const body = {
      ...userData,
      device_info: {
        device_id: this.getDeviceId(),
        device_type: 'web',
        os_version: navigator.platform,
        app_version: '1.0.0',
      },
      location_info: {
        country: 'Unknown',
        state: 'Unknown',
        city: 'Unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    return this.http.post(`${this.baseURL}/auth/register`, body);
  }

  logout(logoutAllSessions: boolean = false): Observable<any> {
    const body = {
      device_id: this.getDeviceId(),
      logout_all_sessions: logoutAllSessions,
    };

    return this.http.post(`${this.baseURL}/auth/logout`, body, { headers: this.getHeaders() })
      .pipe(map(response => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('currentUser');
        this.currentUserSubject.next(null);
        return response;
      }));
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.baseURL}/auth/profile`, { headers: this.getHeaders() });
  }

  getSessions(): Observable<any> {
    return this.http.get(`${this.baseURL}/auth/sessions`, { headers: this.getHeaders() });
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.post(`${this.baseURL}/auth/verify-email`, { verification_token: token });
  }

  resendVerification(email: string): Observable<any> {
    return this.http.post(`${this.baseURL}/auth/resend-verification`, { email });
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.baseURL}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.baseURL}/auth/reset-password`, {
      reset_token: token,
      new_password: newPassword,
    });
  }
}
```

### 5. Mobile App Integration (React Native)

```javascript
// services/api.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

class ApiClient {
  constructor(baseURL = 'http://localhost:3001/api/v1') {
    this.baseURL = baseURL;
  }

  async getStoredTokens() {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      return { accessToken, refreshToken };
    } catch (error) {
      console.error('Error getting stored tokens:', error);
      return { accessToken: null, refreshToken: null };
    }
  }

  async setTokens(accessToken, refreshToken) {
    try {
      await AsyncStorage.setItem('accessToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  }

  async clearTokens() {
    try {
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  async getDeviceInfo() {
    return {
      device_id: await DeviceInfo.getUniqueId(),
      device_type: Platform.OS,
      os_version: Platform.Version.toString(),
      app_version: await DeviceInfo.getVersion(),
    };
  }

  async getHeaders() {
    const { accessToken } = await this.getStoredTokens();
    const deviceInfo = await this.getDeviceInfo();

    const headers = {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceInfo.device_id,
      'X-Platform': deviceInfo.device_type,
      'X-OS-Version': deviceInfo.os_version,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = await this.getHeaders();
    
    const config = {
      headers,
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const newHeaders = await this.getHeaders();
          const retryResponse = await fetch(url, { ...config, headers: newHeaders });
          return await retryResponse.json();
        }
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const { refreshToken } = await this.getStoredTokens();
      const deviceInfo = await this.getDeviceInfo();

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`,
          'X-Device-Id': deviceInfo.device_id,
        },
        body: JSON.stringify({
          device_id: deviceInfo.device_id,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        await this.setTokens(
          data.data.tokens.access_token,
          data.data.tokens.refresh_token
        );
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await this.clearTokens();
      return false;
    }
  }

  async login(email, password) {
    const deviceInfo = await this.getDeviceInfo();
    
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        device_info: deviceInfo,
        location_info: {
          country: 'Unknown',
          state: 'Unknown',
          city: 'Unknown',
          timezone: 'Unknown',
        },
      }),
    });

    if (response.success) {
      await this.setTokens(
        response.data.tokens.access_token,
        response.data.tokens.refresh_token
      );
    }

    return response;
  }

  async register(userData) {
    const deviceInfo = await this.getDeviceInfo();
    
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...userData,
        device_info: deviceInfo,
        location_info: {
          country: 'Unknown',
          state: 'Unknown',
          city: 'Unknown',
          timezone: 'Unknown',
        },
      }),
    });
  }

  async logout(logoutAllSessions = false) {
    const deviceInfo = await this.getDeviceInfo();
    
    const response = await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceInfo.device_id,
        logout_all_sessions: logoutAllSessions,
      }),
    });

    if (response.success) {
      await this.clearTokens();
    }

    return response;
  }

  async getProfile() {
    return this.request('/auth/profile');
  }

  async getSessions() {
    return this.request('/auth/sessions');
  }
}

export const apiClient = new ApiClient();
```

## Environment Configuration

### Frontend Environment Variables

Create environment files for different environments:

```bash
# .env.development
REACT_APP_API_BASE_URL=http://localhost:3001/api/v1
REACT_APP_ENVIRONMENT=development

# .env.production
REACT_APP_API_BASE_URL=https://your-domain.com/api/v1
REACT_APP_ENVIRONMENT=production
```

### CORS Configuration

Your backend is already configured with CORS. Make sure to update the `ALLOWED_ORIGINS` environment variable in your backend:

```bash
# .env (backend)
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
```

## Error Handling

Implement proper error handling in your frontend:

```javascript
// utils/errorHandler.js
export const handleApiError = (error, defaultMessage = 'An error occurred') => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return data.message || 'Invalid request';
      case 401:
        return 'Unauthorized. Please login again.';
      case 403:
        return 'Access forbidden';
      case 404:
        return 'Resource not found';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return data.message || defaultMessage;
    }
  } else if (error.request) {
    // Network error
    return 'Network error. Please check your connection.';
  } else {
    // Other error
    return error.message || defaultMessage;
  }
};
```

## Security Best Practices

1. **Token Storage**: Store tokens securely (HttpOnly cookies for web, secure storage for mobile)
2. **Token Refresh**: Implement automatic token refresh
3. **Error Handling**: Don't expose sensitive information in error messages
4. **Input Validation**: Validate all user inputs on frontend and backend
5. **HTTPS**: Use HTTPS in production
6. **Rate Limiting**: Respect rate limits and handle 429 responses gracefully

## Testing API Integration

You can test your API endpoints using the provided Postman collection:

1. Import the `EduAI Authentication API - Extended.postman_collection.json` file
2. Set up environment variables for your API base URL
3. Test all endpoints to ensure they work correctly

## Next Steps

1. Choose a frontend framework (React, Vue, Angular, etc.)
2. Implement the API client for your chosen framework
3. Create authentication components (login, register, profile, etc.)
4. Set up routing and protected routes
5. Implement error handling and loading states
6. Test the integration thoroughly
7. Deploy your frontend application

This guide provides a solid foundation for connecting your EduAI Authentication API with any frontend application. The examples cover the most common frontend frameworks and include best practices for security and error handling. 