export function formatDisplayName(name: string | null | undefined): string {
  if (!name) return 'Apple User';
  if (name.includes('@privaterelay.appleid.com')) return 'Apple User';
  if (name.includes('@') && !name.includes(' ')) return name.split('@')[0] || 'User';
  return name;
}
