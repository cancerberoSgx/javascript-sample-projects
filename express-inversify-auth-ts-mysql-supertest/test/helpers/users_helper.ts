import * as request from 'supertest'
import { Response } from 'supertest'
import app from '../../src/app'
import { CreateUserInput, CreateUserResult } from '../../src/modules/users/usersTypes'
import { expect } from 'chai'
import { faker } from '@faker-js/faker'
import { unique } from './misc_helper'

export async function createUser(user: Partial<CreateUserInput> = {}, expectedStatus = 200): Promise<CreateUserResult & CreateUserInput> {
  const baseUser: CreateUserInput = {
    name: faker.name.firstName(),
    password: faker.internet.password(),
    email: `${unique()}_${faker.internet.email()}`,
  }
  const finalUser = { ...baseUser, ...user }
  const response: Response = await request(app).post('/users').send(finalUser)
  expect(response.status).to.equal(expectedStatus)
  return { ...finalUser, id: response.body.id }
}
