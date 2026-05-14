import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const MAX_DIMENSION = 10000;

export class CreateImageDTO {
  @ApiProperty({ example: 'cat sleeping', minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 800, minimum: 1, maximum: MAX_DIMENSION })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_DIMENSION)
  width: number;

  @ApiProperty({ example: 600, minimum: 1, maximum: MAX_DIMENSION })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_DIMENSION)
  height: number;
}
