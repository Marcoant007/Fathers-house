// Normalização e casamento de palavras pro tira-dúvidas — sem IA, só texto.

/** "Que horas é o Café?" → "que horas e o cafe" */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras que não ajudam a diferenciar uma pergunta da outra. */
const STOPWORDS = new Set(
  `a o as os um uma uns umas de da do das dos em na no nas nos ao aos e ou que pra pro para por com sem
   como qual quais quando onde quem tem ter tera tinha ha voce voces vc vcs eu me mim meu minha meus minhas
   seu sua seus suas nosso nossa isso esse essa este esta isto aqui la ai so mais muito ja vai vou ir
   posso pode podem gostaria queria quero saber sobre oi ola tudo bem favor por gente sim nao e eh
   faz fazer faco sao ser estar esta estou igreja sobre the`
    .split(/\s+/)
    .filter(Boolean)
);

export function tokens(normalized: string): string[] {
  return normalized.split(" ").filter(Boolean);
}

export function significantTokens(normalized: string): string[] {
  return tokens(normalized).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith("oes")) return word.slice(0, -3) + "ao";
  if (word.length > 4 && word.endsWith("es") && /[rsz]es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Distância de edição — tolera um erro de digitação ("endereso", "horaio"). */
function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Uma palavra do texto bate com a palavra-chave (plural, erro de digitação). */
export function wordMatches(word: string, keyword: string): boolean {
  if (word === keyword) return true;
  if (singular(word) === singular(keyword)) return true;
  return keyword.length >= 5 && word.length >= 5 && levenshtein(word, keyword) <= 1;
}

export type Query = { text: string; padded: string; words: string[] };

export function toQuery(input: string): Query {
  const text = normalize(input);
  return { text, padded: ` ${text} `, words: tokens(text) };
}

/** Frase com várias palavras: precisa aparecer inteira, nessa ordem. */
export function hasPhrase(query: Query, phrase: string): boolean {
  const p = normalize(phrase);
  if (!p) return false;
  if (!p.includes(" ")) return query.words.some((w) => wordMatches(w, p));
  return query.padded.includes(` ${p} `);
}

/**
 * Pontua o quanto a pergunta bate com uma lista de palavras-chave.
 * Frases valem mais que palavras soltas ("grupo familiar" > "grupo").
 */
export function scoreKeywords(query: Query, keywords: string[]): number {
  let score = 0;
  const countedWords = new Set<number>(); // "culto" e "cultos" não contam duas vezes a mesma palavra
  for (const raw of keywords) {
    const kw = normalize(raw);
    if (!kw) continue;
    if (kw.includes(" ")) {
      if (hasPhrase(query, kw)) score += kw.split(" ").length * 1.5;
      continue;
    }
    const index = query.words.findIndex((w, i) => !countedWords.has(i) && wordMatches(w, kw));
    if (index >= 0) {
      countedWords.add(index);
      score += 1;
    }
  }
  return score;
}
