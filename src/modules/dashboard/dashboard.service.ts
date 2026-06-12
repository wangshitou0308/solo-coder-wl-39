import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { Contract } from '../contract/entities/contract.entity';
import { ContractStatus } from '../../common/enums';

export interface MonthlyTrendItem {
  month: string;
  initiated: number;
  completed: number;
}

export interface StatusDistributionItem {
  status: ContractStatus;
  count: number;
}

export interface TenantStats {
  monthlyInitiated: number;
  monthlyCompleted: number;
  avgSignCycle: number;
  rejectionRate: number;
  pendingSigning: number;
  expiringSoon: number;
  monthlyTrend: MonthlyTrendItem[];
  statusDistribution: StatusDistributionItem[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  async getTenantStats(tenantId: string): Promise<TenantStats> {
    const now = dayjs();
    const monthStart = now.startOf('month');
    const sevenDaysLater = now.add(7, 'day');

    const [
      monthlyInitiated,
      monthlyCompleted,
      avgSignCycle,
      rejectionRate,
      pendingSigning,
      expiringSoon,
      monthlyTrend,
      statusDistribution,
    ] = await Promise.all([
      this.getMonthlyInitiated(tenantId, monthStart.toDate()),
      this.getMonthlyCompleted(tenantId, monthStart.toDate(), now.toDate()),
      this.getAvgSignCycle(tenantId),
      this.getRejectionRate(tenantId),
      this.getPendingSigning(tenantId),
      this.getExpiringSoon(tenantId, now.toDate(), sevenDaysLater.toDate()),
      this.getMonthlyTrend(tenantId),
      this.getStatusDistribution(tenantId),
    ]);

    return {
      monthlyInitiated,
      monthlyCompleted,
      avgSignCycle,
      rejectionRate,
      pendingSigning,
      expiringSoon,
      monthlyTrend,
      statusDistribution,
    };
  }

  private async getMonthlyInitiated(
    tenantId: string,
    monthStart: Date,
  ): Promise<number> {
    return this.contractRepository
      .createQueryBuilder('contract')
      .where('contract.tenantId = :tenantId', { tenantId })
      .andWhere('contract.createdAt >= :monthStart', { monthStart })
      .getCount();
  }

  private async getMonthlyCompleted(
    tenantId: string,
    monthStart: Date,
    now: Date,
  ): Promise<number> {
    return this.contractRepository
      .createQueryBuilder('contract')
      .where('contract.tenantId = :tenantId', { tenantId })
      .andWhere('contract.status = :status', { status: ContractStatus.COMPLETED })
      .andWhere('contract.completedAt >= :monthStart', { monthStart })
      .andWhere('contract.completedAt <= :now', { now })
      .getCount();
  }

  private async getAvgSignCycle(tenantId: string): Promise<number> {
    const result = await this.contractRepository
      .createQueryBuilder('contract')
      .select('AVG(EXTRACT(EPOCH FROM (contract.completedAt - contract.createdAt)))', 'avgSeconds')
      .where('contract.tenantId = :tenantId', { tenantId })
      .andWhere('contract.status = :status', { status: ContractStatus.COMPLETED })
      .andWhere('contract.completedAt IS NOT NULL')
      .getRawOne();

    const avgSeconds = parseFloat(result?.avgSeconds || '0');
    return avgSeconds > 0 ? Number((avgSeconds / 3600).toFixed(2)) : 0;
  }

  private async getRejectionRate(tenantId: string): Promise<number> {
    const result = await this.contractRepository
      .createQueryBuilder('contract')
      .select(
        "SUM(CASE WHEN contract.status = :rejected THEN 1 ELSE 0 END)",
        'rejectedCount',
      )
      .addSelect(
        "SUM(CASE WHEN contract.status IN (:...statuses) THEN 1 ELSE 0 END)",
        'totalCount',
      )
      .where('contract.tenantId = :tenantId', { tenantId })
      .setParameter('rejected', ContractStatus.REJECTED)
      .setParameter('statuses', [ContractStatus.COMPLETED, ContractStatus.REJECTED])
      .getRawOne();

    const rejectedCount = parseInt(result?.rejectedCount || '0', 10);
    const totalCount = parseInt(result?.totalCount || '0', 10);

    if (totalCount === 0) {
      return 0;
    }

    return Number(((rejectedCount / totalCount) * 100).toFixed(2));
  }

  private async getPendingSigning(tenantId: string): Promise<number> {
    return this.contractRepository
      .createQueryBuilder('contract')
      .where('contract.tenantId = :tenantId', { tenantId })
      .andWhere('contract.status = :status', { status: ContractStatus.SIGNING })
      .getCount();
  }

  private async getExpiringSoon(
    tenantId: string,
    now: Date,
    sevenDaysLater: Date,
  ): Promise<number> {
    return this.contractRepository
      .createQueryBuilder('contract')
      .where('contract.tenantId = :tenantId', { tenantId })
      .andWhere('contract.status = :status', { status: ContractStatus.SIGNING })
      .andWhere('contract.signDeadline IS NOT NULL')
      .andWhere('contract.signDeadline >= :now', { now })
      .andWhere('contract.signDeadline <= :sevenDaysLater', { sevenDaysLater })
      .getCount();
  }

  private async getMonthlyTrend(tenantId: string): Promise<MonthlyTrendItem[]> {
    const months: MonthlyTrendItem[] = [];
    const now = dayjs();

    for (let i = 11; i >= 0; i--) {
      const monthDate = now.subtract(i, 'month');
      const monthStr = monthDate.format('YYYY-MM');
      const startOfMonth = monthDate.startOf('month').toDate();
      const endOfMonth = monthDate.endOf('month').toDate();

      const [initiated, completed] = await Promise.all([
        this.contractRepository
          .createQueryBuilder('contract')
          .where('contract.tenantId = :tenantId', { tenantId })
          .andWhere('contract.createdAt >= :startOfMonth', { startOfMonth })
          .andWhere('contract.createdAt <= :endOfMonth', { endOfMonth })
          .getCount(),
        this.contractRepository
          .createQueryBuilder('contract')
          .where('contract.tenantId = :tenantId', { tenantId })
          .andWhere('contract.status = :status', { status: ContractStatus.COMPLETED })
          .andWhere('contract.completedAt >= :startOfMonth', { startOfMonth })
          .andWhere('contract.completedAt <= :endOfMonth', { endOfMonth })
          .getCount(),
      ]);

      months.push({
        month: monthStr,
        initiated,
        completed,
      });
    }

    return months;
  }

  private async getStatusDistribution(
    tenantId: string,
  ): Promise<StatusDistributionItem[]> {
    const results = await this.contractRepository
      .createQueryBuilder('contract')
      .select('contract.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('contract.tenantId = :tenantId', { tenantId })
      .groupBy('contract.status')
      .getRawMany();

    const distributionMap = new Map<ContractStatus, number>();
    for (const status of Object.values(ContractStatus)) {
      distributionMap.set(status, 0);
    }

    for (const result of results) {
      const status = result.status as ContractStatus;
      const count = parseInt(result.count, 10);
      if (distributionMap.has(status)) {
        distributionMap.set(status, count);
      }
    }

    return Array.from(distributionMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));
  }
}
