import { Button, Container } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="bg-ink-950 text-white">
      <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-300">404</p>
        <h1 className="mt-4 text-3xl sm:text-4xl">Page not found</h1>
        <p className="mt-4 max-w-md text-white/60 text-pretty">
          The page you are looking for does not exist, or has moved since the site was rebuilt.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button href="/">Back to home</Button>
          <Button href="/competitions/national" variant="ghost">
            Browse competitions
          </Button>
        </div>
      </Container>
    </div>
  );
}
