import type { RequestHandler } from 'express';
import type { AccessControlService } from '../services/access-control.service.js';
import type { TokenPayload } from '../services/token.service.js';
import type { AuditLogQueryInput, PaginationInput } from '../schemas/access-control.schemas.js';

interface IdPair { params: Record<string, string> }

export class AccessControlController {
  constructor(private readonly access: AccessControlService) {}

  readonly listUsers: RequestHandler = async (_req, res, next) => {
    try { res.json(await this.access.listUsers(this.pageQuery(res.locals.input))); } catch (error) { next(error); }
  };
  readonly listRoles: RequestHandler = async (_req, res, next) => {
    try { res.json(await this.access.listRoles(this.pageQuery(res.locals.input))); } catch (error) { next(error); }
  };
  readonly listPermissions: RequestHandler = async (_req, res, next) => {
    try { res.json(await this.access.listPermissions(this.pageQuery(res.locals.input))); } catch (error) { next(error); }
  };
  readonly listGroups: RequestHandler = async (_req, res, next) => {
    try { res.json(await this.access.listGroups(this.pageQuery(res.locals.input))); } catch (error) { next(error); }
  };
  readonly listAuditLogs: RequestHandler = async (_req, res, next) => {
    try {
      const { query } = res.locals.input as { query: AuditLogQueryInput };
      res.json(await this.access.listAuditLogs(query));
    } catch (error) { next(error); }
  };
  readonly getRole: RequestHandler = async (_req, res, next) => {
    try {
      const { params } = res.locals.input as IdPair;
      res.json({ role: await this.access.getRole(this.param(params, 'roleId')) });
    } catch (error) { next(error); }
  };
  readonly getGroup: RequestHandler = async (_req, res, next) => {
    try {
      const { params } = res.locals.input as IdPair;
      res.json({ group: await this.access.getGroup(this.param(params, 'groupId')) });
    } catch (error) { next(error); }
  };
  readonly createRole: RequestHandler = async (_req, res, next) => {
    try {
      const { body } = res.locals.input as { body: { name: string; description?: string } };
      const role = await this.access.createRole(this.actorId(res.locals.auth), body);
      res.location(`/api/v1/roles/${role.id}`).status(201).json({ role });
    } catch (error) { next(error); }
  };
  readonly createGroup: RequestHandler = async (_req, res, next) => {
    try {
      const { body } = res.locals.input as { body: { name: string; description?: string } };
      const group = await this.access.createGroup(this.actorId(res.locals.auth), body);
      res.location(`/api/v1/groups/${group.id}`).status(201).json({ group });
    } catch (error) { next(error); }
  };

  readonly assignPermissionToRole = this.relationshipHandler(
    (actorId, params) => this.access.assignPermissionToRole(actorId, this.param(params, 'roleId'), this.param(params, 'permissionId')),
  );
  readonly removePermissionFromRole = this.relationshipHandler(
    (actorId, params) => this.access.removePermissionFromRole(actorId, this.param(params, 'roleId'), this.param(params, 'permissionId')),
  );
  readonly assignRoleToUser = this.relationshipHandler(
    (actorId, params) => this.access.assignRoleToUser(actorId, this.param(params, 'userId'), this.param(params, 'roleId')),
  );
  readonly removeRoleFromUser = this.relationshipHandler(
    (actorId, params) => this.access.removeRoleFromUser(actorId, this.param(params, 'userId'), this.param(params, 'roleId')),
  );
  readonly assignRoleToGroup = this.relationshipHandler(
    (actorId, params) => this.access.assignRoleToGroup(actorId, this.param(params, 'groupId'), this.param(params, 'roleId')),
  );
  readonly removeRoleFromGroup = this.relationshipHandler(
    (actorId, params) => this.access.removeRoleFromGroup(actorId, this.param(params, 'groupId'), this.param(params, 'roleId')),
  );
  readonly addUserToGroup = this.relationshipHandler(
    (actorId, params) => this.access.addUserToGroup(actorId, this.param(params, 'groupId'), this.param(params, 'userId')),
  );
  readonly removeUserFromGroup = this.relationshipHandler(
    (actorId, params) => this.access.removeUserFromGroup(actorId, this.param(params, 'groupId'), this.param(params, 'userId')),
  );

  private relationshipHandler(action: (actorId: string, params: Record<string, string>) => Promise<void>): RequestHandler {
    return async (_req, res, next) => {
      try {
        const { params } = res.locals.input as IdPair;
        await action(this.actorId(res.locals.auth), params);
        res.status(204).end();
      } catch (error) { next(error); }
    };
  }

  private actorId(auth: unknown): string {
    return (auth as TokenPayload).userId;
  }

  private pageQuery(input: unknown): PaginationInput {
    return (input as { query: PaginationInput }).query;
  }

  private param(params: Record<string, string>, name: string): string {
    const value = params[name];
    if (!value) throw new Error(`Validated route parameter ${name} is missing`);
    return value;
  }
}
