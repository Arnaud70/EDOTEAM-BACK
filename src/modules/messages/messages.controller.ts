import { Controller, Post, Get, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'uuid-du-destinataire' })
  @IsNotEmpty()
  receiverId: string;

  @ApiProperty({ example: 'Bonjour, je suis intéressé par votre service.', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}

@ApiTags('💬 Messagerie')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @ApiOperation({ summary: 'Envoyer un message' })
  @Post()
  send(@Request() req, @Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(req.user.id, dto.receiverId, dto.content);
  }

  @ApiOperation({ summary: 'Lister mes conversations' })
  @Get('conversations')
  conversations(@Request() req) {
    return this.messagesService.getConversations(req.user.id);
  }

  @ApiOperation({ summary: 'Lire les messages avec un utilisateur' })
  @Get(':partnerId')
  getMessages(@Request() req, @Param('partnerId') partnerId: string) {
    return this.messagesService.getMessages(req.user.id, partnerId);
  }

  @ApiOperation({ summary: 'Nombre de messages non lus' })
  @Get('unread/count')
  unreadCount(@Request() req) {
    return this.messagesService.unreadCount(req.user.id);
  }
}
