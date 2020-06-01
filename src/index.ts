import * as express from 'express';
import * as graphqlHTTP from 'express-graphql';
import schema from './schema';
import connect from './db';
import * as exjwt from 'express-jwt';
import * as dotenv from "dotenv";
import * as jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());

app.use(exjwt({ 
  secret: process.env.ACCESS_SECRET
}).unless({ path: ['/login', '/token'] }));

// Frontend
app.get('/', (req, res) => {
  res.json({
    message: 'Haha! Hihi! ' + req.user.username
  });
});

// Backend
connect().then(db => app
  .use('/api', graphqlHTTP({
    schema,
    context: { db },
    graphiql: true
  }))
  .listen(port, () => {
    console.log('GraphQL listening on 3000')
  }));

// Auth related
app.post('/login', (req, res) => {
  // authenticate user first (video)
  // console.log(req.method);

  const username = req.body.username;
  const user = { id: 1, username: username }

  const accessToken = jwt.sign(user, process.env.ACCESS_SECRET, {expiresIn: '15m'});
  const refreshToken = jwt.sign(user, process.env.REFRESH_SECRET);
  //TODO: save refreshToken to Db

  res.json({ accessToken: accessToken, refreshToken: refreshToken});
});

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

app.post('/logout', (req, res) => {
  const refreshToken = req.body.token;
  //logout user, invalidate refreshToken = save token in a blacklist and check this
})


// app.use(function (err, req, res, next) {
//   if (401 == err.status) {
//     res.redirect('/login')
//   }
// });