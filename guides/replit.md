# AffiliateXchange - Affiliate Marketplace Platform

## Overview

AffiliateXchange is a multi-sided marketplace platform connecting video content creators with brands for affiliate marketing opportunities. It enables creators to discover offers, track performance, and earn commissions, while companies can list offers, manage partnerships, and monitor campaigns. The platform features role-based dashboards for creators, companies, and administrators, aiming to streamline affiliate marketing for video content.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite.
**UI Component System**: shadcn/ui (Radix UI primitives) with Tailwind CSS, following a "New York" style variant.
**Routing**: Wouter for client-side routing with role-based protection.
**State Management**: TanStack Query for server state, local React state for UI, and WebSockets for real-time features.
**Design System**: Custom design tokens inspired by Airbnb, Linear, Stripe, and Instagram/TikTok, using HSL color system with light/dark mode support.

### Backend Architecture

**Server Framework**: Express.js with TypeScript on Node.js.
**API Design**: RESTful API with role-based middleware.
**Authentication**: Custom username/password authentication using Passport Local Strategy with bcrypt. Sessions stored in PostgreSQL.
**Real-time Communication**: WebSocket server integrated with HTTP for messaging.

### Database Architecture

**Database**: PostgreSQL (Neon serverless) with connection pooling.
**ORM**: Drizzle ORM for type-safe operations.
**Schema Design**: Includes user management with role-based access, creator and company profiles, affiliate offers with various commission types, application tracking, a messaging system, reviews, favorites, detailed click event logging, and analytics. Key relationships connect users to profiles, offers to companies, and applications to creators and offers.

### System Design Choices

**File Upload & Storage**: Utilizes Uppy for client-side handling, with Cloudinary replacing Google Cloud Storage for media uploads (images, videos). Cloudinary provides optimization, transcoding, and secure delivery.
**Notification System**: Comprehensive multi-channel delivery via Email (SendGrid), Web Push, and In-App notifications. Supports various notification types with user-granular preferences, real-time updates, and professional templating.
**Click Tracking System**: Records detailed click events including IP, geo-location, device, and browser information for analytics and unique click calculations.
**Authentication System**: Custom username/password authentication replaced Replit Auth, featuring secure credential verification, session-based auth, and role selection during registration.

## External Dependencies

**Authentication & Sessions**:
- Passport Local Strategy
- bcrypt

**Database**:
- Neon (PostgreSQL serverless)
- Drizzle ORM (with Drizzle Kit for migrations)

**File Storage**:
- Cloudinary (for images and videos)
- Uppy (file upload library)

**UI Libraries**:
- Radix UI
- Tailwind CSS
- Recharts (for data visualization)
- Lucide React (icon system)

**Development Tools**:
- Vite
- TypeScript
- ESBuild

**Real-time Communication**:
- ws (WebSocket library)

**Geo-location**:
- geoip-lite (IP-to-location lookup)

**Notification Services**:
- SendGrid (email notifications with HTML templates)
- web-push (browser push notifications with VAPID authentication)

**Typography**:
- Google Fonts (Inter, JetBrains Mono)