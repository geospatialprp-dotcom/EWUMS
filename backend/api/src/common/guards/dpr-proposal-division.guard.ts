import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DivisionAccessService } from '../../modules/divisions/division-access.service';
import { JwtPayload } from '../../modules/auth/interfaces/jwt-payload.interface';
import { DprProposal } from '../../modules/dpr-planning/entities/dpr-proposal.entity';

/** Ensures the current user may access the :id DPR proposal route parameter. */
@Injectable()
export class DprProposalDivisionGuard implements CanActivate {
  constructor(
    private divisionAccess: DivisionAccessService,
    @InjectRepository(DprProposal) private proposalRepo: Repository<DprProposal>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    const proposalId = request.params?.id;
    if (!user?.tenantId || !proposalId) return true;

    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId, tenantId: user.tenantId },
    });
    if (!proposal) throw new NotFoundException('DPR proposal not found');

    const accessible = await this.divisionAccess.getAccessibleDivisionIds(user, user.tenantId);
    if (accessible === null) return true;
    if (!proposal.divisionId || !accessible.includes(proposal.divisionId)) {
      throw new ForbiddenException('This proposal belongs to another division. Access denied.');
    }
    return true;
  }
}
