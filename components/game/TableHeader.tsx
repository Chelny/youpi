"use client";

import { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import Banner from "@/components/Banner";
import { RoomLitePlainObject } from "@/server/towers/modules/room/room.entity";
import { TableLitePlainObject } from "@/server/towers/modules/table/table.entity";

type TableHeaderProps = {
  room?: RoomLitePlainObject
  table: TableLitePlainObject | null
};

export default function TableHeader({ room, table }: TableHeaderProps): ReactNode {
  const tableNumber: number | undefined = table?.tableNumber;
  const tableHostUsername: string | null | undefined = table?.hostPlayer.user.username;

  return (
    <div className="[grid-area:banner] flex justify-between items-center gap-6">
      <div className="p-4">
        <h1 className="text-3xl">
          <Trans>
            Table: {tableNumber} - Host: {tableHostUsername}
          </Trans>
        </h1>
        <h2 className="text-lg">{room?.name}</h2>
      </div>
      <Banner />
    </div>
  );
}
