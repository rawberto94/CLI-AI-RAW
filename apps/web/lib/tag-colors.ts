/**
 * Deterministic color generation for tags.
 * Assigns each tag a consistent color based on its name.
 */

const TAG_PALETTE = [
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', hex: '#8B5CF6' },
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', hex: '#3B82F6' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', hex: '#10B981' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', hex: '#F59E0B' },
  { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', hex: '#F43F5E' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', hex: '#06B6D4' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200', hex: '#D946EF' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', hex: '#F97316' },
  { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', hex: '#14B8A6' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', hex: '#6366F1' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', hex: '#EC4899' },
  { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200', hex: '#84CC16' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getTagColor(tag: string) {
  const index = hashString(tag.toLowerCase().trim()) % TAG_PALETTE.length;
  return TAG_PALETTE[index];
}

export function getTagStyle(tag: string) {
  const color = getTagColor(tag);
  return `${color.bg} ${color.text} ${color.border}`;
}
