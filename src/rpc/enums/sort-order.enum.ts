import { registerEnumType } from '@nestjs/graphql';

export enum SortOrder {
  ASC,
  DESC,
}

registerEnumType(SortOrder, {
  name: 'SortOrder',
});
