import { expect } from 'chai';
import * as faker from 'faker/locale/en';
import * as moment from 'moment';
import * as ngeohash from 'ngeohash';
import { Location } from '../../src/app/model/Profile';

export function array<T = number>(n: number, sample?: T): T[] {
  const a: (T | number)[] = [];
  for (let i = 0; i < n; i++) {
    a.push(typeof sample === 'undefined' ? i : sample);
  }
  return a as T[];
}

export function printMs(
  ms: number,
  config: {
    minutes?: boolean;
    seconds?: boolean;
    ms?: boolean;
  } = { minutes: false, seconds: true, ms: true }
) {
  config = { ...{ minutes: false, seconds: true, ms: true }, ...config };
  const seconds = config.seconds && Math.floor(ms / 1000);
  const minutes =
    config.minutes && seconds && (config.ms ? Math.floor(seconds / 60) : Math.round(seconds / 60));
  const milliseconds = config.ms && Math.floor(ms % 1000 || ms);
  return `${minutes ? `${minutes} minutes ` : ''}${seconds ? `${seconds} seconds ` : ''}${
    milliseconds ? `${milliseconds} ms ` : ''
  }`.trim();
}

export const average = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

/** returns the value in given percentile, for example, for median percentile=0.5, for pct90 percentile=0.9, etc */
export const percentile = (arr: number[], percentile: number) => {
  const mid = Math.floor(arr.length * percentile);
  const numbers = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
};

export const median = (arr: number[]) => {
  return percentile(arr, 0.5);
};

export const percentile90 = (arr: number[]) => {
  return percentile(arr, 0.9);
};

let _unique: number = 0;
export function unique(prefix: string = '_'): string {
  return prefix + _unique++;
}

export function secondsAgo(seconds: number): Date {
  return moment(new Date()).subtract(seconds, 'seconds').toDate();
}

export function minutesAgo(minutes: number): Date {
  return moment(new Date()).subtract(minutes, 'minutes').toDate();
}

export function hoursAgo(hours: number): Date {
  return moment(new Date()).subtract(hours, 'hours').toDate();
}

export function daysAgo(days: number): Date {
  return moment(new Date()).subtract(days, 'days').toDate();
}

export function yearsAgo(years: number): Date {
  return daysAgo(365 * years);
}

export function getAge(birthDate: Date) {
  return moment
    .duration({
      years: moment(Date.now()).diff(birthDate, 'years', false),
    })
    .asYears();
}

export function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function encodeLocation(location: Location | string) {
  return typeof location === 'string'
    ? location
    : ngeohash.encode(location.latitude, location.longitude);
}

export function decodeLocation(location: Location | string): Location {
  return typeof location !== 'string' ? location : ngeohash.decode(location);
}

export function sqlPointToLocation(point: { x: number; y: number }): Location {
  return { latitude: point.y, longitude: point.x };
}

export function randomLocation(): Location {
  // Latitude and longitude are in decimal degrees format and range from -90 to 90 for latitude and -180 to 180 for longitude.
  // We add a padding to avoid maths
  return {
    latitude: faker.datatype.number({ min: 90, max: 45 }), // -90 to 90
    longitude: faker.datatype.number({ min: 90, max: 90 }), // -180 to 180
  };
}

export function removeWhites(s: string, replaceWith = ' ') {
  return s.replace(/\s+/gm, replaceWith).trim();
}

export function expectToContainAll(source: string, included: string[]) {
  included.forEach(s => {
    expect(source).to.contain(s, `Expected source to include ${s}`);
  });
}

/** iterates serially */
export async function asyncForEach(array: any[], callback: any) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

/** applies a map() serially */
export async function asyncMap<T, R = any>(
  array: T[],
  callback: (t: T, i: number, a: T[]) => Promise<R>
) {
  const result: R[] = [];
  await asyncForEach(array, async (item: any, i: number, a: any[]) => {
    result.push(await callback(item, i, a));
  });
  return result;
}

export function milesToMeters(miles: number) {
  return miles * 1609.34;
}

/** maps an object to its values type(of) - useful to just make sure property type in expects */
export function typeOfProps(o: any) {
  const r = {};
  Object.keys(o).forEach(k => {
    r[k] = typeof o[k];
  });
  return r;
}
