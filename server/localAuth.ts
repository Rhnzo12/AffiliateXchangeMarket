import type { Express, Request } from "express";

import passport from "passport";

import { Strategy as LocalStrategy } from "passport-local";

import session from "express-session";

import connectPg from "connect-pg-simple";

import { storage } from "./storage";

import bcrypt from "bcrypt";

import { setupGoogleAuth } from "./googleAuth";

import crypto from "crypto";

import { NotificationService } from "./notifications/notificationService";

// Middleware to check if user is authenticated

export function isAuthenticated(req: Request, res: any, next: any) {

  if (req.isAuthenticated()) {

    return next();

  }

  res.status(401).send("Unauthorized");

}

// Middleware to check if user's email is verified

export function isEmailVerified(req: Request, res: any, next: any) {

  if (!req.isAuthenticated()) {

    return res.status(401).json({ error: "Unauthorized" });

  }

  const user = req.user as any;

  if (!user.emailVerified) {

    return res.status(403).json({

      error: "Email verification required",

      message: "Please verify your email address to perform this action.",

      emailVerified: false

    });

  }

  next();

}

// Setup session middleware

function getSession() {

  const sessionTtl = 7 * 24 * 60 * 60 * 1000;

  const pgStore = connectPg(session);

  const sessionStore = new pgStore({

    conString: process.env.DATABASE_URL,

    createTableIfMissing: false,

    ttl: sessionTtl,

    tableName: "sessions",

  });

  return session({

    secret: process.env.SESSION_SECRET!,

    store: sessionStore,

    resave: false,

    saveUninitialized: false,

    cookie: {

      httpOnly: true,

      secure: process.env.NODE_ENV === 'production',

      maxAge: sessionTtl,

    },

  });

}

// Setup Passport Local Strategy

