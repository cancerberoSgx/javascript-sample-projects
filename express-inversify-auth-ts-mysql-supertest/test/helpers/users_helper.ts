import * as request from 'supertest';
import { Response } from 'supertest';
import app from '../../src/app';
import { expect } from 'chai';

export interface UserInput {
  name: string
  email: string
  password: string
}
export async function createUser(user: UserInput, expectedStatus=200): Promise<{id: number}> {
  const response: Response = await request(app)
  .post('/users')
  .send(user)
  expect(response.status).to.equal(expectedStatus)
  return {id: 123}
}