import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateImageDto {
  @IsString()
  title: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  width: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  height: number;
}