export async function setupAuth(app: Express) {

  // Set trust proxy for session cookies

  app.set("trust proxy", 1);

  // Setup session middleware BEFORE passport

  app.use(getSession());

  // Configure Passport Local Strategy

  passport.use(

  new LocalStrategy(async (username, password, done) => {

    try {

      const user = await storage.getUserByUsername(username);

      if (!user) {

        return done(null, false, { message: "Invalid username or password" });

      }

      // Check if user has a password (OAuth users might not have one)

      if (!user.password) {

        return done(null, false, { message: "Please sign in with Google" });

      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {

        return done(null, false, { message: "Invalid username or password" });

      }

      return done(null, user);

    } catch (error) {

      return done(error);

    }

  })

);

  // Serialize user to session

  passport.serializeUser((user: any, done) => {

    // Handle pending Google users (they don't have an id yet)

    if (user.isNewGoogleUser) {

      done(null, { isNewGoogleUser: true, data: user });

    } else {

      done(null, { isNewGoogleUser: false, id: user.id });

    }

  });

  // Deserialize user from session

  passport.deserializeUser(async (data: any, done) => {

    try {

      // Handle pending Google users

      if (data.isNewGoogleUser) {

        return done(null, data.data);

      }

      // Handle regular users

      const user = await storage.getUser(data.id);

      if (!user) {

        // User not found - clear the session

        return done(null, false);

      }

      done(null, user);

    } catch (error) {

      console.error("Error deserializing user:", error);

      // Return false instead of error to clear invalid sessions

      done(null, false);

    }

  });

  // Initialize passport

  app.use(passport.initialize());

  app.use(passport.session());

  // Setup Google OAuth

  await setupGoogleAuth(app);

  // Authentication routes

  app.post("/api/auth/register", async (req, res) => {

    try {

      const { username, email, password, firstName, lastName, role } = req.body;

      // Validate inputs

      if (!username || !email || !password) {

        return res.status(400).json({ error: "Username, email, and password are required" });

      }

      if (password.length < 6) {

        return res.status(400).json({ error: "Password must be at least 6 characters" });

      }

      if (!["creator", "company"].includes(role)) {

        return res.status(400).json({ error: "Invalid role" });

      }

      // Check if username or email already exists

      const existingUser = await storage.getUserByUsername(username);

      if (existingUser) {

        return res.status(400).json({ error: "Username already taken" });

      }

      const existingEmail = await storage.getUserByEmail(email);

      if (existingEmail) {

        return res.status(400).json({ error: "Email already registered" });

      }

      // Hash password

      const hashedPassword = await bcrypt.hash(password, 10);

      // Generate email verification token

      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Create user with all required fields

      const user = await storage.createUser({

        username,

        email,

        password: hashedPassword,

        firstName: firstName || null,

        lastName: lastName || null,

        role,

        accountStatus: 'active', // ✅ Required field

        profileImageUrl: null,   // ✅ Required field

        emailVerified: false,    // Email not verified yet

        emailVerificationToken,

        emailVerificationTokenExpiry,

      });

      // Create profile based on role

      if (role === 'creator') {

        await storage.createCreatorProfile({

          userId: user.id,

          bio: null,

          youtubeUrl: null,

          tiktokUrl: null,

          instagramUrl: null,

          youtubeFollowers: null,

          tiktokFollowers: null,

          instagramFollowers: null,

          niches: [],

        });

      } else if (role === 'company') {

        const companyProfile = await storage.createCompanyProfile({

          userId: user.id,

          legalName: username,

          tradeName: null,

          websiteUrl: null,

          description: null,

          logoUrl: null,

          industry: null,

          companySize: null,

          yearFounded: null,

          contactName: null,

          contactJobTitle: null,

          phoneNumber: null,

          businessAddress: null,

          verificationDocumentUrl: null,

          status: 'pending',

          rejectionReason: null,

        });

        // Notify all admins about new company registration

        try {

          const notificationService = new NotificationService(storage);

          const adminUsers = await storage.getUsersByRole('admin');

          console.log(`[Auth] Company profile created with ID: ${companyProfile.id} for user ${username} (User ID: ${user.id})`);

          for (const admin of adminUsers) {

            await notificationService.sendNotification(

              admin.id,

              'new_application',

              'New Company Registration',

              `${username} has registered as a new company and is awaiting approval.`,

              {

                companyName: username,

                companyUserId: user.id,

                linkUrl: `/admin/companies/${companyProfile.id}`

              }

            );

          }

          console.log(`[Auth] Notified ${adminUsers.length} admin(s) about new company registration: ${username} (Company Profile ID: ${companyProfile.id})`);

        } catch (notificationError) {

          console.error('[Auth] Failed to send admin notification for new company registration:', notificationError);

          // Don't fail registration if notification fails

        }

      }

      // Send email verification email

      try {

        const notificationService = new NotificationService(storage);

        const verificationUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/verify-email?token=${emailVerificationToken}`;

        await notificationService.sendEmailNotification(

          email,

          'email_verification',

          {

            userName: firstName || username,

            verificationUrl,

            linkUrl: verificationUrl,

          }

        );

        console.log(`[Auth] Verification email sent to ${email}`);

      } catch (emailError) {

        console.error('[Auth] Failed to send verification email:', emailError);

        // Don't fail registration if email fails

      }

      // Log the user in

      req.login(user, (err) => {

        if (err) {

          console.error("Login error after registration:", err);

          return res.status(500).json({ error: "Registration successful but login failed" });

        }

        res.json({

          success: true,

          user: {

            id: user.id,

            username: user.username,

            role: user.role,

            emailVerified: user.emailVerified

          },

          message: "Registration successful! Please check your email to verify your account."

        });

      });

    } catch (error: any) {

      console.error("Registration error:", error);

      res.status(500).json({ error: error.message || "Registration failed" });

    }

  });

  app.post("/api/auth/login", (req, res, next) => {

    passport.authenticate("local", (err: any, user: any, info: any) => {

      if (err) {

        console.error("Login error:", err);

        return res.status(500).json({ error: "Login failed" });

      }

      if (!user) {

        return res.status(401).json({ error: info?.message || "Invalid credentials" });

      }

      // Check if 2FA is enabled for this user
      if (user.twoFactorEnabled) {
        // Don't log the user in yet - return a response indicating 2FA is required
        return res.json({
          requiresTwoFactor: true,
          userId: user.id,
          message: "Please enter your two-factor authentication code",
        });
      }

      req.login(user, (loginErr) => {

        if (loginErr) {

          console.error("Session login error:", loginErr);

          return res.status(500).json({ error: "Login failed" });

        }

        res.json({

          success: true,

          user: {

            id: user.id,

            username: user.username,

            email: user.email,

            role: user.role

          },

          role: user.role

        });

      });

    })(req, res, next);

  });

  app.post("/api/auth/logout", (req, res) => {

    req.logout((err) => {

      if (err) {

        console.error("Logout error:", err);

        return res.status(500).json({ error: "Logout failed" });

      }

      res.json({ success: true });

    });

  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {

    try {

      const userId = (req.user as any).id;

      const user = await storage.getUser(userId);

      res.json(user);

    } catch (error) {

      console.error("Error fetching user:", error);

      res.status(500).json({ message: "Failed to fetch user" });

    }

  });

  // Update account information (username, firstName, lastName)

  app.put("/api/auth/account", isAuthenticated, async (req, res) => {

    try {

      const userId = (req.user as any).id;

      const { username, firstName, lastName } = req.body;

      // Validate required fields

      if (!username || !username.trim()) {

        return res.status(400).json({ error: "Username is required" });

      }

      // Check if username is already taken by another user

      const existingUser = await storage.getUserByUsername(username.trim());

      if (existingUser && existingUser.id !== userId) {

        return res.status(400).json({ error: "Username is already taken" });

      }

      // Update user

      const updatedUser = await storage.updateUser(userId, {

        username: username.trim(),

        firstName: firstName?.trim() || null,

        lastName: lastName?.trim() || null,

      });

      if (!updatedUser) {

        return res.status(404).json({ error: "User not found" });

      }

      res.json(updatedUser);

    } catch (error: any) {

      console.error("Error updating account:", error);

      res.status(500).json({ error: error.message || "Failed to update account" });

    }

  });

  // Change password

  app.put("/api/auth/password", isAuthenticated, async (req, res) => {

    try {

      const userId = (req.user as any).id;

      const { currentPassword, newPassword } = req.body;

      // Validate required fields

      if (!currentPassword || !newPassword) {

        return res.status(400).json({ error: "Current and new password are required" });

      }

      if (newPassword.length < 8) {

        return res.status(400).json({ error: "New password must be at least 8 characters" });

      }

      // Get user

      const user = await storage.getUser(userId);

      if (!user) {

        return res.status(404).json({ error: "User not found" });

      }

      // Check if user has a password (OAuth users don't)

      if (!user.password) {

        return res.status(400).json({ error: "Cannot change password for OAuth accounts" });

      }

      // Verify current password

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordValid) {

        return res.status(401).json({ error: "Current password is incorrect" });

      }

      // Hash new password

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password

      const updatedUser = await storage.updateUser(userId, {

        password: hashedPassword,

      });

      if (!updatedUser) {

        return res.status(500).json({ error: "Failed to update password" });

      }

      res.json({ success: true, message: "Password changed successfully" });

    } catch (error: any) {

      console.error("Error changing password:", error);

      res.status(500).json({ error: error.message || "Failed to change password" });

    }

  });

  // Request password change OTP - Send verification code to email
  app.post("/api/auth/request-password-change-otp", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has a password (OAuth users don't)
      if (!user.password) {
        return res.status(400).json({ error: "Cannot change password for OAuth accounts" });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Set OTP expiry to 15 minutes from now
      const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

      // Store OTP in database
      await storage.updateUser(userId, {
        passwordChangeOtp: otp,
        passwordChangeOtpExpiry: otpExpiry,
      });

      // Send OTP via email
      const notificationService = new NotificationService(storage);

      await notificationService.sendEmailNotification(
        user.email,
        'password_change_otp',
        {
          userName: user.firstName || user.username,
          otpCode: otp,
        }
      );

      res.json({
        message: "Verification code sent to your email",
        email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Partially hide email
      });

    } catch (error: any) {
      console.error("Request password change OTP error:", error);
      res.status(500).json({ error: error.message || "Failed to send verification code" });
    }
  });

  // Verify OTP and change password
  app.post("/api/auth/verify-password-change-otp", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { otp, newPassword } = req.body;

      // Validate required fields
      if (!otp) {
        return res.status(400).json({ error: "Verification code is required" });
      }

      if (!newPassword) {
        return res.status(400).json({ error: "New password is required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has a password (OAuth users don't)
      if (!user.password) {
        return res.status(400).json({ error: "Cannot change password for OAuth accounts" });
      }

      // Verify OTP
      if (!user.passwordChangeOtp) {
        return res.status(400).json({ error: "No verification code found. Please request a new code." });
      }

      if (!user.passwordChangeOtpExpiry) {
        return res.status(400).json({ error: "Verification code expiry not found. Please request a new code." });
      }

      if (user.passwordChangeOtp !== otp) {
        return res.status(400).json({ error: "Invalid verification code" });
      }

      if (new Date() > user.passwordChangeOtpExpiry) {
        return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear OTP
      await storage.updateUser(userId, {
        password: hashedPassword,
        passwordChangeOtp: null,
        passwordChangeOtpExpiry: null,
      });

      res.json({ success: true, message: "Password changed successfully" });

    } catch (error: any) {
      console.error("Verify password change OTP error:", error);
      res.status(500).json({ error: error.message || "Failed to change password" });
    }
  });

  // Email verification endpoint

  app.post("/api/auth/verify-email", async (req, res) => {

    try {

      const { token } = req.body;

      if (!token) {

        return res.status(400).json({ error: "Verification token is required" });

      }

      // Find user by verification token

      const user = await storage.getUserByEmailVerificationToken(token);

      if (!user) {

        return res.status(400).json({ error: "Invalid or expired verification token" });

      }

      // Check if token is expired

      if (user.emailVerificationTokenExpiry && new Date() > user.emailVerificationTokenExpiry) {

        return res.status(400).json({ error: "Verification token has expired. Please request a new one." });

      }

      // Update user - set emailVerified to true and clear verification token

      await storage.updateUser(user.id, {

        emailVerified: true,

        emailVerificationToken: null,

        emailVerificationTokenExpiry: null,

      });

      res.json({ success: true, message: "Email verified successfully!" });

    } catch (error: any) {

      console.error("Email verification error:", error);

      res.status(500).json({ error: error.message || "Email verification failed" });

    }

  });

  // Resend verification email endpoint

  app.post("/api/auth/resend-verification", isAuthenticated, async (req, res) => {

    try {

      const userId = (req.user as any).id;

      const user = await storage.getUser(userId);

      if (!user) {

        return res.status(404).json({ error: "User not found" });

      }

      if (user.emailVerified) {

        return res.status(400).json({ error: "Email is already verified" });

      }

      // Generate new verification token

      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with new token

      await storage.updateUser(userId, {

        emailVerificationToken,

        emailVerificationTokenExpiry,

      });

      // Send verification email

      const notificationService = new NotificationService(storage);

      const verificationUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/verify-email?token=${emailVerificationToken}`;

      await notificationService.sendEmailNotification(

        user.email,

        'email_verification',

        {

          userName: user.firstName || user.username,

          verificationUrl,

          linkUrl: verificationUrl,

        }

      );

      res.json({ success: true, message: "Verification email sent successfully!" });

    } catch (error: any) {

      console.error("Resend verification email error:", error);

      res.status(500).json({ error: error.message || "Failed to send verification email" });

    }

  });

  // Forgot password endpoint

  app.post("/api/auth/forgot-password", async (req, res) => {

    try {

      const { email } = req.body;

      if (!email) {

        return res.status(400).json({ error: "Email is required" });

      }

      const user = await storage.getUserByEmail(email);

      // Don't reveal if email exists or not for security

      if (!user) {

        return res.json({ success: true, message: "If an account exists with that email, a password reset link has been sent." });

      }

      // Check if user has a password (OAuth users don't)

      if (!user.password) {

        return res.json({ success: true, message: "If an account exists with that email, a password reset link has been sent." });

      }

      // Generate password reset token

      const passwordResetToken = crypto.randomBytes(32).toString('hex');

      const passwordResetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Update user with reset token

      await storage.updateUser(user.id, {

        passwordResetToken,

        passwordResetTokenExpiry,

      });

      // Send password reset email

      const notificationService = new NotificationService(storage);

      const resetUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password?token=${passwordResetToken}`;

      await notificationService.sendEmailNotification(

        user.email,

        'password_reset',

        {

          userName: user.firstName || user.username,

          resetUrl,

          linkUrl: resetUrl,

        }

      );

      res.json({ success: true, message: "If an account exists with that email, a password reset link has been sent." });

    } catch (error: any) {

      console.error("Forgot password error:", error);

      res.status(500).json({ error: "Failed to process password reset request" });

    }

  });

  // Reset password endpoint

  app.post("/api/auth/reset-password", async (req, res) => {

    try {

      const { token, newPassword } = req.body;

      if (!token || !newPassword) {

        return res.status(400).json({ error: "Token and new password are required" });

      }

      if (newPassword.length < 8) {

        return res.status(400).json({ error: "Password must be at least 8 characters" });

      }

      // Find user by reset token

      const user = await storage.getUserByPasswordResetToken(token);

      if (!user) {

        return res.status(400).json({ error: "Invalid or expired reset token" });

      }

      // Check if token is expired

      if (user.passwordResetTokenExpiry && new Date() > user.passwordResetTokenExpiry) {

        return res.status(400).json({ error: "Reset token has expired. Please request a new one." });

      }

      // Hash new password

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user - set new password and clear reset token

      await storage.updateUser(user.id, {

        password: hashedPassword,

        passwordResetToken: null,

        passwordResetTokenExpiry: null,

      });

      res.json({ success: true, message: "Password reset successfully!" });

    } catch (error: any) {

      console.error("Reset password error:", error);

      res.status(500).json({ error: error.message || "Password reset failed" });

    }

  });

  // GDPR/CCPA: Export user data

  app.get("/api/user/export-data", isAuthenticated, async (req, res) => {

    try {

      const userId = (req.user as any).id;

      const user = await storage.getUser(userId);

      if (!user) {

        return res.status(404).json({ error: "User not found" });

      }

      // Collect all user data

      const exportData: any = {

        exportDate: new Date().toISOString(),

        user: {

          id: user.id,

          username: user.username,

          email: user.email,

          firstName: user.firstName,

          lastName: user.lastName,

          role: user.role,

          accountStatus: user.accountStatus,

          emailVerified: user.emailVerified,

          createdAt: user.createdAt,

          updatedAt: user.updatedAt,

        },

      };

      // Get profile data based on role

      if (user.role === 'creator') {

        const profile = await storage.getCreatorProfile(userId);

        if (profile) {

          exportData.creatorProfile = {

            bio: profile.bio,

            youtubeUrl: profile.youtubeUrl,

            tiktokUrl: profile.tiktokUrl,

            instagramUrl: profile.instagramUrl,

            youtubeFollowers: profile.youtubeFollowers,

            tiktokFollowers: profile.tiktokFollowers,

            instagramFollowers: profile.instagramFollowers,

            niches: profile.niches,

          };

        }

        // Get creator applications

        const applications = await storage.getApplicationsByCreator(userId);

        exportData.applications = applications.map(app => ({

          id: app.id,

          offerId: app.offerId,

          status: app.status,

          message: app.message,

          trackingCode: app.trackingCode,

          createdAt: app.createdAt,

          approvedAt: app.approvedAt,

          completedAt: app.completedAt,

        }));

        // Get creator analytics

        const analytics = await storage.getAnalyticsByCreator(userId);

        exportData.analytics = analytics;

        // Get creator reviews

        const reviews = await storage.getReviewsByCreator(userId);

        exportData.reviews = reviews;

        // Get creator favorites

        const favorites = await storage.getFavoritesByCreator(userId);

        exportData.favorites = favorites;

        // Get creator payments

        const payments = await storage.getPaymentsByCreator(userId);

        exportData.payments = payments.map(payment => ({

          id: payment.id,

          grossAmount: payment.grossAmount,

          platformFeeAmount: payment.platformFeeAmount,

          stripeFeeAmount: payment.stripeFeeAmount,

          netAmount: payment.netAmount,

          status: payment.status,

          paymentMethod: payment.paymentMethod,

          description: payment.description,

          initiatedAt: payment.initiatedAt,

          completedAt: payment.completedAt,

        }));

        // Get payment settings (sanitized)

        const paymentSettings = await storage.getPaymentSettings(userId);

        exportData.paymentSettings = paymentSettings.map(setting => ({

          id: setting.id,

          payoutMethod: setting.payoutMethod,

          payoutEmail: setting.payoutEmail,

          isDefault: setting.isDefault,

        }));

      } else if (user.role === 'company') {

        const profile = await storage.getCompanyProfile(userId);

        if (profile) {

          exportData.companyProfile = {

            legalName: profile.legalName,

            tradeName: profile.tradeName,

            industry: profile.industry,

            websiteUrl: profile.websiteUrl,

            companySize: profile.companySize,

            yearFounded: profile.yearFounded,

            description: profile.description,

            contactName: profile.contactName,

            phoneNumber: profile.phoneNumber,

            businessAddress: profile.businessAddress,

            status: profile.status,

            approvedAt: profile.approvedAt,

          };

          // Get company offers

          const offers = await storage.getOffersByCompany(profile.id);

          exportData.offers = offers.map(offer => ({

            id: offer.id,

            title: offer.title,

            productName: offer.productName,

            shortDescription: offer.shortDescription,

            fullDescription: offer.fullDescription,

            status: offer.status,

            commissionType: offer.commissionType,

            commissionAmount: offer.commissionAmount,

            commissionPercentage: offer.commissionPercentage,

            createdAt: offer.createdAt,

            approvedAt: offer.approvedAt,

          }));

          // Get company applications

          const applications = await storage.getApplicationsByCompany(profile.id);

          exportData.applications = applications;

          // Get company reviews

          const reviews = await storage.getReviewsByCompany(profile.id);

          exportData.reviews = reviews;

        }

      }

      // Get messages (all users)

      const conversations = await storage.getConversationsByUser(userId, user.role);

      const messages = [];

      for (const conv of conversations) {

        const convMessages = await storage.getMessages(conv.id);

        messages.push(...convMessages);

      }

      exportData.messages = messages.map(msg => ({

        id: msg.id,

        conversationId: msg.conversationId,

        content: msg.content,

        attachments: msg.attachments || [],

        isRead: msg.isRead,

        createdAt: msg.createdAt,

        sentByMe: msg.senderId === userId,

      }));

      // Get notifications

      const notifications = await storage.getNotifications(userId);

      exportData.notifications = notifications;

      // Get notification preferences

      const notificationPreferences = await storage.getUserNotificationPreferences(userId);

      exportData.notificationPreferences = notificationPreferences;

      // Set headers for file download

      res.setHeader('Content-Type', 'application/json');

      res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}-${Date.now()}.json"`);

      res.json(exportData);

    } catch (error: any) {

      console.error("Export data error:", error);

      res.status(500).json({ error: error.message || "Failed to export data" });

    }

  });

// Request account deletion - Generate and send OTP
app.post("/api/user/request-account-deletion", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP expiry to 15 minutes from now
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

    // Store OTP in database
    await storage.updateUser(userId, {
      accountDeletionOtp: otp,
      accountDeletionOtpExpiry: otpExpiry,
    });

    // Send OTP via email
    const notificationService = new NotificationService(storage);

    await notificationService.sendEmailNotification(
      user.email,
      'account_deletion_otp',
      {
        userName: user.firstName || user.username,
        otpCode: otp,
      }
    );

    res.json({
      message: "Verification code sent to your email",
      email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Partially hide email
    });

  } catch (error: any) {
    console.error("Request account deletion error:", error);
    res.status(500).json({ error: error.message || "Failed to send verification code" });
  }
});

