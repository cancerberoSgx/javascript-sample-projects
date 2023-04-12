import { scrypt, randomBytes, timingSafeEqual } from 'crypto'
import * as jwt from 'jsonwebtoken'

// Source: https://dev.to/farnabaz/hash-your-passwords-with-scrypt-using-nodejs-crypto-module-316k#comment-24a9e
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
  return jwt.sign({ id: id, email: email }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  })
}

// export function validateUser(req, res, next) {
//   // try {
//     let token = null;
//     const authHeader = req.headers.authorization;
//     if (authHeader && authHeader.startsWith("Bearer")) {
//       token = authHeader.slice(7);
//     } else {
//       throw new Error("Unauthorized user");
//     }
//     req.userId = decodeUser(token);
//     next();
//   // } catch (error) {
//   //   res.status(401).json({ error: error.message });
//   // }
// };

// function decodeUser(token: string) {
//   const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
//   return typeof decodedToken === 'string' ? decodedToken : decodedToken.id;
// }
