import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FeaturesService {
  constructor(private prisma: PrismaService) {}

  async isEnabled(organizationId: string, featureId: string): Promise<boolean> {
    const orgFeature = await this.prisma.organizationFeature.findUnique({
      where: {
        organizationId_featureId: {
          organizationId,
          featureId,
        },
      },
    });
    return orgFeature ? orgFeature.isEnabled : false;
  }

  async getFeaturesForOrganization(organizationId: string) {
    const orgFeatures = await this.prisma.organizationFeature.findMany({
      where: { organizationId },
      include: {
        feature: true,
      },
    });

    return orgFeatures.reduce((acc, current) => {
      acc[current.featureId] = current.isEnabled;
      return acc;
    }, {} as Record<string, boolean>);
  }

  async updateFeatureFlag(organizationId: string, featureId: string, isEnabled: boolean) {
    return this.prisma.organizationFeature.upsert({
      where: {
        organizationId_featureId: {
          organizationId,
          featureId,
        },
      },
      update: { isEnabled },
      create: {
        organizationId,
        featureId,
        isEnabled,
      },
    });
  }
}
