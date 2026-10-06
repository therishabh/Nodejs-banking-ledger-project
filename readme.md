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

`fromAccount`, `toAccount`, `amount`, `idempotencyKey` me se koi missing ho to `400`.

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
