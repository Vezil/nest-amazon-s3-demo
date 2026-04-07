import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateImageDTO {
  @ApiProperty({
    example: 'cat sleeping',
    description: 'Image title',
  })
  @IsString()
  title: string;

  @ApiProperty({
    example: 800,
    description: 'Target image width',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width: number;

  @ApiProperty({
    example: 600,
    description: 'Target image height',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height: number;
}
