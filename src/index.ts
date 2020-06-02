import * as express from 'express';
import * as graphqlHTTP from 'express-graphql';
import schema from './schema';
import connect from './db';
import * as exjwt from 'express-jwt';
import * as dotenv from "dotenv";
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { ObjectId } from "mongodb";

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());

// app.use(exjwt({ 
//   secret: process.env.ACCESS_SECRET
// }).unless({ path: ['/login'] }));

// Frontend
app.get('/', (req, res) => {
  res.json({
    message: 'Haha! Hihi! ' + req.user.username
  });
});

// Backend
connect().then(db => {
  app.use('/api', graphqlHTTP({
      schema,
      context: { db },
      graphiql: true
    }))
    .listen(port, () => {
      console.log('GraphQL listening on 3000')
    })
});

// Auth related
app.post('/login', (req, res) => {
  if (!req.body.username || !req.body.password) return res.sendStatus(400);

  connect().then(async (db) => {
    let existingUsr = await db.collection('drs').findOne({ username: req.body.username });
    if(!existingUsr) return res.sendStatus(403);

    try {
      if (!await bcrypt.compare(req.body.password, existingUsr.password)) {
        res.sendStatus(403);
      } else {
        const username = req.body.username;
        const user = { id: 1, username: username }

        const accessToken = jwt.sign(user, process.env.ACCESS_SECRET, {expiresIn: '15m'});
        const refreshToken = jwt.sign(user, process.env.REFRESH_SECRET);

        db.collection('refreshtokens').insertOne(
          {refreshToken: refreshToken}
        );

        res.json({ accessToken: accessToken, refreshToken: refreshToken});
      };
    }
    catch {
      return res.sendStatus(500);
    }
  });
});

app.post('/login/create', (req, res) => {
  let usr = req.body;

  if (usr._id) {
    if(!usr.username || !usr.password) return res.sendStatus(400);
  } else {
    if (!usr.username ||
      !usr.password ||
      !usr.name ||
      !usr.firstname) return res.sendStatus(400);
  }

  connect().then(async (db) => {
    let result = await db.collection('drs').find({ username: req.body.username }).toArray();
    if (result.length > 0) return res.sendStatus(400);

    
    try {
      const hashedPassword = await bcrypt.hash(usr.password, 10);
      if(usr._id) {
        let existingUsr = await db.collection('drs').findOne({ _id: new ObjectId(usr._id) });
        if(!existingUsr) return res.sendStatus(400);
        if(existingUsr.username || existingUsr.password) return res.sendStatus(400);

        let result = await db.collection('drs').updateOne(
          { _id: {'$eq': new ObjectId(usr._id)}}, {$set: {username: usr.username, password: hashedPassword}}
        );
        if(result.modifiedCount === 1) return res.sendStatus(200);
      } else {
        let result = await db.collection('drs').insertOne(
          Object.assign(usr, { password: hashedPassword })
        );
        if (result.insertedCount === 1) return res.sendStatus(201);
      }

      return res.sendStatus(404);
    }
    catch {
      return res.sendStatus(500);
    }
  })
})

app.post('/login/changepw', (req, res) => {
  let usr = req.body;
  if (!usr.password ||
    !usr._id) return res.sendStatus(400);

  connect().then(async (db) => {
    let existingUsr = await db.collection('drs').findOne({ _id: new ObjectId(usr._id) });
    if (!existingUsr || !existingUsr.username) return res.sendStatus(400);

    try {
      const hashedPassword = await bcrypt.hash(usr.password, 10);

      let result = await db.collection('drs').updateOne(
        { _id: { '$eq': new ObjectId(usr._id) } }, { $set: { password: hashedPassword } }
      );

      if (result && result.modifiedCount === 1) return res.sendStatus(200);

      return res.sendStatus(404);
    }
    catch (ex) { 
      return res.sendStatus(500); 
    }
  })
})

app.post('/token', (req, res) => {
  const refreshToken = req.body.token;
  //check refreshToken against Db
  let dbHasToken = true;
  if (!dbHasToken) return res.sendStatus(403);

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    const accessToken = jwt.sign({name: user.name}, process.env.ACCESS_SECRET, { expiresIn: '15m' });
    res.json({accessToken: accessToken});
  })
})

app.post('/logout', async (req, res) => {
  if (!req.body.token) return res.sendStatus(400);
  const refreshToken = req.body.token;
  
  if(refreshToken) {
    connect().then(async (db) => {
      let existingToken = await db.collection('refreshtokens').findOne({ refreshToken: refreshToken });
      if(existingToken) {
        db.collection('tokenblacklist').insertOne(
          { refreshToken: refreshToken}
        );
        db.collection('refreshtokens').remove({ refreshToken: { '$eq': refreshToken} })
      }
    })
  }
  return res.sendStatus(200);
})