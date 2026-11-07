# AstroWay API for Postman

The [AstroWay astrology API](https://api.astroway.info) as a Postman collection: every operation in the public OpenAPI document, one folder per subject, example bodies filled in, the key set in one place.

[![Run in Postman](https://run.pstmn.io/button.svg)](https://www.postman.com/astroway-info/astroway-api)

The collection here is rebuilt every day from [`/v1/openapi.json`](https://api.astroway.info/v1/openapi.json) by the [sync workflow](.github/workflows/sync.yml), and committed only when something changed. [`stats.json`](stats.json) says which API version it was built from and how many operations it holds.

## Import it

**From this repository.** In Postman choose **Import**, paste this link and confirm:

```
https://raw.githubusercontent.com/astroway/postman-collections/main/astroway-api.postman_collection.json
```

Insomnia, Bruno and Hoppscotch import the same file.

**From the public workspace.** The button above opens [postman.com/astroway-info/astroway-api](https://www.postman.com/astroway-info/astroway-api). Fork the collection into your own workspace from there. The [published documentation](https://documenter.getpostman.com/view/54689779/2sBXqNmy3n) shows the same requests without an account.

## Set your key

The collection has two variables and every request uses them:

| Variable | Value |
|---|---|
| `apiKey` | Your key, sent as the `X-Api-Key` header. Replace the placeholder. |
| `baseUrl` | `https://api.astroway.info/v1`. Leave it. |

Get a key at [api.astroway.info/dashboard/sign-up](https://api.astroway.info/dashboard/sign-up). The free plan is 10,000 credits a month and needs no card; an `aw_test_*` sandbox key spends nothing while you explore. Each request's price is on the [credits page](https://api.astroway.info/en/credits/), and every response carries `X-Credits-Used` and `X-Credits-Remaining`.

Then open **Core**, **Natal Chart** and send it. The body is a real birth moment, so the first request answers.

## Two parameters worth knowing

Most requests already show them in the query tab:

- `fields`: dotted paths to keep, such as `planets.name,planets.longitude`. A full natal chart is tens of kilobytes; the paths you need are often under one.
- `precision`: decimal places to keep.

Both are described in [API conventions](https://api.astroway.info/en/api-conventions/).

## Build it yourself

```bash
npm ci
npm run build    # writes astroway-api.postman_collection.json and stats.json
```

`OPENAPI_URL` points the build at another copy of the spec. Request and response ids are derived from each request's folder and name, so a rebuild against an unchanged spec produces an identical file.

## Other ways in

- [OpenAPI document](https://github.com/astroway/astrology-api-openapi), for code generators
- SDKs for [TypeScript, Python, PHP, Go and C#](https://api.astroway.info/sdk/)
- [MCP servers](https://api.astroway.info/en/agent-setup/) for AI agents

## Licence

MIT for the build script and the collection.
