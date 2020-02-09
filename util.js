const { promisify } = require('util');

const timeout = promisify(setTimeout);

/**
 * Similar to `Promise.race`, but returns a async generator instead of a promise,
 * that yields all values in the order that they complete.
 * 
 * NOTE: Does not deal with rejected promises, i.e. a single failure will end the race!
 * @template X
 * @param {Iterable<Promise<X>>} aIt
 * @returns {AsyncGenerator<X>}
 */
async function* raceAll(aIt) {
  const promises = new Map([...aIt].map(async (p, i) => [i, await p]).entries());
  for (const _ of promises) {
    const [i, value] = await Promise.race(promises.values());
    promises.delete(i);
    yield value;
  }
};

/**
 * Applies async function `f` to every element in `xs` with no more than `n` pending concurrently.
 * You can think of this as a concurrent task queue, where every task is of the form `(x: X) => Promise<Y>`.
 * @template X
 * @template Y
 * @param {Iterable<X>} xs 
 * @param {number} n 
 * @param {(x: X) => Promise<Y>} f 
 * @returns {AsyncGenerator<Y>}
 */
async function* mapConcurrently(xs, n, f) {
  const it = xs[Symbol.iterator]();
  const batch = takeFromIter(it, n);

  /** @param {number} i @returns {(y: Y) => [number, Y]} */
  const index = i => y => [i, y];

  const promises = new Map(batch.map((x, i) => f(x).then(index(i))).entries());
  while (promises.size > 0) {
    const [i, value] = await Promise.race(promises.values());
    promises.delete(i);
    yield value;

    const { done, value: x } = it.next();
    if (!done) promises.set(i, f(x).then(index(i)));
  }
};

/** 
 * Remove special chars from MAC addresses for safer comparison 
 * @param {string} mac A hex MAC address like `e3:f6:04:73:6c:30`
 * @returns {string} The MAC address in all lowercase and without special characters.
 */
const toHex = mac => mac.toLowerCase().replace(/[^0-9a-f]/g, '');

/**
 * @param {string} ip 
 * @returns {[number, number, number, number]}
 */
const parseIPv4 = (ip) => ip.split('.').map(Number);

/**
 * @param {number[]} as 
 * @param {number[]} bs 
 * @return {number}
 */
function arrayCompare(as, bs) {
  const res = Math.sign(as[0] - bs[0]);
  if (res === 0 && as.length > 1) return arrayCompare(as.slice(1), bs.slice(1));
  return res;
}

/**
 * Take the first `n` elements from an iterator. Moves the iterator forward by `n` steps.
 * @template X
 * @param {Iterator<X>} it 
 * @param {number} n 
 * @returns {X[]}
 */
function takeFromIter(it, n) {
  let res = [];
  let itRes;
  while (n-- > 0 && !(itRes = it.next()).done) {
    res.push(itRes.value);
  }
  return res;
}

module.exports = {
  timeout,
  raceAll,
  mapConcurrently,
  toHex,
  parseIPv4,
  arrayCompare,
};
