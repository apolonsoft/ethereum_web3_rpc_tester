import { InterfaceType, Field } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InterfaceType()
export abstract class InputWithLog {
  @Field()
  @IsUUID()
  uuid: string;
}
