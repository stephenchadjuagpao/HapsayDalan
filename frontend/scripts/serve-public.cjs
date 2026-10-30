const express = require("express");
const path = require("path");
const fs = require("fs");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const frontendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(frontendRoot, "..");
const buildRoot = path.join(frontendRoot, "build");
const backendRoot = path.join(projectRoot, "backend");
const host = "127.0.0.1";
const port = Number(process.env.PUBLIC_LOCAL_PORT || 3100);
const backendPort = Number(process.env.PUBLIC_BACKEND_PORT || 8100);

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Retire the laptop origin after copying its database and evidence to the cloud.
app.use((req, res, next) => {
  const stateFile = path.join(backendRoot, ".cloud-migration.json");
  if (!fs.existsSync(stateFile)) return next();
  res.setHeader("Cache-Control", "no-store");
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const target = new URL(state.target);
    if (state.mode === "redirect" && target.protocol === "https:" && !target.username && !target.password && target.pathname === "/" && !target.search && !target.hash) {
      if (["GET", "HEAD"].includes(req.method)) return res.redirect(302, target.origin + req.originalUrl);
      return res.status(503).json({ detail: "This site has moved. Open the cloud website to continue.", website: target.origin });
    }
  } catch (_) {
    // Fail closed while a migration marker exists, including if it is damaged.
  }
  res.setHeader("Retry-After", "120");
  return res.status(503).json({ detail: "Reports are being moved to cloud hosting. Please try again shortly." });
});

app.use(["/api", "/admin"], createProxyMiddleware({
  target: `http://127.0.0.1:${backendPort}`,
  changeOrigin: false,
  onProxyReq(proxyReq, req) {
    proxyReq.setHeader("X-Forwarded-Proto", "https");
    proxyReq.setHeader("X-Forwarded-Host", req.headers.host);
  },
}));

app.use("/media", express.static(process.env.DJANGO_MEDIA_ROOT || path.join(backendRoot, "media"), {
  fallthrough: false,
  setHeaders(res, filePath) {
    if (path.extname(filePath).toLowerCase() === ".jfif") res.setHeader("Content-Type", "image/jpeg");
  },
}));
app.use("/static", express.static(path.join(buildRoot, "static")));
app.use("/static", express.static(path.join(backendRoot, "staticfiles"), { fallthrough: false }));
app.use(express.static(buildRoot, { index: false }));
app.get("*", (req, res) => res.sendFile(path.join(buildRoot, "index.html")));

app.listen(port, host, () => {
  console.log(`HapsayDalan public origin server listening on http://${host}:${port}`);
});
