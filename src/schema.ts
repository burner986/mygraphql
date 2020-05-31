import { GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLNonNull, GraphQLList, GraphQLSchema } from "graphql";
import { GraphQLDate } from 'graphql-iso-date';
import { ObjectIdScalar } from './graphql-objectid';
import { 
  getGraphQLQueryArgs, 
  getMongoDbQueryResolver, 
  getGraphQLUpdateArgs, 
  getMongoDbUpdateResolver, 
  getGraphQLInsertType, 
  getGraphQLFilterType, 
  getMongoDbFilter } from "graphql-to-mongodb";
import { Collection, Db, ObjectId  } from "mongodb";

const getMongoDbQueryField = (type: GraphQLObjectType, getCollection: (context: any) => Collection) => ({
  type: new GraphQLList(type),
  args: getGraphQLQueryArgs(type) as any,
  resolve: getMongoDbQueryResolver(type,
    async (filter, projection, options, obj, args, context) => {
      return await getCollection(context).find(filter, { ...options, projection }).toArray();
    })
})

const updDefault = (xx: GraphQLObjectType, col: string) => {
  return {
    type: GraphQLInt,
    args: getGraphQLUpdateArgs(xx) as any,
    resolve: getMongoDbUpdateResolver(xx,
      async (filter, update, options, projection, obj, args, { db }: { db: Db }) => {
        const result = await db.collection(col).updateMany(filter, update, options);
        return result.modifiedCount;
      }, {
      differentOutputType: true,
      validateUpdateArgs: true
    })
  }
}

const insDefault = (xx: GraphQLObjectType, col: string) => {
  return {
    type: new GraphQLList(xx),
    args: { input: { type: getGraphQLInsertType(xx) } },
    resolve: async (obj, args, { db }: { db: Db }) => {
      const result = await db.collection(col).insertOne(args.input);
      return result.ops;
    }
  }
}

const delDefault = (xx: GraphQLObjectType, col: string) => {
  return {
    type: GraphQLInt,
    args: { filter: { type: new GraphQLNonNull(getGraphQLFilterType(xx)) } },
    resolve: async (obj, args, { db }: { db: Db }) => {
      const filter = getMongoDbFilter(xx, args.filter);
      const result = await db.collection(col).deleteMany(filter)
      return result.deletedCount;
    }
  }
}

const hasNoFkEntry = async (id: string, col: Collection) => {
  const result = await col.find({ _id: { '$eq': new ObjectId(id) } }).toArray();
  return result.length === 0 ? true : false;
}

const idExists = async (id: Int16Array, px: string, col: Collection) => {
  const result = await col.find({ id: { '$eq': id }, px: { '$eq': px}}).toArray();
  return result.length > 0 ? true : false;
}

const Px = new GraphQLObjectType({
  name: 'Px',
  fields: () => ({
    _id: { type: ObjectIdScalar},
    birthdate: { type: new GraphQLNonNull(GraphQLDate) },
    gender: { type: new GraphQLNonNull(GraphQLString)},
    name: { type: new GraphQLNonNull(GraphQLString) },
    firstname: { type: new GraphQLNonNull(GraphQLString) },
    middlename: { type: GraphQLString },
  })
})

const Dx = new GraphQLObjectType({
  name: 'Dx',
  fields: () => ({
    _id: { type: ObjectIdScalar },
    specialization: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    firstname: { type: new GraphQLNonNull(GraphQLString) },
    middlename: { type: GraphQLString },
  })
})

const Cx = new GraphQLObjectType({
  name: 'Cx',
  fields: () => ({
    _id: { type: ObjectIdScalar },
    id: { type: new GraphQLNonNull(GraphQLInt) },
    px: { type: new GraphQLNonNull(GraphQLString) },
    surgeon: { type: GraphQLString },
    firstassist: { type: GraphQLString },
    prediag: { type: new GraphQLNonNull(GraphQLString) },
    procedure: { type: GraphQLString },
    postdiag: { type: GraphQLString },
    biopsy: { type: GraphQLString },
    disposition: { type: GraphQLString },
  })
})

const QueryType = new GraphQLObjectType({
  name: 'QueryType',
  fields: () => ({
    px: getMongoDbQueryField(Px, ({ db }: { db: Db }) => db.collection('pxes')),
    cx: getMongoDbQueryField(Cx, ({ db }: { db: Db }) => db.collection('cxes')),
    dx: getMongoDbQueryField(Dx, ({ db }: { db: Db }) => db.collection('dxes')),
  })
})

const MutationType = new GraphQLObjectType({
  name: 'MutationType',
  fields: () => ({
    insertPx: insDefault(Px, 'pxes'),
    updatePxes: updDefault(Px, 'pxes'),
    deletePxes: delDefault(Px, 'pxes'),
    insertDx: insDefault(Dx, 'dxes'),
    updateDxes: updDefault(Dx, 'dxes'),
    deleteDxes: delDefault(Dx, 'dxes'),
    insertCx: {
      type: new GraphQLList(Cx),
      args: { input: { type: getGraphQLInsertType(Cx) } },
      resolve: async (obj, args, { db }: { db: Db }) => {
        
        if (await hasNoFkEntry(args.input.px, db.collection('pxes'))) {
          return null;
        }

        if (await idExists(args.input.id, args.input.px, db.collection('cxes'))) {
          return null;
        }

        if (args.input.surgeon && await hasNoFkEntry(args.input.surgeon, db.collection('dxes'))) {
          return null;
        }

        if (args.input.firstassist && await hasNoFkEntry(args.input.firstassist, db.collection('dxes'))) {
          return null;
        }

        const result = await db.collection('cxes').insertOne(args.input);
        return result.ops;
      }
    },
    updateCxes: {
      type: GraphQLInt,
      args: getGraphQLUpdateArgs(Cx) as any,
      resolve: getMongoDbUpdateResolver(Cx,
        async (filter, update, options, projection, obj, args, { db }: { db: Db }) => {
          if (update.$set.hasOwnProperty('px')) {
            if (await hasNoFkEntry(update.$set.px, db.collection('pxes'))) {
              return null;
            }
          }
          if (update.$set.hasOwnProperty('surgeon')) {
            if (await hasNoFkEntry(update.$set.surgeon, db.collection('dxes'))) {
              return null;
            }
          }
          if (update.$set.hasOwnProperty('firstassist')) {
            if (await hasNoFkEntry(update.$set.firstassist, db.collection('dxes'))) {
              return null;
            }
          }
          const result = await db.collection('cxes').updateMany(filter, update, options);
          return result.modifiedCount;
        }, {
        differentOutputType: true,
        validateUpdateArgs: true
      })
    },
    deleteCxes: {
      type: GraphQLInt,
      args: { filter: { type: new GraphQLNonNull(getGraphQLFilterType(Cx)) } },
      resolve: async (obj, args, { db }: { db: Db }) => {
        const filter = getMongoDbFilter(Cx, args.filter);
        const result = await db.collection('cxes').deleteMany(filter)
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
