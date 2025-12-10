import * as React from "react";
import { Link } from "wouter";
import { Button } from "./ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "./ui/carousel";
import {
  DollarSign,
  BarChart3,
  Handshake,
  Wallet,
  Briefcase,
  ArrowRight,
} from "lucide-react";

interface PerkSlide {
  id: number;
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  icon: React.ElementType;
  gradient: string;
  accentColor: string;
}

const perks: PerkSlide[] = [
  {
    id: 1,
    title: "Earn Competitive Commissions",
    description:
      "Partner with top brands and earn generous commissions on every successful referral. Your influence, your income.",
    ctaText: "Browse Offers",
    ctaLink: "/browse",
    icon: DollarSign,
    gradient: "from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30",
    accentColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: 2,
    title: "Real-Time Analytics",
    description:
      "Track clicks, conversions, and earnings with our powerful analytics dashboard. Know exactly how your content performs.",
    ctaText: "View Analytics",
    ctaLink: "/analytics",
    icon: BarChart3,
    gradient: "from-blue-50 via-indigo-50 to-violet-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-violet-950/30",
    accentColor: "text-blue-600 dark:text-blue-400",
  },
  {
    id: 3,
    title: "Connect with Premium Brands",
    description:
      "Access exclusive partnerships with industry-leading brands that align with your audience and content style.",
    ctaText: "Explore Brands",
    ctaLink: "/browse",
    icon: Handshake,
    gradient: "from-purple-50 via-pink-50 to-rose-50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-rose-950/30",
    accentColor: "text-purple-600 dark:text-purple-400",
  },
  {
    id: 4,
    title: "Secure & Reliable Payments",
    description:
      "Get paid on time, every time. Multiple payout options with transparent tracking and secure transactions.",
    ctaText: "Payment Settings",
    ctaLink: "/creator/payment-settings",
    icon: Wallet,
    gradient: "from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-yellow-950/30",
    accentColor: "text-amber-600 dark:text-amber-400",
  },
  {
    id: 5,
    title: "Build Your Creator Portfolio",
    description:
      "Showcase your work, grow your reputation, and unlock better opportunities as you build your affiliate career.",
    ctaText: "Update Profile",
    ctaLink: "/settings",
    icon: Briefcase,
    gradient: "from-rose-50 via-fuchsia-50 to-purple-50 dark:from-rose-950/30 dark:via-fuchsia-950/30 dark:to-purple-950/30",
    accentColor: "text-rose-600 dark:text-rose-400",
  },
];

export function WelcomeCarousel() {
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  // Auto-play functionality
  React.useEffect(() => {
    if (!api) {
      return;
    }

    const autoplayInterval = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
      }
    }, 6000);

    return () => clearInterval(autoplayInterval);
  }, [api]);

  return (
    <div className="w-full">
      <Carousel
        setApi={setApi}
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent>
          {perks.map((perk) => {
            const Icon = perk.icon;
            return (
              <CarouselItem key={perk.id}>
                <div
                  className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${perk.gradient} border border-border/50`}
                >
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-40 h-40 opacity-20">
                    <svg
                      viewBox="0 0 200 200"
                      className="w-full h-full"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="150" cy="50" r="80" fill="currentColor" className={perk.accentColor} opacity="0.3" />
                      <circle cx="180" cy="100" r="40" fill="currentColor" className={perk.accentColor} opacity="0.2" />
                      <circle cx="120" cy="120" r="30" fill="currentColor" className={perk.accentColor} opacity="0.15" />
                    </svg>
                  </div>
                  <div className="absolute bottom-0 left-0 w-20 h-20 opacity-10">
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full h-full"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M0,50 Q25,0 50,50 T100,50"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="2"
                        className={perk.accentColor}
                      />
                      <path
                        d="M0,70 Q25,20 50,70 T100,70"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="2"
                        className={perk.accentColor}
                      />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="relative z-10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Icon */}
                    <div className={`h-10 w-10 rounded-xl bg-white dark:bg-gray-800 shadow-md flex items-center justify-center shrink-0`}>
                      <Icon className={`h-5 w-5 ${perk.accentColor}`} />
                    </div>

                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {perk.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl">
                        {perk.description}
                      </p>
                    </div>

                    {/* CTA Button */}
                    <Link href={perk.ctaLink}>
                      <Button
                        size="sm"
                        className="shrink-0 gap-1.5 text-xs bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900"
                      >
                        {perk.ctaText}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>

                  {/* Decorative floating shapes on the right */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-2 opacity-60">
                    <div className={`w-5 h-5 rounded-lg ${perk.accentColor} bg-current opacity-20 rotate-12`} />
                    <div className={`w-4 h-4 rounded-full ${perk.accentColor} bg-current opacity-15 -rotate-6`} />
                    <div className={`w-3 h-3 rounded-md ${perk.accentColor} bg-current opacity-25 rotate-45`} />
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        {/* Navigation dots */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: count }).map((_, index) => (
            <button
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === current
                  ? "w-6 bg-primary"
                  : "w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
              }`}
              onClick={() => api?.scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </Carousel>
    </div>
  );
}
