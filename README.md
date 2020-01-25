# local-devices-gen-x

**Local** **Devices** **Gen**erator Cross (**X**) Platform

Finds all devices in a local network by pinging all IPv4 addresses within a range and then reading from the ARP cache.

Uses a native `arp -a` implementation on platforms that support it (see [`arp-a-x-2`](https://github.com/qwtel/arp-a-x-2)).

It is very similar to [`local-devices`](https://github.com/DylanPiercey/local-devices), and compares as follows:

Favorable
* Smaller code footprint
* Returns results slightly faster in a typical case, and
* when using the async generator, results stream in instantly.
* Response times are stable (`local-devices` can sometimes take up to one minute, at least on macOS)
* Allows specifying IP ranges via CIDR notation

Unfavorable
* Does not provide hostnames
* No global lock
* Less/no configuration options
* No test suite

## Usage

```js
const { findLocalDevices, getLocalDeviceList, findLocalDevice } = require('local-devices-gen-x');

(async () => {
  try {
    // Get devices as soon as they are discovered.
    for await (const entry of findLocalDevices('192.168.1.1/24')) {
      console.log(entry)
    }

    // Returns all devices as an array once the scan is complete (~1 second)
    console.log(await getLocalDeviceList('192.168.1.1/24'))

    // Search for a device with a MAC address. 
    // This can either resolve quickly if the device is already cached in the ARP table,
    // or take a bit longer until it is found by pinging the entire range.
    console.log(await findLocalDevice('xx:xx:xx:xx:xx:xx', '192.168.1.1/24'))
  } catch (e) { console.error(e) }
})();
```