// GDPR/CCPA: Delete account

app.post("/api/user/delete-account", isAuthenticated, async (req, res) => {

  try {

    const userId = (req.user as any).id;

    const { otp } = req.body;

    const user = await storage.getUser(userId);

    if (!user) {

      return res.status(404).json({ error: "User not found" });

    }

    // Verify OTP
    if (!otp) {
      return res.status(400).json({ error: "Verification code is required" });
    }

    if (!user.accountDeletionOtp) {
      return res.status(400).json({ error: "No verification code found. Please request a new code." });
    }

    if (!user.accountDeletionOtpExpiry) {
      return res.status(400).json({ error: "Invalid verification code. Please request a new code." });
    }

    // Check if OTP has expired
    if (new Date() > new Date(user.accountDeletionOtpExpiry)) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new code." });
    }

    // Verify OTP matches
    if (user.accountDeletionOtp !== otp) {
      return res.status(401).json({ error: "Invalid verification code. Please check and try again." });
    }

    // Check for active applications/contracts/retainers

    let applications = [];

    let activeItems: any = {

      applications: [],

      retainerContracts: [],

      retainerApplications: [],

      offers: [],

      pendingPayments: [],

      pendingDeliverables: []

    };

    if (user.role === 'creator') {

      // Check for active applications

      applications = await storage.getApplicationsByCreator(userId);

      const activeApps = applications.filter(app =>

        app.status === 'active' || app.status === 'approved'

      );

      activeItems.applications = activeApps;

      // Check for active retainer contracts where creator is assigned

      const creatorContracts = await storage.getRetainerContractsByCreator(userId);

      const activeContracts = creatorContracts.filter(contract =>

        contract.status === 'in_progress'

      );

      activeItems.retainerContracts = activeContracts;

      // Check for pending retainer applications

      const retainerApplications = await storage.getRetainerApplicationsByCreator(userId);

      const pendingRetainerApps = retainerApplications.filter(app =>

        app.status === 'pending'

      );

      activeItems.retainerApplications = pendingRetainerApps;

      // Check for pending deliverables (not yet approved/rejected)

      const deliverables = await storage.getRetainerDeliverablesByCreator(userId);

      const pendingDeliverables = deliverables.filter(d =>

        d.status === 'pending_review' || d.status === 'revision_requested'

      );

      activeItems.pendingDeliverables = pendingDeliverables;

      // Check for pending payments

      const payments = await storage.getPaymentsByCreator(userId);

      const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'processing');

      activeItems.pendingPayments = pendingPayments;

      // If there are any active items, return error with details

      const hasActiveItems = activeApps.length > 0 || activeContracts.length > 0 ||

                            pendingRetainerApps.length > 0 || pendingDeliverables.length > 0 ||

                            pendingPayments.length > 0;

      if (hasActiveItems) {

        return res.status(400).json({

          error: "Cannot delete account with active activities",

          details: {

            applications: activeApps.length,

            retainerContracts: activeContracts.length,

            retainerApplications: pendingRetainerApps.length,

            pendingDeliverables: pendingDeliverables.length,

            pendingPayments: pendingPayments.length

          },

          activeItems: activeItems

        });

      }

    } else if (user.role === 'company') {

      const profile = await storage.getCompanyProfile(userId);

      if (profile) {

        // Check for active applications

        applications = await storage.getApplicationsByCompany(profile.id);

        const activeApps = applications.filter(app =>

          app.status === 'active' || app.status === 'approved'

        );

        activeItems.applications = activeApps;

        // Check for active offers with applications

        const offers = await storage.getOffersByCompany(profile.id);

        const offersWithApps = [];

        for (const offer of offers) {

          const offerApps = applications.filter(app => app.offerId === offer.id);

          if (offerApps.length > 0 && offer.status === 'approved') {

            offersWithApps.push({

              ...offer,

              applicationCount: offerApps.length

            });

          }

        }

        activeItems.offers = offersWithApps;

        // Check for active retainer contracts (case-insensitive status check)

        const companyContracts = await storage.getRetainerContractsByCompany(profile.id);

        const isInProgressRetainer = (status?: string) => status?.toLowerCase() === 'in_progress';

        const activeContracts = companyContracts.filter(contract =>

          isInProgressRetainer(contract.status)

        );

        activeItems.retainerContracts = activeContracts;

        // Check for pending payments

        const { db } = await import('./db');

        const { retainerPayments } = await import('../shared/schema');

        const { eq } = await import('drizzle-orm');

        const payments = await db.select().from(retainerPayments).where(eq(retainerPayments.companyId, profile.id));

        const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'processing');

        activeItems.pendingPayments = pendingPayments;

        // If there are any active items, return error with details

        const hasActiveItems = activeApps.length > 0 || offersWithApps.length > 0 ||

                              activeContracts.length > 0 || pendingPayments.length > 0;

        if (hasActiveItems) {

          return res.status(400).json({

            error: "Cannot delete account with active activities",

            details: {

              applications: activeApps.length,

              offersWithApplications: offersWithApps.length,

              retainerContracts: activeContracts.length,

              pendingPayments: pendingPayments.length

            },

            activeItems: activeItems

          });

        }

      }

    }

    // Start account deletion process

    console.log(`[Account Deletion] Starting deletion for user ${userId} (${user.email})`);

    // Import ObjectStorageService to delete Cloudinary files

    const { ObjectStorageService } = await import('./objectStorage');

    const objectStorage = new ObjectStorageService();

    // Track Cloudinary deletion errors

    const cloudinaryErrors: string[] = [];

    const deleteFolderWithTracking = async (folderPath: string, description: string) => {
      try {
        await objectStorage.deleteFolder(folderPath);
        console.log(`[Account Deletion] Deleted ${description} folder`);
      } catch (error: any) {
        const errorDetails = error?.message || error?.error?.message || JSON.stringify(error);
        const errorMsg = `Failed to delete ${description} folder: ${errorDetails}`;
        console.error(`[Account Deletion] ${errorMsg}`);
        cloudinaryErrors.push(errorMsg);
      }
    };

    // 1A. Delete specific files first (profile images, logos, documents)

    console.log(`[Account Deletion] Deleting specific user files`);

    // Delete user profile image if exists

    if (user.profileImageUrl) {

      try {

        const publicId = objectStorage.extractPublicIdFromUrl(user.profileImageUrl);

        if (publicId) {

          await objectStorage.deleteResource(publicId, 'image');

          console.log(`[Account Deletion] Deleted user profile image: ${publicId}`);

        }

      } catch (error: any) {

        const errorMsg = `Failed to delete profile image: ${error.message}`;

        console.error(`[Account Deletion] ${errorMsg}`);

        cloudinaryErrors.push(errorMsg);

      }

    }

    if (user.role === 'company') {

      const companyProfile = await storage.getCompanyProfile(userId);

      if (companyProfile) {

        // Delete company logo

        if (companyProfile.logoUrl) {

          try {

            const logoPublicId = objectStorage.extractPublicIdFromUrl(companyProfile.logoUrl);

            if (logoPublicId) {

              await objectStorage.deleteResource(logoPublicId, 'image');

              console.log(`[Account Deletion] Deleted company logo: ${logoPublicId}`);

            }

          } catch (error: any) {

            const errorMsg = `Failed to delete logo: ${error.message}`;

            console.error(`[Account Deletion] ${errorMsg}`);

            cloudinaryErrors.push(errorMsg);

          }

        }

        // Delete verification document

        if (companyProfile.verificationDocumentUrl) {

          try {

            const docPublicId = objectStorage.extractPublicIdFromUrl(companyProfile.verificationDocumentUrl);

            if (docPublicId) {

              const docType = companyProfile.verificationDocumentUrl.endsWith('.pdf') ? 'raw' : 'image';

              await objectStorage.deleteResource(docPublicId, docType);

              console.log(`[Account Deletion] Deleted verification document: ${docPublicId}`);

            }

          } catch (error: any) {

            const errorMsg = `Failed to delete verification document: ${error.message}`;

            console.error(`[Account Deletion] ${errorMsg}`);

            cloudinaryErrors.push(errorMsg);

          }

        }

        // Delete offer images/videos for all company offers

        try {

          const offers = await storage.getOffersByCompany(companyProfile.id);

          console.log(`[Account Deletion] Deleting media from ${offers.length} offers`);

          for (const offer of offers) {

            // Delete featured image

            if (offer.featuredImageUrl) {

              try {

                const publicId = objectStorage.extractPublicIdFromUrl(offer.featuredImageUrl);

                if (publicId) {

                  await objectStorage.deleteResource(publicId, 'image');

                  console.log(`[Account Deletion] Deleted offer featured image: ${publicId}`);

                }

              } catch (error: any) {

                console.error(`[Account Deletion] Error deleting offer image:`, error.message);

              }

            }

            // Delete offer videos

            const { db } = await import('./db');

            const { offerVideos } = await import('../shared/schema');

            const { eq } = await import('drizzle-orm');

            const videos = await db.select().from(offerVideos).where(eq(offerVideos.offerId, offer.id));

            for (const video of videos) {

              if (video.videoUrl) {

                try {

                  const publicId = objectStorage.extractPublicIdFromUrl(video.videoUrl);

                  if (publicId) {

                    await objectStorage.deleteResource(publicId, 'video');

                    console.log(`[Account Deletion] Deleted offer video: ${publicId}`);

                  }

                } catch (error: any) {

                  console.error(`[Account Deletion] Error deleting video:`, error.message);

                }

              }

              if (video.thumbnailUrl) {

                try {

                  const thumbId = objectStorage.extractPublicIdFromUrl(video.thumbnailUrl);

                  if (thumbId) {

                    await objectStorage.deleteResource(thumbId, 'image');

                    console.log(`[Account Deletion] Deleted video thumbnail: ${thumbId}`);

                  }

                } catch (error: any) {

                  console.error(`[Account Deletion] Error deleting thumbnail:`, error.message);

                }

              }

            }

          }

        } catch (error: any) {

          const errorMsg = `Failed to delete offer media: ${error.message}`;

          console.error(`[Account Deletion] ${errorMsg}`);

          cloudinaryErrors.push(errorMsg);

        }

      }

    }

    // 1B. Delete ALL Cloudinary folders for this user
      console.log(`[Account Deletion] Deleting all Cloudinary folders for user ${userId}`);

      if (user.role === 'creator') {
        const creatorProfile = await storage.getCreatorProfile(userId);
        if (creatorProfile) {
          // Delete retainer deliverables from database before deleting files
          try {
            const deliverables = await storage.getRetainerDeliverablesByCreator(userId);
            console.log(`[Account Deletion] Found ${deliverables.length} retainer deliverables to delete`);

            for (const deliverable of deliverables) {
              // Delete the video file from Cloudinary
              if (deliverable.videoUrl) {
                try {
                  const publicId = objectStorage.extractPublicIdFromUrl(deliverable.videoUrl);
                  if (publicId) {
                    await objectStorage.deleteResource(publicId, 'video');
                    console.log(`[Account Deletion] Deleted deliverable video: ${publicId}`);
                  }
                } catch (error: any) {
                  const errorMsg = `Failed to delete deliverable video: ${error.message}`;
                  console.error(`[Account Deletion] ${errorMsg}`);
                  cloudinaryErrors.push(errorMsg);
                }
              }

              // Delete the deliverable record from database
              await storage.deleteRetainerDeliverable(deliverable.id);
            }

            console.log(`[Account Deletion] Deleted ${deliverables.length} deliverable records`);
          } catch (error: any) {
            const errorMsg = `Failed to delete retainer deliverables: ${error.message}`;
            console.error(`[Account Deletion] ${errorMsg}`);
            cloudinaryErrors.push(errorMsg);
          }

          // ✅ DELETE CREATOR-SPECIFIC FOLDERS BY ID

          // 1. Delete creatorprofile/{creator_id} folder
          await deleteFolderWithTracking(
            `creatorprofile/${userId}`,
            `creatorprofile/${userId}`
          );

          // 2. Delete retainer deliverables folder (retainer-deliverables/{creator_id})
          try {
            await objectStorage.deleteFolder(`retainer-deliverables/${userId}`);
            console.log(`[Account Deletion] Deleted retainer-deliverables/${userId} folder`);
          } catch (error: any) {
            const errorMsg = `Failed to delete retainer-deliverables/${userId} folder: ${error.message}`;
            console.error(`[Account Deletion] ${errorMsg}`);
            cloudinaryErrors.push(errorMsg);
          }

          // 3. Delete creatorlink/retainer/{retainer_id} folders for all retainer contracts
          try {
            const retainerContracts = await storage.getRetainerContractsByCreator(userId);
            console.log(`[Account Deletion] Deleting ${retainerContracts.length} retainer contract folders`);

            for (const contract of retainerContracts) {
              try {
                await objectStorage.deleteFolder(`creatorlink/retainer/${contract.id}`);
                console.log(`[Account Deletion] Deleted creatorlink/retainer/${contract.id} folder`);
              } catch (error: any) {
                const errorMsg = `Failed to delete creatorlink/retainer/${contract.id} folder: ${error.message}`;
                console.error(`[Account Deletion] ${errorMsg}`);
                cloudinaryErrors.push(errorMsg);
              }
            }
          } catch (error: any) {
            const errorMsg = `Failed to delete retainer contract folders: ${error.message}`;
            console.error(`[Account Deletion] ${errorMsg}`);
            cloudinaryErrors.push(errorMsg);
          }

          // 4. Delete creatorlink/attachments/{conversation_id} folders for all conversations
          try {
            const conversations = await storage.getConversationsByUser(userId, 'creator');
            console.log(`[Account Deletion] Deleting ${conversations.length} conversation attachment folders`);

            for (const conversation of conversations) {
              try {
                await objectStorage.deleteFolder(`creatorlink/attachments/${conversation.id}`);
                console.log(`[Account Deletion] Deleted creatorlink/attachments/${conversation.id} folder`);
              } catch (error: any) {
                const errorMsg = `Failed to delete creatorlink/attachments/${conversation.id} folder: ${error.message}`;
                console.error(`[Account Deletion] ${errorMsg}`);
                cloudinaryErrors.push(errorMsg);
              }
            }
          } catch (error: any) {
            const errorMsg = `Failed to delete conversation attachment folders: ${error.message}`;
            console.error(`[Account Deletion] ${errorMsg}`);
            cloudinaryErrors.push(errorMsg);
          }

          // Delete any other creator-specific content
          try {
            await objectStorage.deleteFolder(`creator-content/${userId}`);
            console.log(`[Account Deletion] Deleted creator-content/${userId} folder`);
          } catch (error: any) {
            const errorMsg = `Failed to delete creator content folder: ${error.message}`;
            console.error(`[Account Deletion] ${errorMsg}`);
            cloudinaryErrors.push(errorMsg);
          }
        }
      }

      if (user.role === 'company') {
        const companyProfile = await storage.getCompanyProfile(userId);
        if (companyProfile) {
          // ✅ DELETE COMPANY-SPECIFIC FOLDERS BY ID

          // 1. Delete company-logos/{company_id|user_id} folder(s)
          const companyFolderIds = Array.from(new Set([
            companyProfile.id,
            companyProfile.userId
          ]));

          for (const folderId of companyFolderIds) {
            await deleteFolderWithTracking(
              `company-logos/${folderId}`,
              `company-logos/${folderId}`
            );

            // 2. Delete verification-documents/{company_id|user_id} folder(s)
            await deleteFolderWithTracking(
              `verification-documents/${folderId}`,
              `verification-documents/${folderId}`
            );
          }

          // 3. Delete creatorlink/videos/{company_profile_id} folder
          await deleteFolderWithTracking(
            `creatorlink/videos/${companyProfile.id}`,
            `creatorlink/videos/${companyProfile.id}`
          );

          // 4. Delete creatorlink/videos/thumbnails/{company_profile_id} folder
          await deleteFolderWithTracking(
            `creatorlink/videos/thumbnails/${companyProfile.id}`,
            `creatorlink/videos/thumbnails/${companyProfile.id}`
          );

          // 5. Delete creatorlink/retainer/{retainer_id} folders for all retainer contracts
          try {
            const retainerContracts = await storage.getRetainerContractsByCompany(companyProfile.id);
            console.log(`[Account Deletion] Deleting ${retainerContracts.length} retainer contract folders`);

            for (const contract of retainerContracts) {
              try {
                await objectStorage.deleteFolder(`creatorlink/retainer/${contract.id}`);
                console.log(`[Account Deletion] Deleted creatorlink/retainer/${contract.id} folder`);
              } catch (error: any) {
                const errorMsg = `Failed to delete creatorlink/retainer/${contract.id} folder: ${error.message}`;
                console.error(`[Account Deletion] ${errorMsg}`);
                cloudinaryErrors.push(errorMsg);
              }
            }
          } catch (error: any) {
            const errorMsg = `Failed to delete retainer contract folders: ${error.message}`;
            console.error(`[Account Deletion] ${errorMsg}`);
            cloudinaryErrors.push(errorMsg);
          }

          // 6. Delete creatorlink/attachments/{conversation_id} folders for all conversations
          try {
            const conversations = await storage.getConversationsByUser(userId, 'company');
            console.log(`[Account Deletion] Deleting ${conversations.length} conversation attachment folders`);

            for (const conversation of conversations) {
              try {
                await objectStorage.deleteFolder(`creatorlink/attachments/${conversation.id}`);
                console.log(`[Account Deletion] Deleted creatorlink/attachments/${conversation.id} folder`);
              } catch (error: any) {
                const errorMsg = `Failed to delete creatorlink/attachments/${conversation.id} folder: ${error.message}`;
                console.error(`[Account Deletion] ${errorMsg}`);
                cloudinaryErrors.push(errorMsg);
              }
            }
          } catch (error: any) {
            const errorMsg = `Failed to delete conversation attachment folders: ${error.message}`;
            console.error(`[Account Deletion] ${errorMsg}`);
            cloudinaryErrors.push(errorMsg);
          }
        }
      }

      // Log summary of Cloudinary deletion issues
      if (cloudinaryErrors.length > 0) {
        console.warn(`[Account Deletion] Cloudinary deletion completed with ${cloudinaryErrors.length} error(s):`);
        cloudinaryErrors.forEach((err, idx) => console.warn(`  ${idx + 1}. ${err}`));
      }
  

    // 2. Delete payment settings

    const paymentSettings = await storage.getPaymentSettings(userId);

    for (const setting of paymentSettings) {

      await storage.deletePaymentSetting(setting.id);

    }

    console.log(`[Account Deletion] Deleted ${paymentSettings.length} payment settings`);

    // 3. Delete favorites

    if (user.role === 'creator') {

      const favorites = await storage.getFavoritesByCreator(userId);

      for (const fav of favorites) {

        await storage.deleteFavorite(userId, fav.offerId);

      }

      console.log(`[Account Deletion] Deleted ${favorites.length} favorites`);

    }

    // 4. Delete notifications

    const notifications = await storage.getNotifications(userId);

    for (const notif of notifications) {

      await storage.deleteNotification(notif.id);

    }

    console.log(`[Account Deletion] Deleted ${notifications.length} notifications`);

    // 5. Send confirmation email before final deletion

    try {

      const notificationService = new NotificationService(storage);

      await notificationService.sendEmailNotification(

        user.email, // Send to original email before it's deleted

        'system_announcement' as any,

        {

          userName: user.firstName || user.username,

          announcementTitle: 'Account Deletion Confirmation',

          announcementMessage: 'Your account has been successfully deleted. All your personal data has been removed from our systems in compliance with GDPR/CCPA regulations. If you did not request this deletion, please contact support immediately.',

        }

      );

      console.log(`[Account Deletion] Confirmation email sent to ${user.email}`);

    } catch (emailError) {

      console.error('[Account Deletion] Failed to send confirmation email:', emailError);

      // Don't fail the deletion if email fails

    }

    // 6. Remove user and all related records (offers, applications, etc.) via cascading deletes
    console.log(`[Account Deletion] Deleting database records for user ${userId}`);

    await storage.deleteUser(userId);

    console.log(`[Account Deletion] User and related records deleted`);

    // 7. Logout user

    req.logout((err) => {

      if (err) {

        console.error("Logout error during account deletion:", err);

      }

    });

    console.log(`[Account Deletion] Successfully deleted account for user ${userId}`);

    const responseMessage = cloudinaryErrors.length > 0

      ? `Your account has been successfully deleted. All personal data has been removed. Note: Some file deletions encountered issues but your account data is fully deleted.`

      : `Your account has been successfully deleted. All personal data has been removed.`;

    res.json({

      success: true,

      message: responseMessage,

      warnings: cloudinaryErrors.length > 0 ? cloudinaryErrors : undefined

    });

  } catch (error: any) {

    console.error("Delete account error:", error);

    res.status(500).json({ error: error.message || "Failed to delete account" });

  }

});

  // ============================================
  // Two-Factor Authentication (2FA) Endpoints
  // ============================================

  // Get 2FA status for current user
  app.get("/api/auth/2fa/status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        enabled: user.twoFactorEnabled || false,
        hasBackupCodes: Boolean(user.twoFactorBackupCodes),
      });
    } catch (error: any) {
      console.error("[2FA] Error getting 2FA status:", error);
      res.status(500).json({ error: "Failed to get 2FA status" });
    }
  });

  // Start 2FA setup - Generate secret and QR code
  app.post("/api/auth/2fa/setup", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if 2FA is already enabled
      if (user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is already enabled" });
      }

      // Import 2FA service
      const { twoFactorService } = await import('./twoFactorAuth');

      // Generate new secret
      const secret = twoFactorService.generateSecret();

      // Store the secret temporarily (not enabled yet)
      await storage.updateUser(userId, {
        twoFactorSecret: secret,
        twoFactorEnabled: false,
      });

      // Generate QR code
      const qrCodeDataUrl = await twoFactorService.generateQRCodeDataURL(secret, user.email);

      res.json({
        secret,
        qrCode: qrCodeDataUrl,
        message: "Scan the QR code with your authenticator app, then verify with a code to enable 2FA",
      });
    } catch (error: any) {
      console.error("[2FA] Error setting up 2FA:", error);
      res.status(500).json({ error: "Failed to setup 2FA" });
    }
  });

  // Enable 2FA - Verify code and activate
  app.post("/api/auth/2fa/enable", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: "Verification code is required" });
      }

      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is already enabled" });
      }

      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: "Please start 2FA setup first" });
      }

      // Import 2FA service
      const { twoFactorService } = await import('./twoFactorAuth');

      // Validate code format
      if (!twoFactorService.isValidTOTPFormat(code)) {
        return res.status(400).json({ error: "Invalid code format. Please enter a 6-digit code" });
      }

      // Verify the code
      const isValid = twoFactorService.verifyTOTP(code, user.twoFactorSecret);

      if (!isValid) {
        return res.status(400).json({ error: "Invalid verification code. Please try again" });
      }

      // Generate backup codes
      const { plaintextCodes, hashedCodes } = await twoFactorService.generateBackupCodes(10);

      // Enable 2FA and store backup codes
      await storage.updateUser(userId, {
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
      });

      console.log(`[2FA] 2FA enabled for user ${userId}`);

      res.json({
        success: true,
        message: "Two-factor authentication has been enabled",
        backupCodes: plaintextCodes,
      });
    } catch (error: any) {
      console.error("[2FA] Error enabling 2FA:", error);
      res.status(500).json({ error: "Failed to enable 2FA" });
    }
  });

  // Disable 2FA
  app.post("/api/auth/2fa/disable", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { password, code } = req.body;

      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.twoFactorEnabled) {
        return res.status(400).json({ error: "Two-factor authentication is not enabled" });
      }

      // Require either password or 2FA code for security
      if (!password && !code) {
        return res.status(400).json({ error: "Password or 2FA code is required to disable 2FA" });
      }

      // Verify password if provided (for users with passwords)
      if (password && user.password) {
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: "Invalid password" });
        }
      } else if (code) {
        // Verify 2FA code
        const { twoFactorService } = await import('./twoFactorAuth');

        if (!user.twoFactorSecret) {
          return res.status(400).json({ error: "2FA secret not found" });
        }

        const isValid = twoFactorService.verifyTOTP(code, user.twoFactorSecret);
        if (!isValid) {
          return res.status(400).json({ error: "Invalid verification code" });
        }
      } else {
        // OAuth user without password trying to disable with password
        return res.status(400).json({ error: "Please provide your 2FA code to disable two-factor authentication" });
      }

      // Disable 2FA
      await storage.updateUser(userId, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      });

      console.log(`[2FA] 2FA disabled for user ${userId}`);

      res.json({
        success: true,
        message: "Two-factor authentication has been disabled",
      });
    } catch (error: any) {
      console.error("[2FA] Error disabling 2FA:", error);
      res.status(500).json({ error: "Failed to disable 2FA" });
    }
  });

  // Regenerate backup codes
  app.post("/api/auth/2fa/backup-codes/regenerate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: "Verification code is required" });
      }

      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ error: "Two-factor authentication is not enabled" });
      }

      // Import 2FA service
      const { twoFactorService } = await import('./twoFactorAuth');

      // Verify the code
      const isValid = twoFactorService.verifyTOTP(code, user.twoFactorSecret);

      if (!isValid) {
        return res.status(400).json({ error: "Invalid verification code" });
      }

      // Generate new backup codes
      const { plaintextCodes, hashedCodes } = await twoFactorService.generateBackupCodes(10);

      // Update backup codes
      await storage.updateUser(userId, {
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
      });

      console.log(`[2FA] Backup codes regenerated for user ${userId}`);

      res.json({
        success: true,
        message: "New backup codes have been generated",
        backupCodes: plaintextCodes,
      });
    } catch (error: any) {
      console.error("[2FA] Error regenerating backup codes:", error);
      res.status(500).json({ error: "Failed to regenerate backup codes" });
    }
  });

  // Verify 2FA code during login (second step of login)
  app.post("/api/auth/2fa/verify", async (req, res) => {
    try {
      const { userId, code, isBackupCode } = req.body;

      if (!userId || !code) {
        return res.status(400).json({ error: "User ID and code are required" });
      }

      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ error: "Two-factor authentication is not enabled for this account" });
      }

      // Import 2FA service
      const { twoFactorService } = await import('./twoFactorAuth');

      let isValid = false;

      if (isBackupCode) {
        // Verify backup code
        if (!twoFactorService.isValidBackupCodeFormat(code)) {
          return res.status(400).json({ error: "Invalid backup code format" });
        }

        const hashedCodes = user.twoFactorBackupCodes ? JSON.parse(user.twoFactorBackupCodes) : [];
        const matchedIndex = await twoFactorService.verifyBackupCode(code, hashedCodes);

        if (matchedIndex >= 0) {
          isValid = true;

          // Remove the used backup code
          const updatedCodes = twoFactorService.removeUsedBackupCode(hashedCodes, matchedIndex);
          await storage.updateUser(userId, {
            twoFactorBackupCodes: JSON.stringify(updatedCodes),
          });

          console.log(`[2FA] Backup code used for user ${userId}. Remaining codes: ${updatedCodes.length}`);
        }
      } else {
        // Verify TOTP code
        if (!twoFactorService.isValidTOTPFormat(code)) {
          return res.status(400).json({ error: "Invalid code format. Please enter a 6-digit code" });
        }

        isValid = twoFactorService.verifyTOTP(code, user.twoFactorSecret);
      }

      if (!isValid) {
        return res.status(400).json({ error: "Invalid verification code. Please try again" });
      }

      // Log the user in
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("[2FA] Session login error:", loginErr);
          return res.status(500).json({ error: "Login failed" });
        }

        console.log(`[2FA] 2FA verification successful for user ${userId}`);

        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          },
          role: user.role,
        });
      });
    } catch (error: any) {
      console.error("[2FA] Error verifying 2FA:", error);
      res.status(500).json({ error: "Failed to verify 2FA code" });
    }
  });

}