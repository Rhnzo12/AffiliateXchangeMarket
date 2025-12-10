#!/usr/bin/env tsx
/**
 * Environment Check Script
 * Verifies that all required environment variables and services are configured
 * for testing the 8 major features
 */

import dotenv from 'dotenv';
dotenv.config();

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, message: string, isWarning = false) {
  results.push({
    name,
    status: condition ? 'pass' : (isWarning ? 'warn' : 'fail'),
    message
  });
}

console.log('\n🔍 Testing Environment Check\n');
console.log('='.repeat(60));

// 1. Email Verification System (Feature 2)
console.log('\n📧 Feature 2: Email Verification System');
check(
  'SendGrid API Key',
  !!process.env.SENDGRID_API_KEY,
  'SENDGRID_API_KEY is required for email verification and password reset'
);
check(
  'SendGrid From Email',
  !!process.env.SENDGRID_FROM_EMAIL,
  'SENDGRID_FROM_EMAIL is required for sending emails'
);
check(
  'SendGrid From Name',
  !!process.env.SENDGRID_FROM_NAME,
  'SENDGRID_FROM_NAME is recommended',
  true
);

// 2. Priority Listing Feature (Feature 3)
console.log('\n💳 Feature 3: Priority Listing ($199/month)');
check(
  'Stripe Secret Key',
  !!process.env.STRIPE_SECRET_KEY,
  'STRIPE_SECRET_KEY is required for payment processing'
);
check(
  'Stripe Publishable Key',
  !!process.env.VITE_STRIPE_PUBLISHABLE_KEY,
  'VITE_STRIPE_PUBLISHABLE_KEY is required for frontend Stripe integration'
);
check(
  'Stripe Webhook Secret',
  !!process.env.STRIPE_WEBHOOK_SECRET,
  'STRIPE_WEBHOOK_SECRET is required for webhook verification'
);

// 3. Database Configuration
console.log('\n🗄️  Database Configuration');
check(
  'Database URL',
  !!process.env.DATABASE_URL,
  'DATABASE_URL is required for database connection'
);

// 4. Session Configuration
console.log('\n🔐 Session & Authentication');
check(
  'Session Secret',
  !!process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32,
  'SESSION_SECRET should be at least 32 characters for security'
);

// 5. Google Cloud Storage (for video uploads - Feature 1)
console.log('\n☁️  Feature 1: Video Upload');
check(
  'GCS Bucket Name',
  !!process.env.GCS_BUCKET_NAME,
  'GCS_BUCKET_NAME is required for video uploads',
  true // Warning only as fallback might exist
);
check(
  'GCS Credentials',
  !!process.env.GCS_CREDENTIALS,
  'GCS_CREDENTIALS is required for Google Cloud Storage access',
  true
);

// 6. Application URL
console.log('\n🌐 Application Configuration');
check(
  'Application URL',
  !!process.env.VITE_APP_URL,
  'VITE_APP_URL is required for email links (verification, password reset)'
);

// 7. Optional but Recommended
console.log('\n⚙️  Optional Configuration');
check(
  'Node Environment',
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production',
  `NODE_ENV is ${process.env.NODE_ENV || 'not set'}. Recommended: development or production`,
  true
);

// Print Results
console.log('\n' + '='.repeat(60));
console.log('\n📊 Results Summary\n');

const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;
const warnings = results.filter(r => r.status === 'warn').length;

results.forEach(result => {
  const icon = result.status === 'pass' ? '\u2705' : result.status === 'warn' ? '\u26A0\uFE0F' : '\u274C';
  console.log(`${icon} ${result.name}`);
  if (result.status !== 'pass') {
    console.log(`   ${result.message}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n\u2705 Passed: ${passed}`);
console.log(`\u26A0\uFE0F  Warnings: ${warnings}`);
console.log(`\u274C Failed: ${failed}`);

if (failed > 0) {
  console.log('\n\u274C Environment is NOT ready for testing. Please fix the failed checks.');
  console.log('\nTo set environment variables, edit your .env file:');
  console.log('  cp .env.example .env');
  console.log('  # Then edit .env with your values\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n\u26A0\uFE0F  Environment is mostly ready, but some optional features may not work.');
  console.log('Review the warnings above.\n');
  process.exit(0);
} else {
  console.log('\n\u2705 Environment is ready for testing all 8 features!\n');
  console.log('Next steps:');
  console.log('  1. npm run dev');
  console.log('  2. Follow TESTING_GUIDE.md\n');
  process.exit(0);
}
