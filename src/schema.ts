import { GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLNonNull, GraphQLList, GraphQLSchema } from "graphql";
import { GraphQLDate } from 'graphql-iso-date';
import { ObjectIdScalar } from './graphql-objectid';
import {  getGraphQLUpdateArgs, getMongoDbUpdateResolver, getGraphQLInsertType } from "graphql-to-mongodb";
import { Db } from "mongodb";
import * as util from "./schemaUtil";

const Pts = new GraphQLObjectType({
  name: 'Pts',
  fields: () => ({
    _id: { type: ObjectIdScalar},
    birthdate: { type: new GraphQLNonNull(GraphQLDate) },
    gender: { type: new GraphQLNonNull(GraphQLString)},
    name: { type: new GraphQLNonNull(GraphQLString) },
    firstname: { type: new GraphQLNonNull(GraphQLString) },
    middlename: { type: GraphQLString },
  })
})

const Drs = new GraphQLObjectType({
  name: 'Drs',
  fields: () => ({
    _id: { type: ObjectIdScalar },
    specialization: { type: new GraphQLNonNull(GraphQLString) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    firstname: { type: new GraphQLNonNull(GraphQLString) },
    middlename: { type: GraphQLString },
  })
})

const Cases = new GraphQLObjectType({
  name: 'Cases',
  fields: () => ({
    _id: { type: ObjectIdScalar },
    id: { type: new GraphQLNonNull(GraphQLInt) },
    pt: { type: new GraphQLNonNull(GraphQLString) },
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
    pts: util.getMongoDbQueryField(Pts, ({ db }: { db: Db }) => db.collection('patients')),
    cases: util.getMongoDbQueryField(Cases, ({ db }: { db: Db }) => db.collection('cases')),
    drs: util.getMongoDbQueryField(Drs, ({ db }: { db: Db }) => db.collection('doctors')),
  })
})

const MutationType = new GraphQLObjectType({
  name: 'MutationType',
  fields: () => ({
    insertPt: util.insDefault(Pts, 'patients'),
    updatePts: util.updDefault(Pts, 'patients'),
    deletePts: util.delDefault(Pts, 'patients'),
    insertDr: util.insDefault(Drs, 'doctors'),
    updateDrs: util.updDefault(Drs, 'doctors'),
    deleteDrs: util.delDefault(Drs, 'doctors'),
    insertCase: {
      type: new GraphQLList(Cases),
      args: { input: { type: getGraphQLInsertType(Cases) } },
      resolve: async (obj, args, { db }: { db: Db }) => {
        
        if (await util.hasNoFkEntry(args.input.px, db.collection('patients'))) {
          throw new Error(
            "Pt does not exist."
          );
        }

        if (await util.idExists(args.input.id, args.input.px, db.collection('cases'))) {
          throw new Error(
            "Case Id exists already."
          );
        }

        if (args.input.surgeon && await util.hasNoFkEntry(args.input.surgeon, db.collection('doctors'))) {
          throw new Error(
            "Dr does not exist."
          );
        }

        if (args.input.firstassist && await util.hasNoFkEntry(args.input.firstassist, db.collection('doctors'))) {
          throw new Error(
            "Dr does not exist."
          );
        }

        const result = await db.collection('cxes').insertOne(args.input);
        return result.ops;
      }
    },
    updateCases: {
      type: GraphQLInt,
      args: getGraphQLUpdateArgs(Cases) as any,
      resolve: getMongoDbUpdateResolver(Cases,
        async (filter, update, options, projection, obj, args, { db }: { db: Db }) => {
          if (update.$set.hasOwnProperty('pt')) {
            if (await util.hasNoFkEntry(update.$set.px, db.collection('patients'))) {
              throw new Error(
                "Pt does not exist."
              );
            }
          }
          if (update.$set.hasOwnProperty('surgeon')) {
            if (await util.hasNoFkEntry(update.$set.surgeon, db.collection('doctors'))) {
              throw new Error(
                "Dr does not exist."
              );
            }
          }
          if (update.$set.hasOwnProperty('firstassist')) {
            if (await util.hasNoFkEntry(update.$set.firstassist, db.collection('doctors'))) {
              throw new Error(
                "Dr does not exist."
              );
            }
          }
          const result = await db.collection('cases').updateMany(filter, update, options);
          return result.modifiedCount;
        }, {
        differentOutputType: true,
        validateUpdateArgs: true
      })
    },
    deleteCases: util.delDefault(Cases, 'cases'),
  })
})

const Schema = new GraphQLSchema({
  query: QueryType,
  mutation: MutationType
})

export default Schema;
