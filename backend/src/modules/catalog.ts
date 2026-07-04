import { attendanceModule } from "./attendance/index.js";
import { authModule } from "./auth/index.js";
import { clientsModule } from "./clients/index.js";
import { dashboardModule } from "./dashboard/index.js";
import { memberGroupsModule } from "./memberGroups/index.js";
import { peopleModule } from "./people/index.js";
import { profileModule } from "./profile/index.js";
import { schedulingModule } from "./scheduling/index.js";
import { systemsModule } from "./systems/index.js";

export const appModules = [
  authModule,
  clientsModule,
  peopleModule,
  memberGroupsModule,
  profileModule,
  attendanceModule,
  dashboardModule,
  systemsModule,
  schedulingModule
];
