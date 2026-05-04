import { Controller, Post, UseInterceptors, UploadedFile, UseGuards, Request, InternalServerErrorException, BadRequestException, Get } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { promises as fs } from 'fs';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  
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
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
          return callback(new Error('Seules les images sont autorisées !'), false);
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
      throw new BadRequestException(`Fichier non trouvé. Type reçu: ${contentType}. Champs body: ${JSON.stringify(Object.keys(body))}`);
    }

    try {
      const uploadsDir = join(process.cwd(), 'uploads');
      
      // S'assurer que le dossier existe
      await fs.mkdir(uploadsDir, { recursive: true });

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
      const filePath = join(uploadsDir, filename);

      // Écrire le fichier manuellement (plus robuste sur Windows)
      await fs.writeFile(filePath, file.buffer);

      const protocol = req.protocol;
      const host = req.get('host');
      const url = `${protocol}://${host}/uploads/${filename}`;
      
      return {
        url: url,
        filename: filename,
        mimetype: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du fichier:', error);
      throw new InternalServerErrorException('Erreur critique lors de la sauvegarde du fichier sur le serveur.');
    }
  }
}
