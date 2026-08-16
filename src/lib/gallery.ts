import fs from 'node:fs';
import path from 'node:path';

const GALLERY_ROOT = path.join(process.cwd(), 'public', 'gallery');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

export type GalleryImage = {
  /** Public URL, e.g. /gallery/2026/football/final-01.jpg */
  src: string;
  /** Derived from the filename, used as alt text. */
  alt: string;
};

function isImage(fileName: string) {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

/**
 * Filenames that carry no meaning of their own — camera dumps and the
 * sequential names used by the migration script.
 */
const GENERIC_NAME = /^(photo|img|image|dsc|dscf|p|pxl|screenshot|whatsapp)?[\s_-]*\d+$/i;

/**
 * Alt text for one image.
 *
 * A descriptive filename is used as-is ("final-round-winners.jpg" -> "Final
 * round winners"). A generic one falls back to the caller's context so screen
 * readers hear "Challenger, MakeX Lebanon 2024 — photo 3" rather than
 * "Photo 03".
 */
function toAlt(fileName: string, context: string | undefined, index: number) {
  const base = path.basename(fileName, path.extname(fileName));

  if (context && GENERIC_NAME.test(base)) {
    return `${context} — photo ${index + 1}`;
  }

  const words = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function readDirSafe(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    // Directory does not exist yet — that is a normal, empty gallery.
    return [];
  }
}

/**
 * Optional per-folder alt text: a captions.json mapping filename -> description.
 * Hand-edit it to describe individual photos (winner names, rounds, schools).
 */
function readCaptions(dir: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(path.join(dir, 'captions.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    // No captions file, or it is malformed — fall back to generated alt text.
    return {};
  }
}

/**
 * Photos for one category of one season.
 * Reads public/gallery/<year>/<category>/
 *
 * `context` is used to build alt text for images whose filenames say nothing,
 * e.g. "Challenger, MakeX Lebanon 2024".
 */
export function getCategoryImages(
  year: string | number,
  categorySlug: string,
  context?: string,
): GalleryImage[] {
  const dir = path.join(GALLERY_ROOT, String(year), categorySlug);
  const captions = readCaptions(dir);

  return readDirSafe(dir)
    .filter(isImage)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((file, i) => ({
      src: `/gallery/${year}/${categorySlug}/${encodeURIComponent(file)}`,
      alt: captions[file]?.trim() || toAlt(file, context, i),
    }));
}

/**
 * A division within a category — e.g. "Schools · ages 4–5".
 * Represented on disk as a subfolder with a group.json describing it.
 */
export type GalleryGroup = {
  slug: string;
  label: string;
  order: number;
  images: GalleryImage[];
};

function readGroupMeta(dir: string): { label?: string; order?: number } {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'group.json'), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Division sub-galleries for a category, or [] when the category stores its
 * images flat (the 2024/2025 archives, which have no divisions).
 */
export function getCategoryGroups(
  year: string | number,
  categorySlug: string,
  context?: string,
): GalleryGroup[] {
  const base = path.join(GALLERY_ROOT, String(year), categorySlug);

  const subdirs = readDirSafe(base).filter((entry) => {
    try {
      return fs.statSync(path.join(base, entry)).isDirectory();
    } catch {
      return false;
    }
  });

  return subdirs
    .map((slug) => {
      const meta = readGroupMeta(path.join(base, slug));
      const label = meta.label ?? slug.replace(/-/g, ' ');
      return {
        slug,
        label,
        order: meta.order ?? 999,
        images: getCategoryImages(year, `${categorySlug}/${slug}`, context ? `${label}, ${context}` : label),
      };
    })
    .filter((group) => group.images.length > 0)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/** Total images in a category, counting division subfolders. */
export function countCategoryImages(year: string | number, categorySlug: string): number {
  const dir = path.join(GALLERY_ROOT, String(year), categorySlug);
  const entries = readDirSafe(dir);

  const flat = entries.filter(isImage).length;
  const nested = entries.reduce((sum, entry) => {
    const full = path.join(dir, entry);
    try {
      if (!fs.statSync(full).isDirectory()) return sum;
    } catch {
      return sum;
    }
    return sum + readDirSafe(full).filter(isImage).length;
  }, 0);

  return flat + nested;
}

/** Every season year that has at least one photo folder on disk. */
export function getGalleryYears(): string[] {
  return readDirSafe(GALLERY_ROOT)
    .filter((entry) => {
      const full = path.join(GALLERY_ROOT, entry);
      try {
        return fs.statSync(full).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}
