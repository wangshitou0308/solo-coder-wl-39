import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplateCategory } from '../../common/enums';

interface FindAllQuery {
  name?: string;
  category?: TemplateCategory;
  active?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
  ) {}

  async create(
    createTemplateDto: CreateTemplateDto,
    tenantId: string,
    userId: string,
  ): Promise<Template> {
    const template = this.templateRepository.create({
      ...createTemplateDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.templateRepository.save(template);
  }

  async findAll(
    query: FindAllQuery,
    tenantId: string,
  ): Promise<{ data: Template[]; total: number; page: number; limit: number }> {
    const { name, category, active, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const qb = this.templateRepository.createQueryBuilder('template');
    qb.where('template.tenantId = :tenantId', { tenantId });

    if (name) {
      qb.andWhere('template.name ILIKE :name', { name: `%${name}%` });
    }

    if (category) {
      qb.andWhere('template.category = :category', { category });
    }

    if (active !== undefined) {
      qb.andWhere('template.active = :active', { active });
    }

    qb.orderBy('template.createdAt', 'DESC');
    qb.skip(skip);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string, tenantId: string): Promise<Template> {
    const template = await this.templateRepository.findOne({
      where: { id, tenantId },
    });
    if (!template) {
      throw new NotFoundException('模板不存在');
    }
    return template;
  }

  async update(
    id: string,
    updateTemplateDto: UpdateTemplateDto,
    tenantId: string,
    userId: string,
  ): Promise<Template> {
    const template = await this.findOne(id, tenantId);
    Object.assign(template, updateTemplateDto);
    template.updatedBy = userId;
    return this.templateRepository.save(template);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const template = await this.findOne(id, tenantId);
    await this.templateRepository.remove(template);
  }

  async seedPresetTemplates(tenantId: string, userId: string): Promise<Template[]> {
    const presets = [
      {
        name: '采购合同模板',
        category: TemplateCategory.PURCHASE,
        description: '适用于货物采购业务的标准合同模板',
        content: `采购合同

甲方（采购方）：{{companyName}}
乙方（供应方）：{{supplierName}}
签订日期：{{signDate}}

根据《中华人民共和国民法典》及相关法律法规，甲乙双方本着平等互利、协商一致的原则，就甲方向乙方采购货物事宜，达成如下协议：

第一条 采购标的
1.1 货物名称：{{productName}}
1.2 规格型号：{{productSpec}}
1.3 数量：{{quantity}}
1.4 单价：{{unitPrice}}元
1.5 总价：{{amount}}元

第二条 质量标准
乙方所供货物应符合国家相关标准及双方约定的质量要求。

第三条 交货方式及期限
3.1 交货地点：{{deliveryAddress}}
3.2 交货期限：{{deliveryDate}}前

第四条 付款方式
4.1 付款方式：{{paymentMethod}}
4.2 付款时间：{{paymentTime}}

第五条 违约责任
双方应严格履行本合同约定，违约方应承担相应的违约责任。

第六条 争议解决
本合同履行过程中发生争议，双方应协商解决；协商不成的，提交有管辖权的人民法院诉讼解决。

甲方（盖章）：{{companyName}}
乙方（盖章）：{{supplierName}}
`,
        variables: [
          { name: 'companyName', label: '采购方名称', type: 'string', required: true },
          { name: 'supplierName', label: '供应方名称', type: 'string', required: true },
          { name: 'signDate', label: '签订日期', type: 'date', required: true },
          { name: 'productName', label: '货物名称', type: 'string', required: true },
          { name: 'productSpec', label: '规格型号', type: 'string', required: false },
          { name: 'quantity', label: '数量', type: 'number', required: true },
          { name: 'unitPrice', label: '单价', type: 'number', required: true },
          { name: 'amount', label: '总价', type: 'number', required: true },
          { name: 'deliveryAddress', label: '交货地点', type: 'string', required: true },
          { name: 'deliveryDate', label: '交货期限', type: 'date', required: true },
          { name: 'paymentMethod', label: '付款方式', type: 'string', required: true, defaultValue: '银行转账' },
          { name: 'paymentTime', label: '付款时间', type: 'string', required: true, defaultValue: '货到验收合格后30日内' },
        ],
      },
      {
        name: '服务协议模板',
        category: TemplateCategory.SERVICE,
        description: '适用于各类服务业务合作的标准协议模板',
        content: `服务协议

甲方（委托方）：{{companyName}}
乙方（服务方）：{{serviceProviderName}}
签订日期：{{signDate}}

根据《中华人民共和国民法典》及相关法律法规，甲乙双方本着平等互利、协商一致的原则，就乙方为甲方提供服务事宜，达成如下协议：

第一条 服务内容
1.1 服务名称：{{serviceName}}
1.2 服务范围：{{serviceScope}}
1.3 服务标准：{{serviceStandard}}

第二条 服务期限
2.1 服务起始日期：{{startDate}}
2.2 服务终止日期：{{endDate}}

第三条 服务费用及支付
3.1 服务费用总额：{{amount}}元
3.2 支付方式：{{paymentMethod}}
3.3 支付时间：{{paymentTime}}

第四条 双方权利义务
4.1 甲方应按约定向乙方支付服务费用。
4.2 乙方应按约定标准和时间提供服务。

第五条 保密条款
双方对在履行本合同过程中知悉的对方商业秘密负有保密义务。

第六条 违约责任
双方应严格履行本合同约定，违约方应承担相应的违约责任。

第七条 争议解决
本合同履行过程中发生争议，双方应协商解决；协商不成的，提交有管辖权的人民法院诉讼解决。

甲方（盖章）：{{companyName}}
乙方（盖章）：{{serviceProviderName}}
`,
        variables: [
          { name: 'companyName', label: '委托方名称', type: 'string', required: true },
          { name: 'serviceProviderName', label: '服务方名称', type: 'string', required: true },
          { name: 'signDate', label: '签订日期', type: 'date', required: true },
          { name: 'serviceName', label: '服务名称', type: 'string', required: true },
          { name: 'serviceScope', label: '服务范围', type: 'text', required: true },
          { name: 'serviceStandard', label: '服务标准', type: 'text', required: false },
          { name: 'startDate', label: '服务起始日期', type: 'date', required: true },
          { name: 'endDate', label: '服务终止日期', type: 'date', required: true },
          { name: 'amount', label: '服务费用总额', type: 'number', required: true },
          { name: 'paymentMethod', label: '支付方式', type: 'string', required: true, defaultValue: '银行转账' },
          { name: 'paymentTime', label: '支付时间', type: 'string', required: true, defaultValue: '服务完成验收合格后15日内' },
        ],
      },
      {
        name: '保密协议模板',
        category: TemplateCategory.NDA,
        description: '适用于商业合作中保护双方机密信息的保密协议模板',
        content: `保密协议

甲方：{{companyName}}
乙方：{{counterpartyName}}
签订日期：{{signDate}}

鉴于甲乙双方在业务合作过程中可能知悉对方的商业秘密，为保护双方合法权益，根据相关法律法规，经双方协商一致，达成如下保密协议：

第一条 保密信息
1.1 保密信息是指一方（披露方）向另一方（接收方）披露的与业务相关的任何技术信息、经营信息、客户信息、财务信息等。
1.2 保密信息包括但不限于：{{confidentialScope}}

第二条 保密义务
2.1 接收方应对保密信息严格保密，未经披露方书面同意，不得向任何第三方披露。
2.2 接收方应采取不低于保护自身同等重要信息的保密措施。

第三条 保密期限
保密期限自本协议签订之日起至{{confidentialPeriod}}年。

第四条 例外情形
下列信息不属于保密信息：
4.1 披露时已为公众所知的信息；
4.2 接收方在披露前已合法掌握的信息；
4.3 接收方从有权披露的第三方合法获得的信息。

第五条 违约责任
如接收方违反本协议约定，应赔偿披露方因此遭受的全部损失。

第六条 争议解决
本协议履行过程中发生争议，双方应协商解决；协商不成的，提交有管辖权的人民法院诉讼解决。

甲方（盖章）：{{companyName}}
乙方（盖章）：{{counterpartyName}}
`,
        variables: [
          { name: 'companyName', label: '甲方名称', type: 'string', required: true },
          { name: 'counterpartyName', label: '乙方名称', type: 'string', required: true },
          { name: 'signDate', label: '签订日期', type: 'date', required: true },
          { name: 'confidentialScope', label: '保密信息范围', type: 'text', required: false, defaultValue: '技术资料、商业计划、客户名单、财务数据等' },
          { name: 'confidentialPeriod', label: '保密期限（年）', type: 'number', required: true, defaultValue: 5 },
        ],
      },
      {
        name: '劳动合同模板',
        category: TemplateCategory.LABOR,
        description: '适用于企业与员工签订劳动合同的标准模板',
        content: `劳动合同

甲方（用人单位）：{{companyName}}
乙方（劳动者）：{{employeeName}}
身份证号码：{{employeeIdCard}}
签订日期：{{signDate}}

根据《中华人民共和国劳动合同法》及相关法律法规，甲乙双方本着平等自愿、协商一致的原则，签订本劳动合同。

第一条 劳动合同期限
1.1 合同类型：{{contractType}}
1.2 固定期限：自{{startDate}}起至{{endDate}}止。
1.3 试用期：{{probationPeriod}}个月，自{{startDate}}起计算。

第二条 工作内容和工作地点
2.1 工作岗位：{{position}}
2.2 工作地点：{{workLocation}}
2.3 工作内容：{{jobDescription}}

第三条 工作时间和休息休假
3.1 实行标准工时制度，每日工作不超过8小时，每周工作不超过40小时。
3.2 乙方依法享有国家规定的各类假期。

第四条 劳动报酬
4.1 月工资：{{salary}}元
4.2 工资发放日：每月{{payDay}}日
4.3 加班工资按国家相关规定执行。

第五条 社会保险
甲方依法为乙方缴纳社会保险。

第六条 劳动保护和劳动条件
甲方为乙方提供符合国家规定的劳动安全卫生条件和必要的劳动防护用品。

第七条 合同的解除和终止
7.1 本合同的解除和终止按国家法律法规及甲方规章制度执行。
7.2 任何一方解除劳动合同，应提前30日以书面形式通知对方。

第八条 争议解决
本合同履行过程中发生争议，双方应协商解决；协商不成的，可向劳动争议仲裁委员会申请仲裁。

甲方（盖章）：{{companyName}}
乙方（签字）：{{employeeName}}
`,
        variables: [
          { name: 'companyName', label: '用人单位名称', type: 'string', required: true },
          { name: 'employeeName', label: '劳动者姓名', type: 'string', required: true },
          { name: 'employeeIdCard', label: '身份证号码', type: 'string', required: true },
          { name: 'signDate', label: '签订日期', type: 'date', required: true },
          { name: 'contractType', label: '合同类型', type: 'string', required: true, defaultValue: '固定期限' },
          { name: 'startDate', label: '合同起始日期', type: 'date', required: true },
          { name: 'endDate', label: '合同终止日期', type: 'date', required: true },
          { name: 'probationPeriod', label: '试用期（月）', type: 'number', required: true, defaultValue: 3 },
          { name: 'position', label: '工作岗位', type: 'string', required: true },
          { name: 'workLocation', label: '工作地点', type: 'string', required: true },
          { name: 'jobDescription', label: '工作内容', type: 'text', required: false },
          { name: 'salary', label: '月工资', type: 'number', required: true },
          { name: 'payDay', label: '工资发放日', type: 'number', required: true, defaultValue: 15 },
        ],
      },
    ];

    const seededTemplates: Template[] = [];
    for (const preset of presets) {
      const existing = await this.templateRepository.findOne({
        where: { category: preset.category, tenantId },
      });
      if (!existing) {
        const template = this.templateRepository.create({
          ...preset,
          tenantId,
          createdBy: userId,
          updatedBy: userId,
        });
        seededTemplates.push(await this.templateRepository.save(template));
      }
    }
    return seededTemplates;
  }
}
