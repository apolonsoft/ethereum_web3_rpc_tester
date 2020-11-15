import { Scalar } from '@nestjs/graphql'
import {JSONObjectScalar} from "~/rpc/scalers/jsonobject.scalar";


export class Block {}

@Scalar('Block', () => Block)
export class BlockScalar extends JSONObjectScalar {}
