import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src="/logo.png" alt="AffiliateXchange Logo" className="h-8 w-8 rounded-md object-cover" />
              <span className="text-xl font-bold">AffiliateXchange</span>
            </a>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">
              Last Updated: November 23, 2025
            </p>
          </div>

          <Card>
            <CardContent className="p-6 sm:p-8 space-y-8 prose prose-slate dark:prose-invert max-w-none">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p>
                  Welcome to AffiliateXchange ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our marketplace platform.
                </p>
                <p>
                  This policy applies to all information collected through our website, mobile application, and any related services (collectively, the "Services"). By using our Services, you agree to the collection and use of information in accordance with this policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>

                <h3 className="text-xl font-semibold mb-3">2.1 Personal Information You Provide</h3>
                <p>We collect personal information that you voluntarily provide when you:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Register for an account (username, email, password, name)</li>
                  <li>Complete your profile (company name, social media links, audience demographics)</li>
                  <li>Set up payment information (bank details, PayPal email, tax information)</li>
                  <li>Communicate with us (support requests, messages with other users)</li>
                  <li>Apply for affiliate offers or retainer contracts</li>
                  <li>Upload content (videos, images, promotional materials)</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-6">2.2 Automatically Collected Information</h3>
                <p>When you use our Services, we automatically collect:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
                  <li><strong>Usage Data:</strong> Pages visited, time spent, click patterns, search queries</li>
                  <li><strong>Tracking Data:</strong> Affiliate link clicks, conversions, commission earnings</li>
                  <li><strong>Location Data:</strong> General geographic location based on IP address</li>
                  <li><strong>Cookies and Similar Technologies:</strong> Session cookies, preference cookies, analytics cookies</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-6">2.3 Information from Third Parties</h3>
                <p>We may receive information from:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Payment processors (Stripe, PayPal)</li>
                  <li>Social media platforms (when you connect your accounts)</li>
                  <li>Analytics providers (Google Analytics)</li>
                  <li>Verification services (identity and business verification)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                <p>We use your personal information for the following purposes:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Service Delivery:</strong> To provide, maintain, and improve our marketplace services</li>
                  <li><strong>Account Management:</strong> To create and manage your account, authenticate users</li>
                  <li><strong>Transactions:</strong> To process payments, track commissions, and facilitate payouts</li>
                  <li><strong>Communication:</strong> To send notifications, updates, and respond to inquiries</li>
                  <li><strong>Analytics:</strong> To track affiliate performance, clicks, conversions, and earnings</li>
                  <li><strong>Matching:</strong> To connect creators with relevant brand opportunities</li>
                  <li><strong>Security:</strong> To detect and prevent fraud, abuse, and security incidents</li>
                  <li><strong>Legal Compliance:</strong> To comply with legal obligations and protect our rights</li>
                  <li><strong>Marketing:</strong> To send promotional materials (with your consent)</li>
                  <li><strong>Improvement:</strong> To analyze usage patterns and improve our Services</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Legal Basis for Processing (GDPR)</h2>
                <p>For users in the European Economic Area (EEA), United Kingdom, and Switzerland, we process your personal information based on:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Contract Performance:</strong> Processing necessary to fulfill our agreement with you</li>
                  <li><strong>Legitimate Interests:</strong> Our business interests in providing and improving services</li>
                  <li><strong>Legal Obligations:</strong> Compliance with tax, financial, and other legal requirements</li>
                  <li><strong>Consent:</strong> Where you have given explicit consent (e.g., marketing communications)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Information Sharing and Disclosure</h2>

                <h3 className="text-xl font-semibold mb-3">5.1 With Other Users</h3>
                <p>We share information to facilitate marketplace transactions:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Profile information visible to brands and creators</li>
                  <li>Application details when you apply for offers</li>
                  <li>Messages sent through our platform</li>
                  <li>Performance metrics related to specific campaigns</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-6">5.2 With Service Providers</h3>
                <p>We share information with trusted third parties who assist us in operating our platform:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Payment Processors:</strong> Stripe (card payments, ACH), PayPal (PayPal payouts), Interac (Canadian e-transfers)</li>
                  <li><strong>Cloud Infrastructure:</strong> Google Cloud Platform (database hosting, file storage, compute resources)</li>
                  <li><strong>Email Services:</strong> SendGrid (transactional emails, notifications, password resets)</li>
                  <li><strong>Analytics & Monitoring:</strong> Google Analytics (usage patterns), Sentry (error tracking)</li>
                  <li><strong>Content Delivery:</strong> Cloudinary (image/video hosting and optimization)</li>
                  <li><strong>Authentication:</strong> Google OAuth (social login)</li>
                  <li><strong>Communication:</strong> WebSocket services (real-time messaging)</li>
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">
                  All service providers are contractually bound to protect your data and use it only for the purposes we specify. We conduct due diligence on all providers before sharing data.
                </p>

                <h3 className="text-xl font-semibold mb-3 mt-6">5.3 For Legal Reasons</h3>
                <p>We may disclose information when required:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>To comply with legal obligations, court orders, or government requests</li>
                  <li>To protect our rights, property, or safety</li>
                  <li>To prevent fraud or security issues</li>
                  <li>In connection with a business transfer or acquisition</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-6">5.4 With Your Consent</h3>
                <p>We may share information with other parties when you provide explicit consent.</p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Your Privacy Rights</h2>

                <h3 className="text-xl font-semibold mb-3">6.1 GDPR Rights (EEA, UK, Swiss Users)</h3>
                <p>If you are located in the EEA, UK, or Switzerland, you have the following rights:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Right to Access:</strong> Request a copy of your personal data</li>
                  <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data</li>
                  <li><strong>Right to Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
                  <li><strong>Right to Restriction:</strong> Limit how we use your data</li>
                  <li><strong>Right to Data Portability:</strong> Receive your data in a machine-readable format</li>
                  <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
                  <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
                  <li><strong>Right to Lodge a Complaint:</strong> File a complaint with your local data protection authority</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-6">6.2 CCPA Rights (California Residents)</h3>
                <p>If you are a California resident, you have the following rights under the California Consumer Privacy Act (CCPA):</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Right to Know:</strong> Request disclosure of personal information we collect, use, and share</li>
                  <li><strong>Right to Delete:</strong> Request deletion of your personal information</li>
                  <li><strong>Right to Opt-Out:</strong> Opt-out of the "sale" of personal information (Note: We do not sell personal information)</li>
                  <li><strong>Right to Non-Discrimination:</strong> Equal service and pricing regardless of privacy choices</li>
                </ul>

                <h3 className="text-xl font-semibold mb-3 mt-6">6.3 How to Exercise Your Rights</h3>
                <p>To exercise any of these rights, please contact us at:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Email: privacy@affiliatexchange.com</li>
                  <li>Privacy Settings: Available in your account settings</li>
                </ul>
                <p className="mt-4">
                  We will respond to your request within 30 days (GDPR) or 45 days (CCPA). We may need to verify your identity before processing your request.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
                <p>We retain your personal information for specific periods based on the type of data:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Information:</strong> Retained while your account is active plus 90 days after deletion</li>
                  <li><strong>Financial Records:</strong> 7 years from the date of transaction (required by tax laws)</li>
                  <li><strong>Payment Information:</strong> Stored by payment processors (Stripe, PayPal) according to their policies; we retain transaction records for 7 years</li>
                  <li><strong>Communication Records:</strong> Messages and support tickets retained for 3 years</li>
                  <li><strong>Analytics Data:</strong> Aggregated data retained indefinitely; individual tracking data for 2 years</li>
                  <li><strong>Marketing Data:</strong> Until you unsubscribe or request deletion</li>
                  <li><strong>Legal/Compliance Data:</strong> As required by law or to defend legal claims</li>
                </ul>
                <p className="mt-4">
                  When you delete your account, we will delete or anonymize your personal information within 90 days, except where we are required to retain it for legal, tax, or security purposes. Financial records will be retained for 7 years as required by law. You may request early deletion of certain data by contacting privacy@affiliatexchange.com.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers</h2>
                <p>
                  Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place, including:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Standard Contractual Clauses approved by the European Commission</li>
                  <li>Adequacy decisions for certain countries</li>
                  <li>Privacy Shield certification (where applicable)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Data Security</h2>
                <p>We implement comprehensive security measures to protect your information:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Encryption:</strong> TLS 1.3 for data in transit; AES-256 encryption for data at rest</li>
                  <li><strong>Authentication:</strong> Bcrypt password hashing; optional two-factor authentication (2FA)</li>
                  <li><strong>Infrastructure:</strong> Hosted on Google Cloud Platform with enterprise-grade security</li>
                  <li><strong>Access Controls:</strong> Role-based access; least privilege principle for employee access</li>
                  <li><strong>Monitoring:</strong> 24/7 system monitoring; automated threat detection</li>
                  <li><strong>Audits:</strong> Annual third-party security audits; quarterly penetration testing</li>
                  <li><strong>Compliance:</strong> SOC 2 Type II (in progress); PCI DSS compliant payment processing</li>
                  <li><strong>Incident Response:</strong> Dedicated security team; breach notification within 72 hours</li>
                  <li><strong>Employee Training:</strong> Mandatory annual security training; background checks</li>
                </ul>
                <p className="mt-4">
                  However, no method of transmission over the Internet is 100% secure. While we strive to use commercially acceptable means to protect your personal information, we cannot guarantee absolute security. If you discover a security vulnerability, please report it to security@affiliatexchange.com.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Cookies and Tracking Technologies</h2>
                <p>We use cookies and similar technologies to enhance your experience:</p>

                <h3 className="text-lg font-semibold mb-3 mt-4">Types of Cookies We Use:</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Essential Cookies:</strong> Session authentication, security tokens, CSRF protection (cannot be disabled)</li>
                  <li><strong>Functional Cookies:</strong> Remember your language, theme preferences, dashboard settings (expires: 1 year)</li>
                  <li><strong>Analytics Cookies:</strong> Google Analytics for usage patterns, page views, user flows (expires: 2 years)</li>
                  <li><strong>Affiliate Tracking:</strong> Track clicks and conversions on affiliate links (expires: 30 days or upon conversion)</li>
                  <li><strong>Advertising (Optional):</strong> Retargeting cookies for marketing campaigns (only with consent)</li>
                </ul>

                <h3 className="text-lg font-semibold mb-3 mt-4">Cookie Management:</h3>
                <p>You can control cookies through:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Cookie Consent Banner:</strong> Displayed on first visit; customize your preferences</li>
                  <li><strong>Account Settings:</strong> Manage cookie preferences in your account dashboard</li>
                  <li><strong>Browser Settings:</strong> Most browsers allow you to refuse or delete cookies</li>
                  <li><strong>Opt-Out Tools:</strong> Google Analytics Opt-out Browser Add-on, NAI Opt-out Tool</li>
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">
                  Note: Disabling essential cookies will prevent you from logging in and using our Services. Disabling affiliate tracking cookies may prevent accurate commission attribution.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Third-Party Links</h2>
                <p>
                  Our Services may contain links to third-party websites and services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Children's Privacy</h2>
                <p>
                  Our Services are not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal information, please contact us immediately.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Changes to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Posting the new policy on this page</li>
                  <li>Updating the "Last Updated" date</li>
                  <li>Sending an email notification (for significant changes)</li>
                </ul>
                <p className="mt-4">
                  Your continued use of our Services after changes become effective constitutes acceptance of the revised policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">14. Contact Us</h2>
                <p>If you have questions or concerns about this Privacy Policy, please contact us:</p>
                <div className="mt-4 space-y-2">
                  <p><strong>Company Name:</strong> AffiliateXchange Inc.</p>
                  <p><strong>Email:</strong> privacy@affiliatexchange.com</p>
                  <p><strong>Support:</strong> support@affiliatexchange.com</p>
                  <p><strong>Mailing Address:</strong> 123 Commerce Street, Suite 400, San Francisco, CA 94102, United States</p>
                </div>
                <p className="mt-4">
                  <strong>Data Protection Officer (EU):</strong> dpo@affiliatexchange.com
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  We typically respond to privacy inquiries within 48 hours during business days (Monday-Friday, 9:00 AM - 5:00 PM PST).
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">15. Additional Information for Specific Jurisdictions</h2>

                <h3 className="text-xl font-semibold mb-3">15.1 California Privacy Rights</h3>
                <p>
                  California Civil Code Section 1798.83 permits California residents to request information about disclosure of personal information to third parties for direct marketing purposes. We do not share personal information with third parties for their direct marketing purposes.
                </p>

                <h3 className="text-xl font-semibold mb-3 mt-6">15.2 Nevada Privacy Rights</h3>
                <p>
                  Nevada residents have the right to opt-out of the sale of personal information. We do not sell personal information as defined under Nevada law.
                </p>

                <h3 className="text-xl font-semibold mb-3 mt-6">15.3 Canada (PIPEDA)</h3>
                <p>
                  Canadian residents have rights under the Personal Information Protection and Electronic Documents Act (PIPEDA), including the right to access and correct personal information.
                </p>

                <h3 className="text-xl font-semibold mb-3 mt-6">15.4 Australia (Privacy Act)</h3>
                <p>
                  Australian residents have rights under the Privacy Act 1988, including the right to access and correct personal information held by us.
                </p>
              </section>

              <div className="mt-12 pt-8 border-t">
                <p className="text-sm text-muted-foreground text-center">
                  By using AffiliateXchange, you acknowledge that you have read and understood this Privacy Policy.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="AffiliateXchange Logo" className="h-8 w-8 rounded-md object-cover" />
              <span className="font-bold">AffiliateXchange</span>
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy-policy">
                <a className="text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
              </Link>
              <Link href="/terms-of-service">
                <a className="text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </a>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 AffiliateXchange. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
