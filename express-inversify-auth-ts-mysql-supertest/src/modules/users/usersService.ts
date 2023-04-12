import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { hash } from '../auth/authUtil';
import { UsersStorage } from './usersStorage';

@injectable()
export class UsersService {
  constructor(
    @inject('UsersStorage') private usersStorage: UsersStorage,
  ) {}
  async createUser(arg: { name: string; email: string; password: string; }) {
    const password = await hash(arg.password);
    const id = await this.usersStorage.createUser({name: arg.name, email: arg.email, password});
    return {id}
  }
  login(arg: { email: string; password: string; }) {

  }
}
