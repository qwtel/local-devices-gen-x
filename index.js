const os = require('os');
const { Socket } = require('net');

const getIPRange = require('get-ip-range');
const { ipLookup, arpTable } = require('arp-a-x-2');

const { mapConcurrently, toHex, parseIPv4, arrayCompare } = require('./util');

/**
 * Releasing a barrage of pings into the network can wreck havoc,
 * (Specifically in my case, Broadlink devices would drop form the network / stop responding).
 * so we're limiting the number of concurrent requests.
 */
const MAX_CONCURRENT = Number(process.env.LOCAL_DEVICES_MAX_CONCURRENT) || 32;

const PING_TIMEOUT = 250;

// const MAX_TIMEOUT = 2500;

/**
 * Connect to the host at IPv4 `address`. This is solely to force an update to the ARP table.
 * Will **not** return any stats or even distinguish between online and offline hosts. Times out after 1 sec.
 * @param {string} address IPv4 address
 * @returns {Promise<string>} A promise that resolves when a connection was either established, error-ed, or timed out.
 */
function ping(address) {
  return new Promise(resolve => {
    const socket = new Socket();
    const close = () => (socket.destroy(), resolve(address));
    socket.setTimeout(PING_TIMEOUT, close);
    socket.connect(80, address, close);
    socket.once('error', close);
  });
}

/**
 * Wrapper around `get-ip-range` that ignores exceptions. Set `DEBUG` environment variable to log errors.
 * Some of the CIDRs returned from `os.networkInterfaces()` can't be parsed by this library, but we don't care.
 * @param {string} addr 
 * @returns {string[]}
 * @see https://www.npmjs.com/package/get-ip-range
 */
function ipRange(addr) {
  try {
    return getIPRange(addr);
  } catch (err) {
    if (process.env.DEBUG) console.warn(err);
    return [];
  }
}

/** 
 * Returns the address CIDR of each network interface with an IPv4 address.
 */
function* getAllNetworks() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses) {
      if (address.family === 'IPv4' && !address.internal) {
        yield address.cidr;
      }
    }
  }
}

const makeIPSet = (cidr, ...cidrs) => new Set(
  ipRange(cidr).concat(...cidrs.map(ipRange)),
);

const makeIPSetWithDefault = (cidr, ...cidrs) => cidr != null
  ? makeIPSet(cidr, ...cidrs)
  : makeIPSet(...getAllNetworks());

async function* scan(ipSet) {
  for await (const host of mapConcurrently(ipSet, MAX_CONCURRENT, ping)) {
    for (const device of await ipLookup(host) || []) {
      if (ipSet.has(device.ip)) yield device;
    }
  }
}

/**
 * Pings all IPv4 addresses within a range and yields their ARP table entries from the async generator as soon as the corresponding ping arrives.
 * @param {string} address An IPv4 range in either CIDR notation, a hyphenated IP range, or two IP addresses.
 * @returns {Iterable<Promise<Device>>} An async generator of ARP table entries
 * @see https://www.npmjs.com/package/get-ip-range
 */
function findLocalDevices(address, ...addresses) {
  const ipSet = makeIPSetWithDefault(address, ...addresses);
  return scan(ipSet);
}

/**
 * Looks for the device with the provided MAC address within a range of IP addresses and returns it's ARP table entry, if present.
 * Will check the cached ARP table first. If the MAC address is missing, will ping all IP addresses within the specified range and try again.
 * @param {string} macOrIP The MAC address of the device as hex string (case-insensitive), or the IPv4 of the device.
 * @param {string} address An IPv4 range in either CIDR notation, a hyphenated IP range, or two IP addresses.
 * @returns {Promise<Device | undefined>} The ARP entry for the MAC within the given `address` range, undefined otherwise.
 * @see https://www.npmjs.com/package/get-ip-range
 */
async function findLocalDevice(macOrIP, address, ...addresses) {
  const ipSet = makeIPSetWithDefault(address, ...addresses);

  const macHex = toHex(macOrIP);

  const table = await arpTable();
  for (const device of table.filter(({ ip }) => ipSet.has(ip))) {
    if (toHex(device.mac) === macHex || device.ip === macOrIP) return device;
  }

  for await (const device of scan(ipSet)) {
    if (toHex(device.mac) === macHex || device.ip === macOrIP) return device;
  }
}

/**
 * Pings all IPv4 addresses within a range and returns their ARP table entries as an array once all pings have either finished or timed out.
 * @param {string} address An IPv4 range in either CIDR notation, a hyphenated IP range, or two IP addresses. Omit to scan entire network.
 * @returns {Promise<Array<Device>>} All ARP table entries as an array and sorted by IP address
 * @see https://www.npmjs.com/package/get-ip-range
 */
async function getLocalDeviceList(address, ...addresses) {
  const ipSet = makeIPSetWithDefault(address, ...addresses);

  for await (const _ of mapConcurrently(ipSet, MAX_CONCURRENT, ping)) {}

  return (await arpTable())
    .filter(({ ip }) => ipSet.has(ip))
    .sort((a, b) => arrayCompare(parseIPv4(a.ip), parseIPv4(b.ip)));
}

/** 
 * @typedef {{ ip: string, mac: string, flag?: string, iface?: string, ifname?: string }} Device
 * JSON representation of a device on the local network.
 * It's actually just a ARP table entry.
 * IP and MAC are always present, the rest depends on the platform.
 */

// Pings all devices in the provides IP set within 1 second.
// Each ping has a random delay to avoid sending them all at once.
// const pingAll = (ipSet) => [...ipSet].map(async (ip) => {
//   await timeout(Math.random() * MAX_TIMEOUT);
//   return ping(ip);
// });

module.exports = {
  findLocalDevices,
  findLocalDevice,
  getLocalDeviceList,
};
