// Turkish-aware helpers. "Şarkı", "sarki" and "ŞARKI" must all find each other,
// and lists must sort ç after c, ı before i, ö after o and so on.

export function fold(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}

const collator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true });

export function sortBy<T>(items: T[], key: (item: T) => string): T[] {
  return items.sort((a, b) => collator.compare(key(a), key(b)));
}

// Escapes LIKE wildcards so a search for "100%" is literal.
export function likePattern(query: string): string {
  return `%${fold(query).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
