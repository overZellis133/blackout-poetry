// Dev-only API endpoints. In production these same handlers are deployed as
// Vercel serverless functions from /api/*.js. Loaded automatically by CRA's
// webpack-dev-server. Requires ANTHROPIC_API_KEY in .env (or .env.local) for
// the blackout endpoint. Restart `npm start` after editing this file or .env.

const express = require('express');
const blackoutHandler = require('../api/blackout');
const readwiseHandler = require('../api/readwise');

module.exports = function (app) {
  app.use('/api', express.json({ limit: '4mb' }));
  app.post('/api/blackout', blackoutHandler);
  app.post('/api/readwise', readwiseHandler);
};
