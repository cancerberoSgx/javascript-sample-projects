import { describe, it } from 'mocha';
import { expect } from 'chai';
import * as request from 'supertest';
import { Response } from 'supertest';
import app from '../src/app';

describe('health controller', () => {

  it('works', async () => {
    const response: Response = await request(app)
      .get('/health')
      .expect(200)
      expect(response.body).to.deep.equal({ healthy: true, db: true })
  });
});
