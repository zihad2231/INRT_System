import { IsUUID } from 'class-validator';

export class NoticeIdDto {
  @IsUUID()
  noticeId!: string;
}
