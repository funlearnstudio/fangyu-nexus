import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";

@Injectable()
export class DemoAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    return request.headers["x-demo-role"] === "admin";
  }
}
