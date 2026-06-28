import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Role } from '../auth/entities/role.entity';
import { User } from '../auth/entities/user.entity';
import { Division } from './entities/division.entity';

export type DivisionStaffLogin = {
  role: string;
  roleLabel: string;
  email: string;
  password: string;
  created: boolean;
};

const STAFF_TEMPLATES: Array<{
  roleCode: string;
  roleLabel: string;
  emailPrefix: string;
  password: string;
  firstName: string;
  lastName: string;
}> = [
  { roleCode: 'je', roleLabel: 'Junior Engineer', emailPrefix: 'je', password: 'JE@123', firstName: 'Junior', lastName: 'Engineer' },
  { roleCode: 'ae', roleLabel: 'Assistant Engineer', emailPrefix: 'ae', password: 'AE@123', firstName: 'Assistant', lastName: 'Engineer' },
  { roleCode: 'ee', roleLabel: 'Executive Engineer', emailPrefix: 'ee', password: 'EE@123', firstName: 'Executive', lastName: 'Engineer' },
  { roleCode: 'accounts', roleLabel: 'Accounts Officer', emailPrefix: 'accounts', password: 'Accounts@123', firstName: 'Accounts', lastName: 'Officer' },
];

@Injectable()
export class DivisionStaffProvisionerService {
  private readonly logger = new Logger(DivisionStaffProvisionerService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Division) private divisionRepo: Repository<Division>,
  ) {}

  divisionEmailSlug(division: Division): string {
    if (division.code?.toUpperCase().startsWith('DIV-')) {
      return division.code.slice(4).toLowerCase();
    }
    return division.name
      .replace(/\s+division$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 12);
  }

  demoPasswordForEmail(email: string): string {
    const local = email.split('@')[0]?.toLowerCase() ?? '';
    if (email === 'admin@egip.local') return 'Admin@123';
    if (email === 'gis@egip.local') return 'Gis@123';
    if (email === 'contractor@egip.local' || local.startsWith('contractor.')) return 'Contractor@123';
    if (local === 'accounts' || local.startsWith('accounts.')) return 'Accounts@123';
    if (local === 'ee' || local.startsWith('ee.')) return 'EE@123';
    if (local === 'ae' || local.startsWith('ae.')) return 'AE@123';
    if (local === 'je' || local.startsWith('je.')) return 'JE@123';
    return 'Admin@123';
  }

  roleLabelForEmail(email: string, roles: string[]): string {
    const template = STAFF_TEMPLATES.find((t) => {
      const local = email.split('@')[0]?.toLowerCase() ?? '';
      return local === t.emailPrefix || local.startsWith(`${t.emailPrefix}.`);
    });
    if (template) return template.roleLabel;
    if (roles.includes('super_admin')) return 'Administrator';
    if (roles.includes('contractor')) return 'Contractor';
    return roles[0] ?? 'Staff';
  }

  async ensureAllDivisionStaff(tenantId: string): Promise<void> {
    const divisions = await this.divisionRepo.find({
      where: { tenantId, status: 'active' },
      order: { name: 'ASC' },
    });
    for (const division of divisions) {
      if (!division.isHeadquarters) {
        await this.ensureDivisionStaff(tenantId, division.id);
      }
    }
  }

  async listDemoAccounts(tenantId: string): Promise<{
    headOffice: DivisionStaffLogin[];
    divisions: Array<{ divisionName: string; accounts: DivisionStaffLogin[] }>;
  }> {
    await this.ensureAllDivisionStaff(tenantId);

    const rows = await this.userRepo.query(
      `SELECT u.email,
              COALESCE(d.name, 'State / Other') AS division_name,
              COALESCE(d.is_headquarters, FALSE) AS is_headquarters,
              COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_division_assignments uda ON uda.user_id = u.id
       LEFT JOIN divisions d ON d.id = COALESCE(u.division_id, uda.division_id)
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.tenant_id = $1 AND u.status = 'active' AND u.email LIKE '%@egip.local'
       GROUP BY u.id, u.email, d.name, d.is_headquarters
       ORDER BY d.is_headquarters DESC, d.name NULLS LAST, u.email`,
      [tenantId],
    ) as Array<{ email: string; division_name: string; is_headquarters: boolean; roles: string[] }>;

    const headOffice: DivisionStaffLogin[] = [];
    const byDivision = new Map<string, DivisionStaffLogin[]>();

    const isDivisionStaffEmail = (email: string) => /^(je|ae|ee|accounts)\./i.test(email);
    const headOfficeEmails = new Set(['admin@egip.local', 'ee@egip.local']);

    for (const row of rows) {
      const roles = Array.isArray(row.roles) ? row.roles : [];
      const account: DivisionStaffLogin = {
        role: roles[0] ?? 'staff',
        roleLabel: this.roleLabelForEmail(row.email, roles),
        email: row.email,
        password: this.demoPasswordForEmail(row.email),
        created: false,
      };
      if (headOfficeEmails.has(row.email) || (row.is_headquarters && !isDivisionStaffEmail(row.email))) {
        headOffice.push(account);
        continue;
      }
      if (!isDivisionStaffEmail(row.email)) continue;
      const key = row.division_name;
      if (!byDivision.has(key)) byDivision.set(key, []);
      byDivision.get(key)!.push(account);
    }

    return {
      headOffice,
      divisions: [...byDivision.entries()].map(([divisionName, accounts]) => ({
        divisionName,
        accounts,
      })),
    };
  }

  async ensureDivisionStaff(
    tenantId: string,
    divisionId: string,
  ): Promise<DivisionStaffLogin[]> {
    const division = await this.divisionRepo.findOne({
      where: { id: divisionId, tenantId, status: 'active' },
    });
    if (!division || division.isHeadquarters) return [];

    const slug = this.divisionEmailSlug(division);
    const logins: DivisionStaffLogin[] = [];

    for (const template of STAFF_TEMPLATES) {
      const email = `${template.emailPrefix}.${slug}@egip.local`;
      const role = await this.roleRepo.findOne({
        where: { tenantId, code: template.roleCode },
      });
      if (!role) {
        this.logger.warn(`Role ${template.roleCode} not found for tenant ${tenantId}`);
        continue;
      }

      let user = await this.userRepo.findOne({
        where: { tenantId, email },
        relations: ['roles'],
      });
      let created = false;

      if (!user) {
        const passwordHash = await bcrypt.hash(template.password, 10);
        user = this.userRepo.create({
          tenantId,
          email,
          passwordHash,
          firstName: template.firstName,
          lastName: `(${slug.toUpperCase()})`,
          department: division.name,
          status: 'active',
          roles: [role],
        });
        user = await this.userRepo.save(user);
        created = true;
      } else {
        if (!user.roles?.some((r) => r.id === role.id)) {
          user.roles = [...(user.roles ?? []), role];
          await this.userRepo.save(user);
        }
        if (user.status !== 'active') {
          user.status = 'active';
          await this.userRepo.save(user);
        }
      }

      await this.assignUserDivision(user.id, divisionId);

      logins.push({
        role: template.roleCode,
        roleLabel: template.roleLabel,
        email,
        password: template.password,
        created,
      });
    }

    return logins;
  }

  private async assignUserDivision(userId: string, divisionId: string): Promise<void> {
    await this.userRepo.query(
      'UPDATE users SET division_id = $1 WHERE id = $2',
      [divisionId, userId],
    );
    await this.userRepo.query(
      `INSERT INTO user_division_assignments (user_id, division_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET division_id = EXCLUDED.division_id`,
      [userId, divisionId],
    );
  }
}
