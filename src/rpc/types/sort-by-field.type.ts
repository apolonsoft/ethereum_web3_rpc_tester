import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SortByField {
  @Field(() => Number, { nullable: true })
  anyField?: number;
}
