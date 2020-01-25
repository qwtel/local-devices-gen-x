const os = require('os');

const { ipLookup, macLookup, arpTable } = require('arp-a-x-2');

const { raceAll, ping, ipRange } = require('./util');

/** 
 * JSON representation of a device on the local network.
 * It's actually just a ARP table entry.
 * IP and MAC are always present, the rest depends on the platform.
 * @typedef {{ ip: string, mac: string, flag?: string, iface?: string, ifname?: string }} Device
 */

function* getAllAddressCIDRs() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses) {
      if (address.family === 'IPv4' && !address.internal) {
        yield address.cidr;
      }
    }
  }
}

const makeIPSet = (addr, ...addrs) => new Set(ipRange(addr).concat(...addrs.map(ipRange)));

const makeIPSetWithDefault = (addr, ...addrs) => addr != null
  ? makeIPSet(addr, ...addrs)
  : makeIPSet(...getAllAddressCIDRs());

async function* scan(ipSet) {
  const pings = [...ipSet].map(ping);
  for await (const host of raceAll(pings)) {
    for (const device of await ipLookup(host) || []) {
      if (ipSet.has(device.ip)) yield device;
    }
  }
}

/**
 * Pings all IPv4 addresses within a range and yields their ARP table entries from the async generator as soon as the corresponding ping arrives.
 * @param {string} address An IPv4 range in either CIDR notation, a hyphenated IP range, or two IP addresses.
 * @returns {Iterable<Promise<Device>>} 
 *  An async generator of ARP table entries
 * @see https://www.npmjs.com/package/get-ip-range
 */
function findLocalDevices(address, ...addresses) {
  const ipSet = makeIPSetWithDefault(address, ...addresses);
  return scan(ipSet);
}

/**
 * Looks for the device with the provided MAC address within a range of IP addresses and returns it's ARP table entry, if present.
 * Will check the cached ARP table first. If the MAC address is missing, will ping all IP addresses within the specified range and try again.
 * @param {string} mac The MAC address of the device as hex string (case-insensitive).
 * @param {string} address An IPv4 range in either CIDR notation, a hyphenated IP range, or two IP addresses.
 * @returns {Promise<Device | undefined>} The ARP entry for the MAC within the given `address` range, undefined otherwise.
 * @see https://www.npmjs.com/package/get-ip-range
 */
async function findLocalDevice(mac, address, ...addresses) {
  const ipSet = makeIPSetWithDefault(address, ...addresses);

  const entries = await macLookup(mac) || [];
  const device = entries.find(({ ip }) => ipSet.has(ip));
  if (device) return device;

  for await (const device of scan(ipSet)) {
    if (device.mac.toLowerCase() === mac.toLowerCase()) return device;
  }
}

/**
 * Pings all IPv4 addresses within a range and returns their ARP table entries as an array once all pings have either finished or timed out.
 * @param {string} address An IPv4 range in either CIDR notation, a hyphenated IP range, or two IP addresses. Omit to scan entire network.
 * @returns {Promise<Array<Device>>} All ARP table entries as an array
 * @see https://www.npmjs.com/package/get-ip-range
 */
async function getLocalDeviceList(address, ...addresses) {
  const ipSet = makeIPSetWithDefault(address, ...addresses);

  await Promise.all([...ipSet].map(ping));

  const table = await arpTable();
  return table.filter(({ ip }) => ipSet.has(ip))
}

module.exports = {
  findLocalDevices,
  findLocalDevice,
  getLocalDeviceList,
};
