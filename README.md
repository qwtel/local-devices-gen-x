# local-devices-gen-x

**Local** **Devices** **Gen**erator Cross (**X**) Platform

Finds all devices in a local network by pinging all IPv4 addresses within a range and then reading from the ARP cache.

Uses a native `arp -a` implementation on platforms that support it (see [`arp-a-x-2`](https://github.com/qwtel/arp-a-x-2)).

It is very similar to [`local-devices`](https://github.com/DylanPiercey/local-devices), and compares as follows:

* Smaller code footprint
* Returns results slightly faster in a typical case, and
* when using the async generator, results stream in instantly.
* Response times are stable (`local-devices` can sometimes take up to one minute, at least on macOS)
* Allows specifying IP ranges via CIDR notation
* Does not provide hostnames
* No global lock
* Less/no configuration options
* No test suite

## Usage

```js
const { findLocalDevices, getLocalDeviceList, findLocalDevice } = require('local-devices-gen-x');

(async () => {
  try {
    // Get devices as soon as they are discovered within the '192.168.1.*' range.
    for await (const entry of findLocalDevices('192.168.1.1/24')) {
      console.log(entry)
    }

    // Returns all devices within the '192.168.1.*' range as an array once the scan is complete.
    console.log(await getLocalDeviceList('192.168.1.1/24'))

    // Search for a device with a MAC address in the '192.168.1.*' range.
    // This can either resolve quickly if the device is already cached in the ARP table,
    // or take a bit longer until it is found by pinging the entire range.
    console.log(await findLocalDevice('xx:xx:xx:xx:xx:xx', '192.168.1.1/24'))
  } catch (e) { console.error(e) }
})();
```

## Config
This library will ping every possible IP (V4) within the provided range to update the ARP table. 
By default no more than 32 requests are in flight at any given point.
To change this number, set `process.env.LOCAL_DEVICES_MAX_CONCURRENT` to the desired number of concurrent requests.