/**
 * Script to configure CORS for Google Cloud Storage bucket
 * Run with: npx tsx server/configure-cors.ts
 */

import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

async function configureCORS() {
  try {
    // Initialize Google Cloud Storage
    const keyFilePath = process.env.GOOGLE_CLOUD_KEYFILE;
    const storage = keyFilePath
      ? new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          keyFilename: keyFilePath,
        })
      : new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        });

    const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'myapp-media-affiliate';
    const bucket = storage.bucket(bucketName);

    // CORS configuration
    const corsConfiguration = [
      {
        origin: ['http://localhost:3000', 'http://localhost:5000', 'https://*.vercel.app'],
        method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        responseHeader: ['Content-Type', 'Access-Control-Allow-Origin'],
        maxAgeSeconds: 3600,
      },
    ];

    console.log('Configuring CORS for bucket:', bucketName);
    console.log('CORS configuration:', JSON.stringify(corsConfiguration, null, 2));

    await bucket.setCorsConfiguration(corsConfiguration);

    console.log('\n✅ CORS configuration applied successfully!');
    console.log('\nYou can now upload files from:');
    console.log('  - http://localhost:3000');
    console.log('  - http://localhost:5000');
    console.log('  - Any Vercel deployment (*.vercel.app)');

    // Verify the configuration
    const [metadata] = await bucket.getMetadata();
    console.log('\nVerified CORS configuration:');
    console.log(JSON.stringify(metadata.cors, null, 2));

  } catch (error: any) {
    console.error('❌ Error configuring CORS:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

configureCORS();
