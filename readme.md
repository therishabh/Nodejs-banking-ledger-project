# Backend Ledger

Node.js + Express par bana ledger backend. Neeche step-by-step likha hai ki kya-kya aur kaise kiya gaya.

## Step 1: Project setup

- Folder `backend-ledger` banaya aur `npm init` chalaya, isse `package.json` bana.
- Express install kiya:

```bash
npm install express
```

- Installed version: `express@^5.2.1`, module type: CommonJS.

## Step 2: Folder structure + server + MongoDB connection

Code ko organize karne ke liye `src/` folder banaya:

```
backend-ledger/
├── server.js            # entry point, server yahin start hota hai
├── .env                 # secrets (MONGO_URI)
└── src/
    ├── app.js           # express app yahan banta hai
    ├── config/db.js     # MongoDB connection
    └── models/          # mongoose models (user.model.js abhi khaali hai)
```

### Naye packages

```bash
npm install mongoose dotenv
```

- `mongoose` -> MongoDB se baat karne ke liye
- `dotenv` -> `.env` file ke variables `process.env` me load karne ke liye

### MongoDB (Docker) ki connection string

MongoDB docker me chal raha hai (port `27017`). `http://localhost:27017` sirf browser check hai, asli string `mongodb://` se shuru hoti hai. `.env` me rakhi:

```
MONGO_URI=mongodb://localhost:27017/ledger
PORT=9000
```

(Auth on ho to: `mongodb://user:pass@localhost:27017/ledger?authSource=admin`)

### `src/app.js` - express app

Abhi sirf app bana ke export kiya hai, routes aage add honge.

```js
const express = require('express');
const app = express();
module.exports = app;
```

### `src/config/db.js` - DB connect

Connect fail ho to server band (`process.exit(1)`), kyunki bina DB ke app ka kaam nahi.

```js
const mongoose = require('mongoose');
const mongo_uri = process.env.MONGO_URI;

function connectToDB() {
    mongoose.connect(mongo_uri).then(() => {
        console.log('Server is connected to MongoDB')
    }).catch(err => {
        console.log(`Error connecting to DB`, err);
        process.exit(1)
    })
}
module.exports = connectToDB;
```

### `server.js` - entry point

`dotenv` sabse pehle load hota hai (warna `MONGO_URI` undefined milega), phir DB connect, phir server start.

Port `.env` ke `PORT` se aata hai. `Number(...) || 9000` ka matlab: `PORT` na ho, khaali ho ya galat value ho (jaise `abc`) to default `9000` use hoga. (`??` ki jagah `||` isliye, kyunki `??` khaali string par fallback nahi deta.)

```js
require('dotenv').config();
const app = require('./src/app');
const PORT = Number(process.env.PORT) || 9000;
const connectToDB = require('./src/config/db');

connectToDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}, http://localhost:${PORT}`)
})
```

Run karne ke liye: `node server.js`

## Step 3: PORT env se + `.env.example`

- `server.js` me port ab `.env` se aata hai: `Number(process.env.PORT) || 9000` (detail Step 2 me).
- `.env` git me jaati nahi (`.gitignore` me hai), isliye `.env.example` banayi. Isme sirf dummy/local values hain, jisse koi bhi project clone karke bata sake ki kaun-kaun se variables chahiye:

```
MONGO_URI=mongodb://localhost:27017/backend-ledger
PORT=9000
```

Setup: `cp .env.example .env` karke apni values daal do.
- Git setup: `git init`, `.gitignore` (`node_modules`, `.env`, `.DS_Store`) aur GitHub remote `origin` add hua.
