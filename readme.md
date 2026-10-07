# Backend Ledger

Node.js + Express par bana ledger backend. Neeche step-by-step likha hai ki kya-kya aur kaise kiya gaya.
Youtube Link : [Link](https://www.youtube.com/watch?v=NQOAQP0mow0&t=1s)

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

## Step 7: Welcome email (Nodemailer + Gmail OAuth2)

Register hone ke baad user ko welcome email jata hai.

### Naya package

```bash
npm install nodemailer
```

### `.env` me naye variables

Gmail OAuth2 se mail bhejte hain (App password nahi). Placeholders `.env.example` me hain:

```
EMAIL_USER=your_email@gmail.com
CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_google_client_secret
REFRESH_TOKEN=your_google_refresh_token
```

Ye Google Cloud Console me OAuth client bana kar aur OAuth Playground se refresh token lekar milte hain. Asli values sirf `.env` me, kabhi commit nahi karni.

### `src/services/email.service.js`

**1. Transporter** - Gmail se connect karta hai:

```js
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});
```

Server start par `transporter.verify(...)` chalta hai: connection sahi ho to console me `Email server is ready to send messages` aata hai, warna error.

**2. `sendEmail(to, subject, text, html)`** - generic function, koi bhi mail bhejne ke liye. Andar `try/catch` hai, to mail fail hone par app crash nahi hota, sirf error log hota hai.

**3. `sendRegistrationEmail(userEmail, name)`** - welcome mail banata hai:
- `text` = plain version (jahan HTML nahi dikhta).
- `html` = sundar version (header, welcome message, footer). Email clients external CSS nahi maante, isliye **inline styles + table layout**.
- Naam HTML me daalne se pehle `escapeHtml` se escape hota hai, warna koi naam me `<script>` daal ke mail kharab kar sakta tha.

```js
await sendEmail(userEmail, subject, text, html);
```

Export:

```js
module.exports = { sendEmail, sendRegistrationEmail };
```

### Register controller me use

User ban jane aur response bhejne ke baad mail trigger hota hai:

```js
const { sendRegistrationEmail } = require('../services/email.service');
...
await sendRegistrationEmail(email, name);
```

### Bug jo fix hua

`sendEmail(userEmail, subject, text)` me `html` pass nahi ho raha tha, to sirf plain text mail jati thi. `sendEmail` chaar arguments leta hai, isliye `html` bhi dena zaroori hai.

### Mail na jaye to ye errors dekho

| Error | Matlab |
|---|---|
| `ETIMEDOUT` | internet / VPN / firewall se Google tak nahi pahunch pa raha |
| `invalid_grant` | `REFRESH_TOKEN` expire. OAuth app "Testing" mode me ho to 7 din me expire hota hai, naya token lo ya app "In production" karo |
| `invalid_client` / `unauthorized_client` | `CLIENT_ID` ya `CLIENT_SECRET` galat |


## Step 8: Account API (create account) + auth middleware

User ke paas ab bank-jaisa account ban sakta hai. Iske liye 3 cheezein bani: account model, auth middleware (route protect karne ke liye) aur create account API.

> Note: `ledger.model.js` aur `transaction.model.js` abhi bane hain par is commit me **shamil nahi** hain, unpe baad me kaam hoga.

### Naya folder / files

```
src/
├── controllers/account.controller.js
├── middleware/auth.middleware.js     (naya folder: middleware)
├── models/account.model.js
└── routes/account.routes.js
```

Koi naya package install nahi hua (`jsonwebtoken`, `cookie-parser` pehle se the).

### 1. Account model (`src/models/account.model.js`)

Fields:
- `user` - kis user ka account hai (`ObjectId`, ref `"user"`, required).
- `status` - `ACTIVE` / `FROZEN` / `CLOSED`, default `ACTIVE`.
- `currency` - default `INR`, `uppercase` + `trim` (so `"inr"` -> `"INR"`).
- `timestamps: true` - `createdAt`, `updatedAt` apne aap.

```js
status : {
    type : String, // type ke bina mongoose `status` ko nested object samajh leta hai
    enum : {
        values: ["ACTIVE", "FROZEN", "CLOSED"],
        message : "Status can be either ACTIVE, FROZEN or CLOSED"
    },
    default : "ACTIVE"
},
```

Index: user ke accounts (status ke saath filter bhi) fast nikalne ke liye.

```js
accountSchema.index({user: 1, status: 1})
```

Ye compound index `user` akele ki query bhi cover karta hai, isliye alag se `user` par index nahi lagaya.

### 2. Auth middleware (`src/middleware/auth.middleware.js`)

Protected routes ke liye. Kaam:
1. Token lo: pehle cookie `jwt_token`, nahi mila to `Authorization: Bearer <token>` header se.
2. Token nahi hai -> `401`.
3. `jwt.verify` karke `userId` nikalo, DB se user lo.
4. User nahi mila ya token galat/expire -> `401`.
5. Sab sahi -> `req.user = user` set karke `next()`.

```js
const token = req.cookies?.jwt_token || req.headers.authorization?.split(' ')[1];

if(!token){
    return res.status(401).json({ status : "failed", message : "Unauthorized access, token is missing" });
}
```

**Dhyan rakhne wali baat:** `return res.status(...)` me `return` zaroori hai, warna neeche ka code bhi chalega aur dobara response bhejne par `ERR_HTTP_HEADERS_SENT` aayega.

### 3. Create account controller (`src/controllers/account.controller.js`)

`req.user` middleware se aata hai, to account usi logged-in user ka banta hai. Body se sirf `currency` aur `status` liye jaate hain.

```js
// Express 5 me body na bheji ho to req.body undefined hota hai, isliye `?? {}`
const {currency, status} = req.body ?? {};

const account = await accountModel.create({
    user : currentUser._id,
    currency: currency,
    status: status
});
```

Body khali ho to `currency`/`status` `undefined` rahte hain aur schema ke defaults (`INR`, `ACTIVE`) lag jaate hain.

Response: `201` + `{ message, status: "success", account }`.

### 4. Route (`src/routes/account.routes.js`) + `app.js`

```js
router.post('/', authMiddleware, createAccountController);
```

`src/app.js` me mount kiya:

```js
const accountRouter = require('./routes/account.routes')
...
app.use('/api/accounts', accountRouter);
```

### Test kaise kare

Pehle login karo (cookie `jwt_token` set hoti hai), phir:

```
POST /api/accounts
Body (optional): { "currency": "inr" }
```

- Token ke bina -> `401`.
- Token ke saath -> `201`, account `currency: "INR"`, `status: "ACTIVE"` ke saath.


## Step 9: Prettier (format on save)

### Prettier setup

Save karte hi file apne aap format ho, isliye Prettier lagaya.

```bash
npm install -D prettier
```

Naye files:

- `.prettierrc` - code style (maujooda code se match karta hai):

```json
{
  "tabWidth": 4,
  "singleQuote": true,
  "semi": true
}
```

- `.vscode/settings.json` - format on save on karta hai:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "prettier.requireConfig": true
}
```

- `.vscode/extensions.json` - VS Code me Prettier extension recommend karta hai.

VS Code me **Prettier - Code formatter** (`esbenp.prettier-vscode`) extension install karna zaroori hai. `requireConfig: true` ki wajah se ye sirf is project me chalega.

Poora `src` ek baar format kiya:

```bash
npx prettier --write src
```


## Step 10: Transaction aur Ledger models

Paisa bhejne ke liye 2 naye mongoose models banaye (abhi sirf schema, API aage banegi).

### 1. Transaction model (`src/models/transaction.model.js`)

Ek account se doosre account me paisa bhejne ka record.

- `fromAccount` / `toAccount` -> `account` ke ref, dono `required` + `index`.
- `status` -> `PENDING` (default), `COMPLETED`, `FAILED`, `REVERTED`.
- `amount` -> `min: 0.01`, yaani 0 ya negative allow nahi.
- `idempotencyKey` -> `unique`. Client har request ke saath unique key bhejta hai, to retry / double click par duplicate transaction (double debit) nahi banta.
- `timestamps: true` -> `createdAt`, `updatedAt`.

```js
idempotencyKey: {
    type: String,
    required: [true, 'Idempotency key is required'],
    unique: true,
},
```

### 2. Ledger model (`src/models/ledger.model.js`)

Har transaction ki 2 entries bante hain: `fromAccount` par **DEBIT**, `toAccount` par **CREDIT**.

- Fields: `account`, `transaction` (dono ref + index), `amount`, `type` (`CREDIT` / `DEBIT`).
- Saare fields `immutable: true` - ek baar ban gaya to change nahi hoga.
- `immutable` sirf field update rokta hai, delete nahi. Isliye update/delete wali saari query methods par `pre` hook lagaya jo error throw karta hai:

```js
function preventLedgerModification(next) {
    throw new Error('Ledger entries cannot be modified after creation');
}

