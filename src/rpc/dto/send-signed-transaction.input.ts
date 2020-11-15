import { Field, InputType } from '@nestjs/graphql'
import { IsHexadecimal, IsUUID } from 'class-validator'
import {Blockchain} from "~/rpc/enums/blockchain.enum";
import {InputWithLog} from "~/rpc/interfaces/input-with-log.interface";

@InputType()
export class SendSignedTransactionInput implements InputWithLog {
    @IsUUID()
    uuid: string

    @Field(() => Blockchain)
    blockchain: Blockchain

    @Field(() => String)
    @IsHexadecimal()
    hex: string
}
