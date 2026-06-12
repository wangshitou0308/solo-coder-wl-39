import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import * as dayjs from 'dayjs';
import { Archive } from './entities/archive.entity';
import { Contract } from '../contract/entities/contract.entity';
import { ContractTimeline } from '../contract/entities/contract-timeline.entity';
import { Signer } from '../signing/entities/signer.entity';
import { QueryArchiveDto } from './dto/query-archive.dto';
import { ContractStatus, UserRole } from '../../common/enums';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PdfService } from '../pdf/pdf.service';

export interface PaginatedArchives {
  data: Archive[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ArchiveService {
  private readonly logger = new Logger(ArchiveService.name);

  constructor(
    @InjectRepository(Archive)
    private readonly archiveRepository: Repository<Archive>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(ContractTimeline)
    private readonly timelineRepository: Repository<ContractTimeline>,
    @InjectRepository(Signer)
    private readonly signerRepository: Repository<Signer>,
    private readonly pdfService: PdfService,
  ) {}

  async archiveContract(contractId: string, user: CurrentUserPayload): Promise<Archive> {
    const existingArchive = await this.archiveRepository.findOne({
      where: { contractId, tenantId: user.tenantId },
    });
    if (existingArchive) {
      throw new BadRequestException('该合同已归档');
    }

    const contract = await this.contractRepository.findOne({
      where: { id: contractId, tenantId: user.tenantId },
      relations: ['signers', 'timelines'],
    });
    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    if (contract.status !== ContractStatus.COMPLETED && contract.status !== ContractStatus.VOIDED) {
      throw new BadRequestException('仅已完成或已作废的合同可归档');
    }

    const signers = contract.signers.map((signer) => ({
      id: signer.id,
      userId: signer.userId,
      name: signer.name,
      email: signer.email,
      phone: signer.phone,
      signOrder: signer.signOrder,
      status: signer.status,
      signMethod: signer.signMethod,
      signatureUrl: signer.signatureUrl,
      sealId: signer.sealId,
      signedAt: signer.signedAt,
      rejectReason: signer.rejectReason,
      ipAddress: signer.ipAddress,
      userAgent: signer.userAgent,
      digitalFingerprint: signer.digitalFingerprint,
    }));

    const timelines = contract.timelines.map((timeline) => ({
      id: timeline.id,
      action: timeline.action,
      operatorId: timeline.operatorId,
      operatorName: timeline.operatorName,
      remark: timeline.remark,
      ipAddress: timeline.ipAddress,
      userAgent: timeline.userAgent,
      metadata: timeline.metadata,
      createdAt: timeline.createdAt,
    }));

    const signerEvidence = contract.signers
      .filter((s) => s.status === 'signed' || s.status === 'rejected')
      .map((signer) => ({
        type: 'signer_action',
        signerId: signer.id,
        signerName: signer.name,
        action: signer.status === 'signed' ? '签署' : '拒签',
        signedAt: signer.signedAt,
        signMethod: signer.signMethod,
        ipAddress: signer.ipAddress,
        userAgent: signer.userAgent,
        digitalFingerprint: signer.digitalFingerprint,
        rejectReason: signer.rejectReason,
      }));

    const evidenceChain: Record<string, any>[] = [
      ...timelines.map((t) => ({ type: 'timeline', ...t })),
      ...signerEvidence,
    ].sort((a: Record<string, any>, b: Record<string, any>) => {
      const dateA = a.createdAt || a.signedAt;
      const dateB = b.createdAt || b.signedAt;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    const certificateUrl = await this.pdfService.generateSigningCertificate(
      contract,
      contract.signers,
      contract.timelines,
    );

    const archivedAt = new Date();
    const retentionDays = 3650;
    const expiryDate = dayjs(archivedAt).add(retentionDays, 'day').toDate();

    let initiatorName = '';
    const initiatorSigner = contract.signers.find((s) => s.userId === contract.initiatorId);
    if (initiatorSigner) {
      initiatorName = initiatorSigner.name;
    } else {
      initiatorName = user.email;
    }

    const archive = this.archiveRepository.create({
      tenantId: user.tenantId,
      contractId: contract.id,
      contractNo: contract.contractNo,
      title: contract.title,
      initiatorId: contract.initiatorId,
      initiatorName,
      signers,
      contractStatus: contract.status,
      pdfFileUrl: contract.pdfFileUrl,
      signedPdfUrl: contract.signedPdfUrl,
      certificateUrl,
      digitalFingerprint: contract.digitalFingerprint || '',
      evidenceChain,
      completedAt: contract.completedAt,
      archivedAt,
      retentionDays,
      expiryDate,
      isVoided: contract.status === ContractStatus.VOIDED,
      voidReason: contract.voidReason,
      tags: contract.tags as unknown as string[],
      reminderSent: false,
      createdBy: user.userId,
      updatedBy: user.userId,
    });

    const savedArchive = await this.archiveRepository.save(archive);

    this.logger.log(
      `合同归档成功: archiveId=${savedArchive.id}, contractId=${contract.id}, operator=${user.userId}`,
    );

    return savedArchive;
  }

  async findAll(
    query: QueryArchiveDto,
    user: CurrentUserPayload,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<PaginatedArchives> {
    const queryBuilder = this.archiveRepository.createQueryBuilder('archive');

    queryBuilder.where('archive.tenantId = :tenantId', {
      tenantId: user.tenantId,
    });

    if (query.title) {
      queryBuilder.andWhere('archive.title ILIKE :title', {
        title: `%${query.title}%`,
      });
    }

    if (query.initiatorId) {
      queryBuilder.andWhere('archive.initiatorId = :initiatorId', {
        initiatorId: query.initiatorId,
      });
    }

    if (query.signerName) {
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("archive.signers::jsonb @> :signerNameJson::jsonb", {
            signerNameJson: JSON.stringify([{ name: query.signerName }]),
          }).orWhere("archive.signers::text ILIKE :signerNamePattern", {
            signerNamePattern: `%${query.signerName}%`,
          });
        }),
      );
    }

    if (query.contractStatus) {
      queryBuilder.andWhere('archive.contractStatus = :contractStatus', {
        contractStatus: query.contractStatus,
      });
    }

    if (query.startDate && query.endDate) {
      queryBuilder.andWhere(
        '(archive.archivedAt BETWEEN :startDate AND :endDate OR archive.completedAt BETWEEN :startDate AND :endDate)',
        {
          startDate: new Date(query.startDate),
          endDate: new Date(query.endDate),
        },
      );
    } else if (query.startDate) {
      queryBuilder.andWhere(
        '(archive.archivedAt >= :startDate OR archive.completedAt >= :startDate)',
        {
          startDate: new Date(query.startDate),
        },
      );
    } else if (query.endDate) {
      queryBuilder.andWhere(
        '(archive.archivedAt <= :endDate OR archive.completedAt <= :endDate)',
        {
          endDate: new Date(query.endDate),
        },
      );
    }

    if (query.tags && query.tags.length > 0) {
      queryBuilder.andWhere('archive.tags::jsonb @> :tags::jsonb', {
        tags: JSON.stringify(query.tags),
      });
    }

    if (query.isVoided !== undefined) {
      queryBuilder.andWhere('archive.isVoided = :isVoided', {
        isVoided: query.isVoided === 'true',
      });
    }

    queryBuilder.orderBy('archive.archivedAt', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string, user: CurrentUserPayload): Promise<Archive> {
    const archive = await this.archiveRepository.findOne({
      where: { id, tenantId: user.tenantId },
    });

    if (!archive) {
      throw new NotFoundException('归档记录不存在');
    }

    return archive;
  }

  async downloadCertificate(id: string, user: CurrentUserPayload): Promise<{ url: string }> {
    const archive = await this.findOne(id, user);

    if (archive.certificateUrl) {
      return { url: archive.certificateUrl };
    }

    const contract = await this.contractRepository.findOne({
      where: { id: archive.contractId },
      relations: ['signers', 'timelines'],
    });

    if (!contract) {
      throw new NotFoundException('合同不存在，无法生成证书');
    }

    const certificateUrl = await this.pdfService.generateSigningCertificate(
      contract,
      contract.signers,
      contract.timelines,
    );

    archive.certificateUrl = certificateUrl;
    archive.updatedBy = user.userId;
    await this.archiveRepository.save(archive);

    return { url: certificateUrl };
  }

  async downloadContract(id: string, user: CurrentUserPayload): Promise<{ url: string }> {
    const archive = await this.findOne(id, user);

    if (!archive.signedPdfUrl) {
      throw new NotFoundException('已签署PDF不存在');
    }

    return { url: archive.signedPdfUrl };
  }

  async getEvidenceChain(
    archiveId: string,
    user: CurrentUserPayload,
  ): Promise<{
    archive: Archive;
    evidenceChain: Record<string, any>[];
  }> {
    const archive = await this.findOne(archiveId, user);

    return {
      archive,
      evidenceChain: archive.evidenceChain,
    };
  }

  async extendRetention(
    id: string,
    days: number,
    user: CurrentUserPayload,
  ): Promise<Archive> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('仅管理员可延长归档保管期限');
    }

    if (days <= 0) {
      throw new BadRequestException('延长天数必须大于0');
    }

    const archive = await this.findOne(id, user);

    archive.retentionDays += days;
    archive.expiryDate = dayjs(archive.archivedAt)
      .add(archive.retentionDays, 'day')
      .toDate();
    archive.updatedBy = user.userId;

    const savedArchive = await this.archiveRepository.save(archive);

    this.logger.log(
      `延长归档期限成功: archiveId=${id}, 延长天数=${days}, 新到期日=${savedArchive.expiryDate}, operator=${user.userId}`,
    );

    return savedArchive;
  }

  async markReminderSent(id: string, user: CurrentUserPayload): Promise<Archive> {
    const archive = await this.findOne(id, user);

    archive.reminderSent = true;
    archive.updatedBy = user.userId;

    return this.archiveRepository.save(archive);
  }
}
