import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  InternalServerErrorException,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Get('health')
  health() {
    return { status: 'ok', root: process.cwd() };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Télécharger un fichier' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
        ];
        if (
          !file.originalname.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/i) ||
          !allowedMimeTypes.includes(file.mimetype)
        ) {
          return callback(
            new Error(
              'Seuls les images (jpg, png, gif) et les documents PDF sont autorisés !',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      // Diagnostic check: what did we actually receive?
      const body = req.body;
      const contentType = req.headers['content-type'];
      throw new BadRequestException(
        `Fichier non trouvé. Type reçu: ${contentType}. Champs body: ${JSON.stringify(Object.keys(body))}`,
      );
    }

    try {
      const mediaType = typeof req.body?.type === 'string' ? req.body.type.toLowerCase() : 'uploads';
      const folder = `edoteam/users/${req.user.id}/${mediaType}`;
      const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
      const uploaded = await this.cloudinaryService.upload(file.buffer, folder, resourceType);

      return {
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
        mimetype: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Erreur lors de l’upload Cloudinary:', error instanceof Error ? error.message : String(error));
      throw new InternalServerErrorException(
        'Erreur lors de l’upload du fichier.',
      );
    }
  }
}
