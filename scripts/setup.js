const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function setup() {
  console.log('🚀 Setting up EduAI Authentication API...\n');

  // Check if .env file exists
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.log('📝 Creating .env file from template...');
    const envExamplePath = path.join(__dirname, '..', 'env.example');
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ .env file created successfully');
      console.log('⚠️  Please edit .env file with your configuration before starting the server\n');
    } else {
      console.log('❌ env.example file not found');
      process.exit(1);
    }
  } else {
    console.log('✅ .env file already exists\n');
  }

  // Check if node_modules exists
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('📦 Installing dependencies...');
    try {
      execSync('npm install', { stdio: 'inherit' });
      console.log('✅ Dependencies installed successfully\n');
    } catch (error) {
      console.log('❌ Failed to install dependencies');
      process.exit(1);
    }
  } else {
    console.log('✅ Dependencies already installed\n');
  }

  // Check PostgreSQL connection
  console.log('🔍 Checking PostgreSQL connection...');
  try {
    const db = require('../config/database');
    await db.query('SELECT 1');
    console.log('✅ PostgreSQL connection successful\n');
  } catch (error) {
    console.log('❌ PostgreSQL connection failed');
    console.log('Please ensure PostgreSQL is running and your .env configuration is correct\n');
    process.exit(1);
  }

  // Run migrations
  console.log('🗄️  Running database migrations...');
  try {
    execSync('npm run migrate', { stdio: 'inherit' });
    console.log('✅ Database migrations completed successfully\n');
  } catch (error) {
    console.log('❌ Database migrations failed');
    process.exit(1);
  }

  console.log('🎉 Setup completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Edit .env file with your configuration');
  console.log('2. Start the server: npm run dev');
  console.log('3. Test the API: http://localhost:3001/health');
  console.log('4. Import the Postman collection for testing\n');

  console.log('📚 For more information, see README.md');
}

// Run setup
setup().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
}); 