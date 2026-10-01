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

## Step 4: User model (`src/models/user.model.js`)

Naya package: `bcrypt` -> password ko hash karne ke liye.

```bash
npm install bcrypt
```

### Schema fields

| Field | Kya hai |
|---|---|
| `email` | required, `trim`, `lowercase`, regex se validate, `unique: true` |
| `name` | required, 2 se 50 characters |
| `password` | required, min 8 characters, `select: false` |
| `role` | `user` ya `admin`, default `user` |
| `isActive` | default `true`, account delete ki jagah disable karne ke liye |

`timestamps: true` se `createdAt` aur `updatedAt` apne aap ban jaate hain.

Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` -> `kuch@kuch.kuch` format, space ya extra `@` nahi chalega.

Note: `unique: true` validator nahi hai, DB index banata hai. Duplicate email par message nahi, Mongo ka `E11000` error aata hai. Isko controller me pakad ke "Email already exists" dena hoga.

### Password hash (pre-save hook)

Save se pehle password hash hota hai, sirf jab password change hua ho (warna profile update par dobara hash ho jayega).

```js
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});
```

`10` = salt rounds (jitna zyada, utna secure par slow).

### Login ke liye `comparePassword`

```js
userSchema.methods.comparePassword = function (password) {
    return bcrypt.compare(password, this.password);
};
```

`password` field `select: false` hai, isliye login ke time user ko aise laana padega, warna `this.password` `undefined` hoga:

```js
const user = await userModel.findOne({ email }).select("+password");
const ok = await user.comparePassword(password);
```

### `toJSON` transform (password response me na jaye)

```js
userSchema.set("toJSON", {
    transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
    }
});
```

- `userSchema.set(option, value)` schema ki setting badalta hai. Yahan `toJSON` set kiya.
- Jab bhi document JSON me convert hota hai (`res.json(user)` ya `JSON.stringify(user)`), mongoose ye `transform` chalata hai.
- `transform(doc, ret)`: `doc` original mongoose document hai, `ret` wo plain object hai jo JSON me jaayega. Usme se fields delete karke return karo, wahi client ko milta hai.
- Sirf output badalta hai, DB ka data waisa hi rehta hai.

**`select: false` hai to ye kyu?** Dono alag situation cover karte hain:

| Situation | `select: false` | `toJSON` transform |
|---|---|---|
| `findOne({email})` | password nahi aata | - |
| `findOne(...).select("+password")` (login) | password aata hai | response me se hata deta hai |
| `User.create({...})` (register) | password aata hai (hashed), kyunki query hui hi nahi | response me se hata deta hai |

Sabse badi gap register wali hai: `create` ke baad `res.json(user)` karoge to `select: false` kuch nahi karta, hashed password chala jata. `toJSON` isse bachata hai. Ye ek safety net hai, isliye dono rakhe hain.

### Export

```js
const userModel = mongoose.model("user", userSchema);
module.exports = userModel;
```

## Step 5: MongoDB auth fix + Register API

### MongoDB "requires authentication" error

Error aaya: `MongoServerError: Command find requires authentication`.

- **Wajah:** Docker wale Mongo me username/password set tha (`MONGO_INITDB_ROOT_USERNAME`), par `MONGO_URI` me credentials nahi the. Connect ho jata hai, par koi bhi command chalane par error aata hai.
- **Fix:** `.env` me credentials + `authSource=admin` daala (root user `admin` database me bana hota hai):

```
MONGO_URI=mongodb://<username>:<password>@localhost:27017/backend-ledger?authSource=admin
```

Password me `@ : /` jaise special characters ho to URL-encode karna padega.
`.env.example` me sirf placeholders rakhe hain, asli password kabhi commit nahi karna.

### Naye packages

```bash
npm install jsonwebtoken cookie-parser
```

- `jsonwebtoken` -> login token (JWT) banane ke liye
- `cookie-parser` -> request ki cookies read karne ke liye (`req.cookies`)

`.env` me naya variable: `JWT_SECRET` (token sign karne ki secret key, `.env.example` me bhi add kiya).

### Folder structure (naye folders)

```
src/
├── controllers/auth.controller.js   # request ka logic
└── routes/auth.routes.js            # URL -> controller mapping
```

### `src/app.js` - middleware + routes

```js
app.use(express.json());   // body JSON -> req.body
app.use(cookieParser());   // cookies -> req.cookies

