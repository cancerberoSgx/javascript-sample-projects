import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import * as jwt from 'jsonwebtoken'
import * as config from 'config'

export async function hash(password): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex')
    scrypt(password, salt, 32, (err, derivedKey) => {
      if (err) reject(err)
      resolve(`${salt}.${derivedKey.toString('hex')}`)
    })
  })
}

export async function compare(password, hash): Promise<void> {
  return new Promise((resolve, reject) => {
    const [salt, hashKey] = hash.split('.')
    const hashKeyBuff = Buffer.from(hashKey, 'hex')
    scrypt(password, salt, 32, (err, derivedKey) => {
      if (err) reject(err)
      const match = timingSafeEqual(hashKeyBuff, derivedKey)
      if (match) resolve()
      else reject(new Error('Invalid credentials'))
    })
  })
}

export function signToken(id, email) {
  return jwt.sign({ id: id, email: email }, config.get('auth.jwtSecret'), {
    expiresIn: '1h',
  })
}
