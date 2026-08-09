import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Flag,
  BookOpenCheck,
  GraduationCap,
  Lightbulb,
  Users,
  Target,
  HeartPulse,
  ArrowRight,
  Sparkles,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Pillar {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  href: string;
}

const pillars: Pillar[] = [
  {
    key: 'missions',
    icon: Flag,
    gradient: 'from-blue-500 to-cyan-500',
    href: '/dashboard/tasks',
  },
  {
    key: 'revisionCentre',
    icon: BookOpenCheck,
    gradient: 'from-amber-500 to-orange-500',
    href: '/dashboard/programmes',
  },
  {
    key: 'competencyTesting',
    icon: GraduationCap,
    gradient: 'from-violet-500 to-purple-500',
    href: '/dashboard/exam-centre',
  },
  {
    key: 'programmes',
    icon: Lightbulb,
    gradient: 'from-rose-500 to-pink-500',
    href: '/dashboard/programmes',
  },
  {
    key: 'factions',
    icon: Users,
    gradient: 'from-green-500 to-emerald-500',
    href: '/dashboard/factions',
  },
];

export function PhilosophySection() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section ref={sectionRef} className="py-20 lg:py-28 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-emerald-50/40 dark:via-emerald-950/10 to-background" />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-gradient-to-br from-emerald-400/15 to-teal-400/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1.15, 1, 1.15], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/4 -right-32 w-[600px] h-[600px] bg-gradient-to-br from-amber-400/10 to-orange-400/10 rounded-full blur-3xl"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="container mx-auto px-8 sm:px-12 lg:px-16 xl:px-24">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-4"
              whileHover={{ scale: 1.05 }}
            >
              <Sparkles className="w-4 h-4" />
              {t('philosophy.badge')}
            </motion.span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              {t('philosophy.title')}{' '}
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                {t('philosophy.titleHighlight')}
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t('philosophy.description')}
            </p>
          </motion.div>
        </div>

        {/* Pillars grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className={cn(
                'group relative bg-card rounded-2xl border border-border/60 p-6 overflow-hidden',
                'hover:shadow-xl hover:border-border transition-all duration-300',
                index === 4 && 'lg:col-span-1 lg:col-start-2'
              )}
            >
              {/* Hover gradient wash */}
              <motion.div
                className={`absolute inset-0 bg-gradient-to-br ${pillar.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-300`}
              />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center shadow-md`}
                  >
                    <pillar.icon className="w-6 h-6 text-white" />
                  </div>
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, delay: index * 0.5 }}
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </motion.div>
                </div>
                <h3 className="text-lg font-semibold mb-2">{t(`philosophy.pillars.${pillar.key}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {t(`philosophy.pillars.${pillar.key}.description`)}
                </p>
                <Link
                  to={pillar.href}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 group-hover:gap-2.5 transition-all"
                >
                  {t('philosophy.learnMore')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Goal + health band */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-12 grid md:grid-cols-2 gap-6"
        >
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md">
                <Target className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-semibold">{t('philosophy.goalTitle')}</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">{t('philosophy.goal')}</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-semibold">{t('philosophy.healthTitle')}</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">{t('philosophy.health')}</p>
          </div>
        </motion.div>

        {/* F2W note + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            {t('philosophy.freeToWin')}
          </div>
          <div>
            <Button
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 h-12 px-8 text-base"
              asChild
            >
              <Link to={isAuthenticated ? '/dashboard' : '/welcome'}>
                {t('philosophy.start')}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
