import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeaturesService } from './features.service';
import { FEATURE_KEY } from './feature.decorator';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private featuresService: FeaturesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.organizationId) {
      return false;
    }

    const isEnabled = await this.featuresService.isEnabled(user.organizationId, requiredFeature);

    if (!isEnabled) {
      throw new ForbiddenException(`The feature '${requiredFeature}' is not enabled for this workspace. Please upgrade your SaaS plan.`);
    }

    return true;
  }
}
