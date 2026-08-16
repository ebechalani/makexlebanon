import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLesson, lessons } from '@/lib/lessons';
import { LessonPlayer } from '@/components/LessonPlayer';
import { PageHero } from '@/components/PageHero';
import { Container } from '@/components/ui';

type Params = { params: Promise<{ lesson: string }> };

export function generateStaticParams() {
  return lessons.map((lesson) => ({ lesson: lesson.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lesson: slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) return {};
  return {
    title: `${lesson.title} — interactive course`,
    description: lesson.intro,
  };
}

export default async function InteractiveLessonPage({ params }: Params) {
  const { lesson: slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();

  return (
    <>
      <PageHero
        eyebrow={`Interactive course · ${lesson.ageRange}`}
        title={lesson.title}
        lead={lesson.intro}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Training', href: '/training' },
          { label: lesson.title },
        ]}
      />
      <div className="bg-slate-50 py-12 sm:py-16">
        <Container>
          <LessonPlayer lesson={lesson} />
        </Container>
      </div>
    </>
  );
}
