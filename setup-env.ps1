# PowerShell Script to Set Up .env File
# Run this in PowerShell: .\setup-env.ps1

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  AffiliateXchange - Database Setup" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env already exists
if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/n)"
    if ($overwrite -ne "y") {
        Write-Host "Setup cancelled." -ForegroundColor Red
        exit
    }
}

Write-Host "Choose your database option:" -ForegroundColor Green
Write-Host "1. Neon Database (Recommended - Free cloud database)"
Write-Host "2. Local PostgreSQL"
Write-Host "3. I already have a connection string"
Write-Host ""

$choice = Read-Host "Enter your choice (1-3)"

$databaseUrl = ""

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Setting up Neon Database:" -ForegroundColor Green
        Write-Host "1. Go to https://neon.tech and create a free account"
        Write-Host "2. Create a new project"
        Write-Host "3. Copy your connection string (it looks like:"
        Write-Host "   postgresql://user:pass@host.neon.tech/dbname?sslmode=require)" -ForegroundColor Yellow
        Write-Host ""
        $databaseUrl = Read-Host "Paste your Neon connection string here"
    }
    "2" {
        Write-Host ""
        Write-Host "Local PostgreSQL Setup:" -ForegroundColor Green
        $dbUser = Read-Host "PostgreSQL username (default: postgres)"
        if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }

        $dbPass = Read-Host "PostgreSQL password" -AsSecureString
        $dbPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPass))

        $dbHost = Read-Host "Database host (default: localhost)"
        if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }

        $dbPort = Read-Host "Database port (default: 5432)"
        if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "5432" }

        $dbName = Read-Host "Database name (default: affiliatexchange)"
        if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "affiliatexchange" }

        $databaseUrl = "postgresql://${dbUser}:${dbPassPlain}@${dbHost}:${dbPort}/${dbName}"
    }
    "3" {
        Write-Host ""
        $databaseUrl = Read-Host "Enter your database connection string"
    }
    default {
        Write-Host "Invalid choice. Exiting." -ForegroundColor Red
        exit
    }
}

# Generate a random session secret
$sessionSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Create .env file content
$envContent = @"
# Database Configuration
DATABASE_URL=$databaseUrl

# Session Secret (auto-generated)
SESSION_SECRET=$sessionSecret

# Node Environment
NODE_ENV=development

# Optional: Cloudinary (for file uploads - can be added later)
# CLOUDINARY_CLOUD_NAME=your-cloud-name
# CLOUDINARY_API_KEY=your-api-key
# CLOUDINARY_API_SECRET=your-api-secret

# Optional: SendGrid (for emails - can be added later)
# SENDGRID_API_KEY=your-sendgrid-api-key
# SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Optional: Stripe (for payment processing - can be added later)
# STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
# VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key
"@

# Write to .env file
$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host ""
Write-Host "✅ .env file created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Push database schema:    npm run db:push" -ForegroundColor Yellow
Write-Host "2. Seed payment data:       npm run payment:seed" -ForegroundColor Yellow
Write-Host "3. Start development:       npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "Test credentials after seeding:" -ForegroundColor Cyan
Write-Host "  Username: john_creator" -ForegroundColor Yellow
Write-Host "  Password: password123" -ForegroundColor Yellow
Write-Host ""
Write-Host "Navigate to /payment-settings to see payment data!" -ForegroundColor Green
Write-Host ""
