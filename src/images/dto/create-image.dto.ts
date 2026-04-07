import { IsInt, IsString, Min } from 'class-validator';

export class CreateImageDto {
  @IsString()
  title: string;

  @IsInt()
  @Min(1)
  width: number;

  @IsInt()
  @Min(1)
  height: number;
}
