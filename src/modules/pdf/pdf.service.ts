import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import * as dayjs from 'dayjs';
import { Contract } from '../contract/entities/contract.entity';
import { Signer } from '../signing/entities/signer.entity';
import { ContractTimeline } from '../contract/entities/contract-timeline.entity';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly uploadsDir = './uploads';
  private readonly archivesDir = './archives';

  constructor() {
    this.ensureDirectory(this.uploadsDir);
    this.ensureDirectory(this.archivesDir);
  }

  private ensureDirectory(dir: string): void {
    const fullPath = path.resolve(dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      this.logger.log(`创建目录: ${fullPath}`);
    }
  }

  private generateMockPdf(
    filename: string,
    content: string,
    directory: string = this.uploadsDir,
  ): string {
    const fullDir = path.resolve(directory);
    this.ensureDirectory(fullDir);

    const filePath = path.join(fullDir, filename);
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(16).text(content, { align: 'left' });

    doc.end();

    return path.normalize(filePath).replace(/\\/g, '/');
  }

  async generateContractPdf(contract: Contract): Promise<string> {
    const filename = `contract_${contract.id}_${dayjs().format('YYYYMMDDHHmmss')}.pdf`;
    const content = this.buildContractContent(contract);

    this.logger.log(`生成合同PDF: contractId=${contract.id}, filename=${filename}`);

    const fullDir = path.resolve(this.uploadsDir);
    this.ensureDirectory(fullDir);

    const filePath = path.join(fullDir, filename);
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(24).text('合同文件', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`合同编号: ${contract.contractNo}`);
    doc.text(`合同标题: ${contract.title}`);
    if (contract.description) {
      doc.text(`合同描述: ${contract.description}`);
    }
    doc.text(`创建时间: ${dayjs(contract.createdAt).format('YYYY-MM-DD HH:mm:ss')}`);
    if (contract.signDeadline) {
      doc.text(`签署截止: ${dayjs(contract.signDeadline).format('YYYY-MM-DD HH:mm:ss')}`);
    }
    doc.moveDown();

    if (contract.signers && contract.signers.length > 0) {
      doc.fontSize(18).text('签署方信息:', { underline: true });
      doc.moveDown();
      contract.signers.forEach((signer, index) => {
        doc.fontSize(12).text(`${index + 1}. ${signer.name}`);
        if (signer.email) doc.text(`   邮箱: ${signer.email}`);
        if (signer.phone) doc.text(`   电话: ${signer.phone}`);
        doc.text(`   顺序: ${signer.signOrder}`);
        doc.moveDown(0.5);
      });
    }

    doc.moveDown();
    if (contract.content) {
      doc.fontSize(16).text('合同内容:', { underline: true });
      doc.moveDown();
      doc.fontSize(11).text(contract.content);
    }

    if (contract.digitalFingerprint) {
      doc.moveDown();
      doc.fontSize(10).text(`合同数字指纹: ${contract.digitalFingerprint}`);
    }

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        const resultPath = path.normalize(filePath).replace(/\\/g, '/');
        this.logger.log(`合同PDF生成成功: ${resultPath}`);
        resolve(resultPath);
      });
      stream.on('error', (err) => {
        this.logger.error(`合同PDF生成失败: ${err.message}`);
        reject(err);
      });
    });
  }

  async generateSigningCertificate(
    contract: Contract,
    signers: Signer[],
    timelines: ContractTimeline[],
  ): Promise<string> {
    const filename = `certificate_${contract.id}_${dayjs().format('YYYYMMDDHHmmss')}.pdf`;

    this.logger.log(
      `生成签署证书PDF: contractId=${contract.id}, signers=${signers.length}, timelines=${timelines.length}`,
    );

    const fullDir = path.resolve(this.archivesDir);
    this.ensureDirectory(fullDir);

    const filePath = path.join(fullDir, filename);
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    doc.fontSize(26).text('签署完成证书', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text('Signing Completion Certificate', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).text('一、合同基本信息', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`合同编号: ${contract.contractNo}`);
    doc.text(`合同标题: ${contract.title}`);
    if (contract.description) {
      doc.text(`合同描述: ${contract.description}`);
    }
    doc.text(`发起人ID: ${contract.initiatorId}`);
    doc.text(`签署模式: ${contract.signingMode}`);
    doc.text(`合同状态: ${contract.status}`);
    if (contract.completedAt) {
      doc.text(`完成时间: ${dayjs(contract.completedAt).format('YYYY-MM-DD HH:mm:ss')}`);
    }
    doc.moveDown();

    doc.fontSize(14).text('二、签署人信息', { underline: true });
    doc.moveDown();
    signers.forEach((signer, index) => {
      doc.fontSize(12).text(`${index + 1}. ${signer.name}`);
      if (signer.email) doc.text(`   邮箱: ${signer.email}`);
      if (signer.phone) doc.text(`   电话: ${signer.phone}`);
      doc.text(`   签署状态: ${signer.status}`);
      if (signer.signMethod) {
        doc.text(`   签署方式: ${signer.signMethod}`);
      }
      if (signer.signedAt) {
        doc.text(`   签署时间: ${dayjs(signer.signedAt).format('YYYY-MM-DD HH:mm:ss')}`);
      }
      if (signer.digitalFingerprint) {
        doc.text(`   签名指纹: ${signer.digitalFingerprint}`);
      }
      if (signer.ipAddress) {
        doc.text(`   IP地址: ${signer.ipAddress}`);
      }
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.fontSize(14).text('三、签署时间线', { underline: true });
    doc.moveDown();
    timelines.forEach((timeline, index) => {
      doc.fontSize(11).text(
        `${index + 1}. [${dayjs(timeline.createdAt).format('YYYY-MM-DD HH:mm:ss')}] ${timeline.action}`,
      );
      if (timeline.operatorName) {
        doc.text(`   操作人: ${timeline.operatorName}`);
      }
      if (timeline.remark) {
        doc.text(`   备注: ${timeline.remark}`);
      }
      doc.moveDown(0.3);
    });

    doc.moveDown();
    doc.fontSize(14).text('四、数字证据', { underline: true });
    doc.moveDown();
    if (contract.digitalFingerprint) {
      doc.fontSize(11).text(`合同数字指纹 (SHA-256): ${contract.digitalFingerprint}`);
    }
    doc.text(`证书生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
    doc.text(`证书编号: CERT-${contract.id}-${dayjs().format('YYYYMMDDHHmmss')}`);

    doc.moveDown(3);
    doc.fontSize(10).text(
      '本证书由电子签名系统自动生成，证明上述合同已完成所有签署流程。',
      { align: 'center' },
    );
    doc.text(
      'This certificate is automatically generated by the e-signing system.',
      { align: 'center' },
    );

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        const resultPath = path.normalize(filePath).replace(/\\/g, '/');
        this.logger.log(`签署证书PDF生成成功: ${resultPath}`);
        resolve(resultPath);
      });
      stream.on('error', (err) => {
        this.logger.error(`签署证书PDF生成失败: ${err.message}`);
        reject(err);
      });
    });
  }

  private buildContractContent(contract: Contract): string {
    let content = `合同编号: ${contract.contractNo}\n`;
    content += `合同标题: ${contract.title}\n`;
    if (contract.description) {
      content += `合同描述: ${contract.description}\n`;
    }
    content += `创建时间: ${dayjs(contract.createdAt).format('YYYY-MM-DD HH:mm:ss')}\n`;
    if (contract.signDeadline) {
      content += `签署截止: ${dayjs(contract.signDeadline).format('YYYY-MM-DD HH:mm:ss')}\n`;
    }
    return content;
  }
}
