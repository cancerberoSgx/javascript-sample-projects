import { mkdirSync, readFileSync } from 'fs';
import { MoviesData, Movie } from '../types';

export function loadMovies(){
  return JSON.parse(readFileSync('static/movies.json').toString()) as Movie[]
}