ledgerSchema.pre('updateOne', preventLedgerModification);
ledgerSchema.pre('deleteOne', preventLedgerModification);
// ... findOneAndUpdate, updateMany, deleteMany, findOneAndDelete etc.
```

### 3. VS Code settings

`.vscode/settings.json` me `[javascript]` ke liye alag `defaultFormatter` (`vscode.typescript-language-features`) daala.


## Step 11: Create Transaction API

`POST /api/transactions` ka route + controller banaya. Validation se leke ledger entries + commit tak ho gaya hai, success response bhi add ho gaya hai.

Naye files:

- `src/controllers/transaction.controller.js` -> `createTransactionController`
- `src/routes/transaction.routes.js` -> route, `authMiddleware` se protected

`src/app.js` me router mount kiya:

```js
const transactionRouter = require('./routes/transaction.routes');
app.use('/api/transactions', transactionRouter);
```

```js
Router.post('/', authMiddleware, createTransactionController);
```

### Transaction flow (11 steps, controller ke upar comment me likha hai)

1. Request validate
2. Idempotency key check
3. Sender / receiver accounts fetch
4. Account status check
5. Sender ka balance ledger se nikalna
6. Transaction `PENDING` me create
7. Sender par DEBIT ledger entry
8. Receiver par CREDIT ledger entry
9. Transaction `COMPLETED` karna
10. Success response
11. Error handling

**Saare 11 steps done hain.**

### Step 1: Request validation

`fromAccount`, `toAccount`, `amount`, `idempotencyKey` me se koi missing ho to `400`. (Update: `fromAccount` ab body se nahi aata, Step 16 dekho. Ab body me `toAccount`, `amount`, `idempotencyKey` chahiye.)

### Step 2: Idempotency key check

Same `idempotencyKey` se pehle ka transaction mil gaya to naya nahi banta, uske status ke hisaab se response milta hai:

| Existing status | HTTP | `status` in JSON |
|---|---|---|
| `COMPLETED` | 200 | `success` |
| `PENDING` | 202 | `pending` |
| `FAILED` | 409 | `failed` |
| `REVERTED` | 409 | `failed` |

- `PENDING` par 202 kyunki abhi process ho raha hai, `success` bolna galat hoga.
- `FAILED` / `REVERTED` ko `success` nahi bol sakte, isliye 409 + `failed`.

### Step 3: Accounts fetch

```js
const fromAccountDoc = await accountModel.findById(fromAccount);
const toAccountDoc = await accountModel.findById(toAccount);
```

Dono me se koi na mile to `400` (`One or both accounts not found`).

### Step 4: Account status check

Sender ya receiver me se koi bhi `ACTIVE` nahi hai to `400` (`One or both accounts are not active`).

### Step 5: Sender ka balance (ledger se)

Balance kahin store nahi karte, ledger se **derive** karte hain. `account.model.js` me instance method `getBalance()` banaya:

```js
accountSchema.methods.getBalance = async function () {
    const balanceData = await LedgerModel.aggregate([
        { $match: { account: this._id } },
        { $group: {
            _id: null,
            creditBalance: { $sum: { $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount', 0] } },
            debitBalance:  { $sum: { $cond: [{ $eq: ['$type', 'DEBIT'] },  '$amount', 0] } },
        } },
        { $project: { _id: 0, balance: { $subtract: ['$creditBalance', '$debitBalance'] } } },
    ]);
    return balanceData.length > 0 ? balanceData[0].balance : 0; // entries nahi to balance 0
};
```

- Balance = total CREDIT - total DEBIT.
- Controller me `senderAccountBalance < amount` ho to `400` (insufficient balance).
- Fix: pehle `$match` me `accountId` likha tha, jabki ledger me field ka naam `account` hai. Isse balance hamesha 0 aata. Ab `account` use hota hai.

### Steps 6-9: Atomic write (MongoDB session)

Transaction + 2 ledger entries ek hi **session** me likhte hain, taaki ya to sab save ho ya kuch bhi nahi.

```js
session = await mongoose.startSession();
session.startTransaction();

// (a) PENDING transaction
const [transaction] = await transactionModel.create([{ fromAccount, toAccount, amount, idempotencyKey, status: 'PENDING' }], { session });
// (b) sender par DEBIT, (c) receiver par CREDIT
await ledgerModel.create([{ account: fromAccount, transaction: transaction._id, type: 'DEBIT', amount }], { session });
await ledgerModel.create([{ account: toAccount, transaction: transaction._id, type: 'CREDIT', amount }], { session });
// (d) COMPLETED + (e) commit
transaction.status = 'COMPLETED';
await transaction.save({ session });
await session.commitTransaction();
```

Important baatein:

- `create()` me `session` option tabhi lagta hai jab **array** pass karo (`create([{...}], { session })`). Object pass karne par `{ session }` ko doosra document maan leta hai. Isliye `const [transaction] = ...`.
- Error aaye to `catch` me rollback:

```js
if (session?.inTransaction()) await session.abortTransaction();
```

- `finally` me `session?.endSession()` taaki success/error dono me session release ho. `session` ko `try` ke bahar `let session = null` se declare kiya taaki catch/finally me mile.
- `require('mongoose')` controller me missing tha, wo add kiya.
- Note: MongoDB transactions ke liye **replica set** chahiye. Standalone local MongoDB par error aa sakta hai.

### Comments

Step 6 wale block me Hinglish comments add kiye (a-e ka flow), taaki code padhke samajh aaye.

### Step 10: Success response + exports

Commit ke baad `201 Created` bhejte hain, transaction details ke saath:

```js
await session.commitTransaction();

return res.status(201).json({
    message: 'Transaction completed successfully',
    status: 'success',
    transaction,
});
```

- `return` try ke andar hai, par `finally` phir bhi chalta hai, to `endSession()` hota rahta hai.
- Controller file ke end me exports:

```js
module.exports = {
    createTransactionController,
    createInitialFundsTransactionController,
};
```

### Side note: ORM

Ledger/transactions jaise kaam ke liye Postgres (ACID, constraints) zyada safe hai. Future me migrate karna ho to **Prisma** ya **Drizzle** achhe options hain. Abhi Mongoose hi chal raha hai.


## Step 12: System user + Initial funds API

Naye account me balance 0 hota hai, to pehla paisa kahin se aana chahiye. Iske liye ek **system user** (jaise bank) hota hai jo accounts me initial funds credit karta hai.

### 1. `systemUser` flag (user model)

`src/models/user.model.js` me naya field:

```js
systemUser: {
    type: Boolean,
    default: false,
    immutable: true, // ek baar set hone ke baad badal nahi sakta
    select: false,   // query me default nahi aata
},
```

- `immutable` hai, isliye ye **create time** pe hi set hota hai. Register API se system user nahi banta, wo DB me (Compass/mongosh) manually `systemUser: true` ke saath banana padega.
- `select: false` ki wajah se isse padhne ke liye `.select('+systemUser')` lagana padta hai.

### 2. `systemUserAuthMiddleware`

`src/middleware/auth.middleware.js` me naya middleware. Token verify karta hai, user fetch karta hai (`+systemUser` ke saath) aur system user na ho to `401`:

```js
const user = await userModel.findById(decodedToken.userId).select('+systemUser');
if (!user || !user.systemUser) { /* 401 */ }
req.user = user;
return next();
```

### 3. Initial funds route + controller

```js
Router.post("/system/initial-funds", systemUserAuthMiddleware, createInitialFundsTransactionController);
```

`POST /api/transactions/system/initial-funds`, body: `toAccount`, `amount`, `idempotencyKey`.

Flow:

1. Required fields check (`400`)
2. `toAccount` fetch (`400 Invalid Account`)
3. `toAccount` kisi system user ka nahi hona chahiye (`400 toAccount should not be system account`)
4. System user ka apna account dhoondho (`fromUserAccount`)
5. Idempotency key check (same table jo Step 2 me hai)
6. Session start -> `PENDING` transaction -> **DEBIT** system account, **CREDIT** `toAccount` -> `COMPLETED` -> commit
7. `201` + transaction

Step 3 ka check:

```js
const toUser = await userModel.findById(toUserAccount.user).select('+systemUser');

if (toUser?.systemUser) {
    return sendResponse(res, 400, 'toAccount should not be system account');
}
```

- `systemUser` me `select: false` hai, isliye yahan `.select('+systemUser')` **zaroori** hai. Iske bina field aata hi nahi, `systemUser` hamesha `undefined` rehta aur ye check kabhi trigger nahi hota (pehle yahi bug tha).
- Ye check abhi sirf initial-funds me hai. Normal transfer (`createTransactionController`) me system account pe bhejna abhi nahi roka gaya.

Bugs jo fix kiye:

- Pehle system account ki query `findOne({ systemUser: true, user: req.user._id })` thi. `systemUser` **user** model me hai, account me nahi, to query hamesha empty aati. Ab:

```js
const fromUserAccount = await accountModel.findOne({
    user: req.user._id,
    status: 'ACTIVE',
});
```

  (middleware pehle hi system user verify kar chuka hai). Error message `Active account not found for system user`.
- `create([...])` array return karta hai, to `const [transaction] = await transactionModel.create([...], { session })` likha. Warna `transaction._id` undefined aata.
- Debug `console.log` aur unused `debitLedgerEntry` / `creditLedgerEntry` variables hata diye.

## Step 13: Chhote changes (account + logout)

### Ek user = ek account

`createAccountController` me create se pehle check:

```js
const isAccountExist = await accountModel.findOne({ user: currentUser._id });
if (isAccountExist) {
    return res.status(400).json({ status: 'failed', message: 'Account already created' });
}
```

Response ke saath `return` bhi lagaya.

### Logout API

`POST /api/auth/logout` (`userLogoutController`). Cookie `jwt_token` clear karta hai aur `200` bhejta hai. Token na ho tab bhi `200` (already logged out).

```js
res.clearCookie('jwt_token');
return res.status(200).json({ status: 'success', message: 'User logged out successfully' });
```

Note: JWT stateless hai, isliye header me bheja hua token expire hone tak valid rehta hai. Cookie wala client logout ho jaata hai.

## Step 14: MongoDB replica set (Docker) for transactions

Transaction create karte waqt ye error aaya:

```
This MongoDB deployment does not support retryable writes. Please add retryWrites=false to your connection string.
```

**Wajah:** Mongo ke multi-document transactions (`session.startTransaction()`) **replica set** pe hi chalte hain. Local `mongo:latest` container standalone tha. `retryWrites=false` lagana galat fix hai, kyunki uske baad `Transaction numbers are only allowed on a replica set member` aata.

**Fix:** purane container (`mongodb`, 27017) ko touch kiye bina ek naya single-node replica set container (port **27018**):

```bash
docker run -d --name mongo-rs -p 27018:27017 mongo:7 --replSet rs0 --bind_ip_all
docker exec mongo-rs mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
```

- `host` me **27017** dena hai, kyunki container ke andar mongod isi port pe hai. `27018` dene par `No host described in new configuration ... maps to this node` aata hai.

`.env` me:

```
MONGO_URI=mongodb://localhost:27018/backend-ledger?replicaSet=rs0&directConnection=true
```

- `directConnection=true` zaroori hai, warna driver replica set ka host (`localhost:27017`) pakad leta hai jo bahar se kaam nahi karta.
- Naye container me auth nahi hai (local dev), aur DB khaali hai. Users/accounts/system user dobara banane padenge.

MongoDB Compass connection string:

```
mongodb://localhost:27018/?replicaSet=rs0&directConnection=true
```

Note: `.env` git-ignored hai, isliye URI commit me nahi jaati.

### Flow test karne ka order

1. Register (normal user + system user DB me manually `systemUser: true` ke saath)
2. Login
3. Har user ke liye account create
4. System user se `POST /api/transactions/system/initial-funds`
5. Normal user se `POST /api/transactions` (transfer)

## Step 15: `sendResponse` helper (repeat hone wala res.status().json() hataya)

Har controller/middleware me `res.status(..).json({ message, status, ... })` baar-baar likha ja raha tha, aur har jagah `status: 'failed'` / `'success'` manually dena padta tha. Iske liye ek common helper banaya.

Naya folder + file: `src/utils/response.js`

```js
function sendResponse(res, statusCode, message, extra = {}) {
    return res.status(statusCode).json({
        message,
        status: statusCode < 400 ? 'success' : 'failed',
        ...extra,
    });
}

module.exports = { sendResponse };
```

- `status` auto set hota hai: code `< 400` to `'success'`, warna `'failed'`.
- Extra data (`user`, `token`, `transaction`, `account`, `error`) 4th argument me jaata hai.
- Special case (jaise **202 pending**) me `extra` me `status` bhej do, wo default ko override kar deta hai.
- Response ka shape pehle jaisa hi hai (`message`, `status`, + extra), isliye client side pe kuch nahi badla. Sirf JSON keys ka order alag ho sakta hai.

### Use kaise karte hain

```js
// pehle
return res.status(201).json({
    message: 'Account has been successfully created',
    status: 'success',
    account,
});

// ab
return sendResponse(res, 201, 'Account has been successfully created', { account });
```

```js
// 202 pending (status override)
return sendResponse(res, 202, 'Transaction ... is pending', { status: 'pending' });

// error ke saath extra field
sendResponse(res, 500, 'Failed to create transaction', { error: error.message });
```

### Kahan-kahan laga (total 38 calls)

| File | Calls |
|---|---|
| `src/controllers/account.controller.js` | 2 |
| `src/controllers/auth.controller.js` | 10 (register, login, logout) |
| `src/controllers/transaction.controller.js` | 20 (dono controllers) |
| `src/middleware/auth.middleware.js` | 6 (`authMiddleware`, `systemUserAuthMiddleware`) |

Har file ke top pe import:

```js
const { sendResponse } = require('../utils/response');
```

Notes:

- Refactor ek script se kiya (message/status nikalke baaki fields extra me daale). Phir auth me validation errors wala multi-line `message` ko `const message = ...` me nikalke manually theek kiya.
- `res.cookie(...)` / `res.clearCookie(...)` jaisi calls waise hi hain, kyunki wo JSON response nahi hain.
- Future idea: error ke liye `ApiError` class + global error middleware, taaki `catch` ke 500 blocks bhi ek jagah aa jaayein.


## Step 16: Accounts list API, `/api/me`, aur transfer me `fromAccount` auto

### 1. `GET /api/accounts` (list of accounts)

Saare **ACTIVE** accounts ki list (account id + user ka name), lekin logged in user ka apna account aur **system users** ke accounts list me nahi aate. Transfer ke time "kisko bhejna hai" ki list dikhane ke kaam aati hai.

Route (`account.routes.js`): `router.get('/', authMiddleware, listAccountController);`

```js
// 1. system users ki ids
const systemUsers = await userModel.find({ systemUser: true }).select('_id').lean();
const systemUserIds = systemUsers.map((user) => user._id);

// 2. active accounts, apna + system users ke accounts chhodke
const accounts = await accountModel
    .find({
        status: 'ACTIVE',
        user: { $nin: [currentUser._id, ...systemUserIds] },
    })
    .select('_id user')
    .populate('user', 'name')
    .lean();

const accountList = accounts.map((account) => ({
    accountId: account._id,
    name: account.user?.name,
}));
```

- `$nin` = "in me nahi". Apni id + system users ki ids ek saath exclude hoti hain.
- `systemUser` **user** model me hai (account me nahi), isliye pehle users se unki ids nikaali. `select: false` hone par bhi filter me use karne ke liye `.select('+systemUser')` nahi chahiye, wo sirf value padhne ke liye chahiye.
- `.select('_id user')`: sirf zaroori fields. `.populate('user', 'name')`: user id ki jagah uska name (password jaise fields kabhi nahi aate).
- `.lean()`: Mongoose document ki jagah plain JS object deta hai. Fast aur halka hai. Read-only list ke liye theek hai, par `.save()` ya custom methods (`getBalance()`) wahan nahi milte.
- `account.user?.name`: `?.` isliye ki user delete ho gaya ho to populate `null` deta hai aur crash na ho.

Response:

```json
{ "message": "...", "status": "success", "accounts": [{ "accountId": "...", "name": "Rishabh" }] }
```

### 2. `GET /api/me` (logged in user ki info)

Naye files:

- `src/controllers/user.controller.js` -> `getMeController`
- `src/routes/user.routes.js` -> `router.get('/', authMiddleware, getMeController)`

`src/app.js` me mount kiya:

```js
const userRouter = require('./routes/user.routes');
app.use('/api/me', userRouter);
```

- `authMiddleware` pehle hi `req.user` set kar deta hai, to user ke liye extra query nahi lagti.
- User ke fields **explicitly list** kiye (`id, name, email, role, isActive, createdAt`), taaki password / `systemUser` galti se leak na ho.
- Extra: user ka `account` (`accountId, status, currency`) bhi aata hai, kyunki transfer ke liye apni `accountId` chahiye. Account na ho to `null`.

```json
{
  "user": { "id": "...", "name": "...", "email": "...", "role": "user", "isActive": true, "createdAt": "..." },
  "account": { "accountId": "...", "status": "ACTIVE", "currency": "INR" }
}
```

Token ke bina `401 Unauthorized access, token is missing` aata hai (test kiya).

### 3. Transfer me `fromAccount` ab body se nahi

`POST /api/transactions` me pehle client `fromAccount` bhejta tha, yaani koi bhi kisi aur ke account se paisa bhej sakta tha. Ab sender ka account **logged in user se** nikalta hai:

```js
const currentUserAccount = await accountModel.findOne({ user: currentUser._id });
const fromAccount = currentUserAccount._id;

const { toAccount, amount, idempotencyKey } = req.body ?? {};
```

- Body ab: `toAccount`, `amount`, `idempotencyKey`.
- Security improve hui: user sirf apne account se paisa bhej sakta hai.
- User ka account na ho to `currentUserAccount` `null` hota hai aur `._id` pe TypeError aata (generic `500`). Isliye (Step 17 me fix kiya) ab `400` milta hai:

```js
if (!currentUserAccount) {
    return sendResponse(res, 400, 'Account not found for this user, please create an account first');
}
```


## Step 17: Balance API (`GET /api/accounts/balance`)

Logged in user apne account ka current balance dekh sake, iske liye API.

### Path kaisa chuna

`GET /api/accounts/balance`

- Balance **account** ki cheez hai, isliye `/api/accounts` ke neeche aaya (create aur list yahin hain).
- Ek user ka ek hi account hai, to URL me account id nahi chahiye. Account `req.user` se mil jaata hai (jaise `/api/me`).
- `GET` hai kyunki sirf padhna hai.
- Alternative: `/api/accounts/:accountId/balance` (REST style), par tab ownership check bhi chahiye aur ye tab sahi hai jab ek user ke multiple accounts hon.
- Agar baad me `GET /api/accounts/:accountId` jaisa route aaye, to `/balance` ko **uske upar** define karna, warna Express `balance` ko `:accountId` samajh lega.

Route (`account.routes.js`):

```js
router.get('/balance', authMiddleware, getBalanceController);
```

### Controller

Naya logic nahi likha, `getBalance()` (Step 5: CREDIT minus DEBIT) hi use kiya:

```js
async function getBalanceController(req, res) {
    const currentUser = req.user;

    const currentAccount = await accountModel.findOne({ user: currentUser._id });

    // account na ho to null par .getBalance() call karne se crash hota
    if (!currentAccount) {
        return sendResponse(res, 404, 'Account not found for this user, please create an account first');
    }

    const balance = await currentAccount.getBalance();

    return sendResponse(res, 200, 'Account balance has been successfully fetched', {
        accountId: currentAccount._id,
        balance,
        currency: currentAccount.currency,
    });
}
```

Response:

```json
{ "message": "...", "status": "success", "accountId": "...", "balance": 1500, "currency": "INR" }
```

### Code review me jo improve kiya

- **Null crash:** account na ho to pehle `null.getBalance()` pe crash hota. Ab `404`.
- **Debug `console.log`** (`console.log('currentAccount', ...)`) hata diya, wo har request pe account document print karta tha.
- `accountId` response me add kiya, `balance: balance` ko short `balance` kiya, aur doc comment daala.
- `try/catch` nahi lagaya, kyunki Express 5 async errors ko khud error handler tak bhej deta hai.
- Transfer controller (`createTransactionController`) me wahi null bug tha, wahan bhi `400` lagaya (upar Step 16 ke point 3 me).


## Step 18: `ApiError` + Global error handler

### Problem kya thi

Har controller me error ke liye ye pattern baar-baar tha:

```js
if (!account) {
    return sendResponse(res, 404, 'Account not found');   // har jagah likho
}
...
} catch (error) {
    sendResponse(res, 500, 'Failed to create transaction', { error: error.message }); // har controller me try/catch
}
```

Dikkatein:

- Har controller me `try/catch` + 400/401/404/500 ke responses copy-paste ho rahe the.
- Alag-alag jagah error ka format / message alag ho sakta tha (kahin `error.message` leak, kahin nahi).
- Kuch errors ka koi handler hi nahi tha (jaise tuta hua JSON body, galat ObjectId, duplicate key).
- `register` me response bhejne ke baad email fail ho to `catch` dobara response bhejne ki koshish karta tha (`ERR_HTTP_HEADERS_SENT`).

### Idea (simple language me)

Error aaye to controller **response nahi bhejega, error `throw` karega**. Ek hi jagah (global error handler) saare errors pakdega, dekhega ki kis type ka hai, aur sahi status code + message ke saath `sendResponse` se bhej dega.

```
Request -> route -> middleware -> controller
                                     |  throw new ApiError(404, '...')   (ya koi bhi error)
                                     v
                         notFoundHandler (route nahi mila)
                                     v
                          errorHandler (final response yahin bante hain)
```

**Express 5 ki khaas baat:** Express 5 me `async` function (controller/middleware) se `throw` karo ya rejected promise aaye to wo **apne aap** error handler tak pahunch jaata hai. Express 4 me iske liye `express-async-errors` ya har jagah `try/catch + next(err)` chahiye hota tha. Isliye yahan `asyncHandler` wrapper ki zaroorat nahi padi.

### Step 1: `ApiError` class

Naya file: `src/utils/ApiError.js`

```js
class ApiError extends Error {
    constructor(statusCode, message, extra = {}) {
        super(message);

        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.extra = extra; // response JSON me message/status ke saath jodne wale fields

        Error.captureStackTrace(this, this.constructor);
    }
}
```

- `ApiError` = jaanbujhkar fail hui request ka error (400, 401, 404, 409...). Ye normal JS `Error` hi hai, bas ek `statusCode` aur optional `extra` ke saath.
- `extra` me wo fields jaate hain jo response me `message` / `status` ke saath chahiye (jaise `{ status: 'pending' }`).
- Use:

```js
throw new ApiError(404, 'Account not found');
```

### Step 2: Global error handler + 404 handler

Naya file: `src/middleware/error.middleware.js`

**a) `notFoundHandler`**: koi route match na ho to 404:

```js
function notFoundHandler(req, res, next) {
    next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
}
```

**b) `errorHandler`**: Express ko batane ke liye ki ye error handler hai, function me **4 arguments** `(err, req, res, next)` hone zaroori hain (chahe `next` use na ho).

```js
function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err); // response ja chuka hai, Express ka default handler sambhale

    let statusCode = 500;
    let message = 'Something went wrong, please try again later.';
    let extra = {};

    if (err instanceof ApiError) { statusCode = err.statusCode; message = err.message; extra = err.extra; }
    else if (err.name === 'ValidationError') { /* 400, saare field messages join */ }
    else if (err.code === 11000)             { /* 409, Duplicate value for: <field> */ }
    else if (err.name === 'CastError')       { /* 400, Invalid value for <path> */ }
    else if (err.name === 'TokenExpiredError') { /* 401, token has expired */ }
    else if (err.name === 'JsonWebTokenError') { /* 401, token is invalid */ }
    else if (err.type === 'entity.parse.failed') { /* 400, Invalid JSON in request body */ }

    if (statusCode === 500) {
        console.error('Unhandled error:', err);                         // server log me poora error
        if (process.env.NODE_ENV !== 'production') extra = { ...extra, error: err.message }; // client ko sirf dev me
    }

    return sendResponse(res, statusCode, message, extra);
}
```

Kaun sa error kahan se aata hai:

| Error | Kahan se | Response |
|---|---|---|
| `ApiError` | humne `throw` kiya | jo status/message diya |
| `ValidationError` | Mongoose schema (galat email, chhota password) | `400`, saare messages comma se jude |
| `code 11000` | Mongo unique index (duplicate email / `idempotencyKey`) | `409 Duplicate value for: <field>` |
| `CastError` | galat format ki id (`"abc"` ObjectId ki jagah) | `400 Invalid value for <path>` |
| `TokenExpiredError` | `jwt.verify()` expire token | `401 token has expired` |
| `JsonWebTokenError` | `jwt.verify()` galat token | `401 token is invalid` |
| `entity.parse.failed` | `express.json()` ko tuta JSON mila | `400 Invalid JSON in request body` |
| Baaki sab (bug, DB down) | kuch bhi | `500` generic message |

Dhyaan dene wali baatein:

- `TokenExpiredError`, `JsonWebTokenError` ka child hai, isliye **pehle** check kiya.
- **500 pe internal detail leak nahi hoti:** client ko generic message, aur `error.message` sirf `NODE_ENV !== 'production'` me. Poora error server log me (`console.error`).
- `res.headersSent` guard: agar response pehle hi ja chuka hai to dobara bhejne par `ERR_HTTP_HEADERS_SENT` aata, isliye `next(err)` karke Express ke default handler ko de dete hain.

### Step 3: `app.js` me lagana (order important hai)

```js
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

