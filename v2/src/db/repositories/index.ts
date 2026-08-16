import { db } from "@/db/database";
import { LocalClientRepository } from "./client.repository";
import { LocalJobRepository } from "./job.repository";
import { LocalGroupRepository } from "./group.repository";
import { LocalTemplateRepository } from "./template.repository";
import { LocalLoadingRepository } from "./loading.repository";
import { LocalWorkerRepository } from "./worker.repository";
import { LocalStayRepository } from "./stay.repository";
import { LocalMigrationRepository } from "./migration.repository";

/**
 * Single place the app wires repository interfaces to their concrete
 * implementation. Features/components import from here (e.g.
 * `import { clientRepository } from "@/db/repositories"`), never from a
 * specific `Local*Repository` class - this is what lets a future
 * `RemoteJobRepository`/`SyncingJobRepository` swap in later by editing only
 * this file. See ARCHITECTURE.md §3.
 */
export const clientRepository = new LocalClientRepository(db);
export const jobRepository = new LocalJobRepository(db);
export const groupRepository = new LocalGroupRepository(db);
export const templateRepository = new LocalTemplateRepository(db);
export const loadingRepository = new LocalLoadingRepository(db);
export const workerRepository = new LocalWorkerRepository(db);
export const stayRepository = new LocalStayRepository(db);
export const migrationRepository = new LocalMigrationRepository(db);

export type { ClientRepository } from "./client.repository";
export type { JobRepository } from "./job.repository";
export type { GroupRepository } from "./group.repository";
export type { TemplateRepository } from "./template.repository";
export type { LoadingRepository } from "./loading.repository";
export type { WorkerRepository } from "./worker.repository";
export type { StayRepository } from "./stay.repository";
export type { MigrationRepository } from "./migration.repository";
