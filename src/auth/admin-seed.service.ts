import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { authConfig } from '../config/app.config.js';
import { UsersService } from '../users/users.service.js';
import { hashPassword } from './passwords.js';

// Lifecycle hook: runs once all modules are initialised (DB connected, migrations applied).
// Credentials come from the environment, never from a migration.
@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly users: UsersService,
    @Inject(authConfig.KEY) private readonly auth: ConfigType<typeof authConfig>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { adminEmail, adminPassword } = this.auth;
    if (!adminEmail || !adminPassword) return;
    if ((await this.users.countByRole('admin')) > 0) return;
    if (await this.users.findByEmail(adminEmail)) {
      this.logger.warn(`${adminEmail} already exists as a normal user; not promoting it`);
      return;
    }
    await this.users.create({ email: adminEmail, passwordHash: await hashPassword(adminPassword), role: 'admin' });
    this.logger.log(`Seeded admin ${adminEmail}`);
  }
}
