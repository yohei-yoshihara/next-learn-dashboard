## Next.js App Router Course with SQLite3

以下のコースのサンプルアプリを SQLite3 で動作するように修正したもの。

- [course curriculum](https://nextjs.org/learn)

```bash
npm install
npx auth secret
npm run dev
```

データベースに初期データを登録するため、`http://localhost:3000/seed/`へアクセスする。

`http://localhost:3000/`へアクセスし、以下のユーザでログインする。

- email: `user@nextmail.com`
- password: `123456`
