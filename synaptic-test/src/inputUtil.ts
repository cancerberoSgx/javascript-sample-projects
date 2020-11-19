import {dec2bin, bin2dec} from './baseConverter'
import {array} from 'misc-utils-of-mine-generic'

export function number2input_straight(a: number, length: number) {
  const bin = dec2bin(a)
  if(bin.length>length) {
    throw new Error('Number greater than length')
  }
  return [...array(length-bin.length).map(i=>0), ...bin]
}

export function isPrime(num: number) {
  for(let i = 2, s = Math.sqrt(num); i <= s; i++)
      if(num % i === 0) return false
  return num !== 1
}

const digitLength = dec2bin(9).length
export function number2Input_digitByDigit(a: number) {
  return `${a}`.split('').map(i=>parseInt(i, 10)).map(i=>number2input_straight(i, digitLength)).flat()  
}
export function input2number_digitByDigit(input: number[]) {
  const digits = []
  let acc = []
  input.map((n, i)=>{
    acc.push(i)
    if(i % digitLength-1===0) {
    }
  })
}
