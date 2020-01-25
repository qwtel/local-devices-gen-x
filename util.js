const { Socket } = require('net');

const getIPRange = require('get-ip-range');

/**
 * Similar to `Promise.race`, but returns a async generator instead of a promise,
 * that yields all values in the order that they complete.
 * 
 * NOTE: Does not deal with rejected promises, i.e. a single failure will end the race!
 * @template X
 * @param {Iterable<Promise<X>>} aIt
 * @returns {Iterable<Promise<X>>}
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
 * @param {string} address IPv4 address
 * @returns {Promise<string>} when a connection was established, error-ed, or timed out.
 */
function ping(address) {
  return new Promise(resolve => {
    const socket = new Socket();
    const close = () => { socket.destroy(); resolve(address) };
    socket.setTimeout(1000, close);
    socket.connect(80, address, close);
    socket.once('error', close);
  });
}

function ipRange(addr) {
  try { 
    return getIPRange(addr);
  } catch (err) { 
    if (process.env.DEBUG) console.warn(err); 
    return [];
  }
}

module.exports = {
  raceAll,
  ping,
  ipRange,
};
