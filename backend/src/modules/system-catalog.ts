import { SystemRegistry } from "../platform/systems.js";
import { attendanceSystem } from "./attendance/system.js";
import { schedulingSystem } from "./scheduling/system.js";

export const systemRegistry = new SystemRegistry([attendanceSystem, schedulingSystem]);
