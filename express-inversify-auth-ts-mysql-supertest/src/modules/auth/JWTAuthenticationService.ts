import 'reflect-metadata';
import { injectable } from 'inversify';
import { IAuthenticationService } from './IAuthenticationService';
import * as  jwt from 'jsonwebtoken'

/**
 * jsonwebtoken based auth
 */
@injectable()
export class JWTAuthenticationService implements IAuthenticationService {

  async getUserFromAccessToken(accessToken: string): Promise<string> {
    const decodedToken = jwt.verify(accessToken, process.env.JWT_SECRET);
    return (decodedToken as any).id;
    
    // let result: AuthenticationResult = await this.validateToken(accessToken);

    // if (result.isValid) {
    //   return result.tokenPayload.sub; // sub is recommended over username (it's not re-usable)
    // } else throw new AuthenticationError(result.errorMsg);
    // return 'TODO'
  }

  // /**
  //  * Extract the user information from access token.
  //  * @param accessToken
  //  * @param apiKey
  //  */
  // public async validateToken(token: string): Promise<any> {
    // let keys: KeyType[] = await this.publicKeys.get();

    // // Get the kid (key id)
    // let tokenHeader: TokenHeader = CognitoAuthenticationService.parseJWTHeader(token);
    // let key_id = tokenHeader.kid;

    // // search for the kid key id in the Cognito Keys
    // const key = keys.find(key => key.kid === key_id);
    // if (key === undefined) {
    //   return {
    //     isValid: false,
    //     errorMsg: "Token's public key not found in Cognito jwks.json",
    //   };
    // }

    // // verify JWT Signature
    // let keyObj = KEYUTIL.getKey(key);
    // let isValid: boolean = KJUR.jws.JWS.verifyJWT(token, keyObj, {
    //   alg: ['RS256'],
    // });

    // if (!isValid) {
    //   return {
    //     isValid: false,
    //     errorMsg: 'Token signature verification failed',
    //   };
    // }

    // // verify token has not expired
    // let tokenPayload: TokenPayload = CognitoAuthenticationService.parseJWTPayload(token);
    // if (Date.now() >= tokenPayload.exp * 1000) {
    //   return { isValid: false, errorMsg: 'Token expired' };
    // }

    // // verify app_client_id
    // let isAValidClient: boolean = cognitoAppClientIds.some(clientId => {
    //   const strcmp: number = tokenPayload.client_id.localeCompare(clientId);
    //   return strcmp === 0;
    // });

    // if (!isAValidClient) {
    //   return {
    //     isValid: false,
    //     errorMsg: 'Token was not issued for this audience',
    //   };
    // }

    // return { isValid: true, errorMsg: '', tokenPayload: tokenPayload };
  // }

  // // Convert Payload from Base64-URL to JSON
  // private static decodePayload(payload: string): any {
  //   const cleanedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
  //   const decodedPayload = atob(cleanedPayload);

  //   // @ts-ignore
  //   const uriEncodedPayload: string = Array.from(decodedPayload).reduce(
  //     (acc, char: string): string => {
  //       const uriEncodedChar = ('00' + char.charCodeAt(0).toString(16)).slice(-2);
  //       return `${acc}%${uriEncodedChar}`;
  //     },
  //     ''
  //   );

  //   const jsonPayload = decodeURIComponent(uriEncodedPayload);

  //   return JSON.parse(jsonPayload);
  // }

  // // Parse JWT Payload
  // private static parseJWTPayload(token: string): TokenPayload {
  //   const [, payload] = token.split('.');
  //   const jsonPayload: TokenPayload = CognitoAuthenticationService.decodePayload(payload);

  //   return jsonPayload;
  // }

  // // Parse JWT Header
  // private static parseJWTHeader(token: string): TokenHeader {
  //   const [header, ,] = token.split('.');
  //   const jsonHeader: TokenHeader = CognitoAuthenticationService.decodePayload(header);

  //   return jsonHeader;
  // }
}
