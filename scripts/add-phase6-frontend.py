"""Append Phase 6 types + endpoints to frontend types/api files (Python edit because
the source files exceed the file tools' size limit)."""
import re

# ---------- 1. Types ----------
p = 'frontend/src/types/index.ts'
s = open(p).read()

types_block = '''

// ================= Phase 6 — Study Community =================

// ---- Admin & audit ----
export interface AdminUserRow {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AdminNote {
  id: string;
  title: string;
  subject: string | null;
  content: string;
  pageCount: number;
  selectedPages: number[];
  uploadedByName: string | null;
  isUniversal: boolean;
  createdAt: string;
}

export interface SyllabusEntry {
  id: string;
  board: string;
  grade: string;
  subject: string;
  chapters: Array<{ name: string; topics?: string[] }>;
  createdAt: string;
  updatedAt: string;
}

// ---- Programmes ----
export type ProgrammeStatus = 'suggested' | 'building' | 'active' | 'rejected' | 'archived';

export interface Programme {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  status: ProgrammeStatus;
  suggestedBy: string | null;
  suggesterName: string | null;
  aiBuilt: boolean;
  content: Record<string, unknown>;
  rewardPolicy: Record<string, unknown>;
  review: Record<string, unknown>;
  hasFactions: boolean;
  factionSize: number;
  joined?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestProgrammeRequest {
  name: string;
  description?: string;
  kind?: string;
  hasFactions?: boolean;
  factionSize?: number;
}

// ---- Factions ----
export interface Faction {
  id: string;
  programmeId: string | null;
  programmeName: string | null;
  name: string;
  color: string;
  targetSize: number;
  status: string;
  memberCount: number;
  myRole: string | null;
  score: number;
  createdAt: string;
}

export interface FactionMember {
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
}

export interface ElectionResult {
  userId: string;
  name: string;
  votes: number;
}

export interface HelpPledge {
  id: string;
  helperFactionId: string;
  helperName: string;
  helpedFactionId: string;
  helpedName: string;
  periodKey: string;
  status: string;
  activityCount: number;
}

// ---- Social ----
export interface FriendUser {
  userId: string;
  name: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  status: 'accepted' | 'pending' | 'blocked';
  direction: 'outgoing' | 'incoming';
}

export interface SearchUserResult {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

// ---- RPG parties ----
export interface RpgParty {
  id: string;
  leaderId: string;
  leaderName: string;
  name: string;
  maxMembers: number;
  memberCount: number;
  members: Array<{ userId: string; name: string }>;
  createdAt: string;
}

export interface RpgExamBoss {
  key: string;
  name: string;
  subject: string;
  lore: string;
}

export interface RpgPartyBattle {
  id: string;
  partyId: string;
  boss: { key: string; name: string; hp: number; maxHp: number; attack: number };
  examId: string | null;
  state: {
    seed: number;
    round: number;
    phase: string;
    boss: { key: string; name: string; hp: number; maxHp: number; attack: number };
    heroes: Array<{
      userId: string;
      name: string;
      isDown: boolean;
      actedThisRound: boolean;
      state: {
        playerHp: number;
        playerMana: number;
        maxHp: number;
        maxMana: number;
        hand: Array<{ instanceId: string; cardKey: string }>;
      };
    }>;
    log: Array<{ round: number; eventType: string; payload: Record<string, unknown> }>;
  };
  phase: string;
  rewardClaimed: boolean;
  reward: { xp: number; stp: number } | null;
  createdAt: string;
  updatedAt: string;
}
'''
s = s.rstrip() + '\n' + types_block
open(p, 'w').write(s)
print('types appended:', len(types_block), 'chars')

# ---------- 2. API endpoints ----------
p2 = 'frontend/src/config/api.ts'
s2 = open(p2).read()

endpoints_block = '''  // Phase 6 — Study Community
  admin: {
    users: '/admin/users',
    createUser: '/admin/users',
    updateUser: (id: string) => `/admin/users/${id}/update`,
    resetPassword: (id: string) => `/admin/users/${id}/reset-password`,
    auditLogs: '/admin/audit-logs',
  },
  programmes: {
    list: '/programmes',
    suggest: '/programmes',
    get: (id: string) => `/programmes/${id}`,
    join: (id: string) => `/programmes/${id}/join`,
    leave: (id: string) => `/programmes/${id}/leave`,
    review: (id: string) => `/programmes/${id}/review`,
    archive: (id: string) => `/programmes/${id}/archive`,
  },
  factions: {
    list: '/factions',
    mine: '/factions/mine',
    leaderboard: '/factions/leaderboard',
    helpPledges: '/factions/help-pledges',
    autoAssign: '/factions/auto-assign',
    vote: (id: string) => `/factions/${id}/vote`,
    members: (id: string) => `/factions/${id}/members`,
    election: (id: string) => `/factions/${id}/election`,
    help: (id: string) => `/factions/${id}/help`,
    promoteLeaders: (id: string) => `/factions/${id}/promote-leaders`,
    settle: '/factions/settle',
  },
  social: {
    searchUsers: '/social/users/search',
    friends: '/social/friends',
    conversations: '/social/conversations',
    request: '/social/friends/request',
    accept: (id: string) => `/social/friends/${id}/accept`,
    decline: (id: string) => `/social/friends/${id}/decline`,
    block: '/social/friends/block',
    messages: (friendId: string) => `/social/messages/${friendId}`,
    unread: '/social/unread',
  },
  adminNotes: {
    list: '/admin-notes',
    create: '/admin-notes',
    get: (id: string) => `/admin-notes/${id}`,
    remove: (id: string) => `/admin-notes/${id}`,
    syllabus: '/admin-notes/syllabus',
    syllabusItem: (id: string) => `/admin-notes/syllabus/${id}`,
  },
  rpgParty: {
    examBosses: '/rpg/exam-bosses',
    mine: '/rpg/parties/mine',
    create: '/rpg/parties',
    get: (id: string) => `/rpg/parties/${id}`,
    invite: (id: string) => `/rpg/parties/${id}/invite`,
    leave: (id: string) => `/rpg/parties/${id}/leave`,
    startBattle: (id: string) => `/rpg/parties/${id}/battles`,
    battles: (id: string) => `/rpg/parties/${id}/battles`,
    battle: (id: string) => `/rpg/party-battles/${id}`,
    battleAction: (id: string) => `/rpg/party-battles/${id}/action`,
    battleForfeit: (id: string) => `/rpg/party-battles/${id}/forfeit`,
  },
};'''

# Replace the closing of the ENDPOINTS object (last '};' — the rpg block ends with `  },\n};`)
assert s2.rstrip().endswith('};'), 'api.ts does not end with };'
s2 = s2.rstrip()[:-2].rstrip() + '\n' + endpoints_block + '\n'
open(p2, 'w').write(s2)
print('endpoints appended')

