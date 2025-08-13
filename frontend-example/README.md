# EduAI Authentication Frontend Example

This is a simple HTML/JavaScript frontend example that demonstrates how to connect with the EduAI Authentication API backend.

## Features

- **User Registration**: Complete registration form with validation
- **User Login**: Secure login with token management
- **Profile Display**: Shows user information after successful login
- **Token Management**: Automatic token refresh and storage
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Proper error messages and user feedback

## Prerequisites

1. Make sure your EduAI Authentication API backend is running on `http://localhost:3001`
2. Ensure the database is set up and migrations are run
3. Check that CORS is properly configured in your backend

## Quick Start

1. **Start your backend server**:
   ```bash
   cd /path/to/your/backend
   npm run dev
   ```

2. **Open the frontend example**:
   - Simply open `index.html` in your web browser
   - Or serve it using a local server:
     ```bash
     # Using Python
     python -m http.server 8000
     
     # Using Node.js (if you have http-server installed)
     npx http-server -p 8000
     ```

3. **Test the application**:
   - Navigate to `http://localhost:8000` (if using a server) or open the HTML file directly
   - Try registering a new user
   - Try logging in with the registered user
   - View the user profile

## API Endpoints Used

The frontend example demonstrates integration with these backend endpoints:

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/profile` - Get user profile
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Refresh access token

## Key Features Explained

### 1. API Client Class

The `ApiClient` class handles all API communication:

```javascript
class ApiClient {
  constructor(baseURL = 'http://localhost:3001/api/v1') {
    this.baseURL = baseURL;
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }
  
  // Methods for login, register, logout, etc.
}
```

### 2. Token Management

- **Storage**: Tokens are stored in localStorage for persistence
- **Refresh**: Automatic token refresh when 401 errors occur
- **Cleanup**: Tokens are cleared on logout or errors

### 3. Device Information

The frontend sends device information with each request:

```javascript
device_info: {
  device_id: this.getDeviceId(),
  device_type: 'web',
  os_version: navigator.platform,
  app_version: '1.0.0',
}
```

### 4. Error Handling

Comprehensive error handling for:
- Network errors
- API errors
- Validation errors
- Authentication errors

## Customization

### Change API Base URL

To connect to a different backend URL, modify the `ApiClient` constructor:

```javascript
const apiClient = new ApiClient('https://your-api-domain.com/api/v1');
```

### Add More Fields

To add more registration fields, update the form and the `userData` object in the register handler.

### Styling

The example uses inline CSS for simplicity. For production, consider:
- Moving styles to a separate CSS file
- Using a CSS framework like Bootstrap or Tailwind
- Implementing a design system

## Security Considerations

### For Production Use

1. **HTTPS**: Always use HTTPS in production
2. **Token Storage**: Consider using HttpOnly cookies instead of localStorage
3. **Input Validation**: Add client-side validation
4. **CSRF Protection**: Implement CSRF tokens if needed
5. **Rate Limiting**: Handle rate limiting gracefully

### Environment Variables

For production, use environment variables:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api/v1';
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure your backend CORS configuration includes your frontend domain
2. **Connection Refused**: Ensure your backend server is running on the correct port
3. **Token Issues**: Check that tokens are being stored and sent correctly
4. **Database Errors**: Verify your database is running and migrations are applied

### Debug Mode

Enable debug logging by adding this to the browser console:

```javascript
localStorage.setItem('debug', 'true');
```

## Next Steps

This example demonstrates basic authentication. For a full application, consider adding:

1. **Password Reset**: Implement forgot password functionality
2. **Email Verification**: Add email verification flow
3. **Profile Management**: Allow users to edit their profiles
4. **Session Management**: Show active sessions and allow logout from all devices
5. **Role-based Access**: Implement different views based on user type
6. **Form Validation**: Add comprehensive client-side validation
7. **Loading States**: Improve UX with better loading indicators
8. **Responsive Design**: Enhance mobile experience

## Integration with Frameworks

This example shows vanilla JavaScript integration. For production applications, consider using:

- **React**: Use the React hooks and context examples from the main guide
- **Vue.js**: Use the Vue.js service and component examples
- **Angular**: Use the Angular service examples
- **Next.js**: For server-side rendering and better SEO

## Support

If you encounter issues:

1. Check the browser console for errors
2. Verify your backend is running and accessible
3. Test API endpoints directly using Postman or curl
4. Check the network tab in browser dev tools for request/response details

## License

This example is provided as-is for educational purposes. Feel free to modify and use in your projects. 