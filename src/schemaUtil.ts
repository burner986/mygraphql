import { GraphQLObjectType, GraphQLList, GraphQLInt, GraphQLNonNull  } from "graphql";
import { getMongoDbFilter, getGraphQLQueryArgs, getMongoDbQueryResolver, getGraphQLUpdateArgs, getMongoDbUpdateResolver, getGraphQLInsertType, getGraphQLFilterType } from "graphql-to-mongodb";
import { Collection, Db, ObjectId } from "mongodb";

export const getMongoDbQueryField = (type: GraphQLObjectType, getCollection: (context: any) => Collection) => ({
  type: new GraphQLList(type),
  args: getGraphQLQueryArgs(type) as any,
  resolve: getMongoDbQueryResolver(type,
    async (filter, projection, options, obj, args, context) => {
      return await getCollection(context).find(filter, { ...options, projection }).toArray();
    })
})

export const updDefault = (xx: GraphQLObjectType, col: string) => {
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

export const insDefault = (xx: GraphQLObjectType, col: string) => {
  return {
    type: new GraphQLList(xx),
    args: { input: { type: getGraphQLInsertType(xx) } },
    resolve: async (obj, args, { db }: { db: Db }) => {
      const result = await db.collection(col).insertOne(args.input);
      return result.ops;
    }
  }
}

export const delDefault = (xx: GraphQLObjectType, col: string) => {
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

export const hasNoFkEntry = async (id: string, col: Collection) => {
  const result = await col.find({ _id: { '$eq': new ObjectId(id) } }).toArray();
  return result.length === 0 ? true : false;
}

export const idExists = async (id: Int16Array, px: string, col: Collection) => {
  const result = await col.find({ id: { '$eq': id }, px: { '$eq': px } }).toArray();
  return result.length > 0 ? true : false;
}