# 🚀 Render Deployment Guide for EduAI Backend

This guide will help you deploy your EduAI backend to Render for web deployment.

## Prerequisites

1. **GitHub Repository**: Your code should be pushed to GitHub
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **Environment Variables**: Prepare your production environment variables

## Step 1: Prepare Your Repository

### Files Created for Deployment:
- ✅ `render.yaml` - Render service configuration
- ✅ `env.production.example` - Production environment template

### Required Environment Variables:
Copy the values from `env.production.example` and update them with your production values.

## Step 2: Deploy to Render

### Option A: Using Render Dashboard (Recommended)

1. **Go to Render Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Sign in with your GitHub account

2. **Create a New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your `eduai-backend` repository

3. **Configure the Service**
   ```
   Name: eduai-backend
   Environment: Node
   Region: Choose closest to your users
   Branch: main
   Root Directory: (leave empty)
   Build Command: npm install
   Start Command: npm start
   ```

4. **Set Environment Variables**
   Click "Environment" tab and add these variables:
   
   **Required Variables:**
   ```
   NODE_ENV=production
   PORT=10000
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random_production
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_production_email@gmail.com
   EMAIL_PASS=your_production_app_password
   EMAIL_FROM=noreply@eduai.com
   EMAIL_FROM_RESET=info@raycraft.in
   EMAIL_SECURE=false
   EMAIL_REQUIRE_TLS=true
   EMAIL_TLS_REJECT_UNAUTHORIZED=true
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   BCRYPT_ROUNDS=12
   VERIFICATION_TOKEN_EXPIRES_IN=24h
   RESET_TOKEN_EXPIRES_IN=1h
   ALLOWED_ORIGINS=https://your-frontend-app.vercel.app
   LOG_LEVEL=info
   ```

5. **Create PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - Name: `eduai-postgres`
   - Plan: Free
   - Database Name: `eduai_auth`
   - Note down the connection details

6. **Link Database to Service**
   - Go back to your web service
   - In Environment tab, add database connection variables:
   ```
   DB_HOST=(from database connection string)
   DB_PORT=5432
   DB_NAME=eduai_auth
   DB_USER=(from database connection string)
   DB_PASSWORD=(from database connection string)
   ```

7. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete (5-10 minutes)

### Option B: Using render.yaml (Alternative)

1. **Push render.yaml to your repository**
2. **In Render Dashboard:**
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will automatically detect and use render.yaml

## Step 3: Database Setup

After deployment, you need to run database migrations:

1. **Access Render Shell** (if available) or use a one-time deploy:
   ```bash
   npm run migrate
   npm run migrate:attendance
   npm run migrate:attendance-recorded-by
   ```

2. **Alternative: Create a setup script**
   - Add a setup endpoint to your API
   - Call it once after deployment

## Step 4: Update Frontend Configuration

Update your frontend (Vercel) to use the new backend URL:

```javascript
// In your frontend API configuration
const API_BASE_URL = 'https://your-backend-service-name.onrender.com';
```

## Step 5: Test Your Deployment

1. **Health Check**: Visit `https://your-service.onrender.com/health`
2. **API Test**: Test a few endpoints to ensure everything works
3. **Database Test**: Try creating a user or logging in

## Important Notes

### Free Tier Limitations:
- **Sleep Mode**: Free services sleep after 15 minutes of inactivity
- **Cold Start**: First request after sleep takes 30-60 seconds
- **Database**: Free PostgreSQL has connection limits

### Production Considerations:
- **Upgrade Plan**: Consider upgrading for production use
- **Custom Domain**: Add your own domain for better branding
- **SSL**: Automatically provided by Render
- **Monitoring**: Use Render's built-in monitoring

### Environment Variables Security:
- Never commit `.env` files to Git
- Use Render's environment variable interface
- Rotate secrets regularly

## Troubleshooting

### Common Issues:

1. **Build Fails**
   - Check Node.js version compatibility
   - Ensure all dependencies are in package.json

2. **Database Connection Issues**
   - Verify database environment variables
   - Check if database is running

3. **CORS Errors**
   - Update ALLOWED_ORIGINS with your frontend URL
   - Include both HTTP and HTTPS if needed

4. **Service Sleeps**
   - Free tier services sleep after inactivity
   - Consider upgrading to paid plan for production

### Getting Help:
- Render Documentation: [render.com/docs](https://render.com/docs)
- Render Community: [community.render.com](https://community.render.com)

## Next Steps

1. ✅ Deploy backend to Render
2. ✅ Set up PostgreSQL database
3. ✅ Configure environment variables
4. ✅ Run database migrations
5. ✅ Update frontend API URLs
6. ✅ Test the complete system
7. 🔄 Set up monitoring and logging
8. 🔄 Configure custom domain (optional)
9. 🔄 Set up automated backups

Your EduAI backend should now be live on Render! 🎉