// ... saare routes ...
app.use('/api/me', userRouter);

// Error handling: hamesha saare routes ke BAAD, aur is order me
app.use(notFoundHandler);
app.use(errorHandler);
```

- Routes ke **baad** isliye, warna routes se pehle 404 chal jaata.
- `notFoundHandler` pehle, `errorHandler` last me, kyunki 404 bhi ek `ApiError` hai jo `errorHandler` tak jaana chahiye.

### Step 4: Controllers refactor (before / after)

Rule simple hai: **error ho to `throw new ApiError(...)`, success ho to `sendResponse(...)`**. 200/201/202 wale responses (jaise idempotency ka `200 already completed` aur `202 pending`) error nahi hain, isliye `sendResponse` hi rahe.

**1) `account.controller.js`**: `return sendResponse(res, 4xx, ...)` ko `throw` bana diya.

```js
// pehle
if (isAccountExist) {
    return sendResponse(res, 400, 'Account already created');
}

// ab
if (isAccountExist) {
    throw new ApiError(400, 'Account already created');
}
```

Same `getBalanceController` me (`404 Account not found for this user...`).

**2) `auth.middleware.js`**: poora `try/catch` hata diya.

```js
// pehle: try { jwt.verify...; ...} catch { return 401 }  (har error 401 ban jaata tha, DB error bhi)

// ab
const decodedToken = jwt.verify(token, process.env.JWT_SECRET); // galat/expire token par khud throw karta hai
const user = await userModel.findById(decodedToken.userId);
if (!user) throw new ApiError(401, 'Unauthorized access, token is invalid');
```

- `jwt.verify()` ka throw `errorHandler` me `401` ban jaata hai (expired ka alag message).
- Fayda: ab DB down jaise real server errors `401` nahi, `500` dikhte hain (pehle sab 401 me chhup jaate the).
- `systemUserAuthMiddleware` me bhi wahi.

**3) `auth.controller.js`**: `register` ka `try/catch` hata diya.

```js
// pehle: catch me ValidationError (400), 11000 (422), baaki 500 ka alag-alag code
// ab: kuch nahi, global handler ye sab karta hai
async function userRegisterController(req, res) {
    const { email, password, name } = req.body ?? {};
    ...
}
```

Email wala hissa alag, response ke baad:

```js
sendResponse(res, 201, 'User has been successfully created', { user: {...}, token });

