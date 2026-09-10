# Guest and Meta API tests

Run from the repository root after installing the dependencies in `package-lock.json`.

```powershell
npm test
```

The regular suite covers optional authentication, protected review routes, share URLs, and safe Meta HTML rendering. It does not require a database.

For the HTTP integration suite, provide a running local MySQL server and an account allowed to create and drop test databases:

```powershell
$env:TEST_MYSQL_SERVER_URL = "mysql://test_user:test_password@127.0.0.1:3306"
npm run test:api-integration
```

Replace the sample credentials with your local test account. Without this variable, the suite tries `mysql://root@127.0.0.1:33317`. An unavailable server fails the run; database tests are not silently skipped.

Each run creates a unique `gaza_api_test_` database, creates tables from the Sequelize models, seeds fixtures, exercises the actual Express app, and drops that database afterward. The connection must use a loopback host. The suite overrides `MYSQL_URI`; it does not use the application database from `.env`.

Coverage includes category visibility/counts/pagination, product and store browsing, guest versus authenticated reviews, review aggregates, wishlist privacy, Meta escaping/images, hidden products, banned sellers, validation, and protected writes.

Meta endpoints covered:

- `GET /api/product/:id/meta` returns HTML.
- `GET /api/meta/product/:id` and `GET /api/meta/store/:sellerId` retain their JSON responses.
