import axios from 'axios'
import { serial, array } from 'misc-utils-of-mine-generic';
import { writeFileSync, mkdirSync } from 'fs';
import { MoviesData, Movie } from '../types';

export async function downloadMovies() {
  const url = `https://yt` + `s.mx/api/v2/list_` + `movies.json`
  // TODO: another for series // https:// ez tv.i o/api/
  const response = await axios.get<MoviesData>(`${url}?page=1&limit=1`)
  const pages = Math.trunc(response.data.data.movie_count / 50)
  const movies: Movie[] = []
  await serial(array(pages).map(page => async () => {
    const response = await axios.get<MoviesData>(`${url}?page=${page}&limit=50`)
    movies.push(...response.data.data.movies)
    console.log(`Movies: ${movies.length}`)
    mkdirSync('static', { recursive: true })
    writeFileSync('static/movies.json', JSON.stringify(movies, null, 2))
  }))
}

downloadMovies()
