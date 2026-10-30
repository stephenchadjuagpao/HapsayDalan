const fs = require("fs");
const path = require("path");
const os = require("os");
const { X509Certificate, createPrivateKey } = require("crypto");
const { execFileSync, spawn } = require("child_process");

process.chdir(path.resolve(__dirname, ".."));
process.env.NODE_ENV = "development";
require("react-scripts/config/env");

const certFile = path.resolve(process.env.SSL_CRT_FILE || ".certs/localhost.pem");
const keyFile = path.resolve(process.env.SSL_KEY_FILE || ".certs/localhost-key.pem");

function currentAddresses() {
  return [...new Set(Object.values(os.networkInterfaces()).flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254."))
    .map((item) => item.address))].sort();
}

function certificateCovers(addresses) {
  try {
    const cert = new X509Certificate(fs.readFileSync(certFile));
    return Boolean(cert.checkHost("localhost")) &&
      ["127.0.0.1", "::1", ...addresses].every((ip) => cert.checkIP(ip)) &&
      Date.parse(cert.validFrom) <= Date.now() &&
      Date.parse(cert.validTo) > Date.now() + 7 * 86400000 &&
      cert.checkPrivateKey(createPrivateKey(fs.readFileSync(keyFile)));
  } catch {
    return false;
  }
}

function prepareHttps() {
  const addresses = currentAddresses();
  if (!certificateCovers(addresses)) {
    const bundled = path.resolve(".certs", process.platform === "win32" ? "mkcert.exe" : "mkcert");
    const mkcert = process.env.MKCERT_PATH || (fs.existsSync(bundled) ? bundled : "mkcert");
    fs.mkdirSync(path.dirname(certFile), { recursive: true });
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });
    try {
      execFileSync(mkcert, ["-cert-file", certFile, "-key-file", keyFile,
        "localhost", "127.0.0.1", "::1", ...addresses], { stdio: "inherit", windowsHide: true });
    } catch {
      throw new Error("Could not prepare local HTTPS. Install mkcert, run mkcert -install once, then restart npm start. You can set MKCERT_PATH to its executable.");
    }
  }
  process.env.SSL_CRT_FILE = certFile;
  process.env.SSL_KEY_FILE = keyFile;
  console.log(`Local HTTPS ready: ${["localhost", ...addresses].map((name) => `https://${name}:${process.env.PORT || 3000}`).join("  ")}`);
}

function startWithNetworkWatch() {
  let child;
  let stopping = false;
  let restarting = false;
  let timer;

  function launch(afterNetworkChange = false) {
    prepareHttps();
    child = spawn(process.execPath, [
      "--require", path.resolve(__dirname, "prefer-lan-address.cjs"),
      require.resolve("react-scripts/scripts/start"),
    ], {
      cwd: process.cwd(),
      env: afterNetworkChange ? { ...process.env, BROWSER: "none" } : process.env,
      stdio: "inherit", windowsHide: true,
    });
    child.on("error", (error) => {
      console.error(`Could not start the HTTPS server: ${error.message}`);
      clearInterval(timer);
      process.exitCode = 1;
    });
    child.on("exit", (code) => {
      if (stopping || restarting) return;
      clearInterval(timer);
      process.exitCode = code ?? 1;
    });
  }

  launch();
  timer = setInterval(() => {
    if (stopping || restarting || !child || child.exitCode !== null) return;
    const addresses = currentAddresses();
    if (certificateCovers(addresses)) return;
    restarting = true;
    console.log(`Network address changed (${addresses.join(", ") || "no LAN address"}); refreshing HTTPS certificate and server...`);
    child.once("exit", () => {
      if (stopping) return;
      try {
        launch(true);
      } catch (error) {
        console.error(error.message);
        clearInterval(timer);
        process.exitCode = 1;
      } finally {
        restarting = false;
      }
    });
    child.kill();
  }, 2000);

  function stop() {
    stopping = true;
    clearInterval(timer);
    if (child && child.exitCode === null) child.kill();
  }
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

try {
  process.env.HTTPS = process.env.HTTPS || "true";
  process.env.HOST = process.env.HOST || "0.0.0.0";
  if (process.env.HTTPS === "true") {
    if (process.argv.includes("--check")) prepareHttps();
    else startWithNetworkWatch();
  } else if (!process.argv.includes("--check")) {
    require("react-scripts/scripts/start");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
