# Website source code (for developers only)

You do NOT need this folder to launch. The finished website is already built into `deploy/public/index.html`.

To change the website: edit `src/`, then

    npm install
    npm run typecheck                         # recommended before building
    VITE_SERVER_MODE=true npm run build       # output goes to dist/
    # copy everything inside dist/ into deploy/public/ (replace index.html)

Local development against the sandbox API (`cd deploy && npm run dev`, API on :8080):

    echo "VITE_API_URL=http://localhost:8080" > .env.local && npm run dev

Notes: the prebuilt `index.html` was produced with a slightly different CSS pipeline than this Vite project (Tailwind 3), so look the site over once after your first rebuild.
