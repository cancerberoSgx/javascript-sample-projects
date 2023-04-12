import { describe, it } from 'mocha';
import { expect } from 'chai';
import * as request from 'supertest';
import { Response } from 'supertest';
import app from '../src/app';
import { NotFoundErrorName } from '../src/errors';

describe('basic', () => {

  it('/health should works', async () => {
    const response: Response = await request(app)
      .get('/health')
      .expect(200)
      expect(response.body).to.deep.equal({ healthy: true, db: true })
  });

  it('404 should works', async () => {
    const response: Response = await request(app)
      .get('/notExistent')
      .expect(404)
      expect(response.body.error).to.equal(NotFoundErrorName)
  });
});