// Response ja chuka hai, email fail ho to sirf log karo (dobara response nahi bhejna)
try {
    await sendRegistrationEmail(email, name);
} catch (error) {
    console.error('Registration email failed:', error);
}
```

**4) `transaction.controller.js`** (sabse important): yahan MongoDB session ka `try/catch/finally` **rakhna zaroori** hai, kyunki rollback karna hai. Bas error ka response bhejne ki jagah error **dobara throw** karte hain.

```js
try {
    if (!currentUserAccount) {
        throw new ApiError(400, 'Account not found for this user, please create an account first');
    }
    ...
    session = await mongoose.startSession();
    session.startTransaction();
    ...
    await session.commitTransaction();
    return sendResponse(res, 201, 'Transaction completed successfully', { transaction });
} catch (error) {
    if (session?.inTransaction()) {
        await session.abortTransaction();   // pehle rollback
    }
    throw error;                            // phir error global handler ko do
} finally {
    session?.endSession();                  // hamesha session release
}
```

- Session shuru hone se pehle wale `ApiError` bhi isi `catch` me aate hain. Wahan `session` `null` hai, to `session?.inTransaction()` `undefined` deta hai aur abort skip ho jaata hai. Phir `throw error` se handler ko mil jaate hain.
- Pehle `500` me `error: error.message` hamesha jaata tha, ab sirf development me.

### Step 5: Jo chhote behaviour changes hue (jaan lo)

| Cheez | Pehle | Ab |
|---|---|---|
| Duplicate key race (email / `idempotencyKey`) | register `422`, transfer `500` | dono `409 Duplicate value for: <field>` (pehle wala check `User already exists` `422` abhi bhi hai) |
| Expire token | `401 token is invalid` | `401 token has expired` |
| DB down ke time protected route | `401` | `500` (sahi hai, ye auth fail nahi hai) |
| Tuta hua JSON body | Express ka default HTML error | `400 Invalid JSON in request body` |
| Galat route (`/api/nope`) | Express ka default HTML `Cannot GET` | JSON `404 Route GET /api/nope not found` |
| Galat ObjectId (`toAccount: "abc"`) | generic `500` | `400 Invalid value for _id` |
| `register` / `login` me body na ho | `TypeError` se `500` | `req.body ?? {}` lagaya; register me validation `400`, login me `400 Email and password are required` |
| Login me email/password missing | `findOne({ email: undefined })` kisi bhi user ko match kar sakta tha | pehle hi `400` |
| Register me email fail | `ERR_HTTP_HEADERS_SENT` ka risk | sirf log, response disturb nahi hota |

### Test kaise kiya

Ek temporary database (`ledger_tmp_test`, replica set wale `mongo-rs` pe) banake **26 real HTTP requests** chalayi, phir database drop kar diya. Users directly DB me bana ke JWT khud sign kiya, taaki register ka asli email na jaaye.

| Case | Result |
|---|---|
| Unknown route | `404 Route GET /api/nope not found` |
| Token nahi / galat / expire | `401` (alag-alag message) |
| Normal user ne system route hit kiya | `401 ... not a system user` |
| Tuta JSON, login bina body, galat password | `400`, `400`, `401` |
| Register validation (galat email + chhota name/password) | `400` (teeno messages) |
| Account nahi hai, balance / transfer | `404` / `400` clear message |
| Account dobara create | `400 Account already created` |
| Galat `toAccount` id | `400 Invalid value for _id` |
| Initial funds, same key dobara, system account pe | `201`, `200 already completed`, `400` |
| Insufficient balance transfer | `400` |
| Real transfer (session + commit) | `201`, balance `40` aaya |
| Accounts list | sirf Bob (apna + system account nahi) |

Handler pe direct bhi check kiya: `code 11000` -> `409`, unexpected error -> `500` (dev me `error` field, production me nahi), `headersSent` -> `next(err)`.

### Aage kaise use karna hai (rule of thumb)

```js
// 1. Validation / business rule fail -> throw
if (!amount) throw new ApiError(400, 'Amount is required');

// 2. Success -> sendResponse
return sendResponse(res, 201, 'Created', { thing });

// 3. Bug / DB error -> kuch mat karo, throw hone do (handler 500 bana dega)
const data = await Model.find();   // try/catch ki zaroorat nahi
```

- Sirf wahin `try/catch` likho jahan cleanup chahiye (jaise MongoDB session abort), aur wahan bhi end me `throw error`.
- `res.status(...).json(...)` aur `return sendResponse(res, 4xx...)` ab error ke liye mat likhna.

### Files ka summary

| File | Kya hua |
|---|---|
| `src/utils/ApiError.js` | naya |
| `src/middleware/error.middleware.js` | naya (`notFoundHandler`, `errorHandler`) |
| `src/app.js` | handlers lagaye (routes ke baad) |
| `src/controllers/account.controller.js` | 4xx -> `throw ApiError` |
| `src/controllers/auth.controller.js` | `try/catch` hataya, login guard, email alag `try/catch` |
| `src/controllers/transaction.controller.js` | 4xx -> `throw ApiError`, `catch` me abort + `throw error` |
| `src/middleware/auth.middleware.js` | `try/catch` hataya, `throw ApiError` |


## Step 19: Swagger (API documentation + try karne ki jagah)

### Swagger kya hai? (beginner ke liye)

Ab tak API test karne ke liye `request.http` ya Postman use hota tha. Problem: dusre ko ya khud ko baad me yaad nahi rehta ki kaun si API hai, kya body leti hai, kya response deti hai.

**Swagger UI** ek web page hai jo tumhari saari APIs ki list dikhata hai, aur wahin se **"Try it out" dabake API chala sakte ho**, bina Postman ke. Ye page ek file se banta hai jise **OpenAPI spec** kehte hain (ek JSON jisme likha hota hai: API ka path, method, body, response).

Teen naam confuse karte hain:

| Naam | Kya hai |
|---|---|
| **OpenAPI** | API describe karne ka standard format (JSON/YAML). Ye "specification" hai. |
| **Swagger UI** | Us spec ko padhke sundar page banane wala tool. |
| **swagger-jsdoc** | Tumhare code ke comments se OpenAPI spec **khud banata hai**. |

### Hamara flow (kaun kya karta hai)

```
routes/*.js me @openapi comments (YAML)
        |
        v   swagger-jsdoc padhta hai (config/swagger.js)
OpenAPI spec (ek JS object / JSON)
        |
        v   swagger-ui-express dikhata hai (app.js)
http://localhost:9000/api-docs   <-- browser me ye page khulta hai
```

Spec ko seedha JSON me bhi dekh sakte ho: `http://localhost:9000/api-docs.json` (Postman me import karne ke kaam aata hai).

### Step 1: Packages install

```bash
npm install swagger-ui-express swagger-jsdoc
```

- `swagger-ui-express`: Express app me Swagger UI page lagata hai.
- `swagger-jsdoc`: comments se spec banata hai.
- `package.json` ke `dependencies` me dono aa gaye (ye production me bhi chahiye, isliye dev dependency nahi).

### Step 2: Config file banayi: `src/config/swagger.js`

Isme 3 hisse hain.

**(a) `info`**: docs ka title, version, description (isme "Swagger me login kaise karein" bhi likha hai).

```js
definition: {
    openapi: '3.0.3',
    info: { title: 'Backend Ledger API', version: '1.0.0', description: '...' },
    servers: [{ url: '/' }],   // jis host/port pe docs khule hain, requests wahin jaayengi
    tags: [{ name: 'Auth' }, { name: 'User' }, { name: 'Accounts' }, { name: 'Transactions' }],
```

- `tags` se APIs page par groups me dikhti hain.

**(b) `components`**: baar-baar kaam aane wale tukde, ek baar likho aur `$ref` se jahan chahiye wahan lagao (jaise functions).

```js
components: {
    securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },   // login ka tareeka
    },
    responses: { Unauthorized: {...}, BadRequest: {...}, NotFound: {...} },    // common error responses
    schemas:   { ErrorResponse, User, Account, Transaction },                  // data ki shape
}
```

- `bearerAuth` = request ke header me `Authorization: Bearer <token>` (hamare `authMiddleware` jaisa).
- `$ref: '#/components/schemas/Account'` ka matlab "wahan upar jo `Account` shape likhi hai wo yahan use karo".

**(c) `apis`**: kin files me comments scan karne hain.

```js
apis: [path.join(__dirname, '../routes/*.js')],
```

- `__dirname` se absolute path banaya, taaki server kisi bhi folder se start ho, files mil jaayein. (Relative `./src/routes/*.js` likhte to sirf project root se chalane par kaam karta.)

Last me: `const swaggerSpec = swaggerJSDoc(options); module.exports = swaggerSpec;`

### Step 3: Routes me `@openapi` comments likhe

Har route ke upar ek comment block. Andar **YAML** hota hai (indentation matter karti hai!). Example `src/routes/account.routes.js` se:

```js
/**
 * @openapi
 * /api/accounts/balance:            <- path
 *   get:                            <- method
 *     tags: [Accounts]              <- kis group me dikhega
 *     summary: Apne account ka balance
 *     security:
 *       - bearerAuth: []            <- ye route protected hai (page pe lock icon aata hai)
 *     responses:
 *       200:
 *         description: Current balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance: { type: number, example: 150 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'   <- common error reuse
 */
router.get('/balance', authMiddleware, getBalanceController);
```

Body wali API me `requestBody` bhi hota hai (transfer ka example):

```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required: [toAccount, amount, idempotencyKey]
        properties:
          toAccount: { type: string, example: 665f1c2e9b1e8a0012a4b999 }
          amount: { type: number, minimum: 0.01, example: 40 }
          idempotencyKey: { type: string, example: txn-2026-0001 }
