/**
 * OFFICE SCENE DERIVED DATA UTILS
 * ===============================
 * Pure helper functions used by office scene derived-data hooks.
 *
 * KEY CONCEPTS:
 * - Keep deterministic scene data helpers free of React and heavy scene dependencies.
 * - This file is the test seam for office scene data behavior.
 *
 * USAGE:
 * - Import from `use-office-scene-derived-data.ts`.
 * - Import directly in unit tests.
 *
 * MEMORY REFERENCES:
 * - MEM-0143
 * - MEM-0150
 */

import { SAMPLE_MESSAGES } from "../../constants/idle-messages";
import type { StatusType } from "../../features/nav-system/components/status-indicator";
import type { DeskLayoutData, EmployeeData, TeamData } from "../../lib/types";

function hashString(str: string): number {
  if (!str || str.length === 0) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: string, offset: number = 0): number {
  if (!seed) return 0.5;
  const hash = hashString(seed + offset.toString());
  return (hash % 1000) / 1000;
}

export function assignRandomStatuses(
  employees: EmployeeData[],
  teamWanderLocks: Map<string, number | undefined>,
): EmployeeData[] {
  const statusTypes: StatusType[] = ["info", "success", "question", "warning"];
  const now = Date.now();

  return employees.map((employee) => {
    const hasActiveHeartbeatState = Boolean(
      employee.heartbeatState &&
        employee.heartbeatState !== "idle" &&
        employee.heartbeatState !== "no_work",
    );
    const isIdleHeartbeatState =
      employee.heartbeatState === "idle" || employee.heartbeatState === "no_work";
    const teamLockUntil = teamWanderLocks.get(employee.teamId);
    const isTeamLocked = teamLockUntil !== undefined && teamLockUntil > now;

    if (employee.builtInRole === "ceo") {
      return {
        ...employee,
        status: "info" as StatusType,
        statusMessage: employee.statusMessage || "Managing the team",
        wantsToWander: false,
      };
    }

    const wanderRandom = seededRandom(employee._id, 1);
    const statusRandom = seededRandom(employee._id, 2);
    const statusTypeRandom = seededRandom(employee._id, 3);
    const messageRandom = seededRandom(employee._id, 4);
    const messageIndexRandom = seededRandom(employee._id, 5);

    const wantsToWander = isTeamLocked ? false : wanderRandom < 0.5;

    if (hasActiveHeartbeatState) {
      return {
        ...employee,
        wantsToWander,
      };
    }

    if (statusRandom < 0.6) {
      const randomStatus = statusTypes[Math.floor(statusTypeRandom * statusTypes.length)];
      const shouldHaveMessage = messageRandom < 0.75;
      const randomMessage = shouldHaveMessage
        ? SAMPLE_MESSAGES[Math.floor(messageIndexRandom * SAMPLE_MESSAGES.length)]
        : employee.statusMessage;
      const nextMessage = isIdleHeartbeatState
        ? randomMessage || employee.statusMessage
        : employee.statusMessage;

      return {
        ...employee,
        status: randomStatus as StatusType,
        statusMessage: nextMessage,
        wantsToWander,
      };
    }

    return {
      ...employee,
      wantsToWander,
    };
  });
}

export function buildDesksByTeamId(desks: DeskLayoutData[]): Map<string, DeskLayoutData[]> {
  const desksByTeamId = new Map<string, DeskLayoutData[]>();

  for (const desk of desks) {
    const prefix = "desk-";
    if (!desk.id.startsWith(prefix)) continue;
    const lastDashIndex = desk.id.lastIndexOf("-");
    if (lastDashIndex <= prefix.length) continue;
    const teamId = desk.id.slice(prefix.length, lastDashIndex);
    const current = desksByTeamId.get(teamId);
    if (current) {
      current.push(desk);
    } else {
      desksByTeamId.set(teamId, [desk]);
    }
  }

  return desksByTeamId;
}

export function buildTeamWanderLocks(teams: TeamData[]): Map<string, number | undefined> {
  const locks = new Map<string, number | undefined>();
  for (const team of teams) {
    locks.set(team._id, team.wanderLockUntil);
  }
  return locks;
}
