# PasswordDisk
A secure password management tool
# Cloudflare Workers && D1
## Init Database
**Replace DB to your link name**
### 1.Create Table `users`
```sql
npx wrangler d1 execute DB --remote --command "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, password_hash TEXT, salt TEXT, created_at INTEGER, updated_at INTEGER);"
```
### 2.Create Table `password`
```sql
npx wrangler d1 execute DB --remote --command "CREATE TABLE IF NOT EXISTS password (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, backup TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, UNIQUE (user_id))"
```
## Deploy
**Modify wrangler.toml, use your configuration**
```sql
npx wrangler deploy
```
# Screenshot
![screenshot](./screenshot.png)
![2FA](./2FA.png)