```

- `example` wahi value hai jo "Try it out" me pehle se bhari aati hai.
- Jis API me login chahiye wahan `security: - bearerAuth: []`, jahan nahi chahiye (register, login, logout) wahan nahi likha.

Kul **9 operations** document hue:

| Tag | APIs |
|---|---|
| Auth | `POST /api/auth/register`, `login`, `logout` |
| User | `GET /api/me` |
| Accounts | `POST /api/accounts`, `GET /api/accounts`, `GET /api/accounts/balance` |
| Transactions | `POST /api/transactions`, `POST /api/transactions/system/initial-funds` |

### Step 4: `app.js` me page lagaya

```js
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, { swaggerOptions: { persistAuthorization: true } }),
);
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
```

- `swaggerUi.serve` page ki static files (JS/CSS) deta hai, `swaggerUi.setup(spec)` page banata hai.
- `persistAuthorization: true`: Authorize me daala token page refresh ke baad bhi yaad rehta hai.
- Ye **error handlers (404) se pehle** hai (Step 18 ka order bigda nahi), warna `/api-docs` ko 404 mil jaata.

### Step 5: Kaise use karna hai (step by step)

1. Server chalao: `npm run dev`
2. Browser me kholo: **http://localhost:9000/api-docs**
3. Pehle **`POST /api/auth/register`** ya **`login`** kholo, **Try it out** dabao, body bharo, **Execute**.
4. Response me `token` aayega. Usse copy karo (quotes ke bina).
5. Page ke upar **Authorize** button dabao, token paste karo (**`Bearer` mat likhna**, wo khud lag jaata hai), Authorize.
6. Ab lock wale APIs (`/api/me`, `/api/accounts/balance`, transfer...) chalenge.
7. System user ke APIs ke liye system user ka token Authorize me daalna padega.

### Gotchas (aksar galti yahin hoti hai)

- **YAML indentation:** comment ke andar space ek bhi idhar-udhar hua to spec me wo API nahi dikhegi ya error aayega. Space use karo, tab nahi.
- **Colon wali text quotes me likho:** `summary: "[System user only] Kisi account me funds daalo"` (bina quotes ke `:` ya `[` YAML ko confuse kar dete hain).
- **Naya route banaya to uska `@openapi` comment bhi likho**, warna wo docs me nahi aayega (code aur docs ek jagah hain, isliye yaad rakhna aasaan hai).
- **Cookie wali baat:** login karne par server cookie `jwt_token` bhi set karta hai, aur browser same site par use khud bhej deta hai. Isliye kabhi-kabhi Authorize ke bina bhi protected API chal jaati hai. Logout chalao ya cookie delete karo to wo band ho jaayega.
- **Token commit mat karna / kisi ko share mat karna.** `persistAuthorization` token browser ke localStorage me rakhta hai.
- `/api-docs` ek `301` redirect karke `/api-docs/` pe jaata hai, ye normal hai.
- Production me docs public rakhne se pehle sochna (chaho to `NODE_ENV !== 'production'` pe hi mount karo).

### Naya API add karoge to docs kaise likhna (template)

```js
/**
 * @openapi
 * /api/<path>:
 *   <get|post|patch|delete>:
 *     tags: [<Group>]
 *     summary: <ek line me kya karta hai>
 *     security:
 *       - bearerAuth: []        # sirf protected API me
 *     requestBody:              # sirf body wali API me
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field: { type: string, example: abc }
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
```

### Verify kaise kiya

- `swagger-jsdoc` se spec bana: **9 operations** mile.
- Server chalake check: `/api-docs` (`301` -> `/api-docs/` `200` HTML), `swagger-ui-bundle.js` `200`, `/api-docs.json` `200` JSON.
- Spec ko OpenAPI validator (`swagger-cli validate`) se chalaya: **valid**.
- Purane routes bigde nahi: `/api/nope` ab bhi JSON `404`, `/api/me` bina token `401`.
- Browser me page maine khud nahi kholi, tum `http://localhost:9000/api-docs` kholke ek baar dekh lena.

### Files ka summary

| File | Kya hua |
|---|---|
| `package.json` | `swagger-ui-express`, `swagger-jsdoc` add |
| `src/config/swagger.js` | naya: spec config (info, security, reusable components, kahan scan karna hai) |
| `src/routes/auth.routes.js` | `@openapi` comments (register, login, logout) |
| `src/routes/user.routes.js` | `@openapi` comment (`/api/me`) |
| `src/routes/account.routes.js` | `@openapi` comments (create, list, balance) |
| `src/routes/transaction.routes.js` | `@openapi` comments (transfer, initial funds) |
| `src/app.js` | `/api-docs` (UI) aur `/api-docs.json` (spec) mount |

### Test ke dauran mili ek important baat (roadmap me sahi kiya)

Amount validation test karte waqt pata chala ki negative amount block hota hai (model ka `min: 0.01`), jabki maine roadmap me ulta likha tha. Roadmap ka A1 ab test ke hisaab se sahi kar diya hai (kya sach me problem hai: string amount, 3 decimals, float galti, self transfer).


## Swagger Setup Guide (zero se, beginner ke liye)

> Upar **Step 19** me ye bataya hai ki is project me Swagger kaise lagaya gaya. Ye section alag hai: **bilkul zero se**, ye maan ke ki tumne kabhi Swagger setup nahi kiya. Isko padhke tum kisi bhi naye Express project me khud Swagger laga sakte ho.
>
> Pehle chhoti example (`/ping`) se seekhenge, phir batayenge ki is project me wahi cheez kahan hai.

### Is guide ka plan

1. Swagger kya hai aur kyu chahiye
2. Jo shabd confuse karte hain (OpenAPI, Swagger UI, swagger-jsdoc, YAML)
3. Shuru karne se pehle kya chahiye
4. Setup, 10 chhote steps
5. YAML ka 5 minute crash course
6. Swagger page ko padhna kaise hai
7. Galti ho to kya dikhta hai aur fix kaise karein (test karke likha hai)
8. Naya API add karte waqt checklist
9. Naye project me 5 minute ka quick setup (copy-paste)
10. Glossary

---

### 1. Swagger kya hai aur kyu chahiye

Maan lo tumne 10 APIs bana li. Ab sawal:

- Kaun si API ka path kya hai? (`/api/accounts/balance`)
- Konsa method hai? (`GET` ya `POST`)
- Body me kya bhejna hai? (`toAccount`, `amount`...)
- Login chahiye ya nahi?
- Response kaisa aayega?

Ye sab yaad rakhna ya Postman me manually likhna mushkil hai. **Swagger** isi ka hal hai: ek web page jo saari APIs ki list dikhata hai, aur **wahin se API chala bhi sakte ho** ("Try it out" button).

Fayde:

| Fayda | Matlab |
|---|---|
| **Documentation** | Dusra developer (ya 2 mahine baad tum khud) page dekhke samajh jaaye |
| **Testing** | Postman khole bina browser se hi API chalao |
| **Hamesha updated** | Docs code ke bagal me hi likhe hain, to bhoolna mushkil hai |
| **Standard** | Postman, code generators sab is format ko samajhte hain |

### 2. Jo shabd confuse karte hain

| Shabd | Simple matlab | Analogy |
|---|---|---|
| **API / endpoint** | Ek URL + method, jaise `POST /api/auth/login` | Restaurant ka ek menu item |
| **OpenAPI** | API ko describe karne ka **standard format** (JSON ya YAML). Version abhi `3.0.3` use kar rahe hain | Menu likhne ka format |
| **Swagger UI** | OpenAPI ko padhke sundar page banane wala **tool** | Menu ko chhapne wala printer |
| **swagger-jsdoc** | Tumhare **code ke comments** padhke OpenAPI file **khud banata hai** | Tum notes likho, wo menu bana de |
| **swagger-ui-express** | Swagger UI ko **Express me lagane** wala package | Printer ko Express se jodne ki wire |
| **JSDoc comment** | `/** ... */` wala comment jo function/route ke upar likhte hain | Code ke upar sticky note |
| **YAML** | `key: value` wali simple text format. OpenAPI yahi use karta hai (neeche crash course hai) | Notes likhne ki bhasha |
| **Spec** | Final OpenAPI file/object (jisme saari APIs ka description hota hai) | Poora menu |

Note: **Swagger** naam ab aam bolchaal me OpenAPI + Swagger UI dono ke liye use hota hai. Dono sunoge to ghabrana nahi.

### 3. Shuru karne se pehle kya chahiye

- Node.js + Express app jo chal raha ho (`npm run dev` se server start ho).
- Kam se kam ek route (jaise `POST /api/auth/login`).
- Terminal project folder me khula ho (jahan `package.json` hai).

Is project me: Express 5, entry `server.js`, app config `src/app.js`, routes `src/routes/*.js`.

### 4. Setup: 10 chhote steps

#### Step 1: Packages install karo

```bash
npm install swagger-ui-express swagger-jsdoc
```

- `swagger-ui-express`: page dikhata hai.
- `swagger-jsdoc`: comments se spec banata hai.
- Ye `dependencies` me jaate hain (dev me nahi), kyunki server chalte waqt chahiye.

Check: `package.json` me ye dono dikhne chahiye.

#### Step 2: Config file banao (`src/config/swagger.js`)

Ye file batati hai: docs ka title kya hoga, aur comments **kin files me** dhoondhne hain.

**Sabse chhota working version** (itna kaafi hai shuru karne ke liye):

```js
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.3',                                  // OpenAPI ka version
        info: {
            title: 'My API',                               // page ke upar title
            version: '1.0.0',
        },
    },
    apis: [path.join(__dirname, '../routes/*.js')],        // kin files me comments dhoondhne hain
};

module.exports = swaggerJSDoc(options);                     // spec bana ke export
```

Line by line:

| Line | Matlab |
|---|---|
| `openapi: '3.0.3'` | Hum OpenAPI ka kaun sa version use kar rahe hain. Is value ko waise hi rakho |
| `info.title` / `info.version` | Docs page ke upar dikhne wala naam aur version |
| `apis: [...]` | **Sabse important.** Yahan jo files likhi hongi, sirf unhi ke `@openapi` comments padhe jaayenge |
| `path.join(__dirname, '../routes/*.js')` | `src/config` se ek folder upar `routes` ke saare `.js` files. `*` = koi bhi naam |
| `__dirname` kyu | Ye is file ka folder hai. Isse server kisi bhi folder se start ho, path sahi rahega. Sirf `'./src/routes/*.js'` likhte to wo "jahan se `node` chalaya wahi se" dhoondhta, aur galat folder se chalane par kuch na milta |
| `module.exports = swaggerJSDoc(options)` | Spec ban ke bahar nikalta hai, taaki `app.js` use kar sake |

**Is project me:** `src/config/swagger.js` isi ka bada version hai (isme login, common errors aur data shapes bhi hain, wo Step 7 aur 8 me samjhaunga).

#### Step 3: `app.js` me Swagger page lagao

`src/app.js` me **2 cheezein** add karo.

**(a) Upar imports me:**

```js
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
```

**(b) Routes se pehle (ya routes ke saath, par 404 handler se pehle):**

```js
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Optional: raw spec JSON me bhi chahiye (Postman me import karne ke liye)
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
```

Line by line:

| Line | Matlab |
|---|---|
| `'/api-docs'` | Browser me ye URL khologe to docs dikhenge. Naam badal sakte ho (jaise `/docs`) |
| `swaggerUi.serve` | Page ki zaroori files (JS, CSS) deta hai |
| `swaggerUi.setup(swaggerSpec)` | Hamare spec se page banata hai |
| `/api-docs.json` | Wahi spec JSON me. Debug karne me bahut kaam aata hai (neeche dekhoge) |

**Order ka dhyaan (is project me):** `app.js` ke end me `notFoundHandler` aur `errorHandler` hain. Swagger ki lines unse **pehle** honi chahiye, warna `/api-docs` ko "route not found" `404` mil jaayega.

Is project ka `app.js`:

```js
app.use(express.json());
app.use(cookieParser());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { swaggerOptions: { persistAuthorization: true } }));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

app.use('/api/auth', authRouter);
...
app.use(notFoundHandler);   // sabse last
app.use(errorHandler);
```

(`persistAuthorization: true` ka matlab Step 7 me.)

#### Step 4: Pehli API ka doc likho (comment ke roop me)

Ab server ko batana hai ki ye API exist karti hai. Route ke **upar** ek special comment likhte hain jo `@openapi` se shuru hota hai.

Pehle sabse simple example (koi login nahi, koi body nahi):

```js
/**
 * @openapi
 * /ping:
 *   get:
 *     summary: Server zinda hai ya nahi
 *     responses:
 *       200:
 *         description: pong
 */
router.get('/ping', pingController);
```

Is comment ko tod ke samjho:

| Line | Matlab |
|---|---|
| `/** ... */` | Normal JSDoc comment. Har line `*` se shuru hoti hai |
| `@openapi` | **Jadoo ka shabd.** swagger-jsdoc sirf wahi comments uthata hai jisme ye likha ho. Iske bina comment ignore hoga |
| `/ping:` | API ka **path** (jo URL me aata hai). Ye `router.get('/ping')` wale path jaisa hi hona chahiye, poora (`/api/...` prefix ke saath, jaise `/api/auth/login`) |
| `get:` | **HTTP method** (`get`, `post`, `put`, `patch`, `delete`), chhote akshar me |
| `summary:` | Page par ek line ka title |
| `responses:` | Kaun-kaun se response aa sakte hain. **Ye zaroori hai** |
| `200:` | HTTP status code |
| `description: pong` | Us response ka matlab |

> **Yaad rakho:** comment ke andar jo likha hai wo **YAML** hai, aur YAML me **spaces (indentation)** hi structure batate hain. Neeche YAML crash course hai.

**Prefix wali baat (is project me):** `app.js` me `app.use('/api/auth', authRouter)` hai, aur `auth.routes.js` me `router.post('/login')`. To asli URL `/api/auth/login` hai, aur **comment me poora path** likhna hai:

```js
/**
 * @openapi
 * /api/auth/login:       <- poora path, sirf '/login' nahi
 *   post:
 ...
 */
router.post('/login', userLoginController);
```

#### Step 5: Server chalao aur page dekho

```bash
npm run dev
```

Browser me kholo: **http://localhost:9000/api-docs** (port `.env` ke `PORT` jo hai wahi).

Kya dikhna chahiye:

```
 Backend Ledger API  1.0.0
 ┌ Auth ───────────────────────────────┐
 │ POST /api/auth/register   Naya user register karo │
 │ POST /api/auth/login      Login karo              │
 │ POST /api/auth/logout     Logout karo             │
 └─────────────────────────────────────┘
 ┌ Accounts ... ┐
```

Dikha? To setup ho gaya.

**Pehla debug trick:** agar page khula par APIs nahi dikhi, to kholo **http://localhost:9000/api-docs.json**. Isme `"paths": { ... }` dikhega. Agar `paths` khaali `{}` hai, to swagger-jsdoc ko tumhare comments mile hi nahi (Step 2 ka `apis` path ya `@openapi` check karo, troubleshooting me details hain).

Note: `npm run dev` nodemon use karta hai, to routes file save karte hi server restart hota hai. Bas browser me page **refresh** karo.

#### Step 6: "Try it out" se API chalao

1. Kisi API pe click karke kholo (jaise `POST /api/auth/login`).
2. **Try it out** button dabao.
3. Request body ka box editable ho jaata hai, usme `example` wali values pehle se bhari hongi. Badlo.
4. **Execute** dabao.
5. Neeche **Response** me status code (`200`, `401`...) aur body dikhegi. Saath me `curl` command bhi milti hai (jo terminal me chala sakte ho).

Ye wahi API hit karta hai jo Postman karta, bas tum browser me ho.

#### Step 7: Login wali (protected) APIs ke liye "Authorize"

Hamari kai APIs me login zaroori hai (`/api/me`, `/api/accounts/balance`...). Unke liye 2 kaam:

**(a) Config me batao ki login ka tareeka kya hai** (`src/config/swagger.js` ke `definition` ke andar):

```js
components: {
    securitySchemes: {
        bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
        },
    },
},
```

Matlab: "login ka token `Authorization: Bearer <token>` header me jaata hai". Ye wahi hai jo hamara `authMiddleware` padhta hai.

**(b) Jis API me login chahiye, uske comment me `security` likho:**

```js
/**
 * @openapi
 * /api/me:
 *   get:
 *     summary: Logged in user ki info
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User info
 */
