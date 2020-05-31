import { GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLNonNull, GraphQLList, GraphQLSchema } from "graphql";
import { GraphQLDate } from 'graphql-iso-date';
import { getGraphQLQueryArgs, getMongoDbQueryResolver, getGraphQLUpdateArgs, getMongoDbUpdateResolver, getGraphQLInsertType, getGraphQLFilterType, getMongoDbFilter } from "graphql-to-mongodb";
import { Collection, Db } from "mongodb";

const getMongoDbQueryField = (type: GraphQLObjectType, getCollection: (context: any) => Collection) => ({
  type: new GraphQLList(type),
  args: getGraphQLQueryArgs(type) as any,
  resolve: getMongoDbQueryResolver(type,
    async (filter, projection, options, obj, args, context) => {
      return await getCollection(context).find(filter, { ...options, projection }).toArray();
    })
})

const Px = new GraphQLObjectType({
  name: 'Px',
  fields: () => ({
    birthdate: { type: GraphQLDate },
    name: { type: GraphQLString },
    firstname: { type: GraphQLString },
    middlename: { type: GraphQLString },
  })
})

const QueryType = new GraphQLObjectType({
  name: 'QueryType',
  fields: () => ({
    px: getMongoDbQueryField(Px, ({ db }: { db: Db }) => db.collection('pxes')),
  })
})

const MutationType = new GraphQLObjectType({
  name: 'MutationType',
  fields: () => ({
    updatePxes: {
      type: GraphQLInt,
      args: getGraphQLUpdateArgs(Px) as any,
      resolve: getMongoDbUpdateResolver(Px,
        async (filter, update, options, projection, obj, args, { db }: { db: Db }) => {
          const result = await db.collection('pxes').updateMany(filter, update, options);
          return result.modifiedCount;
        }, {
        differentOutputType: true,
        validateUpdateArgs: true
      })
    },
    insertPx: {
      type: new GraphQLList(Px),
      args: { input: { type: getGraphQLInsertType(Px) } },
      resolve: async (obj, args, { db }: { db: Db }) => {
        const result = await db.collection('pxes').insertOne(args.input);
        return result.ops;
      }
    },
    deletePxes: {
      type: GraphQLInt,
      args: { filter: { type: new GraphQLNonNull(getGraphQLFilterType(Px)) } },
      resolve: async (obj, args, { db }: { db: Db }) => {
        const filter = getMongoDbFilter(Px, args.filter);
        const result = await db.collection('pxes').deleteMany(filter)
        return result.deletedCount;
      }
    }
  })
})

const Schema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType
})

export default Schema;
