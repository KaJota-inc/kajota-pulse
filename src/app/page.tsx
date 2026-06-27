/**
 * Kajota Pulse — landing page.
 *
 * Standalone entry point that introduces Pulse and links into the
 * dashboard. Designed to be the first thing a hackathon judge sees, so
 * the elevator pitch is above the fold and the live demo is one click
 * away. Built on the shadcn/ui Card + Button primitives.
 */
import Link from 'next/link';
import { Zap } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FEATURES = [
  { title: 'Trending', body: 'Top movers by velocity, favorites, and share-clicks in the last 24 hours.' },
  { title: 'Price waterfall', body: 'Your listed price vs. category median vs. lowest competitor.' },
  { title: 'Stock alerts', body: 'Notified the moment competitor inventory in your category goes out of stock.' },
  { title: 'Margin leaderboard', body: 'Categories ranked by realised co-sell markup — find the highest-yield slots.' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-accent to-background">
      <main className="mx-auto max-w-5xl px-6 py-20 sm:py-32">
        {/* Brand row */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" fill="currentColor" strokeWidth={0} />
          </div>
          <span className="text-lg font-bold text-primary">Kajota Pulse</span>
        </div>

        {/* Hero */}
        <h1 className="mt-12 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight text-foreground sm:text-6xl">
          The Bloomberg terminal for African micro-commerce.
        </h1>
        <p className="mt-6 max-w-2xl text-xl leading-8 text-muted-foreground">
          Real-time pricing intelligence for co-sellers — trending products, price movements,
          competitor inventory, and high-margin opportunities at a glance.
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            className={cn(buttonVariants({ size: 'lg' }), 'shadow-lg shadow-primary/20')}
            href="/dashboard"
          >
            Open the dashboard →
          </Link>
          <a
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
            href="https://github.com/KaJota-inc/kajota-pulse"
            rel="noopener noreferrer"
            target="_blank"
          >
            View on GitHub
          </a>
        </div>

        {/* Feature grid */}
        <div className="mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(f => (
            <Card key={f.title}>
              <CardContent className="pt-6">
                <h3 className="text-base font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stack credit */}
        <div className="mt-20 rounded-xl bg-accent/60 p-8">
          <h3 className="text-base font-bold text-accent-foreground">Stack</h3>
          <p className="mt-2 text-sm leading-6 text-accent-foreground/80">
            Next.js 16 on Vercel · shadcn/ui + Tailwind 4 + Recharts · AWS Aurora Serverless v2
            (Postgres) via passwordless IAM-token auth · Gemini 2.5 Flash for the &ldquo;explain
            why&rdquo; analyst · MongoDB Atlas (Kajota source of truth).
          </p>
          <p className="mt-2 text-sm leading-6 text-accent-foreground/80">
            Sibling apps:{' '}
            <span className="font-semibold">Kajota Coach</span> (AI listing drafter) ·{' '}
            <span className="font-semibold">Kajota Mesh</span> (on-chain co-sell settlement).
          </p>
        </div>
      </main>
    </div>
  );
}