```

- `bearerAuth` naam wahi hona chahiye jo (a) me rakha. Spelling mismatch hui to lock kaam nahi karega.
- `- bearerAuth: []` me `-` YAML list ka item hai, aur `[]` ka matlab "koi extra scope nahi".
- Public APIs (register, login, logout) me `security` **mat** likhna.

**Ab use kaise karein:**

1. `POST /api/auth/login` chalao, response me `token` milega (lamba text).
2. Token ko copy karo, **quotes ke bina**.
3. Page ke upar right me **Authorize** (hara button, lock icon) dabao.
4. Box me token paste karo. **`Bearer` mat likhna**, Swagger khud lagata hai.
5. **Authorize** phir **Close**.
6. Ab lock wali APIs `Try it out` se chalengi. Lock ab "band" dikhta hai.

`persistAuthorization: true` (jo `swaggerUi.setup` me diya hai) ka matlab: page refresh karne par token yaad rahe, baar-baar paste na karna pade. (Ye token browser ke `localStorage` me rehta hai, isliye kisi ko share mat karna.)

**Cookie wali ek chhoti baat:** login karne par hamara server `jwt_token` naam ki cookie bhi set karta hai, aur browser use same site par khud bhej deta hai. To kabhi-kabhi **Authorize kiye bina bhi** protected API chal jaati hai. Ye bug nahi hai. Test karna ho ki "bina login ke kya hota hai", to pehle `POST /api/auth/logout` chalao.

#### Step 8: Baar-baar likhne se bacho: `components` aur `$ref`

Dekho: har protected API ka `401` response ek jaisa hai. Har jagah copy-paste karna galat hai. Isliye ek baar likhte hain, aur baaki jagah **reference** (`$ref`) dete hain. Ye programming ke "function" jaisa hai.

**Ek baar `swagger.js` me likho:**

```js
components: {
    responses: {
        Unauthorized: {
            description: 'Token missing / invalid / expired',
            content: {
                'application/json': {
                    example: { message: 'Unauthorized access, token is missing', status: 'failed' },
                },
            },
        },
    },
},
```

**Phir kisi bhi route me bas ye likho:**

```yaml
responses:
  401:
    $ref: '#/components/responses/Unauthorized'
```

`$ref: '#/components/responses/Unauthorized'` ka matlab: "us file ke `components` > `responses` > `Unauthorized` wala hissa yahan laga do". `#` ka matlab "isi spec ke andar".

Isi tarah **data ki shape** (`schemas`) bhi reuse hoti hai. Is project me `User`, `Account`, `Transaction` banaye hain:

```js
schemas: {
    Account: {
        type: 'object',
        properties: {
            _id: { type: 'string' },
            status: { type: 'string', enum: ['ACTIVE', 'FROZEN', 'CLOSED'] },
            currency: { type: 'string', example: 'INR' },
        },
    },
},
```

Route me use:

```yaml
account: { $ref: '#/components/schemas/Account' }
```

Is project ke reusable pieces:

| Type | Naam |
|---|---|
| `responses` | `Unauthorized`, `BadRequest`, `NotFound` |
| `schemas` | `ErrorResponse`, `User`, `Account`, `Transaction` |
| `securitySchemes` | `bearerAuth` |

#### Step 9: Alag-alag type ki APIs kaise document karein

Ye cheat sheet hai. Jo API jaisi ho, waisa pattern copy karo.

**(a) GET, bina login, bina body**

```yaml
/api/ping:
  get:
    summary: Health check
    responses:
      200:
        description: OK
```

**(b) POST jisme JSON body jaati hai** (jaise login):

```yaml
/api/auth/login:
  post:
    summary: Login karo
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [email, password]            # inke bina request galat
            properties:
              email: { type: string, example: rishabh@example.com }
              password: { type: string, example: password123 }
    responses:
      200:
        description: Login ho gaya
      401:
        description: Email ya password galat
```

- `required: [...]` me jo naam hain, Swagger page unko `* required` dikhata hai.
- `type` options: `string`, `number`, `integer`, `boolean`, `array`, `object`.
- `example` Try it out me pehle se bhar jaata hai.
- Number limit: `{ type: number, minimum: 0.01 }`. Text length: `{ type: string, minLength: 8 }`. Fixed options: `{ type: string, enum: [ACTIVE, FROZEN] }`.

**(c) Protected API** (login chahiye): upar wale kisi bhi pattern me ye add karo:

```yaml
security:
  - bearerAuth: []
```

**(d) URL me id wali API** (path parameter, jaise `GET /api/accounts/:accountId`). *Abhi is project me ye API nahi hai, aage banegi to kaam aayega.* Dhyaan: OpenAPI me `:accountId` ki jagah `{accountId}` likhte hain.

```yaml
/api/accounts/{accountId}:
  get:
    summary: Ek account ki info
    parameters:
      - in: path
        name: accountId
        required: true
        schema: { type: string }
        description: Account ki id
    responses:
      200:
        description: Account mil gaya
      404:
        $ref: '#/components/responses/NotFound'
```

**(e) Query parameter wali API** (jaise `GET /api/transactions?page=1&limit=10`). *Ye bhi abhi project me nahi hai (roadmap me hai).*

```yaml
/api/transactions:
  get:
    summary: Transaction history
    parameters:
      - in: query
        name: page
        schema: { type: integer, default: 1 }
      - in: query
        name: limit
        schema: { type: integer, default: 10, maximum: 50 }
    responses:
      200:
        description: Transactions ki list
```

**(f) Ek hi path pe 2 methods** (is project me `/api/accounts` pe `POST` aur `GET` dono hain): dono ke **alag-alag `@openapi` comment blocks** likhe hain, har route ke upar ek. Ek hi block me bhi likh sakte ho, par alag block zyada saaf rehta hai.

**(g) Array wala response** (list):

```yaml
accounts:
  type: array
  items:
    type: object
    properties:
      accountId: { type: string }
      name: { type: string }
```

**(h) Alag-alag status codes ko alag documentation:** hamare transfer API me `201` (success), `200` (pehle hi complete), `202` (pending), `400`, `401`, `409` sab likhe hain. Jitne codes asli me aa sakte hain, utne likho.

#### Step 10: Tags se APIs ko groups me baanto

Page par APIs groups me dikhti hain (Auth, Accounts...). Iske liye 2 jagah:

**(a) `swagger.js` me group ke naam aur description:**

```js
tags: [
    { name: 'Auth', description: 'Register, login, logout' },
    { name: 'Accounts', description: 'Account create, list, balance' },
],
```

**(b) Har route ke comment me:** `tags: [Accounts]`.

Jis API ka tag nahi hota wo `default` group me chali jaati hai. Naam ki spelling dono jagah same rakho.

---

### 5. YAML ka 5 minute crash course

Comments ke andar sab kuch YAML hai. Itna jaanna kaafi hai:

**1. `key: value`** (colon ke baad **ek space** zaroori):

```yaml
summary: Login karo
```

**2. Indentation = andar ka hissa.** 2 spaces se ek level andar. **Tab mat use karo, sirf spaces.**

```yaml
post:                  # level 0
  summary: Login       # level 1: post ke andar
  responses:           # level 1
    200:               # level 2: responses ke andar
      description: OK  # level 3: 200 ke andar
```

**3. List (`-`)**:

```yaml
tags:
  - Auth
  - Accounts
```

**4. Chhota (inline) likhne ka tareeka** (curly `{}` object ke liye, square `[]` list ke liye):

```yaml
email: { type: string, example: a@b.com }
required: [email, password]
```

Ye upar wale lambe version jaisa hi hai, bas ek line me.

**5. Special characters wali text ko quotes me likho.** YAML me `:` (colon + space), `[`, `{`, `#` ka khaas matlab hota hai. Text me ye aaye to quotes lagao:

```yaml
summary: "[System user only] Funds daalo"     # sahi
summary: [System user only] Funds daalo       # GALAT, YAML confuse ho jaata hai
```

**6. Lambi description ke liye `|`** (har line ka alag-alag line rehna):

```yaml
description: |
  Pehli line.
  Doosri line.
```

**7. Comment ke andar har line `*` se shuru** hoti hai. `*` ke baad ek space aur phir YAML. Poore block me **same alignment** rakho:

```js
/**
 * @openapi
 * /api/me:
 *   get:                  <- `*` ke baad 3 spaces, ye path ke andar hai
 *     summary: Info       <- 5 spaces, get ke andar
 */
```

---

### 6. Swagger page ko padhna kaise hai

```
┌─────────────────────────────────────────────────────────┐
│ Backend Ledger API 1.0.0           [ Authorize 🔓 ]  <-- token yahan daalo
│ (description yahan dikhti hai)                           │
│                                                          │
│ ▼ Auth                      <-- tag (group)              │
│   POST /api/auth/login   Login karo       <-- ek API     │
│   ...                                                    │
│ ▼ Accounts                                               │
│   GET  /api/accounts/balance  🔒          <-- 🔒 = login chahiye
│                                                          │
│ ▼ Schemas                   <-- components.schemas       │
└─────────────────────────────────────────────────────────┘
```

Ek API kholne par:

| Hissa | Matlab |
|---|---|
| **Parameters** | URL/query me kya dena hai |
| **Request body** | Body ka example, `Example Value` aur `Schema` tab me |
| **Try it out / Execute** | API chalane ke liye |
| **Responses** | Kaun-kaun se status codes aa sakte hain (tumne jo likha) |
| **Server response** | Execute karne ke baad **asli** response (code, body, headers) |
| **Curl** | Wahi request terminal command ke roop me |

---

### 7. Galti ho to kya dikhta hai aur fix kaise karein

Ye sab maine **khud test karke** likha hai. Sabse important baat: **galti hone par server crash nahi hota**, bas wo API docs me **chupchap gayab** ho jaati hai. Isliye "page me API nahi dikhi" ka matlab hai ki kuch galat likha hai.

