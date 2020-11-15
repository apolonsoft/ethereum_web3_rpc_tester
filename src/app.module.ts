import { Module } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import { ScheduleModule } from '@nestjs/schedule'
import { RpcModule } from './rpc/rpc.module'
import { RestModule } from './rest/rest.module'

@Module({
    imports: [
        GraphQLModule.forRoot({
            installSubscriptionHandlers: true,
            autoSchemaFile: 'schema.gql',
            playground: true,
            introspection: true,
        }),
        ScheduleModule.forRoot(),
        RpcModule,
        RestModule,
    ],
})
export class AppModule {}
