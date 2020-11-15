import { Field, InputType } from '@nestjs/graphql'
import { LoggedInput } from '~/rpc/dto/logged.input'
import {SortOrder} from "~/rpc/enums/sort-order.enum";

@InputType()
export class GetHistoryByAddressesInput extends LoggedInput {
    @Field(() => [String])
    addresses: string[]

    @Field(() => SortOrder, { nullable: true, defaultValue: SortOrder.DESC })
    sortOrder?: SortOrder
}
