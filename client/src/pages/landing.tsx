import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { TrendingUp, Users, DollarSign, Shield, Zap, Target, Star, CheckCircle2 } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useEffect, useRef, useState } from "react";

function useScrollAnimation(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

function FeaturesSection() {
  const { ref: headerRef, isVisible: headerVisible } = useScrollAnimation();
  const features = [
    { icon: Zap, title: "Instant Approvals", description: "Get approved in minutes, not days. Start promoting offers within 7 minutes of applying." },
    { icon: DollarSign, title: "High Commissions", description: "Earn competitive rates with multiple commission structures: per-sale, retainers, and hybrid models." },
    { icon: Target, title: "Smart Matching", description: "Find offers tailored to your niche and audience with advanced filtering and recommendations." },
    { icon: Users, title: "Direct Communication", description: "Chat directly with brands through our built-in messaging system. No middlemen." },
    { icon: TrendingUp, title: "Real-Time Analytics", description: "Track clicks, conversions, and earnings with comprehensive analytics dashboards." },
    { icon: Shield, title: "Verified Brands", description: "Work with confidence. All companies are manually verified to ensure legitimacy." },
  ];

  return (
    <section className="py-20 bg-card/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          ref={headerRef}
          className={`text-center space-y-4 mb-16 transition-all duration-700 ${
            headerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <h2 className="text-3xl sm:text-4xl font-bold">Why Choose AffiliateXchange?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to monetize your audience and grow your income
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, index }: { feature: { icon: any; title: string; description: string }; index: number }) {
  const { ref, isVisible } = useScrollAnimation(0.1);
  const Icon = feature.icon;

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <Card className="border-card-border h-full">
        <CardContent className="p-6 space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-semibold">{feature.title}</h3>
          <p className="text-muted-foreground">{feature.description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();

  const handleLogin = () => {
    setLocation("/login");
  };

  const handleRegister = () => {
    setLocation("/register");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AffiliateXchange Logo" className="h-8 w-8 rounded-md object-cover" />
            <span className="text-xl font-bold">AffiliateXchange</span>
          </div>
          <Button onClick={handleLogin} data-testid="button-login">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                Turn Your Influence Into{" "}
                <span className="text-primary">Income</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-xl">
                The ultimate marketplace connecting creators with top brands. Discover exclusive affiliate opportunities, earn real commissions, and grow your creator business.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={handleRegister} data-testid="button-get-started" className="text-base">
                  Get Started
                </Button>
                <Button size="lg" variant="outline" onClick={handleLogin} data-testid="button-list-brand" className="text-base">
                  Sign In
                </Button>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-8 border-t">
                <div>
                  <div className="text-3xl font-bold text-primary">10K+</div>
                  <div className="text-sm text-muted-foreground">Active Creators</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">$5M+</div>
                  <div className="text-sm text-muted-foreground">Earned</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">500+</div>
                  <div className="text-sm text-muted-foreground">Brands</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <img 
                src="/affiliate.png" 
                alt="Affiliate marketing illustration" 
                className="w-full h-auto object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <FeaturesSection />

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">How It Works</h2>
            <p className="text-xl text-muted-foreground">Get started in three simple steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold">Browse Offers</h3>
              <p className="text-muted-foreground">
                Explore thousands of affiliate opportunities from verified brands in your niche.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold">Apply & Get Approved</h3>
              <p className="text-muted-foreground">
                Submit a quick application and get approved automatically within 7 minutes.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold">Promote & Earn</h3>
              <p className="text-muted-foreground">
                Share your unique tracking link and earn commissions on every conversion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">Trusted by Creators</h2>
            <p className="text-xl text-muted-foreground">See what our community has to say</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-card-border">
                <CardContent className="p-6 space-y-4">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-muted-foreground">
                    "AffiliateXchange has completely transformed how I monetize my content. The approval process is instant and the commissions are fantastic!"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <div className="h-10 w-10 rounded-full bg-primary/10" />
                    <div>
                      <div className="font-semibold">Creator Name</div>
                      <div className="text-sm text-muted-foreground">Content Creator</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to Start Earning?</h2>
          <p className="text-xl text-muted-foreground">
            Join thousands of creators already making money with AffiliateXchange
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" onClick={handleLogin} data-testid="button-join-now" className="text-base">
              Get Started Free
            </Button>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-8 pt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Instant approvals</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Free to join</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
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