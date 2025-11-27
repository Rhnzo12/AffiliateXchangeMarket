-- Add high_risk_company notification type to the notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'high_risk_company';
