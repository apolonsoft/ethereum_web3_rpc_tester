import { Scalar } from '@nestjs/graphql'
import {JSONObjectScalar} from "~/rpc/scalers/jsonobject.scalar";

export class Transaction {}

@Scalar('Transaction', () => Transaction)
export class TransactionScalar extends JSONObjectScalar {}
