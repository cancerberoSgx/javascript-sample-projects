import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { notSameNotFalsy } from 'misc-utils-of-mine-generic';
import { Movie } from '../types';

export function loadMovies(){
  return JSON.parse(readFileSync('static/movies.json').toString()) as Movie[]
}

export async function extractMetadata() {
  const movies = loadMovies();
  let g: any[] = [];
  movies.forEach(movie => {
    g.push(...movie.genres || []);
  });
  g = g.filter(notSameNotFalsy);
  mkdirSync('src/common', {recursive: true})
  writeFileSync('src/common/metadata.ts', `
// auto generated by src/db-creation/extractMetadata.ts
export const moviesGenres = ${JSON.stringify(g, null, 2)}
  `.trim());
}
extractMetadata();
