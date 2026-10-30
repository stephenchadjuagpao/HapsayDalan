const { createProxyMiddleware } = require("http-proxy-middleware");
const express = require("express");
const path = require("path");

module.exports = function (app) {
  const mediaRoot = process.env.DJANGO_MEDIA_ROOT || path.resolve(__dirname, "../../backend/media");
  app.use("/media", express.static(mediaRoot, {
    fallthrough: false,
    setHeaders(res, filePath) {
      if (path.extname(filePath).toLowerCase() === ".jfif") res.setHeader("Content-Type", "image/jpeg");
    },
  }));
  app.use(createProxyMiddleware("/api", {
    target: process.env.API_PROXY_TARGET || "http://127.0.0.1:8000",
    changeOrigin: false,
    // Replace forwarded headers instead of trusting headers supplied by clients.
    onProxyReq(proxyReq, req) {
      proxyReq.setHeader("X-Forwarded-Proto", req.socket.encrypted ? "https" : "http");
      proxyReq.setHeader("X-Forwarded-Host", req.headers.host);
    },
  }));
};
