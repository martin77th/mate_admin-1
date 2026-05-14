This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

문서 바로가기: [docs/README.md](docs/README.md)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Docker Development (Port 5001)

Run files are managed in:

`/Volumes/MartinData/SERVER/mate_admin`

Start with Docker Compose:

```bash
cd /Volumes/MartinData/SERVER/mate_admin
./manage.sh rebuild-dev
```

Open [http://localhost:5001](http://localhost:5001).

Stop the service:

```bash
cd /Volumes/MartinData/SERVER/mate_admin
./manage.sh down
```

Production mode can be started with:

```bash
cd /Volumes/MartinData/SERVER/mate_admin
./manage.sh rebuild-prod
```

Detailed plan and 운영 기준 are documented in:

`docs/DOCKER_DEV_PLAN.md`

## Production Deployment (Docker + Domain)

```bash
cp deploy/.env.prod.example deploy/.env.prod
# edit deploy/.env.prod

docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml build --no-cache
docker compose --env-file deploy/.env.prod -f docker-compose.prod.yml up -d
```

Production security/deployment checklist:

`PROD_DEPLOYMENT_GUIDE.md`

Documentation index:

`docs/README.md`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
