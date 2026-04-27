# blackout-poetry

An interactive blackout poetry app with AI-assisted poem generation.

Bootstrapped with [Create React App](https://github.com/facebook/create-react-app). The dev server proxies an `/api/blackout` endpoint to Claude (via the Anthropic SDK) which suggests which source-text words to keep.

## Setup

```sh
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm start` — run the dev server
- `npm test` — run tests in watch mode
- `npm run build` — production build to `build/`
