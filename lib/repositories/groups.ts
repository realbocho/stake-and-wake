import { randomUUID } from "crypto";
import { getSql } from "@/lib/db";
import type { GroupView } from "@/lib/types";

type GroupRow = {
  id: string;
  name: string;
  invite_code: string;
  member_count: number;
};

function mapGroup(row: GroupRow): GroupView {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    memberCount: row.member_count
  };
}

export async function joinGroupByInviteCode(userId: string, inviteCode: string) {
  const sql = getSql();
  const [group] = await sql<GroupRow[]>`
    select id, name, invite_code,
           (select count(*)::int from group_membership gm where gm.group_id = group_room.id) as member_count
    from group_room
    where invite_code = ${inviteCode}
    limit 1
  `;
  if (!group) {
    throw new Error("Group invite code is invalid.");
  }

  await sql.begin(async (transaction) => {
    await transaction`
      insert into group_membership (id, user_id, group_id)
      values (${randomUUID()}, ${userId}, ${group.id})
      on conflict (user_id, group_id) do nothing
    `;

    const [countRow] = await transaction<{ count: number }[]>`
      select count(*)::int as count from group_membership where group_id = ${group.id}
    `;
    await transaction`
      update app_user
      set group_member_count = ${countRow?.count ?? group.member_count}
      where id = ${userId}
    `;
  });

  return mapGroup(group);
}
