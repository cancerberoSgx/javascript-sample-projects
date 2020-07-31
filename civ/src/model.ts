import { unique } from "misc-utils-of-mine-generic";
let model;
export class Base {
  id: string;
  constructor() {
    this.id = unique();
  }
}
enum Product {
  food = 'food',
  gold = 'gold',
  production = 'production'
}
interface Produce {
  product: Product;
  amount: number;
}
/** everything is a unit, tiles, cities, resources */
export class Unit {
  produce: Produce[] = [];
  canBuild: boolean = false;
  canMove: boolean = false;
  canAttack: boolean = false;
}
