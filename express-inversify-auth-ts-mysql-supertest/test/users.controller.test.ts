import { expect } from 'chai'
import { describe, it } from 'mocha'
import { createUser } from './helpers/users_helper'

describe('users controller', () => {
  it('should create user', async () => {
    const result = await createUser({ name: 'seba', password: '1234', email: 'a@b.com' })
    expect(typeof result.id).to.equal('number')
  })

  it.skip('should throw error on invalid user params')
  it.skip('should prevent creating users with same emails')
})
