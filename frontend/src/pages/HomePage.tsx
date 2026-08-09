import { PublicLayout } from '@/layouts/PublicLayout';
import {
  HeroSection,
  TrustedBySection,
  FeaturesSection,
  PhilosophySection,
  HowItWorksSection,
  TestimonialsSection,
  FAQSection,
  CTASection,
} from '@/components/landing';

export function HomePage() {
  return (
    <PublicLayout>
      <HeroSection />
      <TrustedBySection />
      <FeaturesSection />
      <PhilosophySection />
      <HowItWorksSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
    </PublicLayout>
  );
}
