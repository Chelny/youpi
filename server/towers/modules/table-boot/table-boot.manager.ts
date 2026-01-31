import { createId } from "@paralleldrive/cuid2";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import { TableBoot, TableBootProps } from "@/server/towers/modules/table-boot/table-boot.entity";

export class TableBootManager {
  private static tableBoots: Map<string, TableBoot> = new Map<string, TableBoot>();

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): TableBoot | undefined {
    return this.tableBoots.get(id);
  }

  public static all(): TableBoot[] {
    return [...this.tableBoots.values()];
  }

  public static async create(props: Omit<TableBootProps, "id">): Promise<TableBoot> {
    const tableBoot: TableBoot = new TableBoot({ id: createId(), ...props });
    this.tableBoots.set(tableBoot.id, tableBoot);
    PlayerManager.updateLastActiveAt(props.booterPlayer.id);
    return tableBoot;
  }

  public static delete(id: string): void {
    this.tableBoots.delete(id);
  }
}