| Dikkat | Kya hota hai | Wajah / Fix |
|---|---|---|
| Page khula par saari APIs gayab (`paths` khaali) | `/api-docs.json` me `"paths": {}` | `apis` ka path galat hai. `path.join(__dirname, '../routes/*.js')` check karo (folder ka naam, `../` ki ginti) |
| Ek hi API gayab | Baaki dikhti hain | Us comment me `@openapi` likha hi nahi, ya YAML galat hai (neeche wali row) |
| Terminal me `YAMLSyntaxError: All collection items must start at the same column` dikha | Server chalta rehta hai, par **us poori file** ki APIs docs se gayab | Indentation galat. Us file ke saare comments check karo, spaces barabar karo, **tab hatao** |
| Wahi `YAMLSyntaxError`, line `summary: [System ...] ...` | Wahi | Text me `[`, `:` hai. **Quotes me likho** (`summary: "..."`) |
| `/api-docs` par "Route not found" `404` JSON | Error handler se match ho gaya | `app.use('/api-docs', ...)` ko `notFoundHandler` se **pehle** rakho |
| `Cannot GET /api-docs` | Route mounted nahi hai | `app.js` me `app.use('/api-docs', ...)` add karo aur server restart karo |
| `/api-docs` ne `301` diya | Normal | `/api-docs/` (aakhir me `/`) pe redirect hota hai, kuch fix nahi karna |
| Lock dikha par `401 token is missing` aaya | Token bheja hi nahi gaya | **Authorize** me token daala? Token sahi copy kiya (quotes ke bina)? `security` me naam `bearerAuth` hi hai? |
| Authorize kiya par `401 token is invalid` | Token galat/expire | Dobara login karke naya token lo. Token ke aage `Bearer` mat likhna |
| Comment badla par page me purana dikha | Browser purana page dikha raha hai | Server restart hua? Page **hard refresh** karo (Cmd+Shift+R) |
| Path ke aage `/api/...` nahi likha, API alag dikhi | Docs me `/login` aaya, asli `/api/auth/login` hai | Comment me **poora path** likho (prefix ke saath) |
| Spec validate karne par `must have required property 'responses'` aata hai | `swagger-jsdoc` kuch nahi bolta, par spec **invalid** hai (validator pakadta hai) | Har method me `responses:` zaroori hai, kam se kam ek status code |
| `paths` me `"get"` naam ki ajeeb entry | Comment me `/path:` wali line likhi hi nahi | `@openapi` ke turant baad `/api/...:` wali line likho |
| Authorize ka button hi nahi dikha | `securitySchemes` config me nahi hai | `components.securitySchemes.bearerAuth` add karo |

**Debug karne ka 3-step tarika (jab bhi kuch na dikhe):**

1. `http://localhost:9000/api-docs.json` kholo, dekho `paths` me tumhari API hai ya nahi.
2. Terminal (jahan server chal raha hai) me `YAMLSyntaxError` dhoondo. Wo bata deta hai kaun si file aur kaun si line.
3. Spec valid hai ya nahi, ye check karna ho to `.json` ko save karke:

```bash
npx @redocly/cli lint spec.json
```

(Ya online `editor.swagger.io` me spec paste karke error dekh sakte ho.)

---

### 8. Naya API banao to ye checklist follow karo

- [ ] Route aur controller bana liya.
- [ ] Route ke **upar** `@openapi` comment likha (`@openapi` shabd ke saath).
- [ ] Path **poora** likha (`/api/...`), method chhote akshar me (`get`, `post`...).
- [ ] `tags` diya aur wo `swagger.js` ke `tags` me exist karta hai.
- [ ] `summary` ek line me likha.
- [ ] Protected hai to `security: - bearerAuth: []`.
- [ ] Body leta hai to `requestBody` + `required` + `example` values.
- [ ] URL me `{id}` ya `?page=` hai to `parameters`.
- [ ] `responses` me jitne codes asli me aa sakte hain (success + `400`/`401`/`404`...).
- [ ] Common errors ke liye `$ref` use kiya (copy-paste nahi).
- [ ] Server restart hua, `/api-docs` refresh karke API dikhi.
- [ ] `Try it out` se ek baar chalake dekha ki docs aur asli behaviour match karte hain.

**Sabse badi aadat:** docs aur code ko saath me update karo. Agar API ki body badli (naya field aaya), to comment bhi usi waqt badlo. Purana doc bina doc ke se zyada nuksaan karta hai.

---

### 9. Naye project me 5 minute ka quick setup (copy-paste)

Maan lo ek naya Express project hai jisme `src/app.js` aur `src/routes/` hai.

**1. Install:**

```bash
npm install swagger-ui-express swagger-jsdoc
```

**2. `src/config/swagger.js` banao:**

```js
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

module.exports = swaggerJSDoc({
    definition: {
        openapi: '3.0.3',
        info: { title: 'My API', version: '1.0.0' },
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
    },
    apis: [path.join(__dirname, '../routes/*.js')],
});
```

**3. `src/app.js` me:**

```js
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

**4. Kisi route ke upar comment:**

```js
/**
 * @openapi
 * /api/hello:
 *   get:
 *     summary: Hello bolo
 *     responses:
 *       200:
 *         description: Hello
 */
router.get('/hello', helloController);
```

**5. Server chalao, browser me kholo:** `http://localhost:<PORT>/api-docs`. Ho gaya.

Baaki sab (components, tags, `$ref`, params) isi base par upar ke steps ke hisaab se jodte jao.

---

### 10. Glossary (chhota shabdkosh)

| Shabd | Matlab |
|---|---|
| **Endpoint** | Ek API ka address + method (`POST /api/auth/login`) |
| **Spec** | OpenAPI ki file / object jisme saari APIs ka description hai |
| **Path** | URL ka hissa (`/api/me`) |
| **Operation** | Ek path + ek method ka combination. Is project me 9 hain |
| **Tag** | APIs ka group naam |
| **Schema** | Data ki shape (kaun se fields, kaun sa type) |
| **`$ref`** | "Wahan likha hua tukda yahan laga do" |
| **Component** | Reusable tukda (schemas, responses, securitySchemes) |
| **Bearer token** | Header me `Authorization: Bearer <token>` wala login token (JWT) |
| **Request body** | POST/PATCH me jo JSON bhejte hain |
| **Path parameter** | URL ke andar ka variable (`/accounts/{id}`) |
| **Query parameter** | URL me `?` ke baad wale (`?page=1`) |
| **Try it out** | Page se API chalane wala button |
| **Authorize** | Page par token daalne wala button |
| **persistAuthorization** | Refresh ke baad bhi token yaad rakhne wali setting |
| **swagger-jsdoc** | Comments se spec banane wala package |
| **swagger-ui-express** | Spec se page banane aur Express me lagane wala package |

### Aage kya seekh sakte ho

- Docs ko sirf development me dikhana: `if (process.env.NODE_ENV !== 'production') { app.use('/api-docs', ...) }`.
- Spec ko `/api-docs.json` se **Postman me import** karo (Import > Link).
- Naye APIs aaye (history, statement, revert...) to har ek ka `@openapi` comment likhne ki practice karo (roadmap dekho).
- Validation (`zod`/`joi`) aane par request schema aur docs ek hi jagah se banane ke tareeke (`zod-to-openapi`) bhi hote hain.


## Roadmap: Aage kya-kya develop karna hai (TODO list)

Ye section "future plan" hai. Jo cheez ho jaaye, uska checkbox `[x]` karke upar ke steps me uski entry (kya, kyu, kaise) likhni hai.

### Ab tak kya ban chuka hai (quick snapshot)

| Area | Done |
|---|---|
| Auth | `POST /api/auth/register`, `login`, `logout` |
| User | `GET /api/me` |
| Account | `POST /api/accounts`, `GET /api/accounts` (list), `GET /api/accounts/balance` |
| Transaction | `POST /api/transactions` (transfer), `POST /api/transactions/system/initial-funds` |
| Common | `sendResponse` helper, `ApiError` + global error handler, auth + system user middleware, MongoDB session transactions |
| Docs | Swagger UI at `/api-docs` |

### Priority order (suggested)

1. [ ] Amount validation + self transfer block (neeche Section A)
2. [ ] `GET /api/transactions` (history + pagination)
3. [ ] `GET /api/accounts/statement`
4. [ ] Account freeze / close
5. [ ] Transaction revert
6. [ ] Password change + forgot password
7. [ ] Rate limiting, tests, docs (global error handler ho gaya, Step 18)

Is order ka reason: pehle security hole band ho, phir history dekhna, phir ledger ke advanced kaam (revert) jisme sabse zyada seekhne ko milega.

---

### Section A: Pehle fix karne wali cheezein (bugs / security)

#### A1. Amount validation

- [ ] **Pehle maine yahan likha tha ki negative amount se ulta paisa nikal sakte hain. Wo galat tha.** Test karke dekha (Step 19 ke time): `transaction.model.js` me `amount` pe `min: 0.01` hai, aur transaction `create` ledger entries se **pehle** hota hai. Isliye negative amount par `400 Amount must be greater than 0` aata hai aur kuch save nahi hota (rollback). Security hole nahi hai. Lekin ledger model ke `amount` pe `min` nahi hai, wo sirf is order ki wajah se bacha hua hai.
- [ ] **Jo problems sach me hain (test se confirm):**

  | Input | Abhi kya hota hai |
  |---|---|
  | `"10"` (string) | `201`, chal jaata hai (Mongoose number me cast kar deta hai) |
  | `"abc"` | `400`, par message Mongoose ka lamba Cast error hai |
  | `10.123` (3 decimals) | `201`, chal jaata hai |
  | float galti | 100 me se 10.123 bheja to balance `79.87700000000001` aaya |
  | `0` | `400`, par message "Missing required fields" (galat wajah batata hai, kyunki `!amount` check `0` ko missing samajhta hai) |
  | validation ka time | DB queries (accounts, balance) ke **baad** hota hai, pehle hona chahiye |

- [ ] **Kya karna hai:**
  - Controller ke shuru me hi: `typeof amount === 'number'`, `Number.isFinite(amount)`, `amount > 0`, max limit, max 2 decimal places. Dono controllers me.
  - Ledger model ke `amount` me bhi `min: 0.01` (double safety).
  - Better: amount **paise (integer)** me store karo (`10.50` -> `1050`), taaki float galti na aaye.
- [ ] **Seekhoge:** input validation, floating point problem, money ko integer me kaise rakhte hain.

#### A2. Self transfer block

- [ ] `fromAccount` aur `toAccount` same ho to `400` ("Cannot transfer to your own account"). Abhi aisa transfer chal jaata hai (test karke confirm kiya: `201` aata hai aur ledger me DEBIT + CREDIT dono entries ban jaati hain).

#### A3. Transfer me race condition (double spend)

- [ ] **Problem:** Balance check (step 5) aur ledger write (step 6-9) alag-alag hain. Same user do transfer **ek saath** bheje to dono balance check pass kar sakte hain aur balance negative ho sakta hai.
- [ ] **Kya karna hai:** balance check ko bhi session ke andar karo, aur account document pe write lock lo (jaise account me ek `version`/`updatedAt` field update karke), taaki Mongo transaction conflict de aur ek retry/fail ho.
- [ ] **Seekhoge:** concurrency, write conflict, optimistic locking. Banking me ye sabse important topic hai.

#### A4. Idempotency key ka race

- [x] **Abhi kya hai:** `transaction.model.js` me `idempotencyKey` pe `unique: true` hai, to DB level pe duplicate transaction ban nahi sakti.
- **Problem tha:** do request same `idempotencyKey` se **ek saath** aayein to dono `findOne` check pass kar leti hain. Dusri request `create` pe duplicate key error (`code 11000`) khaati thi, jo generic `500` ban jaata tha.
- **Ab (Step 18):** global error handler `11000` ko pakad leta hai aur `409 Duplicate value for: idempotencyKey` deta hai. Isse behtar response (existing transaction ka status) dena abhi baaki hai.

#### A5. Chhote cleanups

