import * as express from 'express';
import * as graphqlHTTP from 'express-graphql';
import schema from './schema';
import connect from './db';

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.json({
    message: 'Haha! Hihi!'
  });
});

connect().then(db => app
  .use('/api', graphqlHTTP({
    schema,
    context: { db },
    graphiql: true
  }))
  .listen(port, () => {
    console.log('GraphQL listening on 3000')
  }));