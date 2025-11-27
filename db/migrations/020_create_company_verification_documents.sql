-- Migration: Create company_verification_documents table for multiple verification documents
-- This allows companies to upload multiple verification documents (PDFs, images)

-- Create the company_verification_documents table
CREATE TABLE IF NOT EXISTS company_verification_documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
  company_id VARCHAR NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  document_url VARCHAR NOT NULL,
  document_name VARCHAR NOT NULL,
  document_type VARCHAR NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_documents_company_id ON company_verification_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_verification_documents_created_at ON company_verification_documents(created_at DESC);

-- Comment on table
COMMENT ON TABLE company_verification_documents IS 'Stores multiple verification documents for companies (business registration, tax ID, etc.)';
COMMENT ON COLUMN company_verification_documents.document_type IS 'Type of document: pdf, image';
COMMENT ON COLUMN company_verification_documents.file_size IS 'File size in bytes';