- [ ] `createTransactionController` me `currentUser` ab use hota hai, par baaki unused variables / imports check karo.
- [ ] Failed transaction par status `FAILED` set karna: abhi error aaye to rollback ho jaata hai par koi `FAILED` record nahi bachta. Audit ke liye bahar (session ke bahar) ek `FAILED` record rakhna achha hai.
- [x] `register` me email fail hone par dobara response bhejne ki koshish hoti thi (`ERR_HTTP_HEADERS_SENT`). Step 18 me email ko alag `try/catch` me daal diya, ab sirf log hota hai.
- [ ] `/api/accounts` list me abhi pagination nahi hai (Section B1 jaisa add karo).

---

### Section B: Transaction aur ledger APIs

#### B1. `GET /api/transactions` (transaction history)

- [ ] **Auth:** `authMiddleware`
- [ ] **Query params:** `page` (default 1), `limit` (default 10, max 50), `status` (optional), `type` (`sent` / `received` / all), `from` / `to` (date range)
- [ ] **Logic:**
  - Logged in user ka account nikalo.
  - Filter: `{ $or: [{ fromAccount: id }, { toAccount: id }] }`.
  - `sort({ createdAt: -1 })`, `skip((page-1) * limit)`, `limit(limit)`.
  - Har item me `direction: 'SENT' | 'RECEIVED'` add karo (user ke account ke hisaab se).
  - `populate` se dusre account ke user ka name.
- [ ] **Response:** `{ transactions: [...], pagination: { page, limit, total, totalPages } }`
- [ ] **Seekhoge:** pagination, `$or`, `countDocuments`, sorting, populate, query params validate karna.
- [ ] **Index:** `fromAccount + createdAt` aur `toAccount + createdAt` pe compound index (fast list ke liye).

#### B2. `GET /api/transactions/:id` (ek transaction ki detail)

- [ ] **Auth:** `authMiddleware`
- [ ] **Logic:** transaction fetch karo, aur check karo ki logged in user ka account `fromAccount` ya `toAccount` hai. Nahi hai to `403` (ya `404`, taaki pata na chale ki id exist karti hai).
- [ ] **Edge cases:** invalid ObjectId (`400`), transaction nahi mila (`404`).
- [ ] **Seekhoge:** **ownership / authorization check** (authentication aur authorization me fark), `mongoose.isValidObjectId`.

#### B3. `GET /api/accounts/statement` (account statement)

- [ ] **Auth:** `authMiddleware`
- [ ] **Query params:** `from`, `to` (date range), `page`, `limit`
- [ ] **Logic:** ledger collection se us account ki entries (`type`, `amount`, `transaction`, date) nikalo, date se sort karo, aur har entry ke baad **running balance** dikhao (aggregation `$setWindowFields` ya JS me cumulative sum).
- [ ] **Response:** opening balance, entries list, closing balance.
- [ ] **Note:** abhi ledger schema me `createdAt` nahi hai (`timestamps` option nahi laga). Isliye pehle ledger schema me `{ timestamps: true }` add karna padega (immutable fields ke saath ye safe hai).
- [ ] **Seekhoge:** MongoDB aggregation pipeline, window functions, accounting statement ka concept.

#### B4. `POST /api/transactions/:id/revert` (transaction ulti karna)

- [ ] **Auth:** system user / admin (normal user nahi)
- [ ] **Logic (ek session me):**
  - Original transaction `COMPLETED` honi chahiye aur pehle revert nahi hui honi chahiye.
  - Nayi transaction banao (`toAccount` -> `fromAccount`), uske naye DEBIT/CREDIT ledger entries.
  - Original ki ledger entries **delete / edit nahi** karni (ledger immutable hai, ye uska point hai).
  - Original ka status `REVERTED`, aur nayi me `revertOf: originalId` field.
- [ ] **Edge cases:** receiver ka balance kam ho gaya ho (insufficient), account frozen ho.
- [ ] **Seekhoge:** reversal entries (accounting me delete nahi karte, ulti entry daalte hain), immutability ka real use.

#### B5. `GET /api/transactions/by-key/:idempotencyKey`

- [ ] Client ko apni request ka result dobara dekhna ho (network timeout ke baad) to idempotency key se transaction status. Idempotency ka practical use.

#### B6. Transaction email notification

- [ ] Transfer `COMPLETED` hone par sender ko "debited" aur receiver ko "credited" email (tumhari `email.service.js` ready hai).
- [ ] Email session commit ke **baad** bhejo, aur email fail hone par transfer fail na ho (try/catch alag).
- [ ] Better: queue (BullMQ + Redis) se bhejo. Abhi seedha bhi chalega.

---

### Section C: Account management APIs

#### C1. `PATCH /api/accounts/status` (freeze / close)

- [ ] **Auth:** user (apna account `CLOSED` kar sake), admin/system (`FROZEN` kar sake)
- [ ] **Body:** `{ status: 'FROZEN' | 'CLOSED' | 'ACTIVE' }`
- [ ] **Rules:**
  - Allowed transitions: `ACTIVE -> FROZEN`, `FROZEN -> ACTIVE`, `ACTIVE/FROZEN -> CLOSED`. `CLOSED` se wapas nahi.
  - `CLOSED` karne se pehle balance `0` hona chahiye.
  - Frozen / closed account se transfer block (Step 4 ka check pehle se hai).
- [ ] **Seekhoge:** state machine (allowed transitions), role-based permission.

#### C2. `GET /api/accounts/:accountId`

- [ ] Kisi ek account ki basic info. Apna ho to poori info, dusre ka ho to sirf `name` (privacy).
- [ ] **Dhyaan:** `/balance` aur `/:accountId` dono hon to `/balance` ko **upar** define karo, warna `balance` ko `:accountId` samajh lega.

#### C3. `GET /api/accounts/lookup?email=...`

- [ ] Receiver ko email se dhoondhna, taaki transfer se pehle confirm ho ("Rishabh ko bhej rahe ho?"). Sirf `accountId` aur `name` return karo, email / balance nahi.
- [ ] Rate limit zaroori (warna kisi ke email ki list nikaali ja sakti hai).

#### C4. Multiple accounts per user (optional, bada change)

- [ ] Abhi ek user = ek account. Savings / current type ke multiple accounts allow karna ho to `accountType` field, `GET /api/accounts/mine`, aur balance/transfer APIs me `accountId` lena padega (`/api/accounts/:accountId/balance`).

#### C5. Account list me pagination + search

- [ ] `GET /api/accounts?page=&limit=&search=` (name se search).

---

### Section D: User aur auth APIs

#### D1. `PATCH /api/me` (profile update)

- [ ] Sirf allowed fields (`name`). `email`, `role`, `systemUser`, `password` is route se **nahi** badalne chahiye (whitelisting). Mass assignment se bachne ke liye `req.body` seedha `update` me mat daalo.

#### D2. `PATCH /api/me/password` (password change)

- [ ] **Body:** `{ currentPassword, newPassword }`
- [ ] Purana password `comparePassword` se verify karo, naya password schema ke rules (min 8) se. `password` me `select: false` hai, to `.select('+password')` lagao.
- [ ] Password badalne ke baad purane tokens invalid karna (D5 se connect).

#### D3. `POST /api/auth/forgot-password` aur `POST /api/auth/reset-password`

- [ ] **Forgot:** email lo, random token banao (`crypto.randomBytes`), uska **hash** DB me expiry (15 min) ke saath rakho, aur reset link email karo. Email exist kare ya na kare, response same do (user enumeration se bachne ke liye).
- [ ] **Reset:** token + new password lo, hash match + expiry check, password update, token delete.

#### D4. Email verification

- [ ] Register ke baad verify link email, `isEmailVerified` field, unverified user ko transfer block.

#### D5. Proper logout / token invalidation

- [ ] **Problem:** abhi logout sirf cookie clear karta hai. Header se bheja hua token expire (3 din) tak chalta hai.
- [ ] **Options:** (a) token blacklist (Redis me token + expiry, `authMiddleware` me check), (b) short-lived access token (15 min) + refresh token (DB me, rotate hota hai).
- [ ] **Seekhoge:** JWT ki limits, refresh token flow. Bada aur important topic hai.

#### D6. `DELETE /api/me` (account delete / deactivate)

- [ ] Soft delete: `isActive: false` (field pehle se hai). Balance `0` hona chahiye, account `CLOSED` karo. Login me `isActive` check.

#### D7. Login me `isActive` check

- [ ] Abhi disabled user (`isActive: false`) bhi login kar sakta hai. `userLoginController` aur `authMiddleware` me check lagao.

#### D8. Role based access (admin)

- [ ] `adminMiddleware` (`role === 'admin'`). Admin APIs:
  - `GET /api/admin/users` (list + pagination)
  - `GET /api/admin/accounts`
  - `GET /api/admin/transactions`
  - `PATCH /api/admin/accounts/:id/status` (freeze)
- [ ] Abhi system user alag concept hai (bank), admin alag (staff). Dono ko mix mat karo.

---

### Section E: Quality, safety aur production readiness

| Cheez | Kya karna hai | Kaise |
|---|---|---|
| **Input validation** | Har route ka body/query validate | `zod` ya `joi`, ek reusable `validate(schema)` middleware |
| **Global error handler** | **Ho gaya (Step 18).** `catch` ke 500 blocks ek jagah | `ApiError` class + `error.middleware.js`, `sendResponse` ke saath |
| **Rate limiting** | Login, register, transfer, forgot-password pe | `express-rate-limit` |
| **Security headers + CORS** | Basic hardening | `helmet`, `cors` (allowed origin config) |
| **Logging** | `console.log` ki jagah proper logs | `pino` ya `winston`, request id |
| **Env validation** | Server start pe `.env` check | `JWT_SECRET`, `MONGO_URI` missing ho to fail fast |
| **Tests** | Transfer flow ke automated tests | `jest` + `supertest` + `mongodb-memory-server` (replica set mode) |
| **API docs** | **Ho gaya (Step 19).** Swagger | `swagger-ui-express` + `swagger-jsdoc` |
| **Request collection** | `request.http` ko complete rakhna | Har naye API ka example add karo |
| **Seed script** | System user + test data ek command me | `scripts/seed.js` (abhi system user DB me manually banana padta hai) |
| **Docker compose** | Mongo replica set + app ek command me | `docker-compose.yml` (abhi `mongo-rs` manually chalaya tha) |
| **Prettier / ESLint** | Code style consistency | ESLint add karo (Prettier pehle se hai) |
| **Money as integer** | Floating point se bachna | Amount paise me store karo (A1 dekho) |
| **DB indexes review** | Slow queries se bachna | `idempotencyKey` unique, ledger `account` + `createdAt`, transaction `fromAccount`/`toAccount` |

### Section F: Advanced / stretch goals (jab upar ka sab ho jaaye)

- [ ] **Transaction limits:** daily transfer limit per account, per-transaction max.
- [ ] **Scheduled / recurring transfers:** cron job (`node-cron`) ya queue.
- [ ] **Beneficiaries (saved payees):** `POST/GET/DELETE /api/beneficiaries`.
- [ ] **Transaction PIN:** transfer se pehle 4-6 digit PIN verify (hashed).
- [ ] **Audit log:** kaun kya kab kiya (admin actions, freeze, revert) ka alag collection.
- [ ] **Reconciliation job:** roz check kare ki saare ledger entries ka total (CREDIT - DEBIT) `0` hai ya nahi (double-entry ka rule). Mismatch ho to alert.
- [ ] **Multi currency:** exchange rate, alag currency ke accounts ke beech transfer.
- [ ] **Postgres + Prisma/Drizzle migration:** ledger jaise kaam ke liye relational DB (ACID, constraints) zyada safe hai. Seekhne ke liye same project ko migrate karke dekho.
- [ ] **Frontend (React):** login, dashboard (balance), transfer form, history table. Ye API ko end-to-end test karne ka bhi achha tareeka hai.

### Har naye feature par yaad rakhna (workflow)

1. Route + controller banao, `sendResponse` use karo.
2. Input validate karo, aur ownership / role check karo.
3. Kuch bhi do ya zyada collections me likhna ho to MongoDB session (transaction) me likho.
4. `request.http` me example add karo.
5. Readme me naya Step likho (kya, kyu, kaise) aur is roadmap me checkbox `[x]` karo.
6. Commit se pehle readme update, phir commit + push.
