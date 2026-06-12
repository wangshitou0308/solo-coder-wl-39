import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seal } from './entities/seal.entity';
import { CreateSealDto } from './dto/create-seal.dto';
import { UpdateSealDto } from './dto/update-seal.dto';

@Injectable()
export class SealService {
  constructor(
    @InjectRepository(Seal)
    private readonly sealRepository: Repository<Seal>,
  ) {}

  async create(
    tenantId: string,
    createSealDto: CreateSealDto,
    userId: string,
  ): Promise<Seal> {
    const seal = this.sealRepository.create({
      ...createSealDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.sealRepository.save(seal);
  }

  async findAll(tenantId: string): Promise<Seal[]> {
    return this.sealRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Seal> {
    const seal = await this.sealRepository.findOne({
      where: { id, tenantId },
    });
    if (!seal) {
      throw new NotFoundException('印章不存在');
    }
    return seal;
  }

  async update(
    id: string,
    tenantId: string,
    updateSealDto: UpdateSealDto,
    userId: string,
  ): Promise<Seal> {
    const seal = await this.findOne(id, tenantId);
    Object.assign(seal, updateSealDto);
    seal.updatedBy = userId;
    return this.sealRepository.save(seal);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const seal = await this.findOne(id, tenantId);
    await this.sealRepository.remove(seal);
  }
}
