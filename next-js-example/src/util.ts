export async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

export async function asyncMap(array, callback) {
  const result = []
  await asyncForEach(array, async (item, i, a) => {
    result.push(await callback(item, i, a))
  });
  return result
}

export function asArray(a) {
  return Array.isArray(a) ? a : [a]
}

export function array(n, sample) {
  const a = []
  for (let i = 0; i < n; i++) {
    a.push(typeof sample === 'undefined' ? i : sample)
  }
  return a
}