app.use('/api/auth', authRouter);
```

Middleware hamesha routes se **pehle** lagte hain, warna routes ko body/cookies nahi milti.

### `src/routes/auth.routes.js`

```js
router.post('/register', userRegisterController);   // POST /api/auth/register
```

`app.js` me `/api/auth` prefix laga hai, to final URL `/api/auth/register` banta hai.

### Register controller (`auth.controller.js`)

Flow:
1. `req.body` se `email`, `password`, `name` nikalo.
2. Email pehle se hai to `422` bhejo.
3. User create karo (password pre-save hook se apne aap hash hota hai, Step 4).
4. JWT token banao (3 din valid) aur cookie me set karo.
5. `201` ke saath user + token bhejo.

```js
const isEmailExists = await userModel.findOne({email});
if (isEmailExists) {
    return res.status(422).json({ message: "User already exists with this email.", status: "failed" });
}

const user = await userModel.create({ email, name, password });

const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '3d' });
res.cookie('jwt_token', token);

res.status(201).json({
    user: { id: user._id, email: user.email, name: user.name },
    token,
    message: "User has been successfully created",
    status: "success"
});
```

- `jwt.sign(payload, secret, options)`: payload me `userId` rakha, baad me isi se pata chalega ki request kis user ki hai.
- Response me user ke fields haath se chune (`id`, `email`, `name`), to password bahar nahi jata.

### Bugs jo fix kiye

- `jwt.sign({userId, user._id}, ...)` -> syntax error tha. Sahi: `{ userId: user._id }` (key aur value alag likhni padti hai).
- `res.cookies(...)` -> typo, sahi `res.cookie(...)`.

### Abhi baaki

- Login controller me `try/catch` nahi hai (register me hai).
- Logout API, protected routes (token verify middleware) aage banenge.

## Step 6: Register hardening + Login API

### Register me `try/catch`

Pehle readme me likha tha ki bina try/catch ke request hang ho sakti hai. Ye galat tha: Express 5 me async error apne aap error handler tak jaata hai, request hang nahi hoti. Par client ko default HTML wala 500 milta tha. `try/catch` se JSON error milta hai aur cases alag handle hote hain:

```js
} catch (error) {
    // schema validation fail (galat email, chhota password, etc.)
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            message: Object.values(error.errors).map(e => e.message).join(', '),
            status: 'failed'
        })
    }

    // do request ek saath aayi to unique index duplicate email par E11000 deta hai
    if (error.code === 11000) {
        return res.status(422).json({ message: "User already exists with this email.", status: "failed" })
    }

    console.error('Register error:', error);   // asli error sirf server log me
    return res.status(500).json({ message: "Something went wrong, please try again later.", status: "failed" })
}
```

- `400` -> validation fail, `422` -> email duplicate, `500` -> baaki sab (jaise DB down).
- Client ko andar ki detail nahi jaati, sirf log me jaati hai.

### Cookie options

```js
res.cookie('jwt_token', token, {
    httpOnly: true,                                  // JS (document.cookie) se read nahi hogi, XSS se token chori nahi hoga
    maxAge: 3 * 24 * 60 * 60 * 1000,                 // 3 din (ms me), token expiry ke barabar
    sameSite: 'strict',                              // dusri site se request me cookie nahi jayegi (CSRF se bachav)
    secure: process.env.NODE_ENV === 'production'    // production me sirf HTTPS par
});
```

`secure` local me `false` rakha hai, warna HTTP wale localhost me cookie set hi nahi hoti.

### Login API: `POST /api/auth/login`

Route (`auth.routes.js`):

```js
router.post('/login', userLoginController);
```

Flow:
1. `email` se user dhundo, **password ke saath** (`.select("+password")`).
2. User na mile ya password galat ho, dono me same message: `401 "Email or password is not valid"` (taaki koi andaza na laga sake ki email register hai ya nahi).
3. Sahi ho to JWT banao, cookie set karo, `200` ke saath user + token bhejo.

```js
const user = await userModel.findOne({email}).select("+password");
if (!user) return res.status(401).json({ status: "failed", message: "Email or password is not valid" });

const isValidPassword = await user.comparePassword(password);
if (!isValidPassword) return res.status(401).json({ status: "failed", message: "Email or password is not valid" });
```

### Error: `data and hash arguments required`

Login me `bcrypt.compare` ye error de raha tha.

- **Wajah:** schema me `password` par `select: false` hai, to `findOne({email})` password laata hi nahi. `this.password` `undefined` mila, aur bcrypt ko hash nahi mila.
- **Fix:** query me `.select("+password")` lagaya (`+` ka matlab: baaki fields ke saath ye hidden field bhi lao).

```js
// pehle (galat)
const user = await userModel.findOne({email});
// ab
const user = await userModel.findOne({email}).select("+password");
```

Ye wahi cheez hai jo Step 4 me `comparePassword` ke note me likhi thi.

Debug ke liye `comparePassword` me `console.log` lagaye the jo password aur hash print karte the. Wo hata diye, secrets kabhi log me nahi jaane chahiye.
