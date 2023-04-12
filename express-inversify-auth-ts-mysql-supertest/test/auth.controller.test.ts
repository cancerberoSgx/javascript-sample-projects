import { describe, it } from 'mocha'
import { expect } from 'chai'
import * as request from 'supertest'
import { Response } from 'supertest'
import app from '../src/app'
import { createUser } from './helpers/users_helper'
import { typeOfProps } from './helpers/misc_helper'

describe('auth controller', () => {
  it('should login', async () => {
    const result = await createUser()
    const response: Response = await request(app).post('/auth/login').send({ email: result.email, password: result.password }).expect(200)
    expect(typeOfProps(response.body)).to.deep.equal({
      id: 'number',
      name: 'string',
      email: 'string',
      token: 'string',
    })
  })

  it.skip('should throw error on login invalid params')
})
