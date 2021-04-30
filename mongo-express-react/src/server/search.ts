import { celebrate, Joi, Segments } from 'celebrate';
import { Movie, SearchResult } from '../types';
import { collection } from './db';
import { moviesGenres } from '../common/metadata';
import { Express } from 'express'
import { printMs } from 'misc-utils-of-mine-generic';

export function installSearch(app: Express) {
  app.get('/v1/search',
    celebrate({
      [Segments.QUERY]: {
        skip: Joi.number().optional(),
        limit: Joi.number().optional(),
        genres: Joi.string().optional().empty().allow(null).allow(''),
        query: Joi.string().optional().empty().allow(null).allow(''),
      },
    }),
    async (req, res, next) => {
      try {
        const t0=Date.now()

        const skip = parseInt(req.query.skip + '');
        const limit = parseInt(req.query.limit + '');
        const genres = (req.query.genres ? (req.query.genres + '') : '').split(',').map(s => s.trim()).filter(s => s);
        if (genres.find(g => !moviesGenres.includes(g))) {
          return next(new Error('Invalid genres ' + genres.join(', ')));
        }
        const movies = await collection<Movie>('movies');
        const query = {};
        console.log(genres);
        if (genres.length) {
          Object.assign(query, { genres: { $not: { $elemMatch: { $nin: genres } } } });
        }
        const options = { limit, skip };
        const result: SearchResult = {  
          skip,
          limit,
          total: await movies.count(query),
          results: await movies.find(query, options).toArray()
        };
        console.log(printMs(Date.now()-t0))

        res.json(result);
      }
      catch (error) {
        next(error);
      }
    }
  );
}
