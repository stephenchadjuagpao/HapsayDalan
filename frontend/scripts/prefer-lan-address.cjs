// CRA's network URL uses the first IPv4 interface. Tailscale can appear first
// on Windows, causing CRA to hide the Wi-Fi URL even while it is reachable.
const os = require("os");
const address = require("address");

const originalIp = address.ip;

address.ip = function preferredLanIp(interfaceName) {
  if (interfaceName) return originalIp.call(this, interfaceName);

  const lanAddress = Object.values(os.networkInterfaces())
    .flat()
    .find((item) => item && item.family === "IPv4" && !item.internal &&
      /^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.)/.test(item.address));

  return lanAddress ? lanAddress.address : originalIp.call(this);
};

// Show the Funnel and cloud addresses alongside CRA's local URLs.
const publicSiteUrl = process.env.PUBLIC_SITE_URL;
const cloudSiteUrl = process.env.CLOUD_SITE_URL || "https://hapsaydalan.onrender.com/";
if (publicSiteUrl || cloudSiteUrl) {
  const originalLog = console.log;
  console.log = function logWithPublicSite(...args) {
    originalLog.apply(this, args);
    if (typeof args[0] === "string" && args[0].includes("On Your Network:")) {
      if (publicSiteUrl) originalLog.call(this, `  Public Website:   ${publicSiteUrl}`);
      if (cloudSiteUrl) originalLog.call(this, `  Cloud Website:    ${cloudSiteUrl}`);
    }
  };
}
