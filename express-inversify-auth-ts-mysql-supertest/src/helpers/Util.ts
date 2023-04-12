import * as moment from 'moment'
import { toArray } from 'lodash'

// Format for dates to be stored into database
export const dbDateFormat: string = 'YYYY-MM-DD HH:mm:ss'

// Convert the given date to UTC in order to be stored in a TIMESTAMP field
export function dateToDb(dt?: moment.MomentInput): any {
  if (dt) return moment(dt).utc().format(dbDateFormat)
  return dt
}

export function nowToDb(): string {
  return dateToDb(moment())
}

export function nanoToMilli(nano: bigint): number {
  return Math.round(Number(nano / BigInt(1e6)))
}

/**
 * Utility to print a ready to execute query to debug when use perform:
 * `await query('select foo from bar where userId=?', [userId])`
 * Supports strings, numbers lists and dates
 */
export function printSQLQuery(sql: string, params: any[] = []): string {
  let counter = 0
  return sql.replace(/(\?)/g, (txt, key) => {
    return escapeSqlValue(params[counter++])
  })
}

export function escapeSqlValue(value: any): string {
  if (typeof value === 'string') {
    return `${quote(value, '"')}`
  } else if (value instanceof Date) {
    return dateToDb(value)
  } else if (Array.isArray(value)) {
    return value.map(escapeSqlValue).join(',')
  } else {
    return `${value}`
  }
}

/**
 * Wrap string with given quote character and escape it in the string. Useful to quote strings to be printed as json, sql values, etc.
 */
export function quote(s: string, quote: string = '"'): string {
  return quote + s.replace(new RegExp(quote, 'g'), '\\' + quote) + quote
}

/**
 * Returns next desiredDay of week in a fixed time. Example:
 * nextWeekDay(new Date('2022-05-24T09:12:12'), 0) will give next sunday, this is
 * 2022-05-29T23:59:59
 */
export function nextWeekDay(from: Date, desiredDay: number) {
  // const dayINeed = 4; // for Thursday
  const today = moment(from).isoWeekday()
  let result: moment.Moment
  // if we haven't yet passed the day of the week that I need:
  if (today <= desiredDay) {
    // then just give me this week's instance of that day
    result = moment(from).isoWeekday(desiredDay)
  } else {
    // otherwise, give me *next week's* instance of that same day
    result = moment(from).add(1, 'weeks').isoWeekday(desiredDay)
  }
  result.set('hour', 23)
  result.set('minute', 59)
  result.set('seconds', 59)
  result.set('milliseconds', 10)
  return result
}

/** Returns given string length counting emojis correctly. */
export function stringLength(value: any) {
  return toArray(value).length
}

/**
 * Returns enum key strings for enums like `{a=1, b=2}`
 */
export function enumKeys(anEnum: any): string[] {
  return Object.keys(anEnum)
    .map(i => anEnum[i as any])
    .filter((s, i, a) => typeof s === 'string' && a.indexOf(s) === i)
}